// Classifies the asset catalog in six levels (issue #514), and is the catalog's check.
//
// WHAT CHANGES. #507 named a row of `Asset Categories` by three levels — `Level 1` the
// category, `Level 2` the tool, `Size` — and #514 names it by six: `Level 1` the type
// (`Equipment` or `Tool`, a select), `Level 2` the category, `Level 3` the name, then `Size`,
// `Maker` and `Part Number`, which a row may leave empty. `Item Name` stays the primary and its
// formula becomes `{Level 3} {Size}, {Maker} ({Part Number})`, an empty level left out with what
// stands before it — no maker, no comma; no part number, no parentheses — so a size the office
// types with its own, `5" (127 mm)`, keeps them before the comma. lib/assetCategory.js
// holds the fields, the type's and the class's values and the expression, and this script
// imports them rather than spelling them.
//
// THE TWO LEVELS MOVE UP BY A RENAME, AND THE ORDER IS FORCED. `Level 2` becomes `Level 3`
// first and `Level 1` becomes `Level 2` second, so no two fields ever hold one name, and only
// then is the new `Level 1` created. A rename carries every value and the formula's reference
// with it (docs/notes/airtable-access.md), so the categories and the tools #507's rows hold
// are where #514 reads them without a record write. Each rename is by field id, so a second
// run reads the base as the first left it: a field already holding its new name is done, one
// holding its old name is due, and anything else stops the run before it writes.
//
// NO HAND STEP. Every edit here is one the Metadata API takes (airtable-access.md): a field's
// name and description PATCH, a select is created with its options and their colors, and an
// existing formula's expression PATCHes. The API appends a created field at the end of the
// table, so moving `Level 1` before `Level 2` and `Maker` and `Part Number` after `Size` is a
// drag in the UI that changes nothing the app reads.
//
// RE-RUN IT AFTER THE CATALOG IS FILLED, AND IT IS THE CATALOG'S CHECK — #507's script was
// until #514, and refuses to run now that the levels are these. Once the schema matches, a run
// writes nothing and reads every row back: it compares each name the base computed with
// lib/assetCategory.js's rule, and it lists every row a registration cannot choose, with why
// — a type, a category, a name or the class missing; a level holding a placeholder for
// nothing, such as `N/A`, `-` or `None`, where an empty level is left empty; or a path another
// row already names. That list is how a row the office typed and the app does not offer gets
// found, and the judgment is `readCatalog`'s, the one the registration reads.
//
// AND SINCE #528 IT MAKES AND CHECKS `Asset Category Groups`, the types and categories the
// catalog files under: one row a pair, `Level 2` the category — the primary, since a select
// cannot be one and a formula cannot be created — and `Level 1` the type, the catalog's own
// two fields, its select's options and colors. Created whole in one call when it is missing,
// as `create_tools_334.py` creates a table; its rows are `replace_asset_catalog_528.mjs`'s to
// load. The check reads them: each row that does not stand as a group, with why, and every
// row a registration may pick whose type and category no group holds, which fails the run —
// a group with nothing under it yet is said and is no fault. The pairing is
// `lib/assetCategory.js:groupCatalog`'s, the same the load judged its two lists by.
//
// IT WRITES NO RECORD, SO IT KEEPS NO LEDGER. What it changes is schema, each step printed as
// it is made; the demo catalog #514 rewrote is `scripts/demo/seed_asset_catalog_514.mjs`'s,
// which carries its own way back.
//
// IT TALKS TO THE REST API DIRECTLY, for create_material_categories_354.mjs' reason: the
// schema half has no SDK. lib/airtableOps.js cannot see these calls, so the run counts them.
//
// Usage (from the repo root). Dry run is the DEFAULT, and a dry run on a base that matches is
// the check:
//   node --env-file=.env.local scripts/import/classify_asset_categories_514.mjs
//   node --env-file=.env.local scripts/import/classify_asset_categories_514.mjs --apply
//
// No loader flag: this file and lib/assetCategory.js import only built-ins and files whose
// extension they spell.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1 something
// failed or was refused, 2 nothing failed but something is still to do (a dry run).

import {
    ASSET_CATEGORY_FIELDS,
    ASSET_CLASS_VALUES,
    ASSET_GROUP_LEVELS,
    ASSET_TYPE_VALUES,
    ITEM_NAME_FORMULA,
    composeItemName,
    groupCatalog,
    pathOf,
    readCatalog,
    readCategoryGroups,
} from "../../lib/assetCategory.js";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;

const TABLE_NAME = "Asset Categories";
const NAME_FIELD = "Item Name";

/** The types and categories the catalog files under (#528). */
const GROUPS_TABLE = "Asset Category Groups";

/**
 * The two renames, by field id, in the order they must run: `Level 2` out of the way first.
 * The ids are #507's fields (`docs/notes/tools.md`), which a rename does not change.
 */
const RENAMES = [
    { id: "fldb3BHeT4BKE7VTC", from: "Level 2", to: ASSET_CATEGORY_FIELDS.level3 },
    { id: "fldsYQKngSbW5CFMi", from: "Level 1", to: ASSET_CATEGORY_FIELDS.level2 },
];

/**
 * The colors walk Airtable's light palette in declaration order — the rule
 * create_tools_334.py states for the axis's selects — and neither select has a terminal
 * value to give gray.
 */
const SELECT_COLORS = ["blueLight2", "cyanLight2"];
const choicesOf = (values) => values.map((name, i) => ({ name, color: SELECT_COLORS[i] }));

const TABLE_DESCRIPTION =
    "The asset categories (#507; Tools until #513): one row per kind, named by its path in six levels (#514) — " +
    "Level 1 the type, Equipment or Tool; Level 2 the category, a field of work such as machining or welding; " +
    "Level 3 the name; then Size, Maker and Part Number, which a row leaves empty where they do not apply — and " +
    "carrying a Class. Leave an empty level empty: N/A, -, None and the like read as values, and a row holding one " +
    "is not offered. The office fills it here, and the app never writes a row of it: a registration picks a row and " +
    "writes assets under it. One path is one kind; two rows naming one path are one choice, and only the first is " +
    "offered (lib/assetCategory.js). Assets holds the physical tools and equipment, one row each.";

const NAME_DESCRIPTION =
    "The kind's name, {Level 3} {Size}, {Maker} ({Part Number}) — an empty level left out, no comma without a Maker " +
    "and no parentheses without a Part Number (#514) — and the name every screen says (#507; Tool Name until #513). A " +
    "formula since #507: it was typed on the registration form from #338, and the app no longer creates a kind. Its " +
    "expression is generated by lib/assetCategory.js and PATCHed by " +
    "scripts/import/classify_asset_categories_514.mjs; edit it there.";

/** The seven fields, as the base should hold them once this has run, in the order a path says them. */
const FIELDS = [
    {
        name: ASSET_CATEGORY_FIELDS.level1,
        type: "singleSelect",
        options: { choices: choicesOf(ASSET_TYPE_VALUES) },
        description:
            "The type, the catalog's first level (#514), said Type on screen: Equipment or Tool. Information only — " +
            "what an asset does is the same either way. A registration filters the names by it, and a row without one " +
            "is not offered.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.level2,
        type: "singleLineText",
        description:
            "The category, the catalog's second level, said Category on screen: a field of work such as machining or " +
            "welding. A registration filters the names by it. Level 1 until #514, which renamed it with its values. " +
            "A row's Level 1 and Level 2 are a row of Asset Category Groups (#528): add a new category there first.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.level3,
        type: "singleLineText",
        description:
            "The name, the catalog's third level, said Name on screen, and the first part of Item Name — Angle " +
            "Grinder, Welding Machine. A registration searches it. Level 2 until #514, which renamed it with its values.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.size,
        type: "singleLineText",
        description:
            "The size, said Size on screen, and the second part of Item Name. Leave it empty where a kind has none — " +
            "most equipment. A registration asks it only where a row under the name has one, and lets it be left empty " +
            "only where a row leaves it empty (#514).",
    },
    {
        name: ASSET_CATEGORY_FIELDS.maker,
        type: "singleLineText",
        description:
            "The maker, said Maker on screen (#514), and what follows Item Name's comma. Leave it empty for a " +
            "generic kind: a generic row beside rows by a maker is what lets a registration leave the maker empty.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.partNumber,
        type: "singleLineText",
        description:
            "The maker's part number, said Part # on screen (#514), and the last thing in Item Name, in parentheses. " +
            "Leave it empty where it does not apply.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.assetClass,
        type: "singleSelect",
        options: { choices: choicesOf(ASSET_CLASS_VALUES) },
        description:
            "How much the kind matters (#507): A for one that matters more, usually a dearer one, B otherwise. " +
            "Information only — no act in the app reads it. A row without one is not offered to a registration.",
    },
];

const GROUPS_DESCRIPTION =
    "The types and categories the asset catalog files under (#528): one row per category, Level 1 the type, " +
    "Equipment or Tool, and Level 2 the category, a field of work such as welding or machining — the two fields " +
    "Asset Categories names them by. A category can stand here before anything is filed under it. Every type and " +
    "category a row of Asset Categories carries is a row here: no link joins the two tables, the values do, " +
    "compared without regard to case or spacing, and scripts/import/classify_asset_categories_514.mjs fails on a " +
    "catalog row whose pair is missing — so add a new category here before typing an item under it. Loaded from " +
    "scripts/import/sources/asset_category_groups_528.csv by scripts/import/replace_asset_catalog_528.mjs; the app " +
    "writes no row of it.";

/**
 * The table's two fields, the primary first: the category, since a select cannot be a primary
 * and a formula cannot be created (docs/notes/airtable-access.md), and then the type, the same
 * select as the catalog's `Level 1`, options and colors. Both are the catalog's own fields'
 * names, the two levels of the same path.
 */
const GROUP_FIELDS = [
    {
        name: ASSET_CATEGORY_FIELDS.level2,
        type: "singleLineText",
        description:
            "The category, said Category on screen — the same value as Level 2 on every Asset Categories row filed " +
            "under it. The primary, and no key on its own: a group is a type and a category together, and one category " +
            "name may stand under both types.",
    },
    {
        name: ASSET_CATEGORY_FIELDS.level1,
        type: "singleSelect",
        options: { choices: choicesOf(ASSET_TYPE_VALUES) },
        description:
            "The type, said Type on screen: Equipment or Tool, the same two options as Level 1 on Asset Categories. A " +
            "row without one is no group.",
    },
];

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

    async table(name = TABLE_NAME) {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`);
        return tables.find((t) => t.name === name) ?? null;
    }

    /** A whole table in one call — its name, description, fields and a select's options and colors (#334). */
    createTable(spec) {
        return this.request("POST", `${META_ROOT}/bases/${this.baseId}/tables`, spec);
    }

    createField(tableId, field) {
        return this.request("POST", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields`, field);
    }

    patchField(tableId, fieldId, patch) {
        return this.request("PATCH", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields/${fieldId}`, patch);
    }

    patchTable(tableId, patch) {
        return this.request("PATCH", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}`, patch);
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
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

/**
 * A formula as the Metadata API returned it, with every field it names by id put back to
 * the field's name. The API renders some formulas with `{fldXXXXXXXXXXXXXX}` and some with
 * `{Field Name}` (docs/notes/airtable-access.md counted 12 and 6 of 18), so a comparison of
 * the raw text would call a correct expression wrong.
 */
function byName(table, formula) {
    const names = new Map(table.fields.map((f) => [f.id, f.name]));
    return String(formula ?? "").replace(/\{(fld[A-Za-z0-9]{14})\}/g, (whole, id) => (names.has(id) ? `{${names.get(id)}}` : whole));
}

/** A select's options as `name/color`, in order — the half of a select nothing can PATCH. */
const choiceList = (field) => (field?.options?.choices ?? []).map((c) => `${c.name}/${c.color}`).join(" | ");

/** A row in the shape lib/assetCategory.js reads, from a REST record. */
function categoryOf(record) {
    const f = record.fields;
    return {
        id: record.id,
        itemName: f[NAME_FIELD] ?? "",
        ...Object.fromEntries(Object.entries(ASSET_CATEGORY_FIELDS).map(([key, name]) => [key, f[name] ?? ""])),
    };
}

/** A row of `Asset Category Groups` in the shape lib/assetCategory.js reads, from a REST record. */
function groupOf(record) {
    return { id: record.id, ...Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [level, record.fields[ASSET_CATEGORY_FIELDS[level]] ?? ""])) };
}

/** A row's type and category as a path says them. */
const pairOf = (row) => pathOf({ level1: row.level1, level2: row.level2 }) || "(neither)";

/** Why a row is not offered, in the words of the fields the office types into. */
function whyAside({ reason, missing, levels, of }) {
    if (reason === "incomplete") return `missing ${missing.map((m) => ASSET_CATEGORY_FIELDS[m]).join(", ")}`;
    if (reason === "placeholder") return `a placeholder for empty in ${levels.map((m) => ASSET_CATEGORY_FIELDS[m]).join(", ")} — leave the cell empty`;
    return `the path ${of.id} already names`;
}

async function main() {
    const apply = process.argv.includes("--apply");
    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }

    const air = new Airtable(token, baseId);
    log(`classify_asset_categories_514 — base ${baseId}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);

    let table = await air.table();
    if (!table) {
        log(`no table named ${TABLE_NAME}.`);
        return finish(air, 1, "nothing to classify");
    }
    const nameField = table.fields.find((f) => f.name === NAME_FIELD);
    if (!nameField || nameField.id !== table.primaryFieldId || nameField.type !== "formula") {
        log(`${TABLE_NAME}."${NAME_FIELD}" is not the primary formula #507 left — stopping.`);
        return finish(air, 1, "the table is not the shape this expects");
    }
    let due = 0;

    // --- the two renames, in order, by id -----------------------------------
    log("the two levels #507 made, moved up a level:");
    for (const rename of RENAMES) {
        const live = table.fields.find((f) => f.id === rename.id);
        if (live?.name === rename.to) {
            log(`  [DONE]   ${rename.id} is ${rename.to}`);
            continue;
        }
        if (live?.name !== rename.from) {
            log(`  ${rename.id} is ${live ? `named ${JSON.stringify(live.name)}` : "missing"}, neither ${rename.from} nor ${rename.to} — stopping.`);
            return finish(air, 1, "the base is not one this recognizes");
        }
        const taken = table.fields.find((f) => f.name === rename.to);
        if (taken) {
            log(`  ${rename.to} is already ${taken.id}, so ${rename.id} cannot take the name — stopping.`);
            return finish(air, 1, "a field is in the way");
        }
        due++;
        if (!apply) {
            log(`  [WOULD]  rename ${rename.id} ${rename.from} → ${rename.to}`);
            // The dry run reads the base as the rename would leave it, so the next step's
            // check sees the name free.
            live.name = rename.to;
            continue;
        }
        await air.patchField(table.id, rename.id, { name: rename.to });
        log(`  [RENAME] ${rename.id} ${rename.from} → ${rename.to}`);
        table = await air.table();
    }

    // --- the three new fields ----------------------------------------------
    log("\nthe fields a row of six levels needs:");
    for (const spec of FIELDS) {
        const live = table.fields.find((f) => f.name === spec.name);
        if (live && live.type !== spec.type) {
            log(`  ${spec.name} exists as a ${live.type}, not the ${spec.type} this needs; a type cannot be PATCHed — stopping.`);
            return finish(air, 1, "a field is in the way");
        }
        if (live) {
            log(`  [SKIP]   ${spec.name} (${live.id}) is a ${live.type}`);
            continue;
        }
        due++;
        if (!apply) {
            log(`  [WOULD]  create ${spec.name} as a ${spec.type}${spec.options ? ` ${JSON.stringify(spec.options)}` : ""}`);
            continue;
        }
        const made = await air.createField(table.id, spec);
        log(`  [CREATE] ${spec.name} (${made.id}) as a ${made.type}`);
    }
    if (apply) table = await air.table();

    // --- the formula and the words ------------------------------------------
    log(`\n${NAME_FIELD}'s expression and the descriptions:`);
    if (byName(table, nameField.options?.formula) === ITEM_NAME_FORMULA) {
        log(`  its expression is already ${ITEM_NAME_FORMULA}`);
    } else if (!apply) {
        due++;
        log(`  [WOULD]  PATCH its expression to ${ITEM_NAME_FORMULA}`);
    } else {
        due++;
        await air.patchField(table.id, nameField.id, { options: { formula: ITEM_NAME_FORMULA } });
        log(`  [PATCH]  its expression is ${ITEM_NAME_FORMULA}`);
    }

    // Descriptions are synced, not only set on create: the base's copy is the one somebody
    // reads while typing into the cell (create_material_categories_354.mjs has the reason). A
    // field a dry run has not made yet has none to compare.
    for (const [name, description] of [[NAME_FIELD, NAME_DESCRIPTION], ...FIELDS.map((f) => [f.name, f.description])]) {
        const live = table.fields.find((f) => f.name === name);
        if (!live || (live.description ?? "") === description) continue;
        due++;
        if (!apply) {
            log(`  [WOULD]  update ${name}'s description`);
            continue;
        }
        await air.patchField(table.id, live.id, { description });
        log(`  [PATCH]  ${name}'s description`);
    }
    if ((table.description ?? "") !== TABLE_DESCRIPTION) {
        due++;
        if (!apply) log(`  [WOULD]  update the table's description`);
        else {
            await air.patchTable(table.id, { description: TABLE_DESCRIPTION });
            log(`  [PATCH]  the table's description`);
        }
    }

    // --- the groups the catalog files under (#528) --------------------------
    log(`\n${GROUPS_TABLE}, the types and categories the catalog files under:`);
    const groupsTable = await air.table(GROUPS_TABLE);
    if (!groupsTable) {
        due++;
        if (!apply) log(`  [WOULD]  create it with ${GROUP_FIELDS.map((f) => `${f.name} (${f.type}${f.options ? ` ${JSON.stringify(f.options)}` : ""})`).join(", ")}`);
        else {
            const made = await air.createTable({ name: GROUPS_TABLE, description: GROUPS_DESCRIPTION, fields: GROUP_FIELDS });
            log(`  [CREATE] ${made.id}: ${made.fields.map((f) => `${f.name} (${f.id}) a ${f.type}`).join(", ")}`);
        }
    } else {
        for (const spec of GROUP_FIELDS) {
            const live = groupsTable.fields.find((f) => f.name === spec.name);
            if (live && live.type !== spec.type) {
                log(`  ${spec.name} exists as a ${live.type}, not the ${spec.type} this needs; a type cannot be PATCHed — stopping.`);
                return finish(air, 1, "a field is in the way");
            }
            if (!live) {
                due++;
                if (!apply) log(`  [WOULD]  create ${spec.name} as a ${spec.type}`);
                else {
                    const made = await air.createField(groupsTable.id, spec);
                    log(`  [CREATE] ${spec.name} (${made.id}) as a ${made.type}`);
                }
                continue;
            }
            if ((live.description ?? "") === spec.description) {
                log(`  [SKIP]   ${spec.name} (${live.id}) is a ${live.type}`);
                continue;
            }
            due++;
            if (!apply) log(`  [WOULD]  update ${spec.name}'s description`);
            else {
                await air.patchField(groupsTable.id, live.id, { description: spec.description });
                log(`  [PATCH]  ${spec.name}'s description`);
            }
        }
        if ((groupsTable.description ?? "") !== GROUPS_DESCRIPTION) {
            due++;
            if (!apply) log(`  [WOULD]  update the table's description`);
            else {
                await air.patchTable(groupsTable.id, { description: GROUPS_DESCRIPTION });
                log(`  [PATCH]  the table's description`);
            }
        }
    }
    if (!apply && due > 0) return finish(air, 2, `dry run — ${due} change(s) due, nothing was written`);

    // --- verification is part of the run, and on a matching base it is the run ----
    log(`\nverifying against the live base:`);
    table = await air.table();
    const failures = [];
    const field = (name) => table.fields.find((f) => f.name === name);
    if (field(NAME_FIELD)?.type !== "formula") failures.push(`${NAME_FIELD} is ${field(NAME_FIELD)?.type}, not a formula`);
    if (byName(table, field(NAME_FIELD)?.options?.formula) !== ITEM_NAME_FORMULA) {
        failures.push(`${NAME_FIELD}'s expression is ${JSON.stringify(byName(table, field(NAME_FIELD)?.options?.formula))}`);
    }
    for (const spec of FIELDS) {
        const live = field(spec.name);
        if (!live) failures.push(`${spec.name} is missing`);
        else if (live.type !== spec.type) failures.push(`${spec.name} is ${live.type}, not ${spec.type}`);
        else if (spec.options && choiceList(live) !== choiceList(spec)) failures.push(`${spec.name}'s choices are ${choiceList(live)}, not ${choiceList(spec)}`);
    }
    for (const rename of RENAMES) {
        if (field(rename.to)?.id !== rename.id) failures.push(`${rename.to} is ${field(rename.to)?.id ?? "missing"}, not ${rename.id}, the field it was renamed from`);
    }

    const records = await air.listRecords(table.id, [NAME_FIELD, ...Object.values(ASSET_CATEGORY_FIELDS)]);
    const categories = records.map(categoryOf);
    for (const category of categories) {
        const expected = composeItemName(category);
        if (category.itemName !== expected) {
            failures.push(`${category.id}: the base named it ${JSON.stringify(category.itemName)}, the rule names it ${JSON.stringify(expected)}`);
        }
    }

    const { offered, setAside } = readCatalog(categories);
    log(`  ${categories.length} row(s); ${offered.length} a registration may pick.`);
    if (setAside.length > 0) {
        log(`  ${setAside.length} row(s) a registration cannot pick, for the office to fill or put right:`);
        for (const aside of setAside) log(`    ${aside.category.id}  ${JSON.stringify(aside.category.itemName)} — ${whyAside(aside)}`);
    }

    // The groups (#528): the table's shape, each row that stands as a group, and every row a
    // registration may pick filed under one. A group with nothing under it is said, not failed.
    const groupsLive = await air.table(GROUPS_TABLE);
    if (!groupsLive) failures.push(`${GROUPS_TABLE} is missing`);
    else {
        const groupField = (name) => groupsLive.fields.find((f) => f.name === name);
        for (const spec of GROUP_FIELDS) {
            const live = groupField(spec.name);
            if (!live) failures.push(`${GROUPS_TABLE}.${spec.name} is missing`);
            else if (live.type !== spec.type) failures.push(`${GROUPS_TABLE}.${spec.name} is ${live.type}, not ${spec.type}`);
            else if (spec.options && choiceList(live) !== choiceList(spec)) failures.push(`${GROUPS_TABLE}.${spec.name}'s choices are ${choiceList(live)}, not ${choiceList(spec)}`);
        }
        if (groupField(GROUP_FIELDS[0].name)?.id !== groupsLive.primaryFieldId) failures.push(`${GROUPS_TABLE}'s primary is not ${GROUP_FIELDS[0].name}`);

        const groups = (await air.listRecords(groupsLive.id, GROUP_FIELDS.map((f) => f.name))).map(groupOf);
        const standing = readCategoryGroups(groups);
        log(`  ${groups.length} ${GROUPS_TABLE} row(s); ${standing.offered.length} stand as a group.`);
        if (standing.setAside.length > 0) {
            log(`  ${standing.setAside.length} row(s) that are no group, for the office to fill or put right:`);
            for (const aside of standing.setAside) log(`    ${aside.group.id}  ${pairOf(aside.group)} — ${whyAside(aside)}`);
        }
        const { ungrouped, withoutItems } = groupCatalog(categories, groups);
        for (const category of ungrouped) failures.push(`${category.id} ${JSON.stringify(category.itemName)}: no group holds ${pairOf(category)}`);
        if (withoutItems.length > 0) log(`  ${withoutItems.length} group(s) with nothing filed under them yet: ${withoutItems.map(pairOf).join(", ")}`);
    }

    if (failures.length > 0) {
        log(`  ${failures.length} problem(s):`);
        for (const line of failures) log(`    ${line}`);
        return finish(air, 1, "the base does not match the spec");
    }
    log(`  the fields, both selects' choices, the expression and every name match, and every type and category a registration offers is a group.`);
    return finish(air, 0, "the base matches the spec");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
