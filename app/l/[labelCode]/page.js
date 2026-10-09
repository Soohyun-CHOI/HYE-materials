import { redirect } from "next/navigation";
import { assetIdFromLabelCode, assetPath } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * The address a label carries (#348). It renders nothing and redirects once.
 *
 * IT EXISTS FOR ITS LENGTH AND FOR NOTHING ELSE. A QR code encodes the whole URL,
 * host included, and the symbol steps up a version as that string grows — thinner
 * modules on a sticker of the same size, read through oil and wear in a gloved
 * hand. `https://hyeusa.com/l/260909-004` is 31 characters against 44 for the
 * screen's own address. `docs/notes/tools.md` carries the arithmetic.
 *
 * THE SEGMENT IS THE PRINTED CODE AND NOT AN `Asset ID` (#411). `HYE-AST-` opens
 * every one of them and separates none, so the label drops it and this route puts
 * it back — `assetIdFromLabelCode` is the whole of that, and what leaves here is
 * the spelling the base holds.
 *
 * A REDIRECT AND NOT A REWRITE, WHICH IS THE DECISION THIS FILE IS. A rewrite would
 * serve the asset's page here and cost no hop at all — and it would make this a
 * second address for one page, which is the thing #340's canonical redirect exists
 * to prevent one level down. One page, one address; this is an entry point that
 * leaves.
 *
 * AND IT IS `redirect` RATHER THAN `permanentRedirect`, WHICH IS WHERE IT PARTS
 * FROM #340. That page's redirect maps a VARIANT of one address onto that address —
 * a property of the id, true forever, so a 308 a browser caches for good is
 * correct. This one maps a printed entry point onto a SCREEN, and the screen's
 * address is the app's to move: that separation is the whole reason this route
 * exists, and a permanent redirect would weld the two back together inside every
 * scanner's cache, where nothing we ship can reach them. A 307 costs a round trip
 * per scan and keeps the printed address authoritative.
 *
 * NO SESSION CHECK, AND THAT IS SAFE BECAUSE IT READS NOTHING. It redirects every
 * string alike, so it cannot tell a caller which ids resolve; the asset's own
 * page calls `requireUser()` and sends a reader with no session to `/login`. One
 * gate, at the screen.
 *
 * IT SITS OUTSIDE `app/(assets)/`, UNDER THE ROOT LAYOUT ALONE (#478), AT THE ADDRESS IT
 * ALWAYS HAD. The assets layout draws the rail and its account and loads the design's
 * three faces, and none of that is for a page that draws nothing: every scan would pay
 * for a frame nobody sees. A route group buys a layout and nothing else, so leaving the
 * group is what this route takes — a directory is not a segment, and `/l/[labelCode]`
 * is the path either way. `offline/asset-routes.mjs` holds both halves: the page answers
 * at exactly that address, and no layout but the root's stands above it.
 *
 * IT NORMALIZES THE CASE SO THE NEXT HOP DOES NOT HAVE TO. The destination
 * redirects when the id it was handed is not the stored spelling, so passing a
 * typed `260909-004` through unchanged would cost two hops.
 * `assetIdFromLabelCode` canonicalizes as it reattaches, and the uppercase claim
 * behind that is asserted against the id generator rather than assumed.
 *
 * NO METADATA. Nothing here paints, so a title would name a tab no reader sees.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. It makes
// no Airtable call today and the scope still opens: `withOpsLabel` logs in a
// `finally`, which is what a page that redirects needs, and a read added here
// later is counted without anyone remembering to.
export default async function LabelEntryPage(props) {
    return withOpsLabel("/l/[labelCode]", () => renderLabelEntryPage(props));
}

async function renderLabelEntryPage({ params }) {
    const { labelCode } = await params;
    redirect(assetPath(assetIdFromLabelCode(decodeURIComponent(labelCode))));
}
