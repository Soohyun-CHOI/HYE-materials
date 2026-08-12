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
//   D — the production path: every PO line linked, dedupe on price only.
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
import {
    getItemsByPO,
    getInvoicingStatusByPO,
    getInvoicedQtyForPOItem,
} from "../../lib/airtable/poItems.js";
import { updatePO, isPoOpen } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { createInvoice, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import { createInvoiceItem } from "../../lib/airtable/invoiceItems.js";
import { uninvoicedQty } from "../../lib/poItemQty.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
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
        // Frozen `Item Name` copied from the tagged PO line, so the tag reaches
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

/** Rows matching one Materials natural key — the duplicate detector. */
async function countMaterialRows({ itemName, size, unit }) {
    const records = await base(TABLES.MATERIALS)
        .select({
            filterByFormula: `AND(
                LOWER(TRIM({Item Name})) = LOWER(TRIM("${formulaString(itemName)}")),
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
    const grouped = collectMaterialsCacheEntries([
        { id: "recA", poItemId: "P-001", itemName: "Pipe", size: '2"', unit: "EA", unitPrice: 10 },
        { id: "recB", poItemId: "P-002", itemName: "Pipe", size: '2"', unit: "EA", unitPrice: 25 },
    ]);
    check("two lines of one material make ONE price entry", grouped.entries.length, 1);
    check("the LAST line's price is the one cached", grouped.entries[0].item.unitPrice, 25);
    // The correctness point the dedupe must not break: Materials' rollups sum
    // over Materials."PO Items", so a line left unlinked is invisible on the
    // item axis. Both lines must be linked even though only one price wins.
    check("but BOTH lines are kept for linking", grouped.entries[0].poItemIds.join(","), "recA,recB");

    check(
        "case/whitespace variants are one key",
        collectMaterialsCacheEntries([
            { id: "r1", itemName: " pipe  x ", size: '2"', unit: "EA", unitPrice: 1 },
            { id: "r2", itemName: "PIPE X", size: '2"', unit: "EA", unitPrice: 2 },
        ]).entries.length,
        1
    );

    const skips = collectMaterialsCacheEntries([
        { id: "s1", poItemId: "P-1", itemName: "   ", unit: "EA", unitPrice: 10 },
        { id: "s2", poItemId: "P-2", itemName: "No unit", unit: "", unitPrice: 10 },
        { id: "s3", poItemId: "P-3", itemName: "No price", unit: "EA", unitPrice: undefined },
        { id: "s4", poItemId: "P-4", itemName: "Zero qty is fine", unit: "EA", qty: 0, unitPrice: 5 },
    ]);
    check("a nameless line is skipped", skips.skipped.filter((s) => s.reason === "no Item Name").length, 1);
    check("a UNIT-LESS line is skipped (#18)", skips.skipped.filter((s) => s.reason === "no Unit").length, 1);
    check("a priceless line is skipped", skips.skipped.filter((s) => s.reason === "no numeric Unit Price").length, 1);
    check("only the valid line remains", skips.entries.length, 1);
    check("and every skip names its PO Item", skips.skipped.every((s) => Boolean(s.poItemId)), true);

    check('a double quote is escaped for the formula', formulaString('2"'), '2\\"');
    check("a backslash is escaped first", formulaString("a\\b"), "a\\\\b");
}

let complete = false;
// ---------------------------------------------------------------------------
const [users, vendors, lines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllLines()]);
const requester = users[0];
const [vendorA, vendorB] = vendors;
const line = lines[0];

if (!requester || !vendorA || !vendorB || !line) {
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
    console.log(`\nFixture context: vendors "${vendorA.vendorName}" / "${vendorB.vendorName}", line "${line.lineLabel}" (reused, not modified)`);

    // -----------------------------------------------------------------------
    console.log("\nPart A — Materials identity: one natural key, one row:");
    const keyA = { itemName: `${TAG} Pipe`, size: '2"', unit: "EA" };

    const m1 = await upsertMaterial(keyA);
    check("created with the name as given", m1.itemName, keyA.itemName);
    check("Material Label is the formula's composite", m1.materialLabel, `${keyA.itemName}_2"_EA`);
    check('a Size containing a double quote is found again by its key', (await getMaterialByKey(keyA))?.id, m1.id);

    const m2 = await upsertMaterial(keyA);
    check("a second call returns the same row", m2.id, m1.id);
    check("exactly one row for that key", await countMaterialRows(keyA), 1);

    // Case-insensitive lookup, and the first spelling is NOT overwritten.
    const m3 = await upsertMaterial({ ...keyA, itemName: keyA.itemName.toUpperCase() });
    check("an all-caps spelling matches the same row", m3.id, m1.id);
    check("and the stored name is still the FIRST spelling", m3.itemName, keyA.itemName);
    check("still one row", await countMaterialRows(keyA), 1);

    // Internal whitespace is normalized by upsertMaterial itself, so a sloppy
    // legacy-shaped value cannot create a second row.
    const m4 = await upsertMaterial({ ...keyA, itemName: `  ${keyA.itemName.replace(" ", "   ")}  ` });
    check("a whitespace-variant spelling matches too", m4.id, m1.id);

    // Unit-less identity still works (the omit-not-"" rule, on the new schema).
    // lib/materialsCache.js skips these, but the function stays correct.
    const keyNoUnit = { itemName: `${TAG} No unit`, size: "", unit: "" };
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
        check("and it is findable by its key", (await getMaterialByKey(keyNoUnit))?.id, mNoUnit.id);
        check("one row for the unit-less key", await countMaterialRows(keyNoUnit), 1);
    }

    // -----------------------------------------------------------------------
    console.log("\nPart B — Material Prices: one material, two vendors:");
    const pA = await upsertMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorA.id, unitPrice: 30, latestDate: "2026-07-01" });
    const pB = await upsertMaterialPrice({ materialRecordId: m1.id, vendorRecordId: vendorB.id, unitPrice: 41, latestDate: "2026-07-02" });

    assert("the two vendors get two DIFFERENT price rows", pA.id !== pB.id);
    check("still exactly one Materials row", await countMaterialRows(keyA), 1);
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
    const keyRace = { itemName: `${TAG} Race`, size: "1/2", unit: "FT" };
    const racing = Promise.all([1, 2, 3].map(() => upsertMaterial(keyRace)));
    check("one lock key is queued while the three identity calls fly", _debugLockKeys().length, 1);
    const raced = await racing;
    check("all three resolved to ONE record", new Set(raced.map((r) => r.id)).size, 1);
    check("and Airtable holds one row", await countMaterialRows(keyRace), 1);

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

    // Vendor A. Item X twice (dedupe + both linked), one unit-less line
    // (skipped), one other material.
    const pr1 = await createPR({
        requesterId: requester.id, lineId: line.id, vendorId: vendorA.id,
        notes: `${TAG} vendor A`,
    });
    track("prs", pr1.id);
    const nameX = `${TAG} Flange`;
    for (const it of [
        { itemName: nameX, size: '4"', unit: "EA", qty: 10, unitPrice: 30 },
        { itemName: nameX, size: '4"', unit: "EA", qty: 5, unitPrice: 44 },
        { itemName: `${TAG} Unitless`, size: "", unit: "", qty: 1, unitPrice: 9 },
        { itemName: `${TAG} Gasket`, size: "", unit: "PCS", qty: 4, unitPrice: 2 },
    ]) {
        await createItem({ prRecordId: pr1.id, prId: pr1.prId, remark: "", ...it });
    }
    await updatePR(pr1.id, { status: "Approved" });
    const gen1 = await generatePOForApprovedPR(await getPRByRecordId(pr1.id));
    track("pos", gen1.poRecordId);
    const po1Items = await getItemsByPO(gen1.poRecordId);
    check("the PO snapshot has all four lines", po1Items.length, 4);

    const keyX = { itemName: nameX, size: '4"', unit: "EA" };
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

    const xLines = po1Items.filter((i) => i.itemName === nameX);
    check("both PO lines of that material carry the Material link", xLines.filter((i) => i.material.includes(matX?.id)).length, 2);
    const unitless = po1Items.find((i) => i.itemName.endsWith("Unitless"));
    check("the unit-less line is NOT linked (skipped)", unitless.material.length, 0);
    check("and no identity row was created for it", await countMaterialRows({ itemName: `${TAG} Unitless`, size: "", unit: "" }), 0);

    // The reverse side of the link, which is what the rollups traverse.
    const matXFresh = await getMaterialByRecordId(matX.id);
    check("Materials.PO Items shows both lines (reverse link)", matXFresh.poItems.length, 2);

    const gasket = await getMaterialByKey({ itemName: `${TAG} Gasket`, size: "", unit: "PCS" });
    assert("a blank SIZE is fine — that line got its own material", Boolean(gasket));

    // Vendor B buys the same material: one identity, a second price.
    const pr2 = await createPR({
        requesterId: requester.id, lineId: line.id, vendorId: vendorB.id,
        notes: `${TAG} vendor B`,
    });
    track("prs", pr2.id);
    await createItem({ prRecordId: pr2.id, prId: pr2.prId, remark: "", itemName: nameX, size: '4"', unit: "EA", qty: 7, unitPrice: 51 });
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
        requesterId: requester.id, lineId: line.id, vendorId: vendorA.id,
        notes: `${TAG} withdrawn`,
    });
    track("prs", pr3.id);
    await createItem({ prRecordId: pr3.id, prId: pr3.prId, remark: "", itemName: nameX, size: '4"', unit: "EA", qty: 100, unitPrice: 60 });
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
    check(`Withdrawn: Committed Qty = 0, NOT the line's 100 (${settleNote(withdrawn)})`, withdrawn.value.get("Committed Qty") || 0, 0);
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

    const targetLine = xLines[0]; // qty 10
    const ii = await createInvoiceItem({
        invoiceRecordId: invoice.id, invoiceId: invoice.invoiceId,
        poRecordId: gen1.poRecordId, poItemRecordId: targetLine.id,
        itemName: nameX, size: '4"', unit: "EA", qty: 3, unitPrice: 30, remark: "",
    });
    track("invoiceItems", ii.id);

    // The merge's premise, re-measured every run rather than trusted: the
    // rollup must be correct on the FIRST read after the link is created,
    // because that is exactly when the invoice actions read it.
    const firstRead = await getInvoicedQtyForPOItem(targetLine.id);
    check("the rollup is correct on the first read after linking", firstRead, 3);

    const statuses = await getInvoicingStatusByPO(gen1.poRecordId);
    const enriched = statuses.find((i) => i.id === targetLine.id);
    check("getInvoicingStatusByPO reports the same figure", enriched.invoicedQty, 3);
    check("uninvoicedQty follows the shared rule", enriched.uninvoicedQty, uninvoicedQty({ qty: 10, invoicedQty: 3 }));
    check("and equals 7", enriched.uninvoicedQty, 7);
    check("the employee path still omits invoicedQty (#132)", "invoicedQty" in (await getItemsByPO(gen1.poRecordId))[0], false);
    check("isPoOpen sees uninvoiced qty on this PO", await isPoOpen(gen1.poRecordId), true);

    // Over-invoicing must stay negative rather than clamp.
    const ii2 = await createInvoiceItem({
        invoiceRecordId: invoice.id, invoiceId: invoice.invoiceId,
        poRecordId: gen1.poRecordId, poItemRecordId: targetLine.id,
        itemName: nameX, size: '4"', unit: "EA", qty: 12, unitPrice: 30, remark: "",
    });
    track("invoiceItems", ii2.id);
    const over = await getInvoicingStatusByPO(gen1.poRecordId);
    const overLine = over.find((i) => i.id === targetLine.id);
    check("invoiced total accumulates", overLine.invoicedQty, 15);
    check("OVER-invoiced remainder stays negative", overLine.uninvoicedQty, -5);

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
