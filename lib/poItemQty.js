// The un-invoiced-remainder rule for one PO line (#48, extracted in #18).
//
// It was inline arithmetic in three places — getInvoicingStatusByPO's map,
// isPoOpen's loop, and the two invoice actions' over-invoicing warning — each
// pairing its own invoiced-qty fetch with its own subtraction. #18 moved the
// invoiced total onto the PO Items."Invoiced Qty" rollup, which left the
// subtraction as the only remaining rule, so it is named here rather than
// retyped per caller.
//
// Pure and dependency-free so scripts/tests/offline/po-item-qty.mjs can pin it.

/**
 * How much of an ordered line is not yet invoiced.
 *
 * MAY BE NEGATIVE, and callers must keep it that way (#48): more invoiced than
 * ordered is a real and interesting state — a vendor over-billing, or an
 * invoice line pointed at the wrong PO Item — and clamping it at 0 would make
 * that indistinguishable from a line that is exactly fulfilled. The PO detail
 * page and the invoice form both surface it distinctly.
 *
 * Blank/absent inputs count as 0, because that is what they mean here: a PO
 * Item with no invoices has an empty rollup, and Airtable returns undefined
 * rather than 0 for it.
 */
export function remainingQty({ qty, invoicedQty }) {
    return (qty || 0) - (invoicedQty || 0);
}

/**
 * Whether this line still has something left to invoice. The ">" is the whole
 * of #57's definition of an "open" PO line — Purchase Orders.Status has no
 * "Closed" option, openness is only ever this computation — and an
 * over-invoiced line is NOT open, which falls out of the strict comparison
 * rather than needing a case of its own.
 */
export function hasRemainingQty({ qty, invoicedQty }) {
    return remainingQty({ qty, invoicedQty }) > 0;
}
