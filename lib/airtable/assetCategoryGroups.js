import { base, TABLES } from "./client";
import { ASSET_CATEGORY_FIELDS, ASSET_GROUP_LEVELS } from "../assetCategory";

/**
 * The types and categories the catalog files under (#528): one row a pair, in the catalog's own
 * two fields, `Level 1` the type and `Level 2` the category — the same two levels of the same
 * path, so the same names (`docs/notes/naming.md`), read through `ASSET_CATEGORY_FIELDS` rather
 * than spelled again. A category stands here before anything is filed under it, which is why
 * the office keeps it apart from the items in `Asset Categories`.
 *
 * NO LINK JOINS THE TWO TABLES. A catalog row names its group by the same two values, compared
 * under `textMatchKey`, and `lib/assetCategory.js:readCategoryGroups` says which rows stand as a
 * group — a row typed by hand can arrive without a type, with a placeholder or twice, as the
 * catalog's can — so a reader hands it the rows as read.
 *
 * FIRST READ BY THE CATALOG'S OWN PAGE (#527), which offers each category to its `Category`
 * filter whether or not anything is filed under it yet; until then only
 * `scripts/import/classify_asset_categories_514.mjs` read the table, for the catalog's check.
 */
function recordToAssetCategoryGroup(record) {
    return {
        id: record.id,
        ...Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [level, record.get(ASSET_CATEGORY_FIELDS[level]) || ""])),
    };
}

/**
 * Every group, in the order the base holds them — `Vendors`-shaped, as the catalog is: the list
 * is bounded by the fields of work the company keeps, tens of rows and one list request.
 */
export async function getAllAssetCategoryGroups() {
    const records = await base(TABLES.ASSET_CATEGORY_GROUPS).select().all();
    return records.map(recordToAssetCategoryGroup);
}
