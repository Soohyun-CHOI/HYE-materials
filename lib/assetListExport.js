// What the Tools & Equipment list exports (#553): the file a press of `Export` downloads, and
// every word the press says.
//
// TWO SHEETS, AND THE FIRST IS THE LIST. `Tools & Equipment` is 1a as the reader is looking at
// it — each item the band leaves, in the list's order, with its four counts, those of the jobs
// the `Job` chip takes when it takes any (#548). `Items` is every asset counted there, one row
// each, grouped as the first sheet's rows are and newest first within each, the order 1d lists a
// kind's assets in. So each row of the first sheet is exactly as many rows of the second, status
// for status, which `offline/asset-export.mjs` holds on a fixture.
//
// WHAT THE LIST SHOWS IS ASKED OF THE LIST'S OWN FUNCTIONS. The rows are
// `lib/assetListView.js:categoryListRows` under `readCategoryList`, which the list itself draws
// by, and the scope is `assetListScope` over the address the list was showing; nothing here
// narrows anything. The second sheet's holder and day are `lastChangeOf`, 1d's reading of an
// asset's latest `Asset Log` row. What this module adds is only what a file needs and a screen
// does not: the columns, the cells and the file's name.
//
// THE FILE IS THE LIST'S WHOLE, NOT ITS PAGE. The list draws fifty rows to a page of what it
// holds (#538) and the page reads nothing (#520); the file holds every row the band leaves, which
// is the `N` the head counts. The `Job` chip is the one place the file and a screen part: a
// kind's own page opened from `All jobs` stands on all of them whatever the chip took (#548),
// while the second sheet lists the chip's jobs alone, since it is the assets the first sheet
// counts.
//
// THE WORDS ARE THE SCREENS'. The first sheet's heads are 1a's — `Name` for the whole of a kind's
// name, the band's `Type` and `Category`, the four statuses; the second's are 1d's and the
// catalog's — `Item ID`, the six levels as the catalog says them, where `Name` is the third level
// alone — then `Status`, `Job`, `Checked out to` as an asset's history says it (#376), `Note` and
// `Updated`. A day reads `mm/dd/yyyy`, the app's notation, and is the reader's day: the press
// sends the browser's zone (`lib/format.js:readerTimeZone`), as every screen draws an instant in
// the reader's zone and names none (#374) — the file's reader is whoever pressed, which is what
// sets it apart from the order document, a surface with no reader that names the zone it used.
//
// THE READS ARE HANDED IN, SO WHAT ONE PRESS DOES IS ONE FUNCTION. `listExport` asks for the
// catalog and the jobs, decides the scope, asks for the assets on it, decides the rows and the
// assets they count, asks for those assets' latest log rows and builds the sheets — the action
// hands it the paced Airtable readers, and `offline/asset-export.mjs` hands it a fixture and
// counts what it asks for, so the check runs the press itself rather than a copy of it.
//
// PURE AND OFFLINE-SAFE, and safe for the browser: the button reads its words here. It imports
// no Airtable module and not `lib/xlsxWorkbook.js`, whose `node:zlib` no browser has — the action
// hands that module the sheets this one builds.

import { ASSET_STATUS_VALUES } from "./assetStatus.js";
import { ASSET_COPY, newestFirst } from "./assetView.js";
import {
    ASSET_LIST_COPY,
    assetCategoriesInScope,
    assetListScope,
    categoryListRows,
    countedAssets,
    idsInScope,
    jobAsked,
    lastChangeOf,
    latestLogRowIds,
    readCategoryList,
} from "./assetListView.js";
import { ASSET_CATEGORY_COPY } from "./assetCategory.js";
import { dayOf, knownTimeZone } from "./format.js";
import { FILTERED_LISTS, axesFor } from "./listFilters.js";

// `All jobs`, read where it is built, as `app/(assets)/JobChoice.js` reads it for the choice that
// says it (#548): the document lists' job picker's word, which every document list carries.
const ALL_JOBS_LABEL = axesFor(FILTERED_LISTS[0]).find((axis) => axis.param === "job").words.all;

/**
 * One press of `Export` (#553): what the list at `search` holds for `user`, as a file's name and
 * its two sheets — or null for a reader standing on no job, whose list holds nothing to give.
 *
 * `search` is the address the list was showing; `timeZone` the browser's, which the days are
 * read in (`knownTimeZone` answers anything else with `UTC`); `now` the moment the file is named
 * for. `read` holds the four reads, each answering what its Airtable reader answers:
 * `categories()` every `Asset Categories` row, `jobs()` every job, `assets(ids)` those assets
 * whole and `logRows(ids)` those `Asset Log` rows' event, moment and holder. Each is asked once.
 *
 * THE SCOPE IS THE PAGE'S, ASKED OF THE ADDRESS: `assetListScope` with this reader over the
 * address's `job` in the shape the page is handed it (`jobAsked`), so a job they may not stand on
 * is answered with the first of theirs. THE ROWS ARE THE LIST'S: `categoryListRows` over the
 * statuses the asset read answered, under `readCategoryList`. Every asset the scope holds is read,
 * since every kind's counts need its statuses; only the assets the band leaves have their log
 * rows read.
 */
export async function listExport({ user, search, timeZone, now = new Date(), read }) {
    const [categories, jobs] = await Promise.all([read.categories(), read.jobs()]);
    const params = new URLSearchParams(typeof search === "string" ? search : "");
    const scope = assetListScope(user, jobs, jobAsked(params));
    if (scope.jobs.length === 0) return null;

    const shown = assetCategoriesInScope(categories, scope.shown);
    const held = await read.assets(shown.flatMap((category) => idsInScope(category.assets, scope.shown)));
    const assets = new Map(held.map((asset) => [asset.id, asset]));
    const statuses = new Map(held.map((asset) => [asset.id, asset.status]));

    const reading = readCategoryList(categoryListRows(shown, scope, statuses), params, { allJobs: scope.allJobs, jobs: scope.jobs });
    const exported = exportedAssets(reading, countedAssets(shown, scope, statuses));
    const logRows = await read.logRows(latestLogRowIds(exported.map((asset) => assets.get(asset.id))));
    const entries = new Map(logRows.map((entry) => [entry.id, entry]));

    const zone = knownTimeZone(timeZone);
    return {
        fileName: exportFileName(scope, zone, now),
        sheets: exportSheets({ reading, categories: shown, exported, assets, entries, jobs: scope.jobs, timeZone: zone }),
    };
}

/**
 * What the file is called: the list's heading, what it stood on — the job's code, or `All jobs`
 * — and the reader's day it was made in `timeZone`, ISO's order so a folder of them sorts by
 * day: `Tools & Equipment - 23-USA-09 - 2026-10-22.xlsx`. The job named is the one
 * `assetListScope` answered, so an address asking for a job the reader may not stand on names
 * the job the file holds. The band is not in the name; the rows are what it left.
 */
function exportFileName(scope, timeZone, now) {
    const stood = scope?.allJobs ? ALL_JOBS_LABEL : String(scope?.job?.jobCode ?? "").replace(/[\\/:*?"<>|]/g, "-");
    const today = dayOf(now.toISOString(), timeZone);
    const pad = (n) => String(n).padStart(2, "0");
    return `${ASSET_LIST_COPY.heading} - ${stood} - ${today.year}-${pad(today.month)}-${pad(today.day)}.xlsx`;
}

/**
 * The assets the second sheet lists, in its order: `counted` is `countedAssets`' answer for the
 * scope — each asset's kind, job and status, the assets the first sheet's counts are made of —
 * and `reading` the list's reading of the rows. An asset stands under its kind's row when the
 * band left that row, and on a job the `Job` chip took when it took any; a kind's are newest
 * first, `countedAssets` having walked each kind's link array in its own order.
 */
function exportedAssets(reading, counted) {
    const chosen = new Set(reading?.held?.jobs ?? []);
    const byKind = new Map();
    for (const asset of counted || []) {
        const kind = asset.category?.[0];
        if (!byKind.has(kind)) byKind.set(kind, []);
        byKind.get(kind).push(asset);
    }
    return (reading?.rows ?? []).flatMap((row) => newestFirst(byKind.get(row.id)).filter((asset) => chosen.size === 0 || chosen.has(asset.job?.[0])));
}

const LEVELS = ["level1", "level2", "level3", "size", "maker", "partNumber"];

/**
 * The two sheets, as `lib/xlsxWorkbook.js:workbookBytes` takes them. `categories` are the kinds
 * the scope reaches, each with its catalog levels; `exported` is `exportedAssets`' answer;
 * `assets` the assets read, by record id, and `entries` their latest log rows, by record id
 * (`latestLogRowIds`); `jobs` the jobs the scope offers, for each asset's code.
 */
function exportSheets({ reading, categories, exported, assets, entries, jobs, timeZone }) {
    const kindOf = new Map((categories || []).map((category) => [category.id, category]));
    const codeOf = new Map((jobs || []).map((job) => [job.id, job.jobCode]));
    const list = {
        name: ASSET_EXPORT_COPY.listSheet,
        columns: [
            { header: ASSET_LIST_COPY.nameLabel, kind: "text", width: 48 },
            { header: ASSET_CATEGORY_COPY.levelLabel.level1, kind: "text", width: 12 },
            { header: ASSET_CATEGORY_COPY.levelLabel.level2, kind: "text", width: 24 },
            ...ASSET_STATUS_VALUES.map((status) => ({ header: status, kind: "number", width: 10 })),
        ],
        rows: (reading?.rows ?? []).map((row) => [row.itemName, row.level1, row.level2, ...row.counts.map((entry) => entry.count)]),
    };
    const items = {
        name: ASSET_EXPORT_COPY.itemSheet,
        columns: [
            { header: ASSET_LIST_COPY.assetIdLabel, kind: "text", width: 20 },
            ...LEVELS.map((level) => ({ header: ASSET_CATEGORY_COPY.levelLabel[level], kind: "text", width: level === "level3" || level === "level2" ? 24 : 14 })),
            { header: ASSET_COPY.statusLabel, kind: "text", width: 10 },
            { header: ASSET_COPY.jobLabel, kind: "text", width: 12 },
            { header: ASSET_COPY.checkedOutToLabel, kind: "text", width: 20 },
            { header: ASSET_LIST_COPY.noteLabel, kind: "text", width: 40 },
            { header: ASSET_LIST_COPY.updatedLabel, kind: "day", width: 12 },
        ],
        rows: (exported || []).map((asset) => {
            const kind = kindOf.get(asset.category?.[0]) ?? {};
            const record = assets?.get(asset.id) ?? { status: asset.status };
            const change = lastChangeOf({ ...record, status: asset.status }, entries);
            return [
                record.assetId,
                ...LEVELS.map((level) => kind[level]),
                asset.status,
                codeOf.get(asset.job?.[0]) ?? "",
                change.holder,
                record.note,
                dayOf(change.updatedAt, timeZone),
            ];
        }),
    };
    return [list, items];
}

/** Every word the export says (1a, #553). */
export const ASSET_EXPORT_COPY = {
    // The control in 1a's head and its name, the design's: `Export` on the button, `Export to
    // Excel` to assistive tech, which says what the file is.
    export: "Export",
    exportName: "Export to Excel",
    // While the file is made — 0f's working word, the verb's `-ing`, heard and not seen.
    working: "Exporting…",
    // A press that made no file, said before the button on its line, as the app's refusals of a
    // press that wrote nothing say it (`Couldn't add the items. Try again.`). The files draw no
    // failure (`docs/briefs/design-copy-findings.md`).
    failed: "Couldn't export the list. Try again.",
    // The sheets: the list by its heading, and the items it counts by the screens' noun for them.
    listSheet: ASSET_LIST_COPY.heading,
    itemSheet: "Items",
};
