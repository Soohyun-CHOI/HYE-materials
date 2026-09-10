// The live category tree against the rule this repo holds — credentialed tier
// (#354).
//
// THE COMPANION TO `offline/material-categories.mjs`, AND NEITHER SUBSUMES THE
// OTHER. That one proves the committed CSV and `lib/materialCategory.js` agree:
// two files, in CI, on every push. This one proves the BASE agrees — and it is
// the only thing that can, because `Material Categories."Category Label"` is an
// Airtable formula, which `docs/notes/verification.md` calls a third tier no
// test reaches cheaply: not in the repo, not in git history, rewritable between
// two green CI runs with nothing in the diff.
//
// WHAT MAKES THE COMPARISON WORTH ANYTHING IS THAT THE TWO SIDES WERE PRODUCED
// BY DIFFERENT IMPLEMENTATIONS. The label on the row was computed by Airtable's
// formula engine; the label this file expects is computed by
// `composeCategoryLabel` in JavaScript. They are fed the same four values off
// the same record, so a disagreement is a real divergence and not a round trip.
// `filterByFormula` cannot call JavaScript and a formula cannot call this
// function, so the duplication is structural and this check is what CLAUDE.md's
// "one rule, one implementation" section asks for in its place — the same shape
// `verify-open-orders-244.mjs` uses for `PO Items."Has Uninvoiced Qty"`.
//
// Reads schema and records. CREATES NOTHING, in Airtable or anywhere else, so
// there is no fixture to clean up and it is safe to run against the shared base
// at any time. Cost is about 10 operations: one schema read plus one record page
// per 100 rows.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-material-categories-354.mjs
//
// The loader is required because this imports lib/airtable/client.js for TABLES,
// and client.js imports `../airtableFormula` without an extension.
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed,
// 2 clean but incomplete (could not reach the base).

import {
    CATEGORY_LABEL_FORMULA,
    CATEGORY_LABEL_SEPARATOR,
    CATEGORY_LEAF_CODE,
    CATEGORY_LEVELS,
    composeCategoryLabel,
} from "../../lib/materialCategory.js";
import { TABLES } from "../../lib/airtable/client.js";

const TABLE = TABLES.MATERIAL_CATEGORIES;
const LABEL_FIELD = "Category Label";

/**
 * Typed out rather than counted from whatever the base happens to hold, so a
 * tree that lost rows fails instead of agreeing with itself. Same figures as
 * the offline check, from the same committed source.
 */
const ROWS = 777;
const ROWS_WITH_A_LEADING_ZERO = 427;

const COLUMNS = CATEGORY_LEVELS.flatMap((l) => [l.code, l.name]);
const NAME_COLUMNS = CATEGORY_LEVELS.map((l) => l.name);

let pass = true;
let incomplete = false;

const log = (m) => console.log(m);
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function fail(label) {
    pass = false;
    log(`  FAIL  ${label}`);
}

console.log(`${TABLE} against lib/materialCategory.js (#354)\n`);

// ---------------------------------------------------------------------------
// Part A — the schema. The record API would show only what rows happen to hold,
// so a code field silently retyped to `number` is invisible there: every value
// would come back a number that still prints as digits, minus its leading zero.
// ---------------------------------------------------------------------------
log("Part A — the field types the tree depends on:");

let table;
try {
    const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
    table = (await res.json()).tables.find((t) => t.name === TABLE);
} catch (err) {
    incomplete = true;
    log(`  SKIP  could not read the base schema: ${err.message}`);
    log("        needs AIRTABLE_API_KEY + AIRTABLE_BASE_ID (schema.bases:read scope).");
}

if (table === null || (table === undefined && !incomplete)) {
    fail(`  table "${TABLE}" not found in this base`);
} else if (table) {
    const label = table.fields.find((f) => f.name === LABEL_FIELD);
    check(`  ${LABEL_FIELD} is a formula`, label?.type ?? "(missing)", "formula");
    check(`  ${LABEL_FIELD} is the primary field`, label?.id ?? "(missing)", table.primaryFieldId);

    // The expression is compared by the fields it REFERENCES rather than by its
    // text: Airtable stores a formula by field id and renders it back with ids
    // where our PATCH sent names, so the two strings never match even when the
    // formula is exactly the one we sent. What is comparable is the set of
    // fields it reads — and the load-bearing half of that is what it does NOT
    // read, since a code reaching the label would put a leading zero on a
    // vendor's purchase order.
    const referenced = new Set(label?.options?.referencedFieldIds ?? []);
    const byId = new Map(table.fields.map((f) => [f.id, f.name]));
    const readNames = [...referenced].map((id) => byId.get(id) ?? id).sort();
    check(
        `  ${LABEL_FIELD} reads exactly the four level names`,
        readNames.join(","),
        [...NAME_COLUMNS].sort().join(",")
    );
    check(`  ${LABEL_FIELD} is valid`, label?.options?.isValid ?? false, true);
    check(
        `  the repo's expression names as many fields`,
        NAME_COLUMNS.filter((n) => CATEGORY_LABEL_FORMULA.includes(`{${n}}`)).length,
        NAME_COLUMNS.length
    );

    for (const column of COLUMNS) {
        const field = table.fields.find((f) => f.name === column);
        check(`  ${column} is text`, field?.type ?? "(missing)", "singleLineText");
    }
}

// ---------------------------------------------------------------------------
// Part B — every row's label, as the base computed it, against the rule.
// ---------------------------------------------------------------------------
log("");
log("Part B — the label on every row:");

let records;
if (table) {
    try {
        const { base } = await import("../../lib/airtable/client.js");
        records = await base(TABLE).select({ fields: [LABEL_FIELD, ...COLUMNS] }).all();
    } catch (err) {
        incomplete = true;
        log(`  SKIP  could not read the rows: ${err.message}`);
    }
}

if (records) {
    check(`  row count`, records.length, ROWS);

    const disagreements = [];
    const numeric = [];
    let leadingZeros = 0;
    const labels = [];

    for (const record of records) {
        const fields = Object.fromEntries(
            [LABEL_FIELD, ...COLUMNS].map((c) => [c, record.get(c)])
        );
        const leaf = fields[CATEGORY_LEAF_CODE];

        for (const level of CATEGORY_LEVELS) {
            if (typeof fields[level.code] !== "string") {
                numeric.push(`${leaf}: ${level.code} came back as ${typeof fields[level.code]}`);
            }
        }
        if (CATEGORY_LEVELS.every((l) => String(fields[l.code] ?? "").startsWith("0"))) leadingZeros++;

        const expected = composeCategoryLabel(fields);
        labels.push(fields[LABEL_FIELD] ?? "");
        if ((fields[LABEL_FIELD] ?? "") !== expected) {
            disagreements.push(
                `${leaf}: the base composed ${JSON.stringify(fields[LABEL_FIELD] ?? "")}, ` +
                `the rule composes ${JSON.stringify(expected)}`
            );
        }
    }

    check(`  labels the base and the rule disagree on`, disagreements.length, 0);
    for (const line of disagreements.slice(0, 10)) log(`        ${line}`);
    if (disagreements.length > 10) log(`        ... and ${disagreements.length - 10} more`);

    check(`  every label is distinct`, new Set(labels).size, ROWS);
    check(`  every leaf code is distinct`, new Set(records.map((r) => r.get(CATEGORY_LEAF_CODE))).size, ROWS);

    log("");
    log("  the leading zeros, which is what a retyped code column would cost:");
    check(`  codes that came back as something other than text`, numeric.length, 0);
    for (const line of numeric.slice(0, 10)) log(`        ${line}`);
    check(`  rows keeping a leading zero at every level`, leadingZeros, ROWS_WITH_A_LEADING_ZERO);

    // Anti-vacuity. Everything above compares two computations, and two
    // computations that both do nothing agree perfectly: if the formula were
    // dropping every level after the first, or the rows had lost their deeper
    // columns, the counts would still be 0 and 777. So assert the base is
    // really running the clauses — some label is folded, some is not, and the
    // words that fold one are really in the data.
    log("");
    log("  the base is really composing, not agreeing vacuously:");
    const segments = labels.map((l) => l.split(CATEGORY_LABEL_SEPARATOR).length);
    check(`  some label is four segments`, segments.some((n) => n === 4), true);
    check(`  some label is fewer than four`, segments.some((n) => n < 4), true);
    check(
        `  the separator is really in the labels`,
        labels.filter((l) => l.includes(CATEGORY_LABEL_SEPARATOR)).length > 0,
        true
    );
    for (const word of ["Standard", "Other"]) {
        check(
            `  the tree still contains ${word}, so its clause is exercised`,
            records.some((r) => NAME_COLUMNS.some((c) => r.get(c) === word)),
            true
        );
    }
}

// ---------------------------------------------------------------------------
console.log("");
console.log("=".repeat(60));
if (!pass) {
    console.log("FAILED — see above");
    process.exit(1);
}
if (incomplete) {
    console.log("INCOMPLETE — no failures, but the base could not be read");
    process.exit(2);
}
console.log(`OK — ${ROWS} live labels match lib/materialCategory.js`);
process.exit(0);
