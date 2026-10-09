// Removes the demo asset catalog, every asset under it and every asset log row of those assets
// (issue #517), and puts them back from its ledger.
//
// WHAT GOES. #507 and #514 gave the catalog demo rows, every one named `DEMO …`
// (`seed_asset_catalog_514.mjs`), and the assets the walks from #338 on registered stand under
// them. #517 loads the office's catalog (`scripts/import/load_asset_catalog_517.mjs`), and the
// demo rows go with what stands under them, as that issue says: each `Asset Categories` row
// whose `Level 3` begins `DEMO `, each `Assets` row whose `Category` is one of those, and each
// `Asset Log` row whose `Asset` is one of those assets. Nothing else is touched — not the demo
// jobs, which the document screens read; not the people; not an asset under one of the office's
// rows. The links into these rows from `Jobs` and `Users` are reverse links, which Airtable
// empties itself.
//
// THIS IS THE ISSUE'S REMOVAL, NOT TIDYING-UP. Records in this base are not removed as
// tidying-up (CLAUDE.md); these go because #517 replaces the catalog they hang from, and the
// list a dry run prints was read and agreed before the run that removed them.
//
// IT REFUSES WHILE THE OFFICE'S CATALOG IS NOT THERE: with no row outside the demo that a
// registration may pick, removing the demo would leave the registration nothing to offer.
//
// THE LEDGER IS WRITTEN BEFORE THE FIRST DELETE AND IS COMMITTED, beside this script, for
// rewrite_po_year_313.mjs' reason (docs/notes/verification.md): every row about to go, each
// field as the API returned it. Then the asset log rows go, then the assets, then the catalog
// rows — a child before its parent, so a run that stops part way never leaves a row pointing at
// one that is gone. A second run removes what the first left, and writes a ledger of its own.
// Each request is the batch delete, which refuses an id of another table (airtable-access.md).
//
// `--revert <ledger>` CREATES THE ROWS AGAIN: the catalog first, then the assets linked to the
// new catalog rows, then the log rows linked to the new assets. What comes back is every value a
// person or the app wrote — the levels and the class, each `Asset ID` and `Asset Log ID`,
// `Status`, the jobs, who recorded each event, when, and to whom an asset was checked out — under
// new record ids, which nothing outside these three tables holds. It refuses before writing if
// any `Asset ID`, `Asset Log ID` or demo path in the ledger is on the base already: a
// registration since the removal can have minted one of those ids for another asset, and two
// assets under one id are two labels with one code. A revert that stops part way says what it
// had created; nothing resumes it.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's scripts do, and counts its calls, which
// lib/airtableOps.js cannot see.
//
// Usage (from the repo root). Dry run is the DEFAULT, for the removal and for a revert:
//   node --env-file=.env.local scripts/demo/remove_demo_catalog_517.mjs
//   node --env-file=.env.local scripts/demo/remove_demo_catalog_517.mjs --apply
//   node --env-file=.env.local scripts/demo/remove_demo_catalog_517.mjs --revert <ledger.jsonl>
//   node --env-file=.env.local scripts/demo/remove_demo_catalog_517.mjs --revert <ledger.jsonl> --apply
//
// No loader flag: this file and lib/assetCategory.js import only built-ins and files whose
// extension they spell.
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 nothing of the demo is left (reverting, every
// row is back), 1 something failed or was refused, 2 nothing failed but something is still to
// do (a dry run).

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_CATEGORY_FIELDS, catalogPathKey, readCatalog } from "../../lib/assetCategory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER_PREFIX = "remove_demo_catalog_517-";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/** What marks a demo row: its name, `Level 3`, begins with it, as every name the demo seeds typed does. */
const DEMO_MARK = "DEMO ";

/**
 * The three tables, children last, each with the fields a revert writes back — every field a
 * person or the app writes, and none Airtable computes: `Item Name` is a formula, and
 * `Asset Categories."Assets"` and `Assets."Asset Log"` are reverse links, filled again by the
 * links their children are created with. A link to another of the three is `relinks`, written
 * through the record ids the revert minted for its parent.
 */
const CATEGORIES = { name: "Asset Categories", writes: Object.values(ASSET_CATEGORY_FIELDS) };
const ASSETS = { name: "Assets", id: "Asset ID", writes: ["Asset ID", "Status", "Job"], relinks: "Category" };
const LOG = { name: "Asset Log", id: "Asset Log ID", writes: ["Asset Log ID", "Event", "Job", "Recorded By", "Event At", "Checked Out To"], relinks: "Asset" };

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

    /** The batch form, which refuses an id that is not this table's. */
    async deleteRecords(tableId, ids) {
        const params = new URLSearchParams();
        for (const id of ids) params.append("records[]", id);
        const { records } = await this.request("DELETE", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
        const gone = records.filter((record) => record.deleted).map((record) => record.id);
        if (gone.length !== ids.length) throw new Error(`asked to delete ${ids.join(", ")} and ${gone.join(", ") || "none"} went`);
    }

    /** No `typecast`: a value a select does not hold is refused rather than coined. */
    createRecords(tableId, records) {
        return this.request("POST", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

/** A REST record as a catalog row, the shape lib/assetCategory.js reads. */
function categoryOf(record) {
    return {
        id: record.id,
        itemName: record.fields["Item Name"] ?? "",
        ...Object.fromEntries(Object.entries(ASSET_CATEGORY_FIELDS).map(([key, name]) => [key, record.fields[name] ?? ""])),
    };
}

const isDemo = (category) => String(category.level3).startsWith(DEMO_MARK);
const linkOf = (record, field) => record.fields[field] ?? [];
const inChunks = (items) => Array.from({ length: Math.ceil(items.length / RECORDS_PER_REQUEST) }, (_, i) => items.slice(i * RECORDS_PER_REQUEST, (i + 1) * RECORDS_PER_REQUEST));

/** Every row of the three tables, and each table's id. */
async function readAxis(air) {
    const tables = await air.tables();
    const table = (spec) => {
        const found = tables.find((t) => t.name === spec.name);
        if (!found) throw new Error(`no table named ${spec.name}`);
        return found;
    };
    const ids = { categories: table(CATEGORIES).id, assets: table(ASSETS).id, log: table(LOG).id };
    return {
        ids,
        categories: await air.listRecords(ids.categories),
        assets: await air.listRecords(ids.assets),
        log: await air.listRecords(ids.log),
    };
}

/** What a removal takes: the demo catalog rows, the assets under them and their log rows. */
function planRemoval(axis) {
    const categories = axis.categories.filter((record) => isDemo(categoryOf(record)));
    const categoryIds = new Set(categories.map((record) => record.id));
    const assets = axis.assets.filter((record) => linkOf(record, ASSETS.relinks).some((id) => categoryIds.has(id)));
    const assetIds = new Set(assets.map((record) => record.id));
    const log = axis.log.filter((record) => linkOf(record, LOG.relinks).some((id) => assetIds.has(id)));
    return { categories, assets, log };
}

/** The plan as a reader checks it: each catalog row with the assets under it, then the log rows by event. */
function printPlan(plan) {
    log(`${plan.categories.length} demo catalog row(s), ${plan.assets.length} asset(s) under them, ${plan.log.length} asset log row(s) of those assets:`);
    for (const record of plan.categories) {
        const under = plan.assets
            .filter((asset) => linkOf(asset, ASSETS.relinks).includes(record.id))
            .sort((a, b) => String(a.fields[ASSETS.id]).localeCompare(String(b.fields[ASSETS.id])));
        log(`  ${record.id}  ${JSON.stringify(categoryOf(record).itemName)} — ${under.length} asset(s)`);
        if (under.length > 0) log(`      ${under.map((asset) => `${asset.fields[ASSETS.id]} (${asset.fields.Status})`).join(", ")}`);
    }
    const events = {};
    for (const record of plan.log) events[record.fields.Event] = (events[record.fields.Event] ?? 0) + 1;
    log(`  the log rows by event: ${Object.entries(events).map(([event, n]) => `${event} ${n}`).join(", ") || "none"}`);
}

async function remove(air, apply) {
    const axis = await readAxis(air);
    const { offered } = readCatalog(axis.categories.map(categoryOf));
    const office = offered.filter((category) => !isDemo(category));
    log(`${axis.categories.length} catalog row(s), ${axis.assets.length} asset(s) and ${axis.log.length} asset log row(s) on the base; ${office.length} row(s) outside the demo a registration may pick.\n`);
    if (office.length === 0) return finish(air, 1, "refused: the office's catalog is not on the base, and the registration would offer nothing");

    const plan = planRemoval(axis);
    if (plan.categories.length === 0) return finish(air, plan.assets.length + plan.log.length > 0 ? 1 : 0, "nothing of the demo is on the base");
    printPlan(plan);
    if (!apply) return finish(air, 2, `dry run — ${plan.categories.length + plan.assets.length + plan.log.length} row(s) would go, nothing was removed`);

    const ledger = join(HERE, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const lines = [
        ...plan.categories.map((record) => ({ table: CATEGORIES.name, id: record.id, createdTime: record.createdTime, fields: record.fields })),
        ...plan.assets.map((record) => ({ table: ASSETS.name, id: record.id, createdTime: record.createdTime, fields: record.fields })),
        ...plan.log.map((record) => ({ table: LOG.name, id: record.id, createdTime: record.createdTime, fields: record.fields })),
    ];
    appendFileSync(ledger, lines.map((line) => JSON.stringify(line)).join("\n") + "\n", "utf8");
    log(`\nledger: ${relative(process.cwd(), ledger)}  (${lines.length} rows; commit it)`);

    for (const [label, tableId, records] of [
        ["asset log row(s)", axis.ids.log, plan.log],
        ["asset(s)", axis.ids.assets, plan.assets],
        ["catalog row(s)", axis.ids.categories, plan.categories],
    ]) {
        for (const chunk of inChunks(records.map((record) => record.id))) await air.deleteRecords(tableId, chunk);
        log(`  removed ${records.length} ${label}`);
    }

    log(`\nreading the three tables back:`);
    const after = await readAxis(air);
    const left = planRemoval(after);
    const removed = new Set(lines.map((line) => line.id));
    const still = [...after.categories, ...after.assets, ...after.log].filter((record) => removed.has(record.id));
    log(`  ${after.categories.length} catalog row(s), ${after.assets.length} asset(s), ${after.log.length} asset log row(s) on the base`);
    if (still.length > 0 || left.categories.length + left.assets.length + left.log.length > 0) {
        log(`  still there: ${still.map((record) => record.id).join(", ") || "none of the ledger's"}; demo left: ${left.categories.length}/${left.assets.length}/${left.log.length}`);
        return finish(air, 1, "the demo is not wholly gone — run it again, and keep both ledgers");
    }
    return finish(air, 0, "nothing of the demo is left");
}

async function revert(air, apply, ledgerPath) {
    const lines = readFileSync(ledgerPath, "utf8")
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
    const of = (spec) => lines.filter((line) => line.table === spec.name);
    const rows = { categories: of(CATEGORIES), assets: of(ASSETS), log: of(LOG) };
    log(`${relative(process.cwd(), ledgerPath)}: ${rows.categories.length} catalog row(s), ${rows.assets.length} asset(s), ${rows.log.length} asset log row(s)\n`);

    // Refused before anything is written: a demo path, an `Asset ID` or an `Asset Log ID` the base holds already.
    const axis = await readAxis(air);
    const paths = new Set(axis.categories.map((record) => catalogPathKey(categoryOf(record))));
    const assetIds = new Set(axis.assets.map((record) => record.fields[ASSETS.id]));
    const logIds = new Set(axis.log.map((record) => record.fields[LOG.id]));
    const taken = [
        ...rows.categories.filter((line) => paths.has(catalogPathKey(categoryOf(line)))).map((line) => `the path of ${line.id}, ${JSON.stringify(line.fields["Item Name"])}`),
        ...rows.assets.filter((line) => assetIds.has(line.fields[ASSETS.id])).map((line) => line.fields[ASSETS.id]),
        ...rows.log.filter((line) => logIds.has(line.fields[LOG.id])).map((line) => line.fields[LOG.id]),
    ];
    const unlinked = [
        ...rows.assets.filter((line) => !linkOf(line, ASSETS.relinks).every((id) => rows.categories.some((c) => c.id === id))).map((line) => line.fields[ASSETS.id]),
        ...rows.log.filter((line) => !linkOf(line, LOG.relinks).every((id) => rows.assets.some((a) => a.id === id))).map((line) => line.fields[LOG.id]),
    ];
    if (taken.length + unlinked.length > 0) {
        if (taken.length > 0) log(`on the base already: ${taken.join(", ")}`);
        if (unlinked.length > 0) log(`linked to a row the ledger does not hold: ${unlinked.join(", ")}`);
        return finish(air, 1, "refused before writing anything");
    }
    log(`none of the ledger's paths, asset ids or log ids is on the base.`);
    if (!apply) return finish(air, 2, `dry run — ${lines.length} row(s) would be created again, nothing was written`);

    const minted = new Map();
    const create = async (spec, tableId, entries) => {
        for (const chunk of inChunks(entries)) {
            const made = await air.createRecords(
                tableId,
                chunk.map((line) => ({
                    fields: {
                        ...Object.fromEntries(spec.writes.filter((field) => line.fields[field] !== undefined).map((field) => [field, line.fields[field]])),
                        ...(spec.relinks ? { [spec.relinks]: linkOf(line, spec.relinks).map((id) => minted.get(id)) } : {}),
                    },
                }))
            );
            made.records.forEach((record, i) => minted.set(chunk[i].id, record.id));
        }
        log(`  created ${entries.length} ${spec.name} row(s) again`);
    };
    try {
        await create(CATEGORIES, axis.ids.categories, rows.categories);
        await create(ASSETS, axis.ids.assets, rows.assets);
        await create(LOG, axis.ids.log, rows.log);
    } catch (error) {
        log(`  stopped: ${error.message}`);
        log(`  created before it stopped (ledger id -> new id): ${[...minted].map(([was, now]) => `${was}->${now}`).join(", ") || "nothing"}`);
        return finish(air, 1, "the revert stopped part way");
    }

    const after = await readAxis(air);
    const back = new Set([...after.categories, ...after.assets, ...after.log].map((record) => record.id));
    const missing = lines.filter((line) => !back.has(minted.get(line.id)));
    if (missing.length > 0) return finish(air, 1, `${missing.length} row(s) did not read back`);
    return finish(air, 0, `every row of the ledger is back, ${lines.length} in all, under new record ids`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    const at = process.argv.indexOf("--revert");
    const ledgerPath = at === -1 ? null : process.argv[at + 1];
    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    if (at !== -1 && !ledgerPath) {
        log("--revert takes the ledger's path");
        return 1;
    }
    const air = new Airtable(token, baseId);
    log(`remove_demo_catalog_517 — base ${baseId}${ledgerPath ? "  (REVERT)" : ""}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);
    return ledgerPath ? revert(air, apply, ledgerPath) : remove(air, apply);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
