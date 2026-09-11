// Adds `Materials."Category"`, backfills it from the name each row already
// carries, and measures whether the leaf-code lookup beside it can be created
// through the API at all (issue #356).
//
// WHY A SCRIPT FOR THIS. A schema edit leaves no diff of its own, so the only
// record that it happened is here — `docs/notes/verification.md` puts a one-time
// run against the live base in this directory for exactly that reason, and
// `add_pr_item_category_355.mjs` is the neighbour that did the same job for the
// link this one points at from the other side. Idempotent throughout: a second
// run finds the field, finds every row already linked, and writes nothing.
//
// THE BACKFILL IS WHAT MAKES THE RETYPE SAFE, AND IT IS THE WHOLE REASON THIS
// RUNS BEFORE THE COMMIT. `Materials."Item Name"` becomes a lookup through
// `Category`, so a row whose `Category` is empty when that happens loses its
// name — and `Material Label`, the primary, goes with it. Every row on this base
// carries a composed `Category Label` as its `Item Name` (777 labels, all
// distinct, so the match is a lookup rather than a search), which is what #358
// left behind when it cleared the base and re-seeded against categories. **This
// script refuses to write a single link unless EVERY row resolves**, because a
// partial backfill is the state that survives the retype looking fine.
//
// WHAT IT CANNOT DO, AND THE RUN PRINTS IT RATHER THAN LEAVING IT IMPLIED.
// Two hand steps in the Airtable UI, listed at the end of the run:
//   - `prefersSingleRecordLink` is refused on field CREATE (422
//     INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE) and on UPDATE (422
//     INVALID_REQUEST_UNKNOWN), measured and recorded in
//     `docs/notes/airtable-access.md`. The app sends one record id either way.
//   - A field's TYPE cannot be PATCHed (422, "Changing a field's type or number
//     precision is not currently supported"), so `Item Name` is retyped by hand.
//
// AND ONE THAT TURNED OUT NOT TO BE A HAND STEP, WHICH IS WHY THE ATTEMPT IS
// STILL IN THE CODE. `Materials."Category Code"` is a lookup, and Airtable
// documents a lookup as a read-only field TYPE — which `docs/notes/
// airtable-access.md` had read as "cannot be created through the Metadata API".
// This script attempts the create and prints the verbatim response, because
// #281 had already caught that file stating a documented limit too broadly.
// **It returned 200.** A lookup CREATES cleanly (`options.recordLinkFieldId` +
// `options.fieldIdInLinkedTable`); what read-only means is that no record write
// may carry a value for it. The attempt stays rather than becoming an
// unconditional create: this is the only file that would notice if the platform
// went back, and a refusal here prints the response and falls through to the
// hand step instead of failing the run.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_material_category_356.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_material_category_356.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// a hand step is still outstanding).
//
// `lib/airtableOps.js` cannot see a raw `fetch`, so the run prints its own call
// count — the same cost `create_material_categories_354.mjs` states.

import { CATEGORY_LEAF_CODE } from "../../lib/materialCategory.js";

const META_ROOT = "https://api.airtable.com/v0/meta";
const DATA_ROOT = "https://api.airtable.com/v0";

const PARENT_TABLE = "Materials";
const TARGET_TABLE = "Material Categories";
const LINK_FIELD = "Category";
const CODE_FIELD = "Category Code";
const NAME_FIELD = "Item Name";
const LABEL_FIELD = "Category Label";
const EXPECTED_INVERSE = "Materials";

const LINK_DESCRIPTION =
    "The catalog path this material IS (#356). Half the natural key, with Size " +
    "and Unit — identity was the item name somebody typed until this field, so " +
    "two spellings of one thing were two rows with separate price histories " +
    "behind them. SINGLE record, enforced by this app rather than by the schema, " +
    "since prefersSingleRecordLink is refused on both CREATE and UPDATE. " +
    "Item Name is a lookup through this link and no longer text anyone writes, " +
    "so a row with no category has no name at all: upsertMaterial refuses one.";

const CODE_DESCRIPTION =
    "This material's category leaf code, looked up through Category (#356). It " +
    "exists because filterByFormula cannot compare a link field against a record " +
    "id — the same exception Material Prices.\"Material Record ID\" records one " +
    "table over — so this is what getMaterialByKey matches on. Named for what it " +
    "means on this row rather than for the field it reads: a material has exactly " +
    "one category and therefore one code, and \"Level 4\" is the tree's word.";

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

async function listAll(tableId, fields) {
    const out = [];
    let offset;
    do {
        const params = new URLSearchParams();
        for (const f of fields) params.append("fields[]", f);
        params.set("pageSize", "100");
        if (offset) params.set("offset", offset);
        const page = await must(DATA_ROOT, "GET", `/${process.env.AIRTABLE_BASE_ID}/${tableId}?${params}`);
        out.push(...page.records);
        offset = page.offset;
    } while (offset);
    return out;
}

function log(m = "") {
    console.log(m);
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    log(`${PARENT_TABLE}."${LINK_FIELD}" -> ${TARGET_TABLE}, and the backfill behind it`);
    log(dryRun ? "DRY RUN: nothing will be written.\n" : "");

    const tables = (await must(META_ROOT, "GET", `/bases/${baseId}/tables`)).tables;
    const parent = tables.find((t) => t.name === PARENT_TABLE);
    const target = tables.find((t) => t.name === TARGET_TABLE);

    if (!parent) { log(`  ${PARENT_TABLE} not found in this base.`); return 1; }
    if (!target) {
        log(`  ${TARGET_TABLE} not found. Run create_material_categories_354.mjs first.`);
        return 1;
    }

    // ---------------------------------------------------------------------
    // 1. The link
    // ---------------------------------------------------------------------
    const existingLink = parent.fields.find((f) => f.name === LINK_FIELD);
    if (existingLink) {
        log(`  ${PARENT_TABLE}."${LINK_FIELD}" already exists (${existingLink.id}, ${existingLink.type}).`);
        if (existingLink.type !== "multipleRecordLinks") {
            log(`  ...but it is \`${existingLink.type}\`, not a link. A field's type cannot be PATCHed.`);
            return 1;
        }
    } else if (dryRun) {
        log(`  would create ${PARENT_TABLE}."${LINK_FIELD}" (multipleRecordLinks -> ${TARGET_TABLE})`);
    } else {
        const created = await must(META_ROOT, "POST", `/bases/${baseId}/tables/${parent.id}/fields`, {
            name: LINK_FIELD,
            type: "multipleRecordLinks",
            description: LINK_DESCRIPTION,
            options: { linkedTableId: target.id },
        });
        log(`  created ${PARENT_TABLE}."${LINK_FIELD}" (${created.id})`);
    }

    // ---------------------------------------------------------------------
    // 2. The lookup beside it — attempted, because the limit is documented
    //    rather than measured on this base. Either answer is worth the call.
    // ---------------------------------------------------------------------
    const linkNow = existingLink
        ?? (await must(META_ROOT, "GET", `/bases/${baseId}/tables`)).tables
            .find((t) => t.name === PARENT_TABLE)?.fields.find((f) => f.name === LINK_FIELD);
    const leafField = target.fields.find((f) => f.name === CATEGORY_LEAF_CODE);
    let codeField = parent.fields.find((f) => f.name === CODE_FIELD);

    log("");
    if (codeField) {
        log(`  ${PARENT_TABLE}."${CODE_FIELD}" already exists (${codeField.id}, ${codeField.type}).`);
    } else if (dryRun || !linkNow || !leafField) {
        log(`  would attempt ${PARENT_TABLE}."${CODE_FIELD}" (multipleLookupValues via ${LINK_FIELD} -> ${CATEGORY_LEAF_CODE})`);
    } else {
        log(`  attempting ${PARENT_TABLE}."${CODE_FIELD}" (multipleLookupValues) — a lookup is`);
        log(`  documented as a read-only field type, so this is a measurement:`);
        const attempt = await api(META_ROOT, "POST", `/bases/${baseId}/tables/${parent.id}/fields`, {
            name: CODE_FIELD,
            type: "multipleLookupValues",
            description: CODE_DESCRIPTION,
            options: { recordLinkFieldId: linkNow.id, fieldIdInLinkedTable: leafField.id },
        });
        if (attempt.ok) {
            log(`    CREATED (${attempt.json.id}) — the documented limit does not hold on this base.`);
            log(`    Record it in docs/notes/airtable-access.md; the hand step below is gone.`);
            codeField = attempt.json;
        } else {
            log(`    refused ${attempt.status}: ${attempt.text}`);
            log(`    -> the hand step below stands. This is the measurement, not a failure.`);
        }
    }

    // ---------------------------------------------------------------------
    // 3. The backfill
    // ---------------------------------------------------------------------
    log("");
    const nameField = parent.fields.find((f) => f.name === NAME_FIELD);
    if (nameField?.type === "multipleLookupValues") {
        log(`  ${PARENT_TABLE}."${NAME_FIELD}" is already a lookup, so it IS the category and`);
        log(`  there is nothing to match on. The backfill has run or was never needed.`);
    } else {
        // The link is only in the projection once it EXISTS — a dry run on a base
        // that has never had it would otherwise 422 on the field name and report
        // nothing about the backfill, which is the half of the run worth
        // rehearsing.
        const [materials, categories] = await Promise.all([
            listAll(parent.id, linkNow ? [NAME_FIELD, LINK_FIELD] : [NAME_FIELD]),
            listAll(target.id, [LABEL_FIELD]),
        ]);

        const byLabel = new Map();
        const duplicateLabels = [];
        for (const c of categories) {
            const label = c.fields[LABEL_FIELD];
            if (byLabel.has(label)) duplicateLabels.push(label);
            else byLabel.set(label, c.id);
        }
        log(`  ${materials.length} material(s), ${categories.length} categor(ies), ${byLabel.size} distinct label(s)`);

        if (duplicateLabels.length > 0) {
            log(`  ${duplicateLabels.length} label(s) are on more than one category row, so a name`);
            log(`  does not name one path: ${duplicateLabels.slice(0, 5).join(" | ")}`);
            return finish(1, "the catalog has duplicate labels — fix them in Airtable first");
        }

        const linked = materials.filter((m) => (m.fields[LINK_FIELD] || []).length > 0);
        const todo = materials.filter((m) => (m.fields[LINK_FIELD] || []).length === 0);
        const unresolved = todo.filter((m) => !byLabel.has(m.fields[NAME_FIELD]));

        log(`  ${linked.length} already linked, ${todo.length} to link, ${unresolved.length} unresolved`);

        if (unresolved.length > 0) {
            // EVERY ROW OR NONE. A row left without a category loses its name the
            // moment `Item Name` becomes a lookup, and the label it is missing is
            // the only evidence of what it was — so stopping here keeps that
            // evidence, and writing the rest would spend it.
            log("");
            log(`  ${unresolved.length} material(s) carry a name that is not a category label:`);
            for (const m of unresolved.slice(0, 20)) {
                log(`    ${m.id}  ${JSON.stringify(m.fields[NAME_FIELD] ?? "")}`);
            }
            log("");
            log("  Nothing was written. Give each of these a Category by hand in Airtable,");
            log("  or delete the row if it predates the catalog, then run this again.");
            return finish(1, "the backfill would leave a row with no name after the retype");
        }

        if (todo.length === 0) {
            log(`  nothing to backfill`);
        } else if (dryRun) {
            log(`  would link ${todo.length} material(s) to their category`);
        } else {
            // Ten per PATCH, Airtable's own ceiling for a batched record write.
            for (let i = 0; i < todo.length; i += 10) {
                const chunk = todo.slice(i, i + 10);
                await must(DATA_ROOT, "PATCH", `/${baseId}/${parent.id}`, {
                    records: chunk.map((m) => ({
                        id: m.id,
                        fields: { [LINK_FIELD]: [byLabel.get(m.fields[NAME_FIELD])] },
                    })),
                });
            }
            log(`  linked ${todo.length} material(s)`);
        }
    }

    // ---------------------------------------------------------------------
    // 4. Verify against the live schema — what was asked for and what exists
    //    can differ, and the inverse's NAME is the one difference nothing
    //    else would report.
    // ---------------------------------------------------------------------
    log("");
    log("verifying against the live schema:");
    const after = (await must(META_ROOT, "GET", `/bases/${baseId}/tables`)).tables;
    const parentAfter = after.find((t) => t.name === PARENT_TABLE);
    const link = parentAfter?.fields.find((f) => f.name === LINK_FIELD);
    const code = parentAfter?.fields.find((f) => f.name === CODE_FIELD);
    const name = parentAfter?.fields.find((f) => f.name === NAME_FIELD);
    const inverse = after
        .find((t) => t.name === TARGET_TABLE)
        ?.fields.find((f) => f.id === link?.options?.inverseLinkFieldId);

    if (dryRun && !link) {
        log(`  ${LINK_FIELD} not present, as expected on a dry run`);
        return finish(2, "dry run — nothing was written");
    }

    let ok = true;
    const check = (label, actual, expected) => {
        const good = actual === expected;
        if (!good) ok = false;
        log(`  ${good ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    };

    check("link field type", link?.type ?? "(missing)", "multipleRecordLinks");
    check("linked table", link?.options?.linkedTableId ?? "(missing)", target.id);
    check("inverse field name", inverse?.name ?? "(missing)", EXPECTED_INVERSE);
    if (!ok) return finish(1, "the base does not match the spec");

    const single = link?.options?.prefersSingleRecordLink === true;
    const codeIsLookup = code?.type === "multipleLookupValues";
    const nameIsLookup = name?.type === "multipleLookupValues";

    log(`  single-record on "${LINK_FIELD}": ${single ? "on" : "OFF"}`);
    log(`  "${CODE_FIELD}": ${code ? code.type : "(missing)"}`);
    log(`  "${NAME_FIELD}": ${name ? name.type : "(missing)"}`);

    // The live values, which is the only place the retype can be seen to have
    // worked. Three rows is enough: the claim is about the shape a lookup takes
    // in string context, not about this base's data.
    if (nameIsLookup) {
        log("");
        log(`  ${NAME_FIELD} renders in ${PARENT_TABLE}."Material Label" as:`);
        const sample = await listAll(parentAfter.id, ["Material Label", NAME_FIELD, "Size", "Unit"]);
        for (const m of sample.slice(0, 3)) {
            log(`    ${JSON.stringify(m.fields["Material Label"])}`);
        }
        const bracketed = sample.filter((m) => String(m.fields["Material Label"] ?? "").startsWith("["));
        log(`  ${bracketed.length} of ${sample.length} label(s) begin with "[" — expected 0.`);
        log(`  A single-element lookup concatenates BARE (measured on PO Items."PO Status");`);
        log(`  a non-zero count here means Material Label needs ARRAYJOIN and this is the`);
        log(`  place that says so.`);
        if (bracketed.length > 0) return finish(1, "Material Label is rendering the array form");
    }

    const hand = [];
    if (!single) hand.push([PARENT_TABLE, LINK_FIELD, 'turn OFF "Allow linking to multiple records"', "multipleRecordLinks"]);
    if (!codeIsLookup) hand.push([PARENT_TABLE, CODE_FIELD, `create: Lookup, via "${LINK_FIELD}", of "${CATEGORY_LEAF_CODE}"`, "multipleLookupValues"]);
    if (!nameIsLookup) hand.push([PARENT_TABLE, NAME_FIELD, `retype: Lookup, via "${LINK_FIELD}", of "${LABEL_FIELD}"`, "singleLineText -> multipleLookupValues"]);

    if (hand.length === 0) return finish(0, "the base matches the spec");

    log("");
    log("=".repeat(72));
    log("HAND STEPS — in the Airtable UI. ORDER MATTERS for the last one:");
    log("");
    for (const [table, field, what, type] of hand) {
        log(`  ${table}."${field}"  [${type}]`);
        log(`      ${what}`);
    }
    log("");
    log(`  The first two are ADDITIVE and belong BEFORE the code commit — nothing`);
    log(`  reads them until it lands, and getMaterialByKey needs "${CODE_FIELD}".`);
    if (!nameIsLookup) {
        log(`  The "${NAME_FIELD}" retype belongs AFTER it. Done first, the old code`);
        log(`  writes a computed field, Airtable 422s, refreshMaterialsCacheForPO`);
        log(`  swallows it per entry, and PO Items."Material" silently stops being`);
        log(`  linked — an order that is fine on the document axis and absent from`);
        log(`  the item axis. Done after, nothing reads the field but two screens.`);
    }
    log("=".repeat(72));
    return finish(2, `${hand.length} hand step(s) outstanding`);
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
