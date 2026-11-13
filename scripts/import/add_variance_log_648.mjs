// Makes the record of an invoice's accepted variances (#648).
//
// WHAT. An Admin accepts an invoice's price variance, quantity variance or totals difference with
// a reason, and an edit that changes what the variance compares opens it again — or, when the
// edit leaves no variance at all, clears it. This makes the two places that holds:
//
//   Variance Log                          new table, append-only, a child of Invoices
//     Variance Log ID                       primary, singleLineText — {Invoice ID}-{seq}
//     Invoice                               link -> Invoices (single by the app)
//     Invoice Item                          link -> Invoice Items (single by the app; blank on a
//                                           Totals differ row)
//     Variance                              singleSelect: Price variance / Quantity variance /
//                                           Totals differ
//     Event                                 singleSelect: Accepted / Reopened / Cleared
//     Reason                                multilineText — on an Accepted row, required by the app
//     Vendor Figure, Our Figure             number — the two figures the variance compared
//     Recorded By                           link -> Users (single by the app)
//     Event At                              dateTime, UTC
//   Invoice Items."Price Variance Accepted"     new checkbox — the cache of the item's acceptance
//   Invoice Items."Quantity Variance Accepted"  new checkbox
//   Invoices."Totals Differ Accepted"           new checkbox
//
// and the three reverse links the table's links make, `Variance Log` on `Invoices`, `Invoice
// Items` and `Users`, each with a description. Why a log and a cache rather than fields alone is
// `docs/notes/deliveries-and-invoices.md`, "Accepting an invoice's variances (#648)".
//
// ONE CREATE CARRIES THE TABLE, EVERY FIELD AND EVERY SELECT'S CHOICES WITH THEIR COLORS — the
// eighth measured limit in `docs/notes/airtable-access.md`, and the only moment a select's list
// is writable through the API. So the vocabulary is settled here, before the create.
//
// WHAT THE API CANNOT DO IS PRINTED AS A HAND STEP, AND THE RUN SAYS SO UNTIL IT IS DONE.
// `prefersSingleRecordLink` is refused on a field create and on an update (airtable-access.md),
// so the three links come back allowing many records; the app writes one, and the UI's
// "Allow linking to multiple records" is turned off by hand on each base. The re-read reports
// each link's setting, and a run with a hand step outstanding exits 2.
//
// A LEFTOVER FIELD STOPS IT. Deleting a table leaves the reverse links it made standing as text
// under their names (#335, #384), and a second `Variance Log` on `Invoices` would come back as
// `Variance Log 2`, which nothing here would address. So a field already named `Variance Log` on
// any of the three far tables, other than this table's own reverse link, stops the run before
// anything is written.
//
// A LEDGER BEFORE THE WRITES. `--apply` writes the base — `live` or `test`, as the run named it —
// the table it makes, each field, and each description it gives a reverse link, to
// `scripts/import/ledgers/add_variance_log_648-<base>-<instant>.jsonl` first. Nothing here can be
// taken back through the API: a table and a field are deleted by hand.
//
// AND IT LOOKS AFTERWARDS. The re-read compares the whole schema against the read before — every
// table's id, name, primary field and description, every field's id, name, type, options and
// description — with the new table, the three checkboxes and the three reverse links set aside,
// and those against what this made.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/add_variance_log_648.mjs                     (dry run)
//   node --env-file=.env.local scripts/import/add_variance_log_648.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/add_variance_log_648.mjs  (dry run, live)
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
import { describeAirtableBase, resolveAirtableBase } from "../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "add_variance_log_648";

const API_ROOT = "https://api.airtable.com/v0";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "ledgers");

/** The far tables, by the ids both bases share (#534), and `Users` by name. */
const INVOICES = { name: "Invoices", id: "tbl2Z4wEbU64YU14o" };
const INVOICE_ITEMS = { name: "Invoice Items", id: "tblg3coc94b7odikV" };
const USERS = { name: "Users" };

const TABLE_NAME = "Variance Log";

/** The reverse link each link makes on its far table, named after this table. */
const REVERSE_NAME = TABLE_NAME;

/** `Deliveries."Created At"`'s options, which every `X At` on this base takes. */
const DATETIME_OPTIONS = {
    dateFormat: { name: "local", format: "l" },
    timeFormat: { name: "12hour", format: "h:mma" },
    timeZone: "utc",
};

/** The three kinds, in the screen's words without the mark (`lib/variance.js:VARIANCE_KINDS`). */
const VARIANCE_CHOICES = [
    { name: "Price variance", color: "orangeLight2" },
    { name: "Quantity variance", color: "yellowLight2" },
    { name: "Totals differ", color: "redLight2" },
];

/** What can happen to one (`lib/variance.js:VARIANCE_EVENTS`). */
const EVENT_CHOICES = [
    { name: "Accepted", color: "greenLight2" },
    { name: "Reopened", color: "orangeLight2" },
    { name: "Cleared", color: "grayLight2" },
];

const TABLE_DESCRIPTION =
    "What has happened to an invoice's variances (#648), append-only. An Admin accepts a Price " +
    "variance, a Quantity variance or Totals differ with a reason (Accepted); an edit that changes " +
    "the two figures it was accepted on while the variance still stands opens it again (Reopened), " +
    "and one that leaves no variance clears it (Cleared). Each acceptance's state is cached on its " +
    "row — Invoice Items.\"Price Variance Accepted\" and \"Quantity Variance Accepted\", " +
    "Invoices.\"Totals Differ Accepted\" — written by lib/variance.server.js with the row that " +
    "moved it, never by a formula.";

/**
 * The table's fields, in order, with the far tables' ids filled in at run time. `linkTo` names
 * the far table of a link; everything else is the create payload as sent.
 */
const FIELDS = [
    {
        name: "Variance Log ID",
        type: "singleLineText",
        description:
            "{Invoice ID}-{seq}, three digits, minted by lib/idSequence.server.js:generateChildId " +
            "(Invoices::Variance Log) — a child of the invoice its variances are on.",
    },
    {
        name: "Invoice",
        linkTo: INVOICES,
        description: "The invoice whose variance this row is about. One record, enforced by the app.",
    },
    {
        name: "Invoice Item",
        linkTo: INVOICE_ITEMS,
        description:
            "The invoice item a Price variance or Quantity variance row is about; blank on a Totals " +
            "differ row, which is the invoice's own. One record, enforced by the app.",
    },
    {
        name: "Variance",
        type: "singleSelect",
        options: { choices: VARIANCE_CHOICES },
        description:
            "Which of an invoice's three variances: Price variance (Invoice Items.\"Has Price " +
            "Variance\"), Quantity variance (\"Has Quantity Variance\") or Totals differ " +
            "(Invoices.\"Totals Differ\") — the screen's words (lib/variance.js).",
    },
    {
        name: "Event",
        type: "singleSelect",
        options: { choices: EVENT_CHOICES },
        description:
            "Accepted: an Admin accepted the variance, with a reason. Reopened: an edit changed the " +
            "two figures it was accepted on and the variance still stands. Cleared: an edit left no " +
            "variance. The last two end an acceptance; lib/variance.js:acceptanceAfter decides which.",
    },
    {
        name: "Reason",
        type: "multilineText",
        description: "Why the office accepted it, as the Admin typed it. Required on an Accepted row; blank on the others.",
    },
    {
        name: "Vendor Figure",
        type: "number",
        options: { precision: 2 },
        description:
            "The invoice's side of the comparison when this row was written: the item's Unit Price " +
            "(Price variance), the item's own Qty (Quantity variance) or Invoice Total (Totals differ).",
    },
    {
        name: "Our Figure",
        type: "number",
        options: { precision: 2 },
        description:
            "The side it is held against when this row was written: the ordered item's Unit Price, " +
            "the ordered item's Qty, or Calculated Total. An acceptance stands while both figures " +
            "are what its Accepted row holds.",
    },
    {
        name: "Recorded By",
        linkTo: USERS,
        description:
            "Who accepted it, or whose edit reopened or cleared it; blank where no person did, as " +
            "when an overage correction's order is generated. One record, enforced by the app.",
    },
    {
        name: "Event At",
        type: "dateTime",
        options: DATETIME_OPTIONS,
        description: "When it happened, UTC instant, *At convention.",
    },
];

/** The three caches, each a checkbox on the row whose flag it qualifies. */
const CHECKBOXES = [
    {
        table: INVOICE_ITEMS,
        name: "Price Variance Accepted",
        description:
            "True while an Admin's acceptance of this item's price variance stands (#648): its " +
            "latest Variance Log row is Accepted. Written by lib/variance.server.js with that row, " +
            "and cleared with a Reopened or Cleared one. Read only beside Has Price Variance.",
    },
    {
        table: INVOICE_ITEMS,
        name: "Quantity Variance Accepted",
        description:
            "True while an Admin's acceptance of this item's quantity variance stands (#648): its " +
            "latest Variance Log row is Accepted. Written by lib/variance.server.js with that row, " +
            "and cleared with a Reopened or Cleared one. Read only beside Has Quantity Variance.",
    },
    {
        table: INVOICES,
        name: "Totals Differ Accepted",
        description:
            "True while an Admin's acceptance of this invoice's totals difference stands (#648): its " +
            "latest Totals differ row on Variance Log is Accepted. Written by lib/variance.server.js " +
            "with that row, and cleared with a Reopened or Cleared one. Read only beside Totals Differ.",
    },
].map((spec) => ({ ...spec, type: "checkbox", options: { icon: "check", color: "greenBright" } }));

/** The descriptions the three reverse links take, by far table. */
const REVERSE_DESCRIPTIONS = {
    [INVOICES.name]:
        "Reverse link of Variance Log.\"Invoice\" (#648): every row recorded against this " +
        "invoice's variances. The invoice detail reads them for who accepted each and why.",
    [INVOICE_ITEMS.name]: "Reverse link of Variance Log.\"Invoice Item\" (#648): every row recorded against this item's two variances.",
    [USERS.name]: "Reverse link of Variance Log.\"Recorded By\" (#648): every acceptance, reopening and clearing this person recorded.",
};

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function request(method, path, body) {
    calls++;
    const res = await fetch(`${API_ROOT}${path}`, {
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
    return (await request("GET", `/meta/bases/${baseId}/tables`)).tables;
}

const byId = (tables, id) => tables.find((t) => t.id === id) ?? null;
const byName = (tables, name) => tables.find((t) => t.name === name) ?? null;
const fieldNamed = (table, name) => table?.fields.find((f) => f.name === name) ?? null;

/** The far tables as this base holds them, or the reason one is not the table this expects. */
function farTables(tables) {
    const invoices = byId(tables, INVOICES.id);
    const items = byId(tables, INVOICE_ITEMS.id);
    const users = byName(tables, USERS.name);
    const problems = [];
    if (!invoices || invoices.name !== INVOICES.name) problems.push(`${INVOICES.id} is not ${INVOICES.name} on this base`);
    if (!items || items.name !== INVOICE_ITEMS.name) problems.push(`${INVOICE_ITEMS.id} is not ${INVOICE_ITEMS.name} on this base`);
    if (!users) problems.push("no Users table on this base");
    return { far: { [INVOICES.name]: invoices, [INVOICE_ITEMS.name]: items, [USERS.name]: users }, problems };
}

/** The create payload for the table, the far tables' ids filled in. */
function tablePayload(far) {
    return {
        name: TABLE_NAME,
        description: TABLE_DESCRIPTION,
        fields: FIELDS.map(({ linkTo, ...field }) =>
            linkTo ? { ...field, type: "multipleRecordLinks", options: { linkedTableId: far[linkTo.name].id } } : field
        ),
    };
}

/** What is wrong with the table as it stands, or [] when it is the one this makes. */
function tableProblems(table, far) {
    const problems = [];
    if (table.description !== TABLE_DESCRIPTION) problems.push(`${TABLE_NAME}'s description is not the one this writes`);
    const names = table.fields.map((f) => f.name);
    if (JSON.stringify(names) !== JSON.stringify(FIELDS.map((f) => f.name))) {
        problems.push(`${TABLE_NAME} holds ${JSON.stringify(names)}, not the fields this makes`);
        return problems;
    }
    if (table.primaryFieldId !== table.fields[0].id) problems.push(`${TABLE_NAME}'s primary field is not Variance Log ID`);
    for (const spec of FIELDS) {
        const field = fieldNamed(table, spec.name);
        if ((field.description ?? "") !== spec.description) problems.push(`${TABLE_NAME}."${spec.name}"'s description is not the one this writes`);
        if (spec.linkTo) {
            if (field.type !== "multipleRecordLinks" || field.options?.linkedTableId !== far[spec.linkTo.name].id) {
                problems.push(`${TABLE_NAME}."${spec.name}" is not a link to ${spec.linkTo.name}`);
            }
            continue;
        }
        if (field.type !== spec.type) problems.push(`${TABLE_NAME}."${spec.name}" is a ${field.type}, not a ${spec.type}`);
        if (spec.type === "singleSelect") {
            const choices = (field.options?.choices ?? []).map(({ name, color }) => ({ name, color }));
            if (JSON.stringify(choices) !== JSON.stringify(spec.options.choices)) {
                problems.push(`${TABLE_NAME}."${spec.name}" holds ${JSON.stringify(choices)}`);
            }
        } else if (spec.options && JSON.stringify(field.options) !== JSON.stringify(spec.options)) {
            problems.push(`${TABLE_NAME}."${spec.name}" has options ${JSON.stringify(field.options)}`);
        }
    }
    return problems;
}

/** A checkbox as it stands, or null; a problem when one stands that is not it. */
function checkboxState(far, spec) {
    const field = fieldNamed(far[spec.table.name], spec.name);
    if (!field) return { field: null, problem: null };
    const same = field.type === spec.type && JSON.stringify(field.options) === JSON.stringify(spec.options);
    return {
        field,
        problem: same ? null : `${spec.table.name}."${spec.name}" is a ${field.type} ${JSON.stringify(field.options)}, not the ${spec.type} this makes`,
    };
}

/**
 * Each link's reverse field on its far table, found by the link's own `inverseLinkFieldId` — or,
 * before the table exists, a field already holding the name the reverse needs, which stops the run.
 */
function reverseLinks(table, far) {
    return FIELDS.filter((f) => f.linkTo).map((spec) => {
        const farTable = far[spec.linkTo.name];
        const link = table ? fieldNamed(table, spec.name) : null;
        const reverse = link ? farTable.fields.find((f) => f.id === link.options?.inverseLinkFieldId) ?? null : null;
        const squatter = farTable.fields.find((f) => f.name === REVERSE_NAME && f.id !== reverse?.id) ?? null;
        return { spec, farTable, link, reverse, squatter };
    });
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

/** The hand steps still outstanding: each link that still allows many records. */
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
    log("The record of an invoice's accepted variances (#648)");
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
    const states = CHECKBOXES.map((spec) => ({ spec, ...checkboxState(far, spec) }));
    const stops = [
        ...(existing ? tableProblems(existing, far) : []),
        ...reverses.filter((r) => r.squatter).map((r) => `${r.farTable.name}."${REVERSE_NAME}" (${r.squatter.id}, a ${r.squatter.type}) already stands and is not this table's reverse link — delete it by hand first (#335, #384)`),
        ...states.map((s) => s.problem),
    ].filter(Boolean);
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }

    log(`  ${TABLE_NAME}: ${existing ? `stands, ${existing.id}` : `-> made, ${FIELDS.length} fields`}`);
    for (const s of states) log(`  ${s.spec.table.name}."${s.spec.name}" ${s.field ? `stands, ${s.field.id}` : "-> made, checkbox"}`);
    const describe = existing
        ? reverses.filter((r) => (r.reverse?.description ?? "") !== REVERSE_DESCRIPTIONS[r.farTable.name])
        : reverses;
    for (const r of reverses) {
        const pending = describe.includes(r);
        log(`  ${r.farTable.name}."${REVERSE_NAME}" ${r.reverse ? `stands, ${r.reverse.id}` : "-> made with the table"}${pending ? ", -> described" : ""}`);
    }

    const pending = (existing ? 0 : 1) + states.filter((s) => !s.field).length + describe.length;
    if (pending > 0 && !apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${pending} write(s) would be made and none was.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    let made = existing;
    const madeIds = new Set();
    if (pending > 0) {
        mkdirSync(LEDGER_DIR, { recursive: true });
        const at = new Date().toISOString();
        const where = airtable.live ? "live" : "test";
        const ledger = join(LEDGER_DIR, `${SCRIPT}-${where}-${at.replace(/[:.]/g, "-")}.jsonl`);
        // The base is named as the run named it, `live` or `test` — the live base's id is written in
        // `lib/airtableBase.js` and nowhere else (`offline/airtable-base.mjs`).
        const lines = [
            ...(existing ? [] : [{ kind: "table", base: where, at, payload: tablePayload(far) }]),
            ...states.filter((s) => !s.field).map((s) => ({ kind: "field", base: where, table: s.spec.table.id, at, name: s.spec.name, type: s.spec.type, options: s.spec.options })),
            ...describe.map((r) => ({ kind: "description", base: where, table: r.farTable.id, at, field: REVERSE_NAME, before: r.reverse?.description ?? "", after: REVERSE_DESCRIPTIONS[r.farTable.name] })),
        ];
        writeFileSync(ledger, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
        log("");
        log(`ledger: ${ledger}`);

        if (!existing) {
            made = await request("POST", `/meta/bases/${baseId}/tables`, tablePayload(far));
            madeIds.add(made.id);
            log(`  made: ${TABLE_NAME} ${made.id}`);
        }
        for (const s of states.filter((s) => !s.field)) {
            const field = await request("POST", `/meta/bases/${baseId}/tables/${s.spec.table.id}/fields`, {
                name: s.spec.name,
                type: s.spec.type,
                options: s.spec.options,
                description: s.spec.description,
            });
            madeIds.add(field.id);
            log(`  made: ${s.spec.table.name}."${s.spec.name}" ${field.id}`);
        }
    }

    // The reverse links, read off the table as it now stands: each is set aside from the
    // comparison below, given its description, and named as the far table's code reads it.
    let tables = await readTables(baseId);
    const now = reverseLinks(byName(tables, TABLE_NAME), farTables(tables).far);
    for (const r of now) {
        if (!r.reverse) continue;
        if (r.reverse.name !== REVERSE_NAME) {
            // A reverse link Airtable named otherwise is the quiet symptom airtable-access.md records:
            // `record.get("Variance Log")` would read nothing. The name PATCHes cleanly.
            await request("PATCH", `/meta/bases/${baseId}/tables/${r.farTable.id}/fields/${r.reverse.id}`, { name: REVERSE_NAME });
            log(`  renamed: ${r.farTable.name}."${r.reverse.name}" -> "${REVERSE_NAME}"`);
        }
        if ((r.reverse.description ?? "") !== REVERSE_DESCRIPTIONS[r.farTable.name]) {
            await request("PATCH", `/meta/bases/${baseId}/tables/${r.farTable.id}/fields/${r.reverse.id}`, {
                description: REVERSE_DESCRIPTIONS[r.farTable.name],
            });
            log(`  described: ${r.farTable.name}."${REVERSE_NAME}"`);
        }
    }

    // The re-read.
    tables = await readTables(baseId);
    const table = byName(tables, TABLE_NAME);
    const after = farTables(tables).far;
    const wrong = [];
    if (!table) wrong.push(`${TABLE_NAME} does not stand`);
    else wrong.push(...tableProblems(table, after));
    for (const spec of CHECKBOXES) {
        const s = checkboxState(after, spec);
        if (!s.field || s.problem || (s.field.description ?? "") !== spec.description) {
            wrong.push(`${spec.table.name}."${spec.name}" is not the field this makes`);
        }
    }
    const finalReverses = table ? reverseLinks(table, after) : [];
    for (const r of finalReverses) {
        if (!r.reverse) wrong.push(`${TABLE_NAME}."${r.spec.name}" has no reverse link on ${r.farTable.name}`);
        else if (r.reverse.name !== REVERSE_NAME || (r.reverse.description ?? "") !== REVERSE_DESCRIPTIONS[r.farTable.name]) {
            wrong.push(`${r.farTable.name}."${r.reverse.name}" is not named and described as this writes`);
        }
    }
    // Everything else: the schema before against the schema after, the new and the reverse set aside.
    const skip = new Set([
        ...(table ? [table.id] : []),
        ...CHECKBOXES.map((spec) => fieldNamed(after[spec.table.name], spec.name)?.id).filter(Boolean),
        ...finalReverses.map((r) => r.reverse?.id).filter(Boolean),
    ]);
    if (shape(tables, skip) !== shape(before, skip)) wrong.push("the schema changed beyond this table, its reverse links and the three checkboxes");

    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log(`  ${TABLE_NAME} ${table.id}: ${FIELDS.length} fields, both selects' choices and colors as written`);
    log(`  ${CHECKBOXES.length} checkboxes, each with its description`);
    log(`  ${finalReverses.length} reverse links named "${REVERSE_NAME}", each with its description`);
    log("  every other table and field: id, name, type, options and description unchanged");

    const steps = handSteps(table);
    if (steps.length > 0) {
        log("");
        log("HAND STEPS — the Metadata API refuses prefersSingleRecordLink (airtable-access.md):");
        for (const step of steps) log(`  ${step}`);
        return finish(2, `${steps.length} hand step(s) outstanding`);
    }
    log("  all three links allow one record");
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
