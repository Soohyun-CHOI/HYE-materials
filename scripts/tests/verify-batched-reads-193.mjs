// Verification for issue #193 — reading a parent's children in one query instead
// of one find() per child.
//
// THIS SCRIPT DECIDES THE ISSUE'S SCOPE RATHER THAN CONFIRMING IT. The single
// find() was chosen deliberately: lib/airtable/client.js:getLinkedRecords records
// that it avoids filtering the child table because Airtable computes lookup
// fields asynchronously, so a row created moments earlier can be briefly
// invisible to a formula query. findByRecordIds matches on RECORD_ID() rather
// than on a lookup, and #19 measured that working on this base — but nobody had
// measured it against children created SECONDS earlier, which is what a Draft
// re-save produces and what #164's Part I had to measure for the parent's link
// array itself. If Part A–D come back dirty, the batched child read does not
// ship and the finding is the result.
//
// WHAT THE OFFLINE TIER CANNOT SEE HERE, and why all of this is credentialed:
// findChildRecords restores two contracts findByRecordIds gives up — link-array
// ORDER, and a THROW on an id that does not resolve — and both are judgments
// about live rows. The functions live in lib/airtable/client.js, which throws
// without credentials, so the offline tier cannot load them at all; extracting
// five lines into a module of their own to make them reachable would trade a real
// boundary for a testable one. Part F is where they are proved instead.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-batched-reads-193.mjs

import { createPR, updatePR } from "../../lib/airtable/purchaseRequests.js";
import { createItem, getItemsByPR } from "../../lib/airtable/prItems.js";
import { createInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { TABLES, findChildRecords, getLinkedRecords } from "../../lib/airtable/client.js";
import { resetOps, snapshot } from "../../lib/airtableOps.js";
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
// Invoice, PRs last because a PR's items are discovered through its own link.
//
// No Materials bucket: these PRs carry no Vendor, so refreshMaterialsCacheForPO
// never runs — and nothing here generates a PO in any case. The fixture Invoice
// does name a vendor, because an Invoice needs one, but no code path writes the
// item axis from an invoice.
const fixtures = createFixtures({
    tag: "V193",
    buckets: [
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item", tagField: "Item Name" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [{ link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" }],
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

// THE TAG IS PRINTED BEFORE ANYTHING IS CREATED, not only at cleanup. A run
// killed by Ctrl-C skips the catch that teardown lives behind — the one hole
// _fixtures.mjs names and does not cover — and the tag is a per-run random
// suffix, so without this line the prefix needed to sweep by hand would die with
// the process. Everything this run writes carries it.
console.log(`run tag: ${TAG} — every fixture below is prefixed with it`);

const ITEM_NAME = `${TAG} probe`;

/**
 * Read until the batched query returns every id, or give up.
 *
 * Returns the number of reads it took (1 is "correct on the first read") and
 * what was missing on that first read, which is the figure #193 needs: a lag
 * would show as 2+ here, or as -1 if it never settled.
 */
async function readsUntilComplete(table, ids, cap = 10) {
    let firstMissing = null;
    for (let i = 1; i <= cap; i++) {
        const rows = await findChildRecords(table, ids).catch((e) => e);
        if (rows instanceof Error) {
            // findChildRecords THROWS on a short result, which is the contract —
            // so a lag surfaces here rather than as a quiet undercount.
            if (firstMissing === null) {
                firstMissing = rows.message.replace(/^.*did not resolve \(/, "").replace(/\)$/, "");
            }
            continue;
        }
        if (rows.length === ids.length) return { reads: i, firstMissing };
    }
    return { reads: -1, firstMissing };
}

/** An Approved-status-agnostic PR with `n` items, created back to back. */
async function makePRWithItems(userId, note, n) {
    const pr = await createPR({ requesterId: userId, notes: `${TAG} ${note}` });
    track("prs", pr.id);
    const ids = [];
    for (let i = 0; i < n; i++) {
        const item = await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: ITEM_NAME,
            qty: i + 1,
            unitPrice: 10,
        });
        ids.push(item.id);
    }
    return { pr, ids };
}

let complete = false;
try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute fixtures to.");
    const userId = users[0].id;
    const vendors = await getAllVendors();
    if (vendors.length === 0) throw new Error("No vendor to attribute the fixture invoice to.");

    // -------------------------------------------------------------------
    console.log("\nPart A — children created seconds ago, read by RECORD_ID() (4 trials):");
    const trialA = [];
    for (let t = 1; t <= 4; t++) {
        const { pr, ids } = await makePRWithItems(userId, `A${t}`, 3);
        const { reads, firstMissing } = await readsUntilComplete(TABLES.PR_ITEMS, ids);
        trialA.push({ pr, ids, reads, firstMissing });
        check(`trial ${t}: 3 items complete on read #`, reads, 1);
        if (firstMissing) console.log(`      (missing on read 1: ${firstMissing})`);
    }
    assert("no trial needed more than one read", trialA.every((x) => x.reads === 1));

    // -------------------------------------------------------------------
    console.log("\nPart B — a second table, because the query index is per table:");
    const invoice = await createInvoice({
        vendorId: vendors[0].id,
        vendorInvoiceCode: `${TAG}-INV`,
        issueDate: "2026-08-18",
        dueDate: "2026-09-18",
        amountDue: 60,
        shippingFee: 0,
    });
    track("invoices", invoice.id);
    const invItemIds = [];
    for (let i = 0; i < 3; i++) {
        const ii = await createInvoiceItem({
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            itemName: ITEM_NAME,
            qty: i + 1,
            unitPrice: 10,
            remark: "",
        });
        track("invoiceItems", ii.id);
        invItemIds.push(ii.id);
    }
    const invRead = await readsUntilComplete(TABLES.INVOICE_ITEMS, invItemIds);
    check("3 invoice items complete on read #", invRead.reads, 1);
    if (invRead.firstMissing) console.log(`      (missing on read 1: ${invRead.firstMissing})`);

    // -------------------------------------------------------------------
    console.log("\nPart C — the tightest window: one child, queried with nothing awaited between:");
    for (let t = 1; t <= 4; t++) {
        const pr = await createPR({ requesterId: userId, notes: `${TAG} C${t}` });
        track("prs", pr.id);
        const item = await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: ITEM_NAME,
            qty: 1,
            unitPrice: 1,
        });
        const { reads } = await readsUntilComplete(TABLES.PR_ITEMS, [item.id]);
        check(`trial ${t}: the child is visible on read #`, reads, 1);
    }

    // -------------------------------------------------------------------
    console.log("\nPart D — the incumbent, side by side on the same parent:");
    // getLinkedRecords reads the parent's link array and then the children. Both
    // halves have to agree with the batched read for this to be a replacement
    // rather than a different answer.
    const { pr: prD, ids: idsD } = await makePRWithItems(userId, "D", 3);
    const viaParent = await getLinkedRecords(TABLES.PURCHASE_REQUESTS, prD.id, "PR Items", TABLES.PR_ITEMS);
    const viaIds = await findChildRecords(TABLES.PR_ITEMS, idsD);
    check("the parent walk sees all three", viaParent.length, 3);
    check("and returns the same ids in the same order",
        JSON.stringify(viaParent.map((r) => r.id)), JSON.stringify(viaIds.map((r) => r.id)));

    // -------------------------------------------------------------------
    console.log("\nPart E — the cost does not move with the number of children:");
    // THE STANDING CHECK. Source shape cannot hold this line — a per-child
    // implementation wrapped in a helper reads as batched — so it is asserted on
    // the operations a real call makes.
    const small = await makePRWithItems(userId, "E-small", 3);
    const large = await makePRWithItems(userId, "E-large", 8);

    // THE RESET COSTS THIS SCRIPT ITS OWN PROCESS TOTAL, worth knowing before
    // reading the `[airtable-ops]` line at exit: it counts from here, so it is the
    // cost of Parts E–F and cleanup rather than of the run. A before-and-after
    // snapshot would keep the total and is what a second reader of this pattern
    // should reach for; nothing else in this file depends on the counter.
    resetOps();
    const smallItems = await getItemsByPR(small.pr.id);
    const smallOps = snapshot().total;
    resetOps();
    const largeItems = await getItemsByPR(large.pr.id);
    const largeOps = snapshot().total;

    check("the small PR has 3 items", smallItems.length, 3);
    check("the large PR has 8 items", largeItems.length, 8);
    // ANTI-VACUITY, three clauses. The child counts must differ and both be
    // non-zero, or "equal cost" is a statement about nothing; the cost must be
    // above zero, since a call that read nothing would also be equal; and the
    // large case must come in under 1 + its child count, which is what every
    // one-at-a-time shape spends and no wrapper can hide.
    assert(`the two child counts differ (${smallItems.length} vs ${largeItems.length})`,
        smallItems.length !== largeItems.length && smallItems.length > 0);
    assert(`the call costs something (${smallOps} ops)`, smallOps > 0);
    check(`cost is the same for 3 children and for 8 (${smallOps} vs ${largeOps})`, smallOps, largeOps);
    assert(`and under 1 + 8 for the large one (${largeOps} < 9)`, largeOps < 1 + largeItems.length);

    // The ids path pays strictly less, because it skips the parent find.
    resetOps();
    await getItemsByPR(large.pr.id, { rowIds: large.ids });
    const idsOps = snapshot().total;
    assert(`passing the link array costs less than passing the id (${idsOps} < ${largeOps})`, idsOps < largeOps);

    // -------------------------------------------------------------------
    console.log("\nPart F — the two contracts findChildRecords restores:");
    // ORDER. Reversed input must come back reversed: findByRecordIds alone
    // returns Airtable's own order, so this is what stops a rendered items table
    // from silently reshuffling.
    const reversed = [...large.ids].reverse();
    const gotReversed = await findChildRecords(TABLES.PR_ITEMS, reversed);
    check("the result follows the order it was given",
        JSON.stringify(gotReversed.map((r) => r.id)), JSON.stringify(reversed));

    // A MISSING ID IS LOUD. find() threw on one; findByRecordIds says nothing.
    let threw = null;
    await findChildRecords(TABLES.PR_ITEMS, [...large.ids, "recDoesNotExist01"]).catch((e) => {
        threw = e.message;
    });
    assert("an id that does not resolve throws rather than returning fewer rows",
        typeof threw === "string" && threw.includes("recDoesNotExist01"));

    // And an empty link array is still zero queries and zero rows.
    resetOps();
    const none = await findChildRecords(TABLES.PR_ITEMS, []);
    check("an empty link array reads nothing", snapshot().total, 0);
    check("and returns no rows", none.length, 0);

    // Leave the Draft-shaped fixture in a state the cleanup can see.
    await updatePR(prD.id, { notes: `${TAG} D done` });

    complete = true;
} catch (error) {
    pass = false;
    console.error(`\n  ABORTED — ${error.message}`);
    console.error(error.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleanup:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(56));
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
