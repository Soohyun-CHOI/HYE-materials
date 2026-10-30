"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withSiteManagerAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllAssetCategories } from "@/lib/airtable/assetCategories";
import { createAssets, getAssetByAssetId, getAssetsByRecordIds } from "@/lib/airtable/assets";
import { createFirstAssetLogEntries, getAssetLogEntriesByRecordIds } from "@/lib/airtable/assetLog";
import { readCatalog } from "@/lib/assetCategory";
import { assignedJobsFor } from "@/lib/assetJob";
import { holderRowIds, lastChangeOf } from "@/lib/assetListView";
import { ASSET_REGISTRATION_COPY, readRegistration } from "@/lib/assetRegistration";
import { assetCategoryPath, searchedAssetId } from "@/lib/assetRoutes";
import { ASSET_STATUS } from "@/lib/assetStatus";
import { ASSET_EXPORT_COPY, listExport } from "@/lib/assetListExport";
import { XLSX_MEDIA_TYPE, workbookBytes } from "@/lib/xlsxWorkbook";
import { createRequestPace, pagesOf } from "@/lib/airtablePace";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Register `count` assets of one category (#338), and the first row of each
 * one's history.
 *
 * IT LIVED BESIDE `/tools/new` UNTIL #456, which took the route away: the form is a
 * dialog now, opened from the category list and from a category's own page — the offer a
 * registration that fell short makes is on that page too — so the action sits beside
 * both, under `/asset-categories`. Nothing about what it writes moved with it.
 *
 * ONLY A SITE MANAGER ADDS ASSETS, AND THE WRAPPER DECIDES THAT BEFORE THIS BODY RUNS
 * (#506). `withSiteManagerAction` refuses anybody else — the page they pressed on,
 * rendered again without the dialog, and nothing said — so the role is not a check here
 * at all. What this body still decides is the job, as it did when this action was an
 * exemption: the submitted job has to be one the actor's own `Users."Assigned Jobs"`
 * names, with no office clause, so a site manager on no job is refused in the dialog's
 * words. `Is Admin` decides neither: the office's flag opens the office's screens, and
 * the assets track does not pass through the office.
 *
 * THE SESSION IS READ TWICE. The wrapper's gate reads the person to decide and drops
 * them, and this body reads them again for their jobs and for `Recorded By` — one
 * operation, the one #382 records `createInvoiceAction` paying for the same reason.
 *
 * REFUSES BY RETURNING, BECAUSE THE CALL SITE BINDS (#185). RegistrationDialog.js reads
 * this through `useActionState`, so a refusal lands in `state` and the dialog renders
 * it where it belongs: `{ fields }` names each refusal about one field under that field,
 * and `{ error }` is the one line above the actions that a refusal about the whole
 * registration takes — a reader on no job, a kind the catalog no longer offers (#507),
 * and a batch that wrote nothing, which since #449 is the only return that is not a check
 * made before the writes. **What a submission may be is `readRegistration`'s**, the same
 * function the dialog asks before it sends anything, so the two cannot refuse differently.
 *
 * THE KIND IS PICKED, NOT TYPED, AND ONLY ONE THE CATALOG OFFERS IS TAKEN (#507). What
 * arrives is an `Asset Categories` record id, the row the dialog's two steps narrowed to —
 * or the row a kind's page opened it on — and this asks `readRegistration` of it against
 * the catalog as the base holds it now, `readCatalog`'s rows, which is the shape the dialog
 * asked of the page's read. A row the office has since emptied, given a path another row
 * names, or never had is refused above the actions, and the page is drawn again with the
 * refusal (`refresh()`, #378), so the dialog's two steps offer what the catalog holds now
 * while it keeps what was chosen. **Nothing here writes an `Asset Categories` row**: a kind
 * is the office's to add, on the catalog's page since #527 or in Airtable, where the name
 * typed on this dialog was found or created from #338 (`upsertTool`, gone).
 *
 * WHAT IT WROTE IS SAID BY LANDING ON IT (#449). A registration that writes an asset
 * redirects to its category's page, on the list's first page, with every one it wrote
 * selected — so the ids survive a reload and their labels are one press of that page's
 * print control. The address also carries the two things the landing cannot show: how
 * many were asked for and not written — with how many were asked for beside it, since
 * the fork's title, `3 of 5 tools added` (#455, #485), needs both — and which of those
 * written have no `Created` row (`assetCategoryPath`'s fourth argument, read back by
 * `readRegistrationAccount`). The record id is the one the registration picked.
 *
 * THE FIRST PAGE, BECAUSE THE LIST READS NEWEST FIRST (#463). What a registration wrote
 * is the newest the category holds, so it begins the list whatever the category held before,
 * and a run longer than a page goes on to the next. Until #463 the list read oldest
 * first and the landing was the page holding the first asset written, at the
 * position the row's `Assets` array had reached before this batch.
 *
 * THE KIND IS THE ROW SUBMITTED, FROM EVERY OPENER. A kind's page and the offer open the
 * dialog on that kind and submit its record id as a hidden field, and the list's dialog
 * submits the row its two steps picked, so what is added lands under the row the reader
 * chose — on the page it was opened from, when it was opened on one. Until #507 the tool was
 * found by the name submitted, so two rows with one key could take a registration opened on
 * the other; a catalog row is named by its id here, and two rows naming one path are the
 * catalog's to repair, reported by `scripts/import/classify_asset_categories_514.mjs`.
 *
 * TWO WRITES IN SEQUENCE, AND SINCE #470 THAT IS CHOSEN RATHER THAN FORCED.
 * `createAssets` holds the day-prefix lock across its whole batch, and the log
 * pass took a per-tool-item lock of its own until #470, so writing each log row
 * inside the batch would have nested two `withKeyLock` calls — the thing
 * CLAUDE.md's concurrency section forbids, and the reason lib/materialsCache.js
 * takes its two locks in sequence. `createFirstAssetLogEntries` takes no lock, since
 * an asset this invocation just made has no history to read, so nothing forbids
 * it now; the pass stays after the batch because inside it would hold the lock every
 * registration in this process waits on through writes that mint nothing under it.
 * The cost is the one obeying the rule had: a failure in the log pass can leave
 * more than one asset without a `Created` row, and the landing names those
 * separately.
 *
 * NOTHING ROLLS BACK. `createAssets`' own header carries the argument: undoing
 * the rows would free ids the daily counter has already spent, and `nextSequence`
 * is MAX + 1, so a gap costs nothing while a reused number costs two labels on
 * two assets. What this action owes the person instead is an exact account, which
 * is why the landing selects every minted id rather than counting them.
 *
 * TWO THINGS NOBODY HAS OBSERVED, RECORDED WHERE THEY WOULD BE MET. A registration of
 * the same category in another invocation, writing after this batch and before the landing
 * renders, puts its assets above this one's, so some of what this one wrote can
 * stand on the next page; the selection is by id, so the selection bar still says how
 * many are not on this one. And a THROW — from a read of the jobs or the catalog, or from
 * the day-prefix query `createAssets` makes before its first create — reaches no line in
 * the dialog, as it reached none on the form before #449: it fails before anything this
 * action could word, where the refusal below is for a batch that ran and wrote none.
 */
export const registerAssetsAction = withSiteManagerAction(registerAssetsHandler);

async function registerAssetsHandler(prevState, formData) {
    return withOpsLabel("registerAssetsAction", async () => {
        const user = await requireUser();

        // One list for however many jobs this person is on, which is the shape
        // `/deliveries` uses. The dialog's choice and this check read the same
        // function, so a job the dialog could not offer cannot be admitted here. The
        // catalog beside it, read as the base holds it now (#507): the page's read is as old
        // as the page, and a kind is admitted only if the catalog still offers it.
        const [allJobs, categories] = await Promise.all([getAllJobs(), getAllAssetCategories()]);
        const reading = readRegistration(
            {
                categoryRecordId: formData.get("categoryRecordId"),
                quantity: formData.get("quantity"),
                jobId: formData.get("jobId"),
            },
            assignedJobsFor(user, allJobs),
            readCatalog(categories).offered
        );
        if (!reading.registration) {
            // A kind the catalog no longer offers is the page out of date, so it is drawn
            // again with the refusal (#378); every other refusal is the reader's to answer.
            if (reading.stale) refresh();
            return reading;
        }
        const { category, count, job } = reading.registration;

        // `createAssets` also hands back the failure that stopped it. The landing
        // needs only how many were not written, which is the count less what was: a
        // failed request is read back by its ids before it is counted, and nothing
        // after it is sent (#470), so `created` is every asset the base holds.
        const { created } = await createAssets({
            categoryRecordId: category.id,
            jobRecordId: job.id,
            count,
        });

        // NOTHING WAS WRITTEN, SO THERE IS NOTHING TO LAND ON (#449). The kind is the
        // catalog's either way, but its page would show no selection and nothing to print,
        // so the person stays in the dialog, told above its actions.
        if (created.length === 0) return { error: ASSET_REGISTRATION_COPY.noneWritten };

        // The `Created` row is this action's to write — `createAssets`
        // creates the asset and its cached `Status` and says so. One row per
        // asset that was actually created, ten to a request since #470, and a
        // failed request STOPS the pass rather than sending the rest, which is
        // `createAssets`' own posture and for its reason: a log write that fails
        // is failing systemically far more often than per row. What did not land is
        // named as unlogged, which is a state with no repair (see the copy); a
        // request whose answer was lost is read back first, so a row that did land
        // is never named.
        const { unlogged } = await createFirstAssetLogEntries({
            assets: created,
            jobRecordId: job.id,
            recordedByUserId: user.id,
        });

        // OUTSIDE EVERY `try`, AND IT HAS TO BE. `redirect` throws to navigate, so a
        // `catch` around it would take the navigation for a failed log write.
        //
        // ON THE JOB IT WROTE TO (#520). A list stands on one job, and what was written is on
        // the job the reader chose here, which need not be the first; landing on another would
        // select ids the page does not draw. It landed with no job from #509, on the whole of
        // the reader's jobs, which always showed it.
        redirect(
            assetCategoryPath(
                category.id,
                1,
                created.map((asset) => asset.assetId),
                { job: job.id, asked: count, unwritten: count - created.length, unlogged }
            )
        );
    });
}

/**
 * The Tools & Equipment list as an Excel file (#553): what the list at `search` holds — the
 * address it was showing, sent with the press — and every item it counts. `timeZone` is the
 * browser's, the zone the file's days are the reader's in. Answers `{ fileName, type, bytes }`,
 * or `{ error }` when there is no file to give.
 *
 * WHOEVER READS THE LIST EXPORTS IT, AND ONLY WHAT THEIR LIST HOLDS. The gate is the page's —
 * `requireUser()`, every signed-in reader with no role (#337) — and what the file holds is
 * `assetListScope`'s answer for this reader over the address's `job`, the one judgment the page
 * stands its list on, which `listExport` asks with the user handed here: a job the list does not
 * offer is answered where the list starts, as the list answers it, and the file is named for the
 * job it holds — any job, for every reader, since #593. No wrapper fits, as none fits the page: `withSiteManagerAction` would refuse
 * every reader who is not one, and `withAdminAction` the site. `offline/authz-structure.mjs`
 * carries it as an exemption, and `offline/asset-export.mjs` holds that the user `requireUser`
 * answered is the one `listExport` is handed.
 *
 * WHAT IT READS, AND ONLY ON A PRESS. The list's page reads nothing for the button (`ListExport`
 * is the browser's). A press reads the session, the catalog and the job list — the page's three
 * — then every asset on what the list stands on, whole, a hundred to a query, and the latest
 * `Asset Log` row of each asset the file lists, a hundred to a query: `3 + ⌈N/100⌉ + ⌈M/100⌉`,
 * N the assets in scope and M those the band leaves. The statuses both sheets count by come
 * with the asset read, so the status memory (#560) is not asked: the file is as of the press,
 * which a view of the list may not be. `lib/assetListExport.js:listExport` is the whole press
 * but the gate, the pace and the bytes; docs/notes/tools.md has the figures and the comparison.
 *
 * FIVE REQUESTS A SECOND AT MOST, EVERY ONE OF THEM PACED (`lib/airtablePace.js`). The session's
 * read waits on the pace too, and a whole-table read's later pages are counted when it returns.
 *
 * A FAILED READ IS SAID, AND ITS CAUSE LOGGED. Everything after the gate is inside one `try`, so
 * a read that throws answers `{ error }`, which `ListExport.js` draws before the button; the gate
 * stays outside it, since `requireUser` redirects by throwing and a `catch` would take the way to
 * sign-in for a failure. A base with no job at all is answered the same way: the list draws no
 * button over an empty list, so only a request made by hand reaches it, and there is no list to
 * give. A reader assigned to no job stood there until #593 and stands on all jobs now.
 */
export async function exportAssetListAction(search, timeZone) {
    return withOpsLabel("exportAssetListAction", async () => {
        const pace = createRequestPace();
        await pace();
        const user = await requireUser();

        try {
            // A whole-table read waits for one request and counts the rest of its pages after.
            const paced = async (read) => {
                await pace();
                const rows = await read();
                pace.spent(pagesOf(rows) - 1);
                return rows;
            };
            const made = await listExport({
                user,
                search,
                timeZone,
                read: {
                    categories: () => paced(getAllAssetCategories),
                    jobs: () => paced(getAllJobs),
                    assets: (ids) => getAssetsByRecordIds(ids, { pace }),
                    logRows: (ids) => getAssetLogEntriesByRecordIds(ids, { perQuery: 100, pace }),
                },
            });
            if (!made) return { error: ASSET_EXPORT_COPY.failed };
            return { fileName: made.fileName, type: XLSX_MEDIA_TYPE, bytes: workbookBytes(made.sheets) };
        } catch (error) {
            console.error("exportAssetListAction: no file was made", error);
            return { error: ASSET_EXPORT_COPY.failed };
        }
    });
}

/**
 * Who holds the item a search found by its id, while it is out (1a, #541): the name 1d says after
 * `Out`, for the way to the item the list draws over its rows — `{ holder }`, or a null holder for
 * an item not out, an id no asset carries, and a read that failed.
 *
 * THE ONE FACT THE LIST CANNOT DRAW FROM WHAT ITS PAGE READ. The status and the id ride on the
 * status memory's reads (#560, #541), so a search finds the item and says its status with nothing
 * asked of the base; the holder is on the asset's latest `Asset Log` row, and reading every
 * holder for every view is a read per view the list does not make. So the list asks this once,
 * when the item it found is out: the session, the asset by its id, and its latest log row, three
 * operations — `holderRowIds` and `lastChangeOf`, 1d's reading of who holds an asset.
 *
 * WHOEVER READS THE LIST, AND ANY ASSET. `requireUser()`, the page's gate (#337); an asset's own
 * page says who holds it to every signed-in reader whatever job it is on, so this answers no
 * more than that page does, and asks no job. No wrapper fits, as none fits the export:
 * `offline/authz-structure.mjs` carries it as an exemption. A failed read draws `Out` alone, as an
 * asset whose latest row names nobody is drawn (`currentHolder`), and is logged.
 */
export async function readFoundHolderAction(assetId) {
    return withOpsLabel("readFoundHolderAction", async () => {
        await requireUser();
        const asked = searchedAssetId(assetId);
        if (!asked) return { holder: null };
        try {
            const asset = await getAssetByAssetId(asked);
            if (asset?.status !== ASSET_STATUS.OUT) return { holder: null };
            const entries = new Map((await getAssetLogEntriesByRecordIds(holderRowIds([asset]))).map((entry) => [entry.id, entry]));
            return { holder: lastChangeOf(asset, entries).holder };
        } catch (error) {
            console.error("readFoundHolderAction: no holder was read", error);
            return { holder: null };
        }
    });
}
