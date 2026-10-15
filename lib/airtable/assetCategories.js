import { base, TABLES, findByRecordIds, withKeyLock } from "./client";
import { ASSET_CATEGORY_FIELDS, DISCONTINUED_FIELD, catalogPathKey } from "../assetCategory";

/**
 * The KIND an asset is bought as (#334) — "DeWalt 20V drill", not the drill on the shelf —
 * and since #507 a row of the catalog a registration picks from. The object itself is
 * `Assets`, one row per physical unit.
 *
 * WHY THE KIND AND THE OBJECT ARE TWO TABLES. A company buys six of the same drill and then
 * tracks them one at a time: six labels, six locations, six histories, under one kind.
 * Folding them into one table means either six rows repeating the kind — which is how two
 * spellings of one kind appear — or one row that cannot say where any individual drill is.
 *
 * THE OFFICE KEEPS THE CATALOG, AND THE CATALOG'S PAGE IS THE ONE WRITER IN THE APP (#507,
 * #527). A kind is named by its path — `Level 1` the type, `Level 2` the category, `Level 3`
 * the name, then `Size`, `Maker` and `Part Number`, which a row may leave empty (#514) — and
 * carries a `Class`, and `Discontinued` once the office no longer buys it (#527); `Item Name`
 * is a formula over the last four, and is what every screen calls the kind. Until #507 a kind
 * was a name typed on the registration form, found or created under a lock (`upsertTool`,
 * #338); a registration picks a row, and from #507 to #527 this module only read. The writers
 * below are the catalog's page's (`app/(assets)/asset-catalog/actions.js`), and the office's
 * hand edits in Airtable are the other way a row changes. `lib/assetCategory.js` says which
 * rows a registration may pick, and why the rest are set aside.
 *
 * NO MINTED ID, THE WAY `Vendors` AND `Materials` HAVE NONE. Nothing prints a kind and nobody
 * quotes one; its path is its identity, and one path is one kind by the catalog's own rule,
 * which Airtable cannot enforce — `readCatalog` offers the first row of a path and the
 * creation script reports the second. The minted ID lives one level down, where it is printed
 * onto a sticker.
 */
function recordToAssetCategory(record) {
    return {
        id: record.id,
        // A formula since #507, so the name a screen says is the base's, and the same in the
        // Airtable UI's links as on every page.
        itemName: record.get("Item Name") || "",
        // Reverse-link, core link data with no propagation lag (see
        // client.js:getLinkedRecords), so exposing it costs no extra fetch. It is
        // how many of this kind the company owns, and it is also the id list the
        // assets are read by.
        assets: record.get("Assets") || [],
        // The catalog's path and class (#507, #514), under the names lib/assetCategory.js reads them by.
        level1: record.get(ASSET_CATEGORY_FIELDS.level1) || "",
        level2: record.get(ASSET_CATEGORY_FIELDS.level2) || "",
        level3: record.get(ASSET_CATEGORY_FIELDS.level3) || "",
        size: record.get(ASSET_CATEGORY_FIELDS.size) || "",
        maker: record.get(ASSET_CATEGORY_FIELDS.maker) || "",
        partNumber: record.get(ASSET_CATEGORY_FIELDS.partNumber) || "",
        assetClass: record.get(ASSET_CATEGORY_FIELDS.assetClass) || "",
        // A row the office no longer buys (#527): a registration does not offer it
        // (`readCatalog`), and what stands under it is read as before. An unmarked box reads as
        // no value at all, so `true` alone marks it.
        discontinued: record.get(DISCONTINUED_FIELD) === true,
    };
}

/**
 * Every category, for the list at `/asset-categories` (#339) and since #507 for the catalog
 * a registration picks from and the action that checks its pick.
 *
 * The whole table, `Vendors`-shaped: a company's asset catalog is bounded by what it
 * buys rather than by activity, so this is hundreds of rows and not thousands — one
 * query per 100, two for the 185 rows #517 loaded and one for the 45 #528 left. Each row arrives carrying its `Assets` link
 * array, so finding a category's units costs no query of its own — the same saving
 * `getAllJobs` takes for `Disciplines` and `Deliveries`.
 *
 * NO PER-STATUS ROLLUP ON `Asset Categories`, DELIBERATELY, and the condition for adding one
 * is measurable rather than a matter of taste. #339's list gets its count per
 * status by reading the assets this array names, one batch of 50 at a time,
 * so the page is `4 + ceil(assets on the job / 50)` operations — the session, the job
 * list since #509 and this read's two since #517 — which passes ten at 301 assets on one
 * job, the whole of a list since #520; this said 3 and 351 in the office's scope until the
 * catalog passed a hundred rows, and 2 and 401 before the job list joined. At that point the count moves into a rollup and
 * `hasUninvoicedItems` is the worked example of the move (#244). Five rollups
 * nothing reads today would be five fields to keep in step for nothing.
 */
export async function getAllAssetCategories() {
    const records = await base(TABLES.ASSET_CATEGORIES).select().all();
    return records.map(recordToAssetCategory);
}

/** Many kinds by record id, batched — one query per 50 (#193). */
export async function getAssetCategoriesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.ASSET_CATEGORIES, recordIds)).map(recordToAssetCategory);
}

/**
 * The fields a row is written with (#527): every level and the class, by the names
 * `ASSET_CATEGORY_FIELDS` gives them, and a level left empty written empty — so an edit that
 * clears a maker clears it. `Level 1` and `Class` are selects written with no `typecast`, so a
 * value outside their options fails the write rather than minting a third; the entry has been
 * read by `lib/assetCatalog.js:readCatalogEntry`, which admits neither.
 */
function fieldsOf(entry) {
    return Object.fromEntries(Object.entries(ASSET_CATEGORY_FIELDS).map(([key, name]) => [name, entry[key] ? entry[key] : null]));
}

/** The lock a write to one path takes, so two writes naming one path cannot both find it free. */
const pathLockKey = (entry) => `asset-category::${catalogPathKey(entry)}`;

/**
 * A row added to the catalog (1l, #527), unless another row already names its path.
 *
 * READ, THEN WRITTEN, UNDER THE PATH'S LOCK. One path is one row and Airtable cannot enforce it,
 * so the catalog is read again under a lock keyed by the path (`withKeyLock`), and a row naming
 * it already is handed back as `exists` with nothing written. The lock holds within one process;
 * two invocations each finding the path free is the cross-invocation window
 * `docs/notes/airtable-access.md` names for every such lock, not observed here.
 */
export async function createAssetCategory(entry) {
    return withKeyLock(pathLockKey(entry), async () => {
        const same = (await getAllAssetCategories()).find((row) => catalogPathKey(row) === catalogPathKey(entry));
        if (same) return { exists: same };
        const [record] = await base(TABLES.ASSET_CATEGORIES).create([{ fields: fieldsOf(entry) }]);
        return { created: recordToAssetCategory(record) };
    });
}

/**
 * A row saved over (1l, #527), unless it is gone or another row names the path it would take —
 * `gone` and `exists`, each with nothing written — read under the new path's lock, as an add is.
 * The items under it take its new name with it: `Item Name` is a formula over the row.
 */
export async function updateAssetCategory(categoryRecordId, entry) {
    return withKeyLock(pathLockKey(entry), async () => {
        const rows = await getAllAssetCategories();
        if (!rows.some((row) => row.id === categoryRecordId)) return { gone: true };
        const same = rows.find((row) => row.id !== categoryRecordId && catalogPathKey(row) === catalogPathKey(entry));
        if (same) return { exists: same };
        const [record] = await base(TABLES.ASSET_CATEGORIES).update([{ id: categoryRecordId, fields: fieldsOf(entry) }]);
        return { updated: recordToAssetCategory(record) };
    });
}

/** A row marked discontinued, or the mark cleared (#527) — the one field written. */
export async function setAssetCategoryDiscontinued(categoryRecordId, discontinued) {
    const [record] = await base(TABLES.ASSET_CATEGORIES).update([{ id: categoryRecordId, fields: { [DISCONTINUED_FIELD]: discontinued === true } }]);
    return recordToAssetCategory(record);
}

/**
 * Several rows given one class (1l's `Set class`, #527), ten to a request — Airtable's batch —
 * one request at a time, the first that fails stopping the rest and thrown, so what was set
 * before it stays set and a second press sets what is left (`lib/assetCatalog.js:classChanges`).
 */
export async function setAssetCategoriesClass(categoryRecordIds, assetClass) {
    const updated = [];
    for (let i = 0; i < categoryRecordIds.length; i += 10) {
        const batch = categoryRecordIds.slice(i, i + 10).map((id) => ({ id, fields: { [ASSET_CATEGORY_FIELDS.assetClass]: assetClass } }));
        const records = await base(TABLES.ASSET_CATEGORIES).update([...batch]);
        updated.push(...records.map(recordToAssetCategory));
    }
    return updated;
}

/**
 * A row taken out of the catalog (1l, #527) — only one nothing stands under, read again first:
 * `gone` for a row that is no longer there and `hasItems` for one an item came to stand under,
 * each with nothing written. A registration takes no lock on the row it picks, so one landing
 * between this read and the removal would leave its items pointing at nothing. Nobody has
 * observed it: it takes a registration of the row being removed, in the second between the two.
 */
export async function removeAssetCategory(categoryRecordId) {
    const [row] = await getAssetCategoriesByRecordIds([categoryRecordId]);
    if (!row) return { gone: true };
    if (row.assets.length > 0) return { hasItems: row };
    await base(TABLES.ASSET_CATEGORIES).destroy([categoryRecordId]);
    return { removed: row };
}
