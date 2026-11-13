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
 * Totals: `Invoices."Invoice Total"` against `Invoices."Calculated Total"` — the
 * comparison the screens call `Totals differ` and `Totals agree` (#623;
 * `Amount Due`, and the header comparison, until then).
 *
 * HALF A CENT, AND IT IS DERIVED RATHER THAN PICKED (#254). It was
 * `max($5, 1% of Calculated Total)` from #15, and the form applied a cent of its
 * own from #57 — neither chosen for this comparison, which is why #254 chose one
 * instead of keeping the wider.
 *
 * THE TWO FIGURES ARE TRANSCRIPTIONS OF ONE DOCUMENT RATHER THAN MEASUREMENTS, so
 * there is no noise to absorb. `Invoice Total` is the total someone copied off the
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
 * could accumulate scales with how many items an invoice has, not with what
 * they come to — a fifty-thousand-dollar invoice can be one item — and a
 * tolerance that grows with the total makes a larger invoice's larger error
 * quieter, which is the wrong direction for a mark a reader is meant to act on.
 *
 * THE PREMISE IS ENFORCED RATHER THAN ASSUMED, AND IT TAKES FOUR WRITE FUNCTIONS
 * TO MAKE THE SENTENCE ABOVE TRUE (#254, #405). It has to be enforced at all
 * because Airtable's `precision` is a display option: a `Qty` field showing no
 * decimals stores 2.5 verbatim and renders it as 3.
 *
 *   `Items Subtotal` rolls up `{Qty} * {Unit Price}`, and both write functions in
 *   `lib/airtable/invoiceItems.js` refuse a fractional quantity or a sub-cent
 *   price (#254).
 *
 *   The three terms summed beside it — `Shipping Fee`, `Tariff`, `Sales Tax` —
 *   and `Invoice Total` on the OTHER SIDE of the comparison are refused by both
 *   write functions in `lib/airtable/invoices.js` (#405). Until that issue
 *   nothing asked them at all: one `1.005` put a side off the cent, and half a
 *   cent stopped being one unit below the smallest real difference.
 *
 * So this constant rests on the item half and the header half together, and
 * enforcing either alone leaves it meaning less than it says. What no writer can
 * reach is a hand edit in the Airtable UI, and the failure that would cause is
 * named in `offline/invoice-header-tolerance.mjs`.
 */
const TOTALS_TOLERANCE = 0.005;

/**
 * Invoice item, Unit Price: `Invoice Items` against its linked `PO Item` — the
 * price variance (#623). Near-exact — only enough absolute tolerance to absorb
 * floating-point noise.
 *
 * THE SAME DERIVATION LANDS ON HALF A CENT HERE TOO, AND THIS FIGURE IS NOT
 * CHANGED (#254). Both figures are whole-cent currency values, so the reasoning
 * above applies unchanged and this constant is simply untightened — the ordering
 * between the two is not a principled statement about which comparison tolerates
 * more. It stays because changing it moves what `Invoice Items."Has Price Variance"`
 * is set on, which is stored data on records that already exist, and #254 owns
 * the totals comparison only. Whoever tightens it is reading this line.
 */
const PRICE_TOLERANCE = 0.01;

/** Totals differ: the vendor's `Invoice Total` against our `Calculated Total` (#254, #623). */
export function checkTotalsDiffer(invoiceTotal, calculatedTotal) {
    return Math.abs(invoiceTotal - calculatedTotal) > TOTALS_TOLERANCE;
}

/**
 * The premise `TOTALS_TOLERANCE` rests on, as two predicates rather than as a
 * paragraph (#254): an item's `Amount` is `{Qty} * {Unit Price}`, and it is a
 * whole number of cents exactly when the quantity is whole and the price is in
 * whole cents.
 *
 * HERE BECAUSE THREE PLACES ASK IT. `lib/airtable/invoiceItems.js` throws on a
 * violation, and both invoice actions refuse one with a message — a person really
 * can put either figure into the form, which is measured rather than assumed, so
 * the refusal and the backstop have to be the same judgment. This module imports
 * nothing, so all three can reach it.
 *
 * `undefined` and `null` are whole: an absent figure is a different question,
 * already asked by the callers that require one, and coupling the two would make
 * a partial update refuse a field it was not writing.
 */
export function isWholeQty(qty) {
    return qty == null || Number.isInteger(qty);
}

export function isWholeCentPrice(unitPrice) {
    if (unitPrice == null) return true;
    // Compared with slack rather than `x * 100 === Math.round(x * 100)`, because a
    // whole-cent value need not be exactly representable in binary — 8.11 is not —
    // so the exact test rejects prices this rule is meant to admit.
    const cents = unitPrice * 100;
    return Number.isFinite(cents) && Math.abs(cents - Math.round(cents)) <= 1e-9;
}

/**
 * What a write refused for precision is marked with, so a caller can recognize one.
 *
 * #308 GAVE THE GUARD A READER WHO CANNOT SEE THE FIGURE. Up to here every throw
 * below reached somebody looking at the box they had typed in, and the action beside
 * it had already refused with words. The order's freeze runs long after that: the
 * request is Approved, its items are no longer editable in this app, and the person
 * pressing the retry is an Admin who did not type anything. A generic
 * `Please try again.` is false for them — the retry fails identically until the row
 * is repaired — so `generatePOAction` matches on this code and says what is wrong.
 *
 * A CODE RATHER THAN THE MESSAGE, because the message names a field, a value and two
 * issue numbers, and matching on prose is a rule that breaks when somebody improves
 * a sentence.
 */
export const PRECISION_BLOCKED = "precision-blocked";

const precisionError = (message) => Object.assign(new Error(message), { code: PRECISION_BLOCKED });

/**
 * The guards every writer of one of these figures runs, as the last line (#254, #308).
 *
 * THEY WERE PRIVATE TO `lib/airtable/invoiceItems.js` UNTIL #308 AND HAD ONE CALLER.
 * That issue gives them five more — `PR Items` and `PO Items` on both figures, and
 * `Purchase Requests` / `Purchase Orders` on the shipping fee — and four copies of a
 * four-line throw is the duplication CLAUDE.md's own section forbids. So they moved
 * here, beside the predicates they wrap and the tolerance they are the premise for.
 *
 * THEY THROW RATHER THAN COERCE, which is the part that must not be softened:
 * rounding here would silently restate what a caller said the figure was, on a
 * document somebody is about to send a vendor.
 *
 * `caller` IS THE FUNCTION NAME AND IS NOT DECORATION. Six writers share these now, so
 * a stack-free log line has to say which one refused.
 */
export function assertWholeQty(caller, qty) {
    if (isWholeQty(qty)) return;
    throw precisionError(
        `${caller}: Qty must be a whole number, got ${qty} — a fractional quantity puts ` +
        `Amount off the cent, and both the order's Total Amount and the invoice header ` +
        `tolerance rest on it (#254, #308)`
    );
}

/**
 * `field` NAMES THE COLUMN BECAUSE THE FIGURE IS NO LONGER ALWAYS A UNIT PRICE (#308).
 * A `Shipping Fee` is summed into the same total and multiplied by nothing, so it asks
 * this half of the rule and never `assertWholeQty`.
 */
export function assertWholeCentPrice(caller, value, field = "Unit Price") {
    if (isWholeCentPrice(value)) return;
    throw precisionError(
        `${caller}: ${field} must be a whole number of cents, got ${value} — a sub-cent ` +
        `figure puts the total off the cent, and both the order's Total Amount and the ` +
        `invoice header tolerance rest on it (#254, #308)`
    );
}

/**
 * The two refusals, for the reader who typed the figure.
 *
 * THEY EXIST BECAUSE THE FORM CAN REACH BOTH STATES, which is the measurement
 * that corrected this file's first draft. The quantity control declares no `step`
 * and the price control declares `step="0.01"`, and on this form the browser marks
 * neither `2.5` nor `1.005` invalid — `checkValidity()` returns true and the form
 * submits. Without these the guard's throw surfaced as
 * `Something went wrong creating the invoice. Please try again.`, on an input a
 * reader could fix and would retry unchanged.
 *
 * `item`, WHICH IS THE NOUN #303 SETTLED AND #254 GUESSED AT. These two said
 * `charge` while their four neighbours in `createInvoiceAction` said `item`, on
 * the authority of a `naming.md` row that had settled the noun together with the
 * verb — and #274, which that row cites, weighed only the verb. An `Invoice
 * Items` row is an `invoice item`, and this sentence names no other kind of item
 * row, so the modifier drops. See `docs/notes/naming.md`.
 */
export const ITEM_PRECISION_COPY = {
    qty: "Every item's quantity has to be a whole number.",
    unitPrice: "Every item's unit price has to be a whole number of cents.",
};

/**
 * The same rule about the figure that is not an item's (#308).
 *
 * A SEPARATE STRING BECAUSE `Every item's unit price` HAS THE WRONG SUBJECT. A
 * shipping fee is not an item and has no unit price; it is one term summed beside the
 * item amounts into `Purchase Orders."Total Amount"`, which is the TOTAL line on the
 * PDF the office sends the vendor. #330 is the precedent and the test it set: two
 * paths refusing what looks like one fact get one string only when the fact really is
 * one, and here the predicate is shared while the subject is not.
 *
 * NAMED FOR THE FIGURE RATHER THAN FOR THE SCREEN, so the invoice side reuses it
 * rather than coining a second sentence about the same field. `Invoices."Shipping
 * Fee"` is one of the three terms of `Calculated Total` that nothing yet holds to a
 * cent — see `docs/notes/backlog.md` — and when that is closed this constant is
 * already the thing to import.
 *
 * IT DOES NOT REPLACE `Shipping Fee must be a number.` and must not be read as
 * tidying it up. That refusal answers whether a figure was typed at all; this one
 * answers where it lands. An empty box and `1.005` are two mistakes and their readers
 * need two sentences.
 *
 * THE MOOD IS `ITEM_PRECISION_COPY`'s, not the NaN refusal's, because the family a
 * sentence belongs to is the judgment behind it: all three of these are
 * `isWholeCentPrice` speaking.
 */
export const SHIPPING_FEE_PRECISION_COPY = "Shipping Fee has to be a whole number of cents.";

/**
 * The same rule over every figure an invoice's header carries (#405).
 *
 * ONE CONSTANT WITH FOUR KEYS, WHICH IS `ITEM_PRECISION_COPY`'s SHAPE AND #330's
 * TEST APPLIED. That test asks whether two paths refusing what looks like one fact
 * are really refusing one: there they were not — a submission with no rows and a
 * record with none are different facts — and here they are. `isWholeCentPrice` is
 * the whole judgment for all four, and only the SUBJECT differs, which is exactly
 * the case that gets one constant keyed by subject rather than four constants.
 *
 * `shippingFee` IS #308's STRING AND NOT A SECOND ONE ABOUT THE SAME FIELD. That
 * issue named `SHIPPING_FEE_PRECISION_COPY` for the figure rather than for the
 * screen so that this issue would import it, and said so in as many words — the
 * field is `Shipping Fee` on a request and on an invoice alike, and the sentence
 * names the field. This is the same binding under a second name, so the request's
 * own call sites are untouched and there is one string to change if it is ever
 * reworded.
 *
 * `invoiceTotal` IS HERE THOUGH IT IS NOT A TERM OF THE SUM, and that is the point
 * rather than an overreach. `TOTALS_TOLERANCE`'s derivation rests on BOTH SIDES of
 * the comparison being whole numbers of cents; `Invoice Total` is the other side, so
 * holding only the terms leaves the same hole one step over — `|100.004 - 100.00|`
 * stays silent under half a cent while `0.006` fires on a difference the currency
 * cannot express. It costs nothing real, since a vendor's printed total is in
 * cents.
 *
 * IT SAYS `Invoice Total`, THE FIELD'S NAME AND BOTH FORMS' LABEL SINCE #623. Until
 * then the field was `Amount Due`, `/invoices/new` labeled the control
 * `Vendor's Stated Total` and the edit screen `Amount Due (vendor's stated total)` —
 * three names for one figure, which is what that issue ended.
 */
export const HEADER_PRECISION_COPY = {
    shippingFee: SHIPPING_FEE_PRECISION_COPY,
    tariff: "Tariff has to be a whole number of cents.",
    salesTax: "Sales Tax has to be a whole number of cents.",
    invoiceTotal: "Invoice Total has to be a whole number of cents.",
};

/**
 * Which of an invoice's header figures is off the cent, as the sentence for it —
 * or `null` when none is (#405).
 *
 * A FUNCTION RATHER THAN FOUR `if`s AT EACH CALL SITE. Two actions ask this, so
 * inline tests would be eight blocks, and the ORDER the refusals come in would be
 * decided twice — two screens that disagree about which of two bad figures to name
 * first is a difference no reader could explain. Pure and import-free like
 * everything else in this file, so the offline tier pins the order as well as the
 * verdict.
 *
 * THE ORDER IS THE SUM'S, THEN THE OTHER SIDE. `Calculated Total` reads
 * `Items Subtotal + Shipping Fee + Tariff + Sales Tax`, so the three terms come in
 * that order and `Invoice Total` comes last as the figure the sum is compared
 * against. It is the same order whichever screen asked, and neither screen's own
 * control order matches it — `/invoices/new` puts the stated total last and the
 * edit screen puts it first — so taking one screen's layout would have made the
 * other one's refusals arbitrary.
 *
 * AN ABSENT FIGURE IS NOT A REFUSAL. `isWholeCentPrice` abstains on `null` and
 * `undefined`, which is what lets `updateInvoice`'s partial callers pass three of
 * these as `undefined` and lets `Tariff` and `Sales Tax` stay optional. Whether a
 * figure had to be there at all is a different question, asked by the callers that
 * require one.
 */
export function headerPrecisionRefusal({ shippingFee, tariff, salesTax, invoiceTotal } = {}) {
    if (!isWholeCentPrice(shippingFee)) return HEADER_PRECISION_COPY.shippingFee;
    if (!isWholeCentPrice(tariff)) return HEADER_PRECISION_COPY.tariff;
    if (!isWholeCentPrice(salesTax)) return HEADER_PRECISION_COPY.salesTax;
    if (!isWholeCentPrice(invoiceTotal)) return HEADER_PRECISION_COPY.invoiceTotal;
    return null;
}

/**
 * What the PO retry says when the freeze is what refused (#308).
 *
 * A THIRD SENTENCE BECAUSE IT HAS A THIRD READER. The two above address the person
 * whose cursor is in the box; this addresses an Admin pressing `Generate the order
 * here` on `/pos`'s #176 strip, long after approval, for a request somebody else
 * filled in. Without it that button answers
 * `Something went wrong generating the PO. Please try again.` — uninformative, and
 * false about the remedy, since the retry fails identically until the row is
 * repaired. A guard that blocks and strands is worse than the defect it blocks.
 *
 * IT NAMES AIRTABLE BECAUSE THE APP HAS NO OTHER ANSWER. `editAndContinueAction`
 * requires `In Review`, so an Approved request's items are past editing here, and the
 * only path that reaches a bad row is the same hand edit that made one. `/deliveries`
 * already names Airtable in its own out-of-scope sentence, so this is the app's
 * grammar rather than a new admission.
 *
 * IT DOES NOT NAME THE ROW, and that is a size judgment rather than an omission: the
 * request's own page lists every item with its quantity and unit price, so the odd one
 * is visible one click away, and carrying a row id out through a service-layer throw
 * would put the id in the error and the sentence in two pieces.
 */
export const PRECISION_BLOCKED_COPY =
    "This request holds a figure the order cannot carry — a quantity that is not a " +
    "whole number, or an amount that is not a whole number of cents. Correct it on " +
    "the request in Airtable, then generate the order again.";

/** Price variance: an invoice item's `Unit Price` against its ordered item's (#623). */
export function checkPriceVariance(invoiceUnitPrice, orderedUnitPrice) {
    return Math.abs(invoiceUnitPrice - orderedUnitPrice) > PRICE_TOLERANCE;
}

/**
 * Quantity variance: what every invoice has charged against one ordered item —
 * `PO Items."Invoiced Qty"`, this invoice's items included — against what it ordered
 * (#623).
 *
 * ONE PREDICATE FOR THREE WRITERS, WHERE THERE WERE THREE INLINE COMPARISONS.
 * `createInvoiceAction` and `updateInvoiceAction` wrote `invoicedQty > poItem.qty` and
 * `lib/overage.server.js` wrote `invoicedQty > (poItem.qty || 0)`, which parted on an
 * ordered item with no `Qty`: the first two judged it false and the third true. The
 * two actions' reading is kept — an ordered quantity nobody stated is not one this
 * can say was exceeded — and no ordered item reaches the state, since an order's
 * items are frozen from a request's, which requires one.
 */
export function checkQuantityVariance(invoicedQty, orderedQty) {
    return orderedQty != null && (invoicedQty || 0) > orderedQty;
}

// ---------------------------------------------------------------------------
// Copy (#179, #623)
//
// TWO FLAGS BOTH READ `Variance` UNTIL #179 AND THEY ARE NOT THE SAME KIND OF FACT.
// One compares the total the vendor wrote against the sum of the items somebody
// typed in from the same page — a disagreement inside one document, which in
// practice means the typing missed something. The other compares an item against
// what the order agreed. The LIST said `Variance` for the first and the detail's
// items table said it for the second, so one word meant one thing on the row a
// reader clicked and another on the page they landed on.
//
// THE WORDS LIVE WITH THE PREDICATES because they are the same decision named
// twice, which is the shape `lib/deliveryStatus.js` and `lib/deliveryAllocation.js`
// already have. It also gets them out of JSX, where `offline/line-vocabulary.mjs`
// and `offline/variance-copy.mjs` cannot see them. `PO_DOCUMENTS_COPY` carried two
// of them until #179 and no longer does: they are invoice facts rendered on the
// order's page, and a word with two homes is what that issue removed.
//
// THREE, IN THE THREE-WAY MATCH'S WORDS: the invoice against the order and against
// itself. `Price variance` is an item's unit price against the order's, `Quantity
// variance` what every invoice has charged against one ordered item against what it
// ordered, and `Totals differ` the vendor's `Invoice Total` against our `Calculated
// Total`, with `Totals agree` for the same comparison passing. #179 named the first and
// last `Order variance` and `Check the total`. #623 named a fourth, `Delivery variance`
// (`Mismatch` until then) — an invoice against the one delivery linked to it — and #640
// retired it with that link: compared cumulatively, less delivered is a wait, which is
// `STATUS_COPY.column.invoice`'s `Awaiting delivery` in `lib/deliveryStatus.js`.
//
// THE ITEM HAS TWO FLAGS NOW, AND EACH BADGE NAMES ITS CAUSE. One stored flag stood for
// a price that differs OR a quantity invoiced beyond the order, so no word beside it
// could say which. The two are judged apart by `checkPriceVariance` and
// `checkQuantityVariance`, stored apart, and drawn apart. What each compares against is
// still on the order's own page, which #233 gave an `Invoiced` column beside the
// ordered quantity and price.
//
// NONE NAMES A DIRECTION, and that is measured rather than stylistic: the price and
// totals predicates compare an ABSOLUTE difference, so each fires when the figure is
// under as readily as over. `Over-billed` was the first draft of the item word and
// would have been false half the time it appeared. The quantity one is one-sided by
// construction — invoiced past what was ordered — and its word says variance, not over.
//
// THE WORD AND THE STORED VALUE ARE ONE STRING SINCE #648. `Invoice Variance Log."Variance"` holds
// which of the three an event is about, and its choices are these words without the mark, so
// the badge is built from the choice rather than written beside it: a reworded badge and a
// select left on the old word would be the one-fact-two-names shape #179 removed.

/** The three kinds, as `Invoice Variance Log."Variance"` holds them and a screen says them unmarked (#648). */
export const VARIANCE_KINDS = {
    price: "Price variance",
    quantity: "Quantity variance",
    totals: "Totals differ",
};

export const VARIANCE_COPY = {
    /**
     * An item's unit price against its order's. Both call sites render the same
     * string: the invoice detail's items table and the order page's list of what an
     * invoice charges it for.
     */
    price: `⚠ ${VARIANCE_KINDS.price}`,
    /** What every invoice has charged against an ordered item, past what it ordered. The same two sites. */
    quantity: `⚠ ${VARIANCE_KINDS.quantity}`,
    /**
     * One document's own arithmetic: the vendor's total against the sum of what was
     * typed in from it. `⚠ Check the total` until #623, chosen short enough to sit
     * beside `Paid 2026-07-27` in a list cell that has 176px; #309 took the date off
     * that cell, so the word it shares the cell with is `Paid` alone.
     */
    totalsDiffer: `⚠ ${VARIANCE_KINDS.totals}`,
    /**
     * The same comparison passing, on `/invoices/new` where the two figures are typed
     * (#623). Nowhere else: a stored invoice whose totals agree carries no mark, as an
     * invoice with nothing wrong carries none.
     */
    totalsAgree: "Totals agree",
    /**
     * Totals differ with its two figures, under the invoice's own totals. The badge
     * label leads it, so the mark in a list and the sentence on the page it leads to
     * cannot come to say different things.
     */
    totalsDetail: (invoiceTotal, calculatedTotal) =>
        `${VARIANCE_COPY.totalsDiffer} — ${totalsComparison(invoiceTotal, calculatedTotal)}`,
    /**
     * TOTALS DIFFER BEFORE THERE IS A RECORD, on `/invoices/new` (#254).
     *
     * SAME COMPARISON, DIFFERENT MOMENT, WHICH IS WHY IT IS A STRING OF ITS OWN RATHER
     * THAN `totalsDetail` REUSED. That one reads as a statement about a stored
     * invoice; this addresses the person still typing, so it names the two figures in
     * front of them as that form labels them and `before submitting` has something to
     * point at. It leads with the badge's words since #623, so the form and the record
     * say the same thing about the same comparison.
     *
     * WHAT THE FORM CLAIMS IS NARROWER THAN WHAT THE RECORD WILL SAY, and the
     * words carry that. The form computes its own sum from what was typed; the
     * backend re-reads Airtable's `Calculated Total` after the items are linked,
     * and the two cannot always see the same number — a coercion drops a typed
     * zero, and a rollup is not a client-side reduce. So the shared thing is the
     * TOLERANCE and never the inputs, and this sentence asserts only that the two
     * figures on the screen right now disagree by more than the rule allows.
     *
     * IT MOVED HERE FROM JSX AND THAT IS THE POINT. Written as element text it was
     * invisible to `offline/line-vocabulary.mjs`, which reads strings inside
     * `*_COPY` declarators and nothing else.
     */
    totalsBeforeSaving: (invoiceTotal, calculatedTotal) =>
        `${VARIANCE_COPY.totalsDiffer} — Invoice Total (${invoiceTotal}) doesn't match the ` +
        `calculated total (${calculatedTotal}); double-check before submitting.`,
    /**
     * THE INVOICE-LEVEL PROMPT, AND IT IS THE ITEMS' VOICE ALONE SINCE #179 — a price
     * variance or a quantity variance on any item, which both differ from what the
     * order agreed.
     *
     * It read `This invoice has variance flags — review before confirming payment.`
     * and fired on either flag, which was wrong twice. It named two kinds with one
     * word; and #211 lifted it out of the Payment section so a non-privileged
     * viewer sees it, where `review before confirming payment` addresses an action
     * most of its readers cannot take.
     *
     * NARROWED TO THE ITEMS because totals differ already has a sentence on this
     * page — the red box under the totals states it with both figures, and it
     * sits outside the Payment gate, so nobody loses it. Firing on both made one
     * fact appear twice on one screen, which is the repetition #232 and #233 took
     * off these pages one level at a time.
     *
     * THE ACTION IS ONE ANY READER CAN TAKE and payment is the deadline rather
     * than the act, which is #232's grammar on the same page: a fact, then
     * something to do, then when it has to happen by.
     */
    itemPrompt: () => ({
        key: "item-variance-prompt",
        text:
            "⚠ An item on this invoice differs from what its order agreed — " +
            "check it against the order, or take it up with the vendor, " +
            "before this invoice is paid.",
    }),
};

/**
 * The totals comparison stated with both figures, which the open box and the accepted one
 * both say after their own lead (#648). One sentence, so the two boxes cannot come to describe
 * one comparison two ways.
 */
function totalsComparison(invoiceTotal, calculatedTotal) {
    return `the vendor's Invoice Total (${invoiceTotal}) doesn't match our Calculated Total (${calculatedTotal}).`;
}

// ---------------------------------------------------------------------------
// Accepting a variance (#648)
//
// A VARIANCE STAYS RED UNTIL ITS CAUSE IS CORRECTED, AND SOME CAUSES HAVE NOTHING TO CORRECT —
// a vendor raised the price and the office decided to pay it. The three-way match's answer is
// the one this takes: somebody with the authority accepts it and says why. An Admin accepts a
// price variance, a quantity variance or a totals difference, each on its own; the mark then
// reads as accepted, and who, when and why are on the invoice's page.
//
// WHAT AN ACCEPTANCE STANDS ON IS THE TWO FIGURES ITS VARIANCE COMPARED, remembered on its
// `Invoice Variance Log` row. Every write that judges a row's variances again — an invoice's edit, an
// overage correction's split — compares the row's figures now with those, through
// `acceptanceAfter` below, and an acceptance whose figures moved ends there: `Reopened` while
// the variance still stands, `Cleared` when it no longer does. Remembering rather than clearing
// on every edit is what lets a Due Date change leave an acceptance alone, and what makes a
// failed edit's retry finish the job: the comparison is against a stored value, not against the
// edit's own before and after.
//
// A QUANTITY VARIANCE'S FIGURES ARE THE ITEM'S OWN `Qty` AND ITS ORDERED ITEM'S, NOT
// `Invoiced Qty`. The flag compares what every invoice has charged against the ordered item, but
// an acceptance is of this invoice's charge: another invoice charging the same ordered item later
// raises a variance on its own item, and taking the total here would reopen this one when its
// own invoice was next edited for anything at all — a Due Date — on a figure that edit did not
// move. The item's own quantity moves only when its own invoice is edited or split, and both
// judge it again, so the cache can never stand on a figure that has changed.
//
// AWAITING DELIVERY IS NOT ONE OF THESE. It is a wait, not a variance — a delivery recorded
// makes the invoice `Matched` by itself — so nothing accepts it; the payment check below states
// it, as information.

/** The three events an `Invoice Variance Log` row records, as its `Event` select holds them. */
export const VARIANCE_EVENTS = {
    accepted: "Accepted",
    reopened: "Reopened",
    cleared: "Cleared",
};

/** The two selects' closed sets, for the writer that refuses anything else. */
export const VARIANCE_KIND_VALUES = Object.values(VARIANCE_KINDS);
export const VARIANCE_EVENT_VALUES = Object.values(VARIANCE_EVENTS);

/** The kinds an invoice item carries; the third is the invoice's own. */
export const ITEM_VARIANCE_KINDS = ["price", "quantity"];

/** Each kind's flag and its acceptance cache, as the two mappers name them. */
const KIND_FIELDS = {
    price: { has: "hasPriceVariance", accepted: "priceVarianceAccepted" },
    quantity: { has: "hasQuantityVariance", accepted: "quantityVarianceAccepted" },
    totals: { has: "totalsDiffer", accepted: "totalsDifferAccepted" },
};

/** Whether `kind` is one of the three. */
export function isVarianceKind(kind) {
    return Object.hasOwn(KIND_FIELDS, kind);
}

/** The cache field a kind's acceptance is written to, by its mapper key. */
export function acceptedFieldOf(kind) {
    return KIND_FIELDS[kind].accepted;
}

/**
 * One row's state for one kind: `open`, `accepted`, or null where the variance does not stand.
 * An acceptance cache on a row whose flag is clear says nothing — the flag is what a screen asks
 * first, so a cache the write that cleared the flag has not cleared yet cannot draw a mark.
 */
export function varianceState(row, kind) {
    const fields = KIND_FIELDS[kind];
    if (!row?.[fields.has]) return null;
    return row[fields.accepted] ? "accepted" : "open";
}

/**
 * A folded row's state, from its members' (`lib/invoiceItemFold.js`, `lib/poDocuments.js`):
 * open while any member's variance is open, accepted once every member carrying one is accepted.
 * A fold answers "is something wrong with this item", and a half nobody accepted is.
 */
export function foldVarianceStates(states) {
    const standing = (states || []).filter(Boolean);
    if (standing.length === 0) return null;
    return standing.includes("open") ? "open" : "accepted";
}

/**
 * The two figures a kind compares: the invoice's side and the side it is held against — what a
 * `Invoice Variance Log` row stores as `Vendor Figure` and `Our Figure`. A quantity's are the item's own
 * `Qty` and its ordered item's (see this section's header for why not `Invoiced Qty`).
 */
export function varianceFigures(kind, { item, orderedItem, invoice } = {}) {
    if (kind === "price") return { vendor: item?.unitPrice ?? null, ours: orderedItem?.unitPrice ?? null };
    if (kind === "quantity") return { vendor: item?.qty ?? null, ours: orderedItem?.qty ?? null };
    if (kind === "totals") return { vendor: invoice?.invoiceTotal ?? null, ours: invoice?.calculatedTotal ?? null };
    throw new Error(`varianceFigures: "${kind}" is not one of ${Object.keys(KIND_FIELDS).join(", ")}`);
}

/**
 * Two figures are the same within half a cent: both are whole cents or whole units (the premise
 * `TOTALS_TOLERANCE` rests on, held by the writers above), so any real change is at least one,
 * and what is left is the binary noise of a stored sum.
 */
function sameFigure(a, b) {
    if (a == null || b == null) return a == null && b == null;
    return Math.abs(a - b) <= TOTALS_TOLERANCE;
}

/**
 * What an accepted variance becomes when its row is judged again: null while the acceptance
 * stands, `Cleared` when the variance no longer stands, `Reopened` when it does and either
 * figure is not what the acceptance was given (#648). `accepted` is the figures on the
 * acceptance's own `Accepted` row, or null where the cache says accepted and the log holds no
 * such row — a hand edit — which stands on nothing and so ends.
 */
export function acceptanceAfter({ stands, accepted, figures }) {
    if (!stands) return VARIANCE_EVENTS.cleared;
    if (!accepted || !sameFigure(accepted.vendor, figures?.vendor) || !sameFigure(accepted.ours, figures?.ours)) {
        return VARIANCE_EVENTS.reopened;
    }
    return null;
}

/**
 * The latest `Invoice Variance Log` row about one kind on one item — or on the invoice, for `totals`,
 * whose rows name no item — in the order the rows were minted. A row's id is its invoice's and a
 * sequence, so a numeric-aware comparison is the order they were written in.
 */
export function latestVarianceEntry(entries, kind, itemRecordId = null) {
    const word = VARIANCE_KINDS[kind];
    const mine = (entries || []).filter(
        (e) => e.variance === word && (kind === "totals" ? (e.invoiceItem || []).length === 0 : (e.invoiceItem || [])[0] === itemRecordId)
    );
    if (mine.length === 0) return null;
    return [...mine].sort((a, b) => (a.invoiceVarianceLogId || "").localeCompare(b.invoiceVarianceLogId || "", "en", { numeric: true })).at(-1);
}

/**
 * What a screen says about one kind on one row beside its badge: the acceptance that stands —
 * who, when and why — or, for a variance open again, when it was reopened. `entries` are the
 * invoice's `Invoice Variance Log` rows, newest last. A folded row asks for each member and shows the
 * newest answer, so the Admin who accepted last is the one named.
 */
export function varianceNote(entries, kind, itemRecordIds, state) {
    const ids = kind === "totals" ? [null] : itemRecordIds || [];
    const latest = ids
        .map((id) => latestVarianceEntry(entries, kind, id))
        .filter(Boolean)
        .sort((a, b) => (a.invoiceVarianceLogId || "").localeCompare(b.invoiceVarianceLogId || "", "en", { numeric: true }))
        .at(-1);
    if (!latest) return null;
    if (state === "accepted" && latest.event === VARIANCE_EVENTS.accepted) {
        return { kind: "accepted", by: latest.recordedBy?.[0] ?? null, at: latest.eventAt, reason: latest.reason };
    }
    if (state === "open" && latest.event === VARIANCE_EVENTS.reopened) {
        return { kind: "reopened", at: latest.eventAt };
    }
    return null;
}

/**
 * The words an acceptance says (#648). A badge keeps its kind's word and loses the mark — the
 * same lead the open badge has, so a reader crossing from one to the other meets the kind first
 * and its state after the dot, as `⚠ Overdue · 10d` adds its figure to `⚠ Overdue`.
 */
export const ACCEPTANCE_COPY = {
    badge: {
        price: `${VARIANCE_KINDS.price} · Accepted`,
        quantity: `${VARIANCE_KINDS.quantity} · Accepted`,
        totals: `${VARIANCE_KINDS.totals} · Accepted`,
    },
    /** The accepted totals box: the accepted badge's words, then the comparison the open box states. */
    totalsDetail: (invoiceTotal, calculatedTotal) =>
        `${ACCEPTANCE_COPY.badge.totals} — ${totalsComparison(invoiceTotal, calculatedTotal)}`,
    /** `Accepted by {name} · {day} — {reason}`: the day is an `Instant`, drawn in the reader's zone. */
    acceptedBy: "Accepted by",
    /** `Reopened · {day} — …`, under a badge open again. */
    reopened: "Reopened",
    reopenedWhy: "the figures it was accepted on changed.",
    /** Under an accepted badge on the edit screen, where a save can be what reopens it. */
    editNote: "Changing the figures it was accepted on reopens it.",
    /** The control beside an open badge, an Admin's alone, and what it opens. */
    open: "Accept",
    reasonLabel: "Reason",
    submit: "Accept",
    pending: "Accepting...",
    cancel: "Cancel",
    refusals: {
        reason: "Reason is required.",
        stale: "That variance has changed since this page loaded.",
        failed: "Something went wrong accepting the variance. Please try again.",
    },
};

/**
 * The variances still open on an invoice, as the payment check lists them (#648): each folded
 * item's, in the table's order, its badge and its name, then the totals'. `folded` rows carry
 * `priceVariance` and `quantityVariance` states and a `label`; an accepted variance is not here.
 */
export function openVariances({ folded, invoice }) {
    const lines = [];
    for (const row of folded || []) {
        if (row.priceVariance === "open") lines.push({ key: `${row.key}::price`, text: `${VARIANCE_COPY.price} — ${row.label}` });
        if (row.quantityVariance === "open") lines.push({ key: `${row.key}::quantity`, text: `${VARIANCE_COPY.quantity} — ${row.label}` });
    }
    if (varianceState(invoice, "totals") === "open") lines.push({ key: "totals", text: VARIANCE_COPY.totalsDiffer });
    return lines;
}

/**
 * What `Save payment` asks before recording a payment on an invoice with something left (#648).
 * It never refuses: the app records a payment made elsewhere, so the question is whether the
 * reader meant to, asked once. The delivery's sentence is information and wears no warning — a wait,
 * which a delivery recorded ends by itself.
 */
export const PAYMENT_CHECK_COPY = {
    heading: "Still open on this invoice:",
    delivery: (chip, wait) => `${chip}${wait ? ` · ${wait}` : ""} — not everything it charges has been delivered yet.`,
    confirm: "Save payment anyway",
    back: "Go back",
};
