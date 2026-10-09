// The catalog a registration picks from (#507). `Asset Categories` IS the catalog: a row is
// one category — the kind an asset is bought as — named by where it sits, and carrying a
// class. The office fills it in Airtable, and the app never writes an `Asset Categories`
// row: a registration picks a row and writes assets under it. This module holds the
// catalog's columns, the type's and the class's values, the expression the base names a row
// with, which rows a registration may pick, the walk the registration narrows through, and
// every word the catalog says.
//
// SIX LEVELS SINCE #514, THREE EVERY ROW FILLS AND THREE IT MAY LEAVE EMPTY. `Level 1` is the
// type — `Equipment` or `Tool`, a select — `Level 2` the category, a field of work such as
// machining or welding, and `Level 3` the name; then `Size`, `Maker` and `Part Number`, which
// a row leaves empty where they do not apply — a piece of equipment usually has no size,
// and a generic tool no maker. A screen says `Type`, `Category`, `Name`, `Size`, `Maker` and
// `Part #`. #507 had three — `Level 1` the category, `Level 2` the tool, `Size` — and #514
// renamed those two fields up a level rather than recreating them, so every value went with
// its field. An empty level is left empty: `N/A` and its kind are not values, and a row
// carrying one is not offered (`readCatalog`).
//
// IN CODE A LEVEL IS ITS FIELD'S NAME, AND A ROW IS `category`. `level1`, `level2` and
// `level3` rather than `type`, `category` and `name`: the second would be the row's own word
// a second time, which is why #507's modules called the row `assetCategory`, and the third
// would sit beside the row's `itemName` meaning something else. The class is `assetClass`,
// `class` being reserved.
//
// THE TYPE IS INFORMATION, AND SO IS THE CLASS. `Tool` or `Equipment` changes nothing an
// asset does — its label, a check-out, a check-in and a retirement are the same — and the
// class is `A` for a kind that matters more, usually a dearer one, and `B` otherwise; no act
// reads either, and a design must not make one do so.
//
// THE NAME IS THE BASE'S, AND THIS MODULE IS WHERE ITS EXPRESSION IS EDITED. `Item Name` is a
// formula since #507, so a row the office adds is named the moment its levels are typed, and
// every screen that names a category reads that field. `ITEM_NAME_FORMULA` is generated from
// `ASSET_CATEGORY_FIELDS` and `scripts/import/classify_asset_categories_514.mjs` PATCHes it
// onto the field. `composeItemName` is the same rule in JavaScript and is read by that script
// alone, to check the names the base computed: a formula cannot call JavaScript, so the two
// cannot be one, and the check is what keeps them one rule — `lib/materialCategory.js` holds
// `Category Label` the same way, and its header has the argument.
//
// WHAT A REGISTRATION MAY PICK IS A ROW WITH A TYPE, A CATEGORY, A NAME AND A CLASS, ONCE PER
// PATH. The office types the catalog by hand, so a row can arrive without one of them, with
// a placeholder for an empty level, and two rows can name one path; `readCatalog` offers the
// first row of each path and sets the rest aside, saying why, and the script prints what it
// set aside, which is how the office finds them. A level is compared under `textMatchKey`,
// so `Welding` and `welding ` are one category.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled out, which
// is `lib/materialPriceView.js`' precedent (#19): the offline tier runs under plain `node`,
// and the registration dialog is a "use client" file that reads it.

import { normalizeItemText, textMatchKey } from "./itemNaming.js";

/**
 * The catalog's columns on `Asset Categories`, by what each holds. `Item Name` is not here:
 * it is the row's name, computed from four of these, and every reader takes it from
 * `recordToAssetCategory`.
 */
export const ASSET_CATEGORY_FIELDS = Object.freeze({
    level1: "Level 1",
    level2: "Level 2",
    level3: "Level 3",
    size: "Size",
    maker: "Maker",
    partNumber: "Part Number",
    assetClass: "Class",
});

/** A category's path, outermost first — the order a screen says it in and a registration narrows by. */
export const ASSET_PATH_LEVELS = Object.freeze(["level1", "level2", "level3", "size", "maker", "partNumber"]);

/** The levels every row a registration may pick fills — the first step's (#514). */
export const ASSET_REQUIRED_LEVELS = Object.freeze(["level1", "level2", "level3"]);

/** The levels a row may leave empty — the second step's, in the order it asks them (#514). */
export const ASSET_OPTIONAL_LEVELS = Object.freeze(["size", "maker", "partNumber"]);

/**
 * The type a category carries (#514), and `Level 1`'s two options on the base. Created with
 * the field, colors and all, since a select's option list cannot be PATCHed afterwards
 * (`docs/notes/airtable-access.md`).
 */
export const ASSET_TYPE_VALUES = Object.freeze(["Equipment", "Tool"]);

/** The class a category carries (#507), and the select's two options on the base, for the same reason. */
export const ASSET_CLASS_VALUES = Object.freeze(["A", "B"]);

/** Between two levels of a path said as one string — `lib/materialCategory.js`' separator, for its reason: a size holds a slash. */
export const ASSET_PATH_SEPARATOR = " > ";

/** A level as a formula says it, trimmed. */
const trimmed = (level) => `TRIM({${ASSET_CATEGORY_FIELDS[level]}})`;

/**
 * `Asset Categories."Item Name"`'s expression (#514): the name and the size, a space between;
 * then a comma and the maker; then the part number in parentheses — `{Level 3} {Size},
 * {Maker} ({Part Number})`. An empty level is left out with what stands before it: no maker,
 * no comma, and no part number, no parentheses, so a part number with no maker follows the
 * size directly. `DEMO Angle Grinder 4-1/2", DEMO Makita (GA4530)`, `DEMO Angle Grinder
 * 4-1/2", DEMO Bosch`, `DEMO Drill Press (JDP-17)`, `DEMO Drill Press`.
 *
 * THE COMMA PARTS THE KIND FROM WHO MADE IT. The office's catalog writes a size with its metric
 * figure beside it — `5" (127 mm)` — so the parentheses that follow a size are the size's own,
 * and the maker stands after a comma rather than in a second pair beside them:
 * `Angle Grinder 5" (127 mm), Makita (GA5030)`. The part number's parentheses close the name.
 */
const NAMED = `TRIM(${trimmed("level3")} & " " & ${trimmed("size")})`;
const HEAD = `${NAMED} & IF(AND(${NAMED}, ${trimmed("maker")}), ", ") & ${trimmed("maker")}`;
export const ITEM_NAME_FORMULA = `TRIM(${HEAD} & IF(${trimmed("partNumber")}, " (" & ${trimmed("partNumber")} & ")"))`;

/**
 * The name the formula above gives a row, in JavaScript, for the script to check the base's
 * answer against (the header). No screen calls it: a screen reads the base's.
 */
export function composeItemName(category) {
    const level = (key) => String(category?.[key] ?? "").trim();
    const named = [level("level3"), level("size")].filter(Boolean).join(" ");
    const head = [named, level("maker")].filter(Boolean).join(", ");
    const partNumber = level("partNumber");
    return (partNumber ? `${head} (${partNumber})` : head).trim();
}

/**
 * A category's path said as one string — `Tool > DEMO Machining > DEMO Angle Grinder > 4-1/2"`
 * — the caption the category's own page and an asset's page say under the name, and the
 * registration's line under its title. A level the row does not have is left out rather than
 * drawn empty.
 */
export function pathOf(category) {
    return ASSET_PATH_LEVELS.map((level) => String(category?.[level] ?? ""))
        .filter((value) => value.trim() !== "")
        .join(ASSET_PATH_SEPARATOR);
}

/**
 * What an office types for a level it means to leave empty, read as its letters and digits
 * alone: `N/A`, `n.a.`, `-`, `—`, `None`, `null`, `TBD` (#514). Empty is how a level is left
 * empty, so a value that only says so is a second spelling of empty — a row carrying one
 * would be a second row on its generic row's path, offered as `N/A` beside `No maker`.
 */
const PLACEHOLDER_KEYS = new Set(["", "na", "none", "null", "nil", "unknown", "tbd"]);

/** Whether a level's value is a placeholder for nothing rather than a value (#514). An empty one is not: it is empty. */
export function isPlaceholder(value) {
    const text = String(value ?? "").trim();
    return text !== "" && PLACEHOLDER_KEYS.has(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
}

/** The key two rows share when they name one path: each level under `textMatchKey`, an empty one included. */
function pathKey(category) {
    return ASSET_PATH_LEVELS.map((level) => textMatchKey(category[level])).join("\n");
}

/**
 * Which rows a registration may pick, and which it may not and why (#507, #514).
 *
 * A ROW IS OFFERED WITH ONE OF THE TWO TYPES, A CATEGORY, A NAME AND ONE OF THE TWO CLASSES,
 * NO PLACEHOLDER IN ANY LEVEL, AND ONCE PER PATH. A level of nothing but spaces is no level.
 * The path is all six levels, an empty one part of it: a generic `Angle Grinder 4-1/2"` and
 * the same grinder by one maker are two paths, which is what lets a maker be left empty. A
 * second row naming a path the first already names is set aside rather than offered beside
 * it: two rows with one path would be one choice in the walk below with two rows behind it,
 * and `docs/notes/materials.md` records why a catalog refuses to let a row win silently.
 * Here the row that came first in the read is offered and the other is reported, since the
 * catalog is typed by hand and a refusal of the whole list would stop every registration
 * over one row.
 *
 * `setAside` carries each row it did not offer with `reason` — `incomplete`, naming the
 * fields it lacks; `placeholder`, naming the levels that hold one; or `repeated`, naming the
 * row it repeats — for the script's report. No screen reads it.
 */
export function readCatalog(categories) {
    const offered = [];
    const setAside = [];
    const firstOfPath = new Map();
    for (const category of categories || []) {
        const missing = ASSET_REQUIRED_LEVELS.filter((level) =>
            level === "level1" ? !ASSET_TYPE_VALUES.includes(category.level1) : textMatchKey(category[level]) === ""
        );
        if (!ASSET_CLASS_VALUES.includes(category.assetClass)) missing.push("assetClass");
        if (missing.length > 0) {
            setAside.push({ category, reason: "incomplete", missing });
            continue;
        }
        const placeholders = ASSET_PATH_LEVELS.filter((level) => isPlaceholder(category[level]));
        if (placeholders.length > 0) {
            setAside.push({ category, reason: "placeholder", levels: placeholders });
            continue;
        }
        const key = pathKey(category);
        if (firstOfPath.has(key)) {
            setAside.push({ category, reason: "repeated", of: firstOfPath.get(key) });
            continue;
        }
        firstOfPath.set(key, category);
        offered.push(category);
    }
    return { offered, setAside };
}

/**
 * The offered rows as the registration dialog takes them (#514): what it shows and narrows by,
 * and none of a row's assets, which no dialog reads and a page would otherwise hand the
 * browser. Both pages that open the dialog hand it this.
 */
export function registrationCatalog(categories) {
    return readCatalog(categories).offered.map((category) => ({
        id: category.id,
        itemName: category.itemName,
        assetClass: category.assetClass,
        ...Object.fromEntries(ASSET_PATH_LEVELS.map((level) => [level, category[level] ?? ""])),
    }));
}

/**
 * Two words in the order every asset list says them: by the base's own spelling, case and
 * accents aside, a run of digits read as a number — so `Circular Saw 7-1/4"` comes before
 * `Circular Saw 10"`, which a name ending in its size (#507) makes an everyday pair. The
 * category list sorts its rows by it (`summarizeAssetCategories`) and the registration its
 * types, categories, names and the second step's values.
 */
export function compareCatalogText(a, b) {
    return String(a ?? "").localeCompare(String(b ?? ""), "en", { sensitivity: "base", numeric: true });
}

/** Whether a row stands under the filters chosen: each a level's key, an empty one no filter. */
function within(category, filters) {
    return Object.entries(filters).every(([level, key]) => !key || textMatchKey(category[level]) === key);
}

/**
 * The values one level holds among the offered rows under the filters chosen — the first
 * step's two filters (#514): the types, and the categories under the type chosen. Each once,
 * keyed as typed text is compared and said in the spelling of the first row that has it,
 * alphabetically.
 */
export function catalogLevelValues(catalog, level, filters = {}) {
    const values = new Map();
    for (const category of catalog || []) {
        const key = textMatchKey(category[level]);
        if (key === "" || values.has(key) || !within(category, filters)) continue;
        values.set(key, { key, value: normalizeItemText(category[level]) });
    }
    return [...values.values()].sort((a, b) => compareCatalogText(a.value, b.value));
}

/**
 * The names the offered rows hold under the filters chosen (#507, #514) — each once, in the
 * spelling of the first row that has it, by name and then by category and type. What the
 * search picks is a name in its place, the type and the category with it: one name under two
 * categories is two, which is why `key` carries all three. The category is said as its filter
 * says it, so a row typed in another case does not say it a second way.
 */
export function catalogNames(catalog, filters = {}) {
    const spelled = new Map(catalogLevelValues(catalog, "level2").map(({ key, value }) => [key, value]));
    const names = new Map();
    for (const category of catalog || []) {
        if (!within(category, filters)) continue;
        const key = nameKeyOf(category);
        if (!names.has(key))
            names.set(key, {
                key,
                level1: category.level1,
                level2: spelled.get(textMatchKey(category.level2)),
                level3: normalizeItemText(category.level3),
            });
    }
    return [...names.values()].sort(
        (a, b) => compareCatalogText(a.level3, b.level3) || compareCatalogText(a.level2, b.level2) || compareCatalogText(a.level1, b.level1)
    );
}

/** The key of the name a row stands under: its type, its category and its name. */
function nameKeyOf(category) {
    return ASSET_REQUIRED_LEVELS.map((level) => textMatchKey(category[level])).join("\n");
}

/** The most names the search offers at once — 1b's five, which the typed name's suggestions took until #507. */
export const MAX_NAME_SUGGESTIONS = 5;

/**
 * The names the registration's search offers for what is typed (#507): every name under the
 * filters that holds it, compared under `textMatchKey`, at most `MAX_NAME_SUGGESTIONS`, and
 * with nothing typed the first of them — so the list opens on something to pick. A name typed
 * in full is offered too, since picking it is how the reader goes on.
 */
export function suggestCatalogNames(catalog, { filters = {}, typed = "" } = {}) {
    const want = textMatchKey(typed);
    return catalogNames(catalog, filters)
        .filter((name) => textMatchKey(name.level3).includes(want))
        .slice(0, MAX_NAME_SUGGESTIONS);
}

/**
 * The one name a typed name names under the filters, or null when it names none or more than
 * one — one name under two categories, with no category chosen. Enter in the search takes
 * it, as a press on its suggestion would.
 */
export function findCatalogName(catalog, { filters = {}, typed = "" } = {}) {
    const want = textMatchKey(typed);
    if (!want) return null;
    const named = catalogNames(catalog, filters).filter((name) => textMatchKey(name.level3) === want);
    return named.length === 1 ? named[0] : null;
}

/** The offered rows under one name — the rows the second step narrows between. */
export function catalogRowsOf(catalog, nameKey) {
    return (catalog || []).filter((category) => nameKeyOf(category) === nameKey);
}

/**
 * The second step's levels over the rows under one name, and the row they make (#514).
 *
 * A LEVEL IS ASKED WHERE A ROW UNDER THE NAME HOLDS A VALUE FOR IT, and nowhere else: a name
 * no row gives a size to — most equipment — is asked no size. Which levels are asked is the
 * name's, so the step does not change shape as its choices change.
 *
 * WHAT CAN BE CHOSEN NARROWS AS THE STEP GOES: a level offers the values of the rows that
 * stand under every choice made before it, size before maker before part number. A level may
 * be left empty where such a row leaves it empty, and only there — the empty option first,
 * `No maker` — and then it STARTS EMPTY, so a reader who leaves it alone has chosen the row
 * that leaves it empty and the field says so. A level no such row leaves empty is a choice
 * 0l's way: its one option already chosen, or none of several.
 *
 * `chosen` is what the reader chose, a level's key or `""` for empty. A choice a choice
 * before it has since taken away is read as never made, so the level starts again rather
 * than holding a value no row has. `value` is `null` for a level still to choose, and
 * `category` is the row once every level holds a value — the one row, since an offered path
 * is one row.
 */
export function walkDetails(rows, chosen = {}) {
    const levels = [];
    let standing = rows || [];
    for (const level of ASSET_OPTIONAL_LEVELS) {
        const asked = (rows || []).some((category) => textMatchKey(category[level]) !== "");
        const values = new Map();
        let empty = false;
        for (const category of standing) {
            const key = textMatchKey(category[level]);
            if (key === "") empty = true;
            else if (!values.has(key)) values.set(key, normalizeItemText(category[level]));
        }
        const options = [
            ...(empty ? [{ value: "", label: ASSET_CATEGORY_COPY.leftEmpty[level] }] : []),
            ...[...values].map(([value, label]) => ({ value, label })).sort((a, b) => compareCatalogText(a.label, b.label)),
        ];
        const held = chosen[level];
        const value = options.some((option) => option.value === held) ? held : empty ? "" : options.length === 1 ? options[0].value : null;
        levels.push({ level, asked, options, value });
        if (value !== null) standing = standing.filter((category) => textMatchKey(category[level]) === value);
    }
    const category = levels.every((each) => each.value !== null) ? (standing[0] ?? null) : null;
    return { levels, category };
}

/**
 * Every word the catalog says, on the two lists, the two pages a category's name heads and the
 * registration that picks one. The level words are the design's (#507, #514); every other is
 * the closest shape the app already says until Design draws them — `All jobs`
 * (`lib/listFilters.js`) for a filter with nothing chosen, `Choose a job` (0l) for a choice
 * still to make — and `docs/notes/tools.md` lists them.
 */
export const ASSET_CATEGORY_COPY = {
    // Each level's word, keyed by the level (#514): the registration's fields, the list's
    // columns and the base's `Level 1` to `Part Number` in the order a path says them.
    levelLabel: { level1: "Type", level2: "Category", level3: "Name", size: "Size", maker: "Maker", partNumber: "Part #" },
    classLabel: "Class",
    // The first step's two filters with nothing chosen, first among their values.
    allOf: { level1: "All types", level2: "All categories" },
    // What the search and the second step's levels say while nothing is chosen.
    unchosen: { level3: "Choose a name", size: "Choose a size", maker: "Choose a maker", partNumber: "Choose a part #" },
    // A level left empty, as the option that leaves it so and the value it then shows (#514).
    // Each says its level rather than one word for all: `None` is also what the catalog's
    // check refuses as a value, and the screen and the base would read as asking for it.
    leftEmpty: { size: "No size", maker: "No maker", partNumber: "No part #" },
    // The class said beside a category, in the caption under its name: `Class A`, the value in Ink
    // inside a line at Ink 3 — parts rather than a string, so the component need not find
    // the value in it, as the registration's preview did with a tool's name (#456).
    classOf: (assetClass) => ["Class ", { emphasis: assetClass }],
};
