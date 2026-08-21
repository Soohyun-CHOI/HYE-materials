// What leaves an order open, stated once — per ordered item, and per order.
//
// `uninvoicedQty` / `hasUninvoicedQty` are the uninvoiced-remainder rule (#48,
// extracted in #18). `countsAsOrdered` joined them in #169, from
// lib/materialPriceView.js — see its own note below for why that was the wrong
// home. Those three each judge ONE ordered item from its own quantities, which
// is what this module was originally named for.
//
// #244 ADDED THE ORDER LEVEL, and it is here rather than beside the query so
// that the two levels of one question stay in one file: an ordered item is open
// when `hasUninvoicedQty`, and an order is open when it has such an item.
// `hasUninvoicedItems` is the second, and it reads the base's count rather than
// re-deriving it, exactly as `countsAsOrdered` reads `Committed Qty`.
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
 * How much of an ordered item is not yet invoiced.
 *
 * MAY BE NEGATIVE, and callers must keep it that way (#48): more invoiced than
 * ordered is a real and interesting state — a vendor over-invoicing, or an
 * invoice item pointed at the wrong PO Item — and clamping it at 0 would make
 * that indistinguishable from an ordered item that is exactly fulfilled. The PO detail
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
 * Whether this ordered item still has something left to invoice. The ">" is the whole
 * of #57's definition of an "open" ordered item — Purchase Orders.Status has no
 * "Closed" option, openness is only ever this computation — and an
 * over-invoiced ordered item is NOT open, which falls out of the strict comparison
 * rather than needing a case of its own.
 */
export function hasUninvoicedQty({ qty, invoicedQty }) {
    return uninvoicedQty({ qty, invoicedQty }) > 0;
}

/**
 * Does this ordered item count as ordered?
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
 * Note this is NOT the same as "the PO was withdrawn": a Qty-0 ordered item on a
 * live PO also fails to count. That is why #19's screen renders the status chip
 * from `PO Status` and uses this only for the "not counted as ordered" note —
 * the label and the judgment come from different fields on purpose, each from
 * the field that actually holds it.
 */
export function countsAsOrdered({ committedQty }) {
    return (committedQty || 0) > 0;
}

/**
 * Does this ORDER still have something left to invoice? (#244)
 *
 * The order-level half of `hasUninvoicedQty` above: true when at least one of
 * the order's ordered items passes it. Reads `Purchase Orders."Uninvoiced
 * Items"`, a rollup summing `PO Items."Has Uninvoiced Qty"`, and does not
 * re-derive the per-item rule — the same relationship `countsAsOrdered` has to
 * `Committed Qty`, and for the same reason: two implementations of one judgment
 * diverge, and the base has to carry this one anyway.
 *
 * WHY THE BASE CARRIES IT. `getOpenPOs` asks this of every order at once, and
 * `filterByFormula` cannot call a JS function, so the only way to ask the
 * question in one query is for the answer to be a field. The walk this replaced
 * defended itself on the ground that an order with an unfulfilled item early in
 * its list is cheap to confirm — true of ONE order, and false of a list of them,
 * because the list paid a re-read plus an item walk per order and therefore grew
 * with every order the company had ever placed. See getOpenPOs.
 *
 * A COUNT OF ITEMS, NOT A QUANTITY, and the aggregate has to be: an order with
 * one item over-invoiced by 5 and another under-invoiced by 5 has zero
 * uninvoiced quantity in total and is still open.
 *
 * Blank counts as 0 — an order with no ordered items has an empty rollup, which
 * is the same "not open" the item walk reached by never entering its loop.
 */
export function hasUninvoicedItems({ uninvoicedItems }) {
    return (uninvoicedItems || 0) > 0;
}
