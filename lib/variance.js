// Invoice variance tolerance rules (issue #17's decision, implemented in
// #15). Not a single uniform rule — see CLAUDE.md's Phase 3 status entry
// for the reasoning behind each shape.

// Header: Invoice.Amount Due vs Calculated Total. Hybrid — passes if within
// an absolute-dollar floor OR a percentage of Calculated Total, whichever
// is more permissive.
const HEADER_TOLERANCE_ABS = 5;
const HEADER_TOLERANCE_PCT = 0.01;

// Invoice item, Unit Price: Invoice Item vs its linked PO Item. Near-exact — only
// enough absolute tolerance to absorb floating-point/rounding noise.
const UNIT_PRICE_TOLERANCE_ABS = 0.01;

export function checkHeaderVariance(amountDue, calculatedTotal) {
    const tolerance = Math.max(HEADER_TOLERANCE_ABS, calculatedTotal * HEADER_TOLERANCE_PCT);
    return Math.abs(amountDue - calculatedTotal) > tolerance;
}

export function checkUnitPriceVariance(invoiceUnitPrice, poItemUnitPrice) {
    return Math.abs(invoiceUnitPrice - poItemUnitPrice) > UNIT_PRICE_TOLERANCE_ABS;
}

// ---------------------------------------------------------------------------
// Copy (#179)
//
// TWO FLAGS BOTH READ `Variance` AND THEY ARE NOT THE SAME KIND OF FACT. One
// compares the total the vendor wrote against the sum of the items somebody typed
// in from the same page — a disagreement inside one document, which in practice
// means the typing missed something. The other compares a charge against what the
// order agreed. The LIST said `Variance` for the first and the detail's items table
// said it for the second, so one word meant one thing on the row a reader clicked
// and another on the page they landed on.
//
// THE WORDS LIVE WITH THE PREDICATES because they are the same decision named
// twice, which is the shape `lib/deliveryStatus.js` and `lib/deliveryAllocation.js`
// already have. It also gets them out of JSX, where `offline/line-vocabulary.mjs`
// and this issue's own check cannot see them. `PO_DOCUMENTS_COPY` carried two of
// them until #179 and no longer does: they are invoice facts rendered on the
// order's page, and a word with two homes is what this issue exists to remove.
//
// `Mismatch` IS NOT AVAILABLE TO EITHER OF THEM. #232 made it a chip value on the
// delivery axis of these same two screens, so using it here would put one word on
// two axes of one page — the defect being fixed, in a different direction.
//
// THE TWO GRAMMARS ARE THE DISTINCTION, not decoration. `Order variance` is a
// STATE: the vendor billed something other than what was settled, which is an
// external fact that stays true until somebody takes it up with them. The header
// one is an INSTRUCTION, because it is an internal arithmetic check on one
// document and what it asks for is a second look — the shape no other mark on
// these screens uses, which is what stops a reader taking it for a third state.
//
// NEITHER NAMES A DIRECTION, and that is measured rather than stylistic: both
// predicates above compare an ABSOLUTE difference, so each fires when the figure
// is under as readily as over. `Over-billed` was the first draft of the item one
// and would have been false half the time it appeared.
//
// THE ITEM FLAG HAS TWO CAUSES AND THE STORED FLAG DOES NOT SAY WHICH.
// `createInvoiceAction` sets it on `unitPriceVariance || invoicedQty > poItem.qty`
// — a price that differs from the order's, or a quantity billed beyond what the
// order asked. `Order variance` covers both, and it is also why no sentence
// accompanies the badge: any explanation naming one cause would be false whenever
// the other fired. What the badge compares against is on the order's own page,
// which #233 gave an `Invoiced` column beside the ordered quantity and price.

export const VARIANCE_COPY = {
    /**
     * A charge against its order. Both call sites render the same string: the
     * invoice detail's items table and the order page's charge list.
     */
    item: "⚠ Order variance",
    /**
     * One document's own arithmetic. Read as an instruction, and short enough to
     * sit beside `Paid 2026-07-27` in a list cell that has 176px.
     */
    header: "⚠ Check the total",
    /**
     * The header kind with its two figures, under the invoice's own totals. The
     * badge label leads it, so the mark in a list and the sentence on the page it
     * leads to cannot come to say different things.
     */
    headerDetail: (amountDue, calculatedTotal) =>
        `${VARIANCE_COPY.header} — the vendor's Amount Due (${amountDue}) doesn't match ` +
        `our Calculated Total (${calculatedTotal}).`,
    /**
     * THE INVOICE-LEVEL PROMPT, AND IT IS THE ITEM KIND'S VOICE ALONE SINCE #179.
     *
     * It read `This invoice has variance flags — review before confirming payment.`
     * and fired on either flag, which was wrong twice. It named two kinds with one
     * word; and #211 lifted it out of the Payment section so a non-privileged
     * viewer sees it, where `review before confirming payment` addresses an action
     * most of its readers cannot take.
     *
     * NARROWED TO THE ITEM KIND because the header kind already has a sentence on
     * this page — the red box under the totals states it with both figures, and it
     * sits outside the Payment gate, so nobody loses it. Firing on both made one
     * fact appear twice on one screen, which is the repetition #232 and #233 took
     * off these pages one level at a time.
     *
     * THE ACTION IS ONE ANY READER CAN TAKE and payment is the deadline rather
     * than the act, which is #232's grammar on the same page: a fact, then
     * something to do, then when it has to happen by.
     */
    itemPrompt: () => ({
        key: "order-variance-prompt",
        text:
            "⚠ A charge on this invoice differs from what its order agreed — " +
            "check it against the order, or take it up with the vendor, " +
            "before this invoice is paid.",
    }),
};
