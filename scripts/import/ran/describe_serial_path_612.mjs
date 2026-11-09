// Corrects one path in `Assets."Serial Number"`'s description on the base this run reaches — the
// path alone.
//
// WHY. `scripts/import/ran/describe_details_612.mjs` wrote the field's description on both bases on
// 2026-11-05, ending `Made by scripts/import/add_serial_number_601.mjs on both bases.` #602 had moved
// that script into `scripts/import/ran/` the day before, so the sentence named a path that was gone.
// This swaps that one path for `scripts/import/ran/add_serial_number_601.mjs` and leaves every other
// character as it stands; `describe_details_612.mjs` holds the corrected sentence as the description
// it expects.
//
// THE PATH AND NOTHING ELSE, BY CONSTRUCTION. The description written is the one read with the old path
// replaced, so no other character can move. A description holding the old path once and the new one
// nowhere is rewritten; one holding the new path once and the old one nowhere is already right; any
// other stops the run before anything is written.
//
// A DESCRIPTION ALONE, BECAUSE `Assets` HOLDS THE SITE'S RECORDS (#531). Every request asks
// `refusesBeyondDescriptions` first, so a body carrying a name, a type or options, or any request to a
// row, is refused before it leaves. It sends one GET of the schema before, one PATCH if the field needs
// it, and one GET after.
//
// A LEDGER BEFORE THE PATCH. `--apply` writes the base — `live` or `test`, as the run named it — the
// field and its description before and after to
// `scripts/import/ledgers/describe_serial_path_612-<base>-<instant>.jsonl` first.
//
// AND IT LOOKS AFTERWARDS. The re-read compares `Assets` whole against the read before — every field's
// id, name, type, options and description but this one's, and the table's name, primary field and
// description — and this one must read as written.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/describe_serial_path_612.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/describe_serial_path_612.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/describe_serial_path_612.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins, the guard's module and the base's.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the description names the new path, 1 something
// failed or the description is not the one this expects, 2 a dry run with the path still to correct.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusesBeyondDescriptions } from "../../protectedTables.mjs";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "describe_serial_path_612";

const META_ROOT = "https://api.airtable.com/v0/meta";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** `Assets`, by the id both bases share (the test base was made by duplicating the live one, #534). */
const TABLE = { name: "Assets", id: "tblXtmDonSyOyOvV3" };

/** The field, by name — its id differs from base to base. */
const FIELD = "Serial Number";

/** The path the description names, and the one it names once corrected. */
const OLD_PATH = "scripts/import/add_serial_number_601.mjs";
const NEW_PATH = "scripts/import/ran/add_serial_number_601.mjs";

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

/** `Assets` as the base holds it now. */
async function readTable(baseId) {
    const { tables } = await request("GET", `/bases/${baseId}/tables`);
    const table = tables.find((t) => t.id === TABLE.id);
    if (!table) throw new Error(`no table ${TABLE.id} on this base`);
    return table;
}

/** How many times `part` stands in `text`. */
function count(text, part) {
    return text.split(part).length - 1;
}

/** Every fact of the table but this field's description, for the before-and-after. */
function shape(table, fieldId) {
    return JSON.stringify({
        id: table.id,
        name: table.name,
        primaryFieldId: table.primaryFieldId,
        description: table.description ?? "",
        fields: table.fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            options: f.options ?? null,
            description: f.id === fieldId ? null : f.description ?? "",
        })),
    });
}

/** Where two texts part and meet again: what one holds there and the other. */
function difference(a, b) {
    let start = 0;
    while (start < a.length && start < b.length && a[start] === b[start]) start++;
    let end = 0;
    while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
    return { at: start, was: a.slice(start, a.length - end), now: b.slice(start, b.length - end) };
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
    log(`${TABLE.name}."${FIELD}" — the path its description names (#612)`);
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTable(baseId);
    const named = before.fields.filter((f) => f.name === FIELD);
    if (before.name !== TABLE.name || named.length !== 1) {
        log(`  STOPPED: ${TABLE.id} is "${before.name}" with ${named.length} field(s) named ${FIELD}. Nothing was written.`);
        return finish(1, "the field is not the one this expects");
    }
    const [field] = named;
    const said = field.description ?? "";
    const olds = count(said, OLD_PATH);
    const news = count(said, NEW_PATH);
    log(`  ${TABLE.name}."${FIELD}" is ${field.id}: the old path ${olds} time(s), the new path ${news} time(s)`);
    if (olds === 0 && news === 1) return finish(0, "the description names the new path");
    if (olds !== 1 || news !== 0) {
        log("  STOPPED: the description is not the one this corrects. Nothing was written.");
        log(said);
        return finish(1, "the description is not the one this expects");
    }

    const written = said.replace(OLD_PATH, NEW_PATH);
    const moved = difference(said, written);
    log("");
    log(`  the one difference, at character ${moved.at} of ${said.length}:`);
    log(`    before: ${JSON.stringify(moved.was)}`);
    log(`    after:  ${JSON.stringify(moved.now)}`);
    log(`  ${said.length} characters before, ${written.length} after`);

    if (!apply) {
        log("");
        log("=".repeat(72));
        log("DRY RUN — one description would be written and none was.");
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
        JSON.stringify({ kind: "description", base: where, table: TABLE.id, field: field.id, at, before: said, after: written }) + "\n"
    );
    log("");
    log(`ledger: ${ledger}`);

    await request("PATCH", `/bases/${baseId}/tables/${TABLE.id}/fields/${field.id}`, { description: written });
    log(`  written: ${TABLE.name}."${FIELD}"`);

    const after = await readTable(baseId);
    const wrong = [];
    if (shape(after, field.id) !== shape(before, field.id)) wrong.push(`${TABLE.name} changed beyond this field's description`);
    const reread = after.fields.find((f) => f.id === field.id);
    if (!reread || reread.name !== FIELD) wrong.push(`${field.id} is no longer ${FIELD}`);
    if ((reread?.description ?? "") !== written) wrong.push(`${TABLE.name}."${FIELD}" does not read as written`);
    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log(`  ${TABLE.name}."${FIELD}": the description as written, the new path in place of the old`);
    log("  every other field of the table, and the table itself: id, name, type, options and description unchanged");
    return finish(0, "the description names the new path");
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
