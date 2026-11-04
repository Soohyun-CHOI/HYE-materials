// A field's × empties that field and nothing else, and a press on what a sheet offers leaves its field
// the caret (#605).
//
// BY VALUE, THE PRESS. `lib/controls.js:fieldClearPress` and `keepFocus` are pure: the `mousedown`
// handler prevents its default — which is what keeps focus where it is — and the click hands the field
// the empty string once, puts focus in the field once and goes no further up the page. Asserted on a
// fake event, which counts what is asked of it.
//
// OFF THE SOURCE, WHERE IT IS ASKED. Every × the app draws is found by its mark and named: a field's,
// drawn by `Controls.js:FieldClear` and nowhere else — at the five fields that end in one — or one that
// is no field's, each with why. A clear written by hand beside a field, a `Done` or a sheet's row that
// lets focus go, and a `mousedown` stopped by an arrow of its own rather than `keepFocus` are each a
// failure here.
//
// WHAT IT CANNOT SEE. A phone. What the press does to a sheet standing on a keyboard was reproduced in
// this repository's browser with a keyboard stood in — the eight events in `keepFocus`'s header — and
// what Safari does under a finger is what a phone shows (`docs/notes/design-system.md`).
//
// EXIT CODES, per `docs/notes/verification.md`: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { CONTROLS_COPY, fieldClearPress, keepFocus } from "../../../lib/controls.js";
import { REPO_ROOT, listJsFiles, parseFile, parseSource, repoPath, resolveFunction, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A field's × empties that field alone, and a sheet's presses leave its field the caret (#605)";

const CONTROLS = "app/components/Controls.js";
const FRAME = "app/components/DialogFrame.js";
const MENU = "app/components/Menu.js";

/** The fields that end in a ×, by file and the look each draws it in. */
const FIELD_CLEARS = {
    "app/components/Controls.js": ["phone", "sheet", "search"],
    "app/components/DialogFrame.js": ["dialogSearch"],
    "app/login/jobs/JobsForm.js": ["phone"],
};

/** Every × the app draws that is no field's, by file, with why each is not a field's clear. */
const OTHER_MARKS = {
    "app/components/Controls.js": "FieldClear's four looks, and a filter chip's and a toggle chip's clear: a chip holds a choice, not a typed value",
    "app/components/DialogFrame.js": "the dialog's close",
    "app/components/ListFrame.js": "the selection bar's clear, which empties a selection of rows",
    "app/components/Toast.js": "a toast's dismiss",
};

/** A fake event that counts what is asked of it. */
function fakeEvent() {
    const asked = [];
    return { asked, preventDefault: () => asked.push("preventDefault"), stopPropagation: () => asked.push("stopPropagation") };
}

/** The files under `app/` drawing `<Icon name="x" …>`, each with how many. */
function xMarks(files) {
    const out = {};
    for (const { path, ast } of files) {
        let n = 0;
        walk(ast, (node) => {
            if (node.type !== "JSXOpeningElement" || node.name?.name !== "Icon") return;
            const name = node.attributes.find((a) => a.name?.name === "name")?.value?.value;
            if (name === "x") n++;
        });
        if (n > 0) out[path] = n;
    }
    return out;
}

/** Each `<FieldClear look="…">` a source draws, by look. */
function fieldClearsIn(ast) {
    const looks = [];
    walk(ast, (node) => {
        if (node.type !== "JSXOpeningElement" || node.name?.name !== "FieldClear") return;
        looks.push(node.attributes.find((a) => a.name?.name === "look")?.value?.value ?? "?");
    });
    return looks;
}

/**
 * A × written by hand: a button drawing the x mark whose `onClick` hands something the empty string.
 * `FieldClear` hands its own over through `fieldClearPress`, which is no arrow here; a dialog's close,
 * a toast's dismiss, a chip's clear and the selection bar's empty no field, and a text button resetting
 * a search draws no ×.
 */
function handClears(ast, source) {
    let n = 0;
    walk(ast, (node) => {
        if (node.type !== "JSXElement" || node.openingElement.name?.name !== "button") return;
        let marked = false;
        walk(node, (inner) => {
            if (inner.type === "JSXOpeningElement" && inner.name?.name === "Icon" && inner.attributes.some((a) => a.name?.name === "name" && a.value?.value === "x")) marked = true;
        });
        const click = node.openingElement.attributes.find((a) => a.name?.name === "onClick")?.value;
        if (marked && click && /\(""\)/.test(source.slice(click.start, click.end))) n++;
    });
    return n;
}

/** Each `mousedown` handler written as an arrow of its own rather than `keepFocus`. */
function ownMouseDowns(source) {
    return (source.match(/onMouseDown=\{\(\w*\) => \w+\.preventDefault\(\)\}/g) ?? []).length;
}

export function run({ check, assert, log }) {
    // ── the press, by value ─────────────────────────────────────────────────
    log("the press, by value:");
    const kept = fakeEvent();
    keepFocus(kept);
    check("keepFocus prevents the mousedown's default, which moves no focus, and nothing more", kept.asked.join(" "), "preventDefault");
    const done = [];
    const press = fieldClearPress({ onChange: (value) => done.push(`onChange(${JSON.stringify(value)})`), focus: () => done.push("focus") });
    check("the clear's props are its mousedown and its click, nothing else", Object.keys(press).sort().join(" "), "onClick onMouseDown");
    check("  its mousedown is keepFocus itself", press.onMouseDown === keepFocus, true);
    const clicked = fakeEvent();
    press.onClick(clicked);
    check("  its click empties the field once, then puts focus in it once", done.join(" "), 'onChange("") focus');
    check("  and goes no further up the page, defaulting nothing away", clicked.asked.join(" "), "stopPropagation");
    check("the clear's name for assistive tech, where its field names none", CONTROLS_COPY.clear, "Clear");

    // ── where it is drawn ───────────────────────────────────────────────────
    log("");
    log("every × the app draws, found by its mark:");
    const files = listJsFiles(repoPath("app")).map((abs) => {
        const path = toPosix(relative(REPO_ROOT, abs));
        const source = readFileSync(abs, "utf8");
        return { path, source, ast: parseSource(source, path).ast };
    });
    const marks = xMarks(files);
    check("  the files drawing one, each named here with why", Object.keys(marks).sort().join(" | "), Object.keys(OTHER_MARKS).sort().join(" | "));
    const controls = parseFile(CONTROLS);
    const looks = resolveFunction(controls.ast, "FieldClear");
    check("  FieldClear spreads the one press, and draws its look's mark", [/\{\.\.\.fieldClearPress\(\{ onChange, focus \}\)\}/.test(controls.source.slice(looks?.start ?? 0, looks?.end ?? 0)), /\{mark\}/.test(controls.source.slice(looks?.start ?? 0, looks?.end ?? 0))].join(" "), "true true");
    check(
        "  and its four looks each draw the x at the field's size",
        (controls.source.match(/mark: <Icon name="x" className="(size-mobile-input-clear-icon|size-clear-icon|size-icon-sm)" \/>,/g) ?? []).length,
        4
    );
    const drawn = Object.fromEntries(files.map(({ path, ast }) => [path, fieldClearsIn(ast)]).filter(([, found]) => found.length > 0));
    check(
        "every field that ends in a × draws FieldClear, in its own look",
        Object.entries(drawn)
            .map(([path, found]) => `${path}: ${found.join(" ")}`)
            .sort()
            .join(" | "),
        Object.entries(FIELD_CLEARS)
            .map(([path, found]) => `${path}: ${found.join(" ")}`)
            .sort()
            .join(" | ")
    );
    check("  and no × is written by hand anywhere under app/", files.filter(({ ast, source }) => handClears(ast, source) > 0).map(({ path }) => path).join(" | "), "");

    // ── a sheet's presses keep the field's caret ───────────────────────────
    log("");
    log("a press on what a sheet offers leaves its field the caret:");
    const frame = parseFile(FRAME).source;
    check("  the sheet's Done stops its mousedown", /type="button"\s*onMouseDown=\{keepFocus\}\s*onClick=\{busy \? undefined : done\.onPress\}/.test(frame), true);
    check("  and so does each of SheetRows' rows", /aria-disabled=\{locked \|\| undefined\}\s*onMouseDown=\{keepFocus\}\s*onClick=\{locked \? undefined : row\.onPress\}/.test(frame), true);
    check("  the dialog's search results and a menu's options take the same press", `${/onMouseDown=\{keepFocus\}\s*onClick=\{\(\) => onPick\(result\)\}/.test(frame)} ${/onMouseDown=\{keepFocus\}\s*onClick=\{\(\) => onPick\(index\)\}/.test(parseFile(MENU).source)}`, "true true");
    check("  and no mousedown under app/ is stopped by an arrow of its own", files.filter(({ source }) => ownMouseDowns(source) > 0).map(({ path }) => path).join(" | "), "");

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — the readers are seen to fail:");
    {
        const planted = '<button onClick={() => {\n    onChange("");\n    inputRef.current?.focus();\n}}><Icon name="x" className="size-icon" /></button>';
        check("  a × written by hand is seen", handClears(parseSource(planted, "p").ast, planted), 1);
        const textClear = '<button onClick={() => { setValue(""); router.push("/materials"); }}>Clear</button>';
        check("  and a text button resetting a search is no ×", handClears(parseSource(textClear, "p").ast, textClear), 0);
    }
    check("  a mousedown stopped by its own arrow is seen", ownMouseDowns("<button onMouseDown={(event) => event.preventDefault()} />"), 1);
    check("  an x mark is found, and another mark is not", JSON.stringify(xMarks([{ path: "p", ast: parseSource('<><Icon name="x" className="size-icon" /><Icon name="plus" /></>', "p").ast }])), '{"p":1}');
    check("  a FieldClear's look is read", fieldClearsIn(parseSource('<FieldClear look="sheet" onChange={f} focus={g} />', "p").ast).join(), "sheet");
    const leaky = fakeEvent();
    fieldClearPress({ onChange: () => {}, focus: () => {} }).onMouseDown(leaky);
    assert("  a press's mousedown is seen preventing its default", leaky.asked.includes("preventDefault"));
}

if (isMain(import.meta.url)) standalone(title, run);
