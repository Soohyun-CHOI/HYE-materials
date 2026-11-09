import { withOpsLabel } from "@/lib/airtableOps";
import { ASSET_LIST_COPY as COPY } from "@/lib/assetListView";
import { requireUser } from "@/lib/authz";
import PageNotFound from "../PageNotFound";

export const metadata = { title: COPY.pageNotFound };

/**
 * An address no route answers, drawn as 1h's `Page not found` (#617).
 *
 * UNTIL #617 NEXT ANSWERED IT, with its own `404 | This page could not be found.` and no rail,
 * where Tools 56 draws 1h in the app's frame for "an address that matches nothing". A route
 * answers before a catch-all does, so this takes only what nothing else takes, and it sits on
 * the assets axis because the view is the axis's: a `not-found.js` at the root would be reached
 * by every screen, which may not read the design's names until #258 (`design-system.md`, `Who
 * may read a name`).
 *
 * THE READER IS THE AXIS'S. Every signed-in user, as on the rest of the axis; one signed out is
 * sent to sign in and back here, as from any page (#373). The gate is the one read, which the
 * layout's rail takes rather than reading again (#478), and nothing else is read: the address
 * names nothing to look up. It answers 200, as the kind's page does for a record id no row
 * carries, since a page's status is not a page's to set.
 */
export default async function AddressNotFoundPage() {
    return withOpsLabel("/[...address]", async () => {
        await requireUser();
        return <PageNotFound />;
    });
}
