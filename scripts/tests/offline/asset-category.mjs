// The catalog a registration picks from (#507).
//
// WHAT THIS HOLDS. `lib/assetCategory.js` is the catalog's one implementation: its columns, the
// class's two values, the expression the base names a row with, which rows a registration
// may pick, and the walk the registration's two steps narrow through. Each is pure and held
// here by value — the walk on a catalog typed the way an office types one by hand, with a
// category in another case and spacing, a row without its class, a row without a level, a
// path named twice and one name under two categories.
//
// AND THAT NOTHING WRITES AN `Asset Categories` ROW. The office fills the catalog in Airtable and a
// registration picks a row, where until #507 it found or created one under a lock. No figure
// on a screen says whether a write is gone, so every use of the table under `app/` and `lib/`
// is read off the source, and each has to be a read.
//
// AND ONE SPELLING OF EACH FIELD. The reader in `lib/airtable/assetCategories.js` and the creation
// script take the fields' names from `ASSET_CATEGORY_FIELDS`, and the script the class's values,
// the expression and the catalog's reading from the module too; a literal of one of the four
// names in either fails, since a second spelling is what a rename would miss.
//
// WHAT IT CANNOT SEE. Whether the base's `Item Name` computes what `composeItemName` says — a
// formula is outside this tier (docs/notes/verification.md), and the creation script compares
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
    ITEM_NAME_FORMULA,
    ASSET_PATH_LEVELS,
    ASSET_PATH_SEPARATOR,
    catalogCategories,
    catalogNames,
    catalogSizes,
    compareCatalogText,
    composeItemName,
    findCatalogName,
    onlySize,
    pathOf,
    readCatalog,
    suggestCatalogNames,
} from "../../../lib/assetCategory.js";
import { REPO_ROOT, listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The catalog a tool is chosen from, and nothing writing a row of it (#507)";

/** The reader of the table, and the script that makes it the catalog. */
const READER = "lib/airtable/assetCategories.js";
const SCRIPT = "scripts/import/create_tool_catalog_507.mjs";

/** A row as `recordToAssetCategory` returns it, named as the base would name it. */
const row = (id, level1, level2, size, assetClass) => ({ id, itemName: composeItemName({ level2, size }), assets: [], level1, level2, size, assetClass });

/**
 * A catalog typed by hand. The first eleven rows are whole; `jig` spells its category in
 * another case and spacing; `knifeH` and `knifeC` are one name under two categories; and the
 * six after `tape` are each a way a row is not offered.
 */
const ROWS = [
    row("g45", "Power Tools", "Angle Grinder", '4-1/2"', "A"),
    row("tw38", "Hand Tools", "Torque Wrench", '3/8" Drive', "B"),
    row("saw10", "Power Tools", "Circular Saw", '10"', "A"),
    row("g5", "Power Tools", "Angle Grinder", '5"', "A"),
    row("jig", "power  tools", "Jigsaw", "T-Shank", "B"),
    row("tw12", "Hand Tools", "Torque Wrench", '1/2" Drive', "A"),
    row("saw7", "Power Tools", "Circular Saw", '7-1/4"', "A"),
    row("knifeH", "Hand Tools", "Utility Knife", "18mm", "B"),
    row("knifeC", "Cutting", "Utility Knife", "25mm", "B"),
    row("laser2", "Measuring", "Laser Level", "Rotary", "A"),
    row("tape", "Measuring", "Tape Measure", "25 ft", "B"),
    row("laser", "Measuring", "Laser Level", "Cross-Line", ""),
    row("again", "Power Tools", "angle  grinder", '4-1/2" ', "B"),
    row("nocat", "  ", "Hammer Drill", "SDS-Plus", "A"),
    row("nosize", "Power Tools", "Impact Driver", "", "B"),
    row("classC", "Power Tools", "Rotary Hammer", "SDS-Max", "C"),
    row("bare", "", "", "", ""),
];

/** Ids, for a list of rows. */
const ids = (assetCategories) => assetCategories.map((assetCategory) => assetCategory.id).join(",");

/** Names as a reader of the search sees them: the name, and its category beside it. */
const said = (names) => names.map((name) => `${name.level2} (${name.level1})`).join(", ");

/** A row set aside, with why: the fields it lacks, or the row whose path it repeats. */
const asideOf = (setAside) =>
    setAside.map(({ category: assetCategory, reason, missing, of }) => `${assetCategory.id}:${reason}:${reason === "incomplete" ? missing.join("+") : of.id}`).join(" ");

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

/** The string literals in a parsed file that spell one of the catalog's field names. */
function fieldLiterals({ ast }) {
    const names = new Set(Object.values(ASSET_CATEGORY_FIELDS));
    const found = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string" && names.has(n.value)) found.push(n.value);
        if (n.type === "TemplateLiteral" && n.expressions.length === 0 && names.has(n.quasis[0]?.value.cooked)) found.push(n.quasis[0].value.cooked);
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── 1: the columns, the class and the name ──────────────────────────────
    log("the catalog's columns, the class's two values and the name the base gives a row:");
    check(
        "the four fields, by what each holds",
        Object.entries(ASSET_CATEGORY_FIELDS)
            .map(([key, field]) => `${key}=${field}`)
            .join(", "),
        "level1=Level 1, level2=Level 2, size=Size, assetClass=Class"
    );
    // SIZE ALWAYS LAST: a level the catalog grows goes between the tool and the size.
    check("  the path outermost first, the size last", ASSET_PATH_LEVELS.join(" > "), "level1 > level2 > size");
    check("  the class's two values, in the select's order", ASSET_CLASS_VALUES.join(", "), "A, B");
    check("  the separator a path is said with, `lib/materialCategory.js`' own", ASSET_PATH_SEPARATOR, " > ");
    check("the expression `Item Name` computes, the tool and the size", ITEM_NAME_FORMULA, 'TRIM({Level 2} & " " & {Size})');
    check("  its JavaScript twin, on a whole row", composeItemName(ROWS[0]), 'Angle Grinder 4-1/2"');
    check("  a row without a size named by its tool alone", composeItemName({ level2: "Impact Driver", size: "" }), "Impact Driver");
    check("  a row without a tool by its size alone", composeItemName({ level2: "", size: "SDS-Plus" }), "SDS-Plus");
    check("  and nothing by nothing", composeItemName(undefined), "");
    check("a path, outermost first", pathOf(ROWS[0]), 'Power Tools > Angle Grinder > 4-1/2"');
    check("  a level the row lacks left out rather than drawn empty", pathOf(ROWS.find((r) => r.id === "nocat")), "Hammer Drill > SDS-Plus");
    check("  and a row with none says nothing", `${pathOf(ROWS.find((r) => r.id === "bare"))}|${pathOf(undefined)}|`, "||");

    // ── 2: which rows a registration may pick ────────────────────────────────
    log("");
    log("a registration may pick a row with all three levels and a class, once per path:");
    const { offered, setAside } = readCatalog(ROWS);
    check("the whole rows are offered, in the order they were read", ids(offered), "g45,tw38,saw10,g5,jig,tw12,saw7,knifeH,knifeC,laser2,tape");
    // EACH WAY A ROW IS NOT OFFERED, WITH WHY: the class missing or not one of the two, a
    // level missing or only spaces, and a path another row names in another case and spacing.
    check(
        "  and every other row is set aside with why",
        asideOf(setAside),
        "laser:incomplete:assetClass again:repeated:g45 nocat:incomplete:level1 nosize:incomplete:size classC:incomplete:assetClass bare:incomplete:level1+level2+size+assetClass"
    );
    // AN INCOMPLETE ROW NAMES NO PATH, so the whole row after it on the same path is the one offered.
    const laser = ROWS.find((r) => r.id === "laser");
    const completed = readCatalog([laser, { ...laser, id: "laserA", assetClass: "A" }]);
    check("an incomplete row names no path: the whole one after it is offered", `${ids(completed.offered)} | ${asideOf(completed.setAside)}`, "laserA | laser:incomplete:assetClass");
    check("  and no catalog offers nothing", `${readCatalog(undefined).offered.length} ${readCatalog(undefined).setAside.length}`, "0 0");

    // ── 3: the walk the registration narrows through ──────────────────────────
    log("");
    log("the first step's filter and search, and the second step's sizes:");
    check("the categories, each once, alphabetically", catalogCategories(offered).map((c) => c.level1).join(", "), "Cutting, Hand Tools, Measuring, Power Tools");
    check(
        "  in the spelling of the first row holding each, keyed as typed text is compared",
        catalogCategories(offered)
            .map((c) => c.key)
            .join("|"),
        "cutting|hand tools|measuring|power tools"
    );
    check(
        "the names under every category, by name and then category",
        said(catalogNames(offered)),
        "Angle Grinder (Power Tools), Circular Saw (Power Tools), Jigsaw (Power Tools), Laser Level (Measuring), Tape Measure (Measuring), Torque Wrench (Hand Tools), Utility Knife (Cutting), Utility Knife (Hand Tools)"
    );
    // THE CATEGORY SAID THE FILTER'S WAY: `jig` typed it `power  tools`, and the search says it
    // as the filter does rather than a second way.
    check("  a name's category said as the filter says it, whatever its row typed", catalogNames(offered).find((n) => n.level2 === "Jigsaw")?.level1, "Power Tools");
    check("  one name under two categories is two", catalogNames(offered).filter((n) => n.level2 === "Utility Knife").map((n) => n.key).join(" | "), "cutting\nutility knife | hand tools\nutility knife");
    check("  under one category, its names alone", said(catalogNames(offered, "hand tools")), "Torque Wrench (Hand Tools), Utility Knife (Hand Tools)");
    check("  and under a category nothing holds, none", said(catalogNames(offered, "nowhere")), "");
    check("the search offers at most", MAX_NAME_SUGGESTIONS, 5);
    check("  with nothing typed, the first of the names", said(suggestCatalogNames(offered)), "Angle Grinder (Power Tools), Circular Saw (Power Tools), Jigsaw (Power Tools), Laser Level (Measuring), Tape Measure (Measuring)");
    check("  a part typed, in any case and spacing, the names holding it", said(suggestCatalogNames(offered, { typed: "  KNIFE " })), "Utility Knife (Cutting), Utility Knife (Hand Tools)");
    check(
        "  six names holding it cut to the five first",
        said(suggestCatalogNames(offered, { typed: "e" })),
        "Angle Grinder (Power Tools), Laser Level (Measuring), Tape Measure (Measuring), Torque Wrench (Hand Tools), Utility Knife (Cutting)"
    );
    check("  narrowed by the category", said(suggestCatalogNames(offered, { categoryKey: "measuring" })), "Laser Level (Measuring), Tape Measure (Measuring)");
    check("  to nothing when the category holds no such name", said(suggestCatalogNames(offered, { categoryKey: "measuring", typed: "grinder" })), "");
    check("  a name typed in full is offered, since picking it goes on", said(suggestCatalogNames(offered, { typed: "angle grinder" })), "Angle Grinder (Power Tools)");
    check("  and words in another order are not one name", said(suggestCatalogNames(offered, { typed: "grinder angle" })), "");
    // ENTER IN THE SEARCH TAKES THE ONE NAME TYPED, or nothing.
    check("Enter takes the one name typed, in any case and spacing", findCatalogName(offered, { typed: "angle  GRINDER" })?.key, "power tools\nangle grinder");
    check("  not a part of one", findCatalogName(offered, { typed: "Angle" }), null);
    check("  not nothing", findCatalogName(offered, { typed: "   " }), null);
    check("  not a name two categories hold, with none chosen", findCatalogName(offered, { typed: "Utility Knife" }), null);
    check("  but that name under the category chosen", findCatalogName(offered, { categoryKey: "cutting", typed: "utility knife" })?.key, "cutting\nutility knife");
    check("  and nothing under a category that does not hold it", findCatalogName(offered, { categoryKey: "hand tools", typed: "Jigsaw" }), null);
    // THE SECOND STEP: a name's sizes, each one row, and a run of digits read as a number.
    const sizesOf = (key) => catalogSizes(offered, key).map((assetCategory) => assetCategory.size).join(", ");
    check("a name's sizes, each its own row", ids(catalogSizes(offered, "power tools\nangle grinder")), "g45,g5");
    check('  `10"` after `7-1/4"`, its figure read as a number', sizesOf("power tools\ncircular saw"), '7-1/4", 10"');
    check("  and a name nothing holds has none", sizesOf("nowhere\nnothing"), "");
    check("the one size a name is held in is already chosen (0l)", onlySize(catalogSizes(offered, "power tools\njigsaw"))?.id, "jig");
    check("  and none of several, or of none", `${onlySize(catalogSizes(offered, "power tools\ncircular saw"))}|${onlySize([])}|${onlySize(undefined)}`, "null|null|null");
    // THE ORDER EVERY ASSET LIST SAYS WORDS IN, which the category list sorts its rows by too.
    check(
        "words by their spelling, case aside, and a run of digits as a number",
        ['Circular Saw 10"', 'circular saw 7-1/4"', 'Angle Grinder 5"'].sort(compareCatalogText).join(" | "),
        'Angle Grinder 5" | circular saw 7-1/4" | Circular Saw 10"'
    );

    // ── 4: the words ─────────────────────────────────────────────────────────
    log("");
    log("every word the catalog says:");
    check("the levels' words and the class's", `${ASSET_CATEGORY_COPY.categoryLabel} | ${ASSET_CATEGORY_COPY.toolLabel} | ${ASSET_CATEGORY_COPY.sizeLabel} | ${ASSET_CATEGORY_COPY.classLabel}`, "Category | Tool | Size | Class");
    check("  the filter with nothing chosen, `All jobs`' shape", ASSET_CATEGORY_COPY.allCategories, "All categories");
    check("  the search and the size while nothing is chosen, `Choose a job`'s", `${ASSET_CATEGORY_COPY.toolUnchosen} | ${ASSET_CATEGORY_COPY.sizeUnchosen}`, "Choose a tool | Choose a size");
    const classParts = ASSET_CATEGORY_COPY.classOf("A");
    check(
        "  and the class beside a tool, its value the part in Ink",
        `${classParts.map((part) => (typeof part === "string" ? part : part.emphasis)).join("")} | ${classParts.filter((part) => typeof part !== "string").map((part) => part.emphasis).join()}`,
        "Class A | A"
    );

    // ── 5: nothing writes an `Asset Categories` row, and each field has one spelling ──────
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
        '"Assets", "Item Name", ASSET_CATEGORY_FIELDS.assetClass, ASSET_CATEGORY_FIELDS.level1, ASSET_CATEGORY_FIELDS.level2, ASSET_CATEGORY_FIELDS.size'
    );
    check("  and spelling none of them", fieldLiterals(reader).join(", "), "");
    const script = parseFile(SCRIPT);
    const imported = [];
    walk(script.ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === "../../lib/assetCategory.js") imported.push(...n.specifiers.map((s) => s.imported.name));
    });
    check(
        "the creation script takes the fields, the class's values, the expression and the reading from the module",
        imported.sort().join(", "),
        "ASSET_CATEGORY_FIELDS, ASSET_CLASS_VALUES, ITEM_NAME_FORMULA, composeItemName, readCatalog"
    );
    check("  and spells none of the fields", fieldLiterals(script).join(", "), "");

    // ── anti-vacuity ──────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // The two readers above, on a planted file writing the table three ways and spelling two
    // fields: each write is reported, and so is each spelling.
    const planted = parseSource(
        "await base(TABLES.ASSET_CATEGORIES).create([{ fields: {} }]);\n" +
            "await createRecords(TABLES.ASSET_CATEGORIES, 'Item Name', [], rowOf);\n" +
            "const table = TABLES.ASSET_CATEGORIES;\n" +
            "const tools = await base(TABLES.ASSET_CATEGORIES).select().all();\n" +
            "record.get('Level 1');\n" +
            "const field = `Class`;\n",
        "<planted-writer>"
    );
    check(
        "  three writes and a read are seen as such, the read admitted",
        categoriesTableUses(planted)
            .map((use) => `${use}:${READS.has(use) ? "read" : "not"}`)
            .join(", "),
        "base(…).create:not, createRecords:not, VariableDeclarator:not, base(…).select:read"
    );
    check("  two spelled fields are seen", fieldLiterals(planted).join(", "), "Level 1, Class");
    // The catalog's reading is seen to tell rows apart, since "every row offered" and "every
    // row set aside" are also what a reading answering one way for all would give.
    assert("  the fixture is both offered from and set aside from", offered.length > 0 && setAside.length > 0);
    assert("  and the search offers something for nothing typed", suggestCatalogNames(offered).length === MAX_NAME_SUGGESTIONS);
}

if (isMain(import.meta.url)) standalone(title, run);
