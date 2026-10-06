// The page a tool label prints as, by value (#353, #467), and the dialog that draws
// and prints it (#457).
//
// WHAT THIS FILE IS FOR. A printed dimension is the one kind of claim this tier is
// unusually good at and unusually easy to fake: the arithmetic is pure, so it can
// be held exactly — and every figure is reachable from a few constants, so an
// assertion written against them holds no matter what they say. #351 shipped that
// mistake and measured it: its quiet-zone assertions were all expressed in terms of
// `QR_QUIET_ZONE_MODULES`, so changing 4 to 2 moved the constant, the derived side,
// the SVG's own margin and the builder's report together, and all 47 assertions
// passed. **So the figures below are LITERALS.** Changing the stock changes them in
// the same commit, which is the point rather than a cost: a dimension nobody re-typed
// is a dimension nobody checked.
//
// ONE LABEL IS ONE PAGE SINCE #467, AND THE SECOND PATH IS THE PARTS ADDING BACK UP
// TO THE STOCK. The stock is two inputs — the tape's width, which is the label's
// height, and the length the printer cuts, 11 mm — and everything else is derived
// from them, the two floors and the face. So what is worth asserting is that the
// derived parts come back to the inputs exactly, that the stock carries no derived
// figure of its own to disagree with them, and that the label is no narrower than the
// one a print proved (10.87 mm, four equal margins). This file held a Letter sheet of
// die-cut labels until then — its grid, its count and its start position — and those
// went with the sheet; section 3 holds that none of them is left.
//
// THE PAGES ARE A DIALOG'S SINCE #457, AND WHAT PRINTS IS NOW THE STYLESHEET'S TO
// DECIDE. The labels were the screen `/tool-items/labels`, whose every heading and
// sentence sat in one wrapper the stylesheet hid at print; they are a modal dialog over
// the page that opens them now, in the top layer, beside a column of what the dialog
// says, in a pane that scrolls. So section 5 reads the rules that take everything but
// the label pages off the paper — the page behind, the frame, the backdrop — and that
// stop the pane cutting the run, and section 5b holds that nothing but a label page
// stands in the pane to be printed.
//
// AND THREE FACTS NO FIGURE CAN SEE. Which way the two pieces stack, what face and
// weight the code prints in, and that the code is set by its baseline rather than by a
// line box are all source: a label drawn upside down adds up to the same sums, a face
// is a name rather than a number, and a line box and a baseline draw the same box. So
// they are read off the AST and the stylesheet, each beside a planted counterexample.
//
// WHAT IT CANNOT SEE, and the list is longer here than usual because the subject is
// paper. It never renders, so it cannot see ink inside the quiet zone, a browser's
// print scaling, whether `@media print` actually took the frame and the page behind off
// the paper, whether the top layer carried the run from page to page, or whether a page
// came out the label's size. What it CAN do is add the parts up: if the pieces do not
// fit the stock, no layout can stop them overlapping, and that is arithmetic. The
// pages were printed to PDF and measured — by #467, and from the dialog by #457 — and
// the label a print proved — this symbol, this code and this height, 10.87 mm across —
// was printed on the label printer and read; both are recorded in docs/notes/tools.md
// rather than implied here.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";

import { MAX_TOOL_ITEMS_PER_REGISTRATION } from "../../../lib/toolRegistration.js";
import * as labelPage from "../../../lib/toolLabelPage.js";
import {
    ID_HEIGHT_MM,
    ID_INK_ABOVE_EM,
    LABEL_CODE_TYPEFACE,
    LABEL_GAP_MM,
    LABEL_PREVIEW_SCALE,
    LABEL_STOCK,
    MAX_LABELS_PER_REQUEST,
    MIN_ID_FONT_PT,
    MIN_MODULE_MM,
    TOOL_LABEL_PAGE_COPY as COPY,
    VERSION_HEADROOM,
    describeLabelRun,
    labelBudget,
    labelSizeMm,
    symbolBox,
} from "../../../lib/toolLabelPage.js";
import {
    callsTo,
    insideCallTo,
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

export const title = "The page a tool label prints as, and the dialog it prints from, by value (#353, #467, #457)";

/** The symbol's side in modules, quiet zone included — #351's figure today. */
const SIDE_MODULES_TODAY = 33;

/** The files several sections below read off the AST. */
const COMPONENT_SOURCE = "app/(tools)/tool-items/LabelsDialog.js";
const ACTION_SOURCE = "app/(tools)/tool-items/actions.js";
const CSS_SOURCE = "app/(tools)/tool-items/labels.css";
const MODULE_SOURCE = "lib/toolLabelPage.js";
const QR_SOURCE = "lib/toolLabelQR.js";

/** `LABEL_STOCK.labelWidthMm` for a member read, the bare name for an identifier. */
function readName(node) {
    if (node.type === "Identifier") return node.name;
    if (node.type === "MemberExpression" && !node.computed)
        return `${readName(node.object)}.${node.property.name}`;
    return node.type;
}

/** Every name a function reads, members spelled out. */
function namesRead(fn) {
    const found = new Set();
    walk(fn, (n) => {
        if (n.type === "MemberExpression" || n.type === "Identifier") found.add(readName(n));
    });
    return found;
}

/**
 * A JSX element's class tokens: a literal's words, and the static words of a template —
 * `label-list grid … ${face.variable}` reads as its words and the expression's name.
 */
function classTokens(element) {
    const attr = element.openingElement?.attributes?.find(
        (a) => a.type === "JSXAttribute" && a.name?.name === "className"
    );
    if (!attr) return [];
    if (attr.value?.type === "Literal") return String(attr.value.value).split(/\s+/).filter(Boolean);
    const expression = attr.value?.expression;
    if (expression?.type === "TemplateLiteral")
        return [
            ...expression.quasis.flatMap((q) => (q.value.cooked ?? "").split(/\s+/).filter(Boolean)),
            ...expression.expressions.map(readName),
        ];
    return expression ? [readName(expression)] : [];
}

/** The first element in a tree carrying this class token. */
function elementWithClass(ast, className) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "JSXElement" && classTokens(n).includes(className)) found = n;
    });
    return found;
}

/** A stylesheet's text with its comments stripped. */
function bare(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The inside of the first `@media <query>` block, braces matched, or "". */
function mediaBlock(css, query) {
    const text = bare(css);
    const open = text.indexOf(`@media ${query}`);
    if (open < 0) return "";
    const start = text.indexOf("{", open);
    let depth = 0;
    for (let at = start; at < text.length; at++) {
        if (text[at] === "{") depth++;
        if (text[at] === "}" && --depth === 0) return text.slice(start + 1, at);
    }
    return "";
}

/** The body of the first rule whose selector is exactly `selector`, or null. */
function cssRule(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return bare(css).match(new RegExp(`(?:^|[\\s}])${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? null;
}

/** One declaration's value inside a rule body, or null. */
function cssValue(body, property) {
    return body?.match(new RegExp(`(?:^|;|\\s)${property}\\s*:\\s*([^;]+?)\\s*(?:;|$)`))?.[1] ?? null;
}

/**
 * An object literal declared under `name` in a parsed file: its keys and whether each
 * value is a literal.
 */
function objectLiteral(parsed, name) {
    let found = null;
    walk(parsed.ast, (n) => {
        if (found || n.type !== "VariableDeclarator" || n.id?.name !== name || n.init?.type !== "ObjectExpression") return;
        found = n.init.properties.map((p) => `${p.key?.name}:${p.value?.type === "Literal" ? "input" : p.value?.type}`);
    });
    return found ? found.join(", ") : "none";
}

/** A JSX attribute's value as written — a literal's text or an expression's source. */
function attributeSource(parsed, element, name) {
    const attr = element?.openingElement?.attributes?.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
    if (!attr) return "none";
    if (attr.value?.type === "Literal") return String(attr.value.value);
    const expression = attr.value?.expression;
    return expression ? parsed.source.slice(expression.start, expression.end) : "none";
}

/** A run of labels whose symbols came out at these side counts, and these codes missing. */
function plantedRun(sides, missing = []) {
    return {
        sideModules: SIDE_MODULES_TODAY,
        labels: sides.map((sideModules, at) => ({
            toolItemId: `HYE-TL-260909-00${at + 1}`,
            labelCode: `260909-00${at + 1}`,
            svg: "<svg/>",
            sideModules,
        })),
        missing,
    };
}

export function run({ check, assert, log }) {
    // ── 1: the stock, which is two inputs and nothing else ──────────────────
    log("the stock the label is cut from:");
    check("the tape the label printer takes, which is the label's height", LABEL_STOCK.tapeWidthMm, 12);
    check("the length it cuts one label to, which is the label's width", LABEL_STOCK.labelWidthMm, 11);
    // A DERIVED FIGURE TYPED IN BESIDE ITS INPUTS IS A SECOND PLACE FOR ONE NUMBER, and
    // the two can disagree with nothing to say so. So the stock is read off the AST: its
    // members are exactly the two inputs, each a number typed as itself.
    check(
        "the stock carries its two inputs and nothing derived",
        objectLiteral(parseFile(MODULE_SOURCE), "LABEL_STOCK"),
        "tapeWidthMm:input, labelWidthMm:input"
    );
    // ANTI-VACUITY: a stock that carries the symbol's box as well — the shape the first
    // design of #467 had — is seen carrying it, and a member computed from another is
    // seen as not an input.
    check(
        "  a stock carrying a derived box is seen carrying it",
        objectLiteral(
            parseSource(
                "const LABEL_STOCK = { tapeWidthMm: 12, labelWidthMm: 11, symbolMm: 9.57, marginMm: (12 - 9.57) / 2 };\n",
                "<planted-stock>"
            ),
            "LABEL_STOCK"
        ),
        "tapeWidthMm:input, labelWidthMm:input, symbolMm:input, marginMm:BinaryExpression"
    );

    // ── 1a: the label a print proved, and this one against it ───────────────
    log("");
    log("the label four equal margins give, which is the one printed and read:");
    const printed = labelSizeMm({ sideModules: SIDE_MODULES_TODAY });
    check("the symbol it is sized for", printed.widestSymbolMm, 9.57);
    check("  the margin all round it", round4(printed.marginMm), 0.6488);
    check("  its width, rounded up to a hundredth", printed.widthMm, 10.87);
    check("  and its height, the tape's", printed.heightMm, 12);
    // THIS LABEL IS THAT ONE WITH A ROUND LENGTH, AND THE ORDER IS THE CLAIM. The side
    // margins may be wider than the print's and never narrower, since a narrower one is a
    // margin nothing has printed.
    assert("this label is at least as wide as the printed one", LABEL_STOCK.labelWidthMm >= printed.widthMm);
    check("  by the length the cut was rounded to", round4(LABEL_STOCK.labelWidthMm - printed.widthMm), 0.13);
    // THE WIDTH IS THE TAPE LESS THE CODE'S HEIGHT, WHATEVER THE SYMBOL — measured here
    // rather than said, because it is what makes a version step a matter of margins
    // alone. A larger symbol takes from the margins exactly what it adds to itself.
    check("the tape less the code's height", round4(LABEL_STOCK.tapeWidthMm - ID_HEIGHT_MM), 10.8676);
    const roomier = labelSizeMm({ sideModules: SIDE_MODULES_TODAY, versionsOfHeadroom: 1 });
    check("  a version of headroom leaves that width where it is", roomier.widthMm, printed.widthMm);
    check("  and takes the margin down to", round4(roomier.marginMm), 0.0688);
    // ANTI-VACUITY: the derivation is shown MOVING with the code, so the equality above is
    // a fact about the tape rather than about a function that returns one number.
    assert("  while a symbol a version larger is larger", roomier.widestSymbolMm > printed.widestSymbolMm);

    // ── 2: the floors, and what the code's ink comes to ─────────────────────
    log("");
    log("the two floors a print proved, and the face's ink:");
    check("the module", MIN_MODULE_MM, 0.29);
    check("the code's size, in points", MIN_ID_FONT_PT, 5);
    check("the code's ink above its baseline, in ems", ID_INK_ABOVE_EM, 0.631);
    // 0.642 em of five points; the 0.011 below the baseline is private to the module,
    // so the height is what holds it.
    check("the code's height, its ink top to bottom", round4(ID_HEIGHT_MM), 1.1324);
    check("no version of headroom above today's symbol", VERSION_HEADROOM, 0);
    check("and nothing between the symbol and the code", LABEL_GAP_MM, 0);

    // ── 2a: what the parts come to, and that they come back to the stock ────
    log("");
    log("the label's parts, added back up to the stock:");
    const budget = labelBudget({ sideModules: SIDE_MODULES_TODAY });
    check("the module it prints at", budget.moduleMm, 0.29);
    check("today's symbol box", budget.symbolMm, 9.57);
    check("  and the widest it is sized for, the same box", budget.widestSymbolMm, 9.57);
    check("either side of the symbol", round4(budget.marginXMm), 0.715);
    check("above it and below the code", round4(budget.marginYMm), 0.6488);
    check("  which is the printed label's margin", round4(budget.marginYMm), round4(printed.marginMm));
    check("what the code needs, tall", round4(budget.minIdHeightMm), 1.1324);
    // THE SECOND PATH: across and down, the parts are summed back to the two inputs
    // they were derived from, so a margin computed from the wrong room is a sum that
    // misses its stock.
    check(
        "across, two margins and the symbol come to the cut",
        round4(budget.marginXMm * 2 + budget.widestSymbolMm),
        LABEL_STOCK.labelWidthMm
    );
    check(
        "down, two margins, the symbol, the gap and the code come to the tape",
        round4(budget.marginYMm * 2 + budget.widestSymbolMm + LABEL_GAP_MM + budget.minIdHeightMm),
        LABEL_STOCK.tapeWidthMm
    );
    assert("the side margins are the wider pair", budget.marginXMm > budget.marginYMm);
    // THE CODE ACROSS, which the symbol's width over it has to clear: ten characters at
    // the floor, in the face's measured advance.
    check("ten characters at the floor, across", round4(budget.minIdWidthMm), 8.8194);
    assert("  which the symbol's width over them clears", budget.minIdWidthMm <= budget.widestSymbolMm);
    check("  with this much to spare", round4(budget.widestSymbolMm - budget.minIdWidthMm), 0.7506);
    // A VERSION STEP HAS ONLY THE MARGINS TO TAKE FROM — the module header's figures, by
    // value, since that is where somebody weighing a longer host will read them.
    const stepped = labelBudget({ sideModules: SIDE_MODULES_TODAY, versionsOfHeadroom: 1 });
    check("a version step at this width leaves either side", round4(stepped.marginXMm), 0.135);
    check("  and above and below", round4(stepped.marginYMm), 0.0688);
    // ANTI-VACUITY: a stock too narrow for the symbol is a NEGATIVE margin, so the sums
    // above are facts about this stock rather than about arithmetic that always closes.
    assert("  a 9 mm cut would leave a negative margin beside the symbol", (9 - budget.widestSymbolMm) / 2 < 0);

    // ── 2b: a longer address prints a BIGGER symbol, not a denser one ───────
    log("");
    log("each symbol's box comes from its own side count:");
    // THE DEFECT THIS SECTION EXISTS FOR WAS MEASURED IN A BROWSER, NOT REASONED
    // ABOUT (#353). Every box was sized from `QR_SIDE_MODULES`, so a version-3 symbol
    // was scaled INTO today's box and its modules came out thinner. The module is fixed
    // for the label; the box is per symbol.
    for (const [side, expected] of [
        [33, 9.57],
        [37, 10.73],
        [41, 11.89],
    ])
        check(`  ${side} modules is ${expected} mm`, symbolBox({ sideModules: side, budget }).boxMm, expected);
    assert(
        "  a version step makes the box bigger rather than the modules thinner",
        symbolBox({ sideModules: 37, budget }).boxMm > symbolBox({ sideModules: 33, budget }).boxMm
    );
    check(
        "  and the module width is the same at every version",
        round4(symbolBox({ sideModules: 41, budget }).boxMm / 41),
        round4(symbolBox({ sideModules: 33, budget }).boxMm / 33)
    );
    // THE EDGE, BOTH SIDES OF IT. Today's fits and nothing larger does, since the
    // margins are what today's leaves. 37 is what a host past seventeen characters
    // builds, a Vercel domain's among them (`offline/tool-label-qr.mjs`).
    assert("  today's fits", symbolBox({ sideModules: 33, budget }).fits);
    assert("  one version up does not, and is reported rather than printed into the margins", !symbolBox({ sideModules: 37, budget }).fits);
    assert("  nor does two", !symbolBox({ sideModules: 41, budget }).fits);
    // WHAT `fits` ASKS IS READ OFF THE SOURCE, because with the margins derived from the
    // widest symbol every comparison against a room the stock leaves comes out the same
    // today. It asks the budget's widest symbol and nothing of the stock, so a margin
    // typed into a comparison cannot stand in for the one the budget derived.
    const asked = (reads) =>
        [...reads].filter((name) => name.startsWith("budget.") || name.startsWith("LABEL_STOCK")).sort().join(", ");
    const moduleAst = parseFile(MODULE_SOURCE).ast;
    const boxReads = namesRead(resolveFunction(moduleAst, "symbolBox"));
    check(
        "  symbolBox asks the budget's module and widest symbol, and nothing of the stock",
        asked(boxReads),
        "budget.moduleMm, budget.widestSymbolMm"
    );
    // AND EVERY BOX IS ASKED OF THE BUDGET `labelBudget` MADE FOR THE RUN — in
    // `describeLabelRun`, which decides which pages print, and in the dialog's page, which
    // draws each — off the AST, since handed anything else `symbolBox` throws as the page
    // renders and this tier never renders. The dialog takes its budget from that function.
    const budgetFlow = (ast) => {
        let bound = "none";
        const handed = [];
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.init?.type === "CallExpression" && n.init.callee?.name === "labelBudget")
                bound = n.id.name;
            if (n.type === "VariableDeclarator" && n.init?.type === "CallExpression" && n.init.callee?.name === "describeLabelRun")
                bound = n.id.type === "ObjectPattern" && n.id.properties.some((p) => p.key?.name === "budget") ? "budget" : "none";
            if (n.type === "CallExpression" && n.callee?.name === "symbolBox") {
                const prop = n.arguments[0]?.properties?.find((p) => p.key?.name === "budget");
                handed.push(prop ? readName(prop.value) : "nothing");
            }
        });
        return `${bound} -> ${[...new Set(handed)].join(", ")}`;
    };
    check("  the run's pages are chosen against the budget labelBudget made", budgetFlow(resolveFunction(moduleAst, "describeLabelRun")), "budget -> budget");
    check("  and the dialog draws each against the budget that run hands it", budgetFlow(parseFile(COMPONENT_SOURCE).ast), "budget -> budget");
    // ANTI-VACUITY: a planted symbolBox comparing against the stock's width is seen
    // reading the stock, and a planted dialog handing its box a module size is seen so.
    const plantedBoxReads = namesRead(
        resolveFunction(
            parseSource(
                "function symbolBox({ sideModules, budget }) { const boxMm = sideModules * budget.moduleMm; return { boxMm, fits: boxMm <= LABEL_STOCK.labelWidthMm - 1.43 }; }\n",
                "<planted-box>"
            ).ast,
            "symbolBox"
        )
    );
    check("  a symbolBox reading the stock is seen reading it", asked(plantedBoxReads), "LABEL_STOCK, LABEL_STOCK.labelWidthMm, budget.moduleMm");
    check(
        "  a dialog handing a box a module size is seen so",
        budgetFlow(parseSource("const { pages } = describeLabelRun(run);\nconst b = symbolBox({ sideModules: 33, budget: moduleMm });\n", "<planted-flow>").ast),
        "none -> moduleMm"
    );

    // ── 3: the sheet went, and nothing of it is left (#467) ─────────────────
    log("");
    log("no sheet, no grid and no start position:");
    // WHAT A LATER PASS WOULD REACH FOR TO PUT A SHEET BACK is exactly these names, so
    // their absence is held as #454 holds the host's words: the module exports none of
    // them, and the same question finds a name that is there.
    const SHEET_NAMES = ["CELLS_PER_SHEET", "LABEL_GRID", "cellPosition", "readStartPosition", "paginateLabels", "LABEL_SAFE_INSET_MM"];
    check(
        "the module exports nothing a sheet needed",
        SHEET_NAMES.filter((name) => name in labelPage).join(", "),
        ""
    );
    assert("  and the same question finds a name that is there", "symbolBox" in labelPage && "labelBudget" in labelPage);
    // AND THE STOCK LINE'S NAME WENT WITH THE LINE (#457): the dialog gives the print's
    // size in text, `COPY.size`, built from the stock — section 8.
    check("the stock line's name is gone", "LABEL_STOCK_NAME" in labelPage, false);

    // ── 4: the cap is the registration's, not a number of its own ───────────
    log("");
    log("the cap comes from the largest registration:");
    check("what one print takes", MAX_LABELS_PER_REQUEST, 100);
    check("  which is the registration cap itself", MAX_LABELS_PER_REQUEST, MAX_TOOL_ITEMS_PER_REGISTRATION);
    // ANTI-VACUITY for that equality: the figure is also pinned by value, so the two
    // moving together is a fact rather than the assertion comparing a name to itself.
    check("and that cap is this number", MAX_TOOL_ITEMS_PER_REGISTRATION, 100);

    // ── 4b: the run is read through the one reading of `id`, and capped (#443, #457) ──
    log("");
    log("the labels' read takes its ids through the reading a tool's list shares:");
    // ONE RUN, TWO READERS, ONE FUNCTION. A tool's list reads its selection off its
    // address and hands it to the labels' read, which reads it again — so the two must
    // read it the same way: a second spelling here that stopped dropping repeats would
    // print one tool item twice from a list that showed it once. So the action is read
    // for where its argument goes: handed to `readToolItemIds` once, read nowhere else,
    // and never canonicalized by the action itself. `offline/tool-routes.mjs` holds the
    // values, and that reading a reading changes nothing.
    const action = parseFile(ACTION_SOURCE);
    const idReading = (ast, parameter) => {
        const found = { handed: [], reads: 0, canonicalized: 0 };
        const notReads = new Set();
        walk(ast, (n) => {
            if (n.type === "Property" && !n.computed) notReads.add(n.key);
            if (n.type === "MemberExpression" && !n.computed) notReads.add(n.property);
        });
        walk(ast, (n) => {
            if (n.type === "CallExpression" && n.callee.type === "Identifier") {
                if (n.callee.name === "readToolItemIds") found.handed.push(readName(n.arguments[0] ?? {}));
                if (n.callee.name === "canonicalToolItemId") found.canonicalized++;
            }
        });
        // Reads of the parameter, the function's own declaration of it excluded.
        const fn = resolveFunction(ast, "readToolItemLabelsAction");
        const declared = new Set(fn?.params ?? []);
        walk(fn ?? ast, (n) => {
            if (n.type === "Identifier" && n.name === parameter && !notReads.has(n) && !declared.has(n)) found.reads++;
        });
        return found;
    };
    const actionReading = idReading(action.ast, "toolItemIds");
    check("the action hands what it is given to readToolItemIds, once", actionReading.handed.join(" | "), "toolItemIds");
    check("  and reads it nowhere else", actionReading.reads, 1);
    check("  nor canonicalizes an id itself", actionReading.canonicalized, 0);
    // ANTI-VACUITY: a planted read that canonicalizes its argument itself is seen for what
    // it is — the argument read outside the shared function, and canonicalized here.
    const restoredReading = idReading(
        parseSource(
            "export async function readToolItemLabelsAction(toolItemIds) {\n" +
                "  const asked = toolItemIds.map((v) => canonicalToolItemId(v));\n" +
                "  const named = [...new Set(asked.filter(Boolean))];\n" +
                "}\n",
            "<planted-restored-reading>"
        ).ast,
        "toolItemIds"
    );
    check("  a read spelling its own reading is seen handing nothing over", restoredReading.handed.length, 0);
    assert(
        "  while reading the argument and canonicalizing it itself",
        restoredReading.reads === 1 && restoredReading.canonicalized === 1
    );
    // A RUN LONGER THAN ONE PRINT THROWS RATHER THAN PRINTING ITS HEAD. A tool's page
    // refuses such a selection first, so a longer one is a caller with no page; the
    // screen took the first hundred and said so until #457.
    const capped = (parsed) => {
        let found = "none";
        walk(parsed.ast, (n) => {
            if (n.type !== "IfStatement") return;
            const test = parsed.source.slice(n.test.start, n.test.end);
            const throws = n.consequent.type === "ThrowStatement" || n.consequent.body?.some?.((s) => s.type === "ThrowStatement");
            if (/MAX_LABELS_PER_REQUEST/.test(test)) found = `${test} -> ${throws ? "throws" : "goes on"}`;
        });
        return found;
    };
    // A CODE THE READ DID NOT FIND IS NAMED IN THE STICKER'S FORM, `260909-098`, as 1i
    // draws it — through `namedCode`, which names a string that is not shaped like a
    // `Tool Item ID` as it came rather than throwing on it, as `labelCodeFor` would.
    const missingNamed = (parsed) => {
        const found = [];
        walk(parsed.ast, (n) => {
            if (n.type !== "CallExpression" || n.callee.type !== "MemberExpression") return;
            if (n.callee.object?.name !== "missing" || n.callee.property?.name !== "push") return;
            const arg = n.arguments[0];
            found.push(arg?.type === "CallExpression" ? `${arg.callee.name}(${readName(arg.arguments[0] ?? {})})` : readName(arg ?? {}));
        });
        return found.join(" | ") || "none";
    };
    check("  and a code it did not find is named by namedCode", missingNamed(action), "namedCode(toolItemId)");
    check(
        "  where one named as the address spelled it is seen so",
        missingNamed(parseSource("const missing = []; missing.push(toolItemId);\n", "<planted-missing>")),
        "toolItemId"
    );
    check("  and a run longer than one print throws", capped(action), "named.length > MAX_LABELS_PER_REQUEST -> throws");
    check(
        "  where one that prints the first hundred is seen going on",
        capped(parseSource("if (named.length > MAX_LABELS_PER_REQUEST) named = named.slice(0, MAX_LABELS_PER_REQUEST);\n", "<planted-cap>")),
        "named.length > MAX_LABELS_PER_REQUEST -> goes on"
    );

    // ── 4c: what the dialog shows for a run, by value (#457) ────────────────
    log("");
    log("which pages a run prints, of how many it named:");
    // 1i's three states and the long host's borrowing of the third, each a run the
    // function is handed — so the count, the pages and the two reasons a label does not
    // print are pinned where the dialog reads them.
    const ready = describeLabelRun(plantedRun([33, 33, 33]));
    check("every code on record and every symbol fitting: all print", `${ready.printing} of ${ready.named}`, "3 of 3");
    check("  the pages are the run's, in its order", ready.pages.map((label) => label.labelCode).join(", "), "260909-001, 260909-002, 260909-003");
    check("  and nothing is missing or too large", `${ready.missing.length} / ${ready.tooLarge}`, "0 / 0");
    const some = describeLabelRun(plantedRun([33, 33], ["260909-098"]));
    check("some codes on no tool item: the rest print", `${some.printing} of ${some.named}`, "2 of 3");
    check("  and the codes not found are kept", some.missing.join(", "), "260909-098");
    const none = describeLabelRun(plantedRun([], ["260909-097", "260909-098"]));
    check("none on record: nothing prints", `${none.printing} of ${none.named}`, "0 of 2");
    const long = describeLabelRun(plantedRun([37, 37]));
    check("every symbol too large for the label: nothing prints", `${long.printing} of ${long.named}`, "0 of 2");
    check("  and it says how many are too large", long.tooLarge, 2);
    const mixed = describeLabelRun(plantedRun([33, 37]));
    check("a run of both sizes prints the one that fits", `${mixed.printing} of ${mixed.named}, ${mixed.tooLarge} too large`, "1 of 2, 1 too large");
    check("the budget it hands on is labelBudget's for the run", round4(ready.budget.marginXMm), 0.715);

    // ── 5: the stylesheet: the page box, and what it takes off the paper ────
    log("");
    log("`labels.css` carries the page box, and at print takes all but the label pages off the paper:");
    // LINE ENDINGS NORMALIZED, since a rule below is found by its selector across two
    // lines: a Windows checkout writes this file with CRLF, and the selector matched
    // nothing there until a rebase rewrote the file and the assertion read null.
    const css = readFileSync(repoPath(CSS_SOURCE), "utf8").replace(/\r\n/g, "\n");
    const print = mediaBlock(css, "print");
    assert("the stylesheet has a print block", print.length > 0);
    // A NAMED PAGE, AND ONLY THE ROOT TAKES THE NAME, ONLY WHILE THE DIALOG IS OPEN. The
    // stylesheet is on both pages that can open the dialog, so a page box for the whole
    // document would print either at the label's size with the dialog shut; and given to
    // the label pages the name is not taken, since they are in the top layer — measured,
    // Chrome and Edge print them at Letter. docs/notes/tools.md has the PDFs.
    const pageRule = cssRule(css, "@page tool-label");
    check(
        "the label's page box is the label: the cut's length across and the tape's width down",
        cssValue(pageRule, "size"),
        `${LABEL_STOCK.labelWidthMm}mm ${LABEL_STOCK.tapeWidthMm}mm`
    );
    // By value as well, so the relation above cannot be two wrong numbers agreeing.
    check("  which is these two", cssValue(pageRule, "size"), "11mm 12mm");
    check("  and takes no margin, so the label's own margins mean something", cssValue(pageRule, "margin"), "0");
    check("no page box is the whole document's", /@page\s*\{/.test(bare(css)), false);
    const OPEN = ":root:has(dialog[open] .label-page)";
    check("the root takes the label's page while a dialog holding label pages is open", cssValue(cssRule(print, `${OPEN},\n    ${OPEN} body`), "page"), "tool-label");
    check("  and nowhere outside that", (bare(css).match(/\bpage\s*:\s*tool-label/g) || []).length, 1);
    check(
        "everything that neither holds the dialog nor is in it is not drawn",
        cssValue(
            cssRule(print, `${OPEN} body *:not(:has(dialog[open] .label-page), dialog[open]:has(.label-page), dialog[open]:has(.label-page) *)`),
            "display"
        ),
        "none"
    );
    check("  and what holds it draws no box of its own", cssValue(cssRule(print, `${OPEN} body :has(dialog[open] .label-page)`), "display"), "contents");
    const dialogRule = cssRule(print, "dialog[open]:has(.label-page)");
    check(
        "the dialog is placed at the first page's corner, with no room, edge or limit of its own",
        ["position", "inset", "margin", "padding", "border", "max-height", "overflow"].map((p) => cssValue(dialogRule, p)).join(" | "),
        "absolute | 0 auto auto 0 | 0 | 0 | 0 | none | visible"
    );
    check("  its backdrop is not drawn", cssValue(cssRule(print, "dialog[open]:has(.label-page)::backdrop"), "display"), "none");
    check("  nor any part of it holding no label page", cssValue(cssRule(print, "dialog[open]:has(.label-page) > :not(:has(.label-page))"), "display"), "none");
    const paneRule = cssRule(print, "dialog[open]:has(.label-page) > :has(.label-page)");
    check(
        "  and the pane neither scrolls, clips nor keeps its room",
        ["overflow", "height", "max-height", "padding"].map((p) => cssValue(paneRule, p)).join(" | "),
        "visible | auto | none | 0"
    );
    check("every label after the first starts a page of its own", cssValue(cssRule(print, ".label-item + .label-item"), "break-before"), "page");
    // THE SCREEN DRAWS A PAGE LARGER AND THE PRINT AT ITS OWN SIZE, by one property the
    // dialog sets (section 6f): zoomed by it on screen, and by 1 at print.
    check("the label's page is zoomed by the dialog's scale on screen", cssValue(cssRule(css, ".label-page"), "zoom"), "var(--label-preview-scale, 1)");
    check("  and printed at its own size", cssValue(cssRule(print, ".label-page"), "zoom"), "1");
    // NO OTHER PHYSICAL DIMENSION MAY BE WRITTEN HERE. Every millimeter on the label is an
    // inline style computed from `lib/toolLabelPage.js`, and the code's points one
    // computed from its floor (#431); one in the stylesheet is the figure that would not
    // move when they do. The page box is the one place the language forces a literal.
    const withoutPage = bare(css).replace(/@page tool-label\s*\{[^}]*\}/, "");
    const physical = withoutPage.match(/\d+(?:\.\d+)?(?:mm|pt)\b/g) || [];
    check(`no millimeter or point outside the page box${physical.length ? ` (${physical.join(", ")})` : ""}`, physical.length, 0);
    // ANTI-VACUITY: the same matcher finds the page box's own two figures, so the zero
    // above is a fact about the rest of the file rather than about a matcher that finds
    // nothing; and the rule reader is seen failing on a stylesheet with a page box for
    // the whole document and a print block that hides nothing.
    check("  and the same matcher finds the page box's two", (bare(css).match(/\d+(?:\.\d+)?(?:mm|pt)\b/g) || []).join(" "), "11mm 12mm");
    const plantedCss = "@page { size: 11mm 12mm; margin: 0; }\n@media print { .label-page { zoom: 2; } }\n";
    check(
        "  a page box for the whole document and a print that hides nothing are seen",
        [/@page\s*\{/.test(bare(plantedCss)), cssRule(mediaBlock(plantedCss, "print"), `${OPEN} body :has(dialog[open] .label-page)`), cssValue(cssRule(mediaBlock(plantedCss, "print"), ".label-page"), "zoom")].join(" | "),
        "true |  | 2"
    );

    // ── 5b: nothing but a label stands in the pane ──────────────────────────
    log("");
    log("the pane holds label pages and nothing else:");
    // THE BUG THIS DESCENDS FROM SHIPPED AND WAS REPORTED FROM A REAL PRINT (#353): the
    // print rule hid the picker and not the page's heading, which printed above the first
    // sheet and pushed every one down by a page. A label is exactly one page since #467
    // against a page box with no margin, so anything printed beside a label is a page of
    // its own. The stylesheet prints every part of the dialog holding a label page — the
    // pane, its list, each item and its frame — so the guard is the pane's own tree: the
    // list holds items, each item one frame, each frame one label page, and no text.
    const component = parseFile(COMPONENT_SOURCE);
    const componentAst = component.ast;
    const paneTree = (ast) => {
        const list = elementWithClass(ast, "label-list");
        if (!list) return "no list";
        const elementsIn = (element) => {
            const out = [];
            for (const child of element.children ?? []) {
                if (child.type === "JSXElement") out.push(child);
                if (child.type === "JSXText" && child.value.trim()) out.push({ text: child.value.trim() });
                if (child.type === "JSXExpressionContainer") {
                    walk(child.expression, (n) => {
                        if (n.type === "JSXElement" && !out.includes(n) && !out.some((o) => o.start <= n.start && n.end <= o.end)) out.push(n);
                    });
                    if (child.expression.type !== "JSXEmptyExpression" && !/JSX|CallExpression/.test(child.expression.type))
                        out.push({ text: readName(child.expression) });
                }
            }
            return out;
        };
        const name = (element) =>
            element.text !== undefined ? `text ${element.text}` : classTokens(element).find((t) => t.startsWith("label-")) ?? element.openingElement.name.name;
        const items = elementsIn(list);
        const frames = items.flatMap((item) => (item.text !== undefined ? [] : elementsIn(item)));
        const pages = frames.flatMap((frame) => (frame.text !== undefined ? [] : elementsIn(frame)));
        return [items, frames, pages].map((level) => level.map(name).join(" + ")).join(" > ");
    };
    check("a list of items, each holding one frame holding one label page", paneTree(componentAst), "label-item > label-frame > LabelPage");
    // ANTI-VACUITY: an item carrying a caption beside its frame — the shape 1i drew for a
    // label too large to print until Design took it out — is seen carrying it.
    check(
        "  an item with a caption beside its frame is seen",
        paneTree(
            parseSource(
                'const a = <ul className="label-list">{pages.map((label) => (<li className="label-item"><div className="label-frame"><LabelPage label={label} /></div><span>{COPY.tooLarge}</span></li>))}</ul>;\n',
                "<planted-caption>"
            ).ast
        ),
        "label-item > label-frame + span > LabelPage + text COPY.tooLarge"
    );

    // ── 6: the symbol is sized by its SIDE and never by its symbol proper ───
    log("");
    log("the quiet zone survives the layout:");
    // #351's contract is that the SVG's box is `QR_SIDE_MODULES` across. The mutant
    // is passing `QR_SYMBOL_MODULES` instead, which crops the four modules of margin
    // and renders a symbol a camera has to separate from the ink beside it. Read off
    // the AST rather than the text, so a comment naming the wrong constant is not a
    // violation. The run carries the figure from the read, since #457.
    const identifiers = (ast) => {
        const names = [];
        walk(ast, (n) => {
            if (n.type === "Identifier") names.push(n.name);
        });
        return names;
    };
    const actionNames = identifiers(action.ast);
    assert("the labels' read hands on QR_SIDE_MODULES", actionNames.includes("QR_SIDE_MODULES"));
    check("  and names QR_SYMBOL_MODULES nowhere", actionNames.filter((name) => name === "QR_SYMBOL_MODULES").length, 0);
    const componentNames = identifiers(componentAst);
    check(
        "the dialog names neither, taking the count with the run",
        componentNames.filter((name) => name === "QR_SIDE_MODULES" || name === "QR_SYMBOL_MODULES").length,
        0
    );
    // ANTI-VACUITY: the walker is seen finding something in those files, so the two
    // zeros above are facts about the source rather than about a failed parse.
    assert("  the walker really reads those files", componentNames.includes("describeLabelRun") && actionNames.includes("buildToolItemLabel"));

    // ── 6b: what the sticker actually prints (#411, #431) ───────────────────
    log("");
    log("the label prints the code and the symbol, and nothing else:");
    // READ OFF THE AST BECAUSE NO VALUE CHECK CAN TELL THE FIELDS APART. They are on
    // the same object and all strings, so `label.toolItemId` in place of
    // `label.labelCode` renders a longer sticker and passes every figure in this
    // file — including the width budget above, which is computed from a constant
    // rather than from what the component reads. The mutation was run in #411: with
    // the member expression swapped, this file passed before this section existed.
    //
    // AND SINCE #431 THE WHOLE LABEL IS ASSERTED, NOT ONE ELEMENT OF IT. The tool's
    // name printed under the code until the design dropped it, and it would come back
    // as one more expression on the label passing every sum here, because the height
    // budget counts the code alone. **The tool's name is the line under the dialog's
    // title since #457**, the opening page's — a screen naming the run's tool, where the
    // label screen's picker named each tool item by its tool.
    const labelElement = elementWithClass(componentAst, "label-page");
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
    check("the label prints one value, the code the run carries", printedIn(labelElement).join(" | "), "label.labelCode");
    const innerHtml = elementWithClass(componentAst, "label-symbol")
        ?.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "dangerouslySetInnerHTML")
        ?.value?.expression?.properties?.find((p) => p.key?.name === "__html")?.value;
    check("  and draws one symbol, the run's", innerHtml ? readName(innerHtml) : null, "label.svg");
    let subtitle = "none";
    walk(componentAst, (n) => {
        if (n.type === "JSXOpeningElement" && n.name?.name === "DialogFrame")
            subtitle = readName(n.attributes.find((a) => a.name?.name === "subtitle")?.value?.expression ?? {});
    });
    check("the tool is named under the dialog's title", subtitle, "toolName");
    const toolNameReads = [];
    walk(componentAst, (n) => {
        if (n.type === "Identifier" && n.name === "toolName") toolNameReads.push(n);
        if (n.type === "MemberExpression" && readName(n) === "label.toolName") toolNameReads.push(n);
    });
    check("  and nowhere on the label", toolNameReads.filter((n) => n.start >= labelElement.start && n.end <= labelElement.end).length, 0);
    // The code is built where the label is, through the one function that owns the form.
    const labelBuilder = resolveFunction(parseFile(QR_SOURCE).ast, "buildToolItemLabel");
    check("the label's code is built through labelCodeFor", callsTo(labelBuilder, "labelCodeFor").length, 1);
    check("  and the dialog never calls it", componentNames.filter((name) => name === "labelCodeFor").length, 0);
    // ANTI-VACUITY: the reader is shown a label carrying the name as well, so the
    // single value above is a fact about the component rather than about a walker
    // that stops at the first thing it sees.
    const plantedLabel = elementWithClass(
        parseSource(
            'const a = <div className="label-page"><div className="label-symbol" />' +
                '<svg className="label-id"><text>{label.labelCode}</text></svg><div>{toolName}</div></div>;\n',
            "<planted-label>"
        ).ast,
        "label-page"
    );
    check("  a label carrying the name is seen carrying it", printedIn(plantedLabel).join(" | "), "label.labelCode | toolName");

    // ── 6c: every physical dimension on the label comes from a name (#412) ──
    log("");
    log("no dimension is written into the component:");
    // READ OFF THE AST FOR THE SAME REASON AS 6b. Section 5 already forbids a
    // millimeter figure in the STYLESHEET, and the component's dimensions are inline
    // styles and attributes it cannot see — so `width: "11mm"` in place of the
    // constant would print the same label today and stop moving the day the stock
    // does, which is the one property this whole file exists to keep. **The code's size
    // is in points since #431**, so a point is held to the same rule as a millimeter,
    // and an em as well, which is what a baseline set from the face would be written in.
    // A figure built from names — the page as the pane draws it, the label's width times
    // the dialog's scale — is a name too; one carrying a number is pinned.
    const namedOnly = (e) =>
        e.type === "Identifier" ||
        e.type === "MemberExpression" ||
        (e.type === "BinaryExpression" && namedOnly(e.left) && namedOnly(e.right));
    const namesIn = (e) => (e.type === "BinaryExpression" ? [...namesIn(e.left), ...namesIn(e.right)] : [readName(e)]);
    const dimensions = (ast) => {
        const reads = [];
        const pinned = [];
        walk(ast, (n) => {
            if (n.type !== "TemplateLiteral") return;
            const tail = n.quasis[n.quasis.length - 1]?.value?.cooked ?? "";
            if (!/^(?:mm|pt|em)\b/.test(tail)) return;
            for (const e of n.expressions) {
                if (namedOnly(e)) reads.push(...namesIn(e));
                else pinned.push(e.type);
            }
        });
        return { reads, pinned };
    };
    const { reads: styleReads, pinned } = dimensions(componentAst);
    assert(`  ${styleReads.length} physical values are built from a name`, styleReads.length >= 9);
    check(`  and none is a literal${pinned.length ? ` (${pinned.join(", ")})` : ""}`, pinned.length, 0);
    // What the label's page, its symbol and its code need, by name, so a box placed or
    // sized from something else entirely would fail rather than merely being un-pinned.
    for (const name of [
        "LABEL_STOCK.labelWidthMm",
        "LABEL_STOCK.tapeWidthMm",
        "LABEL_PREVIEW_SCALE",
        "budget.marginXMm",
        "budget.marginYMm",
        "boxMm",
        "budget.idBaselineMm",
        "MIN_ID_FONT_PT",
    ])
        assert(`  the dialog reads ${name}`, styleReads.includes(name));
    // ANTI-VACUITY: the same reader is shown a pinned millimeter, point and em and a
    // product carrying a number, so the zero above is a fact about the component rather
    // than about a walker that finds nothing.
    check(
        "  the reader tells a pinned figure from a named one",
        dimensions(
            parseSource(
                "const s = { width: `${11}mm`, height: `${h}mm`, fontSize: `${5}pt`, y: `${0.631}em`, cols: `${w * 2}mm` };\n",
                "<planted-mm>"
            ).ast
        ).pinned.join(" | "),
        "Literal | Literal | Literal | BinaryExpression"
    );

    // ── 6d: the code prints in the face, weight and spacing it was measured in ──
    log("");
    log("the code is set in what CHARACTER_WIDTH_RATIO and its ink were measured in:");
    // THE WIDTH BUDGET IS ONE FACE'S ADVANCE AND THE HEIGHT ONE FACE'S INK, SO THE FACE
    // IS PART OF THE ARITHMETIC. A different face prints a different width and a
    // different height under figures that no longer describe it, and nothing in the
    // arithmetic can notice — they are constants. So the chain from the name to the tape
    // is asserted link by link: the module names the face, the dialog loads that face
    // through `next/font` into a custom property and defines it above the label pages,
    // and `.label-id` is set in it, at 400 and with no letter-spacing — the two a print
    // read (#467). Each is pinned by VALUE beside the figures it was measured for. The
    // labels' page loaded the face until #457.
    check("the face named beside the ratio", LABEL_CODE_TYPEFACE, "Inconsolata");
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
    const loader = faceLoader(componentAst);
    // `next/font` spells a family's spaces as underscores in its export names.
    check("the dialog loads that face and no other", loader.faces.join(", "), LABEL_CODE_TYPEFACE.replace(/ /g, "_"));
    check("  into this custom property", loader.property, "--font-label-code");
    // DEFINED ABOVE THE LABEL PAGES, or `var()` resolves to nothing and the code falls
    // back to the body's face in silence — which is the state #412 measured without
    // knowing it.
    const classesAbove = (ast) => {
        const found = [];
        const visit = (node, classes) => {
            if (!node || typeof node !== "object") return;
            if (Array.isArray(node)) return node.forEach((child) => visit(child, classes));
            let here = classes;
            if (node.type === "JSXElement") {
                here = [...classes, ...classTokens(node)];
                if (node.openingElement.name?.name === "LabelPage") found.push(...here);
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
        `  and puts ${loader.binding}.variable on an element above the label pages`,
        Boolean(loader.binding) && classesAbove(componentAst).includes(`${loader.binding}.variable`)
    );
    const idRule = cssRule(css, ".label-id");
    check("the code's rule is set in that property", cssValue(idRule, "font-family"), `var(${loader.property})`);
    check("  at the weight a print read", cssValue(idRule, "font-weight"), "400");
    check("  with no letter-spacing", cssValue(idRule, "letter-spacing"), "0");
    // ANTI-VACUITY, one per link: a file loading another face into another property
    // reads as that face; a property put BESIDE the label pages is not seen above them;
    // and a rule with no face, weight or spacing of its own reads as none of them.
    const plantedLoader = faceLoader(
        parseSource(
            'import { Roboto_Mono } from "next/font/google";\n' +
                'const f = Roboto_Mono({ subsets: ["latin"], variable: "--font-other" });\n',
            "<planted-loader>"
        ).ast
    );
    check(
        "  a file loading another face reads as that face",
        `${plantedLoader.faces.join(", ")} into ${plantedLoader.property}`,
        "Roboto_Mono into --font-other"
    );
    check(
        "  a property beside the label pages is not above them",
        classesAbove(parseSource("const a = <ul><li className={f.variable} /><li><LabelPage /></li></ul>;\n", "<planted-beside>").ast).filter((c) => c === "f.variable").length,
        0
    );
    const bareRule = cssRule(".label-id { white-space: nowrap; }", ".label-id");
    check(
        "  and a code rule with nothing of its own reads as none",
        ["font-family", "font-weight", "letter-spacing"].map((p) => String(cssValue(bareRule, p))).join(" | "),
        "null | null | null"
    );

    // ── 6e: one face, the symbol on it and the code under it by baseline (#431, #467) ──
    log("");
    log("the label is one SVG, the symbol above, and the code's ink starting under it:");
    // ONE BOX PER LABEL, AND THAT IS THE PRINT'S CLAIM RATHER THAN TIDINESS (#467). A
    // print snaps each box's corner to a whole CSS pixel, so a symbol and a code drawn as
    // boxes of their own landed 0.12 mm and 0.10 mm off the margins in the PDF Chrome and
    // Edge save; inside one SVG nothing is snapped, and its corner is the page's. No sum
    // can see that — two boxes add up to the same figures — so the page's children are
    // read off the component.
    const childClasses = (element) =>
        (element?.children ?? [])
            .filter((child) => child.type === "JSXElement")
            .map((child) => classTokens(child)[0] ?? child.openingElement.name?.name);
    check("the label's page holds one box, its face", childClasses(labelElement).join(", "), "label-face");
    const face = elementWithClass(componentAst, "label-face");
    check("  which is an SVG", face?.openingElement?.name?.name, "svg");
    // WHAT IS ON TOP IS #431's DECISION, read as the order the face holds them in.
    check("  holding the symbol and then the code", childClasses(face).join(", "), "label-symbol, label-id");
    // AND WHERE EACH IS, which is `labelBudget`'s: the symbol's corner at the two
    // margins, sized by its own box, and the code's BASELINE where the budget puts it —
    // SVG text's `y` is its baseline, so the digits' ink starts exactly where the
    // symbol's box ends, whatever ascent and descent the platform takes the face to have.
    const placement = (parsed) => {
        const symbol = elementWithClass(parsed.ast, "label-symbol");
        const code = elementWithClass(parsed.ast, "label-id");
        return [
            symbol?.openingElement?.name?.name ?? "none",
            ...["x", "y", "width", "height"].map((name) => attributeSource(parsed, symbol, name)),
            code?.openingElement?.name?.name ?? "none",
            ...["x", "y", "fontSize", "textAnchor"].map((name) => attributeSource(parsed, code, name)),
        ].join(" | ");
    };
    check(
        "  the symbol at the margins and the code on its baseline",
        placement(component),
        "svg | `${budget.marginXMm}mm` | `${budget.marginYMm}mm` | `${boxMm}mm` | `${boxMm}mm` | text | 50% | `${budget.idBaselineMm}mm` | `${MIN_ID_FONT_PT}pt` | middle"
    );
    // The baseline, by value: the margin, the symbol, the gap and the ink above it.
    check("the code's baseline from the label's top edge", round4(budget.idBaselineMm), 11.3318);
    check(
        "  which is the ink above it under the symbol's box",
        round4(budget.idBaselineMm - budget.marginYMm - budget.widestSymbolMm - LABEL_GAP_MM),
        1.113
    );
    check(
        "  and leaves the margin under the ink",
        round4(LABEL_STOCK.tapeWidthMm - (budget.idBaselineMm - 1.113 + ID_HEIGHT_MM)),
        round4(budget.marginYMm)
    );
    // ANTI-VACUITY: the two-box label #467 first drew — a symbol box and a code box beside
    // it on the page, the code set as the line box #431 used — reads as two boxes and as
    // no baseline-placed text.
    const plantedBoxes = parseSource(
        'const a = <div className="label-page">' +
            '<div className="label-symbol" style={{ width: `${boxMm}mm` }} />' +
            '<div className="label-id" style={{ fontSize: `${MIN_ID_FONT_PT}pt`, lineHeight: `${MIN_ID_FONT_PT}pt` }}>{c}</div>' +
            "</div>;\n",
        "<planted-boxes>"
    );
    check(
        "  a label drawn as two boxes reads as two",
        childClasses(elementWithClass(plantedBoxes.ast, "label-page")).join(", "),
        "label-symbol, label-id"
    );
    check(
        "  and its code as no text placed by a baseline",
        placement(plantedBoxes),
        "div | none | none | none | none | div | none | none | none | none"
    );
    // A BLOCK, so no line box puts a strut's descent under the face.
    check("the face is a block", cssValue(cssRule(css, ".label-face"), "display"), "block");

    // ── 6f: the screen draws a page larger, by one figure the stylesheet takes back (#457) ──
    log("");
    log("the pane draws each page at the design's size and the print at its own:");
    // 1i DRAWS A PAGE 22 × 24 mm, TWICE THE LABEL, and 0p says a label on screen is drawn
    // at whatever size reads in its place. The page itself is not drawn twice: the dialog
    // sets one custom property from `LABEL_PREVIEW_SCALE` and the stylesheet zooms the page
    // by it on screen and by 1 at print (section 5).
    check("the scale the pane draws a page at", LABEL_PREVIEW_SCALE, 2);
    check("  which makes the page the design's", `${LABEL_STOCK.labelWidthMm * LABEL_PREVIEW_SCALE} × ${LABEL_STOCK.tapeWidthMm * LABEL_PREVIEW_SCALE} mm`, "22 × 24 mm");
    const scaleSet = (ast) => {
        let found = "none";
        walk(ast, (n) => {
            if (n.type !== "Property" || n.key?.type !== "Literal" || n.key.value !== "--label-preview-scale") return;
            found = readName(n.value);
        });
        return found;
    };
    check("  set as the property the stylesheet zooms by", scaleSet(componentAst), "LABEL_PREVIEW_SCALE");
    check(
        "  where one set from a number is seen so",
        scaleSet(parseSource('const s = { "--label-preview-scale": 2 };\n', "<planted-scale>").ast),
        "Literal"
    );

    // ── 7: no client file may import the encoder ────────────────────────────
    log("");
    log("the encoder stays out of the browser bundle:");
    // #351's header names this and says no check can see it: the rule
    // `offline/client-import-safety.mjs` enforces is about `lib/airtable/`, and
    // `lib/toolLabelQR.js` reaches neither that nor `lib/airtableOps.js`. It imports
    // `qrcode`, so a `"use client"` file importing it ships the whole encoder. #353 put
    // the first client component beside it, which is why the assertion is here.
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
    const componentFile = clientFiles.find((file) => file.rel === COMPONENT_SOURCE);
    assert("  and the dialog is one of them", Boolean(componentFile));
    assert(
        "  importing lib/toolLabelPage.js, which the matcher can see",
        Boolean(componentFile) && componentFile.imports.some((from) => from.endsWith("toolLabelPage"))
    );

    // ── 7b: what the dialog shows, as the source decides it (#457) ──────────
    log("");
    log("the dialog shows what its run has, and says why it prints nothing where it does:");
    // 1i's three states are one arrangement, and what decides each part is a test in the
    // source — no figure moves when the steps are drawn for a run that prints nothing, or
    // when the commitment stays live with nothing to print. So each part is read with the
    // test that guards it: the steps only while something prints, the codes not found
    // only when there are some, the host's sentence only when a symbol is too large, the
    // pane's sentence in place of the pages when none prints, and the commitment disabled
    // then, saying the title's words.
    const frameFn = (ast) => resolveFunction(ast, "LabelsFrame");
    const guards = (parsed) => {
        const fn = frameFn(parsed.ast);
        const found = [];
        const copyRead = (node) => {
            const keys = [];
            walk(node, (n) => {
                if (n.type === "MemberExpression" && n.object?.name === "COPY" && !n.computed) keys.push(n.property.name);
            });
            return [...new Set(keys)].join("+") || "nothing";
        };
        walk(fn ?? {}, (n) => {
            if (n.type === "LogicalExpression" && n.operator === "&&" && /JSX/.test(n.right.type))
                found.push(`${parsed.source.slice(n.left.start, n.left.end)} -> ${copyRead(n.right)}`);
            if (n.type === "ConditionalExpression" && /JSX/.test(n.consequent.type) && /JSX/.test(n.alternate.type))
                found.push(`${parsed.source.slice(n.test.start, n.test.end)} ? ${copyRead(n.consequent)} : ${copyRead(n.alternate)}`);
        });
        return found.sort().join(" | ");
    };
    check(
        "each part stands under its own test",
        guards(component),
        "missing.length > 0 -> notFound | printing > 0 -> hintHeading+hintSteps | printing > 0 ? pages+page : noLabels | tooLarge > 0 -> symbolTooLarge"
    );
    const commitment = (parsed) => {
        let found = "none";
        walk(frameFn(parsed.ast) ?? {}, (n) => {
            if (n.type !== "JSXElement" || n.openingElement.name?.name !== "Button") return;
            const disabled = n.openingElement.attributes.find((a) => a.name?.name === "disabled")?.value?.expression;
            const said = n.children.find((c) => c.type === "JSXExpressionContainer")?.expression;
            if (!disabled || said?.type !== "ConditionalExpression") return;
            found = `disabled ${parsed.source.slice(disabled.start, disabled.end)}; ${parsed.source.slice(said.start, said.end)}`;
        });
        return found;
    };
    check(
        "  and the commitment is disabled with nothing to print, saying the title then",
        commitment(component),
        "disabled printing === 0; printing > 0 ? COPY.print({ labels: printing }) : title"
    );
    // ANTI-VACUITY: a frame drawing the steps whatever prints, and a commitment never
    // disabled, is seen doing both.
    const plantedFrame = parseSource(
        "function LabelsFrame({ title }) {\n" +
            "  return (<>\n" +
            "    {missing.length > 0 && <p>{COPY.notFound(missing.length)}</p>}\n" +
            "    {true && <p>{COPY.hintHeading}</p>}\n" +
            "    <Button onClick={print}>{COPY.print({ labels: printing })}</Button>\n" +
            "  </>);\n" +
            "}\n",
        "<planted-frame>"
    );
    check("  a frame drawing the steps whatever prints is seen so", guards(plantedFrame), "missing.length > 0 -> notFound | true -> hintHeading");
    check("  and a commitment never disabled is seen so", commitment(plantedFrame), "none");
    // AND THE PAGES ARE THE FRAME'S PREVIEW, WHICH IS WHAT DRAWS THEM AT ALL. A frame handed
    // no preview is #456's Compact build, which has no pane: the dialog would open on its
    // column alone, and the print would have no page to keep. Read as the binding the frame
    // is handed and what that binding holds, the list of pages or the pane's sentence.
    const framePreview = (parsed) => {
        let found = "no preview";
        const fn = frameFn(parsed.ast);
        walk(fn ?? {}, (n) => {
            if (n.type !== "JSXOpeningElement" || n.name?.name !== "DialogFrame") return;
            const value = n.attributes.find((a) => a.name?.name === "preview")?.value?.expression;
            if (!value) return;
            let held = "";
            walk(fn, (m) => {
                if (m.type === "VariableDeclarator" && m.id?.name === value.name && m.init)
                    held = parsed.source.slice(m.init.start, m.init.end).includes("label-list") ? ", the pages' list" : ", no pages";
            });
            found = `${readName(value)}${held}`;
        });
        return found;
    };
    check("  and the frame is handed the pages as its preview", framePreview(component), "preview, the pages' list");
    check(
        "  where a frame handed none is seen so",
        framePreview(parseSource("function LabelsFrame({ title }) { return <DialogFrame open={open} title={title}>{null}</DialogFrame>; }\n", "<planted-preview>")),
        "no preview"
    );

    // ── 7c: the press waits for the face and closes the dialog after the print (#457) ──
    log("");
    log("Print waits for the code's face, prints, and closes the dialog when the print dialog closes:");
    // THE FACE IS ASKED FOR WHEN THE DIALOG OPENS, which is when the code is first drawn —
    // later than on the labels' page, which drew it on arrival — so the press waits for
    // `document.fonts.ready` before it prints, or the fallback could print under figures
    // measured in the face (section 6d). And it closes on `afterprint`, which comes with the
    // label printed or not: 1i's tool item page draws the commitment closing the dialog.
    const pressFacts = (parsed) => {
        let found = "none";
        walk(frameFn(parsed.ast) ?? parsed.ast, (n) => {
            if (n.type !== "VariableDeclarator" || n.id?.name !== "print") return;
            const body = parsed.source.slice(n.init.start, n.init.end);
            const ready = body.indexOf("await document.fonts.ready");
            const printed = body.indexOf("window.print()");
            found = [
                ready >= 0 && printed > ready ? "waits for the face" : "does not wait",
                /addEventListener\("afterprint", onClose, \{ once: true \}\)/.test(body) ? "closes after the print" : "stays open",
            ].join(", ");
        });
        return found;
    };
    check("the press", pressFacts(component), "waits for the face, closes after the print");
    check(
        "  where one printing straight away and staying open is seen so",
        pressFacts(parseSource("function LabelsFrame() { const print = () => { window.print(); }; }\n", "<planted-press>")),
        "does not wait, stays open"
    );

    // ── 7d: the opener stays pressable while the run is read (#457) ─────────
    log("");
    log("the opener is disabled for its page's reason and for nothing else:");
    // A BUTTON DISABLED UNDER THE POINTER DROPS FOCUS TO THE PAGE, which a browser showed:
    // the opener was disabled while a tool's run was read, so the dialog opened with
    // nothing to hand focus back to, and closing it left the reader at the top of the
    // document rather than on the opener CLAUDE.md's overlay rule names. A press during
    // the read is ignored instead, and the dialog's header says so.
    const openerDisabled = (parsed) => {
        let found = "none";
        walk(parsed.ast, (n) => {
            if (n.type !== "FunctionDeclaration" || n.id?.name !== "LabelsDialog") return;
            walk(n, (m) => {
                if (m.type !== "JSXOpeningElement" || m.name?.name !== "Button") return;
                const value = m.attributes.find((a) => a.name?.name === "disabled")?.value?.expression;
                found = value ? parsed.source.slice(value.start, value.end) : "never";
            });
        });
        return found;
    };
    check("the opener is disabled by what its page hands it, alone", openerDisabled(component), "disabled");
    check(
        "  where one disabled while the read is in flight is seen so",
        openerDisabled(
            parseSource(
                "export default function LabelsDialog({ disabled }) { return <Button disabled={disabled || pending} />; }\n",
                "<planted-opener>"
            )
        ),
        "disabled || pending"
    );

    // ── 8: the words ────────────────────────────────────────────────────────
    log("");
    log("what the dialog and its openers say:");
    // NO RANGE IN ITS WORDS SINCE #443: the boxes and the count beside it show what it
    // opens the dialog on. It read `…for the tool items on this page` while it sent the page.
    check("the control on a tool, and the dialog's title there", COPY.openFromTool, "Print labels");
    // `Print label` SINCE #457, the design's, where it said `Print the label` from #352.
    check("the control on one tool item, and the dialog's title there", COPY.openFromToolItem, "Print label");
    // WHAT AN OPENER SAYS WHILE A TOOL'S PAGE READS ITS LABELS (0f Working, #495), to assistive
    // tech alone: the work being done, since the press opens the labels rather than printing.
    check("  and what either says while its page reads the labels (#495)", COPY.working, "Loading…");
    check(
        "  busy for that read and not disabled, saying that word",
        [
            /busy=\{pending\}/.test(parseFile(COMPONENT_SOURCE).source),
            /busyLabel=\{COPY\.working\}/.test(parseFile(COMPONENT_SOURCE).source),
            !/disabled=\{[^}]*pending/.test(parseFile(COMPONENT_SOURCE).source),
        ].join(" "),
        "true true true"
    );
    // IT MAY NOT SAY `REPRINT`, which is what it said until #352 was read on screen:
    // nothing in this base records whether a sticker was ever printed, so a control
    // promising a re-print states what the app cannot check.
    check(
        "  and no opener claims a re-print",
        [COPY.openFromTool, COPY.openFromToolItem].filter((s) => /reprint/i.test(s)).length,
        0
    );
    check("the pages' list", COPY.pages, "Pages");
    check("  and one page in it", COPY.page({ page: 1, code: "260909-001" }), "Page 1, 260909-001");
    check("the pane when nothing prints", COPY.noLabels, "No labels to print.");
    // `of` ONLY WHEN THE TWO DIFFER, and the noun follows the larger figure.
    check("a run that prints whole", COPY.count({ printing: 5, named: 5 }), "5 labels");
    check("  one label", COPY.count({ printing: 1, named: 1 }), "1 label");
    check("  a run that does not", COPY.count({ printing: 3, named: 5 }), "3 of 5 labels");
    check("  one of two", COPY.count({ printing: 1, named: 2 }), "1 of 2 labels");
    check("  and none of one", COPY.count({ printing: 0, named: 1 }), "0 of 1 label");
    // THE DOT BETWEEN THE COUNT AND THE SIZE IS `Dot` SINCE #495, whose room either side is a
    // space the text holds: drawn with padding round a mark nobody reads, the two clauses
    // copied and were read as `1 label11 × 12 mm`. Read off the dialog's sentence, beside a
    // planted one padding a mark of its own; the copy holds no mark any more.
    const sentenceParts = (ast) => {
        const out = [];
        walk(ast, (n) => {
            if (n.type !== "JSXElement" || n.openingElement.name?.name !== "DialogMessage") return;
            for (const child of n.children) {
                if (child.type === "JSXElement") out.push(child.openingElement.name.name);
                else if (child.type === "JSXExpressionContainer" && child.expression.type !== "JSXEmptyExpression") out.push("{}");
            }
        });
        return out.join(" ");
    };
    check("the dialog's sentence parts the count and the size with Dot", sentenceParts(parseFile(COMPONENT_SOURCE).ast), "{} Dot span");
    check(
        "  where a padded mark reads otherwise",
        sentenceParts(parseSource('const a = <DialogMessage>{x}<span aria-hidden="true" className="px-separator-inline">·</span><span>{y}</span></DialogMessage>;', "<planted-dot>").ast),
        "{} span span"
    );
    check("  and the copy holds no mark of its own", "between" in COPY, false);
    // THE PRINT'S SIZE IN TEXT, BUILT FROM THE STOCK — read off the AST, beside a planted
    // literal — and pinned by value so the composition is held rather than merely
    // performed. It replaced `Stock: 12 mm tape` (#457).
    check("the size a label prints at", COPY.size, "11 × 12 mm");
    const sizeBuilt = (parsed) => {
        let found = "none";
        walk(parsed.ast, (n) => {
            if (n.type === "Property" && n.key?.name === "size")
                found = n.value.type === "TemplateLiteral" ? n.value.expressions.map(readName).join(", ") : n.value.type;
        });
        return found;
    };
    check("  built from the cut and the tape", sizeBuilt(parseFile(MODULE_SOURCE)), "LABEL_STOCK.labelWidthMm, LABEL_STOCK.tapeWidthMm");
    check("  where a typed size reads as typed", sizeBuilt(parseSource('const C = { size: "11 × 12 mm" };\n', "<planted-size>")), "Literal");
    check("one code not found", COPY.notFound(1), "1 code not found");
    check("  and several", COPY.notFound(3), "3 codes not found");
    // A SYMBOL PAST THE LABEL NAMES THE HOST AND PRESCRIBES NOTHING (#453). With no
    // version of headroom a Vercel domain reaches this, and there a larger stock is the
    // wrong answer: the right one is printing from the host a label should carry,
    // which no sentence on the screen gives since #454 took the warning off. It names
    // no tool item since #457, the count above it saying how many do not print.
    check(
        "a symbol past the label",
        COPY.symbolTooLarge(1),
        "The address from this host is long enough that this symbol does not fit the label stock, so its label does not print."
    );
    check(
        "  and several",
        COPY.symbolTooLarge(4),
        "The address from this host is long enough that these symbols do not fit the label stock, so their labels do not print."
    );
    check(
        "  with no remedy in it that a wrong host would misread",
        [COPY.symbolTooLarge(1), COPY.symbolTooLarge(2)].filter((s) => /larger stock|fixes it/i.test(s)).length,
        0
    );
    check("what to do in the print dialog", `${COPY.hintHeading}: ${COPY.hintSteps.join(" ")}`, "In the print dialog: Choose your label printer. Keep scale at 100%.");
    check("the way out", COPY.cancel, "Cancel");
    check("the commitment, carrying its count", COPY.print({ labels: 5 }), "Print 5 labels");
    check("  one label", COPY.print({ labels: 1 }), "Print 1 label");
    // WHAT WENT WITH THE SCREEN (#457), and with the sheet (#467), and with the host line
    // (#454). Their keys are what a later pass would reach for to put each back, so the
    // absence is held, beside the same question finding a word that is there.
    check(
        "no word is left for the screen, its include, its stock line or its address",
        ["heading", "noneRequested", "noneFound", "selectionHeading", "include", "nothingSelected", "labelCount", "stock", "overCap", "missing", "openFromRegistration"]
            .filter((key) => key in COPY)
            .join(", "),
        ""
    );
    check(
        "  nor for a start position, a sheet count, the host or its warning",
        ["startLabel", "startHint", "sheetCount", "hostLabel", "hostWarningTitle", "hostWarning"].filter((key) => key in COPY).join(", "),
        ""
    );
    check("  nor for a label too large, which 1i draws no more", ["tooLarge", "doesNotPrint"].filter((key) => key in COPY).join(", "), "");
    assert("  and the same question finds a word that is there", "count" in COPY && "notFound" in COPY);
    // THE DESIGN'S NOUN SINCE #455: a `Tool Items` row is a `tool` in a sentence, so no
    // string here says `tool item`. Builders called, so a sentence a builder makes is
    // held as well as a plain string; and since #467 none of them names a sheet.
    const strings = [
        ...Object.values(COPY).filter((value) => typeof value === "string"),
        ...COPY.hintSteps,
        COPY.page({ page: 2, code: "260909-002" }),
        COPY.count({ printing: 3, named: 5 }),
        COPY.notFound(2),
        COPY.symbolTooLarge(1),
        COPY.symbolTooLarge(2),
        COPY.print({ labels: 3 }),
    ];
    const oldNoun = strings.filter((text) => /\btool items?\b/i.test(text));
    check(`no string says \`tool item\`${oldNoun.length ? ` (${oldNoun.join(" | ")})` : ""}`, oldNoun.length, 0);
    assert("  and the matcher would see one", /\btool items?\b/i.test("140 tool items were named"));
    const sheetWord = strings.filter((text) => /\bsheets?\b/i.test(text));
    check(`no string names a sheet${sheetWord.length ? ` (${sheetWord.join(" | ")})` : ""}`, sheetWord.length, 0);
    assert("  and that matcher would see one", /\bsheets?\b/i.test("34 labels across 2 sheets."));

    // ── 9: the host reaches the symbols and nothing else (#454) ────────────
    log("");
    log("the host the labels' read takes goes into the symbols and is shown nowhere:");
    // THE READ STILL TAKES THE HOST, BECAUSE A SYMBOL ENCODES IT — the labels' page did
    // until #457. From #353 that page also handed the origin to the sheet component, which
    // printed it above the warning, and #454 took both off. So what is held is where the
    // reading goes: the host header is read once, the host only to build the origin, the
    // origin inside the label builder's argument and nowhere else, and the dialog names
    // neither. Off the AST, because the origin in a symbol and the origin in a sentence
    // are one string, and no value check can tell where a file put it. The tool item
    // page's own reading is `offline/tool-item-view.mjs`'s.
    //
    // WHAT IT CANNOT SEE is a host reaching the screen by a path those names do not
    // take — the builder's own `url` carries it too, and a dialog printing that would
    // pass. It follows the reading the read makes, not every string the host is in.
    /** Reads of a binding: a declaration, a property's key and a member's name are not. */
    const readsOf = (ast, name) => {
        const notReads = new Set();
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator") notReads.add(n.id);
            if (n.type === "Property" && !n.computed) notReads.add(n.key);
            if (n.type === "MemberExpression" && !n.computed) notReads.add(n.property);
        });
        const reads = [];
        walk(ast, (n) => {
            if (n.type === "Identifier" && n.name === name && !notReads.has(n)) reads.push(n);
        });
        return reads;
    };
    /** Where a file's origin and host are read: into what they build, or elsewhere. */
    const hostFlow = (ast) => {
        let originInit = null;
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id.type === "Identifier" && n.id.name === "origin")
                originInit = n.init;
        });
        const within = (node) => Boolean(originInit) && node.start >= originInit.start && node.end <= originInit.end;
        const origin = readsOf(ast, "origin");
        const host = readsOf(ast, "host");
        return {
            headerReads: callsTo(ast, "get").filter((call) => call.arguments[0]?.value === "host").length,
            originIntoSymbols: origin.filter((n) => insideCallTo(ast, n, "buildToolItemLabel")).length,
            originElsewhere: origin.filter((n) => !insideCallTo(ast, n, "buildToolItemLabel")).length,
            hostIntoOrigin: host.filter(within).length,
            hostElsewhere: host.filter((n) => !within(n)).length,
        };
    };
    const flow = hostFlow(action.ast);
    check("the read takes the host header once", flow.headerReads, 1);
    assert(`  its origin goes into the labels (${flow.originIntoSymbols})`, flow.originIntoSymbols >= 1);
    check("  and is read nowhere else", flow.originElsewhere, 0);
    assert(`  the host is read to build it (${flow.hostIntoOrigin})`, flow.hostIntoOrigin >= 1);
    check("  and for nothing else", flow.hostElsewhere, 0);
    check(
        "the dialog names neither",
        componentNames.filter((name) => name === "origin" || name === "host").length,
        0
    );
    // ANTI-VACUITY: a read taking the header a second time, handing its origin back with
    // the run and returning its host is seen doing all three, beside the reads that are
    // allowed — so the figures above are facts about the read rather than about a reader
    // that finds nothing, and the shorthand the builder is handed counts once. A dialog
    // taking the origin is seen naming it.
    const plantedFlow = hostFlow(
        parseSource(
            'const host = headerList.get("host");\n' +
                'const shown = headerList.get("host");\n' +
                "const origin = `http://${host}`;\n" +
                "const label = buildToolItemLabel({ origin, toolItemId });\n" +
                "const run = { labels: [label], origin, host };\n",
            "<planted-host-shown>"
        ).ast
    );
    check(
        "  a read handing the host on is seen handing it on",
        `${plantedFlow.headerReads} header reads; ` +
            `${plantedFlow.originIntoSymbols} into the labels, ${plantedFlow.originElsewhere} elsewhere; ` +
            `${plantedFlow.hostIntoOrigin} into the origin, ${plantedFlow.hostElsewhere} elsewhere`,
        "2 header reads; 1 into the labels, 1 elsewhere; 1 into the origin, 1 elsewhere"
    );
    const plantedComponentNames = [];
    walk(
        parseSource("function LabelsFrame({ run, origin }) { return <p>{origin}</p>; }\n", "<planted-component>").ast,
        (n) => {
            if (n.type === "Identifier") plantedComponentNames.push(n.name);
        }
    );
    assert("  and a dialog taking the origin is seen naming it", plantedComponentNames.includes("origin"));
}

function round4(value) {
    return Math.round(value * 10000) / 10000;
}

if (isMain(import.meta.url)) standalone(title, run);
