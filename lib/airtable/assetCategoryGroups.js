import { base, TABLES, withKeyLock } from "./client";
import { ASSET_CATEGORY_FIELDS, ASSET_GROUP_LEVELS, categoryGroupKey, readCategoryGroups } from "../assetCategory";

/**
 * The types and categories the catalog files under (#528): one row a pair, in the catalog's own
 * two fields, `Level 1` the type and `Level 2` the category — the same two levels of the same
 * path, so the same names (`docs/notes/naming.md`), read through `ASSET_CATEGORY_FIELDS` rather
 * than spelled again. A category stands here before anything is filed under it, which is why
 * the office keeps it apart from the items in `Asset Categories`.
 *
 * A CATALOG ROW LINKS TO ITS GROUP (#539), `Category Group`, and reads these two values through
 * it, so a group renamed here is renamed on every row filed under it. What the office types is
 * matched to a group by the same two values, compared under `textMatchKey`, and
 * `lib/assetCategory.js:readCategoryGroups` says which rows stand as a group — a row typed by hand
 * can arrive without a type, with a placeholder or twice, as the catalog's can — so a reader hands
 * it the rows as read. The link's far side, `Asset Categories`, this reader does not map: nothing
 * in the app reads it.
 *
 * READ AND WRITTEN BY THE CATALOG'S OWN PAGE (#527), which offers each category to its `Category`
 * filter whether or not anything is filed under it yet, and adds a group two ways — a new category
 * typed into an item's dialog, before the item, and `New category` alone. Nothing in the app
 * renames or removes a group; the office does that in Airtable. Until #527 only
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

/**
 * A group added (1l, #527), unless the type holds that category already — handed back as `exists`
 * with nothing written. Read again under a lock keyed by the pair, as a catalog row is under its
 * path (`createAssetCategory`), so two presses naming one new category in this process add one
 * row; the group is the pair, and `readCategoryGroups` is what decides that one stands.
 */
export async function createAssetCategoryGroup(group) {
    return withKeyLock(`asset-category-group::${categoryGroupKey(group)}`, async () => {
        const standing = readCategoryGroups(await getAllAssetCategoryGroups()).offered.find((each) => categoryGroupKey(each) === categoryGroupKey(group));
        if (standing) return { exists: standing };
        const [record] = await base(TABLES.ASSET_CATEGORY_GROUPS).create([
            { fields: Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [ASSET_CATEGORY_FIELDS[level], group[level]])) },
        ]);
        return { created: recordToAssetCategoryGroup(record) };
    });
}
