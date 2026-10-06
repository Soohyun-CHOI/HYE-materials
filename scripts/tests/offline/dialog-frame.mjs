// The dialog frame and the controls in it (#456).
//
// WHAT THIS FILE IS FOR. `app/components/DialogFrame.js` is Claude Design's 0l drawn once,
// `app/components/Controls.js` and `app/components/Menu.js` are the 0a controls the
// registration dialog is the first to use, and the landing's two dialogs call them (#459),
// as the labels' does (#457) and the tool item page's do (#458), rather than drawing their
// own. So what they are held to is held here, where each of those issues ran into it:
//
//   1. THE KEYS. WAI-ARIA's select-only combobox and its editable combobox with list
//      autocomplete are the two patterns, and `lib/controls.js` says what each key does
//      as pure functions — held by value, key by key, open and shut, at the ends of a
//      list. The keyboard is the whole of what makes either usable without a pointer.
//      Since #478 the menu button is the third, for the menu the rail's account opens.
//   2. THE WIRING. Which role, which `aria-*` and which reader each control applies is
//      read off the source, because a combobox that looks right and names no listbox is
//      silent to a screen reader and moves no figure this tier can read.
//   3. THE FRAME. The browser's own modal dialog (`showModal`), Escape asking the owner
//      and turned down while busy, the caret put in the first field that takes typing,
//      and the list put in the top layer through the Popover API — and since #459 a
//      dialog no press opened handing focus to the page's heading as it closes, the
//      sentence a dialog says describing that dialog, and the actions wrapping on a
//      narrow dialog rather than running off it — and since #457 the second build, a
//      preview in a pane beside a column that is the Compact build inside — and since
//      #458 0l's Confirm, the phone's sheet a dialog marked so becomes below the phone's
//      edge, the sizes its controls take there, the backdrop that closes 1f's sheets
//      only while they are sheets, and a dialog taken off the page handing focus on.
//   4. THE WORDS. Every string these three render comes from `lib/dialogFrame.js` or
//      `lib/controls.js`, pinned by value, and none is in their markup — the rule
//      `offline/tool-list-view.mjs` holds for every file under `app/(tools)/`, which these
//      do not sit under.
//   5. ONE FRAME ON THE TOOLS AXIS. The tool item page's two dialogs were the last drawn on
//      `app/components/modalStyles.js`, and #458 moved them onto this frame, so a file
//      under `app/(tools)/` importing it fails — the measurable condition CLAUDE.md's "one
//      rule, one implementation" asked for, met.
//   6. A DIALOG THAT SUBMITS (#469). The frame hands its `busy` to everything it holds: the
//      form's submit draws 0f's Working and every other control locks, none disabled, and
//      while it is open the frame puts back focus it let fall. What a button is under a busy
//      form and whether focus has fallen are pure functions, held by value; that each control
//      applies the first, that the frame asks the second and where it puts focus are read
//      off the source; and every dialog on the axis that submits is found and held to
//      handing its frame its busy state and its commitment a word, with nothing disabled
//      for the sending.
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
    buttonBusyState,
    editableComboboxKey,
    menuButtonKey,
    menuIndex,
    menuKey,
    movedIndex,
    numberFieldText,
    selectOnlyKey,
    stepNumber,
    typeaheadIndex,
} from "../../../lib/controls.js";
import { DIALOG_FRAME_COPY, focusLost } from "../../../lib/dialogFrame.js";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The dialog frame and the controls in it (#456, #459, #458, #469)";

const FRAME = "app/components/DialogFrame.js";
const CONTROLS = "app/components/Controls.js";
const MENU = "app/components/Menu.js";
const ACCOUNT = "app/components/RailAccount.js";

/**
 * Whether a file draws a dialog on `modalStyles.js` — which no file under `app/(tools)/`
 * does since #458 moved the tool item page's two onto the frame. One found is a second
 * frame growing back.
 */
const drawsOldFrame = (text) => text.includes("@/app/components/modalStyles");

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
    log("a menu button's keys are the menu button pattern's (#478):");
    check("  shut, Down opens it on its first item", menuButtonKey(key("ArrowDown")), "first");
    check("  and Up on its last", menuButtonKey(key("ArrowUp")), "last");
    check("  Enter and Space are the button's own press", `${menuButtonKey(key("Enter"))} ${menuButtonKey(key(" "))}`, "null null");
    for (const [name, mods, expected] of [
        ["ArrowDown", {}, "next"],
        ["ArrowUp", {}, "previous"],
        ["Home", {}, "first"],
        ["End", {}, "last"],
        ["Escape", {}, "close"],
        ["Tab", {}, "leave"],
        ["s", {}, "type"],
        ["s", { ctrlKey: true }, null],
        ["Enter", {}, null],
        [" ", {}, null],
    ])
        check(`  open, ${JSON.stringify(name)}${mods.ctrlKey ? " with Ctrl" : ""}`, menuKey(key(name, mods)), expected);
    log("and it moves among its items, wrapping at both ends:");
    check("  down from the last reaches the first", menuIndex(2, 3, "next"), 0);
    check("  up from the first reaches the last", menuIndex(0, 3, "previous"), 2);
    check("  and the ends are the ends", `${menuIndex(1, 3, "first")} ${menuIndex(1, 3, "last")}`, "0 2");
    check("  one item is every end", `${menuIndex(0, 1, "next")} ${menuIndex(0, 1, "previous")}`, "0 0");

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

    // IN A SHEET BELOW THE PHONE'S EDGE THE CONTROLS TAKE THE PHONE'S SIZES (#458), and
    // there or on a sign-in page only: every such class is `max-sm:in-data-[sheet]:`, so the
    // width and the ancestor both decide it in CSS and a control in a desk's dialog keeps
    // 0a's — or it sits where only a sign-in page's control goes (#473): the `xl` size's own
    // classes, a branch on `xl`, `labelHidden` or `suffix`, or the clear × only `xl` draws —
    // and since #495 a branch on a refusal's `centered`, which the sign-in steps alone pass.
    // A destructive commitment is filled red (0f Destructive), and a busy action of any kind
    // takes no hover and no press (0f Working), nor does one locked with it (#469) — both are
    // `aria-disabled`, which every hover and press is written against. Read through one
    // function, so the planted controls below are judged the same way.
    const SIGN_IN_GATE = /\bxl\b|size === "xl"|\blabelHidden\b|\bsuffix\b|\bcentered\b/;
    const controlFacts = ({ ast, source }) => {
        const constant = (name) => {
            let text = "";
            walk(ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) text = source.slice(n.init.start, n.init.end);
            });
            return text;
        };
        const sheetButton = constant("SHEET_BUTTON");
        const sheetVariants = constant("SHEET_BUTTON_VARIANT");
        const variants = constant("BUTTON_VARIANT");
        const functionSource = (name) => {
            const fn = functionNamed(ast, name);
            return fn ? source.slice(fn.start, fn.end) : "";
        };
        const sheetFieldSource = functionSource("SheetField");
        const parents = parentMap(ast);
        const signInOnly = (node) => {
            for (let child = node, cur = parents.get(node); cur; child = cur, cur = parents.get(cur)) {
                if (cur.type === "Property" && (cur.key?.name ?? cur.key?.value) === "xl") return true;
                if (cur.type === "ConditionalExpression" && child === cur.consequent && SIGN_IN_GATE.test(source.slice(cur.test.start, cur.test.end))) return true;
                if (cur.type === "LogicalExpression" && cur.operator === "&&" && child === cur.right && SIGN_IN_GATE.test(source.slice(cur.left.start, cur.left.end))) return true;
                if (cur.type === "FunctionDeclaration" && cur.id?.name === "ClearButton") return true;
            }
            return false;
        };
        const phoneClasses = [];
        walk(ast, (n) => {
            const text = n.type === "Literal" && typeof n.value === "string" ? n.value : n.type === "TemplateElement" ? (n.value.cooked ?? n.value.raw) : null;
            if (text === null || signInOnly(n)) return;
            for (const [cls] of text.matchAll(/max-sm:(?!in-data-\[sheet\]:)[\w[\]-]+/g)) if (!cls.startsWith("max-sm:hidden")) phoneClasses.push(cls);
        });
        return {
            danger: /danger: "bg-danger text-white not-disabled:not-aria-disabled:hover:bg-danger-hover"/.test(variants),
            busyQuiet: !/(?<!not-aria-disabled:)(?:hover|active):/.test(variants + sheetVariants),
            clearGate: /const clearable = size === "xl" &&/.test(source) && /\{clearable && \(\s*<ClearButton/.test(source),
            sheetButton: [
                /max-sm:in-data-\[sheet\]:h-mobile-dialog-button/.test(sheetButton),
                /max-sm:in-data-\[sheet\]:w-full/.test(sheetButton),
                /max-sm:in-data-\[sheet\]:text-mobile-heading/.test(sheetButton),
            ].join(" "),
            textButton: /bordered:\s*"max-sm:in-data-\[sheet\]:border-0 max-sm:in-data-\[sheet\]:bg-transparent max-sm:in-data-\[sheet\]:not-aria-disabled:active:opacity-mobile-pressed"/.test(sheetVariants),
            applied: ["Button", "ButtonLink"].every((name) =>
                /\$\{BUTTON\} \$\{BUTTON_SIZE\[size\]\} \$\{BUTTON_VARIANT\[variant\]\} \$\{SHEET_BUTTON\} \$\{SHEET_BUTTON_VARIANT\[variant\]\}/.test(functionSource(name))
            ),
            label: /const FIELD_LABEL = "[^"]*max-sm:in-data-\[sheet\]:text-mobile-body-sm"/.test(source),
            refusal: /role="alert"[\s\S]*max-sm:in-data-\[sheet\]:text-mobile-body-sm/.test(functionSource("Refusal")),
            // A refusal of the whole dialog is a message in Ink 2 behind the 16 info mark, 6 from
            // it, since 0l's final drawing (#495): Red is a field's refusal, and none is here.
            refusalMessage: [
                /\btext-foreground-muted\b/.test(functionSource("Refusal")),
                /<InfoMark size="size-icon"/.test(functionSource("Refusal")),
                /\bgap-refusal-gap\b/.test(functionSource("Refusal")),
                !/danger/.test(functionSource("Refusal")),
            ].join(" "),
            // And centered it is a sign-in step's line (0o, #495): centered from the phone's edge
            // up, and below it set left at 15 and 4 in, as the line under a code stands.
            refusalCentered:
                /\$\{\s*centered\s*\?\s*"justify-center max-sm:justify-start max-sm:gap-mobile-input-message-gap max-sm:px-mobile-input-message-inset-x max-sm:text-mobile-body-sm"\s*:\s*"max-sm:in-data-\[sheet\]:text-mobile-body-sm"\s*\}/.test(
                    functionSource("Refusal")
                ),
            // An action as wide as its words keeps its resting width (0f Working, #495): what it
            // shows while busy is laid over its label rather than sharing a cell with it.
            overLabel: [
                /const BUTTON = "relative /.test(source),
                /invisible absolute inset-0 /.test(functionSource("ButtonLabel")),
                !/\bgrid\b/.test(functionSource("ButtonLabel")),
            ].join(" "),
            phoneOnlyInSheet: phoneClasses.length,
            sheetField: [
                /\bsm:hidden\b/.test(sheetFieldSource),
                /aria-haspopup="dialog"/.test(sheetFieldSource),
                // Named by its label and its value — by its label alone while a field with an
                // icon holds nothing, since its placeholder is then the label's own words (#463).
                /const named = icon && !value \? field\.labelId : field\.labelId \? `\$\{field\.labelId\} \$\{valueId\}` : valueId;/.test(sheetFieldSource) &&
                    /aria-labelledby=\{named\}/.test(sheetFieldSource),
                /if \(!onOpen\) \{\s*return \(?\s*<div/.test(sheetFieldSource),
            ].join(" "),
            heading: /heading=\{heading\}/.test(source),
        };
    };
    const controlRules = controlFacts(controls);
    check("a destructive commitment is filled red and hovers to Red's hover", controlRules.danger, true);
    check("  and no busy or locked action changes its fill under the pointer or a press, at a desk or in a sheet", controlRules.busyQuiet, true);
    check("in a sheet below the phone's edge a button is 48, full width and 17", controlRules.sheetButton, "true true true");
    check("  a bordered one a text button that dims while held", controlRules.textButton, true);
    check("  every button carrying both, which only a sheet's ancestor sets off", controlRules.applied, true);
    check("  and a field's label 15 there", controlRules.label, true);
    check("  and a refusal of the whole dialog 15 there, in the refusal every form shares", controlRules.refusal, true);
    check("a refusal of the whole dialog is Ink 2 behind the info mark, 6 from it, and never Red (#495)", controlRules.refusalMessage, "true true true true");
    check("  and centered, a sign-in step's: centered from the phone's edge up, below it set left at 15 and 4 in (#495)", controlRules.refusalCentered, true);
    // `centered` IS A SIGN-IN STEP'S ALONE, which is what lets the phone-size rule below excuse
    // it: a dialog drawing one would put the step's phone sizes outside a sheet.
    const centeredRefusals = listJsFiles(repoPath("app"))
        .map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1))
        .filter((rel) => {
            let found = false;
            walk(parseFile(rel).ast, (n) => {
                if (n.type === "JSXOpeningElement" && n.name?.name === "Refusal" && n.attributes.some((a) => a.name?.name === "centered")) found = true;
            });
            return found;
        });
    check("  drawn centered by the sign-in steps alone", centeredRefusals.join(" | "), "app/login/SignInParts.js");
    check("a busy action keeps its resting width, what it shows laid over its label (#495)", controlRules.overLabel, "true true true");
    check("no phone size reaches a control outside a sheet but a sign-in page's", controlRules.phoneOnlyInSheet, 0);
    check("  and the clear × that carries one is drawn only at a sign-in page's size", controlRules.clearGate, true);
    check(
        "the phone's own field is drawn only below its edge, opens a dialog and is named by its label and its value",
        controlRules.sheetField,
        "true true true true"
    );
    check("the combobox hands its list a head", controlRules.heading, true);

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
    // A LIST'S HEAD (#458) is a word above its options that a screen reader does not
    // hear: the list is named by its field's label, and a listbox owns options alone.
    const headFacts = ({ ast, source }) => {
        const fn = functionNamed(ast, "Menu") ?? ast;
        const heads = elements(fn, "div").filter((a) => a["aria-hidden"] === "true");
        const body = source.slice(fn.start, fn.end);
        return `${heads.length} ${/\{heading && \(/.test(body)} ${body.indexOf("{heading && (") < body.indexOf("{options.map(")}`;
    };
    check("  a head above its options when it is handed one, hidden from a screen reader", headFacts(menu), "1 true true");
    // The other half of 0a's Menu (#478): a button's menu, which takes focus.
    const [actions] = elements(menu.ast, "div").filter((a) => a.role === "menu");
    check("a button's menu is a menu in the top layer, closed by its own handlers", actions?.popover, "manual");
    assert("  named by the button that opens it", "aria-labelledby" in (actions ?? {}));
    let itemTabIndex = null;
    walk(menu.ast, (n) => {
        if (n.type !== "JSXOpeningElement" || !n.attributes.some((a) => a.name?.name === "role" && a.value?.value === "menuitem")) return;
        const value = n.attributes.find((a) => a.name?.name === "tabIndex")?.value?.expression;
        itemTabIndex = value?.type === "UnaryExpression" && value.operator === "-" ? -value.argument.value : value?.value ?? null;
    });
    check("  holding items that take focus by script and never by Tab", itemTabIndex, -1);
    check("  and applying the menu's keys", ["menuKey", "menuIndex"].filter((name) => !menuCalls.has(name)).join(", "), "");

    // #495 — 0a's head is 12 at 400 in Ink 3, 6 above and below and 10 either side, and both
    // lists draw it; a field's list sets its options at 13 and a typed fragment's match at
    // 600; the account's menu is 224, grows in from the corner by its button and stands beside
    // a collapsed one; and the account a phone's menu ends on is a row of its own.
    const menuSource = menu.source;
    const menuConstant = (name) => {
        let text = "";
        walk(menu.ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) text = menuSource.slice(n.init.start, n.init.end);
        });
        return text;
    };
    check(
        "a menu's head is 0a's: 12 at 400 in Ink 3, 6 above and below, 10 either side (#495)",
        ["py-menu-heading-inset-y", "px-control-inset-x", "text-heading-sm", "font-normal", "text-foreground-subtle"].filter((t) => !menuConstant("MENU_HEADING").includes(t)).join(" "),
        ""
    );
    check("  and both lists draw it", (menuSource.match(/className=\{MENU_HEADING\}/g) ?? []).length, 2);
    const fieldListFn = functionNamed(menu.ast, "Menu");
    const fieldListSource = fieldListFn ? menuSource.slice(fieldListFn.start, fieldListFn.end) : "";
    check(
        "a field's list sets its options at 13 and a typed fragment's match at 600 (#495)",
        [
            /className="[^"]*\bp-menu-inset font-ui text-body-sm\b/.test(fieldListSource),
            /\{option\.match \? \(\s*<>\s*\{option\.match\.before\}\s*<span className="font-semibold">\{option\.match\.match\}<\/span>/.test(fieldListSource),
        ].join(" "),
        "true true"
    );
    check(
        "the account's menu is 224, the expanded rail's inside, and grows in from the corner by its button (0m, #495)",
        [
            /w-\[calc\(var\(--width-rail-expanded\)-2\*var\(--spacing-rail-inset\)\)\]/.test(menuConstant("MENU_LOOK")),
            /origin-bottom-left open:animate-account-menu/.test(menuConstant("MENU_LOOK")),
        ].join(" "),
        "true true"
    );
    check(
        "  beside a collapsed button 8 out, its foot on the button's",
        [
            /beside: "my-0 mr-0 ml-account-menu-offset-x"/.test(menuConstant("PLACEMENT")),
            /placement === "beside" \? box\.right : box\.left/.test(menuSource),
            /window\.innerHeight - \(placement === "above" \? box\.top : box\.bottom\)/.test(menuSource),
        ].join(" "),
        "true true true"
    );
    check("  its head describing the menu rather than standing in it", /aria-describedby=\{heading \? headingId : undefined\}/.test(menuSource), true);
    check(
        "an item with a detail is named by its word and described by its detail, under a rule only when something stands above it (#495)",
        [
            /aria-labelledby=\{item\.detail \? labelId : undefined\}/.test(menuSource),
            /aria-describedby=\{item\.detail \? detailId : undefined\}/.test(menuSource),
            /\{item\.separated && index > 0 && <div aria-hidden="true" className="h-px shrink-0 bg-divider-subtle" \/>\}/.test(menuSource),
        ].join(" "),
        "true true true"
    );
    check(
        "  at least 56, 8 and 16 inside, its word over its detail",
        ["min-h-mobile-menu-account", "py-mobile-menu-account-inset-y", "px-mobile-menu-row-inset-x", "flex-col"].filter((t) => !menuConstant("DETAIL_ITEM").includes(t)).join(" "),
        ""
    );
    const account = parseFile(ACCOUNT);
    const [opener] = elements(account.ast, "button").filter((a) => a["aria-haspopup"] === "menu");
    assert("its opener says it opens a menu", Boolean(opener));
    check(
        "  and says whether, which, and whose it is",
        ["aria-expanded", "aria-controls", "aria-label"].filter((name) => !(name in (opener ?? {}))).join(", "),
        ""
    );
    assert("  applying the button's keys", calls(account.ast).has("menuButtonKey"));

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
        // The page's heading, focused through the helper the dialog's title is focused through
        // too (#469), which is where it is made focusable.
        const pageHeading = body("focusPageHeading");
        const heading = body("focusHeading");
        const message = body("DialogMessage");
        const actionRow =
            elements(functionNamed(ast, "DialogActions") ?? {}, "div")
                .map((a) => a.className)
                .find((c) => typeof c === "string" && c.includes("justify-end")) ?? "";
        return {
            heading: [
                /focusHeading\(document\.querySelector\("h1"\)\)/.test(pageHeading),
                /if \(!heading\.hasAttribute\("tabindex"\)\) heading\.tabIndex = -1;/.test(heading),
                /heading\.focus\(\)/.test(heading),
            ].join(" "),
            // Since #495 a closing also sends focus there when the opener did not take it back,
            // which an opener its page has hidden cannot.
            onClose: /const opener = openerRef\.current;\s*dialog\.close\(\);\s*\/\/[^\n]*\n\s*if \(unprompted \|\| \(opener !== null && document\.activeElement !== opener\)\) focusPageHeading\(\);/.test(
                source
            ),
            // A dialog its page stops drawing closes as the window changes size, after the
            // owner's `onHidden` and whether or not it is busy (#495).
            hidden: [
                /window\.addEventListener\("resize", onResize\)/.test(source),
                /if \(!dialog\.open \|\| dialog\.checkVisibility\(\)\) return;\s*onHidden\?\.\(\);\s*onClose\(\);/.test(source),
            ].join(" "),
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
    check("  and only one marked unprompted, or one its opener did not take focus back from, in the branch that closes it (#495)", frameRules.onClose, true);
    check("a dialog its page stops drawing closes as the window changes size, busy or not, after its owner's onHidden (#495)", frameRules.hidden, "true true");
    check("  a dialog's sentence describes the dialog it stands in, and stops when it goes", frameRules.describes, "true true true");
    check("  and the actions wrap rather than run off a narrow dialog", frameRules.wraps, true);

    // THE FRAME'S SECOND BUILD, A PREVIEW BESIDE WHAT THE DIALOG SAYS (#457). What it holds
    // is drawn in a pane on the Field ground that scrolls, the dialog's full height and with
    // no room of the dialog's own around it, and the head and the rest take the room the
    // Compact build gives the whole dialog — so the column beside the pane is the Compact
    // build inside. Where there is no preview the dialog keeps its 24 all round. Read off the
    // source through one function, so the planted frame below is judged the same way.
    const buildFacts = ({ ast, source }) => {
        const constant = (name) => {
            let text = "";
            walk(ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) text = source.slice(n.init.start, n.init.end);
            });
            return text;
        };
        const compact = constant("COMPACT");
        const withPreview = constant("WITH_PREVIEW");
        const paneSource = (() => {
            let found = "";
            walk(ast, (n) => {
                if (
                    n.type === "JSXElement" &&
                    n.children.some((child) => child.type === "JSXExpressionContainer" && child.expression?.name === "preview")
                )
                    found = source.slice(n.start, n.end);
            });
            return found;
        })();
        return {
            compact: [/\bp-dialog-inset\b/.test(compact), /var\(--container-dialog\)/.test(compact)].join(" "),
            withPreview: [
                /var\(--container-dialog-preview\)/.test(withPreview),
                /var\(--height-dialog-preview\)/.test(withPreview),
                /var\(--width-dialog-preview-pane\)/.test(withPreview),
                !/\bp-dialog-inset\b/.test(withPreview),
            ].join(" "),
            // Since #495 the pane reserves 0i's lane and draws its bar, its room 24 16 24 24 so
            // the pages stand 24 from the lane, and it stops at its end (1i).
            pane: [
                /\bbg-background-muted\b/.test(paneSource),
                /\boverflow-y-auto\b/.test(paneSource),
                /\bpy-dialog-inset\b/.test(paneSource) &&
                    /\bpl-dialog-inset\b/.test(paneSource) &&
                    /pr-\[calc\(var\(--spacing-dialog-inset\)-var\(--spacing-scrollbar\)\)\]/.test(paneSource),
                /\[scrollbar-gutter:stable\]/.test(paneSource) && /\$\{SCROLL_LANE\}/.test(paneSource),
                /\boverscroll-contain\b/.test(paneSource),
            ].join(" "),
            // And the column scrolls as one lane between its head and its actions (#495): the
            // head keeps the column's sides, the column itself takes none, and the body and the
            // actions take them inside a dialog marked as holding a preview.
            column: [
                /px-dialog-inset pt-dialog-inset/.test(source),
                /"pb-dialog-inset sm:col-start-2 sm:row-start-2"/.test(source),
                (source.match(/\bin-data-preview:px-dialog-inset\b/g) ?? []).length === 2,
                /data-preview=\{withPreview \? "" : undefined\}/.test(source),
            ].join(" "),
            // The body's outermost box, which in a column taller than what it holds is what
            // takes the room left over — and so what keeps the actions at the column's foot.
            // Its scroller stops at its end (0i Chain, #495), so a scroll past the last line
            // does not move the page behind the dialog.
            bodyContained: (() => {
                const fn = functionNamed(ast, "DialogBody");
                const body = fn ? source.slice(fn.start, fn.end) : "";
                return /ref=\{scrollerRef\}\s*className="[^"]*\boverflow-y-auto overscroll-contain\b/.test(body);
            })(),
            bodyGrows: (() => {
                let grows = false;
                walk(ast, (n) => {
                    if (n.type !== "FunctionDeclaration" || n.id?.name !== "DialogBody") return;
                    const returned = n.body.body.find((s) => s.type === "ReturnStatement")?.argument;
                    const className = returned?.openingElement?.attributes.find((a) => a.name?.name === "className")?.value;
                    grows = className?.type === "Literal" && /\bgrow\b/.test(className.value);
                });
                return grows;
            })(),
        };
    };
    const builds = buildFacts(frame);
    check("  the Compact build keeps its 24 all round, at 420", builds.compact, "true true");
    check("  a preview's build is 780 by 520 with a 440 pane, and no room of its own", builds.withPreview, "true true true true");
    check("  its pane is on the Field ground, scrolls in 0i's reserved lane with its own room, and stops at its end (#495)", builds.pane, "true true true true true");
    check("  and the column beside it takes the Compact build's room, its body scrolling across it (#495)", builds.column, "true true true true");
    // 1i STANDS THE ACTIONS AT THE COLUMN'S FOOT, 460 down a 520 dialog, whatever the body
    // holds above them: the body takes the column's spare room. In the Compact build the
    // column is its content's height, so there is none to take and nothing moves.
    check("  the body takes the column's spare room, so the actions stand at its foot", builds.bodyGrows, true);
    check("a dialog's body stops at its end rather than scrolling the page behind it (#495)", builds.bodyContained, true);

    // THE PHONE'S SHEET, 0l's CONFIRM, AND A DIALOG TAKEN AWAY OPEN (#458). Below the phone's
    // edge a dialog marked `sheet` is Tools 0a's: at the screen's foot and its width, the top
    // corners 28, cast upward over its own wash, 20 at the foot plus the safe area, and
    // marked `data-sheet` so what it holds takes the phone's sizes. A press behind it closes
    // it only when it asked to and only while it is laid out as a sheet, and only past its
    // box — a press in its own room at the foot is a press on it. `recordId` is the Confirm,
    // its line under the title the id in the id face; a sheet that confirms draws no handle,
    // and no sheet draws the close. And a dialog taken off the page while open hands focus
    // back as its closing would — to the opener it kept, none for a dialog no press opened,
    // or to the heading when the opener went with it or will not take focus — once the
    // removal has run, so Strict Mode's put-back does not.
    const sheetFacts = ({ ast, source }) => {
        let sheet = "";
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && n.id?.name === "SHEET" && n.init) sheet = source.slice(n.init.start, n.init.end);
        });
        const frameFn = functionNamed(ast, "DialogFrame");
        const frameSource = frameFn ? source.slice(frameFn.start, frameFn.end) : "";
        return {
            sheet: [
                /max-sm:mt-auto/.test(sheet),
                /max-sm:mb-0/.test(sheet),
                /max-sm:max-w-none/.test(sheet),
                /max-sm:rounded-t-mobile-drawer/.test(sheet),
                /max-sm:shadow-mobile-drawer/.test(sheet),
                /max-sm:backdrop:bg-mobile-drawer-overlay/.test(sheet),
                /var\(--spacing-mobile-drawer-inset-bottom\)\+env\(safe-area-inset-bottom\)/.test(sheet),
                /max-sm:\[--dialog-sheet:1\]/.test(sheet),
            ].join(" "),
            marked: /data-sheet=\{sheet \? \(confirm \? "confirm" : "drawer"\) : undefined\}/.test(frameSource),
            applied: /\$\{sheet \? ` \$\{SHEET\}` : ""\}/.test(frameSource),
            backdrop: [
                /onClick=\{closesOnBackdrop \? onBackdropPress : undefined\}/.test(frameSource),
                /if \(event\.target !== dialog \|\| !laidOutAsSheet\(dialog\)\) return;/.test(frameSource),
                /event\.clientX < box\.left \|\| event\.clientX > box\.right \|\| event\.clientY < box\.top \|\| event\.clientY > box\.bottom/.test(frameSource),
                /getPropertyValue\("--dialog-sheet"\)\.trim\(\) === "1"/.test(source),
            ].join(" "),
            handle: /\{sheet && !confirm && \(/.test(frameSource),
            noClose: /items-center max-sm:in-data-\[sheet\]:hidden/.test(frameSource),
            confirm: [/const confirm = recordId !== undefined;/.test(frameSource), /"font-id text-body-sm tracking-id text-foreground-default /.test(frameSource)].join(" "),
            done: /\{done \? \(/.test(frameSource) && /onClick=\{done\.onPress\}/.test(frameSource),
            removed: [
                /queueMicrotask\(\(\) => \{\s*if \(!dialog\.isConnected\) focusAfterRemoval\(opener\);/.test(frameSource),
                /if \(!dialog\?\.open\) return;\s*const opener = openerRef\.current;/.test(frameSource),
            ].join(" "),
            opener: /openerRef\.current = unprompted \|\| document\.activeElement === document\.body \? null : document\.activeElement;\s*dialog\.showModal\(\);/.test(
                frameSource
            ),
            backTo: (() => {
                const fn = functionNamed(ast, "focusAfterRemoval");
                const body = fn ? source.slice(fn.start, fn.end) : "";
                return [
                    /if \(opener\?\.isConnected\) \{\s*opener\.focus\(\);\s*if \(document\.activeElement === opener\) return;\s*\}/.test(body),
                    /\}\s*focusPageHeading\(\);\s*\}$/.test(body),
                ].join(" ");
            })(),
        };
    };
    const sheetRules = sheetFacts(frame);
    check("below the phone's edge a sheet sits at the foot, full width, 28 at the top, over its wash", sheetRules.sheet, "true true true true true true true true");
    check("  marked as a sheet, and which kind, for what it holds", sheetRules.marked, true);
    check("  and only a dialog that says so", sheetRules.applied, true);
    check("a press behind it closes it only when asked, as a sheet, past its box", sheetRules.backdrop, "true true true true");
    check("a sheet that confirms draws no handle, and no sheet the close", `${sheetRules.handle} ${sheetRules.noClose}`, "true true");
    check("the Confirm's line under the title is the record's id, in the id face", sheetRules.confirm, "true true");
    check("a sheet holding a field ends its head in its own text button", sheetRules.done, true);
    check("a dialog taken away open hands focus back, after the removal", sheetRules.removed, "true true");
    check("  to the opener it kept as it opened, none for a dialog no press opened", sheetRules.opener, true);
    check("  or to the heading when the opener is gone or will not take focus", sheetRules.backTo, "true true");
    // WHAT A SHEET HOLDS TAKES THE PHONE'S SIZES FROM ITS MARK, never from the frame's own
    // branch: the body's sides and 20 between fields, the sentence at 16, the actions
    // stacked 12 apart under 20 — the sheet that confirms' arrangement for every sheet.
    const partClass = (name, test) => {
        const fn = functionNamed(frame.ast, name);
        return Boolean(fn) && elements(fn, "div").concat(elements(fn, "p")).some((a) => typeof a.className === "string" && test(a.className));
    };
    check(
        "a sheet's body, sentence and actions take the phone's sizes from its mark",
        [
            partClass("DialogBody", (c) => /max-sm:in-data-\[sheet=drawer\]:gap-mobile-field-stack/.test(c)),
            partClass("DialogMessage", (c) => /max-sm:in-data-\[sheet\]:text-mobile-body/.test(c)),
            partClass("DialogActions", (c) => /max-sm:in-data-\[sheet\]:flex-col-reverse max-sm:in-data-\[sheet\]:gap-mobile-drawer-action-stack/.test(c)),
            partClass("DialogActions", (c) => /max-sm:in-data-\[sheet\]:pt-mobile-drawer-body-stack/.test(c)),
        ].join(" "),
        "true true true true"
    );
    // A SHEET'S ROWS (0a Sheet): 56 at least, 15 and 16 inside, an Inner rule 16 in between
    // two, and the check on the row already chosen.
    const rowsFn = functionNamed(frame.ast, "SheetRows");
    const rowsSource = rowsFn ? frame.source.slice(rowsFn.start, rowsFn.end) : "";
    check(
        "a sheet's rows are 0a's, the one chosen checked",
        [
            /min-h-mobile-drawer-row/.test(rowsSource),
            /px-mobile-drawer-row-inset-x py-mobile-drawer-row-inset-y/.test(rowsSource),
            /\{index > 0 && <div aria-hidden="true" className="ml-mobile-drawer-row-inset-x h-px bg-divider-subtle" \/>\}/.test(rowsSource),
            /\{row\.chosen && \(/.test(rowsSource),
        ].join(" "),
        "true true true true"
    );
    check(
        "  which stop at their end, and set a typed fragment's match at 600 (#495)",
        [
            /<ul role="list" className="[^"]*\boverflow-y-auto overscroll-contain\b/.test(rowsSource),
            /\{row\.match \? \(\s*<>\s*\{row\.match\.before\}\s*<span className="font-semibold">\{row\.match\.match\}<\/span>\s*\{row\.match\.after\}/.test(rowsSource),
        ].join(" "),
        "true true"
    );

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

    // ── 5: one frame on the tools axis ──────────────────────────────────────
    log("");
    log("no tools file draws a dialog on the old frame, since #458:");
    const toolsFiles = listJsFiles(repoPath("app/(tools)")).map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
    const onOldFrame = toolsFiles.filter((rel) => drawsOldFrame(readFileSync(repoPath(rel), "utf8"))).sort();
    check("  the files on it", onOldFrame.length, 0);
    const onNewFrame = toolsFiles.filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/DialogFrame")).sort();
    // The registration's dialog (#456), the landing's two (#459), the labels' (#457), and the
    // tool item page's transition, its retirement's question and 1f's two sheets (#458).
    check(
        "  and the frame's callers on the axis are the dialogs drawn on it",
        onNewFrame.join(", "),
        [
            "app/(tools)/tool-items/LabelsDialog.js",
            "app/(tools)/tool-items/[toolItemId]/JobSheet.js",
            "app/(tools)/tool-items/[toolItemId]/NameSheet.js",
            "app/(tools)/tool-items/[toolItemId]/RetirementConfirm.js",
            "app/(tools)/tool-items/[toolItemId]/TransitionDialog.js",
            "app/(tools)/tools/RegistrationDialog.js",
            "app/(tools)/tools/[toolRecordId]/RegistrationShortfall.js",
            "app/(tools)/tools/[toolRecordId]/RegistrationUnlogged.js",
        ]
            .sort()
            .join(", ")
    );

    // ── 6: a dialog that submits (#469) ─────────────────────────────────────
    log("");
    log("a dialog that submits says so, and keeps focus where the press found it (#469):");
    // WHAT A BUTTON IS WHILE ITS FORM WAITS, by value. The form's submit is the work being
    // done and every other button locks with it; a button outside a busy form is what its own
    // `busy` says, which is a sign-in step's; and a disabled one is neither, since it holds no
    // focus to keep. Neither state is disabled — that is the rule the frame's focus rests on.
    for (const [args, expected, why] of [
        [{}, null, "a button with nothing to wait on is itself"],
        [{ busy: true }, "working", "  one its caller says is busy works, in no busy form — a sign-in step's"],
        [{ formBusy: true, submits: true }, "working", "  a busy form's submit is the work being done"],
        [{ formBusy: true }, "locked", "  and every other button of that form locks with it"],
        [{ busy: true, formBusy: true }, "working", "  a button its caller says is busy works in one too"],
        [{ formBusy: true, submits: true, disabled: true }, null, "  and a disabled one is neither, even a busy form's submit"],
        [{ busy: true, disabled: true }, null, "  nor one its caller says is busy"],
    ])
        check(why, buttonBusyState(args), expected);

    // WHETHER AN OPEN DIALOG HAS LET FOCUS FALL, by value. The browser drops focus from a
    // control disabled or taken away under it with no event, so this is asked of facts.
    const fell = (facts) => focusLost({ open: true, held: true, heldCanHold: false, onHeld: false, onDocument: false, ...facts });
    check("a commitment disabled while it still holds focus has let it fall", fell({ onHeld: true }), true);
    check("  and so has one taken off the page, with focus on the document", fell({ onDocument: true }), true);
    check("  but focus on the document with what held it still able to is left where it is", fell({ onDocument: true, heldCanHold: true }), false);
    check("  focus in a sheet opened over the dialog went there on purpose", fell({}), false);
    check("  a dialog that is shut has nothing to keep", fell({ open: false, onHeld: true }), false);
    check("  nor one in which nothing held focus", fell({ held: false, onDocument: true }), false);
    check("  and focus on what can still hold it stays", fell({ onHeld: true, heldCanHold: true }), false);

    // EACH CONTROL APPLIES THE FORM'S BUSY STATE, read off the source as the expression
    // that decides it. `FormBusy` provides it; the button asks `buttonBusyState` and draws the
    // answer — a press turned away, `aria-disabled`, and `aria-busy` with `data-busy` only
    // while working; every field locks without being disabled; and the steps and the choice
    // take no hover while locked. In a sheet below the phone's edge a busy action is Tools
    // 0a's Busy: the phone's spinner, and the word kept for assistive tech.
    const busyFacts = ({ ast, source }) => {
        const fnSource = (name) => {
            const fn = functionNamed(ast, name);
            return fn ? source.slice(fn.start, fn.end) : "";
        };
        const reads = (name) => /const formBusy = useContext\(FormBusyContext\);/.test(fnSource(name));
        const button = fnSource("Button");
        const text = fnSource("TextInput");
        const number = fnSource("NumberField");
        const choice = fnSource("Choice");
        const combobox = fnSource("Combobox");
        const sheetField = fnSource("SheetField");
        const constant = (name) => {
            let found = "";
            walk(ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) found = source.slice(n.init.start, n.init.end);
            });
            return found;
        };
        return {
            provider: /export function FormBusy\(\{ busy, children \}\) \{\s*return <FormBusyContext\.Provider value=\{busy\}>\{children\}<\/FormBusyContext\.Provider>;/.test(source),
            button: [
                reads("Button"),
                /buttonBusyState\(\{ busy, formBusy, submits: type === "submit", disabled \}\)/.test(button),
                /onClick=\{state \? \(event\) => event\.preventDefault\(\) : onClick\}/.test(button),
                /aria-disabled=\{state \? true : undefined\}/.test(button),
                /aria-busy=\{working \|\| undefined\}/.test(button) && /data-busy=\{working \|\| undefined\}/.test(button),
            ].join(" "),
            text: [reads("TextInput"), /const locked = readOnly \|\| formBusy;/.test(text), /readOnly=\{locked\}/.test(text)].join(" "),
            number: [
                reads("NumberField"),
                /readOnly=\{formBusy\}/.test(number),
                /if \(!formBusy\) onChange\(stepNumber\(value, delta, \{ min, max \}\)\);/.test(number),
                (number.match(/aria-disabled=\{formBusy \|\| undefined\}/g) ?? []).length === 2,
                /not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground-default/.test(constant("STEP")) && !/(?<!not-aria-disabled:)hover:/.test(constant("STEP")),
            ].join(" "),
            choice: [
                reads("Choice"),
                /aria-readonly=\{formBusy \|\| undefined\}/.test(choice),
                /const onKeyDown = \(event\) => \{\s*if \(formBusy\) return;/.test(choice),
                /onClick=\{\(\) => \{\s*if \(formBusy\) return;/.test(choice),
                /not-aria-readonly:hover:bg-hover-subtle/.test(choice) && !/(?<!not-aria-readonly:)hover:/.test(choice),
            ].join(" "),
            combobox: [
                reads("Combobox"),
                /readOnly=\{formBusy\}/.test(combobox),
                /const shown = listOpen && suggestions\.length > 0 && !formBusy;/.test(combobox),
                /const onKeyDown = \(event\) => \{\s*if \(formBusy\) return;/.test(combobox),
                /onFocus=\{\(\) => \{\s*if \(!formBusy\) onListOpenChange\(true\);/.test(combobox),
            ].join(" "),
            sheetField: [
                reads("SheetField"),
                /aria-disabled=\{formBusy \|\| undefined\}/.test(sheetField),
                /onClick=\{formBusy \? undefined : onOpen\}/.test(sheetField),
                /not-aria-disabled:active:bg-hover-subtle/.test(sheetField),
            ].join(" "),
            // The foot bar's job pill (#463), which locks the same way and takes the Wash under
            // a press only while it can act.
            sheetChip: [
                reads("SheetChip"),
                /aria-disabled=\{formBusy \|\| undefined\}/.test(fnSource("SheetChip")),
                /onClick=\{formBusy \? undefined : onOpen\}/.test(fnSource("SheetChip")),
                /\[&:not\(\[aria-disabled\]\):active>span\]:bg-hover-subtle/.test(fnSource("SheetChip")),
            ].join(" "),
            sheetBusy: [
                /size === "xl" \? "max-sm:size-mobile-spinner" : "max-sm:in-data-\[sheet\]:size-mobile-spinner"/.test(fnSource("Spinner")),
                /size === "xl" \? "max-sm:sr-only" : "sr-only"/.test(fnSource("ButtonLabel")),
            ].join(" "),
        };
    };
    const busyRules = busyFacts(controls);
    check("a busy form's state is provided to what it holds", busyRules.provider, true);
    check("  and the button asks what it is under it, and draws the answer", busyRules.button, "true true true true true");
    check("  a text field locks read-only", busyRules.text, "true true true");
    check("  a number field's figure locks and its steps take no press and no hover", busyRules.number, "true true true true true");
    check("  a choice locks read-only, opening and changing nothing, with no hover", busyRules.choice, "true true true true true");
    check("  a typed value locks read-only and its list does not show", busyRules.combobox, "true true true true true");
    check("  and the phone's field opens no sheet", busyRules.sheetField, "true true true true");
    check("  nor does the foot bar's job pill (#463)", busyRules.sheetChip, "true true true true");
    check(
        "a busy action as wide as its words shows its spinner alone, as Tools 0a's Busy does in a sheet, its word kept for assistive tech (#495)",
        busyRules.sheetBusy,
        "true true"
    );

    // THE FRAME HANDS ITS BUSY STATE TO WHAT IT HOLDS AND KEEPS FOCUS INSIDE WHILE IT IS
    // OPEN. Its close locks rather than disabling. While it is open an observer is told of
    // what can take focus away — a control disabled, hidden or made inert, or taken off the
    // page — and `focusin` follows what holds focus; each change asks `focusLost`, and focus
    // that fell goes to the first thing the body holds that can take it, or to the title.
    const keeperFacts = ({ ast, source }) => {
        const fnSource = (name) => {
            const fn = functionNamed(ast, name);
            return fn ? source.slice(fn.start, fn.end) : "";
        };
        const frameSource = fnSource("DialogFrame");
        let keeper = "";
        walk(functionNamed(ast, "DialogFrame") ?? {}, (n) => {
            if (n.type === "CallExpression" && n.callee?.name === "useLayoutEffect" && /new MutationObserver\(/.test(source.slice(n.start, n.end)))
                keeper = source.slice(n.start, n.end);
        });
        const inside = fnSource("focusInside");
        const hold = fnSource("canHoldFocus");
        // The body's own outermost box, which is the one the frame looks for.
        const returned = functionNamed(ast, "DialogBody")?.body.body.find((s) => s.type === "ReturnStatement")?.argument;
        const bodyMarked = returned?.openingElement?.attributes.some((a) => a.name?.name === "data-dialog-body") ?? false;
        return {
            handsBusy: /<FormBusy busy=\{busy\}>\{children\}<\/FormBusy>/.test(frameSource),
            close: [/aria-disabled=\{busy \|\| undefined\}/.test(frameSource), !/\sdisabled=\{busy\}/.test(frameSource), /not-aria-disabled:hover:bg-hover/.test(frameSource)].join(" "),
            keeper: [
                /if \(!open \|\| !dialog\) return undefined;/.test(keeper),
                /observer\.observe\(dialog, \{ subtree: true, childList: true, attributes: true, attributeFilter: \["disabled", "hidden", "inert"\] \}\);/.test(keeper),
                /dialog\.addEventListener\("focusin", onFocusIn\);/.test(keeper) && /held = event\.target;/.test(keeper),
                /if \(!onDocument && active !== held && dialog\.contains\(active\)\) held = active;/.test(keeper),
                /observer\.disconnect\(\);/.test(keeper) && /\}, \[open\]\)$/.test(keeper),
            ].join(" "),
            asks: /const lost = focusLost\(\{\s*open: dialog\.open,\s*held: held !== null,\s*heldCanHold: held !== null && canHoldFocus\(held\),\s*onHeld: held !== null && active === held,\s*onDocument,\s*\}\);\s*if \(lost\) held = focusInside\(dialog, titleRef\.current\);/.test(
                keeper
            ),
            target: [
                /dialog\.querySelector\("\[data-dialog-body\]"\)/.test(inside),
                /\.find\(\(element\) => element\.tabIndex >= 0 && canHoldFocus\(element\)\)/.test(inside),
                /focusHeading\(title\);/.test(inside) && inside.indexOf("control.focus()") < inside.indexOf("focusHeading(title)"),
                /<h2 ref=\{titleRef\}/.test(frameSource),
                bodyMarked,
            ].join(" "),
            canHold: [/element\.isConnected/.test(hold), /!element\.disabled/.test(hold), /!element\.closest\("\[inert\]"\)/.test(hold), /element\.checkVisibility\(\)/.test(hold)].join(" "),
        };
    };
    const keeper = keeperFacts(frame);
    check("the frame hands its busy state to everything it holds", keeper.handsBusy, true);
    check("  and its close locks rather than disabling", keeper.close, "true true true");
    check("while it is open it watches what can take focus away, and follows what holds focus", keeper.keeper, "true true true true true");
    check("  and asks focusLost of each change, putting fallen focus back inside", keeper.asks, true);
    check("  on the first thing its body holds that can take focus, or its title", keeper.target, "true true true true true");
    check("  where taking focus means on the page, enabled, not inert, and drawn", keeper.canHold, "true true true true");

    // EVERY DIALOG ON THE AXIS THAT SUBMITS IS HELD TO IT, found rather than listed: each
    // component drawing the frame, whether it submits, the busy state it hands the frame, a
    // working word on its submit, and any button disabled while it sends. A dialog that asks
    // nothing hands no busy state, since locking a dialog that sends nothing would freeze it.
    const submitFacts = ({ ast, source }) => {
        const found = [];
        walk(ast, (n) => {
            if (n.type !== "FunctionDeclaration") return;
            const frames = [];
            const commitments = [];
            let disabledBySending = 0;
            walk(n, (inner) => {
                if (inner.type !== "JSXOpeningElement") return;
                const attribute = (name) => inner.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
                const valueOf = (name) => {
                    const a = attribute(name);
                    return a ? (a.value ? source.slice(a.value.start, a.value.end) : "true") : null;
                };
                if (inner.name?.name === "DialogFrame") frames.push({ submits: attribute("onSubmit") !== undefined, busy: valueOf("busy") });
                if (inner.name?.name === "Button") {
                    if (valueOf("type") === '"submit"') commitments.push(valueOf("busyLabel") ? "named" : "unnamed");
                    if (/\bpending\b/.test(valueOf("disabled") ?? "")) disabledBySending++;
                }
            });
            for (const f of frames)
                found.push(
                    `${n.id?.name}: ${f.submits ? "submits" : "asks nothing"} · busy ${f.busy ?? "none"} · ${commitments.join(", ") || "no submit"} · ${disabledBySending} disabled by sending`
                );
        });
        return found;
    };
    const dialogs = toolsFiles
        .filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/DialogFrame"))
        .flatMap((rel) => submitFacts(parseFile(rel)))
        .sort();
    check(
        "every dialog on the axis that submits hands its frame its busy state and its commitment a word, with nothing disabled for it",
        dialogs.filter((d) => d.includes(": submits")).join(" | "),
        [
            "RegistrationForm: submits · busy {pending} · named · 0 disabled by sending",
            "RetirementConfirm: submits · busy {pending} · named · 0 disabled by sending",
            "TransitionForm: submits · busy {pending} · named · 0 disabled by sending",
        ].join(" | ")
    );
    check(
        "  and every one that asks nothing hands it none",
        dialogs.filter((d) => d.includes(": asks nothing") && !d.includes("busy none")).join(" | "),
        ""
    );
    check("  across the dialogs drawn on the frame", dialogs.length, onNewFrame.length);

    // AND EVERY FORM THAT SUBMITS OUTSIDE A FRAME IS HELD TO THE SAME (#463): the tool item
    // page's foot bar, which wraps what it holds in `FormBusy` itself, and the desk's press,
    // whose button says its own busy state. Found rather than listed — each function under
    // the axis handing `FormBusy` a state or a button a `busy` — and read as the state it is
    // handed, its submit's word and anything disabled while it sends.
    const formFacts = ({ ast, source }) => {
        const found = [];
        walk(ast, (n) => {
            if (n.type !== "FunctionDeclaration") return;
            const states = [];
            const commitments = [];
            let disabledBySending = 0;
            walk(n, (inner) => {
                if (inner.type !== "JSXOpeningElement") return;
                const valueOf = (name) => {
                    const a = inner.attributes.find((x) => x.type === "JSXAttribute" && x.name?.name === name);
                    return a ? (a.value ? source.slice(a.value.start, a.value.end) : "true") : null;
                };
                if (inner.name?.name === "FormBusy") states.push(`form ${valueOf("busy")}`);
                if (inner.name?.name === "Button" && valueOf("busy")) states.push(`button ${valueOf("busy")}`);
                // A submit names its word, and since #495 so does a press that waits on a read
                // before it opens anything, which submits no form.
                if (inner.name?.name === "Button" && (valueOf("type") === '"submit"' || valueOf("busy")))
                    commitments.push(valueOf("busyLabel") ? "named" : "unnamed");
                if (inner.name?.name === "Button" && /\bpending\b/.test(valueOf("disabled") ?? "")) disabledBySending++;
            });
            if (states.length > 0) found.push(`${n.id?.name}: ${states.join(", ")} · ${commitments.join(", ")} · ${disabledBySending} disabled by sending`);
        });
        return found;
    };
    const forms = toolsFiles.flatMap((rel) => formFacts(parseFile(rel))).sort();
    check(
        "every form on the axis that submits outside a frame, and every press that waits on a read, says it is busy and names its word (#495)",
        forms.join(" | "),
        [
            "LabelsDialog: button {pending} · named · 0 disabled by sending",
            "TransitionBar: form {pending} · named · 0 disabled by sending",
            "TransitionDialog: button {!asks && pending} · named · 0 disabled by sending",
        ].join(" | ")
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
    // The old-frame census is seen to find a file that imports the old frame, since an empty
    // census and a census that reads nothing are one PASS, and to pass the frame's own source.
    assert(
        "  the census finds the old frame in a file that imports it",
        drawsOldFrame('import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";\n') && !drawsOldFrame(frame.source)
    );
    // The sheet and control readers are seen to fail on a frame that marks every dialog a
    // sheet, closes on any press behind it at any width and keeps the close on a sheet, and
    // on controls that size a button for the phone outside any sheet.
    const plantedSheet = sheetFacts(
        parseSource(
            'const SHEET = "max-sm:mt-auto";\n' +
                'export function DialogFrame({ sheet }) { return <dialog data-sheet="drawer" onClick={ask} className={`${DIALOG} ${SHEET}`}><div className="items-center" /></dialog>; }\n',
            "<planted-sheet>"
        )
    );
    check("  a sheet missing its corners, its wash and its mark is seen", plantedSheet.sheet, "true false false false false false false false");
    check("  every dialog marked a sheet is seen", `${plantedSheet.marked} ${plantedSheet.applied}`, "false false");
    check("  a press anywhere behind closing it is seen", plantedSheet.backdrop, "false false false false");
    check("  and a close kept on a sheet is seen", plantedSheet.noClose, false);
    // The removal reader is seen to fail on the frame as it was before it kept the opener —
    // every removal sent to the heading — and on one that focuses the opener without asking
    // whether focus took, which an opener disabled under a landing would not let it.
    const plantedRemoval = sheetFacts(
        parseSource(
            "function focusAfterRemoval(opener) { opener.focus(); }\n" +
                "export function DialogFrame({ open }) { useLayoutEffect(() => { dialog.showModal(); }, [open]); useLayoutEffect(() => () => { if (!dialog?.open) return; queueMicrotask(() => { if (!dialog.isConnected) focusPageHeading(); }); }, []); }\n",
            "<planted-removal>"
        )
    );
    check("  a removal sent to the heading whatever opened it is seen", `${plantedRemoval.removed} ${plantedRemoval.opener}`, "false false false");
    check("  and an opener focused without asking whether focus took is seen", plantedRemoval.backTo, "false false");
    const plantedControls2 = controlFacts(
        parseSource(
            'const BUTTON_VARIANT = { danger: "bg-danger enabled:hover:bg-danger-hover" };\nconst SHEET_BUTTON = "max-sm:h-mobile-dialog-button";\n' +
                'const BUTTON_SIZE = { xl: "max-sm:h-mobile-button" };\nconst LABEL = xl ? "max-sm:text-mobile-body-sm" : "";\nexport function SheetField() { return <button />; }\n',
            "<planted-sheet-controls>"
        )
    );
    check("  a red commitment that does not hover is seen", plantedControls2.danger, false);
    check("  and a hover a busy one would take is seen", plantedControls2.busyQuiet, false);
    check(
        "  and a refusal that keeps 13 in a sheet is seen",
        controlFacts(parseSource('export function Refusal({ children }) { return <p role="alert" className="text-body-sm text-danger">{children}</p>; }\n', "<planted-refusal>")).refusal,
        false
    );
    check(
        "  and a refusal in Red behind the alert mark is seen",
        controlFacts(parseSource('export function Refusal({ children }) { return <p role="alert" className="flex gap-gap text-danger"><AlertMark />{children}</p>; }\n', "<planted-red-refusal>")).refusalMessage,
        "false false false false"
    );
    check(
        "  and a busy label sharing a cell with the resting one is seen",
        controlFacts(
            parseSource(
                'const BUTTON = "items-center";\nfunction ButtonLabel() { return <span className="grid"><span className="invisible col-start-1 row-start-1" /></span>; }\n',
                "<planted-cell>"
            )
        ).overLabel,
        "false false false"
    );
    check("  and a phone size outside a sheet is seen, where a sign-in page's two are not", plantedControls2.phoneOnlyInSheet, 1);
    // The frame's #459 rules are seen to fail on a frame that keeps the browser's own return,
    // hands focus back on every close, names no description and holds its actions on a line.
    const plantedFrame = frameFacts(
        parseSource(
            "function focusHeading(heading) { heading.focus(); }\n" +
                'function focusPageHeading() { focusHeading(document.querySelector("main")); }\n' +
                "export function DialogFrame({ open }) { useLayoutEffect(() => { if (!open) { dialog.close(); focusPageHeading(); } }, [open]); }\n" +
                "export function DialogMessage({ children }) { return <p>{children}</p>; }\n" +
                'export function DialogActions({ children }) { return <div className="flex justify-end gap-gap">{children}</div>; }\n',
            "<planted-frame>"
        )
    );
    check("  a heading neither found nor made focusable is seen", plantedFrame.heading, "false false true");
    check("  a return to it on every close is seen", plantedFrame.onClose, false);
    check("  a frame that never asks whether it is drawn is seen", plantedFrame.hidden, "false false");
    check("  a sentence describing nothing is seen", plantedFrame.describes, "false false false");
    check("  and actions held on one line are seen", plantedFrame.wraps, false);
    // The build reader is seen to fail on a frame that gives a preview the Compact build's
    // room and width and draws it in a pane on white that does not scroll.
    const plantedBuilds = buildFacts(
        parseSource(
            'const COMPACT = "max-w-[min(var(--container-dialog),100vw)] flex-col";\n' +
                'const WITH_PREVIEW = "max-w-[min(var(--container-dialog),100vw)] p-dialog-inset";\n' +
                'export function DialogFrame({ preview }) { return <dialog><div className="bg-white">{preview}</div></dialog>; }\n',
            "<planted-builds>"
        )
    );
    check("  a Compact build with no room of its own is seen", plantedBuilds.compact, "false true");
    check("  a preview's build at the Compact width with its room is seen", plantedBuilds.withPreview, "false false false false");
    check("  a pane on white that does not scroll is seen", plantedBuilds.pane, "false false false false false");
    check("  and a column taking no room is seen", plantedBuilds.column, "false false false false");
    check(
        "  a body that takes no spare room is seen",
        buildFacts(parseSource('export function DialogBody({ children }) { return <div className="relative flex min-h-0 flex-col">{children}</div>; }\n', "<planted-body>")).bodyGrows,
        false
    );
    // #469's readers are seen to fail on controls that disable a button while its form
    // waits and read no busy state, and that leave the choice hovering and the steps
    // pressable; on a frame that disables its close, watches nothing and puts fallen focus
    // on the dialog itself; and on a dialog that submits with no busy state, an unnamed
    // commitment and a button disabled while it sends, beside one that asks nothing and is
    // handed busy anyway.
    const plantedBusy = busyFacts(
        parseSource(
            "export function FormBusy({ busy, children }) { return <Context.Provider value={busy}>{children}</Context.Provider>; }\n" +
                "export function Button({ busy }) { return <button disabled={busy} aria-busy={busy}>{x}</button>; }\n" +
                "export function TextInput({ readOnly }) { return <input readOnly={readOnly} />; }\n" +
                'const STEP = "hover:bg-hover";\n' +
                "export function NumberField() { const formBusy = useContext(FormBusyContext); return <input readOnly={formBusy} />; }\n" +
                'export function Choice() { const formBusy = useContext(FormBusyContext); return <div aria-readonly={formBusy || undefined} className="hover:bg-hover-subtle" />; }\n' +
                "export function Combobox() { const shown = listOpen; return <input />; }\n" +
                "export function SheetField({ onOpen }) { return <button onClick={onOpen} />; }\n" +
                'function Spinner({ size }) { return <span className={size === "xl" ? "max-sm:size-mobile-spinner" : ""} />; }\n',
            "<planted-busy>"
        )
    );
    check("  a provider that is not the busy state's is seen", plantedBusy.provider, false);
    check("  a button disabled while busy, asking nothing, is seen", plantedBusy.button, "false false false false false");
    check("  a text field the lock does not reach is seen", plantedBusy.text, "false false false");
    check("  steps that take a press and a hover while locked are seen", plantedBusy.number, "true true false false false");
    check("  a choice that opens and hovers while locked is seen", plantedBusy.choice, "true true false false false");
    check("  a typed value whose list shows while locked is seen", plantedBusy.combobox, "false false false false false");
    check("  a sheet field that opens while locked is seen", plantedBusy.sheetField, "false false false false");
    check("  and a sheet keeping the desk's spinner and word is seen", plantedBusy.sheetBusy, "false false");
    const plantedKeeper = keeperFacts(
        parseSource(
            "function canHoldFocus(element) { return element.isConnected; }\n" +
                "function focusInside(dialog) { dialog.focus(); return dialog; }\n" +
                "export function DialogFrame({ busy, children }) { useLayoutEffect(() => { dialog.showModal(); }, [open]); " +
                "useLayoutEffect(() => { const observer = new MutationObserver(() => {}); observer.observe(dialog, { childList: true }); }, []); " +
                "return <dialog><h2>{title}</h2><button disabled={busy} className=\"enabled:hover:bg-hover\" />{children}</dialog>; }\n" +
                "export function DialogBody({ children }) { return <div className=\"relative flex\">{children}</div>; }\n",
            "<planted-keeper>"
        )
    );
    check("  a frame that keeps its busy state to itself is seen", plantedKeeper.handsBusy, false);
    check("  a close disabled while busy is seen", plantedKeeper.close, "false false false");
    check("  a keeper that watches nothing that takes focus away, and follows nothing, is seen", plantedKeeper.keeper, "false false false false false");
    check("  one that asks nothing is seen", plantedKeeper.asks, false);
    check("  focus put back on the dialog itself, in no marked body and on no title, is seen", plantedKeeper.target, "false false false false false");
    check("  and a reading of focus that checks only the page is seen", plantedKeeper.canHold, "true false false false");
    const plantedDialogs = submitFacts(
        parseSource(
            "export function Asking() { return <DialogFrame open={open} onSubmit={submit}><Button>{COPY.cancel}</Button>" +
                '<Button type="submit" disabled={pending || refused}>{COPY.go}</Button></DialogFrame>; }\n' +
                "export function Telling() { return <DialogFrame open={open} busy={pending}><Button>{COPY.ok}</Button></DialogFrame>; }\n",
            "<planted-dialogs>"
        )
    ).sort();
    check(
        "  and a dialog sending with no busy state, an unnamed commitment and a button disabled for it is seen, beside one telling and handed busy",
        plantedDialogs.join(" | "),
        "Asking: submits · busy none · unnamed · 1 disabled by sending | Telling: asks nothing · busy {pending} · no submit · 0 disabled by sending"
    );
}

if (isMain(import.meta.url)) standalone(title, run);
