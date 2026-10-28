import { takesTyping } from "./keyboardViewport.js";
import { cancelsTouch, scrollsUnder } from "./sheetHold.js";

/*
 * What closes a phone's sheet by its handle (#580): a tap on the handle, and a drag down.
 * `DialogFrame.js` asks it for a sheet that draws a handle — not a Confirm, which draws none
 * and is not dragged — while the sheet is open, and only a sheet laid out as one is touched.
 *
 * THE HANDLE'S TAP IS JUDGED FROM THE TOUCH, NOT FROM A CLICK. On a phone a tap on the handle
 * did nothing. Two things stood between it and the click it waited for: what could be pressed
 * was the handle's row, 16 tall — its 12 above the bar and the bar's 4 — under a finger aimed at
 * the bar; and since #579 the hold cancels every move of a finger on it, which Touch Events says
 * should keep any mouse event the move would cause, click included, from following. Whether
 * Safari does is not established: WebKit's touch-move deferral holds back only pans and pinches,
 * and what its canceled touches do to a tap was not found in the source read. So the frame's
 * press is the handle's row and the head's room under it, down to the title's line, and a touch
 * that stays a tap there closes the sheet as it ends, its end canceled: a canceled `touchend`
 * "must not be interpreted as a click" (Touch Events), so the click cannot land on the page the
 * sheet uncovered. The button's own click stays for a mouse and a screen reader's activation.
 *
 * A DRAG STARTS WHEREVER THE HOLD CANCELS A MOVE IN THE SHEET (`sheetHold.js:cancelsTouch`): one
 * finger, not on a field, whose caret is the browser's, and nothing under it that scrolls. So a
 * list that scrolls keeps every move on it, at its top as much as anywhere: a gesture the browser
 * has begun to scroll is the browser's, and when a move stops being cancelable is the browser's
 * to say (Touch Events: "Varies"). A list too short to scroll, the head, `Done` and the room
 * around them drag.
 *
 * TOUCH EVENTS, NOT POINTER EVENTS. A touch's events go to the element it started on, wherever
 * the finger moves (Touch Events), and a move the hold cancels still reaches this listener, since
 * canceling an event does not stop it. A pointer's events end in `pointercancel` once the browser
 * pans with it (Pointer Events), which a page decides with `touch-action` and not with a canceled
 * move — what the hold chose not to rest on — and canceling a pointer event does not keep a click
 * from following (Pointer Events).
 *
 * WHAT A DRAG ENDS IN. Released past a quarter of the sheet's height as the drag began, or moving
 * down at 0.4 px a millisecond over its last 100ms, the sheet closes, at once, as every other way
 * out closes it; short of both it comes back in 200ms, and at once under reduced motion. The two
 * figures are vaul's `CLOSE_THRESHOLD` and `VELOCITY_THRESHOLD`, a library's practice and no
 * standard's. Following the finger is the reader's own hand and stays under reduced motion. Its
 * end is canceled whether it closes or comes back, so a finger lifting over `Done` or a row
 * presses neither. A tap the sheet leaves alone keeps its end, and with it the click on `Done` or
 * a row; so does a touch on a busy sheet.
 *
 * NOTHING MOVES A BUSY SHEET (`DialogFrame.js`'s `busy`): no drag starts on it, and a tap on its
 * handle does nothing, as a press behind it does nothing — pulling a sheet out from under its own
 * write was the retirement's rule (#363).
 *
 * THE KEYBOARD STAYS. A drag moves no focus, so the sheet slides under a keyboard its field
 * raised, following the finger; back short of closing, it stands on the keyboard with the caret
 * where it was. Letting the keyboard go as the drag began would drop the sheet by the keyboard's
 * height under a finger that moved 10. A sheet that closes hands focus back as `Done` does.
 *
 * IT MOVES BY ITS MARGIN, NOT A TRANSFORM. A transform would make the dialog the containing block
 * of the white under its foot (`DialogFrame.js:SHEET_UNDER`, #579), which then stands inside the
 * dialog and is clipped by it. While a finger holds it, or as it comes back, the sheet's
 * `margin-bottom` is the keyboard's cover less how far it was dragged; at rest it is the frame's
 * class again, untouched.
 *
 * A PLAIN MODULE, reaching the page only through the `win` and `dialog` it is handed, so
 * `offline/sheet-drag.mjs` runs it against a document of its own.
 */

/** How far a finger may move and still be a tap, in px. */
export const SLOP = 10;

/** The share of the sheet's height a drag released past closes it (vaul's `CLOSE_THRESHOLD`). */
export const CLOSE_SHARE = 0.25;

/** How fast down, in px a millisecond, a drag released at closes it (vaul's `VELOCITY_THRESHOLD`). */
export const FLICK = 0.4;

/** How far back a release's speed is read, in ms. */
export const FLICK_WINDOW = 100;

/** How long a sheet released short of closing takes to come back, in ms. */
export const RETURN_MS = 200;

/**
 * Whether a touch starting here may drag the sheet: one that draws a handle, laid out as a sheet
 * and not busy, the touch not behind it, and where the hold cancels a move (the header).
 */
export function dragStarts({ handled, laidOut, busy, behind, touches, onField, scrolls }) {
    if (!handled || !laidOut || busy || behind) return false;
    return cancelsTouch({ touches, cancelable: true, onField, scrolls });
}

/**
 * What a touch is once it has moved `dx`, `dy` from where it began: `"tap"` while within `SLOP`,
 * then `"drag"` when it went down at least as far as sideways, and `"none"` — up or sideways —
 * otherwise.
 */
export function touchTurn({ dx, dy }) {
    if (Math.hypot(dx, dy) < SLOP) return "tap";
    return dy > 0 && dy >= Math.abs(dx) ? "drag" : "none";
}

/** How far below its place the sheet stands: the finger's travel since the drag began, never above its place. */
export function dragOffset({ y, fromY }) {
    return Math.max(0, y - fromY);
}

/**
 * The finger's speed down as it lifts, in px a millisecond: over its moves in the last
 * `FLICK_WINDOW`, `samples` being `{ t, y }` oldest first; 0 with one sample.
 */
export function releaseSpeed(samples) {
    const last = samples.at(-1);
    if (!last) return 0;
    const first = samples.find((sample) => sample.t >= last.t - FLICK_WINDOW);
    const elapsed = last.t - first.t;
    return elapsed > 0 ? (last.y - first.y) / elapsed : 0;
}

/** Whether a drag released here closes the sheet: past `CLOSE_SHARE` of its height, or flicked down; never while busy. */
export function releaseCloses({ offset, height, speed, busy }) {
    if (busy) return false;
    return offset >= height * CLOSE_SHARE || (offset > 0 && speed >= FLICK);
}

/** Whether a touch closes the sheet as a tap on its handle: on the handle, still a tap as it ends, and not busy. */
export function handleTapCloses({ onHandle, turn, busy }) {
    return onHandle && turn === "tap" && !busy;
}

/**
 * Whether a touch's end is canceled, so no click follows it (the header): a drag, whether the
 * sheet then closes or comes back, and a tap on the handle that closes it. Any other tap, and a
 * touch that did nothing because the sheet was busy, keep their click.
 */
export function cancelsEnd({ dragged, closesByTap }) {
    return dragged || closesByTap;
}

/** How long a sheet takes to come back, in ms: at once under reduced motion. */
export function returnMs({ reducedMotion }) {
    return reducedMotion ? 0 : RETURN_MS;
}

/** Whether a point lies behind a box — past one of its edges — which is a press on the backdrop. */
export function liesBehind({ x, y, box }) {
    return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

/** The finger a touch began with, in a list of touches, or none. */
function fingerOf(list, id) {
    for (let at = 0; at < list.length; at += 1) if (list[at].identifier === id) return list[at];
    return null;
}

/**
 * Lets a sheet close on a tap on `handle` and on a drag down (the header), until `stop()`.
 * `isSheet` and `isBusy` are asked as each touch starts and ends, and `onClose` is the frame's
 * own close. Returns `{ stop }`, which puts the sheet back at rest.
 */
export function watchDrag(win, dialog, { handle, isSheet, isBusy, onClose }) {
    const reducedMotion = win.matchMedia("(prefers-reduced-motion: reduce)");
    // The touch being followed: where it began, on what, what it is so far and its moves.
    let touch = null;
    let settling = null;

    // The sheet `offset` below its place, or at rest with no style of its own.
    const place = (offset) => {
        if (settling !== null) {
            win.clearTimeout(settling);
            settling = null;
        }
        dialog.style.transition = "";
        dialog.style.marginBottom = offset > 0 ? `calc(var(--keyboard-cover) - ${offset}px)` : "";
    };
    // From where the finger left it back to its place, then the frame's class again.
    const comeBack = () => {
        const ms = returnMs({ reducedMotion: reducedMotion.matches });
        if (ms === 0) {
            place(0);
            return;
        }
        if (settling !== null) win.clearTimeout(settling);
        dialog.style.transition = `margin-bottom ${ms}ms ease-out`;
        dialog.style.marginBottom = "calc(var(--keyboard-cover) - 0px)";
        settling = win.setTimeout(() => {
            settling = null;
            place(0);
        }, ms);
    };

    const onStart = (event) => {
        if (touch !== null) {
            // A second finger: a pinch is the browser's, and the sheet goes back. A drag it cut
            // short still ends canceled.
            if (touch.turn === "drag") comeBack();
            touch.turn = touch.turn === "drag" ? "cut" : "none";
            return;
        }
        const target = event.target;
        const finger = event.touches[0];
        const starts = dragStarts({
            handled: true,
            laidOut: isSheet(),
            busy: isBusy(),
            behind: target === dialog && liesBehind({ x: finger.clientX, y: finger.clientY, box: dialog.getBoundingClientRect() }),
            touches: event.touches.length,
            onField: takesTyping(target),
            scrolls: scrollsUnder(target, win),
        });
        if (!starts) return;
        place(0);
        touch = { id: finger.identifier, x: finger.clientX, y: finger.clientY, onHandle: handle.contains(target), turn: "tap", fromY: 0, height: 0, samples: [] };
    };
    const onMove = (event) => {
        if (touch === null) return;
        const finger = fingerOf(event.touches, touch.id);
        if (finger === null) return;
        if (touch.turn === "tap") {
            touch.turn = touchTurn({ dx: finger.clientX - touch.x, dy: finger.clientY - touch.y });
            if (touch.turn === "drag") {
                touch.fromY = finger.clientY;
                touch.height = dialog.getBoundingClientRect().height;
            }
        }
        if (touch.turn !== "drag") return;
        touch.samples.push({ t: event.timeStamp, y: finger.clientY });
        place(dragOffset({ y: finger.clientY, fromY: touch.fromY }));
    };
    const onEnd = (event) => {
        if (touch === null) return;
        const finger = fingerOf(event.changedTouches, touch.id);
        if (finger === null) return;
        const dragged = touch.turn === "drag" || touch.turn === "cut";
        const busy = isBusy();
        let closes = false;
        if (touch.turn === "drag") {
            touch.samples.push({ t: event.timeStamp, y: finger.clientY });
            const offset = dragOffset({ y: finger.clientY, fromY: touch.fromY });
            closes = releaseCloses({ offset, height: touch.height, speed: releaseSpeed(touch.samples), busy });
        }
        const closesByTap = !dragged && handleTapCloses({ onHandle: touch.onHandle, turn: touch.turn, busy });
        if (cancelsEnd({ dragged, closesByTap }) && event.cancelable) event.preventDefault();
        if (closes || closesByTap) {
            place(0);
            touch = null;
            onClose();
            return;
        }
        if (touch.turn === "drag") comeBack();
        touch = null;
    };
    const onCancel = () => {
        if (touch?.turn === "drag") comeBack();
        touch = null;
    };

    dialog.addEventListener("touchstart", onStart, { passive: true });
    dialog.addEventListener("touchmove", onMove, { passive: true });
    dialog.addEventListener("touchend", onEnd, { passive: false });
    dialog.addEventListener("touchcancel", onCancel, { passive: true });
    return {
        stop() {
            dialog.removeEventListener("touchstart", onStart, { passive: true });
            dialog.removeEventListener("touchmove", onMove, { passive: true });
            dialog.removeEventListener("touchend", onEnd, { passive: false });
            dialog.removeEventListener("touchcancel", onCancel, { passive: true });
            touch = null;
            place(0);
        },
    };
}
