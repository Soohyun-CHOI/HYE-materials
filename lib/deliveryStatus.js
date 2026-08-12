// Delivered against invoiced against ordered (#166) — the judgment and its copy.
//
// The office cannot yet tell whether what a vendor billed for arrived, nor what
// was delivered with no invoice behind it. This module is the whole of that
// comparison: what the numbers mean, what to call each outcome, and how the
// vendor-chasing worklist is ordered. Three surfaces read it — the invoice list,
// the invoice detail and the deliveries list — so the rule is here rather than
// three times.
//
// TWO INDEPENDENT COMPARISONS, NOT A LIST OF CASES. Delivered against invoiced,
// and then each of them against ordered. Every combination anyone can name falls
// out of those two, including the ones nobody enumerated — which is why this
// returns figures and a key rather than a hand-written case per screen.
//
// ONE WORD PER FACT. `delivered`, never `arrived`: the table is `Deliveries` and
// the rollup is `Delivered Qty`, so a second name for the same fact would make a
// reader ask what the difference is. `ordered item`, never `line`: a `Line` in
// this base is a child of a Job. And nothing is `recorded as` anything — this app
// does not write `Recorded as paid` either. #162's ALLOCATION_COPY was swept to
// match in the same pass, for the same reason.
//
// FACTS, NOT VERDICTS. At any one moment "the vendor over-billed" and "the rest
// has not been delivered yet" are the SAME measurement: invoiced exceeds
// delivered. The data cannot distinguish them and neither may the copy, so it
// says "more billed than delivered". Deciding which it is belongs to a person,
// and correcting it belongs to #167.
//
// THE PAIRING IS STORED SINCE #210, AND THAT IS WHAT TOOK THE INFERENCE OUT OF
// THIS MODULE. `Invoices."Delivery"` names the shipment a bill describes, so
// "which delivery answers this invoice" is a lookup rather than an estimate.
// What used to be here — `allocateLineToInvoices`, its `determinate` flag,
// `showsThisBillShare`, the summary's `estimated` and the `inferred` marker — is
// gone rather than kept alongside the link, the same call this module made on
// `arrived-more` and `nothing-invoiced`. The estimate was not merely imprecise:
// it filled bills oldest-first with whatever had arrived on the ordered item, so
// a delivery carrying material nobody had billed yet spilled onto the next bill
// and an invoice whose own shipment had not arrived read as PARTLY DELIVERED —
// manufactured out of the very condition the `Awaiting invoice` worklist exists
// to surface.
//
// SO THE INVOICE AXIS IS TWO STATES AND A DISCREPANCY, not three stages.
// `Delivered` / `Awaiting delivery` come from the link; a quantity shortfall is a
// MARKER beside the chip, #166's own marker-vs-chip shape. `Partly delivered`
// left with the inference, because it reads as progress toward a whole while the
// fact it would name is that a vendor shipped less than it billed — which is a
// discrepancy rather than a stage.
//
// TWO EXPORTS SURVIVE WITH NO READER IN THIS FILE, deliberately:
// `sortInvoicesOldestFirst` and `INFERRED_PREMISE`. #167 imports both for a
// DIFFERENT question — which bill's line carries an over-delivered excess — and
// that one is still inferred, because turning it into a lookup off the stored
// pairing needs its `spansInvoices` refusal rethought and is #210's explicit
// non-goal. They look like they belong on the list above; deleting them would
// break the overage flow.
//
// A THIRD AXIS SINCE #169: delivered against ORDERED, per purchase order. The
// two above compare a delivery to a bill; this one compares it to the order that
// asked for it, which is the question site staff have and the one neither
// existing summarizer answers. `summarizeInvoiceStatus` could not be reused and
// is not called from the new path: its denominator is the BILL, and `lineStatus`
// is built around invoiced quantity and the within/beyond split. Same question,
// different denominator, so what #169 needs is a sibling rather than a caller.
// #169 reused all three of the invoice axis's chip words; TWO of them are shared
// now, because #210 took the middle stage off the invoice axis and left it here,
// where an order really is filled item by item over time — see
// STATUS_COPY.column.po.
//
// Pure apart from lib/poItemQty.js (itself dependency-free), so
// scripts/tests/offline/delivery-status.mjs can pin every clause. Note the
// explicit `.js`, for the reason lib/materialPriceView.js records: the offline
// tier runs under plain `node` with no module loader.

import { countsAsOrdered } from "./poItemQty.js";

/**
 * Whether an invoice line takes part in the comparison at all.
 *
 * A line with no `PO Item` names no ordered item, so there is no ordered quantity
 * to compare it against and no delivery that could correspond to it. Counting it
 * would make the invoice carrying it read as short, which is an artifact of
 * comparing something to nothing rather than a fact about the delivery record.
 *
 * NOT A FREIGHT RULE, and the distinction matters because the obvious reading is
 * wrong. A vendor's freight arrives on `Invoices."Shipping Fee"`, a header field;
 * item rows are for material only. The app does not create a `PO Item`-less item
 * row at all — the free-text "Other" option is hidden
 * (`SHOW_OTHER_ITEM_OPTION = false`, #96) — so a conforming invoice has none.
 * The ones on this base today are hand-entered dummy data, which CLAUDE.md
 * records for `HYE-INV-260727-04` (its line carries a variance flag with an empty
 * `PO Item`, a combination no code path here produces).
 *
 * The rule is still needed: #96 hid the UI option and left the backend path
 * intact, so flipping that flag is the whole of re-exposing it, and a row created
 * that way would reach this comparison.
 *
 * Excluded lines are not dropped from the screen: they get their own box saying
 * `Not compared — no ordered item`, so the reason is where the line is rather
 * than in a footnote about a line the reader cannot see.
 */
export function countsTowardStatus(invoiceLine) {
    return Boolean(invoiceLine?.poItemRecordId);
}

/**
 * One ordered item, measured. Takes the four quantities and returns the two
 * comparisons plus everything a caller might render.
 *
 * `deliveredWithinQty` and `deliveredOverQty` arrive SEPARATED, and that is why
 * this feature reads `Delivery Items` rather than `PO Items."Delivered Qty"`:
 * that rollup sums the two into one number, and only the rows carry the
 * `Over Delivered` flag that tells them apart (#165 attaches every row, so the
 * rollup is complete — it is just no longer decomposable). A screen whose job is
 * separating "delivered against the order" from "delivered beyond it" cannot use
 * it.
 *
 * `invoicedQty` is the ORDERED ITEM's total across every invoice, taken from the
 * `Invoiced Qty` rollup — not the sum of one invoice's own lines. A PO line can
 * carry two invoices, and summing only the invoice in hand would under-count and
 * report material as unbilled when it is billed twice over.
 *
 * COMPARISON 1 uses TOTAL delivered, within-order plus beyond. "Did the billed
 * material arrive" is a question about delivery, not about whether the order
 * covered it: 12 delivered against an order of 10 answers a bill for 12 in full.
 * Using the within-order figure would report 2 as undelivered when it is standing
 * in the warehouse.
 *
 * COMPARISON 2 is each side against ordered, and it is realized as two NAMED
 * facts rather than as max(delivered, invoiced) > ordered. The max form is true
 * of both cases and distinguishes neither, and the `Over Delivered` flag already
 * gives the delivery side exactly.
 *
 * Blank/absent inputs count as 0 — an Airtable rollup with nothing behind it is
 * undefined, not 0.
 */
export function lineStatus({ orderedQty, invoicedQty, deliveredWithinQty, deliveredOverQty } = {}) {
    const ordered = orderedQty || 0;
    const invoiced = invoicedQty || 0;
    const within = deliveredWithinQty || 0;
    const beyond = deliveredOverQty || 0;
    const delivered = within + beyond;

    return {
        ordered,
        invoiced,
        delivered,
        deliveredWithin: within,
        deliveredBeyondOrder: beyond,
        // Comparison 1, both directions. Clamped at 0 because each direction is
        // its own fact: a caller asking "how much is billed but not delivered"
        // wants 0, not a negative, when the answer is the other way round.
        // Contrast lib/poItemQty.js:uninvoicedQty, which MUST stay signed because
        // there a negative is the interesting state.
        billedNotArrived: Math.max(0, invoiced - delivered),
        arrivedNotBilled: Math.max(0, delivered - invoiced),
        // Comparison 2, as the two facts the flag lets us name precisely.
        arrivedBeyondOrder: beyond,
        billedBeyondOrder: Math.max(0, invoiced - ordered),
    };
}

/**
 * THE INVOICE'S OWN VERDICT ON ONE ORDERED ITEM — four outcomes, and the reason
 * there are four rather than six is that two of the six were unreachable here.
 *
 * A share's delivered quantity is CLAMPED at what that bill billed
 * (invoiceShareStatus), so `delivered > invoiced` cannot happen at this scope:
 * `arrived-more` had no reader on the invoice path and its copy was deleted
 * rather than left standing. `nothing-invoiced` went the same way — a share whose
 * bill is 0 can be given nothing, so it collapses into "nothing delivered". This
 * repo has been burned repeatedly by things with no caller (`upsertMaterial`
 * carried three defects from Phase 0 to #18), so an unreachable state is removed,
 * not documented.
 *
 * What used to be `arrived-more` is now stated ON THE ORDER'S OWN TERMS instead:
 * delivered beyond what was ORDERED is `arrivedBeyondOrder`, rendered by the
 * `Against the order:` line below. One fact, one reader.
 *
 * A `null` status means the invoice line named no ordered item — the only outcome
 * that is not a measurement, which is why it cannot be derived from quantities.
 */
export function invoiceVerdictKey(status) {
    if (!status) return "not-compared";
    if ((status.delivered || 0) === 0) return "nothing-delivered";
    if ((status.billedNotArrived || 0) > 0) return "billed-more";
    return "all-delivered";
}

/**
 * Does this invoice bill only PART of what its ordered item carries?
 *
 * The box's figures line shows the ORDERED ITEM's totals, `Billed` included, so
 * without this a reader would take that figure for this invoice's own. Usually
 * they are the same number and the line stays away.
 *
 * REPLACES `showsThisBillShare`, WHICH ASKED A QUESTION THAT NO LONGER EXISTS.
 * That one fired when the answer had been inferred, which made the share line an
 * explanation of the guess; with the pairing stored there is no guess, and what is
 * left is the plain fact that another bill is on the same ordered item. So the
 * condition is now arithmetic on two figures the row already holds rather than a
 * flag threaded down from the allocator.
 *
 * `<` rather than `!==`: `Invoiced Qty` is a rollup that includes this bill, so it
 * cannot legitimately be smaller — and if it ever read smaller, staying silent is
 * the better direction than printing `This bill: 13 of 5`.
 */
export function sharesOrderedItem({ billedOnThisInvoice, line } = {}) {
    if (!line) return false;
    return (billedOnThisInvoice || 0) < (line.invoiced || 0);
}

/**
 * Oldest bill first: `Issue Date` ascending, tie-broken by `Invoice ID`.
 *
 * NOTHING IN THIS MODULE CALLS THIS ANY MORE, and that is deliberate rather than
 * an oversight. #166 used it to fill bills oldest-first with delivered quantity;
 * #210 stored the pairing and deleted that allocator. The one remaining caller is
 * `lib/overage.js:selectOverageBill`, which asks a DIFFERENT question — which
 * bill's line carries an over-delivered excess — and still has to infer, because
 * reading that off the stored pairing needs #167's `spansInvoices` refusal
 * rethought alongside it and is #210's explicit non-goal. It stays exported here,
 * next to `INFERRED_PREMISE`, so the two halves of that one inference keep one
 * home until the issue that retires it moves both.
 *
 * `Issue Date` is the vendor's own date on their document, so it is the order the
 * bills were raised in. It is HUMAN-ENTERED AND BACKDATABLE — the property #164
 * learned the hard way when an ID counter read such a field — so a mistyped date
 * changes which invoice an estimate favors. That is tolerable in a way it was not
 * there: the consequence is a coin-flip landing the other way on a cell already
 * marked as inferred, not a corrupted record. `Invoice ID` breaks ties and is
 * monotonic within a day by construction (#164).
 *
 * An undated invoice sorts LAST rather than first: it cannot claim to be the
 * oldest, and a data gap must not take priority in an ordering whose whole point
 * is age — the same call sortCandidates and sortLongestWaitingFirst both make.
 *
 * Does not mutate its input.
 */
export function sortInvoicesOldestFirst(shares) {
    return [...(shares || [])].sort((a, b) => {
        const da = a.issueDate || "";
        const db = b.issueDate || "";
        if (da !== db) {
            if (!da) return 1;
            if (!db) return -1;
            return da.localeCompare(db);
        }
        return (a.invoiceId || "").localeCompare(b.invoiceId || "");
    });
}

/**
 * One invoice's own view of one ordered item: the same measurement as lineStatus,
 * scoped to what THIS invoice billed and what THE DELIVERY IT NAMES brought on
 * that ordered item.
 *
 * `arrived` IS A LOOKUP SINCE #210, not a share of a fill. It is the sum of the
 * linked delivery's own `Delivery Items` on this ordered item — read, not
 * estimated — which is what let the allocator and its determinacy flag go.
 *
 * CLAMPED AT WHAT THIS BILL BILLED, and the clamp is load-bearing rather than
 * tidy: a shipment may carry material that will be billed later, so the linked
 * delivery legitimately brings MORE of an ordered item than this invoice bills.
 * That surplus is the delivery axis's fact, not this bill's, and leaving it here
 * would make `delivered > invoiced` reachable again — the state whose two verdicts
 * (`arrived-more`, `nothing-invoiced`) were deleted for having no reader. So
 * `arrivedNotBilled` is 0 by construction here, where on `lineStatus` it is a real
 * measurement.
 *
 * Deliberately reuses the line-level shape (`invoiced`/`delivered`) so
 * invoiceVerdictKey and every copy branch work unchanged — it is the same
 * measurement at a different scope, not a second rule. The beyond-the-order facts
 * are NOT here: they are properties of the order, not of one bill, so they stay
 * on the ordered item and the caller carries them separately.
 */
export function invoiceShareStatus({ billed, arrived } = {}) {
    const invoiced = billed || 0;
    const delivered = Math.max(0, Math.min(invoiced, arrived || 0));
    return {
        invoiced,
        delivered,
        billedNotArrived: Math.max(0, invoiced - delivered),
        // 0 by construction, kept because it is the field that DEMONSTRATES the
        // clamp and because it is part of the shape lineStatus shares.
        arrivedNotBilled: Math.max(0, delivered - invoiced),
        // Present so a share can be fed to describeInvoiceLine without the two
        // beyond-order branches firing on facts that are not its own.
        arrivedBeyondOrder: 0,
        billedBeyondOrder: 0,
    };
}

/**
 * An invoice's status: TWO STATES AND A DISCREPANCY (#210).
 *
 * THE CHIP COMES FROM THE LINK, NOT FROM THE QUANTITIES. `Invoices."Delivery"`
 * names the shipment this bill describes, so the question the chip answers — has
 * the material this invoice bills for arrived — is answered by whether that field
 * is set. An invoice with nothing linked is `Awaiting delivery`, which is the
 * correct reading rather than a gap: the vendor emails the bill at shipment, so
 * arriving before the material is the ordinary case.
 *
 * THE SHORTFALL IS A MARKER, NOT A THIRD STATE, and that is #166's own
 * marker-vs-chip shape reused rather than re-argued: a discrepancy composes with
 * the chip instead of replacing it. `Partly delivered` is gone because it read as
 * progress toward a whole, while the fact it would have named is that a vendor
 * shipped less than it billed.
 *
 * NO MARKER WITHOUT A LINK. With nothing linked there is no shipment to compare
 * against, so every line trivially shows a shortfall and marking them all would
 * put a discrepancy on every unshipped invoice on the base.
 *
 * COUNTS LINES, NOT QUANTITIES, where it counts at all: lines carry different
 * Units, so adding their quantities together produces a number of nothing. The
 * count decides nothing here any more — it is reported for the detail and stays
 * out of the chip, which is a closed set of values the way an Airtable single
 * select is.
 *
 * `excludedCount` is the lines countsTowardStatus dropped, carried through so a
 * screen can say what it did not judge.
 */
export function summarizeInvoiceStatus({ lines, hasDelivery = false, excludedCount = 0 } = {}) {
    const entries = lines || [];
    const judged = entries.length;
    const covered = entries.filter((s) => s.billedNotArrived === 0).length;

    return {
        key: hasDelivery ? "delivered" : "awaiting-delivery",
        hasDelivery: Boolean(hasDelivery),
        judged,
        covered,
        excludedCount,
        // ONE SHORT LINE IS ENOUGH — it does not average out across lines, the
        // same call `estimated` used to make for the same reason: the reader has
        // to open the invoice either way.
        mismatch: Boolean(hasDelivery) && entries.some((s) => s.billedNotArrived > 0),
    };
}

/**
 * ONE ORDERED ITEM AGAINST ITS OWN ORDER (#169) — the delivery axis's
 * counterpart to `lineStatus`, and the level `summarizePODeliveryStatus` folds.
 *
 * READS THE `Delivered Qty` ROLLUP, NOT `Delivery Items`, WHICH IS THE OPPOSITE
 * OF WHAT #166 DOES ONE LEVEL UP, and the difference is what each screen needs.
 * #166 reads the rows because it reports within-order and beyond-order arrival
 * as separate facts, and only a row carries `Over Delivered`. #169 asks one
 * question — has the ordered quantity arrived — for which the sum is the whole
 * answer, so it costs one already-fetched field instead of a level of rows.
 *
 * THE ROLLUP IS SUFFICIENT BECAUSE OF WHERE AN OVER-DELIVERY ROW ATTACHES.
 * `lib/deliveryAllocation.js:planDelivery` fills each candidate to capacity
 * before moving on, so it only ever has a surplus once every candidate is full;
 * both of its branches therefore attach that row to a line whose delivered
 * quantity has already reached its `Qty` (the last line filled, or — when
 * nothing had room — the last line in the same order). #167's re-attachment
 * preserves that on both sides: the original line loses a row it did not need to
 * be full, and the overage line's `Qty` is the excess exactly
 * (`lib/overagePR.js` creates it with `qty: row.qty`), so the moved row leaves it
 * exactly full. Verified in code rather than assumed.
 */
export function poLineDelivery({ orderedQty, deliveredQty, committedQty } = {}) {
    const ordered = orderedQty || 0;
    const delivered = deliveredQty || 0;

    return {
        ordered,
        delivered,
        // #18's judgment, read not re-derived: 0 when the PO was withdrawn, so
        // a withdrawn order's lines drop out without this module naming a status
        // string. A line that counts always has ordered > 0, because
        // `Committed Qty` is `IF(withdrawn, 0, Qty)`.
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
 * COUNTS ORDERED ITEMS, NOT QUANTITIES, AND THAT IS FORCED RATHER THAN CHOSEN —
 * the same constraint `summarizeInvoiceStatus` is under. A PO's items carry
 * different Units (EA, FT, SET…), so adding their quantities produces a number
 * of nothing. The count decides the chip and stays behind it.
 *
 * `anyDelivered` IS SEPARATE FROM THE COMPLETED COUNT, which is #166's lesson
 * paid forward rather than re-learned: keying `awaiting-delivery` on "no line is
 * complete" made a one-item order of 13 with 10 delivered read as nothing
 * delivered. `awaiting-delivery` is reserved for no quantity having arrived at
 * all.
 *
 * `nothing-ordered` IS NAMED AFTER THE PREDICATE THAT PRODUCES IT, not after one
 * of the two shapes that reach it. `countsAsOrdered` is what empties the judged
 * set, and it does so for an order with no items at all AND for a withdrawn one,
 * whose every line has `Committed Qty` 0. Calling it `no-ordered-items` — the
 * invoice axis's name for its own dash — would have been a key describing the
 * case that has never occurred on this base (measured: 0 purchase orders carry
 * zero items) while silently covering the one that has (5 of 40 are withdrawn).
 * A withdrawn order has not lost its items; it was ordered and then called off,
 * and telling site staff `Awaiting delivery` for it would have them waiting on
 * material nobody will ship.
 */
export function summarizePODeliveryStatus(lines) {
    const judged = (lines || []).map(poLineDelivery).filter((line) => line.counts);
    const ordered = judged.length;
    const complete = judged.filter((line) => line.complete).length;
    const anyDelivered = judged.some((line) => line.anyDelivered);

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
 * A delivery's invoicing status, per ordered item it filled.
 *
 * "INVOICED" NOW MEANS THIS ARRIVAL WAS BILLED, WHICH IS AN ATTRIBUTION #166 DID
 * NOT HAVE. It used to mean only that the ordered item carried invoice lines at
 * all — an existence test over a level shared with every other arrival on the same
 * order — so a shipment that came in with no bill behind it dropped out of the
 * chasing worklist the moment some EARLIER bill touched the same lines. With
 * `Invoices."Delivery"` stored, the comparison is this delivery's own arrived
 * quantity against what the invoices naming THIS delivery bill on the same ordered
 * item.
 *
 * NOT A BARE LOOKUP, THOUGH, AND THAT IS THE POINT OF COMPARING QUANTITIES. A
 * shipment can carry material nobody has billed yet — two materials arrive, one
 * invoice covers the first — so "has this delivery got an invoice" would read
 * `Invoiced` while half of it is still owed. The three keys therefore survive: the
 * middle one is the state the vendor-chasing worklist exists for.
 *
 * `arrived` is the delivery's OWN slices on that ordered item, within-order plus
 * beyond, for `lineStatus`'s reason: the vendor bills what it shipped, so the
 * excess is part of what a bill answers. `billed` is what the linked invoices bill
 * on the same ordered item — not the `Invoiced Qty` rollup, which is every bill on
 * the order including ones belonging to other shipments.
 *
 * `linesTouched` is one entry per distinct ordered item this delivery allocated
 * against: `{ poItemRecordId, arrived, billed }`.
 */
export function summarizeDeliveryInvoicing(linesTouched) {
    const entries = linesTouched || [];
    const total = entries.length;
    // A line is settled when the bills naming this delivery cover what it brought.
    // `>=` rather than `===` because a vendor may bill more than it shipped, which
    // is a discrepancy the INVOICE axis reports; from the delivery's side there is
    // nothing left to chase.
    const invoiced = entries.filter((l) => (l.billed || 0) >= (l.arrived || 0)).length;
    // A LOCAL, NOT A RETURNED FIELD. `summarizeInvoiceStatus` used to hand back the
    // equivalent (`anyArrived`) and no screen ever read it; the key already carries
    // the distinction, so returning it as well would be one more thing #182 has to
    // find. The offline check asserts the key rather than this.
    const anyBilled = entries.some((l) => (l.billed || 0) > 0);

    const key =
        total === 0
            ? "no-ordered-items"
            : invoiced === total
              ? "invoiced"
              : !anyBilled
                ? "awaiting-invoice"
                : "partly-invoiced";

    return { key, total, invoiced };
}

/**
 * The vendor-chasing filter: material that is here and not fully billed for.
 *
 * BOTH INCOMPLETE STATES, not just the empty one. A delivery carrying two
 * materials where only one has been billed is exactly "it is here and there is no
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
// no longer exists on that page. Both this function and sortLongestWaitingFirst
// have exactly one caller again, and it is a different screen.
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
// What was left was `{ unbilled: Boolean(a), over: Boolean(b) }` — a named rule
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

/**
 * WHY #167 STILL HAS TO INFER SOMETHING, as a clause rather than a sentence.
 *
 * EXPORTED FOR `lib/overage.js` AND READ NOWHERE IN THIS FILE. #166 shared it
 * between two markers — this module's "which bill did the delivery settle" and
 * #167's "which bill's line carries the excess" — and #210 answered the first from
 * the stored pairing, so only #167's use is left.
 *
 * NARROWED WITH THE SAME CHANGE. It read "…and the deliveries cannot be told
 * apart", which became false the moment `Invoices."Delivery"` existed: they can be
 * told apart, and #167 simply does not read the pairing yet. What remains is the
 * whole of `selectOverageBill`'s actual condition — more than one bill on the
 * ordered item — so the clause now says only that.
 */
export const INFERRED_PREMISE = "this ordered item carries more than one bill";

/**
 * WHY A DISCREPANCY MARKER IS ON A CELL, as a whole sentence: it is the marker's
 * tooltip AND its accessible name, since hover reaches neither touch nor a
 * keyboard.
 *
 * ONE DENSITY ONLY, unlike the inferred qualifier it replaces. That one needed a
 * detail-density twin because the invoice detail had to explain a guess; this one
 * does not, because the detail already states the shortfall per ordered item, with
 * its figures, through `STATUS_COPY.detail.verdict["billed-more"]`. So there is no
 * second punctuation of one sentence to keep in step.
 *
 * A FACT, NOT A VERDICT, the same rule the verdicts follow: `more is billed than
 * delivered` and never `over-billed`, because at any one moment the two are the
 * same measurement.
 */
const MISMATCH_REASON = "this invoice bills more than the delivery it names delivered";

export const STATUS_COPY = {
    /** One chip for a table cell. A closed set of values, per axis. */
    column: {
        /**
         * TWO VALUES SINCE #210, AND THE SET IS THE LINK'S TWO STATES. Both the
         * middle stage and the dash left this axis, for different reasons.
         *
         * `partly-delivered` went with the inference that produced it — see
         * summarizeInvoiceStatus. It is still on the PO axis below, where it is
         * a real stage: an order genuinely is filled item by item over time,
         * while a bill is answered by one shipment or by none.
         *
         * `no-ordered-items` — the dash — became UNREACHABLE rather than
         * unwanted. It meant "there was nothing to compare", which was true when
         * the chip was computed from the lines; the chip now comes from a header
         * field, so an invoice with no judgeable line still has an answer. An
         * unreachable state is removed here, not left standing with a comment.
         */
        invoice: {
            delivered: () => ({ key: "delivered", text: "Delivered", tone: "complete" }),
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
            "no-ordered-items": () => ({ key: "no-ordered-items", text: "—", tone: "absent" }),
        },
        /**
         * THE ORDER'S OWN AXIS (#169) — how much of what was ordered has arrived.
         *
         * THE SAME THREE WORDS AS THE INVOICE AXIS, DELIBERATELY, and the rule
         * applied is one name per fact. The predicate is identical — how much of
         * what this document asked for has been delivered — and the denominator
         * that differs (a bill there, an order here) is supplied by the row the
         * reader is looking at, never by the chip. A fourth vocabulary for the
         * same predicate would only make a reader ask what the difference is,
         * which is the argument #166 used when it swept `arrived` to `delivered`.
         * The two sets never appear on one screen.
         *
         * A SEPARATE OBJECT RATHER THAN A SHARED ONE, because the dash is not the
         * same fact on both. On the invoice axis it means every line was free
         * text; here it means no line counts as ordered — see
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
         * NOT A CHIP, AND THAT IS THE POINT — #166's shape, inherited by the fact
         * that replaced its inferred qualifier. A discrepancy is not a third value
         * of a two-value set: it composes with `Delivered` and would double the set
         * if it were a chip. Its text is the tooltip, which must also be the
         * accessible name, since hover reaches neither touch nor a keyboard.
         *
         * IT ONLY EVER COMPOSES WITH `Delivered`. With no delivery linked there is
         * nothing to compare a bill against, so summarizeInvoiceStatus withholds
         * it — see there for why marking every unshipped invoice would be worse
         * than marking none.
         */
        mismatch: () => ({ key: "mismatch", text: `Mismatch: ${MISMATCH_REASON}.` }),
    },

    /** The same facts as sentences, with their figures, for a detail section. */
    detail: {
        /**
         * THE INVOICE'S VERDICT ON ONE ORDERED ITEM — the only colored line in the
         * box, because it is the only one that answers the question the invoice
         * screen exists for. The first version colored all three amber, which made
         * the color distinguish nothing.
         *
         * No figures except where the difference IS the fact: the box already
         * carries `Ordered · Billed · Delivered` above, so repeating them here
         * would be the same numbers twice.
         */
        verdict: {
            "all-delivered": () => ({
                key: "all-delivered",
                text: "All billed material delivered",
            }),
            "billed-more": (s, unit) => ({
                key: "billed-more",
                text: `${qtyUnit(s.billedNotArrived, unit)} more billed than delivered`,
            }),
            "nothing-delivered": () => ({
                key: "nothing-delivered",
                text: "Nothing delivered yet",
            }),
            "not-compared": () => ({
                key: "not-compared",
                text: "Not compared — no ordered item",
            }),
        },
        /**
         * COMPARISON 2, AND IT IS AN ASIDE RATHER THAN A VERDICT. It is a fact
         * about the ORDER, not about this bill, so it is uncolored and the reader
         * is told which frame it is in by name.
         *
         * ONE LINE EVEN WHEN BOTH SIDES EXCEED THE ORDER. Two lines would read as
         * two problems when it is one comparison with two terms, and the billed
         * side comes first because that is the side this screen is about.
         */
        againstOrder: (s, unit) => {
            const parts = [];
            if (s.billedBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.billedBeyondOrder, unit)} more billed`);
            }
            if (s.arrivedBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.arrivedBeyondOrder, unit)} more delivered`);
            }
            return { key: "against-order", text: `Against the order: ${parts.join(", ")}` };
        },
        // An `inferred` sentence stood here and is GONE with the guess it
        // explained (#210). The marker's own reason needs no detail-density twin,
        // because at this density the shortfall is already stated with its figures
        // by `verdict["billed-more"]` — which is the fact the marker points at.
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

/**
 * Everything one ordered item's box says, as NAMED SLOTS rather than a list.
 *
 * A list left the caller deciding which message to color, which is how all three
 * came out amber. Named slots put that beyond a call site's reach: `verdict` is
 * the colored one, and `againstOrder` is an aside by construction.
 *
 * TWO SLOTS SINCE #210, not three. The `inferred` slot went with the guess it
 * explained; the reason a page cannot color the aside is unchanged, which is the
 * property this shape exists for.
 *
 * `status` is null for an invoice line that named no ordered item — the box still
 * exists, and it says why.
 */
export function describeInvoiceLine(status, unit = "") {
    const beyond =
        status && (status.arrivedBeyondOrder > 0 || status.billedBeyondOrder > 0)
            ? STATUS_COPY.detail.againstOrder(status, unit)
            : null;

    return {
        verdict: STATUS_COPY.detail.verdict[invoiceVerdictKey(status)](status, unit),
        againstOrder: beyond,
    };
}

// ---------------------------------------------------------------------------
// Ordering

/**
 * The vendor-chasing worklist: longest-waiting delivery first.
 *
 * `Received Date` ASCENDING, because the question is how long the material has
 * been sitting here unbilled, and that starts when it was delivered — not when
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
 * How long an arrival has been waiting, in whole days (#216).
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
 *   2. `Received Date` IS CALENDAR-ONLY. There is no instant to subtract, so the
 *      arithmetic is between two dates and the answer moves at midnight rather
 *      than at the hour material actually arrived.
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
    explain: "Longest wait first. No invoice yet covers what these arrivals brought.",
};

export function sortLongestWaitingFirst(rows) {
    return [...(rows || [])].sort((a, b) => {
        const ra = a.receivedDate || "";
        const rb = b.receivedDate || "";
        if (ra !== rb) {
            // An undated delivery sorts LAST rather than first: it cannot claim to
            // have waited longest, and a data gap must not take the top of a
            // worklist — the same call lib/deliveryAllocation.js:sortCandidates
            // makes for the head of its FIFO queue.
            if (!ra) return 1;
            if (!rb) return -1;
            return ra.localeCompare(rb);
        }
        return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
}
