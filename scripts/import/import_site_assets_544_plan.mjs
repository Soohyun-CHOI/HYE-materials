// What `import_site_assets_544.mjs` judges, apart from the base it judges (#544): the list read
// whole, the ledgers read for what a run has made, the list against what the base holds, and the
// operations an apply would spend.
//
// A MODULE OF ITS OWN SO THE OFFLINE TIER CAN HOLD IT. The script imports `lib/airtable/client.js`,
// which throws without credentials, so a judgment kept inside it is reached only by a run against a
// base — and the judgments are the run's whole safety: an `existing` path held by one row, a `new`
// path by none, a missing group only one the review left to the run, every job the recorder's, the
// day's ids at three digits, and a second run writing nothing. `offline/asset-import-544.mjs` holds
// each of them against a base of its own making. Everything here is pure but `readList`'s read of
// the file and its digest, and it imports only modules the offline tier already loads.
//
// IT DECIDES NOTHING THE APP DECIDES. A path is `catalogPathKey`'s, a group `categoryGroupKey`'s
// and `readCategoryGroups`', a row a registration may pick `readCatalog`'s, a new path's refusals
// `readCatalogEntry`'s, a recorder's jobs `assignedJobsFor`'s and the day's next sequence
// `nextSequence`'s; what is here is which of those the list's three words ask, and what the run
// owes when they do not hold.
//
// THE LIST'S `class` IS READ BY ITS PLACE AND DECIDES NOTHING SINCE #552, which took the class off
// the catalog. The list stays as it was handed over and its digest with it, so its header and its
// cell count are still the whole list's; the column is still a cell that must carry no stray
// whitespace, and nothing else asks it — no path is created with it, no row is compared by it,
// no ledger line carries it. Until #552 a new path was created with the list's class, a held
// row's differing class was told, and two rows giving one new path two classes refused the run.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
    ASSET_CATEGORY_FIELDS,
    ASSET_PATH_LEVELS,
    catalogPathKey,
    categoryGroupKey,
    composeItemName,
    isPlaceholder,
    pathOf,
    readCatalog,
    readCategoryGroups,
} from "../../lib/assetCategory.js";
import { readCatalogEntry } from "../../lib/assetCatalog.js";
import { assignedJobsFor } from "../../lib/assetJob.js";
import { ID_KINDS, nextSequence } from "../../lib/idSequence.js";
import { normalizeItemText, textMatchKey } from "../../lib/itemNaming.js";

export const SCRIPT = "import_site_assets_544";
export const SOURCE = join(dirname(fileURLToPath(import.meta.url)), "sources", "asset_import_544.csv");

/**
 * The list's header as Soo wrote it, and what each column is read as, in its order — the eighth
 * the list's class, `listClass`, which nothing reads since #552 (the header).
 */
export const HEADER = "job,type,category,name,size,maker,part_number,class,quantity,catalog,source";
const COLUMNS = ["job", "level1", "level2", "level3", "size", "maker", "partNumber", "listClass", "quantity", "catalog", "source"];

/** What the catalog holds of a row's path, in the list's words. */
export const HOLDS = Object.freeze({ EXISTING: "existing", NEW: "new", ADD_PART: "existing (add part)" });

/** Who the `Created` rows are recorded by. */
export const RECORDER_EMAIL = "soo@hanyangengusa.com";

/**
 * The two types and categories the review left to this run to add, should the office not have
 * added them first (#544). A pair the list names that no group holds and that is not one of these
 * refuses the run.
 */
export const GROUPS_THIS_RUN_MAY_ADD = Object.freeze([
    Object.freeze({ level1: "Tool", level2: "For Welders" }),
    Object.freeze({ level1: "Tool", level2: "Other Tools" }),
]);

/** The highest sequence a day takes at the width `Asset ID` declares. */
export const HIGHEST_SEQUENCE = 10 ** ID_KINDS.ASSET.padLength - 1;

/** Airtable's ceiling on the rows one request writes. */
export const ROWS_PER_REQUEST = 10;

/** Rows a list request returns per page, and ids a batched read asks per request (`client.js`). */
const PAGE = 100;
const IDS_PER_READ = 50;

const pages = (rows) => Math.max(1, Math.ceil(rows / PAGE));
const reads = (ids) => Math.ceil(ids / IDS_PER_READ);
const writes = (rows) => Math.ceil(rows / ROWS_PER_REQUEST);

/** `items` cut into requests of ten. */
export const inChunks = (items) =>
    Array.from({ length: Math.ceil(items.length / ROWS_PER_REQUEST) }, (_, i) => items.slice(i * ROWS_PER_REQUEST, (i + 1) * ROWS_PER_REQUEST));

/** A row's path, in the catalog's levels. */
export const levelsOf = (row) => Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, row[level] ?? ""]));

/** A row named as the base names it, and its path said as one string. */
export const said = (row) => `${composeItemName(row)}  — ${pathOf(row)}`;

// ── the list ─────────────────────────────────────────────────────────────────

/** RFC 4180 enough for this file — create_material_categories_354.mjs' reader: quoted cells, a doubled quote, CRLF. */
function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c !== '"') cell += c;
            else if (text[i + 1] === '"') {
                cell += '"';
                i++;
            } else quoted = false;
        } else if (c === '"') quoted = true;
        else if (c === ",") {
            row.push(cell);
            cell = "";
        } else if (c === "\r") continue;
        else if (c === "\n") {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = "";
        } else cell += c;
    }
    if (cell !== "" || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }
    return rows;
}

/**
 * The list read whole, and every reason it cannot be: its rows, each with its file line and its
 * quantity as a number, and the file's digest. `bytes` is the file — the committed one unless a
 * check hands it another.
 *
 * THE DIGEST IS OF THE TEXT WITH ITS LINE ENDINGS AS GIT STORES THEM, `\n`. Git checks a `.csv`
 * out with `\r\n` on a machine whose `core.autocrlf` is set, as this repository's are, so a digest
 * of the bytes would name one list two ways; a ledger's `sha256` names the same list wherever the
 * run was made.
 */
export function readList(bytes = readFileSync(SOURCE)) {
    const text = Buffer.from(bytes).toString("utf8").replace(/\r\n/g, "\n");
    const parsed = parseCsv(text.replace(/^﻿/, ""));
    const problems = [];
    const header = (parsed[0] ?? []).join(",");
    if (header !== HEADER) problems.push(`the header is ${JSON.stringify(header)}, not ${JSON.stringify(HEADER)}`);
    const rows = [];
    for (const [index, cells] of parsed.slice(1).entries()) {
        const line = index + 2;
        if (cells.every((cell) => cell === "")) continue;
        if (cells.length !== COLUMNS.length) {
            problems.push(`line ${line}: ${cells.length} cell(s), not ${COLUMNS.length}`);
            continue;
        }
        const row = { line, ...Object.fromEntries(COLUMNS.map((column, i) => [column, cells[i]])) };
        const where = `line ${line} (${row.source})`;
        for (const column of COLUMNS) {
            if (row[column] !== normalizeItemText(row[column])) problems.push(`${where}: ${column} carries stray whitespace (${JSON.stringify(row[column])})`);
        }
        for (const level of ASSET_PATH_LEVELS) {
            if (isPlaceholder(row[level])) problems.push(`${where}: ${ASSET_CATEGORY_FIELDS[level]} is ${JSON.stringify(row[level])}, a placeholder for empty — leave it empty`);
        }
        if (!/^\d+$/.test(row.quantity) || Number(row.quantity) < 1) problems.push(`${where}: the quantity ${JSON.stringify(row.quantity)} is not a whole number above 0`);
        if (!Object.values(HOLDS).includes(row.catalog)) problems.push(`${where}: catalog is ${JSON.stringify(row.catalog)}, not one of ${Object.values(HOLDS).join(", ")}`);
        if (row.catalog === HOLDS.ADD_PART && row.partNumber === "") problems.push(`${where}: an add part row names no part number`);
        row.quantity = Number(row.quantity);
        rows.push(row);
    }
    const sources = new Map();
    for (const row of rows) sources.set(row.source, [...(sources.get(row.source) ?? []), row.line]);
    for (const [source, lines] of sources) if (source === "" || lines.length > 1) problems.push(`source ${JSON.stringify(source)} names line(s) ${lines.join(", ")}: each row needs a source of its own`);
    if (rows.length === 0) problems.push("the list holds no rows");
    return { rows, problems, sha256: createHash("sha256").update(text, "utf8").digest("hex") };
}

// ── the ledgers ──────────────────────────────────────────────────────────────

/** Whether a ledger's lines are a run of this script on `baseName` — a revert's own ledger is not. */
export function isRunLedgerOf(lines, baseName) {
    return lines[0]?.type === "run" && lines[0].script === SCRIPT && lines[0].base === baseName;
}

/**
 * What the ledgers say this script has made on a base — each `{ name, lines }` — as assets by
 * source, the catalog rows and groups it made, the part numbers it wrote, and every intent no
 * answer followed in its own ledger.
 */
export function ledgered(ledgers) {
    const assets = [];
    const catalogIds = new Set();
    const groupIds = new Set();
    const parts = [];
    const unanswered = [];
    for (const { name, lines } of ledgers) {
        const open = new Map();
        for (const line of lines) {
            if (line.type === "group") groupIds.add(line.id);
            if (line.type === "catalog") catalogIds.add(line.id);
            if (line.type === "part") parts.push({ ...line, ledger: name });
            if (line.type === "intent") open.set(line.source, line);
            if (line.type === "assets") {
                open.delete(line.source);
                for (const asset of line.assets) assets.push({ ...asset, source: line.source, jobRecordId: line.jobRecordId, categoryRecordId: line.categoryRecordId, ledger: name });
            }
        }
        for (const intent of open.values()) unanswered.push({ ...intent, ledger: name });
    }
    return { assets, catalogIds, groupIds, parts, unanswered };
}

// ── the plan ─────────────────────────────────────────────────────────────────

/**
 * The list against the base: what each row's path is on the catalog and how many of its items are
 * due, the groups, paths and part numbers to write, the day's sequence, and every problem — each a
 * refusal — and every note, which is told and refuses nothing.
 *
 * `read` is what the script read: `catalog` and `groups` as their readers map them, `jobs` as
 * `getAllJobs` maps them, `recorder` as `getUserByEmail`, `standing` the ledgers' assets the base
 * still holds, `dayIds` the ids on `prefix` — the day `lib/ids.js` mints under — and `list` the
 * list's rows. `done` is `ledgered`'s answer.
 */
export function plan(read, done) {
    const problems = [];
    const notes = [];
    const { catalog, groups, jobs, recorder, standing, prefix, dayIds, list } = read;
    const byPath = new Map();
    for (const category of catalog) byPath.set(catalogPathKey(category), [...(byPath.get(catalogPathKey(category)) ?? []), category]);
    const onPath = (row) => byPath.get(catalogPathKey(row)) ?? [];
    const { offered: offeredRows, setAside: asideRows } = readCatalog(catalog);
    const offered = new Set(offeredRows.map((category) => category.id));
    const setAside = new Map(asideRows.map((aside) => [aside.category.id, aside.reason]));
    const where = (row) => `line ${row.line} (${row.source})`;

    // The recorder.
    if (!recorder) problems.push(`${RECORDER_EMAIL} is not on Users`);
    else if (recorder.status !== "Active") problems.push(`${RECORDER_EMAIL} is ${recorder.status ?? "of no status"}, not Active`);

    // The jobs, by their code as the list spells it, each one the recorder's own: a registration files
    // on nothing else (`readRegistration`).
    const jobOf = new Map();
    for (const code of [...new Set(list.map((row) => row.job))]) {
        const exact = jobs.filter((job) => job.jobCode === code);
        if (exact.length === 1) jobOf.set(code, exact[0]);
        else if (exact.length > 1) problems.push(`job ${code}: ${exact.length} rows of Jobs carry that code`);
        else {
            const near = jobs.filter((job) => textMatchKey(job.jobCode) === textMatchKey(code)).map((job) => job.jobCode);
            problems.push(`job ${code} is not on Jobs${near.length ? ` (${near.join(", ")} is, spelled otherwise)` : ""}`);
        }
    }
    const assigned = new Set(assignedJobsFor(recorder, jobs).map((job) => job.id));
    for (const [code, job] of jobOf) if (recorder && !assigned.has(job.id)) problems.push(`job ${code}: ${RECORDER_EMAIL} is not assigned to it, and a registration files only on the registrant's own jobs`);

    // The groups: every type and category the list names stands, or is one this run may add.
    const groupOf = new Map(readCategoryGroups(groups).offered.map((group) => [categoryGroupKey(group), group]));
    const groupsToCreate = [];
    const ungrouped = new Map();
    for (const row of list) {
        const key = categoryGroupKey(row);
        const group = groupOf.get(key);
        if (group) {
            if (group.level2 !== row.level2) notes.push(`${where(row)}: the list spells the category ${JSON.stringify(row.level2)} where its group spells ${JSON.stringify(group.level2)}`);
            continue;
        }
        if (groupsToCreate.some((pending) => categoryGroupKey(pending) === key)) continue;
        if (GROUPS_THIS_RUN_MAY_ADD.some((pair) => categoryGroupKey(pair) === key)) groupsToCreate.push({ level1: row.level1, level2: row.level2 });
        else ungrouped.set(key, [...(ungrouped.get(key) ?? []), row]);
    }
    for (const rowsOfPair of ungrouped.values()) {
        const [first] = rowsOfPair;
        problems.push(`no group holds ${first.level1} > ${first.level2}, and it is not one this run may add — ${rowsOfPair.map((row) => row.source).join(", ")}`);
    }

    // The ledgers' assets: which still stand, by source.
    const standingIds = new Set(standing.map((asset) => asset.id));
    const standingOf = new Map();
    for (const asset of done.assets) {
        if (standingIds.has(asset.id)) standingOf.set(asset.source, [...(standingOf.get(asset.source) ?? []), asset]);
    }
    for (const asset of standing) if (asset.assetLog.length === 0) notes.push(`${asset.assetId} stands with no Created row — a registration whose log pass failed, which nothing writes late`);
    for (const intent of done.unanswered) {
        problems.push(`${intent.source}: a registration of ${intent.count} began at ${intent.at} (${intent.ledger}) and its answer is not in the ledger — its assets may stand; read the base before running again`);
    }

    // Each row's path.
    const pathsToCreate = new Map();
    const partsToAdd = [];
    const rows = [];
    for (const row of list) {
        const held = onPath(row);
        const ours = held.filter((category) => done.catalogIds.has(category.id));
        const stand = standingOf.get(row.source)?.length ?? 0;
        let category = null;
        let due = row.quantity - stand;
        if (due < 0) {
            problems.push(`${where(row)}: ${stand} of its items stand, more than its ${row.quantity}`);
            due = 0;
        }
        if (row.catalog === HOLDS.EXISTING) {
            if (held.length !== 1) problems.push(`${where(row)}: existing, and the catalog holds ${held.length} row(s) on ${pathOf(row)}`);
            else if (ours.length > 0) problems.push(`${where(row)}: existing, and its row ${held[0].id} is one this script made`);
            else {
                category = held[0];
                if (!offered.has(category.id)) problems.push(`${where(row)}: its row ${category.id} is not one a registration may pick (${setAside.get(category.id)})`);
            }
        } else if (row.catalog === HOLDS.NEW) {
            if (held.length === 0) {
                const key = catalogPathKey(row);
                const pending = pathsToCreate.get(key);
                if (pending) pending.sources.push(row.source);
                else pathsToCreate.set(key, { entry: levelsOf(row), sources: [row.source] });
            } else if (held.length === 1 && ours.length === 1) category = held[0];
            else problems.push(`${where(row)}: new, and the catalog holds ${held.map((c) => `${c.id} ${JSON.stringify(c.itemName)}`).join(", ")} on its path`);
        } else if (row.catalog === HOLDS.ADD_PART) {
            const targetPath = { ...levelsOf(row), partNumber: "" };
            const targets = byPath.get(catalogPathKey(targetPath)) ?? [];
            const wrote = held.length === 1 && done.parts.some((part) => part.id === held[0].id && part.after === row.partNumber);
            if (wrote) category = held[0];
            else if (held.length > 0) problems.push(`${where(row)}: add part, and the catalog already holds ${held.map((c) => c.id).join(", ")} on ${pathOf(row)}`);
            else if (targets.length !== 1) problems.push(`${where(row)}: add part, and the catalog holds ${targets.length} row(s) on ${pathOf(targetPath)}, its target`);
            else if (targets[0].assets.length > 0) problems.push(`${where(row)}: add part, and ${targets[0].assets.length} item(s) stand on its target ${targets[0].id}, which the part number would rename`);
            else {
                const target = targets[0];
                // The target's own levels, and the list's part number: nothing else of the row moves.
                const entry = { ...levelsOf(target), partNumber: row.partNumber };
                const refused = readCatalogEntry(entry, { rows: catalog, groups, editing: target.id }).fields;
                if (refused) problems.push(`${where(row)}: the catalog's page would refuse the part number — ${Object.entries(refused).map(([k, v]) => `${k}: ${v}`).join("; ")}`);
                partsToAdd.push({ row, category: target, entry });
                category = target;
            }
        }
        rows.push({ row, category, due, job: jobOf.get(row.job) ?? null, stand });
    }

    // Each new path, asked of the catalog page's reading for its refusals alone.
    for (const { entry, sources } of pathsToCreate.values()) {
        const refused = readCatalogEntry(entry, { rows: catalog, groups }).fields;
        if (refused) problems.push(`${sources.join(", ")}: the catalog's page would refuse ${said(entry)} — ${Object.entries(refused).map(([k, v]) => `${k}: ${v}`).join("; ")}`);
        const named = catalog.find((other) => categoryGroupKey(other) === categoryGroupKey(entry) && textMatchKey(other.level3) === textMatchKey(entry.level3));
        if (named && named.level3 !== entry.level3) notes.push(`${sources.join(", ")}: the list spells the name ${JSON.stringify(entry.level3)} where ${named.id} spells ${JSON.stringify(named.level3)}`);
    }

    // The day's sequence: every id due fits at three digits, and no id is on the day twice already.
    const dueTotal = rows.reduce((sum, { due }) => sum + due, 0);
    const highest = nextSequence(dayIds, prefix) - 1;
    const last = highest + dueTotal;
    if (dueTotal > 0 && last > HIGHEST_SEQUENCE) {
        problems.push(`${prefix} holds ${dayIds.length} id(s), the highest -${String(highest).padStart(3, "0")}, and ${dueTotal} more would end at -${last}: past -${HIGHEST_SEQUENCE}, four digits`);
    }
    const repeated = [...new Set(dayIds.filter((id, i) => dayIds.indexOf(id) !== i))];
    if (repeated.length > 0) problems.push(`${prefix} already holds the id(s) ${repeated.join(", ")} twice`);

    return { problems, notes, rows, groupsToCreate, pathsToCreate: [...pathsToCreate.values()], partsToAdd, prefix, dayIds, highest, last, dueTotal };
}

/**
 * The operations an apply would spend, reckoned from the plan: a page per hundred rows on every
 * list read, a request per fifty ids on a batched read, a request per ten rows written — each
 * registration reading the day's ids as they stand when it begins.
 */
export function forecast(p, read, done) {
    let catalogRows = read.catalog.length;
    const lines = [];
    lines.push(["the plan's reads (catalog, groups, jobs, recorder, the ledgers' assets, the day)", pages(catalogRows) + 1 + pages(read.jobs.length) + 1 + reads(done.assets.length) + pages(read.dayIds.length)]);
    lines.push([`${p.groupsToCreate.length} group(s): the groups read again under the pair's lock and one create each`, p.groupsToCreate.length * 2]);
    let catalogOps = 0;
    for (let i = 0; i < p.pathsToCreate.length; i++) catalogOps += pages(catalogRows++) + 1;
    lines.push([`${p.pathsToCreate.length} catalog row(s): the catalog read again under the path's lock and one create each`, catalogOps]);
    lines.push([`${p.partsToAdd.length} part number(s): the catalog read again under the path's lock and one update`, p.partsToAdd.length * (pages(catalogRows) + 1)]);
    lines.push(["the catalog read again before the registrations", p.dueTotal > 0 ? pages(catalogRows) : 0]);
    let day = read.dayIds.length;
    let registerOps = 0;
    let registrations = 0;
    for (const { due } of p.rows) {
        if (due === 0) continue;
        registrations++;
        registerOps += pages(day) + writes(due) + writes(due);
        day += due;
    }
    lines.push([`${registrations} registration(s): the day's ids read under its lock, then ten assets and ten Created rows a request`, registerOps]);
    // Every asset a ledger names is asked for, a gone one too; only those standing have a log to read.
    const everyAsset = done.assets.length + p.dueTotal;
    const standingAfter = read.standing.length + p.dueTotal;
    lines.push(["the read back (catalog, groups, jobs, every asset, their logs, the day)", pages(catalogRows) + 1 + pages(read.jobs.length) + reads(everyAsset) + reads(standingAfter) + pages(day)]);
    return { lines, total: lines.reduce((sum, [, n]) => sum + n, 0) };
}
