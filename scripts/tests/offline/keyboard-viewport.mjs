// A screen with a foot bar asks a phone to make room for its keyboard (#495).
//
// WHY THIS IS A CHECK. `app/components/BottomBar.js` rides on a phone's keyboard two ways: a
// browser that shrinks the page for its keyboard keeps the sticky bar above it by itself, and
// one that covers the page reports how far it covers, which the bar is lifted by. The first
// takes the route asking for it — `viewport.interactiveWidget: "resizes-content"` — and from
// #463 to #495 the bar's header said both screens drawing it asked while only the sign-in
// steps did. Nothing failed: the tool item page simply asked for nothing, and the name sheet
// its foot bar opens could stand under a keyboard 1f draws it standing on. So every route
// whose page reaches the bar has, in that page or a layout above it, a `viewport` export that
// is `KEYBOARD_VIEWPORT` from `app/components/keyboardViewport.js` — the one value, so the two
// screens cannot ask for two things — and that value is the one hint.
//
// FOUND RATHER THAN LISTED. The routes are every `page.js` under `app/` whose import graph
// reaches the bar, read through `unread-exports.mjs`' `importedPairs`, the resolution the
// design-values check walks too; so a third screen that draws the bar is held the day it does.
//
// WHAT IT CANNOT SEE. Whether a browser honors the hint — Safari ignores it, and the bar
// measures the cover there — and whether a keyboard rose at all: this tier never renders, and
// the browser pane has no keyboard either. A dynamic `import()` is outside the graph, as it is
// for every check that walks it.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { posix } from "node:path";
import { KEYBOARD_VIEWPORT } from "../../../app/components/keyboardViewport.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { importedPairs } from "./unread-exports.mjs";

export const title = "A screen with a foot bar asks a phone to make room for its keyboard (#495)";

const BOTTOM_BAR = "app/components/BottomBar.js";
const VIEWPORT_MODULE = "app/components/keyboardViewport.js";
const PAGE_FILE = /^app\/(.*\/)?page\.js$/;

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

/** Every file a module reaches through its imports, itself included. */
function reach(graph, from) {
    const seen = new Set();
    const stack = [from];
    while (stack.length > 0) {
        const file = stack.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        for (const next of graph.get(file) ?? []) stack.push(next);
    }
    return seen;
}

/** The layouts above a page, nearest first, as repo-relative paths that may or may not exist. */
function layoutsAbove(page) {
    const out = [];
    for (let dir = posix.dirname(page); dir === "app" || dir.startsWith("app/"); dir = posix.dirname(dir)) {
        out.push(`${dir}/layout.js`);
        if (dir === "app") break;
    }
    return out;
}

/**
 * Whether a parsed route file exports `viewport` as the shared value: a `const viewport`
 * bound to the `KEYBOARD_VIEWPORT` it imports from the one module. An object of its own, or
 * the name bound to anything else, is not it.
 */
function asksForKeyboard(rel, ast) {
    const imported = [...importedPairs(rel, ast)].includes(`${VIEWPORT_MODULE}::KEYBOARD_VIEWPORT`);
    let exported = false;
    walk(ast, (n) => {
        if (n.type !== "ExportNamedDeclaration" || n.declaration?.type !== "VariableDeclaration") return;
        for (const d of n.declaration.declarations)
            if (d.id?.name === "viewport" && d.init?.type === "Identifier" && d.init.name === "KEYBOARD_VIEWPORT") exported = true;
    });
    return imported && exported;
}

/**
 * The judgment, pure: every page reaching the bar has a route file — itself or a layout above
 * it — that asks. `asks` maps a route file to whether it does; a file not in it does not.
 */
export function judge({ pages, reachesBar, asks }) {
    const failures = [];
    for (const page of pages) {
        if (!reachesBar(page)) continue;
        if (![page, ...layoutsAbove(page)].some((file) => asks.get(file) === true)) failures.push(`${page} draws the foot bar and asks no phone for its keyboard`);
    }
    return failures;
}

export function run({ check, assert, log }) {
    log("the one value a screen with a foot bar asks for:");
    check("  a phone's keyboard shrinks the page rather than covering it", JSON.stringify(KEYBOARD_VIEWPORT), JSON.stringify({ interactiveWidget: "resizes-content" }));

    const files = ["app", "components", "lib"].flatMap((d) => listJsFiles(repoPath(d))).map(repoRelative);
    const graph = new Map();
    const asks = new Map();
    for (const rel of files) {
        const { ast } = parseFile(rel);
        graph.set(rel, new Set([...importedPairs(rel, ast)].map((p) => p.slice(0, p.lastIndexOf("::")))));
        if (/\/(page|layout)\.js$/.test(rel)) asks.set(rel, asksForKeyboard(rel, ast));
    }
    const pages = files.filter((rel) => PAGE_FILE.test(rel)).sort();
    const reachesBar = (page) => reach(graph, page).has(BOTTOM_BAR);

    log("");
    log("every screen that draws the foot bar asks for it, in its page or a layout above:");
    check(
        "  the screens that draw it",
        pages.filter(reachesBar).join(" | "),
        ["app/(tools)/tool-items/[toolItemId]/page.js", "app/login/confirm/page.js", "app/login/name/page.js", "app/login/page.js"].join(" | ")
    );
    check("  the route files that ask", [...asks].filter(([, a]) => a).map(([rel]) => rel).sort().join(" | "), "app/(tools)/tool-items/[toolItemId]/page.js | app/login/layout.js");
    check("  and none that draws it asks for nothing", judge({ pages, reachesBar, asks }).join(" | "), "");

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    log(`  the walk reached ${pages.length} pages`);
    assert("  more than twenty of them", pages.length > 20);
    const plantedPage = "app/planted/screen/page.js";
    check(
        "  a page reaching the bar with nothing above it asking is reported",
        judge({ pages: [plantedPage], reachesBar: () => true, asks: new Map() }).join(" | "),
        `${plantedPage} draws the foot bar and asks no phone for its keyboard`
    );
    check(
        "  and one whose layout asks is not",
        judge({ pages: [plantedPage], reachesBar: () => true, asks: new Map([["app/planted/layout.js", true]]) }).join(" | "),
        ""
    );
    check("  nor one that draws no bar", judge({ pages: [plantedPage], reachesBar: () => false, asks: new Map() }).join(" | "), "");
    const planted = (source) => asksForKeyboard("app/planted/layout.js", parseSource(source, "<planted-viewport>").ast);
    check(
        "  an export of the shared value asks",
        planted('import { KEYBOARD_VIEWPORT } from "@/app/components/keyboardViewport";\nexport const viewport = KEYBOARD_VIEWPORT;\n'),
        true
    );
    check("  an object of its own does not", planted('export const viewport = { interactiveWidget: "resizes-content" };\n'), false);
    check(
        "  nor the name bound to something else",
        planted('import { KEYBOARD_VIEWPORT } from "@/app/components/keyboardViewport";\nexport const viewport = { ...KEYBOARD_VIEWPORT };\n'),
        false
    );
    check("  and the layouts above a page reach the root", layoutsAbove("app/(tools)/tool-items/[toolItemId]/page.js").join(" | "), "app/(tools)/tool-items/[toolItemId]/layout.js | app/(tools)/tool-items/layout.js | app/(tools)/layout.js | app/layout.js");
}

if (isMain(import.meta.url)) standalone(title, run);
