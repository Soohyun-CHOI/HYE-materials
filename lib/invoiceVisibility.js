// Which invoices may this user see (#211) — the read side of the row-level gate,
// over the one rule that already decides it.
//
// NOT A NEW RULE. The judgment is `canViewPR` (lib/prVisibility.js), exactly as
// app/pos/[poId] uses it: a purchase order is visible when the request behind it
// is, and an invoice is visible when any order it charges is. So this module owns no
// predicate of its own — it owns the WALK that reaches the PR from an invoice, and
// nothing else. A second predicate here would be a second answer to one question,
// which is the duplication CLAUDE.md's "one rule, one implementation" exists to
// stop.
//
// THE WALK, AND WHY IT IS ONE HOP SHORTER THAN IT LOOKS. `Invoice Items` carries
// its own `PO` link, so reaching the order does not need the `PO Item` level at
// all, and the Invoice-PO Link join table is not read either — the two are
// equivalent by construction (app/invoices/new/actions.js writes both), and the
// items are what the callers already hold.
//
// AND THE WALK HANDS BACK WHAT IT READ (#314). It resolved the orders and the requests
// to reach `canViewPR` and then dropped them, so the invoice list — which needs a
// request's `Job` for its own column — would have had to walk the same two levels
// again. That is #216's finding on this file's neighbor, in the same shape: a function
// that reads something and does not hand it back forces the next caller to read it
// again. `resolveInvoiceScope` is the walk with its records returned;
// `getVisibleInvoiceIds` is the answer alone, for the three callers that want nothing
// else. One walk, one gate, two shapes.
//
//   0  Invoices      — the caller has these, with their `Invoice Items` arrays
//   0  Invoice Items — the caller passes these; both callers need them anyway
//   1  Purchase Orders   (by record id, from the items' own `PO` links)
//   2  Purchase Requests (by record id, from those orders' `PR` links)
//
// TWO OPERATIONS FOR A PAGE OF ANY SIZE. Same shape as lib/materialHistory.js's
// per-row identifier gate (#19), which also runs `canViewPR` over whole levels rather
// than per row, and the opposite of the 1 + N this repo has been bitten by.
//
// **AND ZERO FOR A PRESIDENT OR AN ADMIN ONLY WHERE THE ANSWER IS ALL THAT IS WANTED**
// (#314 narrowed this sentence, which used to state it of the walk itself). The
// privileged answer is "every invoice" and needs no `canViewPR` call, so
// `getVisibleInvoiceIds` returns it without reading anything. `resolveInvoiceScope`
// walks whoever is reading, because its caller wants the records rather than the
// verdict — and a caller that resolved them for one reader and not the other would be
// deriving a rendered fact from a walk one reader skips.
//
// AN INVOICE WITH NO RESOLVABLE ORDER IS REFUSED, not admitted, and #278 made that a
// FAIL-CLOSED DEFAULT rather than a described state. It read the hidden free-text
// option (#96) as its cause and said such an invoice was visible to the office
// alone — but `createInvoiceAction` has always required a `PO` per item, so no
// invoice the app writes has ever reached it, with or without that flag. The two
// that did were hand-entered and are gone with the seed. What is left is the
// direction: an order this walk cannot resolve admits nobody, which is safe here in
// a way it is NOT inside canViewPR — there, refusing on missing data would stall a
// signing chain, which is why that function throws instead. Here the consequence is
// that an employee does not see a document, which is the pre-#211 state.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any
// Client Component may import this. The rule it defers to is pure and pinned
// offline already (scripts/tests/offline/pr-visibility.mjs).

import { getPOsByRecordIds } from "./airtable/purchaseOrders";
import { getPRsByRecordIds } from "./airtable/purchaseRequests";
import { canViewPR } from "./prVisibility";

/**
 * True when this user reaches every invoice without a walk.
 *
 * ONE JOB SINCE #309, AND ITS NAME IS AGAIN THE WHOLE OF IT: skip the walk. Four
 * places ask — this module's own two, and `checkInvoicePairing`'s read and guard —
 * and every one
 * of them is about COST rather than about disclosure. **The invoice list stopped
 * asking in #314**: it needs the walk's records for its `Job` column whoever is
 * reading, so it takes `resolveInvoiceScope` and has no cost decision left to make.
 * `resolveInvoiceScope` asks in its place, twice, for the same thing the list gave
 * up — whether the verdict can be reached without `canViewPR`. It also decided whether the
 * payment line rendered, on three surfaces, so a function answering "reaches every
 * invoice" was also answering "may see what was paid". The office asked for payment
 * the other way and the two questions came apart. **Nothing about payment is behind
 * this any more, and a payment read put behind it is a failing check** — see
 * scripts/tests/offline/invoice-visibility.mjs.
 *
 * This comment said "three places ask — the list, the detail, and the payment line",
 * which was wrong twice: the sites were five rather than three, and the third named
 * was not a site at all but the second question the first two were carrying.
 *
 * Kept here rather than in lib/prVisibility.js, which is pure and must not grow a
 * second export that reads like a route gate, and because `canViewPR` clause 2 asks
 * the same question one level down.
 */
export function seesEveryInvoice(user) {
    return user?.role === "President" || user?.isAdmin === true;
}

/** Every invoice in `list`, as a Set of record ids — the privileged answer. */
function everyInvoice(list) {
    return new Set(list.map((inv) => inv.id));
}

/**
 * The record ids of the invoices this user may see, as a Set.
 *
 * `invoices` are already-loaded invoice objects; `invoiceItems` are the loaded
 * `Invoice Items` of those invoices — the caller supplies them because both
 * callers hold them for their own reasons, which is what keeps this walk at two
 * operations. The same contract `canViewPR`, `getInvoiceDeliveryStatus` and
 * `getInvoiceReconciliation` all use: pass what you loaded, get a judgment.
 *
 * A Set rather than a filtered list, so the detail page can ask about one invoice
 * and the list can filter, through one implementation rather than two.
 *
 * THE ANSWER ALONE, AND THAT IS WHAT THE SHORT-CIRCUIT IS FOR. A caller with no use
 * for the orders and requests behind it pays nothing when the answer is "every
 * invoice"; a caller that needs them calls `resolveInvoiceScope` and pays for the walk
 * whoever is reading. Both reach the gate through the same code below, so the two
 * shapes cannot come to disagree about who is admitted.
 */
export async function getVisibleInvoiceIds(user, invoices, invoiceItems) {
    const list = invoices || [];
    if (list.length === 0) return new Set();
    if (seesEveryInvoice(user)) return everyInvoice(list);
    return (await resolveInvoiceScope(user, list, invoiceItems)).visible;
}

/**
 * The walk, with the records it read (#314) — `{ visible, poById, prById }`.
 *
 * IT WALKS FOR EVERY READER, WHICH IS THE WHOLE DIFFERENCE FROM THE FUNCTION ABOVE.
 * The gate still short-circuits for a President or an Admin — `visible` is every
 * invoice and no `canViewPR` call is made — but the orders and requests are resolved
 * either way, because a caller asking for them needs them regardless of who is
 * reading. The invoice list is that caller: its `Job` column is one fact for every
 * reader (`lib/invoiceJob.js`), so resolving it from a walk one reader skips would be
 * a column whose value depends on who is looking at it.
 *
 * WHAT THAT COSTS IS PAID BY ONE SCREEN. `/invoices` goes from two walk operations for
 * a site reader and none for the office to two for both; the other three call sites
 * take `getVisibleInvoiceIds` and are unchanged. Measured in the pull request.
 *
 * `prById` IS KEYED BY REQUEST RECORD ID AND `poById` BY ORDER RECORD ID, so a caller
 * joins them the way this function does: an invoice item names an order, an order
 * names a request. Both are returned whole rather than projected — the mappers have no
 * field list, so narrowing here would only hide what a caller may read.
 */
export async function resolveInvoiceScope(user, invoices, invoiceItems) {
    const list = invoices || [];
    const empty = { visible: new Set(), poById: new Map(), prById: new Map() };
    if (list.length === 0) return empty;

    const items = invoiceItems || [];
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    // No order to walk to. A privileged reader still sees every invoice — the gate
    // does not depend on the walk — while everyone else is refused, which is the
    // fail-closed default described above.
    if (poRecordIds.length === 0) {
        return { ...empty, visible: seesEveryInvoice(user) ? everyInvoice(list) : new Set() };
    }

    const pos = await getPOsByRecordIds(poRecordIds);
    const prs = await getPRsByRecordIds(pos.map((po) => po.pr?.[0]).filter(Boolean));

    const poById = new Map(pos.map((po) => [po.id, po]));
    // A PR is visible or it is not; resolve that once per PR rather than once per
    // invoice item, since one order commonly carries several invoice items of one
    // invoice.
    const prById = new Map(prs.map((pr) => [pr.id, pr]));

    if (seesEveryInvoice(user)) return { visible: everyInvoice(list), poById, prById };

    const visiblePOIds = new Set(
        pos
            .filter((po) => {
                const pr = po.pr?.[0] ? prById.get(po.pr[0]) : null;
                // An order whose parent PR could not be resolved is refused rather
                // than admitted — the same direction app/pos/[poId] takes for a PO
                // with no parent PR.
                return pr ? canViewPR(user, pr) : false;
            })
            .map((po) => po.id)
    );

    // ANY invoice item is enough. A multi-PO invoice is real
    // (lib/airtable/invoices.js on the join table), so an invoice can charge one
    // order the viewer raised and one they have never heard of. Admitting on any
    // is what makes the gate useful to the person who counted the material: they
    // are looking for the invoice item that is theirs, and refusing the whole
    // document because it also covers someone else's order would hide the thing
    // they can actually check. The document is one the vendor sent about material
    // on their job either way.
    const visible = new Set();
    for (const it of items) {
        const invoiceRecordId = it.invoice?.[0];
        if (!invoiceRecordId) continue;
        if (it.po?.[0] && visiblePOIds.has(it.po[0])) visible.add(invoiceRecordId);
    }
    return { visible, poById, prById };
}
