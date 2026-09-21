// Adding a path to the catalog from the app (#368).
//
// WHAT THIS IS FOR. Until #368 a path the tree did not have was typed into
// Airtable by hand: four codes, four names and an item name, with three rules held
// nowhere but in a note and in a field's description. `/admin/categories/new`
// applies them, and this file is what holds the rules the screen now carries — the
// 900 block's arithmetic, which level 3 a name resolves to, what a no-division mark
// stores, and the name a document will print.
//
// SEVEN CLAIMS, EACH WITH A MUTANT NAMED BESIDE IT. Verified by mutation, in the
// tree, before this text was written:
//   1. A minted code takes the next number IN the block — drop the `>= floor`
//      filter and a parent whose HQ children reach 033 mints 034.
//   2. It is MAX + 1 and not first-free — hand it a gap and the assertion below
//      fails if it fills one.
//   3. The block's end is a refusal and not a fourth digit — raise the ceiling
//      filter and the eleven-digit assertion fails.
//   4. A no-division mark reuses a placeholder sibling rather than adding a second
//      — drop the `isNoDivisionName` branch in `resolveLevel3` and the `Other`
//      case mints a `Standard` beside it.
//   5. A level-4 name that already exists is a refusal where a level-3 one is a
//      choice — swap either and one of the two assertions below fails.
//   6. The draft is a DRAFT: it reproduces 347 of the 777 committed names and not
//      777, which is what the two counts here hold in place.
//   7. The screen holds no sentence of its own — write one into the form and the
//      literal scan finds it.
//
// THE ANTI-VACUITY IS INSIDE 5 RATHER THAN BESIDE IT: "no refusal" and "the plan
// cannot see anything" are the same result, so the first thing asked of the plan is
// whether its inputs produce more than one answer at all. The draft's pair of
// counts does the same job one claim down — a rule that matched everything and a
// rule that matched nothing would each move one of them.
//
// AND THE PREMISE IS ASSERTED THE OTHER WAY UP FROM `material-categories.mjs`.
// That file holds, as a literal, that no committed leaf uses the 900 block and that
// HQ's highest tail is 33; this one holds that the module's floor is 901 as a
// literal, and then compares the two — a second path to the same fact rather than
// an expression over one value, which is #224's rule and the mistake
// `offline/tool-label-qr.mjs` made first.
//
// WHAT IT CANNOT SEE is the screen. Whether the controls render, whether a level
// disables when its parent is unpicked, whether the preview's two lines are legible
// and whether the draft stops overwriting once somebody types are browser facts
// this tier never reaches — they are measured in the pull request. What it holds is
// that there is one implementation of each rule to look at.
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFile, REPO_ROOT, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { parseCsv } from "./material-categories.mjs";
import {
    CATEGORY_LABEL_SKIPPED,
    CATEGORY_LEVELS,
    keptCategorySegments,
} from "../../../lib/materialCategory.js";
import {
    BRANCH_CODE_CEILING,
    BRANCH_CODE_FLOOR,
    BRANCH_CODE_WIDTH,
    CATEGORY_CREATION_COPY as COPY,
    ITEM_NAME_SEPARATOR,
    LEVEL_CHOICE,
    NO_DIVISION_NAME,
    categoryLabelFor,
    categoryNameKey,
    categoryRecordFields,
    draftItemName,
    isNoDivisionName,
    matchExistingCategoryName,
    narrowParent,
    nextBranchCode,
    planCategory,
} from "../../../lib/categoryCreation.js";

export const title = "Adding a path to the catalog from the app (#368)";

const CSV_PATH = "scripts/import/material_categories.csv";
const FORM = "app/admin/categories/new/CategoryForm.js";
const PAGE = "app/admin/categories/new/page.js";
const ACTION = "app/admin/categories/new/actions.js";

/** The two figures the draft is worth, typed out so a catalog change moves them. */
const DRAFT_REPRODUCES = 347;
const TEMPLATE_A_ROWS = 360;
const DRAFT_REPRODUCES_TEMPLATE_A = 285;
/** The committed rows whose label collapses to one segment, so the draft is empty. */
const DRAFT_EMPTY = 12;
/** HQ's own highest last-three, against the floor. `material-categories.mjs`' own figure. */
const HIGHEST_HQ_LEAF_TAIL = 33;

/**
 * One category in the shape `toCategory` produces, which is what both callers of
 * `planCategory` hand it. Spelled here rather than imported because a fixture that
 * goes through the production mapper would share its bugs.
 */
function row({ codes, names, label, itemName, recordId = "recX" }) {
    return { recordId, label: label ?? names.join(" > "), itemName: itemName ?? names[3], codes, names };
}

/** The tree the plan assertions run against: one level 1, one level 2, three leaves. */
const TREE = [
    row({
        codes: ["17", "1704", "1704001", "1704001003"],
        names: ["Plumbing", "Pipe Support Materials", "Pipe Hanger", "Standard"],
        itemName: "Pipe Hanger",
    }),
    row({
        codes: ["17", "1704", "1704001", "1704001005"],
        names: ["Plumbing", "Pipe Support Materials", "Pipe Hanger", "Clevis Hanger"],
        itemName: "Pipe Hanger, Clevis Hanger",
    }),
    row({
        codes: ["17", "1704", "1704002", "1704002001"],
        names: ["Plumbing", "Pipe Support Materials", "Strut Framing System", "Strut Channel"],
        itemName: "Strut Framing System, Strut Channel",
    }),
];

/** A complete submission against `TREE`, with whatever it overrides. */
function fields(over = {}) {
    return {
        level1Code: "17",
        level2Code: "1704",
        level3Choice: "1704002",
        level3Name: "",
        level4NoDivision: false,
        level4Name: "Bracket",
        itemName: "Strut Framing System, Bracket",
        ...over,
    };
}

export function run({ check, log, assert }) {
    log("the 900 block: the floor, the arithmetic and the end of it:");
    check("the floor is 901", BRANCH_CODE_FLOOR, 901);
    check("the ceiling is 999", BRANCH_CODE_CEILING, 999);
    check("a code adds three digits to its parent's", BRANCH_CODE_WIDTH, 3);
    check(
        "a parent with nothing in the block gets the floor",
        nextBranchCode("0101002", []).code,
        "0101002901"
    );
    check("  which is a ten-digit leaf code", nextBranchCode("0101002", []).code.length, 10);
    // HQ's OWN CHILDREN DO NOT COUNT, which is what makes the block a block. The
    // mutant is dropping the floor filter: this parent would then mint 034.
    check(
        "HQ's own numbering is not counted",
        nextBranchCode("0101002", ["0101002001", "0101002033"]).code,
        "0101002901"
    );
    // MAX + 1, `nextSequence`'s rule: a gap is a free number, not a wrong record.
    check(
        "the next is the highest in the block plus one",
        nextBranchCode("0101002", ["0101002901", "0101002903"]).code,
        "0101002904"
    );
    // A code does not encode its ancestors — 11 committed rows break prefix
    // nesting — so a sibling is read for the number in its own last three digits.
    check(
        "a sibling whose code does not nest still spends its number",
        nextBranchCode("0101002", ["4001001901"]).code,
        "0101002902"
    );
    check(
        "the last code in the block is reachable",
        nextBranchCode("0101002", ["0101002998"]).code,
        "0101002999"
    );
    // THE END IS A REFUSAL AND NOT A FOURTH DIGIT: `Level 4 Code` is ten digits on
    // every committed row, and an eleven-digit one would break the assertion that
    // makes these codes readable as text.
    const full = nextBranchCode("0101002", ["0101002999"]);
    check("a full block is refused", full.code, null);
    assert("  and the refusal names the range", full.refusal.includes(String(BRANCH_CODE_FLOOR)));
    let threw = false;
    try {
        nextBranchCode("01-01", []);
    } catch {
        threw = true;
    }
    check("a parent code that is not digits throws", threw, true);

    log("");
    log("the premise the block rests on, compared against the committed tree:");
    const rows = committedRows();
    const tails = rows.map((r) => Number(r["Level 4 Code"].slice(-3)));
    // TWO PATHS TO ONE FACT. The module's floor is a literal above; HQ's highest
    // tail is read off the CSV here. Neither is derived from the other, which is
    // what `material-categories.mjs`' own 900-block assertions could not offer
    // this file.
    check("HQ's highest last-three", Math.max(...tails), HIGHEST_HQ_LEAF_TAIL);
    check("  which is below the floor", Math.max(...tails) < BRANCH_CODE_FLOOR, true);
    check("committed leaves in the block", tails.filter((n) => n >= BRANCH_CODE_FLOOR).length, 0);

    log("");
    log("a level with no division below it:");
    check("the word written is one the label drops", CATEGORY_LABEL_SKIPPED.includes(NO_DIVISION_NAME), true);
    check("  and it is Standard", NO_DIVISION_NAME, "Standard");
    check("  not Other, which is HQ's and is never written here", NO_DIVISION_NAME === "Other", false);
    // THE MARK MATCHES EITHER PLACEHOLDER, which is what stops a parent gaining a
    // second child that means nothing-below.
    for (const word of CATEGORY_LABEL_SKIPPED) {
        check(`  ${word} reads as no division`, isNoDivisionName(word), true);
    }
    check("  case-insensitively", isNoDivisionName(" standard "), true);
    check("  and a real name does not", isNoDivisionName("Clevis Hanger"), false);
    // THE SCREEN DOES NOT ASK FOR THE WORD. What the person chooses is the meaning.
    check("the option says nothing about the stored word", COPY.noDivision.includes(NO_DIVISION_NAME), false);
    check("  nor does the sentence under it", COPY.noDivisionNote.includes(NO_DIVISION_NAME), false);

    log("");
    log("the drafted item name, and what a draft is worth:");
    check("the segments join with a comma", ITEM_NAME_SEPARATOR, ", ");
    check(
        "a full path drafts the three levels below the first",
        draftItemName(["Stainless Steel (SUS)", "Tube", "SUS 304", "AP"]),
        "Tube, SUS 304, AP"
    );
    check(
        "a placeholder level drops out",
        draftItemName(["PVC", "Pipe", "Standard", "Socket"]),
        "Pipe, Socket"
    );
    check(
        "a level repeating the one last kept drops out",
        draftItemName(["PVC", "Pipe", "Standard", "Pipe"]),
        "Pipe"
    );
    check(
        "a path that collapses drafts nothing",
        draftItemName(["PFA", "Other", "Standard", "Standard"]),
        ""
    );
    // THE RULE IS THE LABEL'S, MINUS LEVEL 1 — one implementation, so the two
    // cannot disagree about which levels count.
    const names = ["Plumbing", "Pipe Support Materials", "Strut Framing System", "Bracket"];
    check(
        "it is the label's kept segments without the first",
        draftItemName(names),
        keptCategorySegments(rowFromNames(names)).slice(1).join(ITEM_NAME_SEPARATOR)
    );
    // MEASURED OVER THE COMMITTED TREE, AND THE POINT IS THAT IT IS NOT 777. #415
    // measured eight templates behind these names, so no rule produces them; the
    // field is stored and this screen drafts into it.
    const reproduced = rows.filter((r) => draftItemName(namesOf(r)) === r[ITEM_NAME_COLUMN]).length;
    check(`the draft reproduces ${DRAFT_REPRODUCES} of the committed names`, reproduced, DRAFT_REPRODUCES);
    check(
        "  and does not reproduce the rest",
        rows.length - reproduced,
        rows.length - DRAFT_REPRODUCES
    );
    const templateA = rows.filter((r) => r.Template === "A");
    check("  HQ's commonest template is this many rows", templateA.length, TEMPLATE_A_ROWS);
    check(
        `  of which it reproduces ${DRAFT_REPRODUCES_TEMPLATE_A}`,
        templateA.filter((r) => draftItemName(namesOf(r)) === r[ITEM_NAME_COLUMN]).length,
        DRAFT_REPRODUCES_TEMPLATE_A
    );
    check(
        "  and the empty draft is a real state",
        rows.filter((r) => draftItemName(namesOf(r)) === "").length,
        DRAFT_EMPTY
    );

    log("");
    log("the name key, which is #18's fold and not a second one:");
    check("case is folded", categoryNameKey("Tube, SUS 304, AP"), categoryNameKey("tube, sus 304, ap"));
    check("ends and internal runs are collapsed", categoryNameKey("  Tube,   SUS 304 "), "tube, sus 304");
    check("a blank name has no key", categoryNameKey("   "), "");
    check(
        "a taken name is found on the loaded tree",
        matchExistingCategoryName("pipe hanger", TREE)?.itemName,
        "Pipe Hanger"
    );
    check("a free one is not", matchExistingCategoryName("Bracket", TREE), null);
    check("and a blank matches nothing", matchExistingCategoryName("", TREE), null);

    log("");
    log("narrowing to a parent, without touching the item picker's own walk:");
    const empty = narrowParent(TREE, ["", "", ""]);
    check("three levels come back", empty.levels.length, 3);
    check("  level 1 offers the branch", empty.levels[0].options.length, 1);
    check("  level 2 offers nothing until one is picked", empty.levels[1].options.length, 0);
    const parent = narrowParent(TREE, ["17", "1704", ""]);
    check("a chosen level 2 offers its own children", parent.levels[2].options.map((o) => o.code).join(","), "1704001,1704002");
    check(
        "  by name",
        parent.levels[2].options.map((o) => o.name).join(","),
        "Pipe Hanger,Strut Framing System"
    );
    const under = narrowParent(TREE, ["17", "1704", "1704001"]);
    check("a chosen level 3 lists the names under it", under.level4Names.join(","), "Standard,Clevis Hanger");
    // A SENTINEL IS NOT A CODE, which is what lets the form hold the choice in the
    // same array the clearing rule works on.
    check(
        "a sentinel narrows nothing",
        narrowParent(TREE, ["17", "1704", LEVEL_CHOICE.newLevel]).level4Names.length,
        0
    );
    for (const sentinel of Object.values(LEVEL_CHOICE)) {
        check(`  ${sentinel} cannot be mistaken for a code`, /^\d+$/.test(sentinel), false);
    }

    log("");
    log("the plan: one judgment, and the states it tells apart:");
    // FIRST, THAT IT ANSWERS AT ALL. A plan that always refused and a plan that
    // always allowed would each pass every assertion below that is about one
    // state.
    const answers = new Set(
        [
            planCategory(fields(), TREE),
            planCategory(fields({ level2Code: "9999" }), TREE),
            planCategory(fields({ itemName: "" }), TREE),
            planCategory(fields({ level4Name: "Strut Channel" }), TREE),
        ].map(({ plan, refusal }) => refusal ?? `plan:${plan.codes.join("/")}`)
    );
    check("  the four inputs do not collapse into one answer", answers.size, 4);

    const planned = planCategory(fields(), TREE);
    check("a complete submission plans", planned.refusal, null);
    check("  the leaf takes the floor under its level 3", planned.plan.codes[3], "1704002901");
    check("  the level 3 is the one that was picked", planned.plan.codes[2], "1704002");
    check("  and is not treated as new", planned.plan.level3IsNew, false);
    check("  the names follow the codes", planned.plan.names.join(" | "), "Plumbing | Pipe Support Materials | Strut Framing System | Bracket");
    check(
        "  the label is the path the base will compute",
        planned.plan.label,
        categoryLabelFor(planned.plan.names)
    );
    check("  and the typed name is stored as typed", planned.plan.itemName, "Strut Framing System, Bracket");

    log("");
    log("  resolve-or-mint at level 3, which is what keeps sibling names distinct:");
    const reused = planCategory(
        fields({ level3Choice: LEVEL_CHOICE.newLevel, level3Name: "pipe hanger", level4Name: "Split Ring" }),
        TREE
    );
    check("a typed name that is already a sibling joins it", reused.plan.codes[2], "1704001");
    check("  and keeps the sibling's own spelling", reused.plan.names[2], "Pipe Hanger");
    check("  so the leaf is numbered inside it", reused.plan.codes[3], "1704001901");
    const minted = planCategory(
        fields({ level3Choice: LEVEL_CHOICE.newLevel, level3Name: "Pipe Clamp", level4Name: "U-Bolt" }),
        TREE
    );
    check("a name nobody has mints a level 3", minted.plan.codes[2], "1704901");
    check("  marked as new", minted.plan.level3IsNew, true);
    check("  and its first leaf takes the floor", minted.plan.codes[3], "1704901901");

    log("");
    log("  a mark reuses a placeholder sibling and never adds a second:");
    const markedOnOther = planCategory(
        fields({ level3Choice: LEVEL_CHOICE.noDivision, level4Name: "Anything" }),
        [
            ...TREE,
            row({
                codes: ["17", "1704", "1704003", "1704003001"],
                names: ["Plumbing", "Pipe Support Materials", "Other", "Pipe Saddle"],
            }),
        ]
    );
    check("an existing Other is reused", markedOnOther.plan.codes[2], "1704003");
    check("  and nothing writes Standard beside it", markedOnOther.plan.names[2], "Other");
    const markedFresh = planCategory(
        fields({ level3Choice: LEVEL_CHOICE.noDivision, level4Name: "Anything" }),
        TREE
    );
    check("a parent with no placeholder gets one", markedFresh.plan.names[2], NO_DIVISION_NAME);
    check("  minted in the block", markedFresh.plan.codes[2], "1704901");

    log("");
    log("  a level-4 name that exists is a refusal where a level-3 one is a choice:");
    const exists = planCategory(fields({ level3Choice: "1704002", level4Name: "strut channel" }), TREE);
    check("an existing leaf name refuses", exists.plan, null);
    assert("  naming the category that holds the path", exists.refusal.includes("Strut Framing System"));
    const markedExists = planCategory(
        fields({ level3Choice: "1704001", level4NoDivision: true, level4Name: "" }),
        TREE
    );
    check("a mark meeting an existing placeholder leaf refuses", markedExists.plan, null);
    const markedFree = planCategory(
        fields({ level3Choice: "1704002", level4NoDivision: true, level4Name: "" }),
        TREE
    );
    check("  and the same mark under a parent without one plans", markedFree.refusal, null);
    check("    storing the word", markedFree.plan.names[3], NO_DIVISION_NAME);

    log("");
    log("  the refusals a forged submission meets:");
    check(
        "an unknown level 2",
        planCategory(fields({ level2Code: "9999" }), TREE).refusal,
        COPY.parentUnknown
    );
    check(
        "a level 1 that is not this level 2's parent",
        planCategory(fields({ level1Code: "01" }), TREE).refusal,
        COPY.parentUnknown
    );
    check(
        "a level 3 code the parent does not have",
        planCategory(fields({ level3Choice: "9999999" }), TREE).refusal,
        COPY.parentUnknown
    );
    for (const missing of [
        { level1Code: "" },
        { level2Code: "" },
        { level3Choice: "" },
        { level3Choice: LEVEL_CHOICE.newLevel, level3Name: "" },
        { level4Name: "" },
        { itemName: "" },
    ]) {
        check(
            `  missing ${Object.keys(missing).join("+")}`,
            planCategory(fields(missing), TREE).refusal,
            COPY.fieldsMissing
        );
    }
    check(
        "a marked level 4 needs no name",
        planCategory(fields({ level4NoDivision: true, level4Name: "" }), TREE).refusal,
        null
    );

    log("");
    log("the record one plan writes:");
    const record = categoryRecordFields(planned.plan);
    check("nine fields, and no more", Object.keys(record).length, 9);
    check("the composed label is not one of them", Object.keys(record).includes("Category Label"), false);
    for (const [i, level] of CATEGORY_LEVELS.entries()) {
        check(`  ${level.code} carries the ${i === 3 ? "minted" : "chosen"} code`, record[level.code], planned.plan.codes[i]);
        check(`  ${level.name} carries its own level's name`, record[level.name], planned.plan.names[i]);
    }
    check("  and the item name is the typed one", record["Item Name"], planned.plan.itemName);

    log("");
    log("one judgment, run by the form and by the action:");
    const form = parseFile(FORM);
    const action = parseFile(ACTION);
    check(`${FORM} plans`, callCount(form.ast, "planCategory") > 0, true);
    check(`${ACTION} plans`, callCount(action.ast, "planCategory") > 0, true);
    check(`${FORM} clears through the shared rule`, callCount(form.ast, "pickCategoryLevel") > 0, true);
    check(`${FORM} narrows through ${"narrowParent"}`, callCount(form.ast, "narrowParent") > 0, true);
    // #367's PROPERTY, KEPT BY CONSTRUCTION: `offline/category-picker.mjs` holds by
    // exact equality that one file under `app/` calls `narrowCategories`, and it is
    // the shared item picker. This screen picks a parent, so its walk is in `lib/`.
    check(`${FORM} does not call narrowCategories`, callCount(form.ast, "narrowCategories"), 0);

    // THE SUBMIT IS GATED ON AN INCOMPLETE FORM AND ON NOTHING ELSE, which is a
    // browser finding rather than a design intention — it was gated on the plan, so
    // every refusal the LOADED tree could see also blocked the submit, and the tree
    // is a per-render snapshot: a row deleted out of band left the screen refusing a
    // path that no longer existed with no way to reach the base's answer. Held here
    // because the tier cannot see a button: the mutant is putting `plan` back, and
    // the assertion is over the `disabled` expression's own text.
    const disabledExpr = jsxAttributeSource(form, "disabled");
    check(
        `  ${FORM} gates its submit on the missing-fields verdict${disabledExpr ? ` (${disabledExpr})` : ""}`,
        disabledExpr.includes("fieldsMissing"),
        true
    );
    check("  and not on the plan's existence", /!\s*plan\b/.test(disabledExpr), false);

    log("");
    log("every word the screen says comes from the copy constant:");
    for (const file of [PAGE, FORM]) {
        const prose = sentences(parseFile(file).ast);
        check(
            `  sentences written into ${file}${prose.length ? ` (${prose.join(" | ")})` : ""}`,
            prose.length,
            0
        );
    }
    // The anti-vacuity for the scan: it has to be seen to find strings at all.
    assert("  the scan reads string literals", literals(parseFile(FORM).ast).length > 10);

    log("");
    log("the sentences the screen carries:");
    check("the heading names the row's own table", COPY.heading, "New Category");
    check(
        "the two preview lines are two sentences",
        COPY.previewName("X") === COPY.previewPath("X"),
        false
    );
    assert("  the first names what a document will print", COPY.previewName("X").includes("X"));
    assert("  the second names where the row sits", COPY.previewPath("A > B").includes("A > B"));
    assert(
        "the account of what was written names the code",
        COPY.created({ itemName: "N", code: "1704001901", label: "A > B" }).includes("1704001901")
    );
    assert(
        "a taken name names the category holding it",
        COPY.nameTaken({ itemName: "N", label: "A > B" }).includes("A > B")
    );
    assert("a taken code names the code", COPY.codeTaken("1704001901").includes("1704001901"));
    assert(
        "a full block names both ends of the range",
        COPY.codesExhausted("1704001").includes(String(BRANCH_CODE_FLOOR)) &&
            COPY.codesExhausted("1704001").includes(String(BRANCH_CODE_CEILING))
    );
    check(
        "the level labels are the picker's own",
        COPY.levels.join(","),
        "Level 1,Level 2,Level 3,Level 4"
    );
    // THE VALUE `offline/action-refusal-shape.mjs` RECORDS BY PATH. That check reads
    // the action's thunk and finds `CATEGORY_CREATION_COPY.notAuthorized`; resolving
    // it would mean importing this module there, so the sentence is pinned here,
    // where the constant lives. It is the first returned refusal in the app held in
    // a copy constant rather than spelled into the action — which is what lets the
    // vocabulary sweeps see it at all.
    check("the authorization refusal the action returns", COPY.notAuthorized, "Not authorized.");
    check("  and the page's own, which names the gate", COPY.notAdmin, "Not authorized. This page is Admin-only.");
}

// ---------------------------------------------------------------------------

const ITEM_NAME_COLUMN = "Item Name";

/** The committed tree, parsed by `material-categories.mjs`' own parser. */
function committedRows() {
    const text = readFileSync(join(REPO_ROOT, CSV_PATH), "utf8");
    const parsed = parseCsv(text);
    const header = parsed[0];
    return parsed
        .slice(1)
        .filter((r) => r.some((c) => c !== ""))
        .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

/** The four level names of one parsed CSV row. */
function namesOf(csvRow) {
    return CATEGORY_LEVELS.map((level) => csvRow[level.name]);
}

/** The four names in the shape the label rule reads. */
function rowFromNames(names) {
    return Object.fromEntries(CATEGORY_LEVELS.map((level, i) => [level.name, names[i] ?? ""]));
}

/**
 * The source text of one JSX attribute's expression, or `""`.
 *
 * READ AS TEXT RATHER THAN WALKED, deliberately: the claim is about which rule a
 * condition consults, and a condition is a short expression whose spelling is the
 * thing. Walking it would mean reproducing operator precedence to say the same
 * sentence. The LAST one wins, which is the submit's on this form — its only other
 * `disabled` is on the level-4 input.
 */
function jsxAttributeSource({ ast, source }, name) {
    let text = "";
    walk(ast, (node) => {
        if (node.type !== "JSXAttribute") return;
        if (node.name?.name !== name) return;
        if (node.value?.type !== "JSXExpressionContainer") return;
        text = source.slice(node.value.expression.start, node.value.expression.end);
    });
    return text;
}

/** How many times a file calls a named function. */
function callCount(ast, name) {
    let n = 0;
    walk(ast, (node) => {
        if (node.type !== "CallExpression") return;
        if ((node.callee?.name ?? node.callee?.property?.name) === name) n += 1;
    });
    return n;
}

/** Every string literal in a file. */
function literals(ast) {
    const found = [];
    walk(ast, (node) => {
        if (node.type === "Literal" && typeof node.value === "string") found.push(node.value);
    });
    return found;
}

/**
 * The literals that read as prose — `offline/category-picker.mjs`' filter, which
 * keeps Tailwind class strings out by their hyphens and lets a hyphenated sentence
 * back in by its punctuation.
 */
function sentences(ast) {
    return literals(ast).filter((text) => /\s\w+\s/.test(text) && (!text.includes("-") || /[.?!]/.test(text)));
}

if (isMain(import.meta.url)) standalone(title, run);
