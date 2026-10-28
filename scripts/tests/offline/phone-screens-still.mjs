// The phone screens hold still while they scroll, load and type (#568).
//
// WHY THIS IS A CHECK. Five things a phone does and a desk browser's phone mode never shows
// moved the screens of the design's two axes: a scroll meeting the page's end bounced the
// foot bar with it, the bars showing and hiding left the sign-in steps at the screen's
// height with the bars shown, Safari zoomed the page to any field set smaller than 16, a
// keyboard that covers the page covered the sheets, and a face arriving late moved every
// line drawn in its fallback. This tier never opens a page, so it holds the code each one
// turns on, which is the part a change could quietly undo:
//
//   1. THE ROOT STOPS ITS BOUNCE ONLY WHILE THE FOOT BAR IS DRAWN. `BottomBar.js` carries
//      the one rule that sets `overscroll-behavior` on the page's root, and Tailwind reads it
//      as `:root:has(<the bar>)` below the phone's edge. `none` also stops pull-to-refresh in
//      Chrome on Android, so no other class, and nothing in the app's stylesheets, may set it
//      on the root: a screen drawing no bar keeps `auto`.
//   2. A PHONE'S SCREEN IS THE DYNAMIC VIEWPORT. Both phone frames take their least height
//      from `dvh`, and nothing the axes reach sizes a length in `vh`, `svh` or `lvh`.
//   3. A FIELD TAKES 16 UNDER A FINGER. Every field a press can type into, found in the files
//      the axes reach, gets its type from a class string that also sets
//      `pointer-coarse:text-mobile-body`, or that sets nothing under 16 — and Tailwind sorts
//      the touch size after every size beside it, so it is the one that holds.
//   4. A KEYBOARD THAT COVERS THE PAGE LIFTS THE BAR AND THE SHEET ALIKE, and only while
//      something takes typing on a page nobody has zoomed: `keyboardViewport.js`'s
//      judgments by value, and both readers taking them through one hook. A sheet's height
//      takes the keyboard off the screen it reads as it opens (#579), which
//      `offline/sheet-still.mjs` holds.
//   5. NO FACE IS SWAPPED IN LATE. Every `next/font` call in `app/faces/` is `optional`.
//
// WHAT IT CANNOT SEE. Whether a phone honors any of it: that WebKit stops its root's bounce
// for `none`, that a keyboard's cover reaches `visualViewport`, that an optional face is used
// when it arrives in time — `docs/notes/design-system.md` has the sources, and a real phone
// is where each is seen. A class assembled at runtime and a dynamic `import()` are outside
// it, as for every check that walks the graph.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { keyboardCover, takesTyping } from "../../../app/components/keyboardViewport.js";
import { listJsFiles, parseFile, parseSource, parentMap, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";
import { importedPairs } from "./unread-exports.mjs";

export const title = "The phone screens hold still while they scroll, load and type (#568)";

const AXES = ["app/(assets)/", "app/login/"];
const BOTTOM_BAR = "app/components/BottomBar.js";
const ROOT_RULE = "max-sm:[:root:has(&)]:overscroll-y-none";
const TOUCH_SIZE = "pointer-coarse:text-mobile-body";
const PHONE_SCREEN = "max-sm:min-h-dvh";
const PHONE_FRAMES = ["app/components/Rail.js", "app/login/layout.js"];
const STYLESHEETS = ["app/globals.css", "app/designValues.css"];
const ROUTE_FILE = /^app\/(.*\/)?(page|layout)\.js$/;
// The input types no keyboard types into.
const NOT_TYPED = new Set(["hidden", "checkbox", "radio", "submit", "button", "reset", "file", "image", "range", "color"]);
const SIXTEEN = 16;

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);

// ─────────────────────────────────────────────────────────────────────────────
// The graph, and the files the axes reach
// ─────────────────────────────────────────────────────────────────────────────

function reachFrom(graph, starts) {
    const seen = new Set();
    const stack = [...starts];
    while (stack.length > 0) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        for (const next of graph.get(file) ?? []) stack.push(next);
    }
    return seen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Class strings, read off the AST
// ─────────────────────────────────────────────────────────────────────────────

/** Every module-level `const NAME = <init>`, by name. */
function moduleConstants(ast) {
    const out = new Map();
    for (const node of ast.body) {
        const decl = node.type === "ExportNamedDeclaration" ? node.declaration : node;
        if (decl?.type !== "VariableDeclaration") continue;
        for (const d of decl.declarations) if (d.id?.type === "Identifier" && d.init) out.set(d.id.name, d.init);
    }
    return out;
}

/**
 * The class strings an expression can hand `className`, each an alternative of its own: a
 * string, a template's fixed text as one, each value of an object a member reads, both arms
 * of a condition. What cannot be read gives nothing.
 */
function fragmentsOf(node, constants, depth = 0) {
    if (!node || depth > 6) return [];
    switch (node.type) {
        case "Literal":
            return typeof node.value === "string" ? [node.value] : [];
        case "JSXExpressionContainer":
            return fragmentsOf(node.expression, constants, depth + 1);
        case "TemplateLiteral":
            return [node.quasis.map((q) => q.value.cooked).join(" "), ...node.expressions.flatMap((e) => fragmentsOf(e, constants, depth + 1))];
        case "ConditionalExpression":
            return [...fragmentsOf(node.consequent, constants, depth + 1), ...fragmentsOf(node.alternate, constants, depth + 1)];
        case "LogicalExpression":
            return [...fragmentsOf(node.left, constants, depth + 1), ...fragmentsOf(node.right, constants, depth + 1)];
        case "BinaryExpression":
            return node.operator === "+" ? [...fragmentsOf(node.left, constants, depth + 1), ...fragmentsOf(node.right, constants, depth + 1)] : [];
        case "Identifier":
            return fragmentsOf(constants.get(node.name), constants, depth + 1);
        case "ObjectExpression":
            return node.properties.flatMap((p) => (p.type === "Property" ? fragmentsOf(p.value, constants, depth + 1) : []));
        case "MemberExpression": {
            const object = node.object.type === "Identifier" ? constants.get(node.object.name) : null;
            if (object?.type !== "ObjectExpression") return [];
            if (!node.computed && node.property.type === "Identifier") {
                const prop = object.properties.find((p) => p.key?.name === node.property.name || p.key?.value === node.property.name);
                return prop ? fragmentsOf(prop.value, constants, depth + 1) : [];
            }
            return fragmentsOf(object, constants, depth + 1);
        }
        case "CallExpression":
            // `[...].join(" ")`, the shape a long class list takes.
            if (node.callee.type === "MemberExpression" && node.callee.property.name === "join" && node.callee.object.type === "ArrayExpression")
                return [node.callee.object.elements.flatMap((e) => fragmentsOf(e, constants, depth + 1)).join(" ")];
            return [];
        default:
            return [];
    }
}

/** A JSX element's name as written, `input` or `Field`. */
const elementName = (opening) => (opening.name.type === "JSXIdentifier" ? opening.name.name : null);

/** A JSX attribute's node, or null. */
const attribute = (opening, name) => opening.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name) ?? null;

const isFunction = (n) => n?.type === "FunctionDeclaration" || n?.type === "FunctionExpression" || n?.type === "ArrowFunctionExpression";

/** The name of the function a node is drawn in: its declaration's, or the variable it is bound to. */
function functionNameOf(fn, parents) {
    if (fn.id?.name) return fn.id.name;
    const holder = parents.get(fn);
    if (holder?.type === "VariableDeclarator" && holder.id?.name) return holder.id.name;
    return "<anonymous>";
}

/**
 * Every field a press can type into in a parsed file: an `input` of a typed kind, a
 * `textarea` or a `select`, with the class strings of itself and of every element holding it
 * inside the same component, nearest first.
 */
export function fieldsOf(rel, ast) {
    const parents = parentMap(ast);
    const constants = moduleConstants(ast);
    const fields = [];
    walk(ast, (n) => {
        if (n.type !== "JSXElement") return;
        const name = elementName(n.openingElement);
        if (!["input", "textarea", "select"].includes(name)) return;
        if (name === "input") {
            const type = attribute(n.openingElement, "type")?.value?.value ?? "text";
            if (NOT_TYPED.has(String(type).toLowerCase())) return;
        }
        const chain = [];
        let component = "<module>";
        for (let at = n; at; at = parents.get(at)) {
            if (isFunction(at)) {
                component = functionNameOf(at, parents);
                break;
            }
            if (at.type === "JSXElement") chain.push(fragmentsOf(attribute(at.openingElement, "className")?.value, constants));
        }
        fields.push({ where: `${rel} ${component} <${name}>`, chain });
    });
    return fields;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tailwind, asked what a token draws
// ─────────────────────────────────────────────────────────────────────────────

function tailwindReader(ds) {
    const cache = new Map();
    const cssOf = (token) => {
        if (!cache.has(token)) cache.set(token, ds.candidatesToCss([token])[0] ?? "");
        return cache.get(token);
    };
    /** The px a token sets a type size to, or null when it sets none. */
    const sizeOf = (token) => {
        const m = /font-size:\s*([^;]+);/.exec(cssOf(token));
        if (!m) return null;
        const value = m[1].trim();
        const named = /^var\((--[a-z0-9-]+)\)$/.exec(value);
        const length = named ? ds.resolveThemeValue(named[1]) : value;
        const rem = /^([\d.]+)rem$/.exec(String(length));
        const px = /^([\d.]+)px$/.exec(String(length));
        return rem ? Number(rem[1]) * 16 : px ? Number(px[1]) : NaN;
    };
    const order = (tokens) => new Map(ds.getClassOrder(tokens).map(([t, o]) => [t, o === null ? -1n : o]));
    return { cssOf, sizeOf, order };
}

/**
 * The judgment, pure: a field passes when the nearest element of its chain that sets a type
 * size sets it, in every alternative that does, to 16 under touch — the touch size present
 * and sorted after every other size in the string, or no size under 16 in it at all.
 */
export function judgeFields(fields, { sizeOf, order }) {
    const failures = [];
    for (const { where, chain } of fields) {
        const setter = chain.find((fragments) => fragments.some((f) => tokensOf(f).some((t) => sizeOf(t) !== null)));
        if (!setter) {
            failures.push(`${where} sets no type size anywhere it can be read`);
            continue;
        }
        for (const fragment of setter) {
            const sizes = tokensOf(fragment).filter((t) => sizeOf(t) !== null);
            if (sizes.length === 0) continue;
            if (sizes.includes(TOUCH_SIZE)) {
                const sorted = order(sizes);
                const last = sizes.every((t) => t === TOUCH_SIZE || sorted.get(t) < sorted.get(TOUCH_SIZE));
                if (!last) failures.push(`${where}: ${TOUCH_SIZE} is not the last size in "${fragment}"`);
            } else if (sizes.some((t) => !(sizeOf(t) >= SIXTEEN))) {
                failures.push(`${where} takes ${sizes.join(" ")} with no ${TOUCH_SIZE}`);
            }
        }
    }
    return failures;
}

/** Every class token in a parsed file's strings. */
function stringTokens(ast) {
    const out = new Set();
    walk(ast, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") for (const t of tokensOf(n.value)) out.add(t);
        if (n.type === "TemplateElement") for (const t of tokensOf(n.value.cooked ?? "")) out.add(t);
    });
    return out;
}

/** Whether a token's CSS sets `overscroll-behavior` on the page's root. */
const setsRootOverscroll = (css) => /overscroll-behavior/.test(css) && /(^|[\s,{])(:root|html|body)\b/.test(css);

/** Whether CSS sizes a length in the viewport units that do not follow the browser's bars. */
const staticViewportUnit = (css) => /\b\d*\.?\d+(vh|svh|lvh)\b/.test(css);

// ─────────────────────────────────────────────────────────────────────────────
// The run
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, assert, log }) {
    const ds = await loadDesignSystem();
    const tw = tailwindReader(ds);

    const files = ["app", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map(repoRelative).sort();
    const parsed = new Map(files.map((rel) => [rel, parseFile(rel).ast]));
    const graph = new Map([...parsed].map(([rel, ast]) => [rel, new Set([...importedPairs(rel, ast)].map((p) => p.slice(0, p.lastIndexOf("::"))))]));
    const routes = files.filter((rel) => ROUTE_FILE.test(rel));
    const axisRoutes = routes.filter((rel) => AXES.some((dir) => rel.startsWith(dir)));
    const reached = reachFrom(graph, axisRoutes);
    const pages = routes.filter((rel) => rel.endsWith("/page.js"));
    const drawsBar = (page) => reachFrom(graph, [page]).has(BOTTOM_BAR);

    // ── 1. the root's bounce, keyed to the bar ───────────────────────────────
    log("1. a scroll meeting the page's end stops only while the foot bar is drawn:");
    check("  the bar carries the rule", stringTokens(parsed.get(BOTTOM_BAR)).has(ROOT_RULE), true);
    const rule = tw.cssOf(ROOT_RULE);
    check(
        "  which Tailwind draws on the root holding the bar, below the phone's edge, as none",
        [/@media \(width < 40rem\)/.test(rule), /:root:has\(&\)/.test(rule), /overscroll-behavior-y: none;/.test(rule)].join(" "),
        "true true true"
    );
    const rootRules = [];
    for (const rel of files) for (const token of stringTokens(parsed.get(rel))) if (token.includes("overscroll") && setsRootOverscroll(tw.cssOf(token))) rootRules.push(`${rel} ${token}`);
    check("  and it is the one class that sets the root's overscroll", rootRules.join(" | "), `${BOTTOM_BAR} ${ROOT_RULE}`);
    const sheetRules = STYLESHEETS.filter((rel) => /overscroll-behavior/.test(readFileSync(repoPath(rel), "utf8")));
    check("  nor do the app's stylesheets, so a screen with no bar keeps auto", sheetRules.join(" | "), "");
    check(
        "  the screens that draw the bar",
        pages.filter(drawsBar).join(" | "),
        ["app/(assets)/assets/[assetId]/page.js", "app/login/confirm/page.js", "app/login/jobs/page.js", "app/login/name/page.js", "app/login/page.js"].join(" | ")
    );
    check(
        "  and the axes' screens that do not, whose root stays auto",
        pages.filter((p) => AXES.some((dir) => p.startsWith(dir)) && !drawsBar(p)).join(" | "),
        ["app/(assets)/asset-catalog/page.js", "app/(assets)/asset-categories/[categoryRecordId]/page.js", "app/(assets)/asset-categories/page.js"].join(" | ")
    );

    // ── 2. a phone's screen is the dynamic viewport ──────────────────────────
    log("");
    log("2. a phone's screen follows the browser's bars:");
    check("  both phone frames take their least height from the dynamic viewport", PHONE_FRAMES.map((rel) => stringTokens(parsed.get(rel)).has(PHONE_SCREEN)).join(" "), "true true");
    check("  which Tailwind draws as 100dvh below the phone's edge", /@media \(width < 40rem\)[\s\S]*min-height: 100dvh;/.test(tw.cssOf(PHONE_SCREEN)), true);
    const staticUnits = [];
    for (const rel of [...reached].filter((r) => parsed.has(r)).sort())
        for (const token of stringTokens(parsed.get(rel))) if (/vh|screen/.test(token) && staticViewportUnit(tw.cssOf(token))) staticUnits.push(`${rel} ${token}`);
    for (const rel of STYLESHEETS) if (staticViewportUnit(readFileSync(repoPath(rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))) staticUnits.push(rel);
    check("  and nothing the axes reach sizes a length in vh, svh or lvh", staticUnits.join(" | "), "");

    // ── 3. a field takes 16 under a finger ───────────────────────────────────
    log("");
    log("3. every field a press can type into takes 16 under a finger:");
    const fields = [...reached].filter((r) => parsed.has(r)).sort().flatMap((rel) => fieldsOf(rel, parsed.get(rel)));
    check(
        "  the fields the axes reach",
        fields.map((f) => f.where).join(" | "),
        [
            "app/components/Controls.js TextInput <input>",
            "app/components/Controls.js SheetInput <input>",
            "app/components/Controls.js NumberField <input>",
            "app/components/Controls.js Combobox <input>",
            "app/components/Controls.js SearchField <input>",
            "app/components/DialogFrame.js DialogSearch <input>",
            "app/login/CodeField.js CodeField <input>",
            "app/login/jobs/JobsForm.js SearchBand <input>",
        ].join(" | ")
    );
    check("  and each sets 16 under touch, the last size in its string", judgeFields(fields, tw).join(" | "), "");
    check("  which Tailwind draws under pointer: coarse at Tools 0a's field value, 16", [/@media \(pointer: coarse\)/.test(tw.cssOf(TOUCH_SIZE)), tw.sizeOf(TOUCH_SIZE)].join(" "), "true 16");
    check(
        "  and sorts after a desk's size and a phone's, whichever width",
        [...tw.order(["sm:text-body", "max-sm:text-mobile-body", "text-body", "text-body-sm", TOUCH_SIZE])].sort((a, b) => (a[1] < b[1] ? -1 : 1)).at(-1)[0],
        TOUCH_SIZE
    );

    // ── 4. the keyboard's cover ──────────────────────────────────────────────
    log("");
    log("4. a keyboard that covers the page lifts what stands at the foot, and nothing else does:");
    check(
        "  what takes typing: a text field, a search, a number, a text area, something editable",
        [{ tagName: "INPUT", type: "text" }, { tagName: "INPUT", type: "search" }, { tagName: "input", type: "number" }, { tagName: "TEXTAREA" }, { tagName: "DIV", isContentEditable: true }].map(takesTyping).join(" "),
        "true true true true true"
    );
    check(
        "  and what does not: a box, a choice, a button, a select, nothing",
        [{ tagName: "INPUT", type: "checkbox" }, { tagName: "INPUT", type: "radio" }, { tagName: "BUTTON" }, { tagName: "SELECT" }, null].map(takesTyping).join(" "),
        "false false false false false"
    );
    const cover = (over) => keyboardCover({ layoutHeight: 810, viewportHeight: 474, viewportTop: 0, scale: 1, typing: true, ...over });
    check("  a keyboard 336 tall under a field covers 336", cover({}), 336);
    check("  less how far the view has moved down", cover({ viewportTop: 40 }), 296);
    check("  none with nothing taking typing", cover({ typing: false }), 0);
    check("  none on a page zoomed by a pinch or a small field", cover({ scale: 1.14 }), 0);
    check("  none where the browser shrank the page for its keyboard", cover({ layoutHeight: 474 }), 0);
    check("  never below none", cover({ viewportHeight: 900 }), 0);
    const hook = "app/components/useKeyboardCover.js";
    const readers = files.filter((rel) => [...importedPairs(rel, parsed.get(rel))].includes(`${hook}::default`));
    check("  the bar and the sheet read it through the one hook", readers.join(" | "), "app/components/BottomBar.js | app/components/DialogFrame.js");
    check(
        "  which reads its judgments: the cover, the pan and what counts as typing",
        ["keyboardCover", "keyboardPan", "isTyping"].map((name) => [...importedPairs(hook, parsed.get(hook))].includes(`app/components/keyboardViewport.js::${name}`)).join(" "),
        "true true true"
    );
    const frameSheet = fragmentsOf(moduleConstants(parsed.get("app/components/DialogFrame.js")).get("SHEET"), new Map()).join(" ");
    check(
        "  the bar stands on the cover, and a sheet does too, its height the screen it read (#579)",
        [
            stringTokens(parsed.get(BOTTOM_BAR)).has("max-sm:bottom-(--keyboard-cover)"),
            tokensOf(frameSheet).includes("max-sm:mb-(--keyboard-cover)"),
            tokensOf(frameSheet).some((t) => t.startsWith("max-sm:max-h-[") && t.includes("var(--sheet-screen,100dvh)")),
        ].join(" "),
        "true true true"
    );

    // ── 5. no face is swapped in late ────────────────────────────────────────
    log("");
    log("5. no face the axes load is swapped in after the first paint:");
    const faces = files.filter((rel) => rel.startsWith("app/faces/"));
    const display = (ast) => {
        const out = [];
        walk(ast, (n) => {
            if (n.type !== "CallExpression" || n.arguments[0]?.type !== "ObjectExpression") return;
            const options = n.arguments[0].properties;
            if (!options.some((p) => p.key?.name === "variable")) return;
            out.push(options.find((p) => p.key?.name === "display")?.value?.value ?? "(default)");
        });
        return out;
    };
    check("  each face's call", faces.map((rel) => `${rel} ${display(parsed.get(rel)).join(",")}`).join(" | "), "app/faces/brand.js optional | app/faces/id.js optional | app/faces/ui.js optional");

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    log(`  the axes' ${axisRoutes.length} route files reach ${reached.size} files`);
    assert("  more than forty of them", reached.size > 40);
    const plantedFields = (source) => judgeFields(fieldsOf("app/planted.js", parseSource(source, "<planted-field>").ast), tw);
    check(
        "  a field at a desk's 14 with no touch size is reported",
        plantedFields('function F() { return <input className="h-control text-body" />; }').join(" | "),
        'app/planted.js F <input> takes text-body with no pointer-coarse:text-mobile-body'
    );
    check("  one with it is not", plantedFields(`function F() { return <input className="text-body ${TOUCH_SIZE}" />; }`).join(" | "), "");
    check(
        "  one whose size its holder sets through an object is read through every value",
        plantedFields(`const SIZE = { a: "text-body ${TOUCH_SIZE}", b: "text-body-sm" };\nfunction F({ s }) { return <div className={SIZE[s]}><input /></div>; }`).join(" | "),
        "app/planted.js F <input> takes text-body-sm with no pointer-coarse:text-mobile-body"
    );
    check("  one with no size anywhere is reported", plantedFields("function F() { return <textarea />; }").join(" | "), "app/planted.js F <textarea> sets no type size anywhere it can be read");
    check("  and a box is no field", fieldsOf("app/planted.js", parseSource('function F() { return <input type="checkbox" className="text-body" />; }').ast).length, 0);
    check("  a touch size sorted before a desk's is reported", judgeFields([{ where: "planted", chain: [["text-body " + TOUCH_SIZE]] }], { ...tw, order: () => new Map([["text-body", 9n], [TOUCH_SIZE, 1n]]) }).length, 1);
    check("  a second class on the root is seen", setsRootOverscroll(tw.cssOf("[:root:has(&)]:overscroll-y-contain")), true);
    check("  and one on an element is not", setsRootOverscroll(tw.cssOf("overscroll-y-none")), false);
    check("  a screen's height in vh is seen, in dvh is not", [staticViewportUnit(tw.cssOf("min-h-screen")), staticViewportUnit(tw.cssOf("h-[50svh]")), staticViewportUnit(tw.cssOf("min-h-dvh"))].join(" "), "true true false");
    check("  a face left at next/font's swap is seen", display(parseSource('export const f = Face({ subsets: ["latin"], variable: "--f" });').ast).join(), "(default)");
}

if (isMain(import.meta.url)) standalone(title, run);
