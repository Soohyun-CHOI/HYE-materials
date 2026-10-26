// Keeps the catalog's class in a ledger before the field comes off the base (issue #552), and
// writes nothing to the base.
//
// WHAT IT KEEPS. `Asset Categories."Class"`, `A` or `B` on every catalog row from #507, read by no
// act and kept by the office no longer: the app stopped reading, writing and saying it in #552,
// and the field comes off each base by a hand step in the Airtable UI, since the Metadata API
// deletes no field (`docs/notes/airtable-access.md`). Deleting a field keeps none of its values,
// so this reads them first: the field as the base describes it — its id, type, two choices with
// their colors and its description — and every row's id, name, path and class, written to
// `scripts/import/ledgers/keep_asset_class_552-<base>-<instant>.jsonl`, the base named `live` or
// `test` as the run named it. The ledger is what a field made again would be filled from; no
// revert is written, since nothing reads the class to want it back.
//
// IT READS, AND ONLY READS. Every request is a GET — the schema once and the catalog one page per
// hundred rows — through the one function here that sends, which names no other method, so the
// live base is read as the test base is.
//
// IT STOPS RATHER THAN KEEP A FIELD IT DOES NOT KNOW. A field named `Class` with another id, type
// or choices than #507's, or any field of the base whose options name it — a formula, lookup or
// rollup that would lose its source with it — refuses the run and writes nothing.
//
// A SECOND RUN WRITES NO SECOND LEDGER FOR THE SAME STATE. It reads the ledgers already beside it
// for its base, and where the latest holds the field and every row as the base does now, it says
// so and writes nothing — the run made right before the hand step on the live base, so that a
// row the office changed since the first run is kept too. On a base the field is gone from it says
// which ledger kept it, and fails if none did.
//
// IT TALKS TO THE REST API DIRECTLY, for create_material_categories_354.mjs' reason, and counts
// its calls, which lib/airtableOps.js cannot see. The judgments are keep_asset_class_552_plan.mjs'.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/keep_asset_class_552.mjs
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/keep_asset_class_552.mjs
//
// No loader flag: this file imports only built-ins and files whose extension they spell.
//
// Airtable PAT scopes: schema.bases:read, data.records:read.
//
// Exit codes, per docs/notes/verification.md: 0 the base's class is in a ledger — written now,
// already there, or kept before the field went — and 1 something failed or was refused.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_CATEGORY_FIELDS } from "../../../lib/assetCategory.js";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import {
    CATALOG_TABLE,
    CLASS_FIELD,
    DELETE_STEP,
    NAME_FIELD,
    classFieldOf,
    holdsTheSame,
    isLedgerOf,
    ledgerLines,
    ledgerName,
    readLedger,
    referencesTo,
} from "../keep_asset_class_552_plan.mjs";

const API_ROOT = "https://api.airtable.com/v0";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

let calls = 0;

/** A GET, and the one request this script sends. */
async function get(airtable, url) {
    calls++;
    const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${airtable.apiKey}` } });
    const text = await response.text();
    if (!response.ok) throw new Error(`GET ${url.replace(airtable.baseId, "{base}")} -> ${response.status} ${text}`);
    return JSON.parse(text);
}

/** Every row of the catalog, by field name, the fields a ledger row keeps and no other. */
async function catalogRows(airtable, tableId) {
    const out = [];
    let offset;
    do {
        const params = new URLSearchParams({ pageSize: "100" });
        for (const name of [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS), CLASS_FIELD.name]) params.append("fields[]", name);
        if (offset) params.set("offset", offset);
        const page = await get(airtable, `${API_ROOT}/${airtable.baseId}/${tableId}?${params}`);
        out.push(...page.records);
        offset = page.offset;
    } while (offset);
    return out;
}

/** The ledgers already in `scripts/import/ledgers/` for `base`, newest last, each `{ name, lines }`. */
function ledgersOf(base) {
    let names = [];
    try {
        names = readdirSync(LEDGER_DIR).filter((name) => isLedgerOf(name, base)).sort();
    } catch {
        names = [];
    }
    return names.map((name) => ({ name, lines: readLedger(readFileSync(join(LEDGER_DIR, name), "utf8")) }));
}

const log = (message = "") => console.log(message);

function finish(code, verdict) {
    log("");
    log(`${calls} Airtable API call(s), every one a GET. ${verdict}.`);
    return code;
}

async function main() {
    let airtable;
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const base = airtable.live ? "live" : "test";
    log(`keep_asset_class_552 — ${describeAirtableBase(airtable)}\n`);
    const kept = ledgersOf(base);

    const { tables } = await get(airtable, `${API_ROOT}/meta/bases/${airtable.baseId}/tables`);
    const table = tables.find((t) => t.name === CATALOG_TABLE);
    if (!table) {
        log(`no table named ${CATALOG_TABLE}.`);
        return finish(1, "nothing to keep");
    }
    const { field, problems } = classFieldOf(table);
    if (!field) {
        const latest = kept.at(-1);
        if (!latest) {
            log(`${CATALOG_TABLE} holds no ${CLASS_FIELD.name}, and no ledger of this script's for the ${base} base holds its values.`);
            return finish(1, "the class is gone with nothing kept");
        }
        const [run] = latest.lines;
        log(`${CATALOG_TABLE} holds no ${CLASS_FIELD.name} any more; ${relative(process.cwd(), join(LEDGER_DIR, latest.name))} kept its ${run.rows} row(s).`);
        return finish(0, "the class is gone, and its ledger stands");
    }
    if (problems.length > 0) {
        for (const problem of problems) log(`  ${problem}`);
        return finish(1, "the field is not the one #507 made, so nothing was kept");
    }
    const referring = referencesTo(field.id, tables);
    if (referring.length > 0) {
        log(`${referring.length} field(s) refer to ${CLASS_FIELD.name}, and would lose their source with it:`);
        for (const name of referring) log(`  ${name}`);
        return finish(1, "something reads the class, so nothing was kept");
    }
    log(`${CATALOG_TABLE}.${CLASS_FIELD.name} (${field.id}), a ${field.type} of ${CLASS_FIELD.values.join(" and ")}; no field of the base refers to it.`);

    const at = new Date().toISOString();
    const lines = ledgerLines({ base, at, field, records: await catalogRows(airtable, table.id) });
    const [run] = lines;
    log(`  ${run.rows} row(s): ${Object.entries(run.counts).map(([value, n]) => `${n} ${value}`).join(", ")}`);

    const latest = kept.at(-1);
    if (latest && holdsTheSame(latest.lines, lines)) {
        log(`\nunchanged since ${relative(process.cwd(), join(LEDGER_DIR, latest.name))}, which holds the field and every row as the base does now; no ledger written.`);
    } else {
        mkdirSync(LEDGER_DIR, { recursive: true });
        const path = join(LEDGER_DIR, ledgerName(base, at));
        writeFileSync(path, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
        log(`\nwrote ${relative(process.cwd(), path)}${latest ? `, since the base no longer holds what ${latest.name} does` : ""}.`);
    }
    log(`\nthe hand step, on the ${base} base, is now the office's: ${DELETE_STEP}`);
    return finish(0, "the class is in a ledger");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
