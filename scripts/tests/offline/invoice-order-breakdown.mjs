// Which order an invoice item was invoiced against (#237) — the same-set test, the
// exclusion, the per-order quantity, what that quantity is measured against (#408)
// and the copy.
//
// THE FOLD IS THE REAL ONE, NOT A HAND-MADE SHAPE. Every fixture here is raw Invoice
// Items run through `foldInvoiceItems`, because the join this module does is on the
// fold's `rowIds` — asserting against a literal that happened to carry that field
// would pass while the fold stopped exporting it.
//
// THE MUTATION THIS FILE EXISTS TO CATCH RUNS IN BOTH DIRECTIONS, and the one that
// matters is the quiet one. "Always agree" turns the list off everywhere: the feature
// disappears, every silent case still passes, and nothing else in this repository
// renders the answer, so a check with no `shown === true` assertion would report green
// over a dead screen. "Always differ" is the loud failure — a list on every invoice —
// and is checked too, since it is what excluding free-text rows on the wrong link
// would produce. Both mutants are BUILT AND RUN below rather than described, and each
// is shown to disagree with the real rule on a named case.
//
// WHAT THIS TIER CANNOT SEE. It reads pure functions, so the rendering is not here:
// whether the child list actually hangs under the order, and whether an order reached
// only through a free-text row draws its row with nothing under it, are browser
// findings and are in the pull request. `scripts/demo/seed_order_breakdown_237.mjs`
// puts the corrective-order shape on the base so the silent side can be read on a
// screen. Two shapes it CANNOT make, and both are pinned here instead:
//
//   - two items split across the SAME two orders, since one correction is one
//     ordered item and a second correction means a third order;
//   - an invoice item with no `PO Item`. That was a state behind a flag when this
//     was written and is no state at all since #278, so what the read below guards
//     is a link emptied by hand rather than a kind of charge.
//
// #408'S DENOMINATOR RESTS ON A THIRD SHAPE, AND THAT ONE THE APP CAN REACH — which
// is why it is asserted here AND produced on the base by
// `scripts/tests/verify-order-breakdown-408.mjs` rather than pinned on this tier
// alone. One folded item can cover TWO `PO Items` rows on ONE order:
// `lib/prItemMerge.js:mergeKey` holds `Remark` and the quotation where
// `lib/invoiceItemFold.js:foldKey` holds neither, so two request items differing only
// in their remark survive as two rows, snapshot one-for-one into two ordered items,
// and take one `Materials` row and one price. The fold is the coarser unit, so the
// denominator sums the DISTINCT ordered items a charge covers — and both ways of
// getting that wrong are built and run below, because reading one row's `Qty` and
// adding one per invoice item are the two plausible mistakes and they fail on
// different invoices.

import { foldInvoiceItems } from "../../../lib/invoiceItemFold.js";
import {
    ORDER_BREAKDOWN_COPY,
    chargesByOrder,
    ordersNamedByFoldedItem,
    splitSignature,
} from "../../../lib/invoiceOrderBreakdown.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Which order an invoice item was invoiced against (#237)";

const A = "recPO_A";
const B = "recPO_B";
const C = "recPO_C";

/**
 * One raw Invoice Item. `poItem` defaults to a truthy ordered item because the app
 * cannot create a row without one (#278); a row passing `poItem: null` while keeping
 * its `PO` is the shape a hand-emptied link leaves, and the reason the read cannot
 * key on the order link.
 */
const row = ({
    id,
    po = A,
    poItem = `${id}-ordered`,
    material = "recMAT_1",
    itemName = "Elbow",
    size = '3"',
    unit = "EA",
    qty = 5,
    unitPrice = 13.49,
}) => ({
    id,
    invoiceItemId: id,
    po: po ? [po] : [],
    poItem: poItem ? [poItem] : [],
    materialRecordId: material,
    itemName,
    size,
    unit,
    qty,
    unitPrice,
});

/** Raw rows in, `{ folded, items }` out — exactly what the page hands over. */
function invoice(rows) {
    return { folded: foldInvoiceItems(rows), items: rows };
}

// One order, two different items. The ordinary invoice.
const ONE_ORDER = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1" }),
    row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
]);

// Two materials, each invoiced on both orders at one price, so each folds to a single
// item touching {A, B} — and they divide themselves DIFFERENTLY, 10:3 against 5:1.
// The order sets agree, so this was silent until #409 and is listed now.
const SPLIT_DIFFERENTLY = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 20, unitPrice: 41.07 }),
    row({ id: "rec3", po: B, material: "recMAT_1", qty: 3 }),
    row({ id: "rec4", po: B, material: "recMAT_2", itemName: "Tee", qty: 4, unitPrice: 41.07 }),
]);

// The same shape divided the SAME way — 10:5 and 20:10 are both 2:1 — so the two items
// say one thing and the list stays silent. The absolute quantities differ on every
// order, which is what makes this the fixture that tells the reduction apart from a
// raw quantity: unreduced, these two signatures differ.
const SAME_PROPORTIONS = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 20, unitPrice: 41.07 }),
    row({ id: "rec3", po: B, material: "recMAT_1", qty: 5 }),
    row({ id: "rec4", po: B, material: "recMAT_2", itemName: "Tee", qty: 10, unitPrice: 41.07 }),
]);

// ONE item split across both orders, which is what a correction actually produces:
// `createOverageDraft` takes a single delivery row and raises a single-item request.
// One folded item is one signature under any rule, so the browsable silent case #237
// seeded cannot be turned on by this issue or by a later one.
const ONE_ITEM_SPLIT = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: B, material: "recMAT_1", qty: 3 }),
]);

// One order, two items, different quantities. Silent — and the case a RAW per-order
// quantity would have turned on, since `A:10` beside `A:20` differs while the list it
// would draw repeats the items table line for line.
const ONE_ORDER_UNEVEN = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 20, unitPrice: 41.07 }),
]);

// One item invoiced against A, another against B. The case that opened the issue.
const EACH_ITS_OWN = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1" }),
    row({ id: "rec2", po: B, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
]);

// One item split across both, one not.
const ONE_SPLIT = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: B, material: "recMAT_1", qty: 3 }),
    row({ id: "rec3", po: A, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
]);

// Every item is free text: a `PO` on each, no ordered item behind any.
const ALL_FREE_TEXT = invoice([
    row({ id: "rec1", po: A, poItem: null, material: null, itemName: "Freight" }),
    row({ id: "rec2", po: B, poItem: null, material: null, itemName: "Fuel surcharge" }),
]);

// The regression the exclusion exists for: an ordinary one-order invoice plus a
// free-text row pointed at a second order.
const ONE_ORDER_PLUS_FREE_TEXT = invoice([
    ...ONE_ORDER.items,
    row({ id: "rec9", po: B, poItem: null, material: null, itemName: "Freight" }),
]);

// A listed invoice that also carries a free-text row on a THIRD order — the order that
// keeps its row in the section with nothing under it.
const LISTED_PLUS_FREE_TEXT = invoice([
    ...EACH_ITS_OWN.items,
    row({ id: "rec9", po: C, poItem: null, material: null, itemName: "Freight" }),
]);

// Two rows of one item on ONE order, against TWO ordered items — the shape a pair of
// request items differing only in their remark leaves (see the header). `row()`'s
// default gives every row its own ordered item, so this is what the default already
// means; it is named here because the denominator is the thing it decides.
const TWO_ORDERED_ITEMS_ON_A = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 5 }),
    row({ id: "rec2", po: A, material: "recMAT_1", qty: 6 }),
    row({ id: "rec3", po: B, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
]);

// The same two rows against ONE ordered item. Not reachable through the invoice form —
// #91 refuses an ordered item a sibling invoice item already claims — and reachable by
// hand, which is this base's standing condition. It is the case that tells summing the
// DISTINCT ordered items apart from adding one per row.
const ONE_ORDERED_ITEM_TWICE = invoice([
    row({ id: "rec1", po: A, poItem: "shared-ordered", material: "recMAT_1", qty: 5 }),
    row({ id: "rec2", po: A, poItem: "shared-ordered", material: "recMAT_1", qty: 6 }),
    row({ id: "rec3", po: B, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
]);

/**
 * What each ordered item was ordered for (#408).
 *
 * Keyed on the `PO Items` record id, which is what a charge row names through
 * `PO Item` — the map `lib/deliveryReconciliation.js` hands over from rows the page
 * has already read. The figures differ from one another on purpose: a denominator
 * built by summing the wrong set lands on a different number rather than on the
 * right one by luck.
 */
const ORDERED_QTY = new Map([
    ["rec1-ordered", 20],
    ["rec2-ordered", 30],
    ["rec3-ordered", 40],
    ["shared-ordered", 20],
]);

/** One invoice with the ordered quantities attached, the way the page hands them over. */
const withOrderedQty = (fixture, map = ORDERED_QTY) => ({
    ...fixture,
    orderedQtyByOrderedItem: map,
});

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("anti-vacuity — the rule reads its inputs and is not a constant:");
    const empty = chargesByOrder({});
    check("no folded items, nothing shown", empty.shown, false);
    check("  and no order carries anything", empty.byOrder.size, 0);
    check("an invoice whose items name orders populates byOrder", chargesByOrder(ONE_ORDER).byOrder.size, 1);
    assert(
        "the fold still exports the membership this module joins on (`rowIds`)",
        ONE_ORDER.folded.every((g) => Array.isArray(g.rowIds) && g.rowIds.length > 0)
    );
    assert(
        "and the fold really folds these fixtures: 4 rows of SAME_PROPORTIONS become 2 items",
        SAME_PROPORTIONS.items.length === 4 && SAME_PROPORTIONS.folded.length === 2
    );

    // -----------------------------------------------------------------------
    log("the split test — the five cases, and neither answer is the constant one:");
    check("one order: silent", chargesByOrder(ONE_ORDER).shown, false);
    check("one order, uneven quantities: silent", chargesByOrder(ONE_ORDER_UNEVEN).shown, false);
    check("one item split across both: silent", chargesByOrder(ONE_ITEM_SPLIT).shown, false);
    check("every item split the same way: silent", chargesByOrder(SAME_PROPORTIONS).shown, false);
    check("one item on A, one on B: listed", chargesByOrder(EACH_ITS_OWN).shown, true);
    check("one item split, one not: listed", chargesByOrder(ONE_SPLIT).shown, true);
    check("same orders, split differently: listed", chargesByOrder(SPLIT_DIFFERENTLY).shown, true);

    // The proportional case needs no rule of its own — it is silent because its
    // SPLITS agree, which is why this module has no branch naming a correction.
    const proportionalSets = ordersNamedByFoldedItem(SAME_PROPORTIONS).map((e) => e.orderRecordIds.length);
    check("and it is silent with both items on two orders", proportionalSets.join(","), "2,2");
    check(
        "  because the two divide themselves alike",
        ordersNamedByFoldedItem(SAME_PROPORTIONS).map((e) => splitSignature(e)).join(" | ").includes(`${A}:2 ${B}:1`),
        true
    );

    // -----------------------------------------------------------------------
    log("the mutants, built and run — a broken rule must not pass this file:");
    // Written as wrappers over the real function so they cannot drift from it: only
    // `shown` is replaced, which is exactly the judgment under test.
    const alwaysAgree = (input) => ({ ...chargesByOrder(input), shown: false });
    const alwaysDiffer = (input) => ({ ...chargesByOrder(input), shown: true });
    assert(
        "`shown` hard-wired to false (the quiet death) disagrees on `one item on A, one on B`",
        alwaysAgree(EACH_ITS_OWN).shown !== chargesByOrder(EACH_ITS_OWN).shown
    );
    assert(
        "  and on `one item split, one not`",
        alwaysAgree(ONE_SPLIT).shown !== chargesByOrder(ONE_SPLIT).shown
    );
    assert(
        "`shown` hard-wired to true (a list everywhere) disagrees on `one order`",
        alwaysDiffer(ONE_ORDER).shown !== chargesByOrder(ONE_ORDER).shown
    );
    assert(
        "  and on an invoice whose items are all split the same way",
        alwaysDiffer(SAME_PROPORTIONS).shown !== chargesByOrder(SAME_PROPORTIONS).shown
    );

    // -----------------------------------------------------------------------
    log("an item with no ordered item behind it names no order:");
    const freeText = ordersNamedByFoldedItem(ALL_FREE_TEXT);
    check("two free-text items are two folded items", freeText.length, 2);
    check("  and neither names an order", freeText.flatMap((e) => e.orderRecordIds).length, 0);
    assert(
        "  although each carries a `PO` — the exclusion is on `PO Item`, or it excludes nothing",
        ALL_FREE_TEXT.items.every((it) => it.po.length === 1 && it.poItem.length === 0)
    );
    check("an invoice of nothing but free text is silent", chargesByOrder(ALL_FREE_TEXT).shown, false);
    check("  and puts nothing under any order", chargesByOrder(ALL_FREE_TEXT).byOrder.size, 0);
    // The load-bearing half: one free-text row must not turn the list on.
    check(
        "one order plus a free-text row on a second: still silent",
        chargesByOrder(ONE_ORDER_PLUS_FREE_TEXT).shown,
        false
    );
    const listedPlusFreeText = chargesByOrder(LISTED_PLUS_FREE_TEXT);
    check("a listed invoice stays listed with a free-text row added", listedPlusFreeText.shown, true);
    check("  and the free-text row's order carries nothing", listedPlusFreeText.byOrder.has(C), false);

    // -----------------------------------------------------------------------
    // THE READ IS THE WHOLE OF WHAT THIS TIER CARRIES ALONE. It is not a state the
    // app can produce (#278), so no seed and no screen can show it, and the two
    // halves have to be pinned here separately: OUT OF THE JUDGMENT and UNDER NO
    // ORDER. Each is asserted above and each is shown below to fail under the one
    // mutation that would break it, which is keying it on the wrong link.
    log("the exclusion's mutant — keyed on `PO` instead of `PO Item`:");
    const keyedOnPO = ({ folded, items } = {}) => {
        // The real rule with ONE change: a row is admitted on its `PO` alone. That is
        // the plausible mistake, because a free-text row does carry one.
        const rowById = new Map((items || []).map((row) => [row.id, row]));
        const byOrder = new Map();
        const signatures = new Set();
        for (const group of folded || []) {
            const orderRecordIds = [];
            for (const rowId of group.rowIds || []) {
                const orderRecordId = rowById.get(rowId)?.po?.[0];
                if (orderRecordId && !orderRecordIds.includes(orderRecordId)) {
                    orderRecordIds.push(orderRecordId);
                }
            }
            if (orderRecordIds.length === 0) continue;
            signatures.add([...orderRecordIds].sort().join(" "));
            for (const id of orderRecordIds) {
                if (!byOrder.has(id)) byOrder.set(id, []);
                byOrder.get(id).push({ key: group.key });
            }
        }
        return { shown: signatures.size > 1, byOrder };
    };
    const realOnePlus = chargesByOrder(ONE_ORDER_PLUS_FREE_TEXT);
    const mutantOnePlus = keyedOnPO(ONE_ORDER_PLUS_FREE_TEXT);
    check("the mutant lets the free-text row into the judgment, so the list turns ON", mutantOnePlus.shown, true);
    assert(
        "  and the real rule disagrees with it there — this is the assertion that catches it",
        realOnePlus.shown === false && mutantOnePlus.shown !== realOnePlus.shown
    );
    const realListed = chargesByOrder(LISTED_PLUS_FREE_TEXT);
    const mutantListed = keyedOnPO(LISTED_PLUS_FREE_TEXT);
    check("the mutant also puts that row under an order", mutantListed.byOrder.has(C), true);
    assert(
        "  where the real rule leaves that order empty — the second half, caught separately",
        realListed.byOrder.has(C) === false && mutantListed.byOrder.has(C) !== realListed.byOrder.has(C)
    );
    // Both halves fail together under this mutation and separately under others, so
    // neither assertion is riding on the other: the judgment shows up on an invoice
    // that must stay SILENT, the placement on one that must stay LISTED.
    assert(
        "the two halves are read off different invoices, so one cannot mask the other",
        realOnePlus.shown === false && realListed.shown === true
    );

    // -----------------------------------------------------------------------
    log("what each order carries — the quantity invoiced against IT, in the table's order:");
    const split = chargesByOrder(ONE_SPLIT).byOrder;
    check("A carries both items", split.get(A).map((b) => b.itemName).join(","), "Elbow,Tee");
    check("  in the folded items' own order, which is the items table's", split.get(A)[0].itemName, "Elbow");
    check("  with the quantity invoiced against A, not the item's total", split.get(A)[0].qty, 10);
    check("B carries the split item alone", split.get(B).map((b) => b.itemName).join(","), "Elbow");
    check("  with its own quantity", split.get(B)[0].qty, 3);
    check("and 10 + 3 is the folded row's Qty in the table above", ONE_SPLIT.folded[0].qty, 13);

    // Two rows of one item on ONE order sum rather than repeating the item.
    const twiceOnOneOrder = chargesByOrder(TWO_ORDERED_ITEMS_ON_A).byOrder;
    check("two rows of one item on one order are one line", twiceOnOneOrder.get(A).length, 1);
    check("  carrying their sum", twiceOnOneOrder.get(A)[0].qty, 11);

    // byOrder is populated whether or not it is shown — the decision and the data are
    // separable, and the page reads `shown`.
    check("byOrder is built for a silent invoice too", chargesByOrder(ONE_ORDER).byOrder.get(A).length, 2);

    // -----------------------------------------------------------------------
    log("the split key (#409) — the orders AND how the quantity divided among them:");
    const sigOf = (fixture) => ordersNamedByFoldedItem(fixture).map((e) => splitSignature(e));
    check("an item naming no order signs nothing", sigOf(ALL_FREE_TEXT).join(","), ",");
    check("one order reduces to 1 whatever the quantity", sigOf(ONE_ORDER_UNEVEN).join(" | "), `${A}:1 | ${A}:1`);
    check("  which is the whole reason that invoice stays silent", chargesByOrder(ONE_ORDER_UNEVEN).shown, false);
    check("10:5 and 20:10 both reduce to 2:1", sigOf(SAME_PROPORTIONS).join(" | "), `${A}:2 ${B}:1 | ${A}:2 ${B}:1`);
    check("10:3 and 20:4 do not", sigOf(SPLIT_DIFFERENTLY).join(" | "), `${A}:10 ${B}:3 | ${A}:5 ${B}:1`);
    check("the ids stay in the key, so a different set is a different split", sigOf(EACH_ITS_OWN).join(" | "), `${A}:1 | ${B}:1`);

    // THE TWO INVARIANTS THIS KEY IS CHOSEN FOR, asserted rather than described.
    //
    // I1 — THE REDUCTION ONLY EVER MERGES. Two items a raw per-order quantity would
    // call identical must stay identical, or the reduction would be inventing
    // disagreements instead of collapsing them.
    const rawSigOf = (fixture) =>
        ordersNamedByFoldedItem(fixture).map((e) =>
            [...e.orderRecordIds].sort().map((id) => `${id}:${e.qtyByOrder.get(id) ?? 0}`).join(" ")
        );
    for (const [name, fixture] of [
        ["ONE_ORDER", ONE_ORDER],
        ["ONE_ORDER_UNEVEN", ONE_ORDER_UNEVEN],
        ["SAME_PROPORTIONS", SAME_PROPORTIONS],
        ["SPLIT_DIFFERENTLY", SPLIT_DIFFERENTLY],
        ["EACH_ITS_OWN", EACH_ITS_OWN],
        ["ONE_SPLIT", ONE_SPLIT],
    ]) {
        const raw = new Set(rawSigOf(fixture));
        const reduced = new Set(sigOf(fixture).filter((s) => s !== null));
        assert(`I1 — ${name}: the reduction never splits what raw quantities joined`, reduced.size <= raw.size);
    }

    // I2 — NOTHING LISTED BEFORE #409 GOES SILENT. The order ids are still in the key,
    // so two items whose SETS differ cannot sign the same however their quantities
    // reduce. Read off the two fixtures that were listed under the set-only rule.
    for (const [name, fixture] of [["EACH_ITS_OWN", EACH_ITS_OWN], ["ONE_SPLIT", ONE_SPLIT]]) {
        const sets = new Set(
            ordersNamedByFoldedItem(fixture)
                .filter((e) => e.orderRecordIds.length > 0)
                .map((e) => [...e.orderRecordIds].sort().join(" "))
        );
        assert(`I2 — ${name}: listed by the set-only rule`, sets.size > 1);
        assert(`  and still listed by the split rule`, chargesByOrder(fixture).shown === true);
    }

    // -----------------------------------------------------------------------
    log("the split key's mutants — the two ways to get the reduction wrong:");
    // Neither is described: both are built, run, and shown to disagree with the real
    // rule on a NAMED invoice, and they fail on different ones.
    const shownBy = (signer) => (fixture) => {
        const sigs = new Set(
            ordersNamedByFoldedItem(fixture)
                .filter((e) => e.orderRecordIds.length > 0)
                .map(signer)
        );
        return sigs.size > 1;
    };
    const rawSigner = (e) =>
        [...e.orderRecordIds].sort().map((id) => `${id}:${e.qtyByOrder.get(id) ?? 0}`).join(" ");
    const setOnlySigner = (e) => [...e.orderRecordIds].sort().join(" ");
    const shownRaw = shownBy(rawSigner);
    const shownSetOnly = shownBy(setOnlySigner);

    check("UNREDUCED quantities turn a one-order invoice ON", shownRaw(ONE_ORDER_UNEVEN), true);
    assert(
        "  where the real rule is silent — this is the assertion that catches it",
        chargesByOrder(ONE_ORDER_UNEVEN).shown === false
    );
    check("  and they turn the proportional invoice ON too", shownRaw(SAME_PROPORTIONS), true);
    assert("  where the real rule is silent", chargesByOrder(SAME_PROPORTIONS).shown === false);

    check("the SET-ONLY rule (#409 not applied) leaves the new case silent", shownSetOnly(SPLIT_DIFFERENTLY), false);
    assert(
        "  where the real rule lists it — the widening, caught on its own invoice",
        chargesByOrder(SPLIT_DIFFERENTLY).shown === true
    );
    assert(
        "the two mutants fail on different invoices, so one cannot mask the other",
        shownRaw(SPLIT_DIFFERENTLY) === true && shownSetOnly(ONE_ORDER_UNEVEN) === false
    );

    // THE THIRD MUTANT IS A PROPOSAL RATHER THAN A SLIP, and it is here so the
    // refusal is executable. Putting the ORDERED quantity in the key signs `5 of 5`
    // apart from `5 of 50`, which is a real argument — and it signs them apart on ONE
    // ORDER too, where the list repeats the items table. `splitSignature`'s docstring
    // says to run it against a one-order invoice; this is that run.
    const withDenominator = (e) =>
        [...e.orderRecordIds]
            .sort()
            .map((id) => `${id}:${e.qtyByOrder.get(id) ?? 0}/${e.orderedQtyByOrder.get(id) ?? ""}`)
            .join(" ");
    const oneOrderTwoWholes = withOrderedQty(
        invoice([
            row({ id: "rec1", po: A, material: "recMAT_1", qty: 5 }),
            row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 5, unitPrice: 41.07 }),
        ]),
        new Map([
            ["rec1-ordered", 5],
            ["rec2-ordered", 50],
        ])
    );
    const denominatorSigs = new Set(ordersNamedByFoldedItem(oneOrderTwoWholes).map(withDenominator));
    check("two items of 5 on ONE order, ordered 5 and 50, sign apart under it", denominatorSigs.size, 2);
    assert(
        "  so it draws a list on a one-order invoice, which #409 says stays silent",
        chargesByOrder(oneOrderTwoWholes).shown === false && denominatorSigs.size > 1
    );

    // A NON-INTEGER QUANTITY IS COMPARED UNREDUCED, which can only tell two items
    // apart. Reachable by hand only — `assertWholeQty` guards every writer.
    const fractional = invoice([
        row({ id: "rec1", po: A, material: "recMAT_1", qty: 2.5 }),
        row({ id: "rec2", po: B, material: "recMAT_1", qty: 5 }),
        row({ id: "rec3", po: A, material: "recMAT_2", itemName: "Tee", qty: 1, unitPrice: 41.07 }),
        row({ id: "rec4", po: B, material: "recMAT_2", itemName: "Tee", qty: 2, unitPrice: 41.07 }),
    ]);
    check("a fractional quantity is not reduced", sigOf(fractional)[0], `${A}:2.5 ${B}:5`);
    check("  so it is told apart from the same ratio in whole numbers", chargesByOrder(fractional).shown, true);
    assert(
        "  and the whole-number pair alone would have been silent",
        chargesByOrder(
            invoice([
                row({ id: "rec1", po: A, material: "recMAT_1", qty: 1 }),
                row({ id: "rec2", po: B, material: "recMAT_1", qty: 2 }),
                row({ id: "rec3", po: A, material: "recMAT_2", itemName: "Tee", qty: 1, unitPrice: 41.07 }),
                row({ id: "rec4", po: B, material: "recMAT_2", itemName: "Tee", qty: 2, unitPrice: 41.07 }),
            ])
        ).shown === false
    );

    // -----------------------------------------------------------------------
    log("what that quantity is measured against (#408) — per order, over the same rows:");
    // ANTI-VACUITY FIRST. The denominator is an OPTIONAL input, so a module that
    // ignored it entirely would pass every string assertion further down by
    // rendering the pre-#408 line. One invoice, read both ways, is what proves the
    // map is read at all.
    const withoutMap = chargesByOrder(ONE_SPLIT).byOrder;
    const withMap = chargesByOrder(withOrderedQty(ONE_SPLIT)).byOrder;
    check("no map: a charge states no whole", withoutMap.get(A)[0].orderedQty, null);
    check("  with the map, the same charge does", withMap.get(A)[0].orderedQty, 20);
    assert(
        "  and the quantity itself is untouched by the map, so only the whole moved",
        withoutMap.get(A)[0].qty === withMap.get(A)[0].qty
    );

    check("each order carries ITS ordered item's quantity — A", withMap.get(A)[0].orderedQty, 20);
    check("  and B carries the other half of the split", withMap.get(B)[0].orderedQty, 30);
    check("  a second item on A takes its own ordered item", withMap.get(A)[1].orderedQty, 40);

    // The shape the header names: one folded item over two ordered items on one order.
    const twoOrdered = chargesByOrder(withOrderedQty(TWO_ORDERED_ITEMS_ON_A)).byOrder;
    check("one line covering two ordered items on one order sums both", twoOrdered.get(A)[0].orderedQty, 50);
    check("  while its own quantity stays the two rows' sum", twoOrdered.get(A)[0].qty, 11);

    // And the case that tells the rule apart from adding one per row.
    const sharedOrdered = chargesByOrder(withOrderedQty(ONE_ORDERED_ITEM_TWICE)).byOrder;
    check("two rows on ONE ordered item count it once", sharedOrdered.get(A)[0].orderedQty, 20);
    check("  with both rows' quantity still summed", sharedOrdered.get(A)[0].qty, 11);

    // -----------------------------------------------------------------------
    log("the denominator's mutants — the two plausible ways to sum the wrong set:");
    // Both are the real builder with one line changed, and each is shown to disagree
    // on the invoice its own mistake shows up on. They fail on DIFFERENT fixtures, so
    // neither assertion is carrying the other.
    const perRow = ({ folded, items, orderedQtyByOrderedItem } = {}) => {
        const rowById = new Map((items || []).map((r) => [r.id, r]));
        const byOrder = new Map();
        for (const group of folded || []) {
            for (const rowId of group.rowIds || []) {
                const r = rowById.get(rowId);
                if (!r || !r.poItem?.[0] || !r.po?.[0]) continue;
                const ordered = orderedQtyByOrderedItem?.get(r.poItem[0]);
                if (typeof ordered !== "number") continue;
                const k = `${group.key}::${r.po[0]}`;
                byOrder.set(k, (byOrder.get(k) ?? 0) + ordered);
            }
        }
        return byOrder;
    };
    const firstOnly = ({ folded, items, orderedQtyByOrderedItem } = {}) => {
        const rowById = new Map((items || []).map((r) => [r.id, r]));
        const byOrder = new Map();
        for (const group of folded || []) {
            for (const rowId of group.rowIds || []) {
                const r = rowById.get(rowId);
                if (!r || !r.poItem?.[0] || !r.po?.[0]) continue;
                const k = `${group.key}::${r.po[0]}`;
                if (byOrder.has(k)) continue;
                byOrder.set(k, orderedQtyByOrderedItem?.get(r.poItem[0]) ?? null);
            }
        }
        return byOrder;
    };
    const sharedKey = ONE_ORDERED_ITEM_TWICE.folded[0].key;
    const twoKey = TWO_ORDERED_ITEMS_ON_A.folded[0].key;
    check(
        "adding one per ROW double-counts an ordered item two rows charge",
        perRow(withOrderedQty(ONE_ORDERED_ITEM_TWICE)).get(`${sharedKey}::${A}`),
        40
    );
    assert(
        "  and the real rule disagrees with it there",
        sharedOrdered.get(A)[0].orderedQty === 20
    );
    check(
        "reading the FIRST ordered item alone undercounts a line covering two",
        firstOnly(withOrderedQty(TWO_ORDERED_ITEMS_ON_A)).get(`${twoKey}::${A}`),
        20
    );
    assert(
        "  and the real rule disagrees with it there",
        twoOrdered.get(A)[0].orderedQty === 50
    );
    assert(
        "the two mutants fail on different invoices, so one cannot mask the other",
        perRow(withOrderedQty(TWO_ORDERED_ITEMS_ON_A)).get(`${twoKey}::${A}`) === 50 &&
            firstOnly(withOrderedQty(ONE_ORDERED_ITEM_TWICE)).get(`${sharedKey}::${A}`) === 20
    );

    // -----------------------------------------------------------------------
    log("a row with no ordered item is out of BOTH figures, not just the first:");
    const partlyFreeText = chargesByOrder(
        withOrderedQty(
            invoice([
                row({ id: "rec1", po: A, material: "recMAT_1", qty: 5 }),
                row({ id: "rec2", po: A, poItem: null, material: "recMAT_1", qty: 6 }),
                row({ id: "rec3", po: B, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
            ])
        )
    ).byOrder;
    // The second row keys on its own id (no `Material` reaches the fold without an
    // ordered item), so it is its own folded item and names no order at all.
    check("the charge on A carries only the linked row's quantity", partlyFreeText.get(A)[0].qty, 5);
    check("  and only that row's ordered item as its whole", partlyFreeText.get(A)[0].orderedQty, 20);
    check("  so A carries one line, not two", partlyFreeText.get(A).length, 1);

    // -----------------------------------------------------------------------
    log("an ordered item the caller could not supply leaves the whole unstated:");
    const noneResolved = chargesByOrder(
        withOrderedQty(TWO_ORDERED_ITEMS_ON_A, new Map())
    ).byOrder;
    check("no ordered item resolved: nothing is claimed", noneResolved.get(A)[0].orderedQty, null);
    const someResolved = chargesByOrder(
        withOrderedQty(TWO_ORDERED_ITEMS_ON_A, new Map([["rec1-ordered", 20]]))
    ).byOrder;
    check("one of two resolved: the one that could be read", someResolved.get(A)[0].orderedQty, 20);
    assert(
        "  which is a smaller whole than both, never a zero standing in for the missing one",
        someResolved.get(A)[0].orderedQty === 20 && twoOrdered.get(A)[0].orderedQty === 50
    );

    // -----------------------------------------------------------------------
    log("the copy — item, size, quantity, unit, and no money:");
    check(
        "a line names the item and what was invoiced against that order",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "166-DEMO Elbow", size: '3"', unit: "EA", qty: 5 }).text,
        '166-DEMO Elbow 3" — 5 EA'
    );
    check(
        "a blank size leaves no double space",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "Rebar", size: "", unit: "FT", qty: 120 }).text,
        "Rebar — 120 FT"
    );
    check(
        "a blank unit leaves no trailing space",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "Rebar", size: "", unit: "", qty: 120 }).text,
        "Rebar — 120"
    );
    check("and a nameless item still says something", ORDER_BREAKDOWN_COPY.charged({}).text, "That item — 0");
    // Decision pinned mechanically rather than by reading the string: no price, no
    // amount, so no currency can reach this line.
    const withMoney = ORDER_BREAKDOWN_COPY.charged({
        itemName: "Elbow",
        size: '3"',
        unit: "EA",
        qty: 5,
        unitPrice: 13.49,
        amount: 67.45,
    }).text;
    assert("a line carries no price and no amount even when handed both", !withMoney.includes("$"));
    check("  and says exactly what it said without them", withMoney, 'Elbow 3" — 5 EA');
    check("the key is stable, so a call site can branch on it", ORDER_BREAKDOWN_COPY.charged({}).key, "order-charged");

    // -----------------------------------------------------------------------
    log("the copy's whole (#408) — one unit, after both figures:");
    check(
        "a charge states the quantity over what its order asked for",
        ORDER_BREAKDOWN_COPY.charged({
            itemName: "166-DEMO Elbow",
            size: '3"',
            unit: "EA",
            qty: 5,
            orderedQty: 10,
        }).text,
        '166-DEMO Elbow 3" — 5 of 10 EA'
    );
    // THE UNIT ONCE, PINNED BY COUNT RATHER THAN BY READING THE STRING — `5 EA of 10
    // EA` is the shape this decision rules out, and it would pass a substring test
    // for the sentence above.
    const pair = ORDER_BREAKDOWN_COPY.charged({
        itemName: "Rebar",
        size: "",
        unit: "EA",
        qty: 5,
        orderedQty: 10,
    }).text;
    check("the unit appears once", pair.split("EA").length - 1, 1);
    check("  and after both figures", pair, "Rebar — 5 of 10 EA");
    check(
        "a blank unit still states both figures",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "Rebar", size: "", unit: "", qty: 5, orderedQty: 10 }).text,
        "Rebar — 5 of 10"
    );
    check(
        "an unstated whole reads as the line read before #408",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "Rebar", size: "", unit: "EA", qty: 5, orderedQty: null }).text,
        "Rebar — 5 EA"
    );
    check(
        "a whole of zero is a figure and is stated",
        ORDER_BREAKDOWN_COPY.charged({ itemName: "Rebar", size: "", unit: "EA", qty: 5, orderedQty: 0 }).text,
        "Rebar — 5 of 0 EA"
    );
    // The denominator is a quantity, so it must not bring money with it either.
    assert(
        "the whole carries no currency",
        !ORDER_BREAKDOWN_COPY.charged({ itemName: "Elbow", unit: "EA", qty: 5, orderedQty: 10, unitPrice: 13.49 })
            .text.includes("$")
    );
}

if (isMain(import.meta.url)) standalone(title, run);
