// `Invoice Items."Position"` (#660): where an item stands on the vendor's invoice, made by this script
// on both bases, and on the test base the rows standing then numbered.
//
// WHY THE FIELD. An invoice item names one ordered item, and a vendor's one item for a material ordered
// on two orders is spread over both (`lib/invoiceSpread.js`), so one item the vendor wrote can be
// several invoice items. They hold one number, and the invoice's page reads them back as one item with
// a share per order. A field on the rows the page already reads costs that page nothing; a table of its
// own would cost a read and hold each item's total twice. Why it is not named for a line of the invoice
// is `offline/line-vocabulary.mjs`.
//
// THE ROWS STANDING THEN ARE NUMBERED BY THE FOLD THE INVOICE'S PAGE DREW THEM WITH, so no page reads
// differently the day the field lands: per invoice, in `Invoice Item ID` order, one number per ordered
// item's `Material` and the row's `Unit Price` (`lib/invoiceItemFold.js`'s key), a row whose ordered
// item has no `Material` a number of its own. An invoice where any row already holds a number is left
// as it is and named. ON THE LIVE BASE NO ROW IS WRITTEN: its `Invoice Items` held none when this was
// made, and a run that finds any there stops before writing the field.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/ran/add_invoice_item_position_660.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/add_invoice_item_position_660.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (the live base, once Soo has approved it)
//
// A LEDGER BEFORE THE WRITES: the field it makes and each row it numbers, with what the row held, to
// `scripts/import/ledgers/add_invoice_item_position_660-<base>-<instant>.jsonl`.
//
// Airtable PAT scopes: data.records:read, data.records:write, schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field as specified and every row a
// number, 1 something failed or is not as specified, 2 a dry run with something to do.

import fs from "node:fs";
import path from "node:path";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";

const API_ROOT = "https://api.airtable.com/v0";
const FIELD = { name: "Position", type: "number", options: { precision: 0 } };

const DESCRIPTION =
    "Issue #660 -- where this item stands on the vendor's invoice: 1 for the first item the vendor wrote, then in the order written. " +
    "One item the vendor wrote is spread over the ordered items of the invoice's orders that hold its material at its ordered price, " +
    "oldest order first (lib/invoiceSpread.js), and every invoice item it was spread into holds the same number, so the invoice's page " +
    "reads them back as one item with a share per order. Written by createInvoiceAction; copied by the edit screen onto a share it adds " +
    "and by an overage correction's split (#265) onto the invoice item it makes. A row with none -- made by hand -- reads as an item of " +
    "its own. Made by scripts/import/ran/add_invoice_item_position_660.mjs, which numbered the test base's rows standing then by the fold " +
    "the page drew them with: one number per Material and Unit Price, in Invoice Item ID order.";

let airtable = null;
let calls = 0;
let ledgerPath = null;

const log = (line = "") => console.log(line);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, url, body) {
    calls++;
    await sleep(220); // five a second at most (#553)
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

function ledger(entry) {
    fs.appendFileSync(ledgerPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

async function readTable(name) {
    const json = await request("GET", `${API_ROOT}/meta/bases/${airtable.baseId}/tables`);
    const table = json.tables.find((t) => t.name === name);
    if (!table) throw new Error(`the base holds no ${name}`);
    return table;
}

async function readRows(tableName, fields) {
    const rows = [];
    let offset;
    do {
        const params = new URLSearchParams();
        fields.forEach((f) => params.append("fields[]", f));
        if (offset) params.set("offset", offset);
        const json = await request("GET", `${API_ROOT}/${airtable.baseId}/${encodeURIComponent(tableName)}?${params}`);
        rows.push(...json.records);
        offset = json.offset;
    } while (offset);
    return rows;
}

function fieldFault(field) {
    if (!field) return "missing";
    if (field.type !== FIELD.type) return `a ${field.type}, not a number`;
    if (field.options?.precision !== FIELD.options.precision) return `precision ${field.options?.precision}, not 0`;
    return null;
}

/** Per invoice, the number each row takes under the fold's key; invoices with a number already are named. */
function numbering(items, materialByOrderedItem) {
    const byInvoice = new Map();
    for (const row of items) {
        const invoice = row.fields.Invoice?.[0] ?? "(none)";
        if (!byInvoice.has(invoice)) byInvoice.set(invoice, []);
        byInvoice.get(invoice).push(row);
    }
    const writes = [];
    const leftAlone = [];
    for (const rows of byInvoice.values()) {
        if (rows.every((r) => r.fields.Position != null)) continue;
        if (rows.some((r) => r.fields.Position != null)) {
            leftAlone.push(rows.map((r) => r.fields["Invoice Item ID"]).join(", "));
            continue;
        }
        rows.sort((a, b) => String(a.fields["Invoice Item ID"]).localeCompare(String(b.fields["Invoice Item ID"])));
        const numberOf = new Map();
        for (const row of rows) {
            const material = materialByOrderedItem.get(row.fields["PO Item"]?.[0]) ?? null;
            const key = material ? `mat::${material}::${row.fields["Unit Price"] ?? ""}` : `row::${row.id}`;
            if (!numberOf.has(key)) numberOf.set(key, numberOf.size + 1);
            writes.push({ id: row.id, invoiceItemId: row.fields["Invoice Item ID"], position: numberOf.get(key) });
        }
    }
    return { writes, leftAlone };
}

function finish(code, why) {
    log("");
    log(`${calls} Airtable call(s). Exit ${code}${why ? ` — ${why}` : ""}.`);
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
    const which = airtable.live ? "live" : "test";
    log("=".repeat(72));
    log(`Invoice Items."${FIELD.name}" (#660)`);
    log(`base ${airtable.baseId} (${which})${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const table = await readTable("Invoice Items");
    let field = table.fields.find((f) => f.name === FIELD.name);
    const items = await readRows("Invoice Items", ["Invoice Item ID", "Invoice", "PO Item", "Unit Price", FIELD.name].filter(
        (f) => f !== FIELD.name || field
    ));
    log(`  Invoice Items: ${items.length} row(s)`);
    if (airtable.live && items.length > 0) {
        return finish(1, "the live base's Invoice Items holds rows, and this script writes none there");
    }

    if (apply) {
        const dir = path.join("scripts", "import", "ledgers");
        fs.mkdirSync(dir, { recursive: true });
        ledgerPath = path.join(dir, `add_invoice_item_position_660-${which}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    }

    let pending = false;
    if (!field) {
        if (!apply) {
            log(`  would create ${FIELD.name}: a number, no decimals, described`);
            pending = true;
        } else {
            ledger({ act: "create-field", table: table.id, name: FIELD.name });
            field = await request("POST", `${API_ROOT}/meta/bases/${airtable.baseId}/tables/${table.id}/fields`, {
                ...FIELD,
                description: DESCRIPTION,
            });
            log(`  created ${FIELD.name} (${field.id})`);
        }
    } else {
        const fault = fieldFault(field);
        if (fault) return finish(1, `${FIELD.name} stands and is ${fault}`);
        if (field.description !== DESCRIPTION) {
            if (!apply) {
                log(`  would rewrite ${FIELD.name}'s description`);
                pending = true;
            } else {
                ledger({ act: "describe-field", field: field.id, before: field.description ?? null });
                await request("PATCH", `${API_ROOT}/meta/bases/${airtable.baseId}/tables/${table.id}/fields/${field.id}`, {
                    description: DESCRIPTION,
                });
                log(`  rewrote ${FIELD.name}'s description`);
            }
        } else {
            log(`  ${FIELD.name} stands as specified`);
        }
    }

    // ── the rows ─────────────────────────────────────────────────────────────
    const orderedItems = items.length ? await readRows("PO Items", ["Material"]) : [];
    const materialByOrderedItem = new Map(orderedItems.map((r) => [r.id, r.fields.Material?.[0] ?? null]));
    const { writes, leftAlone } = numbering(items, materialByOrderedItem);
    for (const names of leftAlone) log(`  left as it is, a number already on some of: ${names}`);
    if (writes.length > 0) {
        if (!apply) {
            for (const w of writes) log(`  would number ${w.invoiceItemId} ${w.position}`);
            pending = true;
        } else {
            for (let i = 0; i < writes.length; i += 10) {
                const chunk = writes.slice(i, i + 10);
                chunk.forEach((w) => ledger({ act: "number-row", id: w.id, invoiceItemId: w.invoiceItemId, before: null, after: w.position }));
                await request("PATCH", `${API_ROOT}/${airtable.baseId}/${encodeURIComponent("Invoice Items")}`, {
                    records: chunk.map((w) => ({ id: w.id, fields: { [FIELD.name]: w.position } })),
                });
                chunk.forEach((w) => log(`  numbered ${w.invoiceItemId} ${w.position}`));
            }
        }
    }

    if (!apply) return finish(pending ? 2 : 0, pending ? "a dry run" : "nothing to do");

    // ── the re-read ──────────────────────────────────────────────────────────
    const after = (await readTable("Invoice Items")).fields.find((f) => f.name === FIELD.name);
    const fault = fieldFault(after);
    if (fault) return finish(1, `${FIELD.name} reads back ${fault}`);
    if (after.description !== DESCRIPTION) return finish(1, `${FIELD.name}'s description reads back otherwise`);
    const rows = await readRows("Invoice Items", ["Invoice Item ID", FIELD.name]);
    const blank = rows.filter((r) => r.fields[FIELD.name] == null);
    log(`  re-read: ${FIELD.name} as specified; ${rows.length - blank.length} of ${rows.length} row(s) numbered`);
    if (ledgerPath) log(`  ledger: ${ledgerPath}`);
    return finish(blank.length === 0 ? 0 : 1, blank.length === 0 ? null : `${blank.length} row(s) hold no number`);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
