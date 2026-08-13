// The read and write sides of the overage correction (#167).
//
// lib/overage.js decides; this fetches the facts it needs and performs the two
// writes: raising the corrective Draft, and — once its PO exists — moving the
// excess onto that PO's own ordered item.
//
// THE APPLY STEP SITS OUTSIDE PO GENERATION'S ROLLBACK, in lib/materialsCache.js's
// position and for #165's reason: a derived artifact must never undo the approval
// that produced it, and the PO is the document sent to the vendor. So a failure
// here leaves the PO standing and an ASYMMETRY behind, which has to be visible.
// There are two signals and they cover different halves:
//   - re-attach failed  → nothing moved. The over-delivery still shows on the
//     original ordered item, and the banner reads `not-applied` because the row
//     still carries the flag. THIS IS THE ONLY SIGNAL for that half; the
//     deliveries worklist cannot see it, since the row still points at an ordered
//     item that IS invoiced.
//   - split failed      → the row moved, so the overage ordered item has a
//     delivery and no invoice, which puts the delivery in #166's
//     `Not fully invoiced` worklist. The banner reads `applied`, NOT
//     `not-applied`: re-attachment ran, so the row carries its provenance and
//     isOverageApplied answers true. This line claimed otherwise and was wrong
//     under the old flag rule too, since that write clears the flag as well.
// Re-attach runs FIRST for exactly that reason: the reachable middle state is the
// one two things notice rather than one.
//
// No notification is sent either way, so those two are the whole of the story, and
// both are derived from links rather than stored. That clause used to read "Resend is
// still in sandbox mode", which stopped being the reason when the domain was verified
// — mail delivers to any address now and nothing here sends any; the same false
// clause was corrected in `verification.md` when it was found there.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The pure halves are lib/overage.js and
// lib/invoiceItemFold.js.

import { put } from "@vercel/blob";
import { base, TABLES } from "./airtable/client";
import { createPR, getPRsByRecordIds } from "./airtable/purchaseRequests";
import { createItem } from "./airtable/prItems";
import { createSigner, getSignersByPR } from "./airtable/prSigners";
import { createQuotation } from "./airtable/quotations";
import { getPOsByRecordIds } from "./airtable/purchaseOrders";
import {
    getInvoicedQtyForPOItem,
    getItemsByPO,
    getPOItemByRecordId,
    getPOItemsForReconciliation,
} from "./airtable/poItems";
import {
    createInvoiceItem,
    getInvoiceItemsByRecordIds,
    updateInvoiceItem,
} from "./airtable/invoiceItems";
import { getInvoicesByRecordIds, linkInvoiceToPO } from "./airtable/invoices";
import { linkedDelivery } from "./deliveryInvoiceLink";
import {
    getDeliveryItemsByRecordIds,
    reattachDeliveryItemToPOItem,
    setDeliveryItemOveragePR,
} from "./airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getActiveUsers } from "./airtable/users";
import { deleteBlobBestEffort } from "./blobIngest";
import { formatUSD } from "./format";
import { checkUnitPriceVariance } from "./variance";
import {
    attachedDeliveryRecordId,
    isNoLongerOverDelivered,
    isOverageApplied,
    overageBannerState,
    overageEligibility,
    resolveOriginalPOItem,
    selectOverageBill,
} from "./overage";

/**
 * Every bill on a set of ordered items, in the shape lib/overage.js wants, keyed by
 * PO Item record id.
 *
 * Two batched reads whatever the row count — the invoice items off the ordered
 * items' own reverse-link, then their parents for `Issue Date`, `Invoice ID` and
 * the file the quotation is taken from. Same discipline as
 * lib/deliveryReconciliation.js:billsByPOItem, which needs a different projection
 * of the same level (it wants coverage; this wants the file and the price).
 *
 * #219 ADDED THE PAIRING TO THE PROJECTION AND NO QUERY WITH IT. These invoices are
 * already read for their date and their file, so which shipment each one names comes
 * off records this function has in hand — which is what makes narrowing the
 * candidates cost nothing. Flattened through `linkedDelivery` rather than indexed
 * here, so #210's single-record rule keeps one home.
 */
async function billsByOrderedItem(poItems) {
    const lines = await getInvoiceItemsByRecordIds(poItems.flatMap((p) => p.invoiceItems || []));
    const invoices = await getInvoicesByRecordIds([
        ...new Set(lines.map((l) => l.invoice?.[0]).filter(Boolean)),
    ]);
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

    const byItem = new Map();
    for (const line of lines) {
        const itemId = (line.poItem || [])[0];
        const invoiceRecordId = line.invoice?.[0];
        if (!itemId || !invoiceRecordId) continue;
        const invoice = invoiceById.get(invoiceRecordId);
        if (!byItem.has(itemId)) byItem.set(itemId, []);
        byItem.get(itemId).push({
            invoiceItemRecordId: line.id,
            invoiceRecordId,
            invoiceId: invoice?.invoiceId ?? null,
            issueDate: invoice?.issueDate ?? null,
            vendorInvoiceCode: invoice?.vendorInvoiceCode ?? "",
            // A `paid` field stood here and is gone (#211). Nothing ever read it —
            // no copy branch, no eligibility clause, no render — so it was a payment
            // fact being assembled on the one invoice-reading path site staff reach,
            // for no reader at all. Payment is President-or-Admin now, and an
            // unread field is the easiest kind of leak to ship: it costs nothing to
            // carry and nothing warns about it.
            file: invoice?.file ?? null,
            hasFile: Boolean(invoice?.file?.[0]?.url),
            // #219 — the shipment this bill describes, or null when nothing names
            // one. Both are answers: selectOverageBill takes the first as evidence
            // and the second as the absence of it.
            deliveryRecordId: invoice ? linkedDelivery(invoice) : null,
            qty: line.qty || 0,
            unitPrice: line.unitPrice ?? null,
            remark: line.remark || "",
        });
    }
    return byItem;
}

/**
 * The overage picture for one delivery's rows.
 *
 * Called only for rows that are flagged or already carry a correction, so an
 * ordinary delivery costs no query at all. FIVE batched reads at most, none of
 * them per row: the ordered items, their bills, those bills' invoices, the linked
 * PRs, and the POs of both sides.
 *
 * Returns a Map of Delivery Item record id -> everything the page needs:
 * `{ eligibility, bannerState, facts, bill }`.
 */
export async function getOverageContext(deliveryItems, { deliveryId } = {}) {
    const rows = (deliveryItems || []).filter((r) => r.overDelivered || r.overagePRRecordId);
    const out = new Map();
    if (rows.length === 0) return out;

    // The ORIGINAL ordered item in every state — the row's own link before the
    // apply step, the provenance link after it.
    const orderedItemIds = [...new Set(rows.map(resolveOriginalPOItem).filter(Boolean))];
    const poItems = await getPOItemsForReconciliation(orderedItemIds);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    const [billsByItem, prs] = await Promise.all([
        billsByOrderedItem(poItems),
        getPRsByRecordIds([...new Set(rows.map((r) => r.overagePRRecordId).filter(Boolean))]),
    ]);
    const prById = new Map(prs.map((pr) => [pr.id, pr]));

    const pos = await getPOsByRecordIds([
        ...new Set([
            ...poItems.flatMap((p) => p.po || []),
            ...prs.flatMap((pr) => pr.purchaseOrders || []),
        ]),
    ]);
    const poById = new Map(pos.map((po) => [po.id, po]));

    // The requests behind the ordered items, for the chain the correction copies.
    // One batched read for all of them; the chains themselves are one read each,
    // which is why they are fetched here and not per row — a delivery normally
    // carries one over-delivery, and POs on one delivery usually share a request.
    const originalPRs = await getPRsByRecordIds([
        ...new Set(poItems.map((p) => poById.get(p.po?.[0])?.pr?.[0]).filter(Boolean)),
    ]);
    const originalPRById = new Map(originalPRs.map((pr) => [pr.id, pr]));
    const chainByPR = new Map();
    for (const originalPR of originalPRs) {
        chainByPR.set(originalPR.id, await copyableSigners(originalPR.id));
    }

    for (const row of rows) {
        const orderedItem = poItemById.get(resolveOriginalPOItem(row)) ?? null;
        const bills = billsByItem.get(orderedItem?.id) ?? [];
        const overagePR = row.overagePRRecordId ? prById.get(row.overagePRRecordId) ?? null : null;
        const overagePO = overagePR?.purchaseOrders?.[0]
            ? poById.get(overagePR.purchaseOrders[0]) ?? null
            : null;

        const eligibility = overageEligibility({ row, bills, overagePR, overagePO });
        const bill =
            eligibility.bill ??
            selectOverageBill({
                bills,
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).bill ??
            null;

        const originalPR = originalPRById.get(poById.get(orderedItem?.po?.[0])?.pr?.[0]) ?? null;
        const chain = originalPR ? chainByPR.get(originalPR.id) : null;

        out.set(row.id, {
            eligibility,
            bannerState: overageBannerState({ row, overagePR, overagePO }),
            noLongerOverDelivered: isNoLongerOverDelivered(row),
            bill,
            orderedItem,
            originalPR,
            facts: {
                // The chain the correction will arrive with, so the preview can say
                // what the requester has to add rather than letting them find out
                // on the form.
                signersDropped: chain?.droppedCount ?? 0,
                signersEmpty: Boolean(chain) && chain.keep.length === 0,
                excess: row.qty || 0,
                unit: row.unit || orderedItem?.unit || "",
                itemName: row.itemName || orderedItem?.itemName || "",
                size: row.size || orderedItem?.size || "",
                originalPoId: poById.get(orderedItem?.po?.[0])?.poId ?? "that order",
                deliveryId: deliveryId ?? null,
                invoiceId: bill?.invoiceId ?? null,
                unitPriceLabel: bill?.unitPrice != null ? formatUSD(bill.unitPrice) : null,
                overagePrId: overagePR?.prId ?? null,
                overagePoId: overagePO?.poId ?? null,
            },
        });
    }

    return out;
}

/**
 * The banner facts for one PR — the corrective request's own page.
 *
 * Costs nothing on an ordinary PR: `overageDeliveryItemRowIds` is empty on every
 * PR that is not a correction, and this returns immediately.
 */
export async function getOverageBannerFacts(pr) {
    const rowIds = pr?.overageDeliveryItemRowIds ?? [];
    if (rowIds.length === 0) return null;

    const rows = await getDeliveryItemsByRecordIds(rowIds);
    if (rows.length === 0) return null;

    const [deliveries, poItems] = await Promise.all([
        getDeliveriesByRecordIds([...new Set(rows.map((r) => r.delivery?.[0]).filter(Boolean))]),
        getPOItemsForReconciliation([...new Set(rows.map(resolveOriginalPOItem).filter(Boolean))]),
    ]);
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    const [billsByItem, pos] = await Promise.all([
        billsByOrderedItem(poItems),
        getPOsByRecordIds([
            ...new Set([...poItems.flatMap((p) => p.po || []), ...(pr.purchaseOrders || [])]),
        ]),
    ]);
    const poById = new Map(pos.map((po) => [po.id, po]));
    const overagePO = pr.purchaseOrders?.[0] ? poById.get(pr.purchaseOrders[0]) ?? null : null;

    // One banner per corrected row. A PR covers one excess in practice — the button
    // raises one — but the link is a list, so this does not assume otherwise.
    return rows
        .map((row) => {
            const orderedItem = poItemById.get(resolveOriginalPOItem(row)) ?? null;
            const bill = selectOverageBill({
                bills: billsByItem.get(orderedItem?.id) ?? [],
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).bill;
            const state = overageBannerState({ row, overagePR: pr, overagePO });
            if (!state) return null;
            return {
                state,
                // #206 — derived per row, never stored, so a re-entered excess
                // clears it with no write anywhere.
                noLongerOverDelivered: isNoLongerOverDelivered(row),
                rowId: row.id,
                facts: {
                    excess: row.qty || 0,
                    unit: row.unit || "",
                    itemName: row.itemName || "",
                    size: row.size || "",
                    deliveryId: deliveryById.get(row.delivery?.[0])?.deliveryId ?? "that delivery",
                    originalPoId: poById.get(orderedItem?.po?.[0])?.poId ?? "the original order",
                    overagePrId: pr.prId,
                    overagePoId: overagePO?.poId ?? null,
                    invoiceId: bill?.invoiceId ?? null,
                },
            };
        })
        .filter(Boolean);
}

/**
 * The banner facts for one PO, from whichever side it is on.
 *
 * `poItems` are the PO's own ordered items, which the detail page already holds. Their
 * `Former Delivery Items` reverse-link names the rows whose excess came from THIS
 * order — which is what makes the original PO's banner precise: a delivery that
 * filled two orders cannot make it appear on the one that was not exceeded.
 *
 * An overage PO reaches the same facts through its own `PR`, so the two sites share
 * one function and differ only in `site`.
 */
export async function getOverageBannerFactsForPO(po, poItems) {
    // The overage side first: this PO's PR is the correction.
    const pr = po?.pr?.[0] ? (await getPRsByRecordIds([po.pr[0]]))[0] : null;
    if (pr?.overageDeliveryItemRowIds?.length) {
        const banners = await getOverageBannerFacts(pr);
        return (banners || []).map((b) => ({ ...b, site: "overagePO" }));
    }

    // The original side: rows whose provenance points at one of this PO's items.
    const rowIds = [...new Set((poItems || []).flatMap((it) => it.formerDeliveryItems || []))];
    if (rowIds.length === 0) return [];

    const rows = await getDeliveryItemsByRecordIds(rowIds);
    const prs = await getPRsByRecordIds([
        ...new Set(rows.map((r) => r.overagePRRecordId).filter(Boolean)),
    ]);
    const prById = new Map(prs.map((p) => [p.id, p]));

    const [deliveries, overagePOs] = await Promise.all([
        getDeliveriesByRecordIds([...new Set(rows.map((r) => r.delivery?.[0]).filter(Boolean))]),
        getPOsByRecordIds([...new Set(prs.flatMap((p) => p.purchaseOrders || []))]),
    ]);
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const overagePOById = new Map(overagePOs.map((p) => [p.id, p]));

    const billsByItem = await billsByOrderedItem(poItems || []);

    return rows
        .map((row) => {
            const overagePR = row.overagePRRecordId ? prById.get(row.overagePRRecordId) ?? null : null;
            const overagePO = overagePR?.purchaseOrders?.[0]
                ? overagePOById.get(overagePR.purchaseOrders[0]) ?? null
                : null;
            const state = overageBannerState({ row, overagePR, overagePO });
            if (!state) return null;
            const bill = selectOverageBill({
                bills: billsByItem.get(resolveOriginalPOItem(row)) ?? [],
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).bill;
            return {
                site: "originalPO",
                state,
                noLongerOverDelivered: isNoLongerOverDelivered(row),
                rowId: row.id,
                facts: {
                    excess: row.qty || 0,
                    unit: row.unit || "",
                    itemName: row.itemName || "",
                    size: row.size || "",
                    deliveryId: deliveryById.get(row.delivery?.[0])?.deliveryId ?? "that delivery",
                    originalPoId: po.poId,
                    thisPoId: po.poId,
                    overagePrId: overagePR?.prId ?? null,
                    overagePoId: overagePO?.poId ?? null,
                    invoiceId: bill?.invoiceId ?? null,
                },
            };
        })
        .filter(Boolean);
}

/**
 * The signing chain to copy onto the correction, minus anyone inactive.
 *
 * A chain that reaches a departed signer STOPS, and nothing in the app can unstick
 * it — the turn belongs to a user who cannot log in. So an inactive signer is left
 * out and the preview says how many were, which is the one thing the requester has
 * to act on. `getActiveUsers()` is one query for the whole chain rather than one
 * per signer.
 */
async function copyableSigners(originalPRRecordId) {
    const [chain, activeUsers] = await Promise.all([
        getSignersByPR(originalPRRecordId),
        getActiveUsers(),
    ]);
    const activeIds = new Set(activeUsers.map((u) => u.id));

    // Sequence Order asc, so the copy keeps the original's order. getSignersByPR
    // does not promise one.
    const ordered = [...chain].sort((a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
    const keep = ordered.filter((s) => s.signer?.[0] && activeIds.has(s.signer[0]));

    return { keep, droppedCount: ordered.length - keep.length, originalCount: ordered.length };
}

/**
 * Raise the corrective Draft for one over-delivery.
 *
 * A REAL DRAFT RECORD rather than a prefilled `/prs/new`, and the reason is the
 * quotation: the vendor's invoice becomes it, which means fetching Airtable's copy
 * server-side and writing a FRESH Blob object for Airtable to ingest. Handing the
 * form an Airtable attachment url to re-submit is exactly the silent data loss #142
 * measured. Creating the record also gives `Delivery Items."Overage PR"` something
 * to point at immediately, which is what makes the row read as pending from the
 * moment the button is used.
 *
 * Rolls back everything it created on failure, children before the PR, the same
 * create-then-delete shape as persistPRFromForm. Returns `blobCleanups` for the
 * CALLER to schedule at the end of its action rather than cleaning up here: a
 * rollback has to leave the object alive so a retry can re-submit the same url
 * (#140).
 */
export async function createOverageDraft({ user, delivery, row, orderedItem, bill, originalPR }) {
    const pr = await createPR({
        requesterId: user.id,
        lineId: originalPR.line?.[0] ?? null,
        vendorId: originalPR.vendor?.[0] ?? null,
        notes:
            `Overage correction. ${row.qty} ${row.unit || ""}`.trim() +
            ` of ${[row.itemName, row.size].filter(Boolean).join(" ")} was delivered beyond ` +
            `what ${orderedItem.poItemId} ordered, on delivery ${delivery.deliveryId}. ` +
            `Quoted from ${bill.invoiceId}, which bills for it already.`,
    });

    const createdItemIds = [];
    const createdSignerIds = [];
    const createdQuotationIds = [];
    const blobCleanups = [];

    try {
        // 1. The quotation — the invoice's own file, re-uploaded rather than
        //    re-submitted. Same server-side put() shape as the PO PDF.
        const source = bill.file?.[0];
        if (!source?.url) throw new Error("the invoice has no file to quote from");
        const res = await fetch(source.url);
        if (!res.ok) throw new Error(`could not read the invoice file (${res.status})`);
        const filename = source.filename || `${bill.invoiceId}.pdf`;
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
                vendorId: originalPR.vendor?.[0] ?? null,
                // The vendor's own code for the document, which here is their
                // invoice number — the issue's "code from the invoice".
                vendorQuotationCode: bill.vendorInvoiceCode || bill.invoiceId || "",
                file: [{ url: blob.url, filename }],
            });
        } catch (err) {
            // The two failure directions are opposite (#140): a write that threw
            // will never be ingested, so the object is dead weight immediately.
            await deleteBlobBestEffort(blob.url, `overage quotation for ${pr.prId}`);
            throw err;
        }
        createdQuotationIds.push(quotation.id);
        blobCleanups.push({
            table: TABLES.QUOTATIONS,
            recordId: quotation.id,
            field: "File",
            blobUrl: blob.url,
            attachmentId: quotation.file?.[0]?.id,
            label: `overage quotation ${quotation.quotationId}`,
        });

        // 2. One item: the excess, at the price the vendor billed it at.
        const item = await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: row.itemName || orderedItem.itemName,
            size: row.size || orderedItem.size,
            unit: row.unit || orderedItem.unit,
            qty: row.qty,
            unitPrice: bill.unitPrice ?? orderedItem.unitPrice,
            remark: `Delivered beyond ${orderedItem.poItemId} on ${delivery.deliveryId}`,
            quotationRecordId: quotation.id,
        });
        createdItemIds.push(item.id);

        // 3. The chain, minus anyone inactive.
        const signers = await copyableSigners(originalPR.id);
        for (let i = 0; i < signers.keep.length; i++) {
            const created = await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                signerUserId: signers.keep[i].signer[0],
                sequenceOrder: i + 1,
                confirmationType: signers.keep[i].confirmationType || "Approval",
            });
            createdSignerIds.push(created.id);
        }

        // 4. The link, last: it is what marks the row as taken, so nothing should
        //    mark it before the Draft it points at is complete.
        await setDeliveryItemOveragePR(row.id, pr.id);

        return {
            pr,
            blobCleanups,
            signersDropped: signers.droppedCount,
            signersEmpty: signers.keep.length === 0,
        };
    } catch (err) {
        await Promise.allSettled([
            ...createdSignerIds.map((id) => base(TABLES.PR_SIGNERS).destroy(id)),
            ...createdItemIds.map((id) => base(TABLES.PR_ITEMS).destroy(id)),
        ]);
        await Promise.allSettled(
            createdQuotationIds.map((id) => base(TABLES.QUOTATIONS).destroy(id))
        );
        await base(TABLES.PURCHASE_REQUESTS).destroy(pr.id).catch(() => {});
        throw err;
    }
}

/**
 * Move the excess onto the freshly generated overage PO — the settlement.
 *
 * IDEMPOTENT, because it is best-effort and has no retry UI: a row whose flag is
 * already clear is skipped, so re-running changes nothing. Reports a summary rather
 * than throwing, and one bad row must not cost the others theirs, so the try/catch
 * is per row — the same shape refreshMaterialsCacheForPO uses.
 *
 * Re-reads the PO's items rather than taking the ones PO generation just created,
 * because the `Material` link those need is written AFTER them, by #18's cache.
 */
export async function applyOverageToPO({ pr, poRecordId }) {
    const rowIds = pr?.overageDeliveryItemRowIds ?? [];
    if (rowIds.length === 0) return { attempted: 0, applied: 0, skipped: [], failed: [] };

    const [rows, newItems] = await Promise.all([
        getDeliveryItemsByRecordIds(rowIds),
        getItemsByPO(poRecordId),
    ]);

    const failed = [];
    const skipped = [];
    let applied = 0;

    for (const row of rows) {
        try {
            if (isOverageApplied(row)) {
                skipped.push({ rowId: row.deliveryItemId, reason: "already applied" });
                continue;
            }

            const originalItemId = resolveOriginalPOItem(row);
            if (!originalItemId) {
                skipped.push({ rowId: row.deliveryItemId, reason: "no ordered item" });
                continue;
            }

            // WHICH ordered item of the overage PO. Matched on #18's `Material`
            // link, never on `Item Name` text. A single-item overage PO is
            // unambiguous anyway, which is the shape the button produces and the
            // fallback for a PO whose cache refresh did not run.
            const target =
                newItems.find((it) => it.material?.[0] && it.material[0] === row.material?.[0]) ??
                (newItems.length === 1 ? newItems[0] : null);
            if (!target) {
                skipped.push({
                    rowId: row.deliveryItemId,
                    reason: "no matching ordered item on the overage PO",
                });
                continue;
            }

            // (i) The delivery side. First, so the reachable middle state is the one
            //     both the banner and #166's worklist notice.
            await reattachDeliveryItemToPOItem(row.id, {
                poItemRecordId: target.id,
                formerPOItemRecordId: originalItemId,
            });

            // (ii) The invoice side. The row's own shipment goes with it because the
            //      split has to land on the SAME bill the preview quoted (#219) —
            //      both sides pick through selectOverageBill, and without this the
            //      write would narrow to a shipment it does not know about.
            await splitInvoiceLineForOverage({
                originalItemId,
                target,
                excess: row.qty || 0,
                deliveryRecordId: attachedDeliveryRecordId(row),
                overagePORecordId: poRecordId,
            });

            applied++;
        } catch (err) {
            failed.push({ rowId: row.deliveryItemId, message: err?.message || String(err) });
        }
    }

    return { attempted: rows.length, applied, skipped, failed };
}

/**
 * Move the billed excess from the original ordered item's invoice item onto the
 * overage order's.
 *
 * NOTHING ON THE INVOICE HEADER MOVES. The quantities and prices on both sides sum
 * to what they summed to before, so `Items Subtotal`, `Calculated Total`,
 * `Amount Due` and `Paid` are all untouched — only the attribution shifts. That is
 * precisely why an ALREADY PAID invoice can be split, which is the common case:
 * the bill usually arrives and is settled before anyone raises the correction.
 *
 * TWO BRANCHES, because a bill whose whole invoice item IS the excess would
 * otherwise be left at qty 0: such an invoice item is RE-POINTED rather than
 * split, so the invoice keeps one invoice item for it and the items table has
 * nothing to fold.
 */
async function splitInvoiceLineForOverage({
    originalItemId,
    target,
    excess,
    deliveryRecordId,
    overagePORecordId,
}) {
    // getPOItemsForReconciliation rather than getPOItemByRecordId: only that
    // projection carries the `Invoice Items` reverse-link this needs.
    const [orderedItem] = await getPOItemsForReconciliation([originalItemId]);
    if (!orderedItem) return { split: false, reason: "the ordered item is gone" };

    const bills = (await billsByOrderedItem([orderedItem])).get(originalItemId) ?? [];
    // THE SAME PREDICATE AS THE PREVIEW, WITH THE SAME SHIPMENT (#219). The bill this
    // splits has to be the one the correction quoted, or the invoice item moved would
    // belong to an arrival the request never mentioned.
    const { bill } = selectOverageBill({ bills, excess, deliveryRecordId });
    if (!bill) return { split: false, reason: "no single bill can carry the excess" };

    // The invoice items whose Variance Flag the split changes, collected as they are
    // written so nothing has to go looking for the new one afterwards.
    const touched = [];

    const wholeLine = (bill.qty || 0) === excess;
    if (wholeLine) {
        await updateInvoiceItem(bill.invoiceItemRecordId, {
            poRecordId: overagePORecordId,
            poItemRecordId: target.id,
        });
        touched.push({ lineId: bill.invoiceItemRecordId, poItemRecordId: target.id });
    } else {
        await updateInvoiceItem(bill.invoiceItemRecordId, { qty: (bill.qty || 0) - excess });
        const created = await createInvoiceItem({
            invoiceRecordId: bill.invoiceRecordId,
            invoiceId: bill.invoiceId,
            poRecordId: overagePORecordId,
            poItemRecordId: target.id,
            itemName: target.itemName,
            size: target.size,
            unit: target.unit,
            qty: excess,
            unitPrice: bill.unitPrice,
            remark: bill.remark,
        });
        touched.push(
            { lineId: bill.invoiceItemRecordId, poItemRecordId: originalItemId },
            { lineId: created.id, poItemRecordId: target.id }
        );
    }

    // The join table has to learn about the overage PO too, or the order looks
    // invoice-free — which would let #138 withdraw it and take the excess with it.
    await linkInvoiceToPO(bill.invoiceRecordId, overagePORecordId);

    // RECOMPUTED with the same two functions createInvoiceAction uses, not assumed
    // to have cleared. The split is exactly the event that resolves a qty variance
    // on the original invoice item, and asserting that without measuring it would be a
    // second implementation of the rule. Sequential, because both reads hit
    // Airtable's per-base budget and the pair is short.
    for (const { lineId, poItemRecordId } of touched) {
        await recomputeLineVariance(lineId, poItemRecordId, bill.unitPrice);
    }

    return { split: true, wholeLine, invoiceRecordId: bill.invoiceRecordId };
}

/** One invoice item's Variance Flag, on createInvoiceAction's own terms. */
async function recomputeLineVariance(invoiceItemRecordId, poItemRecordId, unitPrice) {
    if (!invoiceItemRecordId || !poItemRecordId) return;
    const poItem = await getPOItemByRecordId(poItemRecordId);
    const invoicedQty = await getInvoicedQtyForPOItem(poItemRecordId);
    await updateInvoiceItem(invoiceItemRecordId, {
        varianceFlag:
            checkUnitPriceVariance(unitPrice, poItem.unitPrice) || invoicedQty > (poItem.qty || 0),
    });
}
