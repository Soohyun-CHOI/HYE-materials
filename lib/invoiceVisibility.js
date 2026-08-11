// Which invoices may this user see (#211) — the read side of the row-level gate,
// over the one rule that already decides it.
//
// NOT A NEW RULE. The judgement is `canViewPR` (lib/prVisibility.js), exactly as
// app/pos/[poId] uses it: a purchase order is visible when the request behind it
// is, and an invoice is visible when any order it bills is. So this module owns no
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
//   0  Invoices      — the caller has these, with their `Invoice Items` arrays
//   0  Invoice Items — the caller passes these; both callers need them anyway
//   1  Purchase Orders   (by record id, from the items' own `PO` links)
//   2  Purchase Requests (by record id, from those orders' `PR` links)
//
// TWO OPERATIONS FOR A PAGE OF ANY SIZE, and ZERO for a President or an Admin: the
// privileged answer is "every invoice" and needs no walk, so the reads are only
// paid for by the audience whose answer depends on them. Same shape as
// lib/materialHistory.js's per-row identifier gate (#19), which also runs
// `canViewPR` over whole levels rather than per row, and the opposite of the 1 + N
// this repo has been bitten by.
//
// AN INVOICE WITH NO RESOLVABLE ORDER IS REFUSED, not admitted. A line with no
// `PO` link (the hidden free-text option, #96) names no order, so it carries no
// visibility of its own; an invoice whose every line is like that is visible to
// the office alone. Refusing is the safe direction here in a way it is NOT inside
// canViewPR — there, refusing on missing data would stall a signing chain, which
// is why that function throws instead. Here the consequence of refusing is that
// an employee does not see a document, which is the pre-#211 state.
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
 * Its own function because three places ask — the list, the detail, and the
 * payment line — and because `canViewPR` clause 2 asks the same question one
 * level down. Kept here rather than in lib/prVisibility.js, which is pure and
 * must not grow a second export that reads like a route gate.
 */
export function seesEveryInvoice(user) {
    return user?.role === "President" || user?.isAdmin === true;
}

/**
 * The record ids of the invoices this user may see, as a Set.
 *
 * `invoices` are already-loaded invoice objects; `invoiceItems` are the loaded
 * `Invoice Items` of those invoices — the caller supplies them because both
 * callers hold them for their own reasons, which is what keeps this walk at two
 * operations. The same contract `canViewPR`, `getInvoiceDeliveryStatus` and
 * `getInvoiceReconciliation` all use: pass what you loaded, get a judgement.
 *
 * A Set rather than a filtered list, so the detail page can ask about one invoice
 * and the list can filter, through one implementation rather than two.
 */
export async function getVisibleInvoiceIds(user, invoices, invoiceItems) {
    const list = invoices || [];
    if (list.length === 0) return new Set();
    if (seesEveryInvoice(user)) return new Set(list.map((inv) => inv.id));

    const items = invoiceItems || [];
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    if (poRecordIds.length === 0) return new Set();

    const pos = await getPOsByRecordIds(poRecordIds);
    const prs = await getPRsByRecordIds(pos.map((po) => po.pr?.[0]).filter(Boolean));

    // A PR is visible or it is not; resolve that once per PR rather than once per
    // invoice line, since one order commonly carries several lines of one invoice.
    const prById = new Map(prs.map((pr) => [pr.id, pr]));
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

    // ANY line is enough. A multi-PO invoice is real (lib/airtable/invoices.js on
    // the join table), so an invoice can bill one order the viewer raised and one
    // they have never heard of. Admitting on any is what makes the gate useful to
    // the person who counted the material: they are looking for the line that is
    // theirs, and refusing the whole document because it also covers someone
    // else's order would hide the thing they can actually check. The document is
    // one the vendor sent about material on their job either way.
    const visible = new Set();
    for (const it of items) {
        const invoiceRecordId = it.invoice?.[0];
        if (!invoiceRecordId) continue;
        if (it.po?.[0] && visiblePOIds.has(it.po[0])) visible.add(invoiceRecordId);
    }
    return visible;
}
