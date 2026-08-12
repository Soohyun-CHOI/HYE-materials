// The per-line quantity judgments for one PO line.
//
// `uninvoicedQty` / `hasUninvoicedQty` are the uninvoiced-remainder rule (#48,
// extracted in #18). `countsAsOrdered` joined them in #169, from
// lib/materialPriceView.js — see its own note below for why that was the wrong
// home. What the three share is that each judges ONE ordered line from its own
// quantities, which is what this module is named for.
//
// The remainder was inline arithmetic in three places — getInvoicingStatusByPO's
// map, isPoOpen's loop, and the two invoice actions' over-invoicing warning —
// each pairing its own invoiced-qty fetch with its own subtraction. #18 moved the
// invoiced total onto the PO Items."Invoiced Qty" rollup, which left the
// subtraction as the only remaining rule, so it is named here rather than
// retyped per caller.
//
// NAMED FOR WHAT IT SUBTRACTS (#181). These two were `remainingQty` /
// `hasRemainingQty` and the PO detail column they feed was headed `Remaining`,
// while `Materials."Outstanding Qty"` was a THIRD word for the invoice
// subtraction one level up and the delivery entry screen used one of the same
// two words for a different subtraction entirely (Qty minus Delivered Qty).
// "Remaining" says a quantity is left over without saying left over from what,
// which is exactly the question a reader has when two subtractions are in play.
// So: uninvoiced here and on Materials, undelivered on the delivery side
// (lib/deliveryAllocation.js:undeliveredQty), and neither word does duty twice.
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
export function uninvoicedQty({ qty, invoicedQty }) {
    return (qty || 0) - (invoicedQty || 0);
}

/**
 * Whether this line still has something left to invoice. The ">" is the whole
 * of #57's definition of an "open" PO line — Purchase Orders.Status has no
 * "Closed" option, openness is only ever this computation — and an
 * over-invoiced line is NOT open, which falls out of the strict comparison
 * rather than needing a case of its own.
 */
export function hasUninvoicedQty({ qty, invoicedQty }) {
    return uninvoicedQty({ qty, invoicedQty }) > 0;
}

/**
 * Does this line count as ordered?
 *
 * MOVED HERE FROM `lib/materialPriceView.js` BY #169. NEITHER MODULE RECORDED
 * that it should move; CLAUDE.md did, in its verification-tiers note — "move it
 * when a third consumer appears" — and #169 is that third consumer, beside
 * `lib/deliveryAllocation.js`, which has imported it across the boundary since
 * #162, and `app/materials/[materialId]`. What made the old home wrong is that
 * two of the three consumers are not price screens at all, and leaving it would
 * have made a delivery-STATUS module import a material-price-VIEW one.
 *
 * This reads #18's judgment rather than re-deriving it. `PO Items.Committed Qty`
 * is `IF({PO Status} & "" = "Withdrawn", 0, {Qty})`, so the withdrawn-PO rule
 * already lives in that one Airtable field and is what the Materials rollups
 * traverse. Testing the status string here would be a second implementation of
 * it, and the two would drift the moment a status option is added.
 *
 * Note this is NOT the same as "the PO was withdrawn": a Qty-0 line on a live PO
 * also fails to count. That is why #19's screen renders the status chip from
 * `PO Status` and uses this only for the "not counted as ordered" note — the
 * label and the judgment come from different fields on purpose, each from the
 * field that actually holds it.
 */
export function countsAsOrdered({ committedQty }) {
    return (committedQty || 0) > 0;
}
