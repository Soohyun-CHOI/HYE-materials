// The Invoice ID daily counter — credentialed (#164).
//
// The offline tier pins the rule itself (scripts/tests/offline/id-sequence.mjs,
// 54 checks: the prefixes, max-not-count, the membership test, and that lib/ids.js
// names no date field in a formula). What only real records can answer is here:
//
//   A — the live schema still holds the four ID fields the code counts, under the
//       names it uses. A counter reading a field that was renamed in Airtable's UI
//       is invisible to every file-only check — the third tier CLAUDE.md describes.
//   B — the defect, on the real rows: `IS_SAME({Issue Date}, TODAY(), 'day')`
//       against the population the sequence actually has to be unique within, plus
//       the `LEFT({Invoice ID}, 13)` the issue was filed with, which matches 0 rows
//       because the prefix is 14 characters.
//   C — TWO INVOICES CREATED IN ONE RUN GET DIFFERENT NUMBERS, through the real
//       createInvoice, both with a vendor Issue Date in the past — which is the
//       condition that made the old counter hand out `-01` twice. The old filter is
//       run again afterwards to show it still matches 0, i.e. it would have.
//   D — the other three generators, since #164 made all four share one rule. The PO
//       case reproduces the incident CLAUDE.md records for
//       scripts/demo/seed_material_prices.mjs: a backdated `Created Date` hides a
//       PO from the old count, and five POs came out sharing one PO ID. The new
//       rule cannot see that field.
//   E — a deleted sequence is not re-minted. Measured on this base, both existing
//       invoice prefixes are gapped, so count + 1 is a number that already exists.
//   F — prefixMatch against the live parser: the `= 1` anchor, case sensitivity, an
//       unused prefix, and a hostile prefix carrying a quote (#159's property,
//       scoped to the new builder).
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-invoice-ids-164.mjs
//
// Fixtures: creates Invoices, PRs, POs and Deliveries with no children and no
// attachments, and DELETES ALL OF THEM in this same run. Creates nothing in Vercel
// Blob. Reuses (never modifies, never deletes) one active User, one Vendor, one Line
// and one Job. The only record it updates is a PO it created itself, to backdate
// the field Part D is about.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { execSync } from "child_process";
import { createInvoice } from "../../lib/airtable/invoices.js";
import { createPR } from "../../lib/airtable/purchaseRequests.js";
import { createPO } from "../../lib/airtable/purchaseOrders.js";
import { createDelivery } from "../../lib/airtable/deliveries.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getAllJobs } from "../../lib/airtable/jobs.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { prefixMatch } from "../../lib/airtableFormula.js";
import { ID_KINDS, dailyIdPrefix, nextSequence } from "../../lib/idSequence.js";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}

// ---------------------------------------------------------------------------
// Header. A past run is only evidence if it can be tied to a tree, so the commit
// and whether it was dirty are printed before anything else runs. A dirty tree does
// not fail the run — it is normal to verify work in progress — but it means the
// commit alone does not identify what was tested. Same block as
// verify-deliveries-162.mjs; carrying it to the remaining scripts is #172.
function gitContext() {
    try {
        const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        const dirtyFiles = status.split("\n").filter((l) => l.trim().length > 0);
        return { head, dirty: dirtyFiles.length > 0, dirtyCount: dirtyFiles.length };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}

const git = gitContext();
console.log("=".repeat(72));
console.log("verify-invoice-ids-164 — the daily ID counter's population");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty
          ? `tree      DIRTY — ${git.dirtyCount} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

const TAG = `V164-${Date.now().toString(36).toUpperCase()}`;
const created = { invoices: [], prs: [], pos: [], deliveries: [] };
const track = (bucket, id) => {
    created[bucket].push(id);
    return id;
};
const untrack = (bucket, id) => {
    created[bucket] = created[bucket].filter((x) => x !== id);
};

/** The sequence number off the end of a generated ID. */
const seqOf = (id) => Number(id.slice(id.lastIndexOf("-") + 1));

/** Every ID in a table, unfiltered — the JS-side authority for Part B. */
async function allIds(table, field) {
    const rows = await base(table).select({ fields: [field] }).all();
    return rows.map((r) => r.get(field)).filter(Boolean);
}

/** How many rows a formula selects. Read-only. */
async function countBy(table, field, formula) {
    const rows = await base(table).select({ filterByFormula: formula, fields: [field] }).all();
    return rows.length;
}

const NOW = new Date();
const TODAY_ISO = NOW.toISOString().slice(0, 10);
const PREFIX = {
    invoice: dailyIdPrefix(ID_KINDS.INVOICE, NOW),
    pr: dailyIdPrefix(ID_KINDS.PR, NOW),
    po: dailyIdPrefix(ID_KINDS.PO, NOW),
    delivery: dailyIdPrefix(ID_KINDS.DELIVERY, NOW),
};

try {
    // -----------------------------------------------------------------------
    console.log("\nPart A — the live schema still holds the fields the counters count:");
    const metaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    });
    const { tables } = await metaRes.json();

    for (const [table, kind] of [
        [TABLES.INVOICES, ID_KINDS.INVOICE],
        [TABLES.PURCHASE_REQUESTS, ID_KINDS.PR],
        [TABLES.PURCHASE_ORDERS, ID_KINDS.PO],
        [TABLES.DELIVERIES, ID_KINDS.DELIVERY],
    ]) {
        const tbl = tables.find((t) => t.name === table);
        const field = tbl?.fields.find((f) => f.name === kind.idField);
        assert(`${table}."${kind.idField}" exists under the name lib/idSequence.js counts`, Boolean(field));
        // A formula reads it as text. A renamed or retyped field breaks the counter
        // and nothing in CI would see it.
        if (field) check(`  and is single-line text`, field.type, "singleLineText");
    }

    // Reported, not asserted: #164 chose the route that needs no new field, so the
    // absence is the design working rather than a property to pin. If an audit
    // `Created At` is added later this line simply says so — what must NOT change
    // is that the counter stops reading the ID prefix, and offline/id-sequence.mjs
    // is what holds that.
    const invoiceFields = tables.find((t) => t.name === TABLES.INVOICES).fields.map((f) => f.name);
    console.log(
        `  note    Invoices."Created At" ${invoiceFields.includes("Created At") ? "EXISTS" : "does not exist"}` +
            ` — the counter needs no date field either way`
    );

    // -----------------------------------------------------------------------
    console.log("\nPart B — the defect, on the rows that are already there:");
    const invoiceIds = await allIds(TABLES.INVOICES, ID_KINDS.INVOICE.idField);
    console.log(`  ${invoiceIds.length} invoices on record: ${invoiceIds.sort().join(", ")}`);

    const byIssueDate = await countBy(
        TABLES.INVOICES,
        ID_KINDS.INVOICE.idField,
        `IS_SAME({Issue Date}, TODAY(), 'day')`
    );
    const byPrefix = await countBy(
        TABLES.INVOICES,
        ID_KINDS.INVOICE.idField,
        prefixMatch(ID_KINDS.INVOICE.idField, PREFIX.invoice)
    );
    console.log(
        `  the old population  IS_SAME({Issue Date}, TODAY(), 'day')      -> ${byIssueDate} row(s)` +
            `  [would mint ${byIssueDate + 1}]`
    );
    console.log(`  the new population  FIND("${PREFIX.invoice}", {Invoice ID}) = 1  -> ${byPrefix} row(s)`);

    // The formula must select EXACTLY the siblings, for every prefix that exists.
    // This is the half offline/id-sequence.mjs cannot reach: it pins the string,
    // not what Airtable does with it.
    const existingPrefixes = [...new Set(invoiceIds.map((id) => id.slice(0, id.lastIndexOf("-"))))];
    for (const prefix of existingPrefixes) {
        const expected = invoiceIds.filter((id) => id.startsWith(`${prefix}-`)).length;
        const actual = await countBy(
            TABLES.INVOICES,
            ID_KINDS.INVOICE.idField,
            prefixMatch(ID_KINDS.INVOICE.idField, prefix)
        );
        check(`the formula selects exactly the siblings of ${prefix}`, actual, expected);
    }

    // The number the issue was filed with. 13 characters is one short of the
    // prefix, so it selects nothing at all — a silent zero, which in a counter
    // reads as "first of the day".
    const sample = existingPrefixes[0];
    if (sample) {
        const left13 = await countBy(TABLES.INVOICES, ID_KINDS.INVOICE.idField, `LEFT({Invoice ID}, 13) = "${sample}"`);
        check(`LEFT({Invoice ID}, 13) = "${sample}" matches nothing (the prefix is ${sample.length} chars)`, left13, 0);
    }

    // The gaps that make max load-bearing rather than tidy.
    console.log("  count vs max per existing prefix — a gap means a row was deleted:");
    for (const prefix of existingPrefixes.sort()) {
        const seqs = invoiceIds.filter((id) => id.startsWith(`${prefix}-`)).map(seqOf);
        const countPlusOne = seqs.length + 1;
        const collides = seqs.includes(countPlusOne);
        console.log(
            `    ${prefix}  seqs=[${seqs.sort((a, b) => a - b).join(",")}]  count+1=${countPlusOne}` +
                `  max+1=${nextSequence(invoiceIds, prefix)}` +
                `${collides ? "  <== count+1 ALREADY EXISTS" : ""}`
        );
    }

    // -----------------------------------------------------------------------
    console.log("\nPart C — two invoices, one run, one day:");
    const vendors = await getAllVendors();
    if (vendors.length === 0) throw new Error("no Vendor to hang a fixture invoice on");
    const vendor = vendors[0];

    // Issue Dates deliberately in the past, and different from each other: this is
    // the real shape of a vendor invoice, and it is exactly what the old counter
    // could not survive.
    const invoiceA = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `${TAG}-A`,
        issueDate: "2026-01-15",
        dueDate: "2026-02-15",
        amountDue: 100,
        shippingFee: 0,
        file: [],
    });
    track("invoices", invoiceA.id);
    const invoiceB = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `${TAG}-B`,
        issueDate: "2026-02-20",
        dueDate: "2026-03-20",
        amountDue: 200,
        shippingFee: 0,
        file: [],
    });
    track("invoices", invoiceB.id);
    console.log(`  created ${invoiceA.invoiceId} (issued 2026-01-15) and ${invoiceB.invoiceId} (issued 2026-02-20)`);

    assert(`both carry today's prefix ${PREFIX.invoice}`,
        invoiceA.invoiceId.startsWith(`${PREFIX.invoice}-`) && invoiceB.invoiceId.startsWith(`${PREFIX.invoice}-`));
    assert("the ID's date segment is today's, not the vendor's issue date",
        !invoiceA.invoiceId.includes("260115") && !invoiceB.invoiceId.includes("260220"));
    assert(`THE TWO IDS DIFFER (${invoiceA.invoiceId} != ${invoiceB.invoiceId})`, invoiceA.invoiceId !== invoiceB.invoiceId);
    check("and the second is the first + 1", seqOf(invoiceB.invoiceId), seqOf(invoiceA.invoiceId) + 1);
    check("the first took max+1 over the day's existing rows", seqOf(invoiceA.invoiceId), byPrefix + 1);

    // The old rule, re-run now that both rows exist. It still matches 0, so it
    // would have minted `-01` for both — the defect, not inferred but measured.
    const oldAfter = await countBy(TABLES.INVOICES, ID_KINDS.INVOICE.idField, `IS_SAME({Issue Date}, TODAY(), 'day')`);
    check("the old filter still matches 0 with both rows in place", oldAfter, byIssueDate);
    assert(
        `so the old rule would have minted ${PREFIX.invoice}-${String(oldAfter + 1).padStart(2, "0")} TWICE`,
        oldAfter + 1 !== seqOf(invoiceB.invoiceId)
    );

    // -----------------------------------------------------------------------
    console.log("\nPart D — the other three generators share the rule now:");
    const users = await getActiveUsers();
    const lines = await getAllLines();
    const jobs = await getAllJobs();
    if (users.length === 0 || lines.length === 0 || jobs.length === 0) {
        throw new Error("need one active User, one Line and one Job for the PR/PO/Delivery fixtures");
    }
    const user = users[0];

    const prA = await createPR({ requesterId: user.id, lineId: lines[0].id, vendorId: vendor.id, notes: `${TAG} A` });
    track("prs", prA.id);
    const prB = await createPR({ requesterId: user.id, lineId: lines[0].id, vendorId: vendor.id, notes: `${TAG} B` });
    track("prs", prB.id);
    assert(`PR IDs differ (${prA.prId} vs ${prB.prId})`, prA.prId !== prB.prId);
    check("consecutive", seqOf(prB.prId), seqOf(prA.prId) + 1);
    assert(`both carry today's prefix ${PREFIX.pr}`, prA.prId.startsWith(`${PREFIX.pr}-`) && prB.prId.startsWith(`${PREFIX.pr}-`));

    // One PO per PR, so the strict 1:1 the schema assumes is not violated by a
    // fixture. createPO directly rather than through generatePOForApprovedPR: the
    // subject is the ID counter, and this is the narrowest thing that reaches it.
    const poA = await createPO({ prRecordId: prA.id, ourPicId: user.id, ourManagerId: user.id, deliveryAddressUsed: "Primary" });
    track("pos", poA.id);

    // The seed_material_prices.mjs incident, reproduced: backdating Created Date
    // hid a PO from the old count, and five POs came out sharing one PO ID. A raw
    // field write because updatePO has no createdDate parameter — and it is a
    // record this run created.
    await base(TABLES.PURCHASE_ORDERS).update(poA.id, { "Created Date": "2026-01-05" });
    console.log(`  backdated ${poA.poId}'s Created Date to 2026-01-05 (what the demo script did)`);

    const poB = await createPO({ prRecordId: prB.id, ourPicId: user.id, ourManagerId: user.id, deliveryAddressUsed: "Primary" });
    track("pos", poB.id);
    assert(`PO IDs differ despite the backdating (${poA.poId} vs ${poB.poId})`, poA.poId !== poB.poId);
    check("still consecutive", seqOf(poB.poId), seqOf(poA.poId) + 1);

    // What the old rule would have done with the same two records.
    const oldPoCount = await countBy(TABLES.PURCHASE_ORDERS, ID_KINDS.PO.idField, `IS_SAME({Created Date}, TODAY(), 'day')`);
    const poIdsNow = await allIds(TABLES.PURCHASE_ORDERS, ID_KINDS.PO.idField);
    const todaysPoSeqs = poIdsNow.filter((id) => id.startsWith(`${PREFIX.po}-`)).map(seqOf);
    assert(
        `the old rule would have re-issued ${PREFIX.po}-${String(oldPoCount + 1).padStart(2, "0")}, which exists` +
            ` — the backdated PO is invisible to it`,
        todaysPoSeqs.includes(oldPoCount + 1)
    );

    const dlA = await createDelivery({
        jobRecordId: jobs[0].id,
        vendorRecordId: vendor.id,
        poRecordId: null,
        // Backdated on purpose: the packing-list date is routinely earlier than
        // entry, and it is the field #162 refused to count. Nothing counts it now.
        receivedDate: "2026-01-10",
        recordedByUserId: user.id,
        notes: `${TAG} A`,
        file: [],
    });
    track("deliveries", dlA.id);
    const dlB = await createDelivery({
        jobRecordId: jobs[0].id,
        vendorRecordId: vendor.id,
        poRecordId: null,
        receivedDate: "2026-01-11",
        recordedByUserId: user.id,
        notes: `${TAG} B`,
        file: [],
    });
    track("deliveries", dlB.id);
    assert(`Delivery IDs differ (${dlA.deliveryId} vs ${dlB.deliveryId})`, dlA.deliveryId !== dlB.deliveryId);
    check("consecutive", seqOf(dlB.deliveryId), seqOf(dlA.deliveryId) + 1);
    assert("the ID's date is today's, not the backdated Received Date",
        dlA.deliveryId.startsWith(`${PREFIX.delivery}-`) && !dlA.deliveryId.includes("260110"));

    // -----------------------------------------------------------------------
    console.log("\nPart E — a deleted sequence is not re-minted:");
    await base(TABLES.INVOICES).destroy(invoiceA.id);
    untrack("invoices", invoiceA.id);
    console.log(`  deleted ${invoiceA.invoiceId}, leaving a gap at ${seqOf(invoiceA.invoiceId)}`);

    const survivingSeqs = (await allIds(TABLES.INVOICES, ID_KINDS.INVOICE.idField))
        .filter((id) => id.startsWith(`${PREFIX.invoice}-`))
        .map(seqOf);
    const wouldCount = survivingSeqs.length + 1;

    const invoiceC = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `${TAG}-C`,
        issueDate: "2026-03-01",
        dueDate: "2026-04-01",
        amountDue: 300,
        shippingFee: 0,
        file: [],
    });
    track("invoices", invoiceC.id);
    console.log(`  created ${invoiceC.invoiceId}`);

    assert(
        `count+1 would have been ${wouldCount}, which is still on a live row`,
        survivingSeqs.includes(wouldCount)
    );
    assert(`the new ID collides with nothing (${invoiceC.invoiceId})`, !survivingSeqs.includes(seqOf(invoiceC.invoiceId)));
    check("it is max + 1", seqOf(invoiceC.invoiceId), Math.max(...survivingSeqs) + 1);

    // -----------------------------------------------------------------------
    console.log("\nPart F — prefixMatch against the live parser:");
    const inv = ID_KINDS.INVOICE.idField;

    // The anchor. `INV-260803` occurs in every one of today's IDs, at position 5 —
    // so a match here would mean `= 1` is not doing what the builder claims.
    const unanchored = PREFIX.invoice.slice(4);
    check(
        `an interior substring ("${unanchored}", at position 5) matches nothing`,
        await countBy(TABLES.INVOICES, inv, prefixMatch(inv, unanchored)),
        0
    );
    check(
        "the same substring anchored at 1 does match",
        (await countBy(TABLES.INVOICES, inv, prefixMatch(inv, PREFIX.invoice))) > 0,
        true
    );
    check(
        "FIND is case-sensitive, so a lowercased prefix matches nothing",
        await countBy(TABLES.INVOICES, inv, prefixMatch(inv, PREFIX.invoice.toLowerCase())),
        0
    );
    check(
        "an unused prefix matches nothing rather than everything",
        await countBy(TABLES.INVOICES, inv, prefixMatch(inv, "HYE-INV-190101")),
        0
    );
    // #159's property, scoped to the new builder: a hostile prefix is accepted by
    // the parser as DATA and matches nothing, rather than 422ing or going true.
    for (const hostile of ['HYE-INV-2608"03', '" & {Invoice ID} & "', 'IF(1, "x", "y")', "HYE\\INV"]) {
        let result;
        try {
            result = await countBy(TABLES.INVOICES, inv, prefixMatch(inv, hostile));
        } catch (err) {
            result = `ERROR ${err.message}`;
        }
        check(`a hostile prefix is inert: ${JSON.stringify(hostile)}`, result, 0);
    }
} catch (err) {
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    incomplete = `aborted before finishing: ${err.message}`;
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const destroy = async (table, id, label) =>
    base(table)
        .destroy(id)
        .then(() => console.log(`  deleted ${label} ${id}`))
        .catch((e) => {
            // A surviving fixture is not a silent outcome: it becomes a stray row
            // on a shared base, which is what verify-blob-lifecycle-140.mjs's
            // swallowed cleanup left behind twice.
            pass = false;
            console.error(`  cleanup FAILED: ${label} ${id} — remove manually:`, e.message);
        });

for (const id of created.deliveries) await destroy(TABLES.DELIVERIES, id, "Delivery");
// POs before PRs: a PO links its PR, so the other order leaves a dangling link for
// as long as the loop takes.
for (const id of created.pos) await destroy(TABLES.PURCHASE_ORDERS, id, "PO");
for (const id of created.prs) await destroy(TABLES.PURCHASE_REQUESTS, id, "PR");
for (const id of created.invoices) await destroy(TABLES.INVOICES, id, "Invoice");

console.log("\n" + "=".repeat(72));
console.log(`commit ${git.head}${git.dirty ? " (DIRTY TREE)" : ""}`);
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
process.exit(!pass ? 1 : incomplete ? 2 : 0);
