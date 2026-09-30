// The dialog frame and the controls in it (#456).
//
// WHAT THIS FILE IS FOR. `app/components/DialogFrame.js` is Claude Design's 0l drawn once,
// `app/components/Controls.js` and `app/components/Menu.js` are the 0a controls the
// registration dialog is the first to use, and the landing's two dialogs call them (#459),
// as #457 and #458 will, rather than drawing their own. So what they are held to is held
// here, where each of those issues will run into it:
//
//   1. THE KEYS. WAI-ARIA's select-only combobox and its editable combobox with list
//      autocomplete are the two patterns, and `lib/controls.js` says what each key does
//      as pure functions — held by value, key by key, open and shut, at the ends of a
//      list. The keyboard is the whole of what makes either usable without a pointer.
//   2. THE WIRING. Which role, which `aria-*` and which reader each control applies is
//      read off the source, because a combobox that looks right and names no listbox is
//      silent to a screen reader and moves no figure this tier can read.
//   3. THE FRAME. The browser's own modal dialog (`showModal`), Escape asking the owner
//      and turned down while busy, the caret put in the first field that takes typing,
//      and the list put in the top layer through the Popover API — and since #459 a
//      dialog no press opened handing focus to the page's heading as it closes, the
//      sentence a dialog says describing that dialog, and the actions wrapping on a
//      narrow dialog rather than running off it.
//   4. THE WORDS. Every string these three render comes from `lib/dialogFrame.js` or
//      `lib/controls.js`, pinned by value, and none is in their markup — the rule
//      `offline/tool-list-view.mjs` holds for every file under `app/(tools)/`, which these
//      do not sit under.
//   5. THE SECOND FRAME, AND WHEN IT ENDS. Two dialogs on the tool item page are still drawn
//      on `app/components/modalStyles.js`; #458 moves them onto this frame. They are named
//      here, so a third drawn the old way fails and #458 empties the list — the measurable
//      condition CLAUDE.md's "one rule, one implementation" asks for, made executable.
//
// WHAT IT CANNOT SEE. Anything rendered: whether the dialog is centered, whether the list
// lands under its field, whether focus really returns to the opener, whether a screen
// reader announces what `aria-activedescendant` names. The browser run in the pull request
// is where those were looked at. It also cannot see a key handled somewhere this file does
// not read — the components apply `lib/controls.js`'s answers and the check reads that
// they call them, not that nothing else runs.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import {
    CONTROLS_COPY,
    editableComboboxKey,
    movedIndex,
    numberFieldText,
    selectOnlyKey,
    stepNumber,
    typeaheadIndex,
} from "../../../lib/controls.js";
import { DIALOG_FRAME_COPY } from "../../../lib/dialogFrame.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The dialog frame and the controls in it (#456, #459)";

const FRAME = "app/components/DialogFrame.js";
const CONTROLS = "app/components/Controls.js";
const MENU = "app/components/Menu.js";

/**
 * The tools files still drawing a dialog on `modalStyles.js`, and the issue that moves each
 * onto the frame. #458 empties this; a file added to it is a second frame growing.
 */
const OLD_FRAME = new Map([
    ["app/(tools)/tool-items/[toolItemId]/RetireToolItemForm.js", 458],
    ["app/(tools)/tool-items/[toolItemId]/ToolTransitionForm.js", 458],
]);

/** Attributes whose value a person reads or hears, and so must come from a constant. */
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "alt", "aria-label"]);

/** A key as a handler receives it. */
const key = (name, mods = {}) => ({ key: name, altKey: false, ctrlKey: false, metaKey: false, ...mods });

/** Every JSX opening element named `tag` in a file, with its attributes by name. */
function elements(ast, tag) {
    const out = [];
    walk(ast, (n) => {
        if (n.type !== "JSXOpeningElement" || n.name?.name !== tag) return;
        const attributes = {};
        for (const a of n.attributes) {
            if (a.type !== "JSXAttribute") continue;
            const value = a.value;
            attributes[a.name?.name] =
                value === null
                    ? true
                    : value?.type === "Literal"
                      ? value.value
                      : value?.expression?.type === "Literal"
                        ? value.expression.value
                        : "{expression}";
        }
        out.push(attributes);
    });
    return out;
}

/** The names a file calls, as `a.b.c` for a member call. */
function calls(ast) {
    const out = new Set();
    const nameOf = (node) =>
        node?.type === "Identifier"
            ? node.name
            : node?.type === "MemberExpression" && !node.computed
              ? `${nameOf(node.object)}.${node.property.name}`
              : "?";
    walk(ast, (n) => {
        if (n.type === "CallExpression") out.add(nameOf(n.callee));
    });
    return out;
}

/** The function declared under `name` in a file — exported or not — or null. */
function functionNamed(ast, name) {
    let found = null;
    walk(ast, (n) => {
        if (!found && n.type === "FunctionDeclaration" && n.id?.name === name) found = n;
    });
    return found;
}

/** Copy written into markup: text between tags, a string in braces, a visible attribute. */
function markupCopy(ast) {
    const found = [];
    walk(ast, (n) => {
        if (n.type === "JSXText" && n.value.trim()) found.push(`text ${JSON.stringify(n.value.trim())}`);
        if (n.type === "JSXExpressionContainer" && n.expression?.type === "Literal" && typeof n.expression.value === "string")
            found.push(`string ${JSON.stringify(n.expression.value)}`);
        if (
            n.type === "JSXAttribute" &&
            VISIBLE_ATTRIBUTES.has(n.name?.name) &&
            (n.value?.type === "Literal" || n.value?.expression?.type === "Literal")
        )
            found.push(`attribute ${n.name.name}`);
    });
    return found;
}

export function run({ check, assert, log }) {
    // ── 1: the keys ─────────────────────────────────────────────────────────
    log("a choice's keys are the select-only combobox's:");
    for (const [name, mods, open, expected] of [
        ["ArrowDown", {}, false, "open"],
        ["ArrowUp", {}, false, "open"],
        ["Enter", {}, false, "open"],
        [" ", {}, false, "open"],
        ["Home", {}, false, "first"],
        ["End", {}, false, "last"],
        ["p", {}, false, "type"],
        ["PageDown", {}, false, null],
        ["Escape", {}, false, null],
        ["ArrowDown", {}, true, "next"],
        ["ArrowUp", {}, true, "previous"],
        ["ArrowUp", { altKey: true }, true, "closeSelect"],
        ["PageUp", {}, true, "pageUp"],
        ["PageDown", {}, true, "pageDown"],
        ["Home", {}, true, "first"],
        ["End", {}, true, "last"],
        ["Enter", {}, true, "closeSelect"],
        [" ", {}, true, "closeSelect"],
        ["Escape", {}, true, "close"],
        ["p", {}, true, "type"],
        ["p", { ctrlKey: true }, true, null],
        ["Tab", {}, true, null],
    ])
        check(`  ${open ? "open" : "shut"}, ${JSON.stringify(name)}${mods.altKey ? " with Alt" : mods.ctrlKey ? " with Ctrl" : ""}`, selectOnlyKey(key(name, mods), open), expected);
    log("and it moves within the list, stopping at its ends:");
    check("  down from nothing reaches the first", movedIndex(-1, 4, "next"), 0);
    check("  down from the last stays", movedIndex(4, 4, "next"), 4);
    check("  up from the first stays", movedIndex(0, 4, "previous"), 0);
    check("  a page down stops at the last", movedIndex(1, 4, "pageDown"), 4);
    check("  a page up of eleven moves ten", movedIndex(11, 20, "pageUp"), 1);
    check("  and the ends are the ends", `${movedIndex(3, 4, "first")} ${movedIndex(0, 4, "last")}`, "0 4");
    log("and a typed search lands on what starts with it:");
    const labels = ["Fremont Line 3", "Pier 48 Retrofit", "Pier 50", "Redwood City WWTP"];
    check("  the first that begins with it", typeaheadIndex(labels, "pi", 0), 1);
    check("  searching on from where it stands", typeaheadIndex(labels, "pier 5", 2), 2);
    check("  the same letter again reaches the next", typeaheadIndex(labels, "pp", 2), 2);
    check("  and wraps round", typeaheadIndex(labels, "f", 3), 0);
    check("  and nothing matching is nothing", typeaheadIndex(labels, "zz", 0), -1);

    log("");
    log("a typed value's keys are the editable combobox's, with manual selection:");
    const shown = { shown: true, active: -1, count: 3 };
    const onSecond = { shown: true, active: 1, count: 3 };
    const onLast = { shown: true, active: 2, count: 3 };
    const shut = { shown: false, active: -1, count: 3 };
    const answer = (name, state, mods) => JSON.stringify(editableComboboxKey(key(name, mods), state));
    check("  Down enters the list at its first", answer("ArrowDown", shown), JSON.stringify({ shown: true, active: 0, stop: true }));
    check("  and moves on inside it", answer("ArrowDown", onSecond), JSON.stringify({ shown: true, active: 2, stop: true }));
    check("  wrapping from the last to the first", answer("ArrowDown", onLast), JSON.stringify({ shown: true, active: 0, stop: true }));
    check("  Up enters it at its last", answer("ArrowUp", shown), JSON.stringify({ shown: true, active: 2, stop: true }));
    check("  and wraps from the first to the last", answer("ArrowUp", { ...onSecond, active: 0 }), JSON.stringify({ shown: true, active: 2, stop: true }));
    check("  Alt with Down shows the list and moves nothing", answer("ArrowDown", shut, { altKey: true }), JSON.stringify({ shown: true, active: -1, stop: true }));
    check("  Down with nothing to suggest does nothing", answer("ArrowDown", { ...shown, count: 0 }), "null");
    check("  Enter accepts what is under visual focus", answer("Enter", onSecond), JSON.stringify({ shown: false, active: -1, accept: 1, stop: true }));
    check("  and with nothing under it shuts the list and lets the form submit", answer("Enter", shown), JSON.stringify({ shown: false, active: -1, stop: false }));
    check("  Enter with the list shut is the form's", answer("Enter", shut), "null");
    check("  Tab accepts and still leaves", answer("Tab", onSecond), JSON.stringify({ shown: false, active: -1, accept: 1, stop: false }));
    check("  Escape shuts a list that shows, and stops there", answer("Escape", onSecond), JSON.stringify({ shown: false, active: -1, stop: true }));
    check("  and with the list shut is the dialog's", answer("Escape", shut), "null");
    check("  a side arrow hands focus back to the textbox", answer("ArrowLeft", onSecond), JSON.stringify({ shown: true, active: -1, stop: false }));
    check("  and a letter is the textbox's own", answer("a", onSecond), "null");

    log("");
    log("a number field's steps and what it keeps of a keystroke:");
    const range = { min: 1, max: 100 };
    check("  a step up", stepNumber("4", 1, range), "5");
    check("  a step down", stepNumber("4", -1, range), "3");
    check("  never under the bottom", stepNumber("1", -1, range), "1");
    check("  never over the top", stepNumber("100", 1, range), "100");
    check("  up from nothing is the bottom", stepNumber("", 1, range), "1");
    check("  and so is down", stepNumber("", -1, range), "1");
    check("  a figure past the top steps down by one, and is still refused", stepNumber("140", -1, range), "139");
    check("  and up comes back to the top", stepNumber("140", 1, range), "100");
    check("  a keystroke keeps its digits", numberFieldText("1a2", 100), "12");
    check("  and one more than the ceiling has, so too many can still be typed", numberFieldText("14000", 100), "1400");

    // ── 2: the wiring ───────────────────────────────────────────────────────
    log("");
    log("each control says what it is to a screen reader, as its pattern does:");
    const controls = parseFile(CONTROLS);
    const [choice] = elements(controls.ast, "div").filter((a) => a.role === "combobox");
    assert("  a choice is a combobox", Boolean(choice));
    check(
        "  on a focusable element naming its list, its state and its label",
        ["tabIndex", "aria-controls", "aria-expanded", "aria-haspopup", "aria-labelledby", "aria-activedescendant"]
            .filter((name) => !(name in (choice ?? {})))
            .join(", "),
        ""
    );
    check("  whose list is a listbox", choice?.["aria-haspopup"], "listbox");
    const [typed] = elements(controls.ast, "input").filter((a) => a.role === "combobox");
    assert("  a typed value is a combobox on its own input", Boolean(typed));
    check("  completing from a list", typed?.["aria-autocomplete"], "list");
    check(
        "  naming its list, its state and the option under visual focus",
        ["aria-controls", "aria-expanded", "aria-activedescendant"].filter((name) => !(name in (typed ?? {}))).join(", "),
        ""
    );
    const controlCalls = calls(controls.ast);
    check(
        "  and each applies its pattern's keys from lib/controls.js",
        ["selectOnlyKey", "movedIndex", "typeaheadIndex", "editableComboboxKey", "stepNumber", "numberFieldText"]
            .filter((name) => !controlCalls.has(name))
            .join(", "),
        ""
    );
    // Each combobox stops a key it answers, so Escape that shuts a list shuts nothing more:
    // held per control, since one control stopping would leave the other's list and the
    // dialog around it closing on one press.
    check(
        "  each stopping a key it answers, so a dialog around it stays open",
        ["Choice", "Combobox"].filter((name) => !calls(functionNamed(controls.ast, name) ?? {}).has("event.stopPropagation")).join(", "),
        ""
    );
    const [explainedButton] = elements(functionNamed(controls.ast, "Button") ?? {}, "button");
    assert(
        "  and an action that cannot act names its reason as its description",
        Boolean(explainedButton) && "aria-describedby" in explainedButton
    );

    const menu = parseFile(MENU);
    const [list] = elements(menu.ast, "div").filter((a) => a.role === "listbox");
    check("the list is a listbox in the top layer, dismissed only by its control", list?.popover, "manual");
    assert("  named by its field's label", "aria-labelledby" in (list ?? {}));
    const [option] = elements(menu.ast, "div").filter((a) => a.role === "option");
    assert("  holding options that say whether each is selected", Boolean(option) && "aria-selected" in option && "id" in option);
    const menuCalls = calls(menu.ast);
    check(
        "  shown and hidden through the Popover API, and pressed without taking focus",
        ["list.showPopover", "list.hidePopover", "event.preventDefault"].filter((name) => !menuCalls.has(name)).join(", "),
        ""
    );

    // ── 3: the frame ────────────────────────────────────────────────────────
    log("");
    log("the frame is the browser's own modal dialog, closed only by its owner:");
    const frame = parseFile(FRAME);
    const frameCalls = calls(frame.ast);
    check("  it is a <dialog>", elements(frame.ast, "dialog").length, 1);
    check(
        "  opened with showModal, closed with close, the caret put in its first field",
        ["dialog.showModal", "dialog.close", "focus"].filter((name) => ![...frameCalls].some((call) => call === name || call.endsWith(`.${name}`))).join(", "),
        ""
    );
    const cancelSource = (() => {
        let body = null;
        walk(frame.ast, (n) => {
            if (n.type === "JSXAttribute" && n.name?.name === "onCancel") body = frame.source.slice(n.value.start, n.value.end);
        });
        return body ?? "";
    })();
    assert("  Escape is turned down by the browser and asked of the owner", /preventDefault\(\)/.test(cancelSource) && /ask\(\)/.test(cancelSource));
    let asksOnlyWhenIdle = false;
    walk(frame.ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "ask")
            asksOnlyWhenIdle = /if \(!busy\) onClose\(\)/.test(frame.source.slice(n.init.start, n.init.end));
    });
    check("  and nothing asks while it is busy", asksOnlyWhenIdle, true);
    check("  its first field is one that takes typing", /querySelector\("input:not\(\[type=hidden\]\)"\)/.test(frame.source), true);

    // WHAT A DIALOG NO PRESS OPENED, AND A DIALOG THAT SAYS SOMETHING, ASK OF THE FRAME (#459).
    // The browser hands focus back to what held it when the dialog opened, which for one a
    // page opens on arrival is nothing, so the frame hands it to the page's heading — made
    // focusable where the page did not — and only for a dialog marked so, as it closes. A
    // dialog's sentence names itself as its dialog's description and takes that away as it
    // goes; and the actions wrap, since an action drawn disabled carries its reason before it.
    // Read through one function, so the planted frame below is judged the same way.
    const frameFacts = ({ ast, source }) => {
        const body = (name) => {
            const fn = functionNamed(ast, name);
            return fn ? source.slice(fn.start, fn.end) : "";
        };
        const heading = body("focusPageHeading");
        const message = body("DialogMessage");
        const actionRow =
            elements(functionNamed(ast, "DialogActions") ?? {}, "div")
                .map((a) => a.className)
                .find((c) => typeof c === "string" && c.includes("justify-end")) ?? "";
        return {
            heading: [/querySelector\("h1"\)/.test(heading), /tabIndex = -1/.test(heading), /\.focus\(\)/.test(heading)].join(" "),
            onClose: /dialog\.close\(\);\s*if \(unprompted\) focusPageHeading\(\);/.test(source),
            describes: [
                /closest\("dialog"\)/.test(message),
                /setAttribute\("aria-describedby", id\)/.test(message),
                /removeAttribute\("aria-describedby"\)/.test(message),
            ].join(" "),
            wraps: /\bflex-wrap\b/.test(actionRow),
        };
    };
    const frameRules = frameFacts(frame);
    check("  a dialog no press opened hands focus to the page's heading, made focusable", frameRules.heading, "true true true");
    check("  and only one marked unprompted, in the branch that closes it", frameRules.onClose, true);
    check("  a dialog's sentence describes the dialog it stands in, and stops when it goes", frameRules.describes, "true true true");
    check("  and the actions wrap rather than run off a narrow dialog", frameRules.wraps, true);

    // ── 4: the words ────────────────────────────────────────────────────────
    log("");
    log("every word they render comes from a constant:");
    check("the frame's close", DIALOG_FRAME_COPY.close, "Close");
    check("a number field's step down", CONTROLS_COPY.fewer, "One fewer");
    check("  and up", CONTROLS_COPY.more, "One more");
    for (const [label, parsed] of [
        ["the frame", frame],
        ["the controls", controls],
        ["the list", menu],
    ]) {
        const found = markupCopy(parsed.ast);
        check(`  no copy in ${label}'s markup${found.length ? ` (${found[0]})` : ""}`, found.length, 0);
    }

    // ── 5: the second frame, and when it ends ───────────────────────────────
    log("");
    log("the tools files drawing a dialog on the old frame are the two #458 moves:");
    const toolsFiles = listJsFiles(repoPath("app/(tools)")).map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
    const onOldFrame = toolsFiles.filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/modalStyles")).sort();
    check("  the files", onOldFrame.join(", "), [...OLD_FRAME.keys()].sort().join(", "));
    check("  each waiting on #458", [...new Set(OLD_FRAME.values())].join(), "458");
    const onNewFrame = toolsFiles.filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/DialogFrame")).sort();
    // The registration's dialog (#456) and the landing's two (#459).
    check(
        "  and the frame's callers on the axis are the three dialogs drawn on it",
        onNewFrame.join(", "),
        [
            "app/(tools)/tools/RegistrationDialog.js",
            "app/(tools)/tools/[toolRecordId]/RegistrationShortfall.js",
            "app/(tools)/tools/[toolRecordId]/RegistrationUnlogged.js",
        ]
            .sort()
            .join(", ")
    );

    // ── anti-vacuity ────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // The markup reader finds each shape of copy it bars, on a planted component.
    const planted = parseSource(
        'export function X() { return <div role="combobox" aria-label="Close">Choose<b>{"More"}</b></div>; }',
        "<planted-copy>"
    ).ast;
    check("  a planted component's copy is found three ways", markupCopy(planted).length, 3);
    // The element reader tells a combobox missing its wiring from a wired one.
    const [bare] = elements(parseSource('export const Y = () => <div role="combobox" tabIndex={0} />;', "<planted-bare>").ast, "div");
    assert("  a combobox naming no list is seen so", !("aria-controls" in bare) && bare.role === "combobox");
    // The key functions are seen to answer differently open and shut, since a function
    // answering one constant would pass several rows above.
    assert("  Enter opens a shut choice and chooses in an open one", selectOnlyKey(key("Enter"), false) !== selectOnlyKey(key("Enter"), true));
    assert("  and Escape is a typed value's only while its list shows", editableComboboxKey(key("Escape"), shown) !== null && editableComboboxKey(key("Escape"), shut) === null);
    // The per-control reader is seen to tell a control that stops a key from one that
    // does not, and a button naming its reason from one that names none.
    const plantedControls = parseSource(
        "export function Choice() { const k = (event) => { event.stopPropagation(); }; return <div />; }\n" +
            "export function Combobox() { const k = (event) => { event.preventDefault(); }; return <input />; }\n" +
            "export function Button() { return <button disabled>{x}</button>; }\n",
        "<planted-controls>"
    ).ast;
    check(
        "  a control that does not stop the key is seen",
        ["Choice", "Combobox"].filter((name) => !calls(functionNamed(plantedControls, name) ?? {}).has("event.stopPropagation")).join(", "),
        "Combobox"
    );
    assert(
        "  and a button naming no reason is seen",
        !("aria-describedby" in (elements(functionNamed(plantedControls, "Button") ?? {}, "button")[0] ?? {}))
    );
    // The old-frame census is seen to read a file's imports rather than to list the table.
    assert(
        "  the census finds the old frame in a file that imports it",
        onOldFrame.includes("app/(tools)/tool-items/[toolItemId]/RetireToolItemForm.js")
    );
    // The frame's #459 rules are seen to fail on a frame that keeps the browser's own return,
    // hands focus back on every close, names no description and holds its actions on a line.
    const plantedFrame = frameFacts(
        parseSource(
            'function focusPageHeading() { document.querySelector("main")?.focus(); }\n' +
                "export function DialogFrame({ open }) { useLayoutEffect(() => { if (!open) { dialog.close(); focusPageHeading(); } }, [open]); }\n" +
                "export function DialogMessage({ children }) { return <p>{children}</p>; }\n" +
                'export function DialogActions({ children }) { return <div className="flex justify-end gap-gap">{children}</div>; }\n',
            "<planted-frame>"
        )
    );
    check("  a heading neither found nor made focusable is seen", plantedFrame.heading, "false false true");
    check("  a return to it on every close is seen", plantedFrame.onClose, false);
    check("  a sentence describing nothing is seen", plantedFrame.describes, "false false false");
    check("  and actions held on one line are seen", plantedFrame.wraps, false);
}

if (isMain(import.meta.url)) standalone(title, run);
