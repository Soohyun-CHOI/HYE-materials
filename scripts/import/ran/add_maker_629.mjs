// `Maker` on the four item tables and on `Materials` (#629): who makes the item a request asks for,
// typed beside its size and carried where its size is carried — into the order, its document, the
// invoice and delivery rows that copy the order, and the material that tells items apart.
//
// WHAT IT MAKES, ON EACH BASE. A single line of text called `Maker`, described, on `PR Items`,
// `PO Items`, `Invoice Items`, `Delivery Items` and `Materials`; `Materials."Material Label"`'s
// formula with the maker between the size and the unit; and the four descriptions the field makes
// false, rewritten whole. The ids are the same on both bases — the test base was made by duplicating
// the live one (#534) — and the run checks every one it names before its first write. A dry run
// names every write it would make, the formula's included, so the two bases' runs can be compared
// before either is applied.
//
// WHAT IT CANNOT MAKE, AND THE RUN SAYS SO. `PR Edit Log."Field"` takes a `Maker` choice, placed
// after `Size`, because an edit turn logs a changed maker under it — and a select's option list
// cannot be written through the Metadata API at all (422 on `options.choices`,
// `docs/notes/airtable-access.md`). So Soo made it by hand on each base, with the palette walked
// again from it — `EDIT_LOG_CHOICES` below, names, order and colors — and this run reads it: any
// difference names the step and exits 2.
//
// THE LABELS ARE READ BEFORE AND AFTER THE FORMULA, BECAUSE THAT IS THE ONE CHANGE HERE THAT
// REACHES ROWS. Every material on a base made before #629 has no maker, so the new formula must
// compose every `Material Label` — and every `Price Label`, which is a formula over it — exactly as
// the old one did. The run reads both tables' labels before its PATCH and again after it and fails
// on any that moved.
//
// A LEDGER BESIDE THE WRITES. `--apply` writes `scripts/import/ledgers/add_maker_629-<base>-<instant>
// .jsonl`, the base named as the run named it: a description's and the formula's line BEFORE the
// PATCH that overwrites them, so the old text survives a run that stops half-way, and a created
// field's line after its create, since only the create gives its id. The undo is the ledger read
// backwards — each `before` PATCHed back, the formula's included — and a created field deleted by
// hand in the Airtable UI, the one thing no endpoint does (`airtable-access.md`). The test base's run
// came before the ledger and left none; the live base's, on 2026-11-12, left
// `add_maker_629-live-2026-11-12T15-11-08-358Z.jsonl`. Both bases hold everything since, so a run
// with `--apply` writes nothing and exits 0.
//
// IT MUST STAND ON THE LIVE BASE BEFORE THE CODE READING IT IS DEPLOYED. `createItem` writes `Maker`
// and `getMaterialByKey` filters on it, so a base without the field refuses both (422
// `UNKNOWN_FIELD_NAME`) — a request could not be saved and an order's materials would not be found.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/ran/add_maker_629.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/add_maker_629.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (the live base, once Soo has approved it)
//
// No loader flag: this file imports built-ins and `lib/airtableBase.js`, which imports only its
// sibling.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds everything as specified, 1 something
// failed or a field is not the one specified, 2 a dry run or the hand step still outstanding.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(). */
let airtable = null;

const SCRIPT = "add_maker_629";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

const API_ROOT = "https://api.airtable.com/v0";
const MAKER = "Maker";

const TABLE = {
    PR_ITEMS: "tblAjcKgBkAe2bsBD",
    PO_ITEMS: "tblywiocM7tRgzxEN",
    INVOICE_ITEMS: "tblg3coc94b7odikV",
    DELIVERY_ITEMS: "tblPDlaZbd9HDurlJ",
    MATERIALS: "tblqXbyM4CJo7AO6Y",
    MATERIAL_PRICES: "tbl6T1PLdomNttu41",
    PR_EDIT_LOG: "tblpiQRq2XseB1b0b",
};

/** `Materials`' fields the label is composed of, by id. */
const MATERIALS_FIELD = {
    LABEL: "fldL9CiUUCBoCULJX",
    ITEM_NAME: "fldlsEfPmaYfbLmAi",
    SIZE: "fldS2FJ1CyDWQHaqp",
    UNIT: "fldMaKm3grOHZd3Cv",
    CATEGORY: "fld9LLo7LjF8KKQjG",
};

const EDIT_LOG_FIELD = "fldKZMuITZJIrLtNq";

/**
 * `PR Edit Log."Field"` as Soo set it on both bases: `Maker` after `Size`, and the light palette
 * walked again from there. Its order is `lib/editLogFields.js:EDIT_LOG_FIELD_LABELS`'.
 */
const EDIT_LOG_CHOICES = [
    ["Category", "blueLight2"],
    ["Size", "cyanLight2"],
    ["Maker", "tealLight2"],
    ["Unit", "greenLight2"],
    ["Qty", "yellowLight2"],
    ["Unit Price", "orangeLight2"],
    ["Remark", "redLight2"],
    ["Shipping Fee", "pinkLight2"],
];

/** `Item Name`, then each of the rest after an underscore where it is not blank. */
function labelFormula(segmentIds) {
    const [first, ...rest] = segmentIds;
    return [`{${first}}`, ...rest.map((id) => `IF({${id}}, "_" & {${id}}, "")`)].join(" & ");
}

/** The expression every base held before this run. */
const FORMULA_BEFORE = labelFormula([MATERIALS_FIELD.ITEM_NAME, MATERIALS_FIELD.SIZE, MATERIALS_FIELD.UNIT]);

/** The expression this run writes, once the maker's field id is known. */
const formulaWith = (makerId) => labelFormula([MATERIALS_FIELD.ITEM_NAME, MATERIALS_FIELD.SIZE, makerId, MATERIALS_FIELD.UNIT]);

const MAKER_DESCRIPTION = {
    [TABLE.PR_ITEMS]:
        "Issue #629 -- who makes the item the requester wants, typed beside its Size on the request form, and optional: blank is an item " +
        "with no maker named. Kept as Size is (lib/typedText.js:normalizeItemText): the ends trimmed, runs of spaces collapsed, case as typed, " +
        "and compared without regard to case. Part of what an item is: Materials tells items apart by Category, Size, Maker and Unit " +
        "(lib/materialIdentity.js), so two makers' versions of one item are two materials with prices of their own, and two request rows " +
        "differing only in it are not merged. Copied into PO Items when the order is generated and printed on the order the vendor " +
        "receives. A signer changes it through Edit and continue, which logs it as Maker in PR Edit Log.",
    [TABLE.PO_ITEMS]:
        "Issue #629 -- frozen copy of the PR Item's Maker, written with the rest of the snapshot by lib/poGeneration.js and never changed " +
        "after. Printed in the order document's MAKER column, beside SIZE (lib/poPdf.js). Blank where the request named no maker. Invoice " +
        "Items and Delivery Items copy it from here.",
    [TABLE.INVOICE_ITEMS]:
        "Issue #629 -- frozen copy of the linked PO Item's Maker, as Size and Unit are: reference-only, with no edit path. Blank where the " +
        "order named no maker.",
    [TABLE.DELIVERY_ITEMS]:
        "Issue #629 -- frozen copy of the linked PO Item's Maker, as Item Name, Size and Unit are: reference-only, with no edit path. Blank " +
        "where the order named no maker.",
    [TABLE.MATERIALS]:
        "Issue #629 -- part of the natural key, Category + Size + Maker + Unit. Written once, by upsertMaterial, from the ordered item that " +
        "made the row: trimmed, runs of spaces collapsed, case as typed, and matched without regard to case (lib/materialIdentity.js). " +
        "Blank is a material with no maker named, which every row made before #629 is. Material Label carries it between Size and Unit.",
};

/** The descriptions the field makes false, rewritten whole. */
const DELIVERY_COPY_FIRST =
    "Issue #162 — frozen reference copies, taken from the linked PO Item: every row names one since #165, the over-delivery row " +
    "included. Reference-only: no edit path, and a mismatch against the PO line means the wrong line was allocated — same convention " +
    "as Invoice Items. Item Name, Size, Maker (#629) and Unit are copied together, and Size and Maker are blank where the ordered " +
    "item's are.";
const DELIVERY_UNIT_PARAGRAPH =
    "Unit is the shared canonical select (lib/units.js CANONICAL_UNITS). This table is the FIFTH on that list after PR Items, PO Items, " +
    "Invoice Items and Materials; all 19 options must exist here before the first write, because typecast is deliberately not used and " +
    "a missing option fails the write.";

const CORRECTED = [
    {
        table: TABLE.MATERIALS,
        field: MATERIALS_FIELD.CATEGORY,
        description:
            "The catalog path this material IS (#356). Part of the natural key, with Size, Maker (#629) and Unit — identity was the item name " +
            "somebody typed until this field, so two spellings of one thing were two rows with separate price histories behind them. SINGLE " +
            "record, enforced by this app rather than by the schema, since prefersSingleRecordLink is refused on both CREATE and UPDATE. Item " +
            "Name is a lookup through this link and no longer text anyone writes, so a row with no category has no name at all: upsertMaterial " +
            "refuses one.",
    },
    { table: TABLE.DELIVERY_ITEMS, field: "fldD7V58mH4DKxeim", description: `${DELIVERY_COPY_FIRST}\n\n${DELIVERY_UNIT_PARAGRAPH}` },
    { table: TABLE.DELIVERY_ITEMS, field: "fld3qhWQtKOMerzSt", description: `${DELIVERY_COPY_FIRST}\n\n${DELIVERY_UNIT_PARAGRAPH}` },
    {
        table: TABLE.DELIVERY_ITEMS,
        field: "flddNjm9SwYmOJb7l",
        description:
            `${DELIVERY_COPY_FIRST} Unit is the shared canonical select (lib/units.js CANONICAL_UNITS); all 19 options must exist before the ` +
            "first write, because typecast is deliberately not used and a missing option fails the write.",
    },
];

let calls = 0;
let ledger = null;

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

/** One ledger line, the base named as the run named it — the live base's id is `lib/airtableBase.js`'s alone. */
function record(entry) {
    if (!ledger) {
        mkdirSync(LEDGER_DIR, { recursive: true });
        const at = new Date().toISOString();
        ledger = { path: join(LEDGER_DIR, `${SCRIPT}-${airtable.live ? "live" : "test"}-${at.replace(/[:.]/g, "-")}.jsonl`) };
        log(`  ledger: ${ledger.path}`);
    }
    appendFileSync(ledger.path, JSON.stringify({ base: airtable.live ? "live" : "test", at: new Date().toISOString(), ...entry }) + "\n");
}

async function readTables(baseId) {
    const { tables } = await request("GET", `/meta/bases/${baseId}/tables`);
    return new Map(tables.map((t) => [t.id, t]));
}

/** Every row's value of one field, by record id — read by field id, so a rename cannot hide one. */
async function readColumn(baseId, tableId, fieldId) {
    const out = new Map();
    let offset;
    do {
        const query = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
        query.append("fields[]", fieldId);
        if (offset) query.set("offset", offset);
        const page = await request("GET", `/${baseId}/${tableId}?${query}`);
        for (const rec of page.records) out.set(rec.id, rec.fields[fieldId] ?? "");
        offset = page.offset;
    } while (offset);
    return out;
}

/** The ids whose value differs between two reads of one column, or that one read lacks. */
function moved(before, after) {
    const ids = new Set([...before.keys(), ...after.keys()]);
    return [...ids].filter((id) => before.get(id) !== after.get(id));
}

/** How the edit log's choices differ from `EDIT_LOG_CHOICES`, or null. */
function choicesFault(choices) {
    const got = choices.map((c) => `${c.name} ${c.color}`).join(", ");
    const want = EDIT_LOG_CHOICES.map(([name, color]) => `${name} ${color}`).join(", ");
    return got === want ? null : { got, want };
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
    const baseId = airtable.baseId;
    log("=".repeat(72));
    log(`${MAKER} on the item tables and Materials (#629)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    let tables = await readTables(baseId);
    for (const id of Object.values(TABLE)) {
        if (!tables.has(id)) return finish(1, `the base holds no table ${id}, which this script was written against`);
    }
    const materials = tables.get(TABLE.MATERIALS);
    for (const id of Object.values(MATERIALS_FIELD)) {
        if (!materials.fields.some((f) => f.id === id)) return finish(1, `Materials holds no field ${id}`);
    }
    let pending = false;

    // ── the five fields ──────────────────────────────────────────────────────
    log("");
    log("the fields:");
    for (const [tableId, description] of Object.entries(MAKER_DESCRIPTION)) {
        const table = tables.get(tableId);
        const field = table.fields.find((f) => f.name === MAKER);
        if (field && field.type !== "singleLineText") return finish(1, `${table.name}."${MAKER}" is a ${field.type}, not a single line of text`);
        if (!field) {
            if (!apply) {
                log(`  would create ${table.name}."${MAKER}": a single line of text, described`);
                pending = true;
                continue;
            }
            const created = await request("POST", `/meta/bases/${baseId}/tables/${tableId}/fields`, { name: MAKER, type: "singleLineText", description });
            record({ kind: "field", table: tableId, field: created.id, before: null, after: { name: MAKER, type: "singleLineText", description } });
            log(`  created ${table.name}."${MAKER}" (${created.id})`);
            continue;
        }
        if ((field.description ?? "") === description) {
            log(`  ${table.name}."${MAKER}" (${field.id}) stands as specified`);
        } else if (!apply) {
            log(`  would write ${table.name}."${MAKER}"'s description`);
            pending = true;
        } else {
            record({ kind: "description", table: tableId, field: field.id, before: field.description ?? "", after: description });
            await request("PATCH", `/meta/bases/${baseId}/tables/${tableId}/fields/${field.id}`, { description });
            log(`  wrote ${table.name}."${MAKER}"'s description`);
        }
    }

    // ── the descriptions the field makes false ───────────────────────────────
    log("");
    log("the descriptions it makes false:");
    for (const entry of CORRECTED) {
        const table = tables.get(entry.table);
        const field = table.fields.find((f) => f.id === entry.field);
        if (!field) return finish(1, `${table.name} holds no field ${entry.field}`);
        const what = `${table.name}."${field.name}"`;
        if ((field.description ?? "") === entry.description) {
            log(`  ${what} is the one this script writes`);
        } else if (!apply) {
            log(`  would write ${what}'s description`);
            pending = true;
        } else {
            record({ kind: "description", table: entry.table, field: entry.field, before: field.description ?? "", after: entry.description });
            await request("PATCH", `/meta/bases/${baseId}/tables/${entry.table}/fields/${entry.field}`, { description: entry.description });
            log(`  wrote ${what}'s description`);
        }
    }

    // ── the label ────────────────────────────────────────────────────────────
    log("");
    log("Materials.\"Material Label\":");
    tables = await readTables(baseId);
    const makerField = tables.get(TABLE.MATERIALS).fields.find((f) => f.name === MAKER);
    const label = tables.get(TABLE.MATERIALS).fields.find((f) => f.id === MATERIALS_FIELD.LABEL);
    const now = label.options?.formula ?? "";
    if (makerField && now === formulaWith(makerField.id)) {
        log("  carries the maker between the size and the unit");
    } else if (now !== FORMULA_BEFORE) {
        return finish(1, `Material Label is neither expression this script knows: ${now}`);
    } else if (!makerField) {
        // A dry run on a base without the field: the expression it would write, the maker's id to come.
        log(`  would PATCH it from ${now}`);
        log(`                 to ${formulaWith("<Materials.Maker>")}`);
        pending = true;
    } else if (!apply) {
        log(`  would PATCH it to ${formulaWith(makerField.id)}`);
        pending = true;
    } else {
        const after = formulaWith(makerField.id);
        const labelsBefore = await readColumn(baseId, TABLE.MATERIALS, MATERIALS_FIELD.LABEL);
        const priceLabelField = tables.get(TABLE.MATERIAL_PRICES).fields.find((f) => f.name === "Price Label");
        const pricesBefore = await readColumn(baseId, TABLE.MATERIAL_PRICES, priceLabelField.id);
        log(`  read ${labelsBefore.size} Material Label(s) and ${pricesBefore.size} Price Label(s) before`);
        record({ kind: "formula", table: TABLE.MATERIALS, field: MATERIALS_FIELD.LABEL, before: now, after });
        await request("PATCH", `/meta/bases/${baseId}/tables/${TABLE.MATERIALS}/fields/${MATERIALS_FIELD.LABEL}`, { options: { formula: after } });
        log("  PATCHed the formula");
        const labelsAfter = await readColumn(baseId, TABLE.MATERIALS, MATERIALS_FIELD.LABEL);
        const pricesAfter = await readColumn(baseId, TABLE.MATERIAL_PRICES, priceLabelField.id);
        const movedLabels = moved(labelsBefore, labelsAfter);
        const movedPrices = moved(pricesBefore, pricesAfter);
        log(`  read ${labelsAfter.size} and ${pricesAfter.size} after: ${movedLabels.length} and ${movedPrices.length} moved`);
        if (movedLabels.length || movedPrices.length) {
            return finish(1, `labels moved (${[...movedLabels, ...movedPrices].join(", ")}) — PATCH the ledger's formula back`);
        }
    }

    // ── the hand step ────────────────────────────────────────────────────────
    log("");
    log("PR Edit Log.\"Field\":");
    const choices = tables.get(TABLE.PR_EDIT_LOG).fields.find((f) => f.id === EDIT_LOG_FIELD)?.options?.choices ?? [];
    const fault = choicesFault(choices);
    if (fault) {
        log(`  HAND STEP: the choices read ${fault.got}`);
        log(`             and are to read ${fault.want}`);
        pending = true;
    } else {
        log(`  ${choices.map((c) => `${c.name} ${c.color}`).join(", ")}`);
    }

    if (pending) return finish(2, apply ? "the hand step is outstanding" : "dry run");

    // ── read back ────────────────────────────────────────────────────────────
    tables = await readTables(baseId);
    for (const [tableId, description] of Object.entries(MAKER_DESCRIPTION)) {
        const field = tables.get(tableId).fields.find((f) => f.name === MAKER);
        if (field?.type !== "singleLineText" || (field.description ?? "") !== description) {
            return finish(1, `${tables.get(tableId).name}."${MAKER}" did not read back as written`);
        }
    }
    for (const entry of CORRECTED) {
        const field = tables.get(entry.table).fields.find((f) => f.id === entry.field);
        if ((field?.description ?? "") !== entry.description) return finish(1, `${entry.field}'s description did not read back as written`);
    }
    const makerId = tables.get(TABLE.MATERIALS).fields.find((f) => f.name === MAKER).id;
    if (tables.get(TABLE.MATERIALS).fields.find((f) => f.id === MATERIALS_FIELD.LABEL).options?.formula !== formulaWith(makerId)) {
        return finish(1, "Material Label did not read back as written");
    }
    if (choicesFault(tables.get(TABLE.PR_EDIT_LOG).fields.find((f) => f.id === EDIT_LOG_FIELD)?.options?.choices ?? [])) {
        return finish(1, "PR Edit Log's choices did not read back as specified");
    }
    log("");
    log(`  read back: ${Object.keys(MAKER_DESCRIPTION).length} fields, ${CORRECTED.length} descriptions, the label and the eight choices`);
    return finish(0, "the base holds everything as specified");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
