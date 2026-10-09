// Loads the office's catalog of tools and equipment into `Asset Categories` (issue #517).
//
// WHAT IT LOADS. `asset_categories.csv` beside this file is the company's list as the office
// handed it over, byte for byte — its byte-order mark included — with six columns, `Level 1
// Category`, `Level 2 Category`, `Level 3 Category`, `Size`, `Maker` and `Part Number`. Each
// row becomes one row of the catalog: the six levels in `Level 1` to `Part Number`, in the
// order a path says them, and `Class` A, since the list carries no class and the office sets
// one afterwards in Airtable. `Item Name` is the base's formula and nobody writes it.
//
// THE SOURCE IS COMMITTED, AS `material_categories.csv` IS (#354). A load whose input lives on
// one machine cannot be run again or read back, and running it again is how a load that
// stopped part way is finished (below).
//
// THE CSV IS JUDGED WHOLE BEFORE ANYTHING IS WRITTEN: the header, six cells to a row, no stray
// whitespace, and every row one `readCatalog` offers with class A — a type that is one of the
// two, a category and a name, no placeholder for an empty level, and no second row on a path.
// One row failing refuses the load. A row the registration would not offer is the office's to
// put right in the list, and no API takes a row back for a script that wrote it wrong.
//
// A PATH THE BASE ALREADY HOLDS IS NOT CREATED AGAIN. A row's path is its six levels, keyed by
// `catalogPathKey`, the key `readCatalog` offers one row by; a CSV row whose key some row on the
// base already has is left alone, its class with it — the class is the office's from the load
// on, so running this again never sets one back to A. So a run that stops part way, or a
// request whose answer is lost after its rows landed, is finished by running it again, and no
// ledger is kept: the run creates rows and changes none. A row on the base the CSV does not
// name is left alone and counted, since the office adds rows by hand.
//
// IT WRITES IN THE CSV'S ORDER, ten rows to a request and one request at a time, with no
// `typecast`, so a type or a class the selects do not hold is refused rather than coined; an
// empty level is not sent. The Airtable UI lists the rows in the order they were created, so
// the office reads them in the order of its own list.
//
// THEN IT READS THE CATALOG BACK and says whether every CSV path is on the base, named by the
// rule and offered. `classify_asset_categories_514.mjs` is the catalog's whole check — the
// schema, every row's name, and every row set aside with why — and is run after this.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's other scripts do, and counts its calls,
// which lib/airtableOps.js cannot see. The CSV reader is create_material_categories_354.mjs'
// with the byte-order mark taken off first.
//
// Usage (from the repo root). Dry run is the DEFAULT:
//   node --env-file=.env.local scripts/import/load_asset_catalog_517.mjs
//   node --env-file=.env.local scripts/import/load_asset_catalog_517.mjs --apply
//
// No loader flag: this file and lib/assetCategory.js import only built-ins and files whose
// extension they spell.
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 every CSV path is on the base, named by the
// rule and offered; 1 something failed or was refused; 2 nothing failed but rows are still to
// create (a dry run).

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_CATEGORY_FIELDS, ASSET_PATH_LEVELS, catalogPathKey, composeItemName, readCatalog } from "../../lib/assetCategory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(HERE, "asset_categories.csv");

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;
const TABLE_NAME = "Asset Categories";
const NAME_FIELD = "Item Name";

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/**
 * The list's header as the office wrote it. Its columns are the path's levels in the path's
 * order, `ASSET_PATH_LEVELS`, so a cell is read by its place; the three columns named as their
 * fields are named so by the list, and a field renamed later leaves the list as it is.
 */
const HEADER = "Level 1 Category,Level 2 Category,Level 3 Category,Size,Maker,Part Number";

/** The class every loaded row starts with, until the office sets it (#517). */
const LOADED_CLASS = "A";

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
        if (!response.ok) throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        return text === "" ? null : JSON.parse(text);
    }

    async table() {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`);
        return tables.find((t) => t.name === TABLE_NAME) ?? null;
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

    /** No `typecast`: a type or a class that is not one of the select's options is refused rather than coined. */
    createRecords(tableId, records) {
        return this.request("POST", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air?.calls ?? 0} Airtable API call(s). ${verdict}.`);
    return code;
}

/** RFC 4180 enough for this file: quoted cells, a doubled quote inside one, CRLF. */
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

/** Why a row is not offered, in the words of the fields the office types into. */
function whyAside({ reason, missing, levels, of }) {
    if (reason === "incomplete") return `missing ${missing.map((m) => ASSET_CATEGORY_FIELDS[m]).join(", ")}`;
    if (reason === "placeholder") return `a placeholder for empty in ${levels.map((m) => ASSET_CATEGORY_FIELDS[m]).join(", ")} — leave the cell empty`;
    return `the path ${of.id} already names`;
}

/**
 * The CSV as catalog rows, each carrying its line, and every reason it cannot be loaded. A row
 * is judged by `readCatalog`, the reading the registration offers rows by, so the load and the
 * dialog cannot disagree about a row.
 */
function readSource() {
    const parsed = parseCsv(readFileSync(CSV_PATH, "utf8").replace(/^﻿/, ""));
    const problems = [];
    const header = (parsed[0] ?? []).join(",");
    if (header !== HEADER) problems.push(`the header is ${JSON.stringify(header)}, not ${JSON.stringify(HEADER)}`);

    const rows = [];
    for (const [index, cells] of parsed.slice(1).entries()) {
        const line = index + 2;
        if (cells.every((cell) => cell === "")) continue;
        if (cells.length !== ASSET_PATH_LEVELS.length) {
            problems.push(`line ${line}: ${cells.length} cell(s), not ${ASSET_PATH_LEVELS.length}`);
            continue;
        }
        for (const [i, value] of cells.entries()) {
            if (value !== value.trim() || /\s{2}/.test(value)) problems.push(`line ${line}: ${ASSET_CATEGORY_FIELDS[ASSET_PATH_LEVELS[i]]} carries stray whitespace (${JSON.stringify(value)})`);
        }
        rows.push({ id: `line ${line}`, ...Object.fromEntries(ASSET_PATH_LEVELS.map((level, i) => [level, cells[i]])), assetClass: LOADED_CLASS });
    }
    if (rows.length === 0) problems.push("it holds no rows");
    for (const aside of readCatalog(rows).setAside) problems.push(`${aside.category.id}: ${whyAside(aside)}`);
    return { rows, problems };
}

/** A row in the shape lib/assetCategory.js reads, from a REST record. */
function categoryOf(record) {
    const f = record.fields;
    return {
        id: record.id,
        itemName: f[NAME_FIELD] ?? "",
        ...Object.fromEntries(Object.entries(ASSET_CATEGORY_FIELDS).map(([key, name]) => [key, f[name] ?? ""])),
    };
}

/** A CSV row as the fields a create sends: each level it has, and its class. */
function fieldsOf(row) {
    return {
        ...Object.fromEntries(ASSET_PATH_LEVELS.filter((level) => row[level] !== "").map((level) => [ASSET_CATEGORY_FIELDS[level], row[level]])),
        [ASSET_CATEGORY_FIELDS.assetClass]: row.assetClass,
    };
}

async function main() {
    const apply = process.argv.includes("--apply");
    log(`load_asset_catalog_517${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);

    const source = relative(process.cwd(), CSV_PATH);
    const { rows, problems } = readSource();
    if (problems.length > 0) {
        log(`${source} cannot be loaded — ${problems.length} problem(s), nothing was read from or written to the base:`);
        for (const line of problems) log(`  ${line}`);
        return finish(null, 1, "the CSV is not loadable");
    }
    log(`${source}: ${rows.length} row(s), every one a row a registration may pick.`);

    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const air = new Airtable(token, baseId);

    const table = await air.table();
    const missing = table ? [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS)].filter((name) => !table.fields.some((f) => f.name === name)) : ["the table"];
    if (missing.length > 0) {
        log(`${TABLE_NAME} on base ${baseId} lacks ${missing.join(", ")} — run scripts/import/classify_asset_categories_514.mjs --apply first.`);
        return finish(air, 1, "the schema is not #514's");
    }

    const fields = [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS)];
    const before = (await air.listRecords(table.id, fields)).map(categoryOf);
    const held = new Set(before.map(catalogPathKey));
    const named = new Set(rows.map(catalogPathKey));
    const due = rows.filter((row) => !held.has(catalogPathKey(row)));
    log(`\n${TABLE_NAME} on base ${baseId} holds ${before.length} row(s): ${rows.length - due.length} of the CSV's paths, and ${before.filter((category) => !named.has(catalogPathKey(category))).length} the CSV does not name, left alone.`);

    if (due.length === 0) log("every CSV path is on the base already — nothing to create.");
    else {
        log(`${due.length} row(s) to create, in the CSV's order:`);
        for (const row of due) log(`  ${apply ? "[CREATE]" : "[WOULD] "} ${row.id.padEnd(9)} ${composeItemName(row)}`);
    }
    if (!apply && due.length > 0) return finish(air, 2, `dry run — ${due.length} row(s) due, nothing was written`);

    for (let i = 0; i < due.length; i += RECORDS_PER_REQUEST) {
        const chunk = due.slice(i, i + RECORDS_PER_REQUEST);
        const made = await air.createRecords(
            table.id,
            chunk.map((row) => ({ fields: fieldsOf(row) }))
        );
        log(`  created ${made.records.length}: ${chunk[0].id} to ${chunk[chunk.length - 1].id}`);
    }

    // --- read back: every CSV path on the base, named by the rule, and offered ----
    log(`\nreading the catalog back:`);
    const after = (await air.listRecords(table.id, fields)).map(categoryOf);
    const { offered, setAside } = readCatalog(after);
    const offeredByKey = new Map(offered.map((category) => [catalogPathKey(category), category]));
    const asideByKey = new Map(setAside.map((aside) => [catalogPathKey(aside.category), aside]));
    const failures = [];
    for (const row of rows) {
        const key = catalogPathKey(row);
        const category = offeredByKey.get(key);
        if (!category) {
            const aside = asideByKey.get(key);
            failures.push(`${row.id}: ${aside ? `on the base as ${aside.category.id}, which a registration cannot pick — ${whyAside(aside)}` : "no row on the base"}`);
        } else if (category.itemName !== composeItemName(category)) {
            failures.push(`${row.id}: ${category.id} is named ${JSON.stringify(category.itemName)}, the rule says ${JSON.stringify(composeItemName(category))}`);
        }
    }
    log(`  ${after.length} row(s) on the base, ${offered.length} a registration may pick.`);
    if (failures.length > 0) {
        log(`  ${failures.length} of the CSV's paths are not as they should be:`);
        for (const line of failures) log(`    ${line}`);
        return finish(air, 1, "the catalog does not hold the CSV");
    }
    log(`  every one of the CSV's ${rows.length} paths is on the base, named by the rule and offered.`);
    return finish(air, 0, "the catalog holds the CSV");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
