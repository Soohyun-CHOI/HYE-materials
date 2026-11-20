// Adds what editing a count needs to `Material Log` (#678): `Counted Qty`, the quantity a count edit
// set the stock to, and `Notes`, what the person editing it wrote — with the two descriptions a
// count edit makes false rewritten.
//
// WHAT THE FIELDS ARE. A Count edited row stands at the address whose count it corrects, and its
// `Qty` is the change it made, as every row's is (#675): the counted quantity less the stock before
// it, so either sign. `Counted Qty` keeps what was counted, so the count before the edit is
// `Counted Qty` less `Qty` — stored rather than computed off the rows before it, since a delivery
// deleted, corrected to another address (#680) or split afterwards would move a computed figure
// under an edit already made. `Notes` is free text about an event row, the base's word for that
// (`docs/notes/naming.md`). `Reason` was made with the table by #675 and is not touched.
//
// WHAT IT CANNOT DO. Nothing here is refused by the Metadata API: a number and a long text create
// cleanly (#648 made both in one table create), and a description PATCHes. It deletes nothing and
// writes no record.
//
// A LEDGER BEFORE THE WRITES: `--apply` writes `scripts/import/ledgers/add_count_edit_678-<base>-<at>.jsonl`,
// one line per request with its payload — and for a description, the text it replaces — before it is sent.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/add_count_edit_678.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/add_count_edit_678.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/add_count_edit_678.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins and the base's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base reads as this run leaves it, 1 something
// failed or a field is not the one this expects, 2 a dry run with something still to write.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

let airtable = null;

const SCRIPT = "add_count_edit_678";
const API_ROOT = "https://api.airtable.com/v0";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const TABLE_NAME = "Material Log";

/** The two fields, in the order they are made. */
const FIELDS = [
    {
        name: "Counted Qty",
        type: "number",
        options: { precision: 0 },
        description:
            "On a Count edited row (#678), the quantity of Material counted at Address on Job — what the edit set the stock there to, in the " +
            "material's Unit, 0 or more. The count before the edit is Counted Qty less Qty. Blank on every other event.",
    },
    {
        name: "Notes",
        type: "multilineText",
        options: null,
        description: "On a Count edited row (#678), what the person editing the count wrote about it, if anything. Blank on every other event.",
    },
];

/** The descriptions a count edit makes false, rewritten whole. */
const DESCRIPTIONS = [
    {
        field: "Qty",
        description:
            "The change to the stock of Material at Address on Job, in the material's Unit: negative where stock left the address (Issued, Sent), " +
            "positive where it came in (Received, Send canceled), and either on a Count edited row (#678), whose Qty is its Counted Qty less the " +
            "stock before it. A WRITTEN OFF ROW IS THE ONE EXCEPTION (#677): it moves no address's stock, since what it writes off left its " +
            "address with the Sent row and never reached another, so its Qty is what it took out of transit, negative, and the stock leaves it " +
            "out (lib/materialStock.js) — only what is in transit counts it (lib/materialTransit.js).",
    },
    {
        field: "Event Date",
        description:
            "The day it happened, as the person recording it gave it — on a Sent row the day it was sent, on a Received row the day it arrived " +
            "(#677) — not when it was recorded, which is Recorded At. A Send canceled, Written off or Count edited (#678) row holds the day it " +
            "was recorded, in the recorder's own zone.",
    },
];

let calls = 0;
let ledger = null;

function log(line = "") {
    console.log(line);
}

async function request(method, path, body, before = undefined) {
    if (method !== "GET") {
        if (!ledger) {
            mkdirSync(LEDGER_DIR, { recursive: true });
            const at = new Date().toISOString();
            ledger = join(LEDGER_DIR, `${SCRIPT}-${airtable.live ? "live" : "test"}-${at.replace(/[:.]/g, "-")}.jsonl`);
            log(`  ledger: ${ledger}`);
        }
        // The base is named by the file's name and not in the path: the live base's id is written in
        // one file alone (`lib/airtableBase.js`, #534).
        const where = path.replace(airtable.baseId, "{baseId}");
        appendFileSync(ledger, JSON.stringify({ at: new Date().toISOString(), method, path: where, body, ...(before === undefined ? {} : { before }) }) + "\n");
    }
    calls++;
    const res = await fetch(`${API_ROOT}${path}`, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

const readTables = async (baseId) => (await request("GET", `/meta/bases/${baseId}/tables`)).tables;
const byName = (tables, name) => tables.find((t) => t.name === name) ?? null;
const fieldNamed = (table, name) => table?.fields.find((f) => f.name === name) ?? null;

/** Every fact of the schema, with `skip`'s field ids and `undescribed`'s descriptions left out. */
function shape(tables, skip, undescribed) {
    return JSON.stringify(
        tables.map((t) => ({
            id: t.id,
            name: t.name,
            primaryFieldId: t.primaryFieldId,
            description: t.description ?? "",
            fields: t.fields
                .filter((f) => !skip.has(f.id))
                .map((f) => ({ id: f.id, name: f.name, type: f.type, options: f.options ?? null, description: undescribed.has(f.id) ? null : f.description ?? "" })),
        }))
    );
}

/** What is wrong with one field as the base holds it, or null. */
function fieldFault(table, spec) {
    const field = fieldNamed(table, spec.name);
    if (!field) return "missing";
    if (field.type !== spec.type) return `a ${field.type}, not a ${spec.type}`;
    if (spec.options && JSON.stringify(field.options ?? null) !== JSON.stringify(spec.options)) {
        return `a ${field.type} with options ${JSON.stringify(field.options)}, not ${JSON.stringify(spec.options)}`;
    }
    if ((field.description ?? "") !== spec.description) return "described otherwise";
    return null;
}

function finish(code, verdict) {
    log("");
    log(`${calls} Airtable API call(s). ${verdict}.`);
    return code;
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
    log("Editing a count (#678)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const table = byName(before, TABLE_NAME);
    const stops = [];
    if (!table) stops.push(`no ${TABLE_NAME} table on this base — #675's add_material_log_675.mjs makes it`);
    for (const name of DESCRIPTIONS.map((d) => d.field)) if (table && !fieldNamed(table, name)) stops.push(`${TABLE_NAME} holds no ${name}`);
    const event = fieldNamed(table, "Event");
    if (table && !(event?.options?.choices ?? []).some((c) => c.name === "Count edited")) stops.push(`${TABLE_NAME}."Event" offers no Count edited`);
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return finish(1, "a table is not the one this expects");
    }

    // ── the two fields ──────────────────────────────────────────────────────
    let tables = before;
    let pending = 0;
    for (const spec of FIELDS) {
        const standing = fieldNamed(byName(tables, TABLE_NAME), spec.name);
        if (standing) {
            const fault = fieldFault(byName(tables, TABLE_NAME), spec);
            if (fault) {
                log(`  STOPPED: ${TABLE_NAME}."${spec.name}" (${standing.id}) is ${fault}`);
                return finish(1, "a field is not the one this expects");
            }
            log(`  ${TABLE_NAME}."${spec.name}" (${standing.id}) stands, a ${spec.type}`);
            continue;
        }
        if (!apply) {
            log(`  would make ${TABLE_NAME}."${spec.name}", a ${spec.type}`);
            pending++;
            continue;
        }
        const body = { name: spec.name, type: spec.type, description: spec.description, ...(spec.options ? { options: spec.options } : {}) };
        const made = await request("POST", `/meta/bases/${baseId}/tables/${byName(tables, TABLE_NAME).id}/fields`, body);
        log(`  made ${TABLE_NAME}."${spec.name}" (${made.id}) — answered ${JSON.stringify({ type: made.type, options: made.options ?? null })}`);
        tables = await readTables(baseId);
    }

    // ── the descriptions a count edit makes false ───────────────────────────
    for (const entry of DESCRIPTIONS) {
        const log_ = byName(tables, TABLE_NAME);
        const target = fieldNamed(log_, entry.field);
        const what = `${TABLE_NAME}."${entry.field}"'s description`;
        if ((target.description ?? "") === entry.description) {
            log(`  ${what} is the one this writes`);
            continue;
        }
        if (!apply) {
            log(`  would write ${what}`);
            pending++;
            continue;
        }
        await request("PATCH", `/meta/bases/${baseId}/tables/${log_.id}/fields/${target.id}`, { description: entry.description }, target.description ?? "");
        log(`  wrote ${what}`);
    }
    if (pending > 0) {
        log("");
        log("DRY RUN — nothing was written.");
        return finish(2, "dry run");
    }

    // ── read back ───────────────────────────────────────────────────────────
    tables = await readTables(baseId);
    const after = byName(tables, TABLE_NAME);
    const wrong = [];
    const made = new Set();
    for (const spec of FIELDS) {
        const fault = fieldFault(after, spec);
        if (fault) wrong.push(`${TABLE_NAME}."${spec.name}" is ${fault}`);
        const field = fieldNamed(after, spec.name);
        if (field) made.add(field.id);
    }
    const undescribed = new Set();
    for (const entry of DESCRIPTIONS) {
        const target = fieldNamed(after, entry.field);
        undescribed.add(target.id);
        if ((target.description ?? "") !== entry.description) wrong.push(`${entry.field}'s description did not read back as written`);
    }
    // Every other fact of the base — ids, names, types, options, descriptions — as it stood before.
    // The fields this run made were not in `before`, so they are left out of the comparison.
    if (shape(tables, made, undescribed) !== shape(before, made, undescribed)) {
        wrong.push("the schema changed beyond these two fields and the two descriptions");
    }

    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    for (const spec of FIELDS) {
        const field = fieldNamed(after, spec.name);
        log(`  ${TABLE_NAME}."${spec.name}" (${field.id}) — ${field.type} ${JSON.stringify(field.options ?? null)}`);
    }
    log(`  ${DESCRIPTIONS.length} descriptions as written; every other table and field unchanged`);
    return finish(0, "the base reads as this run leaves it");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
