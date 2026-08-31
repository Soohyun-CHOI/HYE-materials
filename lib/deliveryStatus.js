// Delivered against invoiced against ordered (#166) — the judgment and its copy.
//
// The office cannot yet tell whether what a vendor invoiced for was delivered, nor what
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
// does not write `Recorded as paid` either. #162's ALLOCATION_COPY was swept in
// the same pass but NOT COMPLETELY, and this sentence claimed otherwise until
// #227: the sweep reached `overAttached` and `overFullyDelivered` — it is what
// took `recorded as` out of the second — and never reached `split`, which kept
// both `recorded as` and `lines` until #227 finished it.
//
// FACTS, NOT VERDICTS. At any one moment "the vendor over-billed" and "the rest
// has not been delivered yet" are the SAME measurement: invoiced exceeds
// delivered. The data cannot distinguish them and neither may the copy, so it
// says "more invoiced than delivered". Deciding which it is belongs to a person,
// and correcting it belongs to #167.
//
// THE PAIRING IS STORED SINCE #210, AND THAT IS WHAT TOOK THE INFERENCE OUT OF
// THIS MODULE. `Invoices."Delivery"` names the delivery an invoice describes, so
// "which delivery answers this invoice" is a lookup rather than an estimate.
// What used to be here — `allocateLineToInvoices`, its `determinate` flag,
// `showsThisBillShare`, the summary's `estimated` and the `inferred` marker — is
// gone rather than kept alongside the link, the same call this module made on
// `arrived-more` and `nothing-invoiced`. The estimate was not merely imprecise:
// it filled invoices oldest-first with whatever had been delivered on the ordered item, so
// a delivery carrying material nobody had invoiced yet spilled onto the next invoice
// and an invoice whose own delivery had not delivered read as PARTLY DELIVERED —
// manufactured out of the very condition the `Awaiting invoice` worklist exists
// to surface.
//
// THE ONE-DELIVERY PREMISE IS WHAT MOST OF THE COPY BELOW RESTS ON, AND IT IS
// WRITTEN DOWN IN docs/notes/deliveries-and-invoices.md UNDER "The one-delivery
// premise". In one line: the material an invoice charges is delivered by the delivery it
// matches or not at all, never split across several. It is not this module's rule to
// state — `Invoices."Delivery"` holds it in the data and `fitRefusal`'s
// `notContained` enforces it on write — but every judgment here reads it, so read it
// before rewording anything. THE REASON IT IS A REFERENCE AND NOT A SENTENCE HERE:
// it was stated beside one conclusion at a time, in the chip's own comment, and the
// verdicts three screens down went on saying `Nothing delivered yet` for four issues
// because nothing connected the two. That is the same failure `line` and `arrived`
// had — a rule settled in one module's header, unreferenced everywhere else.
//
// AND #232 FINISHED WHAT #210 STARTED, ON THE DETAIL'S SIDE. Storing the pairing
// made the invoice detail able to speak about ONE invoice, and it went on describing
// the ordered item: `Billed` was the `Invoiced Qty` rollup across every invoice,
// `Delivered` every delivery on the order. So this module now carries the boundary
// rather than just the measurements. `sharesOrderedItem` is gone with the caption it
// wrote for a figure that is no longer the order's; `describeInvoiceItem` takes
// `hasDelivery`; and A BOX SPEAKS ONLY WHEN SOMETHING DISAGREES — `all-delivered`
// has no copy at all, because under the premise it is the invoice's fact and the
// chip says it, so a box repeating it would state one fact once per invoice item.
//
// SO THE INVOICE AXIS IS THREE OUTCOMES, AND NONE OF THEM IS A STAGE.
// `Delivered` / `Awaiting delivery` come from the link and `Mismatch` from the
// quantities under it. `Partly delivered` left with the inference and stays gone:
// it reads as progress toward a whole while the fact it would name is a vendor
// shipping less than it invoiced, which under the one-delivery premise is an error
// rather than a middle. #232 added `Mismatch` without reopening that, because the
// argument bars a STAGE word and an error word is not one.
//
// THE SHORTFALL WAS A MARKER FOR TWO ISSUES AND IS A CHIP VALUE NOW. #166's shape
// put a discrepancy BESIDE a chip, on the ground that it composes with any value and
// would double a closed set. Neither half held: it composed with exactly one value,
// `Delivered`, since a mismatch needs a delivery matched; and its sentence lived in a
// tooltip, which reaches neither touch nor a keyboard, so the word a reader needed
// most was the one hardest to get at. See STATUS_COPY.column.invoice.
//
// TWO EXPORTS SURVIVED HERE WITH NO READER IN THIS FILE, AND #219 TOOK THEM.
// `sortInvoicesOldestFirst` and `INFERRED_PREMISE` were kept for #167, which asked a
// DIFFERENT question off the same ordering — which invoice's invoice item carries an
// over-delivered excess. #219 narrowed that question's candidates to the invoices naming
// the delivery the excess delivered against, which is the rethink of `spansInvoices` #210
// left as its non-goal, and moved both halves into `lib/overage.js` where the only
// reader is. The ordering is private there, so this is not a relocated exception:
// nothing outside that file orders invoices at all.
//
// A THIRD AXIS SINCE #169: delivered against ORDERED, per purchase order. The
// two above compare a delivery to an invoice; this one compares it to the order that
// asked for it, which is the question site staff have and the one neither
// existing summarizer answers. `summarizeInvoiceStatus` could not be reused and
// is not called from the new path: its denominator is the INVOICE, and `orderedItemStatus`
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

// `countsTowardStatus` STOOD HERE AND IS GONE (#278). It answered whether an
// invoice item takes part in the comparison at all, and the only thing it ever
// excluded was a row with no `PO Item` — which #96 had hidden behind a flag and
// #278 removed outright, along with the second path that reached the same state
// with the flag untouched. Every invoice item names an ordered item now, so the
// predicate had one answer.
//
// WHAT WENT WITH IT: `excludedCount` off `summarizeInvoiceStatus`, the
// `not-compared` verdict and its `unjudged` tone, `notComparedRow` in
// lib/deliveryReconciliation.js, and the twelve assertions that were the whole of
// what held them. The state is not merely unseeded — it is unwritable, which is
// the difference between this removal and leaving a comment.
//
// A HAND-EMPTIED LINK IS STILL SURVIVED AND NO LONGER DESCRIBED, and that split
// is #278's: the walks skip such a row so a page still renders, and no screen
// names it. `docs/notes/deliveries-and-invoices.md` carries why.

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
 * `Invoiced Qty` rollup — not the sum of one invoice's own invoice items. An ordered
 * item can carry two invoices, and summing only the invoice in hand would under-count
 * and report material as uninvoiced when it is invoiced twice over.
 *
 * COMPARISON 1 uses TOTAL delivered, within-order plus beyond. "Did the invoiced
 * material was delivered" is a question about delivery, not about whether the order
 * covered it: 12 delivered against an order of 10 answers an invoice for 12 in full.
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
export function orderedItemStatus({ orderedQty, invoicedQty, deliveredWithinQty, deliveredOverQty } = {}) {
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
        // Comparison 1, both directions. Clamped at 0 because each direction is
        // its own fact: a caller asking "how much is invoiced but not delivered"
        // wants 0, not a negative, when the answer is the other way round.
        // Contrast lib/poItemQty.js:uninvoicedQty, which MUST stay signed because
        // there a negative is the interesting state.
        invoicedNotDelivered: Math.max(0, invoiced - delivered),
        deliveredNotInvoiced: Math.max(0, delivered - invoiced),
        // Comparison 2, as the two facts the flag lets us name precisely.
        //
        // ONE KEY SINCE #227, AND THE DUPLICATE IS WHAT THE RENAME FOUND. This
        // object returned `deliveredBeyondOrder` here and `deliveredBeyondOrder` four
        // lines up — the same `beyond`, twice, under the two words this issue is
        // about. Every reader took the `arrived` one and the `delivered` one had
        // none, so merging them removes a field rather than changing a figure.
        deliveredBeyondOrder: beyond,
        invoicedBeyondOrder: Math.max(0, invoiced - ordered),
    };
}

/**
 * THE INVOICE'S OWN VERDICT ON ONE ORDERED ITEM — three outcomes, and the reason
 * there are three rather than six is that three of the six were unreachable here.
 *
 * A share's delivered quantity is CLAMPED at what that invoice invoiced
 * (invoiceShareStatus), so `delivered > invoiced` cannot happen at this scope:
 * `arrived-more` had no reader on the invoice path and its copy was deleted
 * rather than left standing. `nothing-invoiced` went the same way — a share whose
 * invoice is 0 can be given nothing, so it collapses into "nothing delivered". This
 * repo has been burned repeatedly by things with no caller (`upsertMaterial`
 * carried three defects from Phase 0 to #18), so an unreachable state is removed,
 * not documented.
 *
 * `not-compared` IS THE THIRD, REMOVED BY #278 BY THE SAME TEST. It was the one
 * outcome that was not a measurement — a `null` status, meaning the invoice item
 * named no ordered item — and it is unreachable now that every invoice item names
 * one.
 *
 * What used to be `arrived-more` is now stated ON THE ORDER'S OWN TERMS instead:
 * delivered beyond what was ORDERED is `deliveredBeyondOrder`, rendered by the
 * `Against the order:` line below. One fact, one reader.
 *
 * A NULLISH STATUS STILL DOES NOT THROW, and it is the last outcome rather than
 * its own one: a hand-emptied link reaches no caller of this — the walks skip
 * such a row — so what is left here is total by construction, not by a branch.
 */
export function invoiceVerdictKey(status) {
    if ((status?.delivered || 0) === 0) return "nothing-delivered";
    if ((status?.invoicedNotDelivered || 0) > 0) return "invoiced-more";
    return "all-delivered";
}

// `sharesOrderedItem` STOOD HERE AND IS GONE (#232), with the `This bill: 5 of 13`
// line it decided. It existed for one reason, stated in its own docstring: the box's
// figures line showed the ORDERED ITEM's `Billed` — every invoice on it — so a reader
// would take that figure for this invoice's own unless something said otherwise.
// #232 scoped the figures line to the invoice being read, which removes the premise
// rather than the symptom, and a predicate whose whole job was to caption a figure
// that no longer appears has nothing left to decide.
//
// It went through two answers to one question before that. #166's `showsThisBillShare`
// fired when the answer had been INFERRED, which made the line an explanation of a
// guess; #210 stored the pairing, so the guess went and what was left was the plain
// arithmetic fact that the ordered item carries another invoice. Neither is a fact about
// THIS invoice, which is why the third pass deleted the line instead of rewording it.
//
// WHAT IT SAID IS NOT LOST FROM THE APP, AND THAT IS WHY THIS IS A DELETION RATHER
// THAN A GAP. "Another invoice charges this ordered item" is a fact about the ORDER, and
// #233 put it on the order's own page: `/pos/[poId]` names every invoice charging it.
// A fact stated in the frame that owns it beats the same fact captioned in one that
// does not.

// `sortInvoicesOldestFirst` STOOD HERE AND IS GONE (#219), with the ordering's whole
// reasoning — the backdatable `Issue Date`, the `Invoice ID` tie-break, the undated
// invoice sorting last — moved intact to its one reader in `lib/overage.js`. #166 wrote
// it to fill an ordered item's invoices oldest-first with delivered quantity, #210
// deleted that allocator, and what was left was an export this module did not read.
// The other half of that pair, `INFERRED_PREMISE`, went the same way; see the module
// header.

/**
 * One invoice's own view of one ordered item: the same measurement as orderedItemStatus,
 * scoped to what THIS invoice invoiced and what THE DELIVERY IT NAMES brought on
 * that ordered item.
 *
 * `delivered` IS A LOOKUP SINCE #210, not a share of a fill. It is the sum of the
 * linked delivery's own `Delivery Items` on this ordered item — read, not
 * estimated — which is what let the allocator and its determinacy flag go.
 *
 * CLAMPED AT WHAT THIS INVOICE INVOICED, and the clamp is load-bearing rather than
 * tidy: a delivery may carry material that will be invoiced later, so the linked
 * delivery legitimately brings MORE of an ordered item than this invoice charges.
 * That surplus is the delivery axis's fact, not this invoice's, and leaving it here
 * would make `delivered > invoiced` reachable again — the state whose two verdicts
 * (`arrived-more`, `nothing-invoiced`) were deleted for having no reader. So
 * `deliveredNotInvoiced` is 0 by construction here, where on `orderedItemStatus` it is a real
 * measurement.
 *
 * Deliberately reuses the item-level shape (`invoiced`/`delivered`) so
 * invoiceVerdictKey and every copy branch work unchanged — it is the same
 * measurement at a different scope, not a second rule. The beyond-the-order facts
 * are NOT here: they are properties of the order, not of one invoice, so they stay
 * on the ordered item and the caller carries them separately.
 *
 * NO `ordered` EITHER. The `Against the ordered item:` line is gated on the two
 * beyond-order figures, both 0 here, so a bare share renders no order-scoped
 * sentence — correct, since it holds no figure from the ordered item. A caller that
 * wants that line grafts the two facts on, the way lib/deliveryReconciliation.js
 * does. #232's first pass carried `ordered` through for a leading `N ordered` term
 * and took it back out when the line became conditional again.
 */
export function invoiceShareStatus({ invoicedQty, delivered } = {}) {
    const invoiced = invoicedQty || 0;
    // NAMED FOR THE CLAMP RATHER THAN FOR THE INPUT (#227). The parameter and the
    // returned field are both `delivered` — one word for one fact, which is the
    // point — so the value between them, which is neither, takes the name of what
    // was done to it.
    const clamped = Math.max(0, Math.min(invoiced, delivered || 0));
    return {
        invoiced,
        delivered: clamped,
        invoicedNotDelivered: Math.max(0, invoiced - clamped),
        // 0 by construction, kept because it is the field that DEMONSTRATES the
        // clamp and because it is part of the shape orderedItemStatus shares.
        deliveredNotInvoiced: Math.max(0, clamped - invoiced),
        // Present so the two shapes stay identical, which is what lets one set of
        // copy branches read both. They no longer decide whether the order-scoped
        // line renders — `ordered` does — but a share that omitted them would make
        // `orderedItemStatus` and this return two different objects.
        deliveredBeyondOrder: 0,
        invoicedBeyondOrder: 0,
    };
}

/**
 * An invoice's status: THREE OUTCOMES SINCE #232, one of them a discrepancy.
 *
 * THE FIRST QUESTION IS THE LINK, NOT THE QUANTITIES. `Invoices."Delivery"` names
 * the delivery this invoice describes, so "has the material this invoice charges for
 * was delivered" is answered by whether that field is set. An invoice with nothing matched
 * is `Awaiting delivery`, which is the correct reading rather than a gap: the vendor
 * emails the invoice at shipment, so an invoice arriving before its material is ordinary.
 *
 * THE SECOND IS WHETHER THE MATCHED DELIVERY COVERED IT, AND #232 MADE THAT A CHIP
 * VALUE. It was a MARKER for two issues, on #166's ground that a discrepancy
 * composes with a chip instead of enlarging a closed set. See
 * `STATUS_COPY.column.invoice` for why that came apart: it composed with exactly one
 * value, and its own sentence sat in a tooltip. What #210 established is untouched —
 * `Partly delivered` stays gone, because a STAGE word cannot be right here: under the
 * one-delivery premise nothing further is coming, so a shortfall is an error and not
 * a middle. `Mismatch` is an error word and is barred by nothing.
 *
 * NO MISMATCH WITHOUT A MATCH. With nothing matched there is no delivery to compare
 * against, so every invoice item trivially shows a shortfall and reporting them all
 * would put a discrepancy on every unshipped invoice on the base. So the three are
 * ordered: no link at all, then a link that fell short, then a link that covered it.
 *
 * ONE SHORT INVOICE ITEM IS ENOUGH — it does not average out, the same call
 * `estimated` used to make for the same reason: the reader has to open the invoice
 * either way.
 *
 * COUNTS INVOICE ITEMS, NOT QUANTITIES, where it counts at all: invoice items
 * carry different Units, so adding their quantities together produces a number
 * of nothing. The count decides nothing here — it is reported for the detail and
 * stays out of the chip, which is a closed set of values the way an Airtable single
 * select is. It is also why the mismatch SENTENCE carries no figure: one invoice can
 * be short on two ordered items, and their boxes carry a figure each.
 *
 * A `mismatch` BOOLEAN WAS RETURNED BESIDE THE KEY AND IS GONE (#232). The key
 * carries the distinction now, so returning it as well would be two representations
 * of one fact and one more thing for #182 to find — the same call this function made
 * on `anyArrived`, which no screen ever read. `summary.key === "mismatch"` is the
 * question, and every screen asks it that way.
 *
 * `excludedCount` WAS RETURNED HERE AND IS GONE (#278). It counted the invoice
 * items `countsTowardStatus` dropped so a screen could say what it had not judged,
 * and the only thing it ever counted was an invoice item with no ordered item.
 * Nothing
 * has one now, so it was 0 on every invoice this app can write — a figure with one
 * value, and a parameter every caller had to compute and thread through.
 *
 * `judged` STAYS AND NOW EQUALS THE ITEM COUNT, which is not a reason to drop it:
 * the pair `judged`/`covered` is what the detail reads to say how many of how many,
 * and it being a total rather than a subset is a property of the data rather than
 * of this shape.
 */
export function summarizeInvoiceStatus({ itemStatuses, hasDelivery = false } = {}) {
    const entries = itemStatuses || [];
    const judged = entries.length;
    const covered = entries.filter((s) => s.invoicedNotDelivered === 0).length;
    const short = entries.some((s) => s.invoicedNotDelivered > 0);

    return {
        // ORDERED: no delivery matched, then one that fell short, then one that
        // covered the invoice. The first clause is what makes the second honest — see
        // the docstring on why nothing is compared without a match.
        key: !hasDelivery ? "awaiting-delivery" : short ? "mismatch" : "delivered",
        hasDelivery: Boolean(hasDelivery),
        judged,
        covered,
    };
}

/**
 * ONE ORDERED ITEM AGAINST ITS OWN ORDER (#169) — the delivery axis's
 * counterpart to `orderedItemStatus`, and the level `summarizePODeliveryStatus` folds.
 *
 * READS THE `Delivered Qty` ROLLUP, NOT `Delivery Items`, WHICH IS THE OPPOSITE
 * OF WHAT #166 DOES ONE LEVEL UP, and the difference is what each screen needs.
 * #166 reads the rows because it reports within-order and beyond-order delivery
 * as separate facts, and only a row carries `Over Delivered`. #169 asks one
 * question — has the ordered quantity been delivered — for which the sum is the whole
 * answer, so it costs one already-fetched field instead of a level of rows.
 *
 * THE ROLLUP IS SUFFICIENT BECAUSE OF WHERE AN OVER-DELIVERY ROW ATTACHES.
 * `lib/deliveryAllocation.js:planDelivery` fills each candidate to capacity
 * before moving on, so it only ever has a surplus once every candidate is full;
 * both of its branches therefore attach that row to an ordered item whose
 * delivered quantity has already reached its `Qty` (the last ordered item filled,
 * or — when nothing had room — the last ordered item in the same order). #167's
 * re-attachment preserves that on both sides: the original ordered item loses a
 * row it did not need to be full, and the overage ordered item's `Qty` is the
 * excess exactly (`lib/overagePR.js` creates it with `qty: row.qty`), so the
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
 * `Order variance` mark (#179) is what carries it.
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
 * `invoicePoLinks` or `invoiceItems` — so "withdrawn and invoiced" is unreachable
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
 */
export function invoicePayment({ paid, dueDate } = {}, today) {
    const isPaid = Boolean(paid);
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
 * "INVOICED" NOW MEANS THIS DELIVERY WAS INVOICED, WHICH IS AN ATTRIBUTION #166 DID
 * NOT HAVE. It used to mean only that the ordered item carried invoice items at
 * all — an existence test over a level shared with every other delivery on the same
 * order — so a delivery that came in with no invoice behind it dropped out of the
 * chasing worklist the moment some EARLIER invoice touched the same ordered items. With
 * `Invoices."Delivery"` stored, the comparison is this delivery's own delivered
 * quantity against what the invoices naming THIS delivery invoice on the same ordered
 * item.
 *
 * NOT A BARE LOOKUP, THOUGH, AND THAT IS THE POINT OF COMPARING QUANTITIES. A
 * delivery can carry material nobody has invoiced yet — two materials are delivered, one
 * invoice covers the first — so "has this delivery got an invoice" would read
 * `Invoiced` while half of it is still owed. The three keys therefore survive: the
 * middle one is the state the vendor-chasing worklist exists for.
 *
 * `delivered` is the delivery's OWN slices on that ordered item, within-order plus
 * beyond, for `orderedItemStatus`'s reason: the vendor invoices what it shipped, so the
 * excess is part of what an invoice answers. `invoiced` is what the linked invoices charge
 * on the same ordered item — not the `Invoiced Qty` rollup, which is every invoice on
 * the order including ones belonging to other deliveries.
 *
 * `orderedItemsTouched` is one entry per distinct ordered item this delivery allocated
 * against: `{ poItemRecordId, delivered, invoiced }`.
 */
export function summarizeDeliveryInvoicing(orderedItemsTouched) {
    const entries = orderedItemsTouched || [];
    const total = entries.length;
    // An ordered item is settled when the invoices naming this delivery cover what it
    // brought. `>=` rather than `===` because a vendor may invoice more than it
    // shipped, which is a discrepancy the INVOICE axis reports; from the
    // delivery's side there is nothing left to chase.
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

// `INFERRED_PREMISE` STOOD HERE AND IS GONE (#219). #166 shared one premise sentence
// between two markers — this module's "which invoice did the delivery settle" and #167's
// "which invoice's invoice item carries the excess" — and #210 answered the first from
// the stored pairing, leaving a constant shared with nobody. #219 then read the
// pairing on #167's side too, which split its one premise into two (a second invoice on
// the delivery, or no pairing at all), so the sentences live in `OVERAGE_COPY` beside
// the tier that produces each. A constant exists to keep two things in step, and
// there is no longer a second thing.

// `MISMATCH_REASON` STOOD HERE AS A CONSTANT AND IS NOW ONE SENTENCE'S OWN TEXT
// (#232, third pass). It existed to keep a chip-density marker label and a
// detail-density sentence in step; the marker is retired on both screens — the chip
// says `Mismatch` in words now, so a `!` beside it explained a word the reader had
// already read — and what is left is one sentence, in `STATUS_COPY.detail.mismatch`.
// A constant exists to keep two things in step, and there is no longer a second
// thing: the same call this module made on `INFERRED_PREMISE` and
// `CONTAINMENT_PREMISE`. Its rules traveled with it and are that entry's docstring.

export const STATUS_COPY = {
    /** One chip for a table cell. A closed set of values, per axis. */
    column: {
        /**
         * THREE VALUES: THE LINK'S TWO STATES, AND THE ONE WAY THE LINK CAN BE SET
         * AND STILL BE WRONG. Not a stage in the middle — a third outcome at the end.
         *
         * `Mismatch` DELIVERED IN #232 AND DOES NOT REOPEN WHAT #210 CLOSED. That issue
         * removed `partly-delivered` because it read as progress toward a whole while
         * the fact it named was a vendor shipping less than it invoiced, which under
         * THE ONE-DELIVERY PREMISE cannot be a stage: nothing further is coming. That
         * argument bars a STAGE word from this axis. It says nothing against an ERROR
         * word, and `Mismatch` is not on the way to anything — so the rule stands and
         * goes on barring exactly what it was written to bar. `partly-delivered` is
         * still on the PO axis below, where an order really is filled item by item.
         *
         * IT REPLACED A MARKER, AND THAT IS WHY THE SET COULD GROW. #166's shape put
         * a discrepancy BESIDE the chip, on the ground that it composes with any value
         * and would double a closed set. It does not compose here: a mismatch is only
         * reachable with a delivery matched, so it can only ever have qualified
         * `Delivered` — one value, not any of them — and the composition bought
         * nothing while costing the reader a hover. The marker's own sentence lived in
         * a tooltip, which reaches neither touch nor a keyboard, so the word a person
         * needed most was the one hardest to get at. It is a chip value now and the
         * detail states the whole thing in a sentence.
         *
         * `no-ordered-items` — the dash — became UNREACHABLE rather than
         * unwanted. It meant "there was nothing to compare", which was true when
         * the chip was computed from the invoice items; the chip now comes from
         * a header field, so an invoice with no judgeable invoice item still has
         * an answer. An unreachable state is removed here, not left standing
         * with a comment.
         */
        invoice: {
            delivered: () => ({ key: "delivered", text: "Delivered", tone: "complete" }),
            // ITS OWN TONE, NOT `partial`. They would be the same amber, and on the
            // delivery axis `partial` means `Partly invoiced` — a stage — so sharing
            // the class would make one color mean a stage on one list and an error on
            // the other, which is the property this palette exists to hold still.
            mismatch: () => ({ key: "mismatch", text: "Mismatch", tone: "mismatch" }),
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
         * THE SAME THREE WORDS AS THE INVOICE AXIS, DELIBERATELY, and the rule
         * applied is one name per fact. The predicate is identical — how much of
         * what this document asked for has been delivered — and the denominator
         * that differs (an invoice there, an order here) is supplied by the row the
         * reader is looking at, never by the chip. A fourth vocabulary for the
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
         * this in the same red span `⚠ Check the total` already uses, which is the
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
        // A `mismatch` MARKER LABEL STOOD HERE AND IS GONE (#232). It was #166's
        // shape: a discrepancy composes with a chip instead of enlarging a closed set,
        // and its text was the marker's tooltip and accessible name at once. Both
        // halves came apart. It never composed with more than one value — a mismatch
        // needs a delivery matched, so it could only ever qualify `Delivered` — and a
        // tooltip reaches neither touch nor a keyboard, so the one word a reader had
        // to have was behind a hover. `Mismatch` is a chip value above, and the
        // sentence is `detail.mismatch`, in an amber box a reader cannot miss.
    },

    /** The same facts as sentences, with their figures, for a detail section. */
    detail: {
        /**
         * THE INVOICE'S OWN DISCREPANCY, AS A WHOLE SENTENCE WITH SOMETHING TO DO
         * (#232). The chip says `Mismatch` in one word; this says what does not match
         * and who has to act, which is what a word cannot carry.
         *
         * SHAPED LIKE THE VARIANCE PROMPT ON THE SAME PAGE, deliberately: `⚠ This
         * invoice has variance flags — review before confirming payment.` is the same
         * grade of fact — a person must look before money moves — so it gets the same
         * shape and the same amber box rather than a new kind of alarm. A reader who
         * has learned one has learned both.
         *
         * IT NAMES NO QUANTITY, and that is the division of labor #232 settled: this
         * is the INVOICE's fact and one invoice can be short on two ordered items, so
         * a figure here would either be a sum across different Units — the thing
         * `summarizeInvoiceStatus` refuses to compute — or one of several. The
         * per-ordered-item boxes below carry the figures, one each.
         *
         * A FACT, THEN AN ACTION, and the fact half follows the same rule as the
         * verdicts: `more invoiced than delivered` and never `over-billed`, because at
         * any one moment the two are the same measurement. Deciding which it is
         * belongs to a person, which is precisely what the second half asks for.
         * `matched to it` rather than `it names`, one word for one fact across this
         * screen and its section's empty state.
         */
        mismatch: () => ({
            key: "mismatch",
            text:
                "⚠ This invoice charges more than the delivery matched to it delivered — " +
                "take it up with the vendor, or with whoever received the material, " +
                "before confirming payment.",
        }),
        /**
         * THE BADGE AS A SENTENCE, FOR THE INVOICE'S OWN `Payment` SECTION (#316).
         *
         * A SENTENCE RATHER THAN THE BADGE REPEATED, which is this constant's whole
         * density axis: a list cell is a chip a reader learns once, a detail section
         * has room to say what the chip means. It carries the figure for the reason
         * the badge does — one screen, one invoice — and it says what the figure is
         * counted against, which the cell cannot afford to.
         *
         * IT NAMES ITS SUBJECT, as `detail.mismatch` above does. `this invoice` costs
         * two words on a page about one invoice and buys the sentence a subject where
         * it sits: the `Payment` section holds a control and two other sentences, and
         * a bare `10 days past its due date` beside them reads as a fragment.
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
         * WHAT ONE ORDERED ITEM SAYS WHEN IT DISAGREES — and a box that agrees says
         * nothing, which is why `all-delivered` HAS NO ENTRY HERE (#232).
         *
         * THE PREMISE IS WHAT MAKES THAT A DELETION RATHER THAN A HIDING. Under one
         * invoice, one delivery (see the module header) an invoice is answered by
         * the delivery it matches or by none, so "everything invoiced was delivered" is a
         * fact about the INVOICE and the chip beside the section heading states it.
         * A box repeating it printed one fact once per invoice item — the repetition
         * #233 took off the order's page and #232 took off this one, applied one
         * level further down. `invoiceVerdictKey` still returns the key: the
         * judgment is unchanged and `describeInvoiceItem` reads it to decide that
         * there is nothing to say.
         *
         * THE SURVIVING TWO ARE DISCREPANCIES AND ARE WORDED AS SUCH. Under the
         * premise a shortfall against the matched delivery is not a stage on the way
         * to complete — nothing further is coming, because everything this invoice
         * charges either delivered against that delivery or was never shipped — so it is an
         * event to take up with the vendor. `yet` therefore has exactly one honest
         * home on this screen, the section's own empty state, where the material may
         * still be delivered or the delivery may still be recorded. `detail.mismatch` above
         * is the reference vocabulary and both extend its phrasing — it says the same
         * thing at invoice scope, so a reader meets one clause worded one way.
         *
         * THEY CARRY THEIR FIGURES because the box no longer holds a figures line,
         * which reverses the reason this comment used to give: the numbers were said
         * to be above already, and now nothing is. The difference IS the fact in
         * both, so it is what gets stated.
         *
         * FACTS, NOT VERDICTS, unchanged: never `over-billed` or `short-shipped`,
         * because at any one moment those are the same measurement as this.
         *
         * EACH CARRIES A `tone` SINCE #241, AND SINCE #278 THAT VOCABULARY HAS ONE
         * VALUE RATHER THAN TWO. `exception` is a discrepancy a person has to act on.
         * `unjudged` stood beside it for an invoice item nothing was measured
         * against — not a problem but the absence of one — so `not-compared` could
         * not wear a shortfall's tone without dressing a free-text item as an
         * error. That item is gone (#278) and it was `unjudged`'s only producer, so
         * the tone went with it and the app's tone set is six rather than seven.
         *
         * A ONE-VALUE VOCABULARY IS KEPT RATHER THAN INLINED, and this is the
         * departure worth naming: the field could be dropped and the page could
         * color every verdict the same. It stays because the reason it exists is
         * unchanged — the page needs one answer for an entry's NAME and its sentence
         * together (see lib/invoiceDeliveryEntries.js), and that answer is authored
         * here rather than at the call site. A second value re-entering finds a slot
         * rather than a refactor. The chip tones (`complete`, `partial`, `mismatch`,
         * `none`) remain a separate closed set of STATES with a background each;
         * reusing one for a line of text would make one word mean a chip on one
         * screen and a text color on another. Which amber stays a rendering decision
         * and stays in the page.
         */
        verdict: {
            "invoiced-more": (s, unit) => ({
                key: "invoiced-more",
                tone: "exception",
                text: `${qtyUnit(s.invoicedNotDelivered, unit)} more invoiced than the matched delivery delivered`,
            }),
            /**
             * NARROWED BY #232 RATHER THAN REWORDED, then reworded for the same
             * reason. It used to fire on an invoice that matched no delivery at all,
             * which is what made it misleading: it asserted that nothing had been delivered
             * when the fact was that nothing had been MATCHED. That state has left
             * the box — describeInvoiceItem returns no verdict for it and the section
             * says it once — so this key now means only what it says: a delivery IS
             * matched to this invoice and it delivered none of THIS ordered item.
             * Which, under the premise, is a discrepancy rather than a wait.
             *
             * UNREACHABLE THROUGH THE APP'S OWN PAIRING AND REACHABLE THROUGH THE
             * DATA, which is why it is kept rather than deleted with the states this
             * module has deleted before. `fitRefusal`'s `notContained` requires the
             * delivery to bring every ordered item the invoice charges, and
             * `roomOnOrderedItem` refuses a pair whose remaining room is not > 0, so
             * a computed pairing has `delivered > 0` on every judged ordered item.
             * `Invoices."Delivery"` is an ordinary Airtable link, though, and this
             * base carries hand-entered data by design — the same reason
             * `deliveredByDeliveryAndOrderedItem` survives a `PO Item` link removed by hand.
             * `HYE-INV-260804-03` was that row and was deliberately not repaired: such
             * a row is the only way to see this branch on a screen. An invoice of 0 reaches it
             * too, by the clamp.
             */
            "nothing-delivered": (s, unit) => ({
                key: "nothing-delivered",
                tone: "exception",
                text: `${qtyUnit(s.invoiced, unit)} invoiced, none of it delivered by the matched delivery`,
            }),
            // `not-compared` STOOD HERE — `Not compared — no ordered item`, the one
            // sentence in this module about an invoice item with nothing behind it,
            // and the
            // only producer of the `unjudged` tone. Gone with the state (#278).
        },
        /**
         * COMPARISON 2, AND IT IS AN ASIDE RATHER THAN A VERDICT. It is a fact
         * about the ordered item, not about this invoice, so it is uncolored and the
         * reader is told which frame it is in by name.
         *
         * CONDITIONAL, AND THIS REVERSES A DECISION THIS COMMENT ITSELF ARGUED FOR.
         * The first pass of #232 made it unconditional and led it with `N ordered`,
         * on the ground that after the narrowing it was the box's only order-scoped
         * statement, so its label was load-bearing and the two invoice-scoped figures
         * above it needed a denominator. Both halves of that fell when the box was
         * silenced: a normal box now says NOTHING, so there is no set of figures to
         * anchor and no scope confusion to prevent — the line appears only when
         * something exceeds, and when it appears it is the only thing there. And the
         * `N ordered` term was answering "how much of this ordered item was ordered",
         * which `/pos/[poId]` answers in its `Qty` column, one click away and since
         * #233 with this very invoice named on the same page.
         *
         * `the ordered item`, NOT `the order`, and the old label was simply false.
         * `invoicedBeyondOrder` compares against ONE `PO Items` row's `Qty`, not the
         * order's total, and #227's rule is that a `PO Items` row is an ordered item.
         *
         * WHAT SURVIVES IS THE TWO EXCEPTION TERMS, and `invoicedBeyondOrder` is the
         * one worth the line: a vendor invoicing beyond what was ordered is visible on
         * no other screen and bears directly on whether to pay. It also has no honest
         * per-invoice form — two invoices of 20 against an ordered item of 30 leave
         * every invoice reading clean while it is over-billed by 10 — so it cannot
         * be narrowed the way the figures around it were. `deliveredBeyondOrder` could
         * be narrowed to the matched delivery for free and must not be, because then
         * one line would hold two scopes.
         *
         * ONE LINE EVEN WHEN BOTH SIDES EXCEED. Two lines would read as two problems
         * when it is one comparison with two terms, and the invoiced side comes first
         * because that is the side this screen is about.
         *
         * THE SUBJECT AGREES IN NUMBER SINCE #241, AND THAT IS #227's RULE RATHER
         * THAN GRAMMAR TIDYING. An entry folded across a correction covers two
         * ordered items, its two figures are sums over them, and a singular subject
         * would name one thing the sentence is not about — the same falsity #232
         * corrected when it changed `Against the order:` to name the `PO Items` row.
         * The count comes from the caller because only the caller knows how many
         * rows it folded; it defaults to one, so every unfolded entry — which is
         * every entry on an invoice no correction touched — reads exactly as before.
         */
        againstOrder: (s, unit, { orderedItemCount = 1 } = {}) => {
            const parts = [];
            if (s.invoicedBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.invoicedBeyondOrder, unit)} more invoiced`);
            }
            if (s.deliveredBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.deliveredBeyondOrder, unit)} more delivered`);
            }
            const subject = orderedItemCount > 1 ? "the ordered items" : "the ordered item";
            return { key: "against-order", text: `Against ${subject}: ${parts.join(", ")}` };
        },
        // An `inferred` sentence stood here and is GONE with the guess it
        // explained (#210). The marker's own reason needs no detail-density twin,
        // because at this density the shortfall is already stated with its figures
        // by `verdict["invoiced-more"]` — which is the fact the marker points at.
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
 * BOTH SLOTS ARE NULLABLE SINCE #232, AND A BOX SPEAKS ONLY WHEN SOMETHING
 * DISAGREES. Three conditions null the verdict, and they are three different facts:
 *
 * 1. The invoice MATCHES NO DELIVERY. There is a delivery fact and it is the same
 *    one for every box, so the section states it once above them. It is the
 *    CALLER's `hasDelivery` rather than anything derived from `status`, because a
 *    share with `delivered: 0` cannot tell "nothing is matched to this invoice" from
 *    "the matched delivery delivered none of this one" — the distinction #210's
 *    stored pairing created and #232 acts on.
 * 2. Everything this invoice charges on this ordered item was delivered. Under the
 *    one-delivery premise that is a fact about the INVOICE, which the chip states,
 *    so `all-delivered` has no copy branch to render.
 * 3. Nothing above applies and the status is judged fine — the same case as 2,
 *    reached through the key rather than through the flag.
 *
 * A NULL `status` USED TO ALWAYS SPEAK and no longer can (#278). `Not compared —
 * no ordered item` was a fact about the invoice item rather than about any
 * delivery, so it was true whatever the pairing was; with every invoice item
 * naming an
 * ordered item, no caller hands this a null status, and `speaks` is the
 * `hasDelivery` question alone.
 *
 * `againstOrder` is null unless something exceeds the ordered item. It was
 * unconditional in #232's first pass, to anchor the figures that stood above it;
 * those figures are gone, so the anchor is too. See STATUS_COPY.detail.againstOrder.
 *
 * `orderedItemCount` IS THE ONLY THING #241 ADDED, and it changes no judgment: it
 * tells the order-scoped line how many ordered items its figures were summed over,
 * so the subject agrees in number. Whether a `status` is one invoice's share of one
 * ordered item or a folded entry's sum over several is not this function's
 * business — the shape is identical either way, which is what lets one set of copy
 * branches read both, the property `invoiceShareStatus` was built to have.
 */
export function describeInvoiceItem(
    status,
    unit = "",
    { hasDelivery = false, orderedItemCount = 1 } = {}
) {
    const key = invoiceVerdictKey(status);
    const speaks = hasDelivery && key !== "all-delivered";
    const beyond = status && (status.invoicedBeyondOrder > 0 || status.deliveredBeyondOrder > 0);

    return {
        verdict: speaks ? STATUS_COPY.detail.verdict[key](status, unit) : null,
        againstOrder: beyond
            ? STATUS_COPY.detail.againstOrder(status, unit, { orderedItemCount })
            : null,
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
 * blank `Issue Date`, so this is the category `lib/deliveryReconciliation.js` already
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
 * (`lib/ids.js`), never from a date field — that issue found Invoice ID counting
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
 * The two states an unmatched invoice can be in (#256).
 *
 * THEY NAME THE OBSERVATION AND NEVER THE CAUSE, which is forced rather than
 * chosen. `fitRefusal` produces seven refusal reasons and NONE OF THEM IS STORED —
 * it is pure, and it runs at write time only, from `createInvoiceAction` and from
 * `createDeliveryAction`. So an empty `Invoices."Delivery"` is consistent with a
 * refusal, with nothing having been delivered when both writes happened, and with the
 * matcher never having been asked at all. That last one is the common case on this
 * base: `docs/notes/backlog.md` records, measured, that every seed writes invoices
 * directly and none calls the matcher. A word here claiming a pairing was refused
 * would therefore be false about most of the rows it labels.
 *
 * WHAT IS OBSERVABLE IS WHETHER ANYTHING WAS DELIVERED against the ordered items the
 * invoice charges, and that is one batched read of `PO Items."Delivery Items"` rather
 * than the ~5 reads per invoice `getDeliveriesForInvoice` costs — the per-row shape #143
 * ruled out and #162 measured at over 200 calls. So the split is by delivery, not by
 * reason, and the reader is told where to look rather than what happened.
 */
export const AWAITING_DELIVERY_KIND = {
    /** Nothing has been delivered against any ordered item this invoice charges. */
    noDeliveryRecorded: "no-delivery-recorded",
    /** Something has, and no delivery is matched to this invoice. */
    deliveredNotMatched: "delivered-not-matched",
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
 * IT DOES NOT SAY `do not pay`, for the same rule one step further. Payment is
 * President-or-Admin (#211) and this strip is not, so an instruction about paying
 * would be addressed to a subset of its readers. The fact is stated instead, and the
 * fact is the whole argument: nothing has confirmed the material.
 *
 * `yet` IS HONEST IN THE FIRST ROW WORD and is the one place on this axis it is —
 * see `STATUS_COPY.detail.verdict`, where the same reasoning bars it from a
 * shortfall. Material may still be coming or the delivery may still be unrecorded,
 * and the word covers both without choosing.
 *
 * THE THRESHOLD SENTENCE TAKES ITS NUMBER FROM THE CONSTANT AND NEVER SPELLS IT
 * (#263), which is `CONFIRM_COPY`'s shape with `TOKEN_TTL_MINUTES` and for the reason
 * that docstring gives: a number written twice can be changed once, and then the
 * filter is exact while the screen claims something else. Interpolating makes the two
 * homes unreachable rather than merely discouraged, so nothing has to keep them in
 * step. `offline/awaiting-delivery.mjs` asserts on the SOURCE that this is a template
 * reading the constant, because a literal that happens to equal it today passes every
 * runtime comparison.
 *
 * IT IS THE THIRD SENTENCE, AND THE FIRST TWO ARE UNTOUCHED. The two strips share a
 * grammar on purpose (see the head of this docstring), `screen-briefs.mjs` pins the
 * first two as one substring, and #263's own premise is that the two axes are NOT
 * symmetric — so the difference between them is additive and lands where the
 * asymmetry actually is. The heading does not repeat the figure: one fact, one place.
 */
export const AWAITING_DELIVERY_COPY = {
    heading: (n) =>
        n === 1
            ? "1 invoice is waiting on a delivery"
            : `${n} invoices are waiting on a delivery`,
    explain:
        "Longest wait first. Nothing has confirmed the material these invoices charge for. " +
        `Only invoices that have waited ${AWAITING_DELIVERY_DAYS} days or more are listed.`,
    kind: {
        [AWAITING_DELIVERY_KIND.noDeliveryRecorded]: "nothing delivered yet",
        [AWAITING_DELIVERY_KIND.deliveredNotMatched]: "delivered, not matched",
    },
};

/**
 * The invoices waiting on a delivery, longest first (#256), and only once they have
 * waited `AWAITING_DELIVERY_DAYS` (#263).
 *
 * SELECTION IS THE CHIP'S OWN KEY, not a second reading of the same field. Since
 * #210 `awaiting-delivery` means exactly "`Invoices."Delivery"` is empty", so the
 * strip and the list column cannot drift apart — the mistake #176 made by writing
 * `selectPRsAwaitingPO` fresh when a predicate already existed, which #216 recorded
 * and this follows. **#263 makes the strip a SUBSET of that key rather than a second
 * reading of it**, which is the same relationship one step weaker: every row here
 * carries the chip, and not every chip earns a row. Nothing re-derives the key.
 *
 * AN INVOICE THAT CHARGES NO ORDERED ITEM IS EXCLUDED, and since #278 that is a
 * fail-closed guard rather than a case. Such an invoice can never be paired — it is
 * `fitRefusal`'s `noOrderedItem` — and the delivery question cannot be asked of it at
 * all, so both row words would be false. It cited `countsTowardStatus`'s decision one
 * level up, and that predicate is gone with the invoice item behind it: no invoice
 * this app
 * writes can reach `charged.length === 0`, and a hand-emptied link is the only way
 * left. The guard stays because the reasoning does — a row that cannot say either of
 * its two words does not belong in a worklist.
 *
 * SO THE ROW COUNT AND THE NUMBER OF `Awaiting delivery` CHIPS IN THE TABLE BELOW
 * CAN STILL DIFFER, AND THAT IS NOT A DEFECT. **This paragraph named the wrong cause
 * until #278**: it said two of this base's invoices charge no ordered item and sit in
 * the table with no row here, which was true of two hand-entered rows that are now
 * deleted. What separated the two figures after that was the pairing — an invoice the
 * rule refuses for any other reason wears the chip and has no row.
 * **#263 GAVE IT A THIRD AND NOW DOMINANT CAUSE, and it is the ordinary one:** an
 * invoice that has not yet waited `AWAITING_DELIVERY_DAYS` wears the chip and earns no
 * row, which is the whole point of the threshold. Measured on this base the day it went
 * in: 17 invoices carried the chip and 16 earned a row. `docs/briefs/invoices.md` says
 * the same thing for the design side.
 *
 * ORDER IS THE SHARED ONE AND CARRIES NO SECOND TIER. `delivered-not-matched` is the
 * more actionable kind, and sorting it above the rest would give the strip two
 * orderings at once — a reader could not tell why one row sat above another. The
 * kind travels as a word on the row instead.
 *
 * THE TIE-BREAK IS THE `Invoice ID`, AND IT IS LIVE. Two invoices issued on one day
 * order by it descending — most recently entered first, the same fact the delivery
 * side gets from `createdAt`, because a generated id's date half is the mint moment
 * and never a date field (#164). `Invoices` carries no creation timestamp for the
 * sort to have used instead, which is why `sortLongestWaitingFirst` orders by the
 * neutral `createdKey`; under the old name this axis passed `undefined` and the
 * tie-break did nothing at all, silently, on every same-day pair.
 */
export function selectInvoicesAwaitingDelivery({
    invoices,
    statusByInvoice,
    orderedItemsByInvoice,
    deliveredOrderedItems,
    vendorNameById,
    today,
} = {}) {
    const status = statusByInvoice || new Map();
    const ordered = orderedItemsByInvoice || new Map();
    const delivered = deliveredOrderedItems || new Set();
    const names = vendorNameById || {};

    const rows = [];
    for (const invoice of invoices || []) {
        if (status.get(invoice.id)?.key !== "awaiting-delivery") continue;

        const charged = ordered.get(invoice.id) || [];
        if (charged.length === 0) continue;

        // #263 — THE THRESHOLD IS APPLIED HERE, WHICH IS WHAT KEEPS THE HEADING'S
        // COUNT AND THE ROWS FROM DIVERGING. The strip renders
        // `heading(rows.length)` over the array it maps, so the count is the filtered
        // set by construction; a filter in the component, or in the page between the
        // two, would let the heading say one number while the list showed another and
        // nothing would fail. `offline/awaiting-delivery.mjs` already bars the strip
        // from calling `filter` at all, for the sibling reason #216 recorded.
        //
        // ONE THRESHOLD FOR BOTH ROW KINDS, and it is the SIGNAL rather than symmetry
        // that decides it. `deliveredNotMatched` would seem to deserve no waiting time
        // — something arrived and only the pairing is missing, so the office is what is
        // being waited on — but that is not what the flag says: it means some slice was
        // allocated against SOME ordered item this invoice charges, in any quantity, by
        // any delivery, possibly for another invoice. See
        // `lib/deliveryReconciliation.js:getOrderedItemsWithDelivery` for a measured
        // pair on this base where both invoices read `deliveredNotMatched` and the
        // material can only answer one of them. A split needs a precise signal, and the
        // precise signal is `fitRefusal` — pure, unstored, ~5 reads per invoice.
        const waited = daysWaiting(invoice.issueDate, today);
        if (!hasWaitedLongEnough(waited)) continue;

        rows.push({
            invoiceId: invoice.invoiceId,
            waitingSince: invoice.issueDate || "",
            // The id IS the creation marker here — see above on #164.
            createdKey: invoice.invoiceId || "",
            vendorName: names[(invoice.vendor || [])[0]] || "Unknown vendor",
            daysWaiting: waited,
            kind: charged.some((poItemRecordId) => delivered.has(poItemRecordId))
                ? AWAITING_DELIVERY_KIND.deliveredNotMatched
                : AWAITING_DELIVERY_KIND.noDeliveryRecorded,
        });
    }
    return sortLongestWaitingFirst(rows);
}
