// One material, one row, in an invoice's delivery section (#241, re-cut by #640).
//
// THE SECTION FOLDS AS THE ITEMS TABLE ABOVE IT DOES. An overage split divides one
// invoice item into two `Invoice Items` rows against two ordered items, and the table
// above shows them as one; so does this. WHAT COUNTS AS ONE ITEM ON THIS PAGE IS
// `lib/invoiceItemFold.js` AND IS NOT DECIDED AGAIN HERE: that module owns the key
// (`Material` + unit price) and states its grouping as `rowIds`, and this one joins those
// record ids back to the reconciliation rows — the same join #237 makes, on the same
// field, so a rule stated over raw rows cannot disagree with the table a reader is
// looking at.
//
// THE FOLD IS FOR THE READER, NEVER FOR THE JUDGMENT. A row's `filled` was decided per
// invoice item by the oldest-first fill on its own ordered item, and the chip reads
// those same per-row figures — on this page and on `/invoices`, where no fold is
// computed at all. So a folded row ADDS what its members were given and never re-fills
// from summed inputs: one ordered item's surplus must not cover another's shortfall.
//
// THE ORDERED ITEM'S THREE TOTALS ADD OVER DISTINCT ORDERED ITEMS. `ordered`,
// `delivered` and `invoiced` belong to a `PO Items` row rather than to this invoice, so
// two invoice items against ONE ordered item carry the same figures and adding both
// would print one total twice. The invoice form cannot make that shape — #91 excludes
// an ordered item a sibling invoice item already claimed — so this is defensive against
// hand-entered data, which this base carries by design. Across an overage split the two
// members name two ordered items, and their totals add: what was ordered, delivered and
// invoiced of that material across the order and its overage order.
//
// EVERY ITEM HAS A ROW SINCE #640, AND THAT REVERSES #241's SILENCE. #241 returned only
// entries with something to say, because under the one-delivery premise (retired by #640) "everything was
// delivered" was a fact about the invoice that the chip stated, and a row repeating it
// said nothing. Under the three-way match each item carries its own figures — what was
// ordered, delivered and invoiced to date, and how much of this invoice arrived — and
// those are the reconciliation itself, so every row has them to say.
//
// THE NAME COMES FROM THE INVOICE ITEM, NOT THE ORDERED ITEM. `getInvoiceReconciliation`
// labels a row from the `PO Items` row it compares against; a folded row can span two of
// those, so there is no single one to name — the same fact that makes the items table's
// `PO` column impossible (#167). It takes the fold group's frozen copy instead.
//
// Pure: it applies `lib/deliveryStatus.js`'s copy but authors none, and reaches no
// credentialed module. `scripts/tests/offline/invoice-delivery-entries.mjs` pins it.

import { describeInvoiceItemFill } from "./deliveryStatus.js";

/**
 * The figures for one folded row: its members' own quantities added, and their ordered
 * items' totals added once per DISTINCT ordered item — see the header. Null for an empty
 * member list, which `invoiceDeliveryEntries` never hands it.
 */
export function foldedEntryFigures(members) {
    const list = (members || []).filter(Boolean);
    if (list.length === 0) return null;
    const figures = { qty: 0, filled: 0, ordered: 0, delivered: 0, invoiced: 0, orderedItems: 0 };
    const counted = new Set();
    for (const member of list) {
        figures.qty += member.qty || 0;
        figures.filled += member.filled || 0;
        const orderedItem = member.poItemRecordId ?? member.poItemId;
        if (counted.has(orderedItem)) continue;
        counted.add(orderedItem);
        figures.ordered += member.ordered || 0;
        figures.delivered += member.delivered || 0;
        figures.invoiced += member.invoiced || 0;
    }
    figures.orderedItems = counted.size;
    return figures;
}

/**
 * The rows the delivery section renders, in the invoice's own item order.
 *
 * `folded` is `foldInvoiceItems`'s output and `rows` `getInvoiceReconciliation`'s; they
 * are joined on the invoice item's record id, so a `rowIds` entry with no row
 * contributes nothing rather than a blank member, and a group with no member at all —
 * an item whose ordered item did not resolve — has no row.
 */
export function invoiceDeliveryEntries({ folded, rows } = {}) {
    const rowById = new Map((rows || []).filter(Boolean).map((row) => [row.id, row]));

    return (folded || [])
        .filter(Boolean)
        .map((group) => {
            const members = (group.rowIds || []).map((rowId) => rowById.get(rowId)).filter(Boolean);
            if (members.length === 0) return null;
            const figures = foldedEntryFigures(members);
            const unit = group.unit || members[0].unit || "";
            const copy = describeInvoiceItemFill({ ...figures, unit });
            return {
                key: group.key,
                itemName: group.itemName || "",
                size: group.size || "",
                maker: group.maker || "",
                unit,
                figures,
                copy,
                tone: copy.thisInvoice.tone,
            };
        })
        .filter(Boolean);
}
