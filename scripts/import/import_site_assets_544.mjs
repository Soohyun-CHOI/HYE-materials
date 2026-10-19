// Registers the tools and equipment of three sites — 25-USA-13, 26-USA-12 and 23-USA-09 — from
// the list Soo reviewed against the catalog (#544).
//
// ONE SOURCE, `sources/asset_import_544.csv`, KEPT AS IT WAS HANDED OVER — the byte-order mark
// and the notes column with it. The two sites' spreadsheets were matched against the live base's
// catalog and its category groups and settled into this one list before the script existed, and
// nothing here reads them. A row is one registration: a job, a catalog path in its six levels, a
// class, how many to register, what the catalog holds of the path (`catalog`: `existing`, `new` or
// `existing (add part)`), the spreadsheet row it came from (`source`, the run's key for it) and a
// note nothing reads. The cells are written as the list spells them: no rule of
// `lib/itemNaming.js` is asked to spell a name, since the list is already in the catalog's shape.
//
// WHAT A RUN WRITES, IN ORDER. The category groups the list names and no group holds — only
// `Tool > For Welders` and `Tool > Other Tools`, the two the review left to this run; any other
// missing pair refuses the run. Each `new` path once, however many rows name it, with its class.
// The part number of each `existing (add part)` row onto the row that has none — `Band Saw,
// DeWalt` taking `DCS375`, a row no item stands under. Then each row's items, in the list's order,
// and the `Created` row of each.
//
// EVERY WRITE IS ONE OF THE APP'S OWN WRITERS, SO NO RULE HERE IS A SECOND COPY. A group is
// `createAssetCategoryGroup`, a path `createAssetCategory` and a part number `updateAssetCategory`
// — the catalog page's writers (#527), each reading the catalog again under its key's lock and
// writing nothing over a path another row holds. A row's items are the registration's two writes
// (#338, #470): `createAssets`, which mints `HYE-AST-YYMMDD-###` under the day's lock
// (`lib/ids.js`), ten to a request, and writes the cache — `In stock` and the job — with each
// asset; then `createFirstAssetLogEntries`, each asset's `Created` row on the same job, recorded
// by soo@. What a registration may be is `readRegistration`'s, asked with soo@'s own jobs and the
// catalog as read after the catalog's own writes, as the dialog's action asks it; what a new path
// may be is `readCatalogEntry`'s, asked for its refusals alone — the entry it hands back is never
// what is written. Only the revert writes with nothing of the app's to write through: the app
// deletes no asset and no group, so those deletes are this script's, ten to a request.
//
// THE LIST IS JUDGED AGAINST THE BASE BEFORE ANYTHING IS WRITTEN, the dry run's whole work, in
// `import_site_assets_544_plan.mjs`, which the offline tier holds (`offline/asset-import-544.mjs`).
// Every cell read as a level, no placeholder for empty (`isPlaceholder`); every `existing` path
// held by exactly one row a registration may pick, every `new` path by none, and each `add part`
// target held by one row with no part number and no item; every type and category a standing group
// but the two above; every job on `Jobs` and among the recorder's own, since a registration files on
// nothing else; the recorder on `Users`; and the day's sequence able to take every id due at three
// digits. One failure refuses the run.
//
// THREE DIGITS, AND WHY THE RUN REFUSES A FOURTH. `createAssets` mints MAX + 1 over the day's
// prefix and `padStart` does not truncate, so the 1000th asset of a day is `-1000` (#335). That is
// not a collision, but it sorts before `-101`, and a label carrying one more character than the
// symbol was sized for (#412) is not a label anyone has printed. So the dry run reads the day's
// highest sequence and refuses a run whose last id would pass 999; the day is the process
// clock's, as `lib/ids.js` reads it, which on this machine is not UTC.
//
// TEN TO A REQUEST, ONE AT A TIME, AND PACED. Every create goes through `createRecords` or a
// writer of one row, so no request carries more than ten rows and none is sent while another is in
// flight but a batched read's own chunks. Airtable takes five requests a second on a base;
// `paceRequests` holds the start of each request a quarter of a second after the one before, on the
// SDK's one funnel, so a run stays under it by construction rather than by the 429 the SDK
// retries. The forecast the dry run prints is reckoned from the plan, a page per hundred rows read.
//
// A LEDGER, COMMITTED, AND THE RE-RUN IT MAKES SAFE. `--apply` writes `ledgers/
// import_site_assets_544-{base}-{time}.jsonl` as it goes, one line per write and every line on disk
// before the next write: the run itself, each group and catalog row made, the part number's before
// and after BEFORE it is written, each registration's intent before its first request, the assets
// it made — record id and `Asset ID` against the list's `source` — and the assets left unlogged. A
// run reads every ledger of this script for the base it reaches and asks the base which of their
// rows still stand: a list row whose assets stand is not registered again, one short of its
// quantity registers the rest, and an intent with no answer refuses the run until somebody has
// read the base, since its assets may have landed. So a second run writes nothing.
//
// `--revert <ledger>` TAKES BACK WHAT ONE LEDGER MADE, AND NOTHING ELSE. Each `Created` row and
// asset it names, its part number put back, each catalog row and group it made — refusing before
// any write if an asset carries a row of history beyond its `Created` one, or if anything stands
// on a catalog row or a group the ledger made but the ledger's own items, or if the part number is
// no longer the one it wrote. Every row about to go is written to a revert ledger first,
// `import_site_assets_544-revert-{base}-{time}.jsonl`. **A revert frees the day's highest ids**
// (#335): the next registration that day mints them again, so on a base whose labels are printed it
// is a revert of something no label has been stuck to yet.
//
// ON THE LIVE BASE IT IS THE ONE SCRIPT THAT ADDS TO `Assets` AND `Asset Log` (#531, #544), and only
// as `scripts/protectedTables.mjs:refusesBeyondLedger` lets it, asked of every request to either as it
// leaves the SDK's funnel (`fenceRequests`): reads; until the registrations begin, no write at all;
// then creates shaped exactly as a registration's, each `Created` row on an asset this run's own
// create answered with; in a revert, deletes of the rows its checks passed and nothing else; and no
// update of either table ever. `refusesProtectedWrite` is asked of the catalog's tables, and refuses
// this script on the two as it refuses every script. A refused request is never sent.
//
// Usage (from the repo root). Dry run is the DEFAULT, for a run and for a revert:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/import_site_assets_544.mjs
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/import_site_assets_544.mjs --apply
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/import_site_assets_544.mjs --revert <ledger.jsonl> [--apply]
// The live base only by naming it, per command: `AIRTABLE_BASE=live node …`.
//
// Airtable PAT scopes: data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds what the list asks for — or, for a
// revert, nothing the ledger made; 1 something failed or was refused; 2 nothing failed and writes
// are due (a dry run).

import { appendFileSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLES, base, findByRecordIds } from "../../lib/airtable/client.js";
import {
    createAssetCategory,
    getAllAssetCategories,
    removeAssetCategory,
    updateAssetCategory,
} from "../../lib/airtable/assetCategories.js";
import { createAssetCategoryGroup, getAllAssetCategoryGroups } from "../../lib/airtable/assetCategoryGroups.js";
import { createAssets, getAssetsByRecordIds } from "../../lib/airtable/assets.js";
import { createFirstAssetLogEntries } from "../../lib/airtable/assetLog.js";
import { getAllJobs } from "../../lib/airtable/jobs.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { ASSET_CATEGORY_FIELDS, catalogPathKey, categoryGroupKey, composeItemName, pathOf, readCatalog } from "../../lib/assetCategory.js";
import { readRegistration } from "../../lib/assetRegistration.js";
import { assignedJobsFor } from "../../lib/assetJob.js";
import { ASSET_EVENT, ASSET_STATUS } from "../../lib/assetStatus.js";
import { ID_KINDS, dailyIdPrefix } from "../../lib/idSequence.js";
import { prefixMatch } from "../../lib/airtableFormula.js";
import { LIVE_BASE_ID, describeAirtableBase, resolveAirtableBase } from "../../lib/airtableBase.js";
import { snapshot } from "../../lib/airtableOps.js";
import { refusesBeyondLedger, refusesProtectedWrite } from "../protectedTables.mjs";
import { HOLDS, RECORDER_EMAIL, SCRIPT, SOURCE, forecast, inChunks, isRunLedgerOf, ledgered, levelsOf, plan, readList, said } from "./import_site_assets_544_plan.mjs";

const LEDGERS = join(dirname(fileURLToPath(import.meta.url)), "ledgers");

/** The gap held between the starts of two requests: four a second, under Airtable's five. */
const REQUEST_GAP_MS = 250;

function log(message = "") {
    console.log(message);
}

/**
 * What `refusesBeyondLedger` lets this run send to `Assets` and `Asset Log` on the live base
 * (#544): creates once the registrations begin, each `Created` row on an asset in `created` — filled
 * from the answers to this run's own creates — and, in a revert, deletes of `deletes` alone. Empty
 * until a step widens it, so a request sent before then is refused.
 */
const ledgerFence = { creates: false, created: new Map(), deletes: new Set() };

/**
 * The SDK's one funnel — the `runAction` `lib/airtableOps.js` counts on (and pins the version of),
 * wrapped over the counter so a request is still counted once — fenced and paced. Each request is
 * asked of `refusesBeyondLedger` as it leaves, and one it refuses is answered with an error and
 * never sent, so the writer that made it throws and the run stops; then each starts `gapMs` after
 * the one before. An answer to this run's create of assets fills the fence's `created`. A 429's
 * retry is the SDK's own and does not come back through it.
 */
function fenceRequests(baseFunctor, gapMs) {
    const instance = baseFunctor._base;
    const inner = instance.runAction;
    let next = 0;
    const fenced = function (method, path, queryParams, body, callback) {
        const request = { method, path, queryParams, body };
        if (refusesBeyondLedger({ script: SCRIPT, baseId: baseFunctor.getId(), request, allowed: ledgerFence, log })) {
            setTimeout(() => callback(new Error(`refused before sending: ${String(method).toUpperCase()} ${path}`)), 0);
            return;
        }
        const assetsCreated = String(method).toLowerCase() === "post" && decodeURIComponent(String(path).split("/")[1] ?? "") === TABLES.ASSETS;
        const answer = (error, response, result) => {
            if (!error && assetsCreated) for (const record of result?.records ?? []) ledgerFence.created.set(record.id, record.fields?.[ID_KINDS.ASSET.idField]);
            callback(error, response, result);
        };
        const now = Date.now();
        const at = Math.max(now, next);
        next = at + gapMs;
        setTimeout(() => inner.call(instance, method, path, queryParams, body, answer), at - now);
    };
    instance.runAction = fenced;
    baseFunctor.runAction = fenced;
}

function finish(code, verdict) {
    log("");
    log(`${snapshot().total} Airtable operation(s). ${verdict}.`);
    return code;
}

// ── the ledgers ──────────────────────────────────────────────────────────────

/** Every line of one ledger. */
function readLedger(path) {
    return readFileSync(path, "utf8")
        .split("\n")
        .filter((text) => text.trim() !== "")
        .map((text) => JSON.parse(text));
}

/** Every run ledger of this script for one base, oldest first — a revert's own ledger aside. */
function runLedgers(baseName) {
    return readdirSync(LEDGERS)
        .filter((name) => name.startsWith(`${SCRIPT}-${baseName}-`) && name.endsWith(".jsonl"))
        .sort()
        .map((name) => ({ name, lines: readLedger(join(LEDGERS, name)) }))
        .filter(({ lines }) => isRunLedgerOf(lines, baseName));
}

/**
 * A ledger that writes as the run goes, each line on disk before the next write: a run's
 * `import_site_assets_544-{base}-{time}.jsonl`, a revert's `import_site_assets_544-revert-{base}-{time}.jsonl`.
 */
function openLedger(kind, first) {
    const path = join(LEDGERS, `${SCRIPT}-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const write = (line) => appendFileSync(path, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write(first);
    return { path, write };
}

// ── the base ─────────────────────────────────────────────────────────────────

/** The rows of `Assets` whose id carries `prefix` — the day `lib/ids.js` mints under — by id alone. */
async function assetIdsOnDay(prefix) {
    const records = await base(TABLES.ASSETS)
        .select({ filterByFormula: prefixMatch(ID_KINDS.ASSET.idField, prefix), fields: [ID_KINDS.ASSET.idField] })
        .all();
    return records.map((record) => record.get(ID_KINDS.ASSET.idField));
}

/** Everything the plan reads, and which of the ledgers' assets still stand. */
async function readBase(list, done) {
    const [catalog, groups, jobs, recorder] = await Promise.all([
        getAllAssetCategories(),
        getAllAssetCategoryGroups(),
        getAllJobs(),
        getUserByEmail(RECORDER_EMAIL),
    ]);
    const standing = await getAssetsByRecordIds(done.assets.map((asset) => asset.id));
    const prefix = dailyIdPrefix(ID_KINDS.ASSET, new Date());
    const dayIds = await assetIdsOnDay(prefix);
    return { catalog, groups, jobs, recorder, standing, prefix, dayIds, list };
}

function printPlan(p, read, done) {
    log(`${read.catalog.length} catalog row(s), ${read.groups.length} group row(s), ${read.jobs.length} job(s) on the base; the recorder ${RECORDER_EMAIL} is ${read.recorder ? read.recorder.id : "missing"}.`);
    log(`the ledgers name ${done.assets.length} asset(s), ${read.standing.length} of them standing.`);
    log("");
    log(`groups to create: ${p.groupsToCreate.length}`);
    for (const group of p.groupsToCreate) log(`  [GROUP]  ${group.level1} > ${group.level2}`);
    log(`catalog rows to create: ${p.pathsToCreate.length}`);
    for (const { entry, sources } of p.pathsToCreate) log(`  [CREATE] ${said(entry)}, class ${entry.assetClass}  (${sources.join(", ")})`);
    log(`part numbers to add: ${p.partsToAdd.length}`);
    for (const { row, category } of p.partsToAdd) log(`  [PART]   ${category.id} ${JSON.stringify(category.itemName)} takes ${JSON.stringify(row.partNumber)}  (${row.source}; ${category.assets.length} item(s) on it)`);
    log("");
    log(`registrations, in the list's order:`);
    const byJob = new Map();
    for (const { row, category, due, stand } of p.rows) {
        const on = category ? category.id : row.catalog === HOLDS.NEW ? "(to create)" : "(none)";
        const tail = stand > 0 ? `  ${stand} standing, ${due} due` : "";
        log(`  ${row.source.padEnd(9)} ${row.job}  ${String(row.quantity).padStart(3)} × ${composeItemName(row)}  [${row.catalog}] ${on}${tail}`);
        const job = byJob.get(row.job) ?? { rows: 0, items: 0, due: 0 };
        byJob.set(row.job, { rows: job.rows + 1, items: job.items + row.quantity, due: job.due + due });
    }
    log("");
    log("items by job:");
    for (const [code, job] of byJob) log(`  ${code}  ${job.rows} row(s), ${job.items} item(s), ${job.due} due`);
    log(`  in all  ${p.rows.length} row(s), ${p.rows.reduce((s, { row }) => s + row.quantity, 0)} item(s), ${p.dueTotal} due`);
    log("");
    log(
        `the day: ${p.prefix} holds ${p.dayIds.length} asset id(s), the highest ${p.highest === 0 ? "none" : `-${String(p.highest).padStart(3, "0")}`}; ` +
            (p.dueTotal > 0 ? `${p.dueTotal} due would run -${String(p.highest + 1).padStart(3, "0")} to -${String(p.last).padStart(3, "0")}.` : "nothing due.")
    );
    const ops = forecast(p, read, done);
    log("");
    log(`operations an apply would spend, forecast:`);
    for (const [what, n] of ops.lines) log(`  ${String(n).padStart(4)}  ${what}`);
    log(`  ${String(ops.total).padStart(4)}  in all, at four requests a second at most — ${Math.ceil(ops.total / 4)} s or more`);
    if (p.notes.length > 0) {
        log("");
        log(`notes, which refuse nothing: ${p.notes.length}`);
        for (const note of p.notes) log(`  ${note}`);
    }
}

// ── the read back ────────────────────────────────────────────────────────────

/**
 * Whether the base holds what the list asks for: each list row's items standing in its number, on
 * its catalog row and its job, each with its `Created` row recorded by soo@ — an asset whose history
 * has gone on since may have left the job and the stock, which is told and fails nothing — every id
 * of three digits and none twice on its day, and every path and group the list needs.
 */
async function readBack(list, baseName, recorder) {
    const done = ledgered(runLedgers(baseName));
    const [catalog, groups, jobs, standing] = await Promise.all([
        getAllAssetCategories(),
        getAllAssetCategoryGroups(),
        getAllJobs(),
        getAssetsByRecordIds(done.assets.map((asset) => asset.id)),
    ]);
    const logRows = await findByRecordIds(TABLES.ASSET_LOG, standing.flatMap((asset) => asset.assetLog));
    const logById = new Map(logRows.map((record) => [record.id, record]));
    const failures = [];
    const told = [];
    const assetOf = new Map(standing.map((asset) => [asset.id, asset]));
    const jobByCode = new Map(jobs.map((job) => [job.jobCode, job]));
    const byPath = new Map();
    for (const category of catalog) byPath.set(catalogPathKey(category), [...(byPath.get(catalogPathKey(category)) ?? []), category]);

    // A ledger stands whole or not at all: one whose assets partly stand was taken back in part.
    for (const name of [...new Set(done.assets.map((asset) => asset.ledger))]) {
        const its = done.assets.filter((asset) => asset.ledger === name);
        const up = its.filter((asset) => assetOf.has(asset.id)).length;
        if (up > 0 && up < its.length) failures.push(`${name}: ${up} of its ${its.length} asset(s) stand`);
    }

    const perJob = new Map();
    const perPath = new Map();
    const days = new Set();
    for (const row of list) {
        const job = jobByCode.get(row.job);
        const held = byPath.get(catalogPathKey(row)) ?? [];
        if (held.length !== 1) failures.push(`${row.source}: the catalog holds ${held.length} row(s) on ${pathOf(row)}`);
        const category = held[0] ?? null;
        if (row.catalog === HOLDS.NEW && category && category.assetClass !== row.assetClass) failures.push(`${row.source}: ${category.id} is class ${category.assetClass}, the list says ${row.assetClass}`);
        if (category && category.itemName !== composeItemName(category)) told.push(`${category.id} is named ${JSON.stringify(category.itemName)}, the rule says ${JSON.stringify(composeItemName(category))}`);
        if (!groups.some((group) => categoryGroupKey(group) === categoryGroupKey(row))) failures.push(`${row.source}: no group holds ${row.level1} > ${row.level2}`);
        const mine = done.assets.filter((asset) => asset.source === row.source && assetOf.has(asset.id));
        if (mine.length !== row.quantity) failures.push(`${row.source}: ${mine.length} item(s) stand, the list asks ${row.quantity}`);
        perJob.set(row.job, (perJob.get(row.job) ?? 0) + mine.length);
        if (category) {
            const tally = perPath.get(category.id) ?? { category, n: 0, asked: 0 };
            perPath.set(category.id, { category, n: tally.n + mine.length, asked: tally.asked + row.quantity });
        }
        for (const entry of mine) {
            const asset = assetOf.get(entry.id);
            if (asset.assetId !== entry.assetId) failures.push(`${entry.id} reads ${asset.assetId}, the ledger ${entry.assetId}`);
            if (!/^HYE-AST-\d{6}-\d{3}$/.test(asset.assetId)) failures.push(`${asset.assetId} is not of three digits`);
            days.add(asset.assetId.slice(0, asset.assetId.lastIndexOf("-")));
            if (category && asset.category[0] !== category.id) failures.push(`${asset.assetId} stands on ${asset.category[0]}, not ${category.id}`);
            if (category && !category.assets.includes(asset.id)) failures.push(`${asset.assetId} is not among ${category.id}'s assets`);
            const created = asset.assetLog.map((id) => logById.get(id)).find((record) => record?.get("Asset Log ID") === `${asset.assetId}-001`);
            if (!created) failures.push(`${asset.assetId} has no ${asset.assetId}-001`);
            else {
                if (created.get("Event") !== ASSET_EVENT.CREATED) failures.push(`${asset.assetId}-001 is ${created.get("Event")}`);
                if (created.get("Job")?.[0] !== job?.id) failures.push(`${asset.assetId}-001 is on ${created.get("Job")?.[0]}, not ${row.job}`);
                if (created.get("Recorded By")?.[0] !== recorder.id) failures.push(`${asset.assetId}-001 was recorded by ${created.get("Recorded By")?.[0]}`);
            }
            if (asset.assetLog.length === 1) {
                if (asset.status !== ASSET_STATUS.IN_STOCK) failures.push(`${asset.assetId} is ${asset.status} with nothing after its Created row`);
                if (asset.job[0] !== job?.id) failures.push(`${asset.assetId} is on ${asset.job[0]} with nothing after its Created row`);
                if (!job?.assets.includes(asset.id)) failures.push(`${asset.assetId} is not among ${row.job}'s assets`);
            } else told.push(`${asset.assetId} has ${asset.assetLog.length} rows of history, and is ${asset.status} now`);
        }
    }
    for (const day of days) {
        const ids = await assetIdsOnDay(day);
        const twice = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
        if (twice.length > 0) failures.push(`${day} holds ${twice.join(", ")} twice`);
    }
    return { failures, told, perJob, perPath };
}

function printReadBack(list, back) {
    log("items standing by job, against the list:");
    const asked = new Map();
    for (const row of list) asked.set(row.job, (asked.get(row.job) ?? 0) + row.quantity);
    for (const [code, n] of asked) log(`  ${code}  ${back.perJob.get(code) ?? 0} of ${n}`);
    log(`items standing by catalog row, against the list: ${back.perPath.size} row(s)`);
    for (const { category, n, asked: want } of [...back.perPath.values()].sort((a, b) => a.category.itemName.localeCompare(b.category.itemName))) {
        log(`  ${category.id}  ${String(n).padStart(3)} of ${String(want).padStart(3)}  ${category.itemName}  (${category.assets.length} on the row in all)`);
    }
    if (back.told.length > 0) {
        log(`told, failing nothing: ${back.told.length}`);
        for (const line of back.told) log(`  ${line}`);
    }
}

async function report(list, baseName, recorder) {
    const back = await readBack(list.rows, baseName, recorder);
    printReadBack(list.rows, back);
    if (back.failures.length > 0) {
        log(`failures: ${back.failures.length}`);
        for (const line of back.failures) log(`  ${line}`);
        return finish(1, "the base does not hold what the list asks for");
    }
    return finish(0, "the base holds every item the list asks for, each on its job and its catalog row with its Created row");
}

// ── a run ────────────────────────────────────────────────────────────────────

async function load(apply, list, baseName) {
    const done = ledgered(runLedgers(baseName));
    const read = await readBase(list.rows, done);
    const p = plan(read, done);
    printPlan(p, read, done);
    if (p.problems.length > 0) {
        log("");
        log(`refused — ${p.problems.length} problem(s):`);
        for (const line of p.problems) log(`  ${line}`);
        return finish(1, "refused before writing anything");
    }
    const due = p.groupsToCreate.length + p.pathsToCreate.length + p.partsToAdd.length + p.dueTotal;

    // The catalog's tables are asked of `refusesProtectedWrite`, which refuses this script's writes to
    // `Assets` and `Asset Log` on the live base as it does every script's (#531); those go out under
    // `refusesBeyondLedger` instead, request by request at the funnel (#544).
    const loadWrites = [
        ...(p.groupsToCreate.length ? [TABLES.ASSET_CATEGORY_GROUPS] : []),
        ...(p.pathsToCreate.length + p.partsToAdd.length ? [TABLES.ASSET_CATEGORIES] : []),
    ];
    if (refusesProtectedWrite({ script: SCRIPT, baseId: base.getId(), writes: loadWrites, log })) {
        return finish(1, "refused before writing anything");
    }
    if (due === 0) {
        log("");
        log("nothing due: the list's groups, paths, part numbers and items are on the base. Reading it back:");
        return report(list, baseName, read.recorder);
    }
    if (!apply) return finish(2, `dry run — ${due} write(s) due (${p.dueTotal} item(s)), nothing was written`);

    const ledger = openLedger(baseName, { type: "run", script: SCRIPT, base: baseName, source: relative(process.cwd(), SOURCE), sha256: list.sha256, recordedBy: read.recorder.id });
    log("");
    log(`ledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);

    for (const group of p.groupsToCreate) {
        const made = await createAssetCategoryGroup(group);
        if (!made.created) return finish(1, `${group.level1} > ${group.level2} stood by the time it was written — run again, which plans with it`);
        ledger.write({ type: "group", id: made.created.id, ...group });
        log(`  [GROUP]  ${group.level1} > ${group.level2}  ${made.created.id}`);
    }
    for (const { entry, sources } of p.pathsToCreate) {
        const made = await createAssetCategory(entry);
        if (!made.created) return finish(1, `${said(entry)} was on the catalog by the time it was written (${made.exists.id}) — nothing after it was written`);
        ledger.write({ type: "catalog", id: made.created.id, ...entry, itemName: made.created.itemName, sources });
        log(`  [CREATE] ${made.created.id}  ${made.created.itemName}`);
    }
    for (const { row, category, entry } of p.partsToAdd) {
        ledger.write({ type: "part", id: category.id, field: ASSET_CATEGORY_FIELDS.partNumber, before: category.partNumber, after: entry.partNumber, levels: levelsOf(category), assetClass: category.assetClass, source: row.source });
        const made = await updateAssetCategory(category.id, entry);
        if (!made.updated) return finish(1, `${category.id}'s part number was not written (${made.gone ? "the row is gone" : `${made.exists.id} holds the path`})`);
        log(`  [PART]   ${category.id}  ${made.updated.itemName}`);
    }

    // The catalog as it stands after its own writes, which a registration picks from, and the
    // recorder's own jobs, which it files on — `registerAssetsHandler`'s two readings.
    const catalog = await getAllAssetCategories();
    const offered = readCatalog(catalog).offered;
    const byPath = new Map(catalog.map((category) => [catalogPathKey(category), category]));
    const ownJobs = assignedJobsFor(read.recorder, read.jobs);
    // The registrations begin: the fence lets their creates out, each `Created` row on an asset
    // this run's own create answered with.
    ledgerFence.creates = true;
    for (const { row, due: count, job } of p.rows) {
        if (count === 0) continue;
        const category = byPath.get(catalogPathKey(row));
        const reading = readRegistration({ categoryRecordId: category?.id, quantity: String(count), jobId: job.id }, ownJobs, offered);
        if (!reading.registration) return finish(1, `${row.source}: the registration would refuse it — ${JSON.stringify(reading.fields ?? reading.error)}`);
        ledger.write({ type: "intent", source: row.source, line: row.line, count, jobRecordId: job.id, categoryRecordId: category.id });
        const { created, failure } = await createAssets({ categoryRecordId: category.id, jobRecordId: job.id, count });
        ledger.write({
            type: "assets",
            source: row.source,
            line: row.line,
            jobRecordId: job.id,
            categoryRecordId: category.id,
            asked: count,
            assets: created.map((asset) => ({ id: asset.id, assetId: asset.assetId })),
            failure: failure ? String(failure.message ?? failure) : null,
        });
        if (created.length === 0) return finish(1, `${row.source}: no asset was written (${failure?.message ?? "no answer"})`);
        const { unlogged } = await createFirstAssetLogEntries({ assets: created, jobRecordId: job.id, recordedByUserId: read.recorder.id });
        ledger.write({ type: "logged", source: row.source, unlogged });
        log(`  [ITEMS]  ${row.source.padEnd(9)} ${row.job}  ${created.length} of ${count}  ${created[0].assetId} to ${created[created.length - 1].assetId}  ${category.itemName}`);
        if (created.length < count || unlogged.length > 0) {
            log(`  ${count - created.length} not written, ${unlogged.length} without a Created row (${unlogged.join(", ") || "none"}) — the run stops here, as a registration does on a failed request.`);
            break;
        }
    }

    log("");
    log("reading the base back:");
    return report(list, baseName, read.recorder);
}

// ── a revert ─────────────────────────────────────────────────────────────────

async function revert(apply, ledgerPath, baseName) {
    const lines = readLedger(ledgerPath);
    const name = relative(process.cwd(), ledgerPath);
    if (lines[0]?.type !== "run" || lines[0].script !== SCRIPT) {
        log(`${name} is not a run ledger of ${SCRIPT}`);
        return finish(1, "refused before writing anything");
    }
    if (lines[0].base !== baseName) {
        log(`${name} was written on the ${lines[0].base} base, and this run reaches the ${baseName} one`);
        return finish(1, "refused before writing anything");
    }
    const done = ledgered([{ name, lines }]);
    log(`${name}: ${done.groupIds.size} group(s), ${done.catalogIds.size} catalog row(s), ${done.parts.length} part number(s), ${done.assets.length} asset(s)${done.unanswered.length ? `, ${done.unanswered.length} intent(s) with no answer` : ""}\n`);

    const [catalog, groups, standing] = await Promise.all([
        getAllAssetCategories(),
        getAllAssetCategoryGroups(),
        getAssetsByRecordIds(done.assets.map((asset) => asset.id)),
    ]);
    const logRows = await findByRecordIds(TABLES.ASSET_LOG, standing.flatMap((asset) => asset.assetLog));
    const logById = new Map(logRows.map((record) => [record.id, record]));
    const ours = new Set(done.assets.map((asset) => asset.id));
    const ledgerAsset = new Map(done.assets.map((asset) => [asset.id, asset]));
    const refusals = [];

    // An asset goes with its Created row only while that row is all its history.
    const logsToGo = [];
    for (const asset of standing) {
        if (asset.assetId !== ledgerAsset.get(asset.id).assetId) refusals.push(`${asset.id} reads ${asset.assetId}, the ledger ${ledgerAsset.get(asset.id).assetId}`);
        const history = asset.assetLog.map((id) => logById.get(id));
        const createdOnly = history.length === 0 || (history.length === 1 && history[0]?.get("Asset Log ID") === `${asset.assetId}-001` && history[0]?.get("Event") === ASSET_EVENT.CREATED);
        if (!createdOnly) refusals.push(`${asset.assetId} carries ${history.length} row(s) of history — something happened to it after it was registered`);
        else logsToGo.push(...history);
    }
    const catalogToGo = catalog.filter((category) => done.catalogIds.has(category.id));
    for (const category of catalogToGo) {
        const others = category.assets.filter((id) => !ours.has(id));
        if (others.length > 0) refusals.push(`${category.id} ${JSON.stringify(category.itemName)} holds ${others.length} item(s) this ledger did not make`);
    }
    const partsBack = [];
    for (const part of done.parts) {
        const category = catalog.find((row) => row.id === part.id);
        if (!category) {
            refusals.push(`${part.id}, whose part number the ledger wrote, is gone`);
            continue;
        }
        if (category.partNumber !== part.after) refusals.push(`${part.id}'s part number reads ${JSON.stringify(category.partNumber)}, not the ${JSON.stringify(part.after)} the ledger wrote`);
        const others = category.assets.filter((id) => !ours.has(id));
        if (others.length > 0) refusals.push(`${part.id} ${JSON.stringify(category.itemName)} holds ${others.length} item(s) this ledger did not make, which its old part number would rename`);
        partsBack.push({ part, category, entry: { ...levelsOf(category), assetClass: category.assetClass, partNumber: part.before } });
    }
    const groupsToGo = groups.filter((group) => done.groupIds.has(group.id));
    for (const group of groupsToGo) {
        const filed = catalog.filter((category) => !done.catalogIds.has(category.id) && categoryGroupKey(category) === categoryGroupKey(group));
        if (filed.length > 0) refusals.push(`${group.level1} > ${group.level2} holds ${filed.length} catalog row(s) this ledger did not make`);
    }
    if (done.unanswered.length > 0) refusals.push(`${done.unanswered.map((intent) => intent.source).join(", ")}: a registration began and its answer is not in the ledger — read the base for its assets first`);
    if (refusals.length > 0) {
        for (const line of refusals) log(`  ${line}`);
        return finish(1, "refused before writing anything");
    }

    log(`  [LOG]     ${logsToGo.length} Created row(s)`);
    log(`  [ASSET]   ${standing.length} of the ledger's ${done.assets.length} asset(s), the rest gone already`);
    for (const { category, part } of partsBack) log(`  [PART]    ${category.id} ${JSON.stringify(category.itemName)} back to ${JSON.stringify(part.before)}`);
    log(`  [CATALOG] ${catalogToGo.length} of the ledger's ${done.catalogIds.size} row(s)`);
    log(`  [GROUP]   ${groupsToGo.length} of the ledger's ${done.groupIds.size} group(s)`);
    if (standing.length > 0) log(`  the day's highest id(s) among them are free again: the next registration that day mints them`);

    if (
        refusesProtectedWrite({
            script: `${SCRIPT} --revert`,
            baseId: base.getId(),
            writes: [TABLES.ASSET_CATEGORIES, TABLES.ASSET_CATEGORY_GROUPS],
            log,
        })
    ) {
        return finish(1, "refused before writing anything");
    }
    // The fence lets out deletes of exactly the rows the checks above passed — each asset the ledger
    // names that still stands, and its `Created` row — and nothing else of either table (#544).
    ledgerFence.deletes = new Set([...logsToGo.map((row) => row.id), ...standing.map((asset) => asset.id)]);
    const due = logsToGo.length + standing.length + partsBack.length + catalogToGo.length + groupsToGo.length;
    if (due === 0) return finish(0, "nothing the ledger made is on the base");
    if (!apply) return finish(2, `dry run — ${due} write(s) due, nothing was written`);

    // Every row about to go, each field as the API returned it, before the first delete.
    const record = openLedger(`revert-${baseName}`, { type: "run", script: `${SCRIPT} --revert`, base: baseName, of: name });
    for (const row of logsToGo) record.write({ type: "removed", table: TABLES.ASSET_LOG, id: row.id, fields: row.fields });
    for (const asset of standing) record.write({ type: "removed", table: TABLES.ASSETS, id: asset.id, assetId: asset.assetId, category: asset.category, job: asset.job, status: asset.status });
    for (const { part } of partsBack) record.write({ type: "part", id: part.id, before: part.after, after: part.before });
    for (const category of catalogToGo) record.write({ type: "removed", table: TABLES.ASSET_CATEGORIES, id: category.id, ...levelsOf(category), assetClass: category.assetClass, itemName: category.itemName });
    for (const group of groupsToGo) record.write({ type: "removed", table: TABLES.ASSET_CATEGORY_GROUPS, id: group.id, level1: group.level1, level2: group.level2 });
    log(`\nrevert ledger: ${relative(process.cwd(), record.path)}  (commit it)`);

    for (const chunk of inChunks(logsToGo.map((row) => row.id))) await base(TABLES.ASSET_LOG).destroy([...chunk]);
    for (const chunk of inChunks(standing.map((asset) => asset.id))) await base(TABLES.ASSETS).destroy([...chunk]);
    for (const { category, entry } of partsBack) {
        const put = await updateAssetCategory(category.id, entry);
        if (!put.updated) return finish(1, `${category.id}'s part number was not put back — ${put.gone ? "the row is gone" : `${put.exists.id} holds the path`}`);
    }
    for (const category of catalogToGo) {
        const gone = await removeAssetCategory(category.id);
        if (!gone.removed && !gone.gone) return finish(1, `${category.id} was not removed: an item came to stand on it`);
    }
    for (const chunk of inChunks(groupsToGo.map((group) => group.id))) await base(TABLES.ASSET_CATEGORY_GROUPS).destroy([...chunk]);

    // Read back: nothing the ledger made stands, and each part number reads as before.
    const [catalogAfter, groupsAfter, standingAfter] = await Promise.all([
        getAllAssetCategories(),
        getAllAssetCategoryGroups(),
        getAssetsByRecordIds(done.assets.map((asset) => asset.id)),
    ]);
    const left = [
        ...standingAfter.map((asset) => asset.assetId),
        ...catalogAfter.filter((category) => done.catalogIds.has(category.id)).map((category) => category.id),
        ...groupsAfter.filter((group) => done.groupIds.has(group.id)).map((group) => group.id),
        ...done.parts.filter((part) => catalogAfter.find((row) => row.id === part.id)?.partNumber !== part.before).map((part) => `${part.id}'s part number`),
    ];
    if (left.length > 0) return finish(1, `${left.length} of the ledger's rows still stand: ${left.join(", ")}`);
    return finish(0, `nothing ${name} made is on the base, and its part numbers read as before`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    const at = process.argv.indexOf("--revert");
    const ledgerPath = at === -1 ? null : process.argv[at + 1];
    const baseName = base.getId() === LIVE_BASE_ID ? "live" : "test";
    log(`${SCRIPT}${ledgerPath ? "  (REVERT)" : ""}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}`);
    log(`reaching the ${describeAirtableBase(resolveAirtableBase())}\n`);
    if (at !== -1 && !ledgerPath) {
        log("--revert takes the ledger's path");
        return 1;
    }
    fenceRequests(base, REQUEST_GAP_MS);
    if (ledgerPath) return revert(apply, ledgerPath, baseName);

    const list = readList();
    if (list.problems.length > 0) {
        log(`${relative(process.cwd(), SOURCE)} cannot be read — ${list.problems.length} problem(s), nothing was read from or written to the base:`);
        for (const line of list.problems) log(`  ${line}`);
        return finish(1, "the list is not loadable");
    }
    log(`${relative(process.cwd(), SOURCE)}: ${list.rows.length} row(s), ${list.rows.reduce((sum, row) => sum + row.quantity, 0)} item(s), sha256 ${list.sha256.slice(0, 12)}\n`);
    return load(apply, list, baseName);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.stack ?? error.message}`);
        process.exit(1);
    }
);
