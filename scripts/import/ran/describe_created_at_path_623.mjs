// Corrects the script path `Invoices."Created At"`'s description names (#623) — the description alone.
//
// WHY. `rename_invoice_variances_623.mjs` made the field with a description ending on the path of
// the script that filled the invoices standing before it, `scripts/import/...`. That script moved
// into `scripts/import/ran/` once its live run was done, so the path named a file that no longer
// exists on either base. #626's `describe_serial_path_612.mjs` is the shape: write the description
// read with the one path replaced, so no other character can move.
//
// WHAT IT REFUSES. A base whose `Invoices` holds no `Created At`, or whose description holds the
// old path other than once, stops the run before anything is written. One already reading the new
// path is left as it is.
//
// A LEDGER BEFORE THE WRITE. `--apply` writes the base — `live` or `test`, as the run named it —
// the description before and after to
// `scripts/import/ledgers/describe_created_at_path_623-<base>-<instant>.jsonl` first.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/describe_created_at_path_623.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/describe_created_at_path_623.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/describe_created_at_path_623.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the description names the moved path, 1 something
// failed or the field is not the one this expects, 2 a dry run with the write still to make.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

const SCRIPT = "describe_created_at_path_623";
const INVOICES = "tbl2Z4wEbU64YU14o";
const FROM = "scripts/import/rename_invoice_variances_623.mjs";
const TO = "scripts/import/ran/rename_invoice_variances_623.mjs";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

let airtable = null;
let calls = 0;

async function request(method, path, body) {
    calls++;
    const res = await fetch(`https://api.airtable.com/v0/meta${path}`, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

const createdAt = async () =>
    (await request("GET", `/bases/${airtable.baseId}/tables`)).tables
        .find((t) => t.id === INVOICES)
        ?.fields.find((f) => f.name === "Created At") ?? null;

function finish(code, verdict) {
    console.log(`\n${calls} Airtable API call(s). ${verdict}.`);
    return code;
}

async function main() {
    const apply = process.argv.includes("--apply");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        console.log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    console.log(`Invoices."Created At" description path (#623) — ${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);

    const field = await createdAt();
    if (!field) return finish(1, "STOPPED: Invoices holds no Created At");
    const before = field.description ?? "";
    const count = before.split(FROM).length - 1;
    if (count === 0 && before.includes(TO)) return finish(0, "the description already names the moved path");
    if (count !== 1) return finish(1, `STOPPED: the description holds the old path ${count} times`);
    const after = before.replace(FROM, TO);
    console.log(`  ${field.id}: "${FROM}" -> "${TO}", the description's only change`);
    if (!apply) return finish(2, "dry run — 1 description write would be made");

    mkdirSync(LEDGER_DIR, { recursive: true });
    const at = new Date().toISOString();
    const where = airtable.live ? "live" : "test";
    const ledger = join(LEDGER_DIR, `${SCRIPT}-${where}-${at.replace(/[:.]/g, "-")}.jsonl`);
    writeFileSync(ledger, JSON.stringify({ kind: "description", base: where, table: INVOICES, field: field.id, at, before, after }) + "\n");
    console.log(`  ledger: ${ledger}`);

    await request("PATCH", `/bases/${airtable.baseId}/tables/${INVOICES}/fields/${field.id}`, { description: after });
    const back = await createdAt();
    if ((back?.description ?? "") !== after || back?.name !== "Created At" || back?.type !== field.type) {
        return finish(1, "WRONG: the re-read does not hold the description as written");
    }
    return finish(0, "the description names the moved path, and nothing else in it moved");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
