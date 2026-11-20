// Makes `Delivery Log` (#680): what has happened to a recorded delivery after it was recorded,
// append-only — the delivery's activity.
//
// WHAT A ROW IS. One event on one delivery. #680 writes `Address corrected`: the delivery's
// `Delivery Address` was corrected from `Former Address` to `Address`, by `Recorded By` at
// `Event At`. Both addresses are stored because the delivery holds only the address it stands at
// now, and the first correction's starting point is on no other row. Stock is not read from here:
// a job's stock at an address is read off the delivery itself (`lib/materialStock.js`), so a
// correction moves it with the one write to the delivery and this row is its record.
//
// WHY #277's EVENT IS IN IT NOW. A select's choices can be written only when the field is created —
// a PATCH of `options.choices` is refused (422, `docs/notes/airtable-access.md`) — so `Event`
// carries `Order attached`, the office attaching a delivery recorded with no order to one, from the
// start. A field that event needs is a create of its own when #277 writes it, which the API allows.
//
// TWO LINKS TO ONE TABLE. `Address` and `Former Address` both reach `Addresses`, so their reverse
// links there are told apart by role, as this base names a second relation between two tables:
// `Delivery Log` and `Delivery Log (as Former Address)`. Airtable names the second one itself on
// create, so the run renames it, freeing a name before it takes one.
//
// WHAT IT CANNOT DO. The Metadata API refuses `prefersSingleRecordLink` on create and on update,
// so the four links are made multiple and the run prints the four hand toggles and exits 2 until
// a re-read finds each one single. It deletes nothing, and a field already standing under a
// reverse link's name stops it before any write.
//
// A LEDGER BEFORE THE WRITES: `--apply` writes `scripts/import/ledgers/add_delivery_log_680-<base>-<at>.jsonl`
// with the create payload before the request.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/add_delivery_log_680.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/add_delivery_log_680.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/add_delivery_log_680.mjs   (dry run, live)
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

const SCRIPT = "add_delivery_log_680";
const API_ROOT = "https://api.airtable.com/v0";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const TABLE_NAME = "Delivery Log";

/** The far tables, by name. */
const DELIVERIES = { name: "Deliveries" };
const ADDRESSES = { name: "Addresses" };
const USERS = { name: "Users" };
const FAR = [DELIVERIES, ADDRESSES, USERS];

/** `Deliveries."Created At"`'s options, which every `X At` on this base takes. */
const DATETIME_OPTIONS = {
    dateFormat: { name: "local", format: "l" },
    timeFormat: { name: "12hour", format: "h:mma" },
    timeZone: "utc",
};

/** What can happen to a recorded delivery (`lib/deliveryLog.js:DELIVERY_LOG_EVENTS`). */
const EVENT_CHOICES = [
    { name: "Address corrected", color: "blueLight2" },
    { name: "Order attached", color: "greenLight2" },
];

const TABLE_DESCRIPTION =
    "What has happened to a recorded delivery after it was recorded (#680), append-only: the " +
    "delivery's activity. An Address corrected row says its Delivery Address moved from Former " +
    "Address to Address. Stock is not read from here: it is read off the delivery itself " +
    "(lib/materialStock.js), so a correction moves it with its one write to the delivery.";

/**
 * The fields in order. A link's `reverse` is the name its symmetric field takes on the far
 * table, with that field's description.
 */
const FIELDS = [
    {
        name: "Delivery Log ID",
        type: "singleLineText",
        description:
            "{Delivery ID}-{seq}, three digits, minted by lib/idSequence.server.js:generateChildId — the " +
            "shape Delivery Item ID has, told apart by its table.",
    },
    {
        name: "Delivery",
        linkTo: DELIVERIES,
        description: "The delivery this happened to. One record, enforced by the app.",
        reverse: {
            name: "Delivery Log",
            description: "Reverse link of Delivery Log.\"Delivery\" (#680): what has happened to this delivery since it was recorded. Its page reads it.",
        },
    },
    {
        name: "Event",
        type: "singleSelect",
        options: { choices: EVENT_CHOICES },
        description:
            "What happened: Address corrected (#680) — the delivery's address was corrected from Former " +
            "Address to Address. Order attached (#277) — a delivery recorded with no order was attached " +
            "to one. The screen's words (lib/deliveryLog.js).",
    },
    {
        name: "Address",
        linkTo: ADDRESSES,
        description: "Where the delivery stands after the event: on an Address corrected row, the address it was corrected to. One record, enforced by the app.",
        reverse: {
            name: "Delivery Log",
            description: "Reverse link of Delivery Log.\"Address\" (#680): the deliveries whose address was corrected to this one.",
        },
    },
    {
        name: "Former Address",
        linkTo: ADDRESSES,
        description: "On an Address corrected row, the address the delivery was corrected from. One record, enforced by the app.",
        reverse: {
            name: "Delivery Log (as Former Address)",
            description: "Reverse link of Delivery Log.\"Former Address\" (#680): the deliveries whose address was corrected away from this one.",
        },
    },
    {
        name: "Recorded By",
        linkTo: USERS,
        description: "Who made the change. One record, enforced by the app.",
        reverse: {
            name: "Delivery Log",
            description: "Reverse link of Delivery Log.\"Recorded By\" (#680): every change this person made to a recorded delivery.",
        },
    },
    { name: "Event At", type: "dateTime", options: DATETIME_OPTIONS, description: "When it happened, UTC instant, *At convention." },
];

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
const LINKS = FIELDS.filter((f) => f.linkTo);

function farTables(tables) {
    const far = Object.fromEntries(FAR.map((t) => [t.name, byName(tables, t.name)]));
    const problems = FAR.filter((t) => !far[t.name]).map((t) => `no ${t.name} table on this base`);
    return { far, problems };
}

function tablePayload(far) {
    return {
        name: TABLE_NAME,
        description: TABLE_DESCRIPTION,
        fields: FIELDS.map((spec) => {
            const field = Object.fromEntries(Object.entries(spec).filter(([key]) => key !== "linkTo" && key !== "reverse"));
            return spec.linkTo ? { ...field, type: "multipleRecordLinks", options: { linkedTableId: far[spec.linkTo.name].id } } : field;
        }),
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

/**
 * Each link's symmetric field, and any field on the far table already holding the name that
 * field is to take while not being one of this table's reverse links — which stops the run.
 */
function reverseLinks(table, far) {
    const found = LINKS.map((spec) => {
        const farTable = far[spec.linkTo.name];
        const link = table ? fieldNamed(table, spec.name) : null;
        const reverse = link ? farTable.fields.find((f) => f.id === link.options?.inverseLinkFieldId) ?? null : null;
        return { spec, farTable, reverse };
    });
    const ours = new Set(found.map((r) => r.reverse?.id).filter(Boolean));
    return found.map((r) => ({
        ...r,
        squatter: r.farTable.fields.find((f) => f.name === r.spec.reverse.name && !ours.has(f.id)) ?? null,
    }));
}

/**
 * The renames and descriptions the reverse links still need, ordered so a name is freed before
 * it is taken: a patch whose field holds a name another patch takes goes first.
 */
function reversePatches(reverses) {
    const pending = reverses
        .filter((r) => r.reverse)
        .filter((r) => r.reverse.name !== r.spec.reverse.name || (r.reverse.description ?? "") !== r.spec.reverse.description)
        .map((r) => ({
            what: `${r.farTable.name}.${r.reverse.id}`,
            path: `/tables/${r.farTable.id}/fields/${r.reverse.id}`,
            after: { name: r.spec.reverse.name, description: r.spec.reverse.description },
            before: r.reverse.name,
            farTable: r.farTable.name,
        }));
    const taken = (p) => pending.some((q) => q !== p && q.farTable === p.farTable && q.after.name === p.before);
    return [...pending.filter(taken), ...pending.filter((p) => !taken(p))];
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
    return LINKS.map((spec) => fieldNamed(table, spec.name))
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
    log("A delivery's activity (#680)");
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
            .map((r) => `${r.farTable.name}."${r.spec.reverse.name}" (${r.squatter.id}, a ${r.squatter.type}) already stands and is not this table's reverse link — delete it by hand first`),
    ];
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }

    if (existing) log(`  ${TABLE_NAME} ${existing.id}: stands`);
    else log(`  ${TABLE_NAME}: -> made, ${FIELDS.length} fields, and ${LINKS.length} reverse links: ${LINKS.map((l) => `${l.linkTo.name}."${l.reverse.name}"`).join(", ")}`);

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

    // The reverse links Airtable made take their names and their descriptions.
    let tables = await readTables(baseId);
    const pending = reversePatches(reverseLinks(byName(tables, TABLE_NAME), farTables(tables).far));
    if (pending.length > 0 && !apply) {
        for (const p of pending) log(`  would name ${p.what} ("${p.before}") "${p.after.name}"`);
        return finish(2, "dry run");
    }
    for (const p of pending) {
        await request("PATCH", `/meta/bases/${baseId}${p.path}`, p.after);
        log(`  patched: ${p.what} "${p.before}" -> "${p.after.name}"`);
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
    log(`  ${TABLE_NAME} ${table.id}: ${FIELDS.length} fields named and described as written, the select's choices and colors`);
    for (const r of finalReverses) log(`  ${r.farTable.name}."${r.reverse.name}" (${r.reverse.id}), described`);
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
