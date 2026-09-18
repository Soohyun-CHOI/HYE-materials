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
// rule that way is that it needs no case for an overage order. What each item is
// asked for is its SPLIT — the orders it names and how its quantity divided among
// them, reduced so that proportional splits are one answer (#409):
//
//   one order                      A:1, A:1             — agree, silent
//   all split the same way         A:2 B:1, A:2 B:1     — agree, silent
//   one item on A, one on B        A:1, B:1             — differ, listed
//   one item split, one not        A:10 B:3, A:1        — differ, listed
//   same orders, split differently A:10 B:3, A:2 B:11   — differ, listed
//
// THE LAST ROW IS #409 AND THE FOURTH FIGURE IS WHY IT COULD NOT COME FIRST. Until
// #408 a line carried a bare quantity, and two lines under one order carrying
// different bare quantities really were one answer restated — the quantity was
// already in the items table. With a denominator on the line the two say different
// things, so the ground for silencing them went with it. That is also the whole of
// the distinction from #232 and #233: what those issues removed is A SINGLE ANSWER
// RESTATED ONCE PER ITEM, and items that divided themselves differently across the
// same orders are not a single answer. An invoice carrying two orders because a
// correction split ONE item across both still lists one folded item, which is one
// signature, so the browsable silent case #237 seeded is untouched.
//
// THE REDUCTION IS BY THE GREATEST COMMON DIVISOR, AND IT IS WHAT MAKES THE TABLE
// ABOVE NEED NO CLAUSE. A one-order item's vector has one component, so it reduces to
// `1` whatever the quantity — which is what keeps a one-order invoice silent without
// a branch saying so, and a branch is what the raw quantity would have forced: `A:10`
// beside `A:20` differs, and that invoice's list would repeat the items table exactly,
// since with one order a charge IS the folded row's own quantity.
//
// NO FLOAT EVER REACHES IT, WHICH IS A PROPERTY OF THE BASE RATHER THAN OF THIS CODE.
// `lib/variance.js:isWholeQty` is `Number.isInteger` and `assertWholeQty` guards every
// writer of a quantity into an item table — `createItem`/`updateItem`,
// `createPOItem`, `createInvoiceItem`/`updateInvoiceItem` — so a quantity is an
// integer, a sum of them is an integer, and the reduction is integer arithmetic end to
// end. A value a hand edit made fractional is compared UNREDUCED rather than rounded:
// that can only split a signature, never merge two, and splitting turns the list on,
// which states a fact instead of hiding one.
//
// WHAT THE REDUCTION MERGES IS EXACTLY THE PROPORTIONAL CLASS — measured over every
// pair of integer vectors up to (12,12): reduced-equal and proportional agree on all
// 28,561 pairs, and raw-equal never becomes reduced-different, so the reduction only
// ever merges. **AND THE ORDER IDS STAY IN THE SIGNATURE, so nothing this issue does
// can silence what was listed before it**: two items whose order SETS differ have
// different id sequences and therefore different signatures, whatever their
// quantities.
//
// WHERE THE PREMISE BREAKS, NAMED RATHER THAN LEFT TO BE FOUND. `same ratio, one
// answer` is not the same claim as `same line`, and the gap is the denominator #408
// added. Two items each split 2:1 across A and B, one ordered 10 and 100, the other
// 1000 and 10, read `10 of 10` and `5 of 100` against `20 of 1000` and `10 of 10` —
// one exhausted A, the other exhausted B, and this rule is silent. That is ordinary
// data rather than a corner: two materials on two orders have their own ordered
// quantities. The denominator was considered for the signature and refused; see
// `splitSignature` for the case that decided it. **The condition for revisiting is a
// reader shown to need `which order is used up` HERE** — and that is a figure to add
// rather than a trigger to widen, because the honest one is `PO Items."Invoiced Qty"`
// across every invoice, which is `/pos/[poId]`'s.
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
 * One folded item's SPLIT: the orders it names and how its quantity divided among
 * them, reduced so that two items dividing themselves the same way sign the same.
 *
 * Exported so a check can pin the key directly, the way `foldKey` and
 * `ordersNamedByFoldedItem` are, rather than inferring it from whether a list
 * appeared. `null` for an item that names no order, which is what takes it out of
 * the comparison.
 *
 * THE DENOMINATOR IS NOT IN HERE, AND ONE CASE DECIDED IT. Two lines can carry the
 * same quantity against different ordered quantities — `5 of 5` beside `5 of 50` —
 * and those are not one answer restated, which is a real argument for signing them
 * apart. It is refused because it would sign them apart ON ONE ORDER TOO: an invoice
 * charging a single order, two items of 5 against ordered quantities of 5 and 50,
 * would draw a list that repeats the items table line for line. #409's own statement
 * is that an invoice charging one order stays silent, so the figure that breaks it
 * cannot be in the key. It is also the wrong KIND of fact for this judgment — an
 * ordered quantity is the order's own figure and is identical for every invoice that
 * charges it, so it says nothing about how THIS invoice divided anything. **If it is
 * proposed again, that is the test: run it against a one-order invoice.**
 *
 * THE DIVISOR IS THE GREATEST COMMON DIVISOR, or 1 where the quantities are not all
 * integers. They are integers on every path the app writes (see the header), so the
 * second case is a hand edit, and leaving it unreduced compares it exactly — which can
 * only tell two items apart, never merge them.
 */
export function splitSignature(entry) {
    const ids = [...(entry?.orderRecordIds || [])].sort();
    if (ids.length === 0) return null;

    const quantities = ids.map((id) => entry.qtyByOrder?.get(id) ?? 0);
    const divisor = reductionDivisor(quantities);
    // A space separates, never a NUL: #231 lost a whole module from every
    // repository-wide grep to one of those, and a record id cannot contain one.
    return ids.map((id, i) => `${id}:${quantities[i] / divisor}`).join(" ");
}

/** The GCD of the quantities, and 1 where one of them is not a whole number or all are 0. */
function reductionDivisor(quantities) {
    if (!quantities.every((n) => Number.isInteger(n))) return 1;
    let divisor = 0;
    for (const n of quantities) divisor = greatestCommonDivisor(divisor, Math.abs(n));
    return divisor === 0 ? 1 : divisor;
}

function greatestCommonDivisor(a, b) {
    let [x, y] = [a, b];
    while (y !== 0) [x, y] = [y, x % y];
    return x;
}

/**
 * The items to carry under each order, and whether to carry them at all.
 *
 * `shown` is false when every folded item that names an order has the same SPLIT —
 * one order, an overage order every item is split across, or several items divided
 * across the same orders in the same proportions. It is also false for an invoice
 * whose items all name none, which is the same statement: there is nothing that could
 * differ.
 *
 * IT COMPARED THE ORDER SETS ALONE UNTIL #409, so an invoice whose items all named
 * the same two orders was silent however unevenly they were divided between them.
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
        const signature = splitSignature(entry);
        // `null` is an item naming no order, which is out of the comparison and out
        // of every order's list — the same skip this loop opened with before #409.
        if (signature === null) continue;
        signatures.add(signature);

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
