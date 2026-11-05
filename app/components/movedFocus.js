import { focusShows } from "../../lib/dialogFrame.js";

/*
 * Focus the app moves by itself, and the last thing the reader did that decides whether it is
 * drawn (#607) — `lib/dialogFrame.js:focusShows` is the judgment and has why.
 *
 * WHAT A PRESS OPENED IS WHAT THE PRESS LANDED ON, WHERE THE BROWSER GAVE IT NO FOCUS. A dialog
 * keeps what held focus as it opened, to hand focus back there as it closes (`DialogFrame.js`),
 * and Safari gives a tapped button no focus — so the check-out's name sheet, opened by a tap on
 * the foot bar's field, kept nothing, closed onto the document, and the column put focus on the
 * page's heading (`Rail.js`, #519). `pressedControl` is the control the last press began on, the
 * dialog's opener when nothing holds focus as it opens.
 *
 * A MARK, NOT A FOCUS OPTION. `focus({ focusVisible: false })` asks the same of a browser that
 * reads the option; which browsers do was not established, and one that does not would still draw
 * the ring, so a focus moved after a press carries `data-quiet-focus` until it leaves or a key is
 * pressed: `app/globals.css` takes the browser's ring off it, and a control drawing its own focus
 * face reads it too (`SheetField`, `SheetChip`). The two listeners are the page's own, set once as
 * this module loads in a browser.
 */

// What can be pressed and then hold focus, as a dialog's opener.
const PRESSABLE = 'button, a[href], input, select, textarea, [role="button"], [role="combobox"], [tabindex]:not([tabindex="-1"])';

let lastInput = null;
let pressed = null;

if (typeof document !== "undefined") {
    document.addEventListener(
        "pointerdown",
        (event) => {
            lastInput = "pointer";
            pressed = typeof event.target?.closest === "function" ? event.target.closest(PRESSABLE) : null;
        },
        true
    );
    document.addEventListener(
        "keydown",
        () => {
            lastInput = "key";
            for (const element of document.querySelectorAll("[data-quiet-focus]")) element.removeAttribute("data-quiet-focus");
        },
        true
    );
}

/** The control the last press began on, while it is still on the page. */
export function pressedControl() {
    return pressed?.isConnected ? pressed : null;
}

/**
 * Focus moved by the app, drawn as `focusShows` says: after a press it carries `data-quiet-focus`
 * until it leaves. `options` are `focus()`'s own, `preventScroll` among them.
 */
export function moveFocus(element, options) {
    if (!element) return;
    if (!focusShows(lastInput)) {
        element.setAttribute?.("data-quiet-focus", "");
        element.addEventListener?.("blur", () => element.removeAttribute("data-quiet-focus"), { once: true });
    }
    element.focus(options);
}
