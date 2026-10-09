// What the two asset list screens show (#339) — `/asset-categories`, which is every
// category with a count per status, by name, and `/asset-categories/[categoryRecordId]`,
// which is one category's assets a page at a time, newest first since #463, and which of
// them a label run is for (#443) — and since #509 which jobs' assets either holds.
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
// HERE. `Tool`, `Status` and `Job` name the same three fields the asset's own
// page names, and `← Tools` is the same way back; a second copy of any of them is
// a second word for one fact the first time somebody rewords one. What is below
// is only what these two screens say and that one does not.
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

import { ASSET_STATUS_VALUES } from "./assetStatus.js";
import { ASSET_COPY, newestFirst } from "./assetView.js";
import { MAX_LABELS_PER_REQUEST } from "./assetLabelPage.js";
import { sequenceOf } from "./idSequence.js";
import { assignedJobsFor } from "./assetJob.js";
import { compareCatalogText } from "./assetCategory.js";

/**
 * Which assets a reader's asset lists hold, and which jobs they may narrow to (#509).
 *
 * `jobs` is `getAllJobs`' answer, each carrying `Jobs."Assets"` — the reverse link of
 * `Assets."Job"`, which is where an asset IS now (a check-out or check-in on another
 * job moves it). So a scope is a set of asset record ids taken off those arrays before
 * any asset is read, and both lists cut their reads from it.
 *
 * WHERE A READER STARTS. The office — `Is Admin`, whatever else the person is, an
 * assignment included — starts from every asset and may narrow to any job. Anybody
 * else starts from every asset on the jobs they are assigned to, together, and may
 * narrow to one of those. `jobs` in the answer is that list of jobs, a job with no assets
 * on it included, since the reader may ask what is on it and be told nothing.
 * **The office's flag is read here and nowhere else on this axis**, and only to decide what
 * a list starts from: what a reader may RECORD is `isSiteManager`'s, and
 * `offline/site-manager.mjs` holds this as the one read it admits. The President is not the
 * office here unless marked so — this follows `Is Admin` alone, where
 * `lib/deliveryAccess.js` admits both.
 *
 * `start` AND `shown` ARE A SET OF RECORD IDS, OR `null` FOR EVERY ASSET. `start` is
 * what the reader started from, the `M` a narrowed list's count is out of; `shown` is what
 * the list holds now. `null` is the office's unnarrowed list and only that. **A category with no
 * asset in the scope is left off every list (`assetCategoriesInScope`), the office's unnarrowed
 * one included, since #507.** Until then `null` was every tool, one with nothing under it
 * included, because a registration that stopped before writing any left one and the office
 * was who put it right; a registration picks a kind of the catalog now and creates none, so
 * a kind with nothing under it is a catalog row nobody has bought yet, which the list is not
 * for.
 *
 * THE JOB ASKED FOR IS A REQUEST RATHER THAN A PROMISE, as `?page=` is. One the reader may
 * narrow to is chosen; any other string — a job outside their scope, one that does not
 * exist, a repeated parameter — is answered with the whole scope, and the two are answered
 * alike, so a list never says whether a job it did not offer exists. The address is not
 * rewritten: the control shows its first option, and the reader's next choice replaces it.
 *
 * THE WORDS ARE THE DOCUMENT LISTS' AND NOT THIS MODULE'S. The choice's `All jobs` and the
 * head's `N of M` say what `lib/listFilters.js` says for the same narrowing, and the pages
 * and `app/(assets)/JobChoice.js` read them there: this module may not import that one,
 * which declares `LIST_PAGE_SIZE` (`offline/asset-list-view.mjs`), and
 * `offline/list-filters.mjs` holds those words to that module.
 *
 * NOTHING HERE GATES AN ASSET. An asset outside the scope is left off the lists and
 * still opens from its label or a link (#337): the scope is what a reader is shown first,
 * not what they may see.
 */
export function assetListScope(user, jobs, rawJobId) {
    const all = Array.isArray(jobs) ? jobs : [];
    const office = user?.isAdmin === true;
    const listed = office ? all : assignedJobsFor(user, all);
    const job = typeof rawJobId === "string" ? (listed.find((each) => each.id === rawJobId) ?? null) : null;
    const itemsOn = (some) => new Set(some.flatMap((each) => each.assets || []));
    const start = office ? null : itemsOn(listed);
    return { jobs: listed, job, start, shown: job ? itemsOn([job]) : start };
}

/** The ids of `ids` a scope holds, in their own order — all of them for `null`. */
export function idsInScope(ids, scope) {
    const all = Array.isArray(ids) ? ids : [];
    return scope === null ? all : all.filter((id) => scope.has(id));
}

/**
 * The categories a scope reaches: those with at least one asset in it — for `null`, the
 * office's unnarrowed list, with at least one at all (#507). A category's `Assets` link
 * array is what is asked, so this costs no read.
 */
export function assetCategoriesInScope(categories, scope) {
    const all = Array.isArray(categories) ? categories : [];
    return all.filter((category) => idsInScope(category.assets, scope).length > 0);
}

/**
 * How many rows one page of an asset list holds: a category's assets, and since #463
 * the categories themselves, which 0b pages at the same 25 (`Page of rows`).
 *
 * THE FIRST PAGING IN THIS APP (#339). #326 took its shape for the document lists —
 * the page number in the URL, a screen that says which page it is — and could not
 * take the half that divides the read, which `pageOfAssets` says why. The category list
 * divides no read either: it counts every asset in scope to draw any page
 * (`summarizeAssetCategories`), so its pages are a slice of rows already in hand
 * (`pageOfAssetCategories`).
 *
 * TWENTY-FIVE, THE DESIGN'S FIGURE FOR THE LIST AS IT DREW IT (#442). It was ten
 * until then: an estimate of a screenful of three short facts at 375px, made before
 * any screen was drawn and recorded as the one number on this axis with nothing
 * behind it. The design's figure is not a measurement either — nobody has held this
 * list with a real warehouse in it — and it is the design's to move again when the
 * list is drawn again, which is why docs/briefs/asset-categories-categoryRecordId.md states it.
 *
 * WHAT IS NOT THE DESIGN'S IS THE CEILING, AND THERE ARE TWO. The read: any size up
 * to 50 costs exactly one `findChildRecords` query, which is what keeps the screen at
 * four operations, and a fifty-first row is a second query. The print: the page box
 * selects the assets on the page it is showing (#443), so this is also how many
 * one press of it adds to a run, and the print control acts only on a run of at most
 * `MAX_LABELS_PER_REQUEST` — so a page larger than that is a page box whose first
 * press leaves the print control refusing. Until #443 the print control sent the
 * page itself, and the order between the two figures held for that reason instead.
 * `offline/asset-list-view.mjs` holds the size under both.
 *
 * IT IS NOT `LIST_PAGE_SIZE`, AND SINCE #442 THE TWO ARE BOTH 25 — WHICH IS THE
 * STRONGEST REASON NOT TO FOLD THEM RATHER THAN A REASON TO. This list's row is three
 * short facts and a press of its page box selects the page for a label run; the
 * document lists filter, search and page rows a gate admitted. This said the list was
 * read at a phone width (#336), which stopped being true when its brief made it a
 * desk's; corrected per #181. Each figure was set for its own list, and the two landing on one
 * number is two decisions agreeing today. Folding them makes a design change to
 * either move the other. **The one way they become one number is a design decision
 * that they are one reader's page**, taken where #258 names the design's values,
 * with this paragraph and the one on `LIST_PAGE_SIZE` changed in the same commit —
 * the check fails a fold made any other way. `/materials` has a 25 of its own too,
 * and that is a bound on what a search asks the base for rather than a page at all.
 */
export const ASSET_PAGE_SIZE = 25;

/**
 * Every category with its count per status, in the order the list renders them.
 *
 * `categories` is the categories the reader's scope reaches (`assetCategoriesInScope`)
 * and `assets` is every asset of theirs in that scope, read in one batch — which is the
 * arrangement `getAllAssetCategories` and `getAssetsByRecordIds` were written for and the
 * reason `Asset Categories` carries no per-status rollup. docs/notes/tools.md has the
 * operation count and the size at which the rollup becomes the cheaper answer.
 *
 * ALL THREE STATUSES ON EVERY ROW, A ZERO INCLUDED. A count of nothing is a
 * measurement and the app already spells it apart from no measurement at all —
 * an absent `Out` would read as "not known" where `0` reads as "none out". It is
 * also what makes a new status impossible to add silently: the row is built from
 * `ASSET_STATUS_VALUES`, so a fourth value appears here without anyone editing
 * this function, and the check asserts the two agree.
 *
 * NO TOTAL PER CATEGORY, and the reason is `Retired` rather than the issue's wording.
 * A single figure would have to count a retired asset or not count it, and both
 * readings are wanted — what the company holds, and what it has ever bought. The
 * three counts answer both without choosing.
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
 * EACH ROW CARRIES ITS KIND'S CLASS, TYPE AND CATEGORY (#507, #514), off the row
 * `getAllAssetCategories` already read, so the three columns cost nothing. Each keeps its
 * level's name, `level1` the type and `level2` the category, as `lib/assetCategory.js` does.
 *
 * AN ASSET THAT DID NOT RESOLVE IS COUNTED NOWHERE. `findByRecordIds` returns
 * fewer rows rather than throwing, which its own doc warns about; no path in this
 * app produces a link that does not resolve, and the alternative — throwing —
 * would take the whole list down over one row.
 */
export function summarizeAssetCategories(categories, assets) {
    const counts = new Map();
    for (const item of assets || []) {
        const categoryRecordId = item?.category?.[0];
        if (!categoryRecordId) continue;
        if (!counts.has(categoryRecordId)) counts.set(categoryRecordId, new Map());
        const perStatus = counts.get(categoryRecordId);
        perStatus.set(item.status, (perStatus.get(item.status) || 0) + 1);
    }

    return (categories || [])
        .map((category) => ({
            id: category.id,
            itemName: category.itemName,
            assetClass: category.assetClass ?? "",
            level1: category.level1 ?? "",
            level2: category.level2 ?? "",
            counts: ASSET_STATUS_VALUES.map((status) => ({
                status,
                count: counts.get(category.id)?.get(status) || 0,
            })),
        }))
        .sort(
            (a, b) =>
                compareCatalogText(a.itemName, b.itemName) || compareCatalogText(a.level2, b.level2) || compareCatalogText(a.level1, b.level1)
        );
}

/**
 * Which assets one page of a category's list holds, and where that page sits.
 *
 * ONE FUNCTION FOR THE SLICE AND THE CLAMP, so no call site can take a page
 * without having resolved which page it is. That is `readQuantity`'s shape one
 * screen over (#338) and it is the same reason: a caller that slices for itself
 * is a caller that can slice past the end and render an empty screen for a page
 * that exists.
 *
 * IT TAKES THE PARENT'S LINK ARRAY AND RETURNS IDS, WHICH IS WHAT DIVIDES THE
 * READ. The page is chosen before anything is fetched, so only the ids on it are
 * read — one `findChildRecords` query, whatever the category's size — and `total`
 * comes from the array's own length for nothing. **#326 cannot do this half**:
 * most document lists admit rows through `canViewPR`, whose ordered rules are not
 * expressible as a query, so a page of records read from the base is not a page
 * of rows a reader sees. Nothing gates an asset per row (#337), which is what
 * makes dividing the read correct here and not there. **The array is narrowed to the
 * reader's scope first since #509** (`idsInScope`), which is still a filter on ids in
 * hand — the scope comes off the jobs' own link arrays — so the read stays divided.
 *
 * NEWEST FIRST, THE ARRAY TURNED OVER (#463), as 1d draws it. A link array is creation
 * order, so its last is the newest asset, and `newestFirst`, the turn an asset's
 * history takes, puts it at the top with no timestamp parsed; the page is cut from the
 * turned array, and `findChildRecords` keeps the order it is handed. **What it costs was
 * weighed and accepted**: every registration pushes the rows along, so a link to page 2
 * names different assets after one. The selection is printed ids and moves with
 * nothing. It read oldest first until #463, for that cost.
 *
 * AN UNREADABLE PAGE IS PAGE 1 AND A PAGE PAST THE END IS THE LAST ONE. A URL is
 * typed, edited and copied, so the parameter is a request rather than a promise;
 * answering it with an empty screen would show a reader nothing and tell them
 * nothing. A category with no assets has one page, which is the empty state
 * rather than page 0 of 0.
 */
export function pageOfAssets(rowIds, rawPage) {
    const ids = newestFirst(Array.isArray(rowIds) ? rowIds : []);
    const { page, pageCount, from, to } = pageWindow(ids.length, rawPage);
    return { page, pageCount, total: ids.length, from, to, ids: ids.slice(from, to) };
}

/**
 * Which categories one page of the category list holds (#463), and where that page sits —
 * the same clamp and the same 25 as a category's own list, over rows the page has already built.
 *
 * A SLICE AND NOT A DIVIDED READ: every category's three counts need every asset in the
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
// The list reads newest first since #463, so what a registration wrote begins it and
// the action lands on the first page with nothing to work out.

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
 * the same before a press and after it.
 *
 * BY THE ID'S DAY AND THEN ITS SEQUENCE AS A NUMBER, NEVER AS A STRING. `nextSequence`
 * widens past the pad, so a day's thousandth asset is `-1000` and sorts as text
 * ahead of `-999`; `lib/idSequence.js:sequenceOf` is the one reading of a sequence and
 * #40 orders quotations through it for the same reason. The day sorts as text because
 * its stamp is fixed-width. A string that is no asset's id goes after every id
 * that is one, in the order it came.
 */
function inIdOrder(selection) {
    const keyOf = (assetId) => {
        const prefix = assetId.slice(0, assetId.lastIndexOf("-"));
        return { prefix, sequence: sequenceOf(assetId, prefix) };
    };
    return [...selection].sort((a, b) => {
        const left = keyOf(a);
        const right = keyOf(b);
        if (left.sequence === null || right.sequence === null)
            return Number(left.sequence === null) - Number(right.sequence === null);
        if (left.prefix !== right.prefix) return left.prefix < right.prefix ? -1 : 1;
        return left.sequence - right.sequence;
    });
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
 * IT REACHES THIS PAGE AND NO FURTHER, WHICH IS THE PAGING'S CONSEQUENCE RATHER THAN
 * A CHOICE. The screen reads one page of the category's link array (`pageOfAssets`
 * above), and the printed ids of the others are unknown without reading them — so a
 * box selecting the whole category is the read the paging divided, which is also why
 * `docs/briefs/asset-categories-categoryRecordId.md` bars printing all of a category. What
 * is selected on other pages is kept either way.
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

// `toolPagePath` was here until #348 and is `lib/assetRoutes.js:assetCategoryPath` now,
// with every other address on the axis. What stays here is the paging RULE —
// which rows a page holds and which page a parameter resolves to; where that
// page lives is an address, and this issue's whole point is that the axis's
// addresses are in one file so the next move is one edit.

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
    // #513.
    heading: "Tools & Equipment",

    // The three field labels this axis already has, named here so a screen reads
    // one constant rather than two. `toolLabel` heads the name column on the
    // list; `statusLabel` and `jobLabel` head the two columns beside an asset's
    // id.
    toolLabel: ASSET_COPY.toolLabel,
    statusLabel: ASSET_COPY.statusLabel,
    jobLabel: ASSET_COPY.jobLabel,
    backToTools: ASSET_COPY.backToTools,

    // The column over an asset's printed id: `Tool ID`, the design's since #463 (1d).
    // It was `Item` from #455, the design's noun then for what a tool's own page lists;
    // the page's head still speaks `13 items`, and the column names the code each one carries.
    assetIdLabel: "Tool ID",

    // THE LIST'S EMPTY STATE, a heading and a sentence under it (1a), for a list that starts
    // from nothing. The shared brief's three are "nothing exists yet", "nothing you can see"
    // and "nothing matching your filters"; since #509 a list starts from the reader's jobs,
    // so a reader whose jobs hold no assets meets this too, and a job chosen with none
    // on it is the third. Design is drawing both; until then the first two read these
    // words, and the third draws nothing under the head, whose `0 of M` says it. The
    // sentence says what the list is for, and the opener under it is how a category gets onto
    // it — a kind of the catalog with its first items under it, since #507.
    noToolsHeading: "No tools yet",
    noTools: "Each tool shows here with how many are in stock, out and retired.",

    // A kind with nothing under it (1d). A catalog row nobody has bought yet since #507,
    // which the lists leave off and an address still reaches; until then it was a
    // registration that stopped between its two writes, and a sentence under the heading
    // told whoever was adding so — `If you were adding some, it stopped before any were
    // saved.`, which went with the premise. Said as what is so rather than as an error.
    noAssetsHeading: "No items under this tool",

    // How many rows the list holds, which #326 names as the fact every list in
    // this app is missing: without it nothing on screen says whether a reader is
    // looking at everything or at the beginning of it. It is free here — the
    // parent's link array carries the length — and it is a fact about the LIST
    // rather than about what the company holds, which is why it is a single
    // figure where the category list deliberately has none. `items` was the design's word
    // until the files of 2026-10-07, which draw the figure alone (0n, 1a, 1d); the head
    // still speaks each list's own noun after it to assistive tech (#505), since a figure
    // straight after a heading names nothing. `total` is the two as one string, for a
    // sentence.
    itemNoun: (n) => (n === 1 ? "item" : "items"),
    toolNoun: (n) => (n === 1 ? "tool" : "tools"),
    total: (n) => `${n} ${ASSET_LIST_COPY.itemNoun(n)}`,
    // The pager under either list (1a, 1d): which rows this page shows of how many, and
    // which page of how many, with a step each way that a page at its end draws and
    // does not act. The steps are icons, and these are their names.
    range: ({ from, to, total }) => `${from}–${to} of ${total}`,
    pagePosition: ({ page, pageCount }) => `Page ${page} of ${pageCount}`,
    previous: "Previous page",
    next: "Next page",

    // THE SELECTION'S WORDS (#443), AND NONE OF THEM NAMES WHAT IS SELECTED — the way
    // the document lists' pickers say `N selected` (#324). #455 settled the word,
    // `tool` in a sentence and `item` on this page, and had nothing here to undo.
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
    // answers one state rather than standing in for two.
    notFoundHeading: "Tool not found",
};
