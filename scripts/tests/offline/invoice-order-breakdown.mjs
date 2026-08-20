// Which order an invoice item was billed against (#237) — the same-set test, the
// exclusion, the per-order quantity and the copy.
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
//   - an invoice item with no `PO Item`, since `SHOW_OTHER_ITEM_OPTION` is false
//     (#96) and free-text charges are out of the plan — so the exclusion below is
//     defensive, and this file is the only thing holding it.

import { foldInvoiceItems } from "../../../lib/invoiceItemFold.js";
import {
    ORDER_BREAKDOWN_COPY,
    billedItemsByOrder,
    ordersNamedByFoldedItem,
} from "../../../lib/invoiceOrderBreakdown.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Which order an invoice item was billed against (#237)";

const A = "recPO_A";
const B = "recPO_B";
const C = "recPO_C";

/**
 * One raw Invoice Item. `poItem` defaults to a truthy ordered item because the app
 * cannot currently create a row without one (`SHOW_OTHER_ITEM_OPTION` is false, #96);
 * a free-text row is the deliberate exception and passes `poItem: null`, keeping its
 * `PO` — which is the shape `createInvoiceAction` enforces and the reason the exclusion
 * cannot key on that link.
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

// A corrective order every item is split across: two materials, each billed on both
// orders at one price, so each folds to a single item touching {A, B}.
const CORRECTIVE = invoice([
    row({ id: "rec1", po: A, material: "recMAT_1", qty: 10 }),
    row({ id: "rec2", po: A, material: "recMAT_2", itemName: "Tee", qty: 20, unitPrice: 41.07 }),
    row({ id: "rec3", po: B, material: "recMAT_1", qty: 3 }),
    row({ id: "rec4", po: B, material: "recMAT_2", itemName: "Tee", qty: 4, unitPrice: 41.07 }),
]);

// One item billed against A, another against B. The case that opened the issue.
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

export function run({ check, assert, log }) {
    // -----------------------------------------------------------------------
    log("anti-vacuity — the rule reads its inputs and is not a constant:");
    const empty = billedItemsByOrder({});
    check("no folded items, nothing shown", empty.shown, false);
    check("  and no order carries anything", empty.byOrder.size, 0);
    check("an invoice whose items name orders populates byOrder", billedItemsByOrder(ONE_ORDER).byOrder.size, 1);
    assert(
        "the fold still exports the membership this module joins on (`rowIds`)",
        ONE_ORDER.folded.every((g) => Array.isArray(g.rowIds) && g.rowIds.length > 0)
    );
    assert(
        "and the fold really folds these fixtures: 4 rows of CORRECTIVE become 2 items",
        CORRECTIVE.items.length === 4 && CORRECTIVE.folded.length === 2
    );

    // -----------------------------------------------------------------------
    log("the same-set test — the four cases, and neither answer is the constant one:");
    check("one order: silent", billedItemsByOrder(ONE_ORDER).shown, false);
    check("corrective order, every item split across both: silent", billedItemsByOrder(CORRECTIVE).shown, false);
    check("one item on A, one on B: listed", billedItemsByOrder(EACH_ITS_OWN).shown, true);
    check("one item split, one not: listed", billedItemsByOrder(ONE_SPLIT).shown, true);

    // The corrective case needs no rule of its own — it is silent because its sets
    // AGREE, which is the whole reason this module has no branch naming a correction.
    const correctiveSets = ordersNamedByFoldedItem(CORRECTIVE).map((e) => e.orderRecordIds.length);
    check("and it is silent for the stated reason: both items touch two orders", correctiveSets.join(","), "2,2");

    // -----------------------------------------------------------------------
    log("the mutants, built and run — a broken rule must not pass this file:");
    // Written as wrappers over the real function so they cannot drift from it: only
    // `shown` is replaced, which is exactly the judgment under test.
    const alwaysAgree = (input) => ({ ...billedItemsByOrder(input), shown: false });
    const alwaysDiffer = (input) => ({ ...billedItemsByOrder(input), shown: true });
    assert(
        "`shown` hard-wired to false (the quiet death) disagrees on `one item on A, one on B`",
        alwaysAgree(EACH_ITS_OWN).shown !== billedItemsByOrder(EACH_ITS_OWN).shown
    );
    assert(
        "  and on `one item split, one not`",
        alwaysAgree(ONE_SPLIT).shown !== billedItemsByOrder(ONE_SPLIT).shown
    );
    assert(
        "`shown` hard-wired to true (a list everywhere) disagrees on `one order`",
        alwaysDiffer(ONE_ORDER).shown !== billedItemsByOrder(ONE_ORDER).shown
    );
    assert(
        "  and on the corrective order",
        alwaysDiffer(CORRECTIVE).shown !== billedItemsByOrder(CORRECTIVE).shown
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
    check("an invoice of nothing but free text is silent", billedItemsByOrder(ALL_FREE_TEXT).shown, false);
    check("  and puts nothing under any order", billedItemsByOrder(ALL_FREE_TEXT).byOrder.size, 0);
    // The load-bearing half: one free-text row must not turn the list on.
    check(
        "one order plus a free-text row on a second: still silent",
        billedItemsByOrder(ONE_ORDER_PLUS_FREE_TEXT).shown,
        false
    );
    const listedPlusFreeText = billedItemsByOrder(LISTED_PLUS_FREE_TEXT);
    check("a listed invoice stays listed with a free-text row added", listedPlusFreeText.shown, true);
    check("  and the free-text row's order carries nothing", listedPlusFreeText.byOrder.has(C), false);

    // -----------------------------------------------------------------------
    // THE EXCLUSION IS THE WHOLE OF WHAT THIS TIER CARRIES ALONE. It is not a state
    // the app can produce — `SHOW_OTHER_ITEM_OPTION` is false (#96) and free-text
    // charges are out of the plan — so no seed and no screen can show it, and the two
    // halves have to be pinned here separately: OUT OF THE JUDGMENT and UNDER NO
    // ORDER. Each is asserted above and each is shown below to fail under the one
    // mutation that would break it, which is keying the exclusion on the wrong link.
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
    const realOnePlus = billedItemsByOrder(ONE_ORDER_PLUS_FREE_TEXT);
    const mutantOnePlus = keyedOnPO(ONE_ORDER_PLUS_FREE_TEXT);
    check("the mutant lets the free-text row into the judgment, so the list turns ON", mutantOnePlus.shown, true);
    assert(
        "  and the real rule disagrees with it there — this is the assertion that catches it",
        realOnePlus.shown === false && mutantOnePlus.shown !== realOnePlus.shown
    );
    const realListed = billedItemsByOrder(LISTED_PLUS_FREE_TEXT);
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
    log("what each order carries — the quantity billed against IT, in the table's order:");
    const split = billedItemsByOrder(ONE_SPLIT).byOrder;
    check("A carries both items", split.get(A).map((b) => b.itemName).join(","), "Elbow,Tee");
    check("  in the folded items' own order, which is the items table's", split.get(A)[0].itemName, "Elbow");
    check("  with the quantity billed against A, not the item's total", split.get(A)[0].qty, 10);
    check("B carries the split item alone", split.get(B).map((b) => b.itemName).join(","), "Elbow");
    check("  with its own quantity", split.get(B)[0].qty, 3);
    check("and 10 + 3 is the folded row's Qty in the table above", ONE_SPLIT.folded[0].qty, 13);

    // Two rows of one item on ONE order sum rather than repeating the item.
    const twiceOnOneOrder = billedItemsByOrder(
        invoice([
            row({ id: "rec1", po: A, material: "recMAT_1", qty: 5 }),
            row({ id: "rec2", po: A, material: "recMAT_1", qty: 6 }),
            row({ id: "rec3", po: B, material: "recMAT_2", itemName: "Tee", qty: 7, unitPrice: 41.07 }),
        ])
    ).byOrder;
    check("two rows of one item on one order are one line", twiceOnOneOrder.get(A).length, 1);
    check("  carrying their sum", twiceOnOneOrder.get(A)[0].qty, 11);

    // byOrder is populated whether or not it is shown — the decision and the data are
    // separable, and the page reads `shown`.
    check("byOrder is built for a silent invoice too", billedItemsByOrder(ONE_ORDER).byOrder.get(A).length, 2);

    // -----------------------------------------------------------------------
    log("the copy — item, size, quantity, unit, and no money:");
    check(
        "a line names the item and what was billed against that order",
        ORDER_BREAKDOWN_COPY.billed({ itemName: "166-DEMO Elbow", size: '3"', unit: "EA", qty: 5 }).text,
        '166-DEMO Elbow 3" — 5 EA'
    );
    check(
        "a blank size leaves no double space",
        ORDER_BREAKDOWN_COPY.billed({ itemName: "Rebar", size: "", unit: "FT", qty: 120 }).text,
        "Rebar — 120 FT"
    );
    check(
        "a blank unit leaves no trailing space",
        ORDER_BREAKDOWN_COPY.billed({ itemName: "Rebar", size: "", unit: "", qty: 120 }).text,
        "Rebar — 120"
    );
    check("and a nameless item still says something", ORDER_BREAKDOWN_COPY.billed({}).text, "That item — 0");
    // Decision pinned mechanically rather than by reading the string: no price, no
    // amount, so no currency can reach this line.
    const withMoney = ORDER_BREAKDOWN_COPY.billed({
        itemName: "Elbow",
        size: '3"',
        unit: "EA",
        qty: 5,
        unitPrice: 13.49,
        amount: 67.45,
    }).text;
    assert("a line carries no price and no amount even when handed both", !withMoney.includes("$"));
    check("  and says exactly what it said without them", withMoney, 'Elbow 3" — 5 EA');
    check("the key is stable, so a call site can branch on it", ORDER_BREAKDOWN_COPY.billed({}).key, "order-billed");
}

if (isMain(import.meta.url)) standalone(title, run);
