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
// AND THE PRINTED CODE IS A THIRD THING, WHICH IS WHAT #411 ADDED. The segment that
// path carries is no longer a `Tool Item ID`: `HYE-TL-` is on every tool item and
// distinguishes none of them, so the label drops it and this module puts it back.
// `labelCodeFor` and `toolItemIdFromLabelCode` are the two halves, and they are NOT
// folded into `canonicalToolItemId` — see that function for why.
//
// PURE AND OFFLINE-SAFE. It imports `./itemNaming.js` and `./idSequence.js` with
// the extension spelled out, which is lib/materialPriceView.js's precedent (#19):
// the offline tier runs under plain `node` with no loader. Neither reaches
// lib/airtable/ and `idSequence.js` imports nothing at all, so a tool's list (#443)
// — a `"use client"` file — can still import this.
//
// THE REGISTRATION HAS NO ADDRESS SINCE #456. It was `/tools/new`, and a tool's page
// and the offer a registration that fell short makes opened it with a tool's name and a
// count in its query (#449, #451). It is a dialog over the page that opens it now, and
// each opener hands it what the address carried; nothing printed or linked ever held
// that address, so it went with no redirect, and `/tools/new` reaches the tool page's
// not-found like any id no tool carries.
//
// AND THE LABELS HAVE NONE SINCE #457. They were `/tool-items/labels`, which named the
// tool items it printed in its own `id`, and a tool's page and a tool item's opened it.
// They are a dialog over those two pages now: a tool's page opens it on what its list
// has selected — the same `id`, on that page's own address (`toolPath`) — and a tool
// item's on its one label. No label carries that address, since a label carries `/t/`,
// and nothing was deployed, so it went with no redirect too; `/tool-items/labels`
// reaches the tool item page's not-found, the segment taking `labels` for an id.

import { ID_KINDS } from "./idSequence.js";
import { normalizeItemText } from "./itemNaming.js";

/** The tool list. */
export const TOOLS_PATH = "/tools";

// `LABELS_PATH` WAS HERE (#353) AND WENT WITH ITS SCREEN (#457). It was
// `/tool-items/labels`, static beside `[toolItemId]` because a `Tool Item ID` can never
// equal `labels`; the labels are a dialog over the two pages that open them now.

/**
 * The route templates of the axis's screens, which is what `app/(tools)/` must hold.
 * The address a label prints is `LABEL_ROUTE`, outside that directory since #478.
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
    "/tools/[toolRecordId]",
    "/tool-items/[toolItemId]",
];

/**
 * The address a label prints, which draws nothing and leaves for a tool item's own.
 *
 * NOT ONE OF `TOOLS_ROUTES` SINCE #478, because that list is what `app/(tools)/` holds
 * and this page left it: the tools layout draws the rail and its account and loads the
 * design's faces, and a redirect has no use for any of that. The address did not move —
 * a route group is a directory and not a segment — and `offline/tool-routes.mjs` holds
 * the page to this template and to having no layout but the root's above it.
 *
 * NAMED FOR WHAT IT HOLDS AND NOT FOR A FIELD (#411). The segment was `[toolItemId]`
 * while it carried one; it carries the printed code now, and a segment named after a
 * field the base does not have is the failure docs/notes/naming.md opens by describing —
 * somebody reads it, searches the base, and finds nothing. `[toolRecordId]` cost one word
 * for the same reason.
 */
export const LABEL_ROUTE = "/t/[labelCode]";

/**
 * The uppercase alias of the printed path, and the rewrite that makes it resolve.
 *
 * THE LABEL PRINTS THE WHOLE URL IN UPPERCASE, and that is worth the alias. A QR
 * code's alphanumeric mode holds 45 characters — digits, A-Z and a few marks — and
 * packs them far tighter than byte mode; `HTTPS://HYEUSA.COM/T/260909-004` is
 * entirely inside that set while the lowercase form is not. The scheme and the host
 * are case-insensitive per RFC 3986, so uppercasing them changes nothing; the PATH
 * is not, which is why this exists.
 *
 * SHORTENING THE SEGMENT DID NOT MAKE THE ALIAS REDUNDANT (#411), which was worth
 * measuring rather than assuming: the 31-character lowercase form still segments
 * into `Byte + Alphanumeric` and still costs a version. The capitals are what buy
 * the mode, at any length.
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
    source: "/T/:labelCode",
    destination: "/t/:labelCode",
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
 *
 * IT DOES NOT PUT THE FAMILY TOKEN BACK, AND #411 KEPT THE TWO APART DELIBERATELY.
 * Two reasons, and the second is the one that would have shipped a defect. The
 * assertion this function carries is an IDENTITY — a minted id equals its own
 * canonical form — and a function that also prepends `HYE-TL-` cannot make it. And
 * its second caller is `readToolItemIds`, through which a tool's own list, a
 * registration's account and the labels' read read the ids they are handed (#443,
 * #449, #457) — `/tool-items/labels` read its address that way until #457: those are
 * whole `Tool Item ID`s, written by a registration's landing or a tool's page, so
 * folding the token in would prefix them twice.
 */
export function canonicalToolItemId(raw) {
    return normalizeItemText(raw).toUpperCase();
}

/**
 * Everything a `Tool Item ID` has in common with every other one.
 *
 * Read off the generator rather than spelled again, so the family's token and the
 * printed code cannot drift apart: `dailyIdPrefix` joins the token to the stamp
 * with this same separator, which is what makes the tail a clean slice.
 */
const TOOL_ITEM_TOKEN = `${ID_KINDS.TOOL_ITEM.token}-`;

/**
 * What a label PRINTS and what its QR's path carries — the id less its token (#411).
 *
 * ONE STRING FOR BOTH, BECAUSE THE FALLBACK IS A PERSON READING ONE AND TYPING THE
 * OTHER. The readable code under the symbol exists for a sticker that has been
 * scratched or painted over, and what that person does with it is type it into the
 * address. Printing one form and routing another would break that path at the only
 * point it is used.
 *
 * `HYE-TL-` IS SEVEN CHARACTERS THAT DISTINGUISH NOTHING. Every tool item carries
 * it, so it confirmed nothing when a person held a sticker against this app's
 * screen and it bought nothing in the symbol. Dropping it takes the encoded address
 * from 38 characters to 31 against a version-2 capacity of 38 — see
 * `lib/toolLabelQR.js:QR_VERSION` for what that headroom is now for.
 *
 * IT THROWS ON A STRING THAT IS NOT ONE, rather than passing it through. The input
 * is always a stored `Tool Item ID` — both callers read it off a record — so this is
 * a tripwire on an invariant rather than a reachable branch, and the alternative is
 * worse than a throw: a pass-through prints a sticker whose QR resolves to nothing,
 * which is the one failure a printed id family exists to prevent.
 */
export function labelCodeFor(toolItemId) {
    const canonical = canonicalToolItemId(toolItemId);
    if (!canonical.startsWith(TOOL_ITEM_TOKEN)) {
        throw new Error(
            `toolRoutes: a label code comes from a Tool Item ID, and ${canonical} does not open with ${TOOL_ITEM_TOKEN}`
        );
    }
    return canonical.slice(TOOL_ITEM_TOKEN.length);
}

/**
 * How the labels' dialog names an id it found on no tool item (#457): the code a label
 * would print for it when it is shaped like a `Tool Item ID`, and the string as named
 * when it is not.
 *
 * NOT `labelCodeFor`, WHICH THROWS ON THE SECOND. That throw is a tripwire for a stored
 * id, and these are not stored: they are whatever an address carried — a tool's page
 * reads its selection off its own address and does not ask the base about it (#443) —
 * so a hand-typed `foo` reaches here, and the dialog says it was not found rather than
 * taking the page down. 1i names them by their codes, `260909-098`, which is what a
 * shaped one becomes; the slice is the one `labelCodeFor` makes.
 */
export function namedCode(toolItemId) {
    const canonical = canonicalToolItemId(toolItemId);
    return canonical.startsWith(TOOL_ITEM_TOKEN) ? labelCodeFor(canonical) : canonical;
}

/**
 * The inverse, which is what `/t/` does on the way in (#411).
 *
 * IT CANONICALIZES AS IT REATTACHES, so the destination is handed a spelling the
 * base already holds and the tool item's own page has nothing to redirect. That is
 * #348's one-hop rule unchanged; what moved is that the transform now changes the
 * string's KIND as well as its case.
 *
 * A WHOLE `Tool Item ID` ARRIVING HERE IS NOT ACCEPTED, and the reason is that no
 * artifact carries one. Nothing in this app links to `/t/`, every symbol is built
 * at render time, and no label has been printed — so the old form exists nowhere a
 * scanner or a reader could have picked it up, and a branch admitting it would have
 * no caller at all. #340 refused a comparison on exactly that ground and #352
 * deleted an endpoint for it. Typing one reaches `Tool item not found`, which is
 * the sentence this axis gives any id it does not hold.
 */
export function toolItemIdFromLabelCode(raw) {
    return `${TOOL_ITEM_TOKEN}${canonicalToolItemId(raw)}`;
}

/**
 * Where one tool's screen is, which page of its tool items, which of them are selected
 * for a label run, and — on the address a registration lands on — its account (#449).
 *
 * The first page carries no parameter — an address a reader copies should be the
 * plain one — and `offline/url-parameters.mjs` holds `page` in its inventory.
 * Moved here from `lib/toolListView.js` in #348, which is where the paging rule
 * still lives; this is only the address it lands on.
 *
 * THE SELECTION RIDES HERE AS `id` (#443), which was the label screen's own parameter
 * until #457 took that screen into a dialog. It is the printed ids of the tool items
 * the list has selected, in the list's own order (`lib/toolListView.js` keeps it so),
 * and the print control opens the labels' dialog on them unchanged, so the dialog
 * needs no second way of naming a run. It is carried on every page of the list, which
 * is what lets a selection outlive a page turn and a copied link name a run; an empty
 * one carries nothing. `readToolItemIds` is the other half.
 *
 * THE FOURTH ARGUMENT IS A REGISTRATION'S ACCOUNT, AND ONLY A REGISTRATION PASSES IT
 * (#449). `unwritten` is how many it was asked for and did not write, and `unlogged`
 * names the tool items it wrote whose first log row it could not — the things its
 * landing does not otherwise show, the way `/invoices/[invoiceId]?paired=` says how a
 * pairing was reached. `asked` rides with `unwritten` and only with it (#455): the
 * fork's `3 of 5 tools created` needs how many were asked for, and a registration that
 * wrote everything has no fork to say it. They are written here rather than beside the
 * call because this is the scope that names the route, which is how
 * `offline/url-parameters.mjs` places a key. The list's own writes pass three
 * arguments, so a press of a box or a step to another page writes the selection
 * alone: the account lives on the address a registration lands on and is left behind
 * by the reader's first move, while what is already drawn stays until the next render.
 * None unwritten and none unlogged carry nothing, so a registration that wrote
 * everything lands on the plain selection. `lib/toolRegistration.js:readRegistrationAccount`
 * is the other half.
 *
 * `URLSearchParams` BUILDS THE QUERY rather than a template, because several keys, two
 * of them repeated, is what it is for — and `offline/url-parameters.mjs` reads its
 * `set` and `append` calls as the writes they are.
 */
export function toolPath(toolRecordId, page = 1, selected = [], { asked = 0, unwritten = 0, unlogged = [] } = {}) {
    const base = `${TOOLS_PATH}/${encodeURIComponent(toolRecordId)}`;
    const query = new URLSearchParams();
    if (page > 1) query.set("page", String(page));
    for (const toolItemId of selected) query.append("id", toolItemId);
    if (unwritten > 0) {
        query.set("asked", String(asked));
        query.set("unwritten", String(unwritten));
    }
    for (const toolItemId of unlogged) query.append("unlogged", toolItemId);
    const search = query.toString();
    return search ? `${base}?${search}` : base;
}

/**
 * Where page `page` of the tool list is (#463), 1-based: `/tools` itself for the first, so
 * the rail's link and the breadcrumb's are the first page and nothing else spells it.
 */
export function toolsPath(page = 1) {
    const query = new URLSearchParams();
    if (page > 1) query.set("page", String(page));
    const search = query.toString();
    return search ? `${TOOLS_PATH}?${search}` : TOOLS_PATH;
}

/**
 * The printed ids an address names, canonical, each once, in the address's order.
 *
 * ONE READING FOR THE ONE RUN TWO PLACES NAME (#443, #457). `id` on
 * `/tools/[toolRecordId]` is what the list has selected, and the labels' dialog reads
 * the tool items its run names — the same values for the same act, so both read them
 * through this, the dialog's read on the server as well as the list on the client.
 * `/tool-items/labels` was the first reader, of its own address, until #457. **A
 * registration's `unlogged` is read through it too (#449)**: it names printed ids as
 * well, and one reading means a landing cannot spell one tool item two ways.
 *
 * A REPEATED ID IS DROPPED, because in a run it would print one tool item twice — two
 * stickers for one drill, the failure the whole id family exists to prevent — and on
 * the list it would count one selection twice. The first occurrence keeps its place,
 * so the order is still the address's, which for a registration's landing is the order
 * the ids were minted in.
 *
 * IT DOES NOT ASK WHETHER A STRING NAMES A TOOL ITEM. That is a read, and the labels'
 * read makes it anyway and names every id it cannot find; a shape test here would be a
 * second and weaker answer to the question that read already answers.
 *
 * It takes what any reader has: a Server Component's `searchParams` value — a string,
 * an array, or nothing — or `URLSearchParams#getAll`'s array, or the array an action
 * is handed.
 */
export function readToolItemIds(raw) {
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    return [...new Set(values.map((value) => canonicalToolItemId(value)).filter(Boolean))];
}

/** Where one tool item's screen is — the canonical address, and the only page. */
export function toolItemPath(toolItemId) {
    return `/tool-items/${encodeURIComponent(toolItemId)}`;
}

/**
 * What a label encodes. The labels' dialog is what prints one (#457), as
 * `/tool-items/labels` was from #353.
 *
 * It takes the id rather than a whole URL because the host is not this module's:
 * the app is reached at a Vercel preview domain today and at `app.hyeusa.com` when it
 * is deployed, and the printed length is measured against the second — see
 * `docs/notes/tools.md`, which also records that a label may not be printed from a
 * preview host. `lib/toolLabelQR.js:labelURL` is what puts a host in front of this.
 *
 * IT STILL TAKES THE ID AND NOT THE CODE (#411), so the one conversion happens in
 * one place. Every caller holds a `Tool Item ID` — a record's own value — and none
 * holds a label code until this function makes one, which is what keeps the printed
 * form from being spelled anywhere else.
 */
export function labelPath(toolItemId) {
    return LABEL_ROUTE.replace("[labelCode]", encodeURIComponent(labelCodeFor(toolItemId)));
}

// `QR_ROUTE` AND `toolItemQRPath` WERE HERE AND WENT WITH THEIR ROUTE (#352).
// `/api/tool-items/[toolItemId]/qr` served one tool item's symbol as an image, and
// #351 built it expecting the tool item's own page to be the caller. That page
// renders the symbol inline instead: it has just read the record the endpoint would
// have read again, and the endpoint's second operation existed to refuse an id with
// no row — which the page has already refused. So the address had no caller and no
// foreseeable one, and this axis deletes those rather than keeping them (#340's
// `getToolItemByRecordId`). `docs/notes/tools.md` records what of #351 that
// invalidated and what it left standing.

// `toolItemLabelsPath` WAS HERE (#353) AND WENT WITH ITS SCREEN (#457). It built the
// label screen's address for a set of printed ids, which both of that screen's openers
// arrived through. The two pages open the labels' dialog instead: a tool's page on what
// its own address already carries as `id`, so a copied link is still a request to
// print those labels again rather than a confirmation (#321), and a tool item's page on
// its own label, which needs no address at all.
