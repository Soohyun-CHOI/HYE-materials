// Creates `Material Categories` and fills it from the CSV beside this file
// (issue #354).
//
// WHAT THE TABLE IS FOR. A material's identity has been the name a requester
// typed, so one strut channel becomes two rows when two people spell it
// differently. HQ already maintains a four-level tree of the paths this company
// buys; this puts it in the base as reference data, one row per path, so a
// request picks a category instead of typing a name (#355) and the item axis is
// keyed on that category instead of on a spelling (#356).
//
// RE-RUNNABLE, BECAUSE THE BASE IS WIPED AND REBUILT. Re-entering 777 rows by
// hand is a way to enter them wrong. A second run finds every row by its
// `Level 4 Code` and creates nothing; a run against a half-filled table creates
// only what is missing. A row that exists but disagrees with the CSV is
// REPORTED and never rewritten — reference data linked from `Materials` is not
// something a re-run should silently edit.
//
// WHY THIS ONE IS NODE WHERE THE OTHER FOUR IN THIS DIRECTORY ARE PYTHON. The
// label rule lives in `lib/materialCategory.js`, and Python cannot import it.
// `add_unit_options.py` pays that cost with a duplicated 19-item list and an
// offline check comparing the two, which is affordable for a list; here the
// duplicate would be a 1,100-character generated formula, and a third copy of a
// rule this issue is already keeping in two places is the thing CLAUDE.md's
// "one rule, one implementation" section exists to refuse. Importing the module
// removes the copy entirely.
//
// IT TALKS TO THE REST API DIRECTLY, NOT THROUGH `lib/airtable/client.js`, for
// the same reason the Python scripts do: the table does not exist on the first
// run, and the schema half of the work has no SDK anyway. The consequence is
// that `lib/airtableOps.js` cannot see these calls (`docs/notes/
// airtable-access.md` records raw `fetch` as one of the two things invisible to
// the counter), so the run prints its own count.
//
// TWO PHASES, WITH ONE HAND STEP BETWEEN THEM, AND THAT IS FORCED. A formula
// field cannot be CREATED through the Metadata API — Airtable documents
// `formula`, `rollup`, `count` and lookup as read-only field types — and a
// field's TYPE cannot be PATCHed either (422, "Changing a field's type or
// number precision is not currently supported", measured on this base). But an
// existing formula field's `options.formula` DOES PATCH cleanly (200, #281). So
// the first run creates `Category Label` as text, Soo converts it to a formula
// in the UI with any expression at all, and the second run PATCHes the real one
// and loads the rows. Rows are refused while the field is still text, because
// 777 rows with an empty primary is a worse state to be in than none.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/create_material_categories_354.mjs --dry-run
//   node --env-file=.env.local scripts/import/create_material_categories_354.mjs
//
// No loader flag: this file and `lib/materialCategory.js` both import only
// built-ins, so plain Node ESM resolves them.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec and
// the CSV, 1 something failed, 2 nothing failed but something is incomplete (a
// dry run, or the hand step is still outstanding).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
    CATEGORY_LABEL_FORMULA,
    CATEGORY_LEAF_CODE,
    CATEGORY_LEVELS,
    composeCategoryLabel,
} from "../../lib/materialCategory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(HERE, "material_categories.csv");

const TABLE_NAME = "Material Categories";
const LABEL_FIELD = "Category Label";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

const TABLE_DESCRIPTION =
    "HQ's four-level material category tree, one row per path (#354). Reference " +
    "data rather than demo data: loaded from scripts/import/" +
    "material_categories.csv by scripts/import/create_material_categories_354.mjs, " +
    "which is re-runnable and keyed on Level 4 Code. Category Label is a formula " +
    "and is the only place a label is computed; the rule is mirrored in " +
    "lib/materialCategory.js for checking, never for writing.";

const CODE_DESCRIPTION =
    "HQ's code for this level. TEXT AND NEVER A NUMBER: 427 of the 777 rows " +
    "begin with a zero at every level, and a numeric column drops it, which " +
    "would make 01 and 1 the same category. It does not encode its ancestors " +
    "either — 11 rows break prefix nesting — so a parent is reached through the " +
    "columns beside this one and never by slicing this string.";

/**
 * The leaf code says one more thing than the others, and it is the sentence
 * somebody adding a row by hand needs while their cursor is in that cell — which
 * is why it lives on the field and not only in `docs/notes/materials.md`.
 */
const LEAF_CODE_DESCRIPTION =
    CODE_DESCRIPTION +
    " ADDING A PATH BY HAND: take the parent's Level 3 Code and append a " +
    "three-digit number from 901 up — 0101002 becomes 0101002901, then " +
    "0101002902. HQ's own leaves never pass 033, so the 900 block tells a " +
    "branch-made path from an HQ one on sight when HQ's tree is next compared " +
    "against this table, and it costs nothing to follow because the code has to " +
    "be typed anyway. Each code must be unique across the whole table: nothing " +
    "here enforces that, and getCategoriesByLeafCode refuses a request rather " +
    "than guessing which of two rows was meant.";

const NAME_DESCRIPTION =
    "HQ's English name for this level. Korean names are not stored; the " +
    "correspondence lives in the mapping workbook.";

// ---------------------------------------------------------------------------
// The table spec
// ---------------------------------------------------------------------------

/**
 * `Category Label` is FIRST because Airtable takes the first field of a create
 * payload as the table's primary field, and this is the one a link renders — a
 * `Materials."Category"` cell showing `0101002002` instead of the path would be
 * useless in the UI. It goes in as text and is converted by hand; see the
 * header.
 */
function tableSpec() {
    const fields = [
        {
            name: LABEL_FIELD,
            type: "singleLineText",
            description:
                "The composed path, and the primary field, the way Material Label " +
                "and Price Label are. CREATED AS TEXT AND CONVERTED TO A FORMULA BY " +
                "HAND — the Metadata API cannot create a formula field or retype an " +
                "existing one. Its expression is generated by " +
                "lib/materialCategory.js and PATCHed by the import script; do not " +
                "edit it here.",
        },
    ];

    for (const level of CATEGORY_LEVELS) {
        fields.push({
            name: level.code,
            type: "singleLineText",
            description: level.code === CATEGORY_LEAF_CODE ? LEAF_CODE_DESCRIPTION : CODE_DESCRIPTION,
        });
        fields.push({ name: level.name, type: "singleLineText", description: NAME_DESCRIPTION });
    }

    return { name: TABLE_NAME, description: TABLE_DESCRIPTION, fields };
}

const COLUMNS = CATEGORY_LEVELS.flatMap((l) => [l.code, l.name]);

// ---------------------------------------------------------------------------
// The committed source
// ---------------------------------------------------------------------------

/** RFC 4180 enough for this file: quoted cells, embedded commas, CRLF. */
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

/**
 * The source is validated BEFORE anything reaches the base. A malformed CSV
 * that got as far as a write would put 777 wrong rows into a table no API can
 * drop, so the cheap refusal comes first. `offline/material-categories.mjs`
 * holds the same properties in CI with the counts spelled out; this is the
 * subset that must hold for a write to be safe at all.
 */
function readSource() {
    const parsed = parseCsv(readFileSync(CSV_PATH, "utf8"));
    const header = parsed[0] ?? [];
    const problems = [];

    if (header.join(",") !== COLUMNS.join(",")) {
        problems.push(`header is ${header.join(",") || "(empty)"}, expected ${COLUMNS.join(",")}`);
    }

    const rows = parsed
        .slice(1)
        .filter((r) => r.some((c) => c !== ""))
        .map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])));

    for (const [index, row] of rows.entries()) {
        const line = index + 2;
        for (const column of COLUMNS) {
            const value = row[column];
            if (value === undefined || value === "") problems.push(`line ${line}: ${column} is empty`);
            else if (value !== value.trim() || /\s{2}/.test(value)) {
                problems.push(`line ${line}: ${column} carries stray whitespace (${JSON.stringify(value)})`);
            }
        }
    }

    const leafCodes = rows.map((r) => r[CATEGORY_LEAF_CODE]);
    const duplicates = leafCodes.filter((code, i) => leafCodes.indexOf(code) !== i);
    for (const code of new Set(duplicates)) problems.push(`${CATEGORY_LEAF_CODE} ${code} appears more than once`);

    const labels = rows.map(composeCategoryLabel);
    const collisions = labels.filter((label, i) => labels.indexOf(label) !== i);
    for (const label of new Set(collisions)) problems.push(`two rows compose the label ${JSON.stringify(label)}`);

    return { rows, problems };
}

// ---------------------------------------------------------------------------
// Airtable
// ---------------------------------------------------------------------------
class Airtable {
    constructor(token, baseId) {
        this.baseId = baseId;
        this.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        this.calls = 0;
    }

    async request(method, url, body) {
        this.calls++;
        const response = await fetch(url, {
            method,
            headers: this.headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        }
        return text === "" ? null : JSON.parse(text);
    }

    tables() {
        return this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`).then((r) => r.tables);
    }

    /**
     * One call for the table and all nine fields. ATOMIC, which is why it is one
     * call: a create-then-append sequence can half-succeed, and a table with
     * missing fields is something no API can delete (a table DELETE is a 404
     * with no endpoint behind it).
     */
    createTable(spec) {
        return this.request("POST", `${META_ROOT}/bases/${this.baseId}/tables`, spec);
    }

    createField(tableId, field) {
        return this.request("POST", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields`, field);
    }

    /**
     * A field's description. PATCHes cleanly at 200 — measured in #283, and the
     * reason this script can own the text rather than leaving it to whoever
     * first typed it into the browser.
     */
    setDescription(tableId, fieldId, description) {
        return this.request(
            "PATCH",
            `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields/${fieldId}`,
            { description },
        );
    }

    setFormula(tableId, fieldId, formula) {
        return this.request(
            "PATCH",
            `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields/${fieldId}`,
            { options: { formula } },
        );
    }

    async listRecords(tableId, fields) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100" });
            for (const f of fields) params.append("fields[]", f);
            if (offset) params.set("offset", offset);
            const page = await this.request("GET", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
            out.push(...page.records);
            offset = page.offset;
        } while (offset);
        return out;
    }

    /**
     * No `typecast`, anywhere on this path. Every value written here is a string
     * into a text field, and typecast is what would let a mistyped column be
     * coerced into something that looks fine — the same refusal `upsertMaterial`
     * makes for `Unit`.
     */
    createRecords(tableId, records) {
        return this.request("POST", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

function log(message = "") {
    console.log(message);
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }

    log(`${TABLE_NAME} — create and fill from ${CSV_PATH}`);
    log(dryRun ? "DRY RUN: nothing will be written.\n" : "");

    const { rows, problems } = readSource();
    if (problems.length > 0) {
        log(`the committed CSV is not loadable — ${problems.length} problem(s), nothing was written:`);
        for (const problem of problems.slice(0, 20)) log(`  ${problem}`);
        if (problems.length > 20) log(`  ... and ${problems.length - 20} more`);
        return 1;
    }
    log(`source: ${rows.length} rows, ${new Set(rows.map(composeCategoryLabel)).size} distinct labels`);

    const air = new Airtable(token, baseId);
    const tables = await air.tables();
    let table = tables.find((t) => t.name === TABLE_NAME);
    const spec = tableSpec();

    // --- the table -------------------------------------------------------
    if (!table) {
        log(`\nthe table does not exist yet.`);
        if (dryRun) {
            log(`  would create ${TABLE_NAME} with ${spec.fields.length} fields:`);
            for (const f of spec.fields) log(`    ${f.name} (${f.type})`);
            // NOT the hand step: there is no field to convert yet. Saying so
            // here rather than printing the banner, because a banner headed
            // HAND STEP in front of somebody whose base has no such table
            // reads as "do this first", which is the one order that cannot
            // work.
            log("");
            log(`next: run this again without --dry-run to create the table. The one`);
            log(`hand step comes after that, and this will print it when it is due.`);
            return finish(air, 2, "dry run — nothing was written");
        }
        table = await air.createTable(spec);
        log(`  created ${TABLE_NAME} (${table.id}) with ${table.fields.length} fields`);
    } else {
        log(`\nthe table exists (${table.id}).`);
        const missing = spec.fields.filter((f) => !table.fields.some((existing) => existing.name === f.name));
        for (const field of missing) {
            if (dryRun) { log(`  would add the missing field ${field.name} (${field.type})`); continue; }
            await air.createField(table.id, field);
            log(`  added the missing field ${field.name} (${field.type})`);
        }
        if (missing.length === 0) log(`  all ${spec.fields.length} fields are present`);
        if (missing.length > 0 && !dryRun) table = (await air.tables()).find((t) => t.name === TABLE_NAME);

        // DESCRIPTIONS ARE SYNCED, NOT ONLY SET ON CREATE, because the base's
        // copy is the one a person reads while typing into the cell and this
        // script is the only thing that can keep it true. `naming.md` records
        // the failure this closes: three field descriptions written by
        // `create_direct_purchases_272.py` still say a word the app retired, and
        // editing the script alone would have left the two disagreeing forever.
        // A description PATCHes at 200 (#283), so the sync is one call per field
        // that has drifted and none at all when nothing has.
        for (const field of spec.fields) {
            const live = table.fields.find((f) => f.name === field.name);
            if (!live || live.description === field.description) continue;
            if (dryRun) { log(`  would update ${field.name}'s description`); continue; }
            await air.setDescription(table.id, live.id, field.description);
            log(`  updated ${field.name}'s description`);
        }
    }

    // --- the label formula ------------------------------------------------
    const label = table.fields.find((f) => f.name === LABEL_FIELD);
    if (!label) {
        log(`\n${LABEL_FIELD} is missing entirely, which should be impossible — stopping.`);
        return 1;
    }
    if (label.type !== "formula") {
        log(`\n${LABEL_FIELD} is still \`${label.type}\`, so no rows will be written.`);
        return handStep(air, 2);
    }

    if (dryRun) {
        log(`\nwould PATCH ${LABEL_FIELD}'s formula (${CATEGORY_LABEL_FORMULA.length} chars).`);
    } else {
        await air.setFormula(table.id, label.id, CATEGORY_LABEL_FORMULA);
        log(`\nPATCHed ${LABEL_FIELD}'s formula (${CATEGORY_LABEL_FORMULA.length} chars).`);
    }

    // --- the rows ---------------------------------------------------------
    const existing = await air.listRecords(table.id, COLUMNS);
    const byLeafCode = new Map(existing.map((r) => [r.fields[CATEGORY_LEAF_CODE], r]));
    log(`\nthe table holds ${existing.length} rows.`);

    const disagreements = [];
    for (const row of rows) {
        const found = byLeafCode.get(row[CATEGORY_LEAF_CODE]);
        if (!found) continue;
        for (const column of COLUMNS) {
            if ((found.fields[column] ?? "") !== row[column]) {
                disagreements.push(
                    `${row[CATEGORY_LEAF_CODE]}: ${column} is ${JSON.stringify(found.fields[column] ?? "")} on the base, ` +
                    `${JSON.stringify(row[column])} in the CSV`
                );
            }
        }
    }
    if (disagreements.length > 0) {
        log(`  ${disagreements.length} stored value(s) disagree with the CSV. Nothing is rewritten — reference`);
        log(`  data linked from Materials is not something a re-run edits behind you:`);
        for (const line of disagreements.slice(0, 20)) log(`    ${line}`);
        if (disagreements.length > 20) log(`    ... and ${disagreements.length - 20} more`);
        return 1;
    }

    const missingRows = rows.filter((row) => !byLeafCode.has(row[CATEGORY_LEAF_CODE]));
    const extra = existing.filter((r) => !rows.some((row) => row[CATEGORY_LEAF_CODE] === r.fields[CATEGORY_LEAF_CODE]));
    if (extra.length > 0) {
        log(`  ${extra.length} row(s) on the base are not in the CSV. They are left alone; nothing in this`);
        log(`  base is removed as tidying-up. Their leaf codes: ${extra.map((r) => r.fields[CATEGORY_LEAF_CODE]).join(", ")}`);
    }

    if (missingRows.length === 0) {
        log(`  every CSV row is already there — nothing to create.`);
    } else if (dryRun) {
        const requests = Math.ceil(missingRows.length / RECORDS_PER_REQUEST);
        log(`  would create ${missingRows.length} row(s) in ${requests} request(s).`);
        return finish(air, 2, "dry run — nothing was written");
    } else {
        let created = 0;
        for (let i = 0; i < missingRows.length; i += RECORDS_PER_REQUEST) {
            const chunk = missingRows.slice(i, i + RECORDS_PER_REQUEST);
            await air.createRecords(
                table.id,
                chunk.map((row) => ({ fields: Object.fromEntries(COLUMNS.map((c) => [c, row[c]])) })),
            );
            created += chunk.length;
            if (created % 200 === 0 || created === missingRows.length) log(`  created ${created}/${missingRows.length}`);
        }
    }

    // --- verification is part of the run ----------------------------------
    // What was asked for and what exists can differ: a code silently retyped, a
    // formula that did not take. So the last thing this does is read every row
    // back and compare the label the BASE computed against the rule this repo
    // holds — the two implementations the header is about, on identical inputs.
    log(`\nverifying against the live rows:`);
    const live = await air.listRecords(table.id, [LABEL_FIELD, ...COLUMNS]);
    const failures = [];

    if (live.length !== rows.length + extra.length) {
        failures.push(`the table holds ${live.length} rows, expected ${rows.length + extra.length}`);
    }

    let zeros = 0;
    for (const record of live) {
        const fields = record.fields;
        const expected = composeCategoryLabel(fields);
        if ((fields[LABEL_FIELD] ?? "") !== expected) {
            failures.push(
                `${fields[CATEGORY_LEAF_CODE]}: the base composed ${JSON.stringify(fields[LABEL_FIELD] ?? "")}, ` +
                `the rule composes ${JSON.stringify(expected)}`
            );
        }
        for (const level of CATEGORY_LEVELS) {
            const code = fields[level.code];
            if (typeof code !== "string") failures.push(`${fields[CATEGORY_LEAF_CODE]}: ${level.code} came back as ${typeof code}, not text`);
        }
        if (CATEGORY_LEVELS.every((l) => String(fields[l.code] ?? "").startsWith("0"))) zeros++;
    }
    log(`  ${live.length} rows read; ${zeros} of them keep a leading zero at every level`);

    if (failures.length > 0) {
        log(`  ${failures.length} disagreement(s) between the base and lib/materialCategory.js:`);
        for (const line of failures.slice(0, 20)) log(`    ${line}`);
        if (failures.length > 20) log(`    ... and ${failures.length - 20} more`);
        return finish(air, 1, "the base does not match the rule");
    }

    log(`  every label the base computed matches the rule`);
    return finish(air, 0, "the base matches the spec and the CSV");
}

/** The one step the API cannot take, printed where it cannot be lost. */
function handStep(air, code) {
    log("");
    log("=".repeat(72));
    log("HAND STEP — in the Airtable UI, then run this again:");
    log("");
    log(`  Open ${TABLE_NAME} and change ${LABEL_FIELD}'s type from`);
    log(`  "Single line text" to "Formula". The expression does not matter — put`);
    log(`  anything in, or leave the editor's default. This script PATCHes the`);
    log(`  real one on the next run.`);
    log("");
    log("  Why by hand: the Metadata API documents formula, rollup, count and");
    log("  lookup as read-only field types, so a formula field cannot be created;");
    log("  and a field's type cannot be PATCHed either. An existing formula");
    log("  field's expression CAN be PATCHed, which is what the next run does.");
    log("=".repeat(72));
    return finish(air, code, "waiting on the hand step above");
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
