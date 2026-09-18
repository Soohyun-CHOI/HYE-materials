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
 *   and `Amount Due` on the OTHER SIDE of the comparison are refused by both
 *   write functions in `lib/airtable/invoices.js` (#405). Until that issue
 *   nothing asked them at all: one `1.005` put a side off the cent, and half a
 *   cent stopped being one unit below the smallest real difference.
 *
 * So this constant rests on the item half and the header half together, and
 * enforcing either alone leaves it meaning less than it says. What no writer can
 * reach is a hand edit in the Airtable UI, and the failure that would cause is
 * named in `offline/invoice-header-tolerance.mjs`.
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

/**
 * The premise `HEADER_TOLERANCE` rests on, as two predicates rather than as a
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
 * `amountDue` IS HERE THOUGH IT IS NOT A TERM OF THE SUM, and that is the point
 * rather than an overreach. `HEADER_TOLERANCE`'s derivation rests on BOTH SIDES of
 * the comparison being whole numbers of cents; `Amount Due` is the other side, so
 * holding only the terms leaves the same hole one step over — `|100.004 - 100.00|`
 * stays silent under half a cent while `0.006` fires on a difference the currency
 * cannot express. It costs nothing real, since a vendor's printed total is in
 * cents.
 *
 * IT SAYS `Amount Due` THOUGH `/invoices/new` LABELS THAT CONTROL
 * `Vendor's Stated Total`. Both actions already answer `Amount Due is required.`
 * on that screen, so a refusal naming the label would disagree with the refusal
 * directly above it — and the edit screen labels the control
 * `Amount Due (vendor's stated total)`, which is the two names in one place.
 */
export const HEADER_PRECISION_COPY = {
    shippingFee: SHIPPING_FEE_PRECISION_COPY,
    tariff: "Tariff has to be a whole number of cents.",
    salesTax: "Sales Tax has to be a whole number of cents.",
    amountDue: "Amount Due has to be a whole number of cents.",
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
 * that order and `Amount Due` comes last as the figure the sum is compared
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
export function headerPrecisionRefusal({ shippingFee, tariff, salesTax, amountDue } = {}) {
    if (!isWholeCentPrice(shippingFee)) return HEADER_PRECISION_COPY.shippingFee;
    if (!isWholeCentPrice(tariff)) return HEADER_PRECISION_COPY.tariff;
    if (!isWholeCentPrice(salesTax)) return HEADER_PRECISION_COPY.salesTax;
    if (!isWholeCentPrice(amountDue)) return HEADER_PRECISION_COPY.amountDue;
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

export function checkUnitPriceVariance(invoiceUnitPrice, poItemUnitPrice) {
    return Math.abs(invoiceUnitPrice - poItemUnitPrice) > UNIT_PRICE_TOLERANCE_ABS;
}

// ---------------------------------------------------------------------------
// Copy (#179)
//
// TWO FLAGS BOTH READ `Variance` AND THEY ARE NOT THE SAME KIND OF FACT. One
// compares the total the vendor wrote against the sum of the items somebody typed
// in from the same page — a disagreement inside one document, which in practice
// means the typing missed something. The other compares an item against what the
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
     * An item against its order. Both call sites render the same string: the
     * invoice detail's items table and the order page's list of what an invoice
     * charges it for.
     */
    item: "⚠ Order variance",
    /**
     * One document's own arithmetic. Read as an instruction, and short enough to
     * sit beside `Paid 2026-07-27` in a list cell that has 176px — the constraint
     * this length was chosen against. **#309 took the date off that cell**, so the
     * word it shares 176px with is now just `Paid` and the constraint is looser than
     * the one this string satisfies. Kept as the record of why it is this short;
     * lengthening it is a measurement, not a rewording.
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
            "⚠ An item on this invoice differs from what its order agreed — " +
            "check it against the order, or take it up with the vendor, " +
            "before this invoice is paid.",
    }),
};
