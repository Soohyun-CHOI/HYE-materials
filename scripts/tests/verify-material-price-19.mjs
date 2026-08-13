// Material price search + purchase history — credentialed (#19).
//
// The claim that matters most is an authorization one: prices, vendors, dates and
// quantities are open to every active user, but the DOCUMENT IDENTIFIERS on each
// row (PO ID, PR ID, Job) follow the document's own rule — canViewPR on the
// source PO's parent PR. A viewer who fails that must see the price and see no
// identifier. That cannot be checked from files, because it depends on real
// records and on a real non-Admin user, so it lives here.
//
// Parts:
//   A — fixtures: two vendors buy one material, plus a withdrawn PO.
//   B — search as an Admin: grouping, per-vendor rows, identifiers present.
//   C — search as the permanent non-Admin fixture: SAME prices, NO identifiers.
//   D — history: newest first, withdrawn ordered item present and marked, same gating.
//   E — the query budget is constant in the number of rows, measured by counting
//       Airtable HTTP requests rather than asserted.
//
// Everything goes through production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-material-price-19.mjs
//
// Fixtures: 3 PRs + PR Items, 3 POs + PO Items, and the Materials / Material
// Prices rows #18's cache writes for them — all deleted in this same run through
// scripts/tests/_fixtures.mjs (#171). Creates nothing in Vercel Blob. Reuses
// (never modifies, never deletes) two Vendors, one Line, and the authz-fixture
// user.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base,
// 2 clean but incomplete.

import { searchMaterialPrices, getMaterialPurchaseHistory } from "../../lib/materialHistory.js";
import { countsAsOrdered, lowestPriceRowIds, qtyDiffersAcross } from "../../lib/materialPriceView.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { updatePO } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers, getUserByEmail } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";

const FIXTURE_EMAIL = "authz-fixture@hanyangengusa.com";

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

/**
 * Count Airtable OPERATIONS around one call — every `.select()` and every
 * `.find()` issued, counted on the client's own Table prototype.
 *
 * The first attempt at this patched `globalThis.fetch` and measured 0, which made
 * the budget assertions pass vacuously — the exact green-regardless failure this
 * repo has been bitten by before. airtable@0.12.2 resolves `node-fetch` at module
 * load (lib/fetch.js) and captures the function, so a later global patch cannot
 * be seen. Counting at the client layer is both reachable and the more honest
 * measure anyway, since "how many queries does this page make" is the claim.
 *
 * It hooks `_selectRecords` / `_findRecordById` on the Table PROTOTYPE, not
 * `select` / `find`: those two are assigned per instance in airtable's Table
 * constructor (`select is own? true`, measured), so a prototype patch of them
 * catches nothing — which is the second way this measurement silently read 0
 * before it read anything. The underscore-prefixed pair are the implementations
 * those wrappers call, they live on the prototype, and every table object
 * created afterwards therefore sees the patch.
 *
 * That makes this instrument depend on a dependency's private names, so an
 * airtable upgrade could rename them and quietly return 0 again. The `> 0` guard
 * assertion in Part E is not decoration: it is the thing that turns this from a
 * check that can lie into one that fails loudly.
 *
 * Precision note: one `_selectRecords` is one HTTP request per PAGE. These
 * fixtures are far under Airtable's 100-record page, so operations and requests
 * coincide here; on a large table one select could paginate into several.
 */
function instrumentedOps() {
    const tableProto = Object.getPrototypeOf(base(TABLES.MATERIALS));
    const original = {
        select: tableProto._selectRecords,
        find: tableProto._findRecordById,
    };
    if (typeof original.select !== "function" || typeof original.find !== "function") {
        throw new Error(
            "verify-material-price-19: airtable's Table prototype no longer exposes " +
            "_selectRecords/_findRecordById — the query-budget instrument needs updating"
        );
    }
    const counts = { select: 0, find: 0 };

    tableProto._selectRecords = function (...args) {
        counts.select++;
        return original.select.apply(this, args);
    };
    tableProto._findRecordById = function (...args) {
        counts.find++;
        return original.find.apply(this, args);
    };

    return {
        counts,
        restore() {
            tableProto._selectRecords = original.select;
            tableProto._findRecordById = original.find;
        },
    };
}

async function countOps(fn) {
    const probe = instrumentedOps();
    try {
        const result = await fn();
        const total = probe.counts.select + probe.counts.find;
        return { result, total, ...probe.counts };
    } finally {
        probe.restore();
    }
}

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order, children before parents throughout.
const fixtures = createFixtures({
    tag: "V19",
    buckets: [
        // POs before PRs: a PO links its PR, so the other order leaves a dangling
        // link for as long as the loop takes. No tagField — a PO is written by
        // generatePOForApprovedPR and this script sets no text field on it, so its
        // residue check is a tracked-id re-read.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // Tagged, under the rule's second clause (#171): makePO below calls
        // createPR, so the tag is one argument away and declining it would give up
        // a check for nothing. Contrast the POs above, which really are out of
        // reach.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // FOUND BY TAG, NOT TRACKED. Every row here is written by PO generation as
        // a side effect (#18), and this script's only way of tracking them was to
        // look each one up afterwards — `getMaterialByKey(...)` guarded by
        // `if (material)`, twice, plus a loop that read each Material's price link
        // purely as bookkeeping. A lookup that came back empty left the row created
        // and untracked. The tag reaches both materials through `Item Name`, and
        // the prices hang off the Material's own link field rather than a text
        // match on `Price Label` — a formula over two links that need not begin
        // with the tag. Children-before-parents then gives the prices-before-
        // materials order this script's old comment had to ask for by hand.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Item Name",
            discoverByTag: true,
            // A completed run always writes at least one of these, so 0 means the
            // tag stopped reaching them rather than that none were created (#171).
            expectAtLeast: 1,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

// ---------------------------------------------------------------------------
console.log("\nPart A — fixtures: two vendors, one material, plus a withdrawn PO");

let complete = false;
const [users, vendors, lines, fixtureUser] = await Promise.all([
    getActiveUsers(),
    getAllVendors(),
    getAllLines(),
    getUserByEmail(FIXTURE_EMAIL),
]);

const admin = users.find((u) => u.isAdmin === true);
const [vendorA, vendorB] = vendors;
const line = lines[0];

if (!admin || !vendorA || !vendorB || !line) {
    incomplete = "need an Admin user, TWO Vendors and one Line in the base";
} else if (!fixtureUser) {
    incomplete = `${FIXTURE_EMAIL} is missing — it is the permanent non-Admin fixture this check needs`;
}

if (incomplete) {
    console.log(`  SKIP  ${incomplete}`);
} else {
  // EVERY FIXTURE THIS RUN CREATES IS DELETED BELOW, so an unexpected throw in
  // here must not skip that — and until #171 it did. The only `try` in this file
  // was the one inside countOps above, whose `finally` restores the instrument;
  // it never covered the body, and the cleanup began at line 370 of 392, which a
  // throw walks straight past. MEASURED on this file: a throw planted after the
  // first makePO left 6 rows across four tables and printed no id for any of
  // them, so recovering it meant querying by tag — and the PR and the PO were
  // reachable only through their tagged CHILDREN, since neither carried the tag
  // itself. A failing CHECK was always survivable, since check()/assert() only
  // lower `pass`; a THROW was not.
  try {
    // The gating half is only meaningful if the fixture user genuinely fails
    // canViewPR for these PRs. Assert the preconditions rather than assume them:
    // a fixture that had been given Admin, or assigned to this Job, would make
    // Part C pass for the wrong reason.
    check("the fixture user is not an Admin", fixtureUser.isAdmin === true, false);
    check("and not a President", fixtureUser.role, "Employee");
    const fixtureJobs = fixtureUser.assignedJobs || [];
    const lineJob = line.job?.[0];
    assert(
        `and not assigned to the fixture Line's Job (assigned to ${fixtureJobs.length})`,
        !lineJob || !fixtureJobs.includes(lineJob)
    );
    assert("the requester is someone else", admin.id !== fixtureUser.id);

    const NAME = `${TAG} Ball Valve`;
    const KEY = { itemName: NAME, size: '2"', unit: "EA" };

    async function makePO({ vendorId, qty, unitPrice, extraItem }) {
        const pr = await createPR({
            requesterId: admin.id, lineId: line.id, vendorId,
            notes: `${TAG} fixture`,
        });
        track("prs", pr.id);
        await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", itemName: NAME, size: '2"', unit: "EA", qty, unitPrice });
        if (extraItem) {
            await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", ...extraItem });
        }
        await updatePR(pr.id, { status: "Approved" });
        const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
        track("pos", gen.poRecordId);
        return gen;
    }

    // Vendor A: the cheaper price, at a DIFFERENT quantity — so the quantity
    // caveat is exercised too.
    const genA = await makePO({ vendorId: vendorA.id, qty: 100, unitPrice: 12 });
    // Vendor B: dearer, newer, smaller quantity.
    const genB = await makePO({
        vendorId: vendorB.id,
        qty: 10,
        unitPrice: 30,
        extraItem: { itemName: `${TAG} Gasket`, size: "", unit: "PCS", qty: 5, unitPrice: 2 },
    });
    // A third PO for the same material, then withdrawn: its ordered item must appear in
    // the history, marked, and must not count as ordered.
    const genC = await makePO({ vendorId: vendorA.id, qty: 999, unitPrice: 99 });
    await updatePO(genC.poRecordId, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });

    const material = await getMaterialByKey(KEY);
    assert("the material identity row exists", Boolean(material));

    if (material) {
        // -------------------------------------------------------------------
        console.log("\nPart B — search as an Admin (identifiers expected)");
        const adminSearch = await searchMaterialPrices({ user: admin, query: `${TAG} ball valve` });
        check("the query matches one material", adminSearch.materials.length, 1);

        const group = adminSearch.materials[0];
        check("both vendors appear as rows", group.rows.length, 2);

        const rowFor = (v) => group.rows.find((r) => r.vendorName === v.vendorName);
        // THE POINT OF THE FIXTURE: vendor A's most recent PO for this material is
        // the WITHDRAWN one, priced 99. upsertMaterialPrice runs at PO-generation
        // time, so that is the cached figure — and it is shown, with its status,
        // rather than hidden or rolled back to the earlier 12.
        check("vendor A's row carries its LATEST price, from the withdrawn PO", rowFor(vendorA)?.unitPrice, 99);
        check("and is labeled Withdrawn rather than dropped", rowFor(vendorA)?.poStatus, "Withdrawn");
        check("vendor B's row carries its own price", rowFor(vendorB)?.unitPrice, 30);
        check("labeled with its unsigned status", rowFor(vendorB)?.poStatus, "Awaiting Signature");

        // All three POs were generated today and `Created Date` is calendar-only,
        // so these rows genuinely tie on date — the vendor-name tie-break is what
        // real same-day data exercises. The date ORDERING itself is pinned in
        // scripts/tests/offline/material-price-view.mjs, where dates can be set
        // apart freely; here the claim is that real rows feed that rule correctly.
        check(
            "same-day rows fall back to vendor name, ascending",
            group.rows.map((r) => r.vendorName).join(" | "),
            [vendorA.vendorName, vendorB.vendorName].sort().join(" | ")
        );

        check("quantity is carried per row", rowFor(vendorA)?.qty, 999);
        check("and per the other vendor", rowFor(vendorB)?.qty, 10);
        check("the quantities differ, so the caveat applies", qtyDiffersAcross(group.rows), true);

        assert("every row has an identifiers object for an Admin", group.rows.every((r) => r.identifiers !== null));
        assert("and each names a PO ID", group.rows.every((r) => Boolean(r.identifiers.poId)));
        assert("and a PR ID", group.rows.every((r) => Boolean(r.identifiers.prId)));

        const lowest = lowestPriceRowIds(group.rows);
        check("exactly one row is marked lowest", lowest.size, 1);
        check("and it is the 30, not the 99", group.rows.find((r) => lowest.has(r.id))?.unitPrice, 30);

        // An EMPTY query is a browse, not an empty search: the screen lists
        // everything under the search bar before anything is typed. Asserted
        // against the search above rather than against a hard count, because the
        // demo fixtures in scripts/demo/ change how many rows exist.
        const browse = await searchMaterialPrices({ user: admin, query: "" });
        check("an empty query returns no tokens", browse.tokens.length, 0);
        assert(
            `and still lists materials (${browse.materials.length}) — it is a browse, not "no results"`,
            browse.materials.length > 0
        );
        assert(
            "including at least everything the narrow search found",
            browse.materials.length >= adminSearch.materials.length
        );
        assert(
            "and this fixture's material is among them",
            browse.materials.some((g) => g.material.id === material.id)
        );
        // Alphabetical by Material Label, sorted server-side so the cap takes a
        // stable first N rather than an arbitrary one.
        const labels = browse.materials.map((g) => g.material.materialLabel ?? "");
        check(
            "browse order is alphabetical by Material Label",
            labels.join("|"),
            [...labels].sort((a, b) => a.localeCompare(b)).join("|")
        );

        // -------------------------------------------------------------------
        console.log("\nPart C — the same search as the non-Admin fixture user");
        const fixtureSearch = await searchMaterialPrices({ user: fixtureUser, query: `${TAG} ball valve` });
        check("the material is still found", fixtureSearch.materials.length, 1);
        const fixtureGroup = fixtureSearch.materials[0];
        check("both vendor rows are still shown", fixtureGroup.rows.length, 2);

        // The open half: identical figures.
        check("prices are identical", fixtureGroup.rows.map((r) => r.unitPrice).join(","), group.rows.map((r) => r.unitPrice).join(","));
        check("vendors are identical", fixtureGroup.rows.map((r) => r.vendorName).join(","), group.rows.map((r) => r.vendorName).join(","));
        check("dates are identical", fixtureGroup.rows.map((r) => r.latestDate).join(","), group.rows.map((r) => r.latestDate).join(","));
        check("quantities are identical", fixtureGroup.rows.map((r) => r.qty).join(","), group.rows.map((r) => r.qty).join(","));
        check("PO statuses are identical", fixtureGroup.rows.map((r) => r.poStatus).join(","), group.rows.map((r) => r.poStatus).join(","));

        // The gated half: nothing.
        assert("NO row carries identifiers", fixtureGroup.rows.every((r) => r.identifiers === null));
        // Belt and braces: no PO ID string anywhere in the payload, however it
        // might have leaked — a stray ungated field would show up here.
        const serialized = JSON.stringify(fixtureSearch);
        assert(
            "and no PO ID appears anywhere in the returned payload",
            !/HYE-PO-\d{8}-\d{2}/.test(serialized)
        );
        assert("nor any PR ID", !/HYE-PR-\d{6}-\d{2}/.test(serialized));

        // -------------------------------------------------------------------
        console.log("\nPart D — purchase history");
        const adminHistory = await getMaterialPurchaseHistory({ user: admin, materialRecordId: material.id });
        check("all three PO lines are listed", adminHistory.rows.length, 3);
        assert("newest first", (adminHistory.rows[0].date || "") >= (adminHistory.rows[2].date || ""));

        const withdrawnRow = adminHistory.rows.find((r) => r.poStatus === "Withdrawn");
        assert("the withdrawn PO's line is INCLUDED, not filtered out", Boolean(withdrawnRow));
        if (withdrawnRow) {
            check("it still shows the quantity that was ordered", withdrawnRow.qty, 999);
            // #18's Committed Qty is the judgment; nothing here parses a status.
            check("but it does not count as ordered", countsAsOrdered(withdrawnRow), false);
        }
        const liveRow = adminHistory.rows.find((r) => r.poStatus === "Signed" || r.poStatus === "Awaiting Signature");
        if (liveRow) check("a live line does count as ordered", countsAsOrdered(liveRow), true);

        const fixtureHistory = await getMaterialPurchaseHistory({ user: fixtureUser, materialRecordId: material.id });
        check("the fixture user sees the same number of lines", fixtureHistory.rows.length, 3);
        check("with the same prices", fixtureHistory.rows.map((r) => r.unitPrice).sort().join(","), adminHistory.rows.map((r) => r.unitPrice).sort().join(","));
        assert("but no identifiers on any line", fixtureHistory.rows.every((r) => r.identifiers === null));
        assert(
            "and no PO ID anywhere in that payload either",
            !/HYE-PO-\d{8}-\d{2}/.test(JSON.stringify(fixtureHistory))
        );

        // A bad record id reads as not-found rather than throwing.
        check("an unknown material id returns null", await getMaterialPurchaseHistory({ user: admin, materialRecordId: "recDoesNotExist99" }), null);

        // -------------------------------------------------------------------
        console.log("\nPart E — the query budget does not grow with the rows");
        // One material vs two: if anything were per-row, the second would cost
        // more queries. TAG matches both fixtures' materials.
        const one = await countOps(() => searchMaterialPrices({ user: admin, query: `${TAG} ball valve` }));
        const two = await countOps(() => searchMaterialPrices({ user: admin, query: TAG }));
        const oneRows = one.result.materials.reduce((n, g) => n + g.rows.length, 0);
        const twoRows = two.result.materials.reduce((n, g) => n + g.rows.length, 0);
        console.log(`  ${one.result.materials.length} material / ${oneRows} vendor rows: ${one.total} ops (${one.select} select, ${one.find} find)`);
        console.log(`  ${two.result.materials.length} materials / ${twoRows} vendor rows: ${two.total} ops (${two.select} select, ${two.find} find)`);

        // The instrument has to be able to see something, or the comparison below
        // is the vacuous 0 === 0 the first version of this check produced.
        assert(`the instrument observed real operations (${one.total} > 0)`, one.total > 0);
        assert(`the second query really is bigger (${twoRows} rows vs ${oneRows})`, twoRows > oneRows);
        assert(
            `more materials and more rows cost the same number of operations (${one.total} vs ${two.total})`,
            one.total === two.total
        );
        assert(`and it is a small constant, not per-row (${two.total} for ${twoRows} rows)`, two.total <= 10);
        // No .find() at all: every level is a batched select, so nothing is
        // fetched one record at a time.
        check("no per-record find() on the search path", two.find, 0);

        const hist = await countOps(() => getMaterialPurchaseHistory({ user: admin, materialRecordId: material.id }));
        console.log(`  history over ${hist.result.rows.length} lines: ${hist.total} ops (${hist.select} select, ${hist.find} find)`);
        assert(`the instrument observed real operations (${hist.total} > 0)`, hist.total > 0);
        assert(`history is a small constant too (${hist.total} for ${hist.result.rows.length} lines)`, hist.total <= 10);
        // One find(): the material itself, by record id. Everything else batches.
        check("exactly one per-record find() — the material", hist.find, 1);
    }
    complete = true;
  } catch (err) {
    // `pass`, not `incomplete`: an abort here is a check that did not get to run,
    // which is not the same as one that ran and passed. The cleanup below still
    // runs either way, which is the whole point of the block.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
  }
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(60));
// TWO VERDICTS, TWO SENTENCES (#171). `pass` is about the price screens; a leak
// is about this run's effect on a shared base. Until now the cleanup reported per
// record — and swallowed a failed child delete on its way to deleting the parent
// — while reaching no verdict at all, so a run that left rows behind would still
// have printed ALL CHECKS PASS had it got as far as its own cleanup.
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
