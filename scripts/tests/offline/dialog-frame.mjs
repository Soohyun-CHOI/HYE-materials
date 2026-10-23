// The dialog frame and the controls in it (#456).
//
// WHAT THIS FILE IS FOR. `app/components/DialogFrame.js` is Claude Design's 0l drawn once,
// `app/components/Controls.js` and `app/components/Menu.js` are the 0a controls the
// registration dialog is the first to use, and the landing's two dialogs call them (#459),
// as the labels' does (#457) and the asset page's do (#458), rather than drawing their
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
//      edge, the sizes its controls take there, the backdrop that closes 1j's sheets
//      only while they are sheets, and a dialog taken off the page handing focus on.
//   4. THE WORDS. Every string these three render comes from `lib/dialogFrame.js` or
//      `lib/controls.js`, pinned by value, and none is in their markup — the rule
//      `offline/asset-list-view.mjs` holds for every file under `app/(assets)/`, which these
//      do not sit under.
//   5. ONE FRAME ON THE ASSETS AXIS. The asset page's two dialogs were the last drawn on
//      `app/components/modalStyles.js`, and #458 moved them onto this frame, so a file
//      under `app/(assets)/` importing it fails — the measurable condition CLAUDE.md's "one
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
    comboboxList,
    editableComboboxKey,
    menuButtonKey,
    menuIndex,
    menuKey,
    movedIndex,
    multiSelectKey,
    numberFieldText,
    radioKey,
    searchResultsKey,
    selectOnlyKey,
    stepNumber,
    typeaheadIndex,
} from "../../../lib/controls.js";
import { DIALOG_FRAME_COPY, focusFellFromPage, focusLost } from "../../../lib/dialogFrame.js";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "The dialog frame and the controls in it (#456, #459, #458, #469)";

const FRAME = "app/components/DialogFrame.js";
const CONTROLS = "app/components/Controls.js";
const MENU = "app/components/Menu.js";
const ACCOUNT = "app/components/RailAccount.js";

/**
 * Whether a file draws a dialog on `modalStyles.js` — which no file under `app/(assets)/`
 * does since #458 moved the asset page's two onto the frame. One found is a second
 * frame growing back.
 */
const drawsOldFrame = (text) => text.includes("@/app/components/modalStyles");

/** Attributes whose value a person reads or hears, and so must come from a constant. */
const VISIBLE_ATTRIBUTES = new Set(["placeholder", "title", "alt", "aria-label"]);

/** A key as a handler receives it. */
const key = (name, mods = {}) => ({ key: name, altKey: false, ctrlKey: false, metaKey: false, ...mods });

/**
 * What a field's list draws as it scrolls, off `Menu.js` (#555): 0i's bar on every list and its
 * Chain, the bar's 8 reserved by none (Soo's ruling) and a lane's height only where a caller hands
 * one, the height the less of the lane's and the room under the field, and the option it checks
 * scrolled to while no key has moved visual focus.
 */
function laneFacts({ ast, source }) {
    const menu = functionNamed(ast, "Menu");
    const body = menu ? source.slice(menu.start, menu.end) : "";
    // The region inside the popover that scrolls (#555).
    const region = body.match(/<div className=\{`(flex min-h-0 flex-col overflow-y-auto[^`]*)`\}>/)?.[1] ?? "";
    return [
        /import \{ SCROLL_LANE \} from "\.\/scrollLane";/.test(source),
        /\boverflow-y-auto overscroll-contain px-menu-inset \$\{SCROLL_LANE\}/.test(region),
        region !== "" && /\$\{lane \?\? ""\}/.test(body) && !/scrollbar-gutter/.test(body),
        /list\.style\.maxHeight = "";\s*const own = parseFloat\(getComputedStyle\(list\)\.maxHeight\);\s*list\.style\.maxHeight = `\$\{Number\.isNaN\(own\) \? room : Math\.min\(own, room\)\}px`;/.test(body),
        /const index = active >= 0 \? active : checkedIndex;/.test(body) && /\}, \[shown, active, checkedIndex\]\);/.test(body),
    ].join(" ");
}

/**
 * Whether what scrolls stands 5 inside the Edge above and below while it scrolls (Soo, #555): the
 * frame holds the Menu's 5 above and below and scrolls nothing, and the region inside it, which
 * scrolls, holds the 5 either side.
 */
function insetFacts({ ast, source }) {
    const menu = functionNamed(ast, "Menu");
    const body = menu ? source.slice(menu.start, menu.end) : "";
    const frame = body.match(/popover="manual"\s+className=\{`([^`]*)`\}/)?.[1] ?? "";
    const region = body.match(/<div className=\{`(flex min-h-0 flex-col overflow-y-auto[^`]*)`\}>/)?.[1] ?? "";
    return [
        /\bpy-menu-inset\b/.test(frame) && !/\bp-menu-inset\b/.test(frame),
        frame !== "" && !/\boverflow-/.test(frame),
        /\bpx-menu-inset\b/.test(region) && /\bmin-h-0\b/.test(region),
    ].join(" ");
}

/**
 * How a typed value opens on everything it offers, off `Controls.js` (#555): which list it shows
 * and holds the keys to, a press, focus and a key that opens it showing the whole list again,
 * typing narrowing it, the pick taken from the list shown, and the mark and the lane handed on.
 */
function everyFacts({ ast, source }) {
    const fn = functionNamed(ast, "Combobox");
    const body = fn ? source.slice(fn.start, fn.end) : "";
    const chip = functionNamed(ast, "FilterChip");
    return [
        /const list = comboboxList\(\{ every, suggestions, narrowing, value \}\);/.test(body) &&
            /const opening = comboboxList\(\{ every, suggestions, narrowing: false, value \}\);/.test(body),
        /editableComboboxKey\(event, \{ shown, active, count: shown \? list\.length : opening\.length \}\)/.test(body),
        /const open = \(\) => \{\s*setNarrowing\(false\);\s*setActive\(-1\);\s*onListOpenChange\(true\);\s*\};/.test(body) &&
            /if \(answer\.shown && !shown\) setNarrowing\(false\);/.test(body),
        /onChange\(event\.target\.value\);\s*setNarrowing\(true\);/.test(body),
        /if \(onPick\) onPick\(list\[index\]\);\s*else onChange\(list\[index\]\.label\);/.test(body),
        /lane=\{lane\}\s+options=\{list\.map\(/.test(body) && /checked: suggestion\.chosen === true,/.test(body),
        chip ? /lane=\{lane\}/.test(source.slice(chip.start, chip.end)) : false,
    ].join(" ");
}

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

/**
 * Where a frame's opening puts focus (#531), read off its source: the caret in the first field
 * that takes typing, right after `showModal`, and — with none — a sheet laid out as one and not
 * a Confirm on its title, the branch after the field's and that one alone.
 */
function openingFocus(source) {
    const opening = source.match(/if \(open && !dialog\.open\) \{([\s\S]*?)\n\s*\} else if \(!open && dialog\.open\)/)?.[1] ?? "";
    const shownAt = opening.indexOf("dialog.showModal();");
    const fieldAt = opening.search(/const field = dialog\.querySelector\("input:not\(\[type=hidden\]\)"\);\s*if \(field\) field\.focus\(\);/);
    const titleAt = opening.search(/\n\s*else if \(sheet && recordId === undefined && laidOutAsSheet\(dialog\)\) focusHeading\(titleRef\.current\);/);
    const headings = (opening.match(/focusHeading\(/g) ?? []).length;
    return {
        read: opening !== "",
        fieldFirst: shownAt !== -1 && fieldAt > shownAt,
        titleForSheet: fieldAt !== -1 && titleAt > fieldAt && headings === 1,
    };
}

export function run({ check, assert, log }) {
    // ── #555: a field that opens on everything it offers, and 0i's bar on every list ──
    // At the head, as #531's block below is, so nothing older that throws keeps these from failing.
    {
        log("a typed value that opens on everything it offers, and a list that scrolls in 0i's bar (#555):");
        const every = [{ label: "All" }];
        const suggestions = [{ label: "Some" }];
        const shows = (state) => comboboxList({ every, suggestions, ...state })[0]?.label ?? "none";
        check(
            "the whole list until something is typed, the suggestions once it is, the whole again once emptied, and suggestions alone with no whole list",
            [
                shows({ narrowing: false, value: "Power Tools" }),
                shows({ narrowing: true, value: "po" }),
                shows({ narrowing: true, value: "" }),
                comboboxList({ every: undefined, suggestions, narrowing: false, value: "" })[0]?.label ?? "none",
            ].join(" "),
            "All Some All Some"
        );
        const controls = parseFile(CONTROLS);
        check("  the combobox shows that list, shows it whole again as it opens, and narrows it as typed", everyFacts(controls), "true true true true true true true");
        check(
            "  a combobox showing its suggestions whatever was typed is seen",
            everyFacts(parseSource("export function Combobox() { const shown = listOpen && suggestions.length > 0; return <input />; }\nexport function FilterChip() { return <Menu />; }\n", "<planted-every>")),
            "false false false false false false false"
        );
        check("  every field list scrolls in 0i's bar, taking its 8 only while it shows and stopping at its height where handed one", laneFacts(parseFile(MENU)), "true true true true true");
        check("  and what scrolls stands 5 inside the Edge above and below, the frame holding the 5 and scrolling nothing", insetFacts(parseFile(MENU)), "true true true");
        check(
            "  a list padded where it scrolls, so a row scrolled past touches the Edge, is seen",
            insetFacts(parseSource('export default function Menu() { return <div popover="manual" className={`inset-auto overflow-y-auto p-menu-inset`} />; }\n', "<planted-inset>")),
            "false false false"
        );
        check(
            "  a list scrolling in the browser's own bar, as it did until #555, is seen",
            laneFacts(
                parseSource(
                    "export default function Menu() { useLayoutEffect(() => { list.style.maxHeight = `${room}px`; }, [shown]); return <div className={`inset-auto mx-0 flex-col overflow-y-auto rounded-card`} />; }\n",
                    "<planted-lane>"
                )
            ),
            "false false false false false"
        );
        check(
            "  a lane holding the bar's 8 with nothing to scroll, as 1l's do, is seen",
            laneFacts(
                parseSource(
                    'export default function Menu() { return <div popover="manual" className={`inset-auto ${lane ?? ""}`}><div className={`flex min-h-0 flex-col overflow-y-auto overscroll-contain px-menu-inset ${SCROLL_LANE} [scrollbar-gutter:stable]`}></div></div>; }\n',
                    "<planted-reserved>"
                )
            ).split(" ")[2],
            "false"
        );
        const frame = parseFile(FRAME);
        const body = functionNamed(frame.ast, "DialogBody");
        const bodySource = body ? frame.source.slice(body.start, body.end) : "";
        check(
            "  a dialog's body scrolls in the bar too, in the lane and out of it",
            `${/\[scrollbar-gutter:stable\] \$\{SCROLL_LANE\}`/.test(bodySource)} ${/: `pt-dialog-header-stack in-data-preview:px-dialog-inset in-data-fixed:px-dialog-inset \$\{SCROLL_LANE\}`/.test(bodySource)}`,
            "true true"
        );
        log("");
    }

    // ── #531: a sheet holding no field opens on its title ──────────────────
    // At the head of the check, as #522's block below is, so nothing older that throws keeps
    // these from printing. What a browser showed is in `tools.md`.
    {
        log("a sheet holding no field opens on its title, and its rows draw focus for the keyboard (#531):");
        const { ast, source } = parseFile(FRAME);
        const opens = openingFocus(source);
        assert("  the frame's opening was read", opens.read);
        assert("  showModal, then the caret in the first field that takes typing", opens.fieldFirst);
        assert("  with no field, a sheet laid out as one and not a Confirm puts focus on its title", opens.titleForSheet);
        assert("  and the opening asks again when what it is changes", /\}, \[open, unprompted, sheet, recordId\]\);/.test(source));
        assert("  the title draws no ring", /<h2 ref=\{titleRef\} id=\{titleId\} className="[^"]*\boutline-none\b[^"]*"/.test(source));
        const rows = functionNamed(ast, "SheetRows");
        const rowsSource = rows ? source.slice(rows.start, rows.end) : "";
        assert("  SheetRows was found", rowsSource !== "");
        assert("  a sheet's row is shaded under focus-visible", /\bfocus-visible:bg-hover-subtle\b/.test(rowsSource));
        assert("  and under no bare focus", !/(^|[\s"`])focus:/.test(rowsSource));
        const jobSheet = parseFile("app/(assets)/assets/[assetId]/JobSheet.js").source;
        const nameSheet = parseFile("app/(assets)/assets/[assetId]/NameSheet.js").source;
        assert("  the job sheet is a sheet of rows", /<DialogFrame[^>]*\bsheet\b/.test(jobSheet) && /<SheetRows\b/.test(jobSheet));
        assert("  holding no field, so it opens on its title", !/<input\b|<TextInput\b|<Combobox\b/.test(jobSheet));
        assert("  the name sheet holds a field, which takes the caret instead", /<SheetInput\b/.test(nameSheet) && /<SheetRows\b/.test(nameSheet));

        log("");
        log("anti-vacuity — the opening's reader on planted frames:");
        const planted = (body) => `useLayoutEffect(() => {\n        if (open && !dialog.open) {\n${body}\n        } else if (!open && dialog.open) {\n            dialog.close();\n        }\n    }, [open]);`;
        const field = `            dialog.showModal();\n            const field = dialog.querySelector("input:not([type=hidden])");\n            if (field) field.focus();`;
        const good = openingFocus(planted(`${field}\n            else if (sheet && recordId === undefined && laidOutAsSheet(dialog)) focusHeading(titleRef.current);`));
        assert("  a frame that does both reads as both", good.fieldFirst && good.titleForSheet);
        assert("  a frame focusing nothing more is found", !openingFocus(planted(field)).titleForSheet);
        assert("  a frame focusing every dialog's title is found", !openingFocus(planted(`${field}\n            else focusHeading(titleRef.current);`)).titleForSheet);
        assert(
            "  a frame not asking whether it is laid out as a sheet is found",
            !openingFocus(planted(`${field}\n            else if (sheet && recordId === undefined) focusHeading(titleRef.current);`)).titleForSheet
        );
        assert(
            "  a frame focusing the title over a field is found",
            !openingFocus(planted(`${field}\n            else if (sheet && recordId === undefined && laidOutAsSheet(dialog)) focusHeading(titleRef.current);\n            focusHeading(titleRef.current);`)).titleForSheet
        );
        assert("  a frame focusing before it shows is found", !openingFocus(planted(`            const field = dialog.querySelector("input:not([type=hidden])");\n            if (field) field.focus();\n            dialog.showModal();`)).fieldFirst);
        log("");
    }

    // ── 0: the design of 2026-10-11 (#522) ─────────────────────────────────
    // At the head of the check, so an older assertion that throws cannot keep these from
    // printing. Each is read off the source; what a browser showed is in `tools.md`.
    {
        const sourceOf = (file) => parseFile(file).source;
        const fnSource = (file, name) => {
            const { ast, source } = parseFile(file);
            const fn = functionNamed(ast, name);
            return fn ? source.slice(fn.start, fn.end) : "";
        };
        const constantOf = (file, name) => {
            const { ast, source } = parseFile(file);
            let text = "";
            walk(ast, (n) => {
                if (n.type === "VariableDeclarator" && n.id?.name === name && n.init) text = source.slice(n.init.start, n.init.end);
            });
            return text;
        };
        const menuFn = fnSource(MENU, "Menu");
        const choiceFn = fnSource(CONTROLS, "Choice");
        const chipFn = fnSource(CONTROLS, "FilterChip");
        log("the design of 2026-10-11 (#522):");
        // A LIST SHADES ITS OPTION ONLY WHERE A KEY PUT VISUAL FOCUS: 0a's Menu marks the one
        // chosen by its check, and a press that opens a list shades nothing.
        check(
            "a list shades the option under visual focus only when told a key put it there",
            [/function Menu\(\{[^}]*\bshade = true\b/.test(menuFn), /index === active && shade \? "bg-hover" : ""/.test(menuFn)].join(" "),
            "true true"
        );
        check(
            "  a choice is told by its keys and not by a press",
            [
                /shade=\{keyed\}/.test(choiceFn),
                /event\.preventDefault\(\);\s*setKeyed\(true\);/.test(choiceFn),
                /else show\(false\);/.test(choiceFn),
                /case "open":\s*show\(true\);/.test(choiceFn),
            ].join(" "),
            "true true true true"
        );
        check(
            "  and so is a filter chip",
            [/shade=\{keyed\}/.test(chipFn), /event\.preventDefault\(\);\s*setKeyed\(true\);/.test(chipFn), /setActive\(opening\(\)\);\s*setKeyed\(false\);/.test(chipFn)].join(" "),
            "true true true"
        );
        // THE JOB'S CHIP TAKES EDGE FOCUS FROM THE KEYBOARD ALONE: 1a draws it opened by a press
        // on its Edge, a bordered control's Open being its Wash (0f).
        const chipLook = constantOf(CONTROLS, "CHOICE_LOOK").split(/\n\s*chip:/)[1]?.split(/\n\s*crumb:/)[0] ?? "";
        check(
            "the job's chip turns to Edge focus for the keyboard alone",
            [/focus-visible:border-border-focus/.test(chipLook), /(^|[\s"])focus:border-border-focus/.test(chipLook)].join(" "),
            "true false"
        );
        // EVERY FIGURE IN A LIST, A SHEET'S ROWS AND A GROUP OF CHIPS IS TABULAR (0h Figures).
        check(
            "a list, a sheet's rows and a dialog's chips set their figures tabular",
            [
                /role="listbox"[\s\S]*?className=\{`[^`]*\btabular-nums\b/.test(menuFn),
                /\btabular-nums\b/.test(fnSource(FRAME, "SheetRows")),
                /\btabular-nums\b/.test(constantOf(CONTROLS, "CHIP")),
            ].join(" "),
            "true true true"
        );
        check(
            "a number field's steps rest at Ink 3, as 1b draws them",
            [/\btext-foreground-subtle\b/.test(constantOf(CONTROLS, "STEP")), /\btext-foreground-muted\b/.test(constantOf(CONTROLS, "STEP"))].join(" "),
            "true false"
        );
        // A TEXT FIELD'S EDGE IS A BORDER, SO ITS ROOM IS MEASURED INSIDE IT: an inset ring took
        // no room and stood every value 1px left of the drawings.
        const textInput = fnSource(CONTROLS, "TextInput");
        const combobox = fnSource(CONTROLS, "Combobox");
        check(
            "a text field and a combobox draw their Edge as a border, with no inset ring",
            [
                /rounded-control border bg-white/.test(textInput),
                /\binset-ring\b/.test(textInput),
                /rounded-control border bg-white/.test(combobox),
                /\binset-ring\b/.test(combobox),
            ].join(" "),
            "true false true false"
        );
        // A COMMITMENT CAN HOLD THE WIDTH OF A LONGER FORM OF ITS WORDS, unseen and unread.
        const buttonFn = fnSource(CONTROLS, "Button");
        check(
            "an action holds the width of words it keeps room for, unseen, its figures tabular",
            [
                /<span className="inline-grid justify-items-center tabular-nums">/.test(buttonFn),
                /<span aria-hidden="true" className="invisible col-start-1 row-start-1">\s*\{holdWidthOf\}/.test(buttonFn),
            ].join(" "),
            "true true"
        );
        check(
            "  the registration's commitment holds `Add 99 items`, as 1b draws it",
            /<Button type="submit" busyLabel=\{COPY\.working\} holdWidthOf=\{COPY\.submit\(99\)\}>/.test(sourceOf("app/(assets)/asset-categories/RegistrationDialog.js")),
            true
        );
        // A RECORD'S MENU TAKES 0a's WIDTHS INSIDE ITS ROOM AND ITS EDGE (1f, 1j), and a list a
        // field or a chip opens holds 140 with both counted (1a).
        const menuLook = constantOf(MENU, "MENU_LOOK");
        check(
            "a record's menu is 152 at a desk and 234 on a phone, measured outside, and a list stays 140",
            [
                menuLook.includes("min-w-[calc(var(--min-width-menu)+2*var(--spacing-menu-inset)+2px)]"),
                menuLook.includes("max-sm:w-[calc(var(--width-mobile-menu)+2px)]"),
                /fit === "field" \? "" : "w-max min-w-menu max-w-menu"/.test(menuFn),
            ].join(" "),
            "true true true"
        );
        const sheetChip = fnSource(CONTROLS, "SheetChip");
        check(
            "the foot bar's pill draws its icon and its chevron in 0a's 16 box",
            [/<span className="flex size-icon shrink-0 items-center/.test(sheetChip), /name="chevron-down" className="size-icon shrink-0/.test(sheetChip)].join(" "),
            "true true"
        );
        // A REFUSED PRESS TAKES FOCUS TO THE FIRST FIELD REFUSED: a field says it refuses on its
        // box, and the first drawn control in the tab order inside it takes focus.
        const refusalFocus = fnSource(CONTROLS, "useRefusalFocus");
        check(
            "a field and a group of chips say they refuse on their box",
            [
                /<div data-refused=\{refusal \? "" : undefined\} className="flex min-w-0 flex-col">/.test(fnSource(CONTROLS, "Field")),
                /<div data-refused=\{refusal \? "" : undefined\} className="flex flex-col">/.test(fnSource(CONTROLS, "ChipChoice")),
            ].join(" "),
            "true true"
        );
        check(
            "  and focus goes to the first drawn control in the tab order inside the first of them",
            [
                /form\.querySelectorAll\("\[data-refused\]"\)/.test(refusalFocus),
                /element\.tabIndex >= 0/.test(refusalFocus),
                /element\.getClientRects\(\)\.length > 0/.test(refusalFocus),
                /target\.focus\(\);\s*return;/.test(refusalFocus),
            ].join(" "),
            "true true true true"
        );
        check(
            "  the registration hands its form over on the press it refuses",
            /setGuarded\(\{[^\n]*\}\);\s*focusRefused\(event\.currentTarget\);\s*return;/.test(sourceOf("app/(assets)/asset-categories/RegistrationDialog.js")),
            true
        );
    }

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
    // A LIST TAKING SEVERAL (#520), a filter chip's: the same keys, but Enter and Space take or
    // give back the option and leave the list open, and Alt+Up closes taking nothing.
    log("a choice taking several values keeps its list open while it takes them (#520):");
    for (const [name, mods, open, expected] of [
        ["ArrowDown", {}, false, "open"],
        ["Enter", {}, false, "open"],
        [" ", {}, false, "open"],
        ["Enter", {}, true, "toggle"],
        [" ", {}, true, "toggle"],
        ["ArrowUp", { altKey: true }, true, "close"],
        ["Escape", {}, true, "close"],
        ["ArrowDown", {}, true, "next"],
        ["Home", {}, true, "first"],
        ["p", {}, true, "type"],
        ["Tab", {}, true, null],
    ])
        check(`  ${open ? "open" : "shut"}, ${JSON.stringify(name)}${mods.altKey ? " with Alt" : ""}`, multiSelectKey(key(name, mods), open), expected);
    // THE SEARCH A DIALOG IS BUILT AROUND (#520), 1b's: its results always show, the arrows move
    // through them and wrap, Enter takes the one under visual focus — or the one result left
    // when none is (#522) — and is stopped either way,
    // and Escape and Tab are not its — the dialog's, and the filters' after it in the row.
    log("a dialog's search moves through results that always show, and Enter takes one (#520):");
    for (const [name, state, expected] of [
        ["ArrowDown", { active: -1, count: 3 }, { active: 0 }],
        ["ArrowDown", { active: 0, count: 3 }, { active: 1 }],
        ["ArrowDown", { active: 2, count: 3 }, { active: 0 }],
        ["ArrowUp", { active: -1, count: 3 }, { active: 2 }],
        ["ArrowUp", { active: 0, count: 3 }, { active: 2 }],
        ["ArrowUp", { active: 2, count: 3 }, { active: 1 }],
        ["ArrowDown", { active: -1, count: 0 }, null],
        ["Enter", { active: 1, count: 3 }, { accept: 1 }],
        ["Enter", { active: -1, count: 3 }, { accept: null }],
        ["Enter", { active: -1, count: 1 }, { accept: 0 }],
        ["Enter", { active: -1, count: 0 }, { accept: null }],
        ["Enter", { active: 4, count: 3 }, { accept: null }],
        ["Escape", { active: 0, count: 3 }, null],
        ["Tab", { active: 0, count: 3 }, null],
        ["a", { active: 0, count: 3 }, null],
    ])
        check(`  ${JSON.stringify(name)} at ${state.active} of ${state.count}`, JSON.stringify(searchResultsKey(key(name), state)), JSON.stringify(expected));
    // CHIPS TAKING ONE VALUE ARE A RADIO GROUP (#520), 1b's size and model: every arrow moves and
    // chooses, the down and right ones on and the up and left ones back, and Space chooses.
    log("a group of chips taking one value moves and chooses by the arrows (#520):");
    for (const [name, expected] of [
        ["ArrowDown", "next"],
        ["ArrowRight", "next"],
        ["ArrowUp", "previous"],
        ["ArrowLeft", "previous"],
        [" ", "check"],
        ["Enter", null],
        ["Tab", null],
        ["Home", null],
        ["a", null],
    ])
        check(`  ${JSON.stringify(name)}`, radioKey(key(name)), expected);
    check("  and they wrap at both ends", `${menuIndex(3, 4, "next")} ${menuIndex(0, 4, "previous")}`, "0 3");
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
        ["Choice", "Combobox", "FilterChip"].filter((name) => !calls(functionNamed(controls.ast, name) ?? {}).has("event.stopPropagation")).join(", "),
        ""
    );
    // THE FILTER CHIP AND THE SEARCH FIELD (#520), 1a's band. The chip is `Choice`'s pattern
    // taking several: a combobox naming its list and its label, the multi-value keys, a list
    // marked as taking several and counting each option, a blur that takes nothing, and a ×
    // that empties it and hands focus back to the chip, which is one element in both looks.
    // The search field says what it searches as its name, and its × keeps the caret in it.
    const sourceOfFunction = (name) => {
        const fn = functionNamed(controls.ast, name);
        return fn ? controls.source.slice(fn.start, fn.end) : "";
    };
    const chipSource = sourceOfFunction("FilterChip");
    check(
        "a filter chip is the select-only combobox taking several, its list counting each option, and leaving it takes nothing (#520)",
        [
            /const action = single \? selectOnlyKey\(event, open\) : multiSelectKey\(event, open\);/.test(chipSource),
            /role="combobox"/.test(chipSource) && /aria-haspopup="listbox"/.test(chipSource) && /aria-labelledby=\{labelId\}/.test(chipSource),
            /rows="sm"\s+multiselectable=\{!single\}\s+options=/.test(chipSource) && /detail: option\.count,\s*selected: taken\.has\(option\.value\),/.test(chipSource),
            /onBlur=\{\(\) => \{\s*if \(single && open\) choose\(active\);\s*setOpen\(false\);\s*\}\}/.test(chipSource),
            /setOpen\(false\);\s*onChange\(\[\]\);\s*chipRef\.current\?\.focus\(\);/.test(chipSource),
        ].join(" "),
        "true true true true true"
    );
    // ONE TAKING ONE VALUE IS `Choice`'s PATTERN TO THE LETTER (#520), 1b's type and category: its
    // list checks the value held and draws no box, a pick chooses and closes, leaving chooses what
    // is under visual focus (above), it opens on the value held, and holding one it says the value
    // alone — and its list opens where its caller says, at the end of a row.
    check(
        "  and one taking one value checks it, chooses and closes, and says the value alone (#520)",
        [
            /checked: single && index === chosen,/.test(chipSource),
            /single\s*\?\s*\(index\) => \{\s*choose\(index\);\s*setOpen\(false\);\s*\}\s*:\s*toggle/.test(chipSource),
            /case "closeSelect":\s*choose\(active\);\s*setOpen\(false\);/.test(chipSource),
            /const opening = \(\) => \(single \? chosen :/.test(chipSource),
            /\{!single && <span className="text-foreground-subtle">\{label\}<\/span>\}/.test(chipSource),
            /fit=\{fit\}/.test(chipSource),
        ].join(" "),
        "true true true true true true"
    );
    const searchSource = sourceOfFunction("SearchField");
    check(
        "  and a search field names itself by what it searches, its × emptying it with the caret kept (#520)",
        [
            /<div role="search"/.test(searchSource),
            /aria-label=\{label\}\s*placeholder=\{label\}/.test(searchSource),
            /onChange\(""\);\s*inputRef\.current\?\.focus\(\);/.test(searchSource),
        ].join(" "),
        "true true true"
    );
    const multiMenuSource = parseFile(MENU).source;
    check(
        "  the list says it takes several and draws each option's box, and a value at its end keeps 0a's 24 (#520)",
        [
            /aria-multiselectable=\{multiselectable \|\| undefined\}/.test(multiMenuSource),
            /\{multiselectable && \(\s*<span\s+aria-hidden="true"/.test(multiMenuSource) && /option\.selected \? "border-primary bg-primary" : "border-checkbox-border bg-white"/.test(multiMenuSource),
            /pl-\[calc\(var\(--spacing-menu-value-inline\)-var\(--spacing-gap\)\)\]/.test(multiMenuSource),
        ].join(" "),
        "true true true"
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
                /\$\{BUTTON\} \$\{sizeOf\(variant, size\)\} \$\{insetOf\(variant, size\)\} \$\{BUTTON_VARIANT\[variant\]\} \$\{SHEET_BUTTON\} \$\{SHEET_BUTTON_VARIANT\[variant\]\}/.test(functionSource(name))
            ),
            label: /const FIELD_LABEL = "[^"]*max-sm:in-data-\[sheet\]:text-mobile-body-sm"/.test(source),
            // An alert unless its caller says it answers nothing (#527, `DialogActions`' note).
            refusal:
                /export function Refusal\(\{ centered = false, role = "alert", children \}\)/.test(source) &&
                /role=\{role\}[\s\S]*max-sm:in-data-\[sheet\]:text-mobile-body-sm/.test(functionSource("Refusal")),
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
            // A form field holds 12 either side, a dialog's as a sign-in page's, and a choice shows
            // what it holds at 400 (0a Side room, #505): until then a dialog's field and choice held a
            // 36 button's 16, and the choice its value at 500, which no drawing drew.
            fieldSideRoom: [
                /lg: "h-control-lg px-input-inset-x text-body"/.test(constant("TEXT_INPUT_SIZE")),
                /xl: "h-control-xl px-input-inset-x /.test(constant("TEXT_INPUT_SIZE")),
                /field: \(refused\) =>\s*`[^`]*rounded-control border bg-white px-input-inset-x text-body outline-none/.test(constant("CHOICE_LOOK")),
                /rounded-control border bg-white px-input-inset-x text-body /.test(functionSource("Combobox")),
                !/font-medium/.test(constant("CHOICE_LOOK").split(/\n\s*chip:/)[0]),
            ].join(" "),
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
    check("a form field holds 12 either side at both sizes, a choice's and a combobox's too, and a choice's value is 400 (#505)", controlRules.fieldSideRoom, "true true true true true");

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
            /className=\{?[`"][^`"]*\bpy-menu-inset font-ui text-body-sm\b/.test(fieldListSource),
            /\{option\.match \? \(\s*<>\s*\{option\.match\.before\}\s*<span className="font-semibold">\{option\.match\.match\}<\/span>/.test(fieldListSource),
        ].join(" "),
        "true true"
    );
    // A LIST A CHIP OR A BREADCRUMB LEVEL OPENS IS SIZED THE MENU'S WAY (#519): 140 to 280 by its
    // longest option, from the control's left — the job's chip at least 160 and as wide as it
    // since #566, where its list stood against its right end — and 32 rows under both. And the two
    // looks that open them: the job's chip, 1a's 32 at least 128 wide behind a pin, 9 before the
    // pin and 8 on its 12 chevron's side, its words at 13 and 500 (#566); and the level, the
    // breadcrumb's 26 with its 12 chevron 6 on.
    const choiceLooks = parseFile(CONTROLS).source;
    const looksOf = (source) => {
        const at = source.indexOf("const CHOICE_LOOK");
        return at < 0 ? "" : source.slice(at, source.indexOf("};", at));
    };
    const choiceFrames = looksOf(choiceLooks);
    const chipLook = choiceFrames.slice(choiceFrames.indexOf("chip:"), choiceFrames.indexOf("crumb:"));
    const crumbLook = choiceFrames.slice(choiceFrames.indexOf("crumb:"));
    check(
        "a list a chip or a level opens is 140 to 280, from the control's start, the job's at least 160 and its chip, 32 rows under both",
        [
            /fit === "field" \? "" : "w-max min-w-menu max-w-menu"/.test(fieldListSource),
            /if \(fit === "end"\) \{\s*list\.style\.left = "auto";\s*list\.style\.right = `\$\{document\.documentElement\.clientWidth - box\.right\}px`;\s*list\.style\.minWidth = `max\(var\(--min-width-menu\), \$\{box\.width\}px\)`;/.test(fieldListSource),
            /if \(minWidth\) list\.style\.minWidth = `max\(\$\{minWidth\}, \$\{box\.width\}px\)`;/.test(fieldListSource),
            /rows === "sm" \? "h-control" : "h-control-lg"/.test(fieldListSource),
            /fit=\{look === "field" \? "field" : "start"\}/.test(choiceLooks) &&
                /minWidth=\{look === "chip" \? "var\(--min-width-job-chip-list\)" : undefined\}/.test(choiceLooks) &&
                /rows=\{look === "field" \? "lg" : "sm"\}/.test(choiceLooks),
        ].join(" "),
        "true true true true true"
    );
    check(
        "  the chip: 32 and at least 128, 9 before its pin and 8 on its chevron's side, 6 apart, at 13 and 500 on an Edge, its Wash held while open (#566)",
        [
            ["h-control ", "min-w-job-chip", "pl-job-chip-inset-left", "pr-job-chip-inset-right", "gap-control-icon-gap", "text-body-sm", "font-medium", "border-border", "bg-white", "aria-expanded:bg-hover-subtle"]
                .filter((t) => !chipLook.includes(t))
                .join(" "),
            /\{look === "chip" && <Icon name="map-pin" className="size-icon-sm shrink-0 text-foreground-subtle" \/>\}/.test(choiceLooks),
            /: look === "chip"\s*\? "size-job-chip-chevron shrink-0 text-foreground-subtle"/.test(choiceLooks),
            /look === "chip" && label|aria-hidden="true" className="shrink-0 text-foreground-subtle">\s*\{label\}/.test(choiceLooks),
        ].join(" · "),
        " · true · true · false"
    );
    check(
        "  the level: the breadcrumb's 26, its side room pulled back, 13 at 600 in Ink 2, the chevron 6 on",
        ["h-control-inline", "-mx-control-inline-inset-x", "px-control-inline-inset-x", "text-body-sm", "font-semibold", "text-foreground-muted", "gap-breadcrumb-chevron-gap"].filter((t) => !crumbLook.includes(t)).join(" "),
        ""
    );
    check("  and a chip with no look of its own is seen (anti-vacuity)", looksOf("const X = 1;").length, 0);
    // AN OPTION'S NOTE (#519): a job's name after its code, at Ink 3 and 8 on, cut before the code
    // is — in the list as two boxes of the row, and in the field the same way (1b, 1i). A list
    // with a note in it, and a level's, sets each label at 500 in even figures (1b, 1d, 1f, 1i).
    const noteOf = ({ list, choice }) => [
        /<span\s+className=\{`\$\{option\.note \? "shrink-0" : `min-w-0 truncate \$\{multiselectable \? "flex-1" : ""\}`\} \$\{option\.strong \? "font-medium tabular-nums" : ""\}`\}\s*>/.test(list),
        /\{option\.note && <span className="min-w-0 flex-1 truncate text-foreground-subtle">\{option\.note\}<\/span>\}/.test(list),
        /const strong = look === "crumb" \|\| options\.some\(\(option\) => option\.note\);/.test(choice),
        /note: option\.note,\s*strong,/.test(choice),
        /\{chosen >= 0 && options\[chosen\]\.note \? \(\s*<span className="flex min-w-0 flex-1 gap-gap text-foreground-default">\s*<span className="shrink-0">\{options\[chosen\]\.label\}<\/span>\s*<span className="min-w-0 truncate text-foreground-subtle">\{options\[chosen\]\.note\}<\/span>/.test(choice),
    ].join(" ");
    check(
        "an option's note: after its label at Ink 3, 8 on and cut first, in the list and in the field, and labels at 500 beside one or under a level",
        noteOf({ list: fieldListSource, choice: choiceLooks }),
        "true true true true true"
    );
    check(
        "  and a note drawn as the label's own text, a label strong only under a level, and a field that drops it are seen (anti-vacuity)",
        noteOf({
            list: '<span className="min-w-0 truncate">{option.label} {option.note}</span>',
            choice: 'const strong = look === "crumb";\nnote: option.note,\n{chosen >= 0 ? options[chosen].label : placeholder}',
        }),
        "false false false false false"
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
    // AN ITEM SHOWS FOCUS ONLY AS `focus-visible` (#501). Opening moves focus onto an item by
    // script, so a look drawn on `:focus` met the press that opened the account's menu with
    // `Sign out` already shaded, as if pointed at. `focus-visible` is the browser's word for
    // focus the keyboard put there, so every look an item takes is read for a bare `focus:`.
    const focusLooks = ({ ast }) => {
        const texts = [];
        const reached = new Set();
        const strings = (node, from) =>
            walk(node, (m) => {
                if (m.type === "Literal" && typeof m.value === "string") texts.push(m.value);
                if (m.type === "TemplateElement") texts.push(m.value.cooked ?? "");
                if (m.type === "Literal" || m.type === "TemplateElement") reached.add(from);
            });
        walk(ast, (n) => {
            if (n.type === "VariableDeclarator" && ["ITEM_LOOK", "DANGER_ITEM", "DETAIL_ITEM"].includes(n.id?.name) && n.init) strings(n.init, n.id.name);
            if (n.type === "JSXOpeningElement" && n.attributes.some((a) => a.name?.name === "role" && a.value?.value === "menuitem"))
                strings(n.attributes.find((a) => a.name?.name === "className")?.value ?? {}, "the item");
        });
        const bare = texts.flatMap((t) => t.split(/\s+/)).filter((t) => t.split(":").slice(0, -1).includes("focus"));
        return { bare, reached: [...reached].sort().join(" | ") };
    };
    const looks = focusLooks(menu);
    check("an item a button's menu opens on shows focus only when the keyboard put it there (#501)", looks.bare.join(" "), "");
    check(
        "  and the plain item, the one with a detail and both destructive looks still show it then",
        [
            /: "hover:bg-hover focus-visible:bg-hover"/.test(menuSource),
            /item\.detail \? "focus-visible:bg-hover active:bg-hover"/.test(menuSource),
            /account: "hover:bg-danger-subtle hover:text-danger focus-visible:bg-danger-subtle focus-visible:text-danger"/.test(menuConstant("DANGER_ITEM")),
            /record:\s*"hover:bg-danger-subtle hover:text-danger focus-visible:bg-danger-subtle focus-visible:text-danger /.test(menuConstant("DANGER_ITEM")),
        ].join(" "),
        "true true true true"
    );
    // Anti-vacuity: the reading reaches the item's classes and the looks it reads, and sees a
    // planted look drawn on focus — assembled while this runs, so Tailwind never builds it.
    check("  the reading reaches the item's own classes and every look it reads", looks.reached, "DANGER_ITEM | DETAIL_ITEM | ITEM_LOOK | the item");
    const onFocus = ["focus", ":bg-hover"].join("");
    const plantedLooks = focusLooks(
        parseSource(
            'const ITEM_LOOK = { account: "h-control" };\n' +
                `export function ActionMenu() { return <button role="menuitem" className={"hover:bg-hover ${onFocus}"} />; }`,
            "<planted Menu>"
        )
    );
    check("  a planted item drawn on focus is seen", plantedLooks.bare.join(" "), onFocus);
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
        const width = constant("WIDTH");
        const fixed = constant("FIXED");
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
            compact: [/\bp-dialog-inset\b/.test(compact), /compact: "max-w-\[min\(var\(--container-dialog\),/.test(width)].join(" "),
            // A dialog that searches a list and picks from it (#520): 0l's 480, and 1b's 490 held
            // while it picks, with no room of its own — the head, the body and the actions each
            // take their 24 inside it, and what it holds takes the height left.
            search: [
                /search: "max-w-\[min\(var\(--container-dialog-search\),/.test(width),
                /var\(--height-dialog-search\)/.test(fixed) && !/\bp-dialog-inset\b/.test(fixed),
                /\$\{wide \? WIDTH\.search : WIDTH\.compact\} \$\{fixed \? FIXED : COMPACT\}/.test(source),
                /data-fixed=\{fixed \? "" : undefined\}/.test(source),
                // The head, the body, the fields on the actions (`foot`) and the actions.
                (source.match(/\bin-data-fixed:px-dialog-inset\b/g) ?? []).length === 4,
                /flex min-h-0 flex-col in-data-fixed:grow/.test(source),
            ].join(" "),
            withPreview: [
                /var\(--container-dialog-preview\)/.test(withPreview),
                /var\(--height-dialog-preview\)/.test(withPreview),
                /var\(--width-dialog-preview-pane\)/.test(withPreview),
                !/\bp-dialog-inset\b/.test(withPreview),
            ].join(" "),
            // Since #495 the pane reserves 0i's lane and draws its bar, its room 24 16 24 24 so
            // the pages stand 24 from the lane, and it stops at its end (1e).
            pane: [
                /\bbg-background-muted\b/.test(paneSource),
                /\boverflow-y-auto\b/.test(paneSource),
                /\bpy-dialog-inset\b/.test(paneSource) &&
                    /\bpl-dialog-inset\b/.test(paneSource) &&
                    /pr-\[calc\(var\(--spacing-dialog-inset\)-var\(--spacing-scrollbar-gutter\)\)\]/.test(paneSource),
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
                return /ref=\{scrollerRef\}\s*className=\{`[^`]*\boverflow-y-auto overscroll-contain\b/.test(body);
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
    check("  a dialog that searches is 480, held at 490 while it picks, its parts taking their own room (#520)", builds.search, "true true true true true true");
    check("  a preview's build is 780 by 520 with a 440 pane, and no room of its own", builds.withPreview, "true true true true");
    check("  its pane is on the Field ground, scrolls in 0i's reserved lane with its own room, and stops at its end (#495)", builds.pane, "true true true true true");
    check("  and the column beside it takes the Compact build's room, its body scrolling across it (#495)", builds.column, "true true true true");
    // 1e STANDS THE ACTIONS AT THE COLUMN'S FOOT, 460 down a 520 dialog, whatever the body
    // holds above them: the body takes the column's spare room. In the Compact build the
    // column is its content's height, so there is none to take and nothing moves.
    check("  the body takes the column's spare room, so the actions stand at its foot", builds.bodyGrows, true);
    check("a dialog's body stops at its end rather than scrolling the page behind it (#495)", builds.bodyContained, true);

    // THE SEARCH A DIALOG IS BUILT AROUND (#520), 1b's first step: the field a combobox over
    // results that always show — expanded, naming them, pointing at the one under visual focus —
    // its keys `searchResultsKey`'s, no result held until an arrow moves to one (#522; the first
    // was held once something was typed from #520) and a keystroke giving visual focus up, a result pressed with its mousedown stopped so focus stays
    // in the field, and the whole marked as the dialog's body, so focus that falls in the dialog
    // comes back to the field. A secondary action stands at the actions' left (1b's `Back`), a
    // ghost pulled out by its side room, and a ghost is its word alone in Ink, 10 either side.
    const searchFn = functionNamed(frame.ast, "DialogSearch");
    const searchPart = searchFn ? frame.source.slice(searchFn.start, searchFn.end) : "";
    check(
        "a dialog's search is a combobox over results that always show, none held until an arrow moves to one (#522)",
        [
            /role="combobox"\s*aria-expanded="true"\s*aria-controls=\{listId\}\s*aria-autocomplete="list"\s*aria-activedescendant=\{active >= 0 \? `\$\{listId\}-\$\{active\}` : undefined\}/.test(searchPart),
            calls(searchFn ?? {}).has("searchResultsKey"),
            /const active = moved >= 0 && moved < count \? moved : -1;/.test(searchPart),
            /const type = \(next\) => \{\s*setMoved\(-1\);\s*onChange\(next\);/.test(searchPart),
            /role="option"\s*aria-selected=\{index === active \? "true" : "false"\}\s*onMouseDown=\{\(event\) => event\.preventDefault\(\)\}/.test(searchPart),
            /<div data-dialog-body="" /.test(searchPart),
        ].join(" "),
        "true true true true true true"
    );
    // THE RESULTS STAND UNDER A CLEAR 1 WHILE ANY ARE LISTED (1b, #538): the grouped list's first
    // rule, drawn clear, and none over `empty`, where 1b draws no group.
    check(
        "  the results stand under a clear 1 while any are listed, and `empty` at the list's 8 (#538)",
        /role="listbox" aria-label=\{resultsLabel\} className=\{`flex flex-col \$\{count > 0 \? "border-t border-transparent" : ""\}`\}/.test(searchPart),
        true
    );
    const actionsFn = functionNamed(frame.ast, "DialogActions");
    const actionsPart = actionsFn ? frame.source.slice(actionsFn.start, actionsFn.end) : "";
    const controlSource = parseFile(CONTROLS).source;
    check(
        "  a secondary action stands first at the actions' left, pulled out, and a ghost is its word alone (#520)",
        [
            /\{secondary && <div className="mr-auto -ml-ghost-inset-x flex">\{secondary\}<\/div>\}\s*\{children\}/.test(actionsPart),
            /ghost: "text-foreground-default not-disabled:not-aria-disabled:hover:bg-hover",/.test(controlSource),
            /const GHOSTS = \["ghost", "ghostDanger"\];/.test(controlSource) &&
                /const insetOf = \(variant, size\) =>\s*GHOSTS\.includes\(variant\) \? "px-ghost-inset-x" : variant === "faced" \? "pr-faced-inset-right pl-faced-inset-left" : BUTTON_INSET\[size\];/.test(controlSource),
        ].join(" "),
        "true true true"
    );
    // A FACED ACTION (0f Faced, 1a's `Catalog`, #566): no outline at a 36, its mark and word in Ink
    // 2 lifting to Ink as it fills at Hover, 10 before the mark and 12 after the word, and the
    // mark the caller's, 8 before the word.
    check(
        "  a faced action is no outline at a 36 in Ink 2, filling at Hover and lifting to Ink, its mark 8 before its word (#566)",
        [
            /faced: "text-foreground-muted not-disabled:not-aria-disabled:hover:bg-hover not-disabled:not-aria-disabled:hover:text-foreground-default",/.test(controlSource),
            /export function ButtonLink\(\{ variant = "filled", size = "lg", href, mark, children \}\)/.test(controlSource),
            /\$\{SHEET_BUTTON_VARIANT\[variant\]\}\$\{mark \? " gap-gap" : ""\}`\}\s*>\s*\{mark\}\s*\{children\}/.test(controlSource),
        ].join(" "),
        "true true true"
    );
    // ITS DESTRUCTIVE KIND, AND ITS SIZE BESIDE 36s (0f Ghost and Destructive, 1l; #527): at rest
    // its word in Ink on nothing, red on red's Face under the pointer; and among 36s one step
    // under, the Control's 32, keeping the row's 14.
    check(
        "  a ghost that removes is transparent at rest and red on red's Face under the pointer, and one among 36s is 32 at 14 (#527)",
        [
            /ghostDanger: "text-foreground-default not-disabled:not-aria-disabled:hover:bg-danger-subtle not-disabled:not-aria-disabled:hover:text-danger",/.test(controlSource),
            /const sizeOf = \(variant, size\) => \(GHOSTS\.includes\(variant\) && size === "lg" \? "inline-flex h-control shrink-0 text-body" : BUTTON_SIZE\[size\]\);/.test(controlSource),
        ].join(" "),
        "true true"
    );
    // A NOTE ON THE REFUSAL'S LINE (#527): what a press will do, said before it, as a status, and
    // a refusal taking the line from it.
    check(
        "  and the line over the actions carries a note before any press, heard as a status, a refusal taking its place",
        /\{refusal \? <Refusal>\{refusal\}<\/Refusal> : note && <Refusal role="status">\{note\}<\/Refusal>\}/.test(actionsPart),
        true
    );
    // 0l's CHIPS (#520), 1b's size and model: a radio group named by its label, one stop for Tab on
    // the chip chosen or the first, the arrows moving and choosing through `radioKey`, an equal-width
    // grid each as wide as the widest label measured once drawn and once the faces load, 72 at
    // least; a refusal at the right end of the label's line; the chosen chip on the Face in its Edge
    // and an empty option in Ink 3. And a body holding its dialog's height: what scrolls reserves
    // 0i's lane, and the fields always asked sit under it, outside the scroll, 14 below it.
    const chipFn = functionNamed(parseFile(CONTROLS).ast, "ChipChoice");
    const chipPart = chipFn ? controlSource.slice(chipFn.start, chipFn.end) : "";
    check(
        "a group of chips is a radio group, one Tab stop, the arrows choosing, each as wide as the widest (#520)",
        [
            /role="radiogroup"\s*aria-labelledby=\{labelId\}/.test(chipPart),
            /role="radio"\s*aria-checked=\{on\}/.test(chipPart),
            /tabIndex=\{on \|\| \(chosen < 0 && index === 0\) \? 0 : -1\}/.test(chipPart),
            calls(chipFn ?? {}).has("radioKey") && /const next = action === "check" \? index : menuIndex\(index, options\.length, action\);\s*choose\(next\);/.test(chipPart),
            /minmax\(min\(100%,max\(var\(--min-width-dialog-chip\),calc\(var\(--chip-label-width,0px\)\+2\*var\(--spacing-input-inset-x\)\+2px\)\)\),1fr\)/.test(chipPart),
            /each\.scrollWidth/.test(chipPart) && /grid\.style\.setProperty\("--chip-label-width"/.test(chipPart) && /document\.fonts\?\.ready\.then\(measure\)/.test(chipPart),
        ].join(" "),
        "true true true true true true"
    );
    check(
        "  its refusal on its label's line, the chosen chip on the Face, an empty option in Ink 3 (#520)",
        [
            /justify-between[^"]*"[\s\S]*?role="alert" className="text-body-sm text-danger"/.test(chipPart),
            /chosen: "border-selected-border bg-selected not-aria-disabled:hover:bg-selected-hover"/.test(controlSource),
            /option\.empty \? "text-foreground-subtle" : "text-foreground-default"/.test(chipPart),
        ].join(" "),
        "true true true"
    );
    const bodyFn = functionNamed(frame.ast, "DialogBody");
    const bodyPart = bodyFn ? frame.source.slice(bodyFn.start, bodyFn.end) : "";
    check(
        "  and a body holding its height scrolls in 0i's lane, the fields always asked under it (#520)",
        [
            /lane\s*\?\s*`pt-\[[^\]]*\] pr-\[calc\(var\(--spacing-dialog-inset\)-var\(--spacing-scrollbar-gutter\)\)\] pl-dialog-inset \[scrollbar-gutter:stable\] \$\{SCROLL_LANE\}`/.test(bodyPart),
            /\{foot && <div className="shrink-0 pt-gap-lg in-data-fixed:px-dialog-inset">\{foot\}<\/div>\}\s*<\/div>\s*\);/.test(bodyPart),
            /\{hidden\.below && [^\n]*\n\s*<\/div>\s*\{foot &&/.test(bodyPart),
            // What scrolls is what the dialog holds and nothing more: the fields never scroll.
            /`\}\s*>\s*\{children\}\s*<\/div>\s*\{hidden\.above/.test(bodyPart),
        ].join(" "),
        "true true true true"
    );
    // A BODY IN THE LANE STANDS 16 UNDER THE HEAD (1b, 2026-10-12): the Rule it shows once it
    // scrolls is drawn in the last row of that 16, as 1b's head draws it at its foot, and what
    // scrolls keeps the 20 from the title's line at rest, 4 of it inside the lane. A body out of
    // the lane keeps its 20 inside and its Rule at its own top.
    check(
        "  and one in the lane stands 16 under the head, its Rule in the head's last row, 20 from the line at rest",
        [
            /className=\{`relative flex min-h-0 grow flex-col \$\{lane \? "mt-dialog-header-inset-bottom" : ""\}`\}/.test(bodyPart),
            bodyPart.includes("pt-[calc(var(--spacing-dialog-header-stack)-var(--spacing-dialog-header-inset-bottom))]"),
            /: `pt-dialog-header-stack in-data-preview:px-dialog-inset/.test(bodyPart),
            /\{hidden\.above && <div aria-hidden="true" className=\{`absolute inset-x-0 h-px bg-divider \$\{lane \? "-top-px" : "top-0"\}`\} \/>\}/.test(bodyPart),
        ].join(" "),
        "true true true true"
    );

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
            done: /\{done \? \(/.test(frameSource) && /onClick=\{busy \? undefined : done\.onPress\}/.test(frameSource),
            // A `Done` that sends what its sheet holds is 0f's Working while the frame is busy
            // (#533): its press turned away, busy and locked to assistive tech, and its word laid
            // under the spinner — and a `Done` that only puts a sheet away names no word.
            doneBusy: [
                /aria-busy=\{busy && done\.busyLabel \? true : undefined\}/.test(frameSource),
                /aria-disabled=\{busy \? true : undefined\}/.test(frameSource),
                /data-busy=\{\(busy && done\.busyLabel\) \|\| undefined\}/.test(frameSource),
                /<ButtonLabel busyLabel=\{done\.busyLabel\}>\{done\.label\}<\/ButtonLabel>/.test(frameSource),
            ].join(" "),
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
    check("  which says it is working while its sheet sends, and turns its press away (#533)", sheetRules.doneBusy, "true true true true");
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
            (() => {
                // The body's scroller writes its class as a template since #520, its sides chosen
                // by whether it reserves 0i's lane, so it is read off the function's source.
                const fn = functionNamed(frame.ast, "DialogBody");
                return Boolean(fn) && /max-sm:in-data-\[sheet=drawer\]:gap-mobile-field-stack/.test(frame.source.slice(fn.start, fn.end));
            })(),
            partClass("DialogMessage", (c) => /max-sm:in-data-\[sheet\]:text-mobile-body/.test(c)),
            partClass("DialogActions", (c) => /max-sm:in-data-\[sheet\]:flex-col-reverse max-sm:in-data-\[sheet\]:gap-mobile-drawer-action-stack/.test(c)),
            partClass("DialogActions", (c) => /max-sm:in-data-\[sheet\]:pt-mobile-drawer-body-stack/.test(c)),
        ].join(" "),
        "true true true true"
    );
    // A SHEET'S ROWS (0a Sheet): 56 at least, 15 and 16 inside, an Inner rule 16 in between
    // two, and the check on the row already chosen — 17 in Accent, a mark from `Icon.js` (#502).
    const rowsFn = functionNamed(frame.ast, "SheetRows");
    const rowsSource = rowsFn ? frame.source.slice(rowsFn.start, rowsFn.end) : "";
    check(
        "a sheet's rows are 0a's, the one chosen checked",
        [
            /min-h-mobile-drawer-row/.test(rowsSource),
            /px-mobile-drawer-row-inset-x py-mobile-drawer-row-inset-y/.test(rowsSource),
            /\{index > 0 && <div aria-hidden="true" className="ml-mobile-drawer-row-inset-x h-px bg-divider-subtle" \/>\}/.test(rowsSource),
            /\{row\.chosen && <Icon name="check" className="size-mobile-drawer-row-icon shrink-0 text-primary" \/>\}/.test(rowsSource),
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

    // ── 5: one frame on the assets axis ──────────────────────────────────────
    log("");
    log("no file on the assets axis draws a dialog on the old frame, since #458:");
    const assetsFiles = listJsFiles(repoPath("app/(assets)")).map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1));
    const onOldFrame = assetsFiles.filter((rel) => drawsOldFrame(readFileSync(repoPath(rel), "utf8"))).sort();
    check("  the files on it", onOldFrame.length, 0);
    const onNewFrame = assetsFiles.filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/DialogFrame")).sort();
    // The registration's dialog (#456), the landing's two (#459), the labels' (#457), and the
    // asset page's transition, its retirement's question and 1j's two sheets (#458).
    check(
        "  and the frame's callers on the axis are the dialogs drawn on it",
        onNewFrame.join(", "),
        [
            "app/(assets)/assets/LabelsDialog.js",
            "app/(assets)/assets/[assetId]/JobSheet.js",
            "app/(assets)/assets/[assetId]/NameSheet.js",
            "app/(assets)/assets/[assetId]/RetirementConfirm.js",
            "app/(assets)/assets/[assetId]/TransitionDialog.js",
            "app/(assets)/asset-categories/RegistrationDialog.js",
            "app/(assets)/asset-categories/[categoryRecordId]/RegistrationShortfall.js",
            "app/(assets)/asset-categories/[categoryRecordId]/RegistrationUnlogged.js",
            // The catalog's entry and its removal's question (#527).
            "app/(assets)/asset-catalog/CatalogDialogs.js",
            // An item's note: the desk's dialog and the phone's sheet (#533).
            "app/(assets)/assets/[assetId]/AssetNote.js",
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
        // A dialog waiting on an action that is not its submit (#527): that action works by its
        // own `busy`, and the submit, which did nothing, locks with the rest.
        [{ formBusy: "action", submits: true }, "locked", "  a form waiting on another action locks its submit, which did nothing"],
        [{ formBusy: "action" }, "locked", "    and every other button"],
        [{ formBusy: "action", busy: true }, "working", "    but the action it waits on works"],
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

    // WHETHER THE PAGE TOOK A CONTROL AWAY WITH FOCUS ON IT, OUTSIDE A DIALOG (#519), by value:
    // a refused press redrawn without its control, a selection bar gone inert under its clear.
    const fellFromPage = (facts) =>
        focusFellFromPage({ held: true, heldCanHold: false, onDocument: true, samePage: true, dialogOpen: false, ...facts });
    check("a control the page took away with focus on it has let focus fall", fellFromPage({}), true);
    check("  but one that can still hold focus has not", fellFromPage({ heldCanHold: true }), false);
    check("  focus somewhere else went there on purpose", fellFromPage({ onDocument: false }), false);
    check("  an open dialog keeps its own rule", fellFromPage({ dialogOpen: true }), false);
    check("  a new address is a navigation's to place", fellFromPage({ samePage: false }), false);
    check("  and nothing held focus, nothing fell", fellFromPage({ held: false }), false);

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
        // A control that locks asks whether the form waits on anything at all; the button asks
        // what it waits on, its submit or another action (#527).
        const reads = (name) => /const formBusy = Boolean\(useContext\(FormBusyContext\)\);/.test(fnSource(name));
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
        // Choice's frames live in a constant since #519, one per look.
        const choiceLook = constant("CHOICE_LOOK");
        return {
            provider: /export function FormBusy\(\{ busy, children \}\) \{\s*return <FormBusyContext\.Provider value=\{busy\}>\{children\}<\/FormBusyContext\.Provider>;/.test(source),
            button: [
                /const formWaits = useContext\(FormBusyContext\);/.test(button),
                /buttonBusyState\(\{ busy, formBusy: formWaits, submits: type === "submit", disabled \}\)/.test(button),
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
                // Each look's hover is gated as the field's is (#519): the chip and the crumb stand
                // in no busy form today, and the gate keeps one that comes to.
                /not-aria-readonly:hover:bg-hover-subtle/.test(choiceLook) && !/(?<!not-aria-readonly:)hover:/.test(choiceLook),
            ].join(" "),
            combobox: [
                reads("Combobox"),
                /readOnly=\{formBusy\}/.test(combobox),
                /const shown = listOpen && list\.length > 0 && !formBusy;/.test(combobox),
                /const onKeyDown = \(event\) => \{\s*if \(formBusy\) return;/.test(combobox),
                // Focus arriving and a press in the field both open it (#555), and neither does
                // while the form waits.
                /onFocus=\{\(\) => \{\s*if \(!formBusy\) open\(\);/.test(combobox) && /onClick=\{\(\) => \{\s*if \(!formBusy && !shown\) open\(\);/.test(combobox),
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

    // THE HAND IS ONE RULE, AND WHAT DOES NOT ACT WITHHOLDS IT (#501). Tailwind 4's preflight
    // gives a button none, so `app/globals.css` gives it in the base layer — where a control's
    // own cursor still wins — to every button neither `disabled` nor `aria-disabled`, which is
    // what a disabled action, a busy or locked one and a close held while its dialog sends say.
    // Each rule giving the hand is read with the layers it sits in, comments stripped.
    const handRules = (css) => {
        const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
        const rules = [];
        const open = [];
        let prelude = "";
        for (const ch of text) {
            if (ch === "{") {
                open.push(prelude.trim());
                prelude = "";
            } else if (ch === "}") {
                const selector = open.pop() ?? "";
                if (/(^|;)\s*cursor\s*:\s*pointer\s*(;|$)/.test(prelude.trim()))
                    rules.push({
                        layers: open.filter((p) => p.startsWith("@layer")).map((p) => p.replace(/^@layer\s+/, "")).join(" > ") || "none",
                        selectors: selector.split(/,\s*(?![^(]*\))/).map((s) => s.trim().replace(/\s+/g, " ")),
                    });
                prelude = "";
            } else if (ch === ";" && open.length === 0) prelude = "";
            else prelude += ch;
        }
        return rules;
    };
    const hands = handRules(readFileSync(`${REPO_ROOT}/app/globals.css`, "utf8"));
    check("a control that acts shows the hand, from one rule in the base layer (#501)", hands.map((r) => r.layers).join(" | "), "base");
    check(
        "  given to a button and to what says it is one, unless it is disabled or aria-disabled",
        hands.flatMap((r) => r.selectors).join(" | "),
        'button:not(:disabled, [aria-disabled="true"]) | [role="button"]:not(:disabled, [aria-disabled="true"])'
    );
    const controlsText = controls.source;
    const closeTag = frame.source.match(/<button[^>]*aria-label=\{COPY\.close\}[^>]*>/)?.[0] ?? "";
    check(
        "  which is what a disabled action, a busy or locked one and a close held while its dialog sends say",
        [/disabled=\{disabled\}/.test(controlsText), /aria-disabled=\{state \? true : undefined\}/.test(controlsText), /aria-disabled=\{busy \? true : undefined\}/.test(closeTag)].join(" "),
        "true true true"
    );
    // Anti-vacuity: a planted rule outside the layer, withholding the hand from disabled alone,
    // is read as what it is, and a stylesheet giving no hand reads as none.
    const plantedHands = handRules('@import "tailwindcss";\nbutton:not(:disabled) { cursor: pointer; }\n@layer base { a { color: red; } }');
    check(
        "  a planted rule outside the layer, withholding the hand from disabled alone, is seen",
        `${plantedHands.map((r) => r.layers).join(" | ")} ~ ${plantedHands.flatMap((r) => r.selectors).join(" | ")}`,
        "none ~ button:not(:disabled)"
    );
    check("  and a stylesheet that gives none is read so", handRules(":root { color-scheme: light; }").length, 0);

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
            close: [/aria-disabled=\{busy \? true : undefined\}/.test(frameSource), !/\sdisabled=\{busy\}/.test(frameSource), /not-aria-disabled:hover:bg-hover/.test(frameSource)].join(" "),
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

    // THE COLUMN A SCREEN SCROLLS IN PUTS FOCUS A PAGE TOOK AWAY ON ITS HEADING (#519), read off
    // `Rail.js`: it follows what holds focus and where, watches what it holds change — its
    // children, and an element turning disabled, hidden or inert, as the frame watches its own —
    // asks `focusFellFromPage` of the frame's own `canHoldFocus`, counting focus still on the
    // dead control as fallen, and puts focus where a dialog's closing does.
    const columnKeeper = (railSource) => {
        const hook = railSource.slice(railSource.indexOf("function useHeadingWhenFocusFalls"), railSource.indexOf("export default function Rail"));
        return [
            /held = event\.target;\s*heldAt = window\.location\.pathname;/.test(hook),
            /observer\.observe\(column, \{ childList: true, subtree: true, attributes: true, attributeFilter: \["disabled", "hidden", "inert"\] \}\);/.test(hook),
            /heldCanHold: Boolean\(held && canHoldFocus\(held\)\)/.test(hook),
            /onDocument: document\.activeElement === null \|\| document\.activeElement === document\.body \|\| document\.activeElement === held/.test(hook),
            /samePage: heldAt === window\.location\.pathname/.test(hook) && /dialogOpen: Boolean\(document\.querySelector\("dialog\[open\]"\)\)/.test(hook),
            /if \(!fell\) return;\s*held = null;\s*focusPageHeading\(\);/.test(hook),
            /useHeadingWhenFocusFalls\(columnRef\);/.test(railSource) && /<div ref=\{columnRef\} className=\{COLUMN\}>/.test(railSource),
        ].join(" ");
    };
    const railSource = parseFile("app/components/Rail.js").source;
    check("the column puts focus a page took away on the page's heading", columnKeeper(railSource), "true true true true true true true");
    check(
        "  and a column that watches only what it holds, not what turns inert, is seen (anti-vacuity)",
        columnKeeper(railSource.replace('attributes: true, attributeFilter: ["disabled", "hidden", "inert"] ', "")),
        "true false true true true true true"
    );

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
                // A sheet whose `Done` sends what it holds names that `Done`'s working word (#533),
                // which is how it is told from a `Done` that only puts the sheet away.
                if (inner.name?.name === "DialogFrame")
                    frames.push({ submits: attribute("onSubmit") !== undefined, sendsByDone: /\bbusyLabel\b/.test(valueOf("done") ?? ""), busy: valueOf("busy") });
                if (inner.name?.name === "Button") {
                    if (valueOf("type") === '"submit"') commitments.push(valueOf("busyLabel") ? "named" : "unnamed");
                    if (/\bpending\b/.test(valueOf("disabled") ?? "")) disabledBySending++;
                }
            });
            for (const f of frames)
                found.push(
                    `${n.id?.name}: ${f.submits ? "submits" : f.sendsByDone ? "sends by its Done" : "asks nothing"} · busy ${f.busy ?? "none"} · ${commitments.join(", ") || "no submit"} · ${disabledBySending} disabled by sending`
                );
        });
        return found;
    };
    const dialogs = assetsFiles
        .filter((rel) => readFileSync(repoPath(rel), "utf8").includes("@/app/components/DialogFrame"))
        .flatMap((rel) => submitFacts(parseFile(rel)))
        .sort();
    check(
        "every dialog on the axis that submits hands its frame its busy state and its commitment a word, with nothing disabled for it",
        dialogs.filter((d) => d.includes(": submits")).join(" | "),
        [
            // The catalog's entry hands its frame what it waits on, its submit or `"action"` (#527),
            // and so does an item's note, `"action"` while `Remove note` is on its way (#533).
            "EntryDialog: submits · busy {busy} · named · 0 disabled by sending",
            'NoteDialog: submits · busy {pending ? (removing ? "action" : true) : false} · named · 0 disabled by sending',
            "RegistrationForm: submits · busy {pending} · named · 0 disabled by sending",
            "RemoveDialog: submits · busy {pending} · named · 0 disabled by sending",
            "RetirementConfirm: submits · busy {pending} · named · 0 disabled by sending",
            "TransitionForm: submits · busy {pending} · named · 0 disabled by sending",
        ].join(" | ")
    );
    // A SHEET THAT SENDS BY ITS `Done` HANDS ITS FRAME THE STATE TOO (#533), which its `Done`
    // reads: the note's sheet, the one sheet on the axis whose `Done` saves.
    check(
        "  and every sheet that sends by its Done hands it its state, its Done naming a word",
        dialogs.filter((d) => d.includes(": sends by its Done")).join(" | "),
        "NoteSheet: sends by its Done · busy {pending} · no submit · 0 disabled by sending"
    );
    check(
        "  and every one that asks nothing hands it none",
        dialogs.filter((d) => d.includes(": asks nothing") && !d.includes("busy none")).join(" | "),
        ""
    );
    // Every file importing the frame draws a dialog on it — the catalog's file two (#527).
    check(
        "  across the dialogs drawn on the frame, in every file that imports it",
        onNewFrame.filter((rel) => submitFacts(parseFile(rel)).length > 0).length,
        onNewFrame.length
    );
    check("    a dialog each, and the catalog's file and the note's their two", dialogs.length, onNewFrame.length + 2);

    // AND EVERY FORM THAT SUBMITS OUTSIDE A FRAME IS HELD TO THE SAME (#463): the asset
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
    const forms = assetsFiles.flatMap((rel) => formFacts(parseFile(rel))).sort();
    check(
        "every form on the axis that submits outside a frame, and every press that waits on a read, says it is busy and names its word (#495)",
        forms.join(" | "),
        [
            // The catalog entry's `Restore` and `Discontinue`, each working by its own `busy` while
            // the rest of the dialog locks (#527).
            'EntryDialog: button {pending && working === "restore"}, button {pending && working === "discontinue"} · named, named, named · 0 disabled by sending',
            "LabelsDialog: button {pending} · named · 0 disabled by sending",
            // 1a's `Export`, working while the file is made (#553).
            "ListExport: button {busy} · named · 0 disabled by sending",
            // An item's note's `Remove note`, working by its own `busy` while the dialog locks (#533).
            "NoteDialog: button {removing} · named, named · 0 disabled by sending",
            // Both lock while the menu's `Send for repair` is on its way, the wait being the
            // menu's, and work for their own press otherwise (#531).
            'TransitionBar: form {repairPending ? "action" : pending} · named · 0 disabled by sending',
            'TransitionDialog: form {repairPending ? "action" : false}, button {!asks && pending} · named · 0 disabled by sending',
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
    // room and width and draws it in a pane on white that does not scroll — and since #520 on
    // a dialog that searches drawn at 420 with the Compact build's room, no height held, and
    // nothing marking it for what it holds.
    const plantedBuilds = buildFacts(
        parseSource(
            'const WIDTH = { compact: "max-w-[min(var(--container-dialog),100vw)]", search: "max-w-[min(var(--container-dialog),100vw)]" };\n' +
                'const COMPACT = "flex-col";\n' +
                'const FIXED = "flex-col p-dialog-inset";\n' +
                'const WITH_PREVIEW = "max-w-[min(var(--container-dialog),100vw)] p-dialog-inset";\n' +
                'export function DialogFrame({ preview }) { return <dialog><div className="bg-white">{preview}</div></dialog>; }\n',
            "<planted-builds>"
        )
    );
    check("  a Compact build with no room of its own is seen", plantedBuilds.compact, "false true");
    check("  a dialog that searches at 420, with no height held and nothing marked, is seen", plantedBuilds.search, "false false false false false false");
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
                "export function NumberField() { const formBusy = Boolean(useContext(FormBusyContext)); return <input readOnly={formBusy} />; }\n" +
                'export function Choice() { const formBusy = Boolean(useContext(FormBusyContext)); return <div aria-readonly={formBusy || undefined} className="hover:bg-hover-subtle" />; }\n' +
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
