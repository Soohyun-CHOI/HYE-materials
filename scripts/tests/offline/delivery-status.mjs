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
// really came from the ordered item's rollup rather than one invoice's own invoice
// items, whether the two delivered figures were split on `Over Delivered`, and
// whether `arrived` really came from the shipment the invoice NAMES, are
// properties of lib/deliveryReconciliation.js and are measured credentialed.

import {
    AWAITING_INVOICE_COPY,
    daysWaiting,
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
    summarizePODeliveryStatus,
    summarizePOInvoicingStatus,
    describePOInvoicingColumn,
    poLineInvoicing,
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
    // FOUR JUDGMENTS, THREE SENTENCES (#232). Two of the original six were deleted in
    // #210 for being unreachable; `all-delivered` is reachable and has no copy, which
    // is a different thing — a box that agrees says nothing, and the chip beside the
    // section heading is what states it. The KEY survives, because it is what
    // describeInvoiceLine reads to decide there is nothing to say.
    const everyJudgment = new Set([
        invoiceVerdictKey(surplusShipment),
        invoiceVerdictKey(line(100, 80, 50)),
        invoiceVerdictKey(line(100, 80, 0)),
        invoiceVerdictKey(null),
    ]);
    check("the judgment still has four branches", everyJudgment.size, 4);
    check("and only three of them are sentences", Object.keys(STATUS_COPY.detail.verdict).length, 3);
    assert("`all-delivered` is the one with no sentence", !("all-delivered" in STATUS_COPY.detail.verdict));
    // AND THE FUNCTION AGREES WITH THE TABLE, asserted HERE rather than only in the
    // #232 section below, because every call after this line hands a covered status to
    // describeInvoiceLine: a `speaks` reopened for `all-delivered` without its copy
    // branch throws, and this is the last point at which that reports as a failure
    // rather than as a stack trace. Caught for the same reason.
    check(
        "  and describeInvoiceLine reaches for no sentence it has not got",
        (() => {
            try {
                return describeInvoiceLine(surplusShipment, "EA", { hasDelivery: true }).verdict;
            } catch (err) {
                return `THREW: ${err.message}`;
            }
        })(),
        null
    );
    assert(
        "and delivered-beyond-billed is stated against the ORDERED ITEM instead",
        describeInvoiceLine(
            { ...invoiceShareStatus({ billed: 10, arrived: 10 }), arrivedBeyondOrder: 3 },
            "EA",
            { hasDelivery: true }
        ).againstOrder?.text === "Against the ordered item: 3 EA more delivered"
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
        describeInvoiceLine(null, "EA").verdict?.text,
        "Not compared — no ordered item"
    );

    // --- THE INVOICE AXIS: THREE OUTCOMES SINCE #232 -----------------------
    log("");
    log("the FIRST question is the link, not the quantities:");
    const covered = invoiceShareStatus({ billed: 40, arrived: 40 });
    const shortShare = invoiceShareStatus({ billed: 40, arrived: 0 });
    const partShare = invoiceShareStatus({ billed: 13, arrived: 10 });

    const paired = summarizeInvoiceStatus({ lines: [covered], hasDelivery: true });
    const unpaired = summarizeInvoiceStatus({ lines: [shortShare], hasDelivery: false });
    check("a delivery matched and it covered the bill", paired.key, "delivered");
    check("none matched", unpaired.key, "awaiting-delivery");
    check("  which is the correct reading, not a gap", describeInvoiceColumn(unpaired).text, "Awaiting delivery");

    log("");
    log("the SECOND is whether it covered the bill — a chip value since #232:");
    // It was a MARKER for two issues, composing with `Delivered`. It composed with
    // exactly one value and its sentence sat in a tooltip, so it is a chip value now.
    const shortSummary = summarizeInvoiceStatus({ lines: [partShare], hasDelivery: true });
    check("the matched delivery brought less than the bill", shortSummary.key, "mismatch");
    check("  and the chip says so in a word", describeInvoiceColumn(shortSummary).text, "Mismatch");
    check(
        "one short line among covered ones is enough",
        summarizeInvoiceStatus({ lines: [covered, partShare], hasDelivery: true }).key,
        "mismatch"
    );
    check(
        "  and it still reports how many were covered",
        summarizeInvoiceStatus({ lines: [covered, partShare], hasDelivery: true }).covered,
        1
    );
    // NO MISMATCH WITHOUT A MATCH. Every invoice item of an unmatched invoice is
    // trivially short, so reporting them would put a discrepancy on every invoice the
    // vendor emailed ahead of the material — which is most of them. The clause order
    // in summarizeInvoiceStatus is what guarantees it.
    check("nothing matched reads as awaiting, though every line is short", unpaired.key, "awaiting-delivery");
    check(
        "  and two short lines with nothing matched still do",
        summarizeInvoiceStatus({ lines: [shortShare, partShare], hasDelivery: false }).key,
        "awaiting-delivery"
    );

    log("");
    log("THREE values and the middle stage is still barred:");
    assert(
        "the set is the link's two states plus the discrepancy",
        Object.keys(STATUS_COPY.column.invoice).join(",") === "delivered,mismatch,awaiting-delivery"
    );
    // #210 REMOVED A STAGE WORD AND #232 ADDED AN ERROR WORD, which is why the two do
    // not collide: under the one-delivery premise nothing further is coming, so a
    // shortSummary cannot be a middle. `Partly delivered` stays barred here and stays on
    // the PO axis, where an order really is filled item by item.
    assert(
        "no stage word came back with it",
        !("partly-delivered" in STATUS_COPY.column.invoice) &&
            "partly-delivered" in STATUS_COPY.column.po
    );
    assert(
        "  and no chip on this axis says the word at all",
        !Object.values(STATUS_COPY.column.invoice)
            .map((f) => f().text)
            .some((t) => /partly/i.test(t))
    );
    assert(
        "and no dash either — the chip no longer depends on there being a line to judge",
        !("no-ordered-items" in STATUS_COPY.column.invoice)
    );
    // ITS OWN TONE, so the palette cannot say a stage and an error with one color.
    check("the discrepancy has a tone of its own", describeInvoiceColumn(shortSummary).tone, "mismatch");
    assert(
        "  which is not the tone a stage wears on the other axis",
        describeInvoiceColumn(shortSummary).tone !== STATUS_COPY.column.delivery["partly-invoiced"]().tone
    );
    // An invoice with no judgeable invoice item still has an answer, which is why
    // the dash became unreachable rather than merely unwanted.
    check(
        "every line free text, a delivery matched, still reads Delivered",
        summarizeInvoiceStatus({ lines: [], hasDelivery: true, excludedCount: 3 }).key,
        "delivered"
    );
    check("  and it still says how many it did not judge", summarizeInvoiceStatus({ lines: [], hasDelivery: true, excludedCount: 3 }).excludedCount, 3);
    check("no argument does not throw", summarizeInvoiceStatus().key, "awaiting-delivery");

    log("");
    log("the `mismatch` BOOLEAN is gone — the key carries it (#232):");
    // Two representations of one fact is one more thing for #182 to find, the same
    // call this function made on `anyArrived`. Every screen asks `key === "mismatch"`.
    for (const s of [paired, unpaired, shortSummary]) {
        assert(`\`${s.key}\` carries no separate mismatch flag`, !("mismatch" in s));
    }
    // ANTI-VACUITY: the objects checked must be the real summaries.
    assert("  and those are real summaries", [paired, unpaired, shortSummary].every((s) => "judged" in s));

    log("");
    log("the discrepancy's SENTENCE is detail-density now, and the chip label is gone:");
    // The marker's tooltip was chip-density and is retired with the marker. What is
    // left is one sentence with an action in it, shaped like the variance prompt on
    // the same page — so the twin this file used to assert against is now the point.
    assert("no chip-density label survives", !("mismatch" in STATUS_COPY.column));
    check("one key, so a check pins the branch not the wording", STATUS_COPY.detail.mismatch().key, "mismatch");
    const mismatchSentence = STATUS_COPY.detail.mismatch().text;
    assert("it says what is mismatched", mismatchSentence.includes("bills more than"));
    assert(
        "it names the matched delivery as the thing compared against",
        mismatchSentence.includes("the delivery matched to it")
    );
    // AND IT SAYS WHAT TO DO, which is the half a chip word cannot carry and the
    // reason this is a box rather than a tooltip.
    assert("it names someone to take it up with", /vendor/.test(mismatchSentence));
    assert("  and what to hold until then", /before confirming payment/.test(mismatchSentence));
    // NO FIGURE: one invoice can be short on two ordered items carrying different
    // Units, so a figure here would be a sum of nothing or one of several. The boxes
    // below carry one each.
    assert("and no quantity, that being the boxes' job", !/\d/.test(mismatchSentence));
    // A FACT, NOT A VERDICT — the rule the verdicts follow, applied to the one
    // sentence on this screen that asks for something.
    for (const forbidden of ["over-billed", "short-shipped", "missing"]) {
        assert(`it does not say '${forbidden}'`, !mismatchSentence.toLowerCase().includes(forbidden));
    }

    log("");
    log("`sharesOrderedItem` and its `This bill:` line are GONE (#232):");
    // It captioned a `Billed` figure that was the ordered item's total across every
    // invoice. #232 scoped that figure to the invoice being read, so the caption has
    // nothing left to correct. Asserted as an ABSENCE rather than dropped silently:
    // this module has deleted things before (`arrived-more`, `resolveDeliveryFilters`)
    // and each deletion is pinned so a re-add fails here rather than in review.
    assert("the export is gone", !("sharesOrderedItem" in deliveryStatus));
    // ANTI-VACUITY for the line above: a typo in the name would pass it either way.
    assert("  and the namespace is the real module", typeof deliveryStatus.lineStatus === "function");

    // --- #232: A BOX SPEAKS ONLY WHEN SOMETHING DISAGREES ------------------
    //
    // THE ONE-DELIVERY PREMISE IS WHAT THESE ASSERT, one level down from where it
    // was already settled. What an invoice bills arrives on the delivery it matches
    // or not at all, so "everything billed was delivered" is a fact about the
    // INVOICE, which the chip states; a box repeating it states one fact once per
    // invoice item. See the module header, and docs/notes for the premise itself.
    log("");
    log("a box that agrees says NOTHING — `all-delivered` renders no verdict:");
    const covered15 = invoiceShareStatus({ billed: 15, arrived: 15 });
    check("the judgment is still made", invoiceVerdictKey(covered15), "all-delivered");
    // CAUGHT ON PURPOSE, so this reports rather than aborting the file. Re-opening
    // `speaks` for `all-delivered` without re-adding its copy branch throws — the
    // right failure for the code and an unreadable one for a check.
    const coveredBox = (() => {
        try {
            return describeInvoiceLine(covered15, "EA", { hasDelivery: true });
        } catch (err) {
            return { verdict: `THREW: ${err.message}`, againstOrder: null };
        }
    })();
    check("  and the box says nothing about it", coveredBox.verdict, null);
    // ANTI-VACUITY: the same call with a status that DOES disagree must speak, or
    // "returns null" is just what this function always does.
    assert(
        "  while a box that disagrees does speak",
        describeInvoiceLine(invoiceShareStatus({ billed: 15, arrived: 10 }), "EA", {
            hasDelivery: true,
        }).verdict !== null
    );

    log("");
    log("the verdict is WITHHELD where no delivery is matched to the invoice:");
    // The distinction #210 created and #232 acts on. A share with `delivered: 0`
    // cannot tell "nothing is matched to this bill" from "the matched delivery
    // delivered none of this ordered item", so the caller supplies which it is. The
    // first has one answer for the whole invoice and the section states it once.
    const judgedShare = invoiceShareStatus({ billed: 15, arrived: 0 });
    check(
        "nothing matched, so the box says nothing about delivery",
        describeInvoiceLine(judgedShare, "EA", { hasDelivery: false }).verdict,
        null
    );
    check(
        "  and hasDelivery defaults to that, so a caller cannot forget it open",
        describeInvoiceLine(judgedShare, "EA").verdict,
        null
    );
    check(
        "a delivery matched, and the verdict is back",
        describeInvoiceLine(judgedShare, "EA", { hasDelivery: true }).verdict?.key,
        "nothing-delivered"
    );
    // `nothing-delivered` now means only this, which is why it was kept rather than
    // deleted with the states this module has removed for having no reader: the app's
    // own pairing cannot produce it — `fitRefusal` requires containment and
    // `roomOnOrderedItem` refuses a pair with no room — but a hand-set link can
    // (`HYE-INV-260804-03` is one), and so can a bill of 0.
    check(
        "  a bill of 0 reaches it by the clamp",
        describeInvoiceLine(invoiceShareStatus({ billed: 0, arrived: 9 }), "EA", {
            hasDelivery: true,
        }).verdict?.key,
        "nothing-delivered"
    );
    // NOT A DELIVERY FACT, so it survives either way — it is about the invoice item.
    for (const hasDelivery of [true, false]) {
        check(
            `not-compared keeps its verdict with hasDelivery ${hasDelivery}`,
            describeInvoiceLine(null, "EA", { hasDelivery }).verdict?.text,
            "Not compared — no ordered item"
        );
    }

    log("");
    log("the two surviving verdicts are DISCREPANCIES, not stages:");
    // Under the premise nothing further is coming: what this invoice bills either
    // arrived on the delivery it matches or was never shipped. So a shortfall is an
    // event to take up with the vendor, and `yet` has exactly one honest home on this
    // screen — the section's empty state, where the material may still arrive or the
    // arrival may still be recorded.
    const shortfall = describeInvoiceLine(invoiceShareStatus({ billed: 13, arrived: 10 }), "EA", {
        hasDelivery: true,
    }).verdict;
    const nothingOfIt = describeInvoiceLine(invoiceShareStatus({ billed: 40, arrived: 0 }), "EA", {
        hasDelivery: true,
    }).verdict;
    check("the shortfall states its figure", shortfall.text, "3 EA more billed than the matched delivery delivered");
    check("  so does the empty one", nothingOfIt.text, "40 EA billed, none of it delivered by the matched delivery");
    for (const v of [shortfall, nothingOfIt]) {
        assert(`\`${v.key}\` does not say 'yet'`, !/\byet\b/.test(v.text));
        assert(`  and names the matched delivery as what it compares against`, v.text.includes("matched delivery"));
    }
    // THE ONE PLACE `yet` BELONGS is not in this module at all — it is the section's
    // empty state on the page, where nothing has been matched. Asserted here as an
    // absence across every sentence this module can produce.
    const everyDetailSentence = [
        ...Object.values(STATUS_COPY.detail.verdict).map((f) => f(shortShare, "EA").text),
        STATUS_COPY.detail.againstOrder(bothBeyond, "EA").text,
    ];
    assert(
        "and no detail sentence anywhere says it",
        everyDetailSentence.every((t) => !/\byet\b/.test(t))
    );

    log("");
    log("`Against the ordered item:` is CONDITIONAL again, and leads with no `ordered`:");
    // #232's first pass made it unconditional and led it with `N ordered`, to anchor
    // the figures line above it. That line is gone — a normal box is silent — so there
    // is nothing to anchor, and the ordered quantity is `/pos/[poId]`'s `Qty` column.
    // The label says `ordered item` because the figure it compares against is one
    // `PO Items` row's `Qty`, never the order's total (#227).
    const ordinary = invoiceShareStatus({ billed: 15, arrived: 15 });
    check(
        "nothing exceeds, and the line is absent entirely",
        describeInvoiceLine(ordinary, "EA", { hasDelivery: true }).againstOrder,
        null
    );
    check(
        "  both terms on ONE line, billed side first",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 3, arrivedBeyondOrder: 2 }, "EA", {
            hasDelivery: true,
        }).againstOrder?.text,
        "Against the ordered item: 3 EA more billed, 2 EA more delivered"
    );
    check(
        "  and a blank unit reads without one",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 3 }, "", { hasDelivery: true })
            .againstOrder?.text,
        "Against the ordered item: 3 more billed"
    );
    assert(
        "no order-scoped sentence claims the ORDER any more",
        !STATUS_COPY.detail.againstOrder(bothBeyond, "EA").text.includes("Against the order:")
    );
    // IT DOES NOT DEPEND ON `hasDelivery`: an ordered item billed beyond its `Qty` is
    // a fact whether or not anything has been matched, and that is the figure this
    // screen alone shows.
    check(
        "an unmatched invoice still states a billing excess",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 3 }, "EA", { hasDelivery: false })
            .againstOrder?.text,
        "Against the ordered item: 3 EA more billed"
    );
    check(
        "  even though its verdict is withheld",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 3 }, "EA", { hasDelivery: false })
            .verdict,
        null
    );
    check(
        "a not-compared box states nothing about an ordered item it has not got",
        describeInvoiceLine(null, "EA", { hasDelivery: true }).againstOrder,
        null
    );
    // #241 — a verdict carries the tone its line is rendered in, and the entry's name
    // wears the same one. Two values, and they must differ or the color distinguishes
    // nothing, which is the state #232's first pass was in.
    log("");
    log("a verdict says what tone it is (#241):");
    const partlyShort = invoiceShareStatus({ billed: 15, arrived: 12 });
    check(
        "a shortfall is an exception",
        describeInvoiceLine(partlyShort, "EA", { hasDelivery: true }).verdict?.tone,
        "exception"
    );
    check(
        "nothing delivered is one too",
        describeInvoiceLine(invoiceShareStatus({ billed: 40, arrived: 0 }), "EA", {
            hasDelivery: true,
        }).verdict?.tone,
        "exception"
    );
    check(
        "an invoice item with no ordered item is UNJUDGED, not a problem",
        describeInvoiceLine(null, "EA", { hasDelivery: true }).verdict?.tone,
        "unjudged"
    );
    assert(
        "  so the two really differ — a single tone would color nothing apart",
        STATUS_COPY.detail.verdict["billed-more"](partlyShort, "EA").tone !==
            STATUS_COPY.detail.verdict["not-compared"]().tone
    );
    assert(
        "the tone vocabulary is its own, never a chip's closed set of states",
        ["exception", "unjudged"].every(
            (tone) => !["complete", "partial", "mismatch", "none", "absent"].includes(tone)
        )
    );

    // #241 — a folded entry's two figures are sums over the ordered items it covers,
    // so the subject agrees in number. The count is the caller's and defaults to one,
    // which is why every assertion above reads unchanged.
    check(
        "one ordered item is the default, so the singular needs no argument",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 3 }, "EA", { hasDelivery: true })
            .againstOrder?.text,
        "Against the ordered item: 3 EA more billed"
    );
    check(
        "  an entry folded across two says so",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 5 }, "EA", {
            hasDelivery: true,
            orderedItemCount: 2,
        }).againstOrder?.text,
        "Against the ordered items: 5 EA more billed"
    );
    assert(
        "  and the two really differ, so the count is read rather than ignored",
        describeInvoiceLine({ ...ordinary, billedBeyondOrder: 5 }, "EA", {
            hasDelivery: true,
            orderedItemCount: 2,
        }).againstOrder?.text !==
            describeInvoiceLine({ ...ordinary, billedBeyondOrder: 5 }, "EA", { hasDelivery: true })
                .againstOrder?.text
    );

    // The bill ordering was asserted here while this module held it; #219 moved it
    // into lib/overage.js, private to its one reader, and offline/overage.mjs pins
    // every clause of it through selectOverageBill. Its absence from this module is
    // asserted below, with the export list.

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
    // having an invoice item to judge.
    check("and the dash is not dressed as a value", STATUS_COPY.column.delivery["no-ordered-items"]().tone, "absent");
    assert("every chip's key names its own text", everyChip.every((c) => c.key && c.text));

    // --- copy --------------------------------------------------------------
    log("");
    log("the detail's verdicts — the right BRANCH, pinned by key not wording:");
    // `hasDelivery: true` throughout this section, because these assertions are
    // about which WORDS a verdict uses and #232 made the verdict's existence a
    // separate question — pinned in its own section above, on its own inputs.
    const detail = (status, unit = "EA") => describeInvoiceLine(status, unit, { hasDelivery: true });
    check("covered says nothing at all (#232)", detail(covered).verdict, null);
    check("short", detail(partShare).verdict?.text, "3 EA more billed than the matched delivery delivered");
    check("nothing", detail(shortShare).verdict?.text, "40 EA billed, none of it delivered by the matched delivery");
    check("not compared", detail(null).verdict?.text, "Not compared — no ordered item");
    // BOTH SURVIVING VERDICTS CARRY FIGURES, and #232 inverted the reason they did
    // not. The rule was "no figures where the box's own numbers line already has
    // them"; the box has no numbers line now, so the difference — which IS the fact
    // in both — is stated where it is found.
    assert(
        "the shortfall verdict states the difference, which IS the fact",
        detail(partShare).verdict?.text.startsWith("3 EA")
    );
    assert("and the empty one states the whole bill", detail(shortShare).verdict?.text.startsWith("40 EA"));
    assert(
        "a blank unit omits it rather than printing 'undefined'",
        !detail(partShare, "").verdict?.text.includes("undefined")
    );

    log("");
    log("`Against the ordered item:` is ONE line even when both sides exceed it:");
    // Conditional again since #232's second pass, and with no leading `ordered` term
    // — see the section above for both reversals.
    const withBoth = { ...partShare, arrivedBeyondOrder: 2, billedBeyondOrder: 3 };
    check("both terms, billed first", detail(withBoth).againstOrder?.text, "Against the ordered item: 3 EA more billed, 2 EA more delivered");
    check("delivery side alone", detail({ ...covered, arrivedBeyondOrder: 2 }).againstOrder?.text, "Against the ordered item: 2 EA more delivered");
    check("billing side alone", detail({ ...covered, billedBeyondOrder: 3 }).againstOrder?.text, "Against the ordered item: 3 EA more billed");
    check("neither, so the line is absent entirely", detail(covered).againstOrder, null);
    check("and it is absent for a not-compared line too", detail(null).againstOrder, null);

    log("");
    log("NAMED SLOTS, not a list — so a call site cannot color the asides:");
    // The first version returned a list and the page colored everything that was
    // not `matched`, which made all three amber and the color distinguish nothing.
    const slots = detail(withBoth);
    check("the verdict is its own slot", slots.verdict?.key, "billed-more");
    check("and the aside is another", slots.againstOrder?.key, "against-order");
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
        STATUS_COPY.detail.mismatch().text,
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
    // The `line` half of this moved to offline/line-vocabulary.mjs (#227),
    // which bars the word across EVERY `*_COPY` constant rather than only
    // #166's. Two implementations of one rule is what this repo removes; what
    // stays here is #166's own vocabulary, which that check does not own.
    assert(
        "the shortfall message says 'more billed than' what it compares against",
        STATUS_COPY.detail.verdict["billed-more"](short, "EA").text.includes("more billed than the matched delivery")
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

    // --- the strip above /invoices (#216) ----------------------------------
    // The predicate and the ordering above are what the strip selects and sorts
    // with — they did NOT move when `?unbilled=1` left /deliveries, so they keep
    // their existing checks and gain no copies. What is new here is the waiting
    // count and the copy.
    log("");
    log("how long an arrival has waited (#216):");
    check("the day it arrived is zero", daysWaiting("2026-08-12", "2026-08-12"), 0);
    check("the day after is one", daysWaiting("2026-08-11", "2026-08-12"), 1);
    check("across a month boundary", daysWaiting("2026-07-31", "2026-08-12"), 12);
    // A LEAP-YEAR FEBRUARY, because date arithmetic done by hand is where this
    // would break and 2028 is the next one this app will see.
    check("across a leap day", daysWaiting("2028-02-28", "2028-03-01"), 2);
    check("a missing date is null, not zero", daysWaiting("", "2026-08-12"), null);
    // ASSERTED WITH `===` RATHER THAN `check`, because `check` renders its actual
    // through JSON.stringify and NaN comes out as `null` — so a genuine failure
    // here would print "got null, expected null" and read like a pass. Measured
    // while mutating this very clause.
    assert(
        "an unparseable date is null and not NaN",
        daysWaiting("not-a-date", "2026-08-12") === null
    );
    check("a missing today is null", daysWaiting("2026-08-01", ""), null);
    // NULL AND ZERO MUST NOT COLLIDE: zero means it arrived today, null means
    // there is no date to measure from, and a row renders them differently.
    assert("null is distinguishable from zero", daysWaiting("", "2026-08-12") !== 0);

    log("");
    log("what the strip says — ONE voice, because it offers no action:");
    check(
        "one delivery reads as one",
        AWAITING_INVOICE_COPY.heading(1),
        "1 delivery is waiting for an invoice"
    );
    check(
        "and two do not",
        AWAITING_INVOICE_COPY.heading(2),
        "2 deliveries are waiting for an invoice"
    );
    assert(
        "the singular and plural headings actually differ",
        AWAITING_INVOICE_COPY.heading(1) !== AWAITING_INVOICE_COPY.heading(2)
    );
    assert("the explanation is a sentence", /^[A-Z].*\.$/.test(AWAITING_INVOICE_COPY.explain.trim()));
    assert(
        "it names the ordering, which is the thing a reader cannot see",
        /longest wait first/i.test(AWAITING_INVOICE_COPY.explain)
    );
    // IT MUST NOT POINT AT A CONTROL. `/invoices` has a `New invoice` button that
    // only an Admin sees, and this strip renders for every viewer who can reach a
    // delivery — copy naming that button would describe something half its readers
    // do not have. This is the assertion that keeps the one-voice decision honest:
    // the moment the copy tells someone to press something, it needs two voices.
    for (const word of ["New invoice", "record", "button", "click", "press", "add"]) {
        assert(
            `the explanation does not point at a control ("${word}")`,
            !AWAITING_INVOICE_COPY.explain.toLowerCase().includes(word.toLowerCase())
        );
    }

    // --- the worklist order -----------------------------------------------
    log("");
    log("the vendor-chasing worklist: longest-waiting first (#166):");
    // `waitingSince` SINCE #256, which renamed the field off `receivedDate` when a
    // third caller began ordering by an invoice's `Issue Date`. These fixtures carry
    // the neutral name because that is what the function reads; which date a caller
    // puts in it is the call site's claim, and each one now states it.
    const rows = [
        { id: "b", waitingSince: "2026-07-20", createdAt: "2026-07-20T10:00:00.000Z" },
        { id: "a", waitingSince: "2026-07-10", createdAt: "2026-07-11T10:00:00.000Z" },
        { id: "c", waitingSince: "2026-07-20", createdAt: "2026-07-21T10:00:00.000Z" },
    ];
    const sorted = sortLongestWaitingFirst(rows);
    check("waiting-since ascending", sorted.map((r) => r.id).join(""), "acb");
    // Created At DESC as the tie-break, matching the default list's direction so
    // only the primary key flips between the two orderings.
    check("ties broken by Created At descending", sorted[1].id, "c");
    assert("does not mutate its input", rows[0].id === "b");
    // A data gap must not take the top of a worklist — the same call
    // sortCandidates makes for the head of its FIFO queue.
    const withUndated = sortLongestWaitingFirst([...rows, { id: "z", waitingSince: "", createdAt: "2026-01-01T00:00:00.000Z" }]);
    check("an undated row sorts LAST, not first", withUndated.at(-1).id, "z");
    // AND THE OLD NAME IS INERT, which is what makes the rename a rename rather than
    // an addition: a row carrying only `receivedDate` is undated to this function now,
    // so a call site left unconverted sorts last instead of silently sorting right.
    const legacy = sortLongestWaitingFirst([
        { id: "old", receivedDate: "2026-01-01" },
        { id: "new", waitingSince: "2026-07-01" },
    ]);
    check("a row with only the old field is treated as undated", legacy.at(-1).id, "old");
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
    // Over-delivery clears the ordered item rather than overshooting into a state
    // of its own. The within/beyond split #166 needs is exactly what this axis
    // does not.
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
    // A withdrawn PO's every ordered item has Committed Qty 0 (#18's formula), so the
    // judged set empties and the chip is the dash.
    const withdrawn = [poLine(10, 10, 0), poLine(5, 0, 0)];
    check("a withdrawn order reports nothing-ordered", summary(withdrawn), "nothing-ordered");
    // ANTI-VACUITY #1. The assertion above also passes if the summarizer ignored
    // its input, returned the dash for everything, or received an empty array. The
    // SAME ordered items with a live Committed Qty must therefore reach a different
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

    // ── #235: THE INVOICING AXIS AT THE SAME SCOPE ─────────────────────────
    log("");
    log("THE QUIET MUTANT — a verdict that never changes is a chip that always reads:");
    // This rule's failure mode is a constant. One word in every row looks like a
    // list where nothing has been billed, or one where everything has, and no other
    // check in this repository reads these keys — the station #237's `always agree`,
    // #242's removed narrowing, #241's always-silent list, #238's unfolded table and
    // #179's one word for two kinds stand at. So the first assertion is that the
    // four inputs below do not collapse to one answer.
    const poBill = (qty, invoiced, committed = qty) => ({
        orderedQty: qty,
        invoicedQty: invoiced,
        committedQty: committed,
    });
    const billing = (lines) => summarizePOInvoicingStatus(lines).key;
    const everyState = [
        ["invoiced", [poBill(10, 10), poBill(5, 5)]],
        ["partly-invoiced", [poBill(10, 10), poBill(5, 0)]],
        ["awaiting-invoice", [poBill(10, 0), poBill(5, 0)]],
        ["nothing-ordered", [poBill(10, 10, 0)]],
    ];
    const alwaysAwaiting = () => "awaiting-invoice";
    for (const [expected, lines] of everyState) {
        check(`  ${expected}`, billing(lines), expected);
    }
    assert(
        "  so a constant verdict disagrees on three of the four",
        everyState.filter(([expected, lines]) => alwaysAwaiting(lines) !== billing(lines)).length === 3
    );

    log("");
    log("it is the delivery summary's pair, line for line:");
    // The two are claimed to be the same fold at the same scope. Comparing their
    // SHAPES is that claim rather than a restatement of either, and a field added to
    // one and not the other is what this would catch.
    const shapeOf = (o) => Object.keys(o).sort().join(",");
    check(
        "same result shape",
        shapeOf(summarizePOInvoicingStatus([poBill(10, 4)])),
        shapeOf(summarizePODeliveryStatus([poLine(10, 4)])).replace("anyDelivered", "anyInvoiced")
    );
    check("a half-billed ordered item is the middle state", billing([poBill(10, 4)]), "partly-invoiced");
    check(
        "  which the delivery axis reads the same way",
        summarizePODeliveryStatus([poLine(10, 4)]).key,
        "partly-delivered"
    );
    // #210 removed the middle from the INVOICE axis, where one bill is answered by
    // one delivery. An order is billed by as many invoices as the vendor sends, so
    // the middle is real here — asserted rather than assumed, since the temptation
    // to carry that removal across is exactly what this pins.
    assert(
        "the middle state exists on both order-scope axes and on neither bill-scope one",
        "partly-invoiced" in STATUS_COPY.column.poInvoicing &&
            "partly-delivered" in STATUS_COPY.column.po &&
            !("partly-delivered" in STATUS_COPY.column.invoice)
    );

    log("");
    log("billed beyond the order counts as billed, the way delivered beyond it does:");
    check("one ordered item billed past its Qty", billing([poBill(10, 13)]), "invoiced");
    check("  and its own line says so", poLineInvoicing(poBill(10, 13)).complete, true);
    check(
        "  which is what the delivery axis does with an over-delivery",
        summarizePODeliveryStatus([poLine(10, 13)]).key,
        "delivered"
    );
    // The excess is not lost by that: it is a per-ordered-item fact, marked `(over)`
    // beside `Invoiced` and flagged as #179's `Order variance` on the charge.
    check("a partly-invoiced order with one over-billed item stays partly invoiced",
        billing([poBill(10, 13), poBill(5, 0)]), "partly-invoiced");

    log("");
    log("a withdrawn order drops out through the same field as on the delivery axis:");
    check("nothing-ordered", billing([poBill(10, 10, 0), poBill(5, 0, 0)]), "nothing-ordered");
    check(
        "  and the same ordered items with a live Committed Qty do not",
        billing([poBill(10, 10, 10), poBill(5, 0, 5)]),
        "partly-invoiced"
    );
    check("judged counts only what counts", summarizePOInvoicingStatus([poBill(10, 10, 0)]).ordered, 0);

    log("");
    log("the chip — its own words, sharing the delivery axis's tones:");
    // ONE STEM, and the assertion is the whole set rather than three literals: every
    // word here has to come off `invoice`, which is what `Billed` / `Partly billed`
    // broke while `Awaiting invoice` sat beside them. #166 made the same call for
    // `arrival` against `delivery`.
    check("invoiced", STATUS_COPY.column.poInvoicing.invoiced().text, "Invoiced");
    check("partly invoiced", STATUS_COPY.column.poInvoicing["partly-invoiced"]().text, "Partly invoiced");
    assert(
        "every word in the set is built on `invoice`",
        Object.values(STATUS_COPY.column.poInvoicing)
            .map((f) => f().text)
            .filter((t) => t !== "—")
            .every((t) => /invoice/i.test(t))
    );
    assert(
        "  and none of them says `bill`",
        !Object.values(STATUS_COPY.column.poInvoicing).some((f) => /bill/i.test(f().text))
    );
    // The three words are the deliveries list's own, which is one question at two
    // scopes rather than two vocabularies for one.
    for (const key of ["invoiced", "partly-invoiced", "awaiting-invoice"]) {
        check(
            `"${key}" reads as it does on the deliveries list`,
            STATUS_COPY.column.poInvoicing[key]().text,
            STATUS_COPY.column.delivery[key]().text
        );
    }
    check("and the dash", STATUS_COPY.column.poInvoicing["nothing-ordered"]().text, "—");
    for (const [ours, theirs] of [
        ["invoiced", "delivered"],
        ["partly-invoiced", "partly-delivered"],
        ["awaiting-invoice", "awaiting-delivery"],
        ["nothing-ordered", "nothing-ordered"],
    ]) {
        check(
            `"${ours}" wears the tone "${theirs}" wears`,
            STATUS_COPY.column.poInvoicing[ours]().tone,
            STATUS_COPY.column.po[theirs]().tone
        );
    }
    assert(
        "and no word is shared with the delivery axis at this scope",
        !Object.keys(STATUS_COPY.column.poInvoicing).some(
            (k) =>
                k !== "nothing-ordered" &&
                Object.values(STATUS_COPY.column.po).some(
                    (f) => f().text === STATUS_COPY.column.poInvoicing[k]().text
                )
        )
    );
    for (const lines of [[poBill(10, 10)], [poBill(10, 0)], [poBill(10, 4)], []]) {
        const sum = summarizePOInvoicingStatus(lines);
        assert(`describePOInvoicingColumn resolves "${sum.key}"`, Boolean(describePOInvoicingColumn(sum)?.text));
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

    // THE TWO THAT HAD TO SURVIVE, AND #219 TOOK THEM. This block asserted the
    // opposite until then: `sortInvoicesOldestFirst` and `INFERRED_PREMISE` were kept
    // here for #167's `selectOverageBill`, read nowhere in this module, and pinned so
    // that a tidy-up hunting dead exports could not delete them — the exception #182
    // was carrying. #219 narrowed that question's candidates to the bills naming the
    // shipment an excess arrived on, which is the `spansInvoices` rethink #210 left
    // as its non-goal, and moved both into lib/overage.js. The ordering is PRIVATE
    // there, so the exception is retired rather than relocated, and what this file
    // pins is the absence.
    for (const moved of ["sortInvoicesOldestFirst", "INFERRED_PREMISE"]) {
        assert(`\`${moved}\` is no longer exported here (#219)`, !(moved in deliveryStatus));
        assert(`  nor named anywhere in the module`, !identifiers.has(moved));
    }
    // AND THE ORDERING ITSELF IS GONE, not merely its name: a second sort by the same
    // field would be the duplicate implementation offline/overage.mjs asserts against
    // on the other side.
    const sortedFields = new Set();
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "sort") return;
        const text = JSON.stringify(node.arguments);
        for (const field of ["issueDate", "waitingSince", "createdAt"]) {
            if (text.includes(field)) sortedFields.add(field);
        }
    });
    // ANTI-VACUITY FOR THAT MATCHER, and it needs its own: "no sort mentions
    // issueDate" is also what a matcher that reads no sort callback at all reports.
    // sortLongestWaitingFirst is still here, so its two fields must come back seen.
    //
    // THE FIRST FIELD IS `waitingSince` SINCE #256, and updating it here is load-
    // bearing rather than cosmetic: that rename made the sort read a different property,
    // so an assertion still naming `receivedDate` would have gone quiet — reporting
    // "the matcher works" only by finding a field no sort in this module reads. The
    // proof and the thing proved have to move together.
    assert("  the sort matcher reads callback bodies at all", sortedFields.has("waitingSince"));
    assert("    including the tie-break beside it", sortedFields.has("createdAt"));
    assert("and nothing here sorts bills by Issue Date any more", !sortedFields.has("issueDate"));

    // ANTI-VACUITY FOR THE WHOLE SECTION. Every assertion above is of the form "this
    // identifier is absent", which is also what a walk that visited nothing reports —
    // and what a parse of the wrong file reports. So the same two sets must be seen
    // to contain things that ARE in the module.
    log("");
    log("  anti-vacuity — the walk is seen to find what it is looking for:");
    assert("the AST walk visited nodes at all", sawAnyNode);
    assert("it sees identifiers", identifiers.has("summarizeInvoiceStatus"));
    // Was `sharesOrderedItem` until #232 deleted it. The control has to be a name
    // the CURRENT module holds, so it moved to the one that issue added — which
    // keeps the property this line is for: proof the walk is reading the new file
    // and not a stale parse.
    assert("  including one #232 ADDED, so it is reading the new file", identifiers.has("speaks"));
    assert("it sees object keys", propertyKeys.has("billedNotArrived"));
    assert("  including one #210 added", propertyKeys.has("mismatch"));
    // A control on the negative direction too: a name that is genuinely absent and
    // has never been in this module must also come back absent, or the sets are
    // matching everything.
    assert("and it does not report a name that was never there", !identifiers.has("allocateLineToDeliveries"));
}

if (isMain(import.meta.url)) standalone(title, run);
