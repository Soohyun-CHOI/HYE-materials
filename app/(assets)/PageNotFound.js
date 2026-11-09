import { ButtonLink } from "@/app/components/Controls";
import { ASSET_LIST_COPY as COPY } from "@/lib/assetListView";
import { ASSET_CATEGORIES_PATH } from "@/lib/assetRoutes";

/**
 * 1h's `Page not found`: the heading centered in the column and the way back under it, for an
 * address that names nothing (#617) and for a kind's address no row carries (#612).
 *
 * ONE VIEW FOR BOTH, SINCE 1h DRAWS ONE. The kind's page drew it inline from #519; #617 gave
 * every other address it, which until then met Next's own 404 — `404 | This page could not be
 * found.` with no rail — where Tools 56 draws 1h in the app's frame. An address carries nothing
 * a reader can read back, so there is no sentence naming it, and the heading names the page
 * rather than an item (#612). An item's own page keeps `Item not found`, which names the code.
 */
export default function PageNotFound() {
    return (
        <div className="flex min-h-full flex-col items-center justify-center px-page-gutter text-center font-ui text-foreground-default">
            <h1 className="text-heading font-semibold">{COPY.pageNotFound}</h1>
            <div className="mt-gap-lg">
                <ButtonLink variant="bordered" href={ASSET_CATEGORIES_PATH}>
                    {COPY.backToTools}
                </ButtonLink>
            </div>
        </div>
    );
}
