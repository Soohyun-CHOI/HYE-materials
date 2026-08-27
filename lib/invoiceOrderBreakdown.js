// Which order an invoice item was invoiced against, where that differs (#237).
//
// AN INVOICE'S PAGE NAMES THE ORDERS IT INVOICES AND USED TO STOP THERE, so an invoice
// charging one order's material and another's read as though every item could be on
// either. The question had a home twice and lost it twice: #167 dropped the `PO`
// column from the items table — a row an overage split produced spans two orders once
// folded, so that cell has no single value — and pointed at the delivery section,
// which #232 then scoped to the one delivery the invoice matches, where an order does
// not belong. This is the third and, being under `Purchase Orders`, the first one
// whose subject is actually an order.
//
// THE UNIT OF JUDGMENT IS THE FOLDED ITEM, NOT THE RAW ROW, because a folded row is
// what a reader sees in the items table directly below. `lib/invoiceItemFold.js` owns
// that grouping and this module does not redo it: it reads `rowIds`, the fold's own
// statement of which raw rows are one item, and joins them back to the invoice items
// the page already holds. What the fold cannot answer is which orders a group spans —
// its key is `Material` + unit price and deliberately excludes the order, which is
// the same reason the `PO` column is unrepresentable — so the order comes from the
// raw rows and the fold needs no change.
//
// THE LIST APPEARS ONLY WHERE THE FOLDED ITEMS DISAGREE, and the point of stating the
// rule that way is that it needs no case for an overage order:
//
//   one order                     {A}, {A}       — agree, silent
//   overage order, all split     {A,B}, {A,B}   — agree, silent
//   one item on A, one on B       {A}, {B}       — differ, listed
//   one item split, one not       {A,B}, {A}     — differ, listed
//
// An invoice carrying two orders because a correction split every item across both is
// the ordinary reason to carry two, and listing them per item there would repeat one
// answer once per item — the repetition #233 took off the order's page and #232 took
// off this one.
//
// AN ITEM WITH NO ORDERED ITEM BEHIND IT NAMES NO ORDER, and is out of the list AND
// out of the judgment. Out of the judgment is the load-bearing half: one free-text row
// would otherwise make the sets differ and turn the list on for every invoice that has
// one. THE EXCLUSION KEYS ON `PO Item`, NEVER ON `PO` — a free-text invoice item does
// carry a `PO` (`createInvoiceAction` refuses an item without one; only `PO Item` is
// optional), so keying on the order link would exclude nothing at all. That also means
// an order can be reached ONLY through such a row, in which case it keeps its own line
// in the section and has no items under it, which is itself the answer.
//
// NO PRICE AND NO AMOUNT ON A LINE HERE, WHICH IS NOT AN OVERSIGHT. Unit price is part
// of the fold key, so both products of a split carry the same one by construction — a
// price per order would print one number twice in exactly the shape this list exists
// for — and it is already in the items table, once per folded row. A per-order amount
// would be a partial sum of this invoice's own total sitting beside a purchase order,
// which invites the addition #167's `invoiceCaveat` and #232 both refuse: one invoice
// can charge orders this page does not show. So a line carries the quantity, the one
// fact the table above cannot hold, and the syntax matches
// `PO_DOCUMENTS_COPY.deliveries.brought` rather than `invoices.charge` — the price
// travels with whether the frame can see it elsewhere.
//
// THE ITEM NAME COMES FROM THE INVOICE ITEM'S OWN FROZEN COPIES, WHICH IS THE OPPOSITE
// SOURCE FROM `lib/poDocuments.js` AND IS DELIBERATE. That module names an ordered item
// on the ORDER's page and reads it from the `PO Items` row; the frame here is one
// invoice and the items table is directly above, so a name that disagreed with the row
// above it would be the defect. The frame decides the source — do not unify the two.
//
// PURE AND IMPORT-FREE, so scripts/tests/offline/invoice-order-breakdown.mjs can pin
// it and no client bundle can reach a credentialed module through it.

/**
 * The orders each folded item names, in the invoice's own item order.
 *
 * `folded` is `foldInvoiceItems`'s output and `items` the invoice's raw Invoice
 * Items; a row is joined by record id, so a `rowIds` entry with no row contributes
 * nothing rather than a blank order.
 *
 * Exported so a check can pin the set and the exclusion directly, the way `foldKey`
 * is, rather than inferring both from whether a list appeared.
 *
 * Returns one entry per folded item: `orderRecordIds` in first-appearance order and
 * `qtyByOrder`, the quantity this item was invoiced for against each.
 *
 * IT KEYED ON `PO Item` RATHER THAN ON `PO` TO EXCLUDE A FREE-TEXT CHARGE, and #278
 * removed that item. The read stays on `PO Item` and the reason changes: the
 * ordered item is what this module is about, and a row whose link was emptied by
 * hand contributes no order rather than taking the page down. It is no longer an
 * exclusion, so nothing is excluded from the comparison below.
 */
export function ordersNamedByFoldedItem({ folded, items } = {}) {
    const rowById = new Map((items || []).filter(Boolean).map((row) => [row.id, row]));

    return (folded || []).filter(Boolean).map((group) => {
        const orderRecordIds = [];
        const qtyByOrder = new Map();

        for (const rowId of group.rowIds || []) {
            const row = rowById.get(rowId);
            // No ordered item behind it, so there is no order to name — a crash
            // guard on a hand-emptied link since #278, not a judgment about a kind
            // of charge.
            if (!row || !row.poItem?.[0]) continue;
            const orderRecordId = row.po?.[0];
            if (!orderRecordId) continue;

            if (!qtyByOrder.has(orderRecordId)) {
                orderRecordIds.push(orderRecordId);
                qtyByOrder.set(orderRecordId, 0);
            }
            qtyByOrder.set(orderRecordId, qtyByOrder.get(orderRecordId) + (row.qty || 0));
        }

        return {
            key: group.key,
            itemName: group.itemName || "",
            size: group.size || "",
            unit: group.unit || "",
            orderRecordIds,
            qtyByOrder,
        };
    });
}

/**
 * The items to carry under each order, and whether to carry them at all.
 *
 * `shown` is false when every folded item that names an order names the SAME set of
 * them — one order, or an overage order every item is split across. It is also
 * false for an invoice whose items all name none, which is the same statement: there
 * is nothing that could differ.
 *
 * `byOrder` is keyed by PO record id and is populated whether or not `shown` is true,
 * so the decision and the data stay separable — a caller that renders it anyway is
 * making its own choice rather than working around a missing field. The page reads
 * `shown` first.
 */
export function chargesByOrder({ folded, items } = {}) {
    const named = ordersNamedByFoldedItem({ folded, items });
    const byOrder = new Map();
    const signatures = new Set();

    for (const entry of named) {
        if (entry.orderRecordIds.length === 0) continue;
        // A space separates, never a NUL: #231 lost a whole module from every
        // repository-wide grep to one of those, and a record id cannot contain one.
        signatures.add([...entry.orderRecordIds].sort().join(" "));

        for (const orderRecordId of entry.orderRecordIds) {
            if (!byOrder.has(orderRecordId)) byOrder.set(orderRecordId, []);
            byOrder.get(orderRecordId).push({
                key: entry.key,
                itemName: entry.itemName,
                size: entry.size,
                unit: entry.unit,
                qty: entry.qtyByOrder.get(orderRecordId) ?? 0,
            });
        }
    }

    return { shown: signatures.size > 1, byOrder };
}

// ---------------------------------------------------------------------------
// Copy
//
// #166's vocabulary, the same as `PO_DOCUMENTS_COPY`'s: `ordered item`, never `line`.
// In a `*_COPY` constant rather than in the page's JSX so `offline/line-vocabulary.mjs`
// can read it — that check walks copy constants and cannot see text written straight
// into a component.

export const ORDER_BREAKDOWN_COPY = {
    /**
     * One item's charge against one order: what it is and how much of it this
     * invoice invoiced against THAT order. No price and no amount — see the header.
     */
    charged: (f) => ({
        key: "order-charged",
        text: `${itemLabel(f)} — ${f?.qty ?? 0}${f?.unit ? ` ${f.unit}` : ""}`,
    }),
};

/**
 * `Item Name Size`, the pair every items table on this base prints side by side.
 * Size is optional, so a blank one leaves no trailing space.
 */
function itemLabel(f) {
    return [f?.itemName, f?.size].filter(Boolean).join(" ") || "That item";
}
