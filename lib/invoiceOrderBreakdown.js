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
// AND SINCE #408 IT CARRIES WHAT THAT QUANTITY IS MEASURED AGAINST. A bare figure
// beside an order states a part with no whole: `5 EA` is the same line whether the
// order asked for 5 or for 500. The denominator is the ordered quantity of the
// `PO Items` rows this folded item charges ON THAT ORDER — one contribution per
// DISTINCT ordered item, since two invoice items charging one of them charge one row.
// A quantity is not a price: the paragraph above turns on one invoice being able to
// charge orders this page does not show, and an ordered quantity is the order's own
// figure rather than a share of anything, so it invites no addition against a total.
//
// THE TWO FIGURES ARE SUMMED OVER THE SAME ROWS, AND THAT IS AN INVARIANT RATHER THAN
// an arrangement: both are accumulated in one loop under one `PO Item` test below, so
// a row that leaves the numerator leaves the denominator in the same pass. Stating it
// as two walks would let one of them admit a row the other refused, which is a line
// that reads `7 of 15` where one of the two figures counted something the other did
// not.
//
// THE DENOMINATOR IS NOT WHAT IS LEFT TO INVOICE AND NOT WHAT EVERY INVOICE HAS
// CHARGED. `5 of 10` says this invoice charged 5 against an ordered quantity of 10; a
// sibling invoice may already have charged the other 5, and `PO Items."Invoiced Qty"`
// is the figure that would say so. That is the ORDER's cross-document total and it is
// `/pos/[poId]`'s, which is the scope split `docs/briefs/_shared.md` states — so this
// line holds one figure from each document and nothing that adds them.
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
 * `orderedQtyByOrderedItem` maps an ordered item's record id to its `Qty` (#408).
 * `lib/deliveryReconciliation.js` hands it over from `PO Items` rows the page has
 * already read. Omitting it leaves every `orderedQtyByOrder` entry absent, which is
 * what makes the denominator a term the copy appends rather than a figure it needs.
 *
 * Exported so a check can pin the set and the exclusion directly, the way `foldKey`
 * is, rather than inferring both from whether a list appeared.
 *
 * Returns one entry per folded item: `orderRecordIds` in first-appearance order,
 * `qtyByOrder`, the quantity this item was invoiced for against each, and
 * `orderedQtyByOrder`, what the ordered items behind that quantity were ordered for.
 *
 * `orderedQtyByOrder` SUMS ONE CONTRIBUTION PER DISTINCT ORDERED ITEM, and the case
 * is not hypothetical: `lib/prItemMerge.js:mergeKey` holds `Remark` and the quotation
 * where `lib/invoiceItemFold.js:foldKey` holds neither, so two request items differing
 * only in their remark survive as two `PR Items`, become two `PO Items` on one order
 * through `lib/poGeneration.js`'s one-for-one snapshot, take the same `Materials` row
 * from #18's cache and the same unit price — and one folded invoice item then covers
 * both. The fold is strictly the coarser unit, so reading one row's `Qty` would state
 * a denominator smaller than the rows the numerator was summed over.
 *
 * IT KEYED ON `PO Item` RATHER THAN ON `PO` TO EXCLUDE A FREE-TEXT CHARGE, and #278
 * removed that item. The read stays on `PO Item` and the reason changes: the
 * ordered item is what this module is about, and a row whose link was emptied by
 * hand contributes no order rather than taking the page down. It is no longer an
 * exclusion, so nothing is excluded from the comparison below.
 */
export function ordersNamedByFoldedItem({ folded, items, orderedQtyByOrderedItem } = {}) {
    const rowById = new Map((items || []).filter(Boolean).map((row) => [row.id, row]));

    return (folded || []).filter(Boolean).map((group) => {
        const orderRecordIds = [];
        const qtyByOrder = new Map();
        const orderedQtyByOrder = new Map();
        // Which ordered items have already contributed to this item's denominator,
        // per order. The numerator is per ROW and the denominator is per ORDERED
        // ITEM, which is the one place the two figures count different things.
        const countedOrderedItems = new Map();

        for (const rowId of group.rowIds || []) {
            const row = rowById.get(rowId);
            // No ordered item behind it, so there is no order to name — a crash
            // guard on a hand-emptied link since #278, not a judgment about a kind
            // of charge. IT GATES BOTH FIGURES (#408): such a row is out of the
            // quantity and out of what that quantity is measured against, so the
            // pair stays summed over one set of rows.
            if (!row || !row.poItem?.[0]) continue;
            const orderRecordId = row.po?.[0];
            if (!orderRecordId) continue;

            if (!qtyByOrder.has(orderRecordId)) {
                orderRecordIds.push(orderRecordId);
                qtyByOrder.set(orderRecordId, 0);
                countedOrderedItems.set(orderRecordId, new Set());
            }
            qtyByOrder.set(orderRecordId, qtyByOrder.get(orderRecordId) + (row.qty || 0));

            const orderedItemRecordId = row.poItem[0];
            const counted = countedOrderedItems.get(orderRecordId);
            if (counted.has(orderedItemRecordId)) continue;
            counted.add(orderedItemRecordId);

            const orderedQty = orderedQtyByOrderedItem?.get(orderedItemRecordId);
            // A number or nothing. An ordered item whose `Qty` the caller could not
            // supply leaves the entry ABSENT rather than adding 0, so a line whose
            // whole denominator is unknown says nothing instead of claiming a whole
            // of zero — and one where a single member is unknown states the members
            // it could read, which is the same partial honesty the numerator already
            // keeps for a row with no ordered item.
            if (typeof orderedQty !== "number") continue;
            orderedQtyByOrder.set(
                orderRecordId,
                (orderedQtyByOrder.get(orderRecordId) ?? 0) + orderedQty
            );
        }

        return {
            key: group.key,
            itemName: group.itemName || "",
            size: group.size || "",
            unit: group.unit || "",
            orderRecordIds,
            qtyByOrder,
            orderedQtyByOrder,
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
export function chargesByOrder({ folded, items, orderedQtyByOrderedItem } = {}) {
    const named = ordersNamedByFoldedItem({ folded, items, orderedQtyByOrderedItem });
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
                // `null` and not 0 where nothing resolved — see the builder above.
                orderedQty: entry.orderedQtyByOrder.get(orderRecordId) ?? null,
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
     * One item's charge against one order: what it is, how much of it this invoice
     * invoiced against THAT order, and what that order asked for. No price and no
     * amount — see the header.
     *
     * THE UNIT IS WRITTEN ONCE, AFTER BOTH FIGURES, AND THAT IS A CLAIM RATHER THAN
     * A SHORTER STRING. `Invoice Items."Unit"` is a frozen copy of the linked
     * `PO Items."Unit"`, so the two figures are in one measure by construction — a
     * disagreement means the wrong ordered item was picked, which is a different
     * fact with its own home. `5 EA of 10 EA` would assert two measurements that
     * happen to share a unit; `5 of 10 EA` states one measure with a part and a
     * whole on it, which is also `lib/listFilters.js:FILTER_BAR_COPY.count`'s shape
     * for the same relation.
     *
     * `of` RATHER THAN A LABELED TERM, and it is what carries the scope. The
     * numerator is this invoice's and the denominator is the order's, and the two
     * sit on one line; the grammar of `N of M` puts the part inside the whole, so
     * which figure belongs to which document is read rather than counted — the test
     * `docs/briefs/_shared.md` sets wherever two scopes meet on one screen.
     *
     * THE TERM IS APPENDED, NOT REQUIRED. A charge whose ordered items resolved no
     * `Qty` reads exactly as this line read before #408 — the bare quantity, which
     * is still true — rather than a whole of zero or an em dash standing in for a
     * figure nobody asked about.
     */
    charged: (f) => ({
        key: "order-charged",
        text:
            `${itemLabel(f)} — ${f?.qty ?? 0}` +
            `${typeof f?.orderedQty === "number" ? ` of ${f.orderedQty}` : ""}` +
            `${f?.unit ? ` ${f.unit}` : ""}`,
    }),
};

/**
 * `Item Name Size`, the pair every items table on this base prints side by side.
 * Size is optional, so a blank one leaves no trailing space.
 */
function itemLabel(f) {
    return [f?.itemName, f?.size].filter(Boolean).join(" ") || "That item";
}
