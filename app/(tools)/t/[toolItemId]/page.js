import { redirect } from "next/navigation";
import { canonicalToolItemId, toolItemPath } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * The address a label carries (#348). It renders nothing and redirects once.
 *
 * IT EXISTS FOR ITS LENGTH AND FOR NOTHING ELSE. A QR code encodes the whole URL,
 * host included, and the symbol steps up a version as that string grows — thinner
 * modules on a sticker of the same size, read through oil and wear in a gloved
 * hand. `https://hyeusa.com/t/HYE-TL-260909-004` is 38 characters against 47 for
 * the screen's own address, which is a whole version at every error-correction
 * level. `docs/notes/tools.md` carries the arithmetic.
 *
 * A REDIRECT AND NOT A REWRITE, WHICH IS THE DECISION THIS FILE IS. A rewrite would
 * serve the tool item's page here and cost no hop at all — and it would make this a
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
 * string alike, so it cannot tell a caller which ids resolve; the tool item's own
 * page calls `requireUser()` and sends a reader with no session to `/login`. One
 * gate, at the screen.
 *
 * IT NORMALIZES THE CASE SO THE NEXT HOP DOES NOT HAVE TO. The destination
 * redirects when the id it was handed is not the stored spelling, so passing a
 * typed `hye-tl-…` straight through would cost two hops. `canonicalToolItemId` is
 * a string transform with no read behind it, and its uppercase claim is asserted
 * against the id generator rather than assumed.
 *
 * NO METADATA. Nothing here paints, so a title would name a tab no reader sees.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. It makes
// no Airtable call today and the scope still opens: `withOpsLabel` logs in a
// `finally`, which is what a page that redirects needs, and a read added here
// later is counted without anyone remembering to.
export default async function LabelEntryPage(props) {
    return withOpsLabel("/t/[toolItemId]", () => renderLabelEntryPage(props));
}

async function renderLabelEntryPage({ params }) {
    const { toolItemId } = await params;
    redirect(toolItemPath(canonicalToolItemId(decodeURIComponent(toolItemId))));
}
