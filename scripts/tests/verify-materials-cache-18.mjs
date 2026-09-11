// Materials identity + Material Prices + the item axis — credentialed (#18).
//
// The schema this covers has two axes on purpose: price is per vendor
// (Material Prices), while identity and quantity aggregate across vendors
// (Materials). So the central claims are about which table gets which row.
//
// Parts:
//   0 — the pure grouping/skip rules, no DB.
//   A — identity: one natural key keeps one row; the first spelling is kept.
//   B — price: one material, two vendors, two price rows.
//   C — withKeyLock serializes, on both of its two distinct keys.
//   D — the production path: every ordered item linked, dedupe on price only.
//   E — Airtable's own judgment fields, which NOTHING has ever observed with
//       real values: Committed/Signed Qty across all three PO statuses (the
//       `& ""` lookup-to-text coercion), the three Materials rollups, and
//       Uninvoiced Qty.
//   F — invoiced qty: the rollup the JS duplication was merged onto, its
//       immediacy re-measured, and the negative remainder preserved.
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-materials-cache-18.mjs
//
// Fixtures: creates Materials, Material Prices, 3 PRs + PR Items, 3 POs + PO
// Items, 1 Invoice + Invoice Items + its join row, and deletes all of them in
// this same run through scripts/tests/_fixtures.mjs (#171). Creates nothing in
// Vercel Blob. Reuses (never modifies, never deletes) two existing Vendors and
// one existing Line.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base,
// 2 clean but incomplete.

import { upsertMaterial, getMaterialByKey, getMaterialByRecordId } from "../../lib/airtable/materials.js";
import { upsertMaterialPrice, getMaterialPrice } from "../../lib/airtable/materialPrices.js";
import { collectMaterialsCacheEntries } from "../../lib/materialsCache.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { resolveVerifyCategories } from "./_categories.mjs";
import {
    getItemsByPO,
    getInvoicingStatusByPO,
    getInvoicedQtyForPOItem,
} from "../../lib/airtable/poItems.js";
import { updatePO, getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { createInvoice, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import { createInvoiceItem } from "../../lib/airtable/invoiceItems.js";
import { uninvoicedQty, hasUninvoicedItems } from "../../lib/poItemQty.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllDisciplines } from "../../lib/airtable/disciplines.js";
import { base, TABLES, _debugLockKeys } from "../../lib/airtable/client.js";
import { formulaString } from "../../lib/airtableFormula.js";
import { createFixtures } from "./_fixtures.mjs";

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
 * Poll until a computed field settles. Airtable computes rollups/lookups/
 * formulas server-side, so "did it recompute" is a measurement, not an
 * assumption — and a value read too early would make a passing check
 * meaningless.
 *
 * Reports `reads` as well as `ms`, because ms alone is ambiguous: elapsed time
 * includes the reads themselves, so "279ms" could mean one round trip with the
 * value already correct, or two polls of a value that was briefly wrong. Only
 * reads === 1 says the field was already settled before anything looked.
 */
async function waitFor(read, predicate, { ceilingMs = 15000, pollMs = 200 } = {}) {
    const t0 = Date.now();
    let reads = 1;
    let value = await read();
    while (!predicate(value) && Date.now() - t0 < ceilingMs) {
        await new Promise((r) => setTimeout(r, pollMs));
        value = await read();
        reads++;
    }
    return { value, ms: Date.now() - t0, reads, settled: predicate(value) };
}

/** Label suffix that makes a settle measurement unambiguous. */
const settleNote = (w) => `${w.reads === 1 ? "already settled on the first read" : `settled after ${w.reads} reads`}, ${w.ms}ms`;

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order, children before parents throughout.
const fixtures = createFixtures({
    tag: "V18",
    buckets: [
        // Frozen `Item Name` copied from the tagged ordered item, so the tag reaches
        // every row. Deleted before the Invoice, which also lists them as
        // children — by then that link is empty, and the pair is deliberate: the
        // tracked ids get a tag-query residue check of their own, and anything
        // untracked is still swept as a discovered child.
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item", tagField: "Item Name" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable: an Invoice-PO Link row's primary field is an
                // autoNumber and it carries no text at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        // No tagField: written by generatePOForApprovedPR, and this script sets
        // no text field on it. Tracked, so a tracked-id re-read is the residue
        // check. This is the case where declining IS right — contrast the PRs
        // below, which this script creates itself.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // Tagged, under the rule's second clause (#171): this script calls
        // createPR, so `notes` is one argument away and declining the tag would
        // give up a check for nothing.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // FOUND BY TAG, NOT TRACKED, and that replaces the shape commit 3 removed
        // from verify-deliveries-162.mjs for the same reason. Half of these rows
        // are written by PO generation as a side effect (#18) and this script
        // looked each one up right afterwards — `getMaterialByKey(...)` guarded by
        // `if (matX)`, five times over — so a lookup that came back empty left the
        // row created and untracked, leaked with nothing saying so. Every row here
        // carries the tag in `Item Name` whether upsertMaterial or the cache wrote
        // it, so one query covers both halves and depends on neither lookup.
        // Prices hang off the Material's own link field rather than a text match
        // on `Price Label`, a formula over two links that need not begin with the
        // tag, and children-before-parents then gives the prices-before-materials
        // order this script's old comment had to ask for by hand.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            // #356 — `Item Name` IS THE CATEGORY'S PATH NOW, through a lookup, so
            // no run can put its tag there. The paragraph above is about one
            // lookup coming back empty and leaving one row untracked; this would
            // do it to every row of every run, and `expectAtLeast` below is the
            // only thing that would say so. `Size` is the one writable free-text
            // field identity still has, so the tag moved to it and every fixture
            // key below prefixes its size with the tag.
            tagField: "Size",
            discoverByTag: true,
            // A completed run always writes at least one of these, so 0 means the
            // tag stopped reaching them rather than that none were created (#171).
            expectAtLeast: 1,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
// #356 — two categories, so a run can show both that one category is one
// material and that two are two. Every fixture SIZE is TAG-prefixed, which is
// what `discoverByTag` cleans up on now that `Item Name` is the catalog's.
const [CATEGORY, EXTRA_CATEGORY] = await resolveVerifyCategories();
const track = fixtures.track;

/**
 * Rows matching one Materials natural key — the duplicate detector.
 *
 * WRITTEN OUT HERE RATHER THAN CALLING `getMaterialByKey`, which is the whole
 * point of it: the production reader caps at one row, and what this asks is
 * whether there are TWO. It follows #356's key — the leaf code exactly, Size and
 * Unit case-insensitively — so a divergence between this and the reader would be
 * a divergence between two implementations of one rule, which is exactly what
 * the run would then be measuring.
 */
async function countMaterialRows({ categoryCode, size, unit }) {
    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND(
                {Category Code} & "" = "${formulaString(categoryCode)}",
                LOWER(TRIM({Size})) = LOWER(TRIM("${formulaString(size)}")),
                LOWER(TRIM({Unit})) = LOWER(TRIM("${formulaString(unit)}"))
            )`,
        })
        .all();
    return records.length;
}

/** Price rows for one material, however many vendors. */
async function countPriceRows(materialRecordId) {
    const records = await base(TABLES.MATERIAL_PRICES)
        .select({ filterByFormula: `{Material Record ID} = "${formulaString(materialRecordId)}"` })
        .all();
    return records.length;
}

// ---------------------------------------------------------------------------
console.log("\nPart 0 — collectMaterialsCacheEntries (grouping + skips, no DB):");
{
    // #356 — the grouping key is `lib/materialIdentity.js`'s now, so an ordered
    // item arrives with the `Category` link `lib/poGeneration.js` carried over
    // from its request item, and the leaf codes come from the map
    // `refreshMaterialsCacheForPO` reads in one batched query. The rule itself is
    // `offline/material-identity.mjs`'s; what is checked here is the grouping and
    // the skips built on top of it.
    const cats = new Map([
        ["catPipe", { recordId: "catPipe", label: "A > Pipe", codes: ["A", "A1", "A11", "0101001001"] }],
        ["catElbow", { recordId: "catElbow", label: "A > Elbow", codes: ["A", "A1", "A12", "0101002001"] }],
    ]);
    const withCats = (rows) => collectMaterialsCacheEntries(rows, { categoryByRecordId: cats });

    const grouped = withCats([
        { id: "recA", poItemId: "P-001", itemName: "Pipe", categoryRecordId: "catPipe", size: '2"', unit: "EA", unitPrice: 10 },
        { id: "recB", poItemId: "P-002", itemName: "Pipe", categoryRecordId: "catPipe", size: '2"', unit: "EA", unitPrice: 25 },
    ]);
    check("two lines of one material make ONE price entry", grouped.entries.length, 1);
    check("the LAST line's price is the one cached", grouped.entries[0].item.unitPrice, 25);
    check("and the entry carries the category the key was built from", grouped.entries[0].categoryCode, "0101001001");
    // The correctness point the dedupe must not break: Materials' rollups sum
    // over Materials."PO Items", so an ordered item left unlinked is invisible on the
    // item axis. Both ordered items must be linked even though only one price wins.
    check("but BOTH lines are kept for linking", grouped.entries[0].poItemIds.join(","), "recA,recB");

    check(
        "Size case/whitespace variants are one key",
        withCats([
            { id: "r1", itemName: "x", categoryRecordId: "catPipe", size: ' 2  in ', unit: "EA", unitPrice: 1 },
            { id: "r2", itemName: "x", categoryRecordId: "catPipe", size: "2 IN", unit: "EA", unitPrice: 2 },
        ]).entries.length,
        1
    );
    // ANTI-VACUITY for the line above: a grouping that always grouped would pass
    // it. Two categories on one size and unit are two entries.
    check(
        "two categories are two keys",
        withCats([
            { id: "r1", itemName: "x", categoryRecordId: "catPipe", size: "2in", unit: "EA", unitPrice: 1 },
            { id: "r2", itemName: "y", categoryRecordId: "catElbow", size: "2in", unit: "EA", unitPrice: 2 },
        ]).entries.length,
        2
    );

    const skips = withCats([
        { id: "s1", poItemId: "P-1", itemName: "No category", unit: "EA", unitPrice: 10 },
        { id: "s0", poItemId: "P-0", itemName: "Stale category", categoryRecordId: "catGone", unit: "EA", unitPrice: 10 },
        { id: "s2", poItemId: "P-2", itemName: "No unit", categoryRecordId: "catPipe", unit: "", unitPrice: 10 },
        { id: "s3", poItemId: "P-3", itemName: "No price", categoryRecordId: "catPipe", unit: "EA", unitPrice: undefined },
        { id: "s4", poItemId: "P-4", itemName: "Zero qty is fine", categoryRecordId: "catPipe", unit: "EA", qty: 0, unitPrice: 5 },
    ]);
    // #356 replaced the `no Item Name` skip: a name is a lookup through the
    // category now, so a row with a category and a blank frozen name is a
    // perfectly good material and a row with a name and no category is the one
    // with no identity to create.
    check("a category-less line is skipped", skips.skipped.filter((s) => s.reason === "no Category").length, 1);
    check("so is one whose category the catalog no longer has", skips.skipped.filter((s) => s.reason === "Category not in the catalog").length, 1);
    check("a UNIT-LESS line is skipped (#18)", skips.skipped.filter((s) => s.reason === "no Unit").length, 1);
    check("a priceless line is skipped", skips.skipped.filter((s) => s.reason === "no numeric Unit Price").length, 1);
    check("only the valid line remains", skips.entries.length, 1);
    check("and every skip names its PO Item", skips.skipped.every((s) => Boolean(s.poItemId)), true);

    check('a double quote is escaped for the formula', formulaString('2"'), '2\\"');
    check("a backslash is escaped first", formulaString("a\\b"), "a\\\\b");
}

let complete = false;
// ---------------------------------------------------------------------------
const [users, vendors, disciplines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllDisciplines()]);
const requester = users[0];
const [vendorA, vendorB] = vendors;
const discipline = disciplines[0];

if (!requester || !vendorA || !vendorB || !discipline) {
    incomplete = "need one active User, TWO Vendors and one Line in the base";
    console.log(`\n  SKIP  ${incomplete}`);
} else {
  // EVERY FIXTURE THIS RUN CREATES IS DELETED BELOW, so an unexpected throw in
  // here must not skip that — and until #171 it did. There was no `try` around
  // this body at all: the only one in the file is the six lines in Part A that
  // capture an expected error, and the cleanup began at line 422 of 450, which a
  // throw walks straight past. MEASURED ON THIS FILE rather than argued — a
  // throw planted immediately after the first upsertMaterial printed a stack
  // trace, no cleanup section, no verdict of any kind, and left the Material on
  // the base. A failing CHECK was always survivable, since check()/assert() only
  // lower `pass`; a THROW was not. The cleanup sits outside this block precisely
  // so it always runs.
  try {
    console.log(`\nFixture context: vendors "${vendorA.vendorName}" / "${vendorB.vendorName}", discipline "${discipline.disciplineLabel}" (reused, not modified)`);

    // -----------------------------------------------------------------------
    console.log("\nPart A — Materials identity: one natural key, one row:");
    // #356 — THE KEY IS THE CATEGORY, SIZE AND UNIT, and the case-insensitivity
    // this part used to prove about the NAME is gone with the field: a name is
    // not typed any more, so there are no two spellings of one to reconcile. The
    // fold moved wholesale onto `Size`, which is still free text, and the checks
    // below are the old ones re-aimed at it rather than new claims.
    const keyA = {
        categoryRecordId: CATEGORY.recordId,
        categoryCode: CATEGORY.codes[3],
        size: `${TAG} 2"`,
        unit: "EA",
    };
    const lookupA = { categoryCode: keyA.categoryCode, size: keyA.size, unit: keyA.unit };

    const m1 = await upsertMaterial(keyA);
    check("the category it was created with", m1.category?.[0], CATEGORY.recordId);
    check('a Size containing a double quote is found again by its key', (await getMaterialByKey(lookupA))?.id, m1.id);

    const m2 = await upsertMaterial(keyA);
    check("a second call returns the same row", m2.id, m1.id);
    check("exactly one row for that key", await countMaterialRows(lookupA), 1);

    // Case-insensitive lookup on the axis that still has two spellings.
    const m3 = await upsertMaterial({ ...keyA, size: keyA.size.toUpperCase() });
    check("an all-caps Size matches the same row", m3.id, m1.id);
    check("and the stored Size is still the FIRST spelling", m3.size, keyA.size);
    check("still one row", await countMaterialRows(lookupA), 1);

    // Internal whitespace is normalized by upsertMaterial itself, so a sloppy
    // value cannot create a second row.
    const m4 = await upsertMaterial({ ...keyA, size: `  ${keyA.size.replace(" ", "   ")}  ` });
    check("a whitespace-variant Size matches too", m4.id, m1.id);

    // A DIFFERENT CATEGORY IS A DIFFERENT MATERIAL, which is the half of the key
    // the checks above cannot show: every one of them is an equality, and a
    // find-or-create that always found would pass all four.
    const keyOther = { ...keyA, categoryRecordId: EXTRA_CATEGORY.recordId, categoryCode: EXTRA_CATEGORY.codes[3] };
    const mOther = await upsertMaterial(keyOther);
    assert("a second category on the same Size and Unit is a second row", mOther.id !== m1.id);
    check("and the first key still finds exactly one", await countMaterialRows(lookupA), 1);

    // NO CATEGORY IS A THROW, not a nameless row (#356). `Item Name` is a lookup
    // through this link, so a row without one has no name and a `Material Label`
    // of `_Size_Unit` — worse than not existing. lib/materialsCache.js skips such
    // an ordered item and reports it before reaching here.
    let noCategoryErr = null;
    try {
        await upsertMaterial({ size: `${TAG} orphan`, unit: "EA" });
    } catch (err) {
        noCategoryErr = err.message;
    }
    assert("upsertMaterial refuses a key with no category", Boolean(noCategoryErr));
    assert(
        `  and the message says what is missing — ${noCategoryErr ?? "(it did not throw)"}`,
        Boolean(noCategoryErr?.includes("category"))
    );

    // Unit-less identity still works (the omit-not-"" rule). lib/materialsCache.js
    // skips these, but the function stays correct.
    const keyNoUnit = {
        categoryRecordId: CATEGORY.recordId,
        categoryCode: CATEGORY.codes[3],
        size: `${TAG} No unit`,
        unit: "",
    };
    const lookupNoUnit = { categoryCode: keyNoUnit.categoryCode, size: keyNoUnit.size, unit: "" };
    let noUnitErr = null;
    let mNoUnit = null;
    try {
        mNoUnit = await upsertMaterial(keyNoUnit);
    } catch (err) {
        noUnitErr = err.message;
    }
    assert(`a unit-less identity row is accepted${noUnitErr ? ` — ${noUnitErr}` : ""}`, !noUnitErr);
    if (mNoUnit) {
        check("its Unit is genuinely unset, not \"\"", mNoUnit.unit ?? null, null);
        check("and it is findable by its key", (await getMaterialByKey(lookupNoUnit))?.id, mNoUnit.id);
        check("one row for the unit-less key", await countMaterialRows(lookupNoUnit), 1);
    }

    // -----------------------------------------------------------------------
    // THE NAME COMES FROM THE BASE NOW, AND ONLY A CREDENTIALED RUN CAN SEE IT.
    // `Item Name` and `Category Code` are lookups and `Material Label` a formula
    // over one of them, so all three are Airtable's answers rather than this
    // repository's — `docs/notes/verification.md`'s third tier exactly. The
    // bracket check is the one that matters: a single-element lookup
    // concatenates BARE in string context on this base (measured on
    // `PO Items."PO Status"`, which Part E below re-measures), and if that ever
    // stopped being true every `Material Label` would read `["…"]_2"_EA` and the
    // formula would need ARRAYJOIN. Re-read rather than taken off the create,
    // because a lookup is computed and the create returns before it is filled.
    console.log("\nPart A2 — the name is the catalog's, computed by the base:");
    const settledName = await waitFor(
        () => getMaterialByRecordId(m1.id),
        (m) => Boolean(m.itemName)
    );
    // `.value`, because waitFor returns { value, ms, reads, settled } — the shape
    // every other call site in this file already reads. Getting it wrong made all
    // three checks below compare `undefined`, and the bracket assertion below
    // PASSED on it, which is the same vacuity a mutation caught one tier down.
    const named = settledName.value;
    check(`Item Name is the category's own label (${settleNote(settledName)})`, named.itemName, CATEGORY.label);
    check("Category Code is its leaf code", named.categoryCode, CATEGORY.codes[3]);
    check(
        "Material Label composes the three",
        named.materialLabel,
        `${CATEGORY.label}_${keyA.size}_EA`
    );
    // ASSERTED ON A NON-EMPTY STRING FIRST, so "no brackets" cannot be satisfied
    // by there being no label at all.
    assert(
        `and the label is a non-empty string — ${JSON.stringify(named.materialLabel)}`,
        typeof named.materialLabel === "string" && named.materialLabel.length > 0
    );
    assert(
        "  rendering the lookup bare, with no array brackets and no quotes",
        typeof named.materialLabel === "string" &&
            !named.materialLabel.includes("[") &&
            !named.materialLabel.includes('"' + CATEGORY.label)
    );

    // -----------------------------------------------------------------------
    console.log("\nPart B — Material Prices: one material, two vendors:");
    const pA = await upsertMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorA.id, unitPrice: 30, latestDate: "2026-07-01" });
    const pB = await upsertMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorB.id, unitPrice: 41, latestDate: "2026-07-02" });

    assert("the two vendors get two DIFFERENT price rows", pA.id !== pB.id);
    check("still exactly one Materials row", await countMaterialRows(lookupA), 1);
    check("and two price rows for it", await countPriceRows(m1.id), 2);
    check("vendor A's price", pA.unitPrice, 30);
    check("vendor B's price", pB.unitPrice, 41);

    const pA2 = await upsertMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorA.id, unitPrice: 33, latestDate: "2026-07-03" });
    check("re-upserting vendor A updates in place", pA2.id, pA.id);
    check("with the new price", pA2.unitPrice, 33);
    check("vendor B is untouched", (await getMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorB.id })).unitPrice, 41);
    check("still two price rows", await countPriceRows(m1.id), 2);

    // -----------------------------------------------------------------------
    console.log("\nPart C — withKeyLock serializes, on both of its keys:");
    // NOTE on the `_debugLockKeys().length === 1` assertions below: that is a
    // PROCESS-GLOBAL count, not this material's lock. It holds because this
    // script is the only thing holding a lock while it runs, and it would break
    // if these checks ever ran alongside anything else concurrent — it would be
    // counting the other caller's key too. Read it as "exactly one lock exists
    // right now", not as "the lock for this key exists".

    // Identity lock: three concurrent calls on a fresh key. Without the lock
    // each reads "nothing yet" and each creates a row.
    const keyRace = {
        categoryRecordId: CATEGORY.recordId,
        categoryCode: CATEGORY.codes[3],
        size: `${TAG} Race 1/2`,
        unit: "FT",
    };
    const lookupRace = { categoryCode: keyRace.categoryCode, size: keyRace.size, unit: keyRace.unit };
    const racing = Promise.all([1, 2, 3].map(() => upsertMaterial(keyRace)));
    check("one lock key is queued while the three identity calls fly", _debugLockKeys().length, 1);
    const raced = await racing;
    check("all three resolved to ONE record", new Set(raced.map((r) => r.id)).size, 1);
    check("and Airtable holds one row", await countMaterialRows(lookupRace), 1);

    // Price lock: same shape, different key namespace.
    const racingPrice = Promise.all(
        [7, 8, 9].map((p) => upsertMaterialPrice({ materialRecordId: raced[0].id, vendorRecordId: vendorA.id, unitPrice: p, latestDate: "2026-07-01" }))
    );
    check("one lock key is queued while the three price calls fly", _debugLockKeys().length, 1);
    const racedPrices = await racingPrice;
    check("all three resolved to ONE price row", new Set(racedPrices.map((r) => r.id)).size, 1);
    check("and one price row exists", await countPriceRows(raced[0].id), 1);
    check("the lock queue drains with no leaked entry", _debugLockKeys().length, 0);

    // -----------------------------------------------------------------------
    console.log("\nPart D — the production path: generatePOForApprovedPR:");

    // Vendor A. Item X twice (dedupe + both linked), one unit-less ordered item
    // (skipped), one other material.
    const pr1 = await createPR({
        requesterId: requester.id, disciplineId: discipline.id, vendorId: vendorA.id,
        notes: `${TAG} vendor A`,
    });
    track("prs", pr1.id);
    const nameX = `${TAG} Flange`;
    const sizeX = `${TAG} 4"`;
    // #356 — EVERY FIXTURE SIZE CARRIES THE TAG, and that is cleanup rather than
    // style: `Item Name` is a lookup now, so `discoverByTag` matches on `Size`,
    // and a fixture material with an untagged size is one this run cannot find
    // to delete. The blank-Size case this list used to carry (the gasket at
    // `size: ""`) went for exactly that reason — it is `offline/
    // material-identity.mjs`'s claim now, where no row has to be cleaned up.
    for (const it of [
        { itemName: nameX, categoryRecordId: CATEGORY.recordId, size: sizeX, unit: "EA", qty: 10, unitPrice: 30 },
        { itemName: nameX, categoryRecordId: CATEGORY.recordId, size: sizeX, unit: "EA", qty: 5, unitPrice: 44 },
        // A CATEGORY BUT NO UNIT, so the skip below is about the unit and about
        // nothing else. Without one it would be skipped for two reasons at once
        // and the check would not say which.
        { itemName: `${TAG} Unitless`, categoryRecordId: CATEGORY.recordId, size: `${TAG} unitless`, unit: "", qty: 1, unitPrice: 9 },
        { itemName: `${TAG} Gasket`, categoryRecordId: EXTRA_CATEGORY.recordId, size: `${TAG} gasket`, unit: "PCS", qty: 4, unitPrice: 2 },
    ]) {
        await createItem({ prRecordId: pr1.id, prId: pr1.prId, remark: "", ...it });
    }
    await updatePR(pr1.id, { status: "Approved" });
    const gen1 = await generatePOForApprovedPR(await getPRByRecordId(pr1.id));
    track("pos", gen1.poRecordId);
    const po1Items = await getItemsByPO(gen1.poRecordId);
    check("the PO snapshot has all four lines", po1Items.length, 4);

    const keyX = { categoryCode: CATEGORY.codes[3], size: sizeX, unit: "EA" };
    const matX = await getMaterialByKey(keyX);
    assert("an identity row exists for the repeated material", Boolean(matX));
    check("ONE row despite two PO lines", await countMaterialRows(keyX), 1);

    const priceX = matX && (await getMaterialPrice({ materialRecordId: matX.id, vendorRecordId: vendorA.id }));
    assert("a price row exists for this vendor", Boolean(priceX));
    if (priceX) {
        check("the cached price is the LAST line's", priceX.unitPrice, 44);
        assert("Latest PO points at the PO just generated", priceX.latestPO.includes(gen1.poRecordId));
        check("Latest Date is the PO's Created Date", priceX.latestDate, (await base(TABLES.PURCHASE_ORDERS).find(gen1.poRecordId)).get("Created Date"));
    }

    const xItems = po1Items.filter((i) => i.itemName === nameX);
    check("both PO lines of that material carry the Material link", xItems.filter((i) => i.material.includes(matX?.id)).length, 2);
    const unitless = po1Items.find((i) => i.itemName.endsWith("Unitless"));
    check("the unit-less line is NOT linked (skipped)", unitless.material.length, 0);
    check("and no identity row was created for it", await countMaterialRows({ categoryCode: CATEGORY.codes[3], size: `${TAG} unitless`, unit: "" }), 0);

    // The reverse side of the link, which is what the rollups traverse.
    const matXFresh = await getMaterialByRecordId(matX.id);
    check("Materials.PO Items shows both lines (reverse link)", matXFresh.poItems.length, 2);

    const gasket = await getMaterialByKey({ categoryCode: EXTRA_CATEGORY.codes[3], size: `${TAG} gasket`, unit: "PCS" });
    assert("a second category on the same order gets its own material", Boolean(gasket));
    assert("and it is a different row from the repeated one", gasket?.id !== matX?.id);

    // Vendor B buys the same material: one identity, a second price.
    const pr2 = await createPR({
        requesterId: requester.id, disciplineId: discipline.id, vendorId: vendorB.id,
        notes: `${TAG} vendor B`,
    });
    track("prs", pr2.id);
    await createItem({ prRecordId: pr2.id, prId: pr2.prId, remark: "", itemName: nameX, categoryRecordId: CATEGORY.recordId, size: sizeX, unit: "EA", qty: 7, unitPrice: 51 });
    await updatePR(pr2.id, { status: "Approved" });
    const gen2 = await generatePOForApprovedPR(await getPRByRecordId(pr2.id));
    track("pos", gen2.poRecordId);

    check("a second vendor adds NO Materials row", await countMaterialRows(keyX), 1);
    check("but a second price row", await countPriceRows(matX.id), 2);
    const priceXB = await getMaterialPrice({ materialRecordId: matX.id, vendorRecordId: vendorB.id });
    check("vendor B's price is its own", priceXB.unitPrice, 51);
    check("vendor A's price is unchanged by it", (await getMaterialPrice({ materialRecordId: matX.id, vendorRecordId: vendorA.id })).unitPrice, 44);

    // -----------------------------------------------------------------------
    console.log("\nPart E — Airtable's own judgment fields, on real values:");
    // PO1 stays Awaiting Signature. PO2 -> Signed. PO3 -> Withdrawn.
    // These three exercise the `& ""` coercion in PO Items.Committed/Signed Qty,
    // which had never been observed with a value: if coercing the PO Status
    // LOOKUP (an array) to text silently produced "", a withdrawn PO's qty would
    // be counted as ordered.
    await updatePO(gen2.poRecordId, { status: "Signed", presidentSigned: true, presidentSignedAt: new Date().toISOString() });

    const pr3 = await createPR({
        requesterId: requester.id, disciplineId: discipline.id, vendorId: vendorA.id,
        notes: `${TAG} withdrawn`,
    });
    track("prs", pr3.id);
    await createItem({ prRecordId: pr3.id, prId: pr3.prId, remark: "", itemName: nameX, categoryRecordId: CATEGORY.recordId, size: sizeX, unit: "EA", qty: 100, unitPrice: 60 });
    await updatePR(pr3.id, { status: "Approved" });
    const gen3 = await generatePOForApprovedPR(await getPRByRecordId(pr3.id));
    track("pos", gen3.poRecordId);
    await updatePO(gen3.poRecordId, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });

    const poItemOf = async (poRecordId) => (await base(TABLES.PO_ITEMS).find((await base(TABLES.PURCHASE_ORDERS).find(poRecordId)).get("PO Items")[0]));

    const awaiting = await waitFor(() => poItemOf(gen1.poRecordId), (r) => r.get("Committed Qty") === 10);
    check(`Awaiting Signature: Committed Qty = Qty (${settleNote(awaiting)})`, awaiting.value.get("Committed Qty"), 10);
    check("Awaiting Signature: Signed Qty = 0", awaiting.value.get("Signed Qty") || 0, 0);

    const signed = await waitFor(() => poItemOf(gen2.poRecordId), (r) => r.get("Signed Qty") === 7);
    check(`Signed: Signed Qty = Qty (${settleNote(signed)})`, signed.value.get("Signed Qty"), 7);
    check("Signed: Committed Qty = Qty too", signed.value.get("Committed Qty"), 7);

    const withdrawn = await waitFor(() => poItemOf(gen3.poRecordId), (r) => (r.get("Committed Qty") || 0) === 0);
    check(`Withdrawn: Committed Qty = 0, NOT the ordered item's 100 (${settleNote(withdrawn)})`, withdrawn.value.get("Committed Qty") || 0, 0);
    check("Withdrawn: Signed Qty = 0", withdrawn.value.get("Signed Qty") || 0, 0);
    check("the lookup really coerced to text (else this would be the qty)", withdrawn.value.get("Committed Qty") || 0, 0);
    check("PO Status lookup reads as the status", (withdrawn.value.get("PO Status") || []).join(","), "Withdrawn");

    // Materials rollups: 10 + 5 (PO1, awaiting) + 7 (PO2, signed) + 0 (PO3,
    // withdrawn) = 22 committed, of which 7 signed.
    const rolled = await waitFor(() => getMaterialByRecordId(matX.id), (m) => m.committedQty === 22);
    check(`Materials.Committed Qty sums the non-withdrawn lines (${settleNote(rolled)})`, rolled.value.committedQty, 22);
    check("Materials.Signed Qty is the signed subset", rolled.value.signedQty, 7);
    check("Materials.Invoiced Qty is 0 before any invoice", rolled.value.invoicedQty || 0, 0);
    check("Uninvoiced Qty = Committed - Invoiced", rolled.value.uninvoicedQty, 22);

    // -----------------------------------------------------------------------
    console.log("\nPart F — invoiced qty: the merged rollup:");
    const invoice = await createInvoice({
        vendorId: vendorA.id, vendorInvoiceCode: `${TAG}-INV`,
        issueDate: "2026-07-29", dueDate: "2026-08-29", amountDue: 90, shippingFee: 0,
    });
    track("invoices", invoice.id);
    await linkInvoiceToPO(invoice.id, gen1.poRecordId);

    const targetOrderedItem = xItems[0]; // qty 10
    const ii = await createInvoiceItem({
        invoiceRecordId: invoice.id, invoiceId: invoice.invoiceId,
        poRecordId: gen1.poRecordId, poItemRecordId: targetOrderedItem.id,
        itemName: nameX, size: sizeX, unit: "EA", qty: 3, unitPrice: 30, remark: "",
    });
    track("invoiceItems", ii.id);

    // The merge's premise, re-measured every run rather than trusted: the
    // rollup must be correct on the FIRST read after the link is created,
    // because that is exactly when the invoice actions read it.
    const firstRead = await getInvoicedQtyForPOItem(targetOrderedItem.id);
    check("the rollup is correct on the first read after linking", firstRead, 3);

    const statuses = await getInvoicingStatusByPO(gen1.poRecordId);
    const enriched = statuses.find((i) => i.id === targetOrderedItem.id);
    check("getInvoicingStatusByPO reports the same figure", enriched.invoicedQty, 3);
    check("uninvoicedQty follows the shared rule", enriched.uninvoicedQty, uninvoicedQty({ qty: 10, invoicedQty: 3 }));
    check("and equals 7", enriched.uninvoicedQty, 7);
    // THIS ASSERTED THE OPPOSITE UNTIL #356 FOUND IT FAILING, AND IT HAD BEEN
    // FAILING SINCE #235. The line read "the employee path still omits
    // invoicedQty (#132)" and expected the key to be absent; #235 put
    // `Invoiced Qty` on `recordToPOItem` deliberately, on #211's ground that
    // what a vendor invoiced is readable by anyone who may read the order behind
    // it, and said so in a paragraph on the field itself. So the check has
    // contradicted the code it checks for eleven issues, in a script nobody runs
    // without a reason — which is `docs/notes/verification.md`'s own #152
    // precedent happening again, one tier over. Corrected per #181 rather than
    // filed: it states what the mapper now carries.
    const employeeItem = (await getItemsByPO(gen1.poRecordId))[0];
    check("the employee path carries invoicedQty (#235 retired #132's rule)", "invoicedQty" in employeeItem, true);
    check("  and still omits the Invoice Items array, which no caller of this mapper needs", "invoiceItems" in employeeItem, false);
    // #244 — was `await isPoOpen(gen1.poRecordId)`, a re-read of this PO plus a
    // walk of its ordered items. Same assertion, read off the order's own record:
    // `Uninvoiced Items` counts the items passing hasUninvoicedQty, and one of
    // this order's does. That the rollup agrees with the JS at all is
    // verify-open-orders-244.mjs's to prove, not this file's.
    check(
        "the order still has something to invoice",
        hasUninvoicedItems(await getPOByRecordId(gen1.poRecordId)),
        true
    );

    // Over-invoicing must stay negative rather than clamp.
    const ii2 = await createInvoiceItem({
        invoiceRecordId: invoice.id, invoiceId: invoice.invoiceId,
        poRecordId: gen1.poRecordId, poItemRecordId: targetOrderedItem.id,
        itemName: nameX, size: sizeX, unit: "EA", qty: 12, unitPrice: 30, remark: "",
    });
    track("invoiceItems", ii2.id);
    const over = await getInvoicingStatusByPO(gen1.poRecordId);
    const overOrderedItem = over.find((i) => i.id === targetOrderedItem.id);
    check("invoiced total accumulates", overOrderedItem.invoicedQty, 15);
    check("OVER-invoiced remainder stays negative", overOrderedItem.uninvoicedQty, -5);

    // And it propagates up the two-level rollup chain to the material.
    const invRolled = await waitFor(() => getMaterialByRecordId(matX.id), (m) => m.invoicedQty === 15);
    check(`Materials.Invoiced Qty follows the chain (${settleNote(invRolled)})`, invRolled.value.invoicedQty, 15);
    check("Uninvoiced Qty drops by the invoiced amount", invRolled.value.uninvoicedQty, 22 - 15);
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
// TWO VERDICTS, TWO SENTENCES (#171). `pass` is about the item axis; a leak is
// about this run's effect on a shared base. Until now the cleanup reported per
// record — and swallowed a failed child delete on its way to deleting the parent
// — while reaching no verdict at all, so a run that left rows behind would still
// have printed ALL CHECKS PASS had it got as far as its own cleanup.
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
