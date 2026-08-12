// Delivered against invoiced against ordered (#166, #210) — the pure judgment.
//
// The rule is two comparisons rather than an enumeration of cases, so this pins
// the comparisons and the states that fall out of them, not a case list. What it
// cannot reach is the query budget and the actual Airtable values, which are
// Airtable's properties and live in scripts/tests/verify-delivery-status-166.mjs.
//
// #210 REMOVED AN INFERENCE, AND "IT IS GONE" IS A CLAIM ABOUT SOURCE RATHER THAN
// ABOUT BEHAVIOR. A deleted allocator cannot be exercised, so the last section
// asserts it on the AST: four identifiers must appear nowhere in the module, and
// two that LOOK like they belong on the same list must still be exported, because
// #167 imports them. Both halves carry anti-vacuity, since "the walk found nothing"
// and "the identifier is absent" are the same result.
//
// WHAT A PASS DOES NOT PROVE. That the figures handed to lineStatus were the right
// ones. This file pins what the rule does with four numbers; whether `invoicedQty`
// really came from the ordered item's rollup rather than one invoice's own lines,
// whether the two delivered figures were split on `Over Delivered`, and whether
// `arrived` really came from the shipment the invoice NAMES, are properties of
// lib/deliveryReconciliation.js and are measured credentialed.

import {
    STATUS_COPY,
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
    sharesOrderedItem,
    summarizePODeliveryStatus,
    sortInvoicesOldestFirst,
    sortLongestWaitingFirst,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "../../../lib/deliveryStatus.js";
// The namespace too, so the module's own export list can be asserted on — #211
// deleted one export and #210 deleted four more, and "it is gone" is not a claim a
// named import can make.
import * as deliveryStatus from "../../../lib/deliveryStatus.js";
import { parseFile, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery status — delivered vs invoiced vs ordered (#166, #210)";

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

    // --- THE CLAMP, WHICH MOVED IN #210 -----------------------------------
    log("");
    log("a share is CLAMPED at what its own bill billed, and the clamp is here now:");
    // It used to live in allocateLineToInvoices, which took `min(left, billed)` while
    // filling. With the pairing stored, `arrived` is a lookup — the linked shipment's
    // own slices on this ordered item — and that lookup can legitimately be LARGER
    // than this bill, because a shipment may carry material nobody has billed yet.
    // So the clamp had to move here, or `delivered > invoiced` would become reachable
    // and the two deleted verdicts would need writing again.
    const surplusShipment = invoiceShareStatus({ billed: 10, arrived: 25 });
    check("a shipment carrying more than this bill does not overflow it", surplusShipment.delivered, 10);
    check("  so the reverse direction stays 0", surplusShipment.arrivedNotBilled, 0);
    check("  and the verdict is simply covered", invoiceVerdictKey(surplusShipment), "all-delivered");
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

    // --- THE INVOICE AXIS: TWO STATES AND A DISCREPANCY (#210) -------------
    log("");
    log("the chip comes from the LINK, not from the quantities:");
    const covered = invoiceShareStatus({ billed: 40, arrived: 40 });
    const shortShare = invoiceShareStatus({ billed: 40, arrived: 0 });
    const partShare = invoiceShareStatus({ billed: 13, arrived: 10 });

    const paired = summarizeInvoiceStatus({ lines: [covered], hasDelivery: true });
    const unpaired = summarizeInvoiceStatus({ lines: [shortShare], hasDelivery: false });
    check("a shipment named", paired.key, "delivered");
    check("none named", unpaired.key, "awaiting-delivery");
    check("  which is the correct reading, not a gap", describeInvoiceColumn(unpaired).text, "Awaiting delivery");
    // THE STATE THE OLD INFERENCE MANUFACTURED. A bill whose own shipment has not
    // arrived used to land in `Partly delivered` whenever some earlier delivery had
    // touched the same ordered item. There is no such state to land in now.
    assert(
        "there is no middle stage on this axis at all",
        Object.keys(STATUS_COPY.column.invoice).join(",") === "delivered,awaiting-delivery"
    );
    assert(
        "  and no dash either — the chip no longer depends on there being a line to judge",
        !("no-ordered-items" in STATUS_COPY.column.invoice)
    );
    // An invoice with no judgeable line still has an answer, which is why the dash
    // became unreachable rather than merely unwanted.
    check(
        "every line free text, shipment named, still reads Delivered",
        summarizeInvoiceStatus({ lines: [], hasDelivery: true, excludedCount: 3 }).key,
        "delivered"
    );
    check("  and it still says how many it did not judge", summarizeInvoiceStatus({ lines: [], hasDelivery: true, excludedCount: 3 }).excludedCount, 3);
    check("no argument does not throw", summarizeInvoiceStatus().key, "awaiting-delivery");

    log("");
    log("a quantity shortfall is a MARKER beside the chip, never a third value:");
    check("the shipment brought everything billed", paired.mismatch, false);
    check("it brought less", summarizeInvoiceStatus({ lines: [partShare], hasDelivery: true }).mismatch, true);
    check("  and the chip is unchanged by that", summarizeInvoiceStatus({ lines: [partShare], hasDelivery: true }).key, "delivered");
    check("one short line among covered ones is enough", summarizeInvoiceStatus({ lines: [covered, partShare], hasDelivery: true }).mismatch, true);
    check("  and it reports how many were covered", summarizeInvoiceStatus({ lines: [covered, partShare], hasDelivery: true }).covered, 1);
    // NO MARKER WITHOUT A LINK. Every line of an unpaired invoice is trivially
    // short, so marking them would put a discrepancy on every invoice the vendor has
    // emailed ahead of the material — which is most of them.
    check("nothing linked shows no marker, though every line is short", unpaired.mismatch, false);
    assert(
        "which is the whole point: the marker is about a comparison, and there is none",
        summarizeInvoiceStatus({ lines: [shortShare, partShare], hasDelivery: false }).mismatch === false
    );

    log("");
    log("the mismatch marker's own sentence:");
    check("one key, so a check pins the branch not the wording", STATUS_COPY.column.mismatch().key, "mismatch");
    assert("it says what is mismatched", STATUS_COPY.column.mismatch().text.includes("bills more than"));
    assert(
        "it names the shipment as the thing compared against",
        STATUS_COPY.column.mismatch().text.includes("the delivery it names")
    );
    // ONE DENSITY, unlike the qualifier it replaces: the detail states the shortfall
    // with its figures through the verdict, so there is no second sentence to keep in
    // step with this one.
    assert("and there is no detail-density twin to drift from it", !("mismatch" in STATUS_COPY.detail));

    log("");
    log("`This bill:` now fires on a FACT rather than on a guess (#210):");
    // It used to appear exactly when the answer had been inferred, which made it an
    // explanation of the guess. What is left is the plain fact that the ordered item
    // carries another bill, which the box's own `Billed` figure would otherwise be
    // mistaken for this invoice's.
    check(
        "this bill is the only one on the ordered item",
        sharesOrderedItem({ billedOnThisInvoice: 13, line: line(20, 13, 13) }),
        false
    );
    check(
        "another bill shares it",
        sharesOrderedItem({ billedOnThisInvoice: 5, line: line(20, 13, 13) }),
        true
    );
    // `<` rather than `!==`: a rollup that read SMALLER than this bill would print
    // `This bill: 13 of 5`, so silence is the safer direction.
    check(
        "a rollup reading smaller than this bill stays silent",
        sharesOrderedItem({ billedOnThisInvoice: 13, line: line(20, 5, 5) }),
        false
    );
    check("no ordered item, no line", sharesOrderedItem({ billedOnThisInvoice: 5, line: null }), false);
    check("no argument does not throw", sharesOrderedItem(), false);

    log("");
    log("oldest bill first — kept for #167, unchanged: Issue Date asc, then Invoice ID:");
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
    check("billed but not delivered", shortShare.billedNotArrived, 40);
    check("verdict comes from the shared function", invoiceVerdictKey(shortShare), "nothing-delivered");
    check("covered", invoiceVerdictKey(covered), "all-delivered");
    // Beyond-order facts belong to the ORDER, not to one bill, so a share carries
    // none of its own and the caller attaches the ordered item's.
    check("a share claims no beyond-order fact of its own", covered.arrivedBeyondOrder, 0);
    check("nor on the billing side", covered.billedBeyondOrder, 0);
    check("no argument does not throw", invoiceShareStatus().invoiced, 0);

    // --- the delivery axis: QUANTITIES, NOT AN EXISTENCE TEST (#210) --------
    log("");
    log("a delivery is invoiced when the bills NAMING IT cover what it brought:");
    const dl = (arrived, billed) => ({ poItemRecordId: `recPOI${arrived}${billed}`, arrived, billed });
    check("nothing billed — the vendor-chasing state", summarizeDeliveryInvoicing([dl(10, 0), dl(5, 0)]).key, "awaiting-invoice");
    check("both ordered items billed in full", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 5)]).key, "invoiced");
    check("one of two billed", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)]).key, "partly-invoiced");
    // THE CASE THE ISSUE IS ABOUT, ONE LEVEL DOWN. A shipment can carry material
    // nobody has billed yet, so "does this delivery have an invoice" would read
    // `Invoiced` while half of it is still owed. That is why the three keys survive
    // and why the comparison is per ordered item rather than a bare lookup.
    check("a shipment of two materials with one bill is PARTLY, not invoiced", summarizeDeliveryInvoicing([dl(10, 10), dl(8, 0)]).key, "partly-invoiced");
    check("part of one ordered item billed is partly too", summarizeDeliveryInvoicing([dl(10, 4)]).key, "partly-invoiced");
    // The key is what separates "part of it is billed" from "none of it is", and it
    // is the only thing that does — the predicate behind it stays a local rather than
    // becoming a returned field no screen reads.
    check("  while nothing billed at all is the other state", summarizeDeliveryInvoicing([dl(10, 0)]).key, "awaiting-invoice");
    check("no ordered items at all", summarizeDeliveryInvoicing([]).key, "no-ordered-items");
    check("nullish does not throw", summarizeDeliveryInvoicing(null).key, "no-ordered-items");
    // A vendor billing MORE than it shipped is the INVOICE axis's discrepancy; from
    // the delivery's side there is nothing left to chase, so `>=` rather than `===`.
    check("billed more than arrived leaves nothing to chase here", summarizeDeliveryInvoicing([dl(10, 14)]).key, "invoiced");
    check("counts the ordered items it judged", summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)]).total, 2);

    // --- THE CHIPS ---------------------------------------------------------
    log("");
    log("a list cell is a CHIP: a closed set of values, and no figures:");
    check("shipment named", describeInvoiceColumn(paired).text, "Delivered");
    check("none named", describeInvoiceColumn(unpaired).text, "Awaiting delivery");
    check("invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 10)])).text, "Invoiced");
    check("partly invoiced", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 10), dl(5, 0)])).text, "Partly invoiced");
    check("awaiting invoice", describeDeliveryColumn(summarizeDeliveryInvoicing([dl(10, 0)])).text, "Awaiting invoice");
    check("nothing to compare", describeDeliveryColumn(summarizeDeliveryInvoicing([])).text, "—");

    // A FRACTION IS NOT A CHIP VALUE. It changes per row, so the set stops being
    // closed, and saying what it counts needs the words a one-line cell does not
    // have. The figures belong to the detail. Asserted rather than trusted,
    // because the previous version's column copy was exactly that.
    const everyChip = [
        ...Object.values(STATUS_COPY.column.invoice).map((f) => f({ judged: 2, covered: 1 })),
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
    check("both empty states too", STATUS_COPY.column.invoice["awaiting-delivery"]().tone, STATUS_COPY.column.delivery["awaiting-invoice"]().tone);
    // `absent` is not a value of the set — it is the absence of one. Only the
    // delivery axis still has one, since the invoice chip no longer depends on
    // having a line to judge.
    check("and the dash is not dressed as a value", STATUS_COPY.column.delivery["no-ordered-items"]().tone, "absent");
    assert("every chip's key names its own text", everyChip.every((c) => c.key && c.text));

    // --- copy --------------------------------------------------------------
    log("");
    log("the detail's verdicts — the right BRANCH, pinned by key not wording:");
    const detail = (status, unit = "EA") => describeInvoiceLine(status, unit);
    check("covered", detail(covered).verdict.text, "All billed material delivered");
    check("short", detail(partShare).verdict.text, "3 EA more billed than delivered");
    check("nothing", detail(shortShare).verdict.text, "Nothing delivered yet");
    check("not compared", detail(null).verdict.text, "Not compared — no ordered item");
    // No figures where the box's own numbers line already carries them.
    assert("the covered verdict states no quantity", !/\d/.test(detail(covered).verdict.text));
    assert("nor does the empty one", !/\d/.test(detail(shortShare).verdict.text));
    assert(
        "the shortfall verdict states the difference, which IS the fact",
        detail(partShare).verdict.text.startsWith("3 EA")
    );
    assert(
        "a blank unit omits it rather than printing 'undefined'",
        !detail(partShare, "").verdict.text.includes("undefined")
    );

    log("");
    log("`Against the order:` is ONE line even when both sides exceed the order:");
    const withBoth = { ...partShare, arrivedBeyondOrder: 2, billedBeyondOrder: 3 };
    check("both terms, billed first", detail(withBoth).againstOrder.text, "Against the order: 3 EA more billed, 2 EA more delivered");
    check("delivery side alone", detail({ ...covered, arrivedBeyondOrder: 2 }).againstOrder.text, "Against the order: 2 EA more delivered");
    check("billing side alone", detail({ ...covered, billedBeyondOrder: 3 }).againstOrder.text, "Against the order: 3 EA more billed");
    check("neither, so the line is absent entirely", detail(covered).againstOrder, null);
    check("and it is absent for a not-compared line too", detail(null).againstOrder, null);

    log("");
    log("NAMED SLOTS, not a list — so a call site cannot color the asides:");
    // The first version returned a list and the page colored everything that was
    // not `matched`, which made all three amber and the color distinguish nothing.
    const slots = detail(withBoth);
    check("the verdict is its own slot", slots.verdict.key, "billed-more");
    check("and the aside is another", slots.againstOrder.key, "against-order");
    // TWO SLOTS SINCE #210: the third explained a guess that no longer happens.
    assert(
        "the two slots are exactly what a box renders",
        Object.keys(slots).join(",") === "verdict,againstOrder"
    );

    log("");
    log("FACTS, NOT VERDICTS — and ONE WORD PER FACT:");
    const everySentence = [
        ...everyChip.map((c) => c.text),
        ...Object.values(STATUS_COPY.detail.verdict).map((f) => f(short, "EA").text),
        STATUS_COPY.detail.againstOrder(bothBeyond, "EA").text,
        STATUS_COPY.column.mismatch().text,
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
    // nothing delivered.
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
    log("the chip — the invoice axis's own words, and #210 left TWO of the three:");
    // ANTI-VACUITY #2. The words are claimed to be REUSED, and nothing else here
    // would notice one axis being edited without the other. Comparing the two maps
    // is the claim itself rather than a restatement of either.
    for (const key of ["delivered", "awaiting-delivery"]) {
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
    // `partly-delivered` HAS NO SIBLING TO BE COMPARED WITH ANY MORE, and saying so
    // is the honest form of this check. #210 took the middle stage off the invoice
    // axis, where it read as progress toward a whole; here an order really is filled
    // item by item over time, so it stays — and nothing now pins its wording, which
    // is a fact about the coverage rather than a gap to paper over.
    assert(
        "the middle stage is the PO axis's alone now",
        "partly-delivered" in STATUS_COPY.column.po &&
            !("partly-delivered" in STATUS_COPY.column.invoice)
    );
    check("and it still reads as it did", STATUS_COPY.column.po["partly-delivered"]().text, "Partly delivered");
    // The dash is the one key that is NOT shared, because it is not the same fact.
    assert(
        "the dash key is named after the predicate, not after the delivery axis's case",
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

    // ── #210: THE INFERENCE IS GONE, ON THE AST ─────────────────────────────
    //
    // ON THE SOURCE RATHER THAN ON THE NAMESPACE, and the difference matters. A
    // namespace check can only see EXPORTS, so a `determinate` still threaded
    // through a local object or a `showsThisBillShare` kept as an internal helper
    // would both pass it. The claim is that the inference left the module, so the
    // instrument has to be able to see inside it.
    //
    // ON THE AST RATHER THAN BY GREP, for the reason offline/invoice-visibility.mjs
    // gives about `.paid`: this module explains at LENGTH what it removed and why,
    // so its comments are full of the words below and a text search would fail on
    // its own documentation.
    log("");
    log("#210 — the inference left the module, asserted on the AST:");
    const { ast } = parseFile("lib/deliveryStatus.js");

    const identifiers = new Set();
    const propertyKeys = new Set();
    let sawAnyNode = false;
    walk(ast, (node) => {
        sawAnyNode = true;
        if (node.type === "Identifier") identifiers.add(node.name);
        if (node.type === "Property") {
            if (node.key?.name) propertyKeys.add(node.key.name);
            if (typeof node.key?.value === "string") propertyKeys.add(node.key.value);
        }
    });

    // The four names #210 removed. Each was load-bearing for the estimate and none
    // has anything left to mean: `determinate` was the allocator's flag,
    // `showsThisBillShare` read it, `estimated` was the invoice-level roll-up of it,
    // and `inferred` was the copy that explained it.
    for (const gone of ["determinate", "showsThisBillShare", "estimated", "inferred"]) {
        assert(`\`${gone}\` appears nowhere in lib/deliveryStatus.js`, !identifiers.has(gone));
        assert(`  nor as an object key`, !propertyKeys.has(gone));
    }
    // The allocator itself, and the premise constant that justified it.
    assert("`allocateLineToInvoices` is gone", !identifiers.has("allocateLineToInvoices"));
    assert("  and is no longer exported", !("allocateLineToInvoices" in deliveryStatus));
    assert("`CONTAINMENT_PREMISE` is gone with it", !("CONTAINMENT_PREMISE" in deliveryStatus));

    // THE TWO THAT MUST SURVIVE, and they look exactly like the list above. #167's
    // `selectOverageBill` asks a different question — which bill's line carries an
    // over-delivered excess — and still infers, because reading that off the stored
    // pairing needs its `spansInvoices` refusal rethought and is #210's stated
    // non-goal. Deleting either breaks the overage flow, and nothing in this module
    // reads either, so a tidy-up would.
    assert("`sortInvoicesOldestFirst` is still exported, for #167", typeof deliveryStatus.sortInvoicesOldestFirst === "function");
    assert("`INFERRED_PREMISE` is still exported, for #167", typeof deliveryStatus.INFERRED_PREMISE === "string");
    assert("  and it is not empty", deliveryStatus.INFERRED_PREMISE.length > 0);
    // NARROWED IN THE SAME PASS: it used to say "and the deliveries cannot be told
    // apart", which the stored pairing made false.
    assert(
        "  and no longer claims the deliveries cannot be told apart",
        !deliveryStatus.INFERRED_PREMISE.includes("cannot be told apart")
    );

    // ANTI-VACUITY FOR THE WHOLE SECTION. Every assertion above is of the form "this
    // identifier is absent", which is also what a walk that visited nothing reports —
    // and what a parse of the wrong file reports. So the same two sets must be seen
    // to contain things that ARE in the module.
    log("");
    log("  anti-vacuity — the walk is seen to find what it is looking for:");
    assert("the AST walk visited nodes at all", sawAnyNode);
    assert("it sees identifiers", identifiers.has("summarizeInvoiceStatus"));
    assert("  including one #210 ADDED, so it is reading the new file", identifiers.has("sharesOrderedItem"));
    assert("it sees object keys", propertyKeys.has("billedNotArrived"));
    assert("  including one #210 added", propertyKeys.has("mismatch"));
    // A control on the negative direction too: a name that is genuinely absent and
    // has never been in this module must also come back absent, or the sets are
    // matching everything.
    assert("and it does not report a name that was never there", !identifiers.has("allocateLineToDeliveries"));
}

if (isMain(import.meta.url)) standalone(title, run);
