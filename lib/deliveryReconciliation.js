// The read side of #166: the two walks that join invoices to deliveries.
//
// There is no `Invoices.Delivery` link and deliberately none — whether to store
// the join was left until this screen has been used. So it is computed, through
// the one path that exists: `Invoice Items` -> `PO Item` <- `Delivery Items`. The
// ordered line is the only thing both axes touch, which is also why it is the
// level the judgment is made at (lib/deliveryStatus.js decides; this only
// fetches).
//
// TWO WALKS, NOT ONE, because the two screens start from opposite ends and
// neither can be derived from the other's result. The invoice axis starts from
// invoices and asks "did what we were billed for arrive"; the delivery axis
// starts from deliveries and asks "has this been billed". A single "join
// everything" query would fetch both directions for both callers and pay twice.
//
// THE QUERY BUDGET IS CONSTANT IN THE NUMBER OF ROWS. Every step fetches a whole
// level at once, keyed on record ids gathered from the level above:
//
//   invoice axis                          delivery axis
//   1  Invoice Items  (by record id)      1  Delivery Items (by record id)
//   2  PO Items       (by record id)      2  PO Items       (by record id)
//   3  Delivery Items (by record id,      3  Invoice Items  (by record id,
//        from PO Items' reverse-link)          from PO Items' reverse-link)
//   4  Invoice Items  (SIBLINGS, from
//        PO Items' reverse-link)
//   5  Invoices       (of those siblings)
//   6  Deliveries     (detail only)
//
// So 5 operations for a page of invoices of any size, 6 for the detail section,
// and 3 for a page of deliveries — plus one extra per 50 ids inside a batched
// step, the same term #19 and #162 record. The caller already holds level 0 (the
// invoices or the deliveries and their own link arrays), which is what makes step
// 1 free of a query of its own.
//
// STEPS 4 AND 5 EXIST BECAUSE THE ANSWER IS ATTRIBUTED TO ONE INVOICE. Deciding
// whether THIS bill was covered means knowing every OTHER bill on the same ordered
// line — how much each billed, and in what order they were raised — so the
// siblings and their `Issue Date`s have to be read even though the caller never
// asked about them. Steps 3 and 4 are independent of each other and run in
// parallel. They are also why the budget is 5 rather than the 3 the first version
// of this module cost: refusing to attribute was cheaper and could not answer
// "may this be paid".
//
// The alternative is one or two round trips PER ROW, which #143 established
// should not happen and #162 measured at over 200 for an Admin.
//
// SERVER-SIDE WITHHOLDING, NOT A HIDDEN COLUMN (#132's shape). The delivery axis
// reaches invoice data, and the deliveries list is Job-scoped — site staff see
// their own jobs there. A page that fetched the invoice levels and then declined
// to render the column would still ship the data in its payload, which is hiding
// rather than withholding. So `getDeliveryInvoicing` is not called at all for a
// non-privileged viewer, and the two extra levels are only paid for by the
// audience that may see them. That is the same decision as /pos/[poId] filtering
// invoice-derived fields out on the server, and it is why this module takes the
// privileged flag rather than a page taking it.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The pure half is lib/deliveryStatus.js.

import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getPOItemsForReconciliation } from "./airtable/poItems";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getInvoicesByRecordIds } from "./airtable/invoices";
import {
    allocateLineToInvoices,
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
 * Every bill on each ordered line, with the two fields the oldest-first order
 * needs — keyed by PO Item record id.
 *
 * This is the level attribution costs. `Invoiced Qty` gives a line's TOTAL, which
 * is enough to say whether the line is covered but not which of its bills is, so
 * the sibling invoice lines and their parents' `Issue Date` / `Invoice ID` have to
 * be read. Two operations, both batched, both constant in the number of rows.
 *
 * Takes the invoice items already in hand so the caller's own level is not fetched
 * twice; only the siblings it does not already have are added.
 */
async function billsByPOItem(poItems, knownInvoiceItems) {
    const known = new Map((knownInvoiceItems || []).map((i) => [i.id, i]));
    const siblingIds = poItems.flatMap((p) => p.invoiceItems || []).filter((id) => !known.has(id));

    const siblings = await getBills(siblingIds);
    const allItems = [...known.values(), ...siblings].filter((i) => i.poItemRecordId);

    // The parents, for Issue Date and Invoice ID. One batched read over the
    // distinct invoices those lines belong to.
    const invoiceIds = [...new Set(allItems.map((i) => i.invoice?.[0]).filter(Boolean))];
    const invoices = await getInvoicesByRecordIds(invoiceIds);
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

    const byLine = new Map();
    for (const item of allItems) {
        const parent = item.invoice?.[0];
        if (!parent) continue;
        const inv = invoiceById.get(parent);
        const bills = byLine.get(item.poItemRecordId) || [];
        bills.push({
            invoiceRecordId: parent,
            invoiceId: inv?.invoiceId ?? null,
            issueDate: inv?.issueDate ?? null,
            billed: item.qty || 0,
        });
        byLine.set(item.poItemRecordId, bills);
    }
    return byLine;
}

/**
 * Split a level's delivery slices into within-order and beyond-order totals per
 * PO line.
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
        const acc = byLine.get(lineId) || { within: 0, beyond: 0, sliceIds: [], deliveryIds: new Set() };
        if (slice.overDelivered) acc.beyond += slice.qty || 0;
        else acc.within += slice.qty || 0;
        acc.sliceIds.push(slice.id);
        if (slice.delivery?.[0]) acc.deliveryIds.add(slice.delivery[0]);
        byLine.set(lineId, acc);
    }
    return byLine;
}

/**
 * The delivery status of many invoices at once, for the invoice list.
 *
 * `invoices` are already-loaded invoice objects carrying their `invoiceItems`
 * link array — which getAllInvoices() supplies since #166 — so this costs no
 * Invoices query of its own.
 *
 * Returns a Map of invoice record id -> the summary lib/deliveryStatus.js
 * produces. An invoice with no lines at all gets a summary too, so a caller never
 * has to distinguish "no entry" from "nothing to compare".
 */
export async function getInvoiceDeliveryStatus(invoices) {
    const byInvoice = new Map();
    const list = invoices || [];
    if (list.length === 0) return byInvoice;

    const invoiceItems = await getBills(list.flatMap((inv) => inv.invoiceItems || []));

    // Free-text lines name no ordered line, so they are dropped from the
    // judgment here and counted per invoice — see countsTowardStatus for why
    // comparing them to nothing would make every invoice with a freight line read
    // as short.
    const judged = invoiceItems.filter(countsTowardStatus);
    const excludedByInvoice = new Map();
    for (const item of invoiceItems) {
        if (countsTowardStatus(item)) continue;
        const parent = item.invoice?.[0];
        if (!parent) continue;
        excludedByInvoice.set(parent, (excludedByInvoice.get(parent) || 0) + 1);
    }

    const poItems = await getPOItemsForReconciliation([
        ...new Set(judged.map((i) => i.poItemRecordId)),
    ]);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    // Independent of each other, so they overlap: the arrivals on those lines and
    // every bill on them.
    const [slices, billsByLine] = await Promise.all([
        getDeliveryItemsByRecordIds(poItems.flatMap((p) => p.deliveryItems || [])),
        billsByPOItem(poItems, invoiceItems),
    ]);
    const deliveredByLine = deliveredByPOItem(slices);

    // THIS INVOICE'S SHARE of each line it bills, not the line's total. The share
    // is determined outright in the common cases and estimated oldest-bill-first
    // only when the ordering decides — see allocateLineToInvoices.
    const statusesByInvoice = new Map();
    for (const item of judged) {
        const parent = item.invoice?.[0];
        if (!parent) continue;
        const line = poItemById.get(item.poItemRecordId);
        if (!line) continue;
        const delivered = deliveredByLine.get(line.id) || { within: 0, beyond: 0 };
        const lineFacts = lineStatus({
            orderedQty: line.qty,
            invoicedQty: line.invoicedQty,
            deliveredWithinQty: delivered.within,
            deliveredOverQty: delivered.beyond,
        });
        const { shares, determinate } = allocateLineToInvoices({
            delivered: lineFacts.delivered,
            invoices: billsByLine.get(line.id) || [],
        });
        const mine = shares.find((sh) => sh.invoiceRecordId === parent);
        const status = {
            ...invoiceShareStatus({
                billed: mine?.billed ?? item.qty,
                arrived: mine?.arrived ?? 0,
                determinate,
            }),
            // The beyond-the-order facts belong to the ORDER, not to one bill, so
            // they are carried from the line rather than from the share.
            arrivedBeyondOrder: lineFacts.arrivedBeyondOrder,
            billedBeyondOrder: lineFacts.billedBeyondOrder,
        };
        if (!statusesByInvoice.has(parent)) statusesByInvoice.set(parent, []);
        statusesByInvoice.get(parent).push(status);
    }

    for (const inv of list) {
        byInvoice.set(
            inv.id,
            summarizeInvoiceStatus(statusesByInvoice.get(inv.id) || [], excludedByInvoice.get(inv.id) || 0)
        );
    }
    return byInvoice;
}

/**
 * One invoice's detail, as ONE ROW PER INVOICE LINE — including the lines that
 * name no ordered item, which say so where they are rather than in a footnote
 * about lines the reader cannot see.
 *
 * EACH ROW CARRIES ITS OWN DELIVERIES, and that placement is a claim about scope.
 * A row is scoped to one ordered item, so the deliveries listed under it are the
 * ones that touched THAT ordered item — which is exactly the claim the data
 * supports. The first version put them in a section of their own at the foot of
 * the page and had to be headed "recorded against the same order lines" to avoid
 * over-claiming; inside the row that qualification is structural and the label is
 * just `Deliveries`.
 *
 * What is still NOT claimed: which delivery brought the quantity attributed to
 * this bill. The QUANTITY is attributed (allocateLineToInvoices); the ARRIVAL is
 * not, and those are different claims. Nothing links a delivery to an invoice, so
 * when an ordered item carries several of each every one is listed — the
 * containment premise makes one of them the right answer without saying which,
 * and naming one would assert a pairing no field records.
 *
 * `invoiceLines` are the invoice's own already-loaded Invoice Items, which the
 * detail page holds anyway, so this adds no query for them.
 */
export async function getInvoiceReconciliation(invoiceLines) {
    const lines = (invoiceLines || []).map((l) => ({
        id: l.id,
        invoiceItemId: l.invoiceItemId,
        // CARRIED, and its absence was a real defect: billsByPOItem groups bills by
        // their parent invoice, so a line without it was dropped and the invoice's
        // OWN bill went missing from its own line — leaving every share at 0.
        invoice: l.invoice || [],
        poItemRecordId: (l.poItem || [])[0] ?? null,
        itemName: l.itemName,
        size: l.size,
        unit: l.unit,
        qty: l.qty,
    }));

    /** An invoice line with nothing to compare against. Still gets a row. */
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
        billCount: 0,
        line: null,
        status: null,
        deliveries: [],
    });

    const judged = lines.filter(countsTowardStatus);
    if (judged.length === 0) {
        return {
            rows: lines.map(notComparedRow),
            excludedCount: lines.length,
            summary: summarizeInvoiceStatus([], lines.length),
        };
    }

    const poItems = await getPOItemsForReconciliation([...new Set(judged.map((l) => l.poItemRecordId))]);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    const [slices, billsByLine] = await Promise.all([
        getDeliveryItemsByRecordIds(poItems.flatMap((p) => p.deliveryItems || [])),
        billsByPOItem(poItems, judged),
    ]);
    const deliveredByLine = deliveredByPOItem(slices);

    // The deliveries themselves, for their dates. One batched read over the
    // distinct parents of every slice on those ordered items, then distributed to
    // the rows — one query whether the invoice has one line or ten.
    const deliveries = await getDeliveriesByRecordIds([
        ...new Set([...deliveredByLine.values()].flatMap((d) => [...d.deliveryIds])),
    ]);
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));

    // Which invoice this is. Every judged line belongs to it, so the first one's
    // parent identifies it without another read.
    const thisInvoiceRecordId = (invoiceLines || []).map((l) => l.invoice?.[0]).find(Boolean) ?? null;

    // IN THE INVOICE'S OWN LINE ORDER, judged and not-compared interleaved, so the
    // boxes read down the page in the same order as the items table above them.
    const rows = lines.map((l) => {
        const line = countsTowardStatus(l) ? poItemById.get(l.poItemRecordId) : null;
        // A link that resolves to nothing is not a judgeable line either — the same
        // outcome as no link at all, so it takes the same row.
        if (!line) return notComparedRow(l);

        const delivered = deliveredByLine.get(line.id) || { within: 0, beyond: 0, deliveryIds: new Set() };
        const lineFacts = lineStatus({
            orderedQty: line.qty,
            invoicedQty: line.invoicedQty,
            deliveredWithinQty: delivered.within,
            deliveredOverQty: delivered.beyond,
        });
        const bills = billsByLine.get(line.id) || [];
        const { shares, determinate } = allocateLineToInvoices({
            delivered: lineFacts.delivered,
            invoices: bills,
        });
        const mine = shares.find((sh) => sh.invoiceRecordId === thisInvoiceRecordId);

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
            // them for the invoice's own lines), so this is a record id rather
            // than another query.
            poRecordId: line.po?.[0] ?? null,
            // #167 — #18's item identity, the key the items table folds a split
            // line back together on. Never `Item Name` text.
            materialRecordId: line.material?.[0] ?? null,
            billedOnThisInvoice: l.qty || 0,
            // How many bills share this ordered item, so the detail can say why an
            // answer had to be inferred at all.
            billCount: bills.length,
            // The ordered item's own totals — what the box's figures line shows,
            // all three at the same scope so they add up against each other.
            line: lineFacts,
            status: {
                ...invoiceShareStatus({
                    billed: mine?.billed ?? l.qty,
                    arrived: mine?.arrived ?? 0,
                    determinate,
                }),
                arrivedBeyondOrder: lineFacts.arrivedBeyondOrder,
                billedBeyondOrder: lineFacts.billedBeyondOrder,
            },
            // Newest first, matching the deliveries list's default order.
            deliveries: [...(delivered.deliveryIds || [])]
                .map((id) => deliveryById.get(id))
                .filter(Boolean)
                .sort((a, b) => (b.receivedDate || "").localeCompare(a.receivedDate || "")),
        };
    });

    // COUNTED OFF THE ROWS, not off `judged`. A line whose `PO Item` link resolves
    // to nothing took the not-compared row above, so counting the filter's input
    // would let the summary claim a judged line the page does not show.
    const judgedStatuses = rows.filter((r) => r.status).map((r) => r.status);

    return {
        rows,
        excludedCount: rows.length - judgedStatuses.length,
        summary: summarizeInvoiceStatus(judgedStatuses, rows.length - judgedStatuses.length),
    };
}

/**
 * The invoicing status of many deliveries at once, for the deliveries list.
 *
 * NOT CALLED FOR A NON-PRIVILEGED VIEWER — the caller decides, and that is the
 * withholding: the two levels this walks are invoice data and the deliveries list
 * is Job-scoped. See the module header.
 *
 * `deliveries` are already-loaded delivery objects carrying their `deliveryItems`
 * link array, which the list already reads.
 *
 * Returns a Map of delivery record id -> summary. "Invoiced" means the ORDERED
 * LINE carries invoice lines, not that this arrival was billed; summarize's copy
 * claims only that.
 */
export async function getDeliveryInvoicing(deliveries) {
    const byDelivery = new Map();
    const list = deliveries || [];
    if (list.length === 0) return byDelivery;

    const slices = await getDeliveryItemsByRecordIds(list.flatMap((d) => d.deliveryItems || []));

    const poItems = await getPOItemsForReconciliation([
        ...new Set(slices.map((s) => s.poItem?.[0]).filter(Boolean)),
    ]);
    const poItemById = new Map(poItems.map((p) => [p.id, p]));

    // Fetched so the count is of real rows rather than of link ids, which is the
    // same distinction #165 had to make: a link array can outlive what it points
    // at, and "has an invoice" should mean a row exists.
    const invoiceItems = await getBills(poItems.flatMap((p) => p.invoiceItems || []));
    const linesWithInvoice = new Set(invoiceItems.map((i) => i.poItemRecordId).filter(Boolean));

    const linesByDelivery = new Map();
    for (const slice of slices) {
        const parent = slice.delivery?.[0];
        const lineId = slice.poItem?.[0];
        if (!parent || !lineId) continue;
        if (!linesByDelivery.has(parent)) linesByDelivery.set(parent, new Map());
        // One entry per DISTINCT ordered line: a delivery can hold two slices of
        // one line, and counting them twice would make "1 of 2 invoiced" out of a
        // single line.
        linesByDelivery.get(parent).set(lineId, {
            poItemRecordId: lineId,
            poItemId: poItemById.get(lineId)?.poItemId ?? null,
            hasInvoice: linesWithInvoice.has(lineId),
        });
    }

    for (const d of list) {
        byDelivery.set(
            d.id,
            summarizeDeliveryInvoicing([...(linesByDelivery.get(d.id)?.values() || [])])
        );
    }
    return byDelivery;
}
