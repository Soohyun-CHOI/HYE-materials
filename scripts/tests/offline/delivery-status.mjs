// Delivered against invoiced against ordered (#166) — the pure judgment.
//
// The rule is two comparisons rather than an enumeration of cases, so this pins
// the comparisons and the states that fall out of them, not a case list. What it
// cannot reach is the query budget and the actual Airtable values, which are
// Airtable's properties and live in scripts/tests/verify-delivery-status-166.mjs.
//
// WHAT A PASS DOES NOT PROVE. That the figures handed to lineStatus were the right
// ones. This file pins what the rule does with four numbers; whether
// `invoicedQty` really came from the LINE's rollup rather than one invoice's own
// lines, and whether the two delivered figures were split on `Over Delivery`, is a
// property of lib/deliveryReconciliation.js and is measured credentialed.

import {
    CONTAINMENT_PREMISE,
    STATUS_COPY,
    allocateLineToInvoices,
    countsTowardStatus,
    describeDeliveryColumn,
    describeInvoiceColumn,
    describeLineDetail,
    invoiceShareStatus,
    lineStatus,
    lineStatusKey,
    sortInvoicesOldestFirst,
    sortLongestWaitingFirst,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "../../../lib/deliveryStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery status — delivered vs invoiced vs ordered (#166)";

/** One measured line, from the four quantities. */
const line = (ordered, invoiced, within, beyond = 0) =>
    lineStatus({
        orderedQty: ordered,
        invoicedQty: invoiced,
        deliveredWithinQty: within,
        deliveredOverQty: beyond,
    });

export function run({ check, log, assert }) {
    // --- comparison 1: delivered against invoiced -------------------------
    log("comparison 1 — delivered against invoiced, both directions:");
    const short = line(100, 80, 50);
    check("billed but not recorded as arrived", short.billedNotArrived, 30);
    check("and the other direction is 0, not negative", short.arrivedNotBilled, 0);

    const ahead = line(100, 50, 80);
    check("arrived beyond this bill", ahead.arrivedNotBilled, 30);
    check("and the other direction is 0", ahead.billedNotArrived, 0);

    const level = line(100, 80, 80);
    check("equal leaves both at 0", level.billedNotArrived + level.arrivedNotBilled, 0);

    // Clamping is the deliberate difference from lib/poItemQty.js:remainingQty,
    // which MUST stay signed. Each direction here is its own named fact, so a
    // caller asking one of them wants 0 when the answer is the other way round.
    assert(
        "each direction is clamped at 0 — they are two facts, not one signed number",
        short.arrivedNotBilled === 0 && ahead.billedNotArrived === 0
    );

    log("");
    log("TOTAL delivered is what answers the bill, within-order plus beyond:");
    // 12 arriving against an order of 10 answers a bill for 12 in full. Using the
    // within-order figure alone would report 2 as missing while it is in the
    // warehouse.
    const overShipped = line(10, 12, 10, 2);
    check("delivered counts both parts", overShipped.delivered, 12);
    check("so a bill for 12 is fully answered", overShipped.billedNotArrived, 0);
    check("and the beyond-order part is still reported separately", overShipped.arrivedBeyondOrder, 2);

    // --- comparison 2: each side against ordered --------------------------
    log("");
    log("comparison 2 — each side against ordered, as two named facts:");
    check("arrived beyond the order comes from the flag, not from a max()", overShipped.arrivedBeyondOrder, 2);
    // Beyond the order on the ARRIVAL side only: order fully delivered plus 3
    // extra, billed for the order. `overShipped` above is beyond on BOTH sides
    // (it bills 12 against an order of 10), which is why it cannot serve here.
    const arrivedBeyondOnly = line(10, 10, 10, 3);
    // ...and on the BILLING side only.
    const overBilled = line(10, 14, 10);
    check("billed beyond the order", overBilled.billedBeyondOrder, 4);
    check("and nothing arrived beyond it", overBilled.arrivedBeyondOrder, 0);
    // The max form is true of both and distinguishes neither, which is why it is
    // not what the module computes.
    check("arrived beyond the order, billed within it", arrivedBeyondOnly.billedBeyondOrder, 0);
    assert(
        "the two beyond-order facts are independent of each other",
        arrivedBeyondOnly.billedBeyondOrder === 0 && overBilled.arrivedBeyondOrder === 0
    );
    const bothBeyond = line(10, 14, 10, 3);
    check("a line can be beyond the order on both sides at once — arrived", bothBeyond.arrivedBeyondOrder, 3);
    check("  and billed", bothBeyond.billedBeyondOrder, 4);

    log("");
    log("blank inputs are 0, because an empty Airtable rollup is undefined:");
    const empty = lineStatus({});
    check("ordered", empty.ordered, 0);
    check("invoiced", empty.invoiced, 0);
    check("delivered", empty.delivered, 0);
    check("no argument at all does not throw", lineStatus().delivered, 0);

    // --- the six states ---------------------------------------------------
    log("");
    log("the states that fall out of the two comparisons:");
    check("nothing billed and nothing arrived", lineStatusKey(line(100, 0, 0)), "neither");
    check("billed, nothing arrived", lineStatusKey(line(100, 80, 0)), "nothing-arrived");
    check("arrived, nothing billed", lineStatusKey(line(100, 0, 80)), "nothing-invoiced");
    check("more billed than arrived", lineStatusKey(short), "billed-more");
    check("more arrived than billed", lineStatusKey(ahead), "arrived-more");
    check("equal", lineStatusKey(level), "matched");
    // The two absences are checked before the differences on purpose: both would
    // otherwise fall into a difference bucket and read as a discrepancy.
    check(
        "nothing-arrived is not reported as billed-more",
        lineStatusKey(line(100, 80, 0)),
        "nothing-arrived"
    );
    check(
        "nothing-invoiced is not reported as arrived-more",
        lineStatusKey(line(100, 0, 80)),
        "nothing-invoiced"
    );
    // Beyond-order quantity alone is still an arrival.
    check("a purely beyond-order arrival is not 'neither'", lineStatusKey(line(0, 0, 0, 5)), "nothing-invoiced");

    // --- the freight rule -------------------------------------------------
    log("");
    log("invoice lines with no PO Item are excluded from the judgment (#166):");
    // No ordered line means nothing to compare against. NOT a freight rule: a
    // vendor's freight arrives on Invoices."Shipping Fee", a header field, and the
    // app creates no PO Item-less item row at all (SHOW_OTHER_ITEM_OPTION = false,
    // #96). The ones on this base are hand-entered dummy data. The rule stays
    // because that backend path is intact.
    check("a line naming an ordered line counts", countsTowardStatus({ poItemRecordId: "recPOI1" }), true);
    check("a free-text line does not", countsTowardStatus({ poItemRecordId: null }), false);
    check("a missing key does not", countsTowardStatus({}), false);
    check("nullish does not throw", countsTowardStatus(null), false);
    check("undefined does not throw", countsTowardStatus(undefined), false);

    // --- THE DETERMINED / ESTIMATED BOUNDARY ------------------------------
    // The load-bearing rule of #166: which inputs get a computed answer and which
    // get an oldest-bill-first guess. Every case below is about which side of that
    // line an input falls on.
    log("");
    log("determined vs estimated — the boundary, by input shape:");
    const bill = (id, billed, issueDate) => ({
        invoiceRecordId: id,
        invoiceId: `HYE-INV-2607${id}`,
        issueDate,
        billed,
    });

    // ONE bill on the line: the line's arrived-against-billed IS this invoice's
    // answer. Nothing is guessed, and this is the common case.
    const single = allocateLineToInvoices({ delivered: 6, invoices: [bill("01", 10, "2026-07-01")] });
    check("one bill is determined", single.determinate, true);
    check("and it gets what arrived", single.shares[0].arrived, 6);

    // TWO bills, arrival covers BOTH: satisfied whatever order they are taken in.
    const covered = allocateLineToInvoices({
        delivered: 80,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("two bills fully covered is determined", covered.determinate, true);
    check("both get their full amount", covered.shares.map((s) => s.arrived).join(","), "40,40");

    // TWO bills, NOTHING arrived: none is satisfied, likewise order-independent.
    const nothing = allocateLineToInvoices({
        delivered: 0,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("two bills with nothing arrived is determined", nothing.determinate, true);
    check("neither gets anything", nothing.shares.map((s) => s.arrived).join(","), "0,0");

    // TWO bills, arrival covers SOME: the only shape that needs an estimate.
    const split = allocateLineToInvoices({
        delivered: 40,
        invoices: [bill("02", 40, "2026-07-05"), bill("01", 40, "2026-07-01")],
    });
    check("two bills partly covered is ESTIMATED", split.determinate, false);
    check("the OLDEST bill is filled first", split.shares[0].invoiceId, "HYE-INV-260701");
    check("and it is the one treated as arrived", split.shares[0].arrived, 40);
    check("the newer one gets nothing", split.shares[1].arrived, 0);
    assert("every share carries the line's determinacy, not its own", split.shares.every((s) => s.determinate === false));

    // A partial fill is what a non-conforming case looks like: under the
    // containment premise 30 cannot satisfy a 40 bill, but the data does not
    // enforce the premise, so the fill must not throw or clamp to nothing.
    const partial = allocateLineToInvoices({
        delivered: 30,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("a non-conforming arrival still allocates greedily", partial.shares[0].arrived, 30);
    check("leaving the next bill empty", partial.shares[1].arrived, 0);
    check("and it is marked estimated", partial.determinate, false);

    check("no bills at all is determined", allocateLineToInvoices({ delivered: 5, invoices: [] }).determinate, true);
    check("and yields no shares", allocateLineToInvoices({ delivered: 5, invoices: [] }).shares.length, 0);
    check("no argument does not throw", allocateLineToInvoices().shares.length, 0);
    check("the total billed is reported", covered.totalBilled, 80);

    log("");
    log("oldest bill first — Issue Date asc, tie-broken by Invoice ID:");
    const ordered = sortInvoicesOldestFirst([
        { invoiceId: "HYE-INV-260710-02", issueDate: "2026-07-10" },
        { invoiceId: "HYE-INV-260701-01", issueDate: "2026-07-01" },
        { invoiceId: "HYE-INV-260710-01", issueDate: "2026-07-10" },
    ]);
    check("ascending by issue date", ordered[0].invoiceId, "HYE-INV-260701-01");
    check("ties broken by Invoice ID ascending", ordered[1].invoiceId, "HYE-INV-260710-01");
    // A data gap must not take priority in an ordering whose whole point is age —
    // the same call sortCandidates and sortLongestWaitingFirst both make.
    const withUndatedBill = sortInvoicesOldestFirst([
        { invoiceId: "b", issueDate: "" },
        { invoiceId: "a", issueDate: "2026-07-01" },
    ]);
    check("an undated bill sorts LAST", withUndatedBill.at(-1).invoiceId, "b");
    check("nullish does not throw", sortInvoicesOldestFirst(null).length, 0);

    log("");
    log("an invoice's SHARE is the same six-state measurement at a smaller scope:");
    const shareShort = invoiceShareStatus({ billed: 40, arrived: 0, determinate: false });
    check("billed but not arrived", shareShort.billedNotArrived, 40);
    check("state key comes from the shared function", lineStatusKey(shareShort), "nothing-arrived");
    check("determinacy is carried", shareShort.determinate, false);
    const shareFull = invoiceShareStatus({ billed: 40, arrived: 40 });
    check("covered", lineStatusKey(shareFull), "matched");
    check("determinate by default", shareFull.determinate, true);
    // Beyond-order facts belong to the ORDER, not to one bill, so a share carries
    // none of its own and the caller attaches the line's.
    check("a share claims no beyond-order fact of its own", shareFull.arrivedBeyondOrder, 0);
    check("nor on the billing side", shareFull.billedBeyondOrder, 0);

    // --- the invoice summary ----------------------------------------------
    log("");
    log("an invoice summarizes by LINE COUNT, since lines carry different units:");
    const allArrived = summarizeInvoiceStatus([level, overShipped]);
    check("every line covered", allArrived.key, "all-arrived");
    check("counted", `${allArrived.arrived}/${allArrived.judged}`, "2/2");
    const someArrived = summarizeInvoiceStatus([level, short]);
    check("one of two covered", someArrived.key, "some-arrived");
    check("counted", `${someArrived.arrived}/${someArrived.judged}`, "1/2");
    // NO LINE COMPLETE is not the same claim as NOTHING ARRIVED, and conflating
    // them made the column lie: a one-line invoice billing 13 with 10 recorded read
    // as "Nothing recorded as arrived yet". Found by reading seeded data.
    check("no line complete but some quantity arrived", summarizeInvoiceStatus([short]).key, "some-arrived");
    check("  and it reports the count instead of claiming nothing", describeInvoiceColumn(summarizeInvoiceStatus([short])).text, "0 of 1 lines arrived");
    check("  anyArrived says why", summarizeInvoiceStatus([short]).anyArrived, true);
    // Reserved for genuinely nothing.
    const trulyNone = summarizeInvoiceStatus([line(100, 80, 0), line(10, 5, 0)]);
    check("nothing arrived at all", trulyNone.key, "none-arrived");
    check("  anyArrived is false", trulyNone.anyArrived, false);
    check("  and the sentence is then true", describeInvoiceColumn(trulyNone).text, "Nothing recorded as arrived yet");
    // Every line was free text, so there is nothing to compare. Distinct from
    // "nothing arrived", which is a measurement.
    const noneJudged = summarizeInvoiceStatus([], 3);
    check("nothing to compare", noneJudged.key, "no-order-lines");
    check("and it says how many it did not judge", noneJudged.excludedCount, 3);
    assert(
        "which is NOT reported as none-arrived — one is a measurement, the other is its absence",
        noneJudged.key !== "none-arrived"
    );
    check("the beyond-order tags are carried, not folded in", allArrived.anyArrivedBeyondOrder, true);
    check("  and the billed one separately", summarizeInvoiceStatus([overBilled]).anyBilledBeyondOrder, true);
    // A line can be both covered and beyond the order, so one must not mask the
    // other.
    assert(
        "a covered invoice can still carry a beyond-order tag",
        allArrived.key === "all-arrived" && allArrived.anyArrivedBeyondOrder === true
    );
    check("nullish lines do not throw", summarizeInvoiceStatus(null).key, "no-order-lines");

    log("");
    log("one estimated line makes the whole invoice's answer estimated:");
    const est = invoiceShareStatus({ billed: 40, arrived: 0, determinate: false });
    const det = invoiceShareStatus({ billed: 40, arrived: 40, determinate: true });
    check("all determined", summarizeInvoiceStatus([det, det]).estimated, false);
    check("one estimated is enough — it does not average out", summarizeInvoiceStatus([det, est]).estimated, true);
    check("and the state is still measured normally", summarizeInvoiceStatus([det, est]).key, "some-arrived");
    // lineStatus results carry no `determinate`, so a line-scope status must not be
    // mistaken for an estimate.
    check("a line-scope status is not an estimate", summarizeInvoiceStatus([level]).estimated, false);

    log("");
    log("the estimate qualifier is ONE entry at both densities, not a third axis:");
    check("column density is a short tag", STATUS_COPY.column.estimated().text, "estimated");
    assert(
        "detail density says why",
        STATUS_COPY.detail.estimated().text.includes("more than one bill") &&
            STATUS_COPY.detail.estimated().text.includes("oldest bill")
    );
    check("both share one key, so a check pins the branch not the wording", STATUS_COPY.column.estimated().key, STATUS_COPY.detail.estimated().key);
    // The whole point of making it an entry rather than an axis: the state copy is
    // not doubled. Six states, one qualifier.
    check("the line states are not doubled by determinacy", Object.keys(STATUS_COPY.detail.line).length, 6);
    check("and the invoice column states are not either", Object.keys(STATUS_COPY.column.invoice).length, 4);

    log("");
    log("the containment premise is recorded as practice, not as a measured fact:");
    assert("it names what it assumes", CONTAINMENT_PREMISE.includes("contained entirely within one delivery"));
    assert(
        "and says the data does not enforce it",
        CONTAINMENT_PREMISE.includes("not a constraint the data enforces")
    );

    // --- the delivery summary ---------------------------------------------
    log("");
    log("a delivery summarizes over the ordered lines its slices filled:");
    const none = summarizeDeliveryInvoicing([{ hasInvoice: false }, { hasInvoice: false }]);
    check("nothing invoiced — the vendor-chasing state", none.key, "none-invoiced");
    check("partly", summarizeDeliveryInvoicing([{ hasInvoice: true }, { hasInvoice: false }]).key, "partly-invoiced");
    check("all", summarizeDeliveryInvoicing([{ hasInvoice: true }]).key, "all-invoiced");
    check("no ordered lines at all", summarizeDeliveryInvoicing([]).key, "no-order-lines");
    check("nullish does not throw", summarizeDeliveryInvoicing(null).key, "no-order-lines");

    // --- copy -------------------------------------------------------------
    log("");
    log("copy — the right BRANCH, pinned by key not wording:");
    check("all arrived, one line", describeInvoiceColumn(summarizeInvoiceStatus([level])).text, "Arrived");
    check("all arrived, several lines", describeInvoiceColumn(allArrived).text, "Arrived (2 lines)");
    check("some arrived", describeInvoiceColumn(someArrived).text, "1 of 2 lines arrived");
    check(
        "none arrived",
        describeInvoiceColumn(summarizeInvoiceStatus([line(100, 80, 0)])).text,
        "Nothing recorded as arrived yet"
    );
    check("nothing to compare", describeInvoiceColumn(noneJudged).text, "No ordered lines to compare");
    // Short in the column, full in the detail — the density pairing, not two
    // different claims. The column is a 7.5rem table-fixed cell and this is the
    // commonest state, so the full sentence would wrap every row.
    check("the vendor-chasing phrase, column density", describeDeliveryColumn(none).text, "No invoice yet");
    check(
        "and the same fact at detail density, with the figure",
        STATUS_COPY.detail.line["nothing-invoiced"](line(100, 0, 80), "EA").text,
        "No invoice recorded for this yet — 80 EA recorded as arrived."
    );
    check("partly invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([{ hasInvoice: true }, { hasInvoice: false }])).text, "1 of 2 invoiced");
    check("all invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([{ hasInvoice: true }])).text, "Invoiced");

    log("");
    log("FACTS, NOT VERDICTS — the words the copy must never use:");
    // At any one moment "the vendor over-billed" and "the rest has not arrived
    // yet" are the same measurement, so the copy may not pick one.
    const everySentence = [
        ...Object.values(STATUS_COPY.column.invoice).map((f) => f({ judged: 2, arrived: 1, invoiced: 1, total: 2 }).text),
        ...Object.values(STATUS_COPY.column.delivery).map((f) => f({ invoiced: 1, total: 2 }).text),
        ...Object.values(STATUS_COPY.detail.line).map((f) => f(short, "EA").text),
        ...Object.values(STATUS_COPY.detail.beyondOrder).map((f) => f(bothBeyond, "EA").text),
    ];
    for (const forbidden of ["over-billed", "overbilled", "short-shipped", "underdelivered", "under-delivered", "missing"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    assert(
        "the shortfall message says 'more billed than recorded as arrived'",
        STATUS_COPY.detail.line["billed-more"](short, "EA").text.includes(
            "more billed than recorded as arrived"
        )
    );
    assert(
        "and states both figures, so the reader can judge",
        (() => {
            const t = STATUS_COPY.detail.line["billed-more"](short, "EA").text;
            return t.includes("80 EA") && t.includes("50 EA");
        })()
    );
    assert("every sentence is non-empty", everySentence.every((t) => t && t.length > 0));

    log("");
    log("a line's detail is one message per comparison it has something to say about:");
    check("covered and nothing beyond the order — one message", describeLineDetail(level, "EA").length, 1);
    check("beyond the order on one side — two", describeLineDetail(arrivedBeyondOnly, "EA").length, 2);
    check("beyond on both sides — three", describeLineDetail(bothBeyond, "EA").length, 3);
    check("the first is always the state", describeLineDetail(bothBeyond, "EA")[0].key, "billed-more");
    // The qualifier sits immediately after the state it qualifies, before the
    // beyond-order facts, which are about the ORDER rather than this bill.
    const estDetail = describeLineDetail({ ...bothBeyond, determinate: false }, "EA");
    check("an estimated line gains one message", estDetail.length, 4);
    check("and it comes right after the state", estDetail[1].key, "estimated");
    check("a determined line gains none", describeLineDetail(bothBeyond, "EA").length, 3);
    check("then the arrival fact", describeLineDetail(bothBeyond, "EA")[1].key, "arrived-beyond-order");
    check("then the billing fact", describeLineDetail(bothBeyond, "EA")[2].key, "billed-beyond-order");
    assert(
        "a blank unit omits it rather than printing 'undefined'",
        !describeLineDetail(level, "")[0].text.includes("undefined")
    );

    // --- the worklist order -----------------------------------------------
    log("");
    log("the vendor-chasing worklist: longest-waiting first (#166):");
    const rows = [
        { id: "b", receivedDate: "2026-07-20", createdAt: "2026-07-20T10:00:00.000Z" },
        { id: "a", receivedDate: "2026-07-10", createdAt: "2026-07-11T10:00:00.000Z" },
        { id: "c", receivedDate: "2026-07-20", createdAt: "2026-07-21T10:00:00.000Z" },
    ];
    const sorted = sortLongestWaitingFirst(rows);
    check("Received Date ascending", sorted.map((r) => r.id).join(""), "acb");
    // Created At DESC as the tie-break, matching the default list's direction so
    // only the primary key flips between the two orderings.
    check("ties broken by Created At descending", sorted[1].id, "c");
    assert("does not mutate its input", rows[0].id === "b");
    // A data gap must not take the top of a worklist — the same call
    // sortCandidates makes for the head of its FIFO queue.
    const withUndated = sortLongestWaitingFirst([...rows, { id: "z", receivedDate: "", createdAt: "2026-01-01T00:00:00.000Z" }]);
    check("an undated arrival sorts LAST, not first", withUndated.at(-1).id, "z");
    check("nullish does not throw", sortLongestWaitingFirst(null).length, 0);
    check("a single row is returned as-is", sortLongestWaitingFirst([rows[0]])[0].id, "b");
}

if (isMain(import.meta.url)) standalone(title, run);
