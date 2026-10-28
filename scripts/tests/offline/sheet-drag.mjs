// A phone's sheet closes by its handle: a tap on it, and a drag down (#580).
//
// WHY THIS IS A CHECK. On a phone a tap on a sheet's handle did nothing and a drag did not
// move the sheet. A desk browser's phone mode sends no touch of a finger, and this tier never
// opens a page, so it holds the code the two turn on, which is the part a change could quietly
// undo:
//
//   1. THE JUDGMENTS, BY VALUE AT THEIR EDGES (`sheetDrag.js`): where a drag may start — where
//      the hold cancels a move, on a sheet that draws a handle, laid out as one and not busy —
//      a tap against a drag against a move that is neither, how far the sheet stands, the
//      speed a finger lifts at, when a release closes, when a tap on the handle does, which
//      ends are canceled, the return under reduced motion, and what lies behind a box.
//   2. THE TOUCHES, RUN AGAINST A SHEET OF ITS OWN (`watchDrag`): the sheet following a finger,
//      closing past a quarter of its height or on a flick and coming back short of both; a
//      drag's end canceled either way, so the finger lifting over `Done` or a row presses
//      neither, and a tap the sheet leaves alone — on `Done`, a row, a busy sheet's handle —
//      keeping its end; a tap on the handle closing it; nothing moving on a field, in a list
//      that scrolls, behind the sheet or on a busy one; a move the hold canceled still moving
//      it; a second finger and a `touchcancel` sending it back.
//   3. THE FRAME TAKES IT: the handle a button named as the close, out of Tab's order, turning
//      its press away while busy, asking the close the close asks, and no ancestor of it hidden
//      from assistive tech — only the bar it stands over; its press from the sheet's top down to
//      the title's line, laid over the row so no box moves; the drag taken on the one condition
//      that draws the handle; no sheet handing a press of its own to the handle; and the three
//      sheets that draw one, the Confirm drawing none.
//
// WHAT IT CANNOT SEE. A finger: whether a phone's browser sends the touches as the fake does,
// lets a canceled end take its click away, or keeps the click it would have sent for a canceled
// move. `docs/notes/design-system.md` has the sources; a phone is where each is seen.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import {
    CLOSE_SHARE,
    FLICK,
    FLICK_WINDOW,
    RETURN_MS,
    SLOP,
    cancelsEnd,
    dragOffset,
    dragStarts,
    handleTapCloses,
    liesBehind,
    releaseCloses,
    releaseSpeed,
    returnMs,
    touchTurn,
    watchDrag,
} from "../../../app/components/sheetDrag.js";
import { listJsFiles, parentMap, parseFile, parseSource, repoPath, toPosix, walk } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

export const title = "A phone's sheet closes by its handle: a tap on it, and a drag down (#580)";

const FRAME = "app/components/DialogFrame.js";
const DRAG = "app/components/sheetDrag.js";
const SHEETS = {
    job: "app/(assets)/assets/[assetId]/JobSheet.js",
    name: "app/(assets)/assets/[assetId]/NameSheet.js",
    note: "app/(assets)/assets/[assetId]/AssetNote.js",
    retirement: "app/(assets)/assets/[assetId]/RetirementConfirm.js",
};

// ─────────────────────────────────────────────────────────────────────────────
// A sheet of its own
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A sheet as much as the drag reads of one: a window answering reduced motion, a box's own
 * `overflowY` and timers it keeps; a dialog `height` tall at the foot of a 373 × 810 screen,
 * keeping its listeners and its style; and its parts — the handle, the head and its `Done`, a
 * list too short to scroll and one that scrolls, each with a row, and a field.
 */
function fakeSheet({ height = 300, reducedMotion = false } = {}) {
    const listeners = [];
    const timers = [];
    const win = {
        matchMedia: (query) => ({ matches: query === "(prefers-reduced-motion: reduce)" && reducedMotion }),
        getComputedStyle: (element) => ({ overflowY: element.overflowY ?? "visible" }),
        setTimeout(fn, ms) {
            timers.push({ fn, ms, live: true });
            return timers.length;
        },
        clearTimeout(id) {
            if (timers[id - 1]) timers[id - 1].live = false;
        },
    };
    const box = { left: 0, right: 373, top: 810 - height, bottom: 810, height };
    const dialog = {
        nodeType: 1,
        parentElement: null,
        overflowY: "hidden",
        scrollHeight: height,
        clientHeight: height,
        style: { transition: "", marginBottom: "" },
        addEventListener(type, fn, options) {
            listeners.push({ type, fn, options });
        },
        removeEventListener(type, fn) {
            const at = listeners.findIndex((l) => l.type === type && l.fn === fn);
            if (at >= 0) listeners.splice(at, 1);
        },
        getBoundingClientRect: () => box,
    };
    const part = (props = {}) => ({ nodeType: 1, parentElement: dialog, ...props });
    const handle = part({ tagName: "BUTTON" });
    handle.contains = (target) => target === handle;
    const head = part();
    const shortList = part({ overflowY: "auto", scrollHeight: 168, clientHeight: 168 });
    const longList = part({ overflowY: "auto", scrollHeight: 900, clientHeight: 300 });
    const sheet = {
        win,
        dialog,
        handle,
        head,
        done: part({ tagName: "BUTTON", parentElement: head }),
        shortRow: part({ tagName: "BUTTON", parentElement: shortList }),
        longRow: part({ tagName: "BUTTON", parentElement: longList }),
        field: part({ tagName: "INPUT", type: "text" }),
        listeners,
        timers,
        busy: false,
        laidOut: true,
        closes: 0,
    };
    sheet.live = () => timers.filter((t) => t.live).map((t) => t.ms).join() || "none";
    sheet.runTimers = () => {
        for (const timer of timers) {
            if (!timer.live) continue;
            timer.live = false;
            timer.fn();
        }
    };
    sheet.fire = (type, event) => {
        for (const listener of listeners.filter((l) => l.type === type)) listener.fn(event);
    };
    sheet.watch = () =>
        watchDrag(win, dialog, {
            handle,
            isSheet: () => sheet.laidOut,
            isBusy: () => sheet.busy,
            onClose: () => {
                sheet.closes += 1;
            },
        });
    return sheet;
}

/** Where the sheet stands, as its own style says: `rest` with none. */
const placeOf = (sheet) => sheet.dialog.style.marginBottom || "rest";

/** The sheet `px` below its place. */
const below = (px) => `calc(var(--keyboard-cover) - ${px}px)`;

/**
 * One finger on `target` along `path` — `[x, y, t]`, the first where it lands and the last
 * where it lifts — answering where the sheet stood after each move, whether the end was
 * canceled, how many times the sheet closed, and where it stood and how it moved after.
 * `movesCanceled` hands every move in already canceled, as the hold leaves it.
 */
function touchAlong(sheet, target, path, { movesCanceled = false } = {}) {
    const finger = ([x, y]) => ({ identifier: 7, clientX: x, clientY: y });
    const [first, ...rest] = path;
    const last = rest.at(-1) ?? first;
    sheet.fire("touchstart", { target, touches: [finger(first)], changedTouches: [finger(first)], timeStamp: first[2] });
    const places = [];
    for (const point of rest.slice(0, -1)) {
        sheet.fire("touchmove", {
            target,
            touches: [finger(point)],
            changedTouches: [finger(point)],
            timeStamp: point[2],
            cancelable: !movesCanceled,
            defaultPrevented: movesCanceled,
        });
        places.push(placeOf(sheet));
    }
    let canceled = false;
    sheet.fire("touchend", {
        target,
        touches: [],
        changedTouches: [finger(last)],
        timeStamp: last[2],
        cancelable: true,
        preventDefault: () => {
            canceled = true;
        },
    });
    return { places: places.join(" | "), canceled, closes: sheet.closes, after: placeOf(sheet), transition: sheet.dialog.style.transition || "none" };
}

/** A tap on `target` that wobbles 3 down, the way a finger does. */
const tapOn = (sheet, target, [x, y] = [186, 520]) => touchAlong(sheet, target, [[x, y, 0], [x, y + 3, 40], [x, y + 3, 90]]);

// ─────────────────────────────────────────────────────────────────────────────
// The frame's source
// ─────────────────────────────────────────────────────────────────────────────

/** A JSX element's attribute, as its source: `true` for a bare one, null for none. */
function attributeOf(element, name, source) {
    const found = element.openingElement.attributes.find((a) => a.type === "JSXAttribute" && a.name?.name === name);
    if (!found) return null;
    return found.value ? source.slice(found.value.start, found.value.end) : "true";
}

/** The JSX element named `tag` whose attribute `name` reads `value`, or null. */
function elementWith(ast, source, tag, name, value) {
    let hit = null;
    walk(ast, (n) => {
        if (hit || n.type !== "JSXElement" || n.openingElement.name?.name !== tag) return;
        if (attributeOf(n, name, source) === value) hit = n;
    });
    return hit;
}

/**
 * The handle's button and what stands round it: whether it was found, its attributes, and the
 * elements above it in the tree that carry `aria-hidden`, which would take it from assistive
 * tech whatever it says.
 */
function handleFacts({ ast, source }) {
    const button = elementWith(ast, source, "button", "ref", "{handleRef}");
    if (!button) return { found: false, hiddenAbove: "(no button)" };
    const parents = parentMap(ast);
    const hiddenAbove = [];
    for (let at = parents.get(button); at; at = parents.get(at)) {
        if (at.type === "JSXElement" && attributeOf(at, "aria-hidden", source) !== null) hiddenAbove.push(at.openingElement.name.name);
    }
    const row = parents.get(button);
    return {
        found: true,
        attributes: ["type", "tabIndex", "aria-label", "aria-disabled", "onClick", "aria-hidden"].map((name) => attributeOf(button, name, source) ?? "-").join(" "),
        className: attributeOf(button, "className", source) ?? "",
        hiddenAbove: hiddenAbove.join(",") || "none",
        row: row?.type === "JSXElement" ? attributeOf(row, "className", source) ?? "" : "",
        bar:
            row?.type === "JSXElement"
                ? row.children
                      .filter((c) => c.type === "JSXElement" && c.openingElement.name?.name === "span")
                      .map((c) => attributeOf(c, "aria-hidden", source))
                      .join()
                : "",
    };
}

/** The value a name in `app/designValues.css` is declared with, in px. */
function declaredPx(css, name) {
    const match = css.match(new RegExp(`${name.replace(/[-]/g, "\\-")}:\\s*([0-9.]+)rem`));
    return match ? Number(match[1]) * 16 : NaN;
}

// ─────────────────────────────────────────────────────────────────────────────
// The run
// ─────────────────────────────────────────────────────────────────────────────

export async function run({ check, assert, log }) {
    // ── 1. the judgments ────────────────────────────────────────────────────
    log("1. the judgments, by value at their edges:");
    check("  the figures: a tap's 10, a quarter of the height, 0.4 px/ms over 100ms, back in 200ms", [SLOP, CLOSE_SHARE, FLICK, FLICK_WINDOW, RETURN_MS].join(" "), "10 0.25 0.4 100 200");
    {
        const at = { handled: true, laidOut: true, busy: false, behind: false, touches: 1, onField: false, scrolls: false };
        check(
            "  a drag starts on a handle sheet laid out as one, not busy, not behind it, one finger, off a field, nothing scrolling",
            [
                dragStarts(at),
                dragStarts({ ...at, handled: false }),
                dragStarts({ ...at, laidOut: false }),
                dragStarts({ ...at, busy: true }),
                dragStarts({ ...at, behind: true }),
                dragStarts({ ...at, touches: 2 }),
                dragStarts({ ...at, onField: true }),
                dragStarts({ ...at, scrolls: true }),
            ].join(" "),
            "true false false false false false false false"
        );
    }
    check(
        "  a touch is a tap within 10, a drag down at least as far as sideways, else nothing",
        [
            touchTurn({ dx: 0, dy: 9.9 }),
            touchTurn({ dx: 0, dy: 10 }),
            touchTurn({ dx: 6, dy: 8 }),
            touchTurn({ dx: -10, dy: 10 }),
            touchTurn({ dx: 11, dy: 10 }),
            touchTurn({ dx: 0, dy: -10 }),
            touchTurn({ dx: -9, dy: -4 }),
        ].join(" "),
        "tap drag drag drag none none tap"
    );
    check("  the sheet stands as far below as the finger went, and never above its place", [dragOffset({ y: 300, fromY: 250 }), dragOffset({ y: 240, fromY: 250 })].join(" "), "50 0");
    check(
        "  a lift's speed is read over its last 100ms",
        [
            releaseSpeed([
                { t: 0, y: 0 },
                { t: 60, y: 10 },
                { t: 100, y: 40 },
            ]),
            releaseSpeed([
                { t: 0, y: 0 },
                { t: 150, y: 30 },
                { t: 200, y: 70 },
            ]),
            releaseSpeed([{ t: 5, y: 9 }]),
            releaseSpeed([]),
        ].join(" "),
        "0.4 0.8 0 0"
    );
    check(
        "  a release closes past a quarter of the height or at 0.4 down, having moved, and never while busy",
        [
            releaseCloses({ offset: 74, height: 300, speed: 0, busy: false }),
            releaseCloses({ offset: 75, height: 300, speed: 0, busy: false }),
            releaseCloses({ offset: 10, height: 300, speed: 0.39, busy: false }),
            releaseCloses({ offset: 10, height: 300, speed: 0.4, busy: false }),
            releaseCloses({ offset: 0, height: 300, speed: 2, busy: false }),
            releaseCloses({ offset: 200, height: 300, speed: 2, busy: true }),
        ].join(" "),
        "false true false true false false"
    );
    check(
        "  a tap on the handle closes, not busy; a drag, a move that was neither, a busy sheet and a tap elsewhere do not",
        [
            handleTapCloses({ onHandle: true, turn: "tap", busy: false }),
            handleTapCloses({ onHandle: true, turn: "drag", busy: false }),
            handleTapCloses({ onHandle: true, turn: "none", busy: false }),
            handleTapCloses({ onHandle: true, turn: "tap", busy: true }),
            handleTapCloses({ onHandle: false, turn: "tap", busy: false }),
        ].join(" "),
        "true false false false false"
    );
    check(
        "  an end is canceled after a drag and after a tap that closes, and kept otherwise",
        [cancelsEnd({ dragged: true, closesByTap: false }), cancelsEnd({ dragged: false, closesByTap: true }), cancelsEnd({ dragged: false, closesByTap: false })].join(" "),
        "true true false"
    );
    check("  the return takes 200ms, and none under reduced motion", [returnMs({ reducedMotion: false }), returnMs({ reducedMotion: true })].join(" "), "200 0");
    {
        const box = { left: 0, right: 373, top: 510, bottom: 810 };
        check(
            "  a point lies behind a box only past one of its edges",
            [
                [186, 509],
                [186, 510],
                [-1, 600],
                [0, 600],
                [373, 600],
                [374, 600],
                [186, 810],
                [186, 811],
            ]
                .map(([x, y]) => liesBehind({ x, y, box }))
                .join(" "),
            "true false true false false true false true"
        );
    }

    // ── 2. the touches ──────────────────────────────────────────────────────
    log("");
    log("2. the touches, against a sheet 300 tall of its own:");
    {
        const sheet = fakeSheet();
        const watch = sheet.watch();
        check(
            "  four listeners on the sheet, the end's alone not passive",
            sheet.listeners.map((l) => `${l.type}:${l.options?.passive}`).join(" "),
            "touchstart:true touchmove:true touchend:false touchcancel:true"
        );
        watch.stop();
        check("  and stopping takes all four away", sheet.listeners.length, 0);
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const drag = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 16],
            [186, 582, 300],
            [186, 642, 600],
            [186, 642, 900],
        ]);
        check("  a drag from the head follows the finger from where it turned a drag", drag.places, `rest | ${below(40)} | ${below(100)}`);
        check("  and lifted slowly 100 down, past 75, it closes, its end canceled, the sheet at rest", [drag.closes, drag.canceled, drag.after].join(" "), "1 true rest");
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const back = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 16],
            [186, 616, 600],
            [186, 616, 900],
        ]);
        check("  lifted slowly 74 down it comes back, closing nothing", [back.closes, back.after, back.transition].join(" | "), `0 | ${below(0)} | margin-bottom 200ms ease-out`);
        check("  its end canceled all the same, so the finger lifting presses nothing under it", back.canceled, true);
        check("  and once it is back the sheet has no style of its own", [sheet.live(), (sheet.runTimers(), placeOf(sheet)), sheet.dialog.style.transition || "none"].join(" "), "200 rest none");
        const exact = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 16],
            [186, 617, 600],
            [186, 617, 900],
        ]);
        check("  and 75 down closes it", exact.closes, 1);
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const flick = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 10],
            [186, 572, 60],
            [186, 572, 60],
        ]);
        check("  a flick 30 down in 50ms closes it", [flick.closes, flick.canceled].join(" "), "1 true");
        const slow = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 10],
            [186, 561, 60],
            [186, 561, 60],
        ]);
        check("  and 19 in 50ms, 0.38, comes back", [slow.closes, slow.after].join(" "), `1 ${below(0)}`);
    }
    {
        const sheet = fakeSheet({ reducedMotion: true });
        sheet.watch();
        const back = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 16],
            [186, 582, 600],
            [186, 582, 900],
        ]);
        check("  under reduced motion it follows the finger and is back at once", [back.places, back.after, back.transition, sheet.live()].join(" | "), `rest | ${below(40)} | rest | none | none`);
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const handle = tapOn(sheet, sheet.handle);
        check("  a tap on the handle closes it, its end canceled so no click reaches the page uncovered", [handle.closes, handle.canceled].join(" "), "1 true");
        const done = tapOn(sheet, sheet.done, [340, 540]);
        const row = tapOn(sheet, sheet.shortRow, [186, 640]);
        check("  a tap on Done or a row closes nothing and keeps its end, so its click goes on", [done.closes, done.canceled, row.closes, row.canceled].join(" "), "1 false 1 false");
        const late = touchAlong(sheet, sheet.handle, [
            [186, 520, 0],
            [186, 532, 40],
            [186, 532, 90],
        ]);
        check("  a touch on the handle that went 12 is a drag, not a tap", [late.closes, late.after].join(" "), `1 ${below(0)}`);
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        sheet.busy = true;
        const handle = tapOn(sheet, sheet.handle);
        check("  on a busy sheet a tap on the handle does nothing and keeps its end", [handle.closes, handle.canceled].join(" "), "0 false");
        const drag = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 542, 16],
            [186, 642, 300],
            [186, 642, 900],
        ]);
        check("  and a drag moves nothing, closes nothing and keeps its end", [drag.places, drag.closes, drag.canceled].join(" | "), "rest | rest | 0 | false");
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const path = [
            [186, 600, 0],
            [186, 612, 16],
            [186, 652, 300],
            [186, 652, 900],
        ];
        const moved = (target) => {
            sheet.runTimers();
            const answer = touchAlong(sheet, target, path);
            return answer.places.includes("calc") ? "moved" : "still";
        };
        const behind = touchAlong(sheet, sheet.dialog, [
            [186, 400, 0],
            [186, 412, 16],
            [186, 452, 300],
            [186, 452, 900],
        ]);
        check(
            "  a drag on a field or in a list that scrolls leaves the sheet; on a short list, or the sheet's own room, it moves",
            [moved(sheet.field), moved(sheet.longRow), moved(sheet.shortRow), moved(sheet.dialog)].join(" "),
            "still still moved moved"
        );
        check("  and one behind the sheet moves nothing", [behind.places.includes("calc") ? "moved" : "still", behind.canceled].join(" "), "still false");
        sheet.laidOut = false;
        check("  nor does one on a sheet laid out as a desk's dialog", moved(sheet.head), "still");
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const sideways = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [200, 532, 16],
            [200, 600, 300],
            [200, 600, 900],
        ]);
        const upward = touchAlong(sheet, sheet.head, [
            [186, 530, 0],
            [186, 518, 16],
            [186, 600, 300],
            [186, 600, 900],
        ]);
        check(
            "  a touch that went sideways or up first moves nothing after, and keeps its end",
            [sideways.places, sideways.canceled, upward.places, upward.canceled].join(" | "),
            "rest | rest | false | rest | rest | false"
        );
        const held = touchAlong(
            sheet,
            sheet.head,
            [
                [186, 530, 0],
                [186, 542, 16],
                [186, 582, 300],
                [186, 582, 900],
            ],
            { movesCanceled: true }
        );
        check("  a move the hold has canceled still moves the sheet", held.places, `rest | ${below(40)}`);
    }
    {
        const sheet = fakeSheet();
        sheet.watch();
        const finger = (id, y) => ({ identifier: id, clientX: 186, clientY: y });
        sheet.fire("touchstart", { target: sheet.head, touches: [finger(7, 530)], timeStamp: 0 });
        sheet.fire("touchmove", { target: sheet.head, touches: [finger(7, 542)], timeStamp: 16 });
        sheet.fire("touchmove", { target: sheet.head, touches: [finger(7, 582)], timeStamp: 300 });
        sheet.fire("touchstart", { target: sheet.head, touches: [finger(7, 582), finger(8, 300)], timeStamp: 320 });
        const backAt = placeOf(sheet);
        sheet.fire("touchmove", { target: sheet.head, touches: [finger(7, 700), finger(8, 300)], timeStamp: 400 });
        let canceled = false;
        sheet.fire("touchend", { target: sheet.head, touches: [finger(8, 300)], changedTouches: [finger(7, 700)], timeStamp: 500, cancelable: true, preventDefault: () => (canceled = true) });
        check("  a second finger sends a drag back, moves nothing more, and the drag's end is still canceled", [backAt, placeOf(sheet), sheet.closes, canceled].join(" | "), `${below(0)} | ${below(0)} | 0 | true`);

        sheet.runTimers();
        sheet.fire("touchstart", { target: sheet.head, touches: [finger(9, 530)], timeStamp: 1000 });
        sheet.fire("touchmove", { target: sheet.head, touches: [finger(9, 542)], timeStamp: 1016 });
        sheet.fire("touchmove", { target: sheet.head, touches: [finger(9, 602)], timeStamp: 1300 });
        sheet.fire("touchcancel", {});
        check("  a touch the browser takes away sends it back", [placeOf(sheet), sheet.closes].join(" | "), `${below(0)} | 0`);
    }
    {
        const sheet = fakeSheet();
        const watch = sheet.watch();
        sheet.fire("touchstart", { target: sheet.head, touches: [{ identifier: 1, clientX: 186, clientY: 530 }], timeStamp: 0 });
        sheet.fire("touchmove", { target: sheet.head, touches: [{ identifier: 1, clientX: 186, clientY: 542 }], timeStamp: 16 });
        sheet.fire("touchmove", { target: sheet.head, touches: [{ identifier: 1, clientX: 186, clientY: 592 }], timeStamp: 300 });
        const during = placeOf(sheet);
        watch.stop();
        check("  stopping mid-drag puts the sheet at rest", [during, placeOf(sheet), sheet.dialog.style.transition || "none"].join(" | "), `${below(50)} | rest | none`);
    }

    // ── 3. the frame ─────────────────────────────────────────────────────────
    log("");
    log("3. the frame takes it:");
    const frame = parseFile(FRAME);
    const handle = handleFacts(frame);
    check(
        "  the handle is a button, out of Tab's order, named as the close, turning its press away while busy, asking the close",
        handle.attributes,
        '"button" {-1} {COPY.close} {busy ? true : undefined} {ask} -'
    );
    check("  no element above it is hidden from assistive tech", handle.hiddenAbove, "none");
    check("  only the bar it stands over is", handle.bar, '"true"');
    check(
        "  its press lies over the row, from the sheet's top down to the title's line, and the row is what it was",
        [
            /^"absolute inset-x-0 top-0 h-\[calc\(var\(--spacing-mobile-drawer-inset-top\)\+var\(--height-mobile-drawer-handle\)\+var\(--spacing-mobile-drawer-title-inset-y\)\)\]"$/.test(handle.className),
            handle.row,
        ].join(" "),
        'true "relative hidden shrink-0 justify-center pt-mobile-drawer-inset-top max-sm:flex"'
    );
    {
        const css = readFileSync(repoPath("app/designValues.css"), "utf8");
        const reach = ["--spacing-mobile-drawer-inset-top", "--height-mobile-drawer-handle", "--spacing-mobile-drawer-title-inset-y"].map((name) => declaredPx(css, name));
        check("  which is 30, where the row is 16", [reach.reduce((a, b) => a + b, 0), reach[0] + reach[1]].join(" "), "30 16");
    }
    const frameSource = frame.source;
    check(
        "  the handle and the drag stand on one condition, a sheet that does not confirm",
        [
            /const handled = sheet && !confirm;/.test(frameSource),
            /\{handled && \(/.test(frameSource),
            /if \(!open \|\| !handled \|\| !dialog \|\| !handle\) return undefined;/.test(frameSource),
            /\}, \[open, handled\]\);/.test(frameSource),
        ].join(" "),
        "true true true true"
    );
    check(
        "  a touch asks the close the close asks, and whether the frame is busy",
        [
            /const ask = \(\) => \{\s*if \(!busy\) onClose\(\);\s*\};/.test(frameSource),
            /const busyNow = useEffectEvent\(\(\) => Boolean\(busy\)\);/.test(frameSource),
            /const askNow = useEffectEvent\(\(\) => ask\(\)\);/.test(frameSource),
            /watchDrag\(window, dialog, \{\s*handle,\s*isSheet: \(\) => laidOutAsSheet\(dialog\),\s*isBusy: \(\) => busyNow\(\),\s*onClose: \(\) => askNow\(\),\s*\}\)/.test(frameSource),
            /return \(\) => watch\.stop\(\);/.test(frameSource),
        ].join(" "),
        "true true true true true"
    );
    {
        const drag = readFileSync(repoPath(DRAG), "utf8");
        check(
            "  where a drag starts is the hold's own judgment, asked of the same box",
            [/return cancelsTouch\(\{ touches, cancelable: true, onField, scrolls \}\);/.test(drag), /scrolls: scrollsUnder\(target, win\),/.test(drag), /onField: takesTyping\(target\),/.test(drag)].join(" "),
            "true true true"
        );
        check(
            "  the sheet moves by its margin under the keyboard's cover, never a transform",
            [/dialog\.style\.marginBottom = offset > 0 \? `calc\(var\(--keyboard-cover\) - \$\{offset\}px\)` : "";/.test(drag), /\btransform\b/.test(drag.replace(/\/\*[\s\S]*?\*\//g, ""))].join(" "),
            "true false"
        );
    }
    const handPresses = [];
    let filesRead = 0;
    for (const file of listJsFiles(repoPath("app"))) {
        filesRead += 1;
        if (/\bonHandlePress\b/.test(readFileSync(file, "utf8"))) handPresses.push(toPosix(file));
    }
    check("  no sheet hands its handle a press of its own", handPresses.length, 0);
    {
        const kinds = Object.entries(SHEETS).map(([name, path]) => {
            const { ast, source } = parseFile(path);
            const frames = [];
            walk(ast, (n) => {
                if (n.type !== "JSXElement" || n.openingElement.name?.name !== "DialogFrame") return;
                if (attributeOf(n, "sheet", source) === null) return;
                frames.push(attributeOf(n, "recordId", source) === null ? "handle" : "none");
            });
            return `${name}:${frames.join()}`;
        });
        check("  the job, name and note sheets draw a handle, and the retirement's Confirm none", kinds.join(" "), "job:handle name:handle note:handle retirement:none");
    }

    // ── anti-vacuity ─────────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    assert("  the handle's button was found in the frame", handle.found);
    {
        const row = '<div className="relative hidden shrink-0 justify-center pt-mobile-drawer-inset-top max-sm:flex">';
        const planted = frameSource.replace(row, row.replace("<div ", '<div aria-hidden="true" '));
        check("  a row planted hidden above the button is seen", [planted !== frameSource, handleFacts(parseSource(planted, "planted")).hiddenAbove].join(" "), "true div");
    }
    check("  the walk for a handle's own press read the app's files", filesRead > 100, true);
    assert("  and a planted one is seen", /\bonHandlePress\b/.test("<DialogFrame sheet onHandlePress={onClose} />"));
    {
        const sheet = fakeSheet();
        sheet.watch();
        const fromBehind = touchAlong(sheet, sheet.dialog, [
            [186, 520, 0],
            [186, 532, 16],
            [186, 592, 300],
            [186, 592, 900],
        ]);
        check("  a touch inside the sheet's own box on the dialog itself is seen to move it", fromBehind.places, `rest | ${below(60)}`);
    }
}

if (isMain(import.meta.url)) standalone(title, run);
