// Renames three reverse links so each names its role as `(as …)` (#622) — the names alone.
//
// WHAT. When two tables are joined more than once, the base names the second relation's role in
// parentheses with `as`: `Users."Jobs (as PIC)"`, `Users."Purchase Orders (as Sender)"`,
// `Jobs."Assets (as Owner)"`. Three fields said their role another way, and this renames them:
//
//   Users."PR Edit Requests (Initiated)"   -> "PR Edit Requests (as Initiator)"
//   Users."PR Edit Requests (Sent To)"     -> "PR Edit Requests (as Recipient)"
//   Addresses."Jobs (Delivery Address)"    -> "Jobs (as Delivery Address)"
//
// A NAME AND NOTHING ELSE. Each PATCH carries `name` alone, so a field keeps its id, its type, its
// link, its far side and every row's value; a formula, lookup, rollup or view filter reaches a field
// by id and follows the rename (`docs/notes/airtable-access.md`). Renaming a reverse link does not
// carry its far side, and the far sides — `PR Edit Requests."Initiated By"` and `"Sent To"`, and
// `Jobs."Delivery Address"` — keep their names.
//
// BY ID, SO A RUN FINDS EACH FIELD UNDER EITHER NAME. The tables and fields carry the same ids on
// both bases, the test base having been made by duplicating the live one (#534). A field already
// wearing its new name is left as it is; a field wearing any third name, or a link that does not
// reach the far side named here, stops the run before anything is written.
//
// WHAT READS THEM. The app reads every field by name, and `PR Edit Requests (as Recipient)` is the
// one of the three anything reads: `lib/airtable/users.js:recordToUser`, for `canViewPR`'s clause 6.
// `scripts/import/remove_demo_data_537_plan.mjs` reads `Jobs (as Delivery Address)`; nothing reads
// the third. The repository names the new names in the commit carrying this script, and
// `offline/table-field-names.mjs` fails a literal of an old one anywhere but here.
//
// A LEDGER BEFORE THE PATCHES. `--apply` writes the base — `live` or `test`, as the run named it —
// each field's id and its name before and after to
// `scripts/import/ledgers/rename_role_links_622-<base>-<instant>.jsonl` first. The way back is the
// same PATCHes with the names swapped.
//
// AND IT LOOKS AFTERWARDS. The re-read compares the whole schema against the read before — every
// table's id, name, primary field and description, and every field's id, name, type, options and
// description — with these three names as written, so a rename that moved anything else fails.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/rename_role_links_622.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/rename_role_links_622.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/rename_role_links_622.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins and the base's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 all three read as their new names, 1 something
// failed or a field is not the one this expects, 2 a dry run with a rename still to make.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "rename_role_links_622";

const META_ROOT = "https://api.airtable.com/v0/meta";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** The three fields, by the ids both bases share, each with the far side its link must reach. */
const RENAMES = [
    {
        table: { name: "Users", id: "tblisLwTKXyKtsTcy" },
        field: "fldjjTvcdfCyLmElU",
        from: "PR Edit Requests (Initiated)",
        to: "PR Edit Requests (as Initiator)",
        far: { table: "PR Edit Requests", field: "Initiated By" },
    },
    {
        table: { name: "Users", id: "tblisLwTKXyKtsTcy" },
        field: "fldG4xPExqIoy9cJZ",
        from: "PR Edit Requests (Sent To)",
        to: "PR Edit Requests (as Recipient)",
        far: { table: "PR Edit Requests", field: "Sent To" },
    },
    {
        table: { name: "Addresses", id: "tbl8xZwFmZD8UPWev" },
        field: "fldrYHLmOX5mhcJUU",
        from: "Jobs (Delivery Address)",
        to: "Jobs (as Delivery Address)",
        far: { table: "Jobs", field: "Delivery Address" },
    },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function request(method, path, body) {
    calls++;
    const res = await fetch(`${META_ROOT}${path}`, {
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

async function readTables(baseId) {
    return (await request("GET", `/bases/${baseId}/tables`)).tables;
}

/** What is wrong with one field as read, or null when it is the one this renames. */
function fieldProblem(tables, spec) {
    const table = tables.find((t) => t.id === spec.table.id);
    if (!table) return `no table ${spec.table.id} on this base`;
    if (table.name !== spec.table.name) return `${spec.table.id} is called "${table.name}", not ${spec.table.name}`;
    const field = table.fields.find((f) => f.id === spec.field);
    if (!field) return `${spec.table.name} holds no field ${spec.field}`;
    if (field.name !== spec.from && field.name !== spec.to) {
        return `${spec.table.name}.${spec.field} is called "${field.name}", neither "${spec.from}" nor "${spec.to}"`;
    }
    if (field.type !== "multipleRecordLinks") return `${spec.table.name}."${field.name}" is a ${field.type}, not a link`;
    const farTable = tables.find((t) => t.id === field.options?.linkedTableId);
    const farField = farTable?.fields.find((f) => f.id === field.options?.inverseLinkFieldId);
    if (farTable?.name !== spec.far.table || farField?.name !== spec.far.field) {
        return `${spec.table.name}."${field.name}" reaches ${farTable?.name ?? "no table"}."${farField?.name ?? "no field"}", not ${spec.far.table}."${spec.far.field}"`;
    }
    const taken = table.fields.find((f) => f.name === spec.to && f.id !== spec.field);
    if (taken) return `${spec.table.name}."${spec.to}" is already another field, ${taken.id}`;
    return null;
}

/** Every fact of the schema, with these fields' names read as `renamed` gives them. */
function shape(tables, renamed = new Map()) {
    return JSON.stringify(
        tables.map((t) => ({
            id: t.id,
            name: t.name,
            primaryFieldId: t.primaryFieldId,
            description: t.description ?? "",
            fields: t.fields.map((f) => ({
                id: f.id,
                name: renamed.get(f.id) ?? f.name,
                type: f.type,
                options: f.options ?? null,
                description: f.description ?? "",
            })),
        }))
    );
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
    log("Three reverse links renamed to name their role as (as …) (#622)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const problems = RENAMES.map((spec) => fieldProblem(before, spec)).filter(Boolean);
    if (problems.length > 0) {
        for (const problem of problems) log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }
    const nameOf = (tables, spec) => tables.find((t) => t.id === spec.table.id).fields.find((f) => f.id === spec.field).name;
    const pending = RENAMES.filter((spec) => nameOf(before, spec) !== spec.to);
    for (const spec of RENAMES) {
        const now = nameOf(before, spec);
        log(`  ${spec.table.name}.${spec.field} "${now}"${now === spec.to ? " — already its new name" : ` -> "${spec.to}"`}`);
    }
    if (pending.length === 0) return finish(0, "all three read as their new names");

    if (!apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${pending.length} rename(s) would be made and none was.`);
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
        pending
            .map((spec) => JSON.stringify({ kind: "name", base: where, table: spec.table.id, field: spec.field, at, before: spec.from, after: spec.to }))
            .join("\n") + "\n"
    );
    log("");
    log(`ledger: ${ledger}`);

    for (const spec of pending) {
        await request("PATCH", `/bases/${baseId}/tables/${spec.table.id}/fields/${spec.field}`, { name: spec.to });
        log(`  renamed: ${spec.table.name}."${spec.to}"`);
    }

    const after = await readTables(baseId);
    const renamed = new Map(RENAMES.map((spec) => [spec.field, spec.to]));
    const wrong = [];
    if (shape(after) !== shape(before, renamed)) wrong.push("the schema changed beyond these three names");
    for (const spec of RENAMES) if (nameOf(after, spec) !== spec.to) wrong.push(`${spec.table.name}.${spec.field} does not read "${spec.to}"`);
    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log("  all three read as their new names");
    log("  every other table and field: id, name, type, options and description unchanged");
    return finish(0, "all three read as their new names");
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
