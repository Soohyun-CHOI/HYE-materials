// What linking each catalog row to its category group judges before it writes (#539), on bases of
// this check's making.
//
// THE SUBJECT IS `scripts/import/link_category_groups_539_plan.mjs`, the run's judgments apart from
// the base: the schema's state off a Metadata answer, the link each row takes, the rows that refuse
// a run, and what a ledger puts back. The script itself talks to the base, so it is never run here;
// what is held of it is its wiring, off its source — every judgment taken from the plan, the field's
// name from `lib/assetCategory.js` alone, and each write's ledger line ahead of its request.
//
// ONE READING OF WHICH GROUP A ROW STANDS IN. `categoryGroupOf` is the catalog page's own and the
// link's; the plan asks it rather than pairing rows itself, and `lib/assetCatalog.js` keeps no
// private copy of it.
//
// WHAT IT CANNOT SEE. Whether the base the script reads is shaped as these answers are — that is
// the run's own read-back, which reads every row again after its writes — and whether Airtable
// honors a link to one record, which only the hand step and the Metadata API's answer say.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { join } from "path";
import { REPO_ROOT, calleeName, callsBefore, callsTo, parentMap, parseSource, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { CATEGORY_GROUP_FIELD } from "../../../lib/assetCategory.js";
import { readCatalogEntry } from "../../../lib/assetCatalog.js";
import {
    CATALOG_TABLE,
    FILED_BY_LINK_REFUSAL,
    GROUPS_TABLE,
    GROUP_LEVEL_FIELDS,
    INVERSE_NAME,
    ROWS_PER_REQUEST,
    catalogRowOf,
    filedByLink,
    groupRowOf,
    inChunks,
    linkLine,
    planLinks,
    planRevert,
    readLedger,
    readLinks,
    schemaState,
    unlinkLine,
} from "../../import/link_category_groups_539_plan.mjs";

export const title = "Linking each catalog row to its category group judges the base first (#539)";

const SCRIPT_PATH = "scripts/import/ran/link_category_groups_539.mjs";
const PLAN_PATH = "scripts/import/link_category_groups_539_plan.mjs";
const PLAN_SPECIFIER = "./link_category_groups_539_plan.mjs";
const PLAN_SPECIFIER_FROM_RAN = "../link_category_groups_539_plan.mjs";
const CATEGORY_MODULE_PATH = "lib/assetCategory.js";
const CATALOG_MODULE_PATH = "lib/assetCatalog.js";
const WRITER_PATH = "lib/airtable/assetCategories.js";
const ACTIONS_PATH = "app/(assets)/asset-catalog/actions.js";
const IMPORT_PATH = "scripts/import/ran/import_site_assets_544.mjs";
const SYNC_PATH = "scripts/import/sync_test_catalog_544.mjs";
const CLASSIFY_PATH = "scripts/import/classify_asset_categories_514.mjs";

/** The catalog's earlier loads, each with the steps in its entry that read the catalog's rows. */
const EARLIER_LOADS = [
    { path: "scripts/import/ran/replace_asset_catalog_528.mjs", work: ["load", "remove", "revert"] },
    { path: "scripts/demo/remove_demo_catalog_517.mjs", work: ["remove", "revert"] },
    { path: "scripts/demo/seed_asset_catalog_514.mjs", work: ["listRecords"] },
];

const read = (path) => readFileSync(join(REPO_ROOT, path), "utf8");

/** A top-level function by its name, exported or not. */
function functionNamed(ast, name) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = n;
    });
    return found;
}

/** Whether an object literal under `node` holds a computed key spelled as the identifier `name`. */
function hasComputedKey(node, name) {
    let found = false;
    walk(node, (n) => (found ||= n?.type === "Property" && n.computed && n.key?.type === "Identifier" && n.key.name === name));
    return found;
}

/** A node's own source text. */
const sourceOf = (path, node) => (node ? read(path).slice(node.start, node.end) : "");

/** The arguments of the first call to `name` under `root`, as source text — or of every call, with `every`. */
function callArgsOf(path, root, name, { every = false } = {}) {
    const text = read(path);
    const calls = root ? callsTo(root, name) : [];
    const argsOf = (call) => call.arguments.map((arg) => text.slice(arg.start, arg.end));
    return every ? calls.map(argsOf) : calls[0] ? argsOf(calls[0]) : [];
}

// ── the Metadata API's answer, as the two tables come back ────────────────────

const GROUPS_ID = "tblGroups000000001";

function groupsTable(extra = []) {
    return {
        id: GROUPS_ID,
        name: GROUPS_TABLE,
        fields: [
            { id: "fldGroupLevel2001", name: "Level 2", type: "singleLineText" },
            { id: "fldGroupLevel1001", name: "Level 1", type: "singleSelect" },
            ...extra,
        ],
        views: [],
    };
}

const LINK = { id: "fldCatalogLink001", name: CATEGORY_GROUP_FIELD, type: "multipleRecordLinks", options: { linkedTableId: GROUPS_ID, inverseLinkFieldId: "fldGroupInverse01" } };
const INVERSE = { id: "fldGroupInverse01", name: INVERSE_NAME, type: "multipleRecordLinks", options: { linkedTableId: "tblCatalog0000001", inverseLinkFieldId: LINK.id } };
const TYPED = [
    { id: "fldCatalogLevel11", name: "Level 1", type: "singleSelect" },
    { id: "fldCatalogLevel21", name: "Level 2", type: "singleLineText" },
];
const lookup = (id, name, fieldIdInLinkedTable, recordLinkFieldId = LINK.id) => ({ id, name, type: "multipleLookupValues", options: { recordLinkFieldId, fieldIdInLinkedTable } });
const LOOKED_UP = [lookup("fldCatalogLevel11", "Level 1", "fldGroupLevel1001"), lookup("fldCatalogLevel21", "Level 2", "fldGroupLevel2001")];

function catalogTable(fields) {
    return { id: "tblCatalog0000001", name: CATALOG_TABLE, fields: [{ id: "fldItemName00001", name: "Item Name", type: "formula" }, ...fields], views: [] };
}

// ── a small base: groups and rows as the script reads them ────────────────────

const GROUPS = [
    { id: "gPower", level1: "Tool", level2: "Power Tools" },
    { id: "gWelding", level1: "Equipment", level2: "Welding Equipment" },
    { id: "gToolWelders", level1: "Tool", level2: "For Welders" },
    { id: "gEquipWelders", level1: "Equipment", level2: "For Welders" },
    // A second row of `Tool > Power Tools`, set aside as repeated: a row's pair names the first.
    { id: "gPowerAgain", level1: "Tool", level2: "power tools" },
    // A row with no type, which is no group.
    { id: "gNoType", level1: "", level2: "Cutters" },
];

const at = (id, level1, level2, link = [], itemName = `${id} name`) => ({ id, itemName, level1, level2, link });

export function run({ check, assert }) {
    // ── what writes a catalog row links its group (#539) ──────────────────────
    const writer = parseSource(read(WRITER_PATH), WRITER_PATH).ast;
    const fieldsOf = functionNamed(writer, "fieldsOf");
    assert("the writer's fields carry the link, keyed by the module's name for it", hasComputedKey(fieldsOf, "CATEGORY_GROUP_FIELD"));
    check("  a planted key spelled as text is not that name", hasComputedKey(parseSource('const f = { "Category Group": [id] };', "planted").ast, "CATEGORY_GROUP_FIELD"), false);
    assert("  and every level but the group's two, by the module's list of them", sourceOf(WRITER_PATH, fieldsOf).includes("ASSET_WRITTEN_LEVELS.map("));
    check("  and no level through the whole map of fields", sourceOf(WRITER_PATH, fieldsOf).includes("Object.entries(ASSET_CATEGORY_FIELDS)"), false);
    let throwsWithoutGroup = false;
    walk(fieldsOf, (n) => (throwsWithoutGroup ||= n.type === "ThrowStatement"));
    assert("  and a row with no group to link is refused before it is sent", throwsWithoutGroup);
    for (const name of ["createAssetCategory", "updateAssetCategory"]) {
        const fn = functionNamed(writer, name);
        check(`${name} takes the group it files the row under, last`, fn?.params.at(-1)?.name, "categoryGroupRecordId");
        check(`  and writes it`, callArgsOf(WRITER_PATH, fn, "fieldsOf").join(" | "), "entry | categoryGroupRecordId");
    }

    const action = parseSource(read(ACTIONS_PATH), ACTIONS_PATH).ast;
    check("the catalog page's save links the group it read or added", ["createAssetCategory", "updateAssetCategory"].map((name) => callArgsOf(ACTIONS_PATH, action, name).at(-1)).join(" | "), "group.id | group.id");
    assert("  the group added, or one another press added first", read(ACTIONS_PATH).includes("group = made.created ?? made.exists;"));
    const groups = [{ id: "gPower", level1: "Tool", level2: "Power Tools" }];
    const existing = readCatalogEntry({ level1: "Tool", assetClass: "B", level2: "power tools", level3: "Drill" }, { rows: [], groups });
    check("an entry under a standing group hands that group back", existing.group?.id, "gPower");
    const added = readCatalogEntry({ level1: "Tool", assetClass: "B", level2: "Ladders", level3: "Ladder" }, { rows: [], groups });
    check("  and one under a new category none, and says so", `${added.group}|${added.newCategory}`, "null|true");

    for (const [path, writes] of [
        [IMPORT_PATH, 3],
        [SYNC_PATH, 2],
    ]) {
        const ast = parseSource(read(path), path).ast;
        const lasts = [...callArgsOf(path, ast, "createAssetCategory", { every: true }), ...callArgsOf(path, ast, "updateAssetCategory", { every: true })];
        check(`${path}'s catalog writes`, lasts.length, writes);
        assert(`${path} hands each catalog write its group`, lasts.length > 0 && lasts.every((args) => /^groupIdOf\(/.test(args.at(-1) ?? "")));
        assert(`  found by the module's reading of a type and category`, /const groupIdOf = \([^)]*\) => categoryGroupOf\(/.test(read(path)));
    }

    // ── the earlier loads stop on a catalog filed by link ─────────────────────
    const catalogWith = (fields) => ({ name: CATALOG_TABLE, fields: fields.map((name) => ({ name })) });
    check("a catalog holding the link is filed by it", filedByLink([catalogWith(["Item Name", CATEGORY_GROUP_FIELD])]), true);
    check("  and one without it is not", filedByLink([catalogWith(["Item Name", "Level 1"])]), false);
    check("  nor another table holding a field of that name", filedByLink([{ name: GROUPS_TABLE, fields: [{ name: CATEGORY_GROUP_FIELD }] }]), false);
    assert("  the refusal names the link and both levels", FILED_BY_LINK_REFUSAL.includes(CATEGORY_GROUP_FIELD) && GROUP_LEVEL_FIELDS.every((name) => FILED_BY_LINK_REFUSAL.includes(name)));
    for (const { path, work } of EARLIER_LOADS) {
        const main = functionNamed(parseSource(read(path), path).ast, "main");
        assert(`${path} asks the mark in its entry`, callsTo(main, "filedByLink").length === 1);
        assert(`  before each step that reads a row`, work.every((name) => callsBefore(main, "filedByLink", name)));
    }

    // ── the catalog's check holds the link's words as the run wrote them ──────
    const classifyImports = parseSource(read(CLASSIFY_PATH), CLASSIFY_PATH).ast.body.filter((n) => n.type === "ImportDeclaration" && n.source.value === PLAN_SPECIFIER).flatMap((n) => n.specifiers.map((s) => s.imported?.name));
    check("the catalog's check takes the link's and its far side's words from the plan", classifyImports.sort().join(", "), "INVERSE_DESCRIPTION, INVERSE_NAME, LINK_DESCRIPTION, SINGLE_LINK_STEP");

    // ── the schema's state ────────────────────────────────────────────────────
    const fresh = schemaState(catalogTable(TYPED), groupsTable());
    check("typed levels and no link: the levels are typed", fresh.levels, "typed");
    check("typed levels and no link: no link", fresh.link, null);
    check("typed levels and no link: nothing refuses", fresh.problems.length, 0);

    const made = schemaState(catalogTable([...TYPED, LINK]), groupsTable([INVERSE]));
    check("a link to the groups: found", made.link?.id, LINK.id);
    check("a link to the groups: its far side found by its id", made.inverse?.id, INVERSE.id);
    check("a link to the groups: still typed", made.levels, "typed");

    const converted = schemaState(catalogTable([LINK, ...LOOKED_UP]), groupsTable([INVERSE]));
    check("both levels lookups through the link, of the groups' own fields: looked up", converted.levels, "looked up");
    check("looked up: nothing refuses", converted.problems.length, 0);

    const crossed = schemaState(catalogTable([LINK, lookup("fldCatalogLevel11", "Level 1", "fldGroupLevel2001"), LOOKED_UP[1]]), groupsTable([INVERSE]));
    check("Level 1 a lookup of the groups' Level 2: refused", crossed.problems.length, 1);
    const elsewhere = schemaState(catalogTable([LINK, lookup("fldCatalogLevel11", "Level 1", "fldGroupLevel1001", "fldOtherLink00001"), LOOKED_UP[1]]), groupsTable([INVERSE]));
    check("a lookup through another link: refused", elsewhere.problems.length, 1);
    const half = schemaState(catalogTable([LINK, LOOKED_UP[0], TYPED[1]]), groupsTable([INVERSE]));
    check("one level a lookup and one typed: refused", half.problems.length, 1);

    const text = schemaState(catalogTable([...TYPED, { ...LINK, type: "singleLineText", options: {} }]), groupsTable());
    assert("a Category Group that is no link: refused, naming its type", text.problems.some((p) => p.includes("singleLineText")));
    const astray = schemaState(catalogTable([...TYPED, { ...LINK, options: { linkedTableId: "tblSomewhere00001" } }]), groupsTable());
    assert("a link to another table: refused, naming it", astray.problems.some((p) => p.includes("tblSomewhere00001")));
    check("no catalog table: refused", schemaState(null, groupsTable()).problems.length, 1);
    check("no groups table: refused", schemaState(catalogTable(TYPED), null).problems.length, 1);
    check("the levels the link replaces are Level 1 and Level 2", GROUP_LEVEL_FIELDS.join(" | "), "Level 1 | Level 2");
    check("the far side keeps the name of the table it comes from", INVERSE_NAME, CATALOG_TABLE);

    // ── a REST record as the run reads it ─────────────────────────────────────
    const typedRow = catalogRowOf({ id: "rec1", fields: { "Item Name": "Drill, DeWalt", "Level 1": "Tool", "Level 2": "Power Tools" } });
    check("a typed row: its type", typedRow.level1, "Tool");
    check("a typed row: its category", typedRow.level2, "Power Tools");
    check("a typed row with no link: an empty link", typedRow.link.length, 0);
    const linkedRow = catalogRowOf({ id: "rec2", fields: { "Item Name": "Drill", "Level 1": ["Tool"], "Level 2": ["Power Tools"], [CATEGORY_GROUP_FIELD]: ["gPower"] } });
    check("a looked-up row: its type out of the lookup", linkedRow.level1, "Tool");
    check("a looked-up row: its link", linkedRow.link.join(","), "gPower");
    check("a group off a REST record", JSON.stringify(groupRowOf({ id: "g", fields: { "Level 1": "Equipment", "Level 2": "Lift Equipment" } })), JSON.stringify({ id: "g", level1: "Equipment", level2: "Lift Equipment" }));

    // ── each row against the groups ────────────────────────────────────────────
    const rows = [
        at("rNew", "Tool", "Power Tools"),
        at("rLinked", "Tool", "Power Tools", ["gPower"]),
        at("rSpelled", "Tool", "power  tools"),
        at("rNoGroup", "Tool", "Welding Equipment"),
        at("rElsewhere", "Tool", "Power Tools", ["gWelding"]),
        at("rTwice", "Tool", "Power Tools", ["gPower", "gWelding"]),
        at("rEquipWelders", "Equipment", "For Welders"),
        at("rRepeated", "Tool", "Power Tools", ["gPowerAgain"]),
        at("rUntyped", "", "Cutters"),
    ];
    const p = planLinks(rows, GROUPS);
    check("rows to link, each to its pair's group", p.writes.map(({ row, group }) => `${row.id}→${group.id}`).join(" "), "rNew→gPower rSpelled→gPower rEquipWelders→gEquipWelders");
    check("a row linked to its pair's group already: nothing to write", p.linked.map(({ row }) => row.id).join(" "), "rLinked");
    check("a row spelling its category otherwise than its group: linked and said", p.respelled.map(({ row }) => row.id).join(" "), "rSpelled");
    check(
        "the rows that refuse the run",
        p.problems.map(({ row }) => row.id).join(" "),
        "rNoGroup rElsewhere rTwice rRepeated rUntyped"
    );
    assert("a pair no group holds says so, with the pair", p.problems.find(({ row }) => row.id === "rNoGroup")?.why.includes("Tool > Welding Equipment"));
    assert("a link to another group names both", /gWelding.*gPower/.test(p.problems.find(({ row }) => row.id === "rElsewhere")?.why ?? ""));
    assert("two links say how many", p.problems.find(({ row }) => row.id === "rTwice")?.why.startsWith("links 2 groups"));
    assert("one category under both types: the type decides the group", p.writes.some(({ row, group }) => row.id === "rEquipWelders" && group.level1 === "Equipment"));
    check("a group with no type is none to link to", planLinks([at("rCutters", "Tool", "Cutters")], GROUPS).problems.length, 1);

    // ── once the levels read through the link ─────────────────────────────────
    const links = readLinks([at("a", "Tool", "Power Tools", ["gPower"]), at("b", "", "", []), at("c", "Tool, Tool", "Power Tools, Welding Equipment", ["gPower", "gWelding"])]);
    check("looked up: a row with one group is linked", links.linked.map((row) => row.id).join(" "), "a");
    check("looked up: no group and two groups refuse", links.problems.map(({ row }) => row.id).join(" "), "b c");

    // ── the ledger, and what it puts back ─────────────────────────────────────
    const line = linkLine(at("rNew", "Tool", "Power Tools", [], "Drill"), GROUPS[0]);
    check("a link's line: its name, levels, group, before and after", JSON.stringify(line), JSON.stringify({ type: "link", id: "rNew", itemName: "Drill", level1: "Tool", level2: "Power Tools", group: GROUPS[0], before: [], after: ["gPower"] }));
    // Read inside a try, so a reading that throws on a blank line fails here rather than stopping the check.
    let lines = [];
    try {
        lines = readLedger(
            [
                JSON.stringify({ type: "run" }),
                JSON.stringify({ type: "link", id: "r1", before: [], after: ["g1"] }),
                "",
                JSON.stringify({ type: "link", id: "r2", before: [], after: ["g1"] }),
                JSON.stringify({ type: "link", id: "r3", before: [], after: ["g2"] }),
                JSON.stringify({ type: "link", id: "r4", before: [], after: ["g2"] }),
                JSON.stringify({ type: "link", id: "r1", before: ["g9"], after: ["g1"] }),
            ].join("\r\n")
        );
    } catch {
        lines = [];
    }
    check("a ledger read over CRLF with a blank line", lines.length, 6);
    const revert = planRevert(lines, [at("r1", "", "", ["g1"]), at("r2", "", "", []), at("r3", "", "", ["g5"])]);
    check("a revert puts back a link the ledger wrote", revert.writes.map(({ row, line }) => `${row.id}→${line.before.join(",") || "none"}`).join(" "), "r1→none");
    check("a revert finds a link back already", revert.back.map(({ row }) => row.id).join(" "), "r2");
    check("a revert refuses a row linked otherwise since, and a row gone", revert.problems.map(({ line }) => line.id).join(" "), "r3 r4");
    check("a revert's line: the link going back", JSON.stringify(unlinkLine(at("r1", "", "", ["g1"], "Drill"), { before: [] })), JSON.stringify({ type: "unlink", id: "r1", itemName: "Drill", before: ["g1"], after: [] }));
    check("ten rows to a request", ROWS_PER_REQUEST, 10);
    check("twenty-three rows are three requests", inChunks(Array.from({ length: 23 }, (_, i) => i)).map((chunk) => chunk.length).join(","), "10,10,3");

    // ── the wiring, off the sources ────────────────────────────────────────────
    const scriptSource = read(SCRIPT_PATH);
    const planSource = read(PLAN_PATH);
    const script = parseSource(scriptSource, SCRIPT_PATH).ast;
    const plan = parseSource(planSource, PLAN_PATH).ast;

    const importsFrom = (ast, specifier) =>
        ast.body.filter((node) => node.type === "ImportDeclaration" && node.source.value === specifier).flatMap((node) => node.specifiers.map((s) => s.imported?.name));
    const planImports = importsFrom(plan, "../../lib/assetCategory.js");
    assert("the plan asks lib/assetCategory.js which group a row stands in", planImports.includes("categoryGroupOf"));
    assert("the plan takes the link's name from lib/assetCategory.js", planImports.includes("CATEGORY_GROUP_FIELD"));
    const scriptImports = importsFrom(script, PLAN_SPECIFIER_FROM_RAN);
    for (const name of ["schemaState", "planLinks", "readLinks", "planRevert", "linkLine", "unlinkLine", "catalogRowOf", "groupRowOf"]) {
        assert(`the script takes ${name} from the plan`, scriptImports.includes(name));
    }
    assert("the script asks lib/airtableBase.js which base it reaches", importsFrom(script, "../../../lib/airtableBase.js").includes("resolveAirtableBase"));

    const literals = (ast, value) => {
        let count = 0;
        walk(ast, (node) => {
            if (node.type === "Literal" && node.value === value) count++;
            if (node.type === "TemplateLiteral" && node.quasis.some((q) => q.value.cooked === value)) count++;
        });
        return count;
    };
    check("the script spells the link's name nowhere", literals(script, "Category Group"), 0);
    check("the plan spells the link's name nowhere", literals(plan, "Category Group"), 0);
    check("lib/assetCategory.js spells it once", literals(parseSource(read(CATEGORY_MODULE_PATH), CATEGORY_MODULE_PATH).ast, "Category Group"), 1);
    check("the link's name", CATEGORY_GROUP_FIELD, "Category Group");

    // Every request that writes a link has its ledger lines written before it, in the same block —
    // asked of the script, and of a planted loop that sends first, which the same reading must refuse.
    const writesAhead = ledgerFirst(script);
    check("the script's link writes", writesAhead.length, 2);
    assert("each link write's ledger lines come first, in its own block", writesAhead.length > 0 && writesAhead.every(Boolean));
    const planted = ledgerFirst(parseSource("async function f(air, ledger, chunk) { for (const row of chunk) { await air.updateRecords(1, chunk); ledger.write(row); } }", "planted").ast);
    check("a planted loop that sends before it ledgers is read as one write", planted.length, 1);
    check("a planted loop that sends before it ledgers is refused", planted[0], false);

    // The catalog page reads the same group a row's link takes.
    const catalogModule = parseSource(read(CATALOG_MODULE_PATH), CATALOG_MODULE_PATH).ast;
    assert("lib/assetCatalog.js asks categoryGroupOf", importsFrom(catalogModule, "./assetCategory.js").includes("categoryGroupOf"));
    let privateCopy = false;
    walk(catalogModule, (node) => (privateCopy ||= node.type === "FunctionDeclaration" && /groupOf/i.test(node.id?.name ?? "")));
    check("lib/assetCatalog.js keeps no group reading of its own", privateCopy, false);
}

/** For each `updateRecords` call, whether a `write` call stands in an earlier statement of its own block. */
function ledgerFirst(ast) {
    const parents = parentMap(ast);
    const found = [];
    walk(ast, (node) => {
        if (node.type !== "CallExpression" || calleeName(node) !== "updateRecords") return;
        let statement = node;
        while (parents.get(statement) && parents.get(statement).type !== "BlockStatement") statement = parents.get(statement);
        const block = parents.get(statement);
        const before = block ? block.body.slice(0, block.body.indexOf(statement)) : [];
        let ledgered = false;
        for (const earlier of before) walk(earlier, (n) => (ledgered ||= n.type === "CallExpression" && calleeName(n) === "write"));
        found.push(ledgered);
    });
    return found;
}

if (isMain(import.meta.url)) standalone(title, run);
