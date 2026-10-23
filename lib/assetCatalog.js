// The catalog the office keeps (#527) — `/asset-catalog`, every row of `Asset Categories` with its
// path, whether it is discontinued and how many items stand under it, narrowed by the
// category list's band and a toggle of its own. Admin-only: the office keeps the catalog, as it
// keeps invoicing, and a site files items under what the office keeps (`docs/notes/tools.md`).
//
// WHAT A ROW IS. A row of the table as it stands, whether a registration may pick it or not: the
// page is where the office finds a row it typed by hand and puts it right, so a row
// `lib/assetCategory.js:readCatalog` sets aside is listed like any other, and a discontinued one
// is marked. Its name is the path's third level, as 1l draws it, with the size, the maker and the
// part number in columns of their own; the whole name, `Item Name`, rides with it for the search
// and for assistive tech. Its items are counted off the `Assets` link array the read already
// holds, every status counted, since a retired item still stands under its row.
//
// WHAT THE BAND IS, AND WHY IT IS THE CATEGORY LIST'S. The search and the `Type` and `Category`
// chips are 1a's, over rows of the same shape, so `lib/assetListView.js:
// filterAssetCategoryRows` is the one reading of them: the same search through
// `lib/searchTokens.js`, the same counts, the same `N of M`. What the catalog adds is offered
// values no row holds — every group's category, and the whole type vocabulary — and
// the toggle, which narrows to the discontinued rows before anything else is asked, so every
// count the chips give is a count of those. **And the name typed in full first** (`nameRank`, #517's
// rule): 1l ranks its rows as 1b ranks the names holding every word typed (#547), and the
// catalog's names repeat — three rows are `Battery` — where the category list's do not.
//
// THE ROWS STAND BY NAME OR BY WHEN EACH WAS LAST EDITED (#540), as the category list's stand by name
// or by their items' latest event: the address's `sort` under `LIST_SORTS.kinds`, by name where the
// page starts. A row's moment is `Asset Categories."Edited At"`, which Airtable keeps over the six
// fields this page writes and nothing else, so an item registered under a row leaves it where it
// is (`lib/assetCategory.js:EDITED_AT_FIELD`). A search ranks the rows as before and the order holds
// within each rank, so the name typed in full still comes first.
//
// WHAT AN ADD OR AN EDIT MAY SAVE IS ONE READING, ASKED TWICE. `readCatalogEntry` refuses in the
// dialog before anything is sent and again in the action against the catalog and the groups as
// the base holds them then, so the two cannot refuse differently: a type from its two values, a
// category and a name with no placeholder, an empty size, maker or part number
// where one does not apply — `N/A` and its kind refused, `lib/assetCategory.js:isPlaceholder`'s
// rule — and no other row on the same six-level path, a discontinued one included, since a
// discontinued row keeps its path (`readCatalog`). **A category or a name the type already holds
// under `textMatchKey` is saved as it is already spelled**, so the field's `New` and what is
// saved agree: a category the field does not mark new is that group, not a second spelling of it.
// **One it does not hold is saved with each word's first letter in capitals** (#538,
// `lib/itemNaming.js:capitalizeWords`), the rest as typed; the size, the maker and the part
// number keep what was typed. What a save spells is shown before it: the Category field takes
// that spelling once focus leaves it (`savedCategory`), and `Shows as` the name's (`shownName`).
//
// A CATEGORY IS A ROW OF `Asset Category Groups`, AND THE PAGE ADDS ONE TWO WAYS. A new category
// typed into an item's dialog is added with the item, the group first (`readCatalogEntry`'s
// `newCategory`); `New category` adds the group alone (`readCategoryEntry`), refusing one the type
// holds already. A row saved links the group its type and category name (`group`, #539), whose
// two values its own `Level 1` and `Level 2` then look up. Nothing here renames or removes a
// group: that stays the office's to do in Airtable, where a rename reaches every row linked to it.
//
// PURE AND OFFLINE-SAFE, importing four modules with the extension spelled out, so the page's
// list and its dialogs — `"use client"` files — and `offline/asset-catalog.mjs` can all read it.

import {
    ASSET_CATEGORY_COPY,
    ASSET_PATH_LEVELS,
    ASSET_TYPE_VALUES,
    catalogPathKey,
    categoryGroupKey,
    categoryGroupOf,
    compareCatalogText,
    composeItemName,
    isPlaceholder,
    nameRank,
    readCategoryGroups,
} from "./assetCategory.js";
import { ASSET_LIST_COPY, filterAssetCategoryRows, newestMomentFirst } from "./assetListView.js";
import { ASSET_SORT, LIST_SORTS, readSort } from "./assetRoutes.js";
import { ASSET_COPY } from "./assetView.js";
import { capitalizeWords, normalizeItemText, textMatchKey } from "./itemNaming.js";

/**
 * Every row of the catalog as the page lists it (1l): what each column says, whether it is
 * discontinued, how many items stand under it and when it was last edited (#540) — and none of the
 * items, which no screen here reads and the page would otherwise hand the browser. In 1l's order:
 * by name, then size, maker and part number, each as `compareCatalogText` orders a word, so
 * `Flexible Ratchet 9 mm` comes before `10 mm`.
 */
export function catalogRows(categories) {
    return (Array.isArray(categories) ? categories : [])
        .map((category) => ({
            id: category.id,
            itemName: category.itemName ?? "",
            ...Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, category[level] ?? ""])),
            discontinued: category.discontinued === true,
            assetCount: (category.assets ?? []).length,
            editedAt: category.editedAt ?? null,
        }))
        .sort(
            (a, b) =>
                compareCatalogText(a.level3, b.level3) ||
                compareCatalogText(a.size, b.size) ||
                compareCatalogText(a.maker, b.maker) ||
                compareCatalogText(a.partNumber, b.partNumber)
        );
}

/**
 * What the band offers beyond the values its rows hold (#527): both types, whatever the rows
 * hold, as 1l offers them, and every category that stands as a group under its
 * type — so a category the office keeps before filing anything under it is one to narrow to,
 * counting none. `groups` are `Asset Category Groups` as read; one that does not stand
 * (`readCategoryGroups`) offers nothing.
 */
export function catalogOffers(groups) {
    return [
        ...ASSET_TYPE_VALUES.map((level1) => ({ level1 })),
        ...readCategoryGroups(groups).offered.map(({ level1, level2 }) => ({ level1, level2 })),
    ];
}

/**
 * The catalog's rows under what its band holds (1l, #527) — 1a's reading over the rows the toggle
 * leaves, with the offers above, in the order asked (#540), and the rows ranked by name for what is
 * typed. `filters` is `readAssetListFilters`' answer and `discontinued`, true while the toggle
 * narrows to the discontinued rows. `total` is every row, the `M` the head's `N of M` says, and
 * `narrowed` counts the toggle as a narrowing. `held.sort` is the order the next write carries.
 *
 * THE ORDER IS ASKED BEFORE THE RANK, SO IT HOLDS WITHIN ONE (#540): most recently edited first, a
 * tie — every row one write touched, as #539's link touched all of them in one run — keeping the
 * order by name, a row with no moment reading as the newest (`lib/assetListView.js:newestMomentFirst`).
 */
export function filterCatalogRows(rows, groups, filters = {}) {
    const all = Array.isArray(rows) ? rows : [];
    const discontinued = filters.discontinued === true;
    const reading = filterAssetCategoryRows(discontinued ? all.filter((row) => row.discontinued) : all, filters, { offers: catalogOffers(groups) });
    const sort = readSort(filters.sort, LIST_SORTS.kinds);
    const ordered = sort === ASSET_SORT.UPDATED ? [...reading.rows].sort(newestMomentFirst((row) => row.editedAt ?? null)) : reading.rows;
    const typed = filters.q ?? "";
    return {
        ...reading,
        rows: reading.searching ? [...ordered].sort((a, b) => nameRank(a.level3, typed) - nameRank(b.level3, typed)) : ordered,
        held: { ...reading.held, discontinued, sort },
        narrowed: reading.narrowed || discontinued,
        total: all.length,
    };
}

/** The fields an add or an edit takes, in the dialog's order: the path, the type first. */
export const CATALOG_ENTRY_FIELDS = Object.freeze(["level1", "level2", "level3", "size", "maker", "partNumber"]);

/** The levels an entry may leave empty — those a row leaves empty where they do not apply (#514). */
const OPTIONAL_LEVELS = ["size", "maker", "partNumber"];

/** An entry as typed, each field's text normalized, as it would be saved. */
function normalized(raw = {}) {
    return Object.fromEntries(CATALOG_ENTRY_FIELDS.map((key) => [key, normalizeItemText(raw[key])]));
}

/** Whether a category or a name is one: something typed, and not a placeholder for nothing. */
const isNamed = (value) => textMatchKey(value) !== "" && !isPlaceholder(value);

/**
 * How a save spells an entry's category and name (#538), each from what is typed, normalized:
 * as the catalog already spells it when it holds it under `textMatchKey` — the type's standing
 * group for a category, another row under the type and category for a name — and otherwise with
 * each word's first letter in capitals and the rest as typed (`capitalizeWords`). `own` is the
 * row an edit saves over: a value left as that row spells it is saved so, whatever its case,
 * so an edit that does not touch a name the office typed by hand does not rename its items.
 */
function categorySpelling(entry, groups, own) {
    const group = categoryGroupOf(entry, groups);
    if (group) return normalizeItemText(group.level2);
    if (own && normalizeItemText(own.level2) === entry.level2) return entry.level2;
    return capitalizeWords(entry.level2);
}

function nameSpelling(entry, rows, own) {
    const named = rows.find(
        (row) => row.id !== own?.id && categoryGroupKey(row) === categoryGroupKey(entry) && textMatchKey(row.level3) === textMatchKey(entry.level3)
    );
    if (named) return normalizeItemText(named.level3);
    if (own && normalizeItemText(own.level3) === entry.level3) return entry.level3;
    return capitalizeWords(entry.level3);
}

/** The row an edit saves over, or none. */
const ownRow = (rows, editing) => (editing ? (Array.isArray(rows) ? rows : []).find((row) => row.id === editing) ?? null : null);

/**
 * What the Category field holds once focus leaves it (#538): the category as a save would spell
 * it, so the field shows what is saved — in `Add to catalog`, an edit and `New category` alike.
 * Something that is no category, nothing or a placeholder, is left as typed, for the refusal to
 * name; `New category` refuses one the type holds, and the field shows it in that spelling.
 */
export function savedCategory(raw = {}, groups = [], { rows = [], editing = null } = {}) {
    const entry = normalized(raw);
    if (!isNamed(entry.level2)) return entry.level2;
    return categorySpelling(entry, groups, ownRow(rows, editing));
}

/**
 * What an add or an edit may save, or why not (1l, #527) — asked by the dialog before anything is
 * sent and by the action against the catalog and the groups as the base holds them, so the two
 * cannot refuse differently.
 *
 * `raw` is the form's text, keyed by `CATALOG_ENTRY_FIELDS`; `rows` every catalog row; `groups`
 * every row of `Asset Category Groups`; `editing` the id of the row an edit saves over, which is
 * no other row. Every refusal about one field is keyed by it and said under it, all at once (0l).
 * What may be saved comes back as `entry`, each field normalized and the category and the name
 * spelled as the type already spells them — or, new, with each word's first letter in capitals
 * (#538, `categorySpelling`) — `newCategory`, whether saving it adds the group, and `group`, the
 * standing group the row is to link (#539), or null while that group is still to add.
 *
 * THE PATH IS THE CATALOG'S KEY, ALL SIX LEVELS UNDER `textMatchKey` (`catalogPathKey`), checked
 * against every other row, a discontinued or set-aside one included: one path is one row, and a
 * discontinued kind comes back by restoring it. 1l says it on the name, naming the category the
 * other row stands in.
 */
export function readCatalogEntry(raw = {}, { rows = [], groups = [], editing = null } = {}) {
    const entry = normalized(raw);
    const fields = {};
    if (!ASSET_TYPE_VALUES.includes(entry.level1)) fields.level1 = ASSET_CATALOG_COPY.refusal.level1;
    if (!isNamed(entry.level2)) fields.level2 = ASSET_CATALOG_COPY.refusal.level2;
    if (!isNamed(entry.level3)) fields.level3 = ASSET_CATALOG_COPY.refusal.level3;
    for (const level of OPTIONAL_LEVELS) if (isPlaceholder(entry[level])) fields[level] = ASSET_CATALOG_COPY.refusal.leaveEmpty;
    if (Object.keys(fields).length > 0) return { fields };

    const group = categoryGroupOf(entry, groups);
    const all = Array.isArray(rows) ? rows : [];
    const own = ownRow(all, editing);
    entry.level2 = categorySpelling(entry, groups, own);
    entry.level3 = nameSpelling(entry, all, own);
    const others = all.filter((row) => row.id !== editing);
    const same = others.find((row) => catalogPathKey(row) === catalogPathKey(entry));
    if (same) return { fields: { level3: ASSET_CATALOG_COPY.refusal.exists(normalizeItemText(same.level2)) } };
    return { entry, newCategory: group === null, group };
}

/**
 * What `New category` may save, or why not (1l, #527): a type and a category naming no group the
 * type holds under `textMatchKey`. The group comes back as `group`, its category with each word's
 * first letter in capitals (#538); nothing else is written.
 */
export function readCategoryEntry(raw = {}, groups = []) {
    const entry = { level1: normalizeItemText(raw.level1), level2: normalizeItemText(raw.level2) };
    const fields = {};
    if (!ASSET_TYPE_VALUES.includes(entry.level1)) fields.level1 = ASSET_CATALOG_COPY.refusal.level1;
    if (!isNamed(entry.level2)) fields.level2 = ASSET_CATALOG_COPY.refusal.level2;
    else if (fields.level1 === undefined && categoryGroupOf(entry, groups)) fields.level2 = ASSET_CATALOG_COPY.refusal.categoryExists;
    if (Object.keys(fields).length > 0) return { fields };
    return { group: { ...entry, level2: capitalizeWords(entry.level2) } };
}

/**
 * Whether the category typed is a new one for the type chosen, which the field marks `New`
 * (1l): something typed that is no placeholder, under no group the type holds.
 */
export function isNewCategory(raw = {}, groups = []) {
    const entry = normalized(raw);
    return ASSET_TYPE_VALUES.includes(entry.level1) && isNamed(entry.level2) && categoryGroupOf(entry, groups) === null;
}

/**
 * Whether the name typed is a new one under the type and category chosen (1l): something typed
 * that no row under them is called — the row an edit saves over among them, as 1l asks it, so an
 * edit that keeps a name its row alone carries does not mark it new.
 */
export function isNewName(raw = {}, rows = []) {
    const entry = normalized(raw);
    if (!isNamed(entry.level3)) return false;
    return !(Array.isArray(rows) ? rows : []).some(
        (row) => categoryGroupKey(row) === categoryGroupKey(entry) && textMatchKey(row.level3) === textMatchKey(entry.level3)
    );
}

/** At most this many suggestions under a field (1l). */
const SUGGESTED = 6;

/** The words of `values`, each once, in name order. */
function distinct(values) {
    return [...new Set(values.map(normalizeItemText).filter(Boolean))].sort(compareCatalogText);
}

/** The words of `values` holding what is typed, the name typed in full first, without the one typed exactly — 1l's list under a field. */
function suggested(values, typed) {
    const want = textMatchKey(typed);
    return distinct(values)
        .filter((value) => textMatchKey(value).includes(want) && textMatchKey(value) !== want)
        .sort((a, b) => nameRank(a, typed) - nameRank(b, typed))
        .slice(0, SUGGESTED);
}

/**
 * Every word of `values` once, in name order, and the one the field holds marked `chosen` — the
 * whole list a field opens on, before anything is typed (#555). The mark is `textMatchKey`'s, so
 * a value held in another case or spacing marks the word the catalog spells; nothing held marks
 * nothing.
 */
function every(values, held) {
    const key = textMatchKey(held);
    return distinct(values).map((label) => ({ label, chosen: key !== "" && textMatchKey(label) === key }));
}

/**
 * The categories the Category field offers (#527): the standing groups of the type chosen alone —
 * a category of the other type of the same name is a new one here.
 */
function offeredCategories(raw, groups) {
    const level1 = normalizeItemText(raw.level1);
    return readCategoryGroups(groups)
        .offered.filter((group) => normalizeItemText(group.level1) === level1)
        .map((group) => group.level2);
}

/** The names the Name field offers (1l): those of the rows under the type and the category chosen. */
function offeredNames(raw, rows) {
    const entry = normalized(raw);
    return (Array.isArray(rows) ? rows : []).filter((row) => categoryGroupKey(row) === categoryGroupKey(entry)).map((row) => row.level3);
}

/** The categories the Category field suggests (#527): those it offers holding what is typed. */
export function categorySuggestions(raw = {}, groups = []) {
    return suggested(offeredCategories(raw, groups), raw.level2);
}

/** Every category the Category field offers, the one it holds marked — what its list opens on (#555). */
export function everyCategory(raw = {}, groups = []) {
    return every(offeredCategories(raw, groups), raw.level2);
}

/** The names the Name field suggests (1l): those it offers holding what is typed. */
export function nameSuggestions(raw = {}, rows = []) {
    return suggested(offeredNames(raw, rows), normalizeItemText(raw.level3));
}

/** Every name the Name field offers, the one it holds marked — what its list opens on (#555). */
export function everyName(raw = {}, rows = []) {
    return every(offeredNames(raw, rows), raw.level3);
}

/**
 * The name the dialog shows the entry by (1l's `Shows as`) — the base's rule, `composeItemName` —
 * or nothing while no name is typed. The name in it is spelled as a save spells it (#538,
 * `nameSpelling`), so `Shows as` is what is saved: `rows` are the catalog's and `editing` the row
 * an edit saves over.
 */
export function shownName(raw = {}, { rows = [], editing = null } = {}) {
    const entry = normalized(raw);
    if (!entry.level3) return "";
    const level3 = isNamed(entry.level3) ? nameSpelling(entry, Array.isArray(rows) ? rows : [], ownRow(rows, editing)) : entry.level3;
    return composeItemName({ ...entry, level3 });
}

/**
 * Whether saving `raw` over `row` gives the items standing under it a new name (1l): their name is
 * the row's `Item Name`, a formula over its name, size, maker and part number, so an edit moving any
 * of those renames every item under it, which the dialog says before it is saved. `rows` is what
 * `shownName` spells the name from.
 */
export function renamesItems(row, raw = {}, { rows = [] } = {}) {
    return (row?.assetCount ?? 0) > 0 && composeItemName(row) !== shownName(raw, { rows, editing: row?.id ?? null });
}

/** Every word the catalog's page says (1l) — the band's and the pager's are the category list's, read there. */
export const ASSET_CATALOG_COPY = {
    // The page's title, its heading and the 1a opener that leads to it — one word for one place.
    heading: "Catalog",
    // Its search, which says what it searches (0h), and its ×.
    searchLabel: "Search catalog",
    clearSearch: ASSET_CATEGORY_COPY.clearSearch,
    // The columns, in 1l's order: the name — `Name`, the category list's own head over the name's
    // third level — then each level the catalog's word for it, and the items counted.
    columns: {
        level3: ASSET_LIST_COPY.nameLabel,
        size: ASSET_CATEGORY_COPY.levelLabel.size,
        maker: ASSET_CATEGORY_COPY.levelLabel.maker,
        partNumber: ASSET_CATEGORY_COPY.levelLabel.partNumber,
        level2: ASSET_CATEGORY_COPY.levelLabel.level2,
        level1: ASSET_CATEGORY_COPY.levelLabel.level1,
        assetCount: "Items",
    },
    // The mark after a discontinued row's name, in Ink 3, and the toggle that narrows to them —
    // the field's own word, `Asset Categories."Discontinued"` (#527).
    discontinued: "Discontinued",
    discontinuedOnly: "Discontinued only",
    clearDiscontinued: "Clear discontinued filter",
    // What a band that emptied the list says (1l), with the one control that clears everything.
    noneMatch: "Nothing in the catalog matches",
    clearAll: ASSET_LIST_COPY.clearAll,
    // What a reader who is not the office reads in the page's place — the shape the Invoices
    // file's 1g draws for `/invoices/new`, in this page's words, which no drawing gives. It is
    // also what an action says to a press from a page drawn while the reader was the office.
    noAccess: "You don't have access to this page. Keeping the catalog is for Admins.",

    // THE HEAD'S TWO OPENERS AND THE DIALOGS THEY OPEN (1l). `Add to catalog` opens on an empty
    // entry and commits with its own word; a row's name opens `Edit item` over the row; `New
    // category` adds a group alone. `Create category` is 1l's word for that commitment, the one
    // place this axis says `create` beside `add` (`offline/asset-screen-words.mjs` names it).
    addTitle: "Add to catalog",
    editTitle: "Edit item",
    newCategoryTitle: "New category",
    submit: { add: "Add to catalog", edit: "Save changes", category: "Create category" },
    // What each commitment says for assistive tech while it works (0f Working), its spinner alone
    // on the screen.
    working: { add: "Adding…", edit: "Saving…", category: "Creating…", discontinue: "Discontinuing…", restore: "Restoring…", remove: "Removing…" },
    cancel: "Cancel",
    // A row's name opens its dialog, named by the row's whole name, since three rows can say
    // `Battery` and the column says the third level alone.
    editRow: (itemName) => `Edit ${itemName}`,
    // The fields, in the dialog's order, each the catalog's word for its level; the three a row
    // may leave empty say so beside their word, and each field shows an example while empty.
    fields: {
        level1: ASSET_CATEGORY_COPY.levelLabel.level1,
        level2: ASSET_CATEGORY_COPY.levelLabel.level2,
        level3: ASSET_CATEGORY_COPY.levelLabel.level3,
        size: ASSET_CATEGORY_COPY.levelLabel.size,
        maker: ASSET_CATEGORY_COPY.levelLabel.maker,
        partNumber: ASSET_CATEGORY_COPY.levelLabel.partNumber,
    },
    optional: "Optional",
    placeholders: { level2: "e.g. Wrench", level3: "e.g. Flexible Ratchet", size: "e.g. 16 mm", maker: "e.g. Milwaukee", partNumber: "e.g. 2767-20" },
    // A category or a name the type does not hold yet says so at the field's end, and what that
    // means to assistive tech, which hears no mark — 1l's own sentences for the two.
    newMark: "New",
    newCategory: "New category. It is added with this entry.",
    newCategoryAlone: "New category.",
    newName: "New name in this category.",
    // What the entry shows as, the base's own rule for the name, and its place while none is typed.
    showsAs: "Shows as",
    noName: "Item name",
    // An edit's line under its title: how many items stand under the row, and that it is
    // discontinued — and the line over the actions when an edit renames those items.
    itemCount: (n) => (n === 0 ? "No items" : n === 1 ? "1 item" : `${n} items`),
    renames: (n) => (n === 1 ? "Its 1 item takes the new name." : `Its ${n} items take the new name.`),
    // An edit's secondary action, as the row stands (1l), and the menu that removes a row nothing
    // stands under.
    discontinue: "Discontinue",
    restore: "Restore",
    moreActions: ASSET_COPY.moreActions,
    remove: "Remove from catalog",
    removeTitle: (itemName) => `Remove ${itemName} from catalog?`,
    removeSays: "It comes out of the catalog. No items use it.",
    // Each refusal about one field, under that field (1l), and the reasons a whole press is refused.
    refusal: {
        level1: "Choose a type.",
        level2: "Enter a category.",
        level3: "Enter a name.",
        leaveEmpty: "Leave it empty.",
        exists: (category) => `This item already exists in ${category}.`,
        categoryExists: "This category already exists.",
    },
    // A press that wrote nothing, and one that wrote the category and not the item after it — the
    // category stands, with nothing under it yet, so a second press saves the item alone.
    notSaved: "Couldn't save the item. Try again.",
    categoryOnly: "The category was added, but the item wasn't. Try again.",
    categoryNotCreated: "Couldn't create the category. Try again.",
    notRemoved: "Couldn't remove the item. Try again.",
    // A row somebody removed since the page was drawn, and one items came to stand under since
    // the confirmation was asked — each with the page drawn again (#378).
    gone: "This item isn't in the catalog any more.",
    hasItems: "Items use it now, so it stays in the catalog.",
};
