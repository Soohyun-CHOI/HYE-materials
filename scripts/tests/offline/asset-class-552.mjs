// What keeping the catalog's class judges before the field goes (#552), on bases of this check's
// making, and where the class is still named.
//
// THE SUBJECT IS `scripts/import/keep_asset_class_552_plan.mjs`, the run's judgments apart from
// the base: the field as #507 made it, what refers to it, the ledger a run writes and whether one
// already holds what the base holds. The script talks to the base, so it is never run here; what
// is held of it is its shape, off its source — a GET and no other request, every judgment the
// plan's, and one file written, the ledger.
//
// AND THE ONE PLACE THE CLASS IS NAMED. `lib/assetCategory.js` named the field and its two values
// from #507 until #552; under `app/` and `lib/` the name is retired (`offline/table-field-names.mjs`)
// and the module's own check holds its six fields by value. Under `scripts/` the plan names it, and
// the catalog's check and the earlier catalog scripts take it from there, so no `.mjs` there spells
// it. `create_tools_334.py` lists `Class` among the fields #507 made: Python cannot import the plan,
// and that script refuses to run on either base before any of it is read.
//
// WHAT IT CANNOT SEE. Whether a base is shaped as these answers are — the run's own reads say that,
// and the ledger it writes is the record — and whether the hand step has been made, which the
// catalog's check reports on the base itself.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readdirSync } from "fs";
import { join } from "path";
import { REPO_ROOT, calleeName, parseFile, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import {
    CATALOG_TABLE,
    CLASS_FIELD,
    DELETE_STEP,
    NAME_FIELD,
    SCRIPT,
    classFieldOf,
    holdsTheSame,
    isLedgerOf,
    ledgerLines,
    ledgerName,
    readLedger,
    referencesTo,
} from "../../import/keep_asset_class_552_plan.mjs";

export const title = "The catalog's class is kept in a ledger before it goes, and named in one place (#552)";

const SCRIPT_PATH = "scripts/import/keep_asset_class_552.mjs";
const PLAN_PATH = "scripts/import/keep_asset_class_552_plan.mjs";
const CLASSIFY_PATH = "scripts/import/classify_asset_categories_514.mjs";

/** The class field as the Metadata API answers for it on a base #507 made. */
const FIELD = Object.freeze({
    id: "fldCwhAW8RSMLAT7R",
    name: "Class",
    type: "singleSelect",
    options: { choices: [{ id: "selA", name: "A", color: "blueLight2" }, { id: "selB", name: "B", color: "cyanLight2" }] },
    description: "How much the kind matters (#507).",
});

/** A catalog table holding `fields`, as the Metadata API returns one. */
const tableWith = (...fields) => ({ id: "tblCat", name: CATALOG_TABLE, fields: [{ id: "fldName", name: NAME_FIELD, type: "formula" }, ...fields] });

/** A REST record of the catalog, read by field name. */
const record = (id, itemName, value, level3 = itemName) => ({
    id,
    fields: { [NAME_FIELD]: itemName, "Level 1": ["Tool"], "Level 2": ["Power Tools"], "Level 3": level3, ...(value === undefined ? {} : { Class: value }) },
});

/** Every `.mjs` under a directory of the repository, by its path from the root (`_ast.mjs:listJsFiles` lists `.js`). */
function mjsFiles(dir) {
    return readdirSync(join(REPO_ROOT, dir), { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
        .map((entry) => toPosix(join(entry.parentPath ?? entry.path, entry.name)).slice(toPosix(REPO_ROOT).length + 1))
        .filter((path) => !path.split("/").includes("node_modules"));
}

/** Every string literal a parsed file holds. */
function stringsOf(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        if (n.type === "TemplateLiteral") for (const quasi of n.quasis) out.push(quasi.value.cooked ?? "");
    });
    return out;
}

export function run({ check, assert, log }) {
    // ── the field as #507 made it ───────────────────────────────────────────
    log("the field #507 made, and every way a table holds it otherwise:");
    check(
        "the field, by value: its id on both bases, its name, its type, its two values and their colors",
        `${CLASS_FIELD.id} ${CLASS_FIELD.name} ${CLASS_FIELD.type} ${CLASS_FIELD.values.join("/")} ${CLASS_FIELD.colors.join("/")}`,
        "fldCwhAW8RSMLAT7R Class singleSelect A/B blueLight2/cyanLight2"
    );
    const found = classFieldOf(tableWith(FIELD));
    check("  found by its id, with nothing wrong", `${found.field?.id} ${found.problems.length}`, "fldCwhAW8RSMLAT7R 0");
    check("  found by its name where its id is another, and refused for it", classFieldOf(tableWith({ ...FIELD, id: "fldOther0000000000" })).problems.join(" | "), "Class is fldOther0000000000, not fldCwhAW8RSMLAT7R, the field #507 made");
    check("  found by its id under another name, and refused for it", classFieldOf(tableWith({ ...FIELD, name: "Grade" })).problems.join(" | "), 'fldCwhAW8RSMLAT7R is named "Grade", not Class');
    check("  a field of another type refused", classFieldOf(tableWith({ ...FIELD, type: "singleLineText", options: undefined })).problems.join(" | "), "Class is a singleLineText, not a singleSelect | Class's choices are none, not A | B");
    check(
        "  choices otherwise refused",
        classFieldOf(tableWith({ ...FIELD, options: { choices: [{ name: "A" }, { name: "B" }, { name: "C" }] } })).problems.join(" | "),
        "Class's choices are A | B | C, not A | B"
    );
    const gone = classFieldOf(tableWith());
    check("  and a table holding none is the state after the hand step: no field, nothing wrong", `${gone.field} ${gone.problems.length}`, "null 0");

    log("");
    log("what refers to it, across the base:");
    const tables = [
        tableWith(FIELD, { id: "fldTag", name: "Tag", type: "formula", options: { formula: "{fldCwhAW8RSMLAT7R}", referencedFieldIds: ["fldCwhAW8RSMLAT7R"] } }),
        { id: "tblAssets", name: "Assets", fields: [{ id: "fldKind", name: "Kind Class", type: "multipleLookupValues", options: { recordLinkFieldId: "fldCat", fieldIdInLinkedTable: "fldCwhAW8RSMLAT7R" } }, { id: "fldNote", name: "Note", type: "singleLineText" }] },
    ];
    check("  a formula naming it and a lookup through it, each by table and field", referencesTo(FIELD.id, tables).join(" | "), 'Asset Categories."Tag" (formula) | Assets."Kind Class" (multipleLookupValues)');
    check(
        "  and a base naming it nowhere but in the field itself refers to nothing, a field naming its name and not its id among it",
        `${referencesTo(FIELD.id, [tableWith(FIELD, { id: "fldWord", name: "Word", type: "formula", options: { formula: '"Class"' } })]).length} ${referencesTo(FIELD.id, undefined).length}`,
        "0 0"
    );

    // ── the ledger a run writes ─────────────────────────────────────────────
    log("");
    log("the ledger a run writes, and whether one already holds the base:");
    const records = [record("rec1", "Drill", "A"), record("rec2", "Grinder", "B"), record("rec3", "Hammer", undefined)];
    const lines = ledgerLines({ base: "test", at: "2026-10-21T20:00:00.000Z", field: FIELD, records });
    const [run, ...rows] = lines;
    check(
        "the run first: the script, the base by name, when, the table, the field as described, and the counts",
        JSON.stringify(run),
        JSON.stringify({
            type: "run",
            script: SCRIPT,
            base: "test",
            at: "2026-10-21T20:00:00.000Z",
            table: CATALOG_TABLE,
            field: {
                id: "fldCwhAW8RSMLAT7R",
                name: "Class",
                type: "singleSelect",
                choices: [
                    { name: "A", color: "blueLight2" },
                    { name: "B", color: "cyanLight2" },
                ],
                description: "How much the kind matters (#507).",
            },
            rows: 3,
            counts: { A: 1, B: 1, none: 1 },
        })
    );
    check(
        "  then a row for every catalog row in the base's order, its id, its name, its path through the lookups and its class, none as null",
        rows.map((row) => `${row.type}:${row.id}:${row.itemName}:${row.level1}/${row.level2}/${row.level3}:${row.value}`).join(" | "),
        "row:rec1:Drill:Tool/Power Tools/Drill:A | row:rec2:Grinder:Tool/Power Tools/Grinder:B | row:rec3:Hammer:Tool/Power Tools/Hammer:null"
    );
    check("  each row's keys", Object.keys(rows[0]).join(", "), "type, id, itemName, level1, level2, level3, size, maker, partNumber, value");
    const text = lines.map((line) => JSON.stringify(line)).join("\r\n") + "\r\n  \r\n";
    const readBack = (() => {
        try {
            return JSON.stringify(readLedger(text));
        } catch (error) {
            return `threw: ${error.message}`;
        }
    })();
    check("a ledger reads back over CRLF, a line of spaces skipped", readBack, JSON.stringify(lines));
    const later = ledgerLines({ base: "test", at: "2026-10-22T09:00:00.000Z", field: FIELD, records });
    check("  one written later of the same base holds the same", holdsTheSame(lines, later), true);
    check(
        "  and one whose value, row, order or field differs does not, nor two that open on no run",
        [
            holdsTheSame(lines, ledgerLines({ base: "test", at: "x", field: FIELD, records: [record("rec1", "Drill", "B"), ...records.slice(1)] })),
            holdsTheSame(lines, ledgerLines({ base: "test", at: "x", field: FIELD, records: [...records, record("rec4", "Saw", "A")] })),
            holdsTheSame(lines, ledgerLines({ base: "test", at: "x", field: FIELD, records: [...records].reverse() })),
            holdsTheSame(lines, ledgerLines({ base: "test", at: "x", field: { ...FIELD, description: "" }, records })),
            holdsTheSame([{ type: "row" }, ...rows], [{ type: "row" }, ...rows]),
        ].join(" "),
        "false false false false false"
    );
    check("its file name: the script, the base and the moment, made safe for Windows", ledgerName("live", "2026-10-21T20:00:00.000Z"), "keep_asset_class_552-live-2026-10-21T20-00-00-000Z.jsonl");
    check(
        "  and a ledger is one of this script's on its base by that name alone",
        [isLedgerOf("keep_asset_class_552-live-x.jsonl", "live"), isLedgerOf("keep_asset_class_552-test-x.jsonl", "live"), isLedgerOf("describe_note_533-live-x.jsonl", "live"), isLedgerOf("keep_asset_class_552-live-x.json", "live")].join(" "),
        "true false false false"
    );
    check("the hand step names the column and waits for the ledger", DELETE_STEP, "In Asset Categories, open the Class column's menu and choose Delete field — once scripts/import/keep_asset_class_552.mjs has written that base's ledger or found it unchanged.");

    // ── the script's shape ──────────────────────────────────────────────────
    log("");
    log("the script reads and writes nothing but the ledger, off its source:");
    const script = parseFile(SCRIPT_PATH);
    const fetches = [];
    const writes = [];
    walk(script.ast, (n) => {
        if (n.type !== "CallExpression") return;
        const name = calleeName(n);
        if (name === "fetch") fetches.push(script.source.slice(n.start, n.end));
        if (/^(writeFileSync|appendFileSync|unlinkSync|rmSync|renameSync)$/.test(name ?? "")) writes.push(name);
    });
    check(
        "  one fetch, a GET, and no other method spelled",
        `${fetches.length} ${fetches.every((call) => /method: "GET"/.test(call))} ${/"(POST|PATCH|PUT|DELETE)"/.test(script.source)}`,
        "1 true false"
    );
    check("  and one file written, the ledger", writes.join(", "), "writeFileSync");
    const fromPlan = [];
    walk(script.ast, (n) => {
        if (n.type === "ImportDeclaration" && n.source.value === "./keep_asset_class_552_plan.mjs") for (const s of n.specifiers) fromPlan.push(s.imported.name);
    });
    check(
        "  every judgment the plan's",
        fromPlan.sort().join(", "),
        "CATALOG_TABLE, CLASS_FIELD, DELETE_STEP, NAME_FIELD, classFieldOf, holdsTheSame, isLedgerOf, ledgerLines, ledgerName, readLedger, referencesTo"
    );
    check(
        "  and the plan imports the catalog's one reading of a row and nothing that reaches the base",
        [...parseFile(PLAN_PATH).source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]).join(" "),
        "../../lib/assetCategory.js"
    );

    // ── the catalog's check, and the one spelling ───────────────────────────
    log("");
    log("the catalog's check counts the standing field due and fails a base still holding it:");
    const classify = parseFile(CLASSIFY_PATH).source;
    check(
        "  the field, its step and its judgment taken from the plan, a hand step while it stands, a failure after",
        [
            /import \{ CLASS_FIELD, DELETE_STEP, classFieldOf \} from "\.\/keep_asset_class_552_plan\.mjs";/.test(classify),
            /if \(classFieldOf\(table\)\.field\) \{\s*due\+\+;/.test(classify),
            /if \(classFieldOf\(table\)\.field\) failures\.push\(/.test(classify),
            !/ASSET_CLASS_VALUES|assetClass/.test(classify),
        ].join(" "),
        "true true true true"
    );
    const walked = mjsFiles("scripts");
    // This file is left out: it plants the field by value, as a check pinning a value is its reader.
    const self = "scripts/tests/offline/asset-class-552.mjs";
    const spelled = walked.filter((path) => path !== PLAN_PATH && path !== self && stringsOf(parseFile(path).ast).some((value) => value === CLASS_FIELD.name));
    check("no .mjs under scripts/ but the plan spells the field's name", spelled.join(", "), "");
    assert("  (anti-vacuity) the walk reads the plan, which does", walked.includes(PLAN_PATH) && stringsOf(parseFile(PLAN_PATH).ast).includes(CLASS_FIELD.name));
    assert(
        "  and reaches every script that takes it from there",
        ["scripts/import/replace_asset_catalog_528.mjs", "scripts/demo/seed_asset_catalog_514.mjs", CLASSIFY_PATH, "scripts/tests/offline/asset-category.mjs"].every((path) => walked.includes(path))
    );
}

if (isMain(import.meta.url)) standalone(title, run);
