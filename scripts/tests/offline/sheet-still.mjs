// A phone's sheet holds still while it is open, and so does the page behind it (#579).
//
// WHY THIS IS A CHECK. On a phone a sheet did not hold still: the page behind it moved with a
// drag on the sheet and with the keyboard, and the sheet's height and the room under its last
// row changed as the page scrolled and the browser's bars came and went. A desk browser's
// phone mode shows none of it, and this tier never opens a page, so it holds the code each
// fix turns on, which is the part a change could quietly undo:
//
//   1. THE PAGE IS HELD WHILE A SHEET IS OPEN (`sheetHold.js:holdPage`), run against a
//      document of its own: `<body>` fixed at minus the page's scroll, the scroll put back
//      as the last sheet lets go, a move of one finger that nothing in the sheet can scroll
//      canceled by a listener that is not passive, and the page put back where the keyboard
//      moved the view from.
//   2. THE SHEET'S HEIGHT AND FOOT ARE READ, NOT FOLLOWED (`watchSheet`): once the page is
//      held, then on a resize that changes the width, on the first resize after the hold, and
//      as the keyboard comes or goes, and on no other resize and no scroll. The judgments
//      deciding it — a width against a height alone, and whether a resize reads again — are
//      held by value.
//   3. THE KEYBOARD'S JUDGMENTS (`keyboardViewport.js`): its height, which a pan of the view
//      does not change, the pan, and a field in a dialog not counting for the page's bar.
//   4. THE FRAME AND THE BARS TAKE THEM: the hold before the opening, only for a sheet laid
//      out as one; the sheet's classes reading what was read; the foot bar asking for the
//      page's keyboard; the top bar asking the page's scroll.
//
// WHAT IT CANNOT SEE. Whether a phone does what the hold assumes — that a canceled move stops
// Safari's pull-to-refresh, that its view pans for a field and reports it, that the bars do
// not move a held page. `docs/notes/design-system.md` has the sources; a phone is where each
// is seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { cancelsTouch, holdPage, pageScroll, resizeKind, sheetRereads, watchSheet } from "../../../app/components/sheetHold.js";
import { isTyping, keyboardCover, keyboardHeight, keyboardPan } from "../../../app/components/keyboardViewport.js";
import { parseFile, repoPath, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";
import { loadDesignSystem } from "./design-values.mjs";

export const title = "A phone's sheet holds still while it is open, and so does the page behind it (#579)";

const FRAME = "app/components/DialogFrame.js";
const HOLD = "app/components/sheetHold.js";

// ─────────────────────────────────────────────────────────────────────────────
// A document of its own
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A page as much as the hold reads of one: a window, a visual viewport, a root and a body,
 * listeners kept in a list, and a stylesheet answering `100dvh` and the safe area for the probe
 * the reads make, and a box's own `overflowY` for anything else.
 */
function fakePage({ scrollY = 0, innerWidth = 373, clientWidth = 373, innerHeight = 810, coarse = true } = {}) {
    const listeners = [];
    const target = (name) => ({
        addEventListener(type, fn, options) {
            listeners.push({ name, type, fn, options });
        },
        removeEventListener(type, fn) {
            const at = listeners.findIndex((l) => l.name === name && l.type === type && l.fn === fn);
            if (at >= 0) listeners.splice(at, 1);
        },
    });
    const element = (props = {}) => ({ nodeType: 1, parentElement: null, style: {}, ...props });
    const page = {
        dvh: 810,
        safeArea: 0,
        scrolls: [],
        listeners,
        element,
    };
    page.body = element({ style: { position: "", top: "", left: "", right: "", transform: "" } });
    page.root = element({
        style: { overflowY: "" },
        clientWidth,
        append(child) {
            child.remove = () => {};
        },
    });
    page.doc = { body: page.body, documentElement: page.root, activeElement: page.body, createElement: () => element(), ...target("doc") };
    page.view = { height: innerHeight, offsetTop: 0, scale: 1, ...target("view") };
    page.win = {
        scrollX: 0,
        scrollY,
        innerWidth,
        innerHeight,
        visualViewport: page.view,
        matchMedia: () => ({ matches: coarse }),
        scrollTo(x, y) {
            page.scrolls.push(`${x},${y}`);
        },
        getComputedStyle(el) {
            if (String(el.style.cssText ?? "").includes("100dvh")) return { paddingTop: `${page.dvh}px`, paddingBottom: `${page.safeArea}px` };
            return { overflowY: el.overflowY ?? "visible" };
        },
        ...target("win"),
    };
    page.fire = (name, type, event = {}) => {
        for (const l of listeners.filter((x) => x.name === name && x.type === type)) l.fn(event);
    };
    page.count = (type) => listeners.filter((l) => l.type === type).length;
    return page;
}

/** What a move of one finger, or more, on an element does while the page is held. */
function moveOn(page, element, { touches = 1, cancelable = true } = {}) {
    let canceled = false;
    page.fire("doc", "touchmove", { target: element, touches: { length: touches }, cancelable, preventDefault: () => (canceled = true) });
    return canceled ? "canceled" : "left";
}

/** The body's place, as the four styles the hold sets. */
const bodyPlace = (page) => [page.body.style.position, page.body.style.top, page.body.style.left, page.body.style.right].join(" ").trim();

// ─────────────────────────────────────────────────────────────────────────────
// The run
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, assert, log }) {
    // ── 1. the page is held ──────────────────────────────────────────────────
    log("1. while a sheet is open the page behind it is held:");
    {
        const page = fakePage({ scrollY: 240 });
        page.body.style.transform = "the page's own";
        const hold = holdPage(page.win, page.doc);
        page.win.scrollY = 0;
        check("  the body is fixed where the page was scrolled to", bodyPlace(page), "fixed -240px 0px 0px");
        check("  the page's scroll is counted where it was, the document's being none", pageScroll(page.win), 240);
        check("  a phone's root keeps its overflow, no scrollbar having taken width", page.root.style.overflowY, "");
        const listener = page.listeners.find((l) => l.type === "touchmove");
        check("  one listener takes a move of the finger, and it is not passive", [page.count("touchmove"), listener?.options?.passive].join(" "), "1 false");

        const dialog = page.element({ overflowY: "hidden", scrollHeight: 420, clientHeight: 420 });
        const titleRow = page.element({ parentElement: dialog });
        const longList = page.element({ overflowY: "auto", scrollHeight: 900, clientHeight: 300, parentElement: dialog });
        const longRow = page.element({ parentElement: longList });
        const shortList = page.element({ overflowY: "auto", scrollHeight: 168, clientHeight: 168, parentElement: dialog });
        const shortRow = page.element({ parentElement: shortList });
        const field = page.element({ tagName: "INPUT", type: "text", parentElement: dialog });
        check(
            "  a move on the title, a short list or what lies behind is canceled; one in a list that scrolls or on a field is not",
            [moveOn(page, titleRow), moveOn(page, shortRow), moveOn(page, dialog), moveOn(page, longRow), moveOn(page, field)].join(" "),
            "canceled canceled canceled left left"
        );
        check(
            "  and a pinch, or a move the browser no longer lets be canceled, is left alone",
            [moveOn(page, titleRow, { touches: 2 }), moveOn(page, titleRow, { cancelable: false })].join(" "),
            "left left"
        );

        hold.pan(36);
        check("  the page is put back where the keyboard moved the view from", page.body.style.transform, "translateY(36px)");
        hold.pan(0);
        check("  and with no pan it takes its own transform again", page.body.style.transform, "the page's own");

        const second = holdPage(page.win, page.doc);
        hold.release();
        check("  a sheet over a sheet holds it once: the first letting go leaves it held", [bodyPlace(page), page.scrolls.length].join(" | "), "fixed -240px 0px 0px | 0");
        second.release();
        second.release();
        check(
            "  and the last puts the body, the root and the scroll back, once",
            [bodyPlace(page) || "(none)", page.body.style.transform, page.root.style.overflowY || "(none)", page.scrolls.join(" "), page.count("touchmove")].join(" | "),
            "(none) | the page's own | (none) | 0,240 | 0"
        );
        page.win.scrollY = 57;
        check("  and the page's scroll is the document's again", pageScroll(page.win), 57);
    }
    {
        const desk = fakePage({ innerWidth: 1455, clientWidth: 1440 });
        const hold = holdPage(desk.win, desk.doc);
        check("  a scrollbar that took width keeps it, so the page keeps its width", desk.root.style.overflowY, "scroll");
        hold.release();
        check("  and the root's own overflow comes back as the page is let go", desk.root.style.overflowY, "");
    }
    check(
        "  the judgment, by value: one finger, cancelable, off a field, nothing scrolling",
        [
            cancelsTouch({ touches: 1, cancelable: true, onField: false, scrolls: false }),
            cancelsTouch({ touches: 2, cancelable: true, onField: false, scrolls: false }),
            cancelsTouch({ touches: 1, cancelable: false, onField: false, scrolls: false }),
            cancelsTouch({ touches: 1, cancelable: true, onField: true, scrolls: false }),
            cancelsTouch({ touches: 1, cancelable: true, onField: false, scrolls: true }),
        ].join(" "),
        "true false false false false"
    );

    // ── 2. the sheet's height and foot are read ──────────────────────────────
    log("");
    log("2. the sheet's height and foot are read once the page is held, and again only when they should be:");
    check(
        "  a resize is a width when the width moved or none was read, and a height alone otherwise",
        [resizeKind({ width: 373, lastWidth: 373 }), resizeKind({ width: 812, lastWidth: 373 }), resizeKind({ width: 373, lastWidth: null })].join(" "),
        "height width width"
    );
    const again = (over) => sheetRereads({ kind: "height", firstAfterHold: false, typing: false, typedSinceResize: false, ...over });
    check(
        "  it reads again on a width, the first after the hold, while typing and the first after typing; not on a height alone",
        [again({}), again({ kind: "width" }), again({ firstAfterHold: true }), again({ typing: true }), again({ typedSinceResize: true })].join(" "),
        "false true true true true"
    );
    {
        const page = fakePage({ scrollY: 120 });
        page.safeArea = 34;
        let sheet = true;
        const reads = [];
        const field = page.element({ tagName: "INPUT", type: "text" });
        const watch = watchSheet(page.win, page.doc, {
            isSheet: () => sheet,
            onSize: (size) => reads.push(size ? `${size.screen}/${size.safeArea}${page.body.style.position === "fixed" ? " held" : ""}` : "none"),
        });
        const resize = () => page.fire("view", "resize");
        check("  the first read comes once the page is held: the screen and the safe area as they are", reads.join(" | "), "810/34 held");

        page.dvh = 760;
        resize();
        check("  the first resize after the hold reads again, the bars having moved as it held", reads.at(-1), "760/34 held");
        page.dvh = 700;
        page.safeArea = 0;
        resize();
        resize();
        check("  and no other resize of the height alone does: the bars move, the sheet does not", [reads.length, reads.at(-1)].join(" "), "2 760/34 held");

        page.root.clientWidth = 812;
        resize();
        check("  a resize that changes the width reads from the start", [reads.length, reads.at(-1)].join(" "), "3 700/0 held");
        page.root.clientWidth = 373;
        resize();
        check("  and changing it back reads again", reads.length, 4);

        page.doc.activeElement = field;
        page.fire("doc", "focusin");
        check("  focus moving into a field reads, before any keyboard", reads.at(-1), "700/0 held");
        page.view.height = 474;
        resize();
        check("  the keyboard coming takes its height off the screen", reads.at(-1), "364/0 held");
        page.view.offsetTop = 120;
        page.fire("view", "scroll");
        const beforePan = reads.length;
        resize();
        check("  a pan of the view reads nothing, and the height a resize then reads ignores it", [beforePan === reads.length - 1, reads.at(-1)].join(" "), "true 364/0 held");
        check("  nothing listens to a scroll", page.count("scroll"), 0);

        page.doc.activeElement = page.body;
        page.fire("doc", "focusout");
        page.view.offsetTop = 0;
        check("  focus leaving the field reads the screen whole", reads.at(-1), "700/0 held");
        page.view.height = 810;
        resize();
        const afterKeyboard = reads.length;
        resize();
        check("  the first resize after typing stopped reads, and the next does not", [reads.at(-1), reads.length === afterKeyboard].join(" "), "700/0 held true");

        sheet = false;
        page.root.clientWidth = 900;
        resize();
        check("  turned wider than the edge it is no sheet: nothing read, the page let go", [reads.at(-1), bodyPlace(page) || "(none)", page.scrolls.join(" ")].join(" | "), "none | (none) | 0,120");
        sheet = true;
        page.root.clientWidth = 373;
        const beforeAgain = reads.length;
        resize();
        resize();
        resize();
        check("  and a sheet again, it holds, reads, and reads once more on the first resize after", [bodyPlace(page), reads.length - beforeAgain].join(" | "), "fixed -120px 0px 0px | 2");

        watch.pan(48);
        check("  the watch hands its pan to the hold", page.body.style.transform, "translateY(48px)");
        watch.stop();
        check(
            "  and stopping lets the page go and takes every listener away",
            [bodyPlace(page) || "(none)", page.listeners.length].join(" | "),
            "(none) | 0"
        );
    }
    {
        const desk = fakePage({ innerWidth: 1440, clientWidth: 1440 });
        const reads = [];
        const watch = watchSheet(desk.win, desk.doc, { isSheet: () => false, onSize: (size) => reads.push(size === null ? "none" : "read") });
        check("  a dialog laid out at a desk's width holds nothing and reads nothing", [bodyPlace(desk) || "(none)", reads.join(" ")].join(" | "), "(none) | none");
        watch.stop();
    }

    // ── 3. the keyboard's judgments ──────────────────────────────────────────
    log("");
    log("3. the keyboard's height, its pan and whose keyboard it is:");
    const reading = { layoutHeight: 810, viewportHeight: 474, viewportTop: 40, scale: 1, typing: true };
    check("  a keyboard 336 tall is 336 however far the view has panned", [keyboardHeight(reading), keyboardHeight({ ...reading, viewportTop: 200 })].join(" "), "336 336");
    check("  the pan is how far the view stands below the page's top", keyboardPan(reading), 40);
    check("  the cover is the height less the pan", keyboardCover(reading), 296);
    check(
        "  none of them with nothing taking typing, or on a zoomed page, and no pan above the top",
        [keyboardHeight({ ...reading, typing: false }), keyboardPan({ ...reading, typing: false }), keyboardHeight({ ...reading, scale: 1.14 }), keyboardPan({ ...reading, scale: 1.14 }), keyboardPan({ ...reading, viewportTop: -12 })].join(" "),
        "0 0 0 0 0"
    );
    const inDialog = { tagName: "INPUT", type: "text", closest: (selector) => (selector === "dialog[open]" ? {} : null) };
    const onPage = { tagName: "INPUT", type: "text", closest: () => null };
    check(
        "  a field types for a sheet anywhere, and for the page's bar only outside an open dialog",
        [
            isTyping({ coarse: true, element: inDialog }),
            isTyping({ coarse: true, element: inDialog, onPage: true }),
            isTyping({ coarse: true, element: onPage, onPage: true }),
            isTyping({ coarse: false, element: onPage }),
        ].join(" "),
        "true false true false"
    );

    // ── 4. the frame and the bars take them ──────────────────────────────────
    log("");
    log("4. the frame holds a sheet's page first and reads into its classes; the bars ask the page's own:");
    const frame = readFileSync(repoPath(FRAME), "utf8");
    const at = (pattern) => frame.search(pattern);
    const watchAt = at(/watchSheet\(window, document, \{ isSheet: \(\) => laidOutAsSheet\(dialog\), onSize: setSheetSize \}\)/);
    const openAt = at(/dialog\.showModal\(\);/);
    const guardAt = at(/if \(!open \|\| !sheet \|\| !dialog\) return undefined;\s*const watch = watchSheet/);
    check("  the hold, for a dialog laid out as a sheet, is taken before the dialog opens and a field takes focus", [watchAt > 0, guardAt > 0 && guardAt < watchAt, watchAt < openAt].join(" "), "true true true");
    check(
        "  its pan follows the keyboard's, and the sheet's style hands on what was read",
        [/sheetWatchRef\.current\?\.pan\(pan\);/.test(frame), /"--sheet-screen": `\$\{sheetSize\.screen\}px`, "--sheet-safe-area": `\$\{sheetSize\.safeArea\}px`/.test(frame)].join(" "),
        "true true"
    );

    let sheetClasses = "";
    walk(parseFile(FRAME).ast, (n) => {
        if (n.type === "VariableDeclarator" && n.id?.name === "SHEET" && n.init) sheetClasses = frame.slice(n.init.start, n.init.end);
    });
    const tokens = sheetClasses.match(/max-sm:[^\s"]+/g) ?? [];
    const ds = await loadDesignSystem();
    const cssOf = (prefix) => tokens.filter((t) => t.startsWith(prefix)).map((t) => ds.candidatesToCss([t])[0] ?? "").join("");
    const heightCss = cssOf("max-sm:max-h-");
    const footCss = cssOf("max-sm:pb-");
    check(
        "  below the phone's edge the sheet's height is the screen it read less 28 above and below, and no cover",
        [/@media \(width < 40rem\)/.test(heightCss), /max-height: calc\(var\(--sheet-screen,100dvh\) - 2 \* var\(--spacing-dialog-gutter\)\);/.test(heightCss), heightCss.includes("keyboard-cover")].join(" "),
        "true true false"
    );
    check(
        "  its foot is 20 and the safe area it read",
        /padding-bottom: calc\(var\(--spacing-mobile-drawer-inset-bottom\) \+ var\(--sheet-safe-area,env\(safe-area-inset-bottom\)\)\);/.test(footCss),
        true
    );
    check("  and it stands on the keyboard's top, which stays live", /margin-bottom: var\(--keyboard-cover\);/.test(cssOf("max-sm:mb-")), true);

    const hold = readFileSync(repoPath(HOLD), "utf8");
    const bar = readFileSync(repoPath("app/components/BottomBar.js"), "utf8");
    const topBar = readFileSync(repoPath("app/components/TopBar.js"), "utf8");
    check(
        "  the foot bar asks for the page's keyboard, and the frame for any",
        [/useKeyboardCover\(\{ onPage: true \}\)/.test(bar), /const \{ cover, pan \} = useKeyboardCover\(\);/.test(frame)].join(" "),
        "true true"
    );
    check("  the top bar asks the page's scroll, which a held page keeps", [/setUnder\(pageScroll\(window\) > 0\)/.test(topBar), /window\.scrollY/.test(topBar)].join(" "), "true false");
    check("  and the hold reads no scroll of the view", /addEventListener\("scroll"/.test(hold), false);

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    assert("  the frame's opening and its sheet's classes were found", openAt > 0 && tokens.length > 8 && heightCss !== "" && footCss !== "");
    const heightToken = tokens.find((t) => t.startsWith("max-sm:max-h-[")) ?? "";
    const plantedCover = heightToken === "" ? "" : ds.candidatesToCss([heightToken.replace(/\)\]$/, "-var(--keyboard-cover))]")])[0] ?? "";
    check("  a cover planted back in that height is seen", /max-height: [^;]*keyboard-cover/.test(plantedCover), true);
    {
        const page = fakePage();
        const hold = holdPage(page.win, page.doc);
        const planted = page.element({ overflowY: "scroll", scrollHeight: 301, clientHeight: 300 });
        check("  a box one pixel over its height is no scroll, so a move on it is canceled", moveOn(page, planted), "canceled");
        hold.release();
        check("  and with no hold, no move is canceled at all", moveOn(page, planted), "left");
    }
    {
        const page = fakePage();
        page.dvh = 0;
        const reads = [];
        const watch = watchSheet(page.win, page.doc, { isSheet: () => true, onSize: (size) => reads.push(size.screen) });
        check("  a stylesheet with no dynamic unit reads the window's height", reads.join(), "810");
        watch.stop();
    }
}

if (isMain(import.meta.url)) standalone(title, run);
