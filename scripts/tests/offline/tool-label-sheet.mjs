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
// THE STOCK'S GEOMETRY IS ALSO ADDED BACK UP, which is a second path rather than a
// restatement. Avery 5160's published numbers are a margin, a pitch and a count,
// and the page they came from is 215.9 x 279.4 mm — so the margins plus the
// pitches have to reach the page, and they do only if every figure was transcribed
// correctly. That is the assertion a typo in one of them fails.
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
    LABEL_SAFE_INSET_MM,
    LABEL_STOCK,
    MAX_LABELS_PER_REQUEST,
    MIN_ID_FONT_MM,
    MIN_MODULE_MM,
    TOOL_LABEL_SHEET_COPY as COPY,
    VERSION_HEADROOM,
    cellPosition,
    labelBudget,
    moduleSizeMm,
    paginateLabels,
    readStartPosition,
    symbolBox,
} from "../../../lib/toolLabelSheet.js";
import { listJsFiles, parseFile, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The sheet a tool label is printed on, by value (#353)";

/** The symbol's side in modules, quiet zone included — #351's figure today. */
const SIDE_MODULES_TODAY = 33;

export function run({ check, assert, log }) {
    // ── 1: the stock, transcribed and added back up ──────────────────────────
    log("Avery 5160's published geometry, and the page it has to add up to:");
    check("the page size keyword", LABEL_STOCK.page, "letter");
    check("page width", LABEL_STOCK.pageWidthMm, 215.9);
    check("page height", LABEL_STOCK.pageHeightMm, 279.4);
    check("label width", LABEL_STOCK.labelWidthMm, 66.675);
    check("label height", LABEL_STOCK.labelHeightMm, 25.4);
    check("labels a sheet holds", CELLS_PER_SHEET, 30);
    check("  three across", LABEL_STOCK.columns, 3);
    check("  and ten down", LABEL_STOCK.rows, 10);

    // A SECOND PATH TO THE PAGE, which is what catches a mistyped margin or pitch:
    // the left margin, the pitches and the last label's own width have to reach the
    // paper's width, with the right margin left over — and on this stock the two
    // margins are equal, which is a third thing to be wrong about.
    const usedWidth =
        LABEL_STOCK.marginLeftMm +
        (LABEL_STOCK.columns - 1) * LABEL_STOCK.columnPitchMm +
        LABEL_STOCK.labelWidthMm;
    // FOUR DECIMALS RATHER THAN TWO, BECAUSE THE STOCK'S FIGURES NEED THEM. These
    // are inches converted exactly — 3/16 of an inch is 4.7625 mm and 1/8 is 3.175
    // — and rounding to hundredths destroys both. The first version of this file
    // rounded to two and failed on its own arithmetic, which is the right way round
    // for a check to be wrong.
    check("the columns end this far from the left edge", round4(usedWidth), 211.1375);
    check("  leaving the same margin they started with", round4(LABEL_STOCK.pageWidthMm - usedWidth), 4.7625);
    const usedHeight = LABEL_STOCK.marginTopMm + LABEL_STOCK.rows * LABEL_STOCK.rowPitchMm;
    check("the rows end this far from the top edge", round4(usedHeight), 266.7);
    check("  leaving the same margin again", round4(LABEL_STOCK.pageHeightMm - usedHeight), 12.7);
    check("the gap between columns", round4(LABEL_STOCK.columnPitchMm - LABEL_STOCK.labelWidthMm), 3.175);
    check("and no gap between rows", round4(LABEL_STOCK.rowPitchMm - LABEL_STOCK.labelHeightMm), 0);

    // ── 2: the module size, derived and floored ─────────────────────────────
    log("");
    log("millimeters per module, derived from the label's height:");
    const moduleMm = moduleSizeMm({ sideModules: SIDE_MODULES_TODAY });
    check(`${SIDE_MODULES_TODAY} modules today, ${VERSION_HEADROOM} versions of headroom`, VERSION_HEADROOM, 2);
    check("the derived module", moduleMm, 0.57);
    assert(`  which clears the ${MIN_MODULE_MM} mm floor`, moduleMm >= MIN_MODULE_MM);
    check("the floor is a citation and this is its value", MIN_MODULE_MM, 0.4);

    const budget = labelBudget({ sideModules: SIDE_MODULES_TODAY });
    check("today's symbol box", budget.symbolMm, 18.81);
    check("the widest it absorbs", budget.widestSymbolMm, 23.37);
    check("what a label may print inside, tall", budget.usableHeightMm, 23.4);
    check("and wide", budget.usableWidthMm, 64.68);

    // THE FIT, WHICH IS THE ONE CLAIM NO LAYOUT CAN OVERRIDE. If the widest symbol
    // and the id's floor do not fit inside one label, the two must overlap however
    // they are drawn — and ink inside the quiet zone is what #351 asked this issue
    // not to produce.
    assert("the widest symbol fits the label's height", budget.widestSymbolMm <= budget.usableHeightMm);
    check("what is left beside it for text", budget.textWidthMm, 39.81);
    check("what the id needs at its floor", budget.minIdWidthMm, 25.5);
    assert("  so the id fits beside the widest symbol", budget.minIdWidthMm <= budget.textWidthMm);
    check("the id's floor", MIN_ID_FONT_MM, 2.5);
    check("the gap between symbol and text", LABEL_GAP_MM, 1.5);
    check("the safe inset from the die-cut", LABEL_SAFE_INSET_MM, 1);

    // ANTI-VACUITY: the derivation is shown REFUSING. A stock too short drives the
    // module under the floor, so the guard above is a fact about this stock rather
    // than about arithmetic that always passes.
    const tiny = { ...LABEL_STOCK, labelHeightMm: 10 };
    const tinyModule = Math.floor(((tiny.labelHeightMm - 2) / 41) * 100) / 100;
    assert(`  a 10 mm label would derive ${tinyModule} mm and fail the floor`, tinyModule < MIN_MODULE_MM);
    // And a version step really does cost four modules a side, so the headroom is
    // spending something rather than nothing.
    assert(
        "  two versions of headroom really costs module width",
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
        [33, 18.81],
        [37, 21.09],
        [41, 23.37],
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
    // The headroom's edge, both sides of it: a label crops what overflows and a
    // cropped symbol is unscannable with nothing to see, so the screen says so.
    assert("  today's fits", symbolBox({ sideModules: 33, moduleMm }).fits);
    assert("  two versions up still fits", symbolBox({ sideModules: 41, moduleMm }).fits);
    assert("  three does not, and is reported rather than cropped", !symbolBox({ sideModules: 45, moduleMm }).fits);

    // ── 3: where each label position sits ───────────────────────────────────
    log("");
    log("the corners the die-cut put the labels at:");
    check("the first", JSON.stringify(cellPosition(0)), JSON.stringify({ leftMm: 4.76, topMm: 12.7 }));
    check("second across", JSON.stringify(cellPosition(1)), JSON.stringify({ leftMm: 74.61, topMm: 12.7 }));
    check("third across", JSON.stringify(cellPosition(2)), JSON.stringify({ leftMm: 144.46, topMm: 12.7 }));
    check("first of the second row", JSON.stringify(cellPosition(3)), JSON.stringify({ leftMm: 4.76, topMm: 38.1 }));
    check("the last one on the sheet", JSON.stringify(cellPosition(29)), JSON.stringify({ leftMm: 144.46, topMm: 241.3 }));
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
    check("past the end clamps to the last", readStartPosition("99"), CELLS_PER_SHEET);
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
    const spilling = paginateLabels(Array.from({ length: 28 }, (_, at) => ({ toolItemId: `S${at}` })), 7);
    check("28 from position 7 needs two sheets", spilling.length, 2);
    check("  the first holds 30 cells", spilling[0].length, CELLS_PER_SHEET);
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
    assert("  a sheet holds fewer than one request prints, so a run spans sheets", CELLS_PER_SHEET < MAX_LABELS_PER_REQUEST);

    // ── 6: `@page` is spelled in a file nothing else in this tier reads ─────
    log("");
    log("`labels.css` carries the one figure a custom property cannot:");
    const css = readFileSync(repoPath("app/(tools)/tool-items/labels/labels.css"), "utf8");
    assert(`the page box names \`${LABEL_STOCK.page}\``, new RegExp(`size:\\s*${LABEL_STOCK.page}\\s*;`).test(css));
    assert("  and takes no margin, so the stock's own margins mean something", /@page[^}]*margin:\s*0\s*;/s.test(css));
    assert("the picker is hidden at print", /@media print[\s\S]*\.label-controls[\s\S]*display:\s*none/.test(css));
    assert("and a second sheet starts a second page", /\.label-sheet \+ \.label-sheet[\s\S]*break-before:\s*page/.test(css));
    // NO PHYSICAL DIMENSION MAY BE WRITTEN HERE. Every millimeter is an inline style
    // computed from LABEL_STOCK; one in the stylesheet is the figure that would not
    // move when the stock does.
    const millimeters = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/\d+(?:\.\d+)?mm/g) || [];
    check(`no millimeter figure in the stylesheet${millimeters.length ? ` (${millimeters.join(", ")})` : ""}`, millimeters.length, 0);

    // ── 7: the symbol is sized by its SIDE and never by its symbol proper ───
    log("");
    log("the quiet zone survives the layout:");
    // #351's contract is that the SVG's box is `QR_SIDE_MODULES` across. The mutant
    // is passing `QR_SYMBOL_MODULES` instead, which crops the four modules of margin
    // and renders a symbol a camera has to separate from the ink beside it. Read off
    // the AST rather than the text, so a comment naming the wrong constant is not a
    // violation.
    const sheetSource = "app/(tools)/tool-items/labels/LabelSheet.js";
    const pageSource = "app/(tools)/tool-items/labels/page.js";
    const identifiers = (rel) => {
        const names = [];
        walk(parseFile(rel).ast, (n) => {
            if (n.type === "Identifier") names.push(n.name);
        });
        return names;
    };
    const pageNames = identifiers(pageSource);
    assert("the page reads QR_SIDE_MODULES", pageNames.includes("QR_SIDE_MODULES"));
    check(
        "  and names QR_SYMBOL_MODULES nowhere",
        pageNames.filter((name) => name === "QR_SYMBOL_MODULES").length,
        0
    );
    const sheetNames = identifiers(sheetSource);
    check(
        "the sheet component names neither, taking the count as a prop",
        sheetNames.filter((name) => name === "QR_SIDE_MODULES" || name === "QR_SYMBOL_MODULES").length,
        0
    );
    // ANTI-VACUITY: the walker is seen finding something in those files, so the two
    // zeros above are facts about the source rather than about a failed parse.
    assert("  the walker really reads those files", sheetNames.includes("labelBudget") && pageNames.includes("buildToolItemQR"));

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
    const sheetFile = clientFiles.find((file) => file.rel === sheetSource);
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
    check("one label counts singular", COPY.sheetCount({ sheets: 1, labels: 1 }), "1 label across 1 sheet of Avery 5160.");
    check("and several do not", COPY.sheetCount({ sheets: 2, labels: 34 }), "34 labels across 2 sheets of Avery 5160.");
    check("the stock names itself", COPY.stock({ name: LABEL_STOCK.name }), "Stock: Avery 5160");
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
