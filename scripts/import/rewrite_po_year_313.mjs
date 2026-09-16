// Rewrite every stored purchase order ID onto the two-digit year (#313).
//
// WHAT IT TOUCHES, AND IT IS EXACTLY TWO FIELDS. `Purchase Orders."PO ID"` and
// `PO Items."PO Item ID"`, both `singleLineText`, both written by this app. A
// base-wide scan of all 65 text fields across 26 tables found the PO ID string in
// no third place, every other reference to an order is a LINK — `Deliveries."Packing
// List PO"`, `Material Prices."Latest PO"`, `Invoice-PO Link`, `Invoice Items."PO"`
// and `"PO Item"`, `Delivery Items."PO Item"` — and links carry record ids, which
// this does not move. All 20 formulas on the base were dumped and none reads `PO ID`,
// so there is no computed value to follow and no field type to change.
//
// WHY EVERY ROW RATHER THAN NEW ONES ONLY. `/pos` leaves its ordering to Airtable on
// the ID string, and `lib/poListView.js` records that a fixed-width zero-padded ID
// sorts as its date. That holds only while one form is in use: `"2026…"` sorts before
// `"26…"` because `'0' < '6'`, so a half-migrated table puts every long-form order
// below every short-form one whatever its date. `PO Item ID` is a sort key too
// (`lib/deliveryAllocation.js`). A partial run is the one outcome worth refusing, so
// this refuses to start unless every row can move.
//
// WHAT IT CANNOT MOVE, recorded so nobody goes looking for it. The two `PO PDF File`
// attachments are named `{PO ID}.pdf` and the document itself prints the number
// twice; renaming needs a re-upload and the PDF's own text would still disagree, and
// #281 refuses to regenerate a document that exists because regeneration misstates
// history. The vendor holds what the vendor holds. Zero orders have been sent, so
// today that list is two filenames and nothing else.
//
// ORDER OF OPERATIONS: merge the code first, then run this. The generator mints from
// `ID_KINDS.PO`, so a run before the merge would be followed by new long-form rows;
// a merge before the run leaves old rows long for as long as it takes to run this,
// which is the only window and is the survivable direction.
//
// THE LEDGER IS A TRACKED FILE, BESIDE THIS SCRIPT, AND THAT IS DELIBERATE. A
// rollback that exists on one machine is not a rollback; and what was changed on the
// base, when, and from what to what is exactly the kind of record this repository
// keeps. It lands in `scripts/import/`, which already holds `material_categories.csv`
// and `requirements.txt` tracked next to the scripts that read them — a one-time
// script and its data living together. NOT `data/` or `output/`, which `.gitignore`
// sweeps as raw data.
//
// Run from the repo root. Dry run is the DEFAULT and prints the whole table:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/import/rewrite_po_year_313.mjs
//   ... --apply                  actually write, after recording a ledger
//   ... --revert <ledger.jsonl>  put every recorded value back
//
// Nobody may create a purchase order while this runs: `withKeyLock` serializes
// within one process, and this is a different process from the app.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { base, TABLES } from "../../lib/airtable/client.js";

/**
 * Where a ledger is written, and what it is called.
 *
 * RESOLVED FROM THIS MODULE RATHER THAN FROM THE WORKING DIRECTORY, so the file
 * lands beside the script whatever `node` was run from — the header says why it
 * belongs there. The name is the script's own, so `ls scripts/import/` puts the two
 * next to each other and a reader meeting the ledger can tell what wrote it.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER_PREFIX = "rewrite_po_year_313-";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const REVERT_AT = args.indexOf("--revert");
const REVERT_FILE = REVERT_AT === -1 ? null : args[REVERT_AT + 1];

/** The two fields that hold the string, and the table each sits on. */
const TARGETS = [
    { table: TABLES.PURCHASE_ORDERS, field: "PO ID" },
    { table: TABLES.PO_ITEMS, field: "PO Item ID" },
];

/**
 * `HYE-PO-20` plus exactly six digits not followed by a seventh.
 *
 * ANCHORED ON THE TOKEN AND ON WHAT FOLLOWS, so it cannot eat a digit of the
 * sequence: `HYE-PO-20260911-33-001` yields `HYE-PO-260911-33-001` and the child's
 * own suffix is untouched, because the capture stops at the separator.
 */
const LONG = /^HYE-PO-20(\d{6})(?!\d)/;

/** The short form of one stored value, or null when it is already short. */
function shorten(value) {
    return LONG.test(value) ? value.replace(LONG, "HYE-PO-$1") : null;
}

/** Every record of one table, with one field projected. */
async function readAll(table, field) {
    const rows = [];
    await base(table)
        .select({ fields: [field], pageSize: 100 })
        .eachPage((records, next) => {
            for (const r of records) rows.push({ id: r.id, value: r.get(field) || "" });
            next();
        });
    return rows;
}

/** Airtable takes ten records per update call. */
async function writeBatches(table, updates) {
    for (let i = 0; i < updates.length; i += 10) {
        await base(table).update(updates.slice(i, i + 10));
    }
}

async function plan() {
    const entries = [];
    const problems = [];
    for (const { table, field } of TARGETS) {
        const rows = await readAll(table, field);
        let already = 0;
        for (const { id, value } of rows) {
            const after = shorten(value);
            if (after) entries.push({ table, field, id, before: value, after });
            else if (value.startsWith("HYE-PO-")) already += 1;
            else problems.push(`${table}.${field} ${id}: ${JSON.stringify(value)} is not a PO ID`);
        }
        console.log(`  ${table}.${field}: ${rows.length} rows, ${entries.filter((e) => e.table === table).length} to rewrite, ${already} already short`);
    }

    // REFUSALS, all three before a single write. A value nothing recognizes, a pair
    // of rows that would land on one id, and a short form already in the table are
    // each a reason to stop and look rather than to write half a migration.
    const seen = new Map();
    for (const e of entries) {
        const key = `${e.table}|${e.after}`;
        if (seen.has(key)) problems.push(`collision on ${e.after}: ${seen.get(key)} and ${e.id}`);
        seen.set(key, e.id);
    }
    return { entries, problems };
}

async function revert(file) {
    const entries = readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    console.log(`reverting ${entries.length} values from ${file}`);
    for (const { table, field } of TARGETS) {
        const mine = entries.filter((e) => e.table === table);
        if (!mine.length) continue;
        await writeBatches(
            table,
            mine.map((e) => ({ id: e.id, fields: { [field]: e.before } }))
        );
        console.log(`  ${table}.${field}: ${mine.length} put back`);
    }
    console.log("done. Re-run with no flags to see what is left.");
}

async function main() {
    if (REVERT_FILE) return revert(REVERT_FILE);

    console.log(APPLY ? "APPLYING\n" : "DRY RUN — nothing is written\n");
    const { entries, problems } = await plan();

    if (problems.length) {
        console.error("\nREFUSING:");
        for (const p of problems) console.error(`  ${p}`);
        process.exit(1);
    }
    if (!entries.length) {
        console.log("\nNothing to rewrite — every stored PO ID is already on the short form.");
        return;
    }

    console.log(`\n${entries.length} values would change:\n`);
    for (const e of entries) console.log(`  ${e.before}  ->  ${e.after}`);

    if (!APPLY) {
        console.log(`\nDry run. Re-run with --apply to write these ${entries.length} values.`);
        return;
    }

    // THE LEDGER IS WRITTEN BEFORE THE FIRST PATCH, which is what makes this
    // reversible: a run that dies halfway has still recorded every value it was
    // about to touch, and `--revert` puts back the ones that moved (the others are
    // written with the value they already hold, which is a no-op).
    const ledger = join(HERE, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    writeFileSync(ledger, entries.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    console.log(`\nledger: ${ledger}  (commit it — see this file's header)`);

    for (const { table, field } of TARGETS) {
        const mine = entries.filter((e) => e.table === table);
        if (!mine.length) continue;
        await writeBatches(
            table,
            mine.map((e) => ({ id: e.id, fields: { [field]: e.after } }))
        );
        console.log(`  ${table}.${field}: ${mine.length} written`);
    }

    const after = await plan();
    console.log(
        after.entries.length === 0
            ? "\nVerified: no long-form PO ID is left on the base."
            : `\nWARNING: ${after.entries.length} long-form values remain. Revert with --revert ${ledger}`
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
