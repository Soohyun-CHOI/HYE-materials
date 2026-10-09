// The catalog a registration picks from (#507), in six levels since #514.
//
// WHAT THIS HOLDS. `lib/assetCategory.js` is the catalog's one implementation: its columns, the
// type's and the class's values, the expression the base names a row with, which rows a
// registration may pick, and the walk the registration's two steps narrow through. Each is
// pure and held here by value — the walk on a catalog typed the way an office types one by
// hand, with a category in another case and spacing, a generic row beside rows by a maker,
// equipment with no size, one name under two categories and under two types, every way a row
// can be incomplete, a placeholder typed for an empty level, and a path named twice.
//
// AND THAT NOTHING WRITES AN `Asset Categories` ROW. The office fills the catalog in Airtable and a
// registration picks a row, where until #507 it found or created one under a lock. No figure
// on a screen says whether a write is gone, so every use of the table under `app/` and `lib/`
// is read off the source, and each has to be a read.
//
// AND ONE SPELLING OF EACH FIELD. The reader in `lib/airtable/assetCategories.js`, the catalog's
// script and the demo catalog's take the fields' names from `ASSET_CATEGORY_FIELDS`, and the
// catalog's script the type's and the class's values, the expression and the catalog's reading
// from the module too; a literal of one of the seven names in any of them fails, since a second
// spelling is what a rename would miss. The one exception is read by value: the names #514's
// two renames start FROM, which are #507's and are what a field holding them is renamed from.
//
// WHAT IT CANNOT SEE. Whether the base's `Item Name` computes what `composeItemName` says — a
// formula is outside this tier (docs/notes/verification.md), and the catalog's script compares
// the two on every run — and the rows the office has typed, which the same script reports.
// What the registration does with the walk is `offline/asset-registration.mjs`'s, and what
// the lists hand it `offline/asset-list-view.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { relative } from "path";
import {
    MAX_NAME_SUGGESTIONS,
    ASSET_CATEGORY_COPY,
    ASSET_CATEGORY_FIELDS,
    ASSET_CLASS_VALUES,
    ASSET_OPTIONAL_LEVELS,
    ASSET_PATH_LEVELS,
    ASSET_PATH_SEPARATOR,
    ASSET_REQUIRED_LEVELS,
    ASSET_TYPE_VALUES,
    ITEM_NAME_FORMULA,
    catalogLevelValues,
    catalogNames,
    catalogRowsOf,
    compareCatalogText,
    composeItemName,
    findCatalogName,
    isPlaceholder,
    pathOf,
    readCatalog,
    registrationCatalog,
    suggestCatalogNames,
    walkDetails,
} from "../../../lib/assetCategory.js";
import { REPO_ROOT, listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The catalog an asset is chosen from, in six levels, and nothing writing a row of it (#507, #514)";

/** The reader of the table, and the two scripts that write the catalog's schema and its demo rows. */
const READER = "lib/airtable/assetCategories.js";
const SCRIPT = "scripts/import/classify_asset_categories_514.mjs";
const SEED = "scripts/demo/seed_asset_catalog_514.mjs";

/** A row as `recordToAssetCategory` returns it, named as the base would name it. */
const row = (id, [level1, level2, level3, size, maker, partNumber], assetClass) => ({
    id,
    itemName: composeItemName({ level3, size, maker, partNumber }),
    assets: [],
    level1,
    level2,
    level3,
    size,
    maker,
    partNumber,
    assetClass,
});

/**
 * A catalog typed by hand. The first seventeen rows are whole: the grinder at `4-1/2"` has a
 * generic row beside three by a maker, one of them with its category typed another way; the
 * drill has no generic row; the welding machine, the drill press and the compressor are
 * equipment with no size; the laser level is one name under two types and the utility knife
 * one under two categories. The ten after `knifeX` are each a way a row is not offered.
 */
const ROWS = [
    row("g45", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "", ""], "A"),
    row("g45mk30", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "Makita", "GA4530"], "A"),
    row("g45mk70", ["Tool", "machining ", "Angle Grinder", '4-1/2"', "Makita", "GA4570"], "A"),
    row("g45bo", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "Bosch", ""], "A"),
    row("g5", ["Tool", "Machining", "Angle Grinder", '5"', "", ""], "A"),
    row("drillDw", ["Tool", "Carpentry", "Cordless Drill", "18V", "DeWalt", "DCD791"], "B"),
    row("drillMw", ["Tool", "Carpentry", "Cordless Drill", "18V", "Milwaukee", "2801-20"], "B"),
    row("jig", ["Tool", "Carpentry", "Jigsaw", "T-Shank", "", ""], "B"),
    row("weldLi", ["Equipment", "Welding", "Welding Machine", "", "Lincoln", "POWER MIG 256"], "A"),
    row("weldMi", ["Equipment", "Welding", "Welding Machine", "", "Miller", "Millermatic 255"], "A"),
    row("press", ["Equipment", "Machining", "Drill Press", "", "", ""], "A"),
    row("pressJet", ["Equipment", "Machining", "Drill Press", "", "Jet", "JDP-17"], "A"),
    row("air", ["Equipment", "Site Services", "Air Compressor", "", "", ""], "B"),
    row("laserT", ["Tool", "Measuring", "Laser Level", "Cross-Line", "", ""], "B"),
    row("laserE", ["Equipment", "Measuring", "Laser Level", "Rotary", "", ""], "A"),
    row("knifeC", ["Tool", "Carpentry", "Utility Knife", "18mm", "", ""], "B"),
    row("knifeX", ["Tool", "Cutting", "Utility Knife", "25mm", "", ""], "B"),
    row("notype", ["", "Machining", "Bench Grinder", '8"', "", ""], "A"),
    row("vehicle", ["Vehicle", "Transport", "Forklift", "", "", ""], "A"),
    row("nocat", ["Tool", "  ", "Hammer Drill", "SDS-Plus", "", ""], "A"),
    row("noname", ["Tool", "Machining", "", "", "", ""], "A"),
    row("classC", ["Tool", "Concrete", "Rotary Hammer", "SDS-Max", "", ""], "C"),
    row("bare", ["", "", "", "", "", ""], ""),
    row("na", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "N/A", ""], "A"),
    row("dash", ["Equipment", "Welding", "Welding Machine", "-", "Lincoln", "POWER MIG 256"], "A"),
    row("none", ["Tool", "Carpentry", "Cordless Drill", "18V", "DeWalt", "None"], "B"),
    row("again", ["Tool", "machining", "angle  grinder", '4-1/2" ', "makita", "ga4530"], "B"),
];

/** Ids, for a list of rows. */
const ids = (categories) => categories.map((category) => category.id).join(",");

/** Names as a reader of the search sees them: the name, and its place beside it. */
const said = (names) => names.map((name) => `${name.level3} (${name.level1} > ${name.level2})`).join(", ");

/** A row set aside, with why: the fields it lacks, the levels holding a placeholder, or the row whose path it repeats. */
const asideOf = (setAside) =>
    setAside
        .map(({ category, reason, missing, levels, of }) => `${category.id}:${reason}:${reason === "incomplete" ? missing.join("+") : reason === "placeholder" ? levels.join("+") : of.id}`)
        .join(" ");

/** The second step as a reader sees it: each level it asks, its options and what it holds, then the row they make. */
const walked = (rows, chosen) => {
    const { levels, category } = walkDetails(rows, chosen);
    const asked = levels
        .filter((level) => level.asked)
        .map(({ level, options, value }) => `${level} ${options.map((option) => option.label).join("/")} = ${value === null ? "?" : options.find((option) => option.value === value).label}`);
    return `${asked.join(" · ")} → ${category?.id ?? "no row"}`;
};

/**
 * Every use of `TABLES.ASSET_CATEGORIES` in a parsed file, by what is done with it: the
 * method a `base(…)` call is followed by, the function it is handed to, or the node it
 * stands in otherwise — which names a binding, so a table kept in a variable is reported
 * rather than followed.
 */
function categoriesTableUses({ ast }) {
    const parents = parentMap(ast);
    const uses = [];
    walk(ast, (n) => {
        if (n.type !== "MemberExpression" || n.computed || n.object?.name !== "TABLES" || n.property?.name !== "ASSET_CATEGORIES") return;
        const parent = parents.get(n);
        if (parent?.type === "CallExpression" && parent.arguments.includes(n)) {
            if (parent.callee?.type === "Identifier" && parent.callee.name === "base") {
                const chained = parents.get(parent);
                uses.push(chained?.type === "MemberExpression" && chained.object === parent ? `base(…).${chained.property?.name}` : "base(…)");
            } else uses.push(parent.callee?.type === "Identifier" ? parent.callee.name : (parent.callee?.property?.name ?? parent.callee?.type));
        } else uses.push(parent?.type ?? "nothing");
    });
    return uses;
}

/** What may be done with the table: read it. */
const READS = new Set(["base(…).select", "base(…).find", "findByRecordIds", "getLinkedRecords", "findChildRecords"]);

/**
 * The string literals in a parsed file that spell one of the catalog's field names — and, apart,
 * those that are the value of a `from:` property, which is how a rename names the field it
 * starts from (#514).
 */
function fieldLiterals({ ast }) {
    const names = new Set(Object.values(ASSET_CATEGORY_FIELDS));
    const parents = parentMap(ast);
    const spelled = [];
    const renamedFrom = [];
    walk(ast, (n) => {
        const text = n.type === "Literal" ? n.value : n.type === "TemplateLiteral" && n.expressions.length === 0 ? n.quasis[0]?.value.cooked : null;
        if (typeof text !== "string" || !names.has(text)) return;
        const parent = parents.get(n);
        if (parent?.type === "Property" && parent.value === n && parent.key?.name === "from") renamedFrom.push(text);
        else spelled.push(text);
    });
    return { spelled: spelled.join(", "), renamedFrom: renamedFrom.join(", ") };
}

/** The names a file imports from `lib/assetCategory.js`, alphabetically. */
function importedFromModule({ ast }) {
    const imported = [];
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === "../../lib/assetCategory.js") imported.push(...n.specifiers.map((s) => s.imported.name));
    });
    return imported.sort().join(", ");
}

export function run({ check, assert, log }) {
    // ── 1: the columns, the type, the class and the name ────────────────────
    log("the catalog's columns, the type's and the class's values and the name the base gives a row:");
    check(
        "the seven fields, by what each holds",
        Object.entries(ASSET_CATEGORY_FIELDS)
            .map(([key, field]) => `${key}=${field}`)
            .join(", "),
        "level1=Level 1, level2=Level 2, level3=Level 3, size=Size, maker=Maker, partNumber=Part Number, assetClass=Class"
    );
    check("  the path outermost first: type, category, name, then size, maker, part number", ASSET_PATH_LEVELS.join(" > "), "level1 > level2 > level3 > size > maker > partNumber");
    check("  the three every row a registration may pick fills", ASSET_REQUIRED_LEVELS.join(", "), "level1, level2, level3");
    check("  and the three a row may leave empty, in the order the second step asks them", ASSET_OPTIONAL_LEVELS.join(", "), "size, maker, partNumber");
    check("  the type's two values, in the select's order", ASSET_TYPE_VALUES.join(", "), "Equipment, Tool");
    check("  the class's two values, in the select's order", ASSET_CLASS_VALUES.join(", "), "A, B");
    check("  the separator a path is said with, `lib/materialCategory.js`' own", ASSET_PATH_SEPARATOR, " > ");
    check(
        "the expression `Item Name` computes: the name and the size, a comma and the maker, the part number in parentheses",
        ITEM_NAME_FORMULA,
        'TRIM(TRIM(TRIM({Level 3}) & " " & TRIM({Size})) & IF(AND(TRIM(TRIM({Level 3}) & " " & TRIM({Size})), TRIM({Maker})), ", ") & TRIM({Maker}) & IF(TRIM({Part Number}), " (" & TRIM({Part Number}) & ")"))'
    );
    // ITS JAVASCRIPT TWIN, ON EVERY SHAPE A ROW TAKES: each empty level leaves out what stands
    // before it — no maker, no comma; no part number, no parentheses — and a part number with no
    // maker follows the size directly. A size the office types can carry its own parentheses,
    // `5" (127 mm)`, which come before the comma.
    for (const [category, expected, why] of [
        [{ level3: "Angle Grinder", size: '4-1/2"', maker: "Makita", partNumber: "GA4530" }, 'Angle Grinder 4-1/2", Makita (GA4530)', "  its JavaScript twin, on a row with all four"],
        [{ level3: "Angle Grinder", size: '5" (127 mm)', maker: "Makita", partNumber: "GA5030" }, 'Angle Grinder 5" (127 mm), Makita (GA5030)', "  a size with its own parentheses, before the comma"],
        [{ level3: "Welding Machine", size: "", maker: "Lincoln", partNumber: "POWER MIG 256" }, "Welding Machine, Lincoln (POWER MIG 256)", "  equipment with no size"],
        [{ level3: "Angle Grinder", size: '4-1/2"', maker: "Bosch", partNumber: "" }, 'Angle Grinder 4-1/2", Bosch', "  a maker and no part number, with no parentheses"],
        [{ level3: "Drill Press", size: "", maker: "", partNumber: "JDP-17" }, "Drill Press (JDP-17)", "  a part number and no maker, with no comma"],
        [{ level3: "Angle Grinder", size: '5"', maker: "", partNumber: "GA5030" }, 'Angle Grinder 5" (GA5030)', "  and after a size, the same"],
        [{ level3: "Drill Press", size: "", maker: "", partNumber: "" }, "Drill Press", "  a name alone, with no comma and no parentheses"],
        [{ level3: " Jigsaw ", size: " T-Shank ", maker: "  ", partNumber: "" }, "Jigsaw T-Shank", "  each level's spaces trimmed, one of only spaces empty"],
        [{ level3: "", size: "SDS-Plus" }, "SDS-Plus", "  a row without a name by its size alone"],
        [{ maker: "Jet" }, "Jet", "  and by its maker alone, with no comma before it"],
        [{ partNumber: "JDP-17" }, "(JDP-17)", "  and by its part number alone"],
        [undefined, "", "  and nothing by nothing"],
    ])
        check(why, composeItemName(category), expected);
    check("a path, outermost first, every level the row holds", pathOf(ROWS[1]), 'Tool > Machining > Angle Grinder > 4-1/2" > Makita > GA4530');
    check("  equipment's, with no size and no maker", pathOf(ROWS.find((r) => r.id === "air")), "Equipment > Site Services > Air Compressor");
    check("  a level the row lacks left out rather than drawn empty", pathOf(ROWS.find((r) => r.id === "nocat")), "Tool > Hammer Drill > SDS-Plus");
    check("  and a row with none says nothing", `${pathOf(ROWS.find((r) => r.id === "bare"))}|${pathOf(undefined)}|`, "||");

    // ── 2: a placeholder, and which rows a registration may pick ────────────
    log("");
    log("a value that only says a level is empty is a placeholder, and an empty one is empty:");
    for (const [value, expected] of [
        ["N/A", true],
        ["n.a.", true],
        ["NA", true],
        ["-", true],
        ["—", true],
        ["None", true],
        ["null", true],
        ["TBD", true],
        ["Unknown", true],
        ["", false],
        ["   ", false],
        [undefined, false],
        ["Bosch", false],
        ["N/A Series", false],
        ["0", false],
        ['1/2"', false],
    ])
        check(`  ${JSON.stringify(value)}`, isPlaceholder(value), expected);

    log("");
    log("a registration may pick a row with a type, a category, a name and a class, no placeholder, once per path:");
    const { offered, setAside } = readCatalog(ROWS);
    check(
        "the whole rows are offered, in the order they were read — a generic row beside a maker's among them",
        ids(offered),
        "g45,g45mk30,g45mk70,g45bo,g5,drillDw,drillMw,jig,weldLi,weldMi,press,pressJet,air,laserT,laserE,knifeC,knifeX"
    );
    // EACH WAY A ROW IS NOT OFFERED, WITH WHY: the type missing or not one of the two, a level
    // missing or only spaces, the class missing or not one of the two, a placeholder in any
    // level, and a path another row names in another case and spacing whatever its class.
    check(
        "  and every other row is set aside with why",
        asideOf(setAside),
        "notype:incomplete:level1 vehicle:incomplete:level1 nocat:incomplete:level2 noname:incomplete:level3 classC:incomplete:assetClass bare:incomplete:level1+level2+level3+assetClass na:placeholder:maker dash:placeholder:size none:placeholder:partNumber again:repeated:g45mk30"
    );
    // AN INCOMPLETE OR PLACEHOLDER ROW NAMES NO PATH, so the whole row after it on the same path is the one offered.
    const na = ROWS.find((r) => r.id === "na");
    const completed = readCatalog([na, { ...na, id: "naFixed", maker: "Metabo" }, { ...na, id: "naEmpty", maker: "" }]);
    check("a set-aside row names no path: the whole ones after it are offered", `${ids(completed.offered)} | ${asideOf(completed.setAside)}`, "naFixed,naEmpty | na:placeholder:maker");
    check("  and no catalog offers nothing", `${readCatalog(undefined).offered.length} ${readCatalog(undefined).setAside.length}`, "0 0");
    // WHAT THE DIALOG IS HANDED: the offered rows, their levels and class and nothing of their assets.
    const handed = registrationCatalog(ROWS);
    check("the dialog is handed the offered rows", ids(handed), ids(offered));
    check("  each with what it shows and narrows by, and no assets", Object.keys(handed[0]).join(", "), "id, itemName, assetClass, level1, level2, level3, size, maker, partNumber");
    check(
        "  each value its row's",
        Object.values(handed.find((entry) => entry.id === "g45mk30")).join(" | "),
        'g45mk30 | Angle Grinder 4-1/2", Makita (GA4530) | A | Tool | Machining | Angle Grinder | 4-1/2" | Makita | GA4530'
    );

    // ── 3: the first step's filters and search ───────────────────────────────
    log("");
    log("the first step's two filters and its search:");
    const values = (level, filters) =>
        catalogLevelValues(offered, level, filters)
            .map((v) => v.value)
            .join(", ");
    check("the types, each once, alphabetically", values("level1"), "Equipment, Tool");
    check("the categories, each once in the spelling of the first row holding it", values("level2"), "Carpentry, Cutting, Machining, Measuring, Site Services, Welding");
    check(
        "  keyed as typed text is compared",
        catalogLevelValues(offered, "level2")
            .map((v) => v.key)
            .join("|"),
        "carpentry|cutting|machining|measuring|site services|welding"
    );
    check("  under equipment, its categories alone", values("level2", { level1: "equipment" }), "Machining, Measuring, Site Services, Welding");
    check(
        "  a category typed three ways said as its first row says it",
        catalogLevelValues([{ level2: "Welding" }, { level2: " welding " }, { level2: "WELDING" }], "level2")
            .map((v) => v.value)
            .join(", "),
        "Welding"
    );
    check("  under a tool, its categories alone", values("level2", { level1: "tool" }), "Carpentry, Cutting, Machining, Measuring");
    check(
        "the names under no filter, by name and then category and type",
        said(catalogNames(offered)),
        "Air Compressor (Equipment > Site Services), Angle Grinder (Tool > Machining), Cordless Drill (Tool > Carpentry), Drill Press (Equipment > Machining), Jigsaw (Tool > Carpentry), Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring), Utility Knife (Tool > Carpentry), Utility Knife (Tool > Cutting), Welding Machine (Equipment > Welding)"
    );
    // THE CATEGORY SAID THE FILTER'S WAY: `g45mk70` typed it `machining `, and the search says it
    // as the filter does rather than a second way.
    check("  a name's category said as the filter says it, whatever its row typed", catalogNames(offered).find((n) => n.level3 === "Angle Grinder")?.level2, "Machining");
    // A NAME'S CATEGORY IS THE FILTER'S SPELLING EVEN WHERE THE NAME'S OWN ROW SPELLS IT ANOTHER
    // WAY, and two names of one word are ordered by category before type.
    const spelledAgain = [
        { level1: "Tool", level2: "Machining", level3: "Grinder" },
        { level1: "Tool", level2: "machining", level3: "File" },
    ];
    check("  a name whose own row spells its category another way says the filter's", said(catalogNames(spelledAgain)), "File (Tool > Machining), Grinder (Tool > Machining)");
    const twoPlaces = [
        { level1: "Equipment", level2: "Zeta", level3: "Level" },
        { level1: "Tool", level2: "Alpha", level3: "Level" },
    ];
    check("  one name in two places, by category before type", said(catalogNames(twoPlaces)), "Level (Tool > Alpha), Level (Equipment > Zeta)");
    check("  one name under two types is two", catalogNames(offered).filter((n) => n.level3 === "Laser Level").map((n) => n.key).join(" | "), "equipment\nmeasuring\nlaser level | tool\nmeasuring\nlaser level");
    check("  one name under two categories is two", catalogNames(offered).filter((n) => n.level3 === "Utility Knife").map((n) => n.key).join(" | "), "tool\ncarpentry\nutility knife | tool\ncutting\nutility knife");
    check("  under a type, its names alone", said(catalogNames(offered, { level1: "equipment" })), "Air Compressor (Equipment > Site Services), Drill Press (Equipment > Machining), Laser Level (Equipment > Measuring), Welding Machine (Equipment > Welding)");
    check("  under a category, its names alone", said(catalogNames(offered, { level2: "carpentry" })), "Cordless Drill (Tool > Carpentry), Jigsaw (Tool > Carpentry), Utility Knife (Tool > Carpentry)");
    check("  and under both, what both hold — here nothing", said(catalogNames(offered, { level1: "equipment", level2: "carpentry" })), "");
    check("the search offers at most", MAX_NAME_SUGGESTIONS, 5);
    check("  with nothing typed, the first of the names", said(suggestCatalogNames(offered)), "Air Compressor (Equipment > Site Services), Angle Grinder (Tool > Machining), Cordless Drill (Tool > Carpentry), Drill Press (Equipment > Machining), Jigsaw (Tool > Carpentry)");
    check("  a part typed, in any case and spacing, the names holding it", said(suggestCatalogNames(offered, { typed: "  LEVEL " })), "Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring)");
    check(
        "  more names holding it cut to the five first",
        said(suggestCatalogNames(offered, { typed: "e" })),
        "Air Compressor (Equipment > Site Services), Angle Grinder (Tool > Machining), Cordless Drill (Tool > Carpentry), Drill Press (Equipment > Machining), Laser Level (Equipment > Measuring)"
    );
    check("  narrowed by the category", said(suggestCatalogNames(offered, { filters: { level2: "measuring" } })), "Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring)");
    check("  and by the type", said(suggestCatalogNames(offered, { filters: { level1: "tool", level2: "measuring" } })), "Laser Level (Tool > Measuring)");
    check("  to nothing when the filters hold no such name", said(suggestCatalogNames(offered, { filters: { level2: "measuring" }, typed: "grinder" })), "");
    check("  a name typed in full is offered, since picking it goes on", said(suggestCatalogNames(offered, { typed: "drill press" })), "Drill Press (Equipment > Machining)");
    check("  and words in another order are not one name", said(suggestCatalogNames(offered, { typed: "press drill" })), "");
    // ENTER IN THE SEARCH TAKES THE ONE NAME TYPED, or nothing.
    check("Enter takes the one name typed, in any case and spacing", findCatalogName(offered, { typed: "drill  PRESS" })?.key, "equipment\nmachining\ndrill press");
    check("  not a part of one", findCatalogName(offered, { typed: "Drill" }), null);
    check("  not nothing", findCatalogName(offered, { typed: "   " }), null);
    check("  not a name two types hold, with none chosen", findCatalogName(offered, { typed: "Laser Level" }), null);
    check("  but that name under the type chosen", findCatalogName(offered, { filters: { level1: "tool" }, typed: "laser level" })?.key, "tool\nmeasuring\nlaser level");
    check("  not a name two categories hold, under its type alone", findCatalogName(offered, { filters: { level1: "tool" }, typed: "Utility Knife" }), null);
    check("  but that name under the category chosen", findCatalogName(offered, { filters: { level2: "cutting" }, typed: "utility knife" })?.key, "tool\ncutting\nutility knife");
    check("  and nothing under a category that does not hold it", findCatalogName(offered, { filters: { level2: "carpentry" }, typed: "Welding Machine" }), null);
    check("the rows under a name, the second step's to narrow between", ids(catalogRowsOf(offered, "tool\nmachining\nangle grinder")), "g45,g45mk30,g45mk70,g45bo,g5");
    check("  under its type alone, where one name has two", ids(catalogRowsOf(offered, "tool\nmeasuring\nlaser level")), "laserT");
    check("  and a name nothing holds has none", ids(catalogRowsOf(offered, "tool\nnowhere\nnothing")), "");

    // ── 4: the second step's walk ────────────────────────────────────────────
    log("");
    log("the second step asks the levels the name's rows hold, narrowing as it goes:");
    const grinder = catalogRowsOf(offered, "tool\nmachining\nangle grinder");
    // A LEVEL A ROW LEAVES EMPTY STARTS EMPTY, AND ONE NONE DOES IS 0l's CHOICE.
    check(
        "a size none leaves empty starts unchosen; a maker the generic row leaves empty starts there",
        walked(grinder, {}),
        'size 4-1/2"/5" = ? · maker No maker/Bosch/Makita = No maker · partNumber No part # = No part # → no row'
    );
    check("  a size chosen makes the generic row, every other level left empty", walked(grinder, { size: '4-1/2"' }), 'size 4-1/2"/5" = 4-1/2" · maker No maker/Bosch/Makita = No maker · partNumber No part # = No part # → g45');
    check("  a maker chosen narrows the part numbers to its own, none left empty", walked(grinder, { size: '4-1/2"', maker: "makita" }), 'size 4-1/2"/5" = 4-1/2" · maker No maker/Bosch/Makita = Makita · partNumber GA4530/GA4570 = ? → no row');
    check("  and one of them makes its row", walked(grinder, { size: '4-1/2"', maker: "makita", partNumber: "ga4570" }), 'size 4-1/2"/5" = 4-1/2" · maker No maker/Bosch/Makita = Makita · partNumber GA4530/GA4570 = GA4570 → g45mk70');
    check("  a maker with no part number leaves it empty, the one held read as never made", walked(grinder, { size: '4-1/2"', maker: "bosch", partNumber: "ga4570" }), 'size 4-1/2"/5" = 4-1/2" · maker No maker/Bosch/Makita = Bosch · partNumber No part # = No part # → g45bo');
    check("  a size with no maker starts the maker again", walked(grinder, { size: '5"', maker: "makita", partNumber: "ga4570" }), 'size 4-1/2"/5" = 5" · maker No maker = No maker · partNumber No part # = No part # → g5');
    check("  the empty option chosen as itself", walked(grinder, { size: '4-1/2"', maker: "" }), 'size 4-1/2"/5" = 4-1/2" · maker No maker/Bosch/Makita = No maker · partNumber No part # = No part # → g45');
    check(
        "equipment with no size is asked none, and a maker none leaves empty must be chosen",
        walked(catalogRowsOf(offered, "equipment\nwelding\nwelding machine"), {}),
        "maker Lincoln/Miller = ? · partNumber Millermatic 255/POWER MIG 256 = ? → no row"
    );
    check("  whose one part number is then already chosen", walked(catalogRowsOf(offered, "equipment\nwelding\nwelding machine"), { maker: "miller" }), "maker Lincoln/Miller = Miller · partNumber Millermatic 255 = Millermatic 255 → weldMi");
    check("equipment with a generic row starts on it", walked(catalogRowsOf(offered, "equipment\nmachining\ndrill press"), {}), "maker No maker/Jet = No maker · partNumber No part # = No part # → press");
    check("  and takes its maker's row by its maker", walked(catalogRowsOf(offered, "equipment\nmachining\ndrill press"), { maker: "jet" }), "maker No maker/Jet = Jet · partNumber JDP-17 = JDP-17 → pressJet");
    check("a name with one row and no levels asks nothing and is that row", walked(catalogRowsOf(offered, "equipment\nsite services\nair compressor"), {}), " → air");
    check("a name with one size has it already chosen (0l)", walked(catalogRowsOf(offered, "tool\ncarpentry\njigsaw"), {}), "size T-Shank = T-Shank → jig");
    check("  and no rows ask nothing and make no row", walked([], {}), " → no row");
    // WHICH LEVELS ARE ASKED IS THE NAME'S, NOT THE CHOICES': the grinder's part number is asked
    // under its generic size too, where every row under that size leaves it empty.
    check(
        "the levels asked do not change with what is chosen",
        walkDetails(grinder, { size: '5"' })
            .levels.map((level) => `${level.level}:${level.asked}`)
            .join(" "),
        "size:true maker:true partNumber:true"
    );
    // THE ORDER EVERY ASSET LIST SAYS WORDS IN, which the category list sorts its rows by too.
    check(
        "words by their spelling, case aside, and a run of digits as a number",
        ['Circular Saw 10"', 'circular saw 7-1/4"', 'Angle Grinder 5"'].sort(compareCatalogText).join(" | "),
        'Angle Grinder 5" | circular saw 7-1/4" | Circular Saw 10"'
    );

    // ── 5: the words ─────────────────────────────────────────────────────────
    log("");
    log("every word the catalog says:");
    check(
        "each level's word, in the path's order",
        ASSET_PATH_LEVELS.map((level) => ASSET_CATEGORY_COPY.levelLabel[level]).join(" | "),
        "Type | Category | Name | Size | Maker | Part #"
    );
    check("  a word for every level and no other", Object.keys(ASSET_CATEGORY_COPY.levelLabel).join(" "), ASSET_PATH_LEVELS.join(" "));
    check("  and the class's", ASSET_CATEGORY_COPY.classLabel, "Class");
    check("the two filters with nothing chosen, `All jobs`' shape", `${ASSET_CATEGORY_COPY.allOf.level1} | ${ASSET_CATEGORY_COPY.allOf.level2}`, "All types | All categories");
    check(
        "  the search and each level the second step asks while nothing is chosen, `Choose a job`'s",
        Object.entries(ASSET_CATEGORY_COPY.unchosen)
            .map(([level, word]) => `${level}=${word}`)
            .join(" | "),
        "level3=Choose a name | size=Choose a size | maker=Choose a maker | partNumber=Choose a part #"
    );
    check(
        "  each level a row may leave empty, as the option that leaves it so",
        Object.entries(ASSET_CATEGORY_COPY.leftEmpty)
            .map(([level, word]) => `${level}=${word}`)
            .join(" | "),
        "size=No size | maker=No maker | partNumber=No part #"
    );
    const classParts = ASSET_CATEGORY_COPY.classOf("A");
    check(
        "  and the class beside a kind, its value the part in Ink",
        `${classParts.map((part) => (typeof part === "string" ? part : part.emphasis)).join("")} | ${classParts.filter((part) => typeof part !== "string").map((part) => part.emphasis).join()}`,
        "Class A | A"
    );

    // ── 6: nothing writes an `Asset Categories` row, and each field has one spelling ──────
    log("");
    log("every use of the table is a read, and the catalog's fields are spelled once:");
    const uses = [];
    for (const abs of [...listJsFiles(repoPath("app")), ...listJsFiles(repoPath("lib"))]) {
        const file = toPosix(relative(REPO_ROOT, abs));
        for (const use of categoriesTableUses(parseFile(file))) uses.push({ file, use });
    }
    log(`  ${uses.map(({ file, use }) => `${file} ${use}`).join("; ")}`);
    assert(`the table's uses under app/ and lib/ are found (${uses.length})`, uses.length >= 3);
    check(
        "  and every one is a read",
        uses
            .filter(({ use }) => !READS.has(use))
            .map(({ file, use }) => `${file} ${use}`)
            .join("; "),
        ""
    );
    // THE READER READS: its two exports, and no writer beside them.
    const exported = [];
    walk(parseFile(READER).ast, (n) => {
        if (n.type === "ExportNamedDeclaration" && n.declaration?.id) exported.push(n.declaration.id.name);
    });
    check(`${READER} exports its two readers and nothing else`, exported.sort().join(", "), "getAllAssetCategories, getAssetCategoriesByRecordIds");
    // ONE SPELLING: each field the reader takes off a record is the module's, beside the two
    // fields that are not the catalog's own.
    const got = [];
    const reader = parseFile(READER);
    walk(reader.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "get") got.push(reader.source.slice(n.arguments[0].start, n.arguments[0].end));
    });
    check(
        "  reading each catalog field by the module's name for it",
        got.sort().join(", "),
        '"Assets", "Item Name", ASSET_CATEGORY_FIELDS.assetClass, ASSET_CATEGORY_FIELDS.level1, ASSET_CATEGORY_FIELDS.level2, ASSET_CATEGORY_FIELDS.level3, ASSET_CATEGORY_FIELDS.maker, ASSET_CATEGORY_FIELDS.partNumber, ASSET_CATEGORY_FIELDS.size'
    );
    check("  and spelling none of them", fieldLiterals(reader).spelled, "");
    const script = parseFile(SCRIPT);
    check(
        "the catalog's script takes the fields, both selects' values, the expression and the reading from the module",
        importedFromModule(script),
        "ASSET_CATEGORY_FIELDS, ASSET_CLASS_VALUES, ASSET_TYPE_VALUES, ITEM_NAME_FORMULA, composeItemName, readCatalog"
    );
    check("  and spells none of the fields", fieldLiterals(script).spelled, "");
    // THE TWO NAMES IT RENAMES FROM ARE #507's, in the order they must run: `Level 2` out of the way first.
    check("  but the two #507 names its renames start from, `Level 2` first", fieldLiterals(script).renamedFrom, "Level 2, Level 1");
    const seed = parseFile(SEED);
    check("the demo catalog's script takes the fields, the name's rule and the reading from the module", importedFromModule(seed), "ASSET_CATEGORY_FIELDS, composeItemName, readCatalog");
    check("  and spells none of the fields", `${fieldLiterals(seed).spelled}|${fieldLiterals(seed).renamedFrom}`, "|");

    // ── anti-vacuity ──────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // The two readers above, on a planted file writing the table three ways and spelling three
    // fields, one of them as the field a rename starts from: each write is reported, and so is
    // each spelling, the rename's apart.
    const planted = parseSource(
        "await base(TABLES.ASSET_CATEGORIES).create([{ fields: {} }]);\n" +
            "await createRecords(TABLES.ASSET_CATEGORIES, 'Item Name', [], rowOf);\n" +
            "const table = TABLES.ASSET_CATEGORIES;\n" +
            "const tools = await base(TABLES.ASSET_CATEGORIES).select().all();\n" +
            "record.get('Level 1');\n" +
            "const field = `Part Number`;\n" +
            "const rename = { from: 'Level 3', to: 'Level 4' };\n",
        "<planted-writer>"
    );
    check(
        "  three writes and a read are seen as such, the read admitted",
        categoriesTableUses(planted)
            .map((use) => `${use}:${READS.has(use) ? "read" : "not"}`)
            .join(", "),
        "base(…).create:not, createRecords:not, VariableDeclarator:not, base(…).select:read"
    );
    check("  two spelled fields are seen, and a rename's field apart", `${fieldLiterals(planted).spelled} / ${fieldLiterals(planted).renamedFrom}`, "Level 1, Part Number / Level 3");
    // The catalog's reading is seen to tell rows apart, since "every row offered" and "every
    // row set aside" are also what a reading answering one way for all would give — and every
    // way a row is set aside is reached.
    assert("  the fixture is both offered from and set aside from", offered.length > 0 && setAside.length > 0);
    check("  by each of the three reasons", [...new Set(setAside.map((aside) => aside.reason))].sort().join(", "), "incomplete, placeholder, repeated");
    assert("  and the search offers something for nothing typed", suggestCatalogNames(offered).length === MAX_NAME_SUGGESTIONS);
    // The walk is seen to make a row and to make none, and to ask and leave a level unasked.
    const walks = [walkDetails(grinder, {}), walkDetails(grinder, { size: '4-1/2"' }), walkDetails(catalogRowsOf(offered, "equipment\nsite services\nair compressor"), {})];
    assert("  the walk both makes a row and makes none", walks.some((w) => w.category) && walks.some((w) => !w.category));
    assert("  and both asks a level and leaves one unasked", walks.some((w) => w.levels.some((l) => l.asked)) && walks.some((w) => w.levels.some((l) => !l.asked)));
}

if (isMain(import.meta.url)) standalone(title, run);
