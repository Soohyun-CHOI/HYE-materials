// The catalog a registration picks from (#507). `Asset Categories` IS the catalog: a row is
// one category — the kind an asset is bought as — named by where it sits, and carrying a
// class. The office keeps it, in Airtable and since #527 on the catalog's own page
// (`lib/assetCatalog.js`), the one writer of an `Asset Categories` row in the app: a
// registration picks a row and writes assets under it. This module holds the
// catalog's columns, the type's and the class's values, the expression the base names a row
// with, which rows a registration may pick, the walk the registration narrows through, the
// groups its types and categories stand in (#528), and every word the catalog says.
//
// A TYPE AND A CATEGORY ARE A ROW OF `Asset Category Groups` (#528), AND A CATALOG ROW LINKS TO
// IT (#539). The office keeps the list of categories apart from the items, so a category can
// stand before anything is filed under it; a row there is the pair, in the catalog's own two
// fields, `Level 1` and `Level 2`. Each catalog row is filed under one by `Category Group`, and
// its own `Level 1` and `Level 2` are lookups through that link — so a category renamed in
// Airtable is renamed on every row filed under it, and a row names no pair that is no group.
// `catalogFieldsOf` reads them, and a writer writes the link and never the two (`ASSET_WRITTEN_LEVELS`).
// Which group a typed type and category name is still `categoryGroupOf`'s, compared as the
// catalog compares a level: the catalog's page asks it of what the office types, to link that
// group. `groupCatalog` says which rows name no group, which the catalog's check
// (`scripts/import/classify_asset_categories_514.mjs`) fails on — since #539 a row whose link
// is missing or doubled, read as no type and no category.
//
// SIX LEVELS SINCE #514, THREE EVERY ROW FILLS AND THREE IT MAY LEAVE EMPTY. `Level 1` is the
// type — `Equipment` or `Tool`, the group's select — `Level 2` the category, a field of work such
// as machining or welding, and `Level 3` the name; then `Size`, `Maker` and `Part Number`, which
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
// PATH, THAT THE OFFICE HAS NOT DISCONTINUED (#527). The office types the catalog by hand, so a
// row can arrive without one of them, with a placeholder for an empty level, and two rows can
// name one path; `readCatalog` offers the first row of each path and sets the rest aside, saying
// why, and the script prints what it set aside, which is how the office finds them. A level is
// compared under `textMatchKey`, so `Welding` and `welding ` are one category.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` and `./searchTokens.js` with the
// extension spelled out, which is `lib/materialPriceView.js`' precedent (#19): the offline tier
// runs under plain `node`, and the registration dialog is a "use client" file that reads it.

import { normalizeItemText, textMatchKey } from "./itemNaming.js";
import { matchesTokens, searchTokens } from "./searchTokens.js";

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

/**
 * The mark the office sets on a row it no longer buys (#527), a checkbox: a registration no
 * longer offers the row (`readCatalog`), and the assets already under it stay as they are on
 * every list and page. Clearing it offers the row again.
 *
 * NOT ONE OF `ASSET_CATEGORY_FIELDS`, WHICH IS WHAT A KIND IS. That map is a row's path and its
 * class, and the catalog's loads and checks take it whole — each field read off every row, and
 * the loads' lists written by it — where whether the office still offers a row is a mark on the
 * row that no list it hands over carries. So a script reading rows by that map alone reads every
 * row as offered, which for the loads, whose lists hold no such mark, is what they are.
 */
export const DISCONTINUED_FIELD = "Discontinued";

/**
 * The link from a catalog row to the row of `Asset Category Groups` it is filed under (#539) —
 * one group, which the Airtable UI holds a row to since the field was set to link one record,
 * by hand, the Metadata API refusing to. Named for the row it points at, as `Assets."Category"`
 * is; its far side on the groups' table is `Asset Categories`, named for the table it comes
 * from, as every reverse link here is. `Level 1` and `Level 2` are lookups through it.
 */
export const CATEGORY_GROUP_FIELD = "Category Group";

/** A category's path, outermost first — the order a screen says it in and a registration narrows by. */
export const ASSET_PATH_LEVELS = Object.freeze(["level1", "level2", "level3", "size", "maker", "partNumber"]);

/** The levels every row a registration may pick fills — the first step's (#514). */
export const ASSET_REQUIRED_LEVELS = Object.freeze(["level1", "level2", "level3"]);

/**
 * The two levels a model is, chosen together since #520 — who makes it and its part number — on
 * the second step, which asks the size and then the model (`walkDetails`). From #514 to #520 it
 * asked the three levels a row may leave empty one by one: the size, the maker and the part number.
 */
export const ASSET_MODEL_LEVELS = Object.freeze(["maker", "partNumber"]);

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
 * answer against (the header). One screen calls it: the catalog's dialog shows what a row it has
 * not saved yet will be called (`lib/assetCatalog.js:shownName`, #527). Every other screen reads
 * the base's.
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
 * would be a second row on its generic row's path, offered as `N/A` beside `Not specified`.
 */
const PLACEHOLDER_KEYS = new Set(["", "na", "none", "null", "nil", "unknown", "tbd"]);

/** Whether a level's value is a placeholder for nothing rather than a value (#514). An empty one is not: it is empty. */
export function isPlaceholder(value) {
    const text = String(value ?? "").trim();
    return text !== "" && PLACEHOLDER_KEYS.has(text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""));
}

/**
 * The key two rows share when they name one path: each level under `textMatchKey`, an empty
 * one included. `readCatalog` offers one row per key, and the catalog's loads
 * (`scripts/import/load_asset_catalog_517.mjs`, and `replace_asset_catalog_528.mjs`, which
 * keeps the row of a path its revised list names) create no row whose key the base already
 * holds, so "the same path" is one judgment wherever it is asked (#517).
 */
export function catalogPathKey(category) {
    return ASSET_PATH_LEVELS.map((level) => textMatchKey(category?.[level])).join("\n");
}

/**
 * Which rows a registration may pick, and which it may not and why (#507, #514, #527).
 *
 * A ROW IS OFFERED WITH ONE OF THE TWO TYPES, A CATEGORY, A NAME AND ONE OF THE TWO CLASSES,
 * NO PLACEHOLDER IN ANY LEVEL, ONCE PER PATH, AND NOT DISCONTINUED. A level of nothing but spaces is no level.
 * The path is all six levels, an empty one part of it: a generic `Angle Grinder 4-1/2"` and
 * the same grinder by one maker are two paths, which is what lets a maker be left empty. A
 * second row naming a path the first already names is set aside rather than offered beside
 * it: two rows with one path would be one choice in the walk below with two rows behind it,
 * and `docs/notes/materials.md` records why a catalog refuses to let a row win silently.
 * Here the row that came first in the read is offered and the other is reported, since the
 * catalog is typed by hand and a refusal of the whole list would stop every registration
 * over one row.
 *
 * A DISCONTINUED ROW STILL HOLDS ITS PATH (#527). It is asked last, once the row has taken its
 * path, so a second row naming that path is `repeated` of it rather than offered in its place:
 * the office brings a kind back by clearing the mark, and one path stays one row whether or
 * not it is offered. Only `true` marks it — the checkbox's own value — so a row read with no
 * mark at all, as a script reading the catalog's path alone reads one, is offered.
 *
 * `setAside` carries each row it did not offer with `reason` — `incomplete`, naming the
 * fields it lacks; `placeholder`, naming the levels that hold one; `repeated`, naming the
 * row it repeats; or `discontinued` — for the script's report. No screen reads it.
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
        const key = catalogPathKey(category);
        if (firstOfPath.has(key)) {
            setAside.push({ category, reason: "repeated", of: firstOfPath.get(key) });
            continue;
        }
        firstOfPath.set(key, category);
        if (category.discontinued === true) {
            setAside.push({ category, reason: "discontinued" });
            continue;
        }
        offered.push(category);
    }
    return { offered, setAside };
}

/** The two levels a group is (#528): the type and the category, outermost first. */
export const ASSET_GROUP_LEVELS = Object.freeze(["level1", "level2"]);

/**
 * The levels and the class a write of a catalog row carries (#539): every one but the two its
 * group gives, which are lookups through `Category Group` and which a write cannot carry. The
 * group is written as the link instead.
 */
export const ASSET_WRITTEN_LEVELS = Object.freeze(Object.keys(ASSET_CATEGORY_FIELDS).filter((key) => !ASSET_GROUP_LEVELS.includes(key)));

/**
 * One of the two levels a catalog row reads through its group (#539). A lookup arrives as an
 * array, one value for each group the row links, so one group is the row's level, and none or
 * several read as no level: `readCatalog` then sets the row aside as incomplete rather than file
 * it under whichever came first, and the catalog's check names it. That departs from
 * `lib/airtable/materials.js:firstOf`, which takes a lookup's first value, on purpose: only the
 * app writes a material's `Category`, where the office files a catalog row by hand in Airtable.
 *
 * ANYTHING BUT A LOOKUP IS NO LEVEL. Until both bases had turned their two levels into lookups a
 * typed value was read as itself, `firstOf`'s other half, so the app deployed before the hand
 * step read a typed base unbroken; both are lookups since 2026-10-21 (#539), and #555 took the
 * branch out. A level typed again would set every row aside as incomplete, and the catalog's
 * check would name each one.
 */
export function groupLevelOf(value) {
    return Array.isArray(value) && value.length === 1 ? String(value[0] ?? "") : "";
}

/**
 * A catalog row's path and class off its record's fields, keyed as `ASSET_CATEGORY_FIELDS` keys
 * them — the one reading of a row, for `lib/airtable/assetCategories.js` and every script reading
 * the catalog over REST (#539): the type and the category through `groupLevelOf`, every other
 * level and the class as the field holds it, an empty one `""`.
 */
export function catalogFieldsOf(fields) {
    const held = fields ?? {};
    return Object.fromEntries(
        Object.entries(ASSET_CATEGORY_FIELDS).map(([key, name]) => [key, ASSET_GROUP_LEVELS.includes(key) ? groupLevelOf(held[name]) : (held[name] ?? "")])
    );
}

/**
 * The key a catalog row and a group share when the row stands in the group (#528): the type
 * and the category, each under `textMatchKey`, as `readCatalog` compares a level — so a row
 * typed `welding equipment ` stands in `Welding Equipment`.
 */
export function categoryGroupKey(row) {
    return ASSET_GROUP_LEVELS.map((level) => textMatchKey(row?.[level])).join("\n");
}

/**
 * Which rows of `Asset Category Groups` stand as a group, and which do not and why (#528) —
 * `readCatalog`'s reading over two levels and no class: one of the two types, a category, no
 * placeholder in either, and once per pair, the first row read standing and the rest set
 * aside. `setAside` carries the same three reasons, `incomplete` naming the levels missing.
 */
export function readCategoryGroups(groups) {
    const offered = [];
    const setAside = [];
    const firstOfPair = new Map();
    for (const group of groups || []) {
        const missing = ASSET_GROUP_LEVELS.filter((level) =>
            level === "level1" ? !ASSET_TYPE_VALUES.includes(group.level1) : textMatchKey(group[level]) === ""
        );
        if (missing.length > 0) {
            setAside.push({ group, reason: "incomplete", missing });
            continue;
        }
        const placeholders = ASSET_GROUP_LEVELS.filter((level) => isPlaceholder(group[level]));
        if (placeholders.length > 0) {
            setAside.push({ group, reason: "placeholder", levels: placeholders });
            continue;
        }
        const key = categoryGroupKey(group);
        if (firstOfPair.has(key)) {
            setAside.push({ group, reason: "repeated", of: firstOfPair.get(key) });
            continue;
        }
        firstOfPair.set(key, group);
        offered.push(group);
    }
    return { offered, setAside };
}

/**
 * The group a row's type and category stand in — the first standing group of `readCategoryGroups`
 * whose pair is the row's under `categoryGroupKey` — or null where none does. The catalog's page
 * asks it of an entry (`lib/assetCatalog.js`), and the link's script of every row (#539).
 */
export function categoryGroupOf(row, groups) {
    const key = categoryGroupKey(row);
    return readCategoryGroups(groups).offered.find((group) => categoryGroupKey(group) === key) ?? null;
}

/**
 * The catalog against its groups (#528): `ungrouped`, each row a registration may pick whose
 * type and category no standing group holds — what the catalog's check fails on — and
 * `withoutItems`, each standing group no such row stands in, which is a category waiting for
 * its first item and no fault. Both sides are read here, so a caller hands the rows as read.
 */
export function groupCatalog(categories, groups) {
    const offered = readCatalog(categories).offered;
    const standing = readCategoryGroups(groups).offered;
    const held = new Set(standing.map(categoryGroupKey));
    const filed = new Set(offered.map(categoryGroupKey));
    return {
        ungrouped: offered.filter((category) => !held.has(categoryGroupKey(category))),
        withoutItems: standing.filter((group) => !filed.has(categoryGroupKey(group))),
    };
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

/**
 * The names the registration's search lists for what is typed (#507, #520, #547): every name
 * under the filters that a row under it answers — with nothing typed, every name under the
 * filters, so the list opens on the catalog to pick from (1b). Until #520 the search offered five
 * in a list under its field; 1b lists them all in the dialog's body, which scrolls.
 *
 * EVERY WORD TYPED IN ONE LEVEL OR ANOTHER OF ONE ROW (#547). What is typed is read by
 * `lib/searchTokens.js`, the app's one reading of a query, and a word is found where a level holds
 * it under the same fold: the name, or else the type, the category, the size, the maker or the
 * part number, the first of them that holds it. A name is listed where one of its rows holds every
 * word, so `drill dewalt` finds the drill by two, and `ms-htb-4t 1/2` lists no short bender whose
 * MS-HTB-4T is its `1/4"` — a row is what a registration adds, and words two rows hold apart name
 * no item. Until #547 the name alone was searched, for what was typed as one run of words, so
 * `press drill` found nothing.
 *
 * THE NAMES HOLDING EVERY WORD FIRST, THEN THOSE HOLDING SOME, THEN THOSE FOUND BY THE OTHER LEVELS
 * ALONE (#547), each group in `nameRank`'s order and each rank in `catalogNames`'. #517's order
 * leads: among the names holding every word, the name typed in full, then those beginning with
 * what is typed, then those holding it elsewhere — in that order alone the office's catalog put
 * `Wrench`, its commonest name, behind `Adjustable Monkey Wrench` and four others under `wrench`,
 * and the first result is the one the first Down reaches, Enter taking a result only once an
 * arrow is on it or one is left (#522); the files #522 read state this order as 0h's. A name
 * holding some of the words answers more of what was meant than one holding none, and among those
 * holding some it is ranked by the words it holds. A name found by the other levels alone is
 * ranked by the value that found it, which the same reason puts first when it is typed in full:
 * `DCS375` before a `DCS375B`, a `1/2"` before a `1-1/2"`. Where several of a name's rows answer,
 * the best answers for it, and a row whose words fall in two levels answers as the worse of them.
 *
 * EACH NAME SAYS WHERE IT STANDS WHEN THE CATALOG HOLDS ITS WORDS IN ANOTHER PLACE TOO (#520):
 * `place` is the category — `Band Saw` was cutting equipment and a power tool in #517's catalog —
 * or the type and the category where another place of the name holds the same category, as
 * `Pipe Cutter` was a `Cutter` of both types there; and none for a name in one place, which is
 * nearly all of them.
 * It is asked of the whole catalog rather than of what the filters leave, so a name says the
 * same thing however the list was narrowed to it. `sizes` and `models` count what its rows
 * hold — the sizes given, and the makers with their part numbers — which is what the second
 * step will ask (`lib/assetRegistration.js:nameOffers`).
 *
 * AND WHAT FOUND IT, WHERE THE NAME DID NOT (#547): `beside` is what the row says after the name —
 * the place, then each value a word was found in (`foundValues`), any the place already says left
 * out — so `Band Saw` found by `dcs375` says `DeWalt (DCS375)`, and a name in two places found by
 * a maker says its category and then the model, `Power Tools · DeWalt (DCS375)`, since one maker
 * said alone on two rows of one name would tell them apart by nothing. `named` is the
 * words the name holds, which the row marks. `chosen` is what the second step opens with chosen,
 * a size and a model each where the words found them (`chosenBy`).
 */
export function searchCatalogNames(catalog, { filters = {}, typed = "" } = {}) {
    const words = searchTokens(typed);
    const everywhere = catalogNames(catalog);
    return catalogNames(catalog, filters)
        .map((name) => ({ name, rows: catalogRowsOf(catalog, name.key) }))
        .map((each) => ({ ...each, answer: answerOf(each.name, each.rows, words) }))
        .filter(({ answer }) => answer !== null)
        .sort((a, b) => a.answer.group - b.answer.group || a.answer.rank - b.answer.rank)
        .map(({ name, rows, answer }) => {
            const key = textMatchKey(name.level3);
            const elsewhere = everywhere.filter((other) => other.key !== name.key && textMatchKey(other.level3) === key);
            const sharesCategory = elsewhere.some((other) => textMatchKey(other.level2) === textMatchKey(name.level2));
            const place = elsewhere.length === 0 ? [] : sharesCategory ? [name.level1, name.level2] : [name.level2];
            const beside = [];
            for (const part of [...place, ...foundValues(name, answer.found)]) {
                if (!beside.some((said) => textMatchKey(said) === textMatchKey(part))) beside.push(part);
            }
            return {
                ...name,
                place,
                beside,
                named: answer.named,
                chosen: chosenBy(answer.found),
                sizes: new Set(rows.map((row) => textMatchKey(row.size)).filter(Boolean)).size,
                models: new Set(rows.filter(hasModel).map(modelKeyOf)).size,
            };
        });
}

/** The levels a word the name does not hold is found in (#547): every level of a path but the name, outermost first. */
const FOUND_LEVELS = Object.freeze(ASSET_PATH_LEVELS.filter((level) => level !== "level3"));

/**
 * How a name's rows answer the words typed (#547), or null where none holds every word.
 * `group` is `0` where the name holds every word, `1` where it holds some and `2` where it holds
 * none; `rank` is `nameRank`'s, of the name for the words it holds, or of the best row's value for
 * the words it found. `named` is the words the name holds, in the order typed, and `found` each
 * row holding the rest, with the level each word is found in.
 */
function answerOf(name, rows, words) {
    const nameKey = textMatchKey(name.level3);
    const held = words.filter((word) => matchesTokens(nameKey, [word]));
    const rest = words.filter((word) => !held.includes(word));
    const found = [];
    for (const row of rows) {
        const levelOf = new Map();
        for (const word of rest) {
            const level = FOUND_LEVELS.find((each) => matchesTokens(textMatchKey(row[each]), [word]));
            if (level) levelOf.set(word, level);
        }
        if (levelOf.size === rest.length) found.push({ row, levelOf });
    }
    if (found.length === 0) return null;
    const named = held.join(" ");
    if (rest.length === 0) return { group: 0, rank: nameRank(name.level3, named), named, found };
    if (held.length > 0) return { group: 1, rank: nameRank(name.level3, named), named, found };
    const rankOf = ({ row, levelOf }) =>
        Math.max(...[...new Set(levelOf.values())].map((level) => nameRank(row[level], rest.filter((word) => levelOf.get(word) === level).join(" "))));
    return { group: 2, rank: Math.min(...found.map(rankOf)), named, found };
}

/** The rows a word was found in at one of `levels`, of those answering (#547). */
function foundAt(found, levels) {
    return found.filter(({ levelOf }) => [...levelOf.values()].some((level) => levels.includes(level))).map(({ row }) => row);
}

/**
 * The values the words the name does not hold were found in (#547), in a path's order: the type
 * and the category as the name's place says them; each size found, in the second step's order;
 * and the model found as the second step says it, `Maker (Part #)`.
 *
 * SEVERAL MODELS SAY WHAT THEY SHARE. A word can find more than one of a name's models — `hilti`
 * both Hilti hammer drills, `ms-htb` all three Swagelok short benders — and any one of them said
 * alone would name a model the second step does not open on (`chosenBy`). So several by one maker
 * say the maker, as a model with no part number is said, and several sharing none — the part
 * numbers alone, `lf` finding `LF101` and `LF201` — say each, in the second step's order.
 */
function foundValues(name, found) {
    const values = [];
    if (foundAt(found, ["level1"]).length > 0) values.push(name.level1);
    if (foundAt(found, ["level2"]).length > 0) values.push(name.level2);
    const sizes = new Map();
    for (const row of foundAt(found, ["size"])) if (!sizes.has(textMatchKey(row.size))) sizes.set(textMatchKey(row.size), normalizeItemText(row.size));
    values.push(...[...sizes.values()].sort(compareSizes));
    const models = new Map();
    for (const row of foundAt(found, ASSET_MODEL_LEVELS)) if (!models.has(modelKeyOf(row))) models.set(modelKeyOf(row), row);
    const rows = [...models.values()].sort(compareModels);
    const makers = new Set(rows.map((row) => textMatchKey(row.maker)));
    if (rows.length === 1) values.push(modelLabelOf(rows[0]));
    else if (rows.length > 1 && makers.size === 1 && !makers.has("")) values.push(normalizeItemText(rows[0].maker));
    else values.push(...rows.map(modelLabelOf));
    return values;
}

/**
 * What the second step opens with chosen, for a name the words found by a size or a part number
 * (#547) — `walkDetails`' `chosen`, so a choice no row under the name has is read as never made.
 *
 * A PART NUMBER CHOOSES ITS MODEL AND A SIZE ITS SIZE, EACH WHERE THE ROWS ANSWERING HOLD ONE. The
 * model where a part number found the rows and they are one model, and with it their size where
 * they hold one, since a model is offered once its size is settled; the size where a size found
 * them and they hold one. Several start with none, as a choice among several does (#517): `ms-htb`
 * finds three short benders, one to a size, and opens on the three sizes with none chosen rather
 * than on one the reader may not have meant. A maker chooses nothing: it names who made a model
 * and not which, so `dewalt` opens on the drill's models as they were.
 */
function chosenBy(found) {
    const rows = found.map(({ row }) => row);
    const sizes = new Set(rows.map((row) => textMatchKey(row.size)));
    const models = new Set(rows.map(modelKeyOf));
    const chosen = {};
    if (foundAt(found, ["partNumber"]).length > 0 && models.size === 1) chosen.model = [...models][0];
    if ((foundAt(found, ["size"]).length > 0 || chosen.model !== undefined) && sizes.size === 1) chosen.size = [...sizes][0];
    return chosen;
}

/**
 * Where a text stands for what is typed (#517): `0` for the text typed in full, `1` for one
 * beginning with it, `2` for any other — each compared under `textMatchKey`. The registration's
 * search ranks its names by it, and since #547 a name its words find by another level by the value
 * found, and the catalog's page (#527) ranks its rows by their name, so the name typed in full
 * comes first in both and the rest keep their order within each rank.
 */
export function nameRank(name, typed) {
    const want = textMatchKey(typed);
    const key = textMatchKey(name);
    return key === want ? 0 : key.startsWith(want) ? 1 : 2;
}

/** The key a row's model is chosen by (#520): its maker and its part number together, each under `textMatchKey`. */
function modelKeyOf(row) {
    return ASSET_MODEL_LEVELS.map((level) => textMatchKey(row?.[level])).join("\n");
}

/** Whether a row names a model at all — a maker, a part number or both. */
function hasModel(row) {
    return ASSET_MODEL_LEVELS.some((level) => textMatchKey(row?.[level]) !== "");
}

/**
 * Two rows' models in the order the second step offers them (1b, #520): by maker, the makers'
 * empty last, then by part number — the order the search says several found in too (#547).
 */
function compareModels(a, b) {
    const [x, y] = [textMatchKey(a.maker), textMatchKey(b.maker)];
    return (x === "") - (y === "") || compareCatalogText(x, y) || compareCatalogText(normalizeItemText(a.partNumber), normalizeItemText(b.partNumber));
}

/**
 * What a model says (1b, #520): its maker and, in parentheses, its part number — `Lincoln
 * Electric (TIG 205)` — or whichever of the two the row gives, or the empty word for a row
 * giving neither, `Not specified`.
 */
function modelLabelOf(row) {
    const [maker, partNumber] = ASSET_MODEL_LEVELS.map((level) => normalizeItemText(row?.[level]));
    if (maker && partNumber) return `${maker} (${partNumber})`;
    return maker || partNumber || ASSET_CATEGORY_COPY.leftEmpty.model;
}

/**
 * The figure a size leads with, and whether it is metric (1b, #520): `13 mm` is 13 and metric,
 * `4-1/2"` is 4.5, `9/16"` 0.5625 and `M12` 12, none of them metric. A size naming millimeters
 * before any inch mark is metric — `8A to 25A (8 to 32 mm)` — and one naming them after it,
 * `5" (127 mm)`, is an inch size whose metric figure is written beside it.
 */
function sizeOrderOf(size) {
    const text = String(size ?? "");
    const mm = text.search(/mm/i);
    const inch = text.indexOf('"');
    const figure = text.match(/(\d+(?:\.\d+)?)(?:-(\d+)\/(\d+)|\/(\d+))?/);
    let value = Number.POSITIVE_INFINITY;
    if (figure) value = figure[4] ? Number(figure[1]) / Number(figure[4]) : Number(figure[1]) + (figure[2] ? Number(figure[2]) / Number(figure[3]) : 0);
    return { metric: mm !== -1 && (inch === -1 || mm < inch), value };
}

/**
 * Two sizes in the order the second step offers them (1b, #520): the metric ones first, then the
 * rest, each group by the figure it leads with, and two figures alike by their words — so `8 mm`
 * to `27 mm` stand before `7/16"` to `3/4"`, and `9 mm` before `10 mm`. As words alone,
 * `compareCatalogText`'s order until #520, `1/2"` stood before `8 mm` and `11/16"` between `11 mm`
 * and `12 mm`.
 */
export function compareSizes(a, b) {
    const [x, y] = [sizeOrderOf(a), sizeOrderOf(b)];
    if (x.metric !== y.metric) return x.metric ? -1 : 1;
    return x.value - y.value || compareCatalogText(a, b);
}

/** The offered rows under one name — the rows the second step narrows between. */
export function catalogRowsOf(catalog, nameKey) {
    return (catalog || []).filter((category) => nameKeyOf(category) === nameKey);
}

/**
 * The second step over the rows under one name — its size and its model — and the row they make
 * (1b, #514, #520).
 *
 * THE SIZE FIRST, AND ASKED ONLY AMONG SEVERAL. Its options are the sizes the rows give, in
 * `compareSizes`' order, and `None` after them where a row gives none beside rows that do. One
 * option is chosen without asking and the step draws no size — the name says it already — and a
 * name no row sizes, most equipment, has none to choose. Several start with none chosen.
 *
 * THEN THE MODEL, A ROW'S MAKER AND PART NUMBER TOGETHER, AMONG THE ROWS OF THE SIZE CHOSEN.
 * Nothing is offered until the size is settled, since a model belongs to a size; then each model
 * the rows standing give, by its maker with the makers' empty last and then by its part number —
 * `Not specified` for a row giving neither. The model is asked wherever a row standing names one,
 * even alone, since it says who made what is added; one option is chosen without asking, and a
 * name whose rows name no model is asked none, its one generic row being the one.
 *
 * #514 to #520 asked the size, the maker and the part number one by one, each a choice whose
 * empty option came first — `No size`, `No maker`, `No part #` — and drew a level of one option
 * as a choice holding it. The office's `Battery`, a DeWalt with no size beside two Milwaukees
 * sized M12 and M18, is why a level of several starts with none (#517): `Size` started on
 * `No size` then, which left DeWalt the one maker, chosen, for somebody adding a Milwaukee who
 * never touched the size. Here the size is asked among `M12`, `M18` and `None`, and the model
 * waits for it.
 *
 * `chosen` is what the reader chose, `{ size, model }`, an option's value each — `""` for a size
 * of `None`. A choice a choice before it has since taken away is read as never made, so the level
 * starts again rather than holding a value no row has. A level's `value` is `null` while it is
 * still to choose, `asked` says whether the step draws it, and `category` is the row once both
 * hold a value — the one row, since an offered path is one row.
 */
export function walkDetails(rows, chosen = {}) {
    const all = rows || [];
    const sizes = new Map();
    let unsized = false;
    for (const row of all) {
        const key = textMatchKey(row.size);
        if (key === "") unsized = true;
        else if (!sizes.has(key)) sizes.set(key, normalizeItemText(row.size));
    }
    const sizeOptions = [
        ...[...sizes].map(([value, label]) => ({ value, label })).sort((a, b) => compareSizes(a.label, b.label)),
        ...(unsized && sizes.size > 0 ? [{ value: "", label: ASSET_CATEGORY_COPY.leftEmpty.size, empty: true }] : []),
    ];
    const sizeValue = chosenOf(sizeOptions, chosen.size, sizes.size === 0 ? "" : null);
    const standing = sizeValue === null ? [] : all.filter((row) => textMatchKey(row.size) === sizeValue);

    const models = new Map();
    for (const row of standing) {
        const key = modelKeyOf(row);
        if (!models.has(key)) models.set(key, row);
    }
    const modelOptions = [...models]
        .sort(([, a], [, b]) => compareModels(a, b))
        .map(([value, row]) => ({ value, label: modelLabelOf(row), empty: !hasModel(row) }));
    const modelValue = chosenOf(modelOptions, chosen.model, null);

    const levels = [
        { level: "size", asked: sizeOptions.length > 1, options: sizeOptions, value: sizeValue },
        { level: "model", asked: standing.some(hasModel), options: modelOptions, value: modelValue },
    ];
    const category = modelValue === null ? null : (standing.find((row) => modelKeyOf(row) === modelValue) ?? null);
    return { levels, category };
}

/** A level's value: the option held, while one still holds it; else the one option there is; else `none`. */
function chosenOf(options, held, none) {
    if (options.some((option) => option.value === held)) return held;
    return options.length === 1 ? options[0].value : none;
}

/**
 * Every word the catalog says, on the two lists, the two pages a category's name heads and the
 * registration that picks one. The level words are the design's (#507, #514), and so are the
 * search's and the filters' since #520, which the category list's band and the registration's
 * first step say alike but for the search's own words, the registration's since #547, and the
 * second step's — `Model`, `None` and `Not specified` — and `docs/notes/tools.md` lists them.
 */
export const ASSET_CATEGORY_COPY = {
    // Each level's word, keyed by the level (#514): the list's columns until #519 and the base's
    // `Level 1` to `Part Number` in the order a path says them. The type, the category and the
    // class are what a filter chip says (#520), and the size what the second step asks first.
    levelLabel: { level1: "Type", level2: "Category", level3: "Name", size: "Size", maker: "Maker", partNumber: "Part #" },
    classLabel: "Class",
    // The second step's second choice, a row's maker and part number together (1b, #520).
    modelLabel: "Model",
    // The category list's search (1a, #520), and the × that empties it and
    // the registration's (1a, 1b). The registration's search said `Search items` too until #547
    // widened it past the name (`ASSET_REGISTRATION_COPY.searchLabel`).
    searchItems: "Search items",
    clearSearch: "Clear search",
    // The × that empties a filter chip, named for the filter (1a, 1b; #520).
    clearFilter: { level1: "Clear type filter", level2: "Clear category filter", assetClass: "Clear class filter" },
    // A choice left empty, as the chip that leaves it so (1b, #520): a size the row does not
    // give, and a model it names neither a maker nor a part number for — the design's words,
    // set in Ink 3. From #514 each level had its own, `No size`, `No maker` and `No part #`;
    // `None` is also what the catalog's check sets aside as a value (`isPlaceholder`), which a
    // row typed with it never reaches the dialog to collide with.
    leftEmpty: { size: "None", model: "Not specified" },
    // The class said beside a category, in the caption under its name: `Class A`, the value in Ink
    // inside a line at Ink 3 — parts rather than a string, so the component need not find
    // the value in it, as the registration's preview did with a tool's name (#456).
    classOf: (assetClass) => ["Class ", { emphasis: assetClass }],
};
