import { requireAdmin } from "@/lib/authz";
import { getAllAssetCategories } from "@/lib/airtable/assetCategories";
import { getAllAssetCategoryGroups } from "@/lib/airtable/assetCategoryGroups";
import { withOpsLabel } from "@/lib/airtableOps";
import { ASSET_CATALOG_COPY as COPY, catalogRows } from "@/lib/assetCatalog";
import CatalogList from "./CatalogList";

export const metadata = { title: COPY.heading };

/**
 * The catalog the office keeps (1l, #527): every row of `Asset Categories`, narrowed by the
 * category list's band and a toggle for the discontinued rows.
 *
 * THE OFFICE'S, SO `Is Admin`, AND ASKED THROUGH `requireAdmin` (#527). The office keeps the
 * catalog as it keeps invoicing, and a site manager records what happens to an asset without
 * keeping what it is filed under, so the page is gated on the office's flag through the app's
 * one Admin gate — the same answer the opener on the category list draws by and the actions
 * behind this page are wrapped in — and no file on the assets axis reads the flag itself
 * (`offline/site-manager.mjs`). A reader who is not the office reads why in the page's place,
 * the shape the Invoices file's 1g draws for `/invoices/new`: the page names a role, which is
 * not a record whose existence a refusal could give away.
 *
 * THREE READS: the session, the whole catalog — one list request per hundred rows — and every
 * group, one more. A row's items are counted off its `Assets` link array, which the catalog's read
 * already holds, so no item is read; the groups give the `Category` chip the categories nothing is
 * filed under yet. Both go to the browser, whose band narrows them without a request.
 */
export default async function AssetCatalogPage() {
    return withOpsLabel("/asset-catalog", () => renderCatalogPage());
}

async function renderCatalogPage() {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return (
            <div className="flex h-full items-center justify-center px-page-gutter text-center font-ui text-body text-foreground-muted">
                <p>{COPY.noAccess}</p>
            </div>
        );
    }

    const [categories, groups] = await Promise.all([getAllAssetCategories(), getAllAssetCategoryGroups()]);
    return <CatalogList rows={catalogRows(categories)} groups={groups.map(({ level1, level2 }) => ({ level1, level2 }))} />;
}
