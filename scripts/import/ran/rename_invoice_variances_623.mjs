// Names an invoice's variances and its totals as the design does, splits the item's flag in two,
// and adds when an invoice was entered (#623).
//
// WHAT. The screens name four variances in the three-way match's words — Price variance,
// Quantity variance, Delivery variance and Totals differ — and the vendor's figure is the Invoice
// total beside the Calculated total. The base called both stored flags `Variance Flag`, held one
// flag for an item's price and its quantity together, called the vendor's figure `Amount Due`,
// and held no moment for an invoice at all. So this:
//
//   Invoices."Variance Flag"        -> "Totals Differ"          (checkbox, by id)
//   Invoice Items."Variance Flag"   -> "Has Price Variance"     (checkbox, by id)
//   Invoices."Amount Due"           -> "Invoice Total"          (currency, by id)
//   Invoice Items."Has Quantity Variance"   new: checkbox, the sibling's options
//   Invoices."Created At"                   new: dateTime, UTC, `Deliveries."Created At"`'s options
//
// and gives each its description. The test base wore `Has Total Variance` and
// `Has Order Variance` for the first two between this issue's two passes, and a run there finds
// them under those names too. The delivery variance is computed (`lib/deliveryStatus.js`) and
// stored nowhere, so it has no field.
//
// A NAME AND A DESCRIPTION, AND NOTHING ELSE, ON THE THREE RENAMED. Each PATCH carries `name` and
// `description`, so a field keeps its id, its type, its options and every row's value; a formula,
// rollup or view filter reaches a field by id and follows the rename
// (`docs/notes/airtable-access.md`). No field on either base references `Amount Due`'s id.
//
// BY ID, SO A RUN FINDS EACH UNDER ANY NAME IT HAS WORN. The tables and fields carry the same ids
// on both bases, the test base having been made by duplicating the live one (#534). A field
// already wearing its new name is left as it is; one wearing any other name, a field of another
// type, or a new field that stands with other options stops the run before anything is written.
//
// THE ITEM'S FLAG IS SPLIT, SO EVERY ITEM IS JUDGED AGAIN. The old flag held a price that differs
// from the order's OR a quantity invoiced beyond what it ordered, and does not say which; renamed,
// it would claim a price for a row that only went over. So a full run recomputes both flags on
// every invoice item with the app's own two predicates — `lib/variance.js:checkPriceVariance`
// against the ordered item's `Unit Price`, `checkQuantityVariance` with its `Invoiced Qty` rollup
// against its `Qty`, the reads `createInvoiceAction` makes — and writes the rows whose values
// move. An item whose ordered item does not resolve, or whose figures are blank, is judged false
// on the half it cannot compute and named in the output.
//
// THE MOMENT FOR AN INVOICE ALREADY STANDING IS ITS ROW'S OWN CREATION TIME. Airtable returns
// `createdTime` with every record — the instant the row was created, which for an invoice is the
// instant it was entered, `createInvoiceAction` creating the row as it is submitted. So an
// invoice with no `Created At` takes its record's `createdTime`, and no other value.
//
// `--fields-only` MAKES THE TWO NEW FIELDS AND FILLS `Created At`, AND RENAMES NOTHING. Adding a
// field breaks no revision of the app, so a base can take the two first and the names after, when
// a full run also recomputes the split flag — rows the old code wrote in between would otherwise
// hold the joined flag under the price's name. The live base took both runs on 2026-11-12, before
// the merge; `docs/notes/deliveries-and-invoices.md` has why no path broke between.
//
// A LEDGER BEFORE THE WRITES. `--apply` writes the base — `live` or `test`, as the run named it —
// each rename's names and descriptions before and after, each field it makes, and every row it
// writes, before and after, to
// `scripts/import/ledgers/rename_invoice_variances_623-<base>-<instant>.jsonl` first. The way back
// is the same PATCHes with the names swapped and the rows written back; a field cannot be deleted
// through the API, so a new one is a hand step to remove.
//
// AND IT LOOKS AFTERWARDS. The re-read compares the whole schema against the read before —
// every table's id, name, primary field and description, and every field's id, name, type,
// options and description — with these names, descriptions and new fields as written; reads
// `Totals Differ`'s values by field id before and after, which must be the same; and reads every
// row it wrote back for the value it was handed.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/rename_invoice_variances_623.mjs                     (dry run)
//   node --env-file=.env.local scripts/import/ran/rename_invoice_variances_623.mjs --apply --fields-only
//   node --env-file=.env.local scripts/import/ran/rename_invoice_variances_623.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/rename_invoice_variances_623.mjs  (dry run, live)
//
// No loader flag: this file imports only built-ins, the base's module and `lib/variance.js`,
// which imports nothing.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base reads as this run leaves it, 1 something
// failed or a field is not the one this expects, 2 a dry run with something still to write.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { checkPriceVariance, checkQuantityVariance } from "../../../lib/variance.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "rename_invoice_variances_623";

const API_ROOT = "https://api.airtable.com/v0";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const INVOICES = { name: "Invoices", id: "tbl2Z4wEbU64YU14o" };
const INVOICE_ITEMS = { name: "Invoice Items", id: "tblg3coc94b7odikV" };
const PO_ITEMS = { name: "PO Items" };

/** The three renamed fields, by the ids both bases share, each with every name it has worn. */
const RENAMES = [
    {
        table: INVOICES,
        field: "fld8ZPvpB0vUTQz0R",
        type: "checkbox",
        from: ["Variance Flag", "Has Total Variance"],
        to: "Totals Differ",
        description:
            "Totals differ (#623; Variance Flag until then): true when Invoice Total and Calculated " +
            "Total differ by more than half a cent (lib/variance.js:checkTotalsDiffer, #254). " +
            "Backend-set: createInvoiceAction sets it once the invoice items are linked and " +
            "Calculated Total has caught up, and updateInvoiceAction sets it again after an edit.",
    },
    {
        table: INVOICE_ITEMS,
        field: "fldj31SyxdEVwzjEh",
        type: "checkbox",
        from: ["Variance Flag", "Has Order Variance"],
        to: "Has Price Variance",
        description:
            "Price variance (#623): true when this item's Unit Price differs from its ordered item's " +
            "by more than a cent (lib/variance.js:checkPriceVariance). Variance Flag until #623, when " +
            "it held a quantity over the order as well; that half is Has Quantity Variance. " +
            "Backend-set by createInvoiceAction, updateInvoiceAction and an overage correction's split.",
    },
    {
        table: INVOICES,
        field: "fldmiqIxELBqgqauW",
        type: "currency",
        from: ["Amount Due"],
        to: "Invoice Total",
        description:
            "The total the vendor wrote on the invoice, typed in from it and never derived (#623; " +
            "Amount Due until then). Compared against Calculated Total for Totals Differ. Whether " +
            "the invoice has been paid is Paid Date's.",
    },
];

/** The two new fields. Each option set is read off a field already on both bases (#623). */
const NEW_FIELDS = [
    {
        table: INVOICE_ITEMS,
        name: "Has Quantity Variance",
        type: "checkbox",
        options: { icon: "check", color: "redBright" },
        description:
            "Quantity variance (#623): true when more has been invoiced against this item's ordered " +
            "item, across every invoice, than it ordered — PO Items.\"Invoiced Qty\" against its Qty " +
            "(lib/variance.js:checkQuantityVariance). Backend-set by the same three writers as Has " +
            "Price Variance, its sibling.",
    },
    {
        table: INVOICES,
        name: "Created At",
        type: "dateTime",
        options: {
            dateFormat: { name: "local", format: "l" },
            timeFormat: { name: "12hour", format: "h:mma" },
            timeZone: "utc",
        },
        description:
            "When the invoice was entered, UTC instant, *At convention (#623). Written by " +
            "createInvoiceAction with Recorded By, and by nothing else: updateInvoice has no parameter " +
            "for it. Distinct from Issue Date on purpose: an invoice is entered after the vendor issued " +
            "it. Shown beside who entered it. An invoice standing before this field took its record's " +
            "own creation time (scripts/import/ran/rename_invoice_variances_623.mjs).",
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

/** Every row of a table, its fields keyed by field id, with its own `createdTime`. */
async function readRows(baseId, tableId, fieldIds) {
    const rows = [];
    let offset;
    do {
        const query = new URLSearchParams({ returnFieldsByFieldId: "true" });
        for (const id of fieldIds) query.append("fields[]", id);
        if (offset) query.set("offset", offset);
        const page = await request("GET", `/${baseId}/${tableId}?${query}`);
        rows.push(...page.records);
        offset = page.offset;
    } while (offset);
    return rows;
}

/** Ten rows a request, one request at a time — the pace `lib/airtableBatch.js` keeps. */
async function writeRows(baseId, tableId, updates) {
    for (let i = 0; i < updates.length; i += 10) {
        await request("PATCH", `/${baseId}/${tableId}`, { records: updates.slice(i, i + 10) });
    }
}

const tableOf = (tables, spec) => tables.find((t) => t.id === spec.id);
const fieldNamed = (table, name) => table?.fields.find((f) => f.name === name) ?? null;

/** What is wrong with one renamed field as read, or null when it is the one this renames. */
function renameProblem(tables, spec) {
    const table = tableOf(tables, spec.table);
    if (!table) return `no table ${spec.table.id} on this base`;
    if (table.name !== spec.table.name) return `${spec.table.id} is called "${table.name}", not ${spec.table.name}`;
    const field = table.fields.find((f) => f.id === spec.field);
    if (!field) return `${spec.table.name} holds no field ${spec.field}`;
    if (![...spec.from, spec.to].includes(field.name)) {
        return `${spec.table.name}.${spec.field} is called "${field.name}", none of ${[...spec.from, spec.to].map((n) => `"${n}"`).join(", ")}`;
    }
    if (field.type !== spec.type) return `${spec.table.name}."${field.name}" is a ${field.type}, not a ${spec.type}`;
    const taken = table.fields.find((f) => f.name === spec.to && f.id !== spec.field);
    if (taken) return `${spec.table.name}."${spec.to}" is already another field, ${taken.id}`;
    return null;
}

/** A new field as it stands, or null; a problem when one stands that is not it. */
function newFieldState(tables, spec) {
    const field = fieldNamed(tableOf(tables, spec.table), spec.name);
    if (!field) return { field: null, problem: null };
    const same = field.type === spec.type && JSON.stringify(field.options) === JSON.stringify(spec.options);
    return {
        field,
        problem: same ? null : `${spec.table.name}."${spec.name}" is a ${field.type} ${JSON.stringify(field.options)}, not the ${spec.type} this makes`,
    };
}

/** Every fact of the schema, with renamed fields as `renamed` gives them and `skip` left out. */
function shape(tables, renamed = new Map(), skip = new Set()) {
    return JSON.stringify(
        tables.map((t) => ({
            id: t.id,
            name: t.name,
            primaryFieldId: t.primaryFieldId,
            description: t.description ?? "",
            fields: t.fields
                .filter((f) => !skip.has(f.id))
                .map((f) => ({
                    id: f.id,
                    name: renamed.get(f.id)?.name ?? f.name,
                    type: f.type,
                    options: f.options ?? null,
                    description: renamed.get(f.id)?.description ?? f.description ?? "",
                })),
        }))
    );
}

/** The ids of the fields the recompute reads, found by name on the schema as it stands. */
function recomputeFields(tables) {
    const items = tableOf(tables, INVOICE_ITEMS);
    const poItems = tables.find((t) => t.name === PO_ITEMS.name);
    const id = (table, name) => fieldNamed(table, name)?.id ?? null;
    return {
        poItemsTable: poItems?.id ?? null,
        itemUnitPrice: id(items, "Unit Price"),
        itemPOItem: id(items, "PO Item"),
        itemId: id(items, "Invoice Item ID"),
        poUnitPrice: id(poItems, "Unit Price"),
        poQty: id(poItems, "Qty"),
        poInvoicedQty: id(poItems, "Invoiced Qty"),
    };
}

/**
 * Both flags for every invoice item, judged by the app's two predicates, and the rows a half
 * could not be judged on. `price` and `quantity` are the two flags' field ids.
 */
async function planFlags(baseId, ids, price, quantity) {
    const items = await readRows(baseId, INVOICE_ITEMS.id, [ids.itemId, ids.itemUnitPrice, ids.itemPOItem, price, ...(quantity ? [quantity] : [])]);
    const ordered = new Map(
        (await readRows(baseId, ids.poItemsTable, [ids.poUnitPrice, ids.poQty, ids.poInvoicedQty])).map((r) => [r.id, r.fields])
    );
    const plan = [];
    const unjudged = [];
    for (const row of items) {
        const label = row.fields[ids.itemId] ?? row.id;
        const po = ordered.get((row.fields[ids.itemPOItem] || [])[0]) ?? null;
        const unitPrice = row.fields[ids.itemUnitPrice];
        const priceKnown = Boolean(po) && unitPrice != null && po[ids.poUnitPrice] != null;
        const qtyKnown = Boolean(po) && po[ids.poQty] != null;
        if (!priceKnown) unjudged.push(`${label}: price — ${po ? "a unit price is blank" : "no ordered item resolves"}`);
        if (!qtyKnown) unjudged.push(`${label}: quantity — ${po ? "the ordered quantity is blank" : "no ordered item resolves"}`);
        const after = {
            price: priceKnown ? checkPriceVariance(unitPrice, po[ids.poUnitPrice]) : false,
            quantity: qtyKnown ? checkQuantityVariance(po[ids.poInvoicedQty] || 0, po[ids.poQty]) : false,
        };
        const before = { price: Boolean(row.fields[price]), quantity: quantity ? Boolean(row.fields[quantity]) : false };
        plan.push({ id: row.id, label, before, after });
    }
    return { plan, unjudged };
}

async function main() {
    const apply = process.argv.includes("--apply");
    const fieldsOnly = process.argv.includes("--fields-only");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const baseId = airtable.baseId;

    log("=".repeat(72));
    log("An invoice's variances and totals named as the design does, the item flag split (#623)");
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}${fieldsOnly ? "   [new fields only]" : ""}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const states = NEW_FIELDS.map((spec) => ({ spec, ...newFieldState(before, spec) }));
    const ids = recomputeFields(before);
    const missing = Object.entries(ids).filter(([, v]) => !v).map(([k]) => k);
    const problems = [
        ...RENAMES.map((spec) => renameProblem(before, spec)),
        ...states.map((s) => s.problem),
        ...(missing.length ? [`the recompute cannot find ${missing.join(", ")}`] : []),
    ].filter(Boolean);
    if (problems.length > 0) {
        for (const problem of problems) log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }

    const fieldOf = (tables, spec) => tableOf(tables, spec.table).fields.find((f) => f.id === spec.field);
    const asWritten = (tables, spec) => {
        const f = fieldOf(tables, spec);
        return f.name === spec.to && (f.description ?? "") === spec.description;
    };
    const pendingRenames = fieldsOnly ? [] : RENAMES.filter((spec) => !asWritten(before, spec));
    for (const spec of RENAMES) {
        const f = fieldOf(before, spec);
        const state = asWritten(before, spec)
            ? " — already as written"
            : fieldsOnly
              ? " — left for a run without --fields-only"
              : ` -> "${spec.to}", with its description`;
        log(`  ${spec.table.name}.${spec.field} "${f.name}"${state}`);
    }
    for (const s of states) log(`  ${s.spec.table.name}."${s.spec.name}" ${s.field ? `stands, ${s.field.id}` : `-> made, ${s.spec.type}`}`);

    // `Created At`: every invoice holding none takes its record's creation time.
    const createdAt = states.find((s) => s.spec.name === "Created At").field;
    const invoiceRows = await readRows(baseId, INVOICES.id, createdAt ? [createdAt.id] : []);
    const toFill = invoiceRows.filter((row) => !createdAt || !row.fields[createdAt.id]);
    log(`  ${invoiceRows.length} invoice(s), ${toFill.length} to take their record's creation time`);

    // The split: both flags judged again on every item, by a full run only.
    const quantityField = states.find((s) => s.spec.name === "Has Quantity Variance").field;
    const priceField = RENAMES[1].field;
    let flagPlan = { plan: [], unjudged: [] };
    if (!fieldsOnly) {
        flagPlan = await planFlags(baseId, ids, priceField, quantityField?.id ?? null);
        const moving = flagPlan.plan.filter((p) => p.before.price !== p.after.price || p.before.quantity !== p.after.quantity);
        log(`  ${flagPlan.plan.length} invoice item(s) judged again: ${flagPlan.plan.filter((p) => p.after.price).length} price variance, ${flagPlan.plan.filter((p) => p.after.quantity).length} quantity variance, ${moving.length} to write`);
        for (const p of flagPlan.plan) {
            if (p.before.price || p.after.price || p.after.quantity) {
                log(`    ${p.label}: flag ${p.before.price ? "set" : "clear"} -> price ${p.after.price}, quantity ${p.after.quantity}`);
            }
        }
        for (const u of flagPlan.unjudged) log(`    NOT JUDGED ${u}, written false`);
    }
    const flagWrites = flagPlan.plan.filter((p) => p.before.price !== p.after.price || p.before.quantity !== p.after.quantity);

    const pending = pendingRenames.length + states.filter((s) => !s.field).length + toFill.length + flagWrites.length;
    if (pending === 0) return finish(0, fieldsOnly ? "both new fields stand and every invoice holds its moment" : "the base reads as this run leaves it");

    if (!apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${pending} write(s) would be made and none was.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    const totalsBefore = await readRows(baseId, INVOICES.id, [RENAMES[0].field]);

    mkdirSync(LEDGER_DIR, { recursive: true });
    const at = new Date().toISOString();
    const where = airtable.live ? "live" : "test";
    const ledger = join(LEDGER_DIR, `${SCRIPT}-${where}-${at.replace(/[:.]/g, "-")}.jsonl`);
    // The base is named as the run named it, `live` or `test` — the live base's id is written in
    // `lib/airtableBase.js` and nowhere else (`offline/airtable-base.mjs`), the #544 ledgers' shape.
    const lines = [
        ...pendingRenames.map((spec) => {
            const f = fieldOf(before, spec);
            return { kind: "name", base: where, table: spec.table.id, field: spec.field, at, before: { name: f.name, description: f.description ?? "" }, after: { name: spec.to, description: spec.description } };
        }),
        ...states.filter((s) => !s.field).map((s) => ({ kind: "field", base: where, table: s.spec.table.id, at, name: s.spec.name, type: s.spec.type, options: s.spec.options })),
        ...toFill.map((row) => ({ kind: "fill", base: where, table: INVOICES.id, record: row.id, at, field: "Created At", before: null, after: row.createdTime })),
        ...flagWrites.map((p) => ({ kind: "flags", base: where, table: INVOICE_ITEMS.id, record: p.id, at, before: p.before, after: p.after })),
    ];
    writeFileSync(ledger, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
    log("");
    log(`ledger: ${ledger}`);

    for (const spec of pendingRenames) {
        await request("PATCH", `/meta/bases/${baseId}/tables/${spec.table.id}/fields/${spec.field}`, {
            name: spec.to,
            description: spec.description,
        });
        log(`  renamed: ${spec.table.name}."${spec.to}"`);
    }

    const madeIds = new Map(states.filter((s) => s.field).map((s) => [s.spec.name, s.field.id]));
    for (const s of states.filter((s) => !s.field)) {
        const made = await request("POST", `/meta/bases/${baseId}/tables/${s.spec.table.id}/fields`, {
            name: s.spec.name,
            type: s.spec.type,
            options: s.spec.options,
            description: s.spec.description,
        });
        madeIds.set(s.spec.name, made.id);
        log(`  made: ${s.spec.table.name}."${s.spec.name}" ${made.id}`);
    }
    const createdAtId = madeIds.get("Created At");
    const quantityId = madeIds.get("Has Quantity Variance");

    await writeRows(baseId, INVOICES.id, toFill.map((row) => ({ id: row.id, fields: { [createdAtId]: row.createdTime } })));
    if (toFill.length > 0) log(`  filled: ${toFill.length} invoice(s), each with its record's creation time`);
    await writeRows(
        baseId,
        INVOICE_ITEMS.id,
        flagWrites.map((p) => ({ id: p.id, fields: { [priceField]: p.after.price, [quantityId]: p.after.quantity } }))
    );
    if (flagWrites.length > 0) log(`  judged: ${flagWrites.length} invoice item(s) written with both flags`);

    const after = await readTables(baseId);
    const renamed = new Map(pendingRenames.map((spec) => [spec.field, { name: spec.to, description: spec.description }]));
    const newIds = new Set(states.filter((s) => !s.field).map((s) => madeIds.get(s.spec.name)));
    const wrong = [];
    if (shape(after, new Map(), newIds) !== shape(before, renamed)) wrong.push("the schema changed beyond these names, descriptions and new fields");
    for (const spec of pendingRenames) if (fieldOf(after, spec).name !== spec.to) wrong.push(`${spec.table.name}.${spec.field} does not read "${spec.to}"`);
    for (const spec of NEW_FIELDS) {
        const s = newFieldState(after, spec);
        if (!s.field || s.problem || s.field.id !== madeIds.get(spec.name)) wrong.push(`${spec.table.name}."${spec.name}" is not the field this made`);
    }
    const filledBack = new Map((await readRows(baseId, INVOICES.id, [createdAtId])).map((row) => [row.id, row.fields[createdAtId] ?? null]));
    const staleFill = toFill.filter((row) => Date.parse(filledBack.get(row.id)) !== Date.parse(row.createdTime));
    if (staleFill.length > 0) wrong.push(`${staleFill.length} filled invoice(s) do not read their record's creation time`);
    if (flagWrites.length > 0) {
        const back = new Map((await readRows(baseId, INVOICE_ITEMS.id, [priceField, quantityId])).map((r) => [r.id, r.fields]));
        const off = flagWrites.filter((p) => Boolean(back.get(p.id)?.[priceField]) !== p.after.price || Boolean(back.get(p.id)?.[quantityId]) !== p.after.quantity);
        if (off.length > 0) wrong.push(`${off.length} invoice item(s) do not read the flags they were handed: ${off.map((p) => p.label).join(", ")}`);
    }
    const totalsAfter = new Map((await readRows(baseId, INVOICES.id, [RENAMES[0].field])).map((r) => [r.id, Boolean(r.fields[RENAMES[0].field])]));
    const totalsMoved = totalsBefore.filter((r) => Boolean(r.fields[RENAMES[0].field]) !== totalsAfter.get(r.id));
    if (totalsMoved.length > 0) wrong.push(`${totalsMoved.length} Totals Differ value(s) moved`);

    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log(`  ${pendingRenames.length} field(s) renamed, each with its description`);
    log(`  ${newIds.size} field(s) made; ${toFill.length} invoice(s) holding their record's creation time`);
    log(`  ${flagWrites.length} invoice item(s) reading the flags they were judged to`);
    log(`  ${totalsBefore.filter((r) => r.fields[RENAMES[0].field]).length} Totals Differ value(s), read by field id before and after: unchanged`);
    log("  every other table and field: id, name, type, options and description unchanged");
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
