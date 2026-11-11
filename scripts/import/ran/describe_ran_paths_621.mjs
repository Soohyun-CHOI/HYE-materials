// Corrects the paths seven descriptions name on the base this run reaches — six fields' and one
// table's — the paths alone (#621).
//
// WHY. Each description names the script that made, filled or loaded what it describes by the path it
// had then, and each script has since moved into `scripts/import/ran/` (#572, #602), so each sentence
// names a path that is gone: `Assets."Owner Job"` names `fill_owner_job_598.mjs` and
// `add_owner_job_598.mjs`, `Assets."Last Event At"` names `add_last_event_at_540.mjs`,
// `Asset Categories."Category Group"`, `."Edited At"` and `."Asset Statuses"` name
// `link_category_groups_539.mjs`, `add_edited_at_540.mjs` and `add_asset_statuses_582.mjs`,
// `Material Categories."Item Name"` names `add_category_item_name_415.mjs`, and
// `Asset Category Groups`' own description names `replace_asset_catalog_528.mjs`. This puts
// `scripts/import/ran/` in place of `scripts/import/` in those eight paths and leaves every other
// character as it stands, as `describe_serial_path_612.mjs` did for `Assets."Serial Number"`; the
// script or plan holding each sentence as the description it writes holds the corrected one.
//
// THE TABLE'S CAME SECOND. The first run on each base wrote the six fields' alone, before the table's
// was added here; the second found those right and wrote the table's. Each run's ledger holds what it
// wrote.
//
// THE PATHS AND NOTHING ELSE, BY CONSTRUCTION. The description written is the one read with each old
// path replaced, so no other character can move, and the run checks it again character by character:
// every difference must be a `ran/` standing after `scripts/import/`. A description holding each old
// path once and each new one nowhere is rewritten; one holding each new path once and each old one
// nowhere is already right; any other stops the run before anything is written.
//
// AND IT SAYS WHAT IS LEFT. Every description on the base, a table's as well as a field's, is searched
// for a path in `scripts/import/` naming a file that stands in `ran/` alone, and one outside the seven
// is listed and not written.
//
// DESCRIPTIONS ALONE, BECAUSE `Assets` HOLDS THE SITE'S RECORDS (#531). Every request asks
// `refusesBeyondDescriptions` first, so a body carrying a name, a type or options, or any request to a
// row, is refused before it leaves. It sends one GET of the schema before, one PATCH for each
// description that needs it, and one GET after.
//
// A LEDGER BEFORE THE PATCHES. `--apply` writes the base — `live` or `test`, as the run named it — and
// each description before and after, its field's id or `null` for a table's own, to
// `scripts/import/ledgers/describe_ran_paths_621-<base>-<instant>.jsonl` first, a line a description.
//
// AND IT LOOKS AFTERWARDS. The re-read compares every table whole against the read before — every
// field's id, name, type, options and description, every view's id, name and type, and each table's
// name, primary field and description, the seven descriptions aside — and the seven must read as
// written.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/describe_ran_paths_621.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/describe_ran_paths_621.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/describe_ran_paths_621.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins, the guard's module and the base's.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 every description names the new paths, 1 something
// failed or a description is not the one this expects, 2 a dry run with paths still to correct.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusesBeyondDescriptions } from "../../protectedTables.mjs";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "describe_ran_paths_621";

const META_ROOT = "https://api.airtable.com/v0/meta";

const RAN_DIR = dirname(fileURLToPath(import.meta.url));
const IMPORT_DIR = join(RAN_DIR, "..");
const LEDGER_DIR = join(IMPORT_DIR, "ledgers");

/** Where each path pointed, and where it points once corrected. */
const OLD_DIR = "scripts/import/";
const NEW_DIR = "scripts/import/ran/";
const INSERTED = "ran/";

/**
 * The seven descriptions, each by its table's id — both bases share them, the test base made by
 * duplicating the live one (#534) — and by its field's name, since a field's id differs from base to
 * base, or `null` for the table's own; and the scripts it names, in the order it names them.
 */
const ASSETS = { name: "Assets", id: "tblXtmDonSyOyOvV3" };
const ASSET_CATEGORIES = { name: "Asset Categories", id: "tblry47UEqLx86yaU" };
const ASSET_CATEGORY_GROUPS = { name: "Asset Category Groups", id: "tblmAiXzltjLuJcw4" };
const MATERIAL_CATEGORIES = { name: "Material Categories", id: "tblnFLgVVhdeIvEgV" };
const TARGETS = [
    { table: ASSETS, field: "Owner Job", scripts: ["fill_owner_job_598.mjs", "add_owner_job_598.mjs"] },
    { table: ASSETS, field: "Last Event At", scripts: ["add_last_event_at_540.mjs"] },
    { table: ASSET_CATEGORIES, field: "Category Group", scripts: ["link_category_groups_539.mjs"] },
    { table: ASSET_CATEGORIES, field: "Edited At", scripts: ["add_edited_at_540.mjs"] },
    { table: ASSET_CATEGORIES, field: "Asset Statuses", scripts: ["add_asset_statuses_582.mjs"] },
    { table: MATERIAL_CATEGORIES, field: "Item Name", scripts: ["add_category_item_name_415.mjs"] },
    { table: ASSET_CATEGORY_GROUPS, field: null, scripts: ["replace_asset_catalog_528.mjs"] },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

/** The one way this script reaches Airtable: asked of the guard before it is sent. */
async function request(method, path, body) {
    const url = `${META_ROOT}${path}`;
    if (refusesBeyondDescriptions({ script: SCRIPT, method, url, body, log })) {
        throw new Error("refused before sending");
    }
    calls++;
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${airtable.apiKey}`,
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

/** Every table of the base as it holds them now. */
async function readTables(baseId) {
    const { tables } = await request("GET", `/bases/${baseId}/tables`);
    return tables;
}

/** How many times `part` stands in `text`. */
function count(text, part) {
    return text.split(part).length - 1;
}

/** How a description is named in what this prints: a field's by its table and name, a table's own as such. */
function labelOf(tableName, fieldName) {
    return fieldName === null ? `${tableName} (the table's own)` : `${tableName}."${fieldName}"`;
}

/** Every fact of every table but the descriptions of the named fields and tables, for the before-and-after. */
function shape(tables, ids) {
    return JSON.stringify(
        tables.map((table) => ({
            id: table.id,
            name: table.name,
            primaryFieldId: table.primaryFieldId,
            description: ids.has(table.id) ? null : table.description ?? "",
            fields: table.fields.map((f) => ({
                id: f.id,
                name: f.name,
                type: f.type,
                options: f.options ?? null,
                description: ids.has(f.id) ? null : f.description ?? "",
            })),
            views: (table.views ?? []).map((v) => ({ id: v.id, name: v.name, type: v.type })),
        }))
    );
}

/**
 * Where `written` holds a `ran/` after `scripts/import/` that `said` does not, by its character in
 * `said`, when that is every difference between the two; null when any other character differs.
 */
function insertions(said, written) {
    const at = [];
    let i = 0;
    let j = 0;
    while (i < said.length || j < written.length) {
        if (written.startsWith(INSERTED, j) && !said.startsWith(INSERTED, i) && said.slice(0, i).endsWith(OLD_DIR)) {
            at.push(i);
            j += INSERTED.length;
            continue;
        }
        if (i < said.length && said[i] === written[j]) {
            i++;
            j++;
            continue;
        }
        return null;
    }
    return at;
}

/** What one description needs: nothing, the paths corrected, or a stop. */
function planFor(target, said) {
    const olds = target.scripts.map((file) => count(said, OLD_DIR + file));
    const news = target.scripts.map((file) => count(said, NEW_DIR + file));
    if (olds.every((n) => n === 0) && news.every((n) => n === 1)) return { state: "right", olds, news };
    if (olds.every((n) => n === 1) && news.every((n) => n === 0)) {
        let written = said;
        for (const file of target.scripts) written = written.replace(OLD_DIR + file, NEW_DIR + file);
        return { state: "due", olds, news, written };
    }
    return { state: "unexpected", olds, news };
}

/** Every description on the base naming a script by a path in `scripts/import/` it has left for `ran/`. */
function oldPaths(tables) {
    const found = [];
    for (const table of tables) {
        const described = [
            [labelOf(table.name, null), table.description ?? ""],
            ...table.fields.map((f) => [labelOf(table.name, f.name), f.description ?? ""]),
        ];
        for (const [where, text] of described) {
            for (const [path, file] of text.matchAll(/scripts\/import\/([A-Za-z0-9_-]+\.(?:mjs|py|js))/g)) {
                if (existsSync(join(RAN_DIR, file)) && !existsSync(join(IMPORT_DIR, file))) found.push({ where, path });
            }
        }
    }
    return found;
}

/** The old paths outside the seven descriptions, listed. */
function listOthers(tables) {
    const mine = new Set(TARGETS.map((t) => labelOf(t.table.name, t.field)));
    const others = oldPaths(tables).filter((p) => !mine.has(p.where));
    log("");
    if (others.length === 0) {
        log("  no other description on the base names a moved script's old path");
        return;
    }
    log(`  ${others.length} old path(s) in description(s) outside the seven, listed and not written:`);
    for (const p of others) log(`    ${p.where}: ${p.path}`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const baseId = airtable.baseId;

    log("=".repeat(72));
    log("Seven descriptions — the paths of the scripts they name, now in ran/ (#621)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const plans = [];
    let stopped = false;
    for (const target of TARGETS) {
        const label = labelOf(target.table.name, target.field);
        const table = before.find((t) => t.id === target.table.id);
        if (!table || table.name !== target.table.name) {
            log(`  STOPPED: ${target.table.id} is ${table ? `"${table.name}"` : "on no table"}, not ${target.table.name}.`);
            stopped = true;
            continue;
        }
        let id = table.id;
        let path = `/bases/${baseId}/tables/${table.id}`;
        let said = table.description ?? "";
        if (target.field !== null) {
            const named = table.fields.filter((f) => f.name === target.field);
            if (named.length !== 1) {
                log(`  STOPPED: ${target.table.name} holds ${named.length} field(s) named ${target.field}.`);
                stopped = true;
                continue;
            }
            id = named[0].id;
            path += `/fields/${id}`;
            said = named[0].description ?? "";
        }
        const plan = planFor(target, said);
        log("");
        log(`  ${label} is ${id}, ${said.length} characters:`);
        target.scripts.forEach((file, n) => log(`    ${file}: the old path ${plan.olds[n]} time(s), the new path ${plan.news[n]} time(s)`));
        if (plan.state === "right") {
            log("    already names the new paths");
            continue;
        }
        if (plan.state === "unexpected") {
            log("    STOPPED: the description is not the one this corrects.");
            log(said);
            stopped = true;
            continue;
        }
        const at = insertions(said, plan.written);
        if (at === null || at.length !== target.scripts.length) {
            log("    STOPPED: the corrected description differs from the one read beyond the paths.");
            stopped = true;
            continue;
        }
        for (const [n, file] of target.scripts.entries()) {
            log(`    at character ${at[n]}: ${JSON.stringify(OLD_DIR + file)} -> ${JSON.stringify(NEW_DIR + file)}`);
        }
        log(`    "${INSERTED}" inserted ${at.length} time(s), every other character unchanged: ${said.length} before, ${plan.written.length} after`);
        plans.push({ target, label, id, path, said, written: plan.written });
    }
    listOthers(before);
    if (stopped) {
        log("");
        log("  STOPPED before anything was written.");
        return finish(1, "a description is not the one this expects");
    }
    if (plans.length === 0) return finish(0, "every description names the new paths");

    if (!apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${plans.length} description(s) would be written and none was.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    mkdirSync(LEDGER_DIR, { recursive: true });
    const at = new Date().toISOString();
    const where = airtable.live ? "live" : "test";
    const ledger = join(LEDGER_DIR, `${SCRIPT}-${where}-${at.replace(/[:.]/g, "-")}.jsonl`);
    // The base is named as the run named it, `live` or `test` — the live base's id is written in
    // `lib/airtableBase.js` and nowhere else (`offline/airtable-base.mjs`), the #544 ledgers' shape.
    writeFileSync(
        ledger,
        plans
            .map(
                (p) =>
                    JSON.stringify({
                        kind: "description",
                        base: where,
                        table: p.target.table.id,
                        field: p.target.field === null ? null : p.id,
                        at,
                        before: p.said,
                        after: p.written,
                    }) + "\n"
            )
            .join("")
    );
    log("");
    log(`ledger: ${ledger}`);

    for (const p of plans) {
        await request("PATCH", p.path, { description: p.written });
        log(`  written: ${p.label}`);
    }

    const after = await readTables(baseId);
    const ids = new Set(plans.map((p) => p.id));
    const wrong = [];
    if (shape(after, ids) !== shape(before, ids)) wrong.push("the base changed beyond these descriptions");
    for (const p of plans) {
        const table = after.find((t) => t.id === p.target.table.id);
        const reread = p.target.field === null ? table : table?.fields.find((f) => f.id === p.id);
        if (!reread || reread.name !== (p.target.field ?? p.target.table.name)) wrong.push(`${p.id} is no longer ${p.label}`);
        if ((reread?.description ?? "") !== p.written) wrong.push(`${p.label} does not read as written`);
    }
    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const problem of wrong) log(`  WRONG: ${problem}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    for (const p of plans) log(`  ${p.label}: the description as written, the new paths in place of the old`);
    log("  every other description, field and view of every table, and each table's name and primary field: unchanged");
    listOthers(after);
    return finish(0, "every description names the new paths");
}

function finish(code, verdict) {
    log("");
    log(`${calls} Airtable API call(s). ${verdict}.`);
    return code;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
