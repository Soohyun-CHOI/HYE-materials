// The catalog a registration picks from (#507), in six levels since #514.
//
// WHAT THIS HOLDS. `lib/assetCategory.js` is the catalog's one implementation: its columns, the
// type's values — the class's too until #552 — the expression the base names a row with, the key one path is
// compared by, which rows a registration may pick, and the walk the registration's two steps
// narrow through — every level 0l's choice since #517, the empty option one of them. Each is
// pure and held here by value — the walk on a catalog typed the way an office types one by
// hand, with a category in another case and spacing, a generic row beside rows by a maker,
// equipment with no size, one name under two categories and under two types, every way a row
// can be incomplete, a placeholder typed for an empty level, and a path named twice. And since
// #528 the groups a row's type and category stand in: which rows of `Asset Category Groups`
// stand, on a list typed the same way, and which catalog rows no group holds. And since #527 the
// mark a row the office no longer buys carries, `Discontinued`: such a row is not offered and
// still holds its path, on a small catalog of its own so the fixture above reads as it did. And
// since #547 the first step's search over every level of a row — which names it lists and in
// what order, what each says beside its name and what the second step opens with chosen — on a
// catalog of its own shaped as the office's.
//
// AND THAT ONE MODULE WRITES AN `Asset Categories` ROW, FOR ONE PAGE (#527). The office keeps the
// catalog — its first rows loaded from its own list by a script (#517), and since #527 on the
// catalog's own page — and a registration picks a row, where until #507 it found or created one
// under a lock. No figure on a screen says whether a write is gone or a second writer has come,
// so every use of the table under `app/` and `lib/` is read off the source: each outside
// `lib/airtable/assetCategories.js` has to be a read, the writes inside it are the five the
// catalog's page makes, and nothing but that page's actions imports one. From #507 until #527
// every use had to be a read.
//
// AND ONE SPELLING OF EACH FIELD. The reader in `lib/airtable/assetCategories.js`, the catalog's
// script, the demo catalog's, the office catalog's load and the demo's removal (#517) and the
// revised list's replacement (#528) take the fields' names from `ASSET_CATEGORY_FIELDS`, and
// the catalog's script the type's values, the expression and the readings from
// the module too, as the load, the removal and the replacement take the readings and the keys;
// a literal of one of the six names in any of them fails, since a second spelling is what a
// rename would miss. The one exception is
// read by value: the names #514's two renames start FROM, which are #507's and are what a field
// holding them is renamed from.
//
// WHAT IT CANNOT SEE. Whether the base's `Item Name` computes what `composeItemName` says — a
// formula is outside this tier (docs/notes/verification.md), and the catalog's script compares
// the two on every run — and the rows the office has typed, which the same script reports.
// What the registration does with the walk is `offline/asset-registration.mjs`'s, and what
// the lists hand it `offline/asset-list-view.mjs`'s.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { posix, relative } from "path";
import * as assetCategoryModule from "../../../lib/assetCategory.js";
import {
    ASSET_CATEGORY_COPY,
    ASSET_CATEGORY_FIELDS,
    ASSET_GROUP_LEVELS,
    ASSET_MODEL_LEVELS,
    ASSET_PATH_LEVELS,
    ASSET_PATH_SEPARATOR,
    ASSET_REQUIRED_LEVELS,
    ASSET_TYPE_VALUES,
    ASSET_WRITTEN_LEVELS,
    DISCONTINUED_FIELD,
    ITEM_NAME_FORMULA,
    catalogFieldsOf,
    catalogLevelValues,
    catalogNames,
    catalogPathKey,
    catalogRowsOf,
    categoryGroupKey,
    compareCatalogText,
    compareSizes,
    composeItemName,
    groupCatalog,
    groupLevelOf,
    isPlaceholder,
    pathOf,
    readCatalog,
    readCategoryGroups,
    registrationCatalog,
    searchCatalogNames,
    walkDetails,
} from "../../../lib/assetCategory.js";
import { REPO_ROOT, listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The catalog an asset is chosen from, in six levels, its groups, and one writer of its rows (#507, #514, #517, #527, #528, #547)";

/**
 * The module that reads the table and, since #527, writes it; the two scripts that write the
 * catalog's schema and its demo rows; and the two that load the office's rows and remove the
 * demo's (#517).
 */
const READER = "lib/airtable/assetCategories.js";
// The one file that may import a writer of `READER`'s, the catalog page's actions (#527), and
// the writers it may import.
const CATALOG_ACTIONS = "app/(assets)/asset-catalog/actions.js";
const WRITERS = ["createAssetCategory", "removeAssetCategory", "setAssetCategoryDiscontinued", "updateAssetCategory"];
const SCRIPT = "scripts/import/classify_asset_categories_514.mjs";
const SEED = "scripts/demo/seed_asset_catalog_514.mjs";
const LOAD = "scripts/import/ran/load_asset_catalog_517.mjs";
const REMOVAL = "scripts/demo/remove_demo_catalog_517.mjs";
const REPLACEMENT = "scripts/import/ran/replace_asset_catalog_528.mjs";

/** A row as `recordToAssetCategory` returns it, named as the base would name it — with no class since #552. */
const row = (id, [level1, level2, level3, size, maker, partNumber]) => ({
    id,
    itemName: composeItemName({ level3, size, maker, partNumber }),
    assets: [],
    level1,
    level2,
    level3,
    size,
    maker,
    partNumber,
});

/**
 * A catalog typed by hand. The first seventeen rows are whole: the grinder at `4-1/2"` has a
 * generic row beside three by a maker, one of them with its category typed another way; the
 * drill has no generic row; the welding machine, the drill press and the compressor are
 * equipment with no size; the laser level is one name under two types and the utility knife
 * one under two categories. The nine after `knifeX` are each a way a row is not offered — ten
 * until #552, when a class outside the two stopped being one.
 */
const ROWS = [
    row("g45", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "", ""]),
    row("g45mk30", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "Makita", "GA4530"]),
    row("g45mk70", ["Tool", "machining ", "Angle Grinder", '4-1/2"', "Makita", "GA4570"]),
    row("g45bo", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "Bosch", ""]),
    row("g5", ["Tool", "Machining", "Angle Grinder", '5"', "", ""]),
    row("drillDw", ["Tool", "Carpentry", "Cordless Drill", "18V", "DeWalt", "DCD791"]),
    row("drillMw", ["Tool", "Carpentry", "Cordless Drill", "18V", "Milwaukee", "2801-20"]),
    row("jig", ["Tool", "Carpentry", "Jigsaw", "T-Shank", "", ""]),
    row("weldLi", ["Equipment", "Welding", "Welding Machine", "", "Lincoln", "POWER MIG 256"]),
    row("weldMi", ["Equipment", "Welding", "Welding Machine", "", "Miller", "Millermatic 255"]),
    row("press", ["Equipment", "Machining", "Drill Press", "", "", ""]),
    row("pressJet", ["Equipment", "Machining", "Drill Press", "", "Jet", "JDP-17"]),
    row("air", ["Equipment", "Site Services", "Air Compressor", "", "", ""]),
    row("laserT", ["Tool", "Measuring", "Laser Level", "Cross-Line", "", ""]),
    row("laserE", ["Equipment", "Measuring", "Laser Level", "Rotary", "", ""]),
    row("knifeC", ["Tool", "Carpentry", "Utility Knife", "18mm", "", ""]),
    row("knifeX", ["Tool", "Cutting", "Utility Knife", "25mm", "", ""]),
    row("notype", ["", "Machining", "Bench Grinder", '8"', "", ""]),
    row("vehicle", ["Vehicle", "Transport", "Forklift", "", "", ""]),
    row("nocat", ["Tool", "  ", "Hammer Drill", "SDS-Plus", "", ""]),
    row("noname", ["Tool", "Machining", "", "", "", ""]),
    row("bare", ["", "", "", "", "", ""]),
    row("na", ["Tool", "Machining", "Angle Grinder", '4-1/2"', "N/A", ""]),
    row("dash", ["Equipment", "Welding", "Welding Machine", "-", "Lincoln", "POWER MIG 256"]),
    row("none", ["Tool", "Carpentry", "Cordless Drill", "18V", "DeWalt", "None"]),
    row("again", ["Tool", "machining", "angle  grinder", '4-1/2" ', "makita", "ga4530"]),
];

/**
 * `Asset Category Groups` typed by hand (#528). The first seven stand: four pairs the catalog
 * above files under, one of them typed another way (`machining `); `Measuring` under one type
 * of its two; `Lift Equipment`, under which nothing is filed; and `Concrete`, under which the
 * one row is set aside. The six after are each a way a row is no group.
 */
const GROUP_ROWS = [
    { id: "gMach", level1: "Tool", level2: "Machining" },
    { id: "gCarp", level1: "Tool", level2: "Carpentry" },
    { id: "gWeld", level1: "Equipment", level2: "Welding" },
    { id: "gEqMach", level1: "Equipment", level2: "machining " },
    { id: "gMeasT", level1: "Tool", level2: "Measuring" },
    { id: "gLift", level1: "Equipment", level2: "Lift Equipment" },
    { id: "gConcrete", level1: "Tool", level2: "Concrete" },
    { id: "gNoType", level1: "", level2: "Pressure" },
    { id: "gVehicle", level1: "Vehicle", level2: "Transport" },
    { id: "gNoCat", level1: "Tool", level2: "  " },
    { id: "gBare", level1: "", level2: "" },
    { id: "gNA", level1: "Tool", level2: "N/A" },
    { id: "gAgain", level1: "Tool", level2: "MACHINING" },
];

/** Ids, for a list of rows. */
const ids = (categories) => categories.map((category) => category.id).join(",");

/** Names as a reader of the search sees them: the name, and its place beside it. */
const said = (names) => names.map((name) => `${name.level3} (${name.level1} > ${name.level2})`).join(", ");

/**
 * A row set aside, with why: the fields it lacks, the levels holding a placeholder, or the row
 * whose path it repeats — and for a discontinued row (#527), which carries nothing more, the
 * reason alone.
 */
const asideOf = (setAside) =>
    setAside
        .map(({ category, reason, missing, levels, of }) => {
            const why = reason === "incomplete" ? missing.join("+") : reason === "placeholder" ? levels.join("+") : reason === "repeated" ? of.id : "";
            return why ? `${category.id}:${reason}:${why}` : `${category.id}:${reason}`;
        })
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

/** What may be done with the table anywhere: read it. */
const READS = new Set(["base(…).select", "base(…).find", "findByRecordIds", "getLinkedRecords", "findChildRecords"]);

/**
 * The files in `files` that import one of `names` from a module whose specifier ends in
 * `module` — `@/lib/airtable/assetCategories` and a relative path alike — each with what it
 * imports.
 */
export function importersOf(files, module, names) {
    const found = [];
    for (const { file, ast } of files) {
        walk(ast, (n) => {
            if (n.type !== "ImportDeclaration" || !String(n.source?.value ?? "").replace(/\.js$/, "").endsWith(module)) return;
            const taken = n.specifiers.map((s) => s.imported?.name).filter((name) => names.includes(name));
            if (taken.length > 0) found.push(`${file}: ${taken.sort().join(" ")}`);
        });
    }
    return found.sort();
}

/**
 * The string literals in a parsed file that spell one of the catalog's field names — and, apart,
 * those that are the value of a `from:` property, which is how a rename names the field it
 * starts from (#514).
 */
function fieldLiterals({ ast }) {
    const names = new Set([...Object.values(ASSET_CATEGORY_FIELDS), DISCONTINUED_FIELD]);
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

/** The names a file imports from `lib/assetCategory.js`, alphabetically, spelled from the file's own directory. */
function importedFromModule({ ast, relPath }) {
    const specifier = posix.relative(posix.dirname(relPath), "lib/assetCategory.js");
    const imported = [];
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === specifier) imported.push(...n.specifiers.map((s) => s.imported.name));
    });
    return imported.sort().join(", ");
}

export function run({ check, assert, log }) {
    // ── #539: a row's type and category, read through its group ──────────────
    log("a catalog row's type and category, read through the group it links (#539):");
    check("a lookup through one group is that group's value", groupLevelOf(["Tool"]), "Tool");
    check("a lookup through two groups is no value", groupLevelOf(["Tool", "Equipment"]), "");
    check("a lookup through no group is no value", groupLevelOf([]), "");
    check("a typed value is no value, both bases reading lookups (#555)", groupLevelOf("Equipment"), "");
    check("an absent field is no value", groupLevelOf(undefined), "");
    const looked = catalogFieldsOf({
        "Level 1": ["Tool"],
        "Level 2": ["Power Tools"],
        "Level 3": "Drill",
        Size: "18V",
        "Part Number": "DCD791",
        Class: "B",
    });
    check(
        "a record's fields read as the catalog's path, the group's two through their lookups, and a class it still carries read past (#552)",
        JSON.stringify(looked),
        JSON.stringify({ level1: "Tool", level2: "Power Tools", level3: "Drill", size: "18V", maker: "", partNumber: "DCD791" })
    );
    const doubled = catalogFieldsOf({ "Level 1": ["Tool", "Tool"], "Level 2": ["Power Tools", "Cutter"], "Level 3": "Drill", Class: "B" });
    check("a row filed under two groups reads no type and no category", `${doubled.level1}|${doubled.level2}`, "|");
    const aside = readCatalog([{ id: "r", itemName: "Drill", ...doubled }]).setAside[0];
    check("  and is set aside as missing both", `${aside?.reason}: ${aside?.missing?.join(", ")}`, "incomplete: level1, level2");
    check("a write carries every level but the group's two, and no class (#552)", ASSET_WRITTEN_LEVELS.join(", "), "level3, size, maker, partNumber");
    log("");

    // ── 0: the groups the catalog files under (#528) ─────────────────────────
    log("the groups a catalog row's type and category stand in (#528):");
    check("the two levels a group is, the type first", ASSET_GROUP_LEVELS.join(", "), "level1, level2");
    check(
        "a group's key is the type and the category as typed text is compared",
        JSON.stringify(categoryGroupKey({ level1: "Tool", level2: " Welding  Equipment", level3: "Drill" })),
        JSON.stringify("tool\nwelding equipment")
    );
    assert("  so a row typed `machining ` stands in `Machining`", categoryGroupKey(ROWS[2]) === categoryGroupKey({ level1: "Tool", level2: "Machining" }));
    assert("  the name and the levels after it are no part of it", categoryGroupKey(ROWS[0]) === categoryGroupKey(ROWS[4]) && categoryGroupKey(ROWS[0]) === categoryGroupKey({ level1: "Tool", level2: "Machining" }));
    assert("  and the type is: one category under two types is two groups", categoryGroupKey({ level1: "Tool", level2: "Measuring" }) !== categoryGroupKey({ level1: "Equipment", level2: "Measuring" }));
    const groupsRead = readCategoryGroups(GROUP_ROWS);
    check("the rows that stand as a group, in the order read", ids(groupsRead.offered), "gMach,gCarp,gWeld,gEqMach,gMeasT,gLift,gConcrete");
    check(
        "  and those that do not, with why: no type, a type not one of the two, no category, a placeholder, the pair again",
        groupsRead.setAside.map(({ group, reason, missing, levels, of }) => `${group.id}:${reason}:${reason === "incomplete" ? missing.join("+") : reason === "placeholder" ? levels.join("+") : of.id}`).join(" "),
        "gNoType:incomplete:level1 gVehicle:incomplete:level1 gNoCat:incomplete:level2 gBare:incomplete:level1+level2 gNA:placeholder:level2 gAgain:repeated:gMach"
    );
    const filed = groupCatalog(ROWS, GROUP_ROWS);
    check("the rows a registration may pick that no group holds", ids(filed.ungrouped), "air,laserE,knifeX");
    check("  and the groups nothing a registration may pick is filed under — a row set aside is not filed", ids(filed.withoutItems), "gLift,gConcrete");
    check(
        "  a group set aside holds nothing: its pair's rows are ungrouped",
        ids(groupCatalog(ROWS, [...GROUP_ROWS.filter((group) => group.id !== "gMeasT"), { id: "gMeasLower", level1: "tool", level2: "Measuring" }]).ungrouped),
        "air,laserT,laserE,knifeX"
    );
    // THE REVISED LIST'S REPLACEMENT judges a path, a group and the pairing by the module, and
    // spells no field; the catalog's script is held below, with the other scripts.
    const replacement = parseFile(REPLACEMENT);
    check(
        "the revised list's replacement takes the fields, the levels, the keys, the name's rule, the path and the three readings from the module",
        importedFromModule(replacement),
        "ASSET_CATEGORY_FIELDS, ASSET_GROUP_LEVELS, ASSET_PATH_LEVELS, catalogPathKey, categoryGroupKey, composeItemName, groupCatalog, pathOf, readCatalog, readCategoryGroups"
    );
    check("  and the replacement spells none of the fields", `${fieldLiterals(replacement).spelled}|${fieldLiterals(replacement).renamedFrom}`, "|");
    log("");

    // ── 1: the columns, the type and the name ───────────────────────────────
    log("the catalog's columns, the type's values and the name the base gives a row:");
    check(
        "the six fields, by what each holds — the class the seventh until #552",
        Object.entries(ASSET_CATEGORY_FIELDS)
            .map(([key, field]) => `${key}=${field}`)
            .join(", "),
        "level1=Level 1, level2=Level 2, level3=Level 3, size=Size, maker=Maker, partNumber=Part Number"
    );
    check(
        "  and the mark a row the office no longer buys carries, apart from what a kind is (#527)",
        `${DISCONTINUED_FIELD} ${Object.values(ASSET_CATEGORY_FIELDS).includes(DISCONTINUED_FIELD)}`,
        "Discontinued false"
    );
    check("  the path outermost first: type, category, name, then size, maker, part number", ASSET_PATH_LEVELS.join(" > "), "level1 > level2 > level3 > size > maker > partNumber");
    check("  the three every row a registration may pick fills", ASSET_REQUIRED_LEVELS.join(", "), "level1, level2, level3");
    check("  and the two a model is, chosen together on the second step (#520)", ASSET_MODEL_LEVELS.join(", "), "maker, partNumber");
    check("  the type's two values, in the select's order", ASSET_TYPE_VALUES.join(", "), "Equipment, Tool");
    check(
        "  and no class's values, word or caption part, which #552 took off the catalog",
        ["ASSET_CLASS_VALUES" in assetCategoryModule, "classLabel" in ASSET_CATEGORY_COPY, "classOf" in ASSET_CATEGORY_COPY, "assetClass" in ASSET_CATEGORY_COPY.clearFilter].join(" "),
        "false false false false"
    );
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
    log("a registration may pick a row with a type, a category and a name, no placeholder, once per path:");
    const { offered, setAside } = readCatalog(ROWS);
    check(
        "the whole rows are offered, in the order they were read — a generic row beside a maker's among them",
        ids(offered),
        "g45,g45mk30,g45mk70,g45bo,g5,drillDw,drillMw,jig,weldLi,weldMi,press,pressJet,air,laserT,laserE,knifeC,knifeX"
    );
    // EACH WAY A ROW IS NOT OFFERED, WITH WHY: the type missing or not one of the two, a level
    // missing or only spaces, a placeholder in any level, and a path another row names in another
    // case and spacing. A class missing or not one of two was a way until #552.
    check(
        "  and every other row is set aside with why",
        asideOf(setAside),
        "notype:incomplete:level1 vehicle:incomplete:level1 nocat:incomplete:level2 noname:incomplete:level3 bare:incomplete:level1+level2+level3 na:placeholder:maker dash:placeholder:size none:placeholder:partNumber again:repeated:g45mk30"
    );
    // THE KEY ONE PATH IS COMPARED BY (#517): what `readCatalog` offers one row of, and what the
    // office catalog's load asks the base before it creates a row.
    check(
        "a path's key: all six levels as typed text is compared, an empty one kept in its place",
        JSON.stringify([catalogPathKey(ROWS.find((r) => r.id === "again")), catalogPathKey(ROWS[0])]),
        JSON.stringify(['tool\nmachining\nangle grinder\n4-1/2"\nmakita\nga4530', 'tool\nmachining\nangle grinder\n4-1/2"\n\n'])
    );
    check("  one key for a path typed in another case and spacing", catalogPathKey(ROWS.find((r) => r.id === "again")) === catalogPathKey(ROWS[1]), true);
    // AN INCOMPLETE OR PLACEHOLDER ROW NAMES NO PATH, so the whole row after it on the same path is the one offered.
    const na = ROWS.find((r) => r.id === "na");
    const completed = readCatalog([na, { ...na, id: "naFixed", maker: "Metabo" }, { ...na, id: "naEmpty", maker: "" }]);
    check("a set-aside row names no path: the whole ones after it are offered", `${ids(completed.offered)} | ${asideOf(completed.setAside)}`, "naFixed,naEmpty | na:placeholder:maker");
    check("  and no catalog offers nothing", `${readCatalog(undefined).offered.length} ${readCatalog(undefined).setAside.length}`, "0 0");
    // A DISCONTINUED ROW (#527) is set aside and still the row its path is: a second row on that
    // path repeats it rather than taking its place, and clearing the mark offers it again. Only
    // the box's own `true` marks one, so a row read with no mark — a script reading the path
    // alone — is offered.
    const press = ROWS.find((r) => r.id === "press");
    const air = ROWS.find((r) => r.id === "air");
    const marked = readCatalog([{ ...press, discontinued: true }, { ...press, id: "pressAgain" }, air]);
    check(
        "a discontinued row is not offered, and a second row on its path repeats it (#527)",
        `${ids(marked.offered)} | ${asideOf(marked.setAside)}`,
        "air | press:discontinued pressAgain:repeated:press"
    );
    check("  with the mark cleared it is offered again", ids(readCatalog([{ ...press, discontinued: false }, { ...press, id: "pressAgain" }, air]).offered), "press,air");
    check(
        "  and only `true` marks one, nothing merely truthy",
        ["true", 1, "yes", undefined].map((discontinued) => readCatalog([{ ...press, discontinued }]).offered.length).join(","),
        "1,1,1,1"
    );
    check("  an incomplete row is incomplete whatever its mark", asideOf(readCatalog([{ ...ROWS.find((r) => r.id === "noname"), discontinued: true }]).setAside), "noname:incomplete:level3");
    // A CLASS ASKS NOTHING SINCE #552: a row carrying one outside the two, or none, or one of the
    // two, is offered alike, as a row the base read before the field went would be.
    const classed = ["C", "", "A", undefined].map((assetClass, i) => ({ ...ROWS.find((r) => r.id === "jig"), id: `jig${i}`, size: `T-${i}`, assetClass }));
    check("  and a class, whatever it holds, keeps no row from being offered (#552)", `${ids(readCatalog(classed).offered)} | ${asideOf(readCatalog(classed).setAside)}`, "jig0,jig1,jig2,jig3 | ");
    check("  the dialog is not handed it", ids(registrationCatalog([{ ...press, discontinued: true }, air])), "air");
    check(
        "  and its pair is no fault when no group holds it, since nobody may pick it",
        ids(groupCatalog([{ ...press, level2: "Nowhere", discontinued: true }, { ...air, level2: "Nowhere" }], GROUP_ROWS).ungrouped),
        "air"
    );
    // WHAT THE DIALOG IS HANDED: the offered rows, their levels and nothing of their assets — and,
    // until #552, their class.
    const handed = registrationCatalog(ROWS);
    check("the dialog is handed the offered rows", ids(handed), ids(offered));
    check("  each with what it shows and narrows by, and no assets", Object.keys(handed[0]).join(", "), "id, itemName, level1, level2, level3, size, maker, partNumber");
    check(
        "  each value its row's",
        Object.values(handed.find((entry) => entry.id === "g45mk30")).join(" | "),
        'g45mk30 | Angle Grinder 4-1/2", Makita (GA4530) | Tool | Machining | Angle Grinder | 4-1/2" | Makita | GA4530'
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
    // THE SEARCH LISTS EVERY NAME IT HOLDS (#520), where it offered five until then: with nothing
    // typed every name under the filters, in the names' order, so 1b's list opens on the catalog.
    check("the search lists every name, with nothing typed, in the names' order", said(searchCatalogNames(offered)), said(catalogNames(offered)));
    check("  a part typed, in any case and spacing, the names holding it", said(searchCatalogNames(offered, { typed: "  LEVEL " })), "Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring)");
    // Since #547 a name whose own words lack it is listed after those holding it, where a level of
    // a row under it does: `Jigsaw`'s category is `Carpentry`.
    check(
        "  every name a level holds it in, none cut, those whose name holds it first",
        said(searchCatalogNames(offered, { typed: "e" })),
        "Air Compressor (Equipment > Site Services), Angle Grinder (Tool > Machining), Cordless Drill (Tool > Carpentry), Drill Press (Equipment > Machining), Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring), Utility Knife (Tool > Carpentry), Utility Knife (Tool > Cutting), Welding Machine (Equipment > Welding), Jigsaw (Tool > Carpentry)"
    );
    check("  narrowed by the category", said(searchCatalogNames(offered, { filters: { level2: "measuring" } })), "Laser Level (Equipment > Measuring), Laser Level (Tool > Measuring)");
    check("  and by the type", said(searchCatalogNames(offered, { filters: { level1: "tool", level2: "measuring" } })), "Laser Level (Tool > Measuring)");
    check("  to nothing when the filters hold no such name", said(searchCatalogNames(offered, { filters: { level2: "measuring" }, typed: "grinder" })), "");
    check("  a name typed in full is listed, since picking it goes on", said(searchCatalogNames(offered, { typed: "drill press" })), "Drill Press (Equipment > Machining)");
    // Words in another order were no name from #507 to #547, which searched the words as one run.
    check("  and words in another order find it too, each word anywhere in it", said(searchCatalogNames(offered, { typed: "press drill" })), "Drill Press (Equipment > Machining)");
    // THE NAME TYPED IN FULL, THEN THOSE BEGINNING WITH IT, THEN THOSE HOLDING IT (#517): the
    // office's `Wrench` stood sixth among the names holding `wrench`, and the first is the one
    // 1b's Enter takes (#520).
    const wrenches = ["Adjustable Monkey Wrench", "Angle Head Open-End Wrench", "Hex Key Wrench Set", "Open-End Wrench", "Ratchet Wrench", "Wrench", "Wrench Set"].map((level3) => ({
        level1: "Tool",
        level2: "Wrench",
        level3,
    }));
    check(
        "  the name typed in full first, then a name beginning with it, then those holding it, each in the names' order",
        said(searchCatalogNames(wrenches, { typed: "WRENCH " })).replaceAll(" (Tool > Wrench)", ""),
        "Wrench, Wrench Set, Adjustable Monkey Wrench, Angle Head Open-End Wrench, Hex Key Wrench Set, Open-End Wrench, Ratchet Wrench"
    );
    check(
        "  a part beginning names before one holding it elsewhere",
        said(searchCatalogNames(wrenches, { typed: "open" })).replaceAll(" (Tool > Wrench)", ""),
        "Open-End Wrench, Angle Head Open-End Wrench"
    );
    check("  two names typed in full, in two places, in the names' order", said(searchCatalogNames(twoPlaces, { typed: "level" })), "Level (Tool > Alpha), Level (Equipment > Zeta)");
    // WHERE A NAME STANDS, SAID ONLY WHERE ITS WORDS STAND TWICE (#520): the category where the
    // two are in two categories, the type before it where they share one — `Pipe Cutter` on
    // #517's catalog — and nothing for a name in one place. Asked of the whole catalog, so a
    // name listed alone under a filter still says it.
    const placesOf = (names) => names.map((name) => name.place.join(" · ")).join(" | ");
    check("each name in two categories says its category", placesOf(searchCatalogNames(offered, { typed: "utility" })), "Carpentry | Cutting");
    check("  in two types under one category, its type and category", placesOf(searchCatalogNames(offered, { typed: "laser" })), "Equipment · Measuring | Tool · Measuring");
    check("  in one place, nothing", placesOf(searchCatalogNames(offered, { typed: "angle" })), "");
    check("  and the same under a filter that lists it alone", placesOf(searchCatalogNames(offered, { filters: { level2: "cutting" }, typed: "utility" })), "Cutting");
    // WHAT EACH NAME LEADS TO (#520): the sizes its rows give, and the makers with their part
    // numbers — a row with neither no model, and a maker with no part number one.
    const offersOf = (typed) =>
        searchCatalogNames(offered, { typed })
            .map((name) => `${name.level3} ${name.sizes} ${name.models}`)
            .join(" | ");
    check("  sizes and models counted, each once in any case", offersOf("grinder"), "Angle Grinder 2 3");
    check("  one size, two models", offersOf("cordless"), "Cordless Drill 1 2");
    check("  no size, two models", offersOf("welding"), "Welding Machine 0 2");
    check("  a generic row beside one model", offersOf("drill press"), "Drill Press 0 1");
    check("  and one size, no model", offersOf("jigsaw"), "Jigsaw 1 0");
    // ── the search over every level (#547) ──
    // A catalog shaped as the office's where it matters here: `Band Saw` in two places, a DeWalt
    // part number in each and one beginning with the other; two Hilti hammer drills; two DeWalt
    // drills; two flowmeters told apart by part number alone; a bender in two sizes, generic and
    // Swagelok; a wrench whose size holds `1/2` without beginning with it, and a gauge with that
    // size and one beginning with `1/2`; a collet whose maker begins with `Swagelok`; one cutter
    // model in two sizes; a name holding `power`; and three names whose own words hold some, one
    // or none of `hammer drill` while their categories hold the rest.
    const kind = (id, level1, level2, level3, size = "", maker = "", partNumber = "") => ({ id, level1, level2, level3, size, maker, partNumber });
    const kinds = [
        kind("bsP", "Tool", "Power Tools", "Band Saw", "", "DeWalt", "DCS375"),
        kind("bsP2", "Tool", "Power Tools", "Band Saw", "", "Makita", "2107FW"),
        kind("bsC", "Equipment", "Cutting", "Band Saw", "", "DeWalt", "DCS375B"),
        kind("hdA", "Tool", "Power Tools", "Hammer Drill", "", "Hilti", "TE6-A36"),
        kind("hdB", "Tool", "Power Tools", "Hammer Drill", "", "Hilti", "TE6-A36-AVR"),
        kind("hdM", "Tool", "Power Tools", "Hammer Drill", "", "Milwaukee"),
        kind("dr", "Tool", "Power Tools", "Drill", "", "DeWalt"),
        kind("drD", "Tool", "Power Tools", "Drill", "", "DeWalt", "DCD771"),
        kind("rf2", "Tool", "Gas Control", "Rota Flowmeter", "", "", "LF201"),
        kind("rf1", "Tool", "Gas Control", "Rota Flowmeter", "", "", "LF101"),
        kind("sb4", "Tool", "Machining Tools", "Short Bender", '1/4"'),
        kind("sb8", "Tool", "Machining Tools", "Short Bender", '1/2"'),
        kind("sb4s", "Tool", "Machining Tools", "Short Bender", '1/4"', "Swagelok", "MS-HTB-4T"),
        kind("sb8s", "Tool", "Machining Tools", "Short Bender", '1/2"', "Swagelok", "MS-HTB-8"),
        kind("pw", "Tool", "Hand Tools", "Pipe Wrench", '1-1/2"'),
        kind("gauge15", "Tool", "Measuring Tools", "Gauge", '1-1/2"'),
        kind("gauge05", "Tool", "Measuring Tools", "Gauge", '1/2"'),
        kind("collet", "Tool", "For Welders", "Collet Half", '1/2"', "Swagelok USA"),
        kind("tc4", "Tool", "Cutter", "Tube Cutter", '1/4"', "Ridgid", "150"),
        kind("tc8", "Tool", "Cutter", "Tube Cutter", '1/2"', "Ridgid", "150"),
        kind("ps", "Equipment", "Welding Equipment", "Power Supply", "", "Miller"),
        kind("bit", "Tool", "Hammer Accessories", "Drill Bit"),
        kind("carbide", "Tool", "Hammer Accessories", "Carbide Drill"),
        kind("chisel", "Tool", "Hammer Drill Parts", "Chisel"),
    ];
    // What a reader sees of each result: its name, and what it says beside it.
    const shown = (typed) =>
        searchCatalogNames(kinds, { typed })
            .map((name) => (name.beside.length > 0 ? `${name.level3} [${name.beside.join(" · ")}]` : name.level3))
            .join(", ");
    // What the second step opens with chosen for each result, a model's key said with a slash.
    const opens = (typed) =>
        searchCatalogNames(kinds, { typed })
            .map((name) => `${name.level3}: ${Object.entries(name.chosen).map(([level, key]) => `${level}=${key.replace("\n", "/")}`).join(" ") || "nothing"}`)
            .join(" | ");
    // THE NAMES HOLDING EVERY WORD, THEN SOME, THEN NONE, EACH BY #517's RANK: by the words the
    // name holds, and for a name the other levels found alone by the value found. In the names'
    // order alone these four read `Carbide Drill`, `Chisel`, `Drill Bit`, `Hammer Drill`.
    check(
        "the names holding every word first, then those holding some, then those holding none, each in #517's ranks",
        shown("hammer drill"),
        "Hammer Drill, Drill Bit [Hammer Accessories], Carbide Drill [Hammer Accessories], Chisel [Hammer Drill Parts]"
    );
    check("  the name holding a word before the names a category finds", shown("power"), "Power Supply, Band Saw [Power Tools], Drill [Power Tools], Hammer Drill [Power Tools]");
    check("  a value typed in full before one beginning with it, in another place", shown("dcs375"), "Band Saw [Power Tools · DeWalt (DCS375)], Band Saw [Cutting · DeWalt (DCS375B)]");
    check("  a size beginning with it before one holding it, a name ranked by its best row", shown("1/2"), 'Collet Half [1/2"], Gauge [1/2" · 1-1/2"], Short Bender [1/2"], Tube Cutter [1/2"], Pipe Wrench [1-1/2"]');
    // EVERY WORD IN ONE ROW: a name is listed for a row that holds them all, and not for words its
    // rows hold apart — `MS-HTB-4T` is the 1/4" bender.
    check("every word in a level of one row, the name holding one", shown("drill dewalt"), "Drill [DeWalt]");
    check("  and words two of its rows hold apart find nothing", shown("ms-htb-4t 1/2"), "");
    check("  words in two levels of one row, ranked by the worse of the two", shown("swagelok 1/2"), 'Collet Half [1/2" · Swagelok USA], Short Bender [1/2" · Swagelok (MS-HTB-8)]');
    // WHAT FOUND IT, AFTER THE PLACE AND NOT REPEATING IT: the type, the category, each size and the
    // model, `Maker (Part #)`; several models by one maker say the maker, and several by none each.
    check("the type found, after the place", shown("equipment"), "Band Saw [Cutting · Equipment], Power Supply [Equipment]");
    check("  a model found by its maker, one maker's two said once", shown("dewalt"), "Band Saw [Cutting · DeWalt (DCS375B)], Band Saw [Power Tools · DeWalt (DCS375)], Drill [DeWalt]");
    check("  two models by one maker found by their part numbers", shown("te6"), "Hammer Drill [Hilti]");
    check("  one of them typed in full", shown("te6-a36-avr"), "Hammer Drill [Hilti (TE6-A36-AVR)]");
    check("  two by no maker each, in the second step's order, after a name holding it", shown("lf"), "Collet Half, Rota Flowmeter [LF101 · LF201]");
    check("  two sizes each, in the second step's order", shown("1/"), 'Collet Half [1/2"], Gauge [1/2" · 1-1/2"], Short Bender [1/4" · 1/2"], Tube Cutter [1/4" · 1/2"], Pipe Wrench [1-1/2"]');
    check("  and a name its own words found says no more than its place", shown("band saw"), "Band Saw [Cutting], Band Saw [Power Tools]");
    // THE WORDS THE NAME HOLDS, WHICH THE ROW MARKS: in the order typed, and none for a name found
    // by its other levels alone.
    check(
        "the words each name holds, for its mark",
        searchCatalogNames(kinds, { typed: "Drill  HAMMER" })
            .map((name) => `${name.level3}=${name.named}`)
            .join(" | "),
        "Hammer Drill=drill hammer | Drill Bit=drill | Carbide Drill=drill | Chisel="
    );
    // WHAT THE SECOND STEP OPENS WITH CHOSEN: a part number its model, with the size where its rows
    // hold one, and a size its size, each where the rows answering hold one; a maker nothing.
    check("a part number chooses its model, and the size its row has", opens("dcs375"), "Band Saw: model=dewalt/dcs375 size= | Band Saw: model=dewalt/dcs375b size=");
    check("  a model in two sizes, its model alone", opens("150"), "Tube Cutter: model=ridgid/150");
    check("  a size its size, a bender's two models left to choose, and two sizes none", opens("1/2"), 'Collet Half: size=1/2" | Gauge: nothing | Short Bender: size=1/2" | Tube Cutter: size=1/2" | Pipe Wrench: size=1-1/2"');
    check("  several models nothing", opens("te6"), "Hammer Drill: nothing");
    check("  several sizes nothing, and the one size of a name beside them its size", opens("1/"), 'Collet Half: size=1/2" | Gauge: nothing | Short Bender: nothing | Tube Cutter: nothing | Pipe Wrench: size=1-1/2"');
    check("  a maker nothing, though it found one model", opens("makita"), "Band Saw: nothing");
    check("  and a name its own words found nothing, its one model though", opens("cutter"), "Tube Cutter: nothing");
    const bender = catalogRowsOf(kinds, "tool\nmachining tools\nshort bender");
    const openedOn = (typed) => walked(bender, searchCatalogNames(kinds, { typed })[0].chosen);
    check("  the bender opened on the part number's model and its size", openedOn("ms-htb-8"), 'size 1/4"/1/2" = 1/2" · model Swagelok (MS-HTB-8)/Not specified = Swagelok (MS-HTB-8) → sb8s');
    check("  and on the size, its two models to choose between", openedOn("1/2"), 'size 1/4"/1/2" = 1/2" · model Swagelok (MS-HTB-8)/Not specified = ? → no row');
    check("  nothing typed chooses nothing and says the place alone", searchCatalogNames(offered).every((name) => Object.keys(name.chosen).length === 0 && name.beside.join() === name.place.join()), true);

    check("the rows under a name, the second step's to narrow between", ids(catalogRowsOf(offered, "tool\nmachining\nangle grinder")), "g45,g45mk30,g45mk70,g45bo,g5");
    check("  under its type alone, where one name has two", ids(catalogRowsOf(offered, "tool\nmeasuring\nlaser level")), "laserT");
    check("  and a name nothing holds has none", ids(catalogRowsOf(offered, "tool\nnowhere\nnothing")), "");

    // ── 4: the second step's walk ────────────────────────────────────────────
    log("");
    log("the second step asks the size, then the model — a row's maker and part number together (#520):");
    const grinder = catalogRowsOf(offered, "tool\nmachining\nangle grinder");
    // THE SIZE FIRST, AMONG SEVERAL, AND THE MODEL WAITING FOR IT (1b): nothing is offered as a
    // model until the size is settled, since a model belongs to a size.
    check("sizes to choose, and no model asked until one is", walked(grinder, {}), 'size 4-1/2"/5" = ? → no row');
    check(
        "  a size chosen offers its models, makers first, `Not specified` last",
        walked(grinder, { size: '4-1/2"' }),
        'size 4-1/2"/5" = 4-1/2" · model Bosch/Makita (GA4530)/Makita (GA4570)/Not specified = ? → no row'
    );
    check("  a model chosen makes its row, one maker's part numbers told apart", walked(grinder, { size: '4-1/2"', model: "makita\nga4570" }), 'size 4-1/2"/5" = 4-1/2" · model Bosch/Makita (GA4530)/Makita (GA4570)/Not specified = Makita (GA4570) → g45mk70');
    check("  a maker with no part number is its maker alone", walked(grinder, { size: '4-1/2"', model: "bosch\n" }), 'size 4-1/2"/5" = 4-1/2" · model Bosch/Makita (GA4530)/Makita (GA4570)/Not specified = Bosch → g45bo');
    check("  `Not specified` is a choice, the row naming no model", walked(grinder, { size: '4-1/2"', model: "\n" }), 'size 4-1/2"/5" = 4-1/2" · model Bosch/Makita (GA4530)/Makita (GA4570)/Not specified = Not specified → g45');
    check("  a size whose rows name no model is asked none, the model held read as never made", walked(grinder, { size: '5"', model: "makita\nga4570" }), 'size 4-1/2"/5" = 5" → g5');
    check(
        "equipment with no size is asked none, and its models start with none chosen",
        walked(catalogRowsOf(offered, "equipment\nwelding\nwelding machine"), {}),
        "model Lincoln (POWER MIG 256)/Miller (Millermatic 255) = ? → no row"
    );
    check("  and one chosen makes its row", walked(catalogRowsOf(offered, "equipment\nwelding\nwelding machine"), { model: "miller\nmillermatic 255" }), "model Lincoln (POWER MIG 256)/Miller (Millermatic 255) = Miller (Millermatic 255) → weldMi");
    check("a generic row beside a maker's starts on neither", walked(catalogRowsOf(offered, "equipment\nmachining\ndrill press"), {}), "model Jet (JDP-17)/Not specified = ? → no row");
    check("  takes the generic row by `Not specified`", walked(catalogRowsOf(offered, "equipment\nmachining\ndrill press"), { model: "\n" }), "model Jet (JDP-17)/Not specified = Not specified → press");
    check("  and its maker's row by its model", walked(catalogRowsOf(offered, "equipment\nmachining\ndrill press"), { model: "jet\njdp-17" }), "model Jet (JDP-17)/Not specified = Jet (JDP-17) → pressJet");
    // THE OFFICE'S BATTERY (#517): a DeWalt with no size beside two Milwaukees. Started on the empty
    // size, the maker would be DeWalt alone and chosen, and a Milwaukee left unsized added as a
    // DeWalt; the size starts on nothing, `None` last among its options, and the model waits.
    const battery = [
        { id: "batDw", level3: "Battery", size: "", maker: "DeWalt", partNumber: "" },
        { id: "batM12", level3: "Battery", size: "M12", maker: "Milwaukee", partNumber: "" },
        { id: "batM18", level3: "Battery", size: "M18", maker: "Milwaukee", partNumber: "" },
    ];
    check("a size beside no size starts unchosen, `None` last, and asks no model yet", walked(battery, {}), "size M12/M18/None = ? → no row");
    check("  `None` chosen makes the one model left, already chosen and still said", walked(battery, { size: "" }), "size M12/M18/None = None · model DeWalt = DeWalt → batDw");
    check("  and a size makes its Milwaukee", walked(battery, { size: "m18" }), "size M12/M18/None = M18 · model Milwaukee = Milwaukee → batM18");
    // THE OFFICE'S WRENCH: one size of many by a maker. The model waits for the size, and then is
    // the one option the size leaves — said where it names a maker, and not where it names none.
    const wrench = [
        { id: "wr16", level3: "Wrench", size: "16 mm", maker: "", partNumber: "" },
        { id: "wr17", level3: "Wrench", size: "17 mm", maker: "", partNumber: "" },
        { id: "wrProto", level3: "Wrench", size: "13x14 mm", maker: "Proto", partNumber: "" },
    ];
    check("a maker one size of many has waits on the size", walked(wrench, {}), "size 13x14 mm/16 mm/17 mm = ? → no row");
    check("  a size with no maker asks no model and is its row", walked(wrench, { size: "16 mm" }), "size 13x14 mm/16 mm/17 mm = 16 mm → wr16");
    check("  and the size with one has that maker chosen", walked(wrench, { size: "13x14 mm" }), "size 13x14 mm/16 mm/17 mm = 13x14 mm · model Proto = Proto → wrProto");
    const partOnly = [
        { id: "pA", level3: "Gauge", size: "", maker: "", partNumber: "X-2" },
        { id: "pB", level3: "Gauge", size: "", maker: "Acme", partNumber: "" },
    ];
    check("a part number with no maker is the part number alone, after the makers", walked(partOnly, {}), "model Acme/X-2 = ? → no row");
    check("a name with one row and no levels asks nothing and is that row", walked(catalogRowsOf(offered, "equipment\nsite services\nair compressor"), {}), " → air");
    check("a name with one size asks none and is its row (1b)", walked(catalogRowsOf(offered, "tool\ncarpentry\njigsaw"), {}), " → jig");
    check("  and no rows ask nothing and make no row", walked([], {}), " → no row");
    // WHAT IS DRAWN FOLLOWS THE SIZE: the model is asked once the size is settled and a row under it
    // names one, and not before.
    const askedOf = (chosen) =>
        walkDetails(grinder, chosen)
            .levels.map((level) => `${level.level}:${level.asked}`)
            .join(" ");
    check("the model is drawn once the size is settled, and only where a row under it names one", [askedOf({}), askedOf({ size: '4-1/2"' }), askedOf({ size: '5"' })].join(" | "), "size:true model:false | size:true model:true | size:true model:false");
    // THE SIZES' ORDER (1b): the metric ones first, then the rest, each by the figure it leads with.
    check(
        "sizes by their figures, metric first, where words alone put 1/2\" before 8 mm",
        ['3/4"', "8 mm", '1/2"', "10 mm", "9 mm", '11/16"', "27 mm"].sort(compareSizes).join(" | "),
        '8 mm | 9 mm | 10 mm | 27 mm | 1/2" | 11/16" | 3/4"'
    );
    check("  a mixed number read whole, and a figure after a letter", ['5"', '4-1/2"', "M18", "M12"].sort(compareSizes).join(" | "), '4-1/2" | 5" | M12 | M18');
    check("  its fraction counted, so it stands between the whole numbers", ['4-3/4"', '5"', '4-1/4"', '4"'].sort(compareSizes).join(" | "), '4" | 4-1/4" | 4-3/4" | 5"');
    check("  millimeters after an inch mark are an inch size's own", ["150 mm", '5" (127 mm)', '4"'].sort(compareSizes).join(" | "), '150 mm | 4" | 5" (127 mm)');
    check("  and before any, a metric size", ["50 to 120 mm", "8A to 25A (8 to 32 mm)"].sort(compareSizes).join(" | "), "8A to 25A (8 to 32 mm) | 50 to 120 mm");
    check("  a size with no figure after those with one, by its words", ["T-Shank", '1/2"', "Cross-Line"].sort(compareSizes).join(" | "), '1/2" | Cross-Line | T-Shank');
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
    // THE SEARCH'S × AND THE FILTERS' ARE THE DESIGN'S, ONE STRING FOR THE CATEGORY LIST'S BAND AND
    // THE REGISTRATION'S FIRST STEP (1a, 1b; #520). The registration's filters said `All types`
    // and `All categories` from #514, `All jobs`' shape, and its search `Choose a name`; the two
    // searches' own words parted with #547 and #541, and each is its screen's constant's.
    check(
        "the search's × and each filter's, the band's and the registration's alike",
        [ASSET_CATEGORY_COPY.clearSearch, ...Object.values(ASSET_CATEGORY_COPY.clearFilter)].join(" | "),
        "Clear search | Clear type filter | Clear category filter"
    );
    check("  a × for each filter a chip draws, the class's gone with its chip (#552)", Object.keys(ASSET_CATEGORY_COPY.clearFilter).join(" "), "level1 level2");
    // THE SECOND STEP'S WORDS ARE 1b's (#520): its second choice, and each choice's empty option,
    // where #514 drew `Choose a size`-shaped placeholders and `No size`, `No maker`, `No part #`.
    check("  the second step's model", ASSET_CATEGORY_COPY.modelLabel, "Model");
    check(
        "  each choice left empty, as the chip that leaves it so",
        Object.entries(ASSET_CATEGORY_COPY.leftEmpty)
            .map(([level, word]) => `${level}=${word}`)
            .join(" | "),
        "size=None | model=Not specified"
    );
    check("  and no placeholder, since a chip has none", "unchosen" in ASSET_CATEGORY_COPY, false);

    // ── 6: one module writes an `Asset Categories` row, and each field has one spelling ──────
    log("");
    log("every use of the table outside its module is a read, its writes are the catalog page's, and the catalog's fields are spelled once:");
    const uses = [];
    const parsed = [];
    for (const abs of [...listJsFiles(repoPath("app")), ...listJsFiles(repoPath("lib"))]) {
        const file = toPosix(relative(REPO_ROOT, abs));
        const source = parseFile(file);
        parsed.push({ file, ast: source.ast });
        for (const use of categoriesTableUses(source)) uses.push({ file, use });
    }
    log(`  ${uses.map(({ file, use }) => `${file} ${use}`).join("; ")}`);
    assert(`the table's uses under app/ and lib/ are found (${uses.length})`, uses.length >= 3);
    check(
        "  and every one outside its module is a read",
        uses
            .filter(({ file, use }) => file !== READER && !READS.has(use))
            .map(({ file, use }) => `${file} ${use}`)
            .join("; "),
        ""
    );
    // THE MODULE'S WRITES ARE THE CATALOG PAGE'S FOUR (#527): a row added, a row saved over, its
    // mark and a row removed — each a batch form (#444). The fifth gave several rows a class, until
    // #552 took the class off the catalog.
    check(
        "  and inside it the writes are an add, two saves over and a removal",
        uses
            .filter(({ file, use }) => file === READER && !READS.has(use))
            .map(({ use }) => use)
            .sort()
            .join(", "),
        "base(…).create, base(…).destroy, base(…).update, base(…).update"
    );
    // ITS EXPORTS: the two readers and the four writers, and nothing else.
    const exported = [];
    walk(parseFile(READER).ast, (n) => {
        if (n.type === "ExportNamedDeclaration" && n.declaration?.id) exported.push(n.declaration.id.name);
    });
    check(
        `${READER} exports its two readers and the catalog page's four writers`,
        exported.sort().join(", "),
        ["getAllAssetCategories", "getAssetCategoriesByRecordIds", ...WRITERS].sort().join(", ")
    );
    // AND ONLY THE CATALOG PAGE'S ACTIONS TAKE A WRITER — every one of them, so a writer nothing
    // calls fails here as well as in `offline/unread-exports.mjs`.
    check("  whose writers the catalog page's actions alone import, every one", importersOf(parsed, "lib/airtable/assetCategories", WRITERS).join(" | "), `${CATALOG_ACTIONS}: ${WRITERS.join(" ")}`);
    // ONE SPELLING: the path and the class come off a record through the module's one reading of
    // them (#539), and the reader takes by name only the fields that are not the catalog's path.
    const got = [];
    const readings = [];
    const reader = parseFile(READER);
    walk(reader.ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "get") got.push(reader.source.slice(n.arguments[0].start, n.arguments[0].end));
        if (n.type !== "FunctionDeclaration" || n.id?.name !== "recordToAssetCategory") return;
        walk(n.body, (inner) => {
            if (inner.type === "SpreadElement") readings.push(reader.source.slice(inner.argument.start, inner.argument.end));
        });
    });
    check("  reading by name only the fields that are not the catalog's path", got.sort().join(", "), '"Assets", "Item Name", CATEGORY_GROUP_FIELD, DISCONTINUED_FIELD, EDITED_AT_FIELD');
    check("  and the path through the module's one reading of a record", readings.join(", "), "catalogFieldsOf(record.fields)");
    check("  and spelling none of them", fieldLiterals(reader).spelled, "");
    const script = parseFile(SCRIPT);
    check(
        "the catalog's script takes the fields, the mark (#527), the link (#539), the type's values, the expression, the path and the readings from the module",
        importedFromModule(script),
        "ASSET_CATEGORY_FIELDS, ASSET_GROUP_LEVELS, ASSET_TYPE_VALUES, CATEGORY_GROUP_FIELD, DISCONTINUED_FIELD, ITEM_NAME_FORMULA, catalogFieldsOf, composeItemName, groupCatalog, pathOf, readCatalog, readCategoryGroups"
    );
    check("  and spells none of the fields", fieldLiterals(script).spelled, "");
    // THE TWO NAMES IT RENAMES FROM ARE #507's, in the order they must run: `Level 2` out of the way first.
    check("  but the two #507 names its renames start from, `Level 2` first", fieldLiterals(script).renamedFrom, "Level 2, Level 1");
    const seed = parseFile(SEED);
    check("the demo catalog's script takes the fields, the name's rule and the reading from the module", importedFromModule(seed), "ASSET_CATEGORY_FIELDS, composeItemName, readCatalog");
    check("  and spells none of the fields", `${fieldLiterals(seed).spelled}|${fieldLiterals(seed).renamedFrom}`, "|");
    // THE OFFICE CATALOG'S LOAD AND THE DEMO'S REMOVAL (#517): each judges a row by the
    // catalog's reading and a path by its key, and spells no field — the load's CSV header is one
    // string, so the list's own `Size`, `Maker` and `Part Number` columns are not a second spelling.
    const load = parseFile(LOAD);
    check(
        "the office catalog's load takes the fields, the path, the path's key, the name's rule and the reading from the module",
        importedFromModule(load),
        "ASSET_CATEGORY_FIELDS, ASSET_PATH_LEVELS, catalogPathKey, composeItemName, readCatalog"
    );
    check("  and the load spells none of the fields", `${fieldLiterals(load).spelled}|${fieldLiterals(load).renamedFrom}`, "|");
    const removal = parseFile(REMOVAL);
    check("the demo's removal takes the fields, the path's key and the reading from the module", importedFromModule(removal), "ASSET_CATEGORY_FIELDS, catalogPathKey, readCatalog");
    check("  and the removal spells none of the fields", `${fieldLiterals(removal).spelled}|${fieldLiterals(removal).renamedFrom}`, "|");

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
    // A screen importing a writer, by the alias and by a relative path, is seen; a reader is not one.
    check(
        "  a writer imported anywhere is seen, whatever the path's spelling",
        importersOf(
            [
                { file: "<planted-alias>", ast: parseSource('import { removeAssetCategory, getAllAssetCategories } from "@/lib/airtable/assetCategories";', "<planted-alias>").ast },
                { file: "<planted-relative>", ast: parseSource('import { createAssetCategory } from "../../lib/airtable/assetCategories.js";', "<planted-relative>").ast },
                { file: "<planted-reader>", ast: parseSource('import { getAllAssetCategories } from "@/lib/airtable/assetCategories";', "<planted-reader>").ast },
            ],
            "lib/airtable/assetCategories",
            WRITERS
        ).join(" | "),
        "<planted-alias>: removeAssetCategory | <planted-relative>: createAssetCategory"
    );
    // The catalog's reading is seen to tell rows apart, since "every row offered" and "every
    // row set aside" are also what a reading answering one way for all would give — and every
    // way a row is set aside is reached.
    assert("  the fixture is both offered from and set aside from", offered.length > 0 && setAside.length > 0);
    check("  by each of the three reasons", [...new Set(setAside.map((aside) => aside.reason))].sort().join(", "), "incomplete, placeholder, repeated");
    assert("  and the search lists something for nothing typed", searchCatalogNames(offered).length > 0);
    // The places are seen to be said and left unsaid, the type with them and without.
    const places = searchCatalogNames(offered).map((name) => name.place.length);
    assert("  and a name says its place, with its type and without, and most say none", [0, 1, 2].every((n) => places.includes(n)));
    // The walk is seen to make a row and to make none, and to ask and leave a level unasked.
    const walks = [walkDetails(grinder, {}), walkDetails(grinder, { size: '4-1/2"' }), walkDetails(catalogRowsOf(offered, "equipment\nsite services\nair compressor"), {})];
    assert("  the walk both makes a row and makes none", walks.some((w) => w.category) && walks.some((w) => !w.category));
    assert("  and both asks a level and leaves one unasked", walks.some((w) => w.levels.some((l) => l.asked)) && walks.some((w) => w.levels.some((l) => !l.asked)));
}

if (isMain(import.meta.url)) standalone(title, run);
