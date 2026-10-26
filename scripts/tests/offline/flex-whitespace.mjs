// A flex or grid box keeps the spaces between the words it holds (#538).
//
// WHY THIS IS A CHECK. A flex or grid container makes every run of text among its children an
// item of its own, and an item's leading and trailing white space is dropped like a line's. So
// `<p className="flex">{from} of {total}</p>` draws `1–25of25`: the words are there for a copy
// and a screen reader, and the spaces are gone on the screen. The assets lists' pager did it from
// #519, when its count's `<p>` became a flex box to hold the controls' height, until #538 — its
// count is `Figures`, which hands back the figures and the words between them as siblings, so the
// JSX shows no text at all where the space was lost. Nothing failed and every figure read right
// off the DOM; only the drawn line was wrong.
//
// WHAT IT READS. Every `.js` file under `app/`, parsed, and in it every element
// whose `className` holds `flex`, `inline-flex`, `grid` or `inline-grid` — bare or under a variant,
// since a box that is flex at one width drops the space there. Two shapes fail:
//   - a text child whose own words begin or end with a space where an element or an expression
//     stands beside it, the text taken as React takes JSX text (a run broken across lines loses
//     the white space at its line breaks, and a space-only `{" "}` between two siblings is text);
//   - `Figures` placed straight in such a box, since what it returns is the first shape.
// Wrapping the text in one inline element is the remedy, which is `ListTable.js`' pager since #538.
//
// WHAT IT CANNOT SEE. A class assembled at run time from something other than string literals in
// the attribute itself — a constant named elsewhere, a helper's return — so a box styled through
// `LIST_MEASURE`-like constants is judged by the literals beside them only; text handed in as a
// prop and drawn by a box in another file; a component other than `Figures` that returns mixed
// siblings; and CSS that makes a box flex outside its `className`. The browser is what shows the
// drawn line: #538 measured the pager's ` of ` at 12.13 wide where the drawing's is 17.34.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A flex or grid box keeps the spaces between the words it holds (#538)";

/** The components whose return is figures and words as siblings. */
const MIXED_CHILDREN = new Set(["Figures"]);

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);

/** Every string literal and template piece in a `className` attribute, joined by spaces. */
function classText(element) {
    const attribute = element.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === "className");
    if (!attribute?.value) return "";
    const parts = [];
    walk(attribute.value, (n) => {
        if (n.type === "Literal" && typeof n.value === "string") parts.push(n.value);
        if (n.type === "TemplateElement") parts.push(n.value.cooked ?? "");
    });
    return parts.join(" ");
}

/** Whether a class list makes the box flex or grid, bare or under a variant. */
export function isFlexOrGrid(classes) {
    return classes.split(/\s+/).some((token) => /^(?:[\w-]+:)*(?:inline-)?(?:flex|grid)$/.test(token));
}

/**
 * JSX text as React builds it: lines split, each line's white space trimmed where it meets a
 * line break, empty lines dropped, the rest joined by one space. `null` when nothing is left.
 */
export function jsxText(raw) {
    const lines = raw.split(/\r\n|\n|\r/);
    let out = "";
    lines.forEach((line, index) => {
        let piece = line.replace(/\t/g, " ");
        if (index > 0) piece = piece.replace(/^ +/, "");
        if (index < lines.length - 1) piece = piece.replace(/ +$/, "");
        if (piece === "") return;
        out += (out === "" ? "" : " ") + piece;
    });
    return out === "" ? null : out;
}

/** A child's text as drawn, for a text child or a string literal in braces; null for anything else. */
function textOf(child) {
    if (child.type === "JSXText") return jsxText(child.value);
    if (child.type === "JSXExpressionContainer" && child.expression?.type === "Literal" && typeof child.expression.value === "string") return child.expression.value;
    return null;
}

/** Whether a child is something other than text — an element or an expression. */
function isSibling(child) {
    if (child.type === "JSXText") return false;
    if (child.type === "JSXExpressionContainer" && child.expression?.type === "JSXEmptyExpression") return false;
    return textOf(child) === null;
}

/**
 * The judgment over one parsed file: every flex or grid box that drops a space, as
 * `path:line what`. A text child is judged by the siblings beside it once empty text is gone.
 */
export function findDroppedSpaces(parsed) {
    const found = [];
    walk(parsed.ast, (n) => {
        if (n.type !== "JSXElement" || !isFlexOrGrid(classText(n))) return;
        const children = n.children.filter((c) => textOf(c) !== null || isSibling(c));
        children.forEach((child, index) => {
            const text = textOf(child);
            if (text !== null) {
                const before = index > 0 && isSibling(children[index - 1]);
                const after = index < children.length - 1 && isSibling(children[index + 1]);
                if ((before && /^\s/.test(text)) || (after && /\s$/.test(text)))
                    found.push(`${parsed.relPath}:${lineOf(parsed.source, child.start)} text ${JSON.stringify(text)}`);
            } else if (child.type === "JSXElement" && MIXED_CHILDREN.has(child.openingElement.name?.name)) {
                found.push(`${parsed.relPath}:${lineOf(parsed.source, child.start)} <${child.openingElement.name.name}> straight in the box`);
            }
        });
    });
    return found;
}

function lineOf(source, offset) {
    return source.slice(0, offset).split("\n").length;
}

export async function run({ check, log, assert }) {
    const files = listJsFiles(repoPath("app")).map(repoRelative).sort();
    let boxes = 0;
    const found = [];
    for (const file of files) {
        const parsed = parseFile(file);
        walk(parsed.ast, (n) => {
            if (n.type === "JSXElement" && isFlexOrGrid(classText(n))) boxes++;
        });
        found.push(...findDroppedSpaces(parsed));
    }
    log(`read ${files.length} files under app/, holding ${boxes} flex or grid boxes`);
    assert("  more than a hundred and fifty files, the pager's own among them", files.length > 150 && files.includes("app/components/ListTable.js"));
    assert("  and more than two hundred and fifty boxes", boxes > 250);
    check("no flex or grid box drops a space between the words it holds", found.join(" | "), "");

    // The pager's count is the case that put this here: its figures and words in one span.
    const pager = parseFile("app/components/ListTable.js");
    let countWrapped = false;
    walk(pager.ast, (n) => {
        if (n.type !== "JSXElement" || !isFlexOrGrid(classText(n))) return;
        const inner = n.children.filter((c) => c.type === "JSXElement");
        if (inner.length === 1 && inner[0].openingElement.name?.name === "span" && inner[0].children.some((c) => c.type === "JSXElement" && c.openingElement.name?.name === "Figures"))
            countWrapped = true;
    });
    assert("  and the pager's count holds its figures and words in one span inside its flex box", countWrapped);

    // ANTI-VACUITY: each shape is seen where it is planted, and the remedy is not.
    log("");
    log("each way a box drops a space is seen, and the wrapped text is not:");
    const planted = (source) => findDroppedSpaces(parseSource(source, "<planted>")).length;
    check("  the pager's count as it stood from #519", planted('const p = <p className="flex h-control items-center"><Figures className="x">{range}</Figures></p>;'), 1);
    check("  and wrapped in a span, as it stands now", planted('const p = <p className="flex h-control items-center"><span><Figures className="x">{range}</Figures></span></p>;'), 0);
    check("  words between two expressions", planted('const p = <p className="flex">{from} of {total}</p>;'), 1);
    check("  a word after an element", planted('const p = <p className="inline-flex"><b>3</b> selected</p>;'), 1);
    check("  a word before one", planted('const p = <p className="grid">Page <b>3</b></p>;'), 1);
    check("  under a variant", planted('const p = <p className="max-sm:flex">{from} of {total}</p>;'), 1);
    check("  in a template literal's class", planted("const p = <p className={`flex items-center ${x}`}>{from} of {total}</p>;"), 1);
    check("  and in a string inside one", planted("const p = <p className={`items-center ${x ? \"flex\" : \"\"}`}>{from} of {total}</p>;"), 1);
    check("  a space alone in braces between two elements", planted('const p = <div className="flex"><b>a</b>{" "}<b>b</b></div>;'), 1);
    check("  but not in a box that is neither flex nor grid", planted('const p = <p className="text-sm">{from} of {total}</p>;'), 0);
    check("  nor a word whose edges meet only a line break", planted('const p = <p className="flex">\n    <b>a</b>\n    selected\n</p>;'), 0);
    check("  nor a flex token inside another word", planted('const p = <p className="flex-col shrink-0 gridline">{from} of {total}</p>;'), 0);
    check("  and JSX text reads as React builds it", JSON.stringify([jsxText("  a  \n   b \n  "), jsxText("\n   \n"), jsxText(" of ")]), '["  a b",null," of "]');
}

if (isMain(import.meta.url)) standalone(title, run);
