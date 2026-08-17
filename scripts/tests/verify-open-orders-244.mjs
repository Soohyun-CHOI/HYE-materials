// Verification for issue #244 — the invoice form's purchase order picker asks
// the base which orders are still open, in one query, instead of re-reading
// every order and walking its ordered items.
//
// WHY THIS TIER AND NOT THE OFFLINE ONE. Half of one judgment now lives in
// Airtable: `PO Items."Has Uninvoiced Qty"` is lib/poItemQty.js:hasUninvoicedQty
// written as a formula, and `Purchase Orders."Uninvoiced Items"` sums it. Neither
// is in the repo, neither is in git history, and `npm test` cannot see either —
// a formula can be rewritten between two green CI runs with nothing in the diff.
// So the two halves are compared here, on live values, which is the convention
// docs/notes/verification.md states for a rule that lives on the Airtable side.
// The JS half alone is pinned offline, in offline/po-item-qty.mjs.
//
// THE AGGREGATION FUNCTION IS THE SHARPEST CASE. Airtable's Metadata API does not
// expose it at all, so SUM, COUNTALL and MAX are indistinguishable from any
// schema dump. Part B tells them apart the only way available: three ordered
// items, two of them open, and a number read back. SUM says 2, COUNTALL says 3,
// MAX says 1.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-open-orders-244.mjs

import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import {
    getOpenPOs,
    getPOsExceptWithdrawn,
    getPOByRecordId,
} from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem } from "../../lib/airtable/invoiceItems.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { hasUninvoicedQty, hasUninvoicedItems } from "../../lib/poItemQty.js";
import { snapshot, resetOps } from "../../lib/airtableOps.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return ok;
}

// Fixtures (#171). Bucket order IS deletion order: Invoice Items before the
// Invoice that lists them, POs before the PRs they link.
//
// No Materials bucket, for the reason verify-po-awaiting-signature-133.mjs
// measured: these PRs carry NO Vendor, so refreshMaterialsCacheForPO returns
// before writing an identity row, a price row or an ordered item's `Material`
// link. The Invoice below does name a vendor — an Invoice needs one — but no
// code path writes the item axis from an invoice.
//
// No Invoice-PO Link bucket, because this script never calls linkInvoiceToPO.
// The rollup under test travels `Invoice Items.PO Item`, not the join table, so
// the join would add rows to clean up and prove nothing extra.
const fixtures = createFixtures({
    tag: "V244",
    buckets: [
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item", tagField: "Item Name" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [{ link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" }],
        },
        // No tagField: written by generatePOForApprovedPR, and this script sets no
        // text field on it. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;
const ITEM_NAME = `${TAG} widget`;

/** An Approved PR with `qtys.length` items, generated into a PO. */
async function makePO(userId, note, qtys) {
    const pr = await createPR({ requesterId: userId, notes: `${TAG} ${note}` });
    track("prs", pr.id);
    for (const qty of qtys) {
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: ITEM_NAME,
            qty,
            unitPrice: 10,
        });
    }
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", gen.poRecordId);
    return gen.poRecordId;
}

let complete = false;
try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute fixtures to.");
    const userId = users[0].id;
    const vendors = await getAllVendors();
    if (vendors.length === 0) throw new Error("No vendor to attribute the fixture invoice to.");

    // -------------------------------------------------------------------
    console.log("\nPart A — the two fields, read off the live schema:");
    const meta = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    ).then((r) => r.json());
    const tableByName = new Map(meta.tables.map((t) => [t.name, t]));
    const fieldOn = (table, name) => tableByName.get(table)?.fields.find((f) => f.name === name);

    const child = fieldOn("PO Items", "Has Uninvoiced Qty");
    const parent = fieldOn("Purchase Orders", "Uninvoiced Items");
    assert('PO Items."Has Uninvoiced Qty" exists and is a formula', child?.type === "formula");
    assert("its formula is valid", child?.options?.isValid === true);
    // Airtable renders a formula by FIELD ID, not by name (airtable-access.md
    // measured 12 of 18 that way), so the readable check is which fields it
    // references rather than the text of the expression.
    const referenced = new Set(child?.options?.referencedFieldIds || []);
    const poItemsFields = tableByName.get("PO Items")?.fields || [];
    const idOf = (name) => poItemsFields.find((f) => f.name === name)?.id;
    assert("it reads Qty", referenced.has(idOf("Qty")));
    assert("it reads Invoiced Qty", referenced.has(idOf("Invoiced Qty")));
    // The withdrawn-order rule belongs to the picker query's status condition and
    // must not be duplicated into this formula.
    assert("and NOT Committed Qty — the withdrawn rule stays in the status filter",
        !referenced.has(idOf("Committed Qty")));

    assert('Purchase Orders."Uninvoiced Items" exists and is a rollup', parent?.type === "rollup");
    assert("its rollup is valid", parent?.options?.isValid === true);
    assert("it rolls up through the PO Items link",
        parent?.options?.recordLinkFieldId ===
            tableByName.get("Purchase Orders")?.fields.find((f) => f.name === "PO Items")?.id);
    assert("of the child field above", parent?.options?.fieldIdInLinkedTable === child?.id);

    // -------------------------------------------------------------------
    console.log("\nPart B — the aggregation is SUM (the Metadata API cannot say):");
    // Three ordered items. One will be fully invoiced, so two stay open.
    const poB = await makePO(userId, "sum", [10, 5, 7]);
    const itemsB = await getItemsByPO(poB);
    check("the fixture order has three ordered items", itemsB.length, 3);

    const fresh = await getPOByRecordId(poB);
    check("all three open before any invoice", fresh.uninvoicedItems, 3);

    const invoice = await createInvoice({
        vendorId: vendors[0].id,
        vendorInvoiceCode: `${TAG}-INV`,
        issueDate: "2026-08-17",
        dueDate: "2026-09-17",
        amountDue: 100,
        shippingFee: 0,
    });
    track("invoices", invoice.id);

    const closedItem = itemsB.find((i) => i.qty === 5);
    const ii1 = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: poB,
        poItemRecordId: closedItem.id,
        itemName: ITEM_NAME,
        qty: 5,
        unitPrice: 10,
        remark: "",
    });
    track("invoiceItems", ii1.id);

    const afterOne = await getPOByRecordId(poB);
    // 2 is SUM. COUNTALL would be 3 (it counts linked rows, not their values) and
    // MAX would be 1 (the largest single 0-or-1). Nothing in a schema dump
    // separates the three, which is the whole reason this fixture exists.
    check("two of three still open — SUM, not COUNTALL (3) or MAX (1)", afterOne.uninvoicedItems, 2);

    // -------------------------------------------------------------------
    console.log("\nPart C — the field agrees with hasUninvoicedQty, case by case:");
    // Partly invoice one item and over-invoice another, so this order carries
    // three of the four states the JS distinguishes at once: partly invoiced,
    // exactly fulfilled (from Part B) and over-invoiced. The fourth — nothing
    // invoiced — is Part B's opening assertion on this same order, before any
    // invoice item existed.
    const partial = itemsB.find((i) => i.qty === 10);
    const ii2 = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: poB,
        poItemRecordId: partial.id,
        itemName: ITEM_NAME,
        qty: 4,
        unitPrice: 10,
        remark: "",
    });
    track("invoiceItems", ii2.id);
    const overItem = itemsB.find((i) => i.qty === 7);
    const ii3 = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: poB,
        poItemRecordId: overItem.id,
        itemName: ITEM_NAME,
        qty: 9,
        unitPrice: 10,
        remark: "",
    });
    track("invoiceItems", ii3.id);

    const rows = await base(TABLES.PO_ITEMS)
        .select({ filterByFormula: `{Item Name} = "${ITEM_NAME}"` })
        .all();
    let states = { open: 0, closed: 0 };
    for (const row of rows) {
        const qty = row.get("Qty");
        const invoicedQty = row.get("Invoiced Qty");
        const field = (row.get("Has Uninvoiced Qty") || 0) > 0;
        const js = hasUninvoicedQty({ qty, invoicedQty });
        check(`qty=${qty} invoiced=${invoicedQty || 0}: field matches hasUninvoicedQty`, field, js);
        states[js ? "open" : "closed"]++;
    }
    // ANTI-VACUITY. "They agree" is also what a comparison of two constants
    // returns, so the rows have to contain both answers for the loop above to
    // mean anything.
    assert(`both answers occurred (${states.open} open, ${states.closed} closed)`,
        states.open > 0 && states.closed > 0);

    // -------------------------------------------------------------------
    console.log("\nPart D — getOpenPOs answers with that field:");
    const poOpen = await makePO(userId, "open control", [3]);
    // Every ordered item invoiced to the letter, so nothing is left and the only
    // reason to exclude it is the judgment under test.
    const poClosed = await makePO(userId, "closed control", [6]);
    const closedItems = await getItemsByPO(poClosed);
    const ii4 = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: poClosed,
        poItemRecordId: closedItems[0].id,
        itemName: ITEM_NAME,
        qty: 6,
        unitPrice: 10,
        remark: "",
    });
    track("invoiceItems", ii4.id);
    // A third control the walk and the query must agree about for the same
    // reason verify-po-withdraw-138.mjs states: no ordered items at all.
    const poEmpty = await makePO(userId, "item-less control", []);

    const open = await getOpenPOs();
    const openIds = new Set(open.map((p) => p.id));
    check("an order with something left is offered", openIds.has(poOpen), true);
    check("a fully invoiced order is not", openIds.has(poClosed), false);
    check("an order with no ordered items is not", openIds.has(poEmpty), false);
    check("the partly invoiced order is still offered", openIds.has(poB), true);
    assert("every order it returns reads as open on its own record",
        open.every((p) => hasUninvoicedItems(p)));

    // THE SET, NOT JUST THE FIXTURES. The query has to agree with the walk it
    // replaced across the whole base, or the picker silently gained or lost
    // orders nobody looked at.
    const live = (await getPOsExceptWithdrawn());
    const allItems = await base(TABLES.PO_ITEMS).select({ fields: ["Qty", "Invoiced Qty"] }).all();
    const itemById = new Map(allItems.map((r) => [r.id, r]));
    const walked = live
        .filter((p) => (p.poItems || []).some((id) => {
            const it = itemById.get(id);
            return it && hasUninvoicedQty({ qty: it.get("Qty"), invoicedQty: it.get("Invoiced Qty") });
        }))
        .map((p) => p.id).sort();
    const queried = [...openIds].sort();
    check(`the query and the item walk return the same ${walked.length} orders`,
        JSON.stringify(queried), JSON.stringify(walked));

    // -------------------------------------------------------------------
    console.log("\nPart E — the query index, which is a different surface from .find():");
    // PO Items."Invoiced Qty" is measured correct on the FIRST read after
    // create() returns, but that is a .find() on the record. getOpenPOs filters
    // on a computed field, which Airtable answers from a query index, and
    // client.js records that a newly written record can be briefly invisible to
    // one. Whether that reaches this screen is measured, not assumed.
    const reads = async (predicate, label) => {
        for (let i = 1; i <= 10; i++) {
            const list = await getOpenPOs();
            if (predicate(new Set(list.map((p) => p.id)))) return i;
        }
        console.log(`  (${label}: still wrong after 10 reads)`);
        return -1;
    };

    const poFresh = await makePO(userId, "freshness", [4]);
    const appearsAfter = await reads((ids) => ids.has(poFresh), "appear");
    check("a just-generated order is offered on the first read", appearsAfter, 1);

    const freshItems = await getItemsByPO(poFresh);
    const ii5 = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: poFresh,
        poItemRecordId: freshItems[0].id,
        itemName: ITEM_NAME,
        qty: 4,
        unitPrice: 10,
        remark: "",
    });
    track("invoiceItems", ii5.id);
    const dropsAfter = await reads((ids) => !ids.has(poFresh), "drop");
    check("and drops out on the first read after it is fully invoiced", dropsAfter, 1);

    // -------------------------------------------------------------------
    console.log("\nPart F — what one call costs:");
    // THE BOUND IS THE CLAIM, NOT A ROUND NUMBER. getOpenPOs is one select whose
    // result `.all()` pages at 100 records, so its cost is one operation per 100
    // OPEN orders and nothing per order beyond that.
    //
    // THE RESET BELOW COSTS THIS SCRIPT ITS OWN PROCESS TOTAL, and that is worth
    // knowing before reading the `[airtable-ops]` line at exit: it counts from
    // here, not from the first fixture, so it is the cost of Part F and cleanup
    // rather than of the run. The alternative — a before-and-after snapshot —
    // would keep the total and is what a second reader of this pattern should
    // reach for; nothing else in this file depends on the counter.
    resetOps();
    const priced = await getOpenPOs();
    const ops = snapshot().total;
    const expected = Math.max(1, Math.ceil(priced.length / 100));
    console.log(`  ${priced.length} open orders, ${live.length} orders not withdrawn`);
    check(`one operation per 100 open orders (${expected} expected)`, ops, expected);
    // ANTI-VACUITY, AND THE REGRESSION THIS ISSUE IS ABOUT. Any implementation
    // that touches each order pays at least one operation per order, so this
    // clause fails for every per-record shape while the base holds more than a
    // couple of orders. It is the clause a helper-wrapped walk could not slip
    // past, which a source-shape assertion could.
    assert(`and fewer operations than there are orders (${ops} < ${live.length})`,
        ops < live.length);

    complete = true;
} catch (err) {
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleanup:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(56));
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
