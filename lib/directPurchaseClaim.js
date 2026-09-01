// The read and write sides of claiming a direct purchase (#272).
//
// lib/directPurchase.js decides and words; this fetches what those judgments need
// and performs the write: the Draft a site raises from a `Direct Purchases` row,
// with the office's invoice re-uploaded as its quotation.
//
// THE SHAPE IS lib/overagePR.js's, AND SO IS THE REASON. Both take a record that
// is not a request and produce one; both are strips above `/prs` gated by the
// Job; both hand the requester straight into #72's Draft resume path. What
// differs is only what the record knows — an over-delivery knows the item, the
// quantity and the price, so its draft arrives complete; a direct purchase knows
// the vendor and the document, so its draft arrives with the quotation and
// nothing else.
//
// THE FILE IS RE-UPLOADED, WHICH THE OFFICE'S OWN WRITE DID NOT HAVE TO DO. When
// the office recorded the row it was holding a fresh Blob object nobody had
// ingested. Here the source is Airtable's own copy of that attachment, whose url
// expires in about two hours and whose re-submission returns success and silently
// empties the field (#142) — so this reads it server-side and puts a new object,
// exactly as createOverageDraft does with an invoice's file.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import it. The pure half is lib/directPurchase.js.

import { put } from "@vercel/blob";
import { base, TABLES } from "./airtable/client";
import {
    getDirectPurchasesByRecordIds,
    setDirectPurchaseRequest,
} from "./airtable/directPurchases";
import { createPR, getPRsByRecordIds } from "./airtable/purchaseRequests";
import { createQuotation } from "./airtable/quotations";
import { getUsersByRecordIds } from "./airtable/users";
import { deleteBlobBestEffort } from "./blobIngest";
import { sortLongestWaitingFirst } from "./deliveryStatus";
import { DIRECT_PURCHASE_COPY } from "./directPurchase";
import { WAIT_COPY, WAIT_STAGE, requestOfferable, stillWaiting, waitStage } from "./prWait";

/**
 * Every direct purchase on the viewer's jobs still waiting for a request, longest
 * wait first — the strip above `/prs`.
 *
 * TAKES THE JOBS AND THE VENDORS THE CALLER ALREADY HOLDS, which is both cheaper
 * and the gate. `/prs` reads `getAllJobs()` and `getAllVendors()` for its own
 * filters and columns, so the ids come off records it has and a row on a job the
 * viewer cannot reach is never fetched rather than fetched and filtered — the
 * arrangement getOveragesAwaitingRequest already uses for deliveries.
 *
 * TWO READS WHERE THERE IS ANYTHING TO READ, AND NONE WHERE THERE IS NOT: the
 * rows off the jobs' reverse-link, then the requests any of them have been
 * claimed by. A third — the people holding those drafts — happens only when some
 * row is claimed at all, which on an ordinary day is none of them.
 *
 * THE ORDERING IS THE SHARED ONE (#256), `Created At` ascending with the id
 * breaking a tie. That is when the OFFICE recorded the purchase, not when it
 * happened: the vendor's `Issue Date` is the date on their document, which the
 * office may be entering weeks later, and a worklist ordered by it would put a
 * stale invoice above one somebody is waiting on today.
 */
export async function getDirectPurchasesAwaitingRequest(jobs, vendors) {
    const recordIds = (jobs || []).flatMap((job) => job.directPurchases || []);
    if (recordIds.length === 0) return [];

    const rows = await getDirectPurchasesByRecordIds(recordIds);
    const claimed = await getPRsByRecordIds([
        ...new Set(rows.map((row) => row.purchaseRequest?.[0]).filter(Boolean)),
    ]);
    const prById = new Map(claimed.map((pr) => [pr.id, pr]));

    const waiting = rows.filter((row) => stillWaiting(prById.get(row.purchaseRequest?.[0])));
    if (waiting.length === 0) return [];

    // Only the people actually holding a draft, and only if there are any.
    const holderIds = [
        ...new Set(
            waiting
                .map((row) => prById.get(row.purchaseRequest?.[0])?.requester?.[0])
                .filter(Boolean)
        ),
    ];
    const holders = holderIds.length > 0 ? await getUsersByRecordIds(holderIds) : [];
    const holderById = new Map(holders.filter(Boolean).map((user) => [user.id, user]));
    const vendorById = new Map((vendors || []).map((vendor) => [vendor.id, vendor]));
    const jobById = new Map((jobs || []).map((job) => [job.id, job]));

    return sortLongestWaitingFirst(
        waiting.map((row) => {
            const pr = prById.get(row.purchaseRequest?.[0]) ?? null;
            const stage = waitStage(pr);
            return {
                // The record id, because that is what claimDirectPurchaseAction takes.
                id: row.id,
                directPurchaseId: row.directPurchaseId,
                vendorName: vendorById.get(row.vendor?.[0])?.vendorName ?? "—",
                jobCode: jobById.get(row.job?.[0])?.jobCode ?? null,
                vendorInvoiceCode: row.vendorInvoiceCode || "",
                notes: row.notes || "",
                // Airtable's own attachment url, which expires in about two hours.
                // FINE TO RENDER AND NEVER TO STORE — a link that 404s is a visible
                // annoyance, and this page is re-rendered on every load anyway.
                fileUrl: row.file?.[0]?.url ?? null,
                // #256's two keys: what the row waits from, and what breaks a tie.
                waitingSince: row.createdAt ?? null,
                createdKey: row.directPurchaseId ?? "",
                offerable: requestOfferable(pr),
                // The chip a claimed-but-unsubmitted row carries instead of a button.
                // Null on an offerable row, which is what keeps the two mutually
                // exclusive without the component deciding anything.
                heldBy:
                    stage === WAIT_STAGE.draft
                        ? WAIT_COPY.draftChip(holderById.get(pr?.requester?.[0])?.userName ?? null)
                        : null,
            };
        })
    );
}

/**
 * Raise the Draft for one direct purchase.
 *
 * A REAL DRAFT RECORD rather than a prefilled `/prs/new`, for createOverageDraft's
 * reason: the quotation is a document that has to be fetched and re-uploaded
 * server-side, and creating the record is also what gives `Purchase Request`
 * something to point at — which is what makes the row read as taken from the
 * moment the button is used, and what makes the KIND readable at all.
 *
 * NO ITEMS, NO DISCIPLINE AND NO SIGNERS, and none of the three is an omission. The
 * items are what only the site knows; the Discipline is the value this whole table
 * exists because the office cannot supply; and there is no earlier request to
 * copy a chain from, unlike the overage draft. `createPRAction` requires all three
 * at submit, so the form asks for them and nothing here pretends otherwise.
 *
 * Rolls back what it created on failure, children before the parent, and returns
 * `blobCleanups` for the CALLER to schedule at the end of its action (#140).
 */
export async function claimDirectPurchase({ user, directPurchase }) {
    const pr = await createPR({
        requesterId: user.id,
        // The Job the office recorded is not written here and cannot be: a request
        // reaches its Job through `Discipline`, which is what the requester picks next.
        disciplineId: null,
        vendorId: directPurchase.vendor?.[0] ?? null,
        notes:
            `Direct purchase. Bought from this vendor with no order behind it, recorded ` +
            `by the office as ${directPurchase.directPurchaseId}` +
            `${directPurchase.vendorInvoiceCode ? ` from invoice ${directPurchase.vendorInvoiceCode}` : ""}.` +
            `${directPurchase.notes ? ` ${directPurchase.notes}` : ""}`,
    });

    const createdQuotationIds = [];
    const blobCleanups = [];

    try {
        const source = directPurchase.file?.[0];
        if (!source?.url) throw new Error("the direct purchase has no file to quote from");
        const res = await fetch(source.url);
        if (!res.ok) throw new Error(`could not read the invoice file (${res.status})`);
        const filename = source.filename || `${directPurchase.directPurchaseId}.pdf`;
        const blob = await put(filename, Buffer.from(await res.arrayBuffer()), {
            access: "public",
            contentType: source.type || "application/pdf",
            addRandomSuffix: true,
        });

        let quotation;
        try {
            quotation = await createQuotation({
                prRecordId: pr.id,
                prId: pr.prId,
                vendorId: directPurchase.vendor?.[0] ?? null,
                // The vendor's own code for the document, which here is their invoice
                // number — the same substitution #167 makes for the same reason.
                vendorQuotationCode:
                    directPurchase.vendorInvoiceCode || directPurchase.directPurchaseId || "",
                file: [{ url: blob.url, filename }],
            });
        } catch (err) {
            // The two failure directions are opposite (#140): a write that threw will
            // never be ingested, so the object is dead weight immediately.
            await deleteBlobBestEffort(blob.url, `direct purchase quotation for ${pr.prId}`);
            throw err;
        }
        createdQuotationIds.push(quotation.id);
        blobCleanups.push({
            table: TABLES.QUOTATIONS,
            recordId: quotation.id,
            field: "File",
            blobUrl: blob.url,
            attachmentId: quotation.file?.[0]?.id,
            label: `direct purchase quotation ${quotation.quotationId}`,
        });

        // The link, last: it is what marks the row as taken, so nothing marks it
        // before the Draft it points at is complete.
        await setDirectPurchaseRequest(directPurchase.id, pr.id);

        return { pr, blobCleanups };
    } catch (err) {
        await Promise.allSettled(
            createdQuotationIds.map((id) => base(TABLES.QUOTATIONS).destroy(id))
        );
        await base(TABLES.PURCHASE_REQUESTS).destroy(pr.id).catch(() => {});
        throw err;
    }
}

/**
 * The refusal for a row somebody else already holds, with their name in it.
 *
 * SEPARATE FROM THE STRIP'S CHIP because the two answer different readers: the
 * chip is for everyone looking at the list, this is for the one person who
 * pressed a button that had gone stale in their tab. It is a read rather than a
 * derivation of the strip row for the same reason the action re-reads everything
 * — the row they are looking at may be minutes old.
 */
export async function describeClaimRefusal(directPurchase) {
    const prRecordId = directPurchase?.purchaseRequest?.[0];
    if (!prRecordId) return null;
    const [pr] = await getPRsByRecordIds([prRecordId]);
    if (requestOfferable(pr)) return null;

    // A submitted request needs no person named: it is on `/prs` and there is
    // nothing for this reader to chase.
    if (waitStage(pr) !== WAIT_STAGE.draft) {
        return DIRECT_PURCHASE_COPY.refused.raised({ prId: pr?.prId ?? null });
    }

    const holder = pr?.requester?.[0] ? (await getUsersByRecordIds([pr.requester[0]]))[0] : null;
    return DIRECT_PURCHASE_COPY.refused.taken({ holderName: holder?.userName ?? null });
}
