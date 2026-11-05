// Focus the app moves by itself is drawn for the keyboard alone, and a dialog hands it back to
// what opened it (#607).
//
// WHY THIS IS A CHECK. On a phone, closing the check-out's name sheet left Safari's blue ring
// round the page's title. Safari gives a tapped button no focus, so the sheet kept no opener,
// closed onto the document, and the column put focus on the heading by script (#519); and Safari
// judged that focus after a tap visible (#578) and drew its ring, which no drawing has. A desk
// browser shows neither, and this tier never opens a page, so it holds what the fix turns on:
//
//   1. THE JUDGMENT, BY VALUE: `focusShows` draws a moved focus after a key, and not after a press
//      or before either.
//   2. THE PRESS AND THE KEY, PLAYED: `movedFocus.js` is loaded over a stand-in document and its
//      two listeners are driven — a press notes what it began on and makes the next moved focus
//      quiet, the mark leaving with the focus or at the next key; a key makes it drawn.
//   3. EVERY FOCUS THE FRAME AND THE HELD SHEET MOVE GOES THROUGH IT: a dialog's opener is what
//      held focus or what the press began on; a closing hands focus to it while it can hold it,
//      and to the heading otherwise; every `.focus(` left in the two files is a field's, whose
//      caret is what shows.
//   4. NOTHING DRAWS A QUIET FOCUS: `app/globals.css` takes the browser's ring off it, and every
//      control that opens a dialog and draws its own focus face — found by `aria-haspopup="dialog"`
//      — skips it under the mark, as Tailwind reads its classes.
//
// WHAT IT CANNOT SEE. Whether Safari judges a script's focus after a tap visible, and whether a
// phone draws the ring the mark takes away: a phone is where both are seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "fs";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { focusShows } from "../../../lib/dialogFrame.js";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "Focus the app moves is drawn for the keyboard alone, and goes back to what opened a dialog (#607)";

const FRAME = "app/components/DialogFrame.js";
const HOLD = "app/components/sheetHold.js";
const MOVED = "app/components/movedFocus.js";
const GLOBALS = "app/globals.css";

const repoRelative = (abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1);
const tokensOf = (text) => String(text).split(/\s+/).filter(Boolean);
const squeeze = (text) => text.replace(/\s+/g, " ").trim();

// ─────────────────────────────────────────────────────────────────────────────
// A stand-in document, for the module's two listeners
// ─────────────────────────────────────────────────────────────────────────────

/** A document that keeps its listeners and its marked elements, and elements that keep their marks. */
export function standInDocument() {
    const listeners = {};
    const elements = [];
    const doc = {
        addEventListener: (type, handler, capture) => (listeners[type] = { handler, capture }),
        querySelectorAll: (selector) => (selector === "[data-quiet-focus]" ? elements.filter((e) => e.attrs.has("data-quiet-focus")) : []),
    };
    const element = (name, { connected = true, pressable = true } = {}) => {
        const e = {
            name,
            isConnected: connected,
            attrs: new Set(),
            blurs: [],
            focused: 0,
            setAttribute: (attr) => e.attrs.add(attr),
            removeAttribute: (attr) => e.attrs.delete(attr),
            addEventListener: (type, handler) => type === "blur" && e.blurs.push(handler),
            focus: () => (e.focused += 1),
            blur: () => e.blurs.splice(0).forEach((handler) => handler()),
            closest: () => (pressable ? e : null),
        };
        elements.push(e);
        return e;
    };
    return { doc, listeners, element };
}

/**
 * The module loaded over a stand-in document, fresh each time: the document stays the page's
 * while the play runs, since a key's listener asks it for the marks, and `restore` gives it back.
 */
async function loadOver(doc) {
    const previous = globalThis.document;
    globalThis.document = doc;
    const url = new URL(`../../../${MOVED}?stand-in=${Math.random()}`, import.meta.url);
    const loaded = await import(url.href);
    return { ...loaded, restore: () => (globalThis.document = previous) };
}

// ─────────────────────────────────────────────────────────────────────────────
// What the frame and the hold do with focus
// ─────────────────────────────────────────────────────────────────────────────

/** Every `.focus(` call in a source, as written, and what calls it. */
export function focusCalls(source) {
    return [...source.matchAll(/([\w.?]+)\.focus\(([^)]*)\)/g)].map((m) => squeeze(`${m[1]}.focus(${m[2]})`));
}

/** What is wrong with how the frame keeps and hands back focus, in words. */
export function frameFocus(source) {
    const problems = [];
    if (!/const holding = document\.activeElement && document\.activeElement !== document\.body \? document\.activeElement : null;\s*openerRef\.current = unprompted \? null : \(holding \?\? pressedControl\(\)\);/.test(source))
        problems.push("the opener is not what held focus, or what the press began on");
    if (!/dialog\.close\(\);\s*(?:\/\/[^\n]*\n\s*)*if \(!unprompted && opener !== null && canHoldFocus\(opener\)\) moveFocus\(opener\);\s*else focusPageHeading\(\);/.test(source))
        problems.push("a closing does not hand focus to its opener, or to the heading");
    if (!/function focusHeading\(heading\) \{[^}]*moveFocus\(heading\);\s*\}/.test(source)) problems.push("a heading is not focused as a moved focus");
    if (!/if \(opener\?\.isConnected\) \{\s*moveFocus\(opener\);/.test(source)) problems.push("a removed dialog's opener is not focused as a moved focus");
    if (!/if \(control\) \{\s*moveFocus\(control\);/.test(source)) problems.push("a fallen focus is not put back as a moved focus");
    return problems;
}

// ─────────────────────────────────────────────────────────────────────────────
// The check
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, log }) {
    log("the judgment, by value:");
    check("  drawn after a key, not after a press or before either", [focusShows("key"), focusShows("pointer"), focusShows(null)].join(" "), "true false false");

    log("the press and the key, played over a stand-in document:");
    const page = standInDocument();
    const moved = await loadOver(page.doc);
    check(
        "  the module listens for a press and a key, in the capture phase",
        ["pointerdown", "keydown"].map((type) => `${type} ${page.listeners[type]?.capture === true}`).join(" | "),
        "pointerdown true | keydown true"
    );
    const opener = page.element("opener");
    const heading = page.element("heading");
    page.listeners.pointerdown.handler({ target: opener });
    check("  a press notes what it began on", moved.pressedControl()?.name, "opener");
    moved.moveFocus(heading);
    check("  and the focus moved after it is focused and marked quiet", `${heading.focused} ${heading.attrs.has("data-quiet-focus")}`, "1 true");
    heading.blur();
    check("  the mark leaves with the focus", heading.attrs.has("data-quiet-focus"), false);
    moved.moveFocus(heading);
    page.listeners.keydown.handler({});
    check("  or at the next key", heading.attrs.has("data-quiet-focus"), false);
    moved.moveFocus(opener);
    check("  and after a key a moved focus is drawn", `${opener.focused} ${opener.attrs.has("data-quiet-focus")}`, "1 false");
    const gone = page.element("gone", { connected: false });
    page.listeners.pointerdown.handler({ target: gone });
    check("  a press on what has left the page names nothing", moved.pressedControl(), null);
    page.listeners.pointerdown.handler({ target: page.element("text", { pressable: false }) });
    check("  nor one on what cannot hold focus", moved.pressedControl(), null);
    moved.restore();

    log("every focus the frame and the held sheet move goes through it:");
    const frame = parseFile(FRAME).source;
    const hold = parseFile(HOLD).source;
    check("  the frame keeps its opener and hands focus back to it, or to the heading", frameFocus(frame).join("; "), "");
    check("  the held sheet's title after the keyboard's Done is a moved focus", /else if \(turn === "title"\) moveFocus\(titleOf\(leaving, doc\), \{ preventScroll: true \}\);/.test(hold), true);
    check(
        "  and every focus left in the two is a field's, whose caret is what shows",
        [...focusCalls(frame), ...focusCalls(hold)].join(" | "),
        "field.focus() | inputRef.current?.focus() | gaining.focus({ preventScroll: true })"
    );

    log("nothing draws a quiet focus:");
    const globals = readFileSync(repoPath(GLOBALS), "utf8");
    check("  the browser's ring is taken off it, in the base layer", /@layer base \{\s*\[data-quiet-focus\]:focus \{\s*outline: none;\s*\}\s*\}/.test(globals), true);
    const ds = await loadDesignSystem();
    const cssOf = (token) => ds.candidatesToCss([token])[0] ?? "";
    const openers = [];
    for (const abs of listJsFiles(repoPath("app"))) {
        const rel = repoRelative(abs);
        const { ast, source } = parseFile(rel);
        walk(ast, (n) => {
            if (n.type !== "JSXOpeningElement" || !n.attributes.some((a) => a.name?.name === "aria-haspopup" && a.value?.value === "dialog")) return;
            // The opener's own classes and those of what it holds, as written in its element.
            let element = null;
            walk(ast, (m) => {
                if (m.type === "JSXElement" && m.openingElement === n) element = m;
            });
            const text = source.slice(element.start, element.end);
            const component = text.includes("className={`${pill}") ? source.slice(source.lastIndexOf("export function", element.start), element.end) : text;
            const faces = tokensOf([...component.matchAll(/"([^"]*focus[^"]*)"/g)].map((m) => m[1]).join(" ")).filter((t) => /focus/.test(t));
            openers.push({ rel, faces });
        });
    }
    const byText = listJsFiles(repoPath("app"))
        .map(repoRelative)
        .filter((rel) => readFileSync(repoPath(rel), "utf8").includes('aria-haspopup="dialog"'))
        .sort();
    check("  every control opening a dialog is found by its JSX, as by its text", [...new Set(openers.map((o) => o.rel))].sort().join(" | "), byText.join(" | "));
    const drawnQuiet = openers.flatMap((o) => o.faces.filter((t) => /focus-visible|focus-within|:focus/.test(t) && /border|bg-|ring|outline/.test(t)).filter((t) => !/\[data-quiet-focus\]/.test(cssOf(t))).map((t) => `${o.rel} ${t}`));
    check("  and each focus face such a control draws skips a quiet focus", drawnQuiet.join(" | "), "");
    check("  the phone's two such controls draw one each", openers.flatMap((o) => o.faces.filter((t) => /border-border-focus/.test(t))).length, 2);

    // Anti-vacuity: the frame as it was, a press that marks nothing and a face that ignores the mark
    // are each seen.
    log("anti-vacuity — this check is seen to be able to fail:");
    const before = 'openerRef.current = unprompted || document.activeElement === document.body ? null : document.activeElement;\ndialog.close();\nif (unprompted || (opener !== null && document.activeElement !== opener)) focusPageHeading();\nfunction focusHeading(heading) { heading.focus(); }';
    check(
        "  the frame before #607 is seen",
        frameFocus(before).join("; "),
        "the opener is not what held focus, or what the press began on; a closing does not hand focus to its opener, or to the heading; a heading is not focused as a moved focus; a removed dialog's opener is not focused as a moved focus; a fallen focus is not put back as a moved focus"
    );
    check("  as is a focus the frame moves around it", focusCalls("heading.focus(); field.focus();").join(" | "), "heading.focus() | field.focus()");
    const loud = ["not-data-quiet-focus:", "focus-visible:border-border-focus"];
    check("  a face that ignores the mark is seen, and one that reads it is not", [/\[data-quiet-focus\]/.test(cssOf(loud[1])), /\[data-quiet-focus\]/.test(cssOf(loud.join("")))].join(" "), "false true");
    const planted = parseSource('export function O() { return <button aria-haspopup="dialog" className="focus-visible:bg-hover" />; }', "<planted opener>");
    let plantedFaces = [];
    walk(planted.ast, (n) => {
        if (n.type === "JSXOpeningElement") plantedFaces = n.attributes.find((a) => a.name?.name === "className").value.value.split(" ");
    });
    check("  as is an opener whose face ignores it", plantedFaces.filter((t) => !/\[data-quiet-focus\]/.test(cssOf(t))).join(" "), "focus-visible:bg-hover");
}

if (isMain(import.meta.url)) standalone(title, run);
