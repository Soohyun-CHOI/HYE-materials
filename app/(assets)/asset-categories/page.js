import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllAssetCategories } from "@/lib/airtable/assetCategories";
import { getAssetsByRecordIds } from "@/lib/airtable/assets";
import { assignedJobsFor } from "@/lib/assetJob";
import { FILTER_BAR_COPY } from "@/lib/listFilters";
import {
    ASSET_LIST_COPY as COPY,
    idsInScope,
    pageOfAssetCategories,
    summarizeAssetCategories,
    assetListScope,
    assetCategoriesInScope,
} from "@/lib/assetListView";
import { assetCategoryPath, assetCategoriesPath } from "@/lib/assetRoutes";
import { ASSET_STATUS_VALUES } from "@/lib/assetStatus";
import { ASSET_CATEGORY_COPY, registrationCatalog } from "@/lib/assetCategory";
import { ASSET_REGISTRATION_COPY, canRegisterAssets } from "@/lib/assetRegistration";
import { withOpsLabel } from "@/lib/airtableOps";
import { isSiteManager } from "@/lib/siteManager";
import ListFrame from "@/app/components/ListFrame";
import { ListHeader, Pager, TABLE_HEAD, TABLE_ROW, TABLE_ROW_LINK } from "@/app/components/ListTable";
import JobChoice from "../JobChoice";
import RegistrationDialog from "./RegistrationDialog";

// The constant rather than a second spelling of the word: the tab and the
// heading are both the table's name and must not drift apart.
export const metadata = { title: COPY.heading };

// 1a's columns: the name, then a count for each status at 96, right-aligned — and since
// #507 the kind's class and its category between them, and since #514 its type between
// those two, in the order a path says type and category. The class and the type each take a
// count's track, the one narrow track 1a draws — `Equipment` fits it — and the category shares
// the room with the name, until Design draws the columns. THE NAME TAKES THREE PARTS OF THAT
// ROOM TO THE CATEGORY'S ONE SINCE #514: a name carries its maker and part number now, which
// are what tell two rows of one tool and size apart, so it is the cell a cut would cost the
// most — seen at 1440, where an even split cut `DEMO Cordless Drill 18V, DEMO DeWalt (DCD791)`
// at 228 and left `DEMO Machining` 114 short of its 228.
const COLUMNS =
    "grid-cols-[minmax(0,3fr)_var(--width-table-count)_var(--width-table-count)_minmax(0,1fr)_repeat(3,var(--width-table-count))]";

/**
 * Every kind of asset the company owns, with a count per status (#339).
 *
 * WHAT IT ANSWERS IS A QUESTION ABOUT THE FLEET rather than about any one asset:
 * how many of each kind of asset there are, and how many of them are out. That is
 * why the row carries three counts and no total — see `summarizeAssetCategories` for why a
 * single figure cannot be written without deciding whether a retired asset is
 * still owned.
 *
 * FOUR OPERATIONS, AND THE FOURTH IS THE ONE THAT GROWS. The session find,
 * `getAllAssetCategories` — the whole table in one query, bounded by what the company has
 * bought — the job list, and then every asset in the reader's scope, read in one
 * batch of 50 at a time. `getAllAssetCategories` already returns each category's `Assets` link
 * array, so finding the units costs no query per category (#193), and
 * `getAssetsByRecordIds` was written for exactly this call. **The job list is read
 * for every reader since #509**, beside the categories: each job carries the assets on
 * it, which is where a reader's scope comes from (`assetListScope`), and it is the
 * choice the head narrows by. It was read for the registration dialog alone from #456,
 * and for a site manager alone from #506; the dialog takes the reader's own jobs from
 * the same read. The catalog the dialog picks a kind from is every row of the same read that
 * a registration may pick (`registrationCatalog`, #507) — a kind is the company's, whatever scope
 * this list is in — so it costs nothing.
 *
 * WHAT A READER STARTS FROM, AND WHAT A JOB NARROWS (#509). The office starts from every
 * asset and anybody else from the assets on their jobs, and a category with none of
 * the reader's is left off — the office's included since #507, when a kind with nothing
 * under it stopped being a registration the office puts right and became a catalog row
 * nobody has bought yet. A job chosen in the head narrows either to that job's assets,
 * and a category with none of them is left off. The head then counts `N of M`, `M` being where
 * the reader started. `lib/assetListView.js:assetListScope` is the judgment, and a category's own
 * page reads its rows by the same one.
 *
 * EACH ROW SAYS ITS KIND'S CLASS, TYPE AND CATEGORY (#507, #514), off the row already read. A
 * kind's name is its name, its size, and its maker and part number, so the type and the
 * category are what the row says beside it; a kind the office left without one shows the
 * cell empty, and no word stands in for it.
 *
 * A READER WHO IS NOT A SITE MANAGER READS THE SAME LIST WITH NO OPENER (#506), in the
 * head or under an empty list: adding assets is a site manager's, and the action behind
 * the dialog refuses anybody else through `withSiteManagerAction`. The empty list keeps
 * its heading and its sentence, which say what the list is for whoever reads it.
 *
 * NO PER-STATUS ROLLUP ON `Asset Categories`, WHICH IS A DECISION WITH A MEASURED TRIGGER.
 * The walk is `ceil(assets in scope / 50)` over three fixed operations, so this page
 * passes ten at 351 assets in the widest scope, the office's — 401 until the job list
 * joined the fixed three, which #456 began for a site manager and #509 made everybody's;
 * corrected per #181. At that point the count moves into a rollup and
 * `Purchase Orders."Uninvoiced Items"` (#244) is the worked example of the move.
 * Five rollups nothing reads today would be five fields to keep in step for
 * nothing. docs/notes/tools.md carries the arithmetic.
 *
 * DRAWN AS 1a (#463): the list's head with how many categories there are, the table under a
 * column head that holds while the rows scroll, and the pager pinned at the foot —
 * `ListFrame.js` and `ListTable.js` for the parts. **It pages at 25 since that issue**,
 * 0b's page of rows, and paging costs nothing: every category's counts need every asset,
 * so the page reads them all whichever page it draws and slices what it built
 * (`pageOfAssetCategories`). The kinds the registration offers are the whole catalog, not
 * the page's.
 *
 * TWO EMPTY STATES, AND ONE HAS NO WORDS YET. A list that starts from nothing — no category
 * with anything under it, or none on the reader's jobs — draws `No tools yet` and its sentence, with a
 * second opener under them, and no pager: there is nothing to page. A job chosen with
 * nothing on it draws nothing under the head, whose `0 of M` and choice say what
 * happened (#509); Design is drawing what it says.
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
// SHOWN first is their jobs' since #509; neither closes anything to them.
async function renderCategoriesPage({ searchParams }) {
    const user = await requireUser();
    const sp = (await searchParams) ?? {};
    // Whether this reader adds assets (#506) — the one question every opener below is drawn
    // under.
    const recorder = isSiteManager(user);

    const [categories, allJobs] = await Promise.all([getAllAssetCategories(), getAllJobs()]);
    const scope = assetListScope(user, allJobs, sp.job);
    const narrowed = scope.job !== null;
    // The categories the scope reaches, and of theirs the assets in it, in one batched read.
    const shownCategories = assetCategoriesInScope(categories, scope.shown);
    const assets = await getAssetsByRecordIds(shownCategories.flatMap((category) => idsInScope(category.assets, scope.shown)));
    const rows = summarizeAssetCategories(shownCategories, assets);
    const page = pageOfAssetCategories(rows, sp.page);
    const total = assetCategoriesInScope(categories, scope.start).length;
    // 0n's figure alone, and while a job narrows the list the document lists' `N of M`, `M`
    // being where the reader started (#509).
    const count = narrowed ? FILTER_BAR_COPY.count(rows.length, total) : rows.length;
    const job = scope.job?.id ?? null;
    // The head's choice, drawn when there is a job to choose (#509).
    const jobChoice =
        scope.jobs.length > 0 ? (
            <JobChoice jobs={scope.jobs.map(({ id, jobCode }) => ({ id, jobCode }))} job={job} />
        ) : null;

    // The control that opens the registration dialog, carrying that dialog's own title so
    // the two cannot drift (#338). It is in the list's head rather than under it because a
    // reader with no assets yet needs it most, and it opens on no kind (#456). What it picks
    // from is the whole catalog, whatever the scope (#509, #507): a kind is the company's, and
    // one off the reader's jobs, or with nothing under it yet, is still one to add to.
    const registration = {
        opener: ASSET_REGISTRATION_COPY.heading,
        canRegister: canRegisterAssets(user, allJobs),
        jobs: assignedJobsFor(user, allJobs).map(({ id, jobCode }) => ({ id, jobCode })),
        catalog: registrationCatalog(categories),
    };

    return (
        <ListFrame
            header={
                <ListHeader title={COPY.heading} count={count} noun={COPY.toolNoun(rows.length)}>
                    {jobChoice}
                    {recorder && <RegistrationDialog {...registration} />}
                </ListHeader>
            }
            footer={
                rows.length > 0 && (
                    <Pager
                        range={COPY.range({ from: page.from + 1, to: page.to, total: page.total })}
                        position={COPY.pagePosition(page)}
                        previous={{ href: page.page > 1 ? assetCategoriesPath(page.page - 1, job) : null, label: COPY.previous }}
                        next={{ href: page.page < page.pageCount ? assetCategoriesPath(page.page + 1, job) : null, label: COPY.next }}
                    />
                )
            }
        >
            {/* A job chosen with nothing on it draws nothing under the head (#509), whose
                `0 of M` and choice say it; a list that starts from nothing draws the words. */}
            {rows.length === 0 ? (
                narrowed ? null : (
                    <div className="flex flex-col items-center pt-list-empty-state-inset-top text-center">
                        <h2 className="text-heading font-semibold">{COPY.noToolsHeading}</h2>
                        <p className="mt-gap max-w-empty-state text-body-sm text-pretty text-foreground-muted">{COPY.noTools}</p>
                        {recorder && (
                            <div className="mt-gap-lg">
                                <RegistrationDialog {...registration} variant="bordered" />
                            </div>
                        )}
                    </div>
                )
            ) : (
                <div role="table" aria-label={COPY.heading}>
                    <div role="row" className={`${TABLE_HEAD} ${COLUMNS}`}>
                        <span role="columnheader">{COPY.toolLabel}</span>
                        <span role="columnheader">{ASSET_CATEGORY_COPY.classLabel}</span>
                        <span role="columnheader">{ASSET_CATEGORY_COPY.levelLabel.level1}</span>
                        <span role="columnheader">{ASSET_CATEGORY_COPY.levelLabel.level2}</span>
                        {ASSET_STATUS_VALUES.map((status) => (
                            <span key={status} role="columnheader" className="text-right">
                                {status}
                            </span>
                        ))}
                    </div>
                    {page.rows.map((row) => (
                        <div key={row.id} role="row" className={`${TABLE_ROW} ${COLUMNS}`}>
                            <span role="cell" className="min-w-0 truncate">
                                <Link href={assetCategoryPath(row.id, 1, [], { job })} className={TABLE_ROW_LINK}>
                                    {row.itemName}
                                </Link>
                            </span>
                            <span role="cell">{row.assetClass}</span>
                            <span role="cell">{row.level1}</span>
                            <span role="cell" className="min-w-0 truncate">
                                {row.level2}
                            </span>
                            {/* All three statuses on every row, a zero included: an absent
                                one would read as "not known" where a `0` reads as "none",
                                and a zero takes Ink 3. The column head is the label, so a
                                count is never carried by color alone. */}
                            {row.counts.map((entry) => (
                                <span
                                    key={entry.status}
                                    role="cell"
                                    className={`text-right tabular-nums ${entry.count === 0 ? "text-foreground-subtle" : ""}`}
                                >
                                    {entry.count}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </ListFrame>
    );
}
