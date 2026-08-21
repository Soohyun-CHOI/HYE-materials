// Raising an overage PR from an over-delivery — credentialed (#167).
//
// The offline tier pins the judgment (scripts/tests/offline/overage.mjs and
// offline/invoice-item-fold.mjs: eligibility, the shared ordering asserted on the
// AST, the banner derivation, the fold key). What only real records can answer:
//
//   A — THE TWO FIELDS. `Delivery Items."Overage PR"` and
//       `Delivery Items."Former PO Item"` plus both symmetric sides, none of
//       which any file-only check can see. This is the third tier CLAUDE.md
//       describes: a link field renamed in the UI makes `record.get()` return
//       undefined and every banner silently empty. Also the SINGLE-RECORD
//       INVARIANT, which is app-enforced rather than schema-enforced
//       (`prefersSingleRecordLink` is refused on create AND on update, both
//       measured) — so it is checked on the DATA, where drift would actually
//       show, rather than on a schema property nothing can set.
//   B — THE WHOLE FLOW on real records: order 10, deliver 12, invoice 12, raise the
//       correction, approve it, generate its PO, and then assert that the excess
//       MOVED — the delivery row re-attached and unflagged, the invoice item split,
//       and the original ordered item no longer over-delivered.
//   C — THE SAME WITH A PAID INVOICE, which is the common case rather than an edge
//       one: the invoice usually arrives and is settled before anyone corrects the
//       record. Nothing on the header may move.
//   D — THE BANNER, derived from the links on all three documents.
//   E — THE REFUSALS on real data: no invoice, and an excess spanning two invoices.
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-overage-167.mjs
//
// Fixtures: PRs + PR Items, POs + PO Items through the real approve-and-generate
// flow (which is what gives each ordered item its `Material` link), Deliveries +
// Delivery Items, Invoices + Invoice Items + Invoice-PO Link rows, and the
// Quotations the correction creates. DELETES ALL OF THEM in this same run,
// children before parents, with the whole body in a try/catch so a mid-run throw
// cannot skip that. UNLIKE the other verify scripts this one DOES write to Vercel
// Blob — the quotation path is the feature — and deletes those objects too.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { execSync } from "child_process";
// `del` moved to scripts/tests/_fixtures.mjs with the rest of the cleanup (#171).
import { put } from "@vercel/blob";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO, getPOItemsForReconciliation } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import {
    createDeliveryItem,
    getDeliveryItemsByRecordIds,
    getItemsByDelivery,
} from "../../lib/airtable/deliveryItems.js";
import { createInvoice, getInvoiceByRecordId, updateInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { getQuotationsByPR } from "../../lib/airtable/quotations.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { getOverageBannerFacts, getOverageBannerFactsForPO, getOverageContext, createOverageDraft } from "../../lib/overagePR.js";
import { OVERAGE_BLOCKED, describeOverageBanner, isOverageApplied, resolveOriginalPOItem } from "../../lib/overage.js";
import { orderedItemStatus } from "../../lib/deliveryStatus.js";
import { foldInvoiceItems } from "../../lib/invoiceItemFold.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}

// A past run is only evidence if it can be tied to a tree.
function gitContext() {
    try {
        return {
            head: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
            dirty: execSync("git status --porcelain", { encoding: "utf8" }).split("\n").filter((l) => l.trim()).length,
        };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}
const git = gitContext();
console.log("=".repeat(72));
console.log("verify-overage-167 — raising an overage PR from an over-delivery");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty > 0
          ? `tree      DIRTY — ${git.dirty} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order. Blob objects go through trackBlob and are verified with head() rather
// than logged as "already gone or unreachable", which could not tell the two
// apart.
const fixtures = createFixtures({
    tag: "V167",
    buckets: [
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item", tagField: "Item Name" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable — an autoNumber primary and no text field at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        { name: "deliveryItems", table: TABLES.DELIVERY_ITEMS, label: "Delivery Item", tagField: "Item Name" },
        {
            name: "deliveries",
            table: TABLES.DELIVERIES,
            label: "Delivery",
            tagField: "Notes",
            children: [{ link: "Delivery Items", table: TABLES.DELIVERY_ITEMS, label: "Delivery Item" }],
        },
        // No tagField: written by generatePOForApprovedPR, no text field this
        // script sets. Tracked, so its residue check is a tracked-id re-read.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // NO tagField, and the census is what proved it has to be that way. Four
        // of these PRs this script creates with a tagged `Notes`, but the other
        // two are the overage Drafts `createOverageDraft` raises — production
        // code, with notes of its own — so a tag query on `Notes` misses exactly
        // those two. Declaring the field anyway made the helper report the
        // mismatch and fall back on every run; leaving it off says the true thing
        // once. Both are tracked, so tracked-id re-reads cover all six.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            children: [
                { link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" },
                { link: "PR Signers", table: TABLES.PR_SIGNERS, label: "PR Signer" },
                { link: "Quotations", table: TABLES.QUOTATIONS, label: "Quotation" },
            ],
        },
        // The item-axis rows PO generation writes as a side effect (#18), found by
        // tag because this script never holds their ids. The prices hang off the
        // Material's own link rather than a text match on `Price Label`, a formula
        // over two links that need not begin with the tag.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Item Name",
            discoverByTag: true,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

/** A one-page PDF, enough for Airtable to ingest and for the flow to re-upload. */
function tinyPdfBytes(label) {
    const body = `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 80]>>endobj\n`;
    return Buffer.from(`%PDF-1.4\n% ${label}\n${body}trailer<</Root 1 0 R>>\n%%EOF\n`, "utf8");
}

let complete = false;
try {
    // -------------------------------------------------------------------
    console.log("\nPart A — the two link fields and the single-record invariant:");
    const meta = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    ).then((r) => r.json());
    const tableByName = new Map(meta.tables.map((t) => [t.name, t]));
    const fieldOn = (table, name) => tableByName.get(table)?.fields.find((f) => f.name === name);

    const expectedFields = [
        ["Delivery Items", "Overage PR", "Purchase Requests"],
        ["Delivery Items", "Former PO Item", "PO Items"],
        ["Purchase Requests", "Overage Delivery Items", "Delivery Items"],
        ["PO Items", "Former Delivery Items", "Delivery Items"],
    ];
    let fieldsPresent = true;
    for (const [table, name, target] of expectedFields) {
        const field = fieldOn(table, name);
        const ok = assert(
            `${table}."${name}" exists and links to ${target}`,
            field?.type === "multipleRecordLinks" &&
                field.options?.linkedTableId === tableByName.get(target)?.id
        );
        if (!ok) fieldsPresent = false;
        else assert(`  and carries a description`, Boolean(field.description));
    }

    if (!fieldsPresent) {
        incomplete = "the #167 link fields are missing — nothing downstream can run";
        console.log(`\n  SKIP  ${incomplete}`);
        throw new Error("__skip__");
    }

    // The old names, so a half-applied rename fails here rather than at runtime.
    for (const [table, gone] of [
        ["Delivery Items", "Original PO Item"],
        ["PO Items", "Reattached Delivery Items"],
    ]) {
        assert(`${table}."${gone}" is gone — the rename was applied, not duplicated`, !fieldOn(table, gone));
    }

    // `prefersSingleRecordLink` is READABLE but not writable: refused 422 on field
    // create (INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE) and 422 on update
    // (INVALID_REQUEST_UNKNOWN, with and without linkedTableId). Reported rather
    // than asserted true, because asserting the current value would fail the day
    // someone improves it in the UI — and reported rather than dropped, because
    // "the schema does not enforce this" is exactly what the data check below is for.
    for (const name of ["Overage PR", "Former PO Item"]) {
        const field = fieldOn("Delivery Items", name);
        assert(
            `Delivery Items."${name}" exposes prefersSingleRecordLink (currently ${field.options?.prefersSingleRecordLink})`,
            typeof field.options?.prefersSingleRecordLink === "boolean"
        );
    }

    // THE INVARIANT THE APP PROMISES, measured on every stored row. An unenforced
    // invariant drifts silently, and this is the only place that would notice.
    const allDeliveryRows = await base(TABLES.DELIVERY_ITEMS)
        .select({ fields: ["Delivery Item ID", "Overage PR", "Former PO Item"] })
        .all();
    for (const name of ["Overage PR", "Former PO Item"]) {
        const multi = allDeliveryRows.filter((r) => (r.get(name) || []).length > 1);
        assert(
            `no stored row links more than one ${name} (${allDeliveryRows.length} rows scanned)`,
            multi.length === 0
        );
        if (multi.length > 0) {
            console.log(`    offenders: ${multi.map((r) => r.get("Delivery Item ID")).join(", ")}`);
        }
    }

    const [users, vendors, lines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllLines()]);
    const requester = users[0];
    const signer = users[1] ?? users[0];
    const vendor = vendors[0];
    const line = lines.find((l) => l.jobId);
    if (!requester || !vendor || !line) {
        incomplete = "need one active User, one Vendor and one Line attached to a Job";
        console.log(`\n  SKIP  ${incomplete}`);
        throw new Error("__skip__");
    }
    console.log(
        `\nFixture context: vendor "${vendor.vendorName}", line "${line.lineLabel}" (both reused, not modified)`
    );

    /** One PR + one item -> approve -> PO. Returns the PO and its one ordered item. */
    async function makeOrder({ itemName, qty, unitPrice = 12 }) {
        const pr = await createPR({
            requesterId: requester.id,
            lineId: line.id,
            vendorId: vendor.id,
            notes: `${TAG} fixture`,
        });
        track("prs", pr.id);
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName,
            size: '2"',
            unit: "EA",
            qty,
            unitPrice,
            remark: "",
        });
        await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: signer.id,
            sequenceOrder: 1,
            confirmationType: "Approval",
        });
        await updatePR(pr.id, { status: "Approved" });
        const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
        track("pos", gen.poRecordId);
        return {
            pr: await getPRByRecordId(pr.id),
            po: await getPOByRecordId(gen.poRecordId),
            orderedItem: (await getItemsByPO(gen.poRecordId))[0],
        };
    }

    /** One delivery whose rows the caller describes, over-delivery included. */
    async function deliver({ rows, receivedDate }) {
        const delivery = await createDelivery({
            jobRecordId: line.jobId,
            vendorRecordId: vendor.id,
            packingListPORecordId: null,
            receivedDate,
            recordedByUserId: requester.id,
            notes: `${TAG} delivery`,
            file: [],
        });
        track("deliveries", delivery.id);
        for (const row of rows) {
            const di = await createDeliveryItem({
                deliveryRecordId: delivery.id,
                deliveryId: delivery.deliveryId,
                poItemRecordId: row.orderedItem.id,
                materialRecordId: row.orderedItem.material?.[0] ?? null,
                itemName: row.orderedItem.itemName,
                size: row.orderedItem.size,
                unit: row.orderedItem.unit,
                qty: row.qty,
                overDelivered: Boolean(row.over),
            });
            track("deliveryItems", di.id);
        }
        return (await getDeliveriesByRecordIds([delivery.id]))[0];
    }

    /** One invoice with a real attached file, plus one invoice item per entry. */
    async function invoice({ po, items, issueDate, paid = false }) {
        const blob = await put(`${TAG}-invoice.pdf`, tinyPdfBytes(`${TAG} invoice`), {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        fixtures.trackBlob(blob.url);
        const invoice = await createInvoice({
            vendorId: vendor.id,
            vendorInvoiceCode: `${TAG}-${Math.random().toString(36).slice(2, 7)}`,
            issueDate,
            dueDate: "2026-09-01",
            amountDue: items.reduce((s, l) => s + l.qty * (l.unitPrice ?? 12), 0),
            shippingFee: 0,
            file: [{ url: blob.url, filename: `${TAG}-invoice.pdf` }],
        });
        track("invoices", invoice.id);
        for (const l of items) {
            const item = await createInvoiceItem({
                invoiceRecordId: invoice.id,
                invoiceId: invoice.invoiceId,
                poRecordId: po.id,
                poItemRecordId: l.orderedItem.id,
                itemName: l.orderedItem.itemName,
                size: l.orderedItem.size,
                unit: l.orderedItem.unit,
                qty: l.qty,
                unitPrice: l.unitPrice ?? 12,
                remark: "",
            });
            track("invoiceItems", item.id);
        }
        if (paid) await updateInvoice(invoice.id, { paid: true, paidDate: "2026-08-05" });
        // Airtable needs a moment to fetch the attachment; the quotation path reads
        // ITS copy, so wait for the ingest rather than racing it.
        for (let i = 0; i < 40; i++) {
            const fresh = await getInvoiceByRecordId(invoice.id);
            if (fresh.file?.[0]?.url && fresh.file[0].url !== blob.url) return fresh;
            await new Promise((r) => setTimeout(r, 300));
        }
        return await getInvoiceByRecordId(invoice.id);
    }

    /** Raise the correction, approve it, generate its PO. */
    async function correct({ delivery, overRow, paidNote = "" }) {
        const context = (await getOverageContext(await getItemsByDelivery(delivery.id), {
            deliveryId: delivery.deliveryId,
        })).get(overRow.id);
        assert(`the over-delivery is eligible${paidNote}`, context.eligibility.eligible === true);

        const draft = await createOverageDraft({
            user: requester,
            delivery,
            row: overRow,
            orderedItem: context.orderedItem,
            invoice: context.invoice,
            originalPR: context.originalPR,
        });
        track("prs", draft.pr.id);
        for (const q of await getQuotationsByPR(draft.pr.id)) {
            // Tracked for cleanup; the Blob object the draft created is ours too.
        }
        for (const cleanup of draft.blobCleanups) fixtures.trackBlob(cleanup.blobUrl);

        await updatePR(draft.pr.id, { status: "Approved" });
        const gen = await generatePOForApprovedPR(await getPRByRecordId(draft.pr.id));
        track("pos", gen.poRecordId);
        return {
            overagePR: await getPRByRecordId(draft.pr.id),
            overagePO: await getPOByRecordId(gen.poRecordId),
            draft,
            context,
        };
    }

    /** Everything Part B and Part C both assert. */
    async function assertSettled({ label, order, delivery, overRow, invoice, result }) {
        const rows = await getItemsByDelivery(delivery.id);
        const moved = rows.find((r) => r.id === overRow.id);
        const overageItems = await getItemsByPO(result.overagePO.id);

        check(`${label}: the row is re-attached to the overage order`, moved.poItem?.[0], overageItems[0].id);
        check(`${label}: its flag is cleared`, moved.overDelivered, false);
        check(`${label}: and it records where it came from`, moved.formerPOItemRecordId, order.orderedItem.id);
        assert(`${label}: so the flag reads as applied`, isOverageApplied(moved) === true);
        check(
            `${label}: the original ordered item is still recoverable`,
            resolveOriginalPOItem(moved),
            order.orderedItem.id
        );

        const invoiceItems = await getItemsByInvoice(invoice.id);
        const onOriginal = invoiceItems.filter((l) => l.poItem?.[0] === order.orderedItem.id);
        const onOverage = invoiceItems.filter((l) => l.poItem?.[0] === overageItems[0].id);
        check(`${label}: one line still charges the original order`, onOriginal.length, 1);
        check(`${label}:   for what was ordered`, onOriginal[0].qty, order.orderedItem.qty);
        check(`${label}: one line now charges the overage order`, onOverage.length, 1);
        check(`${label}:   for the excess`, onOverage[0].qty, overRow.qty);
        check(`${label}:   and its PO link moved too`, onOverage[0].po?.[0], result.overagePO.id);

        // NOTHING ON THE HEADER MOVES — the total is unchanged, so only attribution
        // shifted. This is what makes splitting a PAID invoice safe.
        const after = await getInvoiceByRecordId(invoice.id);
        check(`${label}: Amount Due unchanged`, after.amountDue, invoice.amountDue);
        check(`${label}: Paid unchanged`, after.paid, invoice.paid);
        check(`${label}: Calculated Total unchanged`, after.calculatedTotal, invoice.calculatedTotal);

        // THE OVER-DELIVERY IS RESOLVED on the original ordered item.
        const [originalAfter] = await getPOItemsForReconciliation([order.orderedItem.id]);
        const status = orderedItemStatus({
            orderedQty: originalAfter.qty,
            invoicedQty: originalAfter.invoicedQty,
            deliveredWithinQty: order.orderedItem.qty,
            deliveredOverQty: 0,
        });
        check(`${label}: nothing is delivered beyond the original order now`, status.deliveredBeyondOrder, 0);
        check(`${label}: nor invoiced beyond it`, status.invoicedBeyondOrder, 0);
        check(`${label}: and the ordered item reads as fully invoiced`, originalAfter.invoicedQty, order.orderedItem.qty);

        // The items table folds the two invoice items back into one.
        const folded = foldInvoiceItems(
            invoiceItems.map((l) => ({
                ...l,
                materialRecordId:
                    l.poItem?.[0] === order.orderedItem.id
                        ? order.orderedItem.material?.[0]
                        : overageItems[0].material?.[0],
            }))
        );
        check(`${label}: the items table folds them back into one row`, folded.length, 1);
        check(`${label}:   summing to what the vendor invoiced`, folded[0].qty, order.orderedItem.qty + overRow.qty);
        check(`${label}:   and it says it stands for two`, folded[0].rowCount, 2);

        // The quotation is the invoice's file, re-uploaded rather than re-submitted.
        const quotations = await getQuotationsByPR(result.overagePR.id);
        check(`${label}: the correction carries one quotation`, quotations.length, 1);
        assert(`${label}:   with a file Airtable actually took`, Boolean(quotations[0].file?.[0]?.url));
        assert(
            `${label}:   and it is Airtable's copy, not the Blob url we submitted`,
            !fixtures.blobUrls().includes(quotations[0].file?.[0]?.url)
        );
        check(
            `${label}:   coded with the vendor's invoice number`,
            quotations[0].vendorQuotationCode,
            invoice.vendorInvoiceCode
        );
    }

    // -------------------------------------------------------------------
    console.log("\nPart B — the whole flow: order 10, deliver 12, invoice 12, correct:");
    const orderB = await makeOrder({ itemName: `${TAG} Pipe`, qty: 10 });
    const deliveryB = await deliver({
        rows: [
            { orderedItem: orderB.orderedItem, qty: 10 },
            { orderedItem: orderB.orderedItem, qty: 2, over: true },
        ],
        receivedDate: "2026-07-20",
    });
    const invoiceB = await invoice({ po: orderB.po, items: [{ orderedItem: orderB.orderedItem, qty: 12 }], issueDate: "2026-07-21" });
    const overRowB = (await getItemsByDelivery(deliveryB.id)).find((r) => r.overDelivered);
    const resultB = await correct({ delivery: deliveryB, overRow: overRowB });

    check("the correction's PO carries one ordered item", (await getItemsByPO(resultB.overagePO.id)).length, 1);
    check("  for the excess", (await getItemsByPO(resultB.overagePO.id))[0].qty, 2);
    check("  at the price the vendor invoiced", (await getItemsByPO(resultB.overagePO.id))[0].unitPrice, 12);
    check("the chain was copied", resultB.draft.signersDropped, 0);
    await assertSettled({
        label: "B",
        order: orderB,
        delivery: deliveryB,
        overRow: overRowB,
        invoice: invoiceB,
        result: resultB,
    });

    // -------------------------------------------------------------------
    console.log("\nPart C — the same on an ALREADY PAID invoice, which is the common case:");
    const orderC = await makeOrder({ itemName: `${TAG} Elbow`, qty: 6 });
    const deliveryC = await deliver({
        rows: [
            { orderedItem: orderC.orderedItem, qty: 6 },
            { orderedItem: orderC.orderedItem, qty: 3, over: true },
        ],
        receivedDate: "2026-07-22",
    });
    const invoiceC = await invoice({
        po: orderC.po,
        items: [{ orderedItem: orderC.orderedItem, qty: 9 }],
        issueDate: "2026-07-23",
        paid: true,
    });
    check("the invoice is paid before the correction", invoiceC.paid, true);
    const overRowC = (await getItemsByDelivery(deliveryC.id)).find((r) => r.overDelivered);
    const resultC = await correct({ delivery: deliveryC, overRow: overRowC, paidNote: " (paid invoice)" });
    await assertSettled({
        label: "C",
        order: orderC,
        delivery: deliveryC,
        overRow: overRowC,
        invoice: invoiceC,
        result: resultC,
    });

    // -------------------------------------------------------------------
    console.log("\nPart D — the banner, derived from the links on all three documents:");
    const prBanners = await getOverageBannerFacts(resultB.overagePR);
    check("the correction's own page has one", prBanners.length, 1);
    check("  and it reads as applied", prBanners[0].state, "applied");
    assert(
        "  naming the original order and the delivery",
        prBanners[0].facts.originalPoId === orderB.po.poId &&
            prBanners[0].facts.deliveryId === deliveryB.deliveryId
    );
    const prMessages = describeOverageBanner({ site: "overagePR", state: prBanners[0].state, facts: prBanners[0].facts });
    check("  two messages: what it corrects, and the accounting caveat", prMessages.length, 2);
    assert("  the caveat names the invoice", prMessages[1].text.includes(invoiceB.invoiceId));

    const overagePOBanners = await getOverageBannerFactsForPO(
        resultB.overagePO,
        await getItemsByPO(resultB.overagePO.id)
    );
    check("the overage order reaches it through its own PR", overagePOBanners.length, 1);
    check("  from that side", overagePOBanners[0].site, "overagePO");

    const originalPOBanners = await getOverageBannerFactsForPO(orderB.po, await getItemsByPO(orderB.po.id));
    check("the ORIGINAL order reaches it through its own ordered item", originalPOBanners.length, 1);
    check("  from that side", originalPOBanners[0].site, "originalPO");
    assert("  and points at the correction", originalPOBanners[0].facts.overagePrId === resultB.overagePR.prId);
    // The provenance link is what makes this precise rather than a walk through the
    // shared delivery, which would also hit an order that was not itself exceeded.
    const unrelated = await getOverageBannerFactsForPO(orderC.po, await getItemsByPO(orderC.po.id));
    assert("  and C's order sees only its own correction", unrelated.every((b) => b.facts.overagePrId === resultC.overagePR.prId));

    // -------------------------------------------------------------------
    console.log("\nPart E — the refusals, on real data:");
    // Nothing charges the ordered item.
    const orderE = await makeOrder({ itemName: `${TAG} Tee`, qty: 4 });
    const deliveryE = await deliver({
        rows: [{ orderedItem: orderE.orderedItem, qty: 4 }, { orderedItem: orderE.orderedItem, qty: 1, over: true }],
        receivedDate: "2026-07-24",
    });
    const overRowE = (await getItemsByDelivery(deliveryE.id)).find((r) => r.overDelivered);
    const contextE = (await getOverageContext(await getItemsByDelivery(deliveryE.id), {
        deliveryId: deliveryE.deliveryId,
    })).get(overRowE.id);
    check("no invoice on the ordered item", contextE.eligibility.blocked, OVERAGE_BLOCKED.noInvoice);

    // An excess larger than the oldest invoice — out of scope, and the reason is the
    // quotation rather than the arithmetic.
    const orderF = await makeOrder({ itemName: `${TAG} Union`, qty: 10 });
    const deliveryF = await deliver({
        rows: [{ orderedItem: orderF.orderedItem, qty: 10 }, { orderedItem: orderF.orderedItem, qty: 5, over: true }],
        receivedDate: "2026-07-25",
    });
    await invoice({ po: orderF.po, items: [{ orderedItem: orderF.orderedItem, qty: 3 }], issueDate: "2026-07-01" });
    await invoice({ po: orderF.po, items: [{ orderedItem: orderF.orderedItem, qty: 12 }], issueDate: "2026-07-26" });
    const overRowF = (await getItemsByDelivery(deliveryF.id)).find((r) => r.overDelivered);
    const contextF = (await getOverageContext(await getItemsByDelivery(deliveryF.id), {
        deliveryId: deliveryF.deliveryId,
    })).get(overRowF.id);
    check("an excess spanning two invoices is refused", contextF.eligibility.blocked, OVERAGE_BLOCKED.spansInvoices);
    check("  and it is marked inferred, since two invoices share the ordered item", contextF.eligibility.inferred, true);

    // A row already carrying a live correction is not offered again.
    const contextBAgain = (await getOverageContext(await getItemsByDelivery(deliveryB.id), {
        deliveryId: deliveryB.deliveryId,
    })).get(overRowB.id);
    check("a settled row is not offered again", contextBAgain.eligibility.blocked, OVERAGE_BLOCKED.notOverDelivered);
    check("  and its banner still reads applied", contextBAgain.bannerState, "applied");
    complete = true;
} catch (err) {
    if (err.message !== "__skip__") {
        pass = false;
        console.error(`\n  ABORTED — ${err.message}`);
        console.error(err.stack);
    }
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(72));
console.log(`commit ${git.head}${git.dirty ? " (DIRTY TREE)" : ""}`);
// TWO VERDICTS, TWO SENTENCES (#171). `pass` is about the overage correction; a
// leak is about this run's effect on a shared base and on the Blob store. Until
// #171 a failed delete lowered `pass`, so a leak printed `SOME CHECKS FAILED` —
// the right exit code attached to a sentence pointing at the wrong thing.
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
