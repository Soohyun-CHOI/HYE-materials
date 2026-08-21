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
import { createSigner, getSignersByPR, getSignersByRecordIds } from "./airtable/prSigners";
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
import { sortLongestWaitingFirst } from "./deliveryStatus";
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
    OVERAGE_COPY,
    attachedDeliveryRecordId,
    awaitsCorrection,
    describeOveragePreview,
    isNoLongerOverDelivered,
    isOverageApplied,
    overageBannerState,
    overageEligibility,
    overageStageKey,
    resolveOriginalPOItem,
    selectCopyableSigners,
    selectOverageInvoice,
    tieBreakLabel,
} from "./overage";

/**
 * Every invoice on a set of ordered items, in the shape lib/overage.js wants, keyed by
 * PO Item record id.
 *
 * Two batched reads whatever the row count — the invoice items off the ordered
 * items' own reverse-link, then their parents for `Issue Date`, `Invoice ID` and
 * the file the quotation is taken from. Same discipline as
 * lib/deliveryReconciliation.js:getDeliveryInvoicing, which needs a different
 * projection of the same level (it wants coverage; this wants the file and the
 * price). It said `billsByPOItem` until #274, which #210 had already deleted.
 *
 * #219 ADDED THE PAIRING TO THE PROJECTION AND NO QUERY WITH IT. These invoices are
 * already read for their date and their file, so which delivery each one names comes
 * off records this function has in hand — which is what makes narrowing the
 * candidates cost nothing. Flattened through `linkedDelivery` rather than indexed
 * here, so #210's single-record rule keeps one home.
 */
async function invoicesByOrderedItem(poItems) {
    const invoiceItems = await getInvoiceItemsByRecordIds(poItems.flatMap((p) => p.invoiceItems || []));
    const invoices = await getInvoicesByRecordIds([
        ...new Set(invoiceItems.map((l) => l.invoice?.[0]).filter(Boolean)),
    ]);
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

    const byItem = new Map();
    for (const item of invoiceItems) {
        const itemId = (item.poItem || [])[0];
        const invoiceRecordId = item.invoice?.[0];
        if (!itemId || !invoiceRecordId) continue;
        const invoice = invoiceById.get(invoiceRecordId);
        if (!byItem.has(itemId)) byItem.set(itemId, []);
        byItem.get(itemId).push({
            invoiceItemRecordId: item.id,
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
            // #219 — the delivery this invoice describes, or null when nothing names
            // one. Both are answers: selectOverageInvoice takes the first as evidence
            // and the second as the absence of it.
            deliveryRecordId: invoice ? linkedDelivery(invoice) : null,
            qty: item.qty || 0,
            unitPrice: item.unitPrice ?? null,
            remark: item.remark || "",
        });
    }
    return byItem;
}

/**
 * The overage picture for a set of over-delivery rows.
 *
 * Called only for rows that are flagged or already carry a correction, so an
 * ordinary delivery costs no query at all. Every read is batched and none is per
 * row: the ordered items, their invoices, those invoices' invoices, the linked PRs, the
 * POs of both sides, the requests behind the orders and their signing chains.
 *
 * ROWS MAY SPAN DELIVERIES SINCE #217, which is what lets the strip above `/prs`
 * price the whole page at one walk instead of one per delivery — measured at 38
 * operations for this base's six rows called per delivery against 19 called once.
 * `deliveryIds` is a Map of delivery record id -> `Delivery ID`, supplied by the
 * caller because every caller already holds the deliveries; the human id is needed
 * only for copy, so reading them here would be a query for a string the caller has.
 *
 * Returns a Map of Delivery Item record id -> everything a screen needs:
 * `{ eligibility, awaitsCorrection, bannerState, noLongerOverDelivered, invoice,
 * orderedItem, originalPR, facts }`. The last field was `bill` here until #274 and
 * the shape had said `invoice` since #227.
 */
export async function getOverageContext(deliveryItems, { deliveryIds } = {}) {
    const rows = (deliveryItems || []).filter((r) => r.overDelivered || r.overagePRRecordId);
    const out = new Map();
    if (rows.length === 0) return out;

    // The ORIGINAL ordered item in every state — the row's own link before the
    // apply step, the provenance link after it.
    const orderedItemIds = [...new Set(rows.map(resolveOriginalPOItem).filter(Boolean))];
    const poItems = await getPOItemsForReconciliation(orderedItemIds);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    const [invoicesByItem, prs] = await Promise.all([
        invoicesByOrderedItem(poItems),
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
    const originalPRs = await getPRsByRecordIds([
        ...new Set(poItems.map((p) => poById.get(p.po?.[0])?.pr?.[0]).filter(Boolean)),
    ]);
    const originalPRById = new Map(originalPRs.map((pr) => [pr.id, pr]));

    // THE CHAINS IN TWO READS FOR ANY NUMBER OF REQUESTS (#217), where this was a
    // loop calling copyableSigners once per request. That cost 14 of the 19
    // operations this function spent on six rows, and none of the 14 was the data:
    // `getSignersByPR` re-`find()`s a request THIS FUNCTION ALREADY HOLDS to reach a
    // reverse-link `recordToPR` already carries, and `getActiveUsers()` read the whole
    // Users table once per request — six reads of one table in one render. Both
    // collapse into one batched read each; the rule that picks the signers is
    // lib/overage.js's and is shared with the write path.
    const [signerRows, activeUsers] = await Promise.all([
        getSignersByRecordIds(originalPRs.flatMap((pr) => pr.signerRowIds || [])),
        getActiveUsers(),
    ]);
    const activeUserIds = new Set(activeUsers.map((u) => u.id));
    const signerRowsByPR = new Map();
    for (const signerRow of signerRows) {
        const parent = signerRow.pr?.[0];
        if (!parent) continue;
        if (!signerRowsByPR.has(parent)) signerRowsByPR.set(parent, []);
        signerRowsByPR.get(parent).push(signerRow);
    }
    const chainByPR = new Map(
        originalPRs.map((pr) => [
            pr.id,
            selectCopyableSigners(signerRowsByPR.get(pr.id) || [], activeUserIds),
        ])
    );

    for (const row of rows) {
        const orderedItem = poItemById.get(resolveOriginalPOItem(row)) ?? null;
        const invoices = invoicesByItem.get(orderedItem?.id) ?? [];
        const overagePR = row.overagePRRecordId ? prById.get(row.overagePRRecordId) ?? null : null;
        const overagePO = overagePR?.purchaseOrders?.[0]
            ? poById.get(overagePR.purchaseOrders[0]) ?? null
            : null;

        // #265 — the three totals the agreement is read from, all off the ordered item
        // this function already holds. `Qty` is the frozen snapshot; `Delivered Qty`
        // and `Invoiced Qty` are Airtable rollups, so nothing here recomputes what the
        // base already sums and no read is added.
        const eligibility = overageEligibility({
            row,
            invoices,
            overagePR,
            overagePO,
            orderedItem: orderedItem
                ? {
                      orderedQty: orderedItem.qty,
                      deliveredQty: orderedItem.deliveredQty,
                      invoicedQty: orderedItem.invoicedQty,
                  }
                : null,
        });
        const invoice =
            eligibility.invoice ??
            selectOverageInvoice({
                invoices,
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).invoice ??
            null;

        const originalPR = originalPRById.get(poById.get(orderedItem?.po?.[0])?.pr?.[0]) ?? null;
        const chain = originalPR ? chainByPR.get(originalPR.id) : null;

        out.set(row.id, {
            eligibility,
            // #217 — the strip's selection, judged where the PR and PO are in hand so
            // no caller has to hold them to ask.
            awaitsCorrection: awaitsCorrection({ row, overagePR, overagePO }),
            bannerState: overageBannerState({ row, overagePR, overagePO }),
            noLongerOverDelivered: isNoLongerOverDelivered(row),
            invoice,
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
                deliveryId: deliveryIds?.get(row.delivery?.[0]) ?? null,
                // #217 — which stage a live correction has reached, for the refusal
                // that names it. Free: the PR is already here.
                overageStage: overageStageKey(overagePR, overagePO),
                invoiceId: invoice?.invoiceId ?? null,
                unitPriceLabel: invoice?.unitPrice != null ? formatUSD(invoice.unitPrice) : null,
                overagePrId: overagePR?.prId ?? null,
                overagePoId: overagePO?.poId ?? null,
            },
        });
    }

    return out;
}

/**
 * Every over-delivery on the viewer's jobs that no live correction covers, longest
 * wait first — the strip above `/prs` (#217).
 *
 * TAKES THE JOBS THE CALLER HAS ALREADY NARROWED, which is both cheaper and the
 * gate. `/prs` reads `getAllJobs()` for its own filters, so the delivery ids come
 * off records it holds; passing the ACCESSIBLE jobs means a delivery on a job the
 * viewer cannot reach is never fetched, rather than fetched and filtered.
 *
 * THE ROWS ARE GATED BY THE DELIVERY RULE, NOT THE PAGE'S, and that is #216's
 * finding applied rather than rediscovered: the table below is purchase requests
 * under `canViewPR`, these rows are deliveries under `canAccessJobDeliveries`, and the
 * two admit different people — `canViewPR` also admits a requester, a signer and the
 * recipient of a correction request, none of whom need a job assignment. The
 * decisive reason to use this one is that `createOverageDraftAction` re-authorizes on
 * it: gating the list any other way would render a button the action refuses.
 * Measured on this base the two agree on all six rows, because every excess here is
 * on one job that the non-Admin fixture is assigned to — so the divergence is real in
 * the rules and not observable in this data.
 *
 * FOUR BATCHED READS PLUS ONE WALK, none of them per row: the deliveries, their
 * rows, and then `getOverageContext` once for every flagged row on the page.
 */
export async function getUncorrectedOverages(jobs) {
    const deliveryRecordIds = (jobs || []).flatMap((j) => j.deliveries || []);
    if (deliveryRecordIds.length === 0) return [];

    const deliveries = await getDeliveriesByRecordIds(deliveryRecordIds);
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const rows = await getDeliveryItemsByRecordIds(
        deliveries.flatMap((d) => d.deliveryItems || [])
    );

    // Flagged or already corrected, which is getOverageContext's own population: the
    // corrected ones are read so `awaitsCorrection` can drop them for the right
    // reason rather than by never having looked.
    const flagged = rows
        .filter((r) => r.overDelivered || r.overagePRRecordId)
        // BY `Delivery Item ID` FIRST, and this is what makes the ordering below
        // total. Two over-delivery rows can share a delivery — two materials, each
        // exceeding its own ordered item — and then both carry the same
        // `Received Date` and the same `Created At`, so the date ordering cannot
        // separate them. Array#sort is stable, so feeding it in id order leaves such
        // a pair in id order instead of in whatever order the ids were fetched.
        .sort((a, b) => String(a.deliveryItemId || "").localeCompare(String(b.deliveryItemId || "")));
    if (flagged.length === 0) return [];

    const contextByRow = await getOverageContext(flagged, {
        deliveryIds: new Map(deliveries.map((d) => [d.id, d.deliveryId])),
    });

    const stripRows = [];
    for (const row of flagged) {
        const context = contextByRow.get(row.id);
        if (!context?.awaitsCorrection) continue;

        const delivery = deliveryById.get(row.delivery?.[0]);
        const { eligibility, facts } = context;
        const eligible = Boolean(eligibility.eligible);

        stripRows.push({
            // The record id, because that is what createOverageDraftAction takes.
            id: row.id,
            deliveryItemId: row.deliveryItemId,
            deliveryId: delivery?.deliveryId ?? null,
            // Both dates come from the parent, which is the only place either exists:
            // a `Delivery Items` row carries no date of its own.
            //
            // `waitingSince` IS WHAT THE SHARED SORT ORDERS BY (#256), which renamed it
            // off `receivedDate` once a third caller began passing an invoice's date.
            // The specific name stays beside it because this row is delivery-derived
            // and the paragraph below names the field it chose; the neutral one is a
            // claim about which date this row waits from, and here they are the same
            // date said twice for two purposes.
            waitingSince: delivery?.receivedDate ?? null,
            receivedDate: delivery?.receivedDate ?? null,
            // `createdKey` since #256's second pass — the tie-break generalized the
            // same way, so the invoice axis can pass an id where this passes a stamp.
            createdKey: delivery?.createdAt ?? null,
            itemName: facts.itemName,
            size: facts.size,
            unit: facts.unit,
            excess: facts.excess,
            originalPoId: facts.originalPoId,
            eligible,
            // A CHIP FOR A BLOCKED ROW, A MODAL FOR AN ELIGIBLE ONE — the density
            // split OVERAGE_COPY.strip explains. The full sentence still exists and is
            // still the delivery detail's.
            reason: eligible ? null : OVERAGE_COPY.strip.reason[eligibility.blocked] ?? null,
            messages: eligible
                ? describeOveragePreview(eligibility, facts).map((m) => m.text)
                : [],
            // #265 — the same `!` in the same place, about a different fact: several
            // invoices could have supplied the quotation rather than a guess having
            // been made. `inferredLabel` stood here and went with #219's tiers.
            tieBreakLabel: eligible ? tieBreakLabel(eligibility) : null,
        });
    }

    // `Received Date` ASCENDING — the same key and the same function the deliveries
    // list and #216's strip order by, so one delivery appears in the same position on
    // every screen that lists it. The alternative was `Created At`, when the excess
    // was RECORDED rather than when it landed; the two disagree on this base
    // (measured), and the delivery date wins because the excess is a fact about the
    // delivery and that is the date every other screen shows for it.
    return sortLongestWaitingFirst(stripRows);
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

    const [invoicesByItem, pos] = await Promise.all([
        invoicesByOrderedItem(poItems),
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
            const invoice = selectOverageInvoice({
                invoices: invoicesByItem.get(orderedItem?.id) ?? [],
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).invoice;
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
                    invoiceId: invoice?.invoiceId ?? null,
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

    const invoicesByItem = await invoicesByOrderedItem(poItems || []);

    return rows
        .map((row) => {
            const overagePR = row.overagePRRecordId ? prById.get(row.overagePRRecordId) ?? null : null;
            const overagePO = overagePR?.purchaseOrders?.[0]
                ? overagePOById.get(overagePR.purchaseOrders[0]) ?? null
                : null;
            const state = overageBannerState({ row, overagePR, overagePO });
            if (!state) return null;
            const invoice = selectOverageInvoice({
                invoices: invoicesByItem.get(resolveOriginalPOItem(row)) ?? [],
                excess: row.qty,
                deliveryRecordId: attachedDeliveryRecordId(row),
            }).invoice;
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
                    invoiceId: invoice?.invoiceId ?? null,
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

    // THE RULE IS lib/overage.js's SINCE #217, shared with the batched read in
    // getOverageContext. It re-sorts by Sequence Order, which is redundant here —
    // getSignersByPR orders its own result and says so — and load-bearing there,
    // where a batched read by record id returns the ids' order. A comment here
    // claimed getSignersByPR does not promise an order, which was false.
    return selectCopyableSigners(chain, activeUsers.map((u) => u.id));
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
export async function createOverageDraft({ user, delivery, row, orderedItem, invoice, originalPR }) {
    const pr = await createPR({
        requesterId: user.id,
        lineId: originalPR.item?.[0] ?? null,
        vendorId: originalPR.vendor?.[0] ?? null,
        notes:
            `Overage correction. ${row.qty} ${row.unit || ""}`.trim() +
            ` of ${[row.itemName, row.size].filter(Boolean).join(" ")} was delivered beyond ` +
            `what ${orderedItem.poItemId} ordered, on delivery ${delivery.deliveryId}. ` +
            `Quoted from ${invoice.invoiceId}, which invoices for it already.`,
    });

    const createdItemIds = [];
    const createdSignerIds = [];
    const createdQuotationIds = [];
    const blobCleanups = [];

    try {
        // 1. The quotation — the invoice's own file, re-uploaded rather than
        //    re-submitted. Same server-side put() shape as the PO PDF.
        const source = invoice.file?.[0];
        if (!source?.url) throw new Error("the invoice has no file to quote from");
        const res = await fetch(source.url);
        if (!res.ok) throw new Error(`could not read the invoice file (${res.status})`);
        const filename = source.filename || `${invoice.invoiceId}.pdf`;
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
                vendorQuotationCode: invoice.vendorInvoiceCode || invoice.invoiceId || "",
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

        // 2. One item: the excess, at the price the vendor invoiced it at.
        const item = await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: row.itemName || orderedItem.itemName,
            size: row.size || orderedItem.size,
            unit: row.unit || orderedItem.unit,
            qty: row.qty,
            unitPrice: invoice.unitPrice ?? orderedItem.unitPrice,
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

            // (ii) The invoice side. The row's own delivery goes with it because the
            //      split has to land on the SAME invoice the preview quoted (#219) —
            //      both sides pick through selectOverageInvoice, and without this the
            //      write would narrow to a delivery it does not know about.
            await splitInvoiceItemForOverage({
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
 * Move the invoiced excess from the original ordered item's invoice item onto the
 * overage order's.
 *
 * NOTHING ON THE INVOICE HEADER MOVES. The quantities and prices on both sides sum
 * to what they summed to before, so `Items Subtotal`, `Calculated Total`,
 * `Amount Due` and `Paid` are all untouched — only the attribution shifts. That is
 * precisely why an ALREADY PAID invoice can be split, which is the common case:
 * the invoice usually arrives and is settled before anyone raises the correction.
 *
 * TWO BRANCHES, because an invoice whose whole invoice item IS the excess would
 * otherwise be left at qty 0: such an invoice item is RE-POINTED rather than
 * split, so the invoice keeps one invoice item for it and the items table has
 * nothing to fold.
 */
async function splitInvoiceItemForOverage({
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

    const invoices = (await invoicesByOrderedItem([orderedItem])).get(originalItemId) ?? [];
    // THE SAME PREDICATE AS THE PREVIEW, WITH THE SAME DELIVERY (#219). The invoice this
    // splits has to be the one the correction quoted, or the invoice item moved would
    // belong to a delivery the request never mentioned.
    const { invoice } = selectOverageInvoice({ invoices, excess, deliveryRecordId });
    if (!invoice) return { split: false, reason: "no single invoice can carry the excess" };

    // The invoice items whose Variance Flag the split changes, collected as they are
    // written so nothing has to go looking for the new one afterwards.
    const touched = [];

    const wholeInvoiceItem = (invoice.qty || 0) === excess;
    if (wholeInvoiceItem) {
        await updateInvoiceItem(invoice.invoiceItemRecordId, {
            poRecordId: overagePORecordId,
            poItemRecordId: target.id,
        });
        touched.push({ invoiceItemId: invoice.invoiceItemRecordId, poItemRecordId: target.id });
    } else {
        await updateInvoiceItem(invoice.invoiceItemRecordId, { qty: (invoice.qty || 0) - excess });
        const created = await createInvoiceItem({
            invoiceRecordId: invoice.invoiceRecordId,
            invoiceId: invoice.invoiceId,
            poRecordId: overagePORecordId,
            poItemRecordId: target.id,
            itemName: target.itemName,
            size: target.size,
            unit: target.unit,
            qty: excess,
            unitPrice: invoice.unitPrice,
            remark: invoice.remark,
        });
        touched.push(
            { invoiceItemId: invoice.invoiceItemRecordId, poItemRecordId: originalItemId },
            { invoiceItemId: created.id, poItemRecordId: target.id }
        );
    }

    // The join table has to learn about the overage PO too, or the order looks
    // invoice-free — which would let #138 withdraw it and take the excess with it.
    await linkInvoiceToPO(invoice.invoiceRecordId, overagePORecordId);

    // RECOMPUTED with the same two functions createInvoiceAction uses, not assumed
    // to have cleared. The split is exactly the event that resolves a qty variance
    // on the original invoice item, and asserting that without measuring it would be a
    // second implementation of the rule. Sequential, because both reads hit
    // Airtable's per-base budget and the pair is short.
    for (const { invoiceItemId, poItemRecordId } of touched) {
        await recomputeInvoiceItemVariance(invoiceItemId, poItemRecordId, invoice.unitPrice);
    }

    return { split: true, wholeInvoiceItem, invoiceRecordId: invoice.invoiceRecordId };
}

/** One invoice item's Variance Flag, on createInvoiceAction's own terms. */
async function recomputeInvoiceItemVariance(invoiceItemRecordId, poItemRecordId, unitPrice) {
    if (!invoiceItemRecordId || !poItemRecordId) return;
    const poItem = await getPOItemByRecordId(poItemRecordId);
    const invoicedQty = await getInvoicedQtyForPOItem(poItemRecordId);
    await updateInvoiceItem(invoiceItemRecordId, {
        varianceFlag:
            checkUnitPriceVariance(unitPrice, poItem.unitPrice) || invoicedQty > (poItem.qty || 0),
    });
}
