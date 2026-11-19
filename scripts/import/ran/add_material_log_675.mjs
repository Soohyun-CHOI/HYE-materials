// Makes `Material Log` (#675): what has happened to a job's material at one of its addresses,
// append-only — the inventory's ledger.
//
// WHAT A ROW IS. One movement of one material's stock at one job's address: `Qty` is the CHANGE to
// that stock, so an `Issued` row holds a negative number, and a job's stock at an address is what
// its deliveries recorded there hold (`Delivery Items."Qty"`, read and never copied here) plus the
// sum of these rows. A delivery is not a row of this table: its quantity follows any change to the
// delivery because it is read from the delivery itself (`lib/materialStock.js`).
//
// WHY THE LATER ISSUES' WORDS ARE IN IT NOW. A select's choices can be written only when the field
// is created — a PATCH of `options.choices` is refused (422, `docs/notes/airtable-access.md`) — so
// `Event` carries #677's and #678's events and `Reason` #678's four reasons from the start, and
// those issues add rows rather than fields or options. A choice is renamed in place if its word
// changes; never added and deleted, which empties every cell holding it.
//
// WHAT IT CANNOT DO. The Metadata API refuses `prefersSingleRecordLink` on create and on update,
// so the four links are made multiple and the run prints the four hand toggles and exits 2 until
// a re-read finds each one single. It deletes nothing, and a field already standing under a
// reverse link's name stops it before any write.
//
// A LEDGER BEFORE THE WRITES: `--apply` writes `scripts/import/ledgers/add_material_log_675-<base>-<at>.jsonl`
// with the create payload before the request.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/add_material_log_675.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/add_material_log_675.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/add_material_log_675.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins and the base's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base reads as this run leaves it and no hand
// step is outstanding, 1 something failed or a field is not the one this expects, 2 a dry run with
// something still to write, or a hand step still to take.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

let airtable = null;

const SCRIPT = "add_material_log_675";
const API_ROOT = "https://api.airtable.com/v0";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const TABLE_NAME = "Material Log";
/** The reverse link each link makes on its far table, named after this table. */
const REVERSE_NAME = TABLE_NAME;

/** The far tables, by name. */
const JOBS = { name: "Jobs" };
const ADDRESSES = { name: "Addresses" };
const MATERIALS = { name: "Materials" };
const USERS = { name: "Users" };
const FAR = [JOBS, ADDRESSES, MATERIALS, USERS];

/** `Deliveries."Created At"`'s options, which every `X At` on this base takes. */
const DATETIME_OPTIONS = {
    dateFormat: { name: "local", format: "l" },
    timeFormat: { name: "12hour", format: "h:mma" },
    timeZone: "utc",
};

/** `Jobs."Closed Date"`'s options (#488), which a calendar day on this base takes. */
const DATE_OPTIONS = { dateFormat: { name: "local", format: "l" } };

/** What can happen to a material's stock at an address (`lib/materialStock.js:MATERIAL_LOG_EVENTS`). */
const EVENT_CHOICES = [
    { name: "Issued", color: "blueLight2" },
    { name: "Sent", color: "purpleLight2" },
    { name: "Received", color: "greenLight2" },
    { name: "Count edited", color: "yellowLight2" },
    { name: "Send canceled", color: "grayLight2" },
    { name: "Written off", color: "redLight2" },
];

/** Why a count was edited (#678). */
const REASON_CHOICES = [
    { name: "Recorded wrong", color: "grayLight2" },
    { name: "Damaged or lost", color: "redLight2" },
    { name: "Returned to the vendor", color: "orangeLight2" },
    { name: "Physical count", color: "cyanLight2" },
];

const TABLE_DESCRIPTION =
    "What has happened to a job's material at one of its addresses (#675), append-only: the " +
    "inventory's ledger. Qty is the change to the stock of Material at Address on Job, so an Issued " +
    "row is negative. A delivery is not a row here: the stock at an address is what the deliveries " +
    "recorded there hold (Delivery Items.\"Qty\") plus the sum of these rows, computed by " +
    "lib/materialStock.js and stored nowhere.";

const FIELDS = [
    {
        name: "Material Log ID",
        type: "singleLineText",
        description:
            "HYE-ML-YYMMDD-###, minted by lib/idSequence.server.js — a daily family, so the date is " +
            "the day the row was recorded, not Event Date.",
    },
    { name: "Job", linkTo: JOBS, description: "The job whose stock moved. One record, enforced by the app." },
    {
        name: "Address",
        linkTo: ADDRESSES,
        description: "The address whose stock of Material on Job moved. One record, enforced by the app.",
    },
    { name: "Material", linkTo: MATERIALS, description: "The material whose stock moved. One record, enforced by the app." },
    {
        name: "Event",
        type: "singleSelect",
        options: { choices: EVENT_CHOICES },
        description:
            "What happened: Issued (#675) — the site took it from the address to use. Sent and " +
            "Received, Send canceled and Written off move it between addresses (#677); Count edited " +
            "corrects it with a Reason (#678). The screen's words (lib/materialStock.js).",
    },
    {
        name: "Qty",
        type: "number",
        options: { precision: 0 },
        description:
            "The change to the stock of Material at Address on Job, in the material's Unit: " +
            "negative where stock left the address (Issued), positive where it came in.",
    },
    {
        name: "Event Date",
        type: "date",
        options: DATE_OPTIONS,
        description: "The day it happened, as the person recording it gave it — not when it was recorded, which is Recorded At.",
    },
    {
        name: "Reason",
        type: "singleSelect",
        options: { choices: REASON_CHOICES },
        description: "Why a count was edited (#678). Blank on every other event.",
    },
    { name: "Recorded By", linkTo: USERS, description: "Who recorded it. One record, enforced by the app." },
    { name: "Recorded At", type: "dateTime", options: DATETIME_OPTIONS, description: "When it was recorded, UTC instant, *At convention." },
];

const REVERSE_DESCRIPTIONS = {
    [JOBS.name]: "Reverse link of Material Log.\"Job\" (#675): every movement of this job's materials. The inventory screens read it.",
    [ADDRESSES.name]: "Reverse link of Material Log.\"Address\" (#675): every movement of material at this address.",
    [MATERIALS.name]: "Reverse link of Material Log.\"Material\" (#675): every movement of this material, on every job.",
    [USERS.name]: "Reverse link of Material Log.\"Recorded By\" (#675): every movement this person recorded.",
};

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function request(method, path, body) {
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

function farTables(tables) {
    const far = Object.fromEntries(FAR.map((t) => [t.name, byName(tables, t.name)]));
    const problems = FAR.filter((t) => !far[t.name]).map((t) => `no ${t.name} table on this base`);
    return { far, problems };
}

function tablePayload(far) {
    return {
        name: TABLE_NAME,
        description: TABLE_DESCRIPTION,
        fields: FIELDS.map(({ linkTo, ...field }) =>
            linkTo ? { ...field, type: "multipleRecordLinks", options: { linkedTableId: far[linkTo.name].id } } : field
        ),
    };
}

/** What is wrong with the table's shape, or [] when it is the one this makes. */
function shapeProblems(table, far) {
    const problems = [];
    const found = FIELDS.map((spec) => fieldNamed(table, spec.name));
    if (found.some((f) => !f) || table.fields.length !== FIELDS.length || found.some((f, i) => table.fields[i]?.id !== f?.id)) {
        return [`${table.name} holds ${JSON.stringify(table.fields.map((f) => f.name))}, not the fields this makes in order`];
    }
    if (table.primaryFieldId !== found[0].id) problems.push(`${table.name}'s primary field is not ${FIELDS[0].name}`);
    FIELDS.forEach((spec, i) => {
        const field = found[i];
        if ((field.description ?? "") !== spec.description) problems.push(`${table.name}."${field.name}"'s description is not the one this writes`);
        if (spec.linkTo) {
            if (field.type !== "multipleRecordLinks" || field.options?.linkedTableId !== far[spec.linkTo.name].id) {
                problems.push(`${table.name}."${field.name}" is not a link to ${spec.linkTo.name}`);
            }
            return;
        }
        if (field.type !== spec.type) problems.push(`${table.name}."${field.name}" is a ${field.type}, not a ${spec.type}`);
        if (spec.type === "singleSelect") {
            const choices = (field.options?.choices ?? []).map(({ name, color }) => ({ name, color }));
            if (JSON.stringify(choices) !== JSON.stringify(spec.options.choices)) problems.push(`${table.name}."${field.name}" holds ${JSON.stringify(choices)}`);
        } else if (spec.options && JSON.stringify(field.options) !== JSON.stringify(spec.options)) {
            problems.push(`${table.name}."${field.name}" has options ${JSON.stringify(field.options)}`);
        }
    });
    return problems;
}

function reverseLinks(table, far) {
    return FIELDS.filter((f) => f.linkTo).map((spec) => {
        const farTable = far[spec.linkTo.name];
        const link = table ? fieldNamed(table, spec.name) : null;
        const reverse = link ? farTable.fields.find((f) => f.id === link.options?.inverseLinkFieldId) ?? null : null;
        const squatter = farTable.fields.find((f) => f.name === REVERSE_NAME && f.id !== reverse?.id) ?? null;
        return { spec, farTable, reverse, squatter };
    });
}

function reversePatches(reverses) {
    return reverses
        .filter((r) => r.reverse)
        .filter((r) => r.reverse.name !== REVERSE_NAME || (r.reverse.description ?? "") !== REVERSE_DESCRIPTIONS[r.farTable.name])
        .map((r) => ({
            what: `${r.farTable.name}.${r.reverse.id}`,
            path: `/tables/${r.farTable.id}/fields/${r.reverse.id}`,
            after: { name: REVERSE_NAME, description: REVERSE_DESCRIPTIONS[r.farTable.name] },
            before: r.reverse.name,
        }));
}

/** Every fact of the schema, with `skip`'s tables and fields left out. */
function shape(tables, skip) {
    return JSON.stringify(
        tables
            .filter((t) => !skip.has(t.id))
            .map((t) => ({
                id: t.id,
                name: t.name,
                primaryFieldId: t.primaryFieldId,
                description: t.description ?? "",
                fields: t.fields
                    .filter((f) => !skip.has(f.id))
                    .map((f) => ({ id: f.id, name: f.name, type: f.type, options: f.options ?? null, description: f.description ?? "" })),
            }))
    );
}

function handSteps(table) {
    return FIELDS.filter((f) => f.linkTo)
        .map((spec) => fieldNamed(table, spec.name))
        .filter((field) => field && field.options?.prefersSingleRecordLink !== true)
        .map((field) => `${TABLE_NAME}."${field.name}" (${field.id}) — open the field, turn off "Allow linking to multiple records", save`);
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
    log("The inventory's ledger (#675)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const { far, problems } = farTables(before);
    if (problems.length > 0) {
        for (const problem of problems) log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "a table is not the one this expects");
    }

    const existing = byName(before, TABLE_NAME);
    const reverses = reverseLinks(existing, far);
    const stops = [
        ...(existing ? shapeProblems(existing, far).filter((p) => !p.endsWith("description is not the one this writes")) : []),
        ...reverses
            .filter((r) => r.squatter)
            .map((r) => `${r.farTable.name}."${REVERSE_NAME}" (${r.squatter.id}, a ${r.squatter.type}) already stands and is not this table's reverse link — delete it by hand first`),
    ];
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }

    if (existing) log(`  ${TABLE_NAME} ${existing.id}: stands`);
    else log(`  ${TABLE_NAME}: -> made, ${FIELDS.length} fields, and ${reverses.length} reverse links named "${REVERSE_NAME}"`);

    if (!existing && !apply) {
        log("");
        log("DRY RUN — the table would be made and was not.");
        return finish(2, "dry run");
    }

    if (!existing) {
        mkdirSync(LEDGER_DIR, { recursive: true });
        const at = new Date().toISOString();
        const where = airtable.live ? "live" : "test";
        const ledger = join(LEDGER_DIR, `${SCRIPT}-${where}-${at.replace(/[:.]/g, "-")}.jsonl`);
        writeFileSync(ledger, JSON.stringify({ kind: "table", base: where, at, payload: tablePayload(far) }) + "\n");
        log(`  ledger: ${ledger}`);
        const made = await request("POST", `/meta/bases/${baseId}/tables`, tablePayload(far));
        log(`  made: ${TABLE_NAME} ${made.id}`);
    }

    // The reverse links Airtable made take this table's name and their descriptions.
    let tables = await readTables(baseId);
    const pending = reversePatches(reverseLinks(byName(tables, TABLE_NAME), farTables(tables).far));
    if (pending.length > 0 && !apply) {
        for (const p of pending) log(`  would describe ${p.what} ("${p.before}")`);
        return finish(2, "dry run");
    }
    for (const p of pending) {
        await request("PATCH", `/meta/bases/${baseId}${p.path}`, p.after);
        log(`  patched: ${p.what} — "${p.after.name}"`);
    }
    if (pending.length > 0) tables = await readTables(baseId);

    const table = byName(tables, TABLE_NAME);
    const after = farTables(tables).far;
    const wrong = table ? shapeProblems(table, after) : [`${TABLE_NAME} does not stand`];
    const finalReverses = table ? reverseLinks(table, after) : [];
    for (const r of finalReverses) if (!r.reverse) wrong.push(`${TABLE_NAME}."${r.spec.name}" has no reverse link on ${r.farTable.name}`);
    for (const p of reversePatches(finalReverses)) wrong.push(`${p.what} reads "${p.before}", not as this writes it`);
    const skip = new Set([...(existing ? [existing.id] : []), ...(table ? [table.id] : []), ...finalReverses.map((r) => r.reverse?.id).filter(Boolean)]);
    if (!existing && shape(tables, skip) !== shape(before, skip)) wrong.push("the schema changed beyond this table and its reverse links");

    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log(`  ${TABLE_NAME} ${table.id}: ${FIELDS.length} fields named and described as written, both selects' choices and colors`);
    log(`  ${finalReverses.length} reverse links named "${REVERSE_NAME}", each with its description`);
    if (!existing) log("  every other table and field: id, name, type, options and description unchanged");
    const steps = handSteps(table);
    if (steps.length > 0) {
        log("");
        log("HAND STEPS — the Metadata API refuses prefersSingleRecordLink (airtable-access.md):");
        for (const step of steps) log(`  ${step}`);
        return finish(2, `${steps.length} hand step(s) outstanding`);
    }
    log("  links: one record each");
    return finish(0, "the base reads as this run leaves it");
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
