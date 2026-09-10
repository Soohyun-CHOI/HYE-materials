// Every address on the tools axis (#348), and the canonical form of the id two of
// them carry.
//
// WHY ONE MODULE HOLDS ALL OF THEM. This issue moved three routes, and the only
// reason that was cheap is that nothing had printed one yet. From Phase 2 onward a
// moved address means reprinting every label already glued to a tool, so the thing
// worth building on the way past is the property that made this move cheap: every
// address the axis has is in one file, and the next move is one edit rather than a
// grep. Before this, `/tools/${id}` was written into four screens and a check.
//
// THE PRINTED PATH AND THE SCREEN PATH ARE TWO THINGS, WHICH IS THE WHOLE POINT OF
// `/t/`. A QR carries the whole address, host included, and the symbol steps up a
// version as that string grows — thinner modules on a sticker of the same size,
// read through oil and wear in a gloved hand. So the label gets a path chosen for
// its length and the screen gets one chosen for its shape, and `/t/` redirects to
// the screen rather than rendering it, because one page must have one address.
// docs/notes/tools.md carries the character counts and the version arithmetic.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` with the extension spelled
// out, which is lib/materialPriceView.js's precedent (#19): the offline tier runs
// under plain `node` with no loader. Nothing here reaches lib/airtable/, so the
// registration form — a `"use client"` file — can import it.

import { normalizeItemText } from "./itemNaming.js";

/** The tool list. */
export const TOOLS_PATH = "/tools";

/** The registration form. Static, and no `Tools` record id can equal `new`. */
export const REGISTER_PATH = "/tools/new";

/**
 * The route templates this axis serves, which is what `app/(tools)/` must hold.
 *
 * DECLARED SO A MOVE CANNOT BE HALF DONE. `offline/tool-routes.mjs` compares this
 * list against the routes derived from the page files under `app/(tools)/`, both
 * directions — a page added without a builder here, or a builder pointing at a
 * route the app does not serve, fails. That is the failure this issue would have
 * shipped without it: a `<Link>` to an address nothing answers renders fine and is
 * a 404 only when somebody clicks it.
 */
export const TOOLS_ROUTES = [
    TOOLS_PATH,
    REGISTER_PATH,
    "/tools/[toolRecordId]",
    "/tool-items/[toolItemId]",
    "/t/[toolItemId]",
];

/**
 * The uppercase alias of the printed path, and the rewrite that makes it resolve.
 *
 * THE LABEL PRINTS THE WHOLE URL IN UPPERCASE, and that is worth the alias. A QR
 * code's alphanumeric mode holds 45 characters — digits, A-Z and a few marks — and
 * packs them far tighter than byte mode; `HTTPS://HYEUSA.COM/T/HYE-TL-260909-004`
 * is entirely inside that set while the lowercase form is not. The scheme and the
 * host are case-insensitive per RFC 3986, so uppercasing them changes nothing; the
 * PATH is not, which is why this exists.
 *
 * A REWRITE RATHER THAN A SECOND ROUTE, and rather than a redirect. Two directories
 * differing only in case cannot coexist — measured on this machine, `mkdir T`
 * beside `t` was refused with `File exists` — and even where they could, two pages
 * for one entry point would be two briefs and two entry points for one act. A
 * REDIRECT would cost a second hop, which is the one thing `/t/` may not do. A
 * rewrite runs the same page under the other spelling and leaves the hop count at
 * one.
 *
 * The two halves are here rather than in `next.config.mjs` so a check can compare
 * that file against them; the config carries the literals and this is what says
 * what they must be.
 */
export const LABEL_REWRITE = {
    source: "/T/:toolItemId",
    destination: "/t/:toolItemId",
};

/**
 * The canonical spelling of a printed `Tool Item ID`.
 *
 * UPPERCASE IS A FACT ABOUT THE FAMILY RATHER THAN A GUESS. Every `Tool Item ID` is
 * `HYE-TL-YYMMDD-###`, minted by `lib/idSequence.js:formatSequentialId` from an
 * uppercase prefix and digits, so a minted id already equals its own uppercase —
 * `offline/tool-routes.mjs` asserts exactly that against the generator, so this
 * cannot drift away from what the base holds.
 *
 * WHY `/t/` NORMALIZES AT ALL, given that the tool item's own page already does. It
 * is what keeps the printed entry point at ONE redirect. A label is read by a
 * camera and, when the symbol is scratched, by a person typing; the typed spelling
 * can be any case, and handing the destination a non-canonical id would make it
 * redirect a second time. This and the destination's own lookup are two LAYERS
 * rather than two rules: this one is a cheap string transform, the destination
 * compares against the stored value and stays the authority on what exists.
 */
export function canonicalToolItemId(raw) {
    return normalizeItemText(raw).toUpperCase();
}

/**
 * Where one tool's screen is, and which page of its tool items.
 *
 * The first page carries no parameter — an address a reader copies should be the
 * plain one — and `offline/url-parameters.mjs` holds `page` in its inventory.
 * Moved here from `lib/toolListView.js` in #348, which is where the paging rule
 * still lives; this is only the address it lands on.
 */
export function toolPath(toolRecordId, page = 1) {
    const base = `${TOOLS_PATH}/${encodeURIComponent(toolRecordId)}`;
    return page > 1 ? `${base}?page=${page}` : base;
}

/** Where one tool item's screen is — the canonical address, and the only page. */
export function toolItemPath(toolItemId) {
    return `/tool-items/${encodeURIComponent(toolItemId)}`;
}

/**
 * What a label encodes. Nothing prints one yet; Phase 2 is what does.
 *
 * It takes the id rather than a whole URL because the host is not this module's:
 * the app is reached at a Vercel preview domain today and at `hyeusa.com` when it
 * is deployed, and the printed length is measured against the second — see
 * `docs/notes/tools.md`, which also records that a label may not be printed from a
 * preview host. `lib/toolLabelQR.js:labelURL` is what puts a host in front of this.
 */
export function labelPath(toolItemId) {
    return `/t/${encodeURIComponent(toolItemId)}`;
}

/**
 * The route template of the endpoint serving one tool item's QR symbol (#351).
 *
 * A ROUTE HANDLER, SO IT IS NOT IN `TOOLS_ROUTES`. That list is compared against the
 * PAGE files under `app/(tools)/` and this address answers no page — it lives under
 * `app/api/` with every other Route Handler. `offline/tool-routes.mjs` holds it to
 * its own `route.js` separately, in the same two directions.
 */
export const QR_ROUTE = "/api/tool-items/[toolItemId]/qr";

/**
 * Where one tool item's QR symbol is served from.
 *
 * HERE RATHER THAN IN `lib/toolLabelQR.js` FOR THIS MODULE'S OWN REASON: every
 * address the axis has is in one file, so a move is one edit rather than a grep.
 * Both screens Phase 2 adds would otherwise spell it, which is exactly the state
 * #348 found `/tools/${id}` in.
 */
export function toolItemQRPath(toolItemId) {
    return `/api/tool-items/${encodeURIComponent(toolItemId)}/qr`;
}
