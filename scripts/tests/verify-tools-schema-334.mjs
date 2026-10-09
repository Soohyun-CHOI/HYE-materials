// The three tools tables, against the live base (#334).
//
// WHY THIS TIER AND NOT THE OFFLINE ONE. `offline/asset-status.mjs` compares two
// FILES — lib/assetStatus.js against the option lists create_tools_334.py sends —
// and that is the whole of what a file-only check can say. It cannot see what
// Airtable actually holds, and this schema has three things that live only there:
// a select's option list (which no API can repair once the field exists), a link
// field's inverse on the far table, and `prefersSingleRecordLink`, which the
// Metadata API refuses to write at all. `docs/notes/verification.md` states the
// convention this follows: when a judgment rule lives on the Airtable side, a
// credentialed check reads the live schema or the live values and compares.
//
// THREE PARTS, AND THEY ASK DIFFERENT QUESTIONS.
//
//   A  SCHEMA, read-only. Does the base hold what the spec asked for — every
//      field, every choice in order with its color, every inverse — and which
//      links still need the hand toggle. Creates nothing.
//   B  ROUND TRIP. Writes one row into each table, reads all three back THROUGH
//      THE PRODUCTION MAPPERS, and compares. This is what proves the mappers name
//      fields the base really has: a wrong name in `record.get()` reads
//      `undefined` silently, which is the quiet half of the rename window
//      docs/notes/airtable-access.md measured in #333. It also mints a real
//      `Asset Log ID` through `createAssetLogEntry`, so the ninth `CHILD_KINDS`
//      relation is exercised rather than merely registered.
//   C  THE SELECT REFUSES. `Event` is written with no `typecast`, so a value
//      outside the option list must FAIL the write rather than mint a ninth
//      choice off the palette. That is the `DRUM` failure this base already had
//      once, and the reason it matters more here than usual is that no API can
//      remove the option afterwards.
//
// Part A is safe at any time. Parts B and C create records, cleaned up within the
// run through scripts/tests/_fixtures.mjs. Cost is roughly 20 operations.
//
// `Asset Categories` IS THE CATALOG SINCE #507, so Part A reads its four fields and the class's
// options against lib/assetCategory.js, and Part B writes its kind by those fields and
// reads back the name the base's formula gave it — the one place `composeItemName`
// is held against the live expression outside the creation script. Its kind was a
// typed `Tool Name`, found by name, until then. This also named `Tool Log."Notes"`,
// which #363 deleted, in Part A's list, the fixture tag and Part B's entry; a log row
// is tagged by `Checked Out To` now, the text a `Checked out` row carries (#376), and
// corrected per #181 by #507.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-tools-schema-334.mjs
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed or
// a row was left on the base, 2 no failures but a part could not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { getJobByCode } from "../../lib/airtable/jobs.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAssetCategoriesByRecordIds } from "../../lib/airtable/assetCategories.js";
import { getAssetByAssetId, getAssetsByCategory } from "../../lib/airtable/assets.js";
import { createAssetLogEntry, getAssetLogByAsset } from "../../lib/airtable/assetLog.js";
import {
    STATUS_AFTER_EVENT,
    ASSET_EVENT,
    ASSET_EVENT_VALUES,
    ASSET_STATUS,
    ASSET_STATUS_VALUES,
} from "../../lib/assetStatus.js";
import { ASSET_CATEGORY_FIELDS, ASSET_CLASS_VALUES, composeItemName } from "../../lib/assetCategory.js";
import { createFixtures } from "./_fixtures.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-tools-schema-334 — the three tools tables, against the live base" });

let pass = true;
let incomplete = false;

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
function log(line = "") {
    console.log(line);
}

// Bucket order IS deletion order: log rows before the tool item they hang off,
// tool items before the kind. Every one of the three is written by this script,
// so all three declare a tagField — the helper's rule is to decline only where a
// row is genuinely out of reach, and none is.
const fixtures = createFixtures({
    tag: "V334",
    buckets: [
        { name: "assetLog", table: TABLES.ASSET_LOG, label: "Tool Log row", tagField: "Checked Out To" },
        {
            name: "assets",
            table: TABLES.ASSETS,
            label: "Tool Item",
            tagField: "Asset ID",
            children: [{ link: "Asset Log", table: TABLES.ASSET_LOG, label: "Tool Log row" }],
        },
        {
            name: "tools",
            table: TABLES.ASSET_CATEGORIES,
            label: "Tool",
            // The field the kind is written by (#507); its formula name begins the same.
            tagField: ASSET_CATEGORY_FIELDS.level2,
            children: [{ link: "Assets", table: TABLES.ASSETS, label: "Tool Item" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

// Printed before anything is created: a run killed by Ctrl-C skips the catch
// teardown lives behind, and the tag is a per-run random suffix, so without this
// line the prefix needed to sweep by hand dies with the process.
console.log(`run tag: ${TAG} — every fixture below is prefixed with it`);
log();

let complete = false;

try {
    // ── Part A — the live schema ────────────────────────────────────────────
    log("Part A — the live schema against the spec (read-only)");

    const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    if (!res.ok) {
        log(`  SKIPPED — Metadata API returned ${res.status}`);
        log("        needs AIRTABLE_API_KEY + AIRTABLE_BASE_ID (schema.bases:read scope).");
        incomplete = true;
    } else {
        const { tables } = await res.json();
        const byName = new Map(tables.map((t) => [t.name, t]));
        const byId = new Map(tables.map((t) => [t.id, t]));
        const field = (table, name) => (table?.fields || []).find((f) => f.name === name);

        const EXPECTED = {
            // The catalog since #507: the name a formula over two of the four.
            [TABLES.ASSET_CATEGORIES]: [
                ["Item Name", "formula"],
                [ASSET_CATEGORY_FIELDS.level1, "singleLineText"],
                [ASSET_CATEGORY_FIELDS.level2, "singleLineText"],
                [ASSET_CATEGORY_FIELDS.size, "singleLineText"],
                [ASSET_CATEGORY_FIELDS.assetClass, "singleSelect"],
            ],
            [TABLES.ASSETS]: [
                ["Asset ID", "singleLineText"],
                ["Category", "multipleRecordLinks"],
                ["Status", "singleSelect"],
                ["Job", "multipleRecordLinks"],
            ],
            [TABLES.ASSET_LOG]: [
                ["Asset Log ID", "singleLineText"],
                ["Asset", "multipleRecordLinks"],
                ["Event", "singleSelect"],
                ["Job", "multipleRecordLinks"],
                ["Recorded By", "multipleRecordLinks"],
                ["Event At", "dateTime"],
                ["Checked Out To", "singleLineText"],
            ],
        };

        for (const [tableName, wanted] of Object.entries(EXPECTED)) {
            const table = byName.get(tableName);
            if (!assert(`\`${tableName}\` exists`, Boolean(table))) continue;
            for (const [fieldName, type] of wanted) {
                const live = field(table, fieldName);
                if (!assert(`  ${tableName}."${fieldName}" exists`, Boolean(live))) continue;
                check(`    type`, live.type, type);
                assert(`    carries a description`, Boolean((live.description || "").trim()));
            }
            // The primary field is the printed identity on two of the three, so a
            // table whose primary drifted would put the wrong value on a label.
            const primary = (table.fields || []).find((f) => f.id === table.primaryFieldId);
            check(`  primary field`, primary?.name, wanted[0][0]);
        }

        // THE OPTION LISTS, THE HALF WITH NO SECOND CHANCE. Compared against
        // lib/assetStatus.js rather than against a literal here — a check that
        // restates its subject asserts nothing, and the JS module is what the app
        // writes from.
        log();
        log("  the option lists, against lib/assetStatus.js and lib/assetCategory.js:");
        const statusField = field(byName.get(TABLES.ASSETS), "Status");
        const eventField = field(byName.get(TABLES.ASSET_LOG), "Event");
        const liveStatus = (statusField?.options?.choices || []).map((c) => c.name);
        const liveEvent = (eventField?.options?.choices || []).map((c) => c.name);
        check("    Assets.Status", liveStatus.join(" | "), ASSET_STATUS_VALUES.join(" | "));
        check("    Asset Log.Event", liveEvent.join(" | "), ASSET_EVENT_VALUES.join(" | "));
        // A choice added by hand is exactly what no file-only check can see, and it
        // is the whole reason this part exists — `DRUM` sat on `PR Items` held by no
        // record and creatable by no code path.
        const strayStatus = liveStatus.filter((n) => !ASSET_STATUS_VALUES.includes(n));
        const strayEvent = liveEvent.filter((n) => !ASSET_EVENT_VALUES.includes(n));
        check("    choices on Status no code can write", strayStatus.join(", "), "");
        check("    choices on Event no code can write", strayEvent.join(", "), "");
        // THE CLASS'S TWO (#507), against lib/assetCategory.js for the same reason.
        const classField = field(byName.get(TABLES.ASSET_CATEGORIES), ASSET_CATEGORY_FIELDS.assetClass);
        const liveClass = (classField?.options?.choices || []).map((c) => c.name);
        check("    Asset Categories.Class", liveClass.join(" | "), ASSET_CLASS_VALUES.join(" | "));

        log();
        log("  the five inverses, checked on the far tables:");
        const INVERSES = [
            [TABLES.ASSETS, "Category", TABLES.ASSET_CATEGORIES, "Assets"],
            [TABLES.ASSETS, "Job", "Jobs", "Assets"],
            [TABLES.ASSET_LOG, "Asset", TABLES.ASSETS, "Asset Log"],
            [TABLES.ASSET_LOG, "Job", "Jobs", "Asset Log"],
            [TABLES.ASSET_LOG, "Recorded By", "Users", "Asset Log"],
        ];
        const needsToggle = [];
        for (const [ourTable, ourField, farTable, farField] of INVERSES) {
            const live = field(byName.get(ourTable), ourField);
            const far = byId.get(live?.options?.linkedTableId);
            const inverse = (far?.fields || []).find((f) => f.id === live?.options?.inverseLinkFieldId);
            check(`    ${ourTable}."${ourField}" points at`, far?.name, farTable);
            check(`      its inverse is`, inverse?.name, farField);
            if (!live?.options?.prefersSingleRecordLink) needsToggle.push(`${ourTable}."${ourField}"`);
        }

        // NOT A FAILURE, AND THAT IS DELIBERATE. The Metadata API refuses
        // `prefersSingleRecordLink` on both CREATE and UPDATE (422, measured), so no
        // script can set it and a red line here would be a permanent one — the shape
        // _fixtures.mjs warns about, where a standing warning stops being read. The
        // app enforces single-record on all five either way; this reports what the
        // BASE still says so the hand toggle can be finished or confirmed.
        log();
        if (needsToggle.length === 0) {
            log("  all five links are single-record on the base too.");
        } else {
            log(`  ${needsToggle.length} link(s) still multi on the base — turn OFF`);
            log('  "Allow linking to multiple records" in the Airtable UI:');
            for (const n of needsToggle) log(`    - ${n}`);
        }
    }

    // ── Part B — round trip through the production mappers ──────────────────
    log();
    log("Part B — one row per table, read back through the mappers");

    const job = await getJobByCode("26-DEMO-01");
    const users = await getActiveUsers();
    if (!job || users.length === 0) {
        log("  SKIPPED — needs Job 26-DEMO-01 and at least one active user.");
        incomplete = true;
    } else {
        const user = users[0];
        // A catalog row, written by its four fields as the office types one (#507);
        // `Item Name` is the base's to compute.
        const kind = { level1: `${TAG} probe tools`, level2: `${TAG} probe drill`, size: "18V", assetClass: ASSET_CLASS_VALUES[1] };
        // `Asset ID` is written as a literal here rather than minted: #335 owns
        // the generator and does not exist yet, and the shape of a top-level ID is
        // that issue's subject. What this part is for is the CHILD id, which is
        // registered and minted below.
        const assetId = `${TAG}-001`;

        const categoryRecord = await base(TABLES.ASSET_CATEGORIES).create(
            Object.fromEntries(Object.entries(ASSET_CATEGORY_FIELDS).map(([key, fieldName]) => [fieldName, kind[key]]))
        );
        track("tools", categoryRecord.id);

        const itemRecord = await base(TABLES.ASSETS).create({
            "Asset ID": assetId,
            Category: [categoryRecord.id],
            Status: ASSET_STATUS.IN_STOCK,
            Job: [job.id],
        });
        track("assets", itemRecord.id);

        // THROUGH THE PRODUCTION WRITER, which is what makes the ninth CHILD_KINDS
        // relation a measured thing rather than a registered one. It mints the id
        // inside the per-parent lock, so a wrong `idField` in the registry would
        // read `undefined` off every sibling and be caught here rather than on the
        // first real scan.
        const entry = await createAssetLogEntry({
            assetRecordId: itemRecord.id,
            assetId,
            event: ASSET_EVENT.CHECKED_OUT,
            jobRecordId: job.id,
            recordedByUserId: user.id,
            checkedOutTo: `${TAG} first event`,
        });
        track("assetLog", entry.id);

        log("  the child ID minted from the registry:");
        check("    Asset Log ID", entry.assetLogId, `${assetId}-001`);

        log("  the kind, read back by record id:");
        const [readCategory] = await getAssetCategoriesByRecordIds([categoryRecord.id]);
        // The base's formula against lib/assetCategory.js's rule, on a row this run wrote.
        check("    itemName, as the formula names it", readCategory?.itemName, composeItemName(kind));
        check(
            "    its path and class, through the mapper",
            `${readCategory?.level1} | ${readCategory?.level2} | ${readCategory?.size} | ${readCategory?.assetClass}`,
            `${kind.level1} | ${kind.level2} | ${kind.size} | ${kind.assetClass}`
        );
        assert("    carries its Assets reverse-link", (readCategory?.assets || []).includes(itemRecord.id));

        log("  the tool item, read back by its printed id:");
        const readItem = await getAssetByAssetId(assetId);
        check("    assetId", readItem?.assetId, assetId);
        check("    status", readItem?.status, ASSET_STATUS.IN_STOCK);
        check("    category", (readItem?.category || [])[0], categoryRecord.id);
        check("    job", (readItem?.job || [])[0], job.id);
        assert("    carries its Asset Log reverse-link", (readItem?.assetLog || []).includes(entry.id));

        log("  the log row, read back through the parent's reverse-link:");
        const history = await getAssetLogByAsset(itemRecord.id);
        check("    rows", history.length, 1);
        check("    event", history[0]?.event, ASSET_EVENT.CHECKED_OUT);
        check("    job", (history[0]?.job || [])[0], job.id);
        check("    recordedBy", (history[0]?.recordedBy || [])[0], user.id);
        check("    checkedOutTo", history[0]?.checkedOutTo, `${TAG} first event`);
        assert("    eventAt is a timestamp", !Number.isNaN(Date.parse(history[0]?.eventAt)));

        // The `rowIds` path is what every screen will take, since a caller holding
        // the tool item record already has the array. It must return the same rows.
        const viaRowIds = await getAssetLogByAsset(itemRecord.id, { rowIds: readItem.assetLog });
        check("    the rowIds path returns the same row", viaRowIds[0]?.id, history[0]?.id);

        const units = await getAssetsByCategory(categoryRecord.id, { rowIds: readCategory.assets });
        check("  the kind's units", units.map((u) => u.assetId).join(", "), assetId);

        // The mapping the app applies, against the row it just wrote. This is the
        // one place both halves are live at once: the event on the base, and the
        // status the module says it implies.
        check(
            "  STATUS_AFTER_EVENT agrees with what the row would set",
            STATUS_AFTER_EVENT[history[0]?.event],
            ASSET_STATUS.OUT
        );

        // ── Part C — the select refuses a value outside its list ────────────
        log();
        log("Part C — Event is written with no typecast, so a stray value fails");
        let refusal = null;
        try {
            await base(TABLES.ASSET_LOG).create({
                "Asset Log ID": `${assetId}-999`,
                "Asset": [itemRecord.id],
                Event: "Marked Lost",
                Job: [job.id],
                "Checked Out To": `${TAG} should not exist`,
            });
        } catch (err) {
            refusal = err;
        }
        if (refusal === null) {
            // If it somehow landed, it is a row on the shared base and must be
            // tracked so teardown takes it — a leak reported is recoverable, a leak
            // unnoticed is not.
            const stray = await base(TABLES.ASSET_LOG)
                .select({ filterByFormula: `{Asset Log ID} = "${assetId}-999"`, maxRecords: 1 })
                .firstPage();
            if (stray.length > 0) track("assetLog", stray[0].id);
        }
        assert("  a value outside the option list is refused", refusal !== null);
        assert(
            "    and the refusal names the option rather than something else",
            /INVALID_MULTIPLE_CHOICE_OPTIONS|select option/i.test(String(refusal?.message || ""))
        );
        log(`    refusal: ${String(refusal?.message || "none").slice(0, 120)}`);
    }

    complete = true;
} catch (err) {
    pass = false;
    log();
    log(`UNCAUGHT: ${err?.stack || err}`);
}

// ── cleanup ─────────────────────────────────────────────────────────────────
log();
const teardown = await fixtures.teardown({ complete });
log(fixtures.describe(teardown));

log();
log("=".repeat(60));
const leaked = teardown.leaked.length > 0;
if (!pass || leaked) {
    log(leaked ? "FAILED — and rows were left on the base, see above" : "FAILED");
    process.exit(1);
}
if (incomplete) {
    log("NO FAILURES, but a part could not run — see SKIPPED above");
    process.exit(2);
}
log("OK — the base matches the spec, and the mappers read it");
process.exit(0);
