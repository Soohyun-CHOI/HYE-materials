// The sheet a tool label is printed on, by value (#353).
//
// WHAT THIS FILE IS FOR. A printed dimension is the one kind of claim this tier is
// unusually good at and unusually easy to fake: the arithmetic is pure, so it can
// be held exactly — and every figure is reachable from one constant, so an
// assertion written against that constant holds no matter what the constant says.
// #351 shipped that mistake and measured it: its quiet-zone assertions were all
// expressed in terms of `QR_QUIET_ZONE_MODULES`, so changing 4 to 2 moved the
// constant, the derived side, the SVG's own margin and the builder's report
// together, and all 47 assertions passed. **So the figures below are LITERALS.**
// Changing stock changes them in the same commit, which is the point rather than a
// cost: a dimension nobody re-typed is a dimension nobody checked.
//
// THE SECOND PATH IS MAXIMALITY, AND #412 IS WHERE IT BECAME THAT. #353 was checking
// a product's transcribed geometry — a margin, a pitch and a count — so adding them
// back up to 215.9 x 279.4 mm was what a typo in one of them failed. Nothing is
// transcribed now: the label comes from the symbol and the count is computed, so
// what is worth asserting is that the computation is right at its boundary. Every
// label keeps the far margin and ONE MORE of either would not, and the call itself
// is read off the AST — because a count pinned to the correct number passes every
// figure in this file, measured.
//
// AND #431 ADDED THREE FACTS NO FIGURE CAN SEE. Which side the module is read from,
// which way the two pieces stack and what face the code prints in are all source:
// the two sides leave the symbol the same room, a label drawn upside down adds up to
// the same sums, and a face is a name rather than a number. So they are read off
// the AST and the stylesheet, each beside a planted counterexample.
//
// AND THE MODULE SIZE IS DERIVED, NOT CHOSEN, so what is checked is the derivation
// and its floor. `MIN_MODULE_MM` is a citation rather than a measurement — nothing
// here printed anything — and holding the derived module above it is what turns
// "this stock is too small to carry a scannable symbol" from a thing somebody
// notices into a failing check.
//
// WHAT IT CANNOT SEE, and the list is longer here than usual because the subject is
// paper. It never renders, so it cannot see a label overlapping its neighbor, ink
// inside the quiet zone, a browser's print scaling, or whether `@media print`
// actually hid the picker. What it CAN do is add the parts up: if the pieces do not
// fit inside one label, no layout can stop them overlapping, and that is arithmetic.
// The rendering was checked once in a browser and the print preview read there;
// **no sheet was printed on paper and no ruler was put to one**, which is recorded
// in #353's pull request rather than implied here.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";

import { MAX_TOOL_ITEMS_PER_REGISTRATION } from "../../../lib/toolRegistration.js";
import {
    CELLS_PER_SHEET,
    LABEL_GAP_MM,
    LABEL_GRID,
    LABEL_SAFE_INSET_MM,
    LABEL_CODE_TYPEFACE,
    LABEL_STOCK,
    LABEL_STOCK_NAME,
    MAX_LABELS_PER_REQUEST,
    MIN_ID_FONT_PT,
    MIN_MODULE_MM,
    TOOL_LABEL_SHEET_COPY as COPY,
    VERSION_HEADROOM,
    cellPosition,
    labelBudget,
    labelSizeMm,
    moduleSizeMm,
    paginateLabels,
    readStartPosition,
    symbolBox,
} from "../../../lib/toolLabelSheet.js";
import {
    listJsFiles,
    parseFile,
    parseSource,
    repoPath,
    resolveFunction,
    toPosix,
    walk,
    REPO_ROOT,
} from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The sheet a tool label is printed on, by value (#353)";

/** The symbol's side in modules, quiet zone included — #351's figure today. */
const SIDE_MODULES_TODAY = 33;

/** The route's two files, which several sections below read off the AST. */
const SHEET_SOURCE = "app/(tools)/tool-items/labels/LabelSheet.js";
const PAGE_SOURCE = "app/(tools)/tool-items/labels/page.js";
const CSS_SOURCE = "app/(tools)/tool-items/labels/labels.css";
const MODULE_SOURCE = "lib/toolLabelSheet.js";

/** `LABEL_STOCK.labelWidthMm` for a member read, the bare name for an identifier. */
function readName(node) {
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression" && !node.computed)
        return `${readName(node.object)}.${node.property.name}`;
    return node.type;
}

/** The `LABEL_STOCK` members a function reads, in source order. */
function stockMembersRead(fn) {
    const found = [];
    walk(fn, (n) => {
        if (n.type === "MemberExpression" && n.object.type === "Identifier" && n.object.name === "LABEL_STOCK")
            found.push(n.property.name);
    });
    return found;
}

/** Every name a function reads, members spelled out. */
function namesRead(fn) {
    const found = new Set();
    walk(fn, (n) => {
        if (n.type === "MemberExpression" || n.type === "Identifier") found.add(readName(n));
    });
    return found;
}

/** A JSX element's `className` when it is a literal, else null. */
function literalClass(element) {
    const attr = element.openingElement?.attributes?.find(
        (a) => a.type === "JSXAttribute" && a.name?.name === "className"
    );
    return attr?.value?.type === "Literal" ? String(attr.value.value) : null;
}

/** The first element in a tree carrying this literal class. */
function elementWithClass(ast, className) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "JSXElement" && literalClass(n) === className) found = n;
    });
    return found;
}

/** The body of one rule in a stylesheet, comments stripped, or null. */
function cssRule(css, selector) {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return bare.match(new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? null;
}

/** One declaration's value inside a rule body, or null. */
function cssValue(body, property) {
    return body?.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+?)\\s*(?:;|$)`))?.[1] ?? null;
}

export function run({ check, assert, log }) {
    // ── 1: the stock, and the grid derived from it ───────────────────────────
    log("the stock, and how many of those labels a sheet holds:");
    check("the page size keyword", LABEL_STOCK.page, "letter");
    check("page width", LABEL_STOCK.pageWidthMm, 215.9);
    check("page height", LABEL_STOCK.pageHeightMm, 279.4);
    check("the margin a printer cannot reach into", LABEL_STOCK.marginMm, 10);
    check("label width", LABEL_STOCK.labelWidthMm, 16.8);
    check("label height", LABEL_STOCK.labelHeightMm, 20.42);
    check("the gap between columns", LABEL_STOCK.columnGapMm, 2);
    check("and between rows", LABEL_STOCK.rowGapMm, 2);
    check("labels a sheet holds", CELLS_PER_SHEET, 110);
    check("  ten across", LABEL_GRID.columns, 10);
    check("  and eleven down", LABEL_GRID.rows, 11);
    check("the column pitch", LABEL_GRID.columnPitchMm, 18.8);
    check("and the row pitch", LABEL_GRID.rowPitchMm, 22.42);

    // THE SECOND PATH IS MAXIMALITY NOW, AND IT IS A BETTER ONE THAN THE SUM IT
    // REPLACED. #353 added a product's margins and pitches back up and required the
    // page to come out, which caught a transcription error in figures somebody had
    // copied. Nothing is transcribed here — the count is computed — so the thing
    // worth asserting is that the computation is right at the boundary: every label
    // keeps the far margin, and ONE MORE of either would not.
    const farRight =
        LABEL_STOCK.pageWidthMm -
        (LABEL_STOCK.marginMm + (LABEL_GRID.columns - 1) * LABEL_GRID.columnPitchMm + LABEL_STOCK.labelWidthMm);
    const farBottom =
        LABEL_STOCK.pageHeightMm -
        (LABEL_STOCK.marginMm + (LABEL_GRID.rows - 1) * LABEL_GRID.rowPitchMm + LABEL_STOCK.labelHeightMm);
    check("what is left to the right of the last column", round4(farRight), 19.9);
    check("and below the last row", round4(farBottom), 24.78);
    assert("  both clear the margin", farRight >= LABEL_STOCK.marginMm && farBottom >= LABEL_STOCK.marginMm);
    // ANTI-VACUITY, AND THE HALF THAT MATTERS: a count that is merely on the page is
    // satisfied by any number below the maximum, so the check has to see the next
    // one fail. One more column would leave 1.1 mm and one more row 2.36, both under
    // the margin — the figures are pinned so a changed margin moves this assertion
    // rather than silently keeping it true.
    const oneMoreRight =
        LABEL_STOCK.pageWidthMm -
        (LABEL_STOCK.marginMm + LABEL_GRID.columns * LABEL_GRID.columnPitchMm + LABEL_STOCK.labelWidthMm);
    const oneMoreBottom =
        LABEL_STOCK.pageHeightMm -
        (LABEL_STOCK.marginMm + LABEL_GRID.rows * LABEL_GRID.rowPitchMm + LABEL_STOCK.labelHeightMm);
    check("an eleventh column would leave only", round4(oneMoreRight), 1.1);
    check("and a twelfth row only", round4(oneMoreBottom), 2.36);
    assert(
        "  so neither fits and the grid is maximal",
        oneMoreRight < LABEL_STOCK.marginMm && oneMoreBottom < LABEL_STOCK.marginMm
    );

    // ── 1a: the grid is computed and not typed (#412) ────────────────────────
    log("");
    log("the count is derived from the stock rather than written beside it:");
    // READ OFF THE AST, BECAUSE A PINNED COUNT THAT HAPPENS TO BE RIGHT PASSES EVERY
    // VALUE ABOVE. Measured: replacing the derivation with a literal `6` leaves all
    // 5384 checks green, and `3` fails eight — so the figures catch a WRONG count
    // and nothing catches a count that has stopped tracking the stock. That is the
    // whole property this issue restructured `LABEL_STOCK` for: when a real die-cut
    // is bought, the dimensions change and the count has to follow. So the call and
    // its arguments are what is asserted, not the answer.
    const gridCalls = {};
    walk(parseFile("lib/toolLabelSheet.js").ast, (n) => {
        if (n.type !== "Property" || !["columns", "rows"].includes(n.key?.name)) return;
        const v = n.value;
        gridCalls[n.key.name] =
            v.type === "CallExpression" && v.callee.type === "Identifier"
                ? `${v.callee.name}(${v.arguments
                      .map((a) =>
                          a.type === "MemberExpression" ? `${a.object.name}.${a.property.name}` : a.type
                      )
                      .join(", ")})`
                : v.type;
    });
    check(
        "the columns are counted from the page's width",
        gridCalls.columns,
        "fitCount(BinaryExpression, LABEL_STOCK.labelWidthMm, LABEL_STOCK.columnGapMm)"
    );
    check(
        "and the rows from its height",
        gridCalls.rows,
        "fitCount(BinaryExpression, LABEL_STOCK.labelHeightMm, LABEL_STOCK.rowGapMm)"
    );
    // ANTI-VACUITY: the reader is shown a pinned property beside a derived one, so
    // the two above are facts about the module rather than about a walker that
    // reports a call for anything.
    const plantedGrid = {};
    walk(parseSource("const g = { columns: 6, rows: fitCount(a - b, c, d) };\n", "<planted-grid>").ast, (n) => {
        if (n.type !== "Property" || !["columns", "rows"].includes(n.key?.name)) return;
        plantedGrid[n.key.name] = n.value.type === "CallExpression" ? "derived" : n.value.type;
    });
    check("  a pinned count reads as a literal", plantedGrid.columns, "Literal");
    check("  and a computed one does not", plantedGrid.rows, "derived");

    // ── 1b: the label is the smallest the two floors allow (#412) ────────────
    log("");
    log("the label size, solved from the floors rather than taken from a product:");
    // TWO PATHS TO ONE PAIR OF NUMBERS. `LABEL_STOCK` states the label and
    // `labelSizeMm` derives what the floors require; the stock has to satisfy the
    // derivation, and on this stock it EQUALS it, because the label was chosen to be
    // the smallest that does. A stock typed a hundredth small fails here.
    const required = labelSizeMm({ sideModules: SIDE_MODULES_TODAY });
    check("the widest symbol the headroom admits", required.widestSymbolMm, 14.8);
    check("the label width that needs, the symbol's alone", required.widthMm, 16.8);
    check("and the height, once one em of code sits under it", required.heightMm, 20.42);
    check("the stock's own width", LABEL_STOCK.labelWidthMm, required.widthMm);
    check("and its own height", LABEL_STOCK.labelHeightMm, required.heightMm);
    // ANTI-VACUITY: the derivation is shown MOVING with its inputs, so the equality
    // above is a fact about this label rather than about a function that returns
    // whatever the stock says.
    const roomier = labelSizeMm({ sideModules: SIDE_MODULES_TODAY, versionsOfHeadroom: 2 });
    check("a second version of headroom would need a label this wide", roomier.widthMm, 18.4);
    check("  and this tall", roomier.heightMm, 22.02);
    assert("  which this stock does not carry", roomier.widthMm > LABEL_STOCK.labelWidthMm);

    // WHAT IT REPLACED, STATED SO THE SIZE IS READABLE AS A CHANGE. #353's label was
    // a product's; #412's was the symbol's with the code beside it; this one is the
    // symbol's with the code under it (#431). The narrow side did not move — the
    // symbol sets it either way — and the long side is what stacking bought.
    assert("the label is narrower than the product it replaces", LABEL_STOCK.labelWidthMm < 66.675);
    assert("  and shorter", LABEL_STOCK.labelHeightMm < 25.4);
    check("the narrow side is the one side by side had", Math.min(LABEL_STOCK.labelWidthMm, LABEL_STOCK.labelHeightMm), 16.8);
    assert("  and the long side is shorter than side by side's 30.3 mm", Math.max(LABEL_STOCK.labelWidthMm, LABEL_STOCK.labelHeightMm) < 30.3);
    assert("  so a sheet holds more than side by side's 78", CELLS_PER_SHEET > 78);

    // ── 1c: the module is read off the width (#431) ─────────────────────────
    log("");
    log("the side the module size is read from:");
    // READ OFF THE AST, BECAUSE NO FIGURE CAN TELL THE TWO SIDES APART. Stacked, the
    // width leaves the widest symbol 14.8 mm and the height, after the gap and the
    // code, 14.8033 — and both floor to the same 0.4 mm module. So a `moduleSizeMm`
    // reading the height's room passes every value in this file, and the only thing
    // that can see which side it reads is its source.
    const moduleReads = stockMembersRead(resolveFunction(parseFile(MODULE_SOURCE).ast, "moduleSizeMm"));
    check("moduleSizeMm reads the label's width and no other side", moduleReads.join(", "), "labelWidthMm");
    // ANTI-VACUITY: the reader is shown a function that reads the other side, so the
    // answer above is a fact about the module rather than a reader that always says
    // width.
    const plantedModule = stockMembersRead(
        resolveFunction(
            parseSource(
                "function moduleSizeMm() { return (LABEL_STOCK.labelHeightMm - 2 - LABEL_GAP_MM) / 37; }\n",
                "<planted-module>"
            ).ast,
            "moduleSizeMm"
        )
    );
    check("  a function reading the height reads as the height", plantedModule.join(", "), "labelHeightMm");

    // ── 2: the module size, derived and floored ─────────────────────────────
    log("");
    log("millimeters per module, derived from the label's width:");
    const moduleMm = moduleSizeMm({ sideModules: SIDE_MODULES_TODAY });
    check(`${SIDE_MODULES_TODAY} modules today, ${VERSION_HEADROOM} version of headroom`, VERSION_HEADROOM, 1);
    check("the derived module", moduleMm, 0.4);
    assert(`  which clears the ${MIN_MODULE_MM} mm floor`, moduleMm >= MIN_MODULE_MM);
    check("the floor is a citation and this is its value", MIN_MODULE_MM, 0.4);
    // AND IT LANDS ON THE FLOOR EXACTLY (#412), which is the whole of that issue in
    // one line: #353 derived 0.57 from a product's label, and this label was solved
    // backwards from the floor so the derivation has nowhere above it to land.
    check("  and the derivation has no room above it", round4(moduleMm - MIN_MODULE_MM), 0);

    const budget = labelBudget({ sideModules: SIDE_MODULES_TODAY });
    check("today's symbol box", budget.symbolMm, 13.2);
    check("the widest it absorbs", budget.widestSymbolMm, 14.8);
    check("what a label may print inside, wide", budget.usableWidthMm, 14.8);
    check("and tall", budget.usableHeightMm, 18.42);

    // THE FIT, WHICH IS THE ONE CLAIM NO LAYOUT CAN OVERRIDE. If the widest symbol
    // and the code's floor do not fit inside one label, the two must overlap however
    // they are drawn — and ink inside the quiet zone is what #351 asked this issue
    // not to produce. Stacked (#431), the symbol takes the width and the code the
    // height under it, and the code also has to clear the width.
    assert("the widest symbol fits the label's width", budget.widestSymbolMm <= budget.usableWidthMm);
    check("what is left under it and the gap for the code", budget.textHeightMm, 2.12);
    check("what the code needs at its floor, tall — six points", round4(budget.minIdHeightMm), 2.1167);
    assert("  so it fits under the widest symbol", budget.minIdHeightMm <= budget.textHeightMm);
    check("and across, ten characters at the floor", round4(budget.minIdWidthMm), 10.5833);
    assert("  which the width under the symbol clears", budget.minIdWidthMm <= budget.usableWidthMm);
    // THE SYMBOL HAS NOTHING LEFT OVER ACROSS, AND THE CODE HAS NEXT TO NOTHING DOWN.
    // The label is solved from the floors, so the width is exactly the widest symbol,
    // and the height is short of the parts by nothing but its rounding up to a
    // hundredth — six points is 2.1167 mm, the label 20.42 where the parts come to
    // 20.4167. Pinned by value because they are the sharpest thing this tier can
    // hold: any constant moved a hundredth puts one on the wrong side of its
    // comparison. The one real room is beside the code, under the symbol.
    check("the width left over beside the widest symbol", round4(budget.usableWidthMm - budget.widestSymbolMm), 0);
    check("the height left over under the code", round4(budget.textHeightMm - budget.minIdHeightMm), 0.0033);
    check("the width left beside the code, under the symbol", round4(budget.usableWidthMm - budget.minIdWidthMm), 4.2167);
    check("the code's floor, in points", MIN_ID_FONT_PT, 6);
    check("the gap between symbol and code", LABEL_GAP_MM, 1.5);
    check("the safe inset from the die-cut", LABEL_SAFE_INSET_MM, 1);

    // ANTI-VACUITY: the derivation is shown REFUSING. A stock too short drives the
    // module under the floor, so the guard above is a fact about this stock rather
    // than about arithmetic that always passes.
    const tinyModule = Math.floor(((10 - 2) / 37) * 100) / 100;
    assert(`  a 10 mm label would derive ${tinyModule} mm and fail the floor`, tinyModule < MIN_MODULE_MM);
    // And a version step really does cost four modules a side, so the headroom is
    // spending something rather than nothing.
    assert(
        "  a version of headroom really costs module width",
        moduleSizeMm({ sideModules: SIDE_MODULES_TODAY, versionsOfHeadroom: 0 }) > moduleMm
    );

    // ── 2b: a longer address prints a BIGGER symbol, not a denser one ───────
    log("");
    log("each symbol's box comes from its own side count:");
    // THE DEFECT THIS SECTION EXISTS FOR WAS MEASURED IN A BROWSER, NOT REASONED
    // ABOUT. Every box was sized from `QR_SIDE_MODULES`, so a version-3 symbol —
    // which is what a longer host produces, and what localhost produces today —
    // was scaled INTO today's box: 37 modules in 18.81 mm is 0.508 mm a module
    // against the 0.57 the stock was derived for. The module size is fixed for the
    // stock; the box is per symbol.
    for (const [side, expected] of [
        [33, 13.2],
        [37, 14.8],
        [41, 16.4],
    ])
        check(`  ${side} modules is ${expected} mm`, symbolBox({ sideModules: side, moduleMm }).boxMm, expected);
    // The relation, so the literals above cannot all be wrong in the same direction.
    assert(
        "  a version step makes the box bigger rather than the modules thinner",
        symbolBox({ sideModules: 37, moduleMm }).boxMm > symbolBox({ sideModules: 33, moduleMm }).boxMm
    );
    check(
        "  and the module width is the same at every version",
        round4(symbolBox({ sideModules: 41, moduleMm }).boxMm / 41),
        round4(symbolBox({ sideModules: 33, moduleMm }).boxMm / 33)
    );
    // THE HEADROOM'S EDGE, BOTH SIDES OF IT, AND #412 MOVED IT BY ONE STEP. A label
    // crops what overflows and a cropped symbol is unscannable with nothing to see,
    // so the screen says so instead. The boundary sits between 37 and 41 now where
    // #353 put it between 41 and 45 — which is `VERSION_HEADROOM` going from two to
    // one, made visible as a verdict rather than only as a constant.
    assert("  today's fits", symbolBox({ sideModules: 33, moduleMm }).fits);
    assert("  one version up still fits", symbolBox({ sideModules: 37, moduleMm }).fits);
    assert("  two does not, and is reported rather than cropped", !symbolBox({ sideModules: 41, moduleMm }).fits);
    assert("  nor does three", !symbolBox({ sideModules: 45, moduleMm }).fits);
    // AND IT FAILS ON BOTH DIMENSIONS AT ONCE, which is what a label with no slack
    // means: the symbol is square and its room is 14.8 mm across and 14.8033 down,
    // so no verdict is decided by one dimension rather than the other.
    assert(
        "  the first one that fails overruns the width",
        symbolBox({ sideModules: 41, moduleMm }).boxMm > budget.usableWidthMm
    );
    check(
        "  and down, what the gap and the code leave it",
        round4(budget.usableHeightMm - LABEL_GAP_MM - budget.minIdHeightMm),
        14.8033
    );
    // WHICH IS WHY THE CLAUSES ARE READ OFF THE SOURCE (#431). With the two rooms
    // this close, `symbolBox` could drop either comparison and return every verdict
    // above unchanged — so what is asserted is that it reads both sides, and the
    // gap and the code's size on the way down.
    const boxReads = namesRead(resolveFunction(parseFile(MODULE_SOURCE).ast, "symbolBox"));
    const BOX_NEEDS = ["LABEL_STOCK.labelWidthMm", "LABEL_STOCK.labelHeightMm", "LABEL_GAP_MM", "ID_FONT_MM"];
    const boxMissing = BOX_NEEDS.filter((name) => !boxReads.has(name));
    check(
        `  symbolBox reads both sides, the gap and the code's size${boxMissing.length ? ` (missing ${boxMissing.join(", ")})` : ""}`,
        boxMissing.length,
        0
    );
    // ANTI-VACUITY: a planted symbolBox with the height clause gone is seen missing
    // exactly what that clause read.
    const plantedBoxReads = namesRead(
        resolveFunction(
            parseSource(
                "function symbolBox({ boxMm }) { return boxMm <= LABEL_STOCK.labelWidthMm - 2; }\n",
                "<planted-box>"
            ).ast,
            "symbolBox"
        )
    );
    check(
        "  a symbolBox with one clause is seen missing the other",
        BOX_NEEDS.filter((name) => !plantedBoxReads.has(name)).join(", "),
        "LABEL_STOCK.labelHeightMm, LABEL_GAP_MM, ID_FONT_MM"
    );

    // ── 3: where each label position sits ───────────────────────────────────
    log("");
    log("the corners the die-cut put the labels at:");
    check("the first", JSON.stringify(cellPosition(0)), JSON.stringify({ leftMm: 10, topMm: 10 }));
    check("second across", JSON.stringify(cellPosition(1)), JSON.stringify({ leftMm: 28.8, topMm: 10 }));
    check("last across", JSON.stringify(cellPosition(9)), JSON.stringify({ leftMm: 179.2, topMm: 10 }));
    check("first of the second row", JSON.stringify(cellPosition(10)), JSON.stringify({ leftMm: 10, topMm: 32.42 }));
    check("the last one on the sheet", JSON.stringify(cellPosition(109)), JSON.stringify({ leftMm: 179.2, topMm: 234.2 }));
    // The last label's far corner has to be on the paper.
    const last = cellPosition(CELLS_PER_SHEET - 1);
    assert("and its far corner is on the page", last.leftMm + LABEL_STOCK.labelWidthMm <= LABEL_STOCK.pageWidthMm);
    assert("  vertically too", last.topMm + LABEL_STOCK.labelHeightMm <= LABEL_STOCK.pageHeightMm);

    // ── 4: the start position, and what a part-used sheet does ──────────────
    log("");
    log("starting partway down a sheet whose first labels are gone:");
    check("a typed position", readStartPosition("7"), 7);
    check("nothing is position 1", readStartPosition(""), 1);
    check("  as is a word", readStartPosition("abc"), 1);
    check("  and zero", readStartPosition("0"), 1);
    // `999` rather than a number just past the sheet: this read `99` until #431 took
    // the sheet to 110 positions and made it an ordinary one.
    check("past the end clamps to the last", readStartPosition("999"), CELLS_PER_SHEET);
    check("a negative clamps to the first", readStartPosition("-4"), 1);

    const six = Array.from({ length: 6 }, (_, at) => ({ toolItemId: `T${at}` }));
    const fromTop = paginateLabels(six, 1);
    check("six labels from the top is one sheet", fromTop.length, 1);
    check("  and its first cell is a label", fromTop[0][0] === null ? "blank" : "label", "label");
    const fromSeven = paginateLabels(six, 7);
    check("six from position 7 is still one sheet", fromSeven.length, 1);
    check("  with six blanks held open first", fromSeven[0].filter((cell) => cell === null).length, 6);
    check("  and the seventh cell carrying the first label", fromSeven[0][6].toolItemId, "T0");
    // A run that no longer fits spills, and the blanks do not repeat on sheet two.
    // The run is sized against the sheet rather than typed, because a smaller label
    // moved the sheet from 30 cells to 78 and a literal here would have been the
    // figure that stopped spilling (#412).
    const spillCount = CELLS_PER_SHEET - 2;
    const spilling = paginateLabels(
        Array.from({ length: spillCount }, (_, at) => ({ toolItemId: `S${at}` })),
        7
    );
    check(`${spillCount} from position 7 needs two sheets`, spilling.length, 2);
    check(`  the first holds ${CELLS_PER_SHEET} cells`, spilling[0].length, CELLS_PER_SHEET);
    check("  the second holds the remaining 4", spilling[1].length, 4);
    check("  and none of them is blank", spilling[1].filter((cell) => cell === null).length, 0);
    check("nothing selected is no sheet at all", paginateLabels([], 1).length, 0);

    // ── 5: the cap is the registration's, not a number of its own ───────────
    log("");
    log("the cap comes from the largest registration:");
    check("what one request prints", MAX_LABELS_PER_REQUEST, 100);
    check("  which is the registration cap itself", MAX_LABELS_PER_REQUEST, MAX_TOOL_ITEMS_PER_REGISTRATION);
    // ANTI-VACUITY for that equality: the figure is also pinned by value, so the two
    // moving together is a fact rather than the assertion comparing a name to itself.
    check("and that cap is this number", MAX_TOOL_ITEMS_PER_REGISTRATION, 100);
    // A SHEET HOLDS MORE THAN ONE REQUEST PRINTS SINCE #431, which turned what this
    // asserted round: it said a run always spans sheets. The largest request now fits
    // one sheet from the top and spills onto a second only from a start position
    // past eleven, so both sides of that edge are pinned — the second sheet is still
    // a state the screen reaches, and this is where it is reached from.
    check("a sheet holds this many more than the largest request", CELLS_PER_SHEET - MAX_LABELS_PER_REQUEST, 10);
    const largest = Array.from({ length: MAX_LABELS_PER_REQUEST }, (_, at) => ({ toolItemId: `L${at}` }));
    check("  the largest request from position 11 is one sheet", paginateLabels(largest, 11).length, 1);
    check("  and from position 12 is two", paginateLabels(largest, 12).length, 2);

    // ── 6: `@page` is spelled in a file nothing else in this tier reads ─────
    log("");
    log("`labels.css` carries the one figure a custom property cannot:");
    const css = readFileSync(repoPath(CSS_SOURCE), "utf8");
    assert(`the page box names \`${LABEL_STOCK.page}\``, new RegExp(`size:\\s*${LABEL_STOCK.page}\\s*;`).test(css));
    assert("  and takes no margin, so the stock's own margins mean something", /@page[^}]*margin:\s*0\s*;/s.test(css));
    assert("everything not a label is hidden at print", /@media print[\s\S]*\.label-screen-only\s*\{[^}]*display:\s*none/.test(css));
    assert("and a second sheet starts a second page", /\.label-sheet \+ \.label-sheet[\s\S]*break-before:\s*page/.test(css));
    // NO PHYSICAL DIMENSION MAY BE WRITTEN HERE. Every millimeter is an inline style
    // computed from LABEL_STOCK, and the code's points one computed from its floor
    // (#431); one in the stylesheet is the figure that would not move when they do.
    const physical = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/\d+(?:\.\d+)?(?:mm|pt)\b/g) || [];
    check(`no millimeter or point figure in the stylesheet${physical.length ? ` (${physical.join(", ")})` : ""}`, physical.length, 0);

    // ── 6b: nothing but a sheet reaches the paper ───────────────────────────
    log("");
    log("every heading, sentence and link is inside the screen-only wrapper:");
    // THE BUG THIS CATCHES SHIPPED AND WAS REPORTED FROM A REAL PRINT. The print
    // rule hid `.label-controls`, which is the sheet component's picker — and the
    // `<h1>` is rendered by the PAGE, so it printed. A sheet is exactly one page
    // tall against a page box with no margin, so 24px of heading took page one and
    // pushed every sheet down by a page. Nothing in this tier renders and the
    // browser pane cannot reach a print preview, so the only defense is structural:
    // on the route's two files, no text-bearing element may sit outside the class
    // the stylesheet hides.
    const SCREEN_ONLY = "label-screen-only";
    const TEXT_TAGS = new Set(["h1", "h2", "p", "ul", "ol", "li", "button", "label", "Link", "input"]);

    /** Every text-bearing element in a file, with whether a screen-only ancestor covers it. */
    function textElements(rel) {
        const out = [];
        const visit = (node, covered) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) {
                for (const child of node) visit(child, covered);
                return;
            }
            let nowCovered = covered;
            if (node.type === "JSXElement") {
                const name = node.openingElement?.name?.name;
                const className = node.openingElement?.attributes?.find(
                    (attr) => attr.type === "JSXAttribute" && attr.name?.name === "className"
                );
                const classText =
                    className?.value?.type === "Literal" ? String(className.value.value) : "";
                if (classText.split(/\s+/).includes(SCREEN_ONLY)) nowCovered = true;
                if (TEXT_TAGS.has(name)) out.push({ name, covered: nowCovered });
            }
            for (const [key, value] of Object.entries(node)) {
                if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
                visit(value, nowCovered);
            }
        };
        visit(parseFile(rel).ast, false);
        return out;
    }

    for (const rel of [PAGE_SOURCE, SHEET_SOURCE]) {
        const elements = textElements(rel);
        const bare = elements.filter((element) => !element.covered).map((element) => element.name);
        assert(`  ${rel.split("/").pop()} has text-bearing elements at all`, elements.length > 3);
        check(
            `  none of its ${elements.length} sits outside \`${SCREEN_ONLY}\`${bare.length ? ` (${[...new Set(bare)].join(", ")})` : ""}`,
            bare.length,
            0
        );
    }
    // ANTI-VACUITY: the walker is shown finding an UNCOVERED one, so the zeros above
    // are a fact about those files rather than about a visitor that marks everything
    // covered or never descends.
    const planted = [];
    {
        const visit = (node, covered) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((c) => visit(c, covered));
            let nowCovered = covered;
            if (node.type === "JSXElement") {
                const name = node.openingElement?.name?.name;
                const cls = node.openingElement?.attributes?.find(
                    (a) => a.type === "JSXAttribute" && a.name?.name === "className"
                );
                const text = cls?.value?.type === "Literal" ? String(cls.value.value) : "";
                if (text.split(/\s+/).includes(SCREEN_ONLY)) nowCovered = true;
                if (TEXT_TAGS.has(name)) planted.push({ name, covered: nowCovered });
            }
            for (const [k, v] of Object.entries(node)) {
                if (k === "type" || k === "start" || k === "end" || k === "loc") continue;
                visit(v, nowCovered);
            }
        };
        visit(
            parseSource(
                'const a = <main><h1>x</h1><div className="label-screen-only"><p>y</p></div></main>;\n',
                "<planted-bare-heading>"
            ).ast,
            false
        );
    }
    check("  a bare heading beside a wrapped one is seen as bare", planted.filter((e) => !e.covered).length, 1);
    check("  and the wrapped one is not", planted.filter((e) => e.covered).length, 1);

    // ── 7: the symbol is sized by its SIDE and never by its symbol proper ───
    log("");
    log("the quiet zone survives the layout:");
    // #351's contract is that the SVG's box is `QR_SIDE_MODULES` across. The mutant
    // is passing `QR_SYMBOL_MODULES` instead, which crops the four modules of margin
    // and renders a symbol a camera has to separate from the ink beside it. Read off
    // the AST rather than the text, so a comment naming the wrong constant is not a
    // violation.


    const identifiers = (rel) => {
        const names = [];
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "Identifier") names.push(n.name);
        });
        return names;
    };
    const pageNames = identifiers(PAGE_SOURCE);
    assert("the page reads QR_SIDE_MODULES", pageNames.includes("QR_SIDE_MODULES"));
    check(
        "  and names QR_SYMBOL_MODULES nowhere",
        pageNames.filter((name) => name === "QR_SYMBOL_MODULES").length,
        0
    );
    const sheetNames = identifiers(SHEET_SOURCE);
    check(
        "the sheet component names neither, taking the count as a prop",
        sheetNames.filter((name) => name === "QR_SIDE_MODULES" || name === "QR_SYMBOL_MODULES").length,
        0
    );
    // ANTI-VACUITY: the walker is seen finding something in those files, so the two
    // zeros above are facts about the source rather than about a failed parse.
    assert("  the walker really reads those files", sheetNames.includes("labelBudget") && pageNames.includes("buildToolItemQR"));

    // ── 7b: what the sticker actually prints (#411, #431) ───────────────────
    log("");
    log("the label prints the code and the symbol, and nothing else:");
    // READ OFF THE AST BECAUSE NO VALUE CHECK CAN TELL THE FIELDS APART. They are on
    // the same object and all strings, so `label.toolItemId` in place of
    // `label.labelCode` renders a longer sticker and passes every figure in this
    // file — including the width budget above, which is computed from a constant
    // rather than from what the component reads. The mutation was run in #411: with
    // the member expression swapped, this file passed before this section existed.
    //
    // AND SINCE #431 THE WHOLE CELL IS ASSERTED, NOT ONE ELEMENT OF IT. The tool's
    // name printed under the code until the design dropped it, and it would come back
    // as one more expression in the cell passing every sum here, because the height
    // budget counts the code alone.
    //
    // THE PICKER ABOVE THE SHEET IS THE OTHER HALF, AND IT KEEPS THE ID AND THE NAME.
    // That list is a SCREEN, and a screen names a tool item by the value the base
    // holds and by its tool; only the paper carries the short form, alone.
    const sheetAst = parseFile(SHEET_SOURCE).ast;
    const cell = elementWithClass(sheetAst, "label-cell");
    const printedIn = (root) => {
        const found = [];
        walk(root, (n) => {
            if (n.type !== "JSXElement") return;
            for (const child of n.children) {
                if (child.type !== "JSXExpressionContainer") continue;
                if (child.expression.type === "JSXEmptyExpression") continue;
                found.push(readName(child.expression));
            }
        });
        return found;
    };
    check("the cell prints one value, the code the page computed", printedIn(cell).join(" | "), "label.labelCode");
    const innerHtml = elementWithClass(sheetAst, "label-symbol")
        ?.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "dangerouslySetInnerHTML")
        ?.value?.expression?.properties?.find((p) => p.key?.name === "__html")?.value;
    check("  and draws one symbol, the page's", innerHtml ? readName(innerHtml) : null, "label.svg");
    const nameReads = [];
    walk(sheetAst, (n) => {
        if (n.type === "MemberExpression" && readName(n) === "label.toolName") nameReads.push(n);
    });
    const namesInCell = nameReads.filter((n) => n.start >= cell.start && n.end <= cell.end).length;
    check("the tool's name is read nowhere inside the cell", namesInCell, 0);
    // ANTI-VACUITY for that zero: the same walk finds the name where it still is.
    assert("  and is still read above the sheet, where the picker names each tool item", nameReads.length - namesInCell >= 1);
    // The page is what computes the code, through the one function that owns the form.
    assert("the page builds that code through labelCodeFor", pageNames.includes("labelCodeFor"));
    check(
        "  and the sheet component never calls it",
        sheetNames.filter((name) => name === "labelCodeFor").length,
        0
    );
    // ANTI-VACUITY: the reader is shown a cell carrying the name as well, so the
    // single value above is a fact about the component rather than about a walker
    // that stops at the first thing it sees.
    const plantedCell = elementWithClass(
        parseSource(
            'const a = <div className="label-cell"><div className="label-symbol" />' +
                '<div className="label-id">{label.labelCode}</div><div>{label.toolName}</div></div>;\n',
            "<planted-cell>"
        ).ast,
        "label-cell"
    );
    check("  a cell carrying the name is seen carrying it", printedIn(plantedCell).join(" | "), "label.labelCode | label.toolName");

    // ── 7c: every physical dimension on the sheet comes from a name (#412) ──
    log("");
    log("no dimension is written into the component:");
    // READ OFF THE AST FOR THE SAME REASON AS 7b. Section 6 already forbids a
    // millimeter figure in the STYLESHEET, and the component's dimensions are inline
    // styles it cannot see — so `width: "16.8mm"` in place of the constant would
    // print the same sheet today and stop moving the day the stock does, which is
    // the one property this whole file exists to keep. #412 changed every one of
    // these figures and a pinned one would have survived it. **The code's size is in
    // points since #431**, so a point is held to the same rule as a millimeter.
    const styleReads = [];
    const pinned = [];
    walk(sheetAst, (n) => {
        if (n.type !== "TemplateLiteral") return;
        const tail = n.quasis[n.quasis.length - 1]?.value?.cooked ?? "";
        if (!/^(?:mm|pt)\b/.test(tail)) return;
        for (const e of n.expressions) {
            if (e.type === "Identifier" || e.type === "MemberExpression") styleReads.push(readName(e));
            else pinned.push(e.type);
        }
    });
    assert(`  ${styleReads.length} physical values are built from a name`, styleReads.length >= 8);
    check(
        `  and none is a literal${pinned.length ? ` (${pinned.join(", ")})` : ""}`,
        pinned.length,
        0
    );
    // The four the label's own box needs, by name, so a box sized from something
    // else entirely would fail rather than merely being un-pinned.
    for (const name of [
        "LABEL_STOCK.labelWidthMm",
        "LABEL_STOCK.labelHeightMm",
        "LABEL_SAFE_INSET_MM",
        "LABEL_GAP_MM",
    ])
        assert(`  the cell reads ${name}`, styleReads.includes(name));
    // ANTI-VACUITY: the same reader is shown a pinned millimeter and a pinned point,
    // so the zero above is a fact about the component rather than about a walker that
    // finds nothing.
    const plantedMm = [];
    walk(
        parseSource('const s = { width: `${30.3}mm`, height: `${h}mm`, fontSize: `${6}pt` };\n', "<planted-mm>").ast,
        (n) => {
            if (n.type !== "TemplateLiteral") return;
            if (!/^(?:mm|pt)\b/.test(n.quasis[n.quasis.length - 1]?.value?.cooked ?? "")) return;
            for (const e of n.expressions) plantedMm.push(e.type);
        }
    );
    check("  the reader tells a pinned figure from a named one", plantedMm.join(" | "), "Literal | Identifier | Literal");

    // ── 7d: the code prints in the face its width was measured in (#431) ────
    log("");
    log("the code is set in the face CHARACTER_WIDTH_RATIO was measured against:");
    // THE WIDTH BUDGET IS ONE FACE'S ADVANCE, SO THE FACE IS PART OF THE BUDGET. A
    // different face prints a different width under a ratio that no longer describes
    // it, and nothing in the arithmetic can notice — the ratio is a constant. So the
    // chain from the name to the paper is asserted link by link: the module names the
    // face, the page loads that face through `next/font` into a custom property and
    // defines it above the sheet, and `.label-id` is set in it. The face is pinned by
    // VALUE beside the width it was measured for (section 2's 10.5833 mm at ten
    // characters): changing either literal is measuring the ratio again, in the same
    // commit.
    check("the face named beside the ratio", LABEL_CODE_TYPEFACE, "Inconsolata");
    const pageAst = parseFile(PAGE_SOURCE).ast;
    const faceLoader = (ast) => {
        const imported = [];
        walk(ast, (n) => {
            if (n.type === "ImportDeclaration" && n.source.value === "next/font/google")
                for (const s of n.specifiers) imported.push({ imported: s.imported?.name, local: s.local.name });
        });
        let binding = null;
        let property = null;
        walk(ast, (n) => {
            if (n.type !== "VariableDeclarator" || n.init?.type !== "CallExpression") return;
            if (!imported.some((i) => i.local === n.init.callee.name)) return;
            binding = n.id.name;
            const option = n.init.arguments[0]?.properties?.find((p) => p.key?.name === "variable");
            property = option?.value?.type === "Literal" ? option.value.value : null;
        });
        return { faces: imported.map((i) => i.imported), binding, property };
    };
    const loader = faceLoader(pageAst);
    // `next/font` spells a family's spaces as underscores in its export names.
    check("the page loads that face and no other", loader.faces.join(", "), LABEL_CODE_TYPEFACE.replace(/ /g, "_"));
    check("  into this custom property", loader.property, "--font-label-code");
    // DEFINED ABOVE THE SHEET, or `var()` resolves to nothing and the code falls back
    // to the body's face in silence — which is the state #412 measured without
    // knowing it.
    const classesAbove = (ast) => {
        const found = [];
        const visit = (node, classes) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((child) => visit(child, classes));
            let here = classes;
            if (node.type === "JSXElement") {
                const attr = node.openingElement.attributes.find(
                    (a) => a.type === "JSXAttribute" && a.name?.name === "className"
                );
                if (attr?.value?.type === "JSXExpressionContainer") here = [...classes, readName(attr.value.expression)];
                if (node.openingElement.name?.name === "LabelSheet") found.push(...here);
            }
            for (const [key, value] of Object.entries(node)) {
                if (key === "type" || key === "start" || key === "end" || key === "loc") continue;
                visit(value, here);
            }
        };
        visit(ast, []);
        return found;
    };
    assert(
        `  and puts ${loader.binding}.variable on an element above the sheet`,
        Boolean(loader.binding) && classesAbove(pageAst).includes(`${loader.binding}.variable`)
    );
    check(
        "the code's rule is set in that property",
        cssValue(cssRule(css, ".label-id"), "font-family"),
        `var(${loader.property})`
    );
    // ANTI-VACUITY, one per link: a page loading another face into another property
    // reads as that face; a property put BESIDE the sheet is not seen above it; and a
    // rule with no face of its own reads as none.
    const plantedLoader = faceLoader(
        parseSource(
            'import { Roboto_Mono } from "next/font/google";\n' +
                'const f = Roboto_Mono({ subsets: ["latin"], variable: "--font-other" });\n',
            "<planted-loader>"
        ).ast
    );
    check(
        "  a page loading another face reads as that face",
        `${plantedLoader.faces.join(", ")} into ${plantedLoader.property}`,
        "Roboto_Mono into --font-other"
    );
    check(
        "  a property beside the sheet is not above it",
        classesAbove(parseSource("const a = <main><div className={f.variable} /><LabelSheet /></main>;\n", "<planted-beside>").ast).length,
        0
    );
    check(
        "  and a code rule with no face of its own reads as none",
        cssValue(cssRule(".label-id { white-space: nowrap; }", ".label-id"), "font-family"),
        null
    );

    // ── 7e: the code goes under the symbol, one em tall (#431) ──────────────
    log("");
    log("the symbol above, the code under it, and the code one em tall:");
    // WHAT IS ON TOP IS THIS ISSUE'S DECISION AND NO SUM CAN SEE IT: a label drawn
    // with the code above the symbol, or beside it again, adds up to exactly the
    // figures above. Two things decide it and both are source — the order the cell's
    // children are written in, and the direction the stylesheet flows them.
    const childClasses = (element) =>
        (element?.children ?? [])
            .filter((child) => child.type === "JSXElement")
            .map((child) => literalClass(child) ?? child.openingElement.name?.name);
    check("the cell holds the symbol and then the code", childClasses(cell).join(", "), "label-symbol, label-id");
    check("  and the stylesheet stacks them", cssValue(cssRule(css, ".label-cell"), "flex-direction"), "column");
    // THE CODE'S LINE BOX IS ITS SIZE, which is what lets `labelSizeMm` count it as
    // one em. Left to inherit, the box is the page's one and a half em and the code
    // claims more height than the label gave it — so both properties read the floor.
    const codeStyle = (element) => {
        const style = element?.openingElement.attributes.find(
            (a) => a.type === "JSXAttribute" && a.name?.name === "style"
        );
        const properties = style?.value?.expression?.properties ?? [];
        const read = (key) => {
            const value = properties.find((p) => p.key?.name === key)?.value;
            if (!value) return "none";
            if (value.type !== "TemplateLiteral" || value.expressions.length !== 1 || value.quasis[0].value.cooked !== "")
                return value.type;
            return `${readName(value.expressions[0])} ${value.quasis[1].value.cooked}`;
        };
        return `${read("fontSize")} / ${read("lineHeight")}`;
    };
    check(
        "  the code's size and its line box are both the floor, in points",
        codeStyle(elementWithClass(sheetAst, "label-id")),
        "MIN_ID_FONT_PT pt / MIN_ID_FONT_PT pt"
    );
    // ANTI-VACUITY: a planted cell with the code on top and no line box reads that
    // way round and without one, and a stylesheet flowing it as a row reads as a row.
    const plantedFlip = parseSource(
        'const a = <div className="label-cell">' +
            '<div className="label-id" style={{ fontSize: `${MIN_ID_FONT_PT}pt` }}>{c}</div>' +
            '<div className="label-symbol" /></div>;\n',
        "<planted-flip>"
    ).ast;
    check(
        "  a cell with the code on top reads that way round",
        childClasses(elementWithClass(plantedFlip, "label-cell")).join(", "),
        "label-id, label-symbol"
    );
    check(
        "  a code with no line box of its own is seen without one",
        codeStyle(elementWithClass(plantedFlip, "label-id")),
        "MIN_ID_FONT_PT pt / none"
    );
    check(
        "  and a row reads as a row",
        cssValue(cssRule(".label-cell { display: flex; flex-direction: row; }", ".label-cell"), "flex-direction"),
        "row"
    );

    // ── 8: no client file may import the encoder ────────────────────────────
    log("");
    log("the encoder stays out of the browser bundle:");
    // #351's header names this and says no check can see it: the rule
    // `offline/client-import-safety.mjs` enforces is about `lib/airtable/`, and
    // `lib/toolLabelQR.js` reaches neither that nor `lib/airtableOps.js`. It imports
    // `qrcode`, so a `"use client"` file importing it ships the whole encoder. This
    // issue put the first client component beside it, which is why the assertion is
    // here now.
    const clientFiles = [];
    for (const root of ["app", "lib"]) {
        const found = [];
        listJsFiles(repoPath(root), found);
        for (const abs of found) {
            const rel = toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
            const { ast, source } = parseFile(rel);
            if (!/^\s*(["'])use client\1/m.test(source)) continue;
            const imports = [];
            walk(ast, (n) => {
                if (n.type === "ImportDeclaration") imports.push(n.source.value);
            });
            clientFiles.push({ rel, imports });
        }
    }
    assert(`${clientFiles.length} "use client" files found`, clientFiles.length > 5);
    const offenders = clientFiles.filter((file) =>
        file.imports.some((from) => from.endsWith("toolLabelQR") || from.endsWith("toolLabelQR.js"))
    );
    check(
        `none imports lib/toolLabelQR.js${offenders.length ? ` (${offenders.map((f) => f.rel).join(", ")})` : ""}`,
        offenders.length,
        0
    );
    // ANTI-VACUITY: the same matcher is shown finding the import a client file DOES
    // make, so the zero is not a matcher that never fires.
    const sheetFile = clientFiles.find((file) => file.rel === SHEET_SOURCE);
    assert("  and the sheet component is one of them", Boolean(sheetFile));
    assert(
        "  importing lib/toolLabelSheet.js, which the matcher can see",
        Boolean(sheetFile) && sheetFile.imports.some((from) => from.endsWith("toolLabelSheet"))
    );

    // ── 9: the words ────────────────────────────────────────────────────────
    log("");
    log("what the screen says:");
    check("the heading", COPY.heading, "Print tool labels");
    check("the control on a registration", COPY.openFromRegistration, "Print labels for these tool items");
    check("the control on a tool", COPY.openFromTool, "Print labels for the tool items on this page");
    check("the control on one tool item", COPY.openFromToolItem, "Print the label");
    // IT MAY NOT SAY `REPRINT`, which is what it said until #352 was read on screen:
    // nothing in this base records whether a sticker was ever printed, so a control
    // promising a re-print states what the app cannot check.
    check(
        "  and no opener claims a re-print",
        [COPY.openFromRegistration, COPY.openFromTool, COPY.openFromToolItem].filter((s) => /reprint/i.test(s)).length,
        0
    );
    check("one label counts singular", COPY.sheetCount({ sheets: 1, labels: 1 }), "1 label across 1 sheet.");
    check("and several do not", COPY.sheetCount({ sheets: 2, labels: 34 }), "34 labels across 2 sheets.");
    // THE STOCK NAMES ITSELF BY ITS GEOMETRY (#412), because no product has these
    // dimensions any more. Composed from `LABEL_STOCK` rather than typed, so the
    // sentence cannot say one size while the label is another — and pinned by value
    // so the composition is held rather than merely performed.
    check("the stock names itself", COPY.stock({ name: LABEL_STOCK_NAME }), "Stock: 16.8 x 20.42 mm die-cut");
    assert(
        "  and the name is built from the two dimensions",
        LABEL_STOCK_NAME.includes(String(LABEL_STOCK.labelWidthMm)) &&
            LABEL_STOCK_NAME.includes(String(LABEL_STOCK.labelHeightMm))
    );
    // AND THE RUN'S OWN SENTENCE NO LONGER NAMES IT. `…sheets of Avery 5160.` read
    // as a sheet of a product; `…sheets of 16.8 x 20.42 mm die-cut.` would read as a
    // measurement of the sheet. It is stated once, on the line above.
    assert("  which the sheet count does not repeat", !COPY.sheetCount({ sheets: 2, labels: 34 }).includes("mm"));
    check(
        "over the cap",
        COPY.overCap({ requested: 140, cap: MAX_LABELS_PER_REQUEST }),
        "140 tool items were named and this prints 100 at a time, so the first 100 are below."
    );
    check(
        "an id the base does not hold",
        COPY.missing({ toolItemIds: ["HYE-TL-260909-014"] }),
        "Not on this base, so no label is offered for HYE-TL-260909-014."
    );
    assert("the host warning names the risk rather than the mechanism", COPY.hostWarning.includes("printed from"));
    // The screen words are `tool` and `tool item`, never a bare `item` — #303's rule,
    // which on this axis is four other tables' worth of item rows.
    const strings = Object.values(COPY).filter((value) => typeof value === "string");
    const bareItem = strings.filter((text) => /\bitems?\b/.test(text) && !/\btool items?\b/.test(text));
    check(`no string says a bare item${bareItem.length ? ` (${bareItem.join(" | ")})` : ""}`, bareItem.length, 0);
    assert("  and the matcher would see one", /\bitems?\b/.test("every item on this sheet"));
}

function round4(value) {
    return Math.round(value * 10000) / 10000;
}

if (isMain(import.meta.url)) standalone(title, run);
