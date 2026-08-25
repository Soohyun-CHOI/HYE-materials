// Invoice variance tolerance rules. Not a single uniform rule — the derivation
// of each shape, and of the figures below, is in
// `docs/notes/deliveries-and-invoices.md` under "One tolerance for the header
// comparison (#254)".
//
// THE REFERENCE THAT STOOD HERE POINTED AT NOTHING, AND HAD SINCE BEFORE IT WAS
// WRITTEN (#254). It said to see CLAUDE.md's Phase 3 status entry for the
// reasoning behind each shape. That entry said `variance checking (line + header,
// % tolerance, lib/variance.js)` and no more — it never held a reason — and #213
// deleted the whole Status section, after which CLAUDE.md states in its own voice
// that it records no phase status at all. #17's reasoning was only ever in that
// issue's closing comment, which is not a place code can point at, so #254 wrote
// it into the notes file above and pointed here at that.

/**
 * Header: `Invoices."Amount Due"` against `Invoices."Calculated Total"`.
 *
 * HALF A CENT, AND IT IS DERIVED RATHER THAN PICKED (#254). It was
 * `max($5, 1% of Calculated Total)` from #15, and the form applied a cent of its
 * own from #57 — neither chosen for this comparison, which is why #254 chose one
 * instead of keeping the wider.
 *
 * THE TWO FIGURES ARE TRANSCRIPTIONS OF ONE DOCUMENT RATHER THAN MEASUREMENTS, so
 * there is no noise to absorb. `Amount Due` is the total someone copied off the
 * vendor's paper. `Calculated Total` is `SUM(Items Subtotal, Shipping Fee, Tariff,
 * Sales Tax)`, and `Items Subtotal` rolls up `Invoice Items.Amount`, which is
 * `{Qty} * {Unit Price}`. A whole quantity at a whole-cent price is exact to the
 * cent, so both sides of the comparison are whole numbers of cents and any real
 * difference is at least one. What is left is the binary representation error of
 * summing them: about 1e-11 dollars on a hundred-thousand-dollar invoice. Half a
 * cent sits five hundred thousand times above that and one unit below the
 * smallest difference the currency can express.
 *
 * WHY NOT A CENT: a cent is the smallest REAL difference, so `> 0.01` would go
 * silent on one. That is the shape #57 left and the reason its figure was not
 * simply adopted.
 *
 * WHY THE PERCENTAGE TERM WENT: it was proportional to the wrong quantity. What
 * could accumulate scales with how many charges an invoice has, not with what
 * they come to — a fifty-thousand-dollar invoice can be one charge — and a
 * tolerance that grows with the total makes a larger invoice's larger error
 * quieter, which is the wrong direction for a mark a reader is meant to act on.
 *
 * THE PREMISE IS ENFORCED IN `lib/airtable/invoiceItems.js` RATHER THAN ASSUMED,
 * and it had to be: Airtable's `precision` is a display option, so a `Qty` field
 * showing no decimals stores 2.5 verbatim and renders it as 3. Both write
 * functions there refuse a fractional quantity or a sub-cent price. What that
 * cannot reach is a hand edit in the Airtable UI, and the failure it would cause
 * is named in `offline/invoice-header-tolerance.mjs`.
 */
const HEADER_TOLERANCE = 0.005;

/**
 * Invoice item, Unit Price: `Invoice Items` against its linked `PO Item`.
 * Near-exact — only enough absolute tolerance to absorb floating-point noise.
 *
 * THE SAME DERIVATION LANDS ON HALF A CENT HERE TOO, AND THIS FIGURE IS NOT
 * CHANGED (#254). Both figures are whole-cent currency values, so the reasoning
 * above applies unchanged and this constant is simply untightened — the ordering
 * between the two is not a principled statement about which comparison tolerates
 * more. It stays because changing it moves what `Invoice Items."Variance Flag"`
 * is set on, which is stored data on records that already exist, and #254 owns
 * the header comparison only. Whoever tightens it is reading this line.
 */
const UNIT_PRICE_TOLERANCE_ABS = 0.01;

export function checkHeaderVariance(amountDue, calculatedTotal) {
    return Math.abs(amountDue - calculatedTotal) > HEADER_TOLERANCE;
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
// STATE: the vendor invoiced something other than what was settled, which is an
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
// — a price that differs from the order's, or a quantity invoiced beyond what the
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
     * THE HEADER KIND BEFORE THERE IS A RECORD, on `/invoices/new` (#254).
     *
     * SAME COMPARISON, DIFFERENT MOMENT, WHICH IS WHY IT IS A THIRD STRING RATHER
     * THAN `headerDetail` REUSED. That one names the two Airtable fields and reads
     * as a statement about a stored invoice; this addresses the person still
     * typing, so it names the two controls in front of them and `before
     * submitting` has something to point at. #179 kept the form's sentence out of
     * the pair it was rewriting for exactly this reason, and the wording here is
     * that sentence unchanged.
     *
     * WHAT THE FORM CLAIMS IS NARROWER THAN WHAT THE RECORD WILL SAY, and the
     * words carry that. The form computes its own sum from what was typed; the
     * backend re-reads Airtable's `Calculated Total` after the charges are linked,
     * and the two cannot always see the same number — a coercion drops a typed
     * zero, and a rollup is not a client-side reduce. So the shared thing is the
     * TOLERANCE and never the inputs, and this sentence asserts only that the two
     * figures on the screen right now disagree by more than the rule allows.
     *
     * IT MOVED HERE FROM JSX AND THAT IS THE POINT. Written as element text it was
     * invisible to `offline/line-vocabulary.mjs`, which reads strings inside
     * `*_COPY` declarators and nothing else.
     */
    headerBeforeSaving: (statedTotal, calculatedTotal) =>
        `Vendor's Stated Total (${statedTotal}) doesn't match the calculated total ` +
        `(${calculatedTotal}) — double-check before submitting.`,
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
