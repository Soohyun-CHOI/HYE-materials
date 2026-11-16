// An item as the vendor wrote it, spread over its orders (#660).
//
// WHAT THIS HOLDS. The office enters an invoice's items as the vendor wrote them — a material,
// a quantity, a price — and `lib/invoiceSpread.js` spreads each over the ordered items of the
// invoice's orders holding that material at that ordered price, oldest order first, what no
// ordered item has left on the last one filled. The pour is `fillOrderedItems`, a delivery's
// (#162), so the first half here is the rule's clauses and the second is that it is ONE pour:
// the delivery planner and the invoice spread both call it, and neither carries a loop of its
// own. Then what is saved and read back: `Position` on every share, an item read back as its
// shares in fill order, and where an item names its order.
//
// THE EDIT SCREEN'S TWO HALVES ARE HERE TOO, because both are judgments: which ordered items an
// item may take a quantity on, and what a save of those quantities writes. And the record: an
// invoice item an edit removes leaves its variances' rows standing with a `Cleared` row, written
// before the destroy, never a deletion of them.

import { readFileSync } from "node:fs";
import {
    INVOICE_SPREAD_COPY,
    editableShares,
    invoicePositions,
    namesOrder,
    orderNaming,
    planShareEdits,
    spreadChoices,
    spreadInvoiceItems,
    spreadKey,
} from "../../../lib/invoiceSpread.js";
import { VARIANCE_COPY } from "../../../lib/variance.js";
import { callsBefore, callsTo, parseFile, repoPath, resolveFunction, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Invoice spread — an item as the vendor wrote it, over its orders (#660)";

const PO_A = { id: "recPoA", poId: "HYE-PO-260901-01", createdDate: "2026-09-01" };
const PO_B = { id: "recPoB", poId: "HYE-PO-260905-01", createdDate: "2026-09-05" };
const PO_C = { id: "recPoC", poId: "HYE-PO-260907-01", createdDate: "2026-09-07" };

const ordered = (id, po, seq, over = {}) => ({
    id,
    poItemId: `${po.poId}-${String(seq).padStart(3, "0")}`,
    poRecordId: po.id,
    poId: po.poId,
    poCreatedDate: po.createdDate,
    materialRecordId: "recElbow",
    itemName: "Elbow",
    size: '3"',
    maker: "",
    unit: "EA",
    qty: 5,
    unitPrice: 10,
    invoicedQty: 0,
    ...over,
});

// Elbow at $10 on A (5) and B (4); a Tee on B; Elbow at $12 on C; an item with no material on A.
const A1 = ordered("recA1", PO_A, 1);
const B1 = ordered("recB1", PO_B, 1, { qty: 4 });
const B2 = ordered("recB2", PO_B, 2, { materialRecordId: "recTee", itemName: "Tee", qty: 3, unitPrice: 7 });
const C1 = ordered("recC1", PO_C, 1, { qty: 6, unitPrice: 12 });
const A2 = ordered("recA2", PO_A, 2, { materialRecordId: null, itemName: "Cap", qty: 2, unitPrice: 5 });
const ALL = [B2, C1, A2, B1, A1]; // deliberately out of fill order

const ELBOW = spreadKey(A1);
const shareSummary = (s) => s.shares.map((x) => `${x.orderedItem.id}:${x.qty}`).join(" ");

export function run({ check, assert, log }) {
    log("one choice is a material at one ordered price:");
    check("the key is the material and the ordered price", ELBOW, "mat::recElbow::10");
    check("  so one material on two orders at one price is one choice", spreadKey(B1), ELBOW);
    check("  and at another price, another", spreadKey(C1) === ELBOW, false);
    check("an ordered item with no material is a choice of its own", spreadKey(A2), "item::recA2");
    const choices = spreadChoices(ALL);
    const elbow = choices.find((c) => c.key === ELBOW);
    check("the choices, one per key", choices.length, 4);
    check("  a choice holds its ordered items in fill order", elbow.orderedItems.map((o) => o.id).join(","), "recA1,recB1");
    check("  and what is uninvoiced on all of them", elbow.uninvoiced, 9);
    check("  and the orders it is on", elbow.poIds.join(","), "HYE-PO-260901-01,HYE-PO-260905-01");
    check("a material at two prices says so on both choices", choices.filter((c) => c.sharesMaterial).length, 2);
    const full = spreadChoices([ordered("recF", PO_A, 3, { materialRecordId: "recFull", invoicedQty: 5 }), ...ALL]);
    check("a choice with nothing uninvoiced comes last", full.at(-1).materialRecordId, "recFull");
    check(
        "the label names orders and price only where the material stands twice",
        [INVOICE_SPREAD_COPY.choice(choices.find((c) => c.materialRecordId === "recTee")), INVOICE_SPREAD_COPY.choice(elbow)].join(" | "),
        'Tee 3" (Uninvoiced: 3) | Elbow 3" · HYE-PO-260901-01, HYE-PO-260905-01 · $10.00 (Uninvoiced: 9)'
    );

    log("");
    log("the spread — oldest order first, the rest on the last one filled:");
    const one = (qty, items = ALL) => spreadInvoiceItems({ entries: [{ key: ELBOW, qty }], orderedItems: items })[0];
    check("within what is left: the older order first, then the newer", shareSummary(one(7)), "recA1:5 recB1:2");
    check("  nothing over", one(7).over, 0);
    check("  and what was left is said", one(7).left, 9);
    check("all of it on the older order when it has room", shareSummary(one(3)), "recA1:3");
    check("past everything left: the excess on the last share", shareSummary(one(12)), "recA1:5 recB1:7");
    check("  and it is over", one(12).over, 3);
    const spent = [ordered("recA1", PO_A, 1, { invoicedQty: 5 }), ordered("recB1", PO_B, 1, { qty: 4, invoicedQty: 4 })];
    check("nothing left anywhere: all of it on the newest", shareSummary(one(2, spent)), "recB1:2");
    check("  over by all of it, with nothing left", `${one(2, spent).over} ${one(2, spent).left}`, "2 0");
    const sameDay = [
        ordered("recX2", { ...PO_A, id: "recPoX2", poId: "HYE-PO-260901-02" }, 1),
        ordered("recX1", { ...PO_A, id: "recPoX1", poId: "HYE-PO-260901-01" }, 1),
    ];
    check("orders of one day go by PO ID", shareSummary(one(7, sameDay)), "recX1:5 recX2:2");
    check("a price the choice is not at is never reached", one(20).shares.some((s) => s.orderedItem.id === "recC1"), false);
    const twice = spreadInvoiceItems({ entries: [{ key: ELBOW, qty: 3 }, { key: ELBOW, qty: 4 }], orderedItems: ALL });
    check("a material written twice is two items, the second taking what the first left", twice.map(shareSummary).join(" / "), "recA1:3 / recA1:2 recB1:2");
    check("  and its left is what the first left", twice[1].left, 6);
    check("one ordered item, one share, however the excess fell", new Set(one(12).shares.map((s) => s.orderedItem.id)).size, one(12).shares.length);
    const gone = spreadInvoiceItems({ entries: [{ key: "mat::recGone::1", qty: 1 }], orderedItems: ALL })[0];
    check("a choice these orders do not hold spreads nothing", `${gone.unknown} ${gone.shares.length}`, "true 0");

    log("");
    log("the words for an item past what is left:");
    check("  with something left", INVOICE_SPREAD_COPY.over({ over: 2, left: 5, unit: "EA" }), "2 EA more than the 5 EA uninvoiced on these orders — it will show as a Quantity variance.");
    check("  with nothing left", INVOICE_SPREAD_COPY.over({ over: 7, left: 0, unit: "EA" }), "Nothing on these orders is left uninvoiced — all 7 EA will show as a Quantity variance.");

    log("");
    log("read back by Position, each item with its shares in fill order:");
    const row = (id, iid, position, po, orderedItem, qty, over = {}) => ({
        id,
        invoiceItemId: iid,
        position,
        po: [po.id],
        poItem: [orderedItem.id],
        itemName: orderedItem.itemName,
        size: orderedItem.size,
        unit: "EA",
        qty,
        unitPrice: orderedItem.unitPrice,
        amount: qty * orderedItem.unitPrice,
        ...over,
    });
    const byId = new Map([A1, B1, B2, C1, A2].map((o) => [o.id, o]));
    const items = [
        row("r3", "INV-01-003", 2, PO_B, B2, 3),
        row("r2", "INV-01-002", 1, PO_A, A1, 5),
        row("r1", "INV-01-001", 1, PO_B, B1, 2, { hasQuantityVariance: true }),
        row("r4", "INV-01-004", null, PO_A, A2, 1),
    ];
    const positions = invoicePositions({ items, orderedItemById: byId });
    check("one item per Position, in its order, a row with none after", positions.map((p) => p.key).join(","), "pos::1,pos::2,row::r4");
    check("  its shares in fill order, not entry order", positions[0].shares.map((s) => s.id).join(","), "r2,r1");
    check("  the item's quantity and amount are its shares'", `${positions[0].qty} ${positions[0].amount}`, "7 70");
    check("  split where it has two", positions.map((p) => p.split).join(","), "true,false,false");
    check("  a share carries its variance", positions[0].shares[1].quantityVariance, "open");

    log("");
    log("where an item names its order:");
    check("one order: nowhere", orderNaming({ positions: positions.slice(0, 1), orders: [PO_A] }), "none");
    const allOnOldest = invoicePositions({ items: items.slice(1, 3), orderedItemById: byId });
    check("every item on the oldest order: the shares", orderNaming({ positions: allOnOldest, orders: [PO_B, PO_A] }), "split");
    check("an item on a newer order alone: every item", orderNaming({ positions, orders: [PO_A, PO_B] }), "every");
    check(
        "  a share names its order under `split` only where its item is split",
        [namesOrder("split", { split: true }), namesOrder("split", { split: false }), namesOrder("every", { split: false }), namesOrder("none", { split: true })].join(","),
        "true,false,true,false"
    );

    log("");
    log("the edit screen — a quantity per order, and what a save writes:");
    const single = invoicePositions({ items: [row("r9", "INV-02-001", 1, PO_A, A1, 3)], orderedItemById: byId })[0];
    const editable = editableShares({
        position: single,
        orderedItems: ALL.map((o) => (o.id === "recA1" ? { ...o, invoicedQty: 3 } : o)),
        thisInvoiceOn: new Map([["recA1", 3]]),
    });
    check("every ordered item of its choice on the invoice's orders, in fill order", editable.map((e) => e.orderedItem.id).join(","), "recA1,recB1");
    check("  each with this item's quantity on it", editable.map((e) => e.qty).join(","), "3,0");
    check("  and what is uninvoiced on it apart from this invoice", editable.map((e) => e.uninvoiced).join(","), "5,4");
    const plan = planShareEdits({
        existing: [{ id: "r1", orderedItemId: "recA1", qty: 5 }, { id: "r2", orderedItemId: "recB1", qty: 2 }],
        candidates: ["recA1", "recB1", "recB9"],
        submitted: [
            { invoiceItemId: "r1", orderedItemId: "recA1", qty: "4" },
            { invoiceItemId: "r2", orderedItemId: "recB1", qty: "0" },
            { invoiceItemId: null, orderedItemId: "recB9", qty: "3" },
            { invoiceItemId: null, orderedItemId: "recC1", qty: "9" },
            { invoiceItemId: null, orderedItemId: "recA1", qty: "8" },
        ],
    });
    check("  a share changed", JSON.stringify(plan.updates), '[{"id":"r1","qty":4}]');
    check("  a share at nothing removed", plan.removes.join(","), "r2");
    check("  a share given a quantity made", JSON.stringify(plan.creates), '[{"orderedItemId":"recB9","qty":3}]');
    check("  and what it adds up to", plan.total, 7);
    check(
        "a share sent no quantity keeps its own",
        planShareEdits({ existing: [{ id: "r1", orderedItemId: "recA1", qty: 5 }], candidates: [], submitted: [] }).total,
        5
    );

    log("");
    log("a quantity variance's figures say it is cumulative:");
    check("with an earlier invoice", VARIANCE_COPY.quantityFigures({ ordered: 5, previously: 5, thisInvoice: 2 }), "Ordered 5 · Previously invoiced 5 · This invoice 2");
    check("with none", VARIANCE_COPY.quantityFigures({ ordered: 5, previously: 0, thisInvoice: 7 }), "Ordered 5 · This invoice 7");

    log("");
    log("ONE pour, called by both — the delivery planner and the invoice spread:");
    const alloc = parseFile("lib/deliveryAllocation.js").ast;
    const spreadAst = parseFile("lib/invoiceSpread.js").ast;
    check("planDelivery pours through fillOrderedItems", callsTo(resolveFunction(alloc, "planDelivery"), "fillOrderedItems").length, 1);
    check("  and so does the invoice spread", callsTo(resolveFunction(spreadAst, "spreadInvoiceItems"), "fillOrderedItems").length, 1);
    let ownLoop = false;
    walk(resolveFunction(spreadAst, "spreadInvoiceItems"), (node) => {
        // A share taken here rather than by the fill is a `Math.min` of what is left and what is wanted.
        if (node.type === "CallExpression" && node.callee?.property?.name === "min") ownLoop = true;
    });
    check("  which takes no share of its own", ownLoop, false);

    log("");
    log("what is saved, and by whom:");
    const create = parseFile("app/invoices/new/actions.js").ast;
    const handler = resolveFunction(create, "createInvoiceAction");
    check("the create action spreads before it writes", callsBefore(handler, "spreadInvoiceItems", "createInvoice"), true);
    const writes = callsTo(handler, "createInvoiceItem");
    check("  and writes a Position on every share", writes.length > 0 && writes.every((c) => /"name":"position"/.test(JSON.stringify(c.arguments))), true);
    const form = parseFile("app/invoices/new/InvoiceForm.js").ast;
    check("the entry form says what it says from the same spread", callsTo(form, "spreadInvoiceItems").length, 1);
    const split = readFileSync(repoPath("lib/overage.server.js"), "utf8");
    assert("an overage split copies the Position onto the share it makes", /position: invoice\.position/.test(split));

    log("");
    log("an edit that removes a share keeps its record:");
    const update = resolveFunction(parseFile("app/invoices/[invoiceId]/actions.js").ast, "updateInvoiceAction");
    check("the Cleared rows are written before the destroy", callsBefore(update, "recordInvoiceItemsRemoved", "destroy"), true);
    check("  and no log row is destroyed by an edit", callsTo(update, "destroyInvoiceVarianceLogEntries").length, 0);
    const removed = resolveFunction(parseFile("lib/variance.server.js").ast, "recordInvoiceItemsRemoved");
    let writesCleared = false;
    // The event the ending carries, not any mention of `cleared`: the function also compares the
    // log's latest row against it, and that comparison must not satisfy this.
    walk(removed, (node) => {
        if (node.type !== "Property" || node.key?.name !== "event") return;
        if (node.value?.object?.name === "VARIANCE_EVENTS" && node.value?.property?.name === "cleared") writesCleared = true;
    });
    check("  each a Cleared row", writesCleared, true);
    check("  through the one writer of an ending", callsTo(removed, "recordEnding").length, 1);
}

if (isMain(import.meta.url)) standalone(title, run);
