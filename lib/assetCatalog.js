// The catalog the office keeps (#527) — `/asset-catalog`, every row of `Asset Categories` with its
// path, its class, whether it is discontinued and how many items stand under it, narrowed by the
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
// WHAT THE BAND IS, AND WHY IT IS THE CATEGORY LIST'S. The search and the `Type`, `Category` and
// `Class` chips are 1a's, over rows of the same shape, so `lib/assetListView.js:
// filterAssetCategoryRows` is the one reading of them: the same search through
// `lib/searchTokens.js`, the same counts, the same `N of M`. What the catalog adds is offered
// values no row holds — every group's category, and the whole type and class vocabularies — and
// the toggle, which narrows to the discontinued rows before anything else is asked, so every
// count the chips give is a count of those. **And the name typed in full first** (`nameRank`, #517's
// rule): 1l ranks its rows as 1b ranks its names, and the catalog's names repeat — three rows are
// `Battery` — where the category list's do not.
//
// PURE AND OFFLINE-SAFE, importing two modules with the extension spelled out, so the page's list
// — a `"use client"` file — and `offline/asset-catalog.mjs` can both read it.

import { ASSET_CATEGORY_COPY, ASSET_CLASS_VALUES, ASSET_PATH_LEVELS, ASSET_TYPE_VALUES, compareCatalogText, nameRank, readCategoryGroups } from "./assetCategory.js";
import { ASSET_LIST_COPY, filterAssetCategoryRows } from "./assetListView.js";

/**
 * Every row of the catalog as the page lists it (1l): what each column says, whether it is
 * discontinued, and how many items stand under it — and none of the items, which no screen here
 * reads and the page would otherwise hand the browser. In 1l's order: by name, then size, maker
 * and part number, each as `compareCatalogText` orders a word, so `Flexible Ratchet 9 mm` comes
 * before `10 mm`.
 */
export function catalogRows(categories) {
    return (Array.isArray(categories) ? categories : [])
        .map((category) => ({
            id: category.id,
            itemName: category.itemName ?? "",
            ...Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, category[level] ?? ""])),
            assetClass: category.assetClass ?? "",
            discontinued: category.discontinued === true,
            assetCount: (category.assets ?? []).length,
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
 * What the band offers beyond the values its rows hold (#527): both types and both classes,
 * whatever the rows hold, as 1l offers them, and every category that stands as a group under its
 * type — so a category the office keeps before filing anything under it is one to narrow to,
 * counting none. `groups` are `Asset Category Groups` as read; one that does not stand
 * (`readCategoryGroups`) offers nothing.
 */
export function catalogOffers(groups) {
    return [
        ...ASSET_TYPE_VALUES.map((level1) => ({ level1 })),
        ...readCategoryGroups(groups).offered.map(({ level1, level2 }) => ({ level1, level2 })),
        ...ASSET_CLASS_VALUES.map((assetClass) => ({ assetClass })),
    ];
}

/**
 * The catalog's rows under what its band holds (1l, #527) — 1a's reading over the rows the toggle
 * leaves, with the offers above, and the rows ranked by name for what is typed. `filters` is
 * `readAssetListFilters`' answer and `discontinued`, true while the toggle narrows to the
 * discontinued rows. `total` is every row, the `M` the head's `N of M` says, and `narrowed`
 * counts the toggle as a narrowing.
 */
export function filterCatalogRows(rows, groups, filters = {}) {
    const all = Array.isArray(rows) ? rows : [];
    const discontinued = filters.discontinued === true;
    const reading = filterAssetCategoryRows(discontinued ? all.filter((row) => row.discontinued) : all, filters, { offers: catalogOffers(groups) });
    const typed = filters.q ?? "";
    return {
        ...reading,
        rows: reading.searching ? [...reading.rows].sort((a, b) => nameRank(a.level3, typed) - nameRank(b.level3, typed)) : reading.rows,
        held: { ...reading.held, discontinued },
        narrowed: reading.narrowed || discontinued,
        total: all.length,
    };
}

/** Every word the catalog's page says (1l) — the band's and the pager's are the category list's, read there. */
export const ASSET_CATALOG_COPY = {
    // The page's title, its heading and the 1a opener that leads to it — one word for one place.
    heading: "Catalog",
    // Its search, which says what it searches (0h), and its ×.
    searchLabel: "Search catalog",
    clearSearch: ASSET_CATEGORY_COPY.clearSearch,
    // The columns, in 1l's order: the name — `Name`, the category list's own head over the name's
    // third level — then each level the catalog's word for it, the class, and the items counted.
    columns: {
        level3: ASSET_LIST_COPY.nameLabel,
        size: ASSET_CATEGORY_COPY.levelLabel.size,
        maker: ASSET_CATEGORY_COPY.levelLabel.maker,
        partNumber: ASSET_CATEGORY_COPY.levelLabel.partNumber,
        level2: ASSET_CATEGORY_COPY.levelLabel.level2,
        level1: ASSET_CATEGORY_COPY.levelLabel.level1,
        assetClass: ASSET_CATEGORY_COPY.classLabel,
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
    // file's 1g draws for `/invoices/new`, in this page's words, which no drawing gives.
    noAccess: "You don't have access to this page. Keeping the catalog is for Admins.",
};
