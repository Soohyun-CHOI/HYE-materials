// The catalog a tool is chosen from (#507). `Tools` IS the catalog: a row is one tool — the
// kind it is bought as — named by where it sits, a category, a tool and a size, and carrying
// a class. The office fills it in Airtable, and the app never writes a `Tools` row: a
// registration picks a row and writes tool items under it. This module holds the catalog's
// columns, the class's two values, the expression the base names a tool with, which rows a
// registration may pick, the walk the registration narrows through, and every word the
// catalog says.
//
// THREE LEVELS, SIZE ALWAYS LAST. `Level 1` is the category, `Level 2` the tool and `Size`
// the size, and a screen says `Category`, `Tool` and `Size`. The two first are numbered
// because a level the catalog grows goes in the middle, as a field inserted between them and
// `Size` when it is wanted; no empty field waits for it. A tool's name is `{Level 2} {Size}`
// — `DEMO Angle Grinder 4-1/2"` — the way the design draws it, so the category is said
// beside a name and never inside one. `tool` is still a `Tools` row in this code, as the
// table's name makes it (naming.md); the second level is `level2` here, its field's name,
// and `Tool` only on a screen.
//
// THE NAME IS THE BASE'S, AND THIS MODULE IS WHERE ITS EXPRESSION IS EDITED. `Tool Name` is a
// formula since #507, so a row the office adds is named the moment its levels are typed, and
// every screen that names a tool reads that field. `TOOL_NAME_FORMULA` is generated from
// `TOOL_CATALOG_FIELDS` and `scripts/import/create_tool_catalog_507.mjs` PATCHes it onto the
// field. `composeToolName` is the same rule in JavaScript and is read by that script alone,
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
// THE CLASS IS INFORMATION. `A` for a tool that matters more, usually a dearer one, and `B`
// otherwise; no act — adding, a label, a check-out — reads it, and a design must not make one
// do so.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled out, which
// is `lib/materialPriceView.js`' precedent (#19): the offline tier runs under plain `node`,
// and the registration dialog is a "use client" file that reads it.

import { textMatchKey } from "./itemNaming.js";

/**
 * The catalog's columns on `Tools`, by what each holds. `Tool Name` is not here: it is the
 * row's name, computed from two of these, and every reader takes it from `recordToTool`.
 */
export const TOOL_CATALOG_FIELDS = Object.freeze({
    level1: "Level 1",
    level2: "Level 2",
    size: "Size",
    toolClass: "Class",
});

/** A tool's path, outermost first — the order a screen says it in and a registration narrows by. */
export const TOOL_PATH_LEVELS = Object.freeze(["level1", "level2", "size"]);

/**
 * The class a tool carries (#507), and the select's two options on the base. Created with
 * the field, colors and all, since a select's option list cannot be PATCHed afterwards
 * (`docs/notes/airtable-access.md`).
 */
export const TOOL_CLASS_VALUES = Object.freeze(["A", "B"]);

/** Between two levels of a path said as one string — `lib/materialCategory.js`' separator, for its reason: a size holds a slash. */
export const TOOL_PATH_SEPARATOR = " > ";

/** `Tools."Tool Name"`'s expression: the tool and the size, a space between, nothing at either end. */
export const TOOL_NAME_FORMULA = `TRIM({${TOOL_CATALOG_FIELDS.level2}} & " " & {${TOOL_CATALOG_FIELDS.size}})`;

/**
 * The name the formula above gives a tool, in JavaScript, for the creation script to check
 * the base's answer against (the header). No screen calls it: a screen reads the base's.
 */
export function composeToolName(tool) {
    return `${tool?.level2 ?? ""} ${tool?.size ?? ""}`.trim();
}

/**
 * A tool's path said as one string — `DEMO Power Tools > DEMO Angle Grinder > 4-1/2"` — the
 * caption the tool's own page and a tool item's page say under the name. A level the row does
 * not have is left out rather than drawn empty.
 */
export function pathOf(tool) {
    return TOOL_PATH_LEVELS.map((level) => tool?.[level] ?? "")
        .filter((value) => value.trim() !== "")
        .join(TOOL_PATH_SEPARATOR);
}

/** The key two rows share when they name one path: each level under `textMatchKey`. */
function pathKey(tool) {
    return TOOL_PATH_LEVELS.map((level) => textMatchKey(tool[level])).join("\n");
}

/**
 * Which rows a registration may pick, and which it may not and why (#507).
 *
 * A ROW IS OFFERED WITH ALL THREE LEVELS AND ONE OF THE TWO CLASSES, AND ONCE PER PATH. A
 * level of nothing but spaces is no level. A second row naming a path the first already
 * names is set aside rather than offered beside it: two tools with one path would be one
 * choice in the walk below with two rows behind it, and `docs/notes/materials.md` records
 * why a catalog refuses to let a row win silently. Here the row that came first in the read
 * is offered and the other is reported, since the catalog is typed by hand and a refusal of
 * the whole list would stop every registration over one row.
 *
 * `setAside` carries each row it did not offer with `reason` — `incomplete`, naming the
 * fields it lacks, or `repeated`, naming the row it repeats — for the creation script's
 * report. No screen reads it.
 */
export function readCatalog(tools) {
    const offered = [];
    const setAside = [];
    const firstOfPath = new Map();
    for (const tool of tools || []) {
        const missing = TOOL_PATH_LEVELS.filter((level) => textMatchKey(tool[level]) === "");
        if (!TOOL_CLASS_VALUES.includes(tool.toolClass)) missing.push("toolClass");
        if (missing.length > 0) {
            setAside.push({ tool, reason: "incomplete", missing });
            continue;
        }
        const key = pathKey(tool);
        if (firstOfPath.has(key)) {
            setAside.push({ tool, reason: "repeated", of: firstOfPath.get(key) });
            continue;
        }
        firstOfPath.set(key, tool);
        offered.push(tool);
    }
    return { offered, setAside };
}

/**
 * Two words in the order every tool list says them: by the base's own spelling, case and
 * accents aside, a run of digits read as a number — so `Circular Saw 7-1/4"` comes before
 * `Circular Saw 10"`, which a name ending in its size (#507) makes an everyday pair. The
 * tool list sorts its rows by it (`summarizeTools`) and the registration its categories,
 * names and sizes.
 */
export function compareToolText(a, b) {
    return String(a ?? "").localeCompare(String(b ?? ""), "en", { sensitivity: "base", numeric: true });
}

/**
 * The categories the offered rows hold, each once in the spelling of the first row that has
 * it, alphabetically — the registration's filter (#507), after `All categories`.
 */
export function catalogCategories(catalog) {
    const categories = new Map();
    for (const tool of catalog || []) {
        const key = textMatchKey(tool.level1);
        if (!categories.has(key)) categories.set(key, { key, level1: tool.level1 });
    }
    return [...categories.values()].sort((a, b) => compareToolText(a.level1, b.level1));
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
    for (const tool of catalog || []) {
        const category = textMatchKey(tool.level1);
        if (categoryKey && category !== categoryKey) continue;
        const key = `${category}\n${textMatchKey(tool.level2)}`;
        if (!names.has(key)) names.set(key, { key, level1: spelled.get(category), level2: tool.level2 });
    }
    return [...names.values()].sort((a, b) => compareToolText(a.level2, b.level2) || compareToolText(a.level1, b.level1));
}

/** The most names the search offers at once — 1b's five, which the typed name's suggestions took until #507. */
export const MAX_TOOL_SUGGESTIONS = 5;

/**
 * The names the registration's search offers for what is typed (#507): every name under the
 * filter that holds it, compared under `textMatchKey`, at most `MAX_TOOL_SUGGESTIONS`, and
 * with nothing typed the first of them — so the list opens on something to pick. A name typed
 * in full is offered too, since picking it is how the reader goes on.
 */
export function suggestCatalogNames(catalog, { categoryKey = "", typed = "" } = {}) {
    const want = textMatchKey(typed);
    return catalogNames(catalog, categoryKey)
        .filter((name) => textMatchKey(name.level2).includes(want))
        .slice(0, MAX_TOOL_SUGGESTIONS);
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

/** The offered rows under one name, by size — the sizes it is held in, each one tool. */
export function catalogSizes(catalog, nameKey) {
    return (catalog || [])
        .filter((tool) => `${textMatchKey(tool.level1)}\n${textMatchKey(tool.level2)}` === nameKey)
        .sort((a, b) => compareToolText(a.size, b.size));
}

/**
 * The tool a choice of size starts on: the one size a name is held in, already chosen, and
 * none of several (0l — a choice with one option is already chosen).
 */
export function onlySize(sizes) {
    return Array.isArray(sizes) && sizes.length === 1 ? sizes[0] : null;
}

/**
 * Every word the catalog says, on the two lists, the two pages that head a tool and the
 * registration that picks one. The level words are the design's (#507); `All categories`
 * is the job filter's `All jobs` (`lib/listFilters.js`) for the same choice one field over.
 */
export const TOOL_CATALOG_COPY = {
    categoryLabel: "Category",
    toolLabel: "Tool",
    sizeLabel: "Size",
    classLabel: "Class",
    // The filter with nothing chosen, first among the categories (#507).
    allCategories: "All categories",
    // What the search and the size say while nothing is chosen — `Choose a job`'s shape (0l).
    toolUnchosen: "Choose a tool",
    sizeUnchosen: "Choose a size",
    // The class said beside a tool, in the caption under its name: `Class A`, the value in Ink
    // inside a line at Ink 3 — parts rather than a string, so the component need not find
    // the value in it, as the registration's preview did with a tool's name (#456).
    classOf: (toolClass) => ["Class ", { emphasis: toolClass }],
};
