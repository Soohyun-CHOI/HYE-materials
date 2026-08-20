// The delivery allocation rule (#162) — candidate set, order, split, over-delivery.
//
// Site staff never pick an ordered item, so this rule is the whole of what a delivery
// is recorded against, and there is no allocation-editing UI to fix a wrong
// answer afterwards: a mistake is corrected by deleting the delivery and
// entering it again. That is why every clause is pinned here rather than trusted
// to the credentialed script, which can only exercise a handful of shapes
// against real records.
//
// Offline-safe: lib/deliveryAllocation.js imports only lib/poItemQty.js, which
// imports nothing, with the extension spelled out — so plain node resolves the
// chain with no loader and no credentials. (It was lib/materialPriceView.js
// until #169 moved countsAsOrdered to its real home.)

import {
    ALLOCATION_COPY,
    BLOCKED,
    availableItemOptions,
    buildItemOptions,
    describeDelivery,
    describePlan,
    recomputeOverDelivery,
    hasUndeliveredQty,
    groupRowsByItem,
    groupRowsByItemAndOrder,
    itemOptionLabel,
    planDelivery,
    selectCandidates,
    sortCandidates,
    summarizeDelivery,
    undeliveredQty,
} from "../../../lib/deliveryAllocation.js";
import { readFileSync } from "node:fs";
// #227's cross-file shape pin reads the writer and the readers out of the tree, so
// this check needs the AST helpers as well as the functions themselves.
import { parseFile, repoPath, resolveFunction, walk as walkAst } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Delivery allocation — candidates, order, split, over-delivery (#162, #165)";

const VENDOR = "recVendorA";
const OTHER_VENDOR = "recVendorB";
const MATERIAL = "recMatPipe";
const OTHER_MATERIAL = "recMatValve";

/** An ordered item in the shape lib/deliveryCandidates.js hands over. */
function orderedItem(over) {
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
        orderedItem({ poItemId: "keep" }),
        orderedItem({ poItemId: "wrong-vendor", vendorRecordId: OTHER_VENDOR }),
        orderedItem({ poItemId: "wrong-material", materialRecordId: OTHER_MATERIAL }),
        orderedItem({ poItemId: "withdrawn", committedQty: 0 }),
        orderedItem({ poItemId: "zero-qty", qty: 0, committedQty: 0 }),
    ];
    const picked = selectCandidates({ orderedItems: pool, vendorRecordId: VENDOR, materialRecordId: MATERIAL });
    check("only the matching ordered item survives", picked.length, 1);
    check("and it is the right one", picked[0].poItemId, "keep");

    // The withdrawn case is read off Committed Qty, not off a status string —
    // #18 put the which-POs-count rule in that one field on purpose.
    const withdrawnOnly = selectCandidates({
        orderedItems: [orderedItem({ poItemId: "withdrawn", committedQty: 0, deliveredQty: 0 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
    });
    check("a withdrawn PO's ordered item is not a candidate", withdrawnOnly.length, 0);

    // Signature status is deliberately not a filter: site orders first and the
    // PR/PO follow as a record, so an unsigned order must still receive goods.
    const unsigned = selectCandidates({
        orderedItems: [orderedItem({ poItemId: "awaiting", qty: 10, committedQty: 10 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
    });
    check("an unsigned PO's ordered item IS a candidate", unsigned.length, 1);

    const narrowedToPo = selectCandidates({
        orderedItems: [
            orderedItem({ poItemId: "a", poRecordId: "recPO1" }),
            orderedItem({ poItemId: "b", poRecordId: "recPO2" }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO2",
    });
    check("a supplied PO narrows to its own ordered items", narrowedToPo.length, 1);
    check("and it is that PO's ordered item", narrowedToPo[0].poItemId, "b");

    log("");
    log("Order — oldest first, then PO ID, then PO Item ID:");
    const sorted = sortCandidates([
        orderedItem({ poItemId: "newer", poId: "HYE-PO-20260320-01", poCreatedDate: "2026-03-20" }),
        orderedItem({ poItemId: "oldest", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01" }),
        orderedItem({ poItemId: "middle", poId: "HYE-PO-20260210-01", poCreatedDate: "2026-02-10" }),
    ]);
    check("oldest PO first", sorted.map((l) => l.poItemId).join(","), "oldest,middle,newer");

    const sameDay = sortCandidates([
        orderedItem({ poItemId: "second", poId: "HYE-PO-20260101-02", poCreatedDate: "2026-01-01" }),
        orderedItem({ poItemId: "first", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01" }),
    ]);
    check("same calendar day ties break on PO ID", sameDay.map((l) => l.poItemId).join(","), "first,second");

    const samePo = sortCandidates([
        orderedItem({ poItemId: "HYE-PO-20260101-01-002" }),
        orderedItem({ poItemId: "HYE-PO-20260101-01-001" }),
    ]);
    check(
        "ordered items within one PO order by PO Item ID",
        samePo.map((l) => l.poItemId).join(","),
        "HYE-PO-20260101-01-001,HYE-PO-20260101-01-002"
    );

    const undated = sortCandidates([
        orderedItem({ poItemId: "undated", poCreatedDate: null }),
        orderedItem({ poItemId: "dated", poCreatedDate: "2026-05-05" }),
    ]);
    check("an undated ordered item sorts LAST, never first", undated.map((l) => l.poItemId).join(","), "dated,undated");

    log("");
    log("Exact fill and partial fill:");
    const one = [orderedItem({ poItemId: "a", qty: 10 })];
    const exact = planDelivery({ orderedItems: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 10 });
    check("an exact quantity makes one row", exact.rows.length, 1);
    check("with the whole quantity", exact.rows[0].qty, 10);
    check("not flagged", exact.rows[0].over, false);
    check("nothing over", exact.over, 0);

    const partial = planDelivery({ orderedItems: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 4 });
    check("a partial quantity makes one row of that size", partial.rows[0].qty, 4);
    check("and leaves nothing over", partial.over, 0);
    check("allocated reports what landed", partial.allocated, 4);

    log("");
    log("One quantity spanning two orders becomes two rows:");
    const two = [
        orderedItem({ poItemId: "old", poRecordId: "recPO1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 10, deliveredQty: 0 }),
        orderedItem({ poItemId: "new", poRecordId: "recPO2", poId: "HYE-PO-20260201-01", poCreatedDate: "2026-02-01", qty: 10, deliveredQty: 0 }),
    ];
    const split = planDelivery({ orderedItems: two, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 15 });
    check("two rows", split.rows.length, 2);
    check("the older order fills first", split.rows[0].orderedItem.poItemId, "old");
    check("to its full remainder", split.rows[0].qty, 10);
    check("the remainder goes to the newer order", split.rows[1].orderedItem.poItemId, "new");
    check("as the balance", split.rows[1].qty, 5);
    check("the two row quantities sum to what was entered", split.rows[0].qty + split.rows[1].qty, 15);
    check("neither row is flagged", split.rows.some((r) => r.over), false);
    check("two distinct POs are reported", split.poRecordIds.length, 2);

    const three = planDelivery({
        orderedItems: [
            orderedItem({ poItemId: "a", poRecordId: "p1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 5 }),
            orderedItem({ poItemId: "b", poRecordId: "p2", poId: "HYE-PO-20260201-01", poCreatedDate: "2026-02-01", qty: 5 }),
            orderedItem({ poItemId: "c", poRecordId: "p3", poId: "HYE-PO-20260301-01", poCreatedDate: "2026-03-01", qty: 5 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 12,
    });
    check("three orders, three rows", three.rows.length, 3);
    check("filled oldest to newest", three.rows.map((r) => r.qty).join(","), "5,5,2");

    // A partly delivered ordered item contributes only its remainder.
    const partlyDelivered = planDelivery({
        orderedItems: [orderedItem({ poItemId: "a", qty: 10, deliveredQty: 7 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 3,
    });
    check("a partly delivered ordered item offers only its remainder", partlyDelivered.rows[0].qty, 3);
    check("and is then exactly filled", partlyDelivered.over, 0);

    log("");
    log("Over-delivery, case (a) — one order in play, so the excess names it:");
    const overOne = planDelivery({ orderedItems: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 13 });
    check("two rows: the fill and the excess", overOne.rows.length, 2);
    check("the fill takes what was undelivered", overOne.rows[0].qty, 10);
    check("the excess is its own row", overOne.rows[1].qty, 3);
    check("flagged", overOne.rows[1].over, true);
    check("and it names the ordered item", overOne.rows[1].orderedItem.poItemId, "a");
    check("over reports the excess", overOne.over, 3);
    check("the excess row's qty IS the excess, no arithmetic needed", overOne.rows[1].qty, overOne.over);

    log("");
    log("Over-delivery, case (b) — two orders in play: the excess names the LAST FILLED (#165):");
    // #162 left this row unattached, on the grounds that no single order had been
    // over-delivered. The cost was worse than the imprecision: an unlinked row is
    // in no ordered item's Delivered Qty, so a delivery that arrived in full read
    // as less arrived than was billed.
    const overTwo = planDelivery({ orderedItems: two, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 25 });
    check("three rows", overTwo.rows.length, 3);
    check("both orders filled", overTwo.rows.slice(0, 2).map((r) => r.qty).join(","), "10,10");
    check("the excess is 5", overTwo.rows[2].qty, 5);
    check("flagged", overTwo.rows[2].over, true);
    assert("and it names an ordered item", overTwo.rows[2].orderedItem !== null);
    check(
        "the LAST ordered item filled, not the first",
        overTwo.rows[2].orderedItem.poItemId,
        overTwo.rows[1].orderedItem.poItemId
    );
    check("which is the newer order, since fill order is oldest-first", overTwo.rows[2].orderedItem.poItemId, "new");
    assert(
        "its siblings still name the orders they filled",
        overTwo.rows.filter((r) => !r.over).every((r) => Boolean(r.orderedItem.poId))
    );

    log("");
    log("Over-delivery with no candidate left at all:");
    const fullyDelivered = [orderedItem({ poItemId: "a", qty: 10, deliveredQty: 10 })];
    const noneLeft = planDelivery({
        orderedItems: fullyDelivered,
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 4,
    });
    check("one row", noneLeft.rows.length, 1);
    check("all of it flagged", noneLeft.rows[0].over, true);
    check("with the full quantity", noneLeft.rows[0].qty, 4);
    assert("attached, even though nothing was filled", noneLeft.rows[0].orderedItem !== null);
    check("to the only narrowed ordered item", noneLeft.rows[0].orderedItem.poItemId, "a");
    check("nothing was allocated", noneLeft.allocated, 0);
    check("no candidates could absorb it", noneLeft.candidates.length, 0);
    assert("but the ordered item was still narrowed to", noneLeft.narrowed.length === 1);

    // Nothing of this material ordered from this vendor at all: no ordered item
    // to name.
    const nothingOrdered = planDelivery({
        orderedItems: [orderedItem({ poItemId: "a", vendorRecordId: OTHER_VENDOR })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 6,
    });
    check("nothing is recorded at all — there is no ordered item to attach to", nothingOrdered.rows.length, 0);
    check("and the plan says why", nothingOrdered.blocked, BLOCKED.notOrdered);
    check("narrowed set is empty", nothingOrdered.narrowed.length, 0);

    log("");
    log("A supplied PO ID is a HARD restriction — excess never spills:");
    const narrowed = planDelivery({
        orderedItems: two,
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO1",
        qty: 18,
    });
    check("only the named PO's ordered item is filled", narrowed.rows[0].orderedItem.poItemId, "old");
    check("to its remainder", narrowed.rows[0].qty, 10);
    check("the rest is flagged, not moved to the other order", narrowed.rows[1].over, true);
    check("as 8", narrowed.rows[1].qty, 8);
    assert(
        "the other order received nothing",
        !narrowed.rows.some((r) => r.orderedItem && r.orderedItem.poItemId === "new")
    );
    check("the excess names the narrowed order", narrowed.rows[1].orderedItem.poItemId, "old");

    // One PO carrying two ordered items of the same material. #162 left this
    // unattached — the PO was unambiguous but the ordered item was not — and
    // recorded only the PO-level fact on Deliveries.PO. #165 resolves it by fill
    // order, which is why this feature no longer depends on a PO holding at most
    // one ordered item per material (and so does not wait on #170).
    const twoOrderedItemsOnePo = planDelivery({
        orderedItems: [
            orderedItem({ poItemId: "HYE-PO-20260101-01-001", poRecordId: "recPO1", qty: 5 }),
            orderedItem({ poItemId: "HYE-PO-20260101-01-002", poRecordId: "recPO1", qty: 5 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO1",
        qty: 14,
    });
    check("both ordered items of the one PO fill", twoOrderedItemsOnePo.rows.slice(0, 2).map((r) => r.qty).join(","), "5,5");
    check("the excess is 4", twoOrderedItemsOnePo.rows[2].qty, 4);
    check("the excess names the second ordered item, the last one filled", twoOrderedItemsOnePo.rows[2].orderedItem.poItemId, "HYE-PO-20260101-01-002");
    check("only one PO was drawn on", twoOrderedItemsOnePo.poRecordIds.length, 1);

    log("");
    log("THE #165 INVARIANT — a plan is blocked, or every row it makes names an ordered item:");
    // Stated over a spread of plans rather than asserted once per case, because
    // this is the property the whole issue is: an unlinked row is in no ordered item's
    // Delivered Qty, so the delivery vanishes from the invoice axis.
    const everyPlan = [
        ["exact fill", exact],
        ["split across two orders", split],
        ["over, one order", overOne],
        ["over, two orders", overTwo],
        ["over, nothing left undelivered", noneLeft],
        ["over, PO-narrowed", narrowed],
        ["over, two ordered items on one PO", twoOrderedItemsOnePo],
        ["blocked, nothing ordered", nothingOrdered],
    ];
    for (const [label, plan] of everyPlan) {
        assert(
            `${label}: ${plan.blocked ? "blocked, so no rows" : "every row names an ordered item"}`,
            plan.blocked ? plan.rows.length === 0 : plan.rows.every((r) => Boolean(r.orderedItem))
        );
    }
    assert(
        "and the invariant is not vacuous — some of those plans do produce rows",
        everyPlan.some(([, p]) => p.rows.length > 0)
    );

    log("");
    log("Blocked: a supplied PO that does not carry the item (#165):");
    // NOT reachable from the entry form — it builds its item options from the typed
    // PO's own ordered items and resets the rows whenever the PO changes. Reachable at
    // SUBMIT, where createDeliveryAction re-runs this from a fresh read and a PO
    // may have been withdrawn in the meantime, and by a direct call on the action.
    // #162 wrote an unlinked row with blank frozen fields for this.
    const poWithoutItem = planDelivery({
        orderedItems: [orderedItem({ poItemId: "a", poRecordId: "recPO1" })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        poRecordId: "recPO2",
        qty: 5,
    });
    check("nothing is recorded", poWithoutItem.rows.length, 0);
    check("blocked with the PO-specific reason", poWithoutItem.blocked, BLOCKED.poHasNoOrderedItem);
    check("narrowed to nothing, which is what blocked it", poWithoutItem.narrowed.length, 0);
    // The two reasons are distinguished only by whether a PO was supplied, and
    // they ask the recorder for different things.
    assert("the two reasons are distinct values", BLOCKED.poHasNoOrderedItem !== BLOCKED.notOrdered);
    const blockedCopy = describePlan(poWithoutItem, { poId: "HYE-PO-20260101-02", label: 'Pipe 2"' });
    check("one message, and it is the reason", blockedCopy.length, 1);
    check("keyed as blocked", blockedCopy[0].key, "blocked-po-has-no-ordered-item");
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
        orderedItem({ poItemId: "c", poRecordId: "recPO3", poId: "HYE-PO-20260103-01", poCreatedDate: "2026-01-03", qty: 5, deliveredQty: 5 }),
        orderedItem({ poItemId: "a", poRecordId: "recPO1", poId: "HYE-PO-20260101-01", poCreatedDate: "2026-01-01", qty: 5, deliveredQty: 5 }),
        orderedItem({ poItemId: "b", poRecordId: "recPO2", poId: "HYE-PO-20260102-01", poCreatedDate: "2026-01-02", qty: 5, deliveredQty: 5 }),
    ];
    const allFull = planDelivery({ orderedItems: threeOrders, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 2 });
    check("nothing could be filled", allFull.allocated, 0);
    check("so the excess goes to the MOST RECENT order", allFull.rows[0].orderedItem.poItemId, "c");
    check(
        "which is exactly sortCandidates' last element",
        allFull.rows[0].orderedItem.poItemId,
        sortCandidates(allFull.narrowed).at(-1).poItemId
    );
    // An undated ordered item sorts last so a data gap cannot take FIFO priority,
    // so the tail picks it. Coherent under the same reading — last to be filled,
    // last to be blamed — and unreachable on this base, where every PO carries a
    // date.
    const withUndated = planDelivery({
        orderedItems: [...threeOrders, orderedItem({ poItemId: "z", poRecordId: "recPO9", poCreatedDate: null, qty: 5, deliveredQty: 5 })],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 2,
    });
    check("an undated ordered item is the tail, as it is the tail of the fill order", withUndated.rows[0].orderedItem.poItemId, "z");

    log("");
    log("Degenerate inputs plan nothing rather than misbehaving:");
    for (const [label, qty] of [["zero", 0], ["negative", -5], ["not a number", "abc"], ["missing", undefined]]) {
        const p = planDelivery({ orderedItems: one, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty });
        check(`a ${label} quantity makes no rows`, p.rows.length, 0);
        check(`  and nothing over`, p.over, 0);
    }
    const noOrderedItems = planDelivery({ orderedItems: [], vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("an empty ordered item list is blocked, not written unattached (#165)", noOrderedItems.rows.length, 0);
    check("  with the not-ordered reason", noOrderedItems.blocked, BLOCKED.notOrdered);
    const undefinedOrderedItems = planDelivery({ vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 5 });
    check("a missing ordered item list does not throw", undefinedOrderedItems.rows.length, 0);

    log("");
    log("totalUndelivered counts only what candidates can absorb:");
    const mixed = planDelivery({
        orderedItems: [
            orderedItem({ poItemId: "a", qty: 10, deliveredQty: 4 }),
            orderedItem({ poItemId: "b", qty: 10, deliveredQty: 10 }),
            orderedItem({ poItemId: "c", qty: 10, deliveredQty: 12 }),
        ],
        vendorRecordId: VENDOR,
        materialRecordId: MATERIAL,
        qty: 1,
    });
    check("6 from the one ordered item with a remainder", mixed.totalUndelivered, 6);
    check("the fully and over delivered ordered items are not candidates", mixed.candidates.length, 1);

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
        orderedItem({ poItemId: "a", qty: 10, deliveredQty: 4 }),
        orderedItem({ poItemId: "b", qty: 10, deliveredQty: 10 }),
        orderedItem({ poItemId: "c", materialRecordId: OTHER_MATERIAL, qty: 5, deliveredQty: 5 }),
        orderedItem({ poItemId: "d", materialRecordId: "recMatBolt", qty: 7, committedQty: 0 }),
        orderedItem({ poItemId: "e", vendorRecordId: OTHER_VENDOR, materialRecordId: "recMatOther" }),
    ];
    const options = buildItemOptions(optionPool, VENDOR);
    check("two materials offered for this vendor", options.length, 2);
    const pipe = options.find((o) => o.materialRecordId === MATERIAL);
    check("the partly delivered item shows its remainder", pipe.undelivered, 6);
    check("  summed across its two ordered items", pipe.orderedItemCount, 2);
    check("  ordered totals both ordered items", pipe.ordered, 20);
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
    check("an empty ordered item list offers nothing", buildItemOptions([], VENDOR).length, 0);
    check("a missing ordered item list does not throw", buildItemOptions(undefined, VENDOR).length, 0);
    // An over-delivered ordered item must not report a negative remainder to the
    // screen.
    const overPool = [orderedItem({ poItemId: "o", qty: 5, deliveredQty: 9 })];
    check("an over-delivered ordered item clamps undelivered at 0", buildItemOptions(overPool, VENDOR)[0].undelivered, 0);

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
    log("THE QUIET MUTANT — a table that does not fold is the screen #238 replaced:");
    // Its failure mode is silence, the same station as #237's `always agree`, #242's
    // removed narrowing and #241's always-silent list: returning the rows untouched
    // renders exactly what shipped before this issue, and every delivery whose rows
    // are already one-per-order passes anyway. So the first assertion here is that
    // something folds at all. `HYE-DL-260804-02`'s shape: one material, 10 against one
    // order, then 10 within and 5 beyond against a second.
    const pipeRows = [
        { id: "recRow1", materialRecordId: "recPipe", poRecordId: "recPO_A", poId: "HYE-PO-20260804-01", itemName: "Pipe", size: '2"', unit: "EA", qty: 10, over: false },
        { id: "recRow2", materialRecordId: "recPipe", poRecordId: "recPO_B", poId: "HYE-PO-20260804-02", itemName: "Pipe", size: '2"', unit: "EA", qty: 10, over: false },
        { id: "recRow3", materialRecordId: "recPipe", poRecordId: "recPO_B", poId: "HYE-PO-20260804-02", itemName: "Pipe", size: '2"', unit: "EA", qty: 5, over: true },
    ];
    const noFold = (rows) => (rows || []).map((r) => ({ ...r, key: r.id, overQty: r.over ? r.qty : 0 }));
    const folded = groupRowsByItemAndOrder(pipeRows);
    check("three stored rows read as two", folded.length, 2);
    assert(
        "  so the no-fold mutant disagrees with the rule on this delivery",
        noFold(pipeRows).length !== folded.length
    );
    // The loud mutant is a real function rather than an invented one: folding on the
    // material alone is `groupRowsByItem`, whose group spans two orders and therefore
    // has nothing to put in this table's `Order` cell — #167's problem, one screen over.
    check("folding on the material alone gives one group", groupRowsByItem(pipeRows).length, 1);
    assert(
        "  which names no single order, and the rule refuses it",
        groupRowsByItem(pipeRows)[0].poIds.size === 2 && folded.every((g) => g.poId)
    );

    log("");
    log("What a folded row carries:");
    check("the two slices against one order are one row", folded[1].rowIds.length, 2);
    check("  summing what was delivered against it", folded[1].qty, 15);
    check("  of which the flagged part is named separately", folded[1].overQty, 5);
    check("  and the row states which slice carried it", folded[1].overRowIds.join(","), "recRow3");
    check("the other order's row is untouched", folded[0].qty, 10);
    check("  and has no excess", folded[0].overQty, 0);
    check("  so it states none", folded[0].overRowIds.length, 0);
    check("entry order is kept", folded.map((g) => g.poId).join(","), "HYE-PO-20260804-01,HYE-PO-20260804-02");
    check("a row folds under its own order's id", folded[1].poRecordId, "recPO_B");

    // `overRowIds` IS A LIST BECAUSE THE CODE CAN PRODUCE TWO, and this is measured
    // with `recomputeOverDelivery` rather than asserted: 6, 6, 6 against an order of
    // 10 leaves the second row split at the boundary and the third wholly flagged, so
    // one delivery holds two flagged rows against one ordered item.
    const replay = recomputeOverDelivery({
        orderedQty: 10,
        rows: [
            { id: "recA", deliveryItemId: "HYE-DL-260101-01-001", qty: 6 },
            { id: "recB", deliveryItemId: "HYE-DL-260101-01-002", qty: 6 },
            { id: "recC", deliveryItemId: "HYE-DL-260101-01-003", qty: 6 },
        ],
    });
    check("the replay flags the third row whole", replay.rows.filter((r) => r.overDelivered).length, 1);
    check("  and splits the second", replay.splits.length, 1);
    const afterReplay = [
        ...replay.rows.map((r) => ({
            id: r.id,
            materialRecordId: "recPipe",
            poRecordId: "recPO_A",
            poId: "HYE-PO-20260101-01",
            itemName: "Pipe",
            size: '2"',
            unit: "EA",
            qty: r.qty,
            over: r.overDelivered,
        })),
        { id: "recD", materialRecordId: "recPipe", poRecordId: "recPO_A", poId: "HYE-PO-20260101-01", itemName: "Pipe", size: '2"', unit: "EA", qty: replay.splits[0].qty, over: true },
    ];
    const replayFolded = groupRowsByItemAndOrder(afterReplay);
    check("which folds to one row", replayFolded.length, 1);
    check("  holding both flagged slices", replayFolded[0].overRowIds.length, 2);
    assert(
        "  so a singular field would have dropped one — the reason it is a list",
        replayFolded[0].overRowIds.includes("recC") && replayFolded[0].overRowIds.includes("recD")
    );
    check("  and the excess sums across them", replayFolded[0].overQty, 8);

    log("");
    log("A row missing either link is its own group:");
    const looseFold = groupRowsByItemAndOrder([
        { id: "recX", materialRecordId: "recPipe", poRecordId: "recPO_A", poId: "P1", itemName: "Pipe", size: "", unit: "EA", qty: 10, over: false },
        { id: "recY", materialRecordId: "recPipe", poRecordId: null, poId: null, itemName: "Pipe", size: "", unit: "EA", qty: 4, over: true },
        { id: "recZ", materialRecordId: null, poRecordId: "recPO_A", poId: "P1", itemName: "Pipe", size: "", unit: "EA", qty: 2, over: false },
    ]);
    check("an over row naming no order stands alone", looseFold.length, 3);
    assert(
        "  and is not merged under a name — the two that could have been are separate",
        looseFold[1].rowIds.join(",") === "recY" && looseFold[2].rowIds.join(",") === "recZ"
    );
    check("no rows folds to nothing", groupRowsByItemAndOrder([]).length, 0);
    check("undefined does not throw", groupRowsByItemAndOrder(undefined).length, 0);

    log("");
    log("The excess figure, in the word `/pos/[poId]` already uses:");
    check("it names the quantity", ALLOCATION_COPY.table.overPortion(5).text, "(5 over)");
    check("  and its key is stable for a call site", ALLOCATION_COPY.table.overPortion(5).key, "over-portion");
    assert(
        "  and carries no unit, the total beside it having one",
        !/\b(EA|FT|PCS)\b/.test(ALLOCATION_COPY.table.overPortion(5).text)
    );
    // THE JUDGMENT IS UNTOUCHED, which is #241's rule transferred: the shared summary
    // is what a list row and this page both read, so folding the table must not move
    // it. Asserted on the same rows the fold was asserted on.
    check("the shared summary still reads one item", summarizeDelivery(pipeRows).itemCount, 1);
    check("  with the whole quantity", summarizeDelivery(pipeRows).first.qty, 25);
    check("  and the delivery still flagged", summarizeDelivery(pipeRows).hasOverDelivery, true);
    check("the banner still names the excess once", describeDelivery(pipeRows).filter((m) => m.key === "over-attached").length, 1);

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
    const input = [orderedItem({ poItemId: "a", qty: 10 })];
    const before = JSON.stringify(input);
    planDelivery({ orderedItems: input, vendorRecordId: VENDOR, materialRecordId: MATERIAL, qty: 25 });
    check("the caller's ordered item list is untouched", JSON.stringify(input), before);
    const toSort = [orderedItem({ poItemId: "b", poCreatedDate: "2026-02-01" }), orderedItem({ poItemId: "a", poCreatedDate: "2026-01-01" })];
    const orderBefore = toSort.map((l) => l.poItemId).join(",");
    sortCandidates(toSort);
    check("sortCandidates copies rather than sorting in place", toSort.map((l) => l.poItemId).join(","), orderBefore);

    // --- #206: THE RECOMPUTATION REPRODUCES #162'S CONTRACT ----------------
    //
    // NOT the allocation. planDelivery also decides WHICH ordered item a delivery
    // attaches to, by FIFO across candidate ordered items, and the recomputation
    // deliberately does not redo that — it works inside one ordered item and
    // moves only the within/over boundary. So what is asserted here is the
    // contract, in quantities: the unflagged rows of an ordered item sum to what
    // was ordered, and the flagged rows sum to the excess. Row-for-row identity
    // with a fresh allocation is NOT claimed and would be false, because an
    // earlier delivery's freed room is not handed back to a later delivery's row.
    log("");
    log("#206 — the recomputation restores #162's contract on every ordered item:");

    function simulate(startItems, deliveries) {
        const state = startItems.map((l) => ({ ...l }));
        const rowsByOrderedItem = new Map(state.map((l) => [l.id, []]));
        for (let d = 0; d < deliveries.length; d++) {
            const plan = planDelivery({
                orderedItems: state,
                vendorRecordId: VENDOR,
                materialRecordId: MATERIAL,
                qty: deliveries[d],
            });
            plan.rows.forEach((r, j) => {
                rowsByOrderedItem.get(r.orderedItem.id).push({
                    id: `rec-${d}-${j}`,
                    deliveryItemId: `HYE-DL-2608${String(d + 1).padStart(2, "0")}-01-${String(j + 1).padStart(3, "0")}`,
                    delivery: d,
                    qty: r.qty,
                    over: r.over,
                });
                const target = state.find((l) => l.id === r.orderedItem.id);
                target.deliveredQty = (target.deliveredQty || 0) + r.qty;
            });
        }
        return { state, rowsByOrderedItem };
    }

    // Apply a plan the way lib/deliveryDelete.js does: resize in place, then add
    // the flagged pieces. Nothing is deleted and nothing is merged.
    function applyPlan(rows, plan) {
        const byId = new Map(rows.map((r) => [r.id, r]));
        const out = plan.rows.map((want) => ({ ...byId.get(want.id), qty: want.qty, over: want.overDelivered }));
        plan.splits.forEach((sp, i) => {
            const from = byId.get(sp.fromRowId);
            out.push({ ...from, id: `${from.id}-split${i}`, qty: sp.qty, over: true });
        });
        return out;
    }

    const totals = (rows) => ({
        within: rows.filter((r) => !r.over).reduce((a, r) => a + r.qty, 0),
        over: rows.filter((r) => r.over).reduce((a, r) => a + r.qty, 0),
    });

    // Every scenario deletes one delivery. `straddles` records whether the
    // survivors leave a row crossing the boundary, which the anti-vacuity below
    // requires the corpus to contain.
    const scenarios = [
        { name: "the survivor fits entirely", qty: 10, deliveries: [10, 4], drop: 0 },
        { name: "nothing left over at all", qty: 10, deliveries: [4, 3], drop: 0 },
        { name: "the survivor is exactly the order", qty: 10, deliveries: [4, 10], drop: 0 },
        { name: "STRADDLE: 6 then 12, drop the 6", qty: 10, deliveries: [6, 12], drop: 0 },
        { name: "STRADDLE: 4, 4, 10, drop the middle", qty: 10, deliveries: [4, 4, 10], drop: 1 },
        { name: "STRADDLE: 5, 5, 5, 12, drop one", qty: 20, deliveries: [5, 5, 5, 12], drop: 1 },
    ];

    let straddlesSeen = 0;
    let splitsSeen = 0;
    for (const sc of scenarios) {
        const built = simulate([orderedItem({ poItemId: sc.name, qty: sc.qty })], sc.deliveries);
        const ln = built.state[0];
        const survivors = built.rowsByOrderedItem.get(ln.id).filter((r) => r.delivery !== sc.drop);

        const plan = recomputeOverDelivery({ orderedQty: sc.qty, rows: survivors });
        const after = applyPlan(survivors, plan);
        splitsSeen += plan.splits.length;

        const delivered = survivors.reduce((a, r) => a + r.qty, 0);
        const t = totals(after);
        const expectedWithin = Math.min(delivered, sc.qty);
        const expectedOver = Math.max(0, delivered - sc.qty);
        if (plan.splits.length) straddlesSeen++;

        check(`${sc.name}: unflagged rows sum to what was ordered`, t.within, expectedWithin);
        check(`  and flagged rows sum to the excess`, t.over, expectedOver);
        // Nothing invented, nothing lost.
        check(`  total quantity is unchanged by the redraw`, t.within + t.over, delivered);

        // The same two quantities a fresh allocation of the survivors would give.
        // Quantities only — the ROWS differ, deliberately, and asserting otherwise
        // would be applying a standard to boundaries that ordered item attribution does
        // not use.
        const scratch = simulate(
            [orderedItem({ poItemId: sc.name + "-scratch", qty: sc.qty })],
            sc.deliveries.filter((_, d) => d !== sc.drop)
        );
        const fresh = totals(scratch.rowsByOrderedItem.get(scratch.state[0].id));
        check(`  matches a fresh allocation on within`, t.within, fresh.within);
        check(`  and on over`, t.over, fresh.over);
    }

    // ANTI-VACUITY, AND #171 IS WHY IT IS HERE. A new check's first version passed
    // 89 cases for the wrong reason. Two things have to be true of this corpus or
    // the assertions above are satisfied by a recomputation that never splits:
    // it must CONTAIN a straddle, and the straddle must actually have produced
    // one. Drop the three STRADDLE scenarios and both of these fail while every
    // contract assertion above still passes — which is exactly the hole they fill.
    log("");
    log("anti-vacuity — the corpus is shown to contain the case that needs splitting:");
    assert(`${straddlesSeen} scenarios left a row crossing the boundary`, straddlesSeen >= 3);
    assert(`${splitsSeen} rows were actually split`, splitsSeen >= 3);

    log("");
    log("the split itself:");
    // Order 10; 4 already inside, then a row of 8 that crosses. The record keeps
    // the within piece and the excess is the new row — never the other way round,
    // because a new row sorts LAST and putting the within piece there would leave
    // the ordered item reading within, over, within.
    const crossing = recomputeOverDelivery({
        orderedQty: 10,
        rows: [
            { id: "a", deliveryItemId: "HYE-DL-260801-01-001", qty: 4 },
            { id: "b", deliveryItemId: "HYE-DL-260802-01-001", qty: 8 },
        ],
    });
    check("one row is split", crossing.splits.length, 1);
    check("  the record keeps the WITHIN piece", crossing.rows.find((r) => r.id === "b").qty, 6);
    check("  and it stops being flagged", crossing.rows.find((r) => r.id === "b").overDelivered, false);
    check("  the excess becomes a new row", crossing.splits[0].qty, 2);
    check("  minted from the row that crossed", crossing.splits[0].fromRowId, "b");
    // AT MOST ONE PER ORDERED ITEM, because every stored row has a positive Qty so the
    // running total crosses the ordered quantity exactly once.
    const many = recomputeOverDelivery({
        orderedQty: 10,
        rows: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `r${n}`, deliveryItemId: `HYE-DL-26080${n}-01-001`, qty: 3 })),
    });
    check("six rows of 3 against an order of 10 still split only once", many.splits.length, 1);

    log("");
    log("shape:");
    check("no rows, nothing to do", recomputeOverDelivery({ orderedQty: 10, rows: [] }).rows.length, 0);
    check("nullish does not throw", recomputeOverDelivery().rows.length, 0);
    check("  and splits nothing", recomputeOverDelivery().splits.length, 0);
    // A zero-qty ordered item has room for nothing, so its first row is already
    // surplus — and is wholly surplus, so there is nothing to split.
    const noOrder = recomputeOverDelivery({ orderedQty: 0, rows: [{ id: "z", deliveryItemId: "x", qty: 1 }] });
    check("an order of nothing flags its first row", noOrder.rows[0].overDelivered, true);
    check("  without splitting it", noOrder.splits.length, 0);

    // -----------------------------------------------------------------------
    // THE TWO SHAPES NOBODY DECLARES, PINNED ACROSS THE FILES THAT AGREE ON THEM
    // (#227).
    //
    // WHY THIS EXISTS AT ALL. `planDelivery` returns rows whose ordered item sits
    // under a property name, and `getDeliveryCandidates` returns its ordered items
    // under another; neither name is declared anywhere, and the writer and the
    // readers are in different files. Rename one side and the other reads
    // `undefined` — a delivery that records nothing, or a form whose dropdown is
    // empty — and every assertion in this file still passes, because the fixtures
    // above and the production writer move together. #227 renamed both properties
    // (`line` -> `orderedItem`, `lines` -> `orderedItems`) and this is the assertion
    // that would have caught doing it by halves.
    //
    // READ FROM THE WRITER, NOT WRITTEN DOWN. Hard-coding both names would pass a
    // check whose two halves came from the same place — the "always agree" mutant.
    // The writer's name is parsed out of `lib/`, the readers' out of `app/`, and the
    // comparison is between the two files.
    log("");
    log("the plan's row shape is the shape both readers use (#227):");
    const { ast: allocAst } = parseFile("lib/deliveryAllocation.js");
    const plan = resolveFunction(allocAst, "planDelivery");
    assert("planDelivery resolves", Boolean(plan));
    // Every `rows.push({ ... })` inside it, and the property that is not qty/over.
    const pushed = new Set();
    walkAst(plan, (node) => {
        if (node.type !== "CallExpression") return;
        if (node.callee?.property?.name !== "push") return;
        for (const arg of node.arguments) {
            if (arg.type !== "ObjectExpression") continue;
            for (const prop of arg.properties) {
                const name = prop.key?.name;
                if (name && name !== "qty" && name !== "over") pushed.add(name);
            }
        }
    });
    check(
        `one name for the ordered item on a plan row (${[...pushed].join(", ") || "none"})`,
        pushed.size,
        1
    );
    const rowProperty = [...pushed][0];
    assert(`  and it is a name, not a blank (${rowProperty})`, Boolean(rowProperty));

    // The readers, by source text rather than by AST: what matters is that the
    // property is READ under this name, wherever in the file it happens.
    const READERS = [
        ["app/deliveries/new/actions.js", "the Server Action that writes the rows"],
        ["app/deliveries/new/DeliveryForm.js", "the form that previews them"],
    ];
    // A BOUNDARY, NOT `includes`. Measured: with the writer mutated to push
    // `{ item: … }`, `includes(".item")` matched `.itemName` two lines away and the
    // whole pin passed — the "always agree" mutant wearing a different hat.
    const readsProperty = (src, name) => new RegExp(`\\.${name}\\b`).test(src);
    for (const [rel, what] of READERS) {
        const src = readFileSync(repoPath(rel), "utf8");
        assert(`${rel} reads \`.${rowProperty}\` — ${what}`, readsProperty(src, rowProperty));
        // AND NO LONGER READS THE OLD ONE. Without this the check passes on a file
        // that reads both, which is what a half-finished rename looks like.
        assert(`  and nothing there still reads \`row.line\``, !/\brow\.line\b|\br\.line\b/.test(src));
    }

    log("");
    log("the candidate shape is the shape its three readers use (#227):");
    const candidatesSrc = readFileSync(repoPath("lib/deliveryCandidates.js"), "utf8");
    // The returned key, off the writer: `return { <name>, vendorNameById }`.
    const returned = candidatesSrc.match(/return \{\s*(\w+),\s*\n\s*vendorNameById/);
    assert("getDeliveryCandidates' returned key is readable from its source", Boolean(returned));
    const candidateKey = returned?.[1];
    check("and there is one of it", candidateKey ? 1 : 0, 1);
    for (const rel of [
        "app/deliveries/new/page.js",
        "app/deliveries/new/actions.js",
        "scripts/tests/offline/delivery-allocation.mjs",
    ]) {
        const src = readFileSync(repoPath(rel), "utf8");
        assert(
            `${rel} names it \`${candidateKey}\``,
            new RegExp(`\\b${candidateKey}\\b`).test(src)
        );
    }
    // ANTI-VACUITY for both pins, and the second half is the one that matters: a
    // name that is a PREFIX of a real one must come back absent, which is exactly
    // what the mutation above exposed.
    const actionSrc = readFileSync(repoPath("app/deliveries/new/actions.js"), "utf8");
    assert("the reader test can fail — a made-up property is not found", !readsProperty(actionSrc, "orderedLine"));
    assert(
        "  and it is not satisfied by a longer name that starts the same way",
        readsProperty(actionSrc, "itemName") && !readsProperty(actionSrc, "item")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
