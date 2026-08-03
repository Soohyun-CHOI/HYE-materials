// The delivery allocation rule (#162) — candidate set, order, split, over-delivery.
//
// Site staff never pick a PO line, so this rule is the whole of what a delivery
// is recorded against, and there is no allocation-editing UI to fix a wrong
// answer afterwards: a mistake is corrected by deleting the delivery and
// entering it again. That is why every clause is pinned here rather than trusted
// to the credentialed script, which can only exercise a handful of shapes
// against real records.
//
// Offline-safe: lib/deliveryAllocation.js imports only lib/materialPriceView.js
// (which imports only lib/itemNaming.js), both with explicit .js extensions, so
// plain node resolves the chain with no loader and no credentials.

import {
    ALLOCATION_COPY,
    describeDelivery,
    describePlan,
    hasUndeliveredQty,
    planDelivery,
    selectCandidates,
    sortCandidates,
    undeliveredQty,
} from "../../../lib/deliveryAllocation.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery allocation — candidates, order, split, over-delivery (#162)";

const VENDOR = "recVendorA";
const OTHER_VENDOR = "recVendorB";
const MATERIAL = "recMatPipe";
const OTHER_MATERIAL = "recMatValve";

/** A PO line in the shape lib/deliveryCandidates.js hands over. */
function line(over) {
    return {
        id: "recPOI-" + (over.poItemId || "x"),
        poItemId: over.poItemId || "HYE-PO-20260101-01-001",
        poRecordId: over.poRecordId || "recPO1",
        poId: over.poId || "HYE-PO-20260101-01",
        poCreatedDate: "poCreatedDate" in over ? over.poCreatedDate : "2026-01-01",
        vendorRecordId: over.vendorRecordId || VENDOR,
        materialRecordId: over.materialRecordId || MATERIAL,
        itemName: "Pipe",
        size: '2"',
        unit: "EA",
        qty: over.qty ?? 10,
        committedQty: "committedQty" in over ? over.committedQty : (over.qty ?? 10),
        deliveredQty: over.deliveredQty ?? 0,
    };
}

export function run({ check, assert, log }) {
    log("The remainder rule:");
    check("qty minus delivered", undeliveredQty({ qty: 10, deliveredQty: 4 }), 6);
    check("a blank rollup counts as 0", undeliveredQty({ qty: 10 }), 10);
    check("a blank qty counts as 0 too", undeliveredQty({}), 0);
    check("over-delivered goes negative, not clamped", undeliveredQty({ qty: 10, deliveredQty: 12 }), -2);
    check("fully delivered cannot absorb more", hasUndeliveredQty({ qty: 10, deliveredQty: 10 }), false);
    check("over-delivered cannot absorb more", hasUndeliveredQty({ qty: 10, deliveredQty: 12 }), false);
    check("partly delivered can", hasUndeliveredQty({ qty: 10, deliveredQty: 9 }), true);

    log("");
    log("Candidate set — each clause refuses on its own:");
    const pool = [
        line({ poItemId: "keep" }),
        line({ poItemId: "wrong-vendor", vendorRecordId: OTHER_VENDOR }),
        line({ poItemId: "wrong-material", materialRecordId: OTHER_MATERIAL }),
        line({ poItemId: "withdrawn", committedQty: 0 }),
        line({ poItemId: "zero-qty", qty: 0, committedQty: 0 }),
    ];
    const picked = selectCandidates({ lines: pool, vendorRecordId: VENDOR, materialRecordId: MATERIAL });
    check("only the matching line survives", picked.length, 1);
    check("and it is the right one", picked[0].poItemId, "keep");

    // The withdrawn case is read off Committed Qty, not off a status string —
    // #18 put the which-POs-count rule in that one field on purpose.
    const withdrawnOnly = selectCandidates({
        lines: [line({ poItemId: "withdrawn", committedQty: 0, deliveredQty: 0 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
    });
    check("a withdrawn PO's line is not a candidate", withdrawnOnly.length, 0);

    // Signature status is deliberately not a filter: site orders first and the
    // PR/PO follow as a record, so an unsigned order must still receive goods.
    const unsigned = selectCandidates({
        lines: [line({ poItemId: "awaiting", qty: 10, committedQty: 10 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
    });
    check("an unsigned PO's line IS a candidate", unsigned.length, 1);

    const narrowedToPo = selectCandidates({
        lines: [
            line({ poItemId: "a", poRecordId: "recPO1" }),
            line({ poItemId: "b", poRecordId: "recPO2" }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO2",
    });
    check("a supplied PO narrows to its own lines", narrowedToPo.length, 1);
    check("and it is that PO's line", narrowedToPo[0].poItemId, "b");

    log("");
    log("Order — oldest first, then PO ID, then PO Item ID:");
    const sorted = sortCandidates([
        line({ poItemId: "newer", poId: "HYE-PO-20260320-01", poCreatedDate: "2026-03-20" }),
        line({ poItemId: "oldest", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01" }),
        line({ poItemId: "middle", poId: "HYE-PO-20260210-01", poCreatedDate: "2026-02-10" }),
    ]);
    check("oldest PO first", sorted.map((l) => l.poItemId).join(","), "oldest,middle,newer");

    const sameDay = sortCandidates([
        line({ poItemId: "second", poId: "HYE-PO-20260101-02", poCreatedDate: "2026-01-01" }),
        line({ poItemId: "first", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01" }),
    ]);
    check("same calendar day ties break on PO ID", sameDay.map((l) => l.poItemId).join(","), "first,second");

    const samePo = sortCandidates([
        line({ poItemId: "HYE-PO-20260101-01-002" }),
        line({ poItemId: "HYE-PO-20260101-01-001" }),
    ]);
    check(
        "lines within one PO order by PO Item ID",
        samePo.map((l) => l.poItemId).join(","),
        "HYE-PO-20260101-01-001,HYE-PO-20260101-01-002"
    );

    const undated = sortCandidates([
        line({ poItemId: "undated", poCreatedDate: null }),
        line({ poItemId: "dated", poCreatedDate: "2026-05-05" }),
    ]);
    check("an undated line sorts LAST, never first", undated.map((l) => l.poItemId).join(","), "dated,undated");

    log("");
    log("Exact fill and partial fill:");
    const one = [line({ poItemId: "a", qty: 10 })];
    const exact = planDelivery({ lines: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 10 });
    check("an exact quantity makes one row", exact.rows.length, 1);
    check("with the whole quantity", exact.rows[0].qty, 10);
    check("not flagged", exact.rows[0].over, false);
    check("nothing over", exact.over, 0);

    const partial = planDelivery({ lines: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 4 });
    check("a partial quantity makes one row of that size", partial.rows[0].qty, 4);
    check("and leaves nothing over", partial.over, 0);
    check("allocated reports what landed", partial.allocated, 4);

    log("");
    log("One quantity spanning two orders becomes two rows:");
    const two = [
        line({ poItemId: "old", poRecordId: "recPO1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 10, deliveredQty: 0 }),
        line({ poItemId: "new", poRecordId: "recPO2", poId: "HYE-PO-20260201-01", poCreatedDate: "2026-02-01", qty: 10, deliveredQty: 0 }),
    ];
    const split = planDelivery({ lines: two, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 15 });
    check("two rows", split.rows.length, 2);
    check("the older order fills first", split.rows[0].line.poItemId, "old");
    check("to its full remainder", split.rows[0].qty, 10);
    check("the remainder goes to the newer order", split.rows[1].line.poItemId, "new");
    check("as the balance", split.rows[1].qty, 5);
    check("the two row quantities sum to what was entered", split.rows[0].qty + split.rows[1].qty, 15);
    check("neither row is flagged", split.rows.some((r) => r.over), false);
    check("two distinct POs are reported", split.poRecordIds.length, 2);

    const three = planDelivery({
        lines: [
            line({ poItemId: "a", poRecordId: "p1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 5 }),
            line({ poItemId: "b", poRecordId: "p2", poId: "HYE-PO-20260201-01", poCreatedDate: "2026-02-01", qty: 5 }),
            line({ poItemId: "c", poRecordId: "p3", poId: "HYE-PO-20260301-01", poCreatedDate: "2026-03-01", qty: 5 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 12,
    });
    check("three orders, three rows", three.rows.length, 3);
    check("filled oldest to newest", three.rows.map((r) => r.qty).join(","), "5,5,2");

    // A partly delivered line contributes only its remainder.
    const partlyDelivered = planDelivery({
        lines: [line({ poItemId: "a", qty: 10, deliveredQty: 7 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 3,
    });
    check("a partly delivered line offers only its remainder", partlyDelivered.rows[0].qty, 3);
    check("and is then exactly filled", partlyDelivered.over, 0);

    log("");
    log("Over-delivery, case (a) — one order in play, so the excess names it:");
    const overOne = planDelivery({ lines: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 13 });
    check("two rows: the fill and the excess", overOne.rows.length, 2);
    check("the fill takes what was outstanding", overOne.rows[0].qty, 10);
    check("the excess is its own row", overOne.rows[1].qty, 3);
    check("flagged", overOne.rows[1].over, true);
    check("and it names the line", overOne.rows[1].line.poItemId, "a");
    check("overAttached says so", overOne.overAttached, true);
    check("over reports the excess", overOne.over, 3);
    check("the excess row's qty IS the excess, no arithmetic needed", overOne.rows[1].qty, overOne.over);

    log("");
    log("Over-delivery, case (b) — two orders in play, so the excess names none:");
    const overTwo = planDelivery({ lines: two, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 25 });
    check("three rows", overTwo.rows.length, 3);
    check("both orders filled", overTwo.rows.slice(0, 2).map((r) => r.qty).join(","), "10,10");
    check("the excess is 5", overTwo.rows[2].qty, 5);
    check("flagged", overTwo.rows[2].over, true);
    assert("and carries NO line, because no single order was over-delivered", overTwo.rows[2].line === null);
    check("overAttached says so", overTwo.overAttached, false);
    assert(
        "its siblings still name the orders, so nothing is lost",
        overTwo.rows.filter((r) => !r.over).every((r) => Boolean(r.line.poId))
    );

    log("");
    log("Over-delivery with no candidate left at all:");
    const fullyDelivered = [line({ poItemId: "a", qty: 10, deliveredQty: 10 })];
    const noneLeft = planDelivery({
        lines: fullyDelivered,
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 4,
    });
    check("one row", noneLeft.rows.length, 1);
    check("all of it flagged", noneLeft.rows[0].over, true);
    check("with the full quantity", noneLeft.rows[0].qty, 4);
    assert("attached, because the narrowed set still holds exactly one line", noneLeft.rows[0].line !== null);
    check("nothing was allocated", noneLeft.allocated, 0);
    check("no candidates could absorb it", noneLeft.candidates.length, 0);
    assert("but the line was still narrowed to", noneLeft.narrowed.length === 1);

    // Nothing of this material ordered from this vendor at all: no line to name.
    const nothingOrdered = planDelivery({
        lines: [line({ poItemId: "a", vendorRecordId: OTHER_VENDOR })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 6,
    });
    check("one flagged row", nothingOrdered.rows.length, 1);
    check("flagged", nothingOrdered.rows[0].over, true);
    assert("and unattached — there is no line at all", nothingOrdered.rows[0].line === null);
    check("narrowed set is empty", nothingOrdered.narrowed.length, 0);

    log("");
    log("A supplied PO ID is a HARD restriction — excess never spills:");
    const narrowed = planDelivery({
        lines: two,
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO1",
        qty: 18,
    });
    check("only the named PO's line is filled", narrowed.rows[0].line.poItemId, "old");
    check("to its remainder", narrowed.rows[0].qty, 10);
    check("the rest is flagged, not moved to the other order", narrowed.rows[1].over, true);
    check("as 8", narrowed.rows[1].qty, 8);
    assert(
        "the other order received nothing",
        !narrowed.rows.some((r) => r.line && r.line.poItemId === "new")
    );
    check("the excess names the narrowed order", narrowed.rows[1].line.poItemId, "old");

    // One PO carrying two lines of the same material: the PO is unambiguous but
    // the LINE is not, so the excess stays unattached and Deliveries.PO records
    // the PO-level fact instead.
    const twoLinesOnePo = planDelivery({
        lines: [
            line({ poItemId: "HYE-PO-20260101-01-001", poRecordId: "recPO1", qty: 5 }),
            line({ poItemId: "HYE-PO-20260101-01-002", poRecordId: "recPO1", qty: 5 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO1",
        qty: 14,
    });
    check("both lines of the one PO fill", twoLinesOnePo.rows.slice(0, 2).map((r) => r.qty).join(","), "5,5");
    check("the excess is 4", twoLinesOnePo.rows[2].qty, 4);
    assert(
        "unattached: the PO is unambiguous but the line is not",
        twoLinesOnePo.rows[2].line === null
    );
    check("only one PO was drawn on", twoLinesOnePo.poRecordIds.length, 1);

    log("");
    log("Degenerate inputs plan nothing rather than misbehaving:");
    for (const [label, qty] of [["zero", 0], ["negative", -5], ["not a number", "abc"], ["missing", undefined]]) {
        const p = planDelivery({ lines: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty });
        check(`a ${label} quantity makes no rows`, p.rows.length, 0);
        check(`  and nothing over`, p.over, 0);
    }
    const noLines = planDelivery({ lines: [], vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("an empty line list still records the arrival as over-delivery", noLines.rows.length, 1);
    check("  flagged", noLines.rows[0].over, true);
    const undefinedLines = planDelivery({ vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("a missing line list does not throw", undefinedLines.rows.length, 1);

    log("");
    log("totalUndelivered counts only what candidates can absorb:");
    const mixed = planDelivery({
        lines: [
            line({ poItemId: "a", qty: 10, deliveredQty: 4 }),
            line({ poItemId: "b", qty: 10, deliveredQty: 10 }),
            line({ poItemId: "c", qty: 10, deliveredQty: 12 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 1,
    });
    check("6 from the one line with a remainder", mixed.totalUndelivered, 6);
    check("the fully and over delivered lines are not candidates", mixed.candidates.length, 1);

    log("");
    log("Preview copy — the right BRANCH, pinned by key not wording:");
    check("a clean single-order fill says nothing", describePlan(exact).length, 0);
    check("a split is announced", describePlan(split)[0].key, "split");
    check("attached excess", describePlan(overOne, { unit: "EA" })[0].key, "over-attached");
    check("unattached excess", describePlan(overTwo, { unit: "EA" }).at(-1).key, "over-unattached");
    check("a split AND excess reports both", describePlan(overTwo).length, 2);
    check(
        "nothing outstanding gets its own message, not the generic one",
        describePlan(noneLeft, { unit: "EA" })[0].key,
        "over-nothing-outstanding"
    );
    check(
        "a supplied PO explains why it did not spill",
        describePlan(narrowed, { unit: "EA", poId: "HYE-PO-20260101-01" }).at(-1).key,
        "over-po-narrowed"
    );
    assert(
        "the po-narrowed message names the PO, since that is its whole point",
        describePlan(narrowed, { unit: "EA", poId: "HYE-PO-20260101-01" })
            .at(-1)
            .text.includes("HYE-PO-20260101-01")
    );
    assert(
        "the unattached message says no single order was over-delivered",
        ALLOCATION_COPY.preview.overUnattached(overTwo, "EA").text.includes("no single order")
    );

    log("");
    log("Banner copy — same decisions, past tense, from stored rows:");
    const storedClean = [{ qty: 10, over: false, poId: "HYE-PO-20260101-01", unit: "EA" }];
    check("one order says nothing", describeDelivery(storedClean).length, 0);
    const storedSplit = [
        { qty: 10, over: false, poId: "HYE-PO-20260101-01", unit: "EA" },
        { qty: 5, over: false, poId: "HYE-PO-20260201-01", unit: "EA" },
    ];
    check("two orders are announced", describeDelivery(storedSplit)[0].key, "split");
    const storedOver = [
        { qty: 10, over: false, poId: "HYE-PO-20260101-01", unit: "EA" },
        { qty: 3, over: true, poId: "HYE-PO-20260101-01", unit: "EA" },
    ];
    check("attached over-delivery names the PO", describeDelivery(storedOver).at(-1).key, "over-attached");
    const storedOverLoose = [
        { qty: 10, over: false, poId: "HYE-PO-20260101-01", unit: "EA" },
        { qty: 10, over: false, poId: "HYE-PO-20260201-01", unit: "EA" },
        { qty: 5, over: true, poId: null, unit: "EA" },
    ];
    check("unattached over-delivery does not", describeDelivery(storedOverLoose).at(-1).key, "over-unattached");
    check("and the split is still reported alongside it", describeDelivery(storedOverLoose).length, 2);
    check("no rows does not throw", describeDelivery([]).length, 0);
    check("undefined rows does not throw", describeDelivery(undefined).length, 0);

    log("");
    log("The planner does not mutate its input:");
    const input = [line({ poItemId: "a", qty: 10 })];
    const before = JSON.stringify(input);
    planDelivery({ lines: input, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 25 });
    check("the caller's line list is untouched", JSON.stringify(input), before);
    const toSort = [line({ poItemId: "b", poCreatedDate: "2026-02-01" }), line({ poItemId: "a", poCreatedDate: "2026-01-01" })];
    const orderBefore = toSort.map((l) => l.poItemId).join(",");
    sortCandidates(toSort);
    check("sortCandidates copies rather than sorting in place", toSort.map((l) => l.poItemId).join(","), orderBefore);
}

if (isMain(import.meta.url)) standalone(title, run);
