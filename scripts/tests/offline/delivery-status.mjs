// Delivered against invoiced against ordered (#166) — the pure judgment.
//
// The rule is two comparisons rather than an enumeration of cases, so this pins
// the comparisons and the states that fall out of them, not a case list. What it
// cannot reach is the query budget and the actual Airtable values, which are
// Airtable's properties and live in scripts/tests/verify-delivery-status-166.mjs.
//
// WHAT A PASS DOES NOT PROVE. That the figures handed to lineStatus were the right
// ones. This file pins what the rule does with four numbers; whether
// `invoicedQty` really came from the ordered item's rollup rather than one
// invoice's own lines, and whether the two delivered figures were split on
// `Over Delivered`, is a property of lib/deliveryReconciliation.js and is measured
// credentialed.

import {
    CONTAINMENT_PREMISE,
    STATUS_COPY,
    allocateLineToInvoices,
    countsTowardStatus,
    describeDeliveryColumn,
    describeInvoiceColumn,
    describeInvoiceLine,
    describePOColumn,
    invoiceShareStatus,
    invoiceVerdictKey,
    isNotFullyInvoiced,
    lineStatus,
    poLineDelivery,
    showsThisBillShare,
    summarizePODeliveryStatus,
    sortInvoicesOldestFirst,
    sortLongestWaitingFirst,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "../../../lib/deliveryStatus.js";
// The namespace too, so the module's own export list can be asserted on — #211
// deleted one export and "it is gone" is not a claim a named import can make.
import * as deliveryStatus from "../../../lib/deliveryStatus.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery status — delivered vs invoiced vs ordered (#166)";

/** One measured ordered item, from the four quantities. */
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
    check("billed but not delivered", short.billedNotArrived, 30);
    check("and the other direction is 0, not negative", short.arrivedNotBilled, 0);

    const ahead = line(100, 50, 80);
    check("delivered beyond this bill", ahead.arrivedNotBilled, 30);
    check("and the other direction is 0", ahead.billedNotArrived, 0);

    const level = line(100, 80, 80);
    check("equal leaves both at 0", level.billedNotArrived + level.arrivedNotBilled, 0);

    // Clamping is the deliberate difference from lib/poItemQty.js:uninvoicedQty,
    // which MUST stay signed. Each direction here is its own named fact, so a
    // caller asking one of them wants 0 when the answer is the other way round.
    assert(
        "each direction is clamped at 0 — they are two facts, not one signed number",
        short.arrivedNotBilled === 0 && ahead.billedNotArrived === 0
    );

    log("");
    log("TOTAL delivered is what answers the bill, within-order plus beyond:");
    // 12 delivered against an order of 10 answers a bill for 12 in full. Using the
    // within-order figure alone would report 2 as undelivered while it is in the
    // warehouse.
    const overShipped = line(10, 12, 10, 2);
    check("delivered counts both parts", overShipped.delivered, 12);
    check("so a bill for 12 is fully answered", overShipped.billedNotArrived, 0);
    check("and the beyond-order part is still reported separately", overShipped.arrivedBeyondOrder, 2);

    // --- comparison 2: each side against ordered --------------------------
    log("");
    log("comparison 2 — each side against ordered, as two named facts:");
    check("delivered beyond the order comes from the flag, not from a max()", overShipped.arrivedBeyondOrder, 2);
    // Beyond the order on the DELIVERY side only: order fully delivered plus 3
    // extra, billed for the order. `overShipped` above is beyond on BOTH sides
    // (it bills 12 against an order of 10), which is why it cannot serve here.
    const arrivedBeyondOnly = line(10, 10, 10, 3);
    // ...and on the BILLING side only.
    const overBilled = line(10, 14, 10);
    check("billed beyond the order", overBilled.billedBeyondOrder, 4);
    check("and nothing delivered beyond it", overBilled.arrivedBeyondOrder, 0);
    // The max form is true of both and distinguishes neither, which is why it is
    // not what the module computes.
    check("delivered beyond the order, billed within it", arrivedBeyondOnly.billedBeyondOrder, 0);
    assert(
        "the two beyond-order facts are independent of each other",
        arrivedBeyondOnly.billedBeyondOrder === 0 && overBilled.arrivedBeyondOrder === 0
    );
    const bothBeyond = line(10, 14, 10, 3);
    check("an ordered item can be beyond the order on both sides at once — delivered", bothBeyond.arrivedBeyondOrder, 3);
    check("  and billed", bothBeyond.billedBeyondOrder, 4);

    log("");
    log("blank inputs are 0, because an empty Airtable rollup is undefined:");
    const empty = lineStatus({});
    check("ordered", empty.ordered, 0);
    check("invoiced", empty.invoiced, 0);
    check("delivered", empty.delivered, 0);
    check("no argument at all does not throw", lineStatus().delivered, 0);

    // --- THE INVOICE'S VERDICT: FOUR OUTCOMES, AND WHY NOT SIX ------------
    log("");
    log("the invoice's verdict on one ordered item — four outcomes:");
    check("nothing delivered", invoiceVerdictKey(line(100, 80, 0)), "nothing-delivered");
    check("more billed than delivered", invoiceVerdictKey(short), "billed-more");
    check("everything billed is delivered", invoiceVerdictKey(level), "all-delivered");
    check("no ordered item to compare against", invoiceVerdictKey(null), "not-compared");
    check("  undefined takes the same branch", invoiceVerdictKey(undefined), "not-compared");
    // The absence is checked before the difference on purpose: it would otherwise
    // fall into `billed-more` and read as a discrepancy rather than as an absence.
    assert(
        "nothing-delivered is not reported as billed-more",
        invoiceVerdictKey(line(100, 80, 0)) === "nothing-delivered"
    );

    // The two states this used to have. A share's delivered quantity is CLAMPED at
    // what its own bill billed (allocateLineToInvoices), so delivered > invoiced
    // cannot occur at invoice scope — `arrived-more` had no reader and its copy was
    // deleted rather than left standing, which is the lesson `upsertMaterial`
    // taught between Phase 0 and #18. What it used to say is now said on the
    // ORDER's terms by the `Against the order:` line.
    const shareCannotExceed = invoiceShareStatus({ billed: 40, arrived: 40 });
    check("a share is clamped, so delivered never exceeds billed", shareCannotExceed.arrivedNotBilled, 0);
    assert(
        "so the invoice verdict has four branches, not six",
        Object.keys(STATUS_COPY.detail.verdict).length === 4
    );
    assert(
        "and delivered-beyond-billed is stated against the ORDER instead",
        describeInvoiceLine(
            { ...invoiceShareStatus({ billed: 10, arrived: 10 }), arrivedBeyondOrder: 3 },
            "EA"
        ).againstOrder.text === "Against the order: 3 EA more delivered"
    );

    // --- the freight rule -------------------------------------------------
    log("");
    log("invoice lines with no PO Item are excluded from the judgment (#166):");
    // No ordered item means nothing to compare against. NOT a freight rule: a
    // vendor's freight arrives on Invoices."Shipping Fee", a header field, and the
    // app creates no PO Item-less item row at all (SHOW_OTHER_ITEM_OPTION = false,
    // #96). The ones on this base are hand-entered dummy data. The rule stays
    // because that backend path is intact.
    check("a line naming an ordered item counts", countsTowardStatus({ poItemRecordId: "recPOI1" }), true);
    check("a free-text line does not", countsTowardStatus({ poItemRecordId: null }), false);
    check("a missing key does not", countsTowardStatus({}), false);
    check("nullish does not throw", countsTowardStatus(null), false);
    check("undefined does not throw", countsTowardStatus(undefined), false);
    // Excluded is not invisible: it gets its own box saying why.
    check(
        "and it still gets a verdict of its own",
        describeInvoiceLine(null, "EA").verdict.text,
        "Not compared — no ordered item"
    );

    // --- THE DETERMINED / INFERRED BOUNDARY -------------------------------
    // The load-bearing rule of #166: which inputs get a computed answer and which
    // get an oldest-bill-first guess. Every case below is about which side of that
    // line an input falls on.
    log("");
    log("determined vs inferred — the boundary, by input shape:");
    const bill = (id, billed, issueDate) => ({
        invoiceRecordId: id,
        invoiceId: `HYE-INV-2607${id}`,
        issueDate,
        billed,
    });

    // ONE bill on the ordered item: its delivered-against-billed IS this invoice's
    // answer. Nothing is guessed, and this is the common case.
    const single = allocateLineToInvoices({ delivered: 6, invoices: [bill("01", 10, "2026-07-01")] });
    check("one bill is determined", single.determinate, true);
    check("and it gets what was delivered", single.shares[0].arrived, 6);

    // TWO bills, delivery covers BOTH: satisfied whatever order they are taken in.
    const covered = allocateLineToInvoices({
        delivered: 80,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("two bills fully covered is determined", covered.determinate, true);
    check("both get their full amount", covered.shares.map((s) => s.arrived).join(","), "40,40");

    // TWO bills, NOTHING delivered: none is satisfied, likewise order-independent.
    const nothing = allocateLineToInvoices({
        delivered: 0,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("two bills with nothing delivered is determined", nothing.determinate, true);
    check("neither gets anything", nothing.shares.map((s) => s.arrived).join(","), "0,0");

    // TWO bills, delivery covers SOME: the only shape that needs inference.
    const split = allocateLineToInvoices({
        delivered: 40,
        invoices: [bill("02", 40, "2026-07-05"), bill("01", 40, "2026-07-01")],
    });
    check("two bills partly covered is INFERRED", split.determinate, false);
    check("the OLDEST bill is filled first", split.shares[0].invoiceId, "HYE-INV-260701");
    check("and it is the one treated as delivered", split.shares[0].arrived, 40);
    check("the newer one gets nothing", split.shares[1].arrived, 0);
    assert("every share carries the item's determinacy, not its own", split.shares.every((s) => s.determinate === false));

    // A partial fill is what a non-conforming case looks like: under the
    // containment premise 30 cannot satisfy a 40 bill, but the data does not
    // enforce the premise, so the fill must not throw or clamp to nothing.
    const partial = allocateLineToInvoices({
        delivered: 30,
        invoices: [bill("01", 40, "2026-07-01"), bill("02", 40, "2026-07-02")],
    });
    check("a non-conforming delivery still allocates greedily", partial.shares[0].arrived, 30);
    check("leaving the next bill empty", partial.shares[1].arrived, 0);
    check("and it is marked inferred", partial.determinate, false);

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
    log("an invoice's SHARE is the same measurement at a smaller scope:");
    const shareShort = invoiceShareStatus({ billed: 40, arrived: 0, determinate: false });
    check("billed but not delivered", shareShort.billedNotArrived, 40);
    check("verdict comes from the shared function", invoiceVerdictKey(shareShort), "nothing-delivered");
    check("determinacy is carried", shareShort.determinate, false);
    const shareFull = invoiceShareStatus({ billed: 40, arrived: 40 });
    check("covered", invoiceVerdictKey(shareFull), "all-delivered");
    check("determinate by default", shareFull.determinate, true);
    // Beyond-order facts belong to the ORDER, not to one bill, so a share carries
    // none of its own and the caller attaches the ordered item's.
    check("a share claims no beyond-order fact of its own", shareFull.arrivedBeyondOrder, 0);
    check("nor on the billing side", shareFull.billedBeyondOrder, 0);

    // --- THE SHARE LINE AND THE MARKER FIRE TOGETHER ----------------------
    log("");
    log("`This bill:` and the inferred marker are ONE condition, not two:");
    // The share line exists to explain why the answer had to be inferred, so the
    // two must not be able to appear apart. Pinned as an EQUALITY over every shape
    // above rather than as two independent expectations.
    const shapes = [
        ["one bill, partly delivered", invoiceShareStatus({ billed: 40, arrived: 10, determinate: true })],
        ["two bills, all delivered", invoiceShareStatus({ billed: 40, arrived: 40, determinate: true })],
        ["two bills, partly delivered", invoiceShareStatus({ billed: 40, arrived: 0, determinate: false })],
        ["nothing at all", invoiceShareStatus({ billed: 0, arrived: 0, determinate: true })],
        ["no ordered item", null],
    ];
    for (const [label, status] of shapes) {
        assert(
            `${label}: share line and marker agree`,
            showsThisBillShare(status) === (describeInvoiceLine(status, "EA").inferred !== null)
        );
    }
    check("a determined share shows neither", showsThisBillShare(shareFull), false);
    check("an inferred one shows both", showsThisBillShare(shareShort), true);
    // NARROWER than "more than one bill": two bills whose material all arrived need
    // no inference, so neither line appears.
    assert(
        "two fully covered bills need neither, though they share the ordered item",
        covered.shares.every((s) => showsThisBillShare(s) === false)
    );

    // --- the invoice summary ----------------------------------------------
    log("");
    log("an invoice summarizes by LINE COUNT, since lines carry different units:");
    const allArrived = summarizeInvoiceStatus([level, overShipped]);
    check("every line covered", allArrived.key, "delivered");
    check("counted behind the chip", `${allArrived.arrived}/${allArrived.judged}`, "2/2");
    const someArrived = summarizeInvoiceStatus([level, short]);
    check("one of two covered", someArrived.key, "partly-delivered");
    // NO LINE COMPLETE is not the same claim as NOTHING DELIVERED, and conflating
    // them made the column lie: a one-line invoice billing 13 with 10 delivered
    // read as "nothing". Found by reading seeded data.
    check("no line complete but some quantity delivered", summarizeInvoiceStatus([short]).key, "partly-delivered");
    check("  and the chip says partly, not awaiting", describeInvoiceColumn(summarizeInvoiceStatus([short])).text, "Partly delivered");
    check("  anyArrived says why", summarizeInvoiceStatus([short]).anyArrived, true);
    // Reserved for genuinely nothing.
    const trulyNone = summarizeInvoiceStatus([line(100, 80, 0), line(10, 5, 0)]);
    check("nothing delivered at all", trulyNone.key, "awaiting-delivery");
    check("  anyArrived is false", trulyNone.anyArrived, false);
    check("  and the chip is then true", describeInvoiceColumn(trulyNone).text, "Awaiting delivery");
    // Every line was free text, so there is nothing to compare. Distinct from
    // "nothing delivered", which is a measurement.
    const noneJudged = summarizeInvoiceStatus([], 3);
    check("nothing to compare", noneJudged.key, "no-ordered-items");
    check("and it says how many it did not judge", noneJudged.excludedCount, 3);
    assert(
        "which is NOT reported as awaiting-delivery — one is a measurement, the other is its absence",
        noneJudged.key !== "awaiting-delivery"
    );
    check("the beyond-order facts are carried for the detail", allArrived.anyArrivedBeyondOrder, true);
    check("  and the billed one separately", summarizeInvoiceStatus([overBilled]).anyBilledBeyondOrder, true);
    check("nullish lines do not throw", summarizeInvoiceStatus(null).key, "no-ordered-items");

    log("");
    log("one inferred line makes the whole invoice's answer inferred:");
    const est = invoiceShareStatus({ billed: 40, arrived: 0, determinate: false });
    const det = invoiceShareStatus({ billed: 40, arrived: 40, determinate: true });
    check("all determined", summarizeInvoiceStatus([det, det]).estimated, false);
    check("one inferred is enough — it does not average out", summarizeInvoiceStatus([det, est]).estimated, true);
    check("and the state is still measured normally", summarizeInvoiceStatus([det, est]).key, "partly-delivered");
    // lineStatus results carry no `determinate`, so an item-scope status must not
    // be mistaken for an inferred one.
    check("an item-scope status is not inferred", summarizeInvoiceStatus([level]).estimated, false);

    log("");
    log("the inferred qualifier is ONE entry at both densities, not a third axis:");
    assert(
        "the marker's tooltip and the detail sentence say the same thing",
        STATUS_COPY.column.inferred().text.replace("Inferred: ", "") ===
            STATUS_COPY.detail.inferred().text.replace("Inferred — ", "")
    );
    assert(
        "and it says why",
        STATUS_COPY.detail.inferred().text.includes("more than one bill") &&
            STATUS_COPY.detail.inferred().text.includes("oldest bill")
    );
    check("both share one key, so a check pins the branch not the wording", STATUS_COPY.column.inferred().key, STATUS_COPY.detail.inferred().key);
    // The whole point of making it an entry rather than an axis: the state copy is
    // not doubled. Four verdicts, one qualifier.
    check("the verdicts are not doubled by determinacy", Object.keys(STATUS_COPY.detail.verdict).length, 4);
    check("and the invoice chips are not either", Object.keys(STATUS_COPY.column.invoice).length, 4);

    log("");
    log("the containment premise is recorded as practice, not as a measured fact:");
    assert("it names what it assumes", CONTAINMENT_PREMISE.includes("contained entirely within one delivery"));
    assert(
        "and says the data does not enforce it",
        CONTAINMENT_PREMISE.includes("not a constraint the data enforces")
    );

    // --- the delivery summary ---------------------------------------------
    log("");
    log("a delivery summarizes over the ordered items its slices filled:");
    const none = summarizeDeliveryInvoicing([{ hasInvoice: false }, { hasInvoice: false }]);
    check("nothing invoiced — the vendor-chasing state", none.key, "awaiting-invoice");
    check("partly", summarizeDeliveryInvoicing([{ hasInvoice: true }, { hasInvoice: false }]).key, "partly-invoiced");
    check("all", summarizeDeliveryInvoicing([{ hasInvoice: true }]).key, "invoiced");
    check("no ordered items at all", summarizeDeliveryInvoicing([]).key, "no-ordered-items");
    check("nullish does not throw", summarizeDeliveryInvoicing(null).key, "no-ordered-items");

    // --- THE CHIPS ---------------------------------------------------------
    log("");
    log("a list cell is a CHIP: a closed set of values, and no figures:");
    check("everything delivered", describeInvoiceColumn(allArrived).text, "Delivered");
    check("  one line reads the same as several — no count leaks in", describeInvoiceColumn(summarizeInvoiceStatus([level])).text, "Delivered");
    check("some delivered", describeInvoiceColumn(someArrived).text, "Partly delivered");
    check("none delivered", describeInvoiceColumn(trulyNone).text, "Awaiting delivery");
    check("nothing to compare is a dash, not a phrase", describeInvoiceColumn(noneJudged).text, "—");
    check("invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([{ hasInvoice: true }])).text, "Invoiced");
    check("partly invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([{ hasInvoice: true }, { hasInvoice: false }])).text, "Partly invoiced");
    check("awaiting invoice", describeDeliveryColumn(none).text, "Awaiting invoice");
    check("nothing to compare", describeDeliveryColumn(summarizeDeliveryInvoicing([])).text, "—");

    // A FRACTION IS NOT A CHIP VALUE. It changes per row, so the set stops being
    // closed, and saying what it counts needs the words a one-line cell does not
    // have. The figures belong to the detail. Asserted rather than trusted,
    // because the previous version's column copy was exactly that.
    const everyChip = [
        ...Object.values(STATUS_COPY.column.invoice).map((f) => f({ judged: 2, arrived: 1, invoiced: 1, total: 2 })),
        ...Object.values(STATUS_COPY.column.delivery).map((f) => f({ invoiced: 1, total: 2 })),
        // #169's axis joins the sweep below rather than restating it: the
        // no-digit rule, the forbidden words and the verdict ban all apply to
        // these chips because they are in this list.
        ...Object.values(STATUS_COPY.column.po).map((f) => f({ ordered: 2, complete: 1 })),
    ];
    for (const chip of everyChip) {
        assert(`chip "${chip.text}" carries no figure`, !/\d/.test(chip.text));
    }
    // The tone is what makes the two lists one system rather than two palettes.
    check("both complete states share a tone", STATUS_COPY.column.invoice.delivered().tone, STATUS_COPY.column.delivery.invoiced().tone);
    check("both partial states too", STATUS_COPY.column.invoice["partly-delivered"]().tone, STATUS_COPY.column.delivery["partly-invoiced"]().tone);
    check("both empty states too", STATUS_COPY.column.invoice["awaiting-delivery"]().tone, STATUS_COPY.column.delivery["awaiting-invoice"]().tone);
    // `absent` is not a value of the set — it is the absence of one.
    check("and the dash is not dressed as a value", STATUS_COPY.column.invoice["no-ordered-items"]().tone, "absent");
    assert("every chip's key names its own text", everyChip.every((c) => c.key && c.text));

    // --- copy --------------------------------------------------------------
    log("");
    log("the detail's verdicts — the right BRANCH, pinned by key not wording:");
    const detail = (status, unit = "EA") => describeInvoiceLine(status, unit);
    check("covered", detail(shareFull).verdict.text, "All billed material delivered");
    check("short", detail(invoiceShareStatus({ billed: 13, arrived: 10 })).verdict.text, "3 EA more billed than delivered");
    check("nothing", detail(shareShort).verdict.text, "Nothing delivered yet");
    check("not compared", detail(null).verdict.text, "Not compared — no ordered item");
    // No figures where the box's own numbers line already carries them.
    assert("the covered verdict states no quantity", !/\d/.test(detail(shareFull).verdict.text));
    assert("nor does the empty one", !/\d/.test(detail(shareShort).verdict.text));
    assert(
        "the shortfall verdict states the difference, which IS the fact",
        detail(invoiceShareStatus({ billed: 13, arrived: 10 })).verdict.text.startsWith("3 EA")
    );
    assert(
        "a blank unit omits it rather than printing 'undefined'",
        !detail(invoiceShareStatus({ billed: 13, arrived: 10 }), "").verdict.text.includes("undefined")
    );

    log("");
    log("`Against the order:` is ONE line even when both sides exceed the order:");
    const withBoth = { ...invoiceShareStatus({ billed: 13, arrived: 10 }), arrivedBeyondOrder: 2, billedBeyondOrder: 3 };
    check("both terms, billed first", detail(withBoth).againstOrder.text, "Against the order: 3 EA more billed, 2 EA more delivered");
    check("delivery side alone", detail({ ...shareFull, arrivedBeyondOrder: 2 }).againstOrder.text, "Against the order: 2 EA more delivered");
    check("billing side alone", detail({ ...shareFull, billedBeyondOrder: 3 }).againstOrder.text, "Against the order: 3 EA more billed");
    check("neither, so the line is absent entirely", detail(shareFull).againstOrder, null);
    check("and it is absent for a not-compared line too", detail(null).againstOrder, null);

    log("");
    log("NAMED SLOTS, not a list — so a call site cannot color the asides:");
    // The first version returned a list and the page colored everything that was
    // not `matched`, which made all three amber and the color distinguish nothing.
    const slots = detail({ ...withBoth, determinate: false });
    check("the verdict is its own slot", slots.verdict.key, "billed-more");
    check("the aside is another", slots.againstOrder.key, "against-order");
    check("and the qualifier a third", slots.inferred.key, "inferred");
    assert(
        "the three slots are exactly what a box renders",
        Object.keys(slots).join(",") === "verdict,againstOrder,inferred"
    );

    log("");
    log("FACTS, NOT VERDICTS — and ONE WORD PER FACT:");
    const everySentence = [
        ...everyChip.map((c) => c.text),
        ...Object.values(STATUS_COPY.detail.verdict).map((f) => f(short, "EA").text),
        STATUS_COPY.detail.againstOrder(bothBeyond, "EA").text,
        STATUS_COPY.detail.inferred().text,
        STATUS_COPY.column.inferred().text,
    ];
    // At any one moment "the vendor over-billed" and "the rest has not been
    // delivered yet" are the same measurement, so the copy may not pick one.
    for (const forbidden of ["over-billed", "overbilled", "short-shipped", "underdelivered", "under-delivered", "missing"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    // ONE NAME PER FACT. `arrived` is the same fact as `delivered`, whose table is
    // `Deliveries` and whose rollup is `Delivered Qty`; `line` in this base is a
    // child of a Job; and this app does not say `Recorded as paid` either.
    for (const forbidden of ["arriv", "recorded as"]) {
        assert(
            `no message says "${forbidden}"`,
            !everySentence.some((t) => t.toLowerCase().includes(forbidden))
        );
    }
    assert(
        'no message calls an ordered item a "line"',
        !everySentence.some((t) => /\bline(s)?\b/i.test(t))
    );
    assert(
        "the shortfall message says 'more billed than delivered'",
        STATUS_COPY.detail.verdict["billed-more"](short, "EA").text.includes("more billed than delivered")
    );
    assert("every sentence is non-empty", everySentence.every((t) => t && t.length > 0));

    // --- THE FILTERS -------------------------------------------------------
    log("");
    log("the vendor-chasing filter takes BOTH incomplete states (#166):");
    // Filtering on the empty state alone would drop a delivery carrying two
    // materials where only one is billed — which is exactly "it is here and there
    // is no invoice for it", the thing this list exists to catch.
    check("nothing invoiced", isNotFullyInvoiced("awaiting-invoice"), true);
    check("partly invoiced", isNotFullyInvoiced("partly-invoiced"), true);
    check("fully invoiced is out", isNotFullyInvoiced("invoiced"), false);
    check("nothing to compare is out", isNotFullyInvoiced("no-ordered-items"), false);
    check("a null key does not throw", isNotFullyInvoiced(null), false);

    log("");
    log("and it exists for EVERY viewer since #211:");
    // A `resolveDeliveryFilters` rule was pinned here, and five checks with it. It
    // existed to treat `?unbilled=1` as ABSENT for a viewer whose rows carried no
    // invoicing key, because getDeliveryInvoicing was not called for them. #211
    // released that withholding, which left the rule with nothing to decide, so it
    // was deleted rather than left standing. What replaces those checks is the
    // assertion that it is really gone — a re-added gate would be a second answer to
    // a question this repo has now settled once.
    assert(
        "the withheld-filter rule is gone from the module",
        !("resolveDeliveryFilters" in deliveryStatus)
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
    check("an undated delivery sorts LAST, not first", withUndated.at(-1).id, "z");
    check("nullish does not throw", sortLongestWaitingFirst(null).length, 0);
    check("a single row is returned as-is", sortLongestWaitingFirst([rows[0]])[0].id, "b");

    // ── the PO axis: delivered against ORDERED (#169) ───────────────────────
    log("");
    log("poLineDelivery — one ordered item against its own order:");
    const poLine = (orderedQty, deliveredQty, committedQty = orderedQty) =>
        ({ orderedQty, deliveredQty, committedQty });

    check("nothing delivered is not complete", poLineDelivery(poLine(10, 0)).complete, false);
    check("and reports no delivery at all", poLineDelivery(poLine(10, 0)).anyDelivered, false);
    check("part delivered is not complete", poLineDelivery(poLine(10, 4)).complete, false);
    check("but does report a delivery", poLineDelivery(poLine(10, 4)).anyDelivered, true);
    check("exactly the ordered quantity IS complete", poLineDelivery(poLine(10, 10)).complete, true);
    // Over-delivery clears the line rather than overshooting into a state of its
    // own. The within/beyond split #166 needs is exactly what this axis does not.
    check("more than ordered is complete too", poLineDelivery(poLine(10, 13)).complete, true);
    check("a blank rollup reads as nothing delivered", poLineDelivery({ orderedQty: 10, committedQty: 10 }).delivered, 0);
    check("nullish input does not throw", poLineDelivery().complete, true);

    log("");
    log("summarizePODeliveryStatus — counts ordered items, never quantities:");
    const summary = (lines) => summarizePODeliveryStatus(lines).key;
    check("every item complete", summary([poLine(10, 10), poLine(5, 5)]), "delivered");
    check("no quantity at all", summary([poLine(10, 0), poLine(5, 0)]), "awaiting-delivery");
    check("some items complete", summary([poLine(10, 10), poLine(5, 0)]), "partly-delivered");
    // #166'S LESSON, PAID FORWARD RATHER THAN RE-LEARNED. Keying the empty state
    // on the completed COUNT made a one-item order of 13 with 10 delivered read as
    // nothing delivered. This is the case that caught it there.
    check("ONE item, part delivered, is partly — not awaiting", summary([poLine(13, 10)]), "partly-delivered");
    check("part of one item on a two-item order is partly", summary([poLine(10, 1), poLine(5, 0)]), "partly-delivered");
    check("an order with no items at all", summary([]), "nothing-ordered");
    check("nullish does not throw", summary(null), "nothing-ordered");

    // MIXED UNITS ARE WHY IT COUNTS ITEMS. Summing 5 SHEET and 5 FT gives a
    // number of nothing, so the shape below must not read as half-delivered:
    // both items are complete on their own terms.
    check(
        "two items in different units, each complete, is delivered",
        summary([poLine(5, 5), poLine(500, 500)]),
        "delivered"
    );

    log("");
    log("withdrawn orders fall out through countsAsOrdered, not a status string:");
    // A withdrawn PO's every line has Committed Qty 0 (#18's formula), so the
    // judged set empties and the chip is the dash.
    const withdrawn = [poLine(10, 10, 0), poLine(5, 0, 0)];
    check("a withdrawn order reports nothing-ordered", summary(withdrawn), "nothing-ordered");
    // ANTI-VACUITY #1. The assertion above also passes if the summarizer ignored
    // its input, returned the dash for everything, or received an empty array. The
    // SAME lines with a live Committed Qty must therefore reach a different
    // answer — that is what shows countsAsOrdered is the thing doing the work.
    check(
        "the same lines with a live Committed Qty do NOT",
        summary([poLine(10, 10, 10), poLine(5, 0, 5)]),
        "partly-delivered"
    );
    check("a Qty-0 line on a live order is excluded too", summary([poLine(10, 10), poLine(0, 0, 0)]), "delivered");
    check("judged counts only the lines that count", summarizePODeliveryStatus(withdrawn).ordered, 0);

    log("");
    log("the chip — the invoice axis's own words, not a fourth vocabulary:");
    // ANTI-VACUITY #2. The words are claimed to be REUSED, and nothing else here
    // would notice one axis being edited without the other. Comparing the two maps
    // is the claim itself rather than a restatement of either.
    for (const key of ["delivered", "partly-delivered", "awaiting-delivery"]) {
        check(
            `"${key}" reads identically on both axes`,
            STATUS_COPY.column.po[key]().text,
            STATUS_COPY.column.invoice[key]().text
        );
        check(
            `and carries the same tone`,
            STATUS_COPY.column.po[key]().tone,
            STATUS_COPY.column.invoice[key]().tone
        );
    }
    // The dash is the one key that is NOT shared, because it is not the same fact.
    assert(
        "the dash key is named after the predicate, not after the invoice axis's case",
        Object.keys(STATUS_COPY.column.po).includes("nothing-ordered") &&
            !Object.keys(STATUS_COPY.column.po).includes("no-ordered-items")
    );
    check("and it renders as a dash", STATUS_COPY.column.po["nothing-ordered"]().text, "—");
    check("with the absent tone, so it is not a chip", STATUS_COPY.column.po["nothing-ordered"]().tone, "absent");

    // Every key the summarizer can produce has copy. A missing entry would throw
    // at render time on a page nobody exercised, which is the failure this catches.
    for (const lines of [[poLine(10, 10)], [poLine(10, 0)], [poLine(10, 4)], []]) {
        const s = summarizePODeliveryStatus(lines);
        assert(`describePOColumn resolves "${s.key}"`, Boolean(describePOColumn(s)?.text));
    }
}

if (isMain(import.meta.url)) standalone(title, run);
