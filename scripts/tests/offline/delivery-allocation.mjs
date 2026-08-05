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
    BLOCKED,
    availableItemOptions,
    buildItemOptions,
    describeDelivery,
    describePlan,
    hasUndeliveredQty,
    groupRowsByItem,
    itemOptionLabel,
    planDelivery,
    selectCandidates,
    sortCandidates,
    summarizeDelivery,
    undeliveredQty,
} from "../../../lib/deliveryAllocation.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery allocation — candidates, order, split, over-delivery (#162, #165)";

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
    check("the fill takes what was undelivered", overOne.rows[0].qty, 10);
    check("the excess is its own row", overOne.rows[1].qty, 3);
    check("flagged", overOne.rows[1].over, true);
    check("and it names the line", overOne.rows[1].line.poItemId, "a");
    check("over reports the excess", overOne.over, 3);
    check("the excess row's qty IS the excess, no arithmetic needed", overOne.rows[1].qty, overOne.over);

    log("");
    log("Over-delivery, case (b) — two orders in play: the excess names the LAST FILLED (#165):");
    // #162 left this row unattached, on the grounds that no single order had been
    // over-delivered. The cost was worse than the imprecision: an unlinked row is
    // in no line's Delivered Qty, so a delivery that arrived in full read as less
    // arrived than was billed.
    const overTwo = planDelivery({ lines: two, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 25 });
    check("three rows", overTwo.rows.length, 3);
    check("both orders filled", overTwo.rows.slice(0, 2).map((r) => r.qty).join(","), "10,10");
    check("the excess is 5", overTwo.rows[2].qty, 5);
    check("flagged", overTwo.rows[2].over, true);
    assert("and it names a line", overTwo.rows[2].line !== null);
    check(
        "the LAST line filled, not the first",
        overTwo.rows[2].line.poItemId,
        overTwo.rows[1].line.poItemId
    );
    check("which is the newer order, since fill order is oldest-first", overTwo.rows[2].line.poItemId, "new");
    assert(
        "its siblings still name the orders they filled",
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
    assert("attached, even though nothing was filled", noneLeft.rows[0].line !== null);
    check("to the only narrowed line", noneLeft.rows[0].line.poItemId, "a");
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
    check("nothing is recorded at all — there is no line to attach to", nothingOrdered.rows.length, 0);
    check("and the plan says why", nothingOrdered.blocked, BLOCKED.notOrdered);
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

    // One PO carrying two lines of the same material. #162 left this unattached —
    // the PO was unambiguous but the line was not — and recorded only the PO-level
    // fact on Deliveries.PO. #165 resolves it by fill order, which is why this
    // feature no longer depends on a PO holding at most one line per material
    // (and so does not wait on #170).
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
    check("the excess names the second line, the last one filled", twoLinesOnePo.rows[2].line.poItemId, "HYE-PO-20260101-01-002");
    check("only one PO was drawn on", twoLinesOnePo.poRecordIds.length, 1);

    log("");
    log("THE #165 INVARIANT — a plan is blocked, or every row it makes names a line:");
    // Stated over a spread of plans rather than asserted once per case, because
    // this is the property the whole issue is: an unlinked row is in no line's
    // Delivered Qty, so the delivery vanishes from the invoice axis.
    const everyPlan = [
        ["exact fill", exact],
        ["split across two orders", split],
        ["over, one order", overOne],
        ["over, two orders", overTwo],
        ["over, nothing left undelivered", noneLeft],
        ["over, PO-narrowed", narrowed],
        ["over, two lines on one PO", twoLinesOnePo],
        ["blocked, nothing ordered", nothingOrdered],
    ];
    for (const [label, plan] of everyPlan) {
        assert(
            `${label}: ${plan.blocked ? "blocked, so no rows" : "every row names a line"}`,
            plan.blocked ? plan.rows.length === 0 : plan.rows.every((r) => Boolean(r.line))
        );
    }
    assert(
        "and the invariant is not vacuous — some of those plans do produce rows",
        everyPlan.some(([, p]) => p.rows.length > 0)
    );

    log("");
    log("Blocked: a supplied PO that does not carry the item (#165):");
    // NOT reachable from the entry form — it builds its item options from the typed
    // PO's own lines and resets the rows whenever the PO changes. Reachable at
    // SUBMIT, where createDeliveryAction re-runs this from a fresh read and a PO
    // may have been withdrawn in the meantime, and by a direct call on the action.
    // #162 wrote an unlinked row with blank frozen fields for this.
    const poWithoutItem = planDelivery({
        lines: [line({ poItemId: "a", poRecordId: "recPO1" })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO2",
        qty: 5,
    });
    check("nothing is recorded", poWithoutItem.rows.length, 0);
    check("blocked with the PO-specific reason", poWithoutItem.blocked, BLOCKED.poHasNoLine);
    check("narrowed to nothing, which is what blocked it", poWithoutItem.narrowed.length, 0);
    // The two reasons are distinguished only by whether a PO was supplied, and
    // they ask the recorder for different things.
    assert("the two reasons are distinct values", BLOCKED.poHasNoLine !== BLOCKED.notOrdered);
    const blockedCopy = describePlan(poWithoutItem, { poId: "HYE-PO-20260101-02", label: 'Pipe 2"' });
    check("one message, and it is the reason", blockedCopy.length, 1);
    check("keyed as blocked", blockedCopy[0].key, "blocked-po-has-no-line");
    assert("it names the PO the recorder typed", blockedCopy[0].text.includes("HYE-PO-20260101-02"));
    assert("and the item, since the reason is about this item", blockedCopy[0].text.includes('Pipe 2"'));
    const notOrderedCopy = describePlan(nothingOrdered, { label: 'Pipe 2"' });
    check("the other reason has its own message", notOrderedCopy[0].key, "blocked-not-ordered");
    assert("which does not blame a PO", !notOrderedCopy[0].text.includes("purchase order"));
    // A blocked plan says ONE thing. Anything else it might report is about rows
    // that will not exist.
    assert("a blocked plan reports nothing else", describePlan(poWithoutItem, { unit: "EA" }).length === 1);

    log("");
    log("The attach tail comes from sortCandidates, not a second comparator (#165):");
    // Both branches are positions in the one order planDelivery already fills in.
    // Branch 2 is literally its last element, so this pins them to each other.
    const threeOrders = [
        line({ poItemId: "c", poRecordId: "recPO3", poId: "HYE-PO-20260103-01", poCreatedDate: "2026-01-03", qty: 5, deliveredQty: 5 }),
        line({ poItemId: "a", poRecordId: "recPO1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 5, deliveredQty: 5 }),
        line({ poItemId: "b", poRecordId: "recPO2", poId: "HYE-PO-20260102-01", poCreatedDate: "2026-01-02", qty: 5, deliveredQty: 5 }),
    ];
    const allFull = planDelivery({ lines: threeOrders, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 2 });
    check("nothing could be filled", allFull.allocated, 0);
    check("so the excess goes to the MOST RECENT order", allFull.rows[0].line.poItemId, "c");
    check(
        "which is exactly sortCandidates' last element",
        allFull.rows[0].line.poItemId,
        sortCandidates(allFull.narrowed).at(-1).poItemId
    );
    // An undated line sorts last so a data gap cannot take FIFO priority, so the
    // tail picks it. Coherent under the same reading — last to be filled, last to
    // be blamed — and unreachable on this base, where every PO carries a date.
    const withUndated = planDelivery({
        lines: [...threeOrders, line({ poItemId: "z", poRecordId: "recPO9", poCreatedDate: null, qty: 5, deliveredQty: 5 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 2,
    });
    check("an undated line is the tail, as it is the tail of the fill order", withUndated.rows[0].line.poItemId, "z");

    log("");
    log("Degenerate inputs plan nothing rather than misbehaving:");
    for (const [label, qty] of [["zero", 0], ["negative", -5], ["not a number", "abc"], ["missing", undefined]]) {
        const p = planDelivery({ lines: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty });
        check(`a ${label} quantity makes no rows`, p.rows.length, 0);
        check(`  and nothing over`, p.over, 0);
    }
    const noLines = planDelivery({ lines: [], vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("an empty line list is blocked, not written unattached (#165)", noLines.rows.length, 0);
    check("  with the not-ordered reason", noLines.blocked, BLOCKED.notOrdered);
    const undefinedLines = planDelivery({ vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("a missing line list does not throw", undefinedLines.rows.length, 0);

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
    check("excess across two orders is attached too now (#165)", describePlan(overTwo, { unit: "EA" }).at(-1).key, "over-attached");
    check("a split AND excess reports both", describePlan(overTwo).length, 2);
    check(
        "a fully delivered item gets its own message, not the generic one",
        describePlan(noneLeft, { unit: "EA" })[0].key,
        "over-fully-delivered"
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
        "the fully-delivered message now names where the excess lands (#165)",
        ALLOCATION_COPY.preview.overFullyDelivered(noneLeft, "EA").text.includes("HYE-PO-20260101-01")
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
    log("The item dropdown is WIDER than the candidate set:");
    // The point of the whole decision: an item whose orders are satisfied must
    // stay listed. Dropping it would send the recorder to the "not in the
    // dropdown" message, which says it may never have been ordered here — false.
    const optionPool = [
        line({ poItemId: "a", qty: 10, deliveredQty: 4 }),
        line({ poItemId: "b", qty: 10, deliveredQty: 10 }),
        line({ poItemId: "c", materialRecordId: OTHER_MATERIAL, qty: 5, deliveredQty: 5 }),
        line({ poItemId: "d", materialRecordId: "recMatBolt", qty: 7, committedQty: 0 }),
        line({ poItemId: "e", vendorRecordId: OTHER_VENDOR, materialRecordId: "recMatOther" }),
    ];
    const options = buildItemOptions(optionPool, VENDOR);
    check("two materials offered for this vendor", options.length, 2);
    const pipe = options.find((o) => o.materialRecordId === MATERIAL);
    check("the partly delivered item shows its remainder", pipe.undelivered, 6);
    check("  summed across its two lines", pipe.lineCount, 2);
    check("  ordered totals both lines", pipe.ordered, 20);
    const valve = options.find((o) => o.materialRecordId === OTHER_MATERIAL);
    assert("a FULLY delivered item is still listed", Boolean(valve));
    check("  showing nothing left undelivered", valve.undelivered, 0);
    assert(
        "a withdrawn-only item is NOT listed (countsAsOrdered)",
        !options.some((o) => o.materialRecordId === "recMatBolt")
    );
    assert(
        "another vendor's item is not listed",
        !options.some((o) => o.materialRecordId === "recMatOther")
    );
    check("an unknown vendor offers nothing", buildItemOptions(optionPool, "recNobody").length, 0);
    check("an empty line list offers nothing", buildItemOptions([], VENDOR).length, 0);
    check("a missing line list does not throw", buildItemOptions(undefined, VENDOR).length, 0);
    // An over-delivered line must not report a negative remainder to the screen.
    const overPool = [line({ poItemId: "o", qty: 5, deliveredQty: 9 })];
    check("an over-delivered line clamps undelivered at 0", buildItemOptions(overPool, VENDOR)[0].undelivered, 0);

    check("the label joins name, size and unit", itemOptionLabel({ itemName: "Pipe", size: '2"', unit: "EA" }), 'Pipe 2" (EA)');
    check("blanks are omitted", itemOptionLabel({ itemName: "Gasket", size: "", unit: "PCS" }), "Gasket (PCS)");
    check("a unit-less option has no empty parens", itemOptionLabel({ itemName: "Pipe", size: '2"', unit: "" }), 'Pipe 2"');

    log("");
    log("An item on one entry row is not offered on another:");
    const threeOptions = [
        { materialRecordId: "m1", itemName: "A", size: "", unit: "EA", undelivered: 5 },
        { materialRecordId: "m2", itemName: "B", size: "", unit: "EA", undelivered: 5 },
        { materialRecordId: "m3", itemName: "C", size: "", unit: "EA", undelivered: 5 },
    ];
    const entryRows = [
        { materialRecordId: "m1", qty: "2" },
        { materialRecordId: "", qty: "" },
    ];
    const forRow1 = availableItemOptions(threeOptions, entryRows, 1);
    check("the empty row loses what row 0 claimed", forRow1.length, 2);
    assert("specifically m1", !forRow1.some((o) => o.materialRecordId === "m1"));

    // The claiming row must still see its OWN choice, or the select renders blank
    // and silently drops it.
    const forRow0 = availableItemOptions(threeOptions, entryRows, 0);
    check("the claiming row keeps its own selection", forRow0.length, 3);
    assert("including m1", forRow0.some((o) => o.materialRecordId === "m1"));

    const twoClaimed = availableItemOptions(
        threeOptions,
        [{ materialRecordId: "m1" }, { materialRecordId: "m3" }, { materialRecordId: "" }],
        2
    );
    check("two claimed leaves one", twoClaimed.length, 1);
    check("  and it is m2", twoClaimed[0].materialRecordId, "m2");
    check(
        "all claimed leaves a new row nothing",
        availableItemOptions(
            threeOptions,
            [{ materialRecordId: "m1" }, { materialRecordId: "m2" }, { materialRecordId: "m3" }, { materialRecordId: "" }],
            3
        ).length,
        0
    );
    check("a single empty row sees everything", availableItemOptions(threeOptions, [{ materialRecordId: "" }], 0).length, 3);
    check("no options yields none", availableItemOptions([], entryRows, 1).length, 0);
    check("undefined options does not throw", availableItemOptions(undefined, entryRows, 1).length, 0);
    check("undefined rows offers everything", availableItemOptions(threeOptions, undefined, 0).length, 3);
    check("an index past the end still excludes the claimed", availableItemOptions(threeOptions, entryRows, 9).length, 2);

    log("");
    log("A delivery holds SEVERAL items, each possibly split across orders:");
    // The rows as stored: two items, the first split across two POs, the second
    // over-delivered. Entry order is Delivery Item ID order.
    const multi = [
        { materialRecordId: "recRebar", itemName: "Rebar D13", size: "", unit: "EA", qty: 150, over: false, poId: "HYE-PO-20260101-01" },
        { materialRecordId: "recRebar", itemName: "Rebar D13", size: "", unit: "EA", qty: 50, over: false, poId: "HYE-PO-20260201-01" },
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 30, over: false, poId: "HYE-PO-20260201-01" },
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 5, over: true, poId: "HYE-PO-20260201-01" },
    ];
    const groups = groupRowsByItem(multi);
    check("four rows collapse to two items", groups.length, 2);
    check("in entry order", groups.map((g) => g.itemName).join(","), "Rebar D13,Pipe");
    check("the split item's slices are summed", groups[0].qty, 200);
    check("  and its slice count kept", groups[0].rowCount, 2);
    check("  across two orders", groups[0].poIds.size, 2);
    check("not flagged", groups[0].over, false);
    check("the over-delivered item sums both slices too", groups[1].qty, 35);
    check("  and IS flagged, because one slice was", groups[1].over, true);

    // An unattributable over-delivery row carries no PO Item but does carry its
    // Material, so it must still group with its own item rather than alone.
    const looseGroups = groupRowsByItem([
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 10, over: false, poId: "HYE-PO-20260101-01" },
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 4, over: true, poId: null },
    ]);
    check("an unattached over row groups with its item", looseGroups.length, 1);
    check("  contributing its quantity", looseGroups[0].qty, 14);
    check("  and its flag", looseGroups[0].over, true);

    // Rows with no material (nothing creates them today) fall back to the frozen
    // name/size/unit rather than collapsing into one nameless group.
    const noMaterial = groupRowsByItem([
        { itemName: "A", size: "", unit: "EA", qty: 1, over: false },
        { itemName: "B", size: "", unit: "EA", qty: 2, over: false },
        { itemName: "A", size: "", unit: "EA", qty: 3, over: false },
    ]);
    check("materialless rows group on name/size/unit", noMaterial.length, 2);
    check("  summing the repeat", noMaterial[0].qty, 4);

    check("no rows groups to nothing", groupRowsByItem([]).length, 0);
    check("undefined rows does not throw", groupRowsByItem(undefined).length, 0);

    log("");
    log("The list summary — first item in full, the rest as a count:");
    const sum = summarizeDelivery(multi);
    check("the first item entered leads", sum.first.label, "Rebar D13");
    check("  with its summed quantity", sum.first.qty, 200);
    check("  and its unit", sum.first.unit, "EA");
    check("one more item beyond it", sum.extraCount, 1);
    check("two items in total", sum.itemCount, 2);
    check("and the delivery carries an over-delivery", sum.hasOverDelivery, true);

    const single = summarizeDelivery([
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 30, over: false, poId: "P1" },
    ]);
    check("a one-item delivery has no extra count", single.extraCount, 0);
    check("  and no over-delivery", single.hasOverDelivery, false);
    check("  and its label includes the size", single.first.label, 'Pipe 2"');
    assert("no rows summarizes to null rather than a blank row", summarizeDelivery([]) === null);
    assert("undefined too", summarizeDelivery(undefined) === null);

    log("");
    log("Banner copy names the item only when there are several:");
    const multiBanners = describeDelivery(multi);
    assert(
        "the over message names the item on a multi-item delivery",
        multiBanners.some((m) => m.text.includes("Pipe"))
    );
    check("and reports the split across orders too", multiBanners[0].key, "split");
    const singleOverBanners = describeDelivery([
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 30, over: false, poId: "P1" },
        { materialRecordId: "recPipe", itemName: "Pipe", size: '2"', unit: "FT", qty: 4, over: true, poId: "P1" },
    ]);
    assert(
        "but NOT on a single-item delivery, where the name is already the headline",
        !singleOverBanners.some((m) => m.text.includes("of Pipe"))
    );
    check("one message per over-delivered ITEM, not per flagged row", describeDelivery([
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 1, over: true, poId: "P1" },
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 2, over: true, poId: "P1" },
    ]).length, 1);
    check("  summing the flagged quantity across slices", describeDelivery([
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 1, over: true, poId: "P1" },
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 2, over: true, poId: "P1" },
    ])[0].text.includes("3 EA"), true);
    // Flagged slices spread over two orders cannot claim one, so it must fall to
    // the unattached wording even though every slice names a PO.
    check("flagged slices on two orders report as unattached", describeDelivery([
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 1, over: true, poId: "P1" },
        { materialRecordId: "recA", itemName: "A", size: "", unit: "EA", qty: 2, over: true, poId: "P2" },
    ])[0].key, "over-unattached");

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
