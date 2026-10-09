// The catalog a registration picks from (#507). `Asset Categories` IS the catalog: a row is
// one category — the kind an asset is bought as — named by where it sits, a category, a tool
// and a size, and carrying a class. The office fills it in Airtable, and the app never writes
// an `Asset Categories` row: a registration picks a row and writes assets under it. This
// module holds the catalog's columns, the class's two values, the expression the base names
// a row with, which rows a registration may pick, the walk the registration narrows through,
// and every word the catalog says.
//
// THREE LEVELS, SIZE ALWAYS LAST. `Level 1` is the category, `Level 2` the tool and `Size`
// the size, and a screen says `Category`, `Tool` and `Size`. The two first are numbered
// because a level the catalog grows goes in the middle, as a field inserted between them and
// `Size` when it is wanted; no empty field waits for it. A row's name is `{Level 2} {Size}`
// — `DEMO Angle Grinder 4-1/2"` — the way the design draws it, so the category is said
// beside a name and never inside one. A row is `assetCategory` in this module, since the first
// level is `category` here (naming.md); the second level is `level2`, its field's name, and
// `Tool` only on a screen.
//
// THE NAME IS THE BASE'S, AND THIS MODULE IS WHERE ITS EXPRESSION IS EDITED. `Item Name` is a
// formula since #507, so a row the office adds is named the moment its levels are typed, and
// every screen that names a category reads that field. `ITEM_NAME_FORMULA` is generated from
// `ASSET_CATEGORY_FIELDS` and `scripts/import/create_tool_catalog_507.mjs` PATCHes it onto the
// field. `composeItemName` is the same rule in JavaScript and is read by that script alone,
// to check the names the base computed: a formula cannot call JavaScript, so the two cannot
// be one, and the check is what keeps them one rule — `lib/materialCategory.js` holds
// `Category Label` the same way, and its header has the argument.
//
// WHAT A REGISTRATION MAY PICK IS A ROW WITH ALL THREE LEVELS AND A CLASS. The office types
// the catalog by hand, so a row can arrive without a level or a class, and two rows can name
// one path; `readCatalog` offers the first row of each path and sets the rest aside, saying
// why, and the creation script prints what it set aside, which is how the office finds
// them. A level is compared under `textMatchKey`, so `Power Tools` and `power  tools` are one
// category, as `Impact Driver` and `impact driver` were one typed name until #507.
//
// THE CLASS IS INFORMATION. `A` for a kind that matters more, usually a dearer one, and `B`
// otherwise; no act — adding, a label, a check-out — reads it, and a design must not make one
// do so.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled out, which
// is `lib/materialPriceView.js`' precedent (#19): the offline tier runs under plain `node`,
// and the registration dialog is a "use client" file that reads it.

import { textMatchKey } from "./itemNaming.js";

/**
 * The catalog's columns on `Asset Categories`, by what each holds. `Item Name` is not here:
 * it is the row's name, computed from two of these, and every reader takes it from
 * `recordToAssetCategory`.
 */
export const ASSET_CATEGORY_FIELDS = Object.freeze({
    level1: "Level 1",
    level2: "Level 2",
    size: "Size",
    assetClass: "Class",
});

/** A category's path, outermost first — the order a screen says it in and a registration narrows by. */
export const ASSET_PATH_LEVELS = Object.freeze(["level1", "level2", "size"]);

/**
 * The class a category carries (#507), and the select's two options on the base. Created with
 * the field, colors and all, since a select's option list cannot be PATCHed afterwards
 * (`docs/notes/airtable-access.md`).
 */
export const ASSET_CLASS_VALUES = Object.freeze(["A", "B"]);

/** Between two levels of a path said as one string — `lib/materialCategory.js`' separator, for its reason: a size holds a slash. */
export const ASSET_PATH_SEPARATOR = " > ";

/** `Asset Categories."Item Name"`'s expression: the tool and the size, a space between, nothing at either end. */
export const ITEM_NAME_FORMULA = `TRIM({${ASSET_CATEGORY_FIELDS.level2}} & " " & {${ASSET_CATEGORY_FIELDS.size}})`;

/**
 * The name the formula above gives a row, in JavaScript, for the creation script to check
 * the base's answer against (the header). No screen calls it: a screen reads the base's.
 */
export function composeItemName(assetCategory) {
    return `${assetCategory?.level2 ?? ""} ${assetCategory?.size ?? ""}`.trim();
}

/**
 * A category's path said as one string — `DEMO Power Tools > DEMO Angle Grinder > 4-1/2"` — the
 * caption the category's own page and an asset's page say under the name. A level the row does
 * not have is left out rather than drawn empty.
 */
export function pathOf(assetCategory) {
    return ASSET_PATH_LEVELS.map((level) => assetCategory?.[level] ?? "")
        .filter((value) => value.trim() !== "")
        .join(ASSET_PATH_SEPARATOR);
}

/** The key two rows share when they name one path: each level under `textMatchKey`. */
function pathKey(assetCategory) {
    return ASSET_PATH_LEVELS.map((level) => textMatchKey(assetCategory[level])).join("\n");
}

/**
 * Which rows a registration may pick, and which it may not and why (#507).
 *
 * A ROW IS OFFERED WITH ALL THREE LEVELS AND ONE OF THE TWO CLASSES, AND ONCE PER PATH. A
 * level of nothing but spaces is no level. A second row naming a path the first already
 * names is set aside rather than offered beside it: two rows with one path would be one
 * choice in the walk below with two rows behind it, and `docs/notes/materials.md` records
 * why a catalog refuses to let a row win silently. Here the row that came first in the read
 * is offered and the other is reported, since the catalog is typed by hand and a refusal of
 * the whole list would stop every registration over one row.
 *
 * `setAside` carries each row it did not offer with `reason` — `incomplete`, naming the
 * fields it lacks, or `repeated`, naming the row it repeats — for the creation script's
 * report. No screen reads it.
 */
export function readCatalog(assetCategories) {
    const offered = [];
    const setAside = [];
    const firstOfPath = new Map();
    for (const assetCategory of assetCategories || []) {
        const missing = ASSET_PATH_LEVELS.filter((level) => textMatchKey(assetCategory[level]) === "");
        if (!ASSET_CLASS_VALUES.includes(assetCategory.assetClass)) missing.push("assetClass");
        if (missing.length > 0) {
            setAside.push({ category: assetCategory, reason: "incomplete", missing });
            continue;
        }
        const key = pathKey(assetCategory);
        if (firstOfPath.has(key)) {
            setAside.push({ category: assetCategory, reason: "repeated", of: firstOfPath.get(key) });
            continue;
        }
        firstOfPath.set(key, assetCategory);
        offered.push(assetCategory);
    }
    return { offered, setAside };
}

/**
 * Two words in the order every asset list says them: by the base's own spelling, case and
 * accents aside, a run of digits read as a number — so `Circular Saw 7-1/4"` comes before
 * `Circular Saw 10"`, which a name ending in its size (#507) makes an everyday pair. The
 * category list sorts its rows by it (`summarizeAssetCategories`) and the registration its
 * categories, names and sizes.
 */
export function compareCatalogText(a, b) {
    return String(a ?? "").localeCompare(String(b ?? ""), "en", { sensitivity: "base", numeric: true });
}

/**
 * The categories the offered rows hold, each once in the spelling of the first row that has
 * it, alphabetically — the registration's filter (#507), after `All categories`.
 */
export function catalogCategories(catalog) {
    const categories = new Map();
    for (const assetCategory of catalog || []) {
        const key = textMatchKey(assetCategory.level1);
        if (!categories.has(key)) categories.set(key, { key, level1: assetCategory.level1 });
    }
    return [...categories.values()].sort((a, b) => compareCatalogText(a.level1, b.level1));
}

/**
 * The second level's names the offered rows hold under a category, or under every category
 * when none is given — each once, in the spelling of the first row that has it, by name and
 * then by category. What a screen calls a tool here is the category and the name together:
 * one name under two categories is two, which is why `key` carries both. The category is
 * said as the filter says it, so a row typed in another case does not say it a second way.
 */
export function catalogNames(catalog, categoryKey = "") {
    const spelled = new Map(catalogCategories(catalog).map((category) => [category.key, category.level1]));
    const names = new Map();
    for (const assetCategory of catalog || []) {
        const category = textMatchKey(assetCategory.level1);
        if (categoryKey && category !== categoryKey) continue;
        const key = `${category}\n${textMatchKey(assetCategory.level2)}`;
        if (!names.has(key)) names.set(key, { key, level1: spelled.get(category), level2: assetCategory.level2 });
    }
    return [...names.values()].sort((a, b) => compareCatalogText(a.level2, b.level2) || compareCatalogText(a.level1, b.level1));
}

/** The most names the search offers at once — 1b's five, which the typed name's suggestions took until #507. */
export const MAX_NAME_SUGGESTIONS = 5;

/**
 * The names the registration's search offers for what is typed (#507): every name under the
 * filter that holds it, compared under `textMatchKey`, at most `MAX_NAME_SUGGESTIONS`, and
 * with nothing typed the first of them — so the list opens on something to pick. A name typed
 * in full is offered too, since picking it is how the reader goes on.
 */
export function suggestCatalogNames(catalog, { categoryKey = "", typed = "" } = {}) {
    const want = textMatchKey(typed);
    return catalogNames(catalog, categoryKey)
        .filter((name) => textMatchKey(name.level2).includes(want))
        .slice(0, MAX_NAME_SUGGESTIONS);
}

/**
 * The one name a typed name names under the filter, or null when it names none or more than
 * one — one name under two categories, with no category chosen. Enter in the search takes
 * it, as a press on its suggestion would.
 */
export function findCatalogName(catalog, { categoryKey = "", typed = "" } = {}) {
    const want = textMatchKey(typed);
    if (!want) return null;
    const named = catalogNames(catalog, categoryKey).filter((name) => textMatchKey(name.level2) === want);
    return named.length === 1 ? named[0] : null;
}

/** The offered rows under one name, by size — the sizes it is held in, each one row. */
export function catalogSizes(catalog, nameKey) {
    return (catalog || [])
        .filter((assetCategory) => `${textMatchKey(assetCategory.level1)}\n${textMatchKey(assetCategory.level2)}` === nameKey)
        .sort((a, b) => compareCatalogText(a.size, b.size));
}

/**
 * The row a choice of size starts on: the one size a name is held in, already chosen, and
 * none of several (0l — a choice with one option is already chosen).
 */
export function onlySize(sizes) {
    return Array.isArray(sizes) && sizes.length === 1 ? sizes[0] : null;
}

/**
 * Every word the catalog says, on the two lists, the two pages a category's name heads and the
 * registration that picks one. The level words are the design's (#507); `All categories`
 * is the job filter's `All jobs` (`lib/listFilters.js`) for the same choice one field over.
 */
export const ASSET_CATEGORY_COPY = {
    categoryLabel: "Category",
    toolLabel: "Tool",
    sizeLabel: "Size",
    classLabel: "Class",
    // The filter with nothing chosen, first among the categories (#507).
    allCategories: "All categories",
    // What the search and the size say while nothing is chosen — `Choose a job`'s shape (0l).
    toolUnchosen: "Choose a tool",
    sizeUnchosen: "Choose a size",
    // The class said beside a category, in the caption under its name: `Class A`, the value in Ink
    // inside a line at Ink 3 — parts rather than a string, so the component need not find
    // the value in it, as the registration's preview did with a tool's name (#456).
    classOf: (assetClass) => ["Class ", { emphasis: assetClass }],
};
