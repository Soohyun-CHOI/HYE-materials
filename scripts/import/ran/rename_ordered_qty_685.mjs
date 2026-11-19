// Names the quantity on orders not withdrawn `Ordered Qty`, the word every screen says (#685).
//
// WHAT. `PO Items` holds an ordered item's `Qty` and, beside it, that `Qty` again or 0 once
// its order is withdrawn — the figure Inventory calls `Ordered`. The base called the second
// `Committed Qty`, on `PO Items` and in the `Materials` rollup over it. So this:
//
//   PO Items."Committed Qty"    -> "Ordered Qty"    (formula, by id)
//   Materials."Committed Qty"   -> "Ordered Qty"    (rollup, by id)
//
// and gives each a description saying a withdrawn order's is 0, which is what tells it from
// `Qty`.
//
// A NAME AND A DESCRIPTION, AND NOTHING ELSE. Each PATCH carries `name` and `description`, so a
// field keeps its id, its type, its options and every row's value; a formula, rollup or view
// filter reaches a field by id and follows the rename (`docs/notes/airtable-access.md`). Two
// fields reference these, both by id: the `Materials` rollup reads the `PO Items` formula, and
// `Materials."Uninvoiced Qty"` reads the rollup. A PATCH handing each field its own name and
// description back came back 200 on both types first, on the test base.
//
// BY ID, SO A RUN FINDS EACH UNDER EITHER NAME. The tables and fields carry the same ids on
// both bases, the test base having been made by duplicating the live one (#534). A field
// already wearing its new name and description is left as it is; a field wearing any third
// name, a field of another type, or another field already called `Ordered Qty` stops the run
// before anything is written.
//
// WHAT READS THEM. The app reads every field by name: `lib/airtable/poItems.js` on both
// projections of an ordered item, and `lib/airtable/materials.js:recordToMaterial`. The
// repository names the new name in the commit carrying this script, and
// `offline/table-field-names.mjs` fails a literal of the old one anywhere but here. On the
// production deployment one reader stays open with the materials screens closed —
// `GET /api/pos/[poRecordId]/items`, whose only screen is closed and reads none of it — and
// the live base held no `Purchase Orders` and no `PO Items` row when this was written.
//
// A LEDGER BEFORE THE PATCHES. `--apply` writes the base — `live` or `test`, as the run named
// it — each field's id and its name and description before and after to
// `scripts/import/ledgers/rename_ordered_qty_685-<base>-<instant>.jsonl` first. The way back is
// the same PATCHes with the ledger's `before` values.
//
// AND IT LOOKS AFTERWARDS. The re-read compares the whole schema against the read before —
// every table's id, name, primary field and description, and every field's id, name, type,
// options and description — with these two names and descriptions as written, so a rename that
// moved anything else fails; and it reads both fields and `Materials."Uninvoiced Qty"` on every
// row by field id before and after, which must be the same.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/rename_ordered_qty_685.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/rename_ordered_qty_685.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/rename_ordered_qty_685.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins and the base's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read.
//
// Exit codes, per docs/notes/verification.md: 0 both read as their new names, 1 something
// failed or a field is not the one this expects, 2 a dry run with a rename still to make.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "rename_ordered_qty_685";

const API_ROOT = "https://api.airtable.com/v0";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const PO_ITEMS = { name: "PO Items", id: "tblywiocM7tRgzxEN" };
const MATERIALS = { name: "Materials", id: "tblqXbyM4CJo7AO6Y" };

/** `Materials."Uninvoiced Qty"`, which reads the rollup by id and is read back with it. */
const UNINVOICED_QTY = "flddv3BKpjLTltC4y";

/** The two fields, by the ids both bases share. */
const RENAMES = [
    {
        table: PO_ITEMS,
        field: "fldWyRBx2fkMVx7gX",
        type: "formula",
        from: "Committed Qty",
        to: "Ordered Qty",
        description:
            "This ordered item's Qty while its order is not withdrawn, and 0 once it is; Qty keeps what was ordered either way. " +
            "What the screens call Ordered (#18; Committed Qty until #685). " +
            "The rule for which orders count lives here, in one named field, rather than inside each Materials rollup's condition: " +
            "a rollup condition is invisible in a schema dump, unreadable by code, and would have to be repeated per rollup. " +
            'The & "" coerces the PO Status lookup (an array) to text so the comparison works.',
    },
    {
        table: MATERIALS,
        field: "fldbIC92pdF5S1Tjm",
        type: "rollup",
        from: "Committed Qty",
        to: "Ordered Qty",
        description:
            "How much of this material is on order anywhere: the sum of PO Items.Ordered Qty over every ordered item of it, " +
            "so a withdrawn order adds 0 where its Qty would not (#18; Committed Qty until #685). " +
            "Summed from PO Items so the which-orders-count rule stays in one place. " +
            'The material-axis figure the document-axis pages cannot give: an order\'s page answers "how much of this order is invoiced", ' +
            'this answers "how much of this material is on order anywhere".',
    },
];

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

/** Every row of one table, as `id -> { fieldId: value }` for the named fields, read by field id. */
async function readValues(baseId, tableId, fieldIds) {
    const rows = new Map();
    let offset;
    do {
        const query = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
        for (const id of fieldIds) query.append("fields[]", id);
        if (offset) query.set("offset", offset);
        const page = await request("GET", `/${baseId}/${tableId}?${query}`);
        for (const record of page.records) rows.set(record.id, record.fields);
        offset = page.offset;
    } while (offset);
    return rows;
}

async function readAllValues(baseId) {
    return {
        poItems: await readValues(baseId, PO_ITEMS.id, [RENAMES[0].field]),
        materials: await readValues(baseId, MATERIALS.id, [RENAMES[1].field, UNINVOICED_QTY]),
    };
}

function sameValues(a, b) {
    const flat = (m) => JSON.stringify([...m.entries()].sort(([x], [y]) => (x < y ? -1 : 1)));
    return flat(a.poItems) === flat(b.poItems) && flat(a.materials) === flat(b.materials);
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
    if (field.type !== spec.type) return `${spec.table.name}."${field.name}" is a ${field.type}, not a ${spec.type}`;
    const taken = table.fields.find((f) => f.name === spec.to && f.id !== spec.field);
    if (taken) return `${spec.table.name}."${spec.to}" is already another field, ${taken.id}`;
    return null;
}

/** Every fact of the schema, with these fields' names and descriptions read as `written` gives them. */
function shape(tables, written = new Map()) {
    return JSON.stringify(
        tables.map((t) => ({
            id: t.id,
            name: t.name,
            primaryFieldId: t.primaryFieldId,
            description: t.description ?? "",
            fields: t.fields.map((f) => ({
                id: f.id,
                name: written.get(f.id)?.name ?? f.name,
                type: f.type,
                options: f.options ?? null,
                description: written.get(f.id)?.description ?? f.description ?? "",
            })),
        }))
    );
}

const fieldOf = (tables, spec) => tables.find((t) => t.id === spec.table.id).fields.find((f) => f.id === spec.field);
const isDone = (field, spec) => field.name === spec.to && (field.description ?? "") === spec.description;

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
    log("The quantity on orders not withdrawn named Ordered Qty (#685)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const problems = RENAMES.map((spec) => fieldProblem(before, spec)).filter(Boolean);
    if (problems.length > 0) {
        for (const problem of problems) log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }
    const pending = RENAMES.filter((spec) => !isDone(fieldOf(before, spec), spec));
    for (const spec of RENAMES) {
        const now = fieldOf(before, spec);
        log(`  ${spec.table.name}.${spec.field} (${spec.type}) "${now.name}"${isDone(now, spec) ? " — already its new name and description" : ` -> "${spec.to}", with its description`}`);
    }
    const valuesBefore = await readAllValues(baseId);
    log(`  rows read by field id: PO Items ${valuesBefore.poItems.size}, Materials ${valuesBefore.materials.size}`);
    if (pending.length === 0) return finish(0, "both read as their new names");

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
            .map((spec) => {
                const now = fieldOf(before, spec);
                return JSON.stringify({
                    kind: "field",
                    base: where,
                    table: spec.table.id,
                    field: spec.field,
                    at,
                    before: { name: now.name, description: now.description ?? "" },
                    after: { name: spec.to, description: spec.description },
                });
            })
            .join("\n") + "\n"
    );
    log("");
    log(`ledger: ${ledger}`);

    for (const spec of pending) {
        await request("PATCH", `/meta/bases/${baseId}/tables/${spec.table.id}/fields/${spec.field}`, {
            name: spec.to,
            description: spec.description,
        });
        log(`  renamed at ${new Date().toISOString()}: ${spec.table.name}."${spec.to}"`);
    }

    const after = await readTables(baseId);
    const valuesAfter = await readAllValues(baseId);
    const written = new Map(RENAMES.map((spec) => [spec.field, { name: spec.to, description: spec.description }]));
    const wrong = [];
    if (shape(after) !== shape(before, written)) wrong.push("the schema changed beyond these two names and descriptions");
    for (const spec of RENAMES) if (!isDone(fieldOf(after, spec), spec)) wrong.push(`${spec.table.name}.${spec.field} does not read "${spec.to}" with its description`);
    if (!sameValues(valuesBefore, valuesAfter)) wrong.push("a value read by field id differs from the read before");
    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log("  both read as their new names, each with its description");
    log("  every other table and field: id, name, type, options and description unchanged");
    log(`  every value read by field id unchanged: PO Items ${valuesAfter.poItems.size} rows, Materials ${valuesAfter.materials.size} rows`);
    return finish(0, "both read as their new names");
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
