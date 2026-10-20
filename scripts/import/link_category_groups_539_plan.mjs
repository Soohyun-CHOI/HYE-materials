// What linking each catalog row to its category group judges before it writes (#539), apart from
// the base: the schema's state, the link each row takes, and what a ledger puts back.
// `link_category_groups_539.mjs` reads the base and writes; this module decides, and
// `offline/category-group-link-539.mjs` holds it on bases of that check's making.
//
// WHICH GROUP A ROW TAKES IS `lib/assetCategory.js:categoryGroupOf`, the catalog page's own
// reading: the first standing group whose type and category are the row's under `textMatchKey`.
// Every row is asked, a discontinued or set-aside one included, since a row filed under no group
// would read no type and no category once `Level 1` and `Level 2` read through the link.
//
// A ROW THE RUN CANNOT ACCOUNT FOR REFUSES THE WHOLE RUN. A pair no group holds, a link to a
// group other than its pair's, or a link to more than one: each is a fact about the base the
// office has to settle — a group to add, a row to re-file, a hand edit to undo — and linking the
// rest would leave the base half in each shape. The catalog's loads refused whole for the same
// reason (#517, #528). A row whose text spells its category otherwise than its group, in
// case or spacing, is linked and said: once the levels read through the link it reads the
// group's spelling.
//
// WHILE `Level 1` AND `Level 2` ARE TYPED THE LINK IS FILLED FROM THEM; ONCE THEY ARE LOOKUPS
// THROUGH IT THERE IS NOTHING TO FILL. A field's type is not PATCHable, so that conversion is a
// hand step in the Airtable UI, made after every row is linked; `schemaState` tells the two
// apart off the Metadata API, and a revert refuses on the second, since emptying a link then
// empties the levels it reads.
//
// PURE: it imports `lib/assetCategory.js` alone, which imports only files whose extension it
// spells, so the offline tier reads it under plain `node`.

import { ASSET_CATEGORY_FIELDS, CATEGORY_GROUP_FIELD, categoryGroupOf, pathOf } from "../../lib/assetCategory.js";

export const SCRIPT = "link_category_groups_539";

/** The catalog and the table its rows are filed under, by the names the base gives them. */
export const CATALOG_TABLE = "Asset Categories";
export const GROUPS_TABLE = "Asset Category Groups";

/** The primary every catalog row is named by, which the ledger keeps beside each link. */
export const NAME_FIELD = "Item Name";

/**
 * The name Airtable gives the link's far side — the table it comes from — kept, so the groups'
 * table reads `Asset Categories` as `Asset Categories` reads `Assets`.
 */
export const INVERSE_NAME = CATALOG_TABLE;

/** The two levels a group is, by their field names on the catalog — the ones the link replaces as typed text. */
export const GROUP_LEVEL_FIELDS = Object.freeze([ASSET_CATEGORY_FIELDS.level1, ASSET_CATEGORY_FIELDS.level2]);

/** How many rows one request writes: Airtable's batch. */
export const ROWS_PER_REQUEST = 10;

/**
 * The link's words and its far side's, written by this run and held by the catalog's check
 * (`classify_asset_categories_514.mjs`), which imports them so the two say one thing.
 */
export const LINK_DESCRIPTION =
    "The category group this item is filed under (#539): its type and its category, a row of Asset Category " +
    "Groups. Pick one group: Level 1 and Level 2 look their values up through this field, so a category renamed " +
    "in Asset Category Groups is renamed on every item filed under it. The app's Catalog page sets it when an " +
    "item is added or edited; scripts/import/link_category_groups_539.mjs filled it from the typed Level 1 and Level 2.";

export const INVERSE_DESCRIPTION =
    "The items of Asset Categories filed under this group (#539), through their Category Group link. A group with " +
    "items here is renamed, never deleted: deleting it empties the link on every item filed under it.";

/** The hand step the Metadata API leaves: a link to one record cannot be set through it (docs/notes/airtable-access.md). */
export const SINGLE_LINK_STEP =
    `In ${CATALOG_TABLE}, open ${CATEGORY_GROUP_FIELD}'s settings, turn off "Allow linking to multiple records", and save.`;

/**
 * Where the schema stands (#539): `link` the link field or null, `inverse` its far side or null,
 * `levels` — `typed` while `Level 1` is a select and `Level 2` text, `looked up` once both are
 * lookups through the link — and `problems`, each a reason the run cannot go on. `catalog` and
 * `groups` are the two tables as the Metadata API returns them.
 */
export function schemaState(catalog, groups) {
    const problems = [];
    if (!catalog) problems.push(`no table named ${CATALOG_TABLE}`);
    if (!groups) problems.push(`no table named ${GROUPS_TABLE}`);
    if (problems.length > 0) return { link: null, inverse: null, levels: null, problems };

    const field = (table, name) => table.fields.find((f) => f.name === name) ?? null;
    const link = field(catalog, CATEGORY_GROUP_FIELD);
    if (link && link.type !== "multipleRecordLinks") problems.push(`${CATALOG_TABLE}.${CATEGORY_GROUP_FIELD} is a ${link.type}, not a link`);
    else if (link && link.options?.linkedTableId !== groups.id) problems.push(`${CATALOG_TABLE}.${CATEGORY_GROUP_FIELD} links to ${link.options?.linkedTableId}, not ${GROUPS_TABLE}`);
    const inverse = link?.options?.inverseLinkFieldId ? (groups.fields.find((f) => f.id === link.options.inverseLinkFieldId) ?? null) : null;

    const [type, category] = GROUP_LEVEL_FIELDS.map((name) => field(catalog, name));
    const lookupThrough = (level, name) =>
        level?.type === "multipleLookupValues" &&
        link !== null &&
        level.options?.recordLinkFieldId === link.id &&
        level.options?.fieldIdInLinkedTable === field(groups, name)?.id;
    let levels = null;
    if (type?.type === "singleSelect" && category?.type === "singleLineText") levels = "typed";
    else if (GROUP_LEVEL_FIELDS.every((name, i) => lookupThrough([type, category][i], name))) levels = "looked up";
    else problems.push(`${GROUP_LEVEL_FIELDS.join(" and ")} are ${type?.type ?? "missing"} and ${category?.type ?? "missing"} — neither typed nor lookups through ${CATEGORY_GROUP_FIELD}`);
    return { link, inverse, levels, problems };
}

/** A REST value as text: a lookup arrives as an array, a typed level as a string. */
const textOf = (value) => (Array.isArray(value) ? value.join(", ") : String(value ?? ""));

/** A catalog row as this run reads it off a REST record: its name, its two levels and its link. */
export function catalogRowOf(record) {
    const fields = record?.fields ?? {};
    return {
        id: record?.id,
        itemName: textOf(fields[NAME_FIELD]),
        level1: textOf(fields[ASSET_CATEGORY_FIELDS.level1]),
        level2: textOf(fields[ASSET_CATEGORY_FIELDS.level2]),
        link: Array.isArray(fields[CATEGORY_GROUP_FIELD]) ? [...fields[CATEGORY_GROUP_FIELD]] : [],
    };
}

/** A group as this run reads it off a REST record: its two levels. */
export function groupRowOf(record) {
    const fields = record?.fields ?? {};
    return { id: record?.id, level1: textOf(fields[ASSET_CATEGORY_FIELDS.level1]), level2: textOf(fields[ASSET_CATEGORY_FIELDS.level2]) };
}

/** A row's or a group's type and category as a path says them. */
export const pairOf = (row) => pathOf({ level1: row.level1, level2: row.level2 }) || "(neither)";

/**
 * Each row against the groups, while the levels are typed (#539): `writes`, the rows with no link
 * and the group their pair names; `linked`, those already linked to it; `respelled`, the rows of
 * either whose text spells the pair otherwise than their group; and `problems`, each row the run
 * cannot account for with why — which refuse the run.
 */
export function planLinks(rows, groups) {
    const writes = [];
    const linked = [];
    const respelled = [];
    const problems = [];
    for (const row of rows || []) {
        const group = categoryGroupOf(row, groups);
        if (row.link.length > 1) {
            problems.push({ row, why: `links ${row.link.length} groups, ${row.link.join(", ")}` });
            continue;
        }
        if (!group) {
            problems.push({ row, why: `no group holds ${pairOf(row)}` });
            continue;
        }
        if (row.link.length === 1 && row.link[0] !== group.id) {
            problems.push({ row, why: `links ${row.link[0]}, where its pair ${pairOf(row)} is ${group.id}` });
            continue;
        }
        if (group.level1 !== row.level1 || group.level2 !== row.level2) respelled.push({ row, group });
        if (row.link.length === 1) linked.push({ row, group });
        else writes.push({ row, group });
    }
    return { writes, linked, respelled, problems };
}

/**
 * Each row once the levels are lookups through the link (#539): `linked`, those with one group,
 * and `problems`, those with none or several — the state the conversion was to leave none in.
 */
export function readLinks(rows) {
    const linked = [];
    const problems = [];
    for (const row of rows || []) {
        if (row.link.length === 1) linked.push(row);
        else problems.push({ row, why: row.link.length === 0 ? "links no group, so it reads no type and no category" : `links ${row.link.length} groups, ${row.link.join(", ")}` });
    }
    return { linked, problems };
}

/** The ledger line a link is written under, before its request is sent. */
export function linkLine(row, group) {
    return {
        type: "link",
        id: row.id,
        itemName: row.itemName,
        level1: row.level1,
        level2: row.level2,
        group: { id: group.id, level1: group.level1, level2: group.level2 },
        before: [...row.link],
        after: [group.id],
    };
}

/** A ledger's lines, from its text: one JSON object a line, blank lines skipped. */
export function readLedger(text) {
    return String(text ?? "")
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "")
        .map((line) => JSON.parse(line));
}

const sameLink = (a, b) => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * What putting a ledger back writes (#539): `writes`, each row whose link is still what the ledger
 * wrote, to go back to what it held before; `back`, those holding that already; and `problems`,
 * each row gone or linked otherwise since — which refuse the revert. `rows` are the catalog as
 * read now, by `catalogRowOf`; a line the ledger names twice is put back once, to its first before.
 */
export function planRevert(lines, rows) {
    const byId = new Map((rows || []).map((row) => [row.id, row]));
    const seen = new Set();
    const writes = [];
    const back = [];
    const problems = [];
    for (const line of (lines || []).filter((each) => each.type === "link")) {
        if (seen.has(line.id)) continue;
        seen.add(line.id);
        const row = byId.get(line.id);
        if (!row) problems.push({ line, why: "is no longer on the base" });
        else if (sameLink(row.link, line.after)) writes.push({ row, line });
        else if (sameLink(row.link, line.before)) back.push({ row, line });
        else problems.push({ line, why: `links ${row.link.join(", ") || "nothing"}, neither what the ledger wrote nor what it held` });
    }
    return { writes, back, problems };
}

/** The ledger line a revert writes before its request, the link going back. */
export function unlinkLine(row, line) {
    return { type: "unlink", id: row.id, itemName: row.itemName, before: [...row.link], after: [...line.before] };
}

/**
 * Whether the catalog files its rows by `Category Group` (#539), off the Metadata API's tables —
 * the mark the catalog's earlier loads stop on (#514's and #528's shape for a script whose spec
 * the base has moved past): each writes `Level 1` and `Level 2` as typed text, which a lookup
 * through the link cannot take, and reads them as text.
 */
export function filedByLink(tables) {
    return (tables ?? []).some((table) => table?.name === CATALOG_TABLE && (table.fields ?? []).some((field) => field.name === CATEGORY_GROUP_FIELD));
}

/** What such a script says as it stops. */
export const FILED_BY_LINK_REFUSAL =
    `${CATALOG_TABLE} files each row under its group by ${CATEGORY_GROUP_FIELD} since #539, and its ${GROUP_LEVEL_FIELDS.join(" and ")} ` +
    "are lookups through it: this script reads and writes them as typed text, so it stops before it reads a row.";

/** A list cut into requests of `size`. */
export function inChunks(items, size = ROWS_PER_REQUEST) {
    const out = [];
    for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
    return out;
}

