// The read side of #166's two axes, rewritten around #210's stored pairing.
//
// `Invoices."Delivery"` names the shipment a bill describes, so the join that used
// to be computed is now READ. The old path was `Invoice Items` -> `PO Item` <-
// `Delivery Items`, with the ordered item as the only thing both axes touched, and
// it could not say WHICH shipment answered WHICH bill — so #166 filled bills
// oldest-first with whatever had arrived on the ordered item and marked the result
// inferred. The ordered item is still where QUANTITIES are compared, because that
// is the only level both documents carry a quantity for; what changed is that the
// pairing is looked up instead of guessed.
//
// TWO WALKS, NOT ONE, unchanged in shape: the two screens start from opposite ends
// and neither result derives from the other. The invoice axis asks "did what we
// were billed for arrive"; the delivery axis asks "has what arrived been billed".
//
// THE BUDGET FELL, AND THE TWO LEVELS THAT WENT ARE THE TWO THE INFERENCE NEEDED.
// Deciding whether THIS bill was covered used to mean reading every OTHER bill on
// the same ordered item and its parent's `Issue Date`, to know what order to fill
// them in. With the pairing stored, neither is anybody's business:
//
//   invoice axis (list)                   invoice axis (detail)
//   1  Invoice Items (by record id)       1  PO Items       (by record id)
//   2  Deliveries    (from the invoices'  2  Delivery Items (from PO Items'
//        own `Delivery` links)                 reverse-link)
//   3  Delivery Items (from those         3  Deliveries     (parents of those
//        deliveries' reverse-link)              slices, for their dates)
//
//   delivery axis
//   1  Delivery Items (by record id)
//   2  Invoices       (from the deliveries' own `Invoices` links)
//   3  Invoice Items  (from those invoices' reverse-link)
//
// So 3 operations on each of the three, down from 5 / 5 / 3 — plus one extra per 50
// ids inside a batched step, the same term #19 and #162 record. The caller already
// holds level 0 (the invoices or the deliveries and their own link arrays), which
// is what makes step 1 free of a query of its own. THESE ARE CEILINGS, NOT FIXED
// NUMBERS: findByRecordIds returns early on an empty id list, so an invoice with no
// delivery named measures 1 and a delivery nobody has billed measures 1 too.
//
// THE LIST AXIS NO LONGER READS `PO Items` AT ALL, which is the sharpest form of
// the same point. The list needs one fact per invoice — is the shipment here, and
// did it bring everything billed — and both come from the bill's own quantity
// against the named shipment's slices. What was ORDERED is a third document's
// figure, and only the detail shows it.
//
// The alternative is one or two round trips PER ROW, which #143 established should
// not happen and #162 measured at over 200 for an Admin.
//
// #166 WITHHELD THE DELIVERY AXIS FROM SITE STAFF AND #211 RELEASED IT, so no
// caller here takes a privileged flag. The withholding was real — a page that
// fetched the invoice levels and then declined to render the column would have been
// hiding rather than withholding, so `getDeliveryInvoicing` was simply not called —
// but the line it drew does not survive the reason for it. The deliveries list is
// Job-scoped, and #211 admits an employee to the invoices of any job they are
// assigned to, so "has this been billed" is no longer a fact kept from them one
// screen away. Payment is what stays behind, and no function here reads it.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The pure half is lib/deliveryStatus.js.

import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getPOItemsForReconciliation } from "./airtable/poItems";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getInvoicesByRecordIds } from "./airtable/invoices";
import { linkedDelivery } from "./deliveryInvoiceLink";
import {
    countsTowardStatus,
    invoiceShareStatus,
    lineStatus,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "./deliveryStatus";

/**
 * Invoice Items by record id, with the ordered item flattened to the single value
 * it is in practice.
 *
 * THE READER ITSELF MOVED TO THE TABLE MODULE IN #167, which needs the same level
 * for the overage affordance — a second batched reader for one table is exactly the
 * duplication that drifts. What stays here is the flattening: `countsTowardStatus`
 * and everything downstream of it read `poItemRecordId`, and that is this module's
 * own shape rather than the table's.
 */
async function getBills(recordIds) {
    return (await getInvoiceItemsByRecordIds(recordIds)).map((item) => ({
        ...item,
        invoice: item.invoice || [],
        poItemRecordId: (item.poItem || [])[0] ?? null,
    }));
}

/**
 * How much each shipment brought, per ordered item — keyed `delivery::poItem`.
 *
 * THE KEY IS THE PAIR, and that is the whole of what #210 buys on this axis. #166
 * could only total an ordered item's arrivals across every shipment, which is why
 * attributing one to a bill needed an ordering; keeping the delivery in the key
 * turns the same rows into a lookup.
 *
 * Slices with no `PO Item` are skipped: they name no ordered item, so there is
 * nothing to compare them against. #165 stopped the app writing one, and the
 * reading side still has to survive a link removed by hand.
 */
function arrivedByDeliveryAndLine(slices) {
    const byPair = new Map();
    for (const slice of slices || []) {
        const deliveryRecordId = slice.delivery?.[0];
        const lineId = slice.poItem?.[0];
        if (!deliveryRecordId || !lineId) continue;
        const key = `${deliveryRecordId}::${lineId}`;
        byPair.set(key, (byPair.get(key) || 0) + (slice.qty || 0));
    }
    return byPair;
}

/**
 * Split a level's delivery slices into within-order and beyond-order totals per
 * ordered item, and remember which shipments they came from.
 *
 * The whole reason this feature reads `Delivery Items` rather than
 * `PO Items."Delivered Qty"`: that rollup adds the two together and only the rows
 * carry `Over Delivered`. #165 attaches every row, so the rollup is complete — it
 * is simply no longer decomposable, which is what a screen that separates them
 * needs.
 */
function deliveredByPOItem(deliverySlices) {
    const byLine = new Map();
    for (const slice of deliverySlices) {
        const lineId = slice.poItem?.[0];
        if (!lineId) continue;
        const acc = byLine.get(lineId) || { within: 0, beyond: 0, deliveryIds: new Set() };
        if (slice.overDelivered) acc.beyond += slice.qty || 0;
        else acc.within += slice.qty || 0;
        if (slice.delivery?.[0]) acc.deliveryIds.add(slice.delivery[0]);
        byLine.set(lineId, acc);
    }
    return byLine;
}

/**
 * The delivery status of many invoices at once, for the invoice list.
 *
 * `invoices` are already-loaded invoice objects carrying their `invoiceItems` and
 * `delivery` link arrays — which getAllInvoices() supplies — so this costs no
 * Invoices query of its own.
 *
 * Returns a Map of invoice record id -> the summary lib/deliveryStatus.js produces.
 * An invoice with no invoice items at all gets a summary too, so a caller never has to
 * distinguish "no entry" from "nothing to compare"; and since the chip comes from
 * the link rather than from the invoice items, that summary is still an answer.
 */
export async function getInvoiceDeliveryStatus(invoices) {
    const byInvoice = new Map();
    const list = invoices || [];
    if (list.length === 0) return byInvoice;

    const invoiceItems = await getBills(list.flatMap((inv) => inv.invoiceItems || []));

    // Free-text invoice items name no ordered item, so they are dropped from the
    // quantity comparison here and counted per invoice — see countsTowardStatus
    // for why comparing them to nothing would make every invoice with such an
    // invoice item read as short.
    const judged = invoiceItems.filter(countsTowardStatus);
    const excludedByInvoice = new Map();
    for (const item of invoiceItems) {
        if (countsTowardStatus(item)) continue;
        const parent = item.invoice?.[0];
        if (!parent) continue;
        excludedByInvoice.set(parent, (excludedByInvoice.get(parent) || 0) + 1);
    }

    // The shipments these bills name, and what each of them brought. Two levels,
    // both batched, both zero when nothing on the page is paired yet.
    const deliveryByInvoice = new Map(list.map((inv) => [inv.id, linkedDelivery(inv)]));
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set([...deliveryByInvoice.values()].filter(Boolean)),
    ]);
    const arrived = arrivedByDeliveryAndLine(
        await getDeliveryItemsByRecordIds(deliveries.flatMap((d) => d.deliveryItems || []))
    );

    // THIS BILL AGAINST THE SHIPMENT IT NAMES, per ordered item. No sibling bill is
    // read and no ordering is applied — the pairing decides, which is the whole of
    // what #210 changed here.
    const statusesByInvoice = new Map();
    for (const item of judged) {
        const parent = item.invoice?.[0];
        if (!parent) continue;
        const deliveryRecordId = deliveryByInvoice.get(parent) ?? null;
        const status = invoiceShareStatus({
            billed: item.qty,
            arrived: deliveryRecordId
                ? arrived.get(`${deliveryRecordId}::${item.poItemRecordId}`) || 0
                : 0,
        });
        if (!statusesByInvoice.has(parent)) statusesByInvoice.set(parent, []);
        statusesByInvoice.get(parent).push(status);
    }

    for (const inv of list) {
        byInvoice.set(
            inv.id,
            summarizeInvoiceStatus({
                lines: statusesByInvoice.get(inv.id) || [],
                hasDelivery: Boolean(deliveryByInvoice.get(inv.id)),
                excludedCount: excludedByInvoice.get(inv.id) || 0,
            })
        );
    }
    return byInvoice;
}

/**
 * One invoice's detail, as ONE ROW PER INVOICE ITEM — including the invoice items that
 * name no ordered item, which say so where they are rather than in a footnote
 * about invoice items the reader cannot see.
 *
 * EACH ROW CARRIES ITS OWN DELIVERIES, and that placement is a claim about scope.
 * A row is scoped to one ordered item, so the deliveries listed under it are the
 * ones that touched THAT ordered item — which is exactly the claim the data
 * supports. The first version put them in a section of their own at the foot of
 * the page and had to be headed "recorded against the same order lines" to avoid
 * over-claiming; inside the row that qualification is structural and the label is
 * just `Deliveries`.
 *
 * AND SINCE #210 ONE OF THEM IS NAMED. What this section could not claim was which
 * shipment brought the quantity attributed to this bill — the quantity was
 * attributed, the arrival was not. The pairing settles it, so the delivery this
 * invoice names is marked and sorted first, and the others are what explain why the
 * ordered item's `Delivered` total is larger than this bill's share.
 *
 * `invoiceLines` are the invoice's own already-loaded Invoice Items, which the
 * detail page holds anyway, so this adds no query for them.
 * `linkedDeliveryRecordId` comes off the invoice record the page also holds.
 */
export async function getInvoiceReconciliation(invoiceLines, { linkedDeliveryRecordId } = {}) {
    const lines = (invoiceLines || []).map((l) => ({
        id: l.id,
        invoiceItemId: l.invoiceItemId,
        poItemRecordId: (l.poItem || [])[0] ?? null,
        itemName: l.itemName,
        size: l.size,
        unit: l.unit,
        qty: l.qty,
    }));

    /** An invoice item with nothing to compare against. Still gets a row. */
    const notComparedRow = (l) => ({
        invoiceItemId: l.invoiceItemId,
        itemName: l.itemName || "",
        size: l.size || "",
        unit: l.unit || "",
        poItemId: null,
        // #167 — no ordered item means no order to name and no material to fold on.
        poRecordId: null,
        materialRecordId: null,
        billedOnThisInvoice: l.qty || 0,
        line: null,
        status: null,
        deliveries: [],
    });

    const judged = lines.filter(countsTowardStatus);
    if (judged.length === 0) {
        return {
            rows: lines.map(notComparedRow),
            excludedCount: lines.length,
            summary: summarizeInvoiceStatus({
                lines: [],
                hasDelivery: Boolean(linkedDeliveryRecordId),
                excludedCount: lines.length,
            }),
        };
    }

    const poItems = await getPOItemsForReconciliation([...new Set(judged.map((l) => l.poItemRecordId))]);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    // Every arrival on those ordered items, in one batched read. Two things come out
    // of the same rows: the ordered item's own totals, split on `Over Delivered`,
    // and how much the shipment THIS invoice names brought.
    const slices = await getDeliveryItemsByRecordIds(poItems.flatMap((p) => p.deliveryItems || []));
    const deliveredByLine = deliveredByPOItem(slices);
    const arrived = arrivedByDeliveryAndLine(slices);

    // The deliveries themselves, for their dates. One batched read over the
    // distinct parents of every slice on those ordered items, then distributed to
    // the rows — one query whether the invoice has one invoice item or ten.
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set([...deliveredByLine.values()].flatMap((d) => [...d.deliveryIds])),
    ]);
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));

    // IN THE INVOICE'S OWN INVOICE ITEM ORDER, judged and not-compared
    // interleaved, so the boxes read down the page in the same order as the items
    // table above them.
    const rows = lines.map((l) => {
        const line = countsTowardStatus(l) ? poItemById.get(l.poItemRecordId) : null;
        // A link that resolves to nothing is not a judgeable invoice item either —
        // the same outcome as no link at all, so it takes the same row.
        if (!line) return notComparedRow(l);

        const delivered = deliveredByLine.get(line.id) || { within: 0, beyond: 0, deliveryIds: new Set() };
        const lineFacts = lineStatus({
            orderedQty: line.qty,
            invoicedQty: line.invoicedQty,
            deliveredWithinQty: delivered.within,
            deliveredOverQty: delivered.beyond,
        });

        return {
            invoiceItemId: l.invoiceItemId,
            // The label comes from the ORDERED item, which is the document the
            // comparison is against — the same call lib/deliveryCandidates.js
            // makes for its item labels.
            itemName: line.itemName,
            size: line.size,
            unit: line.unit || l.unit || "",
            poItemId: line.poItemId,
            // #167 — the order this box is scoped to, which is why the items table
            // could drop its PO column: a box always has exactly one, and a folded
            // items row spans two. The caller already holds the POs (it fetches
            // them for the invoice's own invoice items), so this is a record id rather
            // than another query.
            poRecordId: line.po?.[0] ?? null,
            // #167 — #18's item identity, the key the items table folds a split
            // invoice item back together on. Never `Item Name` text.
            materialRecordId: line.material?.[0] ?? null,
            billedOnThisInvoice: l.qty || 0,
            // The ordered item's own totals — what the box's figures line shows,
            // all three at the same scope so they add up against each other.
            line: lineFacts,
            status: {
                ...invoiceShareStatus({
                    billed: l.qty,
                    arrived: linkedDeliveryRecordId
                        ? arrived.get(`${linkedDeliveryRecordId}::${line.id}`) || 0
                        : 0,
                }),
                // The beyond-the-order facts belong to the ORDER, not to one bill,
                // so they are carried from the ordered item rather than from the share.
                arrivedBeyondOrder: lineFacts.arrivedBeyondOrder,
                billedBeyondOrder: lineFacts.billedBeyondOrder,
            },
            // The one this invoice names first, then the rest newest-first, matching
            // the deliveries list's default order.
            deliveries: [...(delivered.deliveryIds || [])]
                .map((id) => deliveryById.get(id))
                .filter(Boolean)
                .map((d) => ({ ...d, named: d.id === linkedDeliveryRecordId }))
                .sort((a, b) => {
                    if (a.named !== b.named) return a.named ? -1 : 1;
                    return (b.receivedDate || "").localeCompare(a.receivedDate || "");
                }),
        };
    });

    // COUNTED OFF THE ROWS, not off `judged`. An invoice item whose `PO Item` link
    // resolves to nothing took the not-compared row above, so counting the
    // filter's input would let the summary claim a judged invoice item the page
    // does not show.
    const judgedStatuses = rows.filter((r) => r.status).map((r) => r.status);

    return {
        rows,
        excludedCount: rows.length - judgedStatuses.length,
        summary: summarizeInvoiceStatus({
            lines: judgedStatuses,
            hasDelivery: Boolean(linkedDeliveryRecordId),
            excludedCount: rows.length - judgedStatuses.length,
        }),
    };
}

/**
 * The invoicing status of many deliveries at once, for the deliveries list.
 *
 * CALLED FOR EVERY VIEWER SINCE #211. It used to be the caller's decision, and
 * skipping it was the withholding; the deliveries list is Job-scoped and #211
 * admits an employee to that job's invoices, so there is no viewer left for whom
 * this level is out of bounds. See the module header.
 *
 * `deliveries` are already-loaded delivery objects carrying their `deliveryItems`
 * and `invoices` link arrays, which the list already reads.
 *
 * IT NO LONGER READS `PO Items`, AND THAT IS #210's DOING. The old walk went out to
 * the ordered items to ask whether ANY invoice item hung off them — an existence
 * test over a level shared with every other arrival on the same order. Both sides
 * carry the ordered item's record id directly, so with the pairing stored the join
 * is a comparison between two levels this walk already has.
 *
 * Returns `{ byDelivery, slices }` — a Map of delivery record id -> summary, and
 * THE DELIVERY ITEM ROWS IT READ TO BUILD IT.
 *
 * IT USED TO RETURN THE MAP ALONE, AND THAT COST ITS CALLERS A SECOND READ OF A
 * LEVEL THIS FUNCTION ALREADY HAD IN HAND (#216). `/deliveries` fetched the same
 * slices itself to summarize what arrived, so one page load read Delivery Items
 * twice — invisible for as long as it stood, because that page carried no
 * `withOpsLabel` and nothing measured it. #216 added the second consumer and the
 * label in the same change, which is what made the duplicate visible at all.
 *
 * A function that reads something and does not hand it back forces the next
 * caller to read it again, so the fix belongs here rather than in a cache at each
 * call site.
 */
export async function getDeliveryInvoicing(deliveries) {
    const byDelivery = new Map();
    const list = deliveries || [];
    if (list.length === 0) return { byDelivery, slices: [] };

    const slices = await getDeliveryItemsByRecordIds(list.flatMap((d) => d.deliveryItems || []));

    // The bills naming these shipments, and their invoice items. Both levels are
    // empty — and therefore free — for a delivery nobody has billed yet, which is
    // the state the vendor-chasing worklist is made of.
    const invoices = await getInvoicesByRecordIds([
        ...new Set(list.flatMap((d) => d.invoices || [])),
    ]);
    const billsByInvoice = new Map(invoices.map((inv) => [inv.id, inv]));
    const bills = await getBills(invoices.flatMap((inv) => inv.invoiceItems || []));

    // What the bills naming ONE delivery charge for, per ordered item. Keyed
    // `delivery::poItem`, the same pairing key the invoice axis uses.
    const deliveryByInvoice = new Map();
    for (const d of list) {
        for (const invoiceRecordId of d.invoices || []) {
            if (billsByInvoice.has(invoiceRecordId)) deliveryByInvoice.set(invoiceRecordId, d.id);
        }
    }
    const billedByPair = new Map();
    for (const bill of bills) {
        const deliveryRecordId = deliveryByInvoice.get(bill.invoice?.[0]);
        if (!deliveryRecordId || !bill.poItemRecordId) continue;
        const key = `${deliveryRecordId}::${bill.poItemRecordId}`;
        billedByPair.set(key, (billedByPair.get(key) || 0) + (bill.qty || 0));
    }

    const linesByDelivery = new Map();
    for (const slice of slices) {
        const parent = slice.delivery?.[0];
        const lineId = slice.poItem?.[0];
        if (!parent || !lineId) continue;
        if (!linesByDelivery.has(parent)) linesByDelivery.set(parent, new Map());
        const forDelivery = linesByDelivery.get(parent);
        // ONE ENTRY PER DISTINCT ORDERED ITEM, with the delivery's slices summed
        // into it: a delivery can hold two slices of one ordered item — the
        // within-order one and the excess — and counting them as two would make "1
        // of 2 invoiced" out of a single ordered item.
        const entry = forDelivery.get(lineId) || {
            poItemRecordId: lineId,
            arrived: 0,
            billed: billedByPair.get(`${parent}::${lineId}`) || 0,
        };
        entry.arrived += slice.qty || 0;
        forDelivery.set(lineId, entry);
    }

    for (const d of list) {
        byDelivery.set(
            d.id,
            summarizeDeliveryInvoicing([...(linesByDelivery.get(d.id)?.values() || [])])
        );
    }
    return { byDelivery, slices };
}
