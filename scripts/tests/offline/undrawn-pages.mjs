// A screen the design has not drawn yet stands in one box, and only leaves it (#258).
//
// Until #258 each screen above the assets axis declared its own width container inside its
// own page — twenty pages, twenty-four declarations — and six branches a centered refusal
// box of their own. That issue moved them into `app/components/UndrawnPage.js`, under the
// kind of screen each frames, so that the root layout's rail could hold every screen in one
// column. FOUR CLAIMS.
//   1. THE MEASURES ARE THE ONES THE PAGES HELD, BY LITERAL. Each kind's classes are typed
//      below as the pages wrote them, so a measure is not moved by an edit to the component
//      alone: nothing about these screens was designed, and a box restyled here would be a
//      screen restyled with no design to answer to.
//   2. THE PAGES STANDING IN IT ARE A LIST THAT ONLY SHRINKS. Every file calling it is typed
//      below with the kinds it names, so a page added to it fails, a page that stops calling
//      it — because its design arrived — fails until its line goes, and a call naming a kind
//      the component does not hold fails. When the list is empty the component goes.
//   3. NO OTHER FILE SPELLS A CENTERED MEASURE: `mx-auto` beside one of Tailwind's width steps
//      in one string, anywhere under `app/` and `lib/`. A screen the design draws takes its
//      measure from the design's names — `max-w-content` is no step — and a page holds no
//      width of its own (`app/layout.js`). The assets layout said a file-only check could not
//      hold that, since it cannot tell a page's container from an image's `max-w-full`; a
//      width step beside `mx-auto` is one it can tell.
//   4. THE MARK IS ONE STRING IN TWO PLACES. The box carries `data-undrawn-page`, and the rail's
//      column reads it to keep its focus rule (#519) off these screens; a rename on one side
//      would put a form's every removed row back to scrolling it to its top.
//
// WHAT IT CANNOT SEE: whether a box renders at the width it names, whether the column leaves
// focus where the browser puts it — a browser's, and the pull request says what it measured —
// and a class assembled at runtime.
//
// TAILWIND READS THIS FILE FOR CLASS NAMES, so the classes below are assembled while it runs
// (`offline/design-values.mjs` has why); each is one the app already uses.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A screen the design has not drawn stands in one box, and only leaves it (#258)";

const BOX = "app/components/UndrawnPage.js";
const RAIL = "app/components/Rail.js";
const MARK = "data-undrawn-page";

const cls = (...parts) => parts.join("");
const CENTERED = cls("mx", "-auto");
const W = (step) => cls("max-", "w-", step);
const PAD = cls("p-", "8");

/** Each kind's classes, as the pages wrote them. `invoice-entry` adds the file pane's width. */
const MEASURES = {
    form: [CENTERED, "w-full", W("sm"), PAD].join(" "),
    document: [CENTERED, "w-full", W("2xl"), PAD].join(" "),
    "invoice-entry": [CENTERED, "w-full", W("2xl"), PAD, "${PAGE_WIDE}"].join(" "),
    delivery: [CENTERED, "w-full", W("3xl"), PAD].join(" "),
    list: [CENTERED, "w-full", W("4xl"), PAD].join(" "),
    notice: ["flex", cls("min-", "h-full"), "flex-1", "items-center", "justify-center", PAD].join(" "),
};

/** Every page standing in the box, and the kinds it names in source order. */
const UNDRAWN_PAGES = {
    "app/addresses/new/page.js": ["form"],
    "app/admin/categories/new/page.js": ["notice", "form"],
    "app/admin/disciplines/new/page.js": ["notice", "form"],
    "app/admin/jobs/new/page.js": ["notice", "form"],
    "app/admin/vendors/new/page.js": ["notice", "form"],
    "app/deliveries/[deliveryId]/edit/page.js": ["delivery", "delivery"],
    "app/deliveries/[deliveryId]/page.js": ["delivery", "delivery"],
    "app/deliveries/new/page.js": ["delivery", "delivery"],
    "app/deliveries/page.js": ["list"],
    "app/invoices/[invoiceId]/edit/page.js": ["notice", "document"],
    "app/invoices/[invoiceId]/page.js": ["document"],
    "app/invoices/new/page.js": ["notice", "invoice-entry"],
    "app/invoices/page.js": ["list"],
    "app/materials/[materialId]/page.js": ["list", "list"],
    "app/materials/page.js": ["list"],
    "app/pos/[poId]/page.js": ["document"],
    "app/pos/page.js": ["list"],
    "app/prs/[prId]/page.js": ["document"],
    "app/prs/new/page.js": ["document"],
    "app/prs/page.js": ["list"],
};

/** One of Tailwind's width steps, a variant's included: not a design name, `full` or `none`. */
const WIDTH_STEP = /^(?:[\w-]+:)*max-w-(?:xs|sm|md|lg|xl|[2-7]xl|screen-[\w-]+|\[[^\]]+\])$/;

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

/** The JSX name an element is opened with. */
const jsxName = (n) => n.openingElement?.name?.name ?? null;

/** Every string a module holds — a literal, or a template's text with its holes as spaces. */
function stringsOf(ast) {
    const out = [];
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") out.push(n.value);
        if (n.type === "TemplateLiteral") out.push(n.quasis.map((q) => q.value.cooked).join(" "));
    });
    return out;
}

/** Whether one string spells a centered measure: `mx-auto` and a width step among its tokens. */
const spellsMeasure = (s) => {
    const tokens = s.split(/\s+/);
    return tokens.includes(CENTERED) && tokens.some((t) => WIDTH_STEP.test(t));
};

/** The measures the box holds, by kind, each value as its source spells it. */
function measuresOf(ast) {
    const out = {};
    walk(ast, (n) => {
        if (n.type !== "VariableDeclarator" || n.id?.name !== "MEASURES" || n.init?.type !== "ObjectExpression") return;
        for (const p of n.init.properties) {
            const key = p.key.name ?? p.key.value;
            const v = p.value;
            if (v.type === "Literal") out[key] = v.value;
            else if (v.type === "TemplateLiteral")
                out[key] = v.quasis.map((q, i) => q.value.cooked + (v.expressions[i] ? "${" + v.expressions[i].name + "}" : "")).join("");
            else out[key] = `<${v.type}>`;
        }
    });
    return out;
}

/** Each call of the box in a module: the kind it names, or what stands in its place. */
function callsOf(ast, local) {
    const out = [];
    walk(ast, (n) => {
        if (n.type !== "JSXElement" || jsxName(n) !== local) return;
        const attr = n.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "measure");
        out.push(attr?.value?.type === "Literal" ? attr.value.value : `<${attr?.value?.type ?? "no measure"}>`);
    });
    return out;
}

/** The name a module imports the box under, or null. */
function boxImportOf(ast) {
    let local = null;
    walk(ast, (n) => {
        if (n.type === "ImportDeclaration" && /(^|\/)UndrawnPage(\.js)?$/.test(String(n.source.value))) {
            local = n.specifiers.find((s) => s.type === "ImportDefaultSpecifier")?.local.name ?? "?";
        }
    });
    return local;
}

export async function run({ check, assert, log }) {
    const files = ["app", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map(repoRelative);

    // ── anti-vacuity first ───────────────────────────────────────────────────
    log("the walk reaches the tree and every detector can say yes:");
    assert(`  walked ${files.length} modules under app and lib`, files.length > 150);
    assert(`  ${BOX} is in the walk`, files.includes(BOX));
    assert("  a planted centered measure is found", spellsMeasure(`${CENTERED} w-full ${W("5xl")} px-4`));
    assert("  and one at an arbitrary width", spellsMeasure(`${CENTERED} ${W("[60rem]")}`));
    assert("  and one behind a variant", spellsMeasure(`${CENTERED} ${cls("lg:", W("3xl"))}`));
    assert("  but not the design's measure", !spellsMeasure(`${CENTERED} box-content ${W("content")} px-page-gutter`));
    assert("  nor an image's", !spellsMeasure(`${CENTERED} ${W("full")}`));
    assert("  nor a width with nothing centering it", !spellsMeasure(`w-full ${W("4xl")}`));
    const planted = parseSource(
        `import Box from "@/app/components/UndrawnPage";\nexport default () => <Box measure="list"><Box measure={x} /></Box>;`,
        "<planted>"
    ).ast;
    check("  a planted page's calls are read, a kind that is not a literal marked", callsOf(planted, boxImportOf(planted)).join(" "), "list <JSXExpressionContainer>");

    // ── 1: the measures, by literal ──────────────────────────────────────────
    log("");
    log("the box's measures are the ones the pages held:");
    const boxAst = parseFile(BOX).ast;
    const held = measuresOf(boxAst);
    check("  the kinds", Object.keys(held).join(" "), Object.keys(MEASURES).join(" "));
    for (const [kind, classes] of Object.entries(MEASURES)) check(`  ${kind}`, held[kind], classes);

    // ── 2: the pages, a list that only shrinks ───────────────────────────────
    log("");
    log("the pages standing in it are the list, each naming the kinds it did:");
    const callers = {};
    for (const rel of files) {
        if (rel === BOX) continue;
        const ast = parseFile(rel).ast;
        const local = boxImportOf(ast);
        if (local) callers[rel] = callsOf(ast, local);
    }
    check("  the pages", Object.keys(callers).sort().join(" "), Object.keys(UNDRAWN_PAGES).sort().join(" "));
    for (const [rel, kinds] of Object.entries(UNDRAWN_PAGES)) check(`  ${rel}`, (callers[rel] ?? []).join(" "), kinds.join(" "));
    const unknown = Object.entries(callers).flatMap(([rel, kinds]) => kinds.filter((k) => !(k in held)).map((k) => `${rel} names ${k}`));
    check("  every kind named is one the box holds", unknown.join(", "), "");
    log(`  ${Object.keys(callers).length} pages, ${Object.values(callers).flat().length} boxes`);

    // ── 3: no other file spells a centered measure ───────────────────────────
    log("");
    log("no file but the box spells a centered measure:");
    const spellers = files.filter((rel) => rel !== BOX && stringsOf(parseFile(rel).ast).some(spellsMeasure));
    check("  files spelling one", spellers.join(", "), "");
    assert("  and the box itself is seen to spell its own", stringsOf(boxAst).some(spellsMeasure));

    // ── 4: the mark ──────────────────────────────────────────────────────────
    log("");
    log("the box's mark is the one the rail's column reads:");
    let marked = false;
    walk(boxAst, (n) => {
        if (n.type === "JSXAttribute" && n.name?.name === MARK) marked = true;
    });
    assert(`  the box sets ${MARK}`, marked);
    const railReads = [];
    walk(parseFile(RAIL).ast, (n) => {
        if (n.type === "CallExpression" && n.callee?.property?.name === "closest" && n.arguments[0]?.type === "Literal") railReads.push(n.arguments[0].value);
    });
    check("  the column asks for it by that name", railReads.join(" "), `[${MARK}]`);
}

if (isMain(import.meta.url)) standalone(title, run);
