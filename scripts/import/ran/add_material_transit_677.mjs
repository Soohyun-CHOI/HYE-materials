// Adds what sending material between addresses needs to `Material Log` (#677): `Destination Job` and
// `Destination Address` on a Sent row, and `Send` on the rows that settle it — with their reverse
// links named and the descriptions the sending makes false rewritten.
//
// WHAT THE FIELDS ARE. A Sent row stands at the address the material left, its `Qty` negative, and
// names where it went: `Destination Job` and `Destination Address` — both, since one address can be
// several jobs'. A Received row (at the destination), a Send canceled row (back at the address it
// left) and a Written off row each name the Sent row they take out of transit in `Send`, a link to
// this same table; what is in transit is the Sent row's quantity less theirs, computed by
// `lib/materialTransit.js` and stored nowhere. The reverse of `Send` is what lets a Sent row hand over
// every row settling it in one read, wherever those rows' jobs are.
//
// A WRITTEN OFF ROW MOVES NO ADDRESS'S STOCK, and the `Qty` description says so: what it writes off
// left its address with the Sent row and never reached another, so its `Qty` is what it takes out of
// transit and the stock leaves it out (`lib/materialStock.js`).
//
// A LINK TO ITS OWN TABLE, AND WHETHER IT GETS A FAR SIDE. No link on either base reached its own
// table before this one. Airtable's UI gives a new one a reciprocal field; whether a create through
// the Metadata API does is what this run measures, and a `Send` with no reverse stops it with the
// hand step — delete the field and make it in the UI — since a Sent row could then not reach a receipt
// on another job without reading that job's whole ledger.
//
// WHAT IT CANNOT DO. The Metadata API refuses `prefersSingleRecordLink` on create and on update, so
// the three links are made multiple and the run prints the hand toggles and exits 2 until a re-read
// finds each one single. It deletes nothing and writes no record.
//
// A LEDGER BEFORE THE WRITES: `--apply` writes `scripts/import/ledgers/add_material_transit_677-<base>-<at>.jsonl`,
// one line per request with its payload — and for a description, the text it replaces — before it is sent.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/add_material_transit_677.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/add_material_transit_677.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/add_material_transit_677.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins and the base's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base reads as this run leaves it and no hand
// step is outstanding, 1 something failed or a field is not the one this expects, 2 a dry run with
// something still to write, or a hand step still to take.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

let airtable = null;

const SCRIPT = "add_material_transit_677";
const API_ROOT = "https://api.airtable.com/v0";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const TABLE_NAME = "Material Log";

/** The three links, in the order they are made, each with the name its far side takes. */
const LINKS = [
    {
        name: "Destination Job",
        to: "Jobs",
        description:
            "On a Sent row (#677), the job the material was sent to; blank on every other row. One record, enforced by the app.",
        reverse: "Material Log (as Destination)",
        reverseDescription:
            "Reverse link of Material Log.\"Destination Job\" (#677): the Sent rows sending material to this job. The inventory screens read it " +
            "for what is in transit to the job. Named as this base names a second relation between two tables.",
    },
    {
        name: "Destination Address",
        to: "Addresses",
        description:
            "On a Sent row (#677), the address the material was sent to, one of Destination Job's; blank on every other row. One record, enforced by the app.",
        reverse: "Material Log (as Destination)",
        reverseDescription:
            "Reverse link of Material Log.\"Destination Address\" (#677): the Sent rows sending material to this address. Named as this base " +
            "names a second relation between two tables.",
    },
    {
        name: "Send",
        to: TABLE_NAME,
        description:
            "On a Received, Send canceled or Written off row (#677), the Sent row whose in-transit quantity it took; blank on a Sent or an Issued " +
            "row. One record, enforced by the app.",
        reverse: "Material Log (as Send)",
        reverseDescription:
            "Reverse link of Material Log.\"Send\" (#677): on a Sent row, every Received, Send canceled and Written off row settling it, on " +
            "whichever job. What is in transit is the Sent row's quantity less theirs (lib/materialTransit.js).",
    },
];

/** The descriptions the sending makes false, rewritten whole: `null` is the table's own. */
const DESCRIPTIONS = [
    {
        field: null,
        description:
            "What has happened to a job's material at one of its addresses (#675), append-only: the inventory's ledger. Qty is the change to the " +
            "stock of Material at Address on Job, so an Issued or a Sent row is negative — but for a Written off row, which moves no address's " +
            "stock (#677). A delivery is not a row here: the stock at an address is what the deliveries recorded there hold " +
            "(Delivery Items.\"Qty\") plus the sum of these rows less the Written off ones, computed by lib/materialStock.js and stored nowhere. " +
            "Material sent between addresses (#677) is a Sent row at the address it left, naming Destination Job and Destination Address; each " +
            "Received, Send canceled and Written off row names the Sent row it settles in Send, and what is in transit is the Sent row's quantity " +
            "less theirs, computed by lib/materialTransit.js and stored nowhere.",
    },
    {
        field: "Event",
        description:
            "What happened: Issued (#675) — the site took it from the address to use. Sent (#677) — it left the address for Destination Address " +
            "on Destination Job; Received — it arrived there; Send canceled — the sender took back what had not arrived; Written off — an admin " +
            "wrote off what never arrived. Count edited corrects it with a Reason (#678). The screen's words (lib/materialStock.js).",
    },
    {
        field: "Qty",
        description:
            "The change to the stock of Material at Address on Job, in the material's Unit: negative where stock left the address (Issued, Sent), " +
            "positive where it came in (Received, Send canceled). A WRITTEN OFF ROW IS THE ONE EXCEPTION (#677): it moves no address's stock, " +
            "since what it writes off left its address with the Sent row and never reached another, so its Qty is what it took out of transit, " +
            "negative, and the stock leaves it out (lib/materialStock.js) — only what is in transit counts it (lib/materialTransit.js).",
    },
    {
        field: "Event Date",
        description:
            "The day it happened, as the person recording it gave it — on a Sent row the day it was sent, on a Received row the day it arrived " +
            "(#677) — not when it was recorded, which is Recorded At. A Send canceled or Written off row holds the day it was recorded, in the " +
            "recorder's own zone.",
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
            description: undescribed.has(t.id) ? null : t.description ?? "",
            fields: t.fields
                .filter((f) => !skip.has(f.id))
                .map((f) => ({ id: f.id, name: f.name, type: f.type, options: f.options ?? null, description: undescribed.has(f.id) ? null : f.description ?? "" })),
        }))
    );
}

/** What is wrong with one link as the base holds it, or null. */
function linkFault(tables, spec) {
    const table = byName(tables, TABLE_NAME);
    const field = fieldNamed(table, spec.name);
    if (!field) return "missing";
    const far = byName(tables, spec.to);
    if (field.type !== "multipleRecordLinks") return `a ${field.type}, not a link`;
    if (field.options?.linkedTableId !== far.id) return `a link to ${field.options?.linkedTableId}, not ${spec.to}`;
    if (!field.options?.inverseLinkFieldId) return `a link with no field on ${spec.to}`;
    if (!far.fields.some((f) => f.id === field.options.inverseLinkFieldId)) return `a link whose far side ${field.options.inverseLinkFieldId} is not on ${spec.to}`;
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
    log("Sending material between addresses (#677)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const table = byName(before, TABLE_NAME);
    const stops = [];
    if (!table) stops.push(`no ${TABLE_NAME} table on this base — #675's add_material_log_675.mjs makes it`);
    for (const spec of LINKS) if (!byName(before, spec.to)) stops.push(`no ${spec.to} table on this base`);
    for (const name of DESCRIPTIONS.map((d) => d.field).filter(Boolean)) if (table && !fieldNamed(table, name)) stops.push(`${TABLE_NAME} holds no ${name}`);
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return finish(1, "a table is not the one this expects");
    }

    // ── the three links ─────────────────────────────────────────────────────
    let tables = before;
    let pending = 0;
    for (const spec of LINKS) {
        const standing = fieldNamed(byName(tables, TABLE_NAME), spec.name);
        if (standing) {
            const fault = linkFault(tables, spec);
            if (fault) {
                log(`  STOPPED: ${TABLE_NAME}."${spec.name}" (${standing.id}) is ${fault}`);
                if (spec.to === TABLE_NAME && fault.startsWith("a link with no field")) {
                    log(`  HAND STEP: delete ${TABLE_NAME}."${spec.name}" in the UI, then make it there — a link to ${TABLE_NAME} — which gives it`);
                    log(`  its reciprocal field; then run this again.`);
                }
                return finish(1, "a field is not the one this expects");
            }
            log(`  ${TABLE_NAME}."${spec.name}" (${standing.id}) stands, a link to ${spec.to}`);
            continue;
        }
        if (!apply) {
            log(`  would make ${TABLE_NAME}."${spec.name}", a link to ${spec.to}`);
            pending++;
            continue;
        }
        const body = { name: spec.name, type: "multipleRecordLinks", description: spec.description, options: { linkedTableId: byName(tables, spec.to).id } };
        const made = await request("POST", `/meta/bases/${baseId}/tables/${byName(tables, TABLE_NAME).id}/fields`, body);
        log(`  made ${TABLE_NAME}."${spec.name}" (${made.id}) — answered ${JSON.stringify(made.options)}`);
        tables = await readTables(baseId);
        const fault = linkFault(tables, spec);
        if (fault) {
            log(`  STOPPED: ${TABLE_NAME}."${spec.name}" is ${fault}`);
            if (spec.to === TABLE_NAME) {
                log(`  HAND STEP: delete ${TABLE_NAME}."${spec.name}" in the UI, then make it there — a link to ${TABLE_NAME} — which gives it`);
                log(`  its reciprocal field; then run this again.`);
            }
            return finish(1, "a link was made with no far side");
        }
    }
    if (pending > 0) {
        log("");
        log("DRY RUN — the links would be made and were not.");
        return finish(2, "dry run");
    }

    // ── their far sides, named and described ────────────────────────────────
    for (const spec of LINKS) {
        const field = fieldNamed(byName(tables, TABLE_NAME), spec.name);
        const far = byName(tables, spec.to);
        const reverse = far.fields.find((f) => f.id === field.options.inverseLinkFieldId);
        const clash = far.fields.find((f) => f.name === spec.reverse && f.id !== reverse.id);
        if (clash) return finish(1, `${spec.to} already holds another field named ${spec.reverse} (${clash.id})`);
        const change = {
            ...(reverse.name === spec.reverse ? {} : { name: spec.reverse }),
            ...((reverse.description ?? "") === spec.reverseDescription ? {} : { description: spec.reverseDescription }),
        };
        if (Object.keys(change).length === 0) {
            log(`  ${spec.to}."${spec.reverse}" (${reverse.id}) is named and described`);
            continue;
        }
        if (!apply) {
            log(`  would ${change.name ? `rename ${spec.to}."${reverse.name}" to "${spec.reverse}"` : `describe ${spec.to}."${reverse.name}"`}`);
            pending++;
            continue;
        }
        await request("PATCH", `/meta/bases/${baseId}/tables/${far.id}/fields/${reverse.id}`, change, { name: reverse.name, description: reverse.description ?? "" });
        log(`  ${change.name ? `renamed ${spec.to}."${reverse.name}" to "${spec.reverse}"` : `described ${spec.to}."${reverse.name}"`} (${reverse.id})`);
        tables = await readTables(baseId);
    }

    // ── the descriptions the sending makes false ────────────────────────────
    for (const entry of DESCRIPTIONS) {
        const log_ = byName(tables, TABLE_NAME);
        const target = entry.field === null ? log_ : fieldNamed(log_, entry.field);
        const what = entry.field === null ? `${TABLE_NAME}'s description` : `${TABLE_NAME}."${entry.field}"'s description`;
        if ((target.description ?? "") === entry.description) {
            log(`  ${what} is the one this writes`);
            continue;
        }
        if (!apply) {
            log(`  would write ${what}`);
            pending++;
            continue;
        }
        const path = entry.field === null ? `/meta/bases/${baseId}/tables/${log_.id}` : `/meta/bases/${baseId}/tables/${log_.id}/fields/${target.id}`;
        await request("PATCH", path, { description: entry.description }, target.description ?? "");
        log(`  wrote ${what}`);
    }
    if (pending > 0) return finish(2, "dry run");

    // ── read back ───────────────────────────────────────────────────────────
    tables = await readTables(baseId);
    const after = byName(tables, TABLE_NAME);
    const wrong = [];
    const touched = new Set();
    const undescribed = new Set([after.id]);
    for (const spec of LINKS) {
        const fault = linkFault(tables, spec);
        if (fault) {
            wrong.push(`${TABLE_NAME}."${spec.name}" is ${fault}`);
            continue;
        }
        const field = fieldNamed(after, spec.name);
        const reverse = byName(tables, spec.to).fields.find((f) => f.id === field.options.inverseLinkFieldId);
        touched.add(field.id).add(reverse.id);
        if ((field.description ?? "") !== spec.description) wrong.push(`${TABLE_NAME}."${spec.name}"'s description did not read back as written`);
        if (reverse.name !== spec.reverse) wrong.push(`${spec.to}."${reverse.name}" (${reverse.id}) is not named "${spec.reverse}"`);
        if ((reverse.description ?? "") !== spec.reverseDescription) wrong.push(`${spec.to}."${spec.reverse}"'s description did not read back as written`);
    }
    for (const entry of DESCRIPTIONS) {
        const target = entry.field === null ? after : fieldNamed(after, entry.field);
        if (entry.field !== null) undescribed.add(target.id);
        if ((target.description ?? "") !== entry.description) wrong.push(`${entry.field ?? "the table"}'s description did not read back as written`);
    }
    // Every other fact of the base — ids, names, types, options, descriptions — as it stood before.
    // The links made by this run were not in `before`, so only those that stood already are compared.
    const madeNow = new Set([...touched].filter((id) => !before.some((t) => t.fields.some((f) => f.id === id))));
    const reversesBefore = new Set([...touched].filter((id) => !madeNow.has(id)));
    if (shape(tables, new Set([...touched]), undescribed) !== shape(before, new Set([...reversesBefore]), undescribed)) {
        wrong.push("the schema changed beyond these links, their far sides and the four descriptions");
    }

    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    for (const spec of LINKS) {
        const field = fieldNamed(after, spec.name);
        log(`  ${TABLE_NAME}."${spec.name}" (${field.id}) -> ${spec.to}, far side "${spec.reverse}" (${field.options.inverseLinkFieldId})`);
    }
    log(`  ${DESCRIPTIONS.length} descriptions as written; every other table and field unchanged`);
    const steps = LINKS.map((spec) => fieldNamed(after, spec.name))
        .filter((field) => field.options?.prefersSingleRecordLink !== true)
        .map((field) => `${TABLE_NAME}."${field.name}" (${field.id}) — open the field, turn off "Allow linking to multiple records", save`);
    if (steps.length > 0) {
        log("");
        log("HAND STEPS — the Metadata API refuses prefersSingleRecordLink (airtable-access.md):");
        for (const step of steps) log(`  ${step}`);
        return finish(2, `${steps.length} hand step(s) outstanding`);
    }
    log("  links: one record each");
    return finish(0, "the base reads as this run leaves it");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
