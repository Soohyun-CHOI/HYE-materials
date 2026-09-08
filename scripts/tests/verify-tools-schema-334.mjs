// The three tools tables, against the live base (#334).
//
// WHY THIS TIER AND NOT THE OFFLINE ONE. `offline/tool-status.mjs` compares two
// FILES — lib/toolStatus.js against the option lists create_tools_334.py sends —
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
//      `Tool Log ID` through `createToolLogEntry`, so the ninth `CHILD_KINDS`
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
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-tools-schema-334.mjs
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed or
// a row was left on the base, 2 no failures but a part could not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { getJobByCode } from "../../lib/airtable/jobs.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getToolByName } from "../../lib/airtable/tools.js";
import { getToolItemByToolItemId, getToolItemsByTool } from "../../lib/airtable/toolItems.js";
import { createToolLogEntry, getToolLogByToolItem } from "../../lib/airtable/toolLog.js";
import {
    STATUS_AFTER_EVENT,
    TOOL_EVENT,
    TOOL_EVENT_VALUES,
    TOOL_STATUS,
    TOOL_STATUS_VALUES,
} from "../../lib/toolStatus.js";
import { createFixtures } from "./_fixtures.mjs";

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
        { name: "toolLog", table: TABLES.TOOL_LOG, label: "Tool Log row", tagField: "Notes" },
        {
            name: "toolItems",
            table: TABLES.TOOL_ITEMS,
            label: "Tool Item",
            tagField: "Tool Item ID",
            children: [{ link: "Tool Log", table: TABLES.TOOL_LOG, label: "Tool Log row" }],
        },
        {
            name: "tools",
            table: TABLES.TOOLS,
            label: "Tool",
            tagField: "Tool Name",
            children: [{ link: "Tool Items", table: TABLES.TOOL_ITEMS, label: "Tool Item" }],
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
            [TABLES.TOOLS]: [["Tool Name", "singleLineText"]],
            [TABLES.TOOL_ITEMS]: [
                ["Tool Item ID", "singleLineText"],
                ["Tool", "multipleRecordLinks"],
                ["Status", "singleSelect"],
                ["Job", "multipleRecordLinks"],
            ],
            [TABLES.TOOL_LOG]: [
                ["Tool Log ID", "singleLineText"],
                ["Tool Item", "multipleRecordLinks"],
                ["Event", "singleSelect"],
                ["Job", "multipleRecordLinks"],
                ["Recorded By", "multipleRecordLinks"],
                ["Event At", "dateTime"],
                ["Notes", "multilineText"],
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
        // lib/toolStatus.js rather than against a literal here — a check that
        // restates its subject asserts nothing, and the JS module is what the app
        // writes from.
        log();
        log("  the two option lists, against lib/toolStatus.js:");
        const statusField = field(byName.get(TABLES.TOOL_ITEMS), "Status");
        const eventField = field(byName.get(TABLES.TOOL_LOG), "Event");
        const liveStatus = (statusField?.options?.choices || []).map((c) => c.name);
        const liveEvent = (eventField?.options?.choices || []).map((c) => c.name);
        check("    Tool Items.Status", liveStatus.join(" | "), TOOL_STATUS_VALUES.join(" | "));
        check("    Tool Log.Event", liveEvent.join(" | "), TOOL_EVENT_VALUES.join(" | "));
        // A choice added by hand is exactly what no file-only check can see, and it
        // is the whole reason this part exists — `DRUM` sat on `PR Items` held by no
        // record and creatable by no code path.
        const strayStatus = liveStatus.filter((n) => !TOOL_STATUS_VALUES.includes(n));
        const strayEvent = liveEvent.filter((n) => !TOOL_EVENT_VALUES.includes(n));
        check("    choices on Status no code can write", strayStatus.join(", "), "");
        check("    choices on Event no code can write", strayEvent.join(", "), "");

        log();
        log("  the five inverses, checked on the far tables:");
        const INVERSES = [
            [TABLES.TOOL_ITEMS, "Tool", TABLES.TOOLS, "Tool Items"],
            [TABLES.TOOL_ITEMS, "Job", "Jobs", "Tool Items"],
            [TABLES.TOOL_LOG, "Tool Item", TABLES.TOOL_ITEMS, "Tool Log"],
            [TABLES.TOOL_LOG, "Job", "Jobs", "Tool Log"],
            [TABLES.TOOL_LOG, "Recorded By", "Users", "Tool Log"],
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
        const toolName = `${TAG} probe drill`;
        // `Tool Item ID` is written as a literal here rather than minted: #335 owns
        // the generator and does not exist yet, and the shape of a top-level ID is
        // that issue's subject. What this part is for is the CHILD id, which is
        // registered and minted below.
        const toolItemId = `${TAG}-001`;

        const toolRecord = await base(TABLES.TOOLS).create({ "Tool Name": toolName });
        track("tools", toolRecord.id);

        const itemRecord = await base(TABLES.TOOL_ITEMS).create({
            "Tool Item ID": toolItemId,
            Tool: [toolRecord.id],
            Status: TOOL_STATUS.IN_STOCK,
            Job: [job.id],
        });
        track("toolItems", itemRecord.id);

        // THROUGH THE PRODUCTION WRITER, which is what makes the ninth CHILD_KINDS
        // relation a measured thing rather than a registered one. It mints the id
        // inside the per-parent lock, so a wrong `idField` in the registry would
        // read `undefined` off every sibling and be caught here rather than on the
        // first real scan.
        const entry = await createToolLogEntry({
            toolItemRecordId: itemRecord.id,
            toolItemId,
            event: TOOL_EVENT.CHECKED_OUT,
            jobRecordId: job.id,
            recordedByUserId: user.id,
            notes: `${TAG} first event`,
        });
        track("toolLog", entry.id);

        log("  the child ID minted from the registry:");
        check("    Tool Log ID", entry.toolLogId, `${toolItemId}-001`);

        log("  the kind, read back by name:");
        const readTool = await getToolByName(toolName);
        check("    toolName", readTool?.toolName, toolName);
        assert("    carries its Tool Items reverse-link", (readTool?.toolItems || []).includes(itemRecord.id));

        log("  the tool item, read back by its printed id:");
        const readItem = await getToolItemByToolItemId(toolItemId);
        check("    toolItemId", readItem?.toolItemId, toolItemId);
        check("    status", readItem?.status, TOOL_STATUS.IN_STOCK);
        check("    tool", (readItem?.tool || [])[0], toolRecord.id);
        check("    job", (readItem?.job || [])[0], job.id);
        assert("    carries its Tool Log reverse-link", (readItem?.toolLog || []).includes(entry.id));

        log("  the log row, read back through the parent's reverse-link:");
        const history = await getToolLogByToolItem(itemRecord.id);
        check("    rows", history.length, 1);
        check("    event", history[0]?.event, TOOL_EVENT.CHECKED_OUT);
        check("    job", (history[0]?.job || [])[0], job.id);
        check("    recordedBy", (history[0]?.recordedBy || [])[0], user.id);
        check("    notes", history[0]?.notes, `${TAG} first event`);
        assert("    eventAt is a timestamp", !Number.isNaN(Date.parse(history[0]?.eventAt)));

        // The `rowIds` path is what every screen will take, since a caller holding
        // the tool item record already has the array. It must return the same rows.
        const viaRowIds = await getToolLogByToolItem(itemRecord.id, { rowIds: readItem.toolLog });
        check("    the rowIds path returns the same row", viaRowIds[0]?.id, history[0]?.id);

        const units = await getToolItemsByTool(toolRecord.id, { rowIds: readTool.toolItems });
        check("  the kind's units", units.map((u) => u.toolItemId).join(", "), toolItemId);

        // The mapping the app applies, against the row it just wrote. This is the
        // one place both halves are live at once: the event on the base, and the
        // status the module says it implies.
        check(
            "  STATUS_AFTER_EVENT agrees with what the row would set",
            STATUS_AFTER_EVENT[history[0]?.event],
            TOOL_STATUS.OUT
        );

        // ── Part C — the select refuses a value outside its list ────────────
        log();
        log("Part C — Event is written with no typecast, so a stray value fails");
        let refusal = null;
        try {
            await base(TABLES.TOOL_LOG).create({
                "Tool Log ID": `${toolItemId}-999`,
                "Tool Item": [itemRecord.id],
                Event: "Marked Lost",
                Job: [job.id],
                Notes: `${TAG} should not exist`,
            });
        } catch (err) {
            refusal = err;
        }
        if (refusal === null) {
            // If it somehow landed, it is a row on the shared base and must be
            // tracked so teardown takes it — a leak reported is recoverable, a leak
            // unnoticed is not.
            const stray = await base(TABLES.TOOL_LOG)
                .select({ filterByFormula: `{Tool Log ID} = "${toolItemId}-999"`, maxRecords: 1 })
                .firstPage();
            if (stray.length > 0) track("toolLog", stray[0].id);
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
