// Whether the materials screens are open, and which addresses they are (#542, #631).
//
// OPEN ON EVERY BUILD BUT THE PRODUCTION DEPLOYMENT'S (#631). The site uses Tools & Equipment
// alone; the materials screens — requests, orders, invoices, deliveries, material prices, and the
// address form a request sends its writer to — are still being built. So the production
// deployment keeps them closed, and a local server and a preview open them: those reach the test
// base (`lib/airtableBase.js`) and send their mail to one address or none (`lib/mailRedirect.js`).
// Closed, the rail offers none of them (`lib/navigation.js`) and an address on one leads to the
// Tools & Equipment list (`next.config.mjs`). `docs/notes/tools.md`'s `Tools & Equipment alone`
// has why the closure is a redirect in the config rather than in the proxy, a layout or each
// page, and its `Open on every build but production's` why production alone is closed now.
//
// THE BUILD THROWS THE SWITCH, ONCE. `next.config.mjs` asks `materialsScreensAtBuild`, which asks
// `lib/deployment.js` — the one reading of which deployment this is — and takes from it the
// closed segments its redirects lead away from and the answer it hands the app's own code, which
// Next inlines into every bundle, the browser's as well as the server's. A redirect is fixed when
// the app is built, so the rail is fixed then too: a browser has no `VERCEL_ENV` to ask, and a
// rail that asked there would open on production. Nothing else asks the judgment.
//
// AN ANSWER THE APP CANNOT READ IS CLOSED. `MATERIALS_SCREENS_OPEN` is true where the build
// handed the app `true` and nowhere else — not under plain Node, the offline tier or
// `next.config.mjs` itself, which were handed nothing. Which deployment is production reads
// ambiguity the other way, as not production (`lib/deployment.js`), and that is not turned over
// here; `offline/open-screens.mjs` holds that a production build closes everything.
//
// A WAY THROUGH THE APP, NOT AN AUTHORIZATION. Nothing here asks who is reading: a closed
// address leads everybody to the same list, signed in or not. The Route Handlers under
// `/api` and the Server Actions those screens post are not closed — they are not addresses a
// reader opens, each keeps its own gate, and a redirect would answer a fetch with a page.
//
// IMPORTS ONE MODULE, WHICH IMPORTS NOTHING, with the extension spelled out, because
// `next.config.mjs` imports this under plain Node before anything is built, and
// `offline/open-screens.mjs` calls it the same way.

import { isProductionDeployment } from "./deployment.js";

/**
 * The first segment of every address the materials screens live under. `addresses` is the
 * form a new request sends its writer to and returns them from (#385); nothing on the assets
 * axis reads an address. `/admin` is not here: those are the office's forms, and the rail's
 * `Office` section (#486) is where they are placed.
 */
const MATERIALS_SEGMENTS = Object.freeze(["prs", "pos", "invoices", "deliveries", "materials", "addresses"]);
const NONE = Object.freeze([]);

/**
 * What a build with this environment sets (#631): `closedSegments`, the first segments its
 * redirects lead away from, and `env`, the answer it hands the app's own code — open on every
 * build but the production deployment's. `next.config.mjs` asks it, once, and nothing else does.
 */
export function materialsScreensAtBuild(env = process.env) {
    const open = !isProductionDeployment(env);
    return { closedSegments: open ? NONE : MATERIALS_SEGMENTS, env: { MATERIALS_SCREENS_OPEN: String(open) } };
}

/** The switch as the build set it: true where the build handed the app `true`, and nowhere else. */
export const MATERIALS_SCREENS_OPEN = process.env.MATERIALS_SCREENS_OPEN === "true";

/** The first segments this build closes: the materials screens' while they are closed, none once open. */
export const CLOSED_SEGMENTS = MATERIALS_SCREENS_OPEN ? NONE : MATERIALS_SEGMENTS;

/** The first segment of an address or a route template: `/assets/[assetId]` → `assets`. */
export function firstSegment(path) {
    return String(path ?? "").split(/[/?#]/)[1] ?? "";
}

/** Whether an address is on a screen that is open. A segment is matched whole. */
export function isOpenAddress(path) {
    return !CLOSED_SEGMENTS.includes(firstSegment(path));
}
