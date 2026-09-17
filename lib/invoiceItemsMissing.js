// An invoice that holds no item rows (#330).
//
// THE FACT THIS MODULE OWNS, AND IT IS ONE FACT RATHER THAN A RULE. An invoice
// on this base has no `Invoice Items` behind it. That is what the detail screen
// says where the rows would be, and it is what `updateInvoiceAction` refuses on
// — two surfaces, one fact, so one sentence.
//
// IT IS DELIBERATELY NOT NAMED FOR THE RULE. "An invoice needs at least one
// item" is true at both write paths and they refuse on DIFFERENT facts:
// `createInvoiceAction` refuses because the SUBMISSION carries no rows, which
// its own `Add at least one item.` is the right word for on a form that can add
// one. This module is about a RECORD, on a screen that cannot add anything, and
// a name pointing at the shared rule would invite the next reader to fold the
// two back into one string for two facts.
//
// HOW AN INVOICE GETS HERE, which is why the sentence can say what it says.
// Nothing in this app can leave one standing: `Invoice Items` rows are
// destroyed in exactly two places, `createInvoiceAction`'s rollback and
// `deleteInvoiceAction`, and both take the invoice with them in the same block.
// `updateInvoiceAction` edits values and deletes nothing. So the rows went in
// Airtable, and an invoice in this state is a record missing its own contents
// rather than an invoice charging for nothing — which is the reading the screen
// has to prevent, because the totals ladder underneath an empty table prints a
// `Calculated Total` equal to the shipping fee.
//
// PURE, AND IT HAS TO STAY THAT WAY. The detail page is a Server Component and
// the action is credentialed, but this is also read by `offline/invoice-items-
// missing.mjs` under plain `node`, so it imports nothing at all.

/**
 * Does this invoice hold no item rows?
 *
 * TAKES THE INVOICE RECORD, NOT A COUNT, so the two call sites cannot read the
 * absence off two different things. `recordToInvoice` maps `Invoice Items` — the
 * reverse-link array — which both sides of a link carry with no propagation lag,
 * so the answer is already on any record either caller has loaded and costs no
 * Airtable operation at all.
 *
 * A record with no `invoiceItems` key at all reads as missing rather than
 * throwing: the mapper's own `|| []` means the key is always there in practice,
 * and an absent one is the same claim as an empty one.
 */
export function invoiceItemsMissing(invoice) {
    return (invoice?.invoiceItems?.length ?? 0) === 0;
}

/**
 * What both surfaces say, which is one string because it is one fact.
 *
 * ONE NOUN FOR ONE THING. The rows are `items` in both sentences and nowhere
 * `rows` or `lines` — `Invoice Items` is the table, so its row is an invoice
 * item (#303), and `line` names no row of any table since #280.
 *
 * NO `yet`. `lib/listFilters.js` bars that word from an empty state it is false
 * of, and this one is the sharpest case: `yet` promises the rows are coming, and
 * these are not — the app cannot produce this invoice and will not add to it.
 * The second sentence is what carries that, and it is the only thing a reader
 * can act on: every invoice is entered with at least one, so something outside
 * the app took them.
 *
 * SHORT, BECAUSE THIS SCREEN'S OTHER EMPTY STATES ARE. `No delivery has been
 * matched to this invoice yet.` is the neighbor two sections down, and a
 * paragraph where it puts one line would read as an error rather than a state.
 */
export const ITEMS_MISSING_COPY = {
    absent: "This invoice has no items. Every invoice is entered with at least one.",
};
