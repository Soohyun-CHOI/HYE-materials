/**
 * What a screen with a foot bar asks of a phone's keyboard (Tools 0a Keyboard): a browser
 * that would cover the page with its keyboard shrinks it instead, so the bar a screen's
 * action stands in — and a sheet that bar opens — stays above the keyboard. A browser that
 * ignores the hint covers the page, and the bar and the sheet are lifted by how far it
 * covers (`keyboardCover` below, read through `useKeyboardCover.js`).
 *
 * ONE VALUE FOR EVERY SCREEN THAT DRAWS `BottomBar` (#495), exported as `viewport` by the
 * route file above it: the sign-in steps' layout (#473) and the asset page, whose foot
 * bar opens 1j's name sheet onto the keyboard. The bar's own header said both screens asked
 * for it while only the sign-in steps did. `offline/keyboard-viewport.mjs` fails a route
 * whose screen draws the bar with no route file above it exporting this.
 *
 * A PLAIN MODULE AND NOT THE BAR'S, because `BottomBar.js` is a client module, and what a
 * client module exports reaches a Server Component as a reference rather than as its value.
 * It imports nothing, so the offline tier calls the two judgments below as they are.
 */
export const KEYBOARD_VIEWPORT = { interactiveWidget: "resizes-content" };

// The input types a phone raises a keyboard for. A box, a choice or a button takes focus
// and raises none.
const TYPED_INPUTS = new Set(["text", "search", "email", "tel", "url", "number", "password"]);

/**
 * Whether focus on an element raises a phone's keyboard: a text field, a text area or
 * something editable — an element, or anything shaped like one (`tagName`, `type`,
 * `isContentEditable`).
 *
 * NOT EVERY INPUT (#568). The bar counted any `<input>` holding focus as typing, so a job's
 * box on the job step took the bar's room under it from 20 to 12 at the press, with no
 * keyboard anywhere.
 */
export function takesTyping(element) {
    if (!element) return false;
    if (element.isContentEditable) return true;
    const tag = String(element.tagName ?? "").toUpperCase();
    if (tag === "TEXTAREA") return true;
    return tag === "INPUT" && TYPED_INPUTS.has(String(element.type ?? "text").toLowerCase());
}

// How far a visual viewport's scale may sit from 1 and still be a page nobody has zoomed.
const UNZOOMED = 0.01;

/**
 * How far a phone's keyboard covers the page from below, in px: the layout viewport's
 * height less the visual viewport's, less how far the visual viewport stands below the
 * layout viewport's top. A browser that shrinks the page for its keyboard shrinks both, and
 * the answer is 0.
 *
 * ONLY WHILE SOMETHING TAKES TYPING AND THE PAGE IS NOT ZOOMED (#568). The same difference
 * opens with no keyboard at all: a pinch, or Safari zooming a field smaller than 16 as it
 * takes focus, shrinks the visual viewport by the zoom, and its top moves as the zoomed view
 * pans. Until #568 the bar was lifted by any of them and drew its keyboard room.
 */
export function keyboardCover({ layoutHeight, viewportHeight, viewportTop, scale, typing }) {
    if (!typing || Math.abs(scale - 1) > UNZOOMED) return 0;
    return Math.max(0, Math.round(layoutHeight - viewportHeight - viewportTop));
}
