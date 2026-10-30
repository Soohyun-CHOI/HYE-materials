// What the two asset list screens show (#339) — `/asset-categories`, which is every
// category with a count per status and since #569 its total, by name or since #540 by its
// items' most recent change, and `/asset-categories/[categoryRecordId]`, which is one
// category's assets a page at a time, newest first since #463 — by their most recent change or
// their printed id since #540 — and which of them a label run is for (#443) — and since #509
// which jobs' assets either holds: one job's since #520, or all of a reader's at once when they
// choose it (#548).
//
// PURE AND OFFLINE-SAFE. It imports lib/assetStatus.js, lib/assetView.js — which
// imports lib/assetStatus.js in turn since #376 — and, since #443, lib/assetLabelPage.js
// for what one print takes and lib/idSequence.js for the one reading of a sequence,
// all with the extension spelled out, so
// `scripts/tests/offline/asset-list-view.mjs` pins all of it with no credentials.
// Nothing here reaches lib/airtable/, which is also what lets a category's list — a
// `"use client"` file — import it.
//
// THE FIELD LABELS COME FROM lib/assetView.js RATHER THAN BEING RE-SPELLED
// HERE. `Status` and `Job` name the same two fields the asset's own page names,
// and `Back to Equipment & Tools` is the same way back; a second copy of any of
// them is a second word for one fact the first time somebody rewords one. What is
// below is only what these two screens say and that one does not — the list's
// `Name` among it since #519, where it borrowed the asset page's `Tool`.
//
// EVERY STRING EITHER SCREEN RENDERS IS IN A COPY CONSTANT AND NONE IS IN JSX,
// which is this axis's arrangement since #338 — a word written into a component
// is invisible to the vocabulary checks and to scripts/screen-strings.mjs, so it
// cannot be swept when a word changes, and it is not Design's to reword in one
// place. The check that comes with this issue is what finally holds it: it reads
// every file under app/(assets)/ and fails on any JSX text at all. **This said the
// constant was `TOOL_LIST_COPY`, which stopped being the whole of it**: the print
// control says the labels' own word (#443), and what a registration says where it
// lands (#449) and the control that opens the form from a category's page (#451) are
// `ASSET_REGISTRATION_COPY`'s — each is the constant of the screen or the dialog the
// words are about. `ASSET_LIST_COPY` is what these two say of their own.

import { ASSET_STATUS, SHOWN_STATUS_VALUES, countedInTotal } from "./assetStatus.js";
import { ASSET_COPY, currentHolder, newestFirst } from "./assetView.js";
import { ASSET_NOTE_COPY } from "./assetNote.js";
import { MAX_LABELS_PER_REQUEST } from "./assetLabelPage.js";
import { sequenceOf } from "./idSequence.js";
import { assignedJobsFor } from "./assetJob.js";
import { ASSET_CATEGORY_COPY, compareCatalogText } from "./assetCategory.js";
import { ALL_JOBS, ASSET_LIST_PARAMS, ASSET_SORT, LIST_SORTS, readSort, searchedAssetId } from "./assetRoutes.js";
import { normalizeItemText, textMatchKey } from "./itemNaming.js";
import { matchesTokens, searchTokens } from "./searchTokens.js";

/**
 * Which job a reader's asset lists stand on, and which jobs they may move to (#509, #520, #548, #593).
 *
 * `jobs` is `getAllJobs`' answer, each carrying `Jobs."Assets"` — the reverse link of
 * `Assets."Job"`, which is where an asset IS now (a check-out or check-in on another
 * job moves it). So a scope is a set of asset record ids taken off the jobs' arrays before
 * any asset is read, and both lists cut their reads from it.
 *
 * EVERY READER MAY MOVE TO EVERY JOB (#593). `jobs` in the answer is every job by its code, as
 * `compareCatalogText` orders a code, a job with no assets on it included, since the reader may
 * ask what is on it and be told nothing. Until #593 that was the office's alone — `Is Admin`,
 * whatever else the person was — and anybody else's was the jobs they are assigned to, so a
 * site's equipment was hidden from everybody not on it. A rule taking a job off the choice is
 * #488's, for a job that has ended, and it takes the job off every reader's list at once.
 *
 * A LIST STARTS ON ONE JOB (#520): THE FIRST OF THE READER'S OWN in the choice's order, their
 * assignments as `assignedJobsFor` reads them, which is the job a site reads its list for — and
 * the office's the same way since #593, where it started on the first of every job. `job` is
 * the job the list stands on, null on all of them and where there is no job at all.
 *
 * AND ON ALL OF THEM WHEN THE ADDRESS ASKS FOR `ALL_JOBS` (#548), or with no job asked for a
 * reader assigned to none (#593), where #519 drew `No job yet` — wherever there are two jobs to
 * choose between. `allJobs` says so, and `shown` is the record ids of the assets on the jobs it
 * stands on — one job's, all of them together, or none where no job exists. `choice` is what
 * the job's choice holds and the list's own writes carry: the job's id, `ALL_JOBS`, or null.
 * **#509 started every list from all of a reader's jobs and #520 took that away**, since a site
 * reads its list for the job it stands on; #548 kept that start and offered all of them as a
 * choice, for a reader asking how many of a kind there are across the sites.
 * docs/notes/tools.md has the turn and the return.
 *
 * **The office's flag is read here and nowhere else on this axis**, and since #593 for one
 * thing alone: handed back as `office`, whether the office's acts on an asset are this
 * reader's (`lib/assetOfficeActs.js`, #583). Which jobs a list may stand on no longer asks it.
 * What a reader may RECORD is `isSiteManager`'s and the jobs they record on are their own
 * assignments, which nothing here decides (`offline/asset-record-jobs.mjs`), and
 * `offline/site-manager.mjs` holds this as the one read of the flag it admits. The President is
 * not the office here unless marked so — this follows `Is Admin` alone, where
 * `lib/deliveryAccess.js` admits both. **A category with no asset on the job is left off
 * every list (`assetCategoriesInScope`)** — since #507 a kind with nothing under it is a
 * catalog row nobody has bought yet, which the list is not for.
 *
 * THE JOB ASKED FOR IS A REQUEST RATHER THAN A PROMISE, as `?page=` is. A job the list offers
 * is chosen; any other string — one that does not exist, a repeated parameter — is answered
 * where an address naming no job starts, and the two are answered alike, so a list never says
 * whether a job it did not offer exists. #509 answered it with the whole scope, which #520
 * took away. The address is not rewritten: the control holds where the list starts, and the
 * reader's next choice replaces it. **`ALL_JOBS` is taken wherever it stands among the values
 * (#548)**, since the band's `Job` chip rides beside it as more of them — whatever those name,
 * the band's to read — and with one job or none it is answered as any value not offered is.
 *
 * THE COUNT'S WORDS ARE THE DOCUMENT LISTS' AND NOT THIS MODULE'S. The head's `N of M` says
 * what `lib/listFilters.js` says for a narrowing, and the pages read it there: this module may
 * not import that one, which declares `LIST_PAGE_SIZE` (`offline/asset-list-view.mjs`), and
 * `offline/list-filters.mjs` holds those words to that module.
 *
 * NOTHING HERE GATES AN ASSET. An asset off the job is left off the lists and still opens
 * from its label or a link (#337): the scope is what a reader is shown, not what they may see.
 */
export function assetListScope(user, jobs, rawJob) {
    const all = Array.isArray(jobs) ? jobs : [];
    const office = user?.isAdmin === true;
    const listed = [...all].sort((a, b) => compareCatalogText(a.jobCode, b.jobCode));
    const values = Array.isArray(rawJob) ? rawJob : [rawJob];
    const asked = typeof rawJob === "string" ? (listed.find((each) => each.id === rawJob) ?? null) : null;
    const start = assignedJobsFor(user, listed)[0] ?? null;
    const allJobs = listed.length > 1 && (values.includes(ALL_JOBS) || (asked === null && start === null));
    const job = allJobs ? null : (asked ?? start ?? listed[0] ?? null);
    const on = allJobs ? listed : job ? [job] : [];
    const onJob = new Map(on.flatMap((each) => (each.assets || []).map((id) => [id, each.id])));
    return {
        // Whether this reader is the office (#583), the flag as it was read above: what the office
        // may do to an asset nothing has happened to asks it here rather than reading it again.
        office,
        jobs: listed,
        job,
        allJobs,
        choice: allJobs ? ALL_JOBS : (job?.id ?? null),
        shown: new Set(onJob.keys()),
        // Which of the jobs stood on holds each asset in `shown` (#560): the job whose
        // `Jobs."Assets"` array names it, which is where `countedAssets` counts it.
        onJob,
    };
}

/**
 * The `job` an address asks for, in the shape a page's `searchParams` hands it to
 * `assetListScope` (#553): nothing, one string, or the repeated values in their order — Next's
 * own reading of a repeated key. The export asks it of the address the list was showing, so the
 * scope it stands on is answered by the one judgment the page's is, a job not offered included.
 */
export function jobAsked(params) {
    const values = params?.getAll?.("job") ?? [];
    return values.length === 0 ? undefined : values.length === 1 ? values[0] : values;
}

/**
 * The job an asset's page opens a list on (#519, #581): the asset's own, a Job record id, when there
 * are jobs to choose between and it is one of them, and null otherwise, which opens the list where
 * an address naming no job does. `scope` is `assetListScope`'s answer for the reader. Every reader
 * chooses among every job since #593, so it is the asset's job for a reader on one job of their
 * own or none as well, where #581 carried none for a reader on one: their bare list was theirs.
 *
 * ONE VALUE FOR EVERY LEVEL OF THE PAGE'S BREADCRUMB THAT LEADS TO A LIST: `Equipment & Tools`,
 * through `assetCategoriesPath`, and the category, through `assetCategoryPath`. The category's
 * carried it from #519 and the first carried none until #581, so a reader on several jobs went
 * back to the list on the first of them. The page's address carries no job, so the way back
 * stands on the asset's job whatever list the asset was opened from, `All jobs` included.
 */
export function listJobFromAsset(scope, asset) {
    const job = asset?.job?.[0];
    return scope.jobs.length > 1 && scope.jobs.some((each) => each.id === job) ? job : null;
}

/** The ids of `ids` a scope holds, in their own order. */
export function idsInScope(ids, scope) {
    const all = Array.isArray(ids) ? ids : [];
    return all.filter((id) => scope?.has(id));
}

/**
 * The categories a scope reaches: those with at least one asset in it (#507). A category's
 * `Assets` link array is what is asked, so this costs no read.
 */
export function assetCategoriesInScope(categories, scope) {
    const all = Array.isArray(categories) ? categories : [];
    return all.filter((category) => idsInScope(category.assets, scope).length > 0);
}

/**
 * How many rows one page of an asset list holds: a category's assets, since #463 the
 * categories themselves, and since #527 the catalog's rows — fifty since #538.
 *
 * THE FIRST PAGING IN THIS APP (#339). #326 took its shape for the document lists —
 * the page number in the URL, a screen that says which page it is — and could not
 * take the half that divides the read, which `pageOfAssets` says why. The category list
 * divides no read either: it counts every asset in scope to draw any page
 * (`summarizeAssetCategories`), so its pages are a slice of rows already in hand
 * (`pageOfAssetCategories`).
 *
 * FIFTY SINCE #538, WHICH IS THE ISSUE'S FIGURE AND NOT THE DRAWINGS'. It was ten until
 * #442, an estimate of a screenful of three short facts at 375px made before any screen
 * was drawn, and twenty-five from #442, the design's figure for the list as it drew it —
 * which every list in the files of 2026-10-16 still draws. #538 set fifty for every list
 * on the axis, and nobody has yet held one with a real warehouse in it. It is stated in
 * docs/briefs/asset-categories-categoryRecordId.md, so the design work sees the figure.
 *
 * WHAT IS NOT A CHOICE IS THE CEILING, AND THERE ARE TWO; FIFTY IS THE FIRST EXACTLY.
 * The read: the latest log rows of a page's items that are out are read fifty to a query
 * (#520, #540), so a page of more than fifty with more than fifty out would read them twice.
 * Until #540 the page's own items were read the same way — any size up to 50 one
 * `findChildRecords` query, a fifty-first row a second — and since then every item of the kind
 * on the scope is read, a hundred to a query, whatever the page holds. The print:
 * the page box selects the assets on the page it is showing (#443), so this is also how
 * many one press of it adds to a run, and the print control acts only on a run of at
 * most `MAX_LABELS_PER_REQUEST` — so a page larger than that is a page box whose first
 * press leaves the print control refusing. Until #443 the print control sent the
 * page itself, and the order between the two figures held for that reason instead.
 * `offline/asset-list-view.mjs` holds the size under both.
 *
 * IT IS NOT `LIST_PAGE_SIZE`, AND #538 IS WHAT THE SEPARATION WAS FOR. From #442 the
 * two were both 25, which a pass naming the design's values would have read as one
 * number; #538 moved this one to fifty and the document lists' stayed at 25, the change
 * the warning existed to keep one edit. This list's row is three short facts and a press
 * of its page box selects the page for a label run; the document lists filter, search and
 * page rows a gate admitted. Folding them makes a change to either move the other. **The
 * one way they become one number is a decision that they are one reader's page**, taken
 * where #258 names the design's values, with this paragraph and the one on
 * `LIST_PAGE_SIZE` changed in the same commit — the check fails a fold made any other
 * way. `/materials` has a 25 of its own, and that is a bound on what a search asks the
 * base for rather than a page at all.
 */
export const ASSET_PAGE_SIZE = 50;

/**
 * The later of two moments an item or a kind last changed at (#540): ISO strings, as
 * `Assets."Last Event At"` arrives. `null` is an item with no `Asset Log` row, which only a
 * registration whose log pass failed leaves (#449), so it is the newest there is and reads later
 * than any moment; `undefined` is nothing met yet.
 */
function laterMoment(a, b) {
    if (a === undefined) return b;
    if (b === undefined) return a;
    return momentRank(a) >= momentRank(b) ? a : b;
}

// A moment as a number to order by: `null` the newest (`laterMoment`), a moment that does not parse
// the oldest.
function momentRank(at) {
    if (at === null) return Infinity;
    const ms = Date.parse(at);
    return Number.isNaN(ms) ? -Infinity : ms;
}

/**
 * Newest first, by what `moment` reads off each — the order every `Recently updated` takes (#540): an
 * item's, a kind's on the category list and a catalog row's. Two alike compare equal, so a sort keeps
 * them in the order it was handed, which is by name on both lists of kinds.
 */
export const newestMomentFirst = (moment) => (a, b) => momentRank(moment(b)) - momentRank(moment(a));

/**
 * Every category with its count per status, in the order the list renders them.
 *
 * `categories` is the categories the reader's scope reaches (`assetCategoriesInScope`)
 * and `assets` is every asset of theirs in that scope — since #560 `countedAssets`' answer, each
 * one's kind and job off the link arrays and its status as the server keeps it
 * (`lib/assetStatusMemory.js`), so a view reads the base about the statuses once whatever stands
 * under it. docs/notes/tools.md has the figures, and why `Asset Categories` carries no
 * per-status rollup.
 *
 * EVERY STATUS ON EVERY ROW, A ZERO INCLUDED. A count of nothing is a
 * measurement and the app already spells it apart from no measurement at all —
 * an absent `Out` would read as "not known" where `0` reads as "none out". It is
 * also what makes a new status impossible to add silently: the row is built from
 * `SHOWN_STATUS_VALUES`, so #531's `In repair` appeared here without anyone editing
 * this function, and the check asserts the two agree — and #582's `Deleted`, which the app
 * shows nowhere, did not. **An item in repair is not in
 * stock**: one status at a time, so the `In stock` count leaves out what is away at its
 * maker by construction, as 1a draws it.
 *
 * THE TOTAL IS NOT MADE HERE (#569). A kind's `Total` counts what the company still holds,
 * every status but `Retired` (`lib/assetStatus.js:countedInTotal`), and the four counts stay
 * beside it, so what it has ever bought is still on the row. It is added by `readCategoryList`,
 * after the `Job` chip has narrowed the counts, which this function cannot know. From #339
 * until #569 the row carried no total at all, on the ground that one figure would have to
 * choose between those two readings.
 *
 * BY NAME, CASE-INSENSITIVELY, AS 1a DRAWS IT — only a category's own list reads newest
 * first (#463) — AND BY CATEGORY AND TYPE WHERE TWO NAMES MEET (#507, #514). A kind's name is
 * its name, its size, and its maker and part number, so one of those under two categories or
 * two types is two kinds of one name; the category and the type are what tell them apart on
 * the row, and ordering by them keeps a page the same on every read. Until #507 nothing
 * needed it: `upsertTool` refused a second row whose name matched one ignoring case. The
 * order is the registration's (`compareCatalogText`), which reads a size's figure as a
 * number.
 *
 * EACH ROW CARRIES ITS KIND'S CATEGORY AND TYPE (#507, #514), off the row
 * `getAllAssetCategories` already read, so they cost nothing: the category the row says
 * beside its name (1a, #519) and the type two rows of one name and category are ordered by.
 * Each keeps its level's name, `level1` the type and `level2` the category, as
 * `lib/assetCategory.js` does. Both are what the list's band filters by (#520,
 * `filterAssetCategoryRows`). The class rode here too, as a column from #507 to #519 and as a
 * filter from #520 until #552 took it off the catalog.
 *
 * AN ASSET THAT DID NOT RESOLVE IS COUNTED NOWHERE. `findByRecordIds` returns
 * fewer rows rather than throwing, which its own doc warns about; no path in this
 * app produces a link that does not resolve, and the alternative — throwing —
 * would take the whole list down over one row.
 *
 * EACH ROW ALSO CARRIES ITS COUNTS ON EACH JOB (#548), `perJob`: a Job record id to its counts in
 * `SHOWN_STATUS_VALUES`' order, for every job the row has an asset on — the job the asset itself
 * links, the same link `Jobs."Assets"` reverses. The band's `Job` chip adds these up in the
 * browser (`filterAssetCategoryRows`), so narrowing all jobs to some reads nothing.
 * On one job a row holds that job alone, and `counts` is its figures.
 *
 * AND THE ASSETS IT COUNTS, BY THE ID EACH ONE'S LABEL PRINTS (#541), `assetIds`: a Job record
 * id to each status to the `Asset ID`s on that job holding it, so the search finds an item by its
 * id in the browser as it finds a row by its name, and says where the item is and its status
 * (`filterAssetCategoryRows`). They are the assets counted and no others — those on the jobs the
 * list stands on, the reader's — so an id off them is found on no row. **Grouped and not one
 * record each, which a page's bytes decided**: written as `{ assetId, job, status }` the ids of
 * a job of 143 carried 13,471 bytes into the page, 94 each, and grouped they carry 6,033.
 *
 * AND WHEN ITS ITEMS LAST CHANGED (#540), `lastEventAt`: the latest of the assets' `Last Event At`
 * it counts — each asset's latest `Asset Log` event, which the status memory keeps — and
 * `lastEventOnJob`, the same on each job, so the band's `Job` chip can say when the kind last
 * changed on the jobs it takes, as it adds up their counts. `readCategoryList` reads one of the two
 * as the row's `updatedAt` and sorts by it. An item with no event reads as the newest
 * (`laterMoment`).
 */
export function summarizeAssetCategories(categories, assets) {
    const counts = new Map();
    const onJobs = new Map();
    const printed = new Map();
    const latest = new Map();
    const latestOnJobs = new Map();
    for (const item of assets || []) {
        const categoryRecordId = item?.category?.[0];
        if (!categoryRecordId) continue;
        if (!counts.has(categoryRecordId)) counts.set(categoryRecordId, new Map());
        const perStatus = counts.get(categoryRecordId);
        perStatus.set(item.status, (perStatus.get(item.status) || 0) + 1);
        const moment = item.lastEventAt ?? null;
        latest.set(categoryRecordId, laterMoment(latest.get(categoryRecordId), moment));
        if (item?.job?.[0]) {
            if (!latestOnJobs.has(categoryRecordId)) latestOnJobs.set(categoryRecordId, {});
            const onJob = latestOnJobs.get(categoryRecordId);
            onJob[item.job[0]] = laterMoment(onJob[item.job[0]], moment);
        }
        if (item.assetId) {
            if (!printed.has(categoryRecordId)) printed.set(categoryRecordId, {});
            const onJob = (printed.get(categoryRecordId)[item?.job?.[0] ?? ""] ??= {});
            (onJob[item.status] ??= []).push(item.assetId);
        }
        const jobRecordId = item?.job?.[0];
        const index = SHOWN_STATUS_VALUES.indexOf(item.status);
        if (!jobRecordId || index < 0) continue;
        if (!onJobs.has(categoryRecordId)) onJobs.set(categoryRecordId, {});
        const perJob = onJobs.get(categoryRecordId);
        perJob[jobRecordId] ??= SHOWN_STATUS_VALUES.map(() => 0);
        perJob[jobRecordId][index] += 1;
    }

    return (categories || [])
        .map((category) => ({
            id: category.id,
            itemName: category.itemName,
            level1: category.level1 ?? "",
            level2: category.level2 ?? "",
            counts: SHOWN_STATUS_VALUES.map((status) => ({
                status,
                count: counts.get(category.id)?.get(status) || 0,
            })),
            perJob: onJobs.get(category.id) ?? {},
            assetIds: printed.get(category.id) ?? {},
            lastEventAt: latest.get(category.id) ?? null,
            lastEventOnJob: latestOnJobs.get(category.id) ?? {},
        }))
        .sort(
            (a, b) =>
                compareCatalogText(a.itemName, b.itemName) || compareCatalogText(a.level2, b.level2) || compareCatalogText(a.level1, b.level1)
        );
}

/**
 * The category list's rows (#339, #560): each category the scope reaches with its counts, over
 * the assets `kept` holds a status for — `summarizeAssetCategories` of `countedAssets`, the
 * one composition the list and its export make (#553). `categories` are those the scope reaches
 * (`assetCategoriesInScope`), which the caller already holds to know which statuses to ask for:
 * the list asks the status memory, and the export the assets it reads whole.
 *
 * A CATEGORY WITH NOTHING COUNTED UNDER IT IS NO ROW (#582). The scope reaches a category by its
 * link array, which names a deleted asset as it names any other, and neither read hands a deleted
 * one back — so a kind whose only item on the job was deleted would stand with nothing in any
 * column. It is left off as a kind with no item on the job is (`assetCategoriesInScope`), and so is
 * one whose assets there all failed to resolve, which no path in this app produces.
 */
export function categoryListRows(categories, scope, kept) {
    const counted = countedAssets(categories, scope, kept);
    const standing = new Set(counted.map((asset) => asset.category[0]));
    return summarizeAssetCategories(
        (categories || []).filter((category) => standing.has(category.id)),
        counted
    );
}

/**
 * The assets a category list counts (#560), as `summarizeAssetCategories` takes them: every
 * asset in the scope under the categories given, each with its kind, its job, its status and the
 * id its label prints (#541).
 *
 * THE KIND AND THE JOB COME OFF THE LINK ARRAYS, WHICH A VIEW READS EVERY TIME. A category's
 * `Assets` array names its kind's assets and the scope's `onJob` the job whose `Jobs."Assets"`
 * array names each one, so a move, a recategorizing or a deletion counts at once, and a row's
 * counts per job (`perJob`) are only ever the jobs the reader stands on. `kept` holds the three
 * facts the server keeps between views, each asset's `{ status, assetId, lastEventAt }` —
 * `lib/airtable/assets.js:getAssetStatuses`' answer — for an asset the base still has.
 *
 * AN ASSET WITH NO STATUS IN THE ANSWER IS COUNTED NOWHERE, the reading a read that did not
 * resolve always had: a status-less row would be a count under no column. An asset under two
 * categories' arrays, which no write here makes, is counted once, under the first.
 */
export function countedAssets(categories, scope, kept) {
    const counted = [];
    const met = new Set();
    for (const category of categories || []) {
        for (const id of idsInScope(category.assets, scope?.shown)) {
            if (met.has(id)) continue;
            met.add(id);
            const facts = kept?.get(id);
            if (!facts?.status) continue;
            const job = scope?.onJob?.get(id);
            counted.push({
                id,
                assetId: facts.assetId ?? null,
                category: [category.id],
                job: job ? [job] : [],
                status: facts.status,
                lastEventAt: facts.lastEventAt ?? null,
            });
        }
    }
    return counted;
}

/**
 * Which assets one page of a category's list holds, in the order asked, and where that page sits.
 *
 * ONE FUNCTION FOR THE ORDER, THE SLICE AND THE CLAMP, so no call site can take a page without
 * having resolved which page it is, or cut one from rows in another order. That is
 * `readQuantity`'s shape one screen over (#338) and it is the same reason: a caller that slices
 * for itself is a caller that can slice past the end and render an empty screen for a page
 * that exists.
 *
 * IT TAKES EVERY ASSET OF THE KIND ON THE SCOPE, READ, AND HANDS BACK ONE PAGE OF THEM (#540).
 * A sort by the items' most recent change or by their printed id needs each one's
 * `Last Event At` and `Asset ID` before a page can be cut, so the page reads them all — a
 * hundred to a query, one request up to a hundred items — and draws fifty. From #339 until
 * #540 the page was cut from the kind's link array before anything was fetched and its ids alone
 * were read, whatever the kind's size. **The array is narrowed to the reader's scope first since
 * #509** (`idsInScope`), a filter on ids in hand, so what is read is the scope's. Nothing gates
 * an asset per row (#337), so every asset read is one the reader may see, and `total` is how many
 * were read.
 *
 * `sort` IS THE ORDER (`sortedAssets`): newest change first, the list's start, or by printed id.
 * Newest first was the link array turned over from #463 — creation order, so the last registered
 * first — and since #540 it is each item's latest event: a registration still begins the first
 * page, its `Created` rows being the kind's latest, and an item checked out or in rises to it.
 * **What it costs was weighed and accepted at #463**: a change pushes the rows along, so a link
 * to page 2 names different assets after one. The selection is printed ids and moves with
 * nothing.
 *
 * AN UNREADABLE PAGE IS PAGE 1 AND A PAGE PAST THE END IS THE LAST ONE. A URL is
 * typed, edited and copied, so the parameter is a request rather than a promise;
 * answering it with an empty screen would show a reader nothing and tell them
 * nothing. A category with no assets has one page, which is the empty state
 * rather than page 0 of 0.
 */
export function pageOfAssets(assets, rawPage, sort = LIST_SORTS.items.start) {
    const ordered = sortedAssets(assets, sort);
    const { page, pageCount, from, to } = pageWindow(ordered.length, rawPage);
    return { page, pageCount, total: ordered.length, from, to, assets: ordered.slice(from, to) };
}

/**
 * A kind's items in the order `sort` names (#540), one of `LIST_SORTS.items`: by printed id, day
 * then sequence as a number, the order a label run prints (`compareAssetIds`); or newest change
 * first, by `Last Event At` — an item with none first, since only a registration whose log pass
 * failed leaves one (#449) — and two items whose latest events share a moment, a registration's
 * batch among them, by printed id the other way, the last minted first. An order the list does not
 * offer is answered with its start, as `readSort` answers an address.
 */
export function sortedAssets(assets, sort) {
    const all = [...(Array.isArray(assets) ? assets : [])];
    if (readSort(sort, LIST_SORTS.items) === ASSET_SORT.ITEM_ID) return all.sort((a, b) => compareAssetIds(a?.assetId, b?.assetId));
    const newest = newestMomentFirst((asset) => asset?.lastEventAt ?? null);
    return all.sort((a, b) => newest(a, b) || compareAssetIds(b?.assetId, a?.assetId));
}

/**
 * The `Asset Log` rows a page of a category's list reads for who holds each of its assets that
 * is out (1d, #520): each such asset's latest, and nothing older.
 *
 * THE LATEST IS THE LAST OF THE ASSET'S LINK ARRAY, the order `newestFirst` reads — one
 * judgment of what a link array's order means, made in lib/assetView.js, which the asset's
 * own page draws its history by. So a page asks for one row per asset out and the read is one
 * batched query whatever the histories hold. An asset with no row — a registration whose log
 * pass failed (#449) — asks for none.
 *
 * ONLY AN ASSET OUT HAS A HOLDER, SO ONLY ITS ROW IS ASKED FOR (#540). From #520 every asset on the
 * page had its latest row read, for its moment as well; the moment is the asset's own
 * `Last Event At` since #540 (`lastChangeOf`), so a page with nothing out reads no log at all.
 */
export function holderRowIds(assets) {
    return (assets || [])
        .filter((asset) => asset?.status === ASSET_STATUS.OUT)
        .map((asset) => newestFirst(asset?.assetLog)[0])
        .filter(Boolean);
}

/**
 * What a category's list says of one asset beside its status (1d, #520): when it last
 * changed — its `Last Event At`, the latest `Asset Log` event's moment Airtable keeps on it since
 * #540, where the latest row was read for it from #520 — and, while it is out, who holds it,
 * `currentHolder`'s answer off that row. `entries` is the read `holderRowIds` asked for, by record
 * id; an asset whose row it did not return names nobody, rather than a name the asset is no
 * longer with. The moment is the one `sortedAssets` orders by, so the day each row draws and the
 * order the rows stand in cannot part.
 */
export function lastChangeOf(asset, entries) {
    const latest = entries?.get(newestFirst(asset?.assetLog)[0]) ?? null;
    return { updatedAt: asset?.lastEventAt ?? null, holder: currentHolder(latest ? [latest] : [], asset?.status) };
}

/**
 * Which categories one page of the category list holds (#463), and where that page sits —
 * the same clamp and the same `ASSET_PAGE_SIZE` as a category's own list, over rows the page has already built.
 *
 * A SLICE AND NOT A DIVIDED READ: every category's counts need every asset in the
 * reader's scope (#509), so the page reads them all whichever page it draws, and paging changes what is drawn and
 * nothing that is read. Ordered by name before it is cut (`summarizeAssetCategories`), so a page's
 * edges move only when a category is created or renamed.
 */
export function pageOfAssetCategories(rows, rawPage) {
    const all = Array.isArray(rows) ? rows : [];
    const { page, pageCount, from, to } = pageWindow(all.length, rawPage);
    return { page, pageCount, total: all.length, from, to, rows: all.slice(from, to) };
}

/**
 * What the category list filters by (1a, #520), in the order its band draws them: a row's type
 * and its category. Its class was the third until #552, and an address still naming one
 * (`class=A`) is read as naming nothing, since no facet asks for it.
 */
export const ASSET_LIST_FACETS = Object.freeze(["level1", "level2"]);

/**
 * What an address asks the category list for (#520): the text searched and each facet's
 * values, as written — `params` is a `URLSearchParams`, or anything with its `get` and
 * `getAll`, under `lib/assetRoutes.js:ASSET_LIST_PARAMS`' names. A request rather than a
 * promise, as `?page=` is: `filterAssetCategoryRows` decides what it narrows. And the order asked
 * for, `sort`, as written (#540), which `readSort` answers for the list reading it.
 */
export function readAssetListFilters(params) {
    const values = (name) => [...new Set((params?.getAll?.(name) ?? []).map(normalizeItemText).filter(Boolean))];
    return {
        q: String(params?.get?.(ASSET_LIST_PARAMS.q) ?? ""),
        sort: params?.get?.(ASSET_LIST_PARAMS.sort) ?? null,
        ...Object.fromEntries(ASSET_LIST_FACETS.map((facet) => [facet, values(ASSET_LIST_PARAMS[facet])])),
    };
}

/**
 * The category list's rows under what its band holds, each option the band offers with its
 * count, and whether anything narrows (1a, #520) — one reading, so the rows, the head's
 * `N of M` and every figure in a chip's list cannot disagree.
 *
 * A FACET OFFERS THE VALUES THE JOB'S ROWS HOLD, each once under `textMatchKey`, in the
 * spelling of the first row holding it and in `compareCatalogText`'s order: the types, the
 * categories under the types chosen — `Machining` is a category of `Equipment` and of `Tool`.
 * A value the address names that no option holds is no choice and narrows
 * nothing, so a category chosen under a type since unchosen drops out, as a job off the reader's
 * list does (`assetListScope`); the next write of the address leaves it behind.
 *
 * EACH OPTION COUNTS THE ROWS IT WOULD LEAVE ON ITS OWN: those holding it that the search and
 * every other facet admit, as 1a counts them. Several values on one facet are any of them; the
 * facets and the search compose with and.
 *
 * THE SEARCH TAKES A ROW'S NAME, ITS CATEGORY AND ITS TYPE through `lib/searchTokens.js`, the
 * app's one reading of a typed query: the names on the row, which is #325's rule for a list's
 * box (`lib/listFilters.js`), and the type, which the design's box reaches though the row does
 * not say it. Every word typed must be in one of them, so `drill dewalt` finds the drill by two.
 *
 * `offers` ARE VALUES A FACET OFFERS THOUGH NO ROW HOLDS THEM (#527): rows of the same shape that
 * are never rows — the catalog's page hands it every group, so a category with nothing filed
 * under it yet is still one to narrow to, at a count of none, and the type's whole vocabulary.
 * A category offered this way stands under its own type as a row's does.
 *
 * `jobs` ARE THE JOBS THE `Job` CHIP MAY OFFER (#548), `{ id, jobCode }` in the choice's order,
 * handed over only while the list stands on all jobs — on one job, or on the
 * catalog's page, there are none and the chip narrows nothing. It offers those a row has an
 * asset on, as a facet offers the values its rows hold, and is held by Job record id, the
 * address's value for a job (`filters.jobs`); an id it does not offer narrows nothing, as a type
 * no row holds does. A row is admitted when it has an asset on any job taken, and a narrowed
 * row's counts are its counts on those jobs added up (`perJob`), so the head, the rows and the
 * chips' figures are those jobs' alone. Each job counts the rows it would leave on its own, as a
 * facet's value does. `jobOptions` is the chip's list and `held.jobs` what it holds.
 *
 * A SEARCH THAT IS AN ITEM'S ID FINDS THAT ITEM (#541), and searches no name. The id whole or its
 * label's code is one (`lib/assetRoutes.js:searchedAssetId`), and anything shorter is searched in
 * the names as before. A row is admitted when one of the assets it counts carries the id
 * (`assetIds`, `summarizeAssetCategories`) on a job the `Job` chip holds, or on any job the list
 * stands on while it holds none — so the id is found inside what the list shows and nowhere
 * else, and each job's option counts the row only where the item is on that job. The chips
 * narrow it as they narrow a name. `found` is the item when its row is left, `{ assetId,
 * status, itemName }`, which the list draws as the way to it; `byId` says the search was an id.
 */
export function filterAssetCategoryRows(rows, filters = {}, { offers = [], jobs = [] } = {}) {
    const all = Array.isArray(rows) ? rows : [];
    const assetId = searchedAssetId(filters.q);
    const tokens = assetId ? [] : searchTokens(filters.q ?? "");
    // The row's asset carrying the id, on one of `onJobs` or on any job when there are none.
    const carrying = (row, onJobs) => {
        for (const [job, byStatus] of Object.entries(row.assetIds ?? {})) {
            if (onJobs.length > 0 && !onJobs.includes(job)) continue;
            for (const [status, printedIds] of Object.entries(byStatus)) if (printedIds.includes(assetId)) return { assetId, job, status };
        }
        return null;
    };
    const searched = (row, onJobs) =>
        assetId ? carrying(row, onJobs) !== null : tokens.length === 0 || matchesTokens([row.itemName, row.level2, row.level1].join(" "), tokens);
    const offeredJobs = (jobs ?? []).filter((job) => all.some((row) => row.perJob?.[job.id]));
    const askedJobs = new Set(filters.jobs ?? []);
    const chosenJobs = offeredJobs.filter((job) => askedJobs.has(job.id)).map((job) => job.id);
    const onChosenJobs = (row) => chosenJobs.some((id) => row.perJob?.[id]);
    const offered = {};
    const chosen = {};
    for (const facet of ASSET_LIST_FACETS) {
        // The categories offered are those under the types chosen, which are decided first.
        const within = [...all, ...offers];
        const pool = facet === "level2" && chosen.level1.size > 0 ? within.filter((row) => chosen.level1.has(textMatchKey(row.level1))) : within;
        const values = new Map();
        for (const row of pool) {
            const key = textMatchKey(row[facet]);
            if (key && !values.has(key)) values.set(key, normalizeItemText(row[facet]));
        }
        offered[facet] = [...values].map(([key, value]) => ({ key, value })).sort((a, b) => compareCatalogText(a.value, b.value));
        const asked = new Set((filters[facet] ?? []).map(textMatchKey));
        chosen[facet] = new Set(offered[facet].filter(({ key }) => asked.has(key)).map(({ key }) => key));
    }
    // `onJobs` are the jobs an id is found on: those the chip holds, or one job's own option.
    const admits = (row, except = null, onJobs = chosenJobs) =>
        searched(row, onJobs) &&
        (except === "jobs" || chosenJobs.length === 0 || onChosenJobs(row)) &&
        ASSET_LIST_FACETS.every((facet) => facet === except || chosen[facet].size === 0 || chosen[facet].has(textMatchKey(row[facet])));
    const chosenOn = (facet) => offered[facet].filter(({ key }) => chosen[facet].has(key)).map(({ value }) => value);
    // A row narrowed to some jobs counts its assets on those alone (#548).
    const countedOn = (row) =>
        chosenJobs.length === 0
            ? row
            : {
                  ...row,
                  counts: row.counts.map((entry, index) => ({
                      status: entry.status,
                      count: chosenJobs.reduce((sum, id) => sum + (row.perJob?.[id]?.[index] ?? 0), 0),
                  })),
              };
    const admitted = all.filter((row) => admits(row));
    const foundOn = assetId ? admitted.find((row) => carrying(row, chosenJobs)) : null;
    const foundAsset = foundOn ? carrying(foundOn, chosenJobs) : null;
    return {
        rows: admitted.map(countedOn),
        found: foundAsset ? { assetId: foundAsset.assetId, status: foundAsset.status, itemName: foundOn.itemName } : null,
        jobOptions: offeredJobs.map((job) => ({
            value: job.id,
            label: job.jobCode,
            chosen: chosenJobs.includes(job.id),
            count: all.filter((row) => row.perJob?.[job.id] && admits(row, "jobs", [job.id])).length,
        })),
        facets: Object.fromEntries(
            ASSET_LIST_FACETS.map((facet) => [
                facet,
                offered[facet].map(({ key, value }) => ({
                    value,
                    chosen: chosen[facet].has(key),
                    count: all.filter((row) => textMatchKey(row[facet]) === key && admits(row, facet)).length,
                })),
            ])
        ),
        // What the band holds once read: the values chosen, in their spelling and the band's
        // order, which is what the next write of the address carries.
        held: { q: filters.q ?? "", ...Object.fromEntries(ASSET_LIST_FACETS.map((facet) => [facet, chosenOn(facet)])), jobs: chosenJobs },
        searching: tokens.length > 0 || assetId !== null,
        byId: assetId !== null,
        narrowed: tokens.length > 0 || assetId !== null || chosenJobs.length > 0 || ASSET_LIST_FACETS.some((facet) => chosen[facet].size > 0),
    };
}

/**
 * What one view of the category list holds (#520, #548, #553): `filterAssetCategoryRows` over
 * `rows`, asked what the address asks — the search and the chips through `readAssetListFilters`,
 * and the `Job` chip's jobs, which ride as more `job` values and count only while the list stands
 * on all jobs. `jobs` are the jobs that chip may offer, `{ id, jobCode }`, and `q`
 * the search as typed when the caller holds it ahead of the address, as the list does.
 *
 * THE LIST AND ITS EXPORT BOTH READ THIS, SO THE FILE IS WHAT THE LIST SHOWS (#553). The list
 * draws it in the browser over the address it is showing; the export answers it on the server
 * over that same address, sent with the press, and writes `rows` and the assets under them. A
 * change to what the band narrows by, made here or in what it calls, reaches both: #541's ids
 * did, so a file pressed on an item's id holds that item's row and every asset under it, and
 * #540's order would.
 *
 * EACH ROW'S `total` IS ADDED HERE, AND NOWHERE ELSE (#569): its counts in the statuses
 * `countedInTotal` holds — `In stock`, `Out` and `In repair` — added up once the `Job` chip has
 * narrowed them, so on all jobs it is the jobs the chip takes, as the four are.
 * The list draws it as 1a's last column and the export writes it as the first sheet's, both
 * off this one reading, so the two cannot part. The catalog's page reads
 * `filterAssetCategoryRows` itself and its rows count no status, so they carry none.
 *
 * AND SO ARE ITS `updatedAt` AND THE ORDER (#540). A row's `updatedAt` is the latest event among
 * the kind's items on what the list stands on — one job, all of a reader's, or the jobs the `Job`
 * chip takes, read off `lastEventOnJob` as the total is off `perJob` — and the address's `sort`
 * (`readSort` over `LIST_SORTS.kinds`) orders the rows by it, newest first, or leaves them in
 * `summarizeAssetCategories`' order by name, which also breaks a tie. Here and not in a component,
 * so the list's pages and the export's first sheet are one order; `held.sort` is what the next
 * write of the address carries.
 */
export function readCategoryList(rows, params, { allJobs = false, jobs = [], q } = {}) {
    const asked = readAssetListFilters(params);
    const reading = filterAssetCategoryRows(
        rows,
        { ...asked, ...(q === undefined ? {} : { q }), jobs: allJobs ? (params?.getAll?.("job") ?? []) : [] },
        { jobs: allJobs ? (jobs ?? []) : [] }
    );
    const sort = readSort(asked.sort, LIST_SORTS.kinds);
    const chosenJobs = reading.held.jobs;
    const read = reading.rows.map((row) => ({
        ...row,
        total: row.counts.reduce((sum, entry) => sum + (countedInTotal(entry.status) ? entry.count : 0), 0),
        updatedAt:
            chosenJobs.length === 0
                ? (row.lastEventAt ?? null)
                : (chosenJobs.reduce((at, id) => laterMoment(at, row.lastEventOnJob?.[id]), undefined) ?? null),
    }));
    return {
        ...reading,
        rows: sort === ASSET_SORT.UPDATED ? read.sort(newestMomentFirst((row) => row.updatedAt)) : read,
        held: { ...reading.held, sort },
    };
}

/**
 * What a list the band has emptied says, and what its one control is called (1a, #520): the
 * sentence names what was typed when anything was, and the control clears the search alone when
 * the search is all that narrows, and everything otherwise — the `Job` chip a chip like the
 * others (#548).
 *
 * AN ID NOBODY'S ITEM CARRIES SAYS SO (1a, #541), and on one job names the job: the list finds an
 * item on the job it stands on and nowhere else, so `No item has the ID` there would deny an item
 * on another job. `jobCode` is the job the list stands on, or null on all of them,
 * where the sentence is the drawing's. Chips that leave the item's row off say it too, as drawn.
 */
export function emptiedListWords({ searching, byId = false, held }, { jobCode = null } = {}) {
    const clearsAll =
        !searching || (held?.jobs ?? []).length > 0 || ASSET_LIST_FACETS.some((facet) => (held?.[facet] ?? []).length > 0);
    return {
        sentence: byId
            ? jobCode
                ? ASSET_LIST_COPY.noIdMatchOn(jobCode)
                : ASSET_LIST_COPY.noIdMatch
            : searching
              ? ASSET_LIST_COPY.noneMatch
              : ASSET_LIST_COPY.noneMatchFilters,
        typed: searching ? normalizeItemText(held?.q) : null,
        clearsAll,
        clear: clearsAll ? ASSET_LIST_COPY.clearAll : ASSET_LIST_COPY.clearSearch,
    };
}

/**
 * Where page `rawPage` of `total` rows starts and ends, the clamp both lists share: an
 * unreadable page is page 1, one past the end the last, and no rows is one page.
 */
function pageWindow(total, rawPage) {
    const pageCount = Math.max(1, Math.ceil(total / ASSET_PAGE_SIZE));
    const asked = /^\d+$/.test(String(rawPage ?? "").trim()) ? Number(rawPage) : 1;
    const page = Math.min(Math.max(asked, 1), pageCount);
    const from = (page - 1) * ASSET_PAGE_SIZE;
    return { page, pageCount, from, to: Math.min(from + ASSET_PAGE_SIZE, total) };
}

// `pageHolding` was here from #449 to #463: the page holding the first asset a
// registration wrote, found from the length the tool's link array had before the batch.
// The list reads newest first since #463 — by each item's latest event since #540, which a
// registration's `Created` rows are — so what a registration wrote begins it and the action
// lands on the first page with nothing to work out.

/**
 * The selection in ascending `Asset ID`, which is the order a label run prints in.
 *
 * THE SELECTION IS A LIST OF PRINTED IDS AND NOTHING ELSE (#443). It rides in the
 * address as `id`, the parameter `/tool-items/labels` took until #457, so the print
 * control opens the labels' dialog on exactly what is selected and the labels print in
 * the address's order. `lib/assetRoutes.js` reads it off the address
 * (`readAssetIds`) and writes it back (`assetCategoryPath`); the functions below are what a
 * press makes of it in between.
 *
 * KEPT IN ONE ORDER RATHER THAN THE ORDER IT WAS MADE IN, WHICH A BROWSER DECIDED. In
 * the order it was made in, selecting three and then the page put those three at the
 * head of the sheet and the other nine after them — so a person matching stickers to
 * the tools down the list met them out of order. In this order the labels come off the
 * printer as their numbers count up (one to a page since #467), and one selection is
 * one address whatever order its boxes were pressed in.
 *
 * IT WAS THE LIST'S ORDER UNTIL #463, AND IT DID NOT TURN WITH THE LIST. The list reads
 * newest first since then, and the selection, held by printed id, was left as it was —
 * so a person working down the list meets a run's stickers the other way round. A
 * registration lands with its ids in minted order, which is this one, so its run reads
 * the same before a press and after it. **A list sorted by `Item ID` reads this order (#540)**,
 * through `compareAssetIds` below, so there the list and its run agree.
 */
function inIdOrder(selection) {
    return [...selection].sort(compareAssetIds);
}

/**
 * Two printed ids in the order a label run prints them, and a kind's page sorted by `Item ID`
 * stands in (#540).
 *
 * BY THE ID'S DAY AND THEN ITS SEQUENCE AS A NUMBER, NEVER AS A STRING. `nextSequence`
 * widens past the pad, so a day's thousandth asset is `-1000` and sorts as text
 * ahead of `-999`; `lib/idSequence.js:sequenceOf` is the one reading of a sequence and
 * #40 orders quotations through it for the same reason. The day sorts as text because
 * its stamp is fixed-width. A string that is no asset's id goes after every id
 * that is one, in the order it came.
 */
function compareAssetIds(a, b) {
    const keyOf = (assetId) => {
        const text = String(assetId ?? "");
        const prefix = text.slice(0, text.lastIndexOf("-"));
        return { prefix, sequence: sequenceOf(text, prefix) };
    };
    const left = keyOf(a);
    const right = keyOf(b);
    if (left.sequence === null || right.sequence === null) return Number(left.sequence === null) - Number(right.sequence === null);
    if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
    return left.sequence - right.sequence;
}

/** What one press on one entry's box makes of the selection: it adds the asset, or takes it out. */
export function toggleAsset(selection, assetId) {
    return inIdOrder(
        selection.includes(assetId)
            ? selection.filter((selected) => selected !== assetId)
            : [...selection, assetId]
    );
}

/**
 * How much of this page is selected — `none`, `some` or `all` of its entries.
 *
 * THIS PAGE'S OWN ANSWER, WHATEVER IS SELECTED ON ANOTHER. A selection outlives a
 * page turn, so what is selected elsewhere is not this page's to show: the page box
 * answers for the entries in front of the reader, and the sentence beside the print
 * control is what counts the rest. A page with no entries has nothing selected.
 */
export function pageSelection(selection, pageAssetIds) {
    const here = pageAssetIds.filter((assetId) => selection.includes(assetId)).length;
    if (here === 0) return "none";
    return here === pageAssetIds.length ? "all" : "some";
}

/**
 * What a press of the page box makes of the selection: the rest of this page added,
 * or — when all of it is selected already — this page taken out.
 *
 * IT REACHES THIS PAGE AND NO FURTHER. The screen hands the list its page's rows alone
 * (`pageOfAssets` above), so the printed ids of the others are not in the browser. Until #540
 * they were unknown without reading them, the read the paging divided; since then the page
 * reads every item of the kind on the scope to sort them, and still hands the list one page, so
 * what one press reaches is unchanged and `docs/briefs/asset-categories-categoryRecordId.md`
 * still bars printing all of a category. What is selected on other pages is kept either way.
 *
 * A PARTLY SELECTED PAGE IS COMPLETED RATHER THAN CLEARED, which is what a box in
 * the mixed state does everywhere else.
 */
export function togglePage(selection, pageAssetIds) {
    if (pageSelection(selection, pageAssetIds) === "all")
        return inIdOrder(selection.filter((assetId) => !pageAssetIds.includes(assetId)));
    return inIdOrder([...selection, ...pageAssetIds.filter((assetId) => !selection.includes(assetId))]);
}

/**
 * What the selection bar says, and whether its print control acts (0b's Selection bar).
 *
 * NOTHING SELECTED DRAWS NO BAR (#463), where until then a sentence and a control that
 * did not act stood over the list: 0b floats the bar while any row is selected and draws
 * nothing otherwise. What the boxes are for is said by the bar the first press brings.
 * **It still never prints "the page"**: the control sent the page it was on until #443,
 * and the page is one press of the page box away, which that press shows.
 *
 * A SELECTION LARGER THAN ONE PRINT DOES NOT PRINT. One print takes
 * `MAX_LABELS_PER_REQUEST`, and the labels' read refuses a longer run outright (#457), so
 * the control refusing first, with why before it (0f Disabled), is what keeps a press from
 * reaching it. It needs a category with more assets than one print takes, selected across
 * pages. 0b draws the bar since the design's final files: the control follows Disabled (0f)
 * and the reason names the limit (#495).
 *
 * THE COUNT IS THE ADDRESS'S, AND NOTHING WAS READ FOR IT. Every selected id is in the
 * address and this page's are in the rows already drawn, so the count and how many are
 * not on this page cost no operation. An id not on this page is not checked against
 * the base, because checking it is a read; the labels' read makes that read anyway
 * and names any id it cannot find.
 */
export function describeSelection(selection, pageAssetIds) {
    const count = selection.length;
    const notOnPage = selection.filter((assetId) => !pageAssetIds.includes(assetId)).length;
    if (count > MAX_LABELS_PER_REQUEST) {
        return { count, notOnPage, printable: false, reason: ASSET_LIST_COPY.printCap(MAX_LABELS_PER_REQUEST) };
    }
    return { count, notOnPage, printable: count > 0, reason: null };
}

/**
 * The page's position under a list, or null when it holds one page (0b Pager, #519): `Page 1
 * of 1` and two steps that cannot act told the reader nothing, and the files draw the count
 * alone there. Both lists' pagers ask this, so they cannot answer differently.
 */
export function pagerPosition(page) {
    return page.pageCount > 1 ? ASSET_LIST_COPY.pagePosition(page) : null;
}

// `toolPagePath` was here until #348 and is `lib/assetRoutes.js:assetCategoryPath` now,
// with every other address on the axis. What stays here is the paging RULE —
// which rows a page holds and which page a parameter resolves to; where that
// page lives is an address, and this issue's whole point is that the axis's
// addresses are in one file so the next move is one edit.

// The two column heads an order is named for too (#540): one word each, read below by the head
// and by the sort control.
const NAME_WORD = "Name";
const ITEM_ID_WORD = "Item ID";

/**
 * Every word the two list screens render.
 *
 * THE CATEGORY'S PAGE HAS NO HEADING WORD — its heading is the category's name, which is
 * the shape the asset's page already takes with its printed id and the four
 * document detail screens take with theirs.
 */
export const ASSET_LIST_COPY = {
    // The axis's name on screen (#513): what the site calls the things the office calls
    // assets, and so not a table's name — those are `Asset Categories` and `Assets`
    // (docs/notes/naming.md). Everything that names the axis reads it: this list's heading
    // and its tab title, the rail, the breadcrumb, and the link on `/` that leads here. It
    // was written into this page's JSX until #339, and was the `Tools` table's name until
    // #513. **`Equipment & Tools` since #591, the app's word**: it said `Tools & Equipment`
    // from #513, which the design's files still say (docs/briefs/design-copy-findings.md).
    heading: "Equipment & Tools",

    // THE NAME COLUMN'S HEAD, `Name` (1a) — the design's since #519, where it was `Tool`, a
    // label this list borrowed from the asset's page. It heads the whole name a category
    // carries, its size, maker and part number in it, so it is the list's own word and not
    // the registration's `Name` level, which is `Level 3` alone (`ASSET_CATEGORY_COPY`).
    nameLabel: NAME_WORD,
    // THE LAST COLUMN'S HEAD, `Total` (1a, #569) — the design's: how many of a kind the
    // company still holds, every count before it but `Retired`'s (`readCategoryList`). The
    // export's first sheet heads its last column with it too.
    totalLabel: "Total",
    // The two field labels the asset's page already has, named here so a screen reads one
    // constant rather than two: they head the two columns beside an asset's id.
    statusLabel: ASSET_COPY.statusLabel,
    jobLabel: ASSET_COPY.jobLabel,
    backToTools: ASSET_COPY.backToTools,

    // The column over an asset's printed id: `Item ID`, the design's since #519 (1d). It
    // was `Tool ID` from #463 and `Item` from #455; the screens say `item` for what a list
    // shows and for each labeled one alike since #519, and the column names the code each
    // one carries.
    assetIdLabel: ITEM_ID_WORD,
    // The column over when each item last changed (1d, #520): its latest log row's day, in
    // the place the job's column stood from #463.
    updatedLabel: "Updated",
    // The column over each item's note (1d, #533), between its status and that day: the field
    // label the asset's page writes it under, one word for one fact.
    noteLabel: ASSET_NOTE_COPY.label,

    // THE BAND OVER THE CATEGORY LIST (1a, #520): the search, which says what it searches
    // (0h), and a chip per facet, each the catalog's own word for its level — the
    // registration's `Type` and `Category` — named, with its value or how many it holds, and
    // cleared by a control saying which. The search says it takes an item's id as well since #541,
    // the drawing's words; the registration's has said its own since #547.
    searchLabel: "Search items or item IDs",
    clearSearch: ASSET_CATEGORY_COPY.clearSearch,
    facetLabel: {
        level1: ASSET_CATEGORY_COPY.levelLabel.level1,
        level2: ASSET_CATEGORY_COPY.levelLabel.level2,
    },
    clearFacet: ASSET_CATEGORY_COPY.clearFilter,
    // The `Job` chip's × (1a, #548), drawn while the list stands on all jobs. The
    // chip itself says the asset's page's `Job`, and the jobs by their codes.
    clearJobs: "Clear job filter",
    // THE SORT CONTROL (1a, 1d, 1l, #540): its name, heard and not seen, and what each order is
    // called, the drawings' — the column heads' own words for the name and the printed id, since
    // the order is that column's, and `Recently updated` for the most recent change.
    sortLabel: "Sort",
    sortNames: {
        [ASSET_SORT.NAME]: NAME_WORD,
        [ASSET_SORT.UPDATED]: "Recently updated",
        [ASSET_SORT.ITEM_ID]: ITEM_ID_WORD,
    },
    // What a list the band has emptied says: what was typed after the first, set apart in the
    // id's face (1a), and the second when only chips narrow. One control under either.
    noneMatch: "No items match",
    noneMatchFilters: "No items match these filters",
    clearAll: "Clear all",
    // What a search for an id no item in the list carries says, the id after it as what was
    // typed is (1a, #541): the drawing's on all jobs, and on one job the job it
    // looked on, which the drawing does not say (docs/briefs/design-copy-findings.md).
    noIdMatch: "No item has the ID",
    noIdMatchOn: (jobCode) => `No item on ${jobCode} has the ID`,

    // THE LIST'S EMPTY STATE, a heading and a sentence under it (1a), for a list that starts
    // from nothing. The shared brief's three are "nothing exists yet", "nothing you can see"
    // and "nothing matching your filters"; since #509 a list stands on a job,
    // so a job with no assets on it meets this too, and a job chosen with none
    // on it is the third, which draws nothing under the head, whose `0 of M` says it. The
    // sentence says what the list is for, and the opener under it is how a category gets onto
    // it — a kind of the catalog with its first items under it, since #507.
    noItemsHeading: "No items yet",
    // It names every status the row counts, `in repair` since #531 — where the files of
    // 2026-10-15 still say `in stock, out and retired` over four columns; #531 took the columns.
    noItems: "Each item shows here with how many are in stock, out, in repair and retired.",
    // THE SAME TWO LISTS FOR A READER WHO ADDS NOTHING (#519, 1a2, 1d) — the design's words. A
    // reader who is not a site manager is told who fills the list, on both lists, where the
    // sentence above says what the list is for and the opener under it is how; a site manager on
    // a category's page with nothing under it is told it fills when they add. **1a2's reader on no
    // job, `No job yet` and `Items show here once the office assigns you to a job.`, went with
    // #593**: a reader assigned to none stands on all jobs, which holds every site's items.
    untilASiteManagerAdds: "Items show here once a site manager adds them.",
    untilYouAdd: "Items show here once you add them.",

    // A kind with nothing under it (1d). A catalog row nobody has bought yet since #507,
    // which the lists leave off and an address still reaches; until then it was a
    // registration that stopped between its two writes, and a sentence under the heading
    // told whoever was adding so — `If you were adding some, it stopped before any were
    // saved.`, which went with the premise. Said as what is so rather than as an error, in
    // the design's words since #519, where it was `No items under this tool`.
    noAssetsHeading: "Nothing added yet",

    // How many rows the list holds, which #326 names as the fact every list in
    // this app is missing: without it nothing on screen says whether a reader is
    // looking at everything or at the beginning of it. It is free here — the
    // parent's link array carries the length — and it is a fact about the LIST
    // rather than about what the company holds, which a row's `Total` says since #569
    // (`totalLabel`); the two are different counts. `items` was the design's word
    // until the files of 2026-10-07, which draw the figure alone (0n, 1a, 1d); the head
    // still speaks each list's own noun after it to assistive tech (#505), since a figure
    // straight after a heading names nothing — `items` on both since #519, where the
    // category list said `tools`. `total` is the two as one string, for a sentence.
    itemNoun: (n) => (n === 1 ? "item" : "items"),
    total: (n) => `${n} ${ASSET_LIST_COPY.itemNoun(n)}`,
    // The pager under either list (1a, 1d): which rows this page shows of how many, and
    // which page of how many, with a step each way that a page at its end draws and
    // does not act. The steps are icons, and these are their names. 0b's since #519: the
    // count is the one figure where a page shows a single row, `1 of 1`, and the page and its
    // steps stand only past one page (`pagerPosition`).
    range: ({ from, to, total }) => (from === to ? `${from} of ${total}` : `${from}–${to} of ${total}`),
    pagePosition: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
    previous: "Previous page",
    next: "Next page",

    // THE SELECTION'S WORDS (#443), AND NONE OF THEM NAMES WHAT IS SELECTED — the way
    // the document lists' pickers say `N selected` (#324). #455 settled the word,
    // `tool` in a sentence and `item` on this page, and #519 made it `item` in both; neither
    // had anything here to undo.
    //
    // The page box's name, Design's (`docs/notes/design-system.md`, answer 3), which
    // still says it reaches this page and not the category.
    selectPage: "Select this page",
    // An entry's box, named for the id beside it — an accessible name rather than a
    // second visible copy of the id the row already shows.
    selectAsset: (assetId) => `Select ${assetId}`,
    // The selection bar (0b): its name, the count, and the second clause after a dot,
    // which comes only while other pages hold part of the selection, since it is what
    // reconciles the count with a page whose boxes show fewer.
    selectionBar: "Selected items",
    selectedCount: (count) => `${count} selected`,
    notOnPage: (count) => `${count} not on this page`,
    // Before a print control that does not act on a selection one print cannot take — the
    // design's since #495 (0b, 1d), which names the limit in the noun the dialog counts in.
    printCap: (cap) => `Up to ${cap} labels per print.`,
    // Every page's selection at once — the bar's clear and its tooltip. The page box
    // already clears one page, so this is the way out of a selection made on pages the
    // reader is no longer on.
    clearSelection: "Clear selection",

    // The same shape every other detail screen uses for a record it cannot find,
    // and here there is one way to reach it: no category carries this record id.
    // Nothing on this axis is gated per record — a job narrows a list and gates no
    // page (#509) — so unlike the request, order and invoice screens this refusal
    // answers one state rather than standing in for two. The design's `item` since #519.
    notFoundHeading: "Item not found",
};
