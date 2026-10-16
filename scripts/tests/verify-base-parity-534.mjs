// The test base and the live base hold the same schema (#534).
//
// WHY. Every run reaches the test base unless it names the live one (`lib/airtableBase.js`), so
// a check that passes there proves something about the live base only while the two are shaped
// alike — and a schema change is applied to the test base first and to the live one after Soo
// has approved it (`docs/notes/verification.md`), which leaves a window in which they are not.
// This is what says whether that window is closed: run it after the live half of a schema
// change, and before trusting a test-base result about a table the change touched.
//
// WHAT IT COMPARES, by name rather than by id: the tables, each table's description and primary
// field, its fields in order, and each field's type, description and options — a select's
// choices with their colors, a link's far table, a formula's expression — with every table,
// field, choice and view id inside an option rewritten as the name it points at; and each
// table's views, by name and type. The ids happen to agree today, because the test base was
// made by duplicating the live one and Airtable kept them; comparing by name keeps the check
// meaningful for a copy that did not. Rows are not compared: the bases' records part from the
// moment anything is written to either, and that is the point of having two.
//
// WHAT IT CANNOT SEE, which is the Metadata API's limit and not this script's: a view's filter,
// an automation, an interface, and a rollup's aggregation function — two bases can agree on all
// of this and differ in what a rollup sums (`docs/notes/verification.md`).
//
// IT NAMES THE LIVE BASE, BY WHAT IT IS FOR. It sends two GETs of a base's schema — one with the
// test pair, one with `AIRTABLE_API_KEY` — and nothing else: no row is read and nothing is
// written to either base. An environment without the live key is a part that could not run.
//
// Run from the repo root:
//   node --env-file=.env.local scripts/tests/verify-base-parity-534.mjs
//
// Exit codes, per docs/notes/verification.md: 0 the two schemas match, 1 they differ, 2 a base
// could not be read.

import { printProvenance } from "./_provenance.mjs";
import { describeAirtableBase, resolveAirtableBase } from "../../lib/airtableBase.js";

printProvenance({ title: "verify-base-parity-534 — the test base's schema against the live base's" });

let calls = 0;

function log(line = "") {
    console.log(line);
}

/** One base's tables off the Metadata API, or a reason it could not be read. */
async function readSchema(env) {
    let base;
    try {
        base = resolveAirtableBase(env);
    } catch (error) {
        return { error: error.message };
    }
    calls++;
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${base.baseId}/tables`, {
        headers: { Authorization: `Bearer ${base.apiKey}` },
    });
    if (!res.ok) return { error: `${describeAirtableBase(base)}: Metadata API ${res.status} ${await res.text()}` };
    return { base, tables: (await res.json()).tables };
}

/** Every id a schema holds, as the name it points at. */
function namesOf(tables) {
    const names = new Map();
    for (const table of tables) {
        names.set(table.id, `table ${table.name}`);
        for (const field of table.fields) {
            names.set(field.id, `field ${table.name}.${field.name}`);
            for (const choice of field.options?.choices ?? []) if (choice.id) names.set(choice.id, `choice ${choice.name}`);
        }
        for (const view of table.views ?? []) names.set(view.id, `view ${table.name}.${view.name}`);
    }
    return names;
}

/** A value with every id in it rewritten as a name and its own `id` keys dropped, keys sorted. */
function byName(value, names) {
    if (typeof value === "string") {
        return value.replace(/\b(tbl|fld|sel|viw)[A-Za-z0-9]{14}\b/g, (id) => names.get(id) ?? `unknown ${id.slice(0, 3)}`);
    }
    if (Array.isArray(value)) return value.map((item) => byName(item, names));
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.keys(value)
                .filter((key) => key !== "id")
                .sort()
                .map((key) => [key, byName(value[key], names)])
        );
    }
    return value;
}

/** Every difference between two schemas, as sentences. */
function differences(live, test) {
    const liveNames = namesOf(live);
    const testNames = namesOf(test);
    const out = [];
    const liveTables = new Map(live.map((table) => [table.name, table]));
    const testTables = new Map(test.map((table) => [table.name, table]));
    for (const name of liveTables.keys()) if (!testTables.has(name)) out.push(`table ${name} is on the live base only`);
    for (const name of testTables.keys()) if (!liveTables.has(name)) out.push(`table ${name} is on the test base only`);
    for (const [name, a] of liveTables) {
        const b = testTables.get(name);
        if (!b) continue;
        if ((a.description ?? "") !== (b.description ?? "")) out.push(`${name}: its description differs`);
        const primary = (table) => table.fields.find((field) => field.id === table.primaryFieldId)?.name;
        if (primary(a) !== primary(b)) out.push(`${name}: its primary field is ${primary(a)} on the live base and ${primary(b)} on the test base`);
        const aFields = new Map(a.fields.map((field) => [field.name, field]));
        const bFields = new Map(b.fields.map((field) => [field.name, field]));
        for (const field of aFields.keys()) if (!bFields.has(field)) out.push(`${name}."${field}" is on the live base only`);
        for (const field of bFields.keys()) if (!aFields.has(field)) out.push(`${name}."${field}" is on the test base only`);
        const order = (table) => table.fields.map((field) => field.name).filter((field) => aFields.has(field) && bFields.has(field)).join("|");
        if (order(a) !== order(b)) out.push(`${name}: its fields stand in a different order`);
        for (const [field, x] of aFields) {
            const y = bFields.get(field);
            if (!y) continue;
            if (x.type !== y.type) out.push(`${name}."${field}" is ${x.type} on the live base and ${y.type} on the test base`);
            if ((x.description ?? "") !== (y.description ?? "")) out.push(`${name}."${field}": its description differs`);
            const xo = JSON.stringify(byName(x.options ?? {}, liveNames));
            const yo = JSON.stringify(byName(y.options ?? {}, testNames));
            if (xo !== yo) out.push(`${name}."${field}": its options differ\n      live ${xo}\n      test ${yo}`);
        }
        const views = (table) => (table.views ?? []).map((view) => `${view.name} (${view.type})`).sort().join(", ");
        if (views(a) !== views(b)) out.push(`${name}: its views differ\n      live ${views(a)}\n      test ${views(b)}`);
    }
    return out;
}

const env = { ...process.env };
delete env.AIRTABLE_BASE;
const [test, live] = await Promise.all([readSchema(env), readSchema({ ...env, AIRTABLE_BASE: "live" })]);

log();
let code = 0;
if (test.error || live.error) {
    if (test.error) log(`  SKIPPED — the test base could not be read: ${test.error}`);
    if (live.error) log(`  SKIPPED — the live base could not be read: ${live.error}`);
    code = 2;
} else {
    log(`  ${describeAirtableBase(test.base)}: ${test.tables.length} tables, ${test.tables.reduce((n, t) => n + t.fields.length, 0)} fields`);
    log(`  ${describeAirtableBase(live.base)}: ${live.tables.length} tables, ${live.tables.reduce((n, t) => n + t.fields.length, 0)} fields`);
    const found = differences(live.tables, test.tables);
    log();
    if (found.length === 0) {
        log("  PASS  the two schemas match — every table, field, type, option, description and view");
    } else {
        for (const line of found) log(`  FAIL  ${line}`);
        code = 1;
    }
}

log();
log(`${calls} Metadata API call(s); no row read, nothing written.`);
log("=".repeat(60));
log(code === 0 ? "OK — the bases are shaped alike" : code === 1 ? "FAILED — the bases differ, see above" : "NO VERDICT — a base could not be read");
process.exit(code);
