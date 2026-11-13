// Delivered against invoiced against ordered (#166) — the judgment and its copy.
//
// Whether what a vendor invoiced for was delivered, and what was delivered with no
// invoice behind it. This module is the whole of that comparison: what the numbers mean,
// what to call each outcome, and how the vendor-chasing worklists are ordered. The
// invoice list, the invoice detail, the deliveries list and both strips above
// `/invoices` read it, so the rule is here once.
//
// INVOICES AND DELIVERIES MEET ONLY THROUGH THE ORDERED ITEM (#640). Neither document
// names the other: an invoice item names the ordered item it charges and a delivery item
// the ordered item it filled, so a `PO Items` row is the one place both carry a
// quantity, and what is compared there is CUMULATIVE — everything invoiced against it
// against everything delivered against it. That is the three-way match's shape, and it
// is what lets material shipped in two deliveries and invoiced once, or shipped once and
// invoiced on two invoices, reconcile at all. From #210 to #640 an invoice named ONE
// delivery (`Invoices."Delivery"`) and was compared with that delivery alone; the
// premise that held up is retired, and docs/notes/deliveries-and-invoices.md ("Invoices
// and deliveries meet through the ordered item") says what went with it.
//
// WHICH DOCUMENT A CUMULATIVE QUANTITY ANSWERS IS ONE RULE: OLDEST FIRST, IN ENTRY ORDER
// (`fillOldestFirst`). On one ordered item, what was delivered fills its invoice items in
// the order they were entered, and what was invoiced fills its delivery items the same
// way. An invoice whose every item is filled is `Matched`, one that is not is `Awaiting
// delivery`; a delivery the fill reached in full is `Invoiced`. Entry order is the child
// ID's own (`byEntryOrder`), so it costs no read and nobody can backdate it.
//
// ONE WORD PER FACT. `delivered`, never `arrived`: the table is `Deliveries` and
// the rollup is `Delivered Qty`, so a second name for the same fact would make a
// reader ask what the difference is. `ordered item`, never `line`: #303's rule
// gives each item table's row its own table's name. This said `a `Line` in this
// base is a child of a Job` until #321 — true when #166 wrote it, and false since
// #280 renamed that table to `Disciplines`. And nothing is `recorded as` anything — this app
// does not write `Recorded as paid` either. #162's ALLOCATION_COPY was swept in
// the same pass but NOT COMPLETELY, and this sentence claimed otherwise until
// #227: the sweep reached `overAttached` and `overFullyDelivered` — it is what
// took `recorded as` out of the second — and never reached `split`, which kept
// both `recorded as` and `lines` until #227 finished it.
//
// FACTS, NOT VERDICTS. At any one moment "the vendor over-billed" and "the rest
// has not been delivered yet" are the SAME measurement: invoiced exceeds
// delivered. The data cannot distinguish them and neither may the copy, so an invoice
// the deliveries have not caught up with reads `Awaiting delivery` and says how long it
// has waited. Deciding which it is belongs to a person, and correcting an excess
// belongs to #167.
//
// A THIRD AXIS SINCE #169: delivered against ORDERED, per purchase order. The
// two above compare a delivery to an invoice; this one compares it to the order that
// asked for it, which is the question site staff have and the one neither
// existing summarizer answers. Same question, different denominator, so what #169
// needed was a sibling rather than a caller. It shares one chip word with the invoice
// axis, `Awaiting delivery` — the predicate "nothing yet" on both — and keeps
// `Delivered` and `Partly delivered` to itself, where an order really is filled item
// by item over time; see STATUS_COPY.column.po.
//
// Pure apart from lib/poItemQty.js (itself dependency-free), so
// scripts/tests/offline/delivery-status.mjs can pin every clause. Note the
// explicit `.js`, for the reason lib/materialPriceView.js records: the offline
// tier runs under plain `node` with no module loader.

import { countsAsOrdered } from "./poItemQty.js";

// `countsTowardStatus` STOOD HERE AND IS GONE (#278). It answered whether an
// invoice item takes part in the comparison at all, and the only thing it ever
// excluded was a row with no `PO Item` — which #96 had hidden behind a flag and
// #278 removed outright, along with the second path that reached the same state
// with the flag untouched. Every invoice item names an ordered item now, so the
// predicate had one answer. A hand-emptied link is still survived and no longer
// described: the walks skip such a row so a page still renders, and no screen names
// it. `docs/notes/deliveries-and-invoices.md` carries why.
//
// `orderedItemStatus`, `invoiceShareStatus`, `invoiceVerdictKey` AND
// `describeInvoiceItem` STOOD HERE UNTIL #640. They compared one invoice with the one
// delivery it named and split the ordered item's delivered total into within-order and
// beyond-order halves for an aside; the fill replaces the first, and the detail's table
// states the ordered item's three totals outright in place of the second.

/**
 * Entry order, the one order `fillOldestFirst` pours in (#640).
 *
 * A child ID is its parent's ID, a separator and a sequence (lib/idSequence.js), and a
 * parent's is `HYE-{KIND}-{YYMMDD}-{NN}`, minted from the day it was entered and that
 * day's count (#164) — so comparing two `Invoice Item ID`s orders their invoices by entry
 * and then the items inside one invoice, and two `Delivery Item ID`s do the same for
 * deliveries. That is the order allocation already fills ordered items in (#162: "order
 * of entry decides, not order of delivery"), it costs no read of the parent, and nobody
 * can backdate it — which `Issue Date` and `Received Date` both allow.
 *
 * NUMERIC, so a day's hundredth document still sorts after its ninety-ninth. A row with
 * no ID — made by hand in Airtable — sorts LAST, the call `sortCandidates` makes for a
 * data gap in a first-in-first-out queue, and two such rows fall back to their record ids
 * so the order is total and the same on every screen.
 */
export function byEntryOrder(a, b) {
    const ka = a?.entryKey || "";
    const kb = b?.entryKey || "";
    if (ka !== kb) {
        if (!ka) return 1;
        if (!kb) return -1;
        return ka.localeCompare(kb, "en", { numeric: true });
    }
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
}

/**
 * One side's total on one ordered item, poured over the other side's rows oldest first
 * (#640) — the whole of how a cumulative comparison answers one document.
 *
 * `capacity` is one side's total on the ordered item: what was delivered, when the
 * entries are its invoice items; what was invoiced, when they are its delivery items.
 * Each entry `{ id, entryKey, qty }` takes what it can of what is left, in
 * `byEntryOrder`, so the first entered is the first answered and a later one waits
 * behind it. Returns a Map of entry id to the quantity that answered it — never more
 * than the entry's own `qty`, never negative.
 *
 * WHY A RULE AND NOT A STORED PAIR. #210 stored which delivery answered an invoice and
 * #231 computed it at entry, both on the premise that one invoice is answered by one
 * delivery. Material shipped in two deliveries and invoiced once broke that with nothing
 * wrong in the data, and there was no way to record it. The three-way match compares
 * totals instead, and a rule is all it needs to say which document a total reaches.
 *
 * #210 CALLED THIS FILL WRONG, AND THE OBJECTION DOES NOT CARRY OVER. #166 filled
 * invoices oldest-first with whatever was delivered, and #210 measured it putting a
 * delivery's quantity on an invoice that delivery was not "for" — wrong only if a
 * delivery is for one invoice, which is the premise this replaces. Cumulatively, the
 * older invoice is the one the material answers first; the order is entry rather than
 * `Issue Date`, which is what kept #166's version open to a backdated document.
 */
export function fillOldestFirst(capacity, entries) {
    let left = Math.max(0, Number(capacity) || 0);
    const filled = new Map();
    for (const entry of [...(entries || [])].filter(Boolean).sort(byEntryOrder)) {
        const qty = Math.max(0, Number(entry.qty) || 0);
        const take = Math.min(qty, left);
        filled.set(entry.id, take);
        left -= take;
    }
    return filled;
}

/**
 * Whether filling one ordered item needs every entry in order, and so whether a caller
 * holding only some of them must read the rest (#640).
 *
 * Only when the capacity covers some and not all of `total`, the entries' own sum (the
 * `Invoiced Qty` or `Delivered Qty` rollup): with nothing on the other side every entry
 * gets 0, and with at least the whole of it every entry gets all of its own, in any
 * order and from any subset. So this is answerable from the ordered item alone, before
 * any entry is read — #166 found the same boundary for its estimate ("inference is
 * needed in exactly one shape"), and it is what keeps the invoice detail from reading
 * the other invoices on an ordered item it does not need.
 */
export function fillNeedsOrder(capacity, total) {
    const c = Number(capacity) || 0;
    return c > 0 && c < (Number(total) || 0);
}

/**
 * An invoice's delivery status (#640): `matched` once every item is answered in full,
 * `awaiting-delivery` until then.
 *
 * `items` are `{ qty, filled }` — what an invoice item charges and what
 * `fillOldestFirst` gave it. ONE SHORT ITEM IS ENOUGH: it does not average out across
 * items, because the reader has to open the invoice either way. COUNTS ITEMS, NEVER
 * QUANTITIES, since an invoice's items carry different Units and their sum is a number
 * of nothing — the detail states each item's figures instead.
 *
 * AN INVOICE WITH NO ITEMS READS `awaiting-delivery`, not `matched`. "Everything it
 * charges has been delivered" is vacuously true of nothing, and the chip would then say
 * the one thing a reader should not be told about a document whose contents are missing
 * (#330). No invoice this app writes is in that state; a hand-emptied one is.
 *
 * `partly` is whether some item has been answered at all while the invoice is still
 * waiting — the strip's row word (`partly delivered`), read off the same summary so the
 * strip cannot say something the chip contradicts. `judged` and `covered` are the
 * counts.
 */
export function summarizeInvoiceStatus({ items } = {}) {
    const entries = (items || []).filter(Boolean);
    const judged = entries.length;
    const covered = entries.filter((i) => (i.filled || 0) >= (i.qty || 0)).length;
    const anyFilled = entries.some((i) => (i.filled || 0) > 0);
    return {
        key: judged > 0 && covered === judged ? "matched" : "awaiting-delivery",
        judged,
        covered,
        partly: covered < judged && anyFilled,
    };
}

/**
 * ONE ORDERED ITEM AGAINST ITS OWN ORDER (#169) — the level `summarizePODeliveryStatus`
 * folds.
 *
 * READS THE `Delivered Qty` ROLLUP, NOT `Delivery Items`: it asks one question — has
 * the ordered quantity been delivered — for which the sum is the whole answer, so it
 * costs one already-fetched field instead of a level of rows. #166's invoice detail read
 * the rows to split within-order from beyond-order delivery, which only a row's
 * `Over Delivered` can tell apart; since #640 nothing on the invoice side needs that
 * split, and the rollup serves both axes.
 *
 * THE ROLLUP IS SUFFICIENT BECAUSE OF WHERE AN OVER-DELIVERY ROW ATTACHES.
 * `lib/deliveryAllocation.js:planDelivery` fills each candidate to capacity
 * before moving on, so it only ever has a surplus once every candidate is full;
 * both of its branches therefore attach that row to an ordered item whose
 * delivered quantity has already reached its `Qty` (the last ordered item filled,
 * or — when nothing had room — the last ordered item in the same order). #167's
 * re-attachment preserves that on both sides: the original ordered item loses a
 * row it did not need to be full, and the overage ordered item's `Qty` is the
 * excess exactly (`lib/overage.server.js` creates it with `qty: row.qty`), so the
 * moved row leaves it exactly full. Verified in code rather than assumed.
 */
export function orderedItemDelivery({ orderedQty, deliveredQty, committedQty } = {}) {
    const ordered = orderedQty || 0;
    const delivered = deliveredQty || 0;

    return {
        ordered,
        delivered,
        // #18's judgment, read not re-derived: 0 when the PO was withdrawn, so a
        // withdrawn order's ordered items drop out without this module naming a
        // status string. An ordered item that counts always has ordered > 0,
        // because `Committed Qty` is `IF(withdrawn, 0, Qty)`.
        counts: countsAsOrdered({ committedQty }),
        complete: delivered >= ordered,
        anyDelivered: delivered > 0,
    };
}

/**
 * ONE PURCHASE ORDER'S DELIVERY STATE (#169), shared by /pos and /pos/[poId] so
 * the row a reader clicks and the page they land on cannot describe one order
 * differently — the same reason #162 shares `summarizeDelivery` between its own
 * two screens.
 *
 * THE SECOND CALLER DELIVERED IN #233, AND UNTIL THEN THIS SENTENCE WAS FALSE. #169
 * gave the detail page the `Delivered` column and not the chip, so the sharing it
 * describes existed on one screen; the claim was corrected by adding the call
 * rather than by narrowing the comment, because the property it states is the one
 * worth having. On the detail page the chip sits beside the `Deliveries` heading,
 * mirroring where the invoice detail puts its own.
 *
 * COUNTS ORDERED ITEMS, NOT QUANTITIES, AND THAT IS FORCED RATHER THAN CHOSEN —
 * the same constraint `summarizeInvoiceStatus` is under. A PO's items carry
 * different Units (EA, FT, SET…), so adding their quantities produces a number
 * of nothing. The count decides the chip and stays behind it.
 *
 * `anyDelivered` IS SEPARATE FROM THE COMPLETED COUNT, which is #166's lesson
 * paid forward rather than re-learned: keying `awaiting-delivery` on "no ordered
 * item is complete" made a one-item order of 13 with 10 delivered read as
 * nothing delivered. `awaiting-delivery` is reserved for no quantity having
 * delivered at all.
 *
 * `nothing-ordered` IS NAMED AFTER THE PREDICATE THAT PRODUCES IT, not after one
 * of the two shapes that reach it. `countsAsOrdered` is what empties the judged
 * set, and it does so for an order with no items at all AND for a withdrawn one,
 * whose every ordered item has `Committed Qty` 0. Calling it `no-ordered-items` — the
 * invoice axis's name for its own dash — would have been a key describing the
 * case that has never occurred on this base — an order holding no items at all —
 * while silently covering the one that has, a withdrawn order.
 * A withdrawn order has not lost its items; it was ordered and then called off,
 * and telling site staff `Awaiting delivery` for it would have them waiting on
 * material nobody will ship.
 */
export function summarizePODeliveryStatus(orderedItems) {
    const judged = (orderedItems || []).map(orderedItemDelivery).filter((item) => item.counts);
    const ordered = judged.length;
    const complete = judged.filter((item) => item.complete).length;
    const anyDelivered = judged.some((item) => item.anyDelivered);

    const key =
        ordered === 0
            ? "nothing-ordered"
            : complete === ordered
              ? "delivered"
              : !anyDelivered
                ? "awaiting-delivery"
                : "partly-delivered";

    return { key, ordered, complete, anyDelivered };
}

/**
 * ONE ORDERED ITEM AGAINST WHAT HAS BEEN INVOICED FOR IT (#235) — the invoicing
 * axis's `orderedItemDelivery`, and the level `summarizePOInvoicingStatus` folds.
 *
 * READS THE `Invoiced Qty` ROLLUP for the reason its twin reads `Delivered Qty`:
 * the question at this scope is whether the ordered quantity has been invoiced, for
 * which the sum is the whole answer, so it costs one already-fetched field rather
 * than a level of `Invoice Items`. What the rows carry that the rollup does not —
 * WHICH invoice, and at what price — is the per-item question, and the per-item
 * `Price variance` and `Quantity variance` marks (#623) are what carry it.
 *
 * INVOICED BEYOND THE ORDER COUNTS AS INVOICED, which mirrors the delivery axis
 * exactly: `orderedItemDelivery` asks only whether the quantity was reached, and the
 * excess is stated per ordered item by the `(over)` mark beside `Invoiced`. It is
 * also `hasUninvoicedQty`'s own reading — #57 defines an open ordered item as one
 * with a POSITIVE remainder, so an over-billed one is not open — and reusing that
 * reading here keeps one answer to "is there anything left to charge".
 *
 * A WITHDRAWN ORDER DROPS OUT THROUGH `countsAsOrdered`, the same field and the
 * same judgment as the delivery axis. Nothing is hidden by that: an order cannot
 * be withdrawn once anything charges it — `getPOWithdrawEligibility` refuses on
 * the order's `invoiceItems` — so "withdrawn and invoiced" is unreachable
 * through the app, and where hand-entered data reaches it the two axes at least
 * say the same thing.
 */
export function orderedItemInvoicing({ orderedQty, invoicedQty, committedQty } = {}) {
    const ordered = orderedQty || 0;
    const invoiced = invoicedQty || 0;

    return {
        ordered,
        invoiced,
        counts: countsAsOrdered({ committedQty }),
        complete: invoiced >= ordered,
        anyInvoiced: invoiced > 0,
    };
}

/**
 * ONE PURCHASE ORDER'S INVOICING STATE (#235), shared by /pos and /pos/[poId] for
 * the reason `summarizePODeliveryStatus` is: the row a reader clicks and the page
 * they land on cannot describe one order differently.
 *
 * THE PAIR OF THE DELIVERY SUMMARY, DELIBERATELY LINE FOR LINE. Same folding —
 * ordered items rather than quantities, because a PO's items carry different Units
 * and adding them produces a number of nothing. Same reserved middle: `anyInvoiced`
 * is separate from the completed count, so a one-item order of 13 with 10 invoiced
 * reads as partly invoiced rather than as nothing invoiced, which is #166's lesson paid
 * forward rather than re-learned. Same dash, from the same predicate, named after
 * it for the same reason.
 *
 * #210 REMOVED A MIDDLE STATE FROM THE INVOICE AXIS AND THAT DOES NOT REACH HERE.
 * `partly-delivered` went from `summarizeInvoiceStatus` because one invoice is
 * answered by one delivery — under that premise a shortfall is an error rather than
 * a stage. An ORDER has no such premise: it is invoiced by as many invoices as the
 * vendor sends, so a half-invoiced order is an ordinary middle. The delivery axis
 * already keeps `partly-delivered` at this scope for the same reason.
 */
export function summarizePOInvoicingStatus(orderedItems) {
    const judged = (orderedItems || []).map(orderedItemInvoicing).filter((item) => item.counts);
    const ordered = judged.length;
    const complete = judged.filter((item) => item.complete).length;
    const anyInvoiced = judged.some((item) => item.anyInvoiced);

    const key =
        ordered === 0
            ? "nothing-ordered"
            : complete === ordered
              ? "invoiced"
              : !anyInvoiced
                ? "awaiting-invoice"
                : "partly-invoiced";

    return { key, ordered, complete, anyInvoiced };
}

/**
 * ONE INVOICE, ON THE PAYMENT AXIS (#311) — the level `summarizePOPaymentStatus`
 * folds, and the reason the two facts it returns are returned TOGETHER.
 *
 * `today` IS A PARAMETER, WHICH IS `daysWaiting`'s SHAPE AND ITS REASON: the offline
 * tier pins every boundary without a clock. It is the server's day there as it is
 * here, with the same two properties that function documents — a reader in another
 * timezone can be one day off, and `Due Date` is calendar-only, so the answer moves
 * at midnight rather than at an hour.
 *
 * ONLY AN UNPAID INVOICE CAN BE LATE, which is not a convenience but what makes the
 * badge composable: an order whose every invoice is paid has nothing outstanding, so
 * `Paid` and `⚠ Overdue` cannot co-occur and the badge is a qualifier on the two
 * unpaid chips alone.
 *
 * THE DUE DAY ITSELF IS NOT YET LATE. Same direction as `lib/authTokenState.js`'s
 * `expiresAt < now`: the boundary instant belongs to the side that still has time. A
 * blank `Due Date` is NOT overdue — there is nothing to have passed — which is #263's
 * call on a null wait carried one field across, and it is reachable: `Due Date` is
 * optional on BOTH invoice write paths (neither form marks the input `required` and
 * neither action refuses a blank, unlike `Issue Date`, which both do), so an invoice
 * this axis cannot judge for lateness is an ordinary record rather than a hand edit.
 *
 * THE DAY COUNT AND THE VERDICT COME OUT OF ONE EXPRESSION (#316), which is the whole
 * of why this returns three fields rather than two. #316 puts the figure on the
 * invoice list and on the invoice's own page, and the tempting shape was to leave this
 * function alone and call `daysWaiting(dueDate, today)` beside it. Then `dueDate <
 * today` and `days >= 1` are two ways of saying one thing, agreeing everywhere until
 * they do not — a cell reading `⚠ Overdue · 0d` is what that looks like on a screen.
 * Deriving the verdict FROM the count makes them one answer by construction.
 *
 * `daysWaiting` IS THE ARITHMETIC BECAUSE IT ALREADY IS, not because the name fits.
 * It is this module's one whole-calendar-day subtraction between two dates, generalized
 * off the delivery axis in #256 when an invoice's own date became its third caller, and
 * a second implementation here would be the duplication CLAUDE.md's one-rule-one-
 * implementation section exists against. Its two properties travel with it unchanged —
 * the server's day, and an answer that moves at midnight rather than at an hour.
 *
 * THE CONTRACT MOVED WITH THE SHAPE, AND IT REACHES `/pos` (#316). `dueDate < today`
 * was a STRING comparison, so an unparseable `Due Date` was judged by lexical order;
 * `daysWaiting` returns null for one, and a null count is not late. That is the better
 * answer and it is not free — `summarizePOPaymentStatus` folds this function, so the
 * order list and the order detail take the new judgment too. No record on this base
 * carries an unparseable due date (23 invoices, 22 on `2026-09-30` and one on
 * `2026-08-21`), so nothing observable changes there; the shape is what changed.
 *
 * `daysOverdue` IS NULL WHERE THE BADGE DOES NOT STAND, never 0. A figure exists
 * exactly where there is something to state, so no copy branch can render `0d` and no
 * caller has to test the number as well as the verdict.
 *
 * IT TAKES TWO DATES SINCE #318, AND THE FIRST OF THEM USED TO BE A CHECKBOX. That
 * issue removed `Invoices."Paid"` — the flag and the date made four combinations of
 * which two had a meaning, and nothing refused a date on an invoice the flag called
 * unpaid — so a `Paid Date` IS the payment and `paid` is its presence. Every reader of
 * the old flag reaches the date through this: #309's sentence on the invoice's own
 * page, #311's column on the order list, #233's badge on the order detail.
 *
 * SO THE CONTRACT MOVED A SECOND TIME AND IT REACHES `/pos` AGAIN, exactly as the
 * paragraph above records for the due date. `summarizePOPaymentStatus` folds this, so
 * the order list and the order detail judge from the date now. Observable only on a
 * record where the two disagreed, and there is none: 23 invoices on this base, one
 * paid with both fields set and 22 with neither, counted before the change.
 *
 * `paid` IS STILL WHAT THIS RETURNS, and that is the point rather than a leftover. The
 * question every screen asks is whether the invoice is paid; the field it is answered
 * from is this function's business and nobody else's.
 */
export function invoicePayment({ paidDate, dueDate } = {}, today) {
    const isPaid = Boolean(paidDate);
    const days = daysWaiting(dueDate, today);
    const overdue = !isPaid && typeof days === "number" && days > 0;
    return { paid: isPaid, overdue, daysOverdue: overdue ? days : null };
}

/**
 * ONE PURCHASE ORDER'S PAYMENT STATE (#311), shared by /pos and /pos/[poId] for the
 * reason its two siblings above are: the row a reader clicks and the page they land
 * on cannot describe one order differently.
 *
 * `paid` IS NOT A FACT AN ORDER HOLDS, and that is the whole of what this function
 * has to get right. An order is charged by several invoices and an invoice charges
 * several orders, so what can be said is a statement about the DOCUMENTS: every
 * invoice charging this order is paid, or some are, or none is. What cannot be said
 * is that the order has been paid for, and #233's rule is where that lands as a
 * constraint the copy has to obey — see `lib/poDocuments.js`'s header on why no
 * entry may hold a document's own total. **So this axis carries no figure at all**:
 * a money figure beside the order's `Total` invites the addition that rule forbids,
 * and one invoice's amount is not this order's.
 *
 * THE EMPTY SET SAYS NOTHING RATHER THAN `Not paid`. "Every invoice is paid" is
 * vacuously true of no invoices and "none is paid" is vacuously true too, so an
 * order nothing has charged would read as whichever the arithmetic happened to
 * reach. It gets the dash, which asserts no debt — the same `absent` shape the two
 * siblings give a state they did not measure, and the key is named after the
 * predicate rather than the shape, as theirs are. A withdrawn order lands here
 * without a clause of its own: it cannot be invoiced
 * (`getPOWithdrawEligibility` refuses on invoices), so nothing charges it.
 *
 * TWO FACTS FROM ONE CALL, DELIBERATELY. Lateness could have been a second function,
 * and then a screen could ask for the chip and never ask for the badge — which is
 * this issue's own mutant one size down: two surfaces answering one question
 * differently because one of them asked half of it. `describePOPaymentColumn`
 * carries the pair into named slots for the same reason.
 *
 * NO COUNT AND NO DAY FIGURE. A count of invoices belongs to a set the row does not
 * show, and a day count belongs to ONE invoice while this badge is about a set — an
 * order with two late invoices would need a rule for which one's number to print,
 * and there is no reason to prefer either. Both are on the invoice's own page.
 * **AND THE SECOND HALF IS A FACT RATHER THAN A PLACEMENT SINCE #316**: the count is
 * on the two invoice screens now, from `invoicePayment`'s own `daysOverdue`, which
 * this summary reads past. It folds the verdict and drops the figure, which is the
 * one direction that stays honest — a set has no day count to carry.
 *
 * `invoices` are DISTINCT invoice records; both callers gather them through a `Set`
 * of record ids, which is the shape `/pos/[poId]` already had.
 */
export function summarizePOPaymentStatus(invoices, today) {
    const judged = (invoices || []).map((invoice) => invoicePayment(invoice, today));
    const charging = judged.length;
    const paid = judged.filter((invoice) => invoice.paid).length;

    const key =
        charging === 0
            ? "nothing-invoiced"
            : paid === charging
              ? "paid"
              : paid === 0
                ? "not-paid"
                : "partly-paid";

    return { key, charging, paid, overdue: judged.some((invoice) => invoice.overdue) };
}

/**
 * A delivery's invoicing status, per ordered item it filled.
 *
 * "INVOICED" MEANS THIS DELIVERY'S MATERIAL HAS BEEN INVOICED, ATTRIBUTED BY THE FILL
 * (#640). What was invoiced on an ordered item answers its deliveries oldest first, so a
 * delivery that came in after the invoices ran out reads as waiting for one — the
 * attribution #166 lacked, when the test was only whether the ordered item carried
 * invoice items at all and a later delivery dropped off the chasing worklist the moment
 * an earlier invoice touched the same ordered item. #210 to #640 attributed it through
 * `Invoices."Delivery"` instead; the fill needs no link and answers the case the link
 * could not, one delivery invoiced on several invoices or several on one.
 *
 * NOT A BARE LOOKUP, AND THAT IS THE POINT OF COMPARING QUANTITIES. A delivery can carry
 * material nobody has invoiced yet — two materials are delivered, one invoice covers the
 * first — so "has this delivery got an invoice" would read `Invoiced` while half of it
 * is still owed. The three keys therefore survive: the middle one is the state the
 * vendor-chasing worklist exists for.
 *
 * `delivered` is the delivery's OWN slices on that ordered item, within-order plus
 * beyond, because the vendor invoices what it shipped and the excess is part of what an
 * invoice answers. `invoiced` is how much of that the fill gave it — never more than
 * `delivered`, so `>=` below holds exactly when the fill reached all of it.
 *
 * `orderedItemsTouched` is one entry per distinct ordered item this delivery allocated
 * against: `{ poItemRecordId, delivered, invoiced }`.
 */
export function summarizeDeliveryInvoicing(orderedItemsTouched) {
    const entries = orderedItemsTouched || [];
    const total = entries.length;
    // An ordered item is settled when the fill reached everything this delivery
    // brought of it. `>=` rather than `===` so a caller handing a figure that is not
    // clamped still reads settled at "covered"; from the delivery's side there is
    // nothing left to chase.
    const invoiced = entries.filter((l) => (l.invoiced || 0) >= (l.delivered || 0)).length;
    // A LOCAL, NOT A RETURNED FIELD. `summarizeInvoiceStatus` used to hand back the
    // equivalent (`anyArrived`) and no screen ever read it; the key already carries
    // the distinction, so returning it as well would be one more thing #182 has to
    // find. The offline check asserts the key rather than this.
    const anyInvoiced = entries.some((l) => (l.invoiced || 0) > 0);

    // NO ENTRIES FALLS TO `awaiting-invoice` SINCE #278, AND THAT IS A CHOICE
    // BETWEEN TWO FALSE ANSWERS RATHER THAN A CORRECT ONE.
    //
    // `no-ordered-items` stood here and rendered an em dash, meaning "there was
    // nothing to compare". Every path that produced it is gone: the delivery form
    // refuses a delivery with no items, its edit page writes no `Delivery Items`
    // row at all, and allocation attaches every row it plans (#165). What is left
    // is a row whose `PO Item` link somebody emptied in Airtable — a state #165
    // MEASURED AT 0 ROWS on this base and which #278 decided the app survives
    // without describing: whoever can empty a link is the one person who can see
    // the base, so a screen explaining it has no reader.
    //
    // Something still has to come back, because `describeDeliveryColumn` indexes
    // this key with no fallback. Both candidates are wrong: `invoiced` would call
    // such a delivery settled and drop it out of the vendor-chasing worklist, and
    // `awaiting-invoice` claims nothing has invoiced it. The second is the one that
    // takes a reader TO the row rather than past it, which is the only ground for
    // preferring either, and `isNotFullyInvoiced` keeps it on the worklist where
    // somebody will open it. A dash would be a third state to explain on every
    // screen that renders this chip, for a row that has never existed.
    const key =
        invoiced === total && total > 0
            ? "invoiced"
            : !anyInvoiced
              ? "awaiting-invoice"
              : "partly-invoiced";

    return { key, total, invoiced };
}

/**
 * The vendor-chasing filter: material that is here and not fully invoiced for.
 *
 * BOTH INCOMPLETE STATES, not just the empty one. A delivery carrying two
 * materials where only one has been invoiced is exactly "it is here and there is no
 * invoice for it" — the thing the month-end email to every vendor stands in for —
 * and filtering on `awaiting-invoice` alone would drop it.
 */
export function isNotFullyInvoiced(key) {
    return key === "awaiting-invoice" || key === "partly-invoiced";
}

// `?unbilled=1` ITSELF IS GONE TOO (#216) — the filter this predicate served on
// /deliveries is now a strip above /invoices, where recording the invoice
// actually happens. The predicate did not move with it: it stays here and the
// strip calls it, which is why the paragraph below still describes a filter that
// no longer exists on that page.
//
// THE CALLER COUNTS HAVE MOVED APART SINCE, and this said both had exactly one
// each. `isNotFullyInvoiced` still does — #216's strip. `sortLongestWaitingFirst`
// has three: that strip, #217's uncorrected-excess strip, and #256's, which is
// the first to order by something other than a delivery's own date. Corrected per
// #181 by #256, which made the sentence one caller more wrong.
//
// A `resolveDeliveryFilters` rule stood here and is deliberately GONE (#211).
//
// It existed for one reason: the invoicing column was withheld from a viewer who
// may not see invoice data, so `?unbilled=1` had to be treated as ABSENT for them
// rather than ignored — a filter over a column that was never fetched would
// silently empty the list. #211 released that withholding, since the deliveries
// list is Job-scoped and every row on it is on a job whose invoices the viewer may
// now read, so there is no viewer for whom the filter has nothing to act on.
//
// What was left was `{ uninvoiced: Boolean(a), over: Boolean(b) }` — a named rule
// with no rule in it, and two callers that could no longer disagree because there
// was nothing left to agree about. An unreachable branch is removed here, not left
// standing with a comment: the same call this module made when it deleted
// `arrived-more` and `nothing-invoiced` rather than documenting them.

// ---------------------------------------------------------------------------
// Copy
//
// One object with paired variants, so a change to one cannot quietly leave the
// other describing something else — the arrangement ALLOCATION_COPY and
// WITHDRAW_COPY use.
//
// BUT THE AXIS IS DENSITY, NOT VOICE, AND THAT DEPARTURE IS DELIBERATE. Those two
// pair an ACTOR about to act (second person, future) against a VIEWER reading
// history (third person, past), because both concerns have someone doing
// something. This one does not: there is no action to take here and no actor to
// address — all three surfaces state a present fact to a reader. Forcing that
// axis would invent a voice with no speaker. What actually varies is room.
//
// AND ROOM IS NOT A MATTER OF DEGREE HERE, WHICH IS WHAT THE FIRST VERSION GOT
// WRONG. A list cell is one line, so `column` is a CHIP: a closed set of values a
// reader learns once and then recognizes, exactly like an Airtable single select.
// Sentences and fractions both break that — a fraction changes per row, and
// saying what it counts costs the words the cell does not have. The figures go to
// `detail`, which has room to lay them out. So the pairing is chip vs sentence,
// not short sentence vs long one.
//
// Every builder returns { key, text }; a chip adds `tone`, which is a semantic
// name rather than a color so the two lists cannot drift into different palettes.

const qtyUnit = (n, unit) => `${n}${unit ? " " + unit : ""}`;

// `INFERRED_PREMISE` STOOD HERE AND IS GONE (#219), and so is `MISMATCH_REASON` (#232).
// Each kept two sentences in step — a marker label and its detail-density twin — and
// lost its second reader when the marker went, so each became one sentence's own text.
// A constant exists to keep two things in step, and there was no longer a second thing.
// The sentences themselves left with #640: they spoke of the one delivery an invoice
// named, and nothing names one now.

export const STATUS_COPY = {
    /** One chip for a table cell. A closed set of values, per axis. */
    column: {
        /**
         * TWO VALUES (#640): `Matched` once everything the invoice charges has been
         * delivered, `Awaiting delivery` until then. No third.
         *
         * `Delivery variance` IS GONE, WORD AND KEY. It was the invoice against the ONE
         * delivery `Invoices."Delivery"` named, flagged when that delivery brought less;
         * with the comparison cumulative there is no single delivery to fall short of,
         * and less delivered than invoiced is material still to come — a wait, which
         * the second value is. More delivered than invoiced is no state of the INVOICE
         * at all: it is the delivery axis's `Partly invoiced` or `Awaiting invoice`.
         *
         * NOT `Partly delivered`, AND THE REASON CHANGED RATHER THAN FELL. #210 barred
         * that STAGE word here because under the one-delivery premise nothing further
         * was coming. That premise is retired, and a partial delivery is progress now;
         * what keeps the word off the chip is that the decision a reader makes from it
         * — has what we are being charged for arrived — has two answers, and how much
         * has arrived is the detail's table and the strip's row word. The PO axis keeps
         * `Partly delivered`, where an order's progress is the question.
         *
         * THE WAIT TRAVELS BESIDE THE SECOND VALUE, NEVER IN IT (`describeInvoiceWait`):
         * a chip carries no digit, so the set stays closed (#166).
         */
        invoice: {
            // `Matched` SINCE #623, AND THE PO AXIS KEEPS `Delivered`. This chip says
            // everything the invoice charges has been delivered against the ordered items
            // it charges — the three-way match's answer — where the order's says how much
            // of the order has been delivered. They shared the key and the word until
            // then; split, so a reader of either is told the fact it is.
            matched: () => ({ key: "matched", text: "Matched", tone: "complete" }),
            "awaiting-delivery": () => ({
                key: "awaiting-delivery",
                text: "Awaiting delivery",
                tone: "none",
            }),
        },
        delivery: {
            invoiced: () => ({ key: "invoiced", text: "Invoiced", tone: "complete" }),
            "partly-invoiced": () => ({
                key: "partly-invoiced",
                text: "Partly invoiced",
                tone: "partial",
            }),
            // The vendor-chasing worklist's own state, and the reason this feature
            // exists at all: the month-end email asking every vendor for missing
            // invoices is what currently stands in for it.
            "awaiting-invoice": () => ({
                key: "awaiting-invoice",
                text: "Awaiting invoice",
                tone: "none",
            }),
            // A `no-ordered-items` dash stood here and went with its key (#278) —
            // see `summarizeDeliveryInvoicing` for what replaced it and why the
            // replacement is the better of two wrong answers.
        },
        /**
         * THE ORDER'S OWN AXIS (#169) — how much of what was ordered has been delivered.
         *
         * TWO OF ITS WORDS ARE THE INVOICE AXIS'S, AND THE THIRD WAS UNTIL #623, which
         * gave the invoice's complete state `Matched`: there it answers whether the
         * invoice was matched to a delivery that covered it, and here how much of
         * the order has been delivered. `Awaiting delivery` is one word for one
         * predicate on both — nothing yet — and the denominator that differs (an
         * invoice there, an order here) is supplied by the row the reader is
         * looking at, never by the chip. A fourth vocabulary for the
         * same predicate would only make a reader ask what the difference is,
         * which is the argument #166 used when it swept `arrived` to `delivered`.
         * The two sets never appear on one screen.
         *
         * A SEPARATE OBJECT RATHER THAN A SHARED ONE, because the dash is not the
         * same fact on both. On the invoice axis it means every invoice item was free
         * text; here it means no ordered item counts as ordered — see
         * `summarizePODeliveryStatus` for why that key is named after the
         * predicate rather than after either shape that reaches it.
         */
        po: {
            delivered: () => ({ key: "delivered", text: "Delivered", tone: "complete" }),
            "partly-delivered": () => ({
                key: "partly-delivered",
                text: "Partly delivered",
                tone: "partial",
            }),
            "awaiting-delivery": () => ({
                key: "awaiting-delivery",
                text: "Awaiting delivery",
                tone: "none",
            }),
            "nothing-ordered": () => ({ key: "nothing-ordered", text: "—", tone: "absent" }),
        },
        /**
         * THE SAME FOUR SHAPES ON THE INVOICING AXIS (#235), and the tones are the
         * delivery axis's rather than new ones: a reader crossing between the two
         * chips on one row should not have to learn a second palette for the same
         * three states plus a dash. `complete` is the green that means nothing is
         * outstanding, `partial` the amber that means some of it is, `none` the gray
         * of a thing not yet begun.
         *
         * ONE STEM ACROSS THE SET, WHICH IS #166's OWN MOVE. That issue dropped
         * `arrival` for `delivery` because the table is `Deliveries`, and the same
         * test lands here: the table is `Invoices`, the rollup is `Invoiced Qty`, and
         * the third value was already `Awaiting invoice`. `Billed` / `Partly billed`
         * split the stem inside one closed set while the delivery axis reads
         * `Delivered` / `Partly delivered` / `Awaiting delivery` on one. The first
         * draft chose `Billed` on the ground that a chip states what the VENDOR did
         * while `Invoiced` is the figure this app computes; the distinction is real
         * and is not worth two stems in four words, and `Uninvoiced Items` and
         * `Invoiced Qty` already put this repository on the other side of it.
         * `partly`, never `partially`, because the delivery axis says
         * `Partly delivered`.
         *
         * THE SAME THREE WORDS THE DELIVERIES LIST USES, which is agreement rather
         * than collision: `STATUS_COPY.column.delivery` answers "has this delivery
         * been invoiced" and this answers it of an order. One question at two scopes,
         * so a reader meets one vocabulary — the property `summarizePODeliveryStatus`
         * already has with the invoice axis's own words.
         *
         * `Invoiced` IS ALSO A COLUMN HEAD ON `/pos/[poId]`, AND THAT COLLISION IS
         * THE DELIVERY AXIS'S TOO. That page has carried a `Delivered` column beside
         * a `Delivered` chip since #233 and the two have never read as one thing: a
         * chip is one of a closed set of three, a column head sits over a quantity.
         * Do not rename either to break a tie the shapes already break.
         */
        poInvoicing: {
            invoiced: () => ({ key: "invoiced", text: "Invoiced", tone: "complete" }),
            "partly-invoiced": () => ({
                key: "partly-invoiced",
                text: "Partly invoiced",
                tone: "partial",
            }),
            "awaiting-invoice": () => ({
                key: "awaiting-invoice",
                text: "Awaiting invoice",
                tone: "none",
            }),
            "nothing-ordered": () => ({ key: "nothing-ordered", text: "—", tone: "absent" }),
        },
        /**
         * THE THIRD AXIS (#311), AND THE ONE PLACE THIS SET BREAKS THE SHAPE OF THE
         * TWO ABOVE. Their third value is `Awaiting delivery` / `Awaiting invoice`,
         * so the parallel here would be `Awaiting payment` — and it is not taken,
         * because this app already had TWO words for an unpaid invoice before this
         * issue: `Unpaid` on the invoice list and `Not paid` on the order detail's
         * badge. A third would be a third name for one fact, and #311 is the issue
         * that owns this axis, so it converges them instead: `Unpaid` is gone and
         * `Not paid` is the word at all three places. Its two siblings each coined
         * the only word their axis had; this one is choosing among words that exist.
         *
         * `Not paid` RATHER THAN `Unpaid`, and the tie-break is `naming.md`'s
         * participle convention: a checkbox takes a participle, so `Paid` is the
         * fixed point and the negation is built by negating it rather than by
         * coining a second lexeme. It also cost one string against two.
         *
         * ONE STEM ACROSS THE SET, which is the rule the invoicing axis states above
         * and this satisfies without effort — `Paid` / `Partly paid` / `Not paid`.
         * `partly`, never `partially`, for the reason given there.
         *
         * THE SAME WORD AT TWO SCOPES, WHICH IS AGREEMENT RATHER THAN COLLISION.
         * `Not paid` is one invoice's state on `/pos/[poId]`'s badge and a set's
         * here — "none of them is paid" — and the row supplies which, exactly as
         * `Delivered` and `Invoiced` already do at two scopes each.
         */
        poPayment: {
            paid: () => ({ key: "paid", text: "Paid", tone: "complete" }),
            "partly-paid": () => ({ key: "partly-paid", text: "Partly paid", tone: "partial" }),
            "not-paid": () => ({ key: "not-paid", text: "Not paid", tone: "none" }),
            "nothing-invoiced": () => ({ key: "nothing-invoiced", text: "—", tone: "absent" }),
        },
        /**
         * THE BADGE THAT COMPOSES WITH THE TWO UNPAID CHIPS (#311), and a badge
         * rather than a fifth chip value because a closed set would have to throw
         * one of two true facts away. An order charged by one paid invoice and one
         * late one is `Partly paid` AND overdue; a single value has to pick, and
         * either pick loses something a reader came for. #166's rule is already
         * here for exactly this — a second fact composes with a chip instead of
         * enlarging its set.
         *
         * A WORD, NOT A `!`. #232 retired `QualifierMarker` from the invoice list
         * because a reader met the normal word first and had to hover for the one
         * that mattered, in a tooltip that reaches neither touch nor a keyboard.
         * That objection is to a marker whose meaning is only in its `title`, not to
         * composition, so this reads as text.
         *
         * NO TONE, BECAUSE IT IS NOT A CHIP. `TONE_CLASS` is the closed set's
         * palette and `StatusChip` refuses anything else; the two screens render
         * this in the same red span `⚠ Totals differ` already uses, which is the
         * shape that badge has at three sites. The `⚠` is this base's look-at-this
         * glyph and the pair of them are the only two.
         */
        poPaymentOverdue: { text: "⚠ Overdue" },
        /**
         * THE SAME BADGE ONE SCOPE DOWN, AND THE FIGURE IS WHAT THE SCOPE BUYS
         * (#316). `/invoices` is a list of invoices, so a row is ONE document — the
         * reason the badge above carries no day count (an order with two late
         * invoices has no rule for which number to print) does not reach a row that
         * has exactly one candidate. Nothing else about it moves: the same axis, the
         * same composition with an unpaid state, the same red span.
         *
         * IT OPENS WITH THE ORDER LIST'S WHOLE WORD, DELIBERATELY. A reader crossing
         * `/pos` and `/invoices` meets `⚠ Overdue` first at both, and the figure is
         * an addition after it rather than a second wording — so the badge cannot
         * become two names for one fact, which is what #311 spent an issue undoing on
         * this very axis when `Unpaid` met `Not paid`. `offline/screen-briefs.mjs`
         * pins the shared prefix and `offline/delivery-status.mjs` asserts the
         * `startsWith`, so a rewording of either has to move both.
         *
         * `· Nd` IS THIS APP'S DAY COUNT, from the three strips that already render
         * it — `/invoices`' two and `/pos`' one — where it sits after the date it
         * counts from. Here it sits after the verdict for want of a date in the cell;
         * the date is in the `Due Date` column on the same row, which is the fact
         * this badge is a reading of.
         *
         * NO TONE, for `poPaymentOverdue`'s reason: it is not a value of a closed set
         * and `StatusChip` must never be handed one.
         */
        invoiceOverdue: (days) => ({ key: "invoice-overdue", text: `⚠ Overdue · ${days}d` }),
    },

    /** The same facts as sentences, with their figures, for a detail section. */
    detail: {
        /**
         * THE BADGE AS A SENTENCE, FOR THE INVOICE'S OWN `Payment` SECTION (#316).
         *
         * A SENTENCE RATHER THAN THE BADGE REPEATED, which is this constant's whole
         * density axis: a list cell is a chip a reader learns once, a detail section
         * has room to say what the chip means. It carries the figure for the reason
         * the badge does — one screen, one invoice — and it says what the figure is
         * counted against, which the cell cannot afford to.
         *
         * IT NAMES ITS SUBJECT. `this invoice` costs two words on a page about one
         * invoice and buys the sentence a subject where it sits: the `Payment` section
         * holds a control and two other sentences, and a bare `10 days past its due
         * date` beside them reads as a fragment.
         *
         * SINGULAR AT ONE, because the first day past a due date is the ordinary
         * moment for a reader to meet this and `1 days` is the kind of thing that
         * makes a screen look unfinished. The count is never 0 — see `invoicePayment`,
         * which nulls the figure rather than reaching it.
         *
         * IT SAYS NOTHING ABOUT BEING UNPAID, and does not have to: only an unpaid
         * invoice can be late, so the fact is a premise of the sentence rather than a
         * second clause, and the section states the payment state on its own line
         * anyway.
         */
        invoiceOverdue: (days) => ({
            key: "invoice-overdue",
            text: `⚠ Overdue — this invoice is ${days === 1 ? "1 day" : `${days} days`} past its due date.`,
        }),
        /**
         * THE INVOICE DETAIL'S DELIVERY SECTION (#640): the deliveries that brought what
         * this invoice charges, then one row per item with the ordered item's three
         * totals and how much of this invoice they answer.
         *
         * `Deliveries` NAMES EVERY DELIVERY THAT FILLED ONE OF THESE ORDERED ITEMS, which
         * is the claim the data supports and no more: a delivery is not this invoice's,
         * it is the ordered item's, and the oldest-first fill decides how much of it
         * answers this invoice. The empty sentence says `yet` because it is honest here —
         * the material may still be coming or the delivery may still be unrecorded.
         *
         * THE TWO CUMULATIVE HEADS SAY `to date`, because each is every document's sum on
         * the ordered item and not this invoice's own figure — the scope confusion #232
         * found when `Billed` was the ordered item's total under a heading that read as
         * the invoice's. `This invoice` is the column that is this invoice's, and its cell
         * reads `150 of 200 EA delivered`: this invoice's quantity, and how much of it
         * the fill answered.
         *
         * WHAT WENT WITH #640: `deliveryVariance` (the amber sentence under a
         * `Delivery variance` chip), the two `verdict` sentences, and `againstOrder`.
         * Each compared this invoice with the one delivery `Invoices."Delivery"` named,
         * or stated a figure the table's columns now show outright — more invoiced or
         * delivered than ordered is `Ordered` beside the two totals, and an invoice
         * beyond its order also wears #623's `Quantity variance` in the items table.
         */
        deliveries: {
            label: "Deliveries",
            none: () => ({
                key: "no-deliveries",
                text: "No delivery has been recorded for this invoice's items yet.",
            }),
        },
        heads: {
            item: "Item",
            ordered: "Ordered",
            delivered: "Delivered to date",
            invoiced: "Invoiced to date",
            thisInvoice: "This invoice",
        },
        /**
         * `tone` IS `waiting` WHILE THIS INVOICE'S QUANTITY IS NOT ALL ANSWERED, and the
         * page colors that row's item and this cell; a row answered in full carries no
         * tone, being the ordinary row. Not `exception`, the word a row had while a
         * shortfall against the matched delivery was an error: under the three-way match
         * a shortfall is material still to come, which is what the chip says too. Which
         * amber stays a rendering decision and stays in the page.
         *
         * Takes the row's figures as one object — `lib/invoiceDeliveryEntries.js`'s
         * `foldedEntryFigures` is the producer — so a field renamed there reaches here
         * rather than reading `undefined`.
         */
        filled: ({ filled, qty } = {}, unit) => {
            const done = (filled || 0) >= (qty || 0);
            return {
                key: done ? "filled" : "waiting",
                ...(done ? {} : { tone: "waiting" }),
                text: `${filled || 0} of ${qtyUnit(qty || 0, unit)} delivered`,
            };
        },
    },
};

/** The chip for one invoice summary. */
export function describeInvoiceColumn(summary) {
    return STATUS_COPY.column.invoice[summary.key](summary);
}

/** The chip for one delivery summary. */
export function describeDeliveryColumn(summary) {
    return STATUS_COPY.column.delivery[summary.key](summary);
}

/** The chip for one purchase order's delivery state (#169). */
export function describePOColumn(summary) {
    return STATUS_COPY.column.po[summary.key](summary);
}

/** The chip for one purchase order's invoicing state (#235). */
export function describePOInvoicingColumn(summary) {
    return STATUS_COPY.column.poInvoicing[summary.key](summary);
}

/**
 * One purchase order's payment state (#311), as NAMED SLOTS rather than one value.
 *
 * Its two siblings return a chip, because their axis has one fact. This one has two
 * — the state of the invoices and whether any still-unpaid one is late — and they
 * are handed over together so a call site cannot render the first and drop the
 * second. That is `describeInvoiceLine`'s shape and its reason, one axis along:
 * putting both in a list would leave the caller deciding which to show.
 *
 * `overdue` is null on a chip it cannot compose with, so a screen renders the slot
 * it is given rather than re-deciding when the badge applies.
 */
export function describePOPaymentColumn(summary) {
    return {
        chip: STATUS_COPY.column.poPayment[summary.key](summary),
        overdue: summary.overdue ? STATUS_COPY.column.poPaymentOverdue : null,
    };
}

/**
 * One invoice's lateness, at both densities, from one call (#316).
 *
 * TWO SLOTS FOR TWO SCREENS, WHICH INVERTS `describePOPaymentColumn`'s REASON WHILE
 * KEEPING ITS SHAPE. That one hands over a pair so a call site cannot render the chip
 * and drop the badge; here each screen renders exactly one slot and ignores the other.
 * What the pair buys is the CONDITION: `overdue ? … : null` is written once, so
 * neither the list nor the invoice's own page can decide for itself when the mark
 * applies. Two describers with a `? :` each would be that decision written twice, and
 * the two are one boundary apart — which is the divergence this issue exists to
 * prevent, one scope below the one #311 prevented.
 *
 * IT TAKES THE JUDGMENT, NOT THE INVOICE, so there is nothing here to derive from.
 * `invoicePayment` has already read `Paid` and `Due Date` against the server's day;
 * this reads its two fields and picks words. A screen that passed a record instead
 * would be asking this function to judge, and then the judgment would have two homes.
 */
export function describeInvoiceOverdue(payment) {
    if (!payment?.overdue) return { badge: null, sentence: null };
    return {
        badge: STATUS_COPY.column.invoiceOverdue(payment.daysOverdue),
        sentence: STATUS_COPY.detail.invoiceOverdue(payment.daysOverdue),
    };
}

/**
 * The two words one invoice's payment reads as, and the closed set `/invoices`
 * filters by (#324).
 *
 * READ OFF THE CHIP SET RATHER THAN WRITTEN AGAIN, and #311 is why that matters. That
 * issue converged three surfaces onto `Not paid` after the app had spent two words on
 * one fact — `Unpaid` on the invoice list, `Not paid` on the order detail's badge —
 * and the invoice list's own cell then spelled the pair inline, in JSX, where no check
 * could see it. Deriving is what makes a fourth divergence impossible rather than
 * merely unlikely: a rewording of the chip carries here in the same edit.
 *
 * AN INVOICE'S PAYMENT HAS NO MIDDLE, WHICH IS WHY ONLY TWO OF THE FOUR ARE HERE. The
 * chip set has `Partly paid` and a dash because an ORDER's payment aggregates the
 * invoices charging it; an invoice holds `Paid Date` itself, so it is binary. That is
 * also what makes this axis a filter on `/invoices` and a strip's subject on `/pos` —
 * `lib/listFilters.js` states the rule.
 */
export const INVOICE_PAYMENT_WORDS = {
    paid: STATUS_COPY.column.poPayment.paid().text,
    notPaid: STATUS_COPY.column.poPayment["not-paid"]().text,
};

/** Which of the two an invoice wears, from the judgment `invoicePayment` already made. */
export function invoicePaymentWord(payment) {
    return payment?.paid ? INVOICE_PAYMENT_WORDS.paid : INVOICE_PAYMENT_WORDS.notPaid;
}

/**
 * How long an invoice the deliveries have not caught up with has waited, beside its chip
 * (#640): `12d`, or nothing.
 *
 * COUNTED FROM `Issue Date`, BY `daysWaiting`, so the list row, the detail and the
 * strip above the list print one figure for one invoice — the strip has always counted
 * from that date (#256), and an invoice's age is its document's in practice. NOTHING
 * ONCE IT IS `Matched`: the figure answers "how long has this been waiting", and a
 * matched invoice is not. Nothing either for an undated invoice or one dated in the
 * future, which has no wait to state — the same refusal `hasWaitedLongEnough` makes of
 * a null wait.
 *
 * `Nd` IS THIS APP'S DAY COUNT, from the strips that already render it and the overdue
 * badge (`⚠ Overdue · 3d`). NOT A CHIP VALUE: the chip is a closed set and carries no
 * digit (#166), so the count travels beside it, in no tone of its own. Standing out once
 * the wait passes `AWAITING_DELIVERY_DAYS` is the strip's job and stays there.
 */
export function describeInvoiceWait(summary, issueDate, today) {
    if (summary?.key !== "awaiting-delivery") return null;
    const days = daysWaiting(issueDate, today);
    if (typeof days !== "number" || Number.isNaN(days) || days < 0) return null;
    return { key: "invoice-wait", days, text: `${days}d` };
}

/**
 * One row of the invoice detail's delivery table (#640), as the words each cell prints.
 *
 * `entry` is `{ qty, filled, ordered, delivered, invoiced, unit }`: what this invoice
 * charges and how much of it the oldest-first fill answered, then the ordered item's
 * three totals — summed over every ordered item a folded row stands for, which
 * lib/invoiceDeliveryEntries.js does. The three totals print as quantities; the last
 * cell is `STATUS_COPY.detail.filled`, which also carries the tone the page colors.
 */
export function describeInvoiceItemFill(entry) {
    const unit = entry?.unit || "";
    return {
        ordered: qtyUnit(entry?.ordered || 0, unit),
        delivered: qtyUnit(entry?.delivered || 0, unit),
        invoiced: qtyUnit(entry?.invoiced || 0, unit),
        thisInvoice: STATUS_COPY.detail.filled(entry, unit),
    };
}

// ---------------------------------------------------------------------------
// Ordering

/**
 * The vendor-chasing worklist: longest-waiting delivery first.
 *
 * `Received Date` ASCENDING, because the question is how long the material has
 * been sitting here uninvoiced, and that starts when it was delivered — not when
 * someone typed it in. It is the semantically right field and it is human-entered
 * and backdatable, which #164 learned the hard way when an ID counter read one.
 * The consequence here is milder than a duplicate ID — a mistyped date sits at
 * the top of a worklist rather than corrupting a record — but it is the same
 * property, so it is written down rather than discovered again.
 *
 * `Created At` DESCENDING as the tie-break, matching the default list's tie-break
 * direction exactly. Only the primary key flips between the two orderings;
 * keeping the secondary one identical means the tie-break is for stability alone
 * and carries no meaning of its own that could disagree between the two views.
 *
 * Does not mutate its input.
 */
/**
 * How long a delivery has been waiting, in whole days (#216).
 *
 * `today` is a parameter rather than read here, so the offline tier pins every
 * boundary without a clock — the same shape lib/airtableOps.js gives `now` on its
 * record builders.
 *
 * TWO PROPERTIES WORTH KNOWING BEFORE TRUSTING THE NUMBER, neither of them a
 * defect to fix:
 *
 *   1. IT IS THE SERVER'S DAY, NOT THE READER'S. This renders in a Server
 *      Component, so `today` is whatever the server thinks the date is. A reader
 *      in another timezone can see a count one off from their own calendar.
 *   2. BOTH DATES IT IS EVER GIVEN ARE CALENDAR-ONLY — `Deliveries."Received
 *      Date"` and, since #256, `Invoices."Issue Date"`. There is no instant to
 *      subtract, so the arithmetic is between two dates and the answer moves at
 *      midnight rather than at the hour the thing it counts from happened.
 *
 * Both are why the row shows the DATE beside the count rather than the count
 * alone: the date is the fact, and the count is the reading of it that makes a
 * worklist scannable. A reader who doubts the number can check it.
 *
 * A missing or unparseable date returns null — the row still renders, and
 * sortLongestWaitingFirst already puts such a delivery last rather than first.
 */
export function daysWaiting(receivedDate, today) {
    if (!receivedDate || !today) return null;
    const from = Date.parse(`${receivedDate}T00:00:00Z`);
    const to = Date.parse(`${today}T00:00:00Z`);
    if (Number.isNaN(from) || Number.isNaN(to)) return null;
    return Math.round((to - from) / 86400000);
}

/**
 * How long an invoice waits before #256's strip will list it, and THE ONE PLACE
 * THE NUMBER LIVES (#263).
 *
 * WHY THERE IS A THRESHOLD AT ALL, and why only on this axis. The vendor emails the
 * invoice at shipment, so an invoice with no delivery matched to it is what an
 * ordinary Tuesday looks like — the strip gathered every one of them and was the
 * list below it with a different heading. The opposite strip does not have the
 * problem in the same degree: material standing uninvoiced reads as waiting from the
 * first day, so `AWAITING_INVOICE_COPY` carries no threshold and must not grow one.
 *
 * CALENDAR DAYS, AND 7 IS WHAT MAKES THAT HONEST. `daysWaiting` counts calendar days
 * — it subtracts two dates and sees neither weekends nor holidays — and the office's
 * intuition for this is five working days. Any seven consecutive days contain exactly
 * five weekdays, so a 7-day calendar threshold DELIVERS the five-working-day
 * intuition without claiming to be a working-day count. Three reasons that is the
 * right trade rather than a convenient one:
 *
 *   1. What is being waited for is not on this office's calendar. Material in transit
 *      does not stop moving on Saturday; only recording it is office work.
 *   2. A working-day count with no holiday calendar is not one, and this repository
 *      has no holiday table. Calling weekend-skipping arithmetic `business days` on a
 *      screen would be a claim the code cannot keep — the same test docs/notes/naming.md
 *      applies to a name that contradicts its contents.
 *   3. A row already renders `· 20d` from `daysWaiting`. A threshold on a different
 *      clock would filter on one number while showing another, and a reader could not
 *      tell why a `7d` row was absent while a `9d` row was there.
 *
 * WHAT IS ACCEPTED RATHER THAN SOLVED: holidays inside the window still shorten the
 * working days it contains. What is FIXED by choosing 7 over 5 is the wobble — at 5
 * the working days inside the window ranged from three to five depending on the day
 * the invoice was issued.
 *
 * A CONSTANT, NOT AN ENVIRONMENT VARIABLE AND NOT A ROW ON THE BASE. `TOKEN_TTL_MINUTES`
 * is the precedent and the reasoning is the same one step on: the number has to be
 * readable by every reader that states it, including the offline tier, and this module
 * is offline-safe. Every `process.env` use under `lib/` is a secret or an
 * infrastructure toggle — no business rule is tuned that way here — and a row on the
 * base would put the rule in the tier no file-only check can see while adding a read
 * to a page whose budget #263 must not grow.
 *
 * HOW IT CHANGES, written down because that is what this issue settled rather than
 * the number. The real figure cannot be known until the office has used the app, and
 * the person who will then change it is the person editing this file — there is no
 * admin settings screen and nothing is deployed. So the change is this line plus the
 * expected value in `offline/awaiting-delivery.mjs`, and the check is what makes the
 * edit safe: it pins the sentence against this constant, so a number changed here
 * cannot leave the strip claiming the old one. **7 is a placeholder with an argument,
 * not a measurement.** If it ever has to change without a deploy, that is the moment
 * to move it, and it moves from one place.
 */
export const AWAITING_DELIVERY_DAYS = 7;

/**
 * Has this invoice waited long enough to be a worklist row (#263)?
 *
 * BESIDE `daysWaiting` RATHER THAN INSIDE IT, because three strips read that function
 * — #216's, #217's and #256's — and only one of them has a threshold. Folding the
 * judgment in would move the figure the other two display.
 *
 * A NULL WAIT IS REFUSED, AND THAT IS `sortLongestWaitingFirst`'s CALL EXTENDED
 * rather than a new one. That comparator already refuses to let an undated row claim
 * the longest wait, on the ground that a data gap must not take the top of a
 * worklist; this says a data gap does not earn a place in the worklist either. The
 * strip's claim is "this has waited long enough", and an invoice with no `Issue Date`
 * has not been shown to have waited at all — admitting it while sorting it last would
 * be two judgments about one row.
 *
 * The cost is real and small: such an invoice appears in no worklist. It is not
 * invisible — it sits in the table below with its `Awaiting delivery` chip and an em
 * dash where its date would be — and a row with no date is a DATA problem rather than
 * a waiting problem, which is fixed by filling the date in. Reachable only by a hand
 * edit in any case: `createInvoiceAction` and `updateInvoiceAction` both refuse a
 * blank `Issue Date`, so this is the category `lib/deliveryStatus.server.js` already
 * decided to survive rather than describe.
 */
export function hasWaitedLongEnough(days) {
    if (typeof days !== "number" || Number.isNaN(days)) return false;
    return days >= AWAITING_DELIVERY_DAYS;
}

/**
 * What the strip above the invoice list says (#216).
 *
 * ONE VOICE, AND THAT IS THE DIFFERENCE FROM #176. That strip carried two,
 * because it offered an action only an Admin could take and a strip that offers
 * an action to someone who cannot take it reads as their fault. This one offers
 * no action at all — `/invoices` already has a `New invoice` button at the top of
 * the same screen, and a second control going to the same place would be one fact
 * rendered twice, which is the reason #166 took the `beyond order` tag off this
 * very page. With nothing to act on there is nothing for a voice to split over.
 *
 * NEITHER LINE NAMES A CONTROL, deliberately. The button at the top is Admin-only
 * and this strip is not, so copy pointing at it would be describing something
 * half its readers cannot see.
 */
export const AWAITING_INVOICE_COPY = {
    heading: (n) =>
        n === 1
            ? "1 delivery is waiting for an invoice"
            : `${n} deliveries are waiting for an invoice`,
    explain: "Longest wait first. No invoice yet covers what these deliveries brought.",
};

/**
 * Longest wait first, for any worklist of documents.
 *
 * `waitingSince` RATHER THAN `receivedDate`, AND THE RENAME IS #256's (was
 * `receivedDate` through #216 and #217). Three callers order by this rule and the
 * third counts from an invoice's `Issue Date`, so a property named after the
 * delivery field would have been false at one of the three. Each call site now
 * states which date it is claiming — `waitingSince: d.receivedDate` on the two
 * delivery-derived strips, `waitingSince: inv.issueDate` on the invoice one — which
 * is more legible than the implicit shared field it replaces.
 *
 * AN ACCESSOR PARAMETER WAS THE ALTERNATIVE AND IS WORSE, for a reason outside this
 * function. `offline/delivery-status.mjs` pins that no `.sort()` in THIS MODULE
 * mentions `issueDate`, because #219 moved the one ordering of invoices by that field
 * into `lib/overage.js` and made it private. Passing `(r) => r.issueDate` in from a
 * page passes that check only because the call site sits elsewhere; move row-building
 * into this module later and it trips #219's guard. A neutral property never can.
 * The two orderings stay apart on the question they answer — which invoice carries an
 * excess, against which invoices to read first — and this one adds no comparator.
 *
 * TIES BREAK ON `createdKey` DESCENDING, which is `createdAt` generalized the same
 * way and for the same reason (#256, second pass). It is whatever a caller holds that
 * rises as records are created — a timestamp on the two delivery-derived strips, and
 * the `Invoice ID` on the invoice one, because `Invoices` HAS NO CREATION TIMESTAMP
 * AT ALL: no field on the table, and none on the mapper. Named for what it orders by
 * rather than for its type, since the two callers pass different kinds of value and
 * `createdAt` was a claim only one of them could honor — under that name the invoice
 * side read `undefined` and the tie-break was silently inert on the whole axis.
 *
 * THE `Invoice ID` SUBSTITUTION IS EXACT RATHER THAN APPROXIMATE, and #164 is why.
 * The date half of a generated id comes from `new Date()` at mint time
 * (`lib/idSequence.server.js`), never from a date field — that issue found Invoice ID counting
 * `{Issue Date}`, the vendor's own human-entered date, and fixed it. So descending by
 * `Invoice ID` says the same thing descending by `createdAt` says on the other side:
 * most recently entered first, with the within-day sequence breaking a same-day tie.
 */
export function sortLongestWaitingFirst(rows) {
    return [...(rows || [])].sort((a, b) => {
        const ra = a.waitingSince || "";
        const rb = b.waitingSince || "";
        if (ra !== rb) {
            // An undated row sorts LAST rather than first: it cannot claim to have
            // waited longest, and a data gap must not take the top of a worklist —
            // the same call lib/deliveryAllocation.js:sortCandidates makes for the
            // head of its FIFO queue.
            if (!ra) return 1;
            if (!rb) return -1;
            return ra.localeCompare(rb);
        }
        return (b.createdKey || "").localeCompare(a.createdKey || "");
    });
}

/**
 * The two states a waiting invoice can be in on the strip (#256, re-cut by #640).
 *
 * WHAT IS SAID IS HOW MUCH HAS BEEN DELIVERED FOR IT, AND IT IS EXACT NOW. Until #640 the
 * kinds were `nothing delivered yet` and `delivered, not matched`, and the second was
 * read off a flag that meant "some slice was allocated against some ordered item this
 * invoice charges, by any delivery, possibly for another invoice" — imprecise in a way
 * #263 measured on a pair of invoices where it was false about one of them. With the
 * pairing gone the question it stood in for is answered outright: the oldest-first fill
 * says how much of THIS invoice has been answered, so `partly delivered` is a fact about
 * this invoice and nothing else, and it costs no read the chip did not already make.
 */
export const AWAITING_DELIVERY_KIND = {
    /** Nothing has been delivered for any item this invoice charges. */
    noDeliveryRecorded: "no-delivery-recorded",
    /** Some of it has, and not all. */
    partlyDelivered: "partly-delivered",
};

/**
 * What the second strip above the invoice list says (#256).
 *
 * SHAPED ON `AWAITING_INVOICE_COPY` DELIBERATELY, and kept beside it for the reason
 * #235 kept the two order-scope summaries together: the two strips sit on one screen
 * and a reader crossing between them should meet one grammar. Same first sentence,
 * same counted heading, same silence when there is nothing.
 *
 * NEITHER LINE NAMES A CONTROL, AND THE REASON IS SHARPER HERE THAN AT #216. There
 * the barred control was `New invoice`, Admin-only on a strip that is not. What a
 * reader would act on here is recording a delivery, which is Job-scoped site work,
 * so copy pointing at it would name an action the office staff most likely to be
 * reading this page cannot take at all.
 *
 * IT DOES NOT SAY `do not pay`, for the same rule one step further: an instruction
 * about paying would be addressed to a subset of its readers. The fact is stated
 * instead — not everything these invoices charge for has been delivered.
 *
 * `yet` IS HONEST IN THE FIRST ROW WORD: material may still be coming or the delivery
 * may still be unrecorded, and the word covers both without choosing. Since #640 that
 * is true of the second word's remainder as well, which is why `partly delivered` is a
 * stage and not an error — what is missing is still on its way as far as anything here
 * can tell.
 *
 * THE THRESHOLD SENTENCE TAKES ITS NUMBER FROM THE CONSTANT AND NEVER SPELLS IT
 * (#263), which is `CONFIRM_COPY`'s shape with `TOKEN_TTL_MINUTES` and for the reason
 * that docstring gives: a number written twice can be changed once, and then the
 * filter is exact while the screen claims something else. `offline/awaiting-delivery.mjs`
 * asserts on the SOURCE that this is a template reading the constant, because a literal
 * that happens to equal it today passes every runtime comparison.
 *
 * THE SECOND SENTENCE CHANGED WITH #640 AND THE OTHER TWO DID NOT. It said nothing had
 * confirmed the material, which was the pairing's claim — an empty link — and is false
 * of an invoice part of whose material has been delivered. The grammar #216 set is
 * kept: the first sentence is the shared one, and the threshold is the third.
 */
export const AWAITING_DELIVERY_COPY = {
    heading: (n) =>
        n === 1
            ? "1 invoice is waiting on a delivery"
            : `${n} invoices are waiting on a delivery`,
    explain:
        "Longest wait first. Not everything these invoices charge for has been delivered. " +
        `Only invoices that have waited ${AWAITING_DELIVERY_DAYS} days or more are listed.`,
    kind: {
        [AWAITING_DELIVERY_KIND.noDeliveryRecorded]: "nothing delivered yet",
        [AWAITING_DELIVERY_KIND.partlyDelivered]: "partly delivered",
    },
};

/**
 * The invoices waiting on a delivery, longest first (#256), and only once they have
 * waited `AWAITING_DELIVERY_DAYS` (#263).
 *
 * SELECTION IS THE CHIP'S OWN KEY, not a second reading of the same facts, so the strip
 * and the list column cannot drift apart — the mistake #176 made by writing
 * `selectPRsAwaitingPO` fresh when a predicate already existed, which #216 recorded and
 * this follows. #263 makes the strip a SUBSET of that key: every row here carries the
 * chip, and not every chip earns a row. The row's kind comes off the same summary
 * (`partly`), so nothing re-derives either.
 *
 * AN INVOICE THAT CHARGES NO ORDERED ITEM IS EXCLUDED, a fail-closed guard rather than
 * a case since #278: no invoice this app writes has no item, and a hand-emptied one
 * cannot say either of the two row words, so it does not belong in a worklist.
 *
 * SO THE ROW COUNT AND THE NUMBER OF `Awaiting delivery` CHIPS IN THE TABLE BELOW CAN
 * DIFFER, AND THAT IS NOT A DEFECT: an invoice that has not yet waited
 * `AWAITING_DELIVERY_DAYS` wears the chip and earns no row, which is the whole point of
 * the threshold.
 *
 * THE WAIT IS COUNTED FROM `Issue Date` (#256), the invoice's own date, as the
 * delivery side counts from `Received Date` — and the list and the detail print the
 * same count beside the chip (`describeInvoiceWait`), so the three places a wait shows
 * say one figure. #640 weighed `Created At`, the day the office entered it, and kept
 * the document's own date: it is what an invoice's age is counted from in practice, and
 * what keeps the two strips' `Nd` the same kind of figure.
 *
 * ORDER IS THE SHARED ONE AND CARRIES NO SECOND TIER. Sorting one kind above the other
 * would give the strip two orderings at once — a reader could not tell why one row sat
 * above another. The kind travels as a word on the row instead.
 *
 * THE TIE-BREAK IS THE `Invoice ID`, AND IT IS LIVE. Two invoices issued on one day
 * order by it descending — most recently entered first, the same fact the delivery
 * side gets from `createdAt`, because a generated id's date half is the mint moment and
 * never a date field (#164). `Invoices."Created At"` exists since #623 and would order
 * the same pairs the same way; the id stays because it needs no field a hand-made row
 * might lack. This said `Invoices` carried no creation timestamp until #640 — true when
 * #256 wrote it, false since #623.
 */
export function selectInvoicesAwaitingDelivery({ invoices, statusByInvoice, vendorNameById, today } = {}) {
    const status = statusByInvoice || new Map();
    const names = vendorNameById || {};

    const rows = [];
    for (const invoice of invoices || []) {
        const summary = status.get(invoice.id);
        if (summary?.key !== "awaiting-delivery") continue;
        if (!(summary.judged > 0)) continue;

        // #263 — THE THRESHOLD IS APPLIED HERE, WHICH IS WHAT KEEPS THE HEADING'S
        // COUNT AND THE ROWS FROM DIVERGING. The strip renders `heading(rows.length)`
        // over the array it maps, so the count is the filtered set by construction; a
        // filter in the component, or in the page between the two, would let the
        // heading say one number while the list showed another and nothing would fail.
        // One threshold for both kinds: a partly delivered invoice is waiting on the
        // vendor exactly as a fully undelivered one is.
        const waited = daysWaiting(invoice.issueDate, today);
        if (!hasWaitedLongEnough(waited)) continue;

        rows.push({
            invoiceId: invoice.invoiceId,
            waitingSince: invoice.issueDate || "",
            // The id IS the creation marker here — see above on #164.
            createdKey: invoice.invoiceId || "",
            vendorName: names[(invoice.vendor || [])[0]] || "Unknown vendor",
            daysWaiting: waited,
            kind: summary.partly
                ? AWAITING_DELIVERY_KIND.partlyDelivered
                : AWAITING_DELIVERY_KIND.noDeliveryRecorded,
        });
    }
    return sortLongestWaitingFirst(rows);
}
