/**
 * What a screen with a foot bar asks of a phone's keyboard (Tools 0a Keyboard): a browser
 * that would cover the page with its keyboard shrinks it instead, so the bar a screen's
 * action stands in — and a sheet that bar opens — stays above the keyboard. A browser that
 * ignores the hint covers the page, and the bar measures how far it covers
 * (`BottomBar.js`).
 *
 * ONE VALUE FOR EVERY SCREEN THAT DRAWS `BottomBar` (#495), exported as `viewport` by the
 * route file above it: the sign-in steps' layout (#473) and the asset page, whose foot
 * bar opens 1j's name sheet onto the keyboard. The bar's own header said both screens asked
 * for it while only the sign-in steps did. `offline/keyboard-viewport.mjs` fails a route
 * whose screen draws the bar with no route file above it exporting this.
 *
 * A PLAIN MODULE AND NOT THE BAR'S, because `BottomBar.js` is a client module, and what a
 * client module exports reaches a Server Component as a reference rather than as its value.
 */
export const KEYBOARD_VIEWPORT = { interactiveWidget: "resizes-content" };
