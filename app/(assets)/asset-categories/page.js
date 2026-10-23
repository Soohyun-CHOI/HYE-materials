import { requireAdmin } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllAssetCategories } from "@/lib/airtable/assetCategories";
import { getAssetStatuses } from "@/lib/airtable/assets";
import { assignedJobsFor } from "@/lib/assetJob";
import {
    ASSET_LIST_COPY as COPY,
    categoryListRows,
    idsInScope,
    assetListScope,
    assetCategoriesInScope,
} from "@/lib/assetListView";
import { registrationCatalog } from "@/lib/assetCategory";
import { ASSET_CATALOG_COPY } from "@/lib/assetCatalog";
import { ASSET_REGISTRATION_COPY, canRegisterAssets } from "@/lib/assetRegistration";
import { ASSET_CATALOG_PATH } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";
import { isSiteManager } from "@/lib/siteManager";
import { ButtonLink } from "@/app/components/Controls";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader } from "@/app/components/ListTable";
import JobChoice from "../JobChoice";
import AssetCategoryList from "./AssetCategoryList";
import RegistrationDialog from "./RegistrationDialog";

// The constant rather than a second spelling of the word: the tab and the
// heading are both the table's name and must not drift apart.
export const metadata = { title: COPY.heading };

/**
 * Every kind of asset on the job the list stands on, with a count per status (#339, #520).
 *
 * WHAT IT ANSWERS IS A QUESTION ABOUT THE FLEET rather than about any one asset:
 * how many of each kind of asset there are, and how many of them are out. That is
 * why the row carries a count per status and no total — see `summarizeAssetCategories` for why a
 * single figure cannot be written without deciding whether a retired asset is
 * still owned.
 *
 * FOUR READS, HOWEVER MANY ASSETS STAND UNDER THE LIST, ONCE THIS SERVER HAS COUNTED THEM (#560).
 * The session find, `getAllAssetCategories` — the whole table, bounded by what the company has
 * bought, one query per hundred rows — the job list, and one question: which assets' statuses
 * have changed since the last view (`getAssetStatuses`). Each asset's status is kept between
 * views, and the first time this server meets an asset, or once ten minutes have passed, it is
 * read again, a hundred to a query: ten operations for all of 643, eight for a job of 415, where
 * every view read them all fifty to a query from #339 until this issue — six, twelve and sixteen
 * on the same jobs. `lib/assetStatusMemory.js` says why every view asks and what that answers.
 * `getAllAssetCategories` already returns each category's `Assets` link array, so finding the
 * units costs no query per category (#193), and the kind each asset is counted under comes off
 * that array. **The job list is read for every reader since #509**, beside the categories: each
 * job carries the assets on it, which is where the list's scope comes from (`assetListScope`),
 * the job each asset is counted on, and the choice the head moves by. The dialog takes the
 * reader's own jobs from the same read. The catalog the dialog picks a kind from is every row of
 * the same read that a registration may pick (`registrationCatalog`, #507) — a kind is the
 * company's, whatever job this list stands on — so it costs nothing.
 *
 * THE LIST STARTS ON ONE JOB (#520). The office may move to any job and anybody else to theirs,
 * and either starts on the first by its code; a category with nothing on the job is left off.
 * `lib/assetListView.js:assetListScope` is the judgment, and a category's own page reads its rows
 * by the same one. **From #509 a list started from all of the reader's jobs at once**, with `All
 * jobs` first in the choice, which the design never drew; docs/notes/tools.md has the turn.
 *
 * AND ON ALL OF THEM WHEN THE READER CHOOSES `All jobs` (#548): every job they may choose
 * between, read as one job is — the assets on them together in the one question below, and
 * nothing read per job. A row is a kind with an asset on any of them, its counts
 * those jobs' added up, and each row carries its counts per job for the band's `Job` chip, which
 * narrows to some of them in the browser.
 *
 * EVERY ROW ON THE JOB GOES TO THE BROWSER, WHICH FILTERS, SEARCHES AND PAGES THEM (#520). Every
 * category's counts need every asset on the job, so the page counts them all whichever page
 * it draws, and the band's narrowing and the paging are of rows already in hand
 * (`AssetCategoryList.js`), so neither fetches anything. **The page reads no filter off the
 * address**: what the band holds is the list's to read there, as a category's selection is.
 * **Each row carries the ids of the assets it counts (#541)**, which the status memory hands back
 * with their statuses for no read more, so a search finds an item by its id in the browser too.
 *
 * EACH ROW SAYS ITS KIND'S CATEGORY BESIDE ITS NAME (1a, #519), off the row already read, and
 * carries its type for the band to filter by.
 *
 * A READER WHO IS NOT A SITE MANAGER READS THE SAME LIST WITH NO OPENER (#506), in the
 * head or under an empty list: adding assets is a site manager's, and the action behind
 * the dialog refuses anybody else through `withSiteManagerAction`. Their empty list says who
 * fills it, `Items show here once a site manager adds them.` (1a2, #519).
 *
 * NO PER-STATUS ROLLUP ON `Asset Categories`, AND NO SUMMARY TABLE. Until #560 this said the count
 * would move into a rollup once the page passed ten operations, which #544 passed; what moved
 * instead is where the statuses are kept, since a view kept between views costs what a summary
 * table's would and asks nothing of the schema or of the writes. docs/notes/tools.md carries the
 * comparison.
 *
 * TWO EMPTY STATES (1a2, #519). A job with nothing on it draws `No items yet` and, for a site
 * manager, its sentence with a second opener under them; for anybody else who fills it — the
 * head's choice still there to move to another job. **A reader on no job** — anybody but the
 * office with no assignment — draws `No job yet` and what the list waits for, with no figure in
 * the head and no opener under it: a site manager among them has the head's opener, drawn
 * disabled with why before it (#456). Neither draws the band or a pager: there is nothing to
 * narrow or to page.
 *
 * THE JOB IS A CHOICE ONLY FOR A READER WITH MORE THAN ONE (#519): 1a draws the chip for a
 * reader on several jobs and nothing for one on one, whose list is that job's.
 *
 * THE OFFICE IS OFFERED THE CATALOG (1a, #527): `Catalog`, bordered, in the head after the job's
 * chip and 12 before `Add items`, in every state the list takes. The office is asked through
 * `requireAdmin`, the gate the catalog's page and its actions ask — one read, since a render reads
 * the person once — and nothing here reads the flag itself (`offline/site-manager.mjs`).
 *
 * NO WIDTH OF ITS OWN AND NO TEXT IN THE MARKUP — #336 put this axis's only container
 * in the layout, the 1080 here is the content's measure inside it (0b), and every
 * string comes from a constant so a vocabulary sweep can reach it.
 */
// Labeled for #190 by #224's rule that every entry point opens a scope. An outer
// wrapper and the route template, so repeated loads aggregate into one row.
export default async function AssetCategoriesPage(props) {
    return withOpsLabel("/asset-categories", () => renderCategoriesPage(props));
}

// Every signed-in user, with no Role and no Job gate (#337): a scan needs an account
// only because it records who performed it, and an asset moves between jobs, so the
// person scanning one is not always assigned to the job it is on. What a reader may DO
// here is narrower since #506 — adding assets is a site manager's — and what a reader is
// SHOWN is one of their jobs since #520; neither closes anything to them.
async function renderCategoriesPage({ searchParams }) {
    // The gate that admits every signed-in reader, and the office's answer with it (#527): a
    // reader who is not the office still reads the list, without the catalog's opener.
    const { user, authorized: office } = await requireAdmin();
    const sp = (await searchParams) ?? {};
    // Whether this reader adds assets (#506) — the one question every opener below is drawn
    // under.
    const recorder = isSiteManager(user);

    const [categories, allJobs] = await Promise.all([getAllAssetCategories(), getAllJobs()]);
    const scope = assetListScope(user, allJobs, sp.job);
    // The categories on the job, and the statuses of theirs there as this server keeps them, each
    // with the id its label prints (#541) — one question about what changed, whatever stands under
    // the list (#560); each asset's kind and job come off the arrays already read.
    const shownCategories = assetCategoriesInScope(categories, scope.shown);
    const kept = await getAssetStatuses(shownCategories.flatMap((category) => idsInScope(category.assets, scope.shown)));
    const rows = categoryListRows(shownCategories, scope, kept);
    // A reader on no job — anybody but the office with no assignment — has nothing the list
    // could hold, so the head counts nothing (1a2, #519).
    const onNoJob = scope.jobs.length === 0;
    // What the job's choice holds and the list's writes carry: a job, or all of them (#548).
    const job = scope.choice;
    // The jobs the head's choice offers, drawn when there is more than one to choose (#509,
    // #519) — by the list, which hands it what the band holds (#520), or here over an empty one.
    // They are also what the band's `Job` chip may offer while the list is on all of them (#548).
    const choosable = scope.jobs.length > 1 ? scope.jobs.map(({ id, jobCode }) => ({ id, jobCode })) : null;

    // The control that opens the registration dialog, carrying that dialog's own title so
    // the two cannot drift (#338). It is in the list's head rather than under it because a
    // reader with no assets yet needs it most, and it opens on no kind (#456). What it picks
    // from is the whole catalog, whatever the job (#509, #507): a kind is the company's, and
    // one off this job, or with nothing under it yet, is still one to add to. Its job starts on
    // the one the list stands on when that is one of the reader's own (#565) — none on all of
    // them — which the scope already answered off the address, so the opener reads nothing more.
    const registration = {
        opener: ASSET_REGISTRATION_COPY.heading,
        canRegister: canRegisterAssets(user, allJobs),
        jobs: assignedJobsFor(user, allJobs).map(({ id, jobCode, jobName }) => ({ id, jobCode, jobName })),
        listJobId: scope.job?.id ?? null,
        catalog: registrationCatalog(categories),
    };
    // A reader on no job meets no opener in the head (1a2, #522): the design draws its no-job
    // state with the heading alone, where #509 drew the opener locked with why before it.
    //
    // EACH OF THE HEAD'S CONTROLS MADE HERE CARRIES A KEY (#527). Handed to the list, a client
    // component, they arrive as elements this page made and stand among the head's children
    // there, where React asked a key of them and warned on every load of the list without one —
    // the registration's opener alone did, measured for a reader the catalog's is not drawn for.
    const opener = recorder && !onNoJob && <RegistrationDialog key="registration" {...registration} />;
    // The way to the catalog, the office's alone (#527) and in every state of the head.
    const catalog = office && (
        <ButtonLink key="catalog" variant="bordered" href={ASSET_CATALOG_PATH}>
            {ASSET_CATALOG_COPY.heading}
        </ButtonLink>
    );

    // Nothing on the job, or no job at all: the words where the rows would be (1a2, #519) —
    // a reader on no job's, a site manager's with the opener under them, or who fills it for
    // anybody else.
    if (rows.length === 0) {
        return (
            <ListFrame
                header={
                    <ListHeader title={COPY.heading} count={onNoJob ? null : 0} noun={COPY.itemNoun(0)}>
                        {choosable && <JobChoice jobs={choosable} job={job} />}
                        {catalog}
                        {opener}
                    </ListHeader>
                }
            >
                <div className="flex flex-col items-center pt-list-empty-state-inset-top text-center">
                    <h2 className="text-heading font-semibold">{onNoJob ? COPY.noJobHeading : COPY.noItemsHeading}</h2>
                    <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted">
                        {onNoJob ? COPY.untilAssigned : recorder ? COPY.noItems : COPY.untilASiteManagerAdds}
                    </p>
                    {recorder && !onNoJob && (
                        <div className="mt-gap-lg">
                            <RegistrationDialog {...registration} variant="bordered" />
                        </div>
                    )}
                </div>
            </ListFrame>
        );
    }

    // The job the list stands on is named where a search for an id finds no item (#541), and on
    // all of them none is.
    return (
        <AssetCategoryList
            rows={rows}
            job={job}
            jobCode={scope.job?.jobCode ?? null}
            allJobs={scope.allJobs}
            jobs={choosable}
            catalog={catalog}
            opener={opener}
        />
    );
}
