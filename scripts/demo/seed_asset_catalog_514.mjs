// Rewrites the demo asset catalog in #514's six levels, and adds the rows that show them.
//
// WHAT IT IS FOR. #514 classifies a row of `Asset Categories` by type, category, name, size,
// maker and part number, and a registration may leave a level empty only where a row under the
// chosen name leaves it empty. The eleven demo rows #507 typed all had a size and nothing
// else, so neither side of that rule had anything to show. This gives the demo catalog every
// case the dialog draws differently:
//   - equipment, which has no size — `DEMO Welding Machine`, `DEMO Drill Press`,
//     `DEMO Air Compressor`, the last asked nothing on the second step at all;
//   - a name whose maker may be left empty, a generic row beside rows by a maker — the tool
//     `DEMO Angle Grinder 4-1/2"` and the equipment `DEMO Drill Press`;
//   - a name whose maker may not, every row by a maker — the tool `DEMO Cordless Drill 18V`
//     and the equipment `DEMO Welding Machine`;
//   - a part number that narrows under its maker: two under `DEMO Makita`, none under
//     `DEMO Bosch`.
//
// THE ELEVEN ROWS KEEP THEIR IDS, SO EVERY ASSET STAYS WHERE IT WAS. A row is rewritten in
// place — its type set, its category moved to a field of work, a maker and a part number given
// to the drill — and never replaced: 137 assets point at five of them. The categories #507
// typed (`DEMO Power Tools`, `DEMO Hand Tools`) were kinds of tool rather than fields of work,
// which is what #514 makes a category.
//
// EACH ROW CARRIES WHAT IT WAS AND WHAT IT BECOMES, SO THE SPEC IS ITS OWN LEDGER. A row that
// reads neither is somebody's edit, and the run stops before writing anything rather than
// overwriting it; `--revert` puts every rewritten row back. The nine rows it adds are found by
// their path on a second run and not added twice, and `--revert` leaves them standing and
// names them: records in this base are not removed as tidying-up.
//
// IT NEEDS #514's SCHEMA. Run scripts/import/classify_asset_categories_514.mjs --apply
// first; this stops on a base without `Level 3`, `Maker` and `Part Number`.
//
// #517 REMOVED THE DEMO CATALOG, every asset under it with it
// (`remove_demo_catalog_517.mjs`), so on this base the eleven rows above are gone and a run
// refuses before writing anything. `remove_demo_catalog_517.mjs --revert <its ledger>` brings
// them back under new record ids, and this would then refuse those too: it finds the eleven by
// the ids written above.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's scripts in scripts/import/ do, and counts
// its calls, which lib/airtableOps.js cannot see.
//
// Usage (from the repo root). Dry run is the DEFAULT:
//   node --env-file=.env.local scripts/demo/seed_asset_catalog_514.mjs
//   ... --apply     write
//   ... --revert    put the eleven rows back as #507 left them
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the catalog reads as the spec, 1 something
// failed or was refused, 2 nothing failed but something is still to do (a dry run).

import { ASSET_CATEGORY_FIELDS, composeItemName, readCatalog } from "../../lib/assetCategory.js";
import { textMatchKey } from "../../lib/itemNaming.js";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;
const TABLE_NAME = "Asset Categories";
const NAME_FIELD = "Item Name";

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/** What a spec row says, in the order a path says it and then the class. */
const KEYS = ["level1", "level2", "level3", "size", "maker", "partNumber", "assetClass"];

/** A row as `[type, category, name, size, maker, part number, class]`, an empty level `""`. */
const row = (values) => Object.fromEntries(KEYS.map((key, i) => [key, values[i]]));

/** The eleven rows #507 typed, by id: what each read once #514's renames ran, and what it becomes. */
const REWRITES = [
    ["recN22IDMe5bfJg0V", ["", "DEMO Power Tools", "DEMO Angle Grinder", '4-1/2"', "", "", "A"], ["Tool", "DEMO Machining", "DEMO Angle Grinder", '4-1/2"', "", "", "A"]],
    ["recqzATzksybusNgu", ["", "DEMO Power Tools", "DEMO Angle Grinder", '5"', "", "", "A"], ["Tool", "DEMO Machining", "DEMO Angle Grinder", '5"', "", "", "A"]],
    ["rec1RSWAUAg5QOUK1", ["", "DEMO Power Tools", "DEMO Rotary Hammer", "SDS-Plus", "", "", "A"], ["Tool", "DEMO Concrete", "DEMO Rotary Hammer", "SDS-Plus", "", "", "A"]],
    ["recops6mQWbVinzC6", ["", "DEMO Power Tools", "DEMO Rotary Hammer", "SDS-Max", "", "", "A"], ["Tool", "DEMO Concrete", "DEMO Rotary Hammer", "SDS-Max", "", "", "A"]],
    ["reclgWQ6MGDapXhcG", ["", "DEMO Power Tools", "DEMO Cordless Drill", "18V", "", "", "B"], ["Tool", "DEMO Carpentry", "DEMO Cordless Drill", "18V", "DEMO DeWalt", "DCD791", "B"]],
    ["recdQDXTjhk4c0d4o", ["", "DEMO Power Tools", "DEMO Jigsaw", "T-Shank", "", "", "B"], ["Tool", "DEMO Carpentry", "DEMO Jigsaw", "T-Shank", "", "", "B"]],
    ["recZG1ZkBXJfJbG5o", ["", "DEMO Power Tools", "DEMO Circular Saw", '7-1/4"', "", "", "A"], ["Tool", "DEMO Carpentry", "DEMO Circular Saw", '7-1/4"', "", "", "A"]],
    ["recTOvLY8WSzaDafV", ["", "DEMO Power Tools", "DEMO Impact Driver", '1/4" Hex', "", "", "B"], ["Tool", "DEMO Fastening", "DEMO Impact Driver", '1/4" Hex', "", "", "B"]],
    ["reclMZ3ox9Zqvjaa8", ["", "DEMO Hand Tools", "DEMO Torque Wrench", '3/8" Drive', "", "", "B"], ["Tool", "DEMO Fastening", "DEMO Torque Wrench", '3/8" Drive', "", "", "B"]],
    ["recxbdxwo6h1dgYPr", ["", "DEMO Hand Tools", "DEMO Torque Wrench", '1/2" Drive', "", "", "A"], ["Tool", "DEMO Fastening", "DEMO Torque Wrench", '1/2" Drive', "", "", "A"]],
    ["recyfpzzrcrdi3Wa7", ["", "DEMO Measuring", "DEMO Laser Level", "Cross-Line", "", "", "B"], ["Tool", "DEMO Measuring", "DEMO Laser Level", "Cross-Line", "", "", "B"]],
].map(([id, from, to]) => ({ id, from: row(from), to: row(to) }));

/** The nine rows #514 adds, found again by their path. */
const ADDITIONS = [
    ["Tool", "DEMO Machining", "DEMO Angle Grinder", '4-1/2"', "DEMO Makita", "GA4530", "A"],
    ["Tool", "DEMO Machining", "DEMO Angle Grinder", '4-1/2"', "DEMO Makita", "GA4570", "A"],
    ["Tool", "DEMO Machining", "DEMO Angle Grinder", '4-1/2"', "DEMO Bosch", "", "A"],
    ["Tool", "DEMO Carpentry", "DEMO Cordless Drill", "18V", "DEMO Milwaukee", "2801-20", "B"],
    ["Equipment", "DEMO Welding", "DEMO Welding Machine", "", "DEMO Lincoln", "POWER MIG 256", "A"],
    ["Equipment", "DEMO Welding", "DEMO Welding Machine", "", "DEMO Miller", "Millermatic 255", "A"],
    ["Equipment", "DEMO Machining", "DEMO Drill Press", "", "", "", "A"],
    ["Equipment", "DEMO Machining", "DEMO Drill Press", "", "DEMO Jet", "JDP-17", "A"],
    ["Equipment", "DEMO Site Services", "DEMO Air Compressor", "", "", "", "B"],
].map(row);

class Airtable {
    constructor(token, baseId) {
        this.baseId = baseId;
        this.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        this.calls = 0;
    }

    async request(method, url, body) {
        this.calls++;
        const response = await fetch(url, {
            method,
            headers: this.headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        return text === "" ? null : JSON.parse(text);
    }

    async table() {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`);
        return tables.find((t) => t.name === TABLE_NAME) ?? null;
    }

    async listRecords(tableId, fields) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100" });
            for (const f of fields) params.append("fields[]", f);
            if (offset) params.set("offset", offset);
            const page = await this.request("GET", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
            out.push(...page.records);
            offset = page.offset;
        } while (offset);
        return out;
    }

    /** No `typecast`: a type or a class that is not one of the select's options is refused rather than coined. */
    updateRecords(tableId, records) {
        return this.request("PATCH", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }

    createRecords(tableId, records) {
        return this.request("POST", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

/** A REST record as a spec row, an empty field `""`. */
function valuesOf(record) {
    return Object.fromEntries(KEYS.map((key) => [key, record.fields[ASSET_CATEGORY_FIELDS[key]] ?? ""]));
}

/** A spec row as the fields a write sends: every one, an empty level cleared. */
function fieldsOf(values) {
    return Object.fromEntries(KEYS.map((key) => [ASSET_CATEGORY_FIELDS[key], values[key] === "" ? null : values[key]]));
}

const same = (a, b) => KEYS.every((key) => a[key] === b[key]);
const said = (values) => KEYS.map((key) => JSON.stringify(values[key])).join(" | ");
const pathKey = (values) => KEYS.slice(0, 6).map((key) => textMatchKey(values[key])).join("\n");

/** Writes in requests of ten, one at a time. */
async function inChunks(items, write) {
    for (let i = 0; i < items.length; i += RECORDS_PER_REQUEST) await write(items.slice(i, i + RECORDS_PER_REQUEST));
}

async function main() {
    const apply = process.argv.includes("--apply");
    const revert = process.argv.includes("--revert");
    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const writing = apply || revert;
    const air = new Airtable(token, baseId);
    log(`seed_asset_catalog_514 — base ${baseId}${revert ? "  (REVERT)" : writing ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);

    const table = await air.table();
    const missing = table ? Object.values(ASSET_CATEGORY_FIELDS).filter((name) => !table.fields.some((f) => f.name === name)) : ["the table"];
    if (missing.length > 0) {
        log(`${TABLE_NAME} lacks ${missing.join(", ")} — run scripts/import/classify_asset_categories_514.mjs --apply first.`);
        return finish(air, 1, "the schema is not #514's");
    }

    const records = await air.listRecords(table.id, [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS)]);
    const byId = new Map(records.map((record) => [record.id, record]));

    // --- the eleven rows: each must read what it was or what it becomes ------
    log(`the eleven rows #507 typed, ${revert ? "back to what they were" : "rewritten"}:`);
    const rewrites = [];
    const refused = [];
    for (const { id, from, to } of REWRITES) {
        const [want, other] = revert ? [from, to] : [to, from];
        const record = byId.get(id);
        if (!record) {
            refused.push(`${id} is not on the base`);
            continue;
        }
        const live = valuesOf(record);
        if (same(live, want)) log(`  [DONE]   ${id}  ${said(want)}`);
        else if (same(live, other)) rewrites.push({ id, want });
        else refused.push(`${id} reads ${said(live)}, which is neither what this expects it to be nor what it writes`);
    }
    if (refused.length > 0) {
        for (const line of refused) log(`  ${line}`);
        return finish(air, 1, "refused before writing anything: a row is not as this left it");
    }
    for (const { id, want } of rewrites) log(`  ${writing ? "[WRITE] " : "[WOULD] "} ${id}  ${said(want)}`);

    // --- the nine rows: added once, by path ----------------------------------
    const paths = new Set(records.map((record) => pathKey(valuesOf(record))));
    const additions = ADDITIONS.filter((values) => !paths.has(pathKey(values)));
    if (revert) {
        log(`\nthe nine rows #514 added are left standing (nothing here is removed as tidying-up):`);
        for (const values of ADDITIONS.filter((values) => paths.has(pathKey(values)))) log(`  ${said(values)}`);
    } else {
        log(`\nthe nine rows #514 adds:`);
        for (const values of ADDITIONS) log(`  ${additions.includes(values) ? (writing ? "[CREATE]" : "[WOULD] ") : "[DONE]  "} ${said(values)}`);
    }
    const due = rewrites.length + (revert ? 0 : additions.length);
    if (!writing) return finish(air, due > 0 ? 2 : 0, due > 0 ? `dry run — ${due} write(s) due, nothing was written` : "the catalog reads as the spec");

    await inChunks(rewrites, (chunk) => air.updateRecords(table.id, chunk.map(({ id, want }) => ({ id, fields: fieldsOf(want) }))));
    if (!revert) await inChunks(additions, (chunk) => air.createRecords(table.id, chunk.map((values) => ({ fields: fieldsOf(values) }))));

    // --- read back ------------------------------------------------------------
    log(`\nreading the catalog back:`);
    const after = await air.listRecords(table.id, [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS)]);
    const afterById = new Map(after.map((record) => [record.id, record]));
    const failures = [];
    for (const { id, from, to } of REWRITES) {
        const want = revert ? from : to;
        const live = valuesOf(afterById.get(id));
        if (!same(live, want)) failures.push(`${id} reads ${said(live)}`);
    }
    if (!revert) {
        const afterPaths = new Map(after.map((record) => [pathKey(valuesOf(record)), record]));
        for (const values of ADDITIONS) if (!afterPaths.has(pathKey(values))) failures.push(`no row reads ${said(values)}`);
        const spec = new Set([...REWRITES.map(({ id }) => id), ...ADDITIONS.map((values) => afterPaths.get(pathKey(values))?.id)]);
        const categories = after.filter((record) => spec.has(record.id)).map((record) => ({ id: record.id, itemName: record.fields[NAME_FIELD] ?? "", ...valuesOf(record) }));
        for (const category of categories) {
            if (category.itemName !== composeItemName(category)) failures.push(`${category.id} is named ${JSON.stringify(category.itemName)}, the rule says ${JSON.stringify(composeItemName(category))}`);
            else log(`  ${category.id}  ${category.itemName}`);
        }
        const offered = new Set(readCatalog(categories).offered.map(({ id }) => id));
        for (const category of categories) if (!offered.has(category.id)) failures.push(`${category.id} is not offered to a registration`);
    }
    if (failures.length > 0) {
        for (const line of failures) log(`  ${line}`);
        return finish(air, 1, "the catalog does not read as the spec");
    }
    return finish(air, 0, revert ? "the eleven rows read as #507 left them" : "the catalog reads as the spec, every row named by the rule and offered");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
