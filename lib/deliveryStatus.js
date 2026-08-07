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
// NOTHING IS STORED. There is no `Invoices.Delivery` link; the join is computed
// at read time from `Invoice Items` -> `PO Item` <- `Delivery Items`
// (lib/deliveryReconciliation.js). Whether to store it was deliberately left
// until this screen has been used.
//
// A THIRD AXIS SINCE #169: delivered against ORDERED, per purchase order. The
// two above compare a delivery to a bill; this one compares it to the order that
// asked for it, which is the question site staff have and the one neither
// existing summarizer answers. `summarizeInvoiceStatus` could not be reused and
// is not called from the new path: its verdict is `billedNotArrived === 0`, so
// its denominator is the BILL, and `lineStatus` is built around invoiced
// quantity and the within/beyond split. Same question, different denominator, so
// what #169 needs is a sibling rather than a caller. The three chip words are
// reused verbatim — see STATUS_COPY.column.po.
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
 * The answer is attributed (allocateLineToInvoices), and a share's delivered
 * quantity is CLAMPED at what that bill billed, so `delivered > invoiced` cannot
 * happen at this scope: `arrived-more` had no reader on the invoice path and its
 * copy was deleted rather than left standing. `nothing-invoiced` went the same
 * way — a share whose bill is 0 can be allocated nothing, so it collapses into
 * "nothing delivered". This repo has been burned repeatedly by things with no
 * caller (`upsertMaterial` carried three defects from Phase 0 to #18), so an
 * unreachable state is removed, not documented.
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
 * Whether this invoice's own share of an ordered item has to be spelled out.
 *
 * EXACTLY THE CONDITION THE INFERRED MARKER FIRES ON, and that identity is the
 * point rather than a coincidence: the share line explains why the answer had to
 * be inferred, so showing one without the other would either raise a question it
 * does not answer or answer one nobody asked. Pinned as an equality offline.
 *
 * Note this is NARROWER than "the ordered item carries more than one bill". Two
 * bills whose material all arrived need no inference (the outcome is the same in
 * any order), so neither line appears — see allocateLineToInvoices.
 */
export function showsThisBillShare(status) {
    return status?.determinate === false;
}

/**
 * THE ONE PREMISE THIS FEATURE RESTS ON, and it is a statement about how the
 * office works rather than a measured fact:
 *
 *   ONE INVOICE IS CONTAINED ENTIRELY WITHIN ONE DELIVERY. A vendor does not
 *   bill for half a shipment, and an invoice is not split across deliveries.
 *
 * NOTHING IN THE DATA ENFORCES IT. There is no link between a delivery and an
 * invoice (deliberately — see the module header), no field records the pairing,
 * and no write path checks it. It is the practice the office describes, and the
 * estimate below is only as good as it. If it breaks — a vendor bills half a
 * pallet, or one invoice covers two deliveries — the estimate does not degrade
 * gracefully into "roughly right": it becomes wrong in a different way, because
 * it will hand a whole invoice a coverage that actually belongs to part of two.
 *
 * What the premise buys is the sentence below: with 80 billed across two invoices
 * and 40 delivered, the 40 satisfies ONE of them completely rather than half of
 * each. That is what makes "this one has not been delivered" a statement with a
 * one-in-two chance of naming the right invoice, rather than a middle value that
 * is in the data nowhere.
 */
export const CONTAINMENT_PREMISE =
    "One invoice is contained entirely within one delivery: a vendor does not bill " +
    "for half a shipment, and an invoice is not split across deliveries. This is the " +
    "office's practice, not a constraint the data enforces.";

/**
 * Oldest bill first: `Issue Date` ascending, tie-broken by `Invoice ID`.
 *
 * `Issue Date` is the vendor's own date on their document, so it is the order the
 * bills were raised in and the right meaning for "which was settled first". It is
 * HUMAN-ENTERED AND BACKDATABLE — the property #164 learned the hard way when an
 * ID counter read such a field — so a mistyped date changes which invoice an
 * estimate favors. That is tolerable here in a way it was not there: the
 * consequence is a coin-flip landing the other way on a cell already marked as
 * inferred, not a corrupted record. `Invoice ID` breaks ties and is monotonic
 * within a day by construction (#164).
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
 * Split one ordered item's delivered quantity across the invoices that bill it.
 *
 * THE BOUNDARY BETWEEN DETERMINED AND INFERRED IS THE LOAD-BEARING RULE OF #166,
 * which is why it is one named predicate here rather than a condition inside a
 * page. Most of the time nothing is inferred at all:
 *
 *   - ONE invoice on the ordered item — that item's delivered-against-billed IS
 *     the invoice's answer. Nothing is guessed. This is the common case.
 *   - delivered covers EVERY bill — all of them are satisfied whatever order they
 *     are taken in, so the outcome does not depend on the ordering.
 *   - NOTHING delivered — none of them is satisfied, likewise order-independent.
 *
 * Inference is needed in exactly one shape: two or more bills on the ordered item
 * AND a delivered quantity that covers some but not all of them. Then the answer
 * depends on which bill the material belongs to, which nothing records, so it is
 * filled oldest-bill-first (sortInvoicesOldestFirst) and the result is MARKED.
 * See CONTAINMENT_PREMISE for what makes that a coin flip between whole invoices
 * rather than an invented middle value.
 *
 * WHY INFER AT ALL, given #166's own "facts, not verdicts" rule. Refusing would
 * leave the invoice axis unable to answer "may this be paid", which is the
 * question it exists for. #165 made the same call one level down: it declined to
 * attach an over-delivery row while the right line was uncertain, and reversed
 * because not attaching was the larger error. Being approximately right about
 * WHICH bill beats being silent about WHETHER the material was delivered.
 *
 * `invoices` is one entry per invoice billing this ordered item:
 * `{ invoiceRecordId, invoiceId, issueDate, billed }`. Returns the same entries
 * with `arrived` filled in, plus the item-level `determinate` flag.
 */
export function allocateLineToInvoices({ delivered, invoices } = {}) {
    const bills = invoices || [];
    const arrivedTotal = delivered || 0;
    const totalBilled = bills.reduce((sum, b) => sum + (b.billed || 0), 0);

    // The three order-independent cases. Anything else and the ordering decides,
    // which is precisely what "inferred" means.
    const determinate = bills.length <= 1 || arrivedTotal >= totalBilled || arrivedTotal <= 0;

    let left = arrivedTotal;
    const shares = sortInvoicesOldestFirst(bills).map((bill) => {
        const take = Math.max(0, Math.min(left, bill.billed || 0));
        left -= take;
        return { ...bill, arrived: take, determinate };
    });

    return { shares, determinate, totalBilled, delivered: arrivedTotal };
}

/**
 * One invoice's own view of one ordered item: the same measurement as lineStatus,
 * scoped to what THIS invoice billed and what was allocated to it.
 *
 * Deliberately reuses the line-level shape (`invoiced`/`delivered`) so
 * invoiceVerdictKey and every copy branch work unchanged — it is the same
 * measurement at a different scope, not a second rule. The beyond-the-order facts
 * are NOT here: they are properties of the order, not of one bill, so they stay
 * on the ordered item and the caller carries them separately.
 */
export function invoiceShareStatus({ billed, arrived, determinate = true } = {}) {
    const invoiced = billed || 0;
    const delivered = arrived || 0;
    return {
        invoiced,
        delivered,
        billedNotArrived: Math.max(0, invoiced - delivered),
        arrivedNotBilled: Math.max(0, delivered - invoiced),
        determinate: Boolean(determinate),
        // Present so a share can be fed to describeInvoiceLine without the two
        // beyond-order branches firing on facts that are not its own.
        arrivedBeyondOrder: 0,
        billedBeyondOrder: 0,
    };
}

/**
 * An invoice's status, from its judged lines.
 *
 * COUNTS LINES, NOT QUANTITIES, and that is forced rather than chosen: lines
 * carry different Units, so adding their quantities together produces a number
 * of nothing.
 *
 * THE COUNT DOES NOT REACH THE COLUMN, THOUGH. A list cell is one line and holds
 * a CHIP — a closed set of values, like an Airtable single select — and a
 * fraction is neither closed nor unit-free once it has to say what it counts.
 * So the count decides which of three chips it is and stays behind; the figures
 * belong to the detail, which has room for them.
 *
 * ATTRIBUTES TO THIS INVOICE. Each entry is this invoice's own share of one
 * ordered item (invoiceShareStatus), so `delivered` means what was allocated to
 * THIS bill rather than what the ordered item received in total. Refusing to
 * attribute left the invoice axis unable to answer "may this be paid" — see
 * allocateLineToInvoices.
 *
 * `estimated` is true when ANY of its lines needed the oldest-first fill. One
 * uncertain line makes the invoice's answer uncertain, so it does not average out
 * across lines.
 *
 * `excludedCount` is the lines countsTowardStatus dropped, carried through so a
 * screen can say what it did not judge.
 */
export function summarizeInvoiceStatus(lineStatuses, excludedCount = 0) {
    const entries = lineStatuses || [];
    const judged = entries.length;
    const arrived = entries.filter((s) => s.billedNotArrived === 0).length;
    // Whether ANY quantity was delivered, which is a different question from
    // whether any line is fully covered — and keeping them apart is what stops
    // the chip lying. A one-line invoice billing 13 with 10 delivered is not
    // `Awaiting delivery`; it is `Partly delivered`. Found by reading the seeded
    // data, not by a check.
    const anyArrived = entries.some((s) => s.delivered > 0);

    const key =
        judged === 0
            ? "no-ordered-items"
            : arrived === judged
              ? "delivered"
              : arrived === 0 && !anyArrived
                ? "awaiting-delivery"
                : "partly-delivered";

    return {
        key,
        judged,
        arrived,
        excludedCount,
        anyArrived,
        // One uncertain line is enough: the invoice's answer rests on it.
        estimated: entries.some((s) => s.determinate === false),
        // Carried for the detail's per-item `Against the order:` line. NOT shown
        // on the invoice list: see lib/deliveryReconciliation.js and the note in
        // app/invoices/page.js on why the two exception tags left that screen.
        anyArrivedBeyondOrder: entries.some((s) => s.arrivedBeyondOrder > 0),
        anyBilledBeyondOrder: entries.some((s) => s.billedBeyondOrder > 0),
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
        // #18's judgement, read not re-derived: 0 when the PO was withdrawn, so
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
 * A delivery's invoicing status, from the ordered items its slices filled.
 *
 * "Invoiced" here means THE ORDERED ITEM carries invoice lines — not that this
 * delivery was billed, which is the attribution that does not exist. The copy is
 * worded to claim only that.
 *
 * `linesTouched` is one entry per distinct PO line this delivery allocated
 * against, each with whether that line has any invoice line at all.
 */
export function summarizeDeliveryInvoicing(linesTouched) {
    const total = (linesTouched || []).length;
    const invoiced = (linesTouched || []).filter((l) => l.hasInvoice).length;

    const key =
        total === 0
            ? "no-ordered-items"
            : invoiced === 0
              ? "awaiting-invoice"
              : invoiced === total
                ? "invoiced"
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

/**
 * WHICH DELIVERY FILTERS EXIST FOR THIS VIEWER, as a rule rather than as an `&&`
 * at each of the two places that ask.
 *
 * The invoicing column is withheld ON THE SERVER for a viewer who may not see
 * invoice data — `getDeliveryInvoicing` is not called at all, so the rows carry
 * no invoicing key — and a filter over a column that was never fetched would
 * silently empty the list. So `?unbilled=1` is treated as ABSENT for such a
 * viewer rather than ignored, and this function is where that is decided so the
 * server's initial props and the client's state cannot disagree about it.
 *
 * The over-delivery filter is not gated: an over-delivery is a fact about the
 * delivery itself, which anyone who may see the delivery may see.
 */
export function resolveDeliveryFilters({ unbilled, over, showInvoicing } = {}) {
    return {
        unbilled: Boolean(unbilled) && Boolean(showInvoicing),
        over: Boolean(over),
    };
}

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
 * WHY ANYTHING HERE HAS TO BE INFERRED, as a clause rather than a sentence.
 *
 * Exported because #167 inherits the same ambiguity for a different question:
 * this module asks which bill the delivery SETTLED, and #167's overage flow asks
 * which bill's line CARRIES the excess. The premise is identical and the
 * consequence is not, so the premise is one string with two endings rather than
 * two sentences that could drift into describing different situations.
 */
export const INFERRED_PREMISE =
    "this ordered item carries more than one bill and the deliveries cannot be told apart";

/**
 * The inferred qualifier, at both densities. ONE SENTENCE, TWO PUNCTUATIONS: the
 * marker's tooltip and the detail's own line say the same thing, because a reader
 * who hovers the marker and a reader who opens the invoice must not be told two
 * different reasons.
 */
const INFERRED_REASON = `${INFERRED_PREMISE}, so the oldest bill is treated as settled first`;

export const STATUS_COPY = {
    /** One chip for a table cell. A closed set of values, per axis. */
    column: {
        invoice: {
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
            // Every line is free text, so there was nothing to compare. A dash
            // rather than a phrase: a chip is a value, and "we did not measure"
            // is the absence of one.
            "no-ordered-items": () => ({ key: "no-ordered-items", text: "—", tone: "absent" }),
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
         * NOT A CHIP, AND THAT IS THE POINT. Inference is not a fourth value of a
         * closed set — it composes with any of the three and would double them —
         * so at column density it is a MARKER beside the chip rather than a second
         * chip. Its text is the tooltip, which must also be the accessible name:
         * hover reaches neither touch nor a keyboard.
         */
        inferred: () => ({ key: "inferred", text: `Inferred: ${INFERRED_REASON}.` }),
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
        /** The same qualifier as a sentence, where there is room for it. */
        inferred: () => ({ key: "inferred", text: `Inferred — ${INFERRED_REASON}.` }),
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
 * the colored one, and the other two are asides by construction.
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
        inferred: showsThisBillShare(status) ? STATUS_COPY.detail.inferred() : null,
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
