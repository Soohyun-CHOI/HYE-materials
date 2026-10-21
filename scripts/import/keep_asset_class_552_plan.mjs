// What keeping the catalog's class judges before the field goes (#552), apart from the base: the
// field as #507 made it, what refers to it, the ledger a run writes and whether one already holds
// what the base holds. `keep_asset_class_552.mjs` reads the base and writes the ledger; this
// module decides, and `offline/asset-class-552.mjs` holds it on bases of that check's making.
//
// THE CLASS IS NAMED HERE AND NOWHERE ELSE IN THE REPOSITORY'S CODE. `lib/assetCategory.js` held
// the field's name and its two values from #507 until #552, when nothing in the app read the class
// any more; `offline/table-field-names.mjs` retires `Class` under `app/` and `lib/`. What still has
// to name it is this run, which reads it once more on each base; the catalog's check, which counts
// the field a hand step due while it stands; and the earlier catalog scripts, which stop before
// they read a row on either base and keep their own record of the class they wrote through this.
//
// A RUN WRITES NO REQUEST BUT A READ, so the live base is read as the test base is: the schema, and
// every catalog row's id, its name, its path and its class, which is what the hand step takes
// away. The field cannot be deleted through the Metadata API (`docs/notes/airtable-access.md`), so
// the deletion is the office's, in the Airtable UI, once the ledger stands.
//
// PURE: it imports `lib/assetCategory.js` alone, which imports only files whose extension it
// spells, so the offline tier reads it under plain `node`.

import { ASSET_PATH_LEVELS, catalogFieldsOf } from "../../lib/assetCategory.js";

export const SCRIPT = "keep_asset_class_552";

/** The catalog, and the primary each ledger row is named by beside its class. */
export const CATALOG_TABLE = "Asset Categories";
export const NAME_FIELD = "Item Name";

/**
 * `Asset Categories."Class"` as #507 made it on the base the test base was duplicated from, so the
 * same id on both (#534): a single select of `A` and `B`, colors and all, the colors walking
 * Airtable's light palette in declaration order (`create_tools_334.py`'s rule).
 */
export const CLASS_FIELD = Object.freeze({
    id: "fldCwhAW8RSMLAT7R",
    name: "Class",
    type: "singleSelect",
    values: Object.freeze(["A", "B"]),
    colors: Object.freeze(["blueLight2", "cyanLight2"]),
});

/** The hand step that takes the field off a base, once its ledger stands. */
export const DELETE_STEP =
    `In ${CATALOG_TABLE}, open the ${CLASS_FIELD.name} column's menu and choose Delete field — ` +
    `once scripts/import/${SCRIPT}.mjs has written that base's ledger or found it unchanged.`;

/**
 * The class field on a table as the Metadata API returns it, and every reason it is not the one
 * #507 made: `field` is null where the table holds no field by its id or its name, which is the
 * state after the hand step.
 */
export function classFieldOf(table) {
    const fields = table?.fields ?? [];
    const field = fields.find((f) => f.id === CLASS_FIELD.id) ?? fields.find((f) => f.name === CLASS_FIELD.name) ?? null;
    if (!field) return { field: null, problems: [] };
    const problems = [];
    if (field.id !== CLASS_FIELD.id) problems.push(`${field.name} is ${field.id}, not ${CLASS_FIELD.id}, the field #507 made`);
    if (field.name !== CLASS_FIELD.name) problems.push(`${CLASS_FIELD.id} is named ${JSON.stringify(field.name)}, not ${CLASS_FIELD.name}`);
    if (field.type !== CLASS_FIELD.type) problems.push(`${field.name} is a ${field.type}, not a ${CLASS_FIELD.type}`);
    const choices = (field.options?.choices ?? []).map((c) => c.name);
    if (choices.join(" | ") !== CLASS_FIELD.values.join(" | ")) problems.push(`${field.name}'s choices are ${choices.join(" | ") || "none"}, not ${CLASS_FIELD.values.join(" | ")}`);
    return { field, problems };
}

/**
 * Every field of every table whose options name the class's id — a formula, a lookup, a rollup or
 * a count that would lose its source with it. Asked of the whole base, since a lookup can stand on
 * a table the catalog links to. Each is `Table."Field"` and its type.
 */
export function referencesTo(fieldId, tables) {
    const found = [];
    for (const table of tables ?? []) {
        for (const field of table.fields ?? []) {
            if (JSON.stringify(field.options ?? {}).includes(fieldId)) found.push(`${table.name}."${field.name}" (${field.type})`);
        }
    }
    return found;
}

/**
 * The ledger a run writes, line by line: the run — the script, the base by name and never by id
 * (`offline/airtable-base.mjs`), when, the field as the base described it and how many rows hold
 * each value — then a row for every catalog row in the order the base listed them, its id, its
 * name, its path and its class, `null` for none. `records` are REST records read by field name.
 */
export function ledgerLines({ base, at, field, records }) {
    const rows = (records ?? []).map((record) => {
        const path = catalogFieldsOf(record.fields);
        return {
            type: "row",
            id: record.id,
            itemName: record.fields?.[NAME_FIELD] ?? "",
            ...Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, path[level]])),
            value: record.fields?.[CLASS_FIELD.name] ?? null,
        };
    });
    const counts = {};
    for (const row of rows) counts[row.value ?? "none"] = (counts[row.value ?? "none"] ?? 0) + 1;
    const run = {
        type: "run",
        script: SCRIPT,
        base,
        at,
        table: CATALOG_TABLE,
        field: {
            id: field.id,
            name: field.name,
            type: field.type,
            choices: (field.options?.choices ?? []).map(({ name, color }) => ({ name, color })),
            description: field.description ?? "",
        },
        rows: rows.length,
        counts,
    };
    return [run, ...rows];
}

/** A ledger's lines read back, over `\n` or `\r\n`, a blank line skipped. */
export function readLedger(text) {
    return String(text ?? "")
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
}

/**
 * Whether two ledgers hold one state of the base: the same field, as described, and the same rows
 * with the same values in the same order — everything but when each was written.
 */
export function holdsTheSame(a, b) {
    const [runA, ...rowsA] = a ?? [];
    const [runB, ...rowsB] = b ?? [];
    if (runA?.type !== "run" || runB?.type !== "run") return false;
    return JSON.stringify(runA.field) === JSON.stringify(runB.field) && JSON.stringify(rowsA) === JSON.stringify(rowsB);
}

/** A ledger's file name: the script, the base and the moment, `:` and `.` made safe for Windows. */
export const ledgerName = (base, at) => `${SCRIPT}-${base}-${at.replace(/[:.]/g, "-")}.jsonl`;

/** Whether a ledger file is one of this script's on `base`, by its name. */
export const isLedgerOf = (name, base) => name.startsWith(`${SCRIPT}-${base}-`) && name.endsWith(".jsonl");
