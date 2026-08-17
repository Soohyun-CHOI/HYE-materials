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
// does not write `Recorded as paid` either. #162's ALLOCATION_COPY was swept in
// the same pass but NOT COMPLETELY, and this sentence claimed otherwise until
// #227: the sweep reached `overAttached` and `overFullyDelivered` — it is what
// took `recorded as` out of the second — and never reached `split`, which kept
// both `recorded as` and `lines` until #227 finished it.
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
// THE ONE-DELIVERY PREMISE IS WHAT MOST OF THE COPY BELOW RESTS ON, AND IT IS
// WRITTEN DOWN IN docs/notes/deliveries-and-invoices.md UNDER "The one-delivery
// premise". In one line: the material an invoice bills arrives on the delivery it
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
// made the invoice detail able to speak about ONE bill, and it went on describing
// the ordered item: `Billed` was the `Invoiced Qty` rollup across every invoice,
// `Delivered` every arrival on the order. So this module now carries the boundary
// rather than just the measurements. `sharesOrderedItem` is gone with the caption it
// wrote for a figure that is no longer the order's; `describeInvoiceLine` takes
// `hasDelivery`; and A BOX SPEAKS ONLY WHEN SOMETHING DISAGREES — `all-delivered`
// has no copy at all, because under the premise it is the invoice's fact and the
// chip says it, so a box repeating it would state one fact once per invoice item.
//
// SO THE INVOICE AXIS IS THREE OUTCOMES, AND NONE OF THEM IS A STAGE.
// `Delivered` / `Awaiting delivery` come from the link and `Mismatch` from the
// quantities under it. `Partly delivered` left with the inference and stays gone:
// it reads as progress toward a whole while the fact it would name is a vendor
// shipping less than it billed, which under the one-delivery premise is an error
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
// DIFFERENT question off the same ordering — which bill's invoice item carries an
// over-delivered excess. #219 narrowed that question's candidates to the bills naming
// the shipment the excess arrived on, which is the rethink of `spansInvoices` #210
// left as its non-goal, and moved both halves into `lib/overage.js` where the only
// reader is. The ordering is private there, so this is not a relocated exception:
// nothing outside that file orders bills at all.
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
 * Whether an invoice item takes part in the comparison at all.
 *
 * An invoice item with no `PO Item` names no ordered item, so there is no ordered
 * quantity to compare it against and no delivery that could correspond to it.
 * Counting it would make the invoice carrying it read as short, which is an
 * artifact of comparing something to nothing rather than a fact about the
 * delivery record.
 *
 * NOT A FREIGHT RULE, and the distinction matters because the obvious reading is
 * wrong. A vendor's freight arrives on `Invoices."Shipping Fee"`, a header field;
 * item rows are for material only. The app does not create a `PO Item`-less item
 * row at all — the free-text "Other" option is hidden (`SHOW_OTHER_ITEM_OPTION =
 * false`, #96) — so a conforming invoice has none. The ones on this base today
 * are hand-entered dummy data, which CLAUDE.md records for `HYE-INV-260727-04`
 * (its invoice item carries a variance flag with an empty `PO Item`, a
 * combination no code path here produces).
 *
 * The rule is still needed: #96 hid the UI option and left the backend path
 * intact, so flipping that flag is the whole of re-exposing it, and a row created
 * that way would reach this comparison.
 *
 * Excluded invoice items are not dropped from the screen: they get their own box saying
 * `Not compared — no ordered item`, so the reason is where the invoice item is rather
 * than in a footnote about an invoice item the reader cannot see.
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
 * `Invoiced Qty` rollup — not the sum of one invoice's own invoice items. An ordered
 * item can carry two invoices, and summing only the invoice in hand would under-count
 * and report material as unbilled when it is billed twice over.
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
 * A `null` status means the invoice item named no ordered item — the only outcome
 * that is not a measurement, which is why it cannot be derived from quantities.
 */
export function invoiceVerdictKey(status) {
    if (!status) return "not-compared";
    if ((status.delivered || 0) === 0) return "nothing-delivered";
    if ((status.billedNotArrived || 0) > 0) return "billed-more";
    return "all-delivered";
}

// `sharesOrderedItem` STOOD HERE AND IS GONE (#232), with the `This bill: 5 of 13`
// line it decided. It existed for one reason, stated in its own docstring: the box's
// figures line showed the ORDERED ITEM's `Billed` — every bill on it — so a reader
// would take that figure for this invoice's own unless something said otherwise.
// #232 scoped the figures line to the invoice being read, which removes the premise
// rather than the symptom, and a predicate whose whole job was to caption a figure
// that no longer appears has nothing left to decide.
//
// It went through two answers to one question before that. #166's `showsThisBillShare`
// fired when the answer had been INFERRED, which made the line an explanation of a
// guess; #210 stored the pairing, so the guess went and what was left was the plain
// arithmetic fact that the ordered item carries another bill. Neither is a fact about
// THIS invoice, which is why the third pass deleted the line instead of rewording it.
//
// WHAT IT SAID IS NOT LOST FROM THE APP, AND THAT IS WHY THIS IS A DELETION RATHER
// THAN A GAP. "Another bill charges this ordered item" is a fact about the ORDER, and
// #233 put it on the order's own page: `/pos/[poId]` names every invoice charging it.
// A fact stated in the frame that owns it beats the same fact captioned in one that
// does not.

// `sortInvoicesOldestFirst` STOOD HERE AND IS GONE (#219), with the ordering's whole
// reasoning — the backdatable `Issue Date`, the `Invoice ID` tie-break, the undated
// bill sorting last — moved intact to its one reader in `lib/overage.js`. #166 wrote
// it to fill an ordered item's bills oldest-first with delivered quantity, #210
// deleted that allocator, and what was left was an export this module did not read.
// The other half of that pair, `INFERRED_PREMISE`, went the same way; see the module
// header.

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
 *
 * NO `ordered` EITHER. The `Against the ordered item:` line is gated on the two
 * beyond-order figures, both 0 here, so a bare share renders no order-scoped
 * sentence — correct, since it holds no figure from the ordered item. A caller that
 * wants that line grafts the two facts on, the way lib/deliveryReconciliation.js
 * does. #232's first pass carried `ordered` through for a leading `N ordered` term
 * and took it back out when the line became conditional again.
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
        // Present so the two shapes stay identical, which is what lets one set of
        // copy branches read both. They no longer decide whether the order-scoped
        // line renders — `ordered` does — but a share that omitted them would make
        // `lineStatus` and this return two different objects.
        arrivedBeyondOrder: 0,
        billedBeyondOrder: 0,
    };
}

/**
 * An invoice's status: THREE OUTCOMES SINCE #232, one of them a discrepancy.
 *
 * THE FIRST QUESTION IS THE LINK, NOT THE QUANTITIES. `Invoices."Delivery"` names
 * the delivery this bill describes, so "has the material this invoice bills for
 * arrived" is answered by whether that field is set. An invoice with nothing matched
 * is `Awaiting delivery`, which is the correct reading rather than a gap: the vendor
 * emails the bill at shipment, so a bill arriving before its material is ordinary.
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
 * `excludedCount` is the invoice items countsTowardStatus dropped, carried through so a
 * screen can say what it did not judge.
 */
export function summarizeInvoiceStatus({ lines, hasDelivery = false, excludedCount = 0 } = {}) {
    const entries = lines || [];
    const judged = entries.length;
    const covered = entries.filter((s) => s.billedNotArrived === 0).length;
    const short = entries.some((s) => s.billedNotArrived > 0);

    return {
        // ORDERED: no delivery matched, then one that fell short, then one that
        // covered the bill. The first clause is what makes the second honest — see
        // the docstring on why nothing is compared without a match.
        key: !hasDelivery ? "awaiting-delivery" : short ? "mismatch" : "delivered",
        hasDelivery: Boolean(hasDelivery),
        judged,
        covered,
        excludedCount,
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
 * both of its branches therefore attach that row to an ordered item whose
 * delivered quantity has already reached its `Qty` (the last ordered item filled,
 * or — when nothing had room — the last ordered item in the same order). #167's
 * re-attachment preserves that on both sides: the original ordered item loses a
 * row it did not need to be full, and the overage ordered item's `Qty` is the
 * excess exactly (`lib/overagePR.js` creates it with `qty: row.qty`), so the
 * moved row leaves it exactly full. Verified in code rather than assumed.
 */
export function poLineDelivery({ orderedQty, deliveredQty, committedQty } = {}) {
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
 * THE SECOND CALLER ARRIVED IN #233, AND UNTIL THEN THIS SENTENCE WAS FALSE. #169
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
 * arrived at all.
 *
 * `nothing-ordered` IS NAMED AFTER THE PREDICATE THAT PRODUCES IT, not after one
 * of the two shapes that reach it. `countsAsOrdered` is what empties the judged
 * set, and it does so for an order with no items at all AND for a withdrawn one,
 * whose every ordered item has `Committed Qty` 0. Calling it `no-ordered-items` — the
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
 * NOT HAVE. It used to mean only that the ordered item carried invoice items at
 * all — an existence test over a level shared with every other arrival on the same
 * order — so a shipment that came in with no bill behind it dropped out of the
 * chasing worklist the moment some EARLIER bill touched the same ordered items. With
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
    // An ordered item is settled when the bills naming this delivery cover what it
    // brought. `>=` rather than `===` because a vendor may bill more than it
    // shipped, which is a discrepancy the INVOICE axis reports; from the
    // delivery's side there is nothing left to chase.
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

// `INFERRED_PREMISE` STOOD HERE AND IS GONE (#219). #166 shared one premise sentence
// between two markers — this module's "which bill did the delivery settle" and #167's
// "which bill's invoice item carries the excess" — and #210 answered the first from
// the stored pairing, leaving a constant shared with nobody. #219 then read the
// pairing on #167's side too, which split its one premise into two (a second bill on
// the shipment, or no pairing at all), so the sentences live in `OVERAGE_COPY` beside
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
         * `Mismatch` ARRIVED IN #232 AND DOES NOT REOPEN WHAT #210 CLOSED. That issue
         * removed `partly-delivered` because it read as progress toward a whole while
         * the fact it named was a vendor shipping less than it billed, which under
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
         * verdicts: `more billed than delivered` and never `over-billed`, because at
         * any one moment the two are the same measurement. Deciding which it is
         * belongs to a person, which is precisely what the second half asks for.
         * `matched to it` rather than `it names`, one word for one fact across this
         * screen and its section's empty state.
         */
        mismatch: () => ({
            key: "mismatch",
            text:
                "⚠ This invoice bills more than the delivery matched to it delivered — " +
                "take it up with the vendor, or with whoever received the material, " +
                "before confirming payment.",
        }),
        /**
         * WHAT ONE ORDERED ITEM SAYS WHEN IT DISAGREES — and a box that agrees says
         * nothing, which is why `all-delivered` HAS NO ENTRY HERE (#232).
         *
         * THE PREMISE IS WHAT MAKES THAT A DELETION RATHER THAN A HIDING. Under one
         * invoice, one delivery (see the module header) an invoice is answered by
         * the delivery it matches or by none, so "everything billed arrived" is a
         * fact about the INVOICE and the chip beside the section heading states it.
         * A box repeating it printed one fact once per invoice item — the repetition
         * #233 took off the order's page and #232 took off this one, applied one
         * level further down. `invoiceVerdictKey` still returns the key: the
         * judgment is unchanged and `describeInvoiceLine` reads it to decide that
         * there is nothing to say.
         *
         * THE SURVIVING TWO ARE DISCREPANCIES AND ARE WORDED AS SUCH. Under the
         * premise a shortfall against the matched delivery is not a stage on the way
         * to complete — nothing further is coming, because everything this invoice
         * bills either arrived on that delivery or was never shipped — so it is an
         * event to take up with the vendor. `yet` therefore has exactly one honest
         * home on this screen, the section's own empty state, where the material may
         * still arrive or the arrival may still be recorded. `detail.mismatch` above
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
         */
        verdict: {
            "billed-more": (s, unit) => ({
                key: "billed-more",
                text: `${qtyUnit(s.billedNotArrived, unit)} more billed than the matched delivery delivered`,
            }),
            /**
             * NARROWED BY #232 RATHER THAN REWORDED, then reworded for the same
             * reason. It used to fire on an invoice that matched no delivery at all,
             * which is what made it misleading: it asserted that nothing had arrived
             * when the fact was that nothing had been MATCHED. That state has left
             * the box — describeInvoiceLine returns no verdict for it and the section
             * says it once — so this key now means only what it says: a delivery IS
             * matched to this invoice and it delivered none of THIS ordered item.
             * Which, under the premise, is a discrepancy rather than a wait.
             *
             * UNREACHABLE THROUGH THE APP'S OWN PAIRING AND REACHABLE THROUGH THE
             * DATA, which is why it is kept rather than deleted with the states this
             * module has deleted before. `fitRefusal`'s `notContained` requires the
             * arrival to bring every ordered item the bill charges, and
             * `roomOnOrderedItem` refuses a pair whose remaining room is not > 0, so
             * a computed pairing has `arrived > 0` on every judged ordered item.
             * `Invoices."Delivery"` is an ordinary Airtable link, though, and this
             * base carries hand-entered data by design — the same reason
             * `arrivedByDeliveryAndLine` survives a `PO Item` link removed by hand.
             * `HYE-INV-260804-03` is that row and is deliberately not repaired: it is
             * the only way to see this branch on a screen. A bill of 0 reaches it
             * too, by the clamp.
             */
            "nothing-delivered": (s, unit) => ({
                key: "nothing-delivered",
                text: `${qtyUnit(s.invoiced, unit)} billed, none of it delivered by the matched delivery`,
            }),
            "not-compared": () => ({
                key: "not-compared",
                text: "Not compared — no ordered item",
            }),
        },
        /**
         * COMPARISON 2, AND IT IS AN ASIDE RATHER THAN A VERDICT. It is a fact
         * about the ordered item, not about this bill, so it is uncolored and the
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
         * `billedBeyondOrder` compares against ONE `PO Items` row's `Qty`, not the
         * order's total, and #227's rule is that a `PO Items` row is an ordered item.
         *
         * WHAT SURVIVES IS THE TWO EXCEPTION TERMS, and `billedBeyondOrder` is the
         * one worth the line: a vendor billing beyond what was ordered is visible on
         * no other screen and bears directly on whether to pay. It also has no honest
         * per-invoice form — two bills of 20 against an ordered item of 30 leave
         * every invoice reading clean while it is over-billed by 10 — so it cannot
         * be narrowed the way the figures around it were. `arrivedBeyondOrder` could
         * be narrowed to the matched delivery for free and must not be, because then
         * one line would hold two scopes.
         *
         * ONE LINE EVEN WHEN BOTH SIDES EXCEED. Two lines would read as two problems
         * when it is one comparison with two terms, and the billed side comes first
         * because that is the side this screen is about.
         */
        againstOrder: (s, unit) => {
            const parts = [];
            if (s.billedBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.billedBeyondOrder, unit)} more billed`);
            }
            if (s.arrivedBeyondOrder > 0) {
                parts.push(`${qtyUnit(s.arrivedBeyondOrder, unit)} more delivered`);
            }
            return { key: "against-order", text: `Against the ordered item: ${parts.join(", ")}` };
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
 * BOTH SLOTS ARE NULLABLE SINCE #232, AND A BOX SPEAKS ONLY WHEN SOMETHING
 * DISAGREES. Three conditions null the verdict, and they are three different facts:
 *
 * 1. The invoice MATCHES NO DELIVERY. There is a delivery fact and it is the same
 *    one for every box, so the section states it once above them. It is the
 *    CALLER's `hasDelivery` rather than anything derived from `status`, because a
 *    share with `delivered: 0` cannot tell "nothing is matched to this bill" from
 *    "the matched delivery delivered none of this one" — the distinction #210's
 *    stored pairing created and #232 acts on.
 * 2. Everything this bill charges on this ordered item was delivered. Under the
 *    one-delivery premise that is a fact about the INVOICE, which the chip states,
 *    so `all-delivered` has no copy branch to render.
 * 3. Nothing above applies and the status is judged fine — the same case as 2,
 *    reached through the key rather than through the flag.
 *
 * A NULL `status` is the one thing that always speaks: `Not compared — no ordered
 * item` is a fact about the invoice item and not about any delivery, so it is true
 * whatever the invoice's pairing is and belongs where the invoice item is.
 *
 * `againstOrder` is null unless something exceeds the ordered item. It was
 * unconditional in #232's first pass, to anchor the figures that stood above it;
 * those figures are gone, so the anchor is too. See STATUS_COPY.detail.againstOrder.
 */
export function describeInvoiceLine(status, unit = "", { hasDelivery = false } = {}) {
    const key = invoiceVerdictKey(status);
    const speaks = !status || (hasDelivery && key !== "all-delivered");
    const beyond = status && (status.billedBeyondOrder > 0 || status.arrivedBeyondOrder > 0);

    return {
        verdict: speaks ? STATUS_COPY.detail.verdict[key](status, unit) : null,
        againstOrder: beyond ? STATUS_COPY.detail.againstOrder(status, unit) : null,
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
