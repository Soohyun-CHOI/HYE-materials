// Replaces the asset catalog with the office's revised list, and loads the category groups it
// files under (issue #528).
//
// WHAT IT LOADS. Two lists the office handed over, committed under `sources/` as they came —
// every value and the UTF-8 byte-order mark, the line endings Git's: `asset_categories_528.csv`,
// the revised catalog, 45 rows of seven columns, the six levels and `Class`; and
// `asset_category_groups_528.csv`, the 20 types and categories the catalog files under, nine
// of them with nothing filed under them yet. The groups go to `Asset Category Groups`, which
// `classify_asset_categories_514.mjs --apply` makes; this refuses while it is missing.
//
// BOTH LISTS ARE JUDGED WHOLE BEFORE ANYTHING IS READ FROM THE BASE, by the readings the app and
// the check use: each header as one string, the cells to a row, no stray whitespace, every
// catalog row one `readCatalog` offers with its own class, every group one
// `readCategoryGroups` stands, and every catalog row's type and category one of the groups
// (`groupCatalog`). One row failing refuses the run, as #517's load refused.
//
// A PATH BOTH LISTS NAME KEEPS ITS ROW. A row is its path, the six levels under
// `catalogPathKey`: where the base holds the revised list's path, that row IS the revised row
// — kept, every asset under it with it, and its `Class` set to the list's, the one value the
// office changed on it. Twenty of the 45 are such rows. A path the base does not hold is
// created, in the list's order, ten to a request with no `typecast`; 25 of the 45. So no path
// is held by two rows at any moment, and no row needs telling from another by when it was made.
//
// AN ASSET ON A ROW THAT GOES MOVES FIRST, TO THE SAME ITEM. A row the revised list does not
// name goes, and an asset under it moves to the revised row with its type, name, size, maker
// and part number — every level but the category, which is what the office renamed: `Equipment
// > Welding > TIG Welder > Lincoln Electric > TIG 205` is `Welding Equipment`'s now. Exactly one
// such row, or the run refuses and names the asset. The asset's `Category` link is the one
// write; `Status`, `Job` and its log stay, since a catalog revised is nothing that happened to it.
//
// THE REMOVAL IS A SECOND RUN, `--remove`, AND IT TAKES A ROW ONLY ON TWO COUNTS: the revised
// list does not name its path, and #517's list (`sources/asset_categories_517.csv`) does. It
// refuses before writing if the revised list is not wholly on the base with its classes, if a
// group is missing, if an asset stands on a row about to go, or if a row the revised list does
// not name is outside #517's list — a row the office added by hand is not this issue's to take.
// Records in this base are not removed as tidying-up (CLAUDE.md): these go because #528
// replaces the list they were loaded from, and the list a dry run prints is read and agreed
// before the run that removes them.
//
// TWO LEDGERS, COMMITTED, IN `ledgers/`, for rewrite_po_year_313.mjs' reason. `--apply` writes,
// before the first value it overwrites, each `Class` it changes and each `Category` it moves,
// before and after; a row it creates needs none, as #517's load kept none. `--remove` writes
// every row about to go, each field as the API returned it, before the first delete.
//
// `--revert <ledger>` PUTS A LEDGER BACK. A removal's rows are created again — the levels and
// the class, under new record ids, which nothing outside the catalog holds — refusing before a
// write if the base holds any of their paths. A class goes back to its `before`, and a moved
// asset back to the row on its `before` path, found by path since a removal's revert re-creates
// that row under a new id; each refusing before a write unless the base still reads as the run
// left it. So the way back from both runs is the removal's ledger first, then the load's.
//
// SINCE #531 A RUN THAT WOULD MOVE AN ASSET IS REFUSED WHOLE, before its first write and in the
// dry run too — a load whose plan holds a move, a revert whose ledger does. `Assets` holds the
// site's records, which no script writes (`scripts/protectedTables.mjs`), and refusing only the
// moves would leave the catalog revised over assets still on the rows it replaces. A load with
// no move and the removal, whose rows no asset stands on, run as before.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's other scripts do, and counts its calls,
// which lib/airtableOps.js cannot see. The CSV reader is load_asset_catalog_517.mjs', which is
// create_material_categories_354.mjs' with the byte-order mark taken off first.
//
// AFTER THIS ISSUE THE BASE IS THE OFFICE'S, AND A RUN READS IT AS SUCH. An `--apply` sets every
// kept row's class back to the list's, so a class the office changes in Airtable afterwards is
// put back by a later `--apply`: read the dry run, which names every class it would change,
// before running one. Not observed — nothing has run it since.
//
// SINCE #539 IT STOPS BEFORE IT READS A ROW, as #517's load stops since this one ran. The catalog
// files each row under its group by `Category Group`, and `Level 1` and `Level 2` are lookups
// through it, which a load and a revert here write as typed text
// (`link_category_groups_539_plan.mjs:filedByLink`).
//
// Usage (from the repo root). Dry run is the DEFAULT, for each run and for a revert:
//   node --env-file=.env.local scripts/import/replace_asset_catalog_528.mjs
//   node --env-file=.env.local scripts/import/replace_asset_catalog_528.mjs --apply
//   node --env-file=.env.local scripts/import/replace_asset_catalog_528.mjs --remove
//   node --env-file=.env.local scripts/import/replace_asset_catalog_528.mjs --remove --apply
//   node --env-file=.env.local scripts/import/replace_asset_catalog_528.mjs --revert <ledger.jsonl> [--apply]
//
// No loader flag: this file and lib/assetCategory.js import only built-ins and files whose
// extension they spell.
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds what the run is for — the
// revised list and its groups, or nothing of the earlier list; 1 something failed or was
// refused; 2 nothing failed but something is still to do (a dry run).

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
    ASSET_CATEGORY_FIELDS,
    ASSET_GROUP_LEVELS,
    ASSET_PATH_LEVELS,
    catalogPathKey,
    categoryGroupKey,
    composeItemName,
    groupCatalog,
    pathOf,
    readCatalog,
    readCategoryGroups,
} from "../../lib/assetCategory.js";
import { textMatchKey } from "../../lib/itemNaming.js";
import { refusesProtectedWrite } from "../protectedTables.mjs";
import { FILED_BY_LINK_REFUSAL, filedByLink } from "./link_category_groups_539_plan.mjs";
import { resolveAirtableBase } from "../../lib/airtableBase.js";
import { CLASS_FIELD } from "./keep_asset_class_552_plan.mjs";

// The catalog's fields as this script read and wrote them: lib/assetCategory.js's path and the
// class, which #552 took off the catalog and lib/ names no longer, its name from
// keep_asset_class_552_plan.mjs. The run stops on the base as it stands before it reads a row,
// so nothing here reaches the class; it is kept as the record of what ran.
const CATALOG_FIELDS = Object.freeze({ ...ASSET_CATEGORY_FIELDS, assetClass: CLASS_FIELD.name });

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(HERE, "sources");
const LEDGERS = join(HERE, "ledgers");
const LEDGER_PREFIX = "replace_asset_catalog_528-";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/**
 * The three lists, each with its header as the office wrote it. A list's columns are levels in
 * the order a path says them, so a cell is read by its place, and a field renamed later leaves
 * a list as it is. The revised catalog carries the class; #517's did not.
 */
const REVISED = { file: "asset_categories_528.csv", header: "Level 1 Category,Level 2 Category,Level 3 Category,Size,Maker,Part Number,Class", levels: [...ASSET_PATH_LEVELS, "assetClass"] };
const GROUPS = { file: "asset_category_groups_528.csv", header: "Level 1 Category,Level 2 Category", levels: ASSET_GROUP_LEVELS };
const EARLIER = { file: "asset_categories_517.csv", header: "Level 1 Category,Level 2 Category,Level 3 Category,Size,Maker,Part Number", levels: ASSET_PATH_LEVELS };

/** The tables, and the fields of `Assets` a move reads and writes. */
const CATALOG_TABLE = "Asset Categories";
const GROUPS_TABLE = "Asset Category Groups";
const ASSETS_TABLE = "Assets";
const ASSET_ID = "Asset ID";
const ASSET_CATEGORY = "Category";
const NAME_FIELD = "Item Name";

/** What makes two rows the same item: every level but the category, which the revision renamed. */
const ITEM_LEVELS = ASSET_PATH_LEVELS.filter((level) => level !== "level2");
const itemKey = (row) => ITEM_LEVELS.map((level) => textMatchKey(row?.[level])).join("\n");

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

    async tables() {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`);
        return tables;
    }

    /** Every row of a table, every field. */
    async listRecords(tableId) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100" });
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

    /** The batch form, which refuses an id that is not this table's (airtable-access.md). */
    updateRecords(tableId, records) {
        return this.request("PATCH", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }

    /** The batch form, which refuses an id that is not this table's. */
    async deleteRecords(tableId, ids) {
        const params = new URLSearchParams();
        for (const id of ids) params.append("records[]", id);
        const { records } = await this.request("DELETE", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
        const gone = records.filter((record) => record.deleted).map((record) => record.id);
        if (gone.length !== ids.length) throw new Error(`asked to delete ${ids.join(", ")} and ${gone.join(", ") || "none"} went`);
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

const inChunks = (items) => Array.from({ length: Math.ceil(items.length / RECORDS_PER_REQUEST) }, (_, i) => items.slice(i * RECORDS_PER_REQUEST, (i + 1) * RECORDS_PER_REQUEST));

/** RFC 4180 enough for these files: quoted cells, a doubled quote inside one, CRLF. */
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

/** One list's rows, each carrying its line, and every reason the list cannot be read. */
function readList(list) {
    const parsed = parseCsv(readFileSync(join(SOURCES, list.file), "utf8").replace(/^﻿/, ""));
    const problems = [];
    const header = (parsed[0] ?? []).join(",");
    if (header !== list.header) problems.push(`${list.file}: the header is ${JSON.stringify(header)}, not ${JSON.stringify(list.header)}`);
    const rows = [];
    for (const [index, cells] of parsed.slice(1).entries()) {
        const line = index + 2;
        if (cells.every((cell) => cell === "")) continue;
        if (cells.length !== list.levels.length) {
            problems.push(`${list.file} line ${line}: ${cells.length} cell(s), not ${list.levels.length}`);
            continue;
        }
        for (const [i, value] of cells.entries()) {
            if (value !== value.trim() || /\s{2}/.test(value)) problems.push(`${list.file} line ${line}: ${CATALOG_FIELDS[list.levels[i]]} carries stray whitespace (${JSON.stringify(value)})`);
        }
        rows.push({ id: `line ${line}`, ...Object.fromEntries(list.levels.map((level, i) => [level, cells[i]])) });
    }
    if (rows.length === 0) problems.push(`${list.file}: it holds no rows`);
    return { rows, problems };
}

/** Why a row is not offered, or no group, in the words of the fields the office types into. */
function whyAside({ reason, missing, levels, of }) {
    if (reason === "incomplete") return `missing ${missing.map((m) => CATALOG_FIELDS[m]).join(", ")}`;
    if (reason === "placeholder") return `a placeholder for empty in ${levels.map((m) => CATALOG_FIELDS[m]).join(", ")} — leave the cell empty`;
    return `${of.id} already names it`;
}

/** The three lists, judged whole: the revised catalog and its groups by the app's readings. */
function readSources() {
    const revised = readList(REVISED);
    const groups = readList(GROUPS);
    const earlier = readList(EARLIER);
    const problems = [...revised.problems, ...groups.problems, ...earlier.problems];
    for (const aside of readCatalog(revised.rows).setAside) problems.push(`${REVISED.file} ${aside.category.id}: ${whyAside(aside)}`);
    for (const aside of readCategoryGroups(groups.rows).setAside) problems.push(`${GROUPS.file} ${aside.group.id}: ${whyAside(aside)}`);
    for (const category of groupCatalog(revised.rows, groups.rows).ungrouped) problems.push(`${REVISED.file} ${category.id}: no group in ${GROUPS.file} holds ${pairOf(category)}`);
    return { revised: revised.rows, groups: groups.rows, earlier: earlier.rows, problems };
}

/** A row's type and category as a path says them. */
const pairOf = (row) => pathOf({ level1: row.level1, level2: row.level2 });

/** A REST record as a catalog row, the shape lib/assetCategory.js reads. */
function categoryOf(record) {
    return {
        id: record.id,
        itemName: record.fields[NAME_FIELD] ?? "",
        assets: record.fields.Assets ?? [],
        ...Object.fromEntries(Object.entries(CATALOG_FIELDS).map(([key, name]) => [key, record.fields[name] ?? ""])),
    };
}

/** A REST record of `Asset Category Groups`, its two levels. */
function groupOf(record) {
    return { id: record.id, ...Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [level, record.fields[CATALOG_FIELDS[level]] ?? ""])) };
}

/** A list row as the fields a create sends: each level it has, and its class where it has one. */
function fieldsOf(row, levels) {
    return Object.fromEntries(levels.filter((level) => (row[level] ?? "") !== "").map((level) => [CATALOG_FIELDS[level], row[level]]));
}

/** The levels of a row, for a ledger: what a path is said and keyed by. */
const levelsOf = (row) => Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, row[level] ?? ""]));

/** The three tables' ids and every row of each. */
async function readBase(air) {
    const tables = await air.tables();
    const id = (name) => tables.find((t) => t.name === name)?.id ?? null;
    const ids = { catalog: id(CATALOG_TABLE), groups: id(GROUPS_TABLE), assets: id(ASSETS_TABLE) };
    if (!ids.catalog || !ids.assets) throw new Error(`no ${!ids.catalog ? CATALOG_TABLE : ASSETS_TABLE} table`);
    return {
        ids,
        catalogRecords: await air.listRecords(ids.catalog),
        groups: ids.groups ? (await air.listRecords(ids.groups)).map(groupOf) : [],
        assets: await air.listRecords(ids.assets),
    };
}

/**
 * The base against the lists: which revised rows it holds and which are to create, each kept
 * row whose class differs, the groups to create, the rows the revised list does not name — and
 * of those the ones outside #517's list — and each asset on one of those with the item it moves
 * to. A path held twice is a problem, since a row is its path.
 */
function plan(base, sources) {
    const catalog = base.catalogRecords.map(categoryOf);
    const byPath = new Map();
    for (const category of catalog) byPath.set(catalogPathKey(category), [...(byPath.get(catalogPathKey(category)) ?? []), category]);
    const problems = [...byPath.values()].filter((rows) => rows.length > 1).map((rows) => `the base holds ${rows.map((r) => r.id).join(", ")} on one path, ${JSON.stringify(rows[0].itemName)}`);

    const revisedKeys = new Set(sources.revised.map(catalogPathKey));
    const earlierKeys = new Set(sources.earlier.map(catalogPathKey));
    const held = (row) => byPath.get(catalogPathKey(row))?.[0] ?? null;
    const toCreate = sources.revised.filter((row) => !held(row));
    const classes = sources.revised.filter((row) => held(row) && held(row).assetClass !== row.assetClass).map((row) => ({ row, category: held(row) }));
    const standing = new Set(readCategoryGroups(base.groups).offered.map(categoryGroupKey));
    const groupsToCreate = sources.groups.filter((group) => !standing.has(categoryGroupKey(group)));

    const going = catalog.filter((category) => !revisedKeys.has(catalogPathKey(category)));
    const outside = going.filter((category) => !earlierKeys.has(catalogPathKey(category)));
    const goingIds = new Set(going.map((category) => category.id));
    const moves = [];
    for (const asset of base.assets) {
        const from = catalog.find((category) => (asset.fields[ASSET_CATEGORY] ?? []).includes(category.id));
        if (!from || !goingIds.has(from.id)) continue;
        const same = sources.revised.filter((row) => itemKey(row) === itemKey(from));
        if (same.length !== 1) {
            problems.push(`${asset.fields[ASSET_ID]} stands on ${JSON.stringify(from.itemName)}, which goes, and the revised list holds ${same.length} row(s) of its item`);
            continue;
        }
        moves.push({ asset, from, to: same[0], toCategory: held(same[0]) });
    }
    return { catalog, byPath, toCreate, classes, groupsToCreate, going, outside, moves, problems };
}

function printLoadPlan(p) {
    log(`groups to create: ${p.groupsToCreate.length}`);
    for (const group of p.groupsToCreate) log(`  [GROUP]  ${pairOf(group)}`);
    log(`catalog rows to create: ${p.toCreate.length}`);
    for (const row of p.toCreate) log(`  [CREATE] ${row.id.padEnd(8)} ${composeItemName(row)}  — ${pairOf(row)}, class ${row.assetClass}`);
    log(`kept rows whose class changes: ${p.classes.length}`);
    for (const { row, category } of p.classes) log(`  [CLASS]  ${category.id}  ${JSON.stringify(category.itemName)}  ${category.assetClass || "(none)"} → ${row.assetClass}`);
    log(`assets to move: ${p.moves.length}`);
    for (const { asset, from, to, toCategory } of p.moves) log(`  [MOVE]   ${asset.fields[ASSET_ID]}  ${pathOf(from)}  →  ${pathOf(to)}${toCategory ? ` (${toCategory.id})` : " (a row to create)"}`);
}

function printRemoval(p) {
    log(`rows the revised list does not name: ${p.going.length}, ${p.outside.length} of them outside #517's list`);
    const byPair = new Map();
    for (const category of p.going) byPair.set(pairOf(category), [...(byPair.get(pairOf(category)) ?? []), category]);
    for (const [pair, rows] of byPair) {
        log(`  ${pair} — ${rows.length}`);
        for (const category of rows) log(`      ${category.id}  ${JSON.stringify(category.itemName)}  class ${category.assetClass}${category.assets.length ? `  ${category.assets.length} ASSET(S)` : ""}${p.outside.includes(category) ? "  OUTSIDE #517's LIST" : ""}`);
    }
}

function writeLedger(lines) {
    const ledger = join(LEDGERS, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    appendFileSync(ledger, lines.map((line) => JSON.stringify(line)).join("\n") + "\n", "utf8");
    log(`\nledger: ${relative(process.cwd(), ledger)}  (${lines.length} line(s); commit it)`);
    return ledger;
}

/**
 * Whether the base holds the revised list and its groups: every list row on its own row, with
 * the list's class and the name the rule gives it; every group standing; no asset on a row the
 * list does not name. The failures, each a line.
 */
function verifyLoad(base, sources) {
    const p = plan(base, sources);
    const failures = [...p.problems];
    for (const row of sources.revised) {
        const category = p.byPath.get(catalogPathKey(row))?.[0];
        if (!category) failures.push(`${row.id} ${composeItemName(row)}: no row on the base`);
        else if (category.assetClass !== row.assetClass) failures.push(`${category.id} ${JSON.stringify(category.itemName)}: class ${category.assetClass}, the list says ${row.assetClass}`);
        else if (category.itemName !== composeItemName(category)) failures.push(`${category.id}: named ${JSON.stringify(category.itemName)}, the rule says ${JSON.stringify(composeItemName(category))}`);
    }
    if (!base.ids.groups) failures.push(`${GROUPS_TABLE} is not on the base`);
    for (const group of p.groupsToCreate) failures.push(`no group stands for ${pairOf(group)}`);
    for (const { asset } of p.moves) failures.push(`${asset.fields[ASSET_ID]} still stands on a row the revised list does not name`);
    const offered = readCatalog(p.catalog).offered.length;
    return { p, failures, offered };
}

async function load(air, apply, sources) {
    let base = await readBase(air);
    if (!base.ids.groups) {
        log(`${GROUPS_TABLE} is not on the base — run scripts/import/classify_asset_categories_514.mjs --apply first.`);
        return finish(air, 1, "refused: the groups' table is missing");
    }
    const p = plan(base, sources);
    log(`${base.catalogRecords.length} catalog row(s), ${base.groups.length} group row(s) and ${base.assets.length} asset(s) on the base; the revised list holds ${sources.revised.length - p.toCreate.length} of its ${sources.revised.length} paths already.\n`);
    if (p.problems.length > 0) {
        for (const line of p.problems) log(`  ${line}`);
        return finish(air, 1, "refused before writing anything");
    }
    printLoadPlan(p);
    const due = p.groupsToCreate.length + p.toCreate.length + p.classes.length + p.moves.length;
    if (due === 0) log("\nnothing to load: the base holds the revised list and its groups.");
    // A move writes an asset's `Category`, and since #531 no script writes `Assets`
    // (`scripts/protectedTables.mjs`) — so a plan holding one is refused whole, the dry run
    // included, before the groups and the catalog rows it would write first.
    const loadWrites = [
        ...(p.groupsToCreate.length ? [GROUPS_TABLE] : []),
        ...(p.toCreate.length + p.classes.length ? [CATALOG_TABLE] : []),
        ...(p.moves.length ? [ASSETS_TABLE] : []),
    ];
    if (refusesProtectedWrite({ script: "replace_asset_catalog_528", baseId: air.baseId, writes: loadWrites, log })) {
        return finish(air, 1, "refused before writing anything");
    }
    if (!apply && due > 0) return finish(air, 2, `dry run — ${due} write(s) due, nothing was written`);

    if (due > 0) {
        // The creates first: nothing they write was there to overwrite, so they need no ledger.
        for (const chunk of inChunks(p.groupsToCreate)) {
            await air.createRecords(base.ids.groups, chunk.map((group) => ({ fields: fieldsOf(group, ASSET_GROUP_LEVELS) })));
        }
        if (p.groupsToCreate.length) log(`\n  created ${p.groupsToCreate.length} group(s)`);
        for (const chunk of inChunks(p.toCreate)) {
            const made = await air.createRecords(base.ids.catalog, chunk.map((row) => ({ fields: fieldsOf(row, [...ASSET_PATH_LEVELS, "assetClass"]) })));
            log(`  created ${made.records.length} catalog row(s): ${chunk[0].id} to ${chunk[chunk.length - 1].id}`);
        }

        // Then what overwrites a value, after the ledger holds it: a move's target read back by its
        // path, so it is the row just created where it was one.
        if (p.classes.length + p.moves.length > 0) {
            const after = plan(await readBase(air), sources);
            const targetOf = (row) => after.byPath.get(catalogPathKey(row))?.[0];
            const lines = [
                ...p.classes.map(({ row, category }) => ({ table: CATALOG_TABLE, field: CATALOG_FIELDS.assetClass, id: category.id, name: category.itemName, before: category.assetClass, after: row.assetClass })),
                ...p.moves.map(({ asset, from, to }) => ({ table: ASSETS_TABLE, field: ASSET_CATEGORY, id: asset.id, assetId: asset.fields[ASSET_ID], before: [from.id], after: [targetOf(to).id], beforeLevels: levelsOf(from), afterLevels: levelsOf(to) })),
            ];
            writeLedger(lines);
            for (const chunk of inChunks(lines.filter((line) => line.table === CATALOG_TABLE))) {
                await air.updateRecords(base.ids.catalog, chunk.map((line) => ({ id: line.id, fields: { [line.field]: line.after } })));
            }
            if (p.classes.length) log(`  set ${p.classes.length} kept row(s)' class`);
            for (const chunk of inChunks(lines.filter((line) => line.table === ASSETS_TABLE))) {
                await air.updateRecords(base.ids.assets, chunk.map((line) => ({ id: line.id, fields: { [line.field]: line.after } })));
            }
            if (p.moves.length) log(`  moved ${p.moves.length} asset(s)`);
        }
    }

    log(`\nreading the base back:`);
    base = await readBase(air);
    const { p: now, failures, offered } = verifyLoad(base, sources);
    log(`  ${base.catalogRecords.length} catalog row(s), ${offered} a registration may pick; ${base.groups.length} group row(s).`);
    if (failures.length > 0) {
        for (const line of failures) log(`    ${line}`);
        return finish(air, 1, "the base does not hold the revised list");
    }
    log(`  every revised path is on its own row with the list's class and the rule's name, every group stands, and no asset is on a row to go.`);
    log(`\nnext, a run of its own — scripts/import/replace_asset_catalog_528.mjs --remove:`);
    printRemoval(now);
    return finish(air, 0, "the base holds the revised list and its groups");
}

async function remove(air, apply, sources) {
    const base = await readBase(air);
    const { p, failures } = verifyLoad(base, sources);
    printRemoval(p);
    const refusals = [
        ...failures.map((line) => `the load is not done: ${line}`),
        ...p.outside.map((category) => `${category.id} ${JSON.stringify(category.itemName)} is in neither list`),
        ...p.going.filter((category) => category.assets.length > 0).map((category) => `${category.id} ${JSON.stringify(category.itemName)} holds ${category.assets.length} asset(s)`),
    ];
    if (refusals.length > 0) {
        log(`\nrefused:`);
        for (const line of refusals) log(`  ${line}`);
        return finish(air, 1, "refused before removing anything");
    }
    if (p.going.length === 0) return finish(air, 0, "nothing of the earlier list is left");
    // Catalog rows alone, none of them under an asset (refused above), so this answers no
    // (#531) — asked all the same, so every write this script makes is asked.
    if (refusesProtectedWrite({ script: "replace_asset_catalog_528 --remove", baseId: air.baseId, writes: [CATALOG_TABLE], log })) {
        return finish(air, 1, "refused before removing anything");
    }
    if (!apply) return finish(air, 2, `dry run — ${p.going.length} row(s) would go, nothing was removed`);

    const ledger = writeLedger(base.catalogRecords.filter((record) => p.going.some((category) => category.id === record.id)).map((record) => ({ table: CATALOG_TABLE, removed: true, id: record.id, createdTime: record.createdTime, fields: record.fields })));
    for (const chunk of inChunks(p.going.map((category) => category.id))) await air.deleteRecords(base.ids.catalog, chunk);
    log(`  removed ${p.going.length} catalog row(s)`);

    log(`\nreading the base back:`);
    const after = await readBase(air);
    const { p: left, failures: still } = verifyLoad(after, sources);
    log(`  ${after.catalogRecords.length} catalog row(s), ${after.groups.length} group row(s), ${after.assets.length} asset(s).`);
    if (left.going.length > 0 || still.length > 0) {
        for (const line of still) log(`    ${line}`);
        log(`  ${left.going.length} row(s) the revised list does not name are still there`);
        return finish(air, 1, `the earlier list is not wholly gone — run it again, and keep ${relative(process.cwd(), ledger)}`);
    }
    return finish(air, 0, "nothing of the earlier list is left, and the base holds the revised list");
}

async function revert(air, apply, ledgerPath) {
    const lines = readFileSync(ledgerPath, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
    const removed = lines.filter((line) => line.removed);
    const classes = lines.filter((line) => line.table === CATALOG_TABLE && !line.removed);
    const moves = lines.filter((line) => line.table === ASSETS_TABLE);
    log(`${relative(process.cwd(), ledgerPath)}: ${removed.length} removed row(s), ${classes.length} class(es), ${moves.length} move(s)\n`);

    // Refused before anything is written: a path the base holds, or a value no longer as the run left it.
    const base = await readBase(air);
    const catalog = base.catalogRecords.map(categoryOf);
    const onPath = (levels) => catalog.filter((category) => catalogPathKey(category) === catalogPathKey(levels));
    const assetOf = (id) => base.assets.find((asset) => asset.id === id);
    const refusals = [
        ...removed.filter((line) => onPath(categoryOf(line)).length > 0).map((line) => `the path of ${line.id}, ${JSON.stringify(line.fields[NAME_FIELD])}, is on the base`),
        ...classes.filter((line) => catalog.find((category) => category.id === line.id)?.assetClass !== line.after).map((line) => `${line.id} ${JSON.stringify(line.name)} no longer reads class ${line.after}`),
        ...moves.filter((line) => JSON.stringify(assetOf(line.id)?.fields[ASSET_CATEGORY] ?? null) !== JSON.stringify(line.after)).map((line) => `${line.assetId} no longer stands on ${line.after.join(", ")}`),
        ...moves.filter((line) => onPath(line.beforeLevels).length !== 1).map((line) => `${line.assetId}: the base holds ${onPath(line.beforeLevels).length} row(s) on ${pathOf(line.beforeLevels)} — revert the removal's ledger first`),
    ];
    if (refusals.length > 0) {
        for (const line of refusals) log(`  ${line}`);
        return finish(air, 1, "refused before writing anything");
    }
    for (const line of moves) log(`  [MOVE]   ${line.assetId} back to ${pathOf(line.beforeLevels)} (${onPath(line.beforeLevels)[0].id})`);
    for (const line of classes) log(`  [CLASS]  ${line.id} ${JSON.stringify(line.name)} ${line.after} → ${line.before}`);
    if (removed.length) log(`  [CREATE] ${removed.length} catalog row(s) again`);
    // A move back writes an asset's `Category`, which no script may since #531, so a ledger
    // holding one is refused whole, the dry run included.
    const revertWrites = [...(removed.length + classes.length ? [CATALOG_TABLE] : []), ...(moves.length ? [ASSETS_TABLE] : [])];
    if (refusesProtectedWrite({ script: "replace_asset_catalog_528 --revert", baseId: air.baseId, writes: revertWrites, log })) {
        return finish(air, 1, "refused before writing anything");
    }
    if (!apply) return finish(air, 2, `dry run — ${lines.length} line(s) would be put back, nothing was written`);

    for (const chunk of inChunks(removed)) {
        await air.createRecords(base.ids.catalog, chunk.map((line) => ({ fields: Object.fromEntries(Object.values(CATALOG_FIELDS).filter((name) => line.fields[name] !== undefined).map((name) => [name, line.fields[name]])) })));
    }
    for (const chunk of inChunks(classes)) await air.updateRecords(base.ids.catalog, chunk.map((line) => ({ id: line.id, fields: { [line.field]: line.before } })));
    for (const chunk of inChunks(moves)) await air.updateRecords(base.ids.assets, chunk.map((line) => ({ id: line.id, fields: { [line.field]: [onPath(line.beforeLevels)[0].id] } })));

    const after = await readBase(air);
    const now = after.catalogRecords.map(categoryOf);
    const missing = [
        ...removed.filter((line) => !now.some((category) => catalogPathKey(category) === catalogPathKey(categoryOf(line)))).map((line) => line.id),
        ...classes.filter((line) => now.find((category) => category.id === line.id)?.assetClass !== line.before).map((line) => line.id),
        ...moves.filter((line) => !now.some((category) => (category.assets ?? []).includes(line.id) && catalogPathKey(category) === catalogPathKey(line.beforeLevels))).map((line) => line.assetId),
    ];
    if (missing.length > 0) return finish(air, 1, `${missing.length} line(s) did not read back: ${missing.join(", ")}`);
    return finish(air, 0, `every line of the ledger is back, ${lines.length} in all`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    const at = process.argv.indexOf("--revert");
    const ledgerPath = at === -1 ? null : process.argv[at + 1];
    const removal = process.argv.includes("--remove");
    log(`replace_asset_catalog_528${ledgerPath ? "  (REVERT)" : removal ? "  (REMOVAL)" : ""}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);
    if (at !== -1 && !ledgerPath) {
        log("--revert takes the ledger's path");
        return 1;
    }

    const sources = readSources();
    if (sources.problems.length > 0) {
        log(`the lists cannot be loaded — ${sources.problems.length} problem(s), nothing was read from or written to the base:`);
        for (const line of sources.problems) log(`  ${line}`);
        return finish(null, 1, "the lists are not loadable");
    }
    log(`${REVISED.file}: ${sources.revised.length} row(s), each one a registration may pick, each in one of the ${sources.groups.length} groups of ${GROUPS.file}; ${EARLIER.file}: ${sources.earlier.length} row(s).\n`);

    let airtable;
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const { apiKey: token, baseId } = airtable;
    const air = new Airtable(token, baseId);
    if (filedByLink(await air.tables())) {
        log(FILED_BY_LINK_REFUSAL);
        return finish(air, 1, "refused: the catalog files by link since #539");
    }
    if (ledgerPath) return revert(air, apply, ledgerPath);
    return removal ? remove(air, apply, sources) : load(air, apply, sources);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
