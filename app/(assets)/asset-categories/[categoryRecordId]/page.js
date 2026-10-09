import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAssetsByCategory } from "@/lib/airtable/assets";
import { getAssetCategoriesByRecordIds } from "@/lib/airtable/assetCategories";
import { assignedJobsFor } from "@/lib/assetJob";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import { ASSET_LIST_COPY as COPY, idsInScope, pageOfAssets, assetListScope } from "@/lib/assetListView";
import { registrationCatalog } from "@/lib/assetCategory";
import { ASSET_REGISTRATION_COPY, canRegisterAssets, readRegistrationAccount } from "@/lib/assetRegistration";
import { ASSET_CATEGORIES_PATH, assetCategoriesPath } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";
import { isSiteManager } from "@/lib/siteManager";
import Breadcrumb from "@/app/components/Breadcrumb";
import { ButtonLink } from "@/app/components/Controls";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader } from "@/app/components/ListTable";
import RegistrationDialog from "../RegistrationDialog";
import CategoryCaption from "../../CategoryCaption";
import RegistrationShortfall from "./RegistrationShortfall";
import RegistrationUnlogged from "./RegistrationUnlogged";
import CategoryJobChoice from "./CategoryJobChoice";
import AssetList from "./AssetList";

// Static, the way `/materials/[materialId]` is and for the same reason: the
// segment is an Airtable record id, which names nothing a reader would recognize,
// so a tab carrying the category's name would have to resolve it — and that is a
// SECOND read of the same record, since generateMetadata runs separately from the
// page render and the Airtable SDK deduplicates nothing. The other asset screen
// with a dynamic segment carries the printed id in the URL already, so it names
// its record for no operations at all.
export const metadata = { title: "Tool" };

/**
 * One category and its assets, a page at a time (#339).
 *
 * IT IS KEYED ON THE AIRTABLE RECORD ID, which is `/materials/[materialId]`'s
 * answer to the same problem one axis over: `Asset Categories` mints no id, the way
 * `Vendors` and `Materials` mint none, because nothing prints a category and nobody
 * quotes one. The name a person typed is the identity and it is not a path — it
 * can hold any character, and a rename would move the address. The parameter is
 * `categoryRecordId` and not `categoryId` deliberately: there is no `Category ID` field, and
 * a name a reader would search the base for and not find is what
 * docs/notes/naming.md exists to prevent.
 *
 * IT STOOD AT `/tools/tool/[toolRecordId]` UNTIL #348, AND THE HALF THAT SURVIVES
 * THE MOVE IS THE HALF WORTH KNOWING. What forced the extra segment was that the
 * flat slot under `/tools` held the tool item, because a QR code encodes the whole
 * address and the symbol's version grows with it. `/l/[labelCode]` carries the
 * printed address now, so the slot came free and this page took it. **What did not
 * change is why this is a route at all rather than `/asset-categories?category=rec…`**: every
 * parameter this app carries narrows which rows appear, opens a form on a record
 * or accounts for something the arrival does not say, and none of them changes
 * what the page is a list of — a route rendering two different tables is a shape
 * the brief system, one file per page, cannot describe.
 *
 * FOUR OPERATIONS, WHATEVER THE CATEGORY'S SIZE. The session find, the category, the one
 * batched read of this page's assets, and the job list. The page is chosen
 * from the category's own `Assets` link array BEFORE anything is fetched, so a
 * category with three hundred units costs exactly what one with three costs, and
 * the total the screen states comes from that array's length for nothing.
 *
 * AND WHATEVER JOB IT IS NARROWED TO (#509). The array is first cut to the reader's
 * scope — `assetListScope`, the judgment `/asset-categories` reads its rows by — which
 * comes off the job list's own link arrays, so the page is still chosen before anything
 * is fetched. The office starts from every asset under the category and anybody else from
 * those on their jobs; a job in the head narrows to its own, and the head counts
 * `N of M`. A category with assets, none of them in the scope, draws its head and nothing
 * under it, as a job with none does on `/asset-categories`: `No items under this tool`
 * would be false there, and Design is drawing what it says. An asset off the scope still
 * opens from its label.
 *
 * AND WHATEVER IS SELECTED (#443). Which assets a label run is for rides in the
 * address as `id`, and this page never reads it: `AssetList.js` beside it reads
 * it off the address and rewrites it on every press without a render, and its header
 * says why the page cannot be the reader the way `/login`'s is (#373). So an id
 * selected on another page is never fetched here, and a press costs no operation.
 *
 * AND WHATEVER A REGISTRATION LANDS WITH (#449). A registration arrives here with what
 * it wrote selected, and its address carries two things more when they happened: how
 * many were asked for and not written — with how many were asked for beside it since
 * #455 — and which of those written have no first log row. This page DOES read those,
 * off the address and for nothing. A box or a step writes an address without them
 * rather than a different value of them (see `assetCategoryPath`), and the two controls that
 * remove them, the fork's `Not now` and the notice's `Got it`, each hide what they
 * remove — so the address never holds a different account from the one this render
 * drew, at most less of it, which is what makes a server read correct here and wrong
 * for the selection. The selection is the arrival's whole confirmation and nothing
 * here repeats it (#321); these are what it cannot show. The fork is
 * `RegistrationShortfall.js` and the notice `RegistrationUnlogged.js`, whose headers
 * say why each dismissal edits the address on the client. **Each is a dialog over this
 * page since #459**, told one at a time and the notice first — which is
 * `lib/assetRegistration.js:accountToTell`, asked of this render's reading and of the
 * address as it stands — so both are handed the whole account.
 *
 * AND IT IS WHERE A SITE MANAGER ADDS MORE UNDER THIS CATEGORY (#451). One control opens the
 * registration dialog on this kind and with no count — nothing here knows how many
 * were bought — and costs nothing: the kind is the row already read, and the reader
 * and the job list are what this page reads anyway. It is drawn for every kind this page
 * finds, the one with nothing under it included — disabled, with the reason before it,
 * for a site manager on no job, as `/asset-categories`' own control and the offer below are (#456).
 * The dialog starts at its second step on this kind (#507): the kind is submitted by its
 * record id, and the dialog is handed the kind as the catalog it may pick from — so the
 * levels it asks start on this kind's values (#514) — which is none at all for a row the
 * catalog no longer offers: its refusal is then the action's.
 *
 * WHAT THE KIND IS, IN THE CAPTION UNDER ITS NAME (#507): its class and where it sits in the
 * catalog, off the row already read (`CategoryCaption`).
 *
 * A READER WHO IS NOT A SITE MANAGER READS THIS PAGE WITHOUT WHAT A SITE MANAGER DOES ON
 * IT (#506): no opener, no box on a row or on the page and no selection bar — so no label
 * run is made here, and an `id` on the address is left unread — and neither part of a
 * registration's account, which is told to whoever added. An empty category keeps its heading
 * and drops the sentence under it, which speaks to the person who was adding. Every
 * question is `isSiteManager`, asked once here, the one the actions behind those controls
 * ask through `withSiteManagerAction`. An empty kind's heading stands alone for everybody
 * since #507, when the sentence that spoke to whoever was adding went with the failed
 * registration it described.
 *
 * NO COUNT PER STATUS HERE, DELIBERATELY. That is the question one level up, and
 * answering it on this page would mean reading every asset under the category —
 * which is the cost the paging exists to avoid. If it is ever wanted here it
 * comes from a rollup, under the same measured condition docs/notes/tools.md
 * already states for the list.
 *
 * DRAWN AS 1d (#463): the breadcrumb and the list's head with how many items the category has,
 * held still over the rows, the selection bar floating over the pinned pager while anything
 * is selected — `ListFrame.js` and `ListTable.js` for the parts, `AssetList.js` for the
 * rows, the boxes and the bar, which read the selection off the address. **Newest first,
 * as 1d draws it** (`pageOfAssets`), so a registration moves every page's edges, which
 * was accepted: the selection is printed ids and moves with nothing.
 *
 * NO WIDTH OF ITS OWN AND NO TEXT IN THE MARKUP — see the layout (#336), lib/assetListView.js
 * for the rules and lib/assetRoutes.js for the addresses.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so every page of every category aggregates into one
// row rather than one per record.
export default async function AssetCategoryPage(props) {
    return withOpsLabel("/asset-categories/[categoryRecordId]", () => renderCategoryPage(props));
}

// Every signed-in user, with no Role and no Job gate (#337) — the same reader the rest
// of this axis has; what the list shows first is their jobs' (#509).
async function renderCategoryPage({ params, searchParams }) {
    const user = await requireUser();
    const { categoryRecordId } = await params;
    const sp = (await searchParams) ?? {};

    // Batched by record id, so an id nothing carries comes back as no row rather
    // than as a throw. The id reaches a formula only through `orByRecordId`,
    // which escapes it. The job list beside it, since the scope comes off it (#509).
    const [[category], jobs] = await Promise.all([getAssetCategoriesByRecordIds([categoryRecordId]), getAllJobs()]);
    if (!category) {
        // 1h's shape, which the asset page draws for a code no asset carries: the
        // heading centered in the column and the way back under it. An address carries a
        // record id here, which says nothing to a reader, so there is no sentence naming it.
        return (
            <div className="flex min-h-full flex-col items-center justify-center px-page-gutter text-center font-ui text-foreground-default">
                <h1 className="text-heading font-semibold">{COPY.notFoundHeading}</h1>
                <div className="mt-gap-lg">
                    <ButtonLink variant="bordered" href={ASSET_CATEGORIES_PATH}>
                        {COPY.backToTools}
                    </ButtonLink>
                </div>
            </div>
        );
    }

    // The slice is decided here and the read follows it. `pageOfAssets` clamps
    // as well as slices, so a typed or copied `?page=` never lands on an empty
    // screen for a page that exists.
    //
    // `rowIds: page.ids` IS WHAT DIVIDES THE READ, AND TWO CLAIMS REST ON IT (#442):
    // the four operations above, and the page box below selecting one page (#443;
    // until then the second claim was the print control sending one page). Without
    // it `getAssetsByCategory` reads the category's whole link array, and this screen
    // reads every asset under the category and offers every one of them to the page
    // box with nothing on screen to show it — so `offline/asset-list-view.mjs` reads
    // the argument off the source, and the rows this hands the list, rather than
    // trusting a figure.
    //
    // THE ARRAY IS CUT TO THE READER'S SCOPE FIRST (#509), off ids already in hand, so the
    // read is still one page.
    const scope = assetListScope(user, jobs, sp.job);
    const narrowed = scope.job !== null;
    const job = scope.job?.id ?? null;
    const page = pageOfAssets(idsInScope(category.assets, scope.shown), sp.page);
    const total = idsInScope(category.assets, scope.start).length;
    const assets = await getAssetsByCategory(category.id, { rowIds: page.ids });

    const jobCodeById = Object.fromEntries(jobs.map((each) => [each.id, each.jobCode]));
    const account = readRegistrationAccount({ asked: sp.asked, unwritten: sp.unwritten, unlogged: sp.unlogged });
    // Whether this reader adds assets and prints their labels here at all (#506): every
    // control below that does either is drawn under it, and nothing else on the page is.
    const recorder = isSiteManager(user);
    // What both openers on this page hand the registration dialog (#456): whether this
    // site manager may register, which is the one predicate every opener asks, and the
    // jobs its choice offers.
    const canRegister = canRegisterAssets(user, jobs);
    const assignedJobs = assignedJobsFor(user, jobs).map(({ id, jobCode }) => ({ id, jobCode }));

    // The way back is the breadcrumb's one level since #460, the list's own heading behind a
    // chevron (1d). The category's name is the heading and there is no heading word, which is
    // the shape the asset's page takes. Registering more under this category (#451) is the
    // head's one control, so a category with nothing under it keeps it — there it is the way to
    // write what a registration did not. It opens the dialog on this category (#456). The way
    // back keeps the job the list is narrowed to (#509), and the head's choice stands
    // before the opener, as on `/asset-categories`.
    const top = <Breadcrumb levels={[{ label: COPY.heading, href: assetCategoriesPath(1, job) }]} />;
    // The dialog on this kind (#507): the row as the page read it, and the catalog it may pick
    // from, which is this row alone — none when the catalog no longer offers it — so each
    // level its second step asks has this row's value already chosen (#514).
    const opened = { id: category.id, itemName: category.itemName, assetClass: category.assetClass };
    const catalog = registrationCatalog([category]);
    const registration = { opener: ASSET_REGISTRATION_COPY.heading, canRegister, jobs: assignedJobs, category: opened, catalog };
    const header = (
        <ListHeader
            title={category.itemName}
            count={narrowed ? FILTER_BAR_COPY.count(page.total, total) : page.total}
            noun={COPY.itemNoun(page.total)}
            caption={<CategoryCaption category={category} className="text-body text-foreground-subtle" />}
            underBreadcrumb
        >
            {scope.jobs.length > 0 && (
                <CategoryJobChoice
                    jobs={scope.jobs.map(({ id, jobCode }) => ({ id, jobCode }))}
                    job={job}
                    categoryRecordId={category.id}
                    selects={recorder}
                />
            )}
            {recorder && <RegistrationDialog {...registration} />}
        </ListHeader>
    );

    // Assets under the category, none of them in the scope (#509): the head alone, whose
    // count and choice say it, where the empty category's words below would be false.
    if (page.total === 0 && category.assets.length > 0) {
        return <ListFrame top={top} header={header} />;
    }

    if (page.total === 0) {
        return (
            <ListFrame top={top} header={header}>
                <div className="flex flex-col items-center pt-list-empty-state-inset-top text-center">
                    <h2 className="text-heading font-semibold">{COPY.noAssetsHeading}</h2>
                    {/* The opener under the heading is a site manager's (#506). The sentence
                        between them, which told whoever was adding that a registration had
                        stopped before writing any, went in #507: a kind with nothing under it
                        is a catalog row nobody has bought yet. */}
                    {recorder && (
                        <div className="mt-gap-lg">
                            <RegistrationDialog {...registration} variant="bordered" />
                        </div>
                    )}
                </div>
            </ListFrame>
        );
    }

    // The rows this render read, and only those, which is what keeps the page box to this
    // page (#443): the list selects among what it is handed and has no way to name an asset
    // it was not. What a label run is for is the list's to read off the address, and
    // the print control that opens the labels on it stands in the selection bar with the
    // count; the category's name is the line under that dialog's title (#457). The boxes and the
    // bar are a site manager's (#506), so `selects` is the page's one answer to that.
    return (
        <AssetList
            categoryRecordId={category.id}
            itemName={category.itemName}
            selects={recorder}
            rows={assets.map((asset) => ({
                id: asset.id,
                assetId: asset.assetId,
                status: asset.status,
                jobCode: jobCodeById[asset.job?.[0]],
            }))}
            page={page}
            job={job}
            top={top}
            header={header}
        >
            {/* A registration's account, which only a list with rows in it can carry: one
                that wrote nothing stays in the dialog (#449, #456). The fork asks a question
                and the notice states a fact nothing repairs, so the fork's two controls answer
                it and the notice's one only takes it away (#455), and the fork's count never
                includes the notice's assets, which were written. Each is a dialog since
                #459, one at a time and the notice first; it stands first here too, so when
                its answer hands over to the fork the one closes before the other opens. Both
                are told to whoever added, which is a site manager (#506); an address carrying
                them reaches anybody else only as a copied link, and tells them nothing. */}
            {recorder && account.unlogged.length > 0 && <RegistrationUnlogged itemName={category.itemName} account={account} />}
            {recorder && account.unwritten > 0 && (
                <RegistrationShortfall category={opened} catalog={catalog} account={account} canRegister={canRegister} jobs={assignedJobs} />
            )}
        </AssetList>
    );
}
