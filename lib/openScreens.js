// Whether the materials screens are open, and which addresses they are (#542).
//
// ONE SWITCH, AND IT HAS TWO READERS. The site uses Tools & Equipment alone; the materials
// screens — requests, orders, invoices, deliveries, material prices, and the address form a
// request sends its writer to — hold demo records and carry no design. While
// `MATERIALS_SCREENS_OPEN` is false the rail offers none of them (`lib/navigation.js`) and an
// address on one leads to the Tools & Equipment list (`next.config.mjs`). Setting it true opens
// both and changes nothing else: the checks compute what they expect from it, so no check is
// edited with it. `docs/notes/tools.md`'s `Tools & Equipment alone` has why the closure is a
// redirect in the config rather than in the proxy, a layout or each page, and why it holds in
// every environment rather than in production alone.
//
// A WAY THROUGH THE APP, NOT AN AUTHORIZATION. Nothing here asks who is reading: a closed
// address leads everybody to the same list, signed in or not. The Route Handlers under
// `/api` and the Server Actions those screens post are not closed — they are not addresses a
// reader opens, each keeps its own gate, and a redirect would answer a fetch with a page.
//
// PURE AND IMPORTING NOTHING, because `next.config.mjs` imports it under plain Node before
// anything is built, and `offline/open-screens.mjs` calls it the same way.

/** The switch. False until the site starts using the materials screens. */
export const MATERIALS_SCREENS_OPEN = false;

/**
 * The first segment of every address the materials screens live under. `addresses` is the
 * form a new request sends its writer to and returns them from (#385); nothing on the assets
 * axis reads an address. `/admin` is not here: those are the office's forms, and the rail's
 * `Office` section (#486) is where they are placed.
 */
const MATERIALS_SEGMENTS = Object.freeze(["prs", "pos", "invoices", "deliveries", "materials", "addresses"]);

/** The first segments closed now: the materials screens' while they are closed, none once open. */
export const CLOSED_SEGMENTS = MATERIALS_SCREENS_OPEN ? Object.freeze([]) : MATERIALS_SEGMENTS;

/** The first segment of an address or a route template: `/assets/[assetId]` → `assets`. */
export function firstSegment(path) {
    return String(path ?? "").split(/[/?#]/)[1] ?? "";
}

/** Whether an address is on a screen that is open. A segment is matched whole. */
export function isOpenAddress(path) {
    return !CLOSED_SEGMENTS.includes(firstSegment(path));
}
