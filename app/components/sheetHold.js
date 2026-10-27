import { isTyping, keyboardHeight, takesTyping } from "./keyboardViewport.js";

/*
 * What holds a phone's sheet still while it is open (#579): the page behind it, and the
 * sheet's own height and foot. `DialogFrame.js` asks it for a sheet laid out as one.
 *
 * THE PAGE BEHIND IS HELD THREE WAYS, because a modal dialog holds none of it. `showModal()`
 * makes the page inert to a press and to focus and leaves its scroll alone, and a sheet holds
 * a scroll only in its list or its body: a drag on the handle, the title, the field's row,
 * the actions or what lies behind went on to the page, and in Safari so did a drag on a list
 * too short to scroll. So, while a sheet is open:
 *
 * - `<body>` IS FIXED WHERE THE PAGE WAS, `top` at minus its scroll, and the scroll is put
 *   back as the last sheet closes. A fixed box's part past the viewport cannot be scrolled
 *   to, so the document has nothing to scroll whatever a browser does with `overflow`, which
 *   Safari does not honor on the body while its keyboard is up. A desk's scrollbar that took
 *   width keeps it, with the root's `overflow-y: scroll`, so the page keeps its width.
 * - A MOVE OF ONE FINGER THAT NOTHING IN THE SHEET CAN SCROLL IS CANCELED (`cancelsTouch`):
 *   one that starts outside a box that overflows, and not on a field, whose own caret and
 *   selection are the browser's. That is Safari's pull-to-refresh, which no
 *   `overscroll-behavior` stops, and its pan of the view while the keyboard is up. A pinch
 *   is left alone. The root's overscroll is not touched: `BottomBar.js` alone sets it (#568).
 * - THE PAGE IS PUT BACK WHERE THE KEYBOARD MOVED IT FROM (`pan`): Safari pans the view to
 *   show a field the keyboard would cover, which moves everything placed on the layout
 *   viewport up the screen, so the held page is moved down by the same amount
 *   (`keyboardViewport.js:keyboardPan`), as the sheet's foot already is by the cover. While
 *   it is moved the body is a containing block for anything fixed inside it, of which the
 *   asset page draws none with a sheet open.
 *
 * A FIELD IN A HELD SHEET TAKES FOCUS WITHOUT SAFARI'S OWN SCROLL TO SHOW IT (`focusTurn`).
 * A tap that focuses a field makes Safari move the view to show it, which a focus given with
 * `preventScroll` does not; the pan is told only once the view has moved, so the sheet rose
 * off the keyboard and came back down. Seen on a phone when the keyboard's Done had let focus
 * go and the field was tapped again; the sheet's opening, which focuses the field itself, did
 * not show it. So while a sheet holds the page: focus leaving anything for a field in an open
 * dialog gives the field focus here first, with `preventScroll`, so the tap's own focus finds
 * it focused; and a field in an open dialog letting focus go to nothing — Done — puts focus on
 * that dialog's title, so the next tap on the field leaves the title, where it is caught. It is
 * React Aria's way with Safari (`usePreventScroll`); no WebKit page read says what a tap's
 * focus scrolls, and that a focus with `preventScroll` scrolls nothing there is an inference
 * from it.
 *
 * THE SHEET'S HEIGHT AND FOOT ARE READ, NOT FOLLOWED (`watchSheet`). The screen's height
 * (`100dvh`) and the safe area at its foot (`env(safe-area-inset-bottom)`) both change with
 * the browser's bars, and the keyboard's cover changed with every scroll of the view; read
 * live, they stretched a sheet and widened its foot as the page under it scrolled. So they are
 * read once the page is held, and again only when one of these resizes comes (`sheetRereads`):
 * the first after the hold, since holding the page can itself change the bars; one that
 * changes the width, which starts over as the sheet opened; and the keyboard coming or going —
 * one while something takes typing, or the first after typing stopped. A resize that changes
 * the height alone is otherwise the browser's bars, which a sheet does not follow. Where the
 * sheet stands — on the keyboard's top — stays live, since that is what keeps it still on the
 * screen when the view pans.
 *
 * WHAT A PHONE SHOWS IS NOT SEEN HERE. That Safari's view pans, that a canceled move stops its
 * pull-to-refresh, that the bars do not move a held page: `docs/notes/design-system.md` has
 * the sources and what was measured in a desk browser, and a phone is where each is seen.
 *
 * A PLAIN MODULE, reaching the document only through the `win` and `doc` it is handed, so
 * `offline/sheet-still.mjs` runs it against a document of its own.
 */

/** The sheets holding the page now, and what the page was as the first took it. */
let holds = 0;
let held = null;

/**
 * Whether a move of the finger is canceled while the page is held: one finger, a move the
 * browser still lets be canceled, not on a field, and nothing under it that scrolls.
 */
export function cancelsTouch({ touches, cancelable, onField, scrolls }) {
    return cancelable && touches === 1 && !onField && !scrolls;
}

/**
 * What a held page does as focus leaves something (the header): `"field"` when focus is going
 * to a field in an open dialog, which is focused here first without a scroll; `"title"` when a
 * field in an open dialog lets focus go to nothing within the page, so focus waits on the
 * dialog's title; and null otherwise.
 */
export function focusTurn({ toField, fromField, toNothing }) {
    if (toField) return "field";
    if (fromField && toNothing) return "title";
    return null;
}

/** Whether an element is a field in an open dialog. */
const fieldInDialog = (element) => takesTyping(element) && Boolean(element.closest?.("dialog[open]"));

/** The title an open dialog is labeled by, made focusable as `DialogFrame.js` makes a heading. */
function titleOf(element, doc) {
    const dialog = element.closest("dialog[open]");
    const title = dialog ? doc.getElementById(dialog.getAttribute("aria-labelledby") ?? "") : null;
    if (title && !title.hasAttribute("tabindex")) title.tabIndex = -1;
    return title;
}

/** Whether something from an element up overflows a box that scrolls it — a list or a body that does. */
function scrollsUnder(element, win) {
    for (let at = element; at && at.nodeType === 1; at = at.parentElement) {
        const { overflowY } = win.getComputedStyle(at);
        if ((overflowY === "auto" || overflowY === "scroll") && at.scrollHeight - at.clientHeight > 1) return true;
    }
    return false;
}

/**
 * Holds the page where it is (the header): returns `{ pan, release }`. Sheets open over one
 * another hold it once, and it goes back as the last one releases.
 */
export function holdPage(win, doc) {
    holds += 1;
    if (holds === 1) {
        const { body, documentElement: root } = doc;
        const x = win.scrollX;
        const y = win.scrollY;
        const onTouchMove = (event) => {
            const target = event.target;
            const answer = cancelsTouch({ touches: event.touches.length, cancelable: event.cancelable, onField: takesTyping(target), scrolls: scrollsUnder(target, win) });
            if (answer) event.preventDefault();
        };
        const onBlur = (event) => {
            const leaving = event.target;
            const gaining = event.relatedTarget ?? null;
            // Nothing within the page: a window losing focus to another app keeps the field's.
            const toNothing = gaining === null && doc.hasFocus();
            const turn = focusTurn({ toField: gaining !== null && fieldInDialog(gaining), fromField: fieldInDialog(leaving), toNothing });
            if (turn === "field") gaining.focus({ preventScroll: true });
            else if (turn === "title") titleOf(leaving, doc)?.focus({ preventScroll: true });
        };
        held = {
            x,
            y,
            onTouchMove,
            onBlur,
            body: { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, transform: body.style.transform },
            rootOverflowY: root.style.overflowY,
        };
        const scrollbar = win.innerWidth - root.clientWidth;
        body.style.position = "fixed";
        body.style.top = `${-y}px`;
        body.style.left = `${-x}px`;
        body.style.right = `${x}px`;
        if (scrollbar > 0) root.style.overflowY = "scroll";
        doc.addEventListener("touchmove", onTouchMove, { passive: false });
        doc.addEventListener("blur", onBlur, true);
    }
    let released = false;
    return {
        pan(px) {
            if (released || !held) return;
            doc.body.style.transform = px > 0 ? `translateY(${px}px)` : held.body.transform;
        },
        release() {
            if (released) return;
            released = true;
            holds -= 1;
            if (holds > 0) return;
            const { body, documentElement: root } = doc;
            Object.assign(body.style, held.body);
            root.style.overflowY = held.rootOverflowY;
            doc.removeEventListener("touchmove", held.onTouchMove, { passive: false });
            doc.removeEventListener("blur", held.onBlur, true);
            const { x, y } = held;
            held = null;
            win.scrollTo(x, y);
        },
    };
}

/**
 * The page's scroll, as its own screens count it: where it was as a sheet took it while one
 * holds it, since a held page's document scrolls nowhere. The top bar asks it, whose ground
 * shows while the page has scrolled.
 */
export function pageScroll(win) {
    return held ? held.y : win.scrollY;
}

/**
 * Whether a resize changed the width or the height alone: a width no read has seen yet is a
 * width. Measured on the root's width, which neither a keyboard nor a pinch changes.
 */
export function resizeKind({ width, lastWidth }) {
    return width !== lastWidth ? "width" : "height";
}

/**
 * Whether a resize makes a held sheet read its height and foot again (the header): one that
 * changes the width; the first after the page was held; one while something takes typing; or
 * the first after typing stopped, which is the keyboard leaving. Any other is the browser's
 * bars.
 */
export function sheetRereads({ kind, firstAfterHold, typing, typedSinceResize }) {
    return kind === "width" || firstAfterHold || typing || typedSinceResize;
}

/** The screen's height and the safe area at its foot, in px, as the stylesheet resolves them now. */
function readScreen(win, doc) {
    const probe = doc.createElement("span");
    probe.style.cssText = "display:none;padding-top:100dvh;padding-bottom:env(safe-area-inset-bottom)";
    doc.documentElement.append(probe);
    const style = win.getComputedStyle(probe);
    const dynamic = parseFloat(style.paddingTop);
    const safeArea = parseFloat(style.paddingBottom);
    probe.remove();
    return { dynamic: dynamic > 0 ? dynamic : win.innerHeight, safeArea: Number.isFinite(safeArea) ? safeArea : 0 };
}

/**
 * Holds the page while `isSheet()` and reads the sheet's size into `onSize` — `{ screen,
 * safeArea }` in px, or null when it is not laid out as a sheet — once the page is held and
 * again on the resizes `sheetRereads` names and on a move of focus into or out of a field.
 * Returns `{ pan, stop }`: `pan` puts the held page back where the keyboard moved it from.
 */
export function watchSheet(win, doc, { isSheet, onSize }) {
    const view = win.visualViewport ?? null;
    const coarse = win.matchMedia("(pointer: coarse)");
    let hold = null;
    let pan = 0;
    let width = null;
    let firstAfterHold = false;
    let typing = false;
    let typedSinceResize = false;

    const typingNow = () => isTyping({ coarse: coarse.matches, element: doc.activeElement });
    const read = () => {
        width = doc.documentElement.clientWidth;
        const { dynamic, safeArea } = readScreen(win, doc);
        const keyboard = keyboardHeight({ layoutHeight: win.innerHeight, viewportHeight: view?.height ?? win.innerHeight, scale: view?.scale ?? 1, typing });
        onSize({ screen: Math.max(0, dynamic - keyboard), safeArea });
    };
    // From the start, as the sheet opened: held while it is a sheet, then read.
    const start = () => {
        if (!isSheet()) {
            hold?.release();
            hold = null;
            width = doc.documentElement.clientWidth;
            onSize(null);
            return;
        }
        if (!hold) {
            hold = holdPage(win, doc);
            hold.pan(pan);
            firstAfterHold = true;
        }
        read();
    };
    const onResize = () => {
        const now = typingNow();
        const kind = resizeKind({ width: doc.documentElement.clientWidth, lastWidth: width });
        const again = sheetRereads({ kind, firstAfterHold, typing: now, typedSinceResize });
        firstAfterHold = false;
        typing = now;
        typedSinceResize = now;
        if (kind === "width") start();
        else if (again && hold) read();
    };
    const onFocus = () => {
        const now = typingNow();
        if (now === typing) return;
        typing = now;
        if (now) typedSinceResize = true;
        if (hold) read();
    };

    typing = typingNow();
    start();
    const resizes = view ?? win;
    resizes.addEventListener("resize", onResize);
    doc.addEventListener("focusin", onFocus);
    doc.addEventListener("focusout", onFocus);
    return {
        pan(px) {
            pan = px;
            hold?.pan(px);
        },
        stop() {
            resizes.removeEventListener("resize", onResize);
            doc.removeEventListener("focusin", onFocus);
            doc.removeEventListener("focusout", onFocus);
            hold?.release();
            hold = null;
        },
    };
}
