// Points `Materials."Item Name"` at the category's own name, adds the path beside
// it, and rewrites the names already frozen onto four item tables (issue #416).
//
// WHY A SCRIPT FOR THIS. A schema edit leaves no diff of its own, so the only
// record that it happened is here — `add_material_category_356.mjs` next door is
// the neighbour this copies, and `add_category_item_name_415.mjs` is the one that
// filled the field this now reads. Idempotent throughout: a second run finds both
// fields as it wants them, finds every row already carrying its name, and writes
// nothing.
//
// THREE PIECES, AND THE FIRST TWO ARE SCHEMA:
//
//   1  `Materials."Item Name"` is a lookup through `Category`, reading
//      `Category Label`. It reads `Material Categories."Item Name"` after this.
//      **A LOOKUP'S SOURCE FIELD CANNOT BE PATCHED — MEASURED, 422
//      `INVALID_REQUEST_UNKNOWN` IN EVERY SHAPE TRIED**, while the same token
//      PATCHing that field's `description` returns 200. So this is a HAND STEP in
//      the Airtable UI, and the attempt stays in the code for #356's reason: this
//      is the only file that would notice if the platform changed, and a refusal
//      prints the response and names the step rather than failing opaquely.
//      `docs/notes/airtable-access.md` carries the four responses.
//   2  `Materials."Category Path"` is new, a lookup of `Category Label`. **IT IS
//      WHAT KEEPS THE SEARCH STANDING.** `Material Label` is
//      `<item name>_Size_Unit`, so once the name stops being the path the table
//      holds the path nowhere, and `/materials` matches the label alone — a query
//      for a branch would stop reaching the rows under it. Nothing renders this
//      field; `lib/airtable/materials.js` searches it.
//   3  The frozen copies. `PR Items`, `PO Items`, `Invoice Items` and
//      `Delivery Items` each store `Item Name` as text, written when the row was
//      created, and each reaches a category by its own link:
//
//        PR Items       Category
//        PO Items       Material -> Category
//        Invoice Items  PO Item -> Material -> Category
//        Delivery Items Material -> Category
//
// THE LOOKUP MOVES 37 ROWS WITHOUT TOUCHING ONE. A lookup is computed, so
// repointing it changes every `Materials."Item Name"` at once, and
// `Material Label` — a formula over it — follows. Nothing is written and nothing
// is in the ledger for it, which is why the ONLY undo for step 1 is pointing the
// lookup back. The run says so rather than implying the ledger covers it.
//
// **THE UNDO, WRITTEN OUT BECAUSE IT IS THE ONLY ONE.** PATCH
// `/meta/bases/{baseId}/tables/{Materials}/fields/fldlsEfPmaYfbLmAi` with
// `options: { recordLinkFieldId: "fld9LLo7LjF8KKQjG", fieldIdInLinkedTable:
// "fldHaz4QoceuWEgcQ" }` — that last id is `Material Categories."Category Label"`,
// where this run sets `fldfuzm7q4h57HGBC` (`Material Categories."Item Name"`). The
// link field is unchanged in both directions; only the looked-up field moves. In
// the Airtable UI it is the same one step: open `Materials."Item Name"` and change
// the field it looks up back to `Category Label`. **Undoing step 3 as well means
// running `--revert` on this run's ledger** — the two are separate undos and doing
// one without the other leaves the frozen copies and the live lookup disagreeing.
// `Materials."Category Path"` can be left in place: nothing but the search reads
// it, and a search that also matches the path is correct under either lookup.
//
// **THE LEDGER IS THE ONLY COPY OF WHAT STEP 3 OVERWRITES, WHICH IS THE ONE WAY
// THIS DIFFERS FROM #415.** That issue filled blank cells, so `before` was `""`
// and a revert was an erase; here `before` is a real string that exists nowhere
// else once the write lands. Two consequences, both built in: `--trial N` reverts
// to the PRIOR TEXT rather than to blank, which is a stronger claim than #415
// could make; and the revert covers EVERY TABLE IN THE LEDGER and verifies all of
// them before reporting, because one table restored and three not is worse than
// none — the ledger would still be right and the base would be half mixed, with
// nothing on it saying which half.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/retype_item_names_416.mjs --dry-run
//   node --env-file=.env.local scripts/import/retype_item_names_416.mjs --trial 3
//   node --env-file=.env.local scripts/import/retype_item_names_416.mjs
//   node --env-file=.env.local scripts/import/retype_item_names_416.mjs --revert <ledger.jsonl>
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// `lib/airtableOps.js` cannot see a raw `fetch`, so the run prints its own call
// count — the same cost both neighbours state.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the catalog, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, a
// trial, or a hand step still outstanding).

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORY_ITEM_NAME } from "../../lib/materialCategory.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const META_ROOT = "https://api.airtable.com/v0/meta";
const DATA_ROOT = "https://api.airtable.com/v0";

const CATEGORIES = "Material Categories";
const MATERIALS = "Materials";
const NAME_FIELD = "Item Name";
const PATH_FIELD = "Category Path";
const LEDGER_PREFIX = "retype_item_names_416-";

/**
 * Each frozen copy and the link it reaches a category by. ORDERED, and the order
 * is the order the run reports in — parents before the rows that were snapshotted
 * from them, so a reader follows the same chain the app does.
 */
const FROZEN = [
    { table: "PR Items", via: "category" },
    { table: "PO Items", via: "material" },
    { table: "Invoice Items", via: "poItem" },
    { table: "Delivery Items", via: "material" },
];

const PATH_DESCRIPTION =
    "This material's category path, looked up through Category (#416). NOT " +
    "RENDERED ANYWHERE: Item Name beside it is the category's own readable name " +
    "now, so Material Label carries no path, and a search for a branch would stop " +
    "reaching the rows under it: most of the 777 names hold no word of their own " +
    "Level 1 (425 to 461 of them, depending on how a level name is cut into " +
    "words). lib/airtable/materials.js matches this field alongside the label. " +
    "Named for what it means on this row rather than for the field it reads, which " +
    "is Category Code's rule one field over: Category Label would put two fields " +
    "called Label on a table whose own label is Material Label.";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const REVERT_AT = args.indexOf("--revert");
const REVERT_FILE = REVERT_AT === -1 ? null : args[REVERT_AT + 1];
const TRIAL_AT = args.indexOf("--trial");
const TRIAL_ROWS = TRIAL_AT === -1 ? 0 : Number.parseInt(args[TRIAL_AT + 1] ?? "", 10);

let calls = 0;

async function api(root, method, path, body) {
    calls++;
    const res = await fetch(`${root}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, json: text === "" ? null : JSON.parse(text) };
}

async function must(root, method, path, body) {
    const res = await api(root, method, path, body);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.text}`);
    return res.json;
}

async function listAll(table, fields) {
    const out = [];
    let offset;
    do {
        const params = new URLSearchParams();
        for (const f of fields) params.append("fields[]", f);
        params.set("pageSize", "100");
        if (offset) params.set("offset", offset);
        const page = await must(
            DATA_ROOT,
            "GET",
            `/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}?${params}`
        );
        out.push(...page.records);
        offset = page.offset;
    } while (offset);
    return out;
}

/** Ten per request, which is Airtable's ceiling for a record PATCH. */
async function writeBatches(table, updates) {
    for (let i = 0; i < updates.length; i += 10) {
        await must(DATA_ROOT, "PATCH", `/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`, {
            records: updates.slice(i, i + 10),
        });
    }
}

const log = (m = "") => console.log(m);
const first = (v) => (Array.isArray(v) ? v[0] : v) ?? null;

/**
 * Put every entry in a ledger back, table by table, and PROVE it — every table,
 * not the first one that answers.
 *
 * Returns `{ restored, outstanding }` counted from a re-read rather than from the
 * writes succeeding, because a PATCH that returns 200 and a field that holds the
 * value are different claims.
 */
async function revert(file, { quiet = false } = {}) {
    const entries = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const tables = [...new Set(entries.map((e) => e.table))];
    if (!quiet) log(`reverting ${entries.length} value(s) across ${tables.length} table(s) from ${file}`);

    for (const table of tables) {
        const mine = entries.filter((e) => e.table === table);
        await writeBatches(table, mine.map((e) => ({ id: e.id, fields: { [e.field]: e.before } })));
        if (!quiet) log(`  ${table}: ${mine.length} written back`);
    }

    // THE PROOF IS A RE-READ OF EVERY TABLE, and it is what makes "half restored"
    // reportable at all. A run that put one table back and failed on the next
    // would otherwise end with a ledger that is still correct and a base nothing
    // describes.
    let restored = 0;
    const outstanding = [];
    for (const table of tables) {
        const mine = entries.filter((e) => e.table === table);
        const byId = new Map(mine.map((e) => [e.id, e]));
        const rows = (await listAll(table, [NAME_FIELD])).filter((r) => byId.has(r.id));
        let back = 0;
        for (const r of rows) {
            if ((r.fields[NAME_FIELD] ?? "") === byId.get(r.id).before) back += 1;
        }
        restored += back;
        if (back !== mine.length) outstanding.push(`${table} (${mine.length - back} of ${mine.length})`);
        if (!quiet) log(`  ${table}: ${back} of ${mine.length} read back as they were`);
    }
    return { restored, total: entries.length, outstanding };
}

async function main() {
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (REVERT_FILE) {
        const report = await revert(REVERT_FILE);
        log(
            report.outstanding.length === 0
                ? `\ndone — ${report.restored} of ${report.total} back on every table.`
                : `\nINCOMPLETE — still to put back: ${report.outstanding.join(", ")}. The ledger is unchanged; run it again.`
        );
        return report.outstanding.length === 0 ? 0 : 1;
    }
    if (TRIAL_AT !== -1 && !(Number.isInteger(TRIAL_ROWS) && TRIAL_ROWS > 0)) {
        log("--trial needs a positive row count, e.g. --trial 3");
        return 1;
    }

    log(`${MATERIALS}."${NAME_FIELD}" -> the category's own name, and the frozen copies behind it`);
    if (DRY_RUN) log("DRY RUN: nothing will be written.\n");
    else if (TRIAL_AT !== -1) log(`TRIAL: ${TRIAL_ROWS} row(s), written and then reverted.\n`);
    else log("");

    const tables = (await must(META_ROOT, "GET", `/bases/${baseId}/tables`)).tables;
    const byName = new Map(tables.map((t) => [t.name, t]));
    const categories = byName.get(CATEGORIES);
    const materials = byName.get(MATERIALS);
    if (!categories || !materials) { log(`  ${CATEGORIES} or ${MATERIALS} not found in this base.`); return 1; }

    const catName = categories.fields.find((f) => f.name === CATEGORY_ITEM_NAME);
    const catLabel = categories.fields.find((f) => f.name === "Category Label");
    if (!catName) {
        log(`  ${CATEGORIES}."${CATEGORY_ITEM_NAME}" is missing. Run add_category_item_name_415.mjs first.`);
        return 1;
    }

    // ---------------------------------------------------------------------
    // 1. The lookup's source
    // ---------------------------------------------------------------------
    log("the lookup:");
    const nameLookup = materials.fields.find((f) => f.name === NAME_FIELD);
    if (!nameLookup || nameLookup.type !== "multipleLookupValues") {
        log(`  ${MATERIALS}."${NAME_FIELD}" is ${nameLookup ? nameLookup.type : "missing"}, not a lookup.`);
        return 1;
    }
    const pointsAt = nameLookup.options?.fieldIdInLinkedTable;
    let lookupReady = pointsAt === catName.id;
    if (lookupReady) {
        log(`  ${MATERIALS}."${NAME_FIELD}" already reads ${CATEGORIES}."${CATEGORY_ITEM_NAME}".`);
    } else if (DRY_RUN) {
        log(`  would repoint ${MATERIALS}."${NAME_FIELD}" from ${pointsAt} to ${catName.id}`);
        log(`    (${catLabel?.id === pointsAt ? "Category Label" : pointsAt} -> ${CATEGORY_ITEM_NAME})`);
        log(`    THIS MOVES EVERY ${MATERIALS} ROW AT ONCE and is in no ledger — a lookup is`);
        log(`    computed, so the undo is pointing it back, not a record write.`);
    } else {
        const res = await api(META_ROOT, "PATCH", `/bases/${baseId}/tables/${materials.id}/fields/${nameLookup.id}`, {
            options: { recordLinkFieldId: nameLookup.options.recordLinkFieldId, fieldIdInLinkedTable: catName.id },
        });
        log(`  PATCH .../fields/${nameLookup.id} -> ${res.status} ${res.ok ? "repointed" : res.text}`);
        if (!res.ok) {
            log(`\n  HAND STEP: open ${MATERIALS}."${NAME_FIELD}" in Airtable and change the looked-up`);
            log(`  field from "Category Label" to "${CATEGORY_ITEM_NAME}". Leave the link field alone.`);
        }
        lookupReady = res.ok;
    }

    // ---------------------------------------------------------------------
    // 2. The path beside it
    // ---------------------------------------------------------------------
    log("");
    log("the path the search needs:");
    const existingPath = materials.fields.find((f) => f.name === PATH_FIELD);
    let pathReady = Boolean(existingPath);
    if (existingPath) {
        log(`  ${MATERIALS}."${PATH_FIELD}" already exists (${existingPath.id}, ${existingPath.type}).`);
    } else if (DRY_RUN) {
        log(`  would create ${MATERIALS}."${PATH_FIELD}" (lookup of ${CATEGORIES}."Category Label")`);
    } else {
        const res = await api(META_ROOT, "POST", `/bases/${baseId}/tables/${materials.id}/fields`, {
            name: PATH_FIELD,
            type: "multipleLookupValues",
            description: PATH_DESCRIPTION,
            options: {
                recordLinkFieldId: nameLookup.options.recordLinkFieldId,
                fieldIdInLinkedTable: catLabel.id,
            },
        });
        log(`  POST .../fields -> ${res.status} ${res.ok ? `created ${res.json.id}` : res.text}`);
        if (!res.ok) {
            log(`\n  HAND STEP: add "${PATH_FIELD}" to ${MATERIALS} as a lookup through Category of`);
            log(`  "Category Label". The search is refused while it is missing.`);
        }
        pathReady = res.ok;
    }

    // ---------------------------------------------------------------------
    // 3. The frozen copies
    // ---------------------------------------------------------------------
    log("");
    log("the frozen copies:");

    const nameByCategory = new Map(
        (await listAll(CATEGORIES, [CATEGORY_ITEM_NAME])).map((r) => [r.id, r.fields[CATEGORY_ITEM_NAME] ?? ""])
    );
    const categoryByMaterial = new Map(
        (await listAll(MATERIALS, ["Category"])).map((r) => [r.id, first(r.fields.Category)])
    );
    const materialByOrderedItem = new Map(
        (await listAll("PO Items", ["Material"])).map((r) => [r.id, first(r.fields.Material)])
    );

    /** The category one row of `table` reaches, by that table's own link. */
    function categoryFor(via, fields) {
        if (via === "category") return first(fields.Category);
        if (via === "material") return categoryByMaterial.get(first(fields.Material)) ?? null;
        const material = materialByOrderedItem.get(first(fields["PO Item"]));
        return material ? categoryByMaterial.get(material) ?? null : null;
    }

    const problems = [];
    const toWrite = [];
    let already = 0;
    for (const { table, via } of FROZEN) {
        const linkField = via === "category" ? "Category" : via === "material" ? "Material" : "PO Item";
        const rows = await listAll(table, [NAME_FIELD, linkField]);
        let unresolved = 0;
        let mine = 0;
        for (const r of rows) {
            const categoryId = categoryFor(via, r.fields);
            const after = categoryId ? nameByCategory.get(categoryId) : null;
            if (!after) { unresolved += 1; continue; }
            const before = r.fields[NAME_FIELD] ?? "";
            if (before === after) { already += 1; continue; }
            toWrite.push({ table, field: NAME_FIELD, id: r.id, before, after });
            mine += 1;
        }
        log(`  ${table.padEnd(15)} ${rows.length} row(s), ${mine} to rewrite, ${unresolved} reaching no category`);
        if (unresolved > 0) problems.push(`${unresolved} ${table} row(s) reach no category through ${linkField}`);
    }

    log("");
    log("what would change:");
    log(`  ${already} row(s) already carry their name`);
    log(`  ${toWrite.length} row(s) to rewrite, every one of them over an existing value`);
    for (const e of toWrite.slice(0, 3)) log(`    ${e.table} ${e.id}\n      "${e.before}"\n   -> "${e.after}"`);
    if (toWrite.length > 6) log("    ...");
    for (const e of toWrite.slice(-3)) log(`    ${e.table} ${e.id}\n      "${e.before}"\n   -> "${e.after}"`);

    if (problems.length) {
        log("");
        log("REFUSED — nothing was written:");
        for (const p of problems) log(`  - ${p}`);
        return 1;
    }

    if (DRY_RUN) {
        log("");
        log(`dry run complete. ${calls} API call(s).`);
        log(`a real run would make about ${Math.ceil(toWrite.length / 10)} PATCH call(s) on top of this.`);
        return 2;
    }
    if (!lookupReady || !pathReady) {
        log("");
        log("the rows are not rewritten while a schema step is outstanding — do the hand step above first.");
        return 2;
    }
    if (toWrite.length === 0) {
        log("");
        log(`nothing to write. ${calls} API call(s).`);
        return 0;
    }

    // ---------------------------------------------------------------------
    // 4. The write, and the ledger before it
    // ---------------------------------------------------------------------
    const planned = TRIAL_AT === -1 ? toWrite : pickTrial(toWrite, TRIAL_ROWS);
    const ledger = join(HERE, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    writeFileSync(ledger, planned.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    log("");
    log(`ledger: ${ledger}  (commit it — see this file's header)`);
    log(`  ${new Set(planned.map((e) => e.table)).size} table(s), ${planned.length} value(s)`);

    for (const table of new Set(planned.map((e) => e.table))) {
        const mine = planned.filter((e) => e.table === table);
        await writeBatches(table, mine.map((e) => ({ id: e.id, fields: { [e.field]: e.after } })));
        log(`  ${table}: ${mine.length} rewritten`);
    }

    if (TRIAL_AT === -1) {
        log("");
        log("read back:");
        let wrong = 0;
        for (const table of new Set(planned.map((e) => e.table))) {
            const mine = planned.filter((e) => e.table === table);
            const byId = new Map(mine.map((e) => [e.id, e]));
            const rows = (await listAll(table, [NAME_FIELD])).filter((r) => byId.has(r.id));
            const ok = rows.filter((r) => (r.fields[NAME_FIELD] ?? "") === byId.get(r.id).after).length;
            wrong += mine.length - ok;
            log(`  ${table}: ${ok} of ${mine.length} carry the catalog's name`);
        }
        log("");
        log(`${calls} API call(s).`);
        if (wrong > 0) log(`WARNING: ${wrong} row(s) did not land. Revert with --revert ${ledger}`);
        return wrong === 0 ? 0 : 1;
    }

    // ---------------------------------------------------------------------
    // 5. The trial's second half: put them back and prove every table did
    // ---------------------------------------------------------------------
    log("");
    log("proving the ledger:");
    const report = await revert(ledger);
    log(`  ${report.restored} of ${report.total} back, across every table in the ledger`);
    if (report.outstanding.length > 0) {
        log(`  STILL OUT: ${report.outstanding.join(", ")}`);
        log(`\nTRIAL FAILED. The ledger is kept: ${ledger}`);
        return 1;
    }

    // The trial's ledger records a round trip that has already been completed, so
    // it can undo nothing; a failed trial keeps it, because that is when the
    // values are needed. #415's rule, and the reason is the same.
    rmSync(ledger);
    log("  ledger deleted — it describes a write that has already been undone");
    log("");
    log(`trial complete. ${calls} API call(s). The schema is in place and no frozen copy moved.`);
    return 2;
}

/**
 * The trial's rows, spread ACROSS the tables rather than taken off the top.
 *
 * Taking the first N would take them all from `PR Items`, and the thing this
 * trial exists to prove is that a revert covers every table in the ledger — a
 * one-table ledger cannot demonstrate it.
 */
function pickTrial(entries, count) {
    const byTable = new Map();
    for (const e of entries) {
        if (!byTable.has(e.table)) byTable.set(e.table, []);
        byTable.get(e.table).push(e);
    }
    const picked = [];
    let round = 0;
    while (picked.length < count) {
        let added = false;
        for (const list of byTable.values()) {
            if (picked.length >= count) break;
            if (list[round]) { picked.push(list[round]); added = true; }
        }
        if (!added) break;
        round += 1;
    }
    return picked;
}

main()
    .then((code) => process.exit(code))
    .catch((err) => {
        console.error(`\nFAILED — ${err.stack || err.message}`);
        process.exit(1);
    });
