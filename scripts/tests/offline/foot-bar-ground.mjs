// Every foot bar takes the page's white below the phone's edge (#607).
//
// WHY THIS IS A CHECK. Tools 0a's Foot bar row says since the files of 2026-11-04's afternoon that
// the bar "holds the screen's foot under the scrolling body, which ends at its top, so nothing runs
// beneath it". Those files draw the asset page's (1j) and the job step's (Sign in 1k) so, while
// Sign in 27 still draws the email, code and name steps' content running on under a translucent
// bar; by Soo's ruling of 2026-11-05 every bar is 0a's, so that one sign-in does not draw two
// bars. The app's phone screens scroll the document, so the bar keeps its sticky place and its
// ride on the keyboard (#568, #579) and takes the page's white. A ground some bars were handed by
// a prop is what this replaced, and one would bring the two bars back. This tier never opens a
// page, so it holds:
//
//   1. THE GROUND: the element `BottomBar` makes sticky below the phone's edge carries
//      `max-sm:bg-white` among the classes it always draws, and none it draws on a condition is a
//      ground — which Tailwind draws as white under the phone's edge.
//   2. NO BAR IS SET APART: `BottomBar` takes `stack`, `bleed`, `phoneOnly` and its children
//      alone, and every bar the app draws, found by its JSX and by its text, passes nothing else.
//
// WHAT IT CANNOT SEE: what a phone draws under a bar while the body scrolls past it. A browser at
// 373 × 810 under touch measured the sign-in steps' bars and the asset page's against main.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "Every foot bar takes the page's white below the phone's edge (#607)";

const BAR = "app/components/BottomBar.js";
const PROPS = ["stack", "bleed", "phoneOnly", "children"];
const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const words = (text) => text.split(/\s+/).filter(Boolean);
const grounds = (classes) => classes.filter((c) => /(^|:)bg-/.test(c));

/** The sticky element's classes: those it always draws, and those it draws on a condition. */
export function stickyClasses(ast) {
    let found = null;
    walk(ast, (n) => {
        if (found || n.type !== "TemplateLiteral") return;
        const fixed = words(n.quasis.map((q) => q.value.cooked).join(" "));
        if (!fixed.includes("max-sm:sticky")) return;
        const conditional = [];
        for (const e of n.expressions) {
            walk(e, (m) => {
                if (m.type === "Literal" && typeof m.value === "string") conditional.push(...words(m.value));
            });
        }
        found = { fixed, conditional };
    });
    return found ?? { fixed: [], conditional: [] };
}

/** The props the bar's default export takes, a rest element as `…rest`. */
export function barProps(ast) {
    let props = null;
    walk(ast, (n) => {
        if (props || n.type !== "ExportDefaultDeclaration") return;
        const param = n.declaration.params?.[0];
        props = param?.type === "ObjectPattern" ? param.properties.map((p) => (p.type === "RestElement" ? "…rest" : p.key?.name)) : [];
    });
    return props ?? [];
}

/** Every bar drawn, by file, with the props it passes in name order, a spread as `…spread`. */
export function bars(files) {
    const found = [];
    for (const { relPath, ast } of files) {
        walk(ast, (n) => {
            if (n.type !== "JSXOpeningElement" || n.name?.name !== "BottomBar") return;
            const passed = n.attributes.map((a) => (a.type === "JSXSpreadAttribute" ? "…spread" : a.name.name)).sort();
            found.push({ relPath, passed });
        });
    }
    return found.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
}

/** The bars passing a prop the bar does not take. */
export function setApart(found) {
    return found.filter(({ passed }) => passed.some((p) => !PROPS.includes(p))).map(({ relPath, passed }) => `${relPath} ${passed.join(",")}`);
}

export async function run({ check, log }) {
    const ds = await loadDesignSystem();
    const bar = parseFile(BAR);

    log("the ground:");
    const sticky = stickyClasses(bar.ast);
    check("  the sticky element is found", String(sticky.fixed.includes("max-sm:sticky")), "true");
    check(
        "  its ground is the page's white, drawn whatever the bar is handed",
        JSON.stringify({ always: grounds(sticky.fixed), onCondition: grounds(sticky.conditional) }),
        JSON.stringify({ always: ["max-sm:bg-white"], onCondition: [] })
    );
    const css = ds.candidatesToCss(["max-sm:bg-white"])[0] ?? "";
    check("  which Tailwind draws as white under the phone's edge", [/@media \(width < 40rem\)/.test(css), /background-color: var\(--color-white\)/.test(css)].join(" "), "true true");

    log("no bar is set apart:");
    check("  the bar takes stack, bleed, phoneOnly and its children alone", barProps(bar.ast).join(" | "), PROPS.join(" | "));
    const files = listJsFiles(repoPath("app")).map((abs) => parseFile(repoRelative(abs)));
    const found = bars(files);
    const byText = listJsFiles(repoPath("app"))
        .map((abs) => [repoRelative(abs), (readFileSync(abs, "utf8").match(/<BottomBar\b/g) ?? []).length])
        .filter(([, count]) => count > 0)
        .flatMap(([rel, count]) => Array(count).fill(rel))
        .sort();
    check("  every bar is found by its JSX, as by its text", found.map((f) => f.relPath).join(" | "), byText.join(" | "));
    check("  eleven bars are drawn, the deactivated step's among them (#491)", String(found.length), "11");
    check("  and none passes a prop the bar does not take", setApart(found).join(" | "), "");

    // Anti-vacuity: a ground drawn on a condition, a bar taking a prop more, a caller passing one and
    // a caller spreading are each seen.
    log("anti-vacuity — this check is seen to be able to fail:");
    const plantedBar = parseSource(
        'export default function BottomBar({ stack, below = false }) { return <div className={`max-sm:sticky ${below ? "max-sm:bg-white" : ""}`} />; }',
        "<planted>"
    ).ast;
    const plantedSticky = stickyClasses(plantedBar);
    check(
        "  a ground drawn on a condition is seen",
        JSON.stringify({ always: grounds(plantedSticky.fixed), onCondition: grounds(plantedSticky.conditional) }),
        JSON.stringify({ always: [], onCondition: ["max-sm:bg-white"] })
    );
    check("  as is a bar taking a prop more", barProps(plantedBar).join(" | "), "stack | below");
    const planted = parseSource('export function P({ rest }) { return <><BottomBar stack="none" below /><BottomBar {...rest} /></>; }', "<planted>");
    check("  and a caller passing one, or spreading", setApart(bars([{ relPath: "app/planted.js", ast: planted.ast }])).join(" | "), "app/planted.js below,stack | app/planted.js …spread");
}

if (isMain(import.meta.url)) standalone(title, run);
