// Unit select options in Airtable vs CANONICAL_UNITS — credentialed tier (#18).
//
// The companion to scripts/tests/offline/unit-options.mjs. That one proves the
// two hand-maintained FILES agree; this one proves the four Airtable FIELDS
// agree with them. Neither subsumes the other, and the gap between them is not
// hypothetical: a 20th option, DRUM, existed on PR Items and on no other table,
// held by no record, creatable by no code path in this repo — added by hand in
// Airtable, and invisible to every check that reads only files.
//
// It matters more since #18. Materials' natural key includes Unit, so an option
// present on PR Items but absent on Materials does not mislabel anything — it
// fails the cache write outright, because upsertMaterial deliberately does not
// use typecast (which would "fix" the write by inventing the option and let the
// canonical list rot). Schema here is edited by hand, so drift recurs by
// default; this is the thing that notices.
//
// Reads schema only. Creates nothing, in Airtable or anywhere else, so there is
// no fixture to clean up and it is safe to run against the shared base at any
// time.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-unit-options-18.mjs
//
// THE LOADER IS REQUIRED, and this header claimed the opposite until #181. It
// said "no module loader needed (every import here is extension-qualified and
// lib/airtable/client.js pulls in no relative imports of its own)". The second
// half stopped being true when #159 split the formula escape out: client.js now
// imports `../airtableFormula` extensionless, so plain `node` dies with
// ERR_MODULE_NOT_FOUND on lib/airtableFormula before a single check runs. Only
// TABLES is wanted from client.js, which is what made the claim plausible — an
// import is an execution either way. No dev server.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete (could
// not reach the schema).

import { CANONICAL_UNITS } from "../../lib/units.js";
import { TABLES } from "../../lib/airtable/client.js";

// The tables carrying the shared Unit select, by their production constants
// rather than another hand-typed copy of the names. Delivery Items joined in
// #162, where a missing option fails the write outright: createDeliveryItem does
// not use typecast, so an unlisted unit would break recording an arrival rather
// than mislabel one.
const UNIT_TABLES = [
    TABLES.PR_ITEMS,
    TABLES.PO_ITEMS,
    TABLES.INVOICE_ITEMS,
    TABLES.MATERIALS,
    TABLES.DELIVERY_ITEMS,
];
const FIELD = "Unit";

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

console.log("Unit select options in Airtable vs lib/units.js CANONICAL_UNITS (#18)\n");
console.log(`Canonical list (${CANONICAL_UNITS.length}): ${CANONICAL_UNITS.join(", ")}\n`);

// ---------------------------------------------------------------------------
// Schema read. The Metadata API is the only way to see a select field's option
// list; the record API would show only the values records happen to hold, which
// is precisely how an unused option like DRUM stays hidden.
let tables;
try {
    const res = await fetch(
        `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
        { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    if (!res.ok) {
        throw new Error(`${res.status} ${res.statusText} — ${await res.text()}`);
    }
    tables = (await res.json()).tables;
} catch (err) {
    // Could not run rather than found a problem — exit 2, never 0.
    incomplete = true;
    log(`  SKIP  could not read the base schema: ${err.message}`);
    log("        needs AIRTABLE_API_KEY + AIRTABLE_BASE_ID (schema.bases:read scope).");
}

if (tables) {
    for (const tableName of UNIT_TABLES) {
        log(`${tableName}:`);

        const table = tables.find((t) => t.name === tableName);
        if (!table) {
            // A table named in TABLES that the base does not have is a real
            // problem, not an incomplete run.
            fail(`  table "${tableName}" not found in this base`);
            continue;
        }

        const field = table.fields.find((f) => f.name === FIELD);
        if (!field) {
            fail(`  ${tableName}."${FIELD}" not found`);
            continue;
        }

        check(`  ${FIELD} is a singleSelect`, field.type, "singleSelect");

        const choices = (field.options?.choices || []).map((c) => c.name);
        const extra = choices.filter((c) => !CANONICAL_UNITS.includes(c));
        const missing = CANONICAL_UNITS.filter((u) => !choices.includes(u));

        check(`  option count`, choices.length, CANONICAL_UNITS.length);

        // The two that decide whether writes work. Named individually so the
        // output says WHICH value drifted, not just that something did — an
        // extra option is a hand edit to reverse or promote, a missing one is
        // a backfill to re-run (scripts/import/add_unit_options.py).
        check(`  no options beyond the canonical list`, extra.join(",") || "(none)", "(none)");
        check(`  no canonical values missing`, missing.join(",") || "(none)", "(none)");

        // Display order only — a reordering in Airtable breaks no write. Worth
        // a line anyway: the four fields are read side by side by anyone
        // comparing them, and today all four match the file's order exactly.
        check(`  same order as the file (display only)`, choices.join(","), CANONICAL_UNITS.join(","));

        log("");
    }
}

// ---------------------------------------------------------------------------
console.log("=".repeat(60));
if (!pass) {
    console.log("FAILED — see above");
    process.exit(1);
}
if (incomplete) {
    console.log("INCOMPLETE — no failures, but the schema could not be read");
    process.exit(2);
}
console.log(`OK — all ${UNIT_TABLES.length} Unit fields match the canonical list`);
process.exit(0);
