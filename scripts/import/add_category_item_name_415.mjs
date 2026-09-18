// Adds `Material Categories."Item Name"` and fills all 777 rows from the CSV
// beside this file (issue #415).
//
// WHY A SCRIPT FOR THIS. A schema edit leaves no diff of its own, so the only
// record that it happened is here — the reason `docs/notes/verification.md` puts
// a one-time run against the live base in this directory, and the reason
// `add_material_category_356.mjs` next door exists in the shape this one copies.
// Idempotent throughout: a second run finds the field, finds every row already
// carrying its name, and writes nothing.
//
// IT FILLS ROWS RATHER THAN CREATING THEM, which is the one way it differs from
// `create_material_categories_354.mjs`. The 777 rows are already there and are
// REFERENCE DATA linked from `Materials` and `PR Items`, so this is the first
// bulk write this repository makes to rows that are not a demo seed or a
// verification fixture. Three consequences, all built in below: every refusal
// fires before a single write, the ledger is written before the first PATCH, and
// `--trial` exists so the ledger can be proved on a handful of rows before the
// rest are touched.
//
// THE NAMES ARE NOT COMPUTED AND CANNOT BE. `Category Label` is composed from the
// four level columns by one rule, which is why a category added by hand gets a
// label for free; these names come from eight templates HQ writes them with, so
// the CSV is the source and this field is stored text. `lib/materialCategory.js:
// CATEGORY_ITEM_NAME` carries that reasoning and the `Template` column's.
//
// `Category Label` IS NOT TOUCHED. It stays a formula: it is what a hand-added
// path still computes for free, and what `verify-material-categories-354.mjs`
// compares its own implementation against.
//
// MATCHED ON `Level 4 Code`, and the match is checked before it is used. The leaf
// code is unique across the 777 and the base and the CSV hold the same set — this
// run proves both rather than assuming them, and refuses everything if either
// side holds a leaf the other does not. A partial backfill against a half-matched
// set is the state that survives looking fine.
//
// THE LEDGER IS A TRACKED FILE BESIDE THIS SCRIPT, which is #313's shape and its
// reason: a reverting run needs the values, and a value that lives only in
// somebody's terminal is not a value. Every entry is `{table, field, id, before,
// after}`, written BEFORE the first PATCH. On a first run every `before` is the
// empty string, so `--revert` empties the column rather than restoring text —
// which is the correct undo for a field that did not exist.
//
// **#313 LEFT `--revert` UNRUN, AND THAT IS WHY `--trial` IS HERE.** That issue's
// ledger was the only way back from a rewrite of every stored `PO ID` and nothing
// ever exercised the path. `--trial N` writes N rows, reverts them from the
// ledger it just wrote, and reads them back to prove they are empty again — so
// the undo is demonstrated on the real table and the real field before the other
// 774 rows are written, and the run leaves the base holding the new field and no
// values.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_category_item_name_415.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_category_item_name_415.mjs --trial 3
//   node --env-file=.env.local scripts/import/add_category_item_name_415.mjs
//   node --env-file=.env.local scripts/import/add_category_item_name_415.mjs --revert <ledger.jsonl>
//
// No loader flag: this file and `lib/materialCategory.js` both import only
// built-ins, so plain Node ESM resolves them.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// `lib/airtableOps.js` cannot see a raw `fetch`, so the run prints its own call
// count — the same cost the two neighbours state.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the CSV, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// a trial, which deliberately leaves the rows empty).

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORY_ITEM_NAME, CATEGORY_LEAF_CODE } from "../../lib/materialCategory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(HERE, "material_categories.csv");

const META_ROOT = "https://api.airtable.com/v0/meta";
const DATA_ROOT = "https://api.airtable.com/v0";

const TABLE = "Material Categories";
const ROWS = 777;

/**
 * Where a ledger is written, and what it is called. #313's shape: the prefix
 * names the script so a reader meeting the file can tell what wrote it, and the
 * timestamp keeps two runs from landing on one name.
 */
const LEDGER_PREFIX = "add_category_item_name_415-";

const FIELD_DESCRIPTION =
    "The readable name of this category, as a person says it (#415) — " +
    "\"Tube, SUS 304, AP\" where Category Label beside it composes the path " +
    "\"Stainless Steel (SUS) > Tube > SUS 304 > AP\". STORED TEXT AND NOT A " +
    "FORMULA: HQ writes these with eight templates, so no expression computes " +
    "them and scripts/import/material_categories.csv is the source. A path added " +
    "by hand therefore gets a Category Label for free and does NOT get one of " +
    "these — fill it from the row's own CSV line, or leave it and read the label. " +
    "Filled by scripts/import/add_category_item_name_415.mjs, which matches on " +
    "Level 4 Code and refuses to write unless the base and the CSV hold the same " +
    "777 leaves.";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REVERT_AT = args.indexOf("--revert");
const REVERT_FILE = REVERT_AT === -1 ? null : args[REVERT_AT + 1];
const TRIAL_AT = args.indexOf("--trial");
const TRIAL_ROWS = TRIAL_AT === -1 ? 0 : Number.parseInt(args[TRIAL_AT + 1] ?? "", 10);

let calls = 0;

async function api(root, method, path, body) {
    calls++;
    const res = await fetch(`${root}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, json: text === "" ? null : JSON.parse(text) };
}

async function must(root, method, path, body) {
    const res = await api(root, method, path, body);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.text}`);
    return res.json;
}

async function listAll(tableId, fields) {
    const out = [];
    let offset;
    do {
        const params = new URLSearchParams();
        for (const f of fields) params.append("fields[]", f);
        params.set("pageSize", "100");
        if (offset) params.set("offset", offset);
        const page = await must(DATA_ROOT, "GET", `/${process.env.AIRTABLE_BASE_ID}/${tableId}?${params}`);
        out.push(...page.records);
        offset = page.offset;
    } while (offset);
    return out;
}

/** Ten per request, which is Airtable's ceiling for a record PATCH. */
async function writeBatches(tableId, updates) {
    for (let i = 0; i < updates.length; i += 10) {
        await must(DATA_ROOT, "PATCH", `/${process.env.AIRTABLE_BASE_ID}/${tableId}`, {
            records: updates.slice(i, i + 10),
        });
    }
}

/**
 * RFC 4180 enough for this file: quoted cells, embedded commas, CRLF.
 *
 * THE NAIVE SPLIT IS WRONG HERE AND IT IS MEASURED. 28 of the names carry a comma
 * or a slash, and `Item Name` is the FIRST column, so a `split(",")` reads every
 * level column off by however many commas the name before it contains.
 * `offline/material-categories.mjs` exports the same parser for the same reason;
 * this file cannot import it — that module resolves the repo root from its own
 * location under `scripts/tests/offline/` — so the two are the same twelve lines
 * twice, which is the cost of the tier boundary rather than a duplicated rule.
 */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c !== '"') cell += c;
            else if (text[i + 1] === '"') { cell += '"'; i++; }
            else quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === ",") { row.push(cell); cell = ""; }
        else if (c === "\r") continue;
        else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
        else cell += c;
    }
    if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
}

function readCsv() {
    const parsed = parseCsv(readFileSync(CSV_PATH, "utf8"));
    const header = parsed[0];
    return parsed
        .slice(1)
        .filter((r) => r.some((c) => c !== ""))
        .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function log(m = "") {
    console.log(m);
}

async function revert(file) {
    const entries = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const tables = (await must(META_ROOT, "GET", `/bases/${process.env.AIRTABLE_BASE_ID}/tables`)).tables;
    const table = tables.find((t) => t.name === TABLE);
    if (!table) { log(`  ${TABLE} not found in this base.`); return 1; }

    log(`reverting ${entries.length} values from ${file}`);
    await writeBatches(
        table.id,
        entries.map((e) => ({ id: e.id, fields: { [e.field]: e.before } }))
    );
    log(`  ${TABLE}."${CATEGORY_ITEM_NAME}": ${entries.length} put back`);
    log("done. Re-run with no flags to see what is left.");
    return 0;
}

async function main() {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (REVERT_FILE) return revert(REVERT_FILE);
    if (TRIAL_AT !== -1 && !(Number.isInteger(TRIAL_ROWS) && TRIAL_ROWS > 0)) {
        log("--trial needs a positive row count, e.g. --trial 3");
        return 1;
    }

    log(`${TABLE}."${CATEGORY_ITEM_NAME}", and the backfill behind it`);
    if (DRY_RUN) log("DRY RUN: nothing will be written.\n");
    else if (TRIAL_AT !== -1) log(`TRIAL: ${TRIAL_ROWS} row(s), written and then reverted.\n`);
    else log("");

    // ---------------------------------------------------------------------
    // 1. The CSV, and the two properties the new column has to keep
    // ---------------------------------------------------------------------
    const csv = readCsv();
    log("the committed source:");
    log(`  ${csv.length} rows parsed`);
    const problems = [];
    if (csv.length !== ROWS) problems.push(`the CSV holds ${csv.length} rows, not ${ROWS}`);

    const blank = csv.filter((r) => !(r[CATEGORY_ITEM_NAME] ?? "").trim());
    const names = csv.map((r) => r[CATEGORY_ITEM_NAME]);
    const byName = new Map();
    for (const r of csv) {
        const n = r[CATEGORY_ITEM_NAME];
        if (!byName.has(n)) byName.set(n, []);
        byName.get(n).push(r[CATEGORY_LEAF_CODE]);
    }
    const duplicated = [...byName.entries()].filter(([, codes]) => codes.length > 1);
    log(`  ${new Set(names).size} distinct names, ${blank.length} blank`);
    if (blank.length) problems.push(`${blank.length} CSV row(s) name nothing`);
    for (const [name, codes] of duplicated.slice(0, 5)) {
        problems.push(`two rows name "${name}" (${codes.join(", ")})`);
    }
    if (duplicated.length > 5) problems.push(`...and ${duplicated.length - 5} more duplicated names`);

    // ---------------------------------------------------------------------
    // 2. The table and the field
    // ---------------------------------------------------------------------
    const tables = (await must(META_ROOT, "GET", `/bases/${baseId}/tables`)).tables;
    const table = tables.find((t) => t.name === TABLE);
    if (!table) {
        log(`\n  ${TABLE} not found. Run create_material_categories_354.mjs first.`);
        return 1;
    }

    log("");
    log("the field:");
    const existing = table.fields.find((f) => f.name === CATEGORY_ITEM_NAME);
    let fieldReady = false;
    if (existing) {
        log(`  ${TABLE}."${CATEGORY_ITEM_NAME}" already exists (${existing.id}, ${existing.type}).`);
        if (existing.type !== "singleLineText") {
            log(`  ...but it is \`${existing.type}\`. A field's TYPE cannot be PATCHed (#356), so`);
            log(`     this one has to be deleted and recreated by hand before the backfill runs.`);
            return 1;
        }
        fieldReady = true;
    } else if (DRY_RUN) {
        log(`  would create ${TABLE}."${CATEGORY_ITEM_NAME}" (singleLineText)`);
    } else {
        // ATTEMPTED AND REPORTED VERBATIM, which is #356's posture rather than a
        // hedge: that issue found this file's own notes stating a documented limit
        // too broadly, and the attempt plus the response is what corrected it. A
        // text field has never been refused on this base — `Category Label` was
        // created as one — so a refusal here is news and should read as news.
        const res = await api(META_ROOT, "POST", `/bases/${baseId}/tables/${table.id}/fields`, {
            name: CATEGORY_ITEM_NAME,
            type: "singleLineText",
            description: FIELD_DESCRIPTION,
        });
        log(`  POST .../fields -> ${res.status} ${res.ok ? `created ${res.json.id}` : res.text}`);
        if (!res.ok) {
            log(`\n  HAND STEP: add "${CATEGORY_ITEM_NAME}" to ${TABLE} as a single line text field,`);
            log("  then run this again. The backfill below is refused while the field is missing.");
            return 1;
        }
        fieldReady = true;
    }

    // ---------------------------------------------------------------------
    // 3. The rows, matched on the leaf code
    // ---------------------------------------------------------------------
    // THE FIELD IS ONLY ASKED FOR ONCE IT EXISTS. Airtable answers a `fields[]`
    // naming an absent field with 422 UNKNOWN_FIELD_NAME, so a dry run — which is
    // exactly the run where the field has not been created yet — cannot request
    // it. Every row then reads as empty, which is what it is.
    const rowFields = existing ? [CATEGORY_LEAF_CODE, CATEGORY_ITEM_NAME] : [CATEGORY_LEAF_CODE];
    const records = await listAll(table.id, rowFields);
    log("");
    log("the rows:");
    log(`  ${records.length} on the base`);
    if (records.length !== ROWS) problems.push(`the base holds ${records.length} rows, not ${ROWS}`);

    const baseByLeaf = new Map();
    for (const r of records) {
        const code = r.fields[CATEGORY_LEAF_CODE];
        if (!code) { problems.push(`record ${r.id} has no ${CATEGORY_LEAF_CODE}`); continue; }
        if (baseByLeaf.has(code)) problems.push(`two records share ${CATEGORY_LEAF_CODE} ${code}`);
        baseByLeaf.set(code, r);
    }

    const csvLeaves = new Set(csv.map((r) => r[CATEGORY_LEAF_CODE]));
    const onlyBase = [...baseByLeaf.keys()].filter((c) => !csvLeaves.has(c));
    const onlyCsv = [...csvLeaves].filter((c) => !baseByLeaf.has(c));
    log(`  leaves on the base and not in the CSV: ${onlyBase.length}${onlyBase.length ? ` (${onlyBase.slice(0, 5).join(", ")})` : ""}`);
    log(`  leaves in the CSV and not on the base: ${onlyCsv.length}${onlyCsv.length ? ` (${onlyCsv.slice(0, 5).join(", ")})` : ""}`);
    if (onlyBase.length) problems.push(`${onlyBase.length} leaf code(s) on the base are not in the CSV`);
    if (onlyCsv.length) problems.push(`${onlyCsv.length} leaf code(s) in the CSV are not on the base`);

    // WHAT WOULD CHANGE. A row already carrying its name is skipped and never
    // reaches the ledger, which is what makes a second run write nothing. A row
    // carrying a DIFFERENT name is reported and rewritten — unlike
    // `create_material_categories_354.mjs`, which refuses to touch a disagreeing
    // row, because there the value is the row's identity and here it is a name
    // this CSV is the source of.
    const toWrite = [];
    const toOverwrite = [];
    // Record id -> leaf code, for the preview alone. The ledger keeps #313's five
    // keys exactly, so what a reader can join on is not widened by a display need.
    const leafById = new Map();
    let already = 0;
    for (const row of csv) {
        const leaf = row[CATEGORY_LEAF_CODE];
        const record = baseByLeaf.get(leaf);
        if (!record) continue;
        const before = record.fields[CATEGORY_ITEM_NAME] ?? "";
        const after = row[CATEGORY_ITEM_NAME];
        if (before === after) { already++; continue; }
        const entry = { table: TABLE, field: CATEGORY_ITEM_NAME, id: record.id, before, after };
        leafById.set(record.id, leaf);
        toWrite.push(entry);
        if (before !== "") toOverwrite.push(entry);
    }

    const show = (e) => `    ${leafById.get(e.id)}  ${e.before === "" ? "(blank)" : `"${e.before}"`} -> "${e.after}"`;
    log("");
    log("what would change:");
    log(`  ${already} row(s) already carry their name`);
    log(`  ${toWrite.length} row(s) to fill, of which ${toOverwrite.length} would overwrite an existing value`);
    if (toOverwrite.length) {
        log("  the overwrites, which are the ones worth reading before approving:");
        for (const e of toOverwrite.slice(0, 10)) log(show(e));
    }
    log("  the first and last of what would be written:");
    for (const e of toWrite.slice(0, 3)) log(show(e));
    if (toWrite.length > 6) log("    ...");
    for (const e of toWrite.slice(-3)) log(show(e));

    if (problems.length) {
        log("");
        log("REFUSED — nothing was written:");
        for (const p of problems) log(`  - ${p}`);
        return 1;
    }

    if (DRY_RUN) {
        log("");
        log(`dry run complete. ${calls} API call(s).`);
        log(`a real run would make about ${Math.ceil(toWrite.length / 10)} PATCH call(s) on top of this.`);
        return 2;
    }

    if (!fieldReady) return 1;
    if (toWrite.length === 0) {
        log("");
        log(`nothing to write. ${calls} API call(s).`);
        return 0;
    }

    // ---------------------------------------------------------------------
    // 4. The write, and the ledger before it
    // ---------------------------------------------------------------------
    const planned = TRIAL_AT === -1 ? toWrite : toWrite.slice(0, TRIAL_ROWS);
    const ledger = join(HERE, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    writeFileSync(ledger, planned.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    log("");
    log(`ledger: ${ledger}  (commit it — see this file's header)`);

    await writeBatches(table.id, planned.map((e) => ({ id: e.id, fields: { [e.field]: e.after } })));
    log(`  ${planned.length} name(s) written`);

    if (TRIAL_AT === -1) {
        const after = await listAll(table.id, [CATEGORY_LEAF_CODE, CATEGORY_ITEM_NAME]);
        const named = after.filter((r) => (r.fields[CATEGORY_ITEM_NAME] ?? "").trim() !== "");
        const distinct = new Set(after.map((r) => r.fields[CATEGORY_ITEM_NAME] ?? ""));
        log("");
        log("read back:");
        log(`  ${named.length} of ${after.length} rows name something`);
        log(`  ${distinct.size} distinct names`);
        log("");
        log(`${calls} API call(s).`);
        const clean = named.length === ROWS && distinct.size === ROWS;
        if (!clean) log(`WARNING: revert with --revert ${ledger}`);
        return clean ? 0 : 1;
    }

    // ---------------------------------------------------------------------
    // 5. The trial's second half: put those rows back and prove they went
    // ---------------------------------------------------------------------
    log("");
    log("proving the ledger:");
    const ids = new Set(planned.map((e) => e.id));
    const written = (await listAll(table.id, [CATEGORY_LEAF_CODE, CATEGORY_ITEM_NAME])).filter((r) => ids.has(r.id));
    for (const r of written) log(`  ${r.fields[CATEGORY_LEAF_CODE]} now reads "${r.fields[CATEGORY_ITEM_NAME] ?? ""}"`);
    const allWritten = written.every(
        (r) => (r.fields[CATEGORY_ITEM_NAME] ?? "") === planned.find((e) => e.id === r.id).after
    );
    log(`  all ${planned.length} carry the CSV's name: ${allWritten}`);

    await revert(ledger);

    const back = (await listAll(table.id, [CATEGORY_LEAF_CODE, CATEGORY_ITEM_NAME])).filter((r) => ids.has(r.id));
    for (const r of back) log(`  ${r.fields[CATEGORY_LEAF_CODE]} now reads "${r.fields[CATEGORY_ITEM_NAME] ?? ""}"`);
    const allBack = back.every(
        (r) => (r.fields[CATEGORY_ITEM_NAME] ?? "") === planned.find((e) => e.id === r.id).before
    );
    log(`  all ${planned.length} are back to what they were: ${allBack}`);

    if (!allWritten || !allBack) {
        log("");
        log(`TRIAL FAILED. The ledger is kept: ${ledger}`);
        return 1;
    }

    // THE TRIAL'S LEDGER IS DELETED AND THE FULL RUN'S IS NOT, which is the one
    // place the two differ. This file records a round trip that has already been
    // completed, so it can undo nothing; committing it would put a file in
    // `scripts/import/` that reads like an undo and is not one. A FAILED trial
    // keeps it, because that is exactly when somebody needs the values.
    rmSync(ledger);
    log(`  ledger deleted — it describes a write that has already been undone`);

    log("");
    log(`trial complete. ${calls} API call(s). The field exists and no row carries a name.`);
    // 2 rather than 0: the trial deliberately leaves the backfill undone.
    return 2;
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        console.error(`\nFAILED — ${err.stack || err.message}`);
        process.exit(1);
    });
