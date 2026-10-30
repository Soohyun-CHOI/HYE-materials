// What the office may do to an asset nothing has happened to (#583, #582): the one condition, the
// jobs its job may change to, what a Save writes and in which order, what a deletion writes and in
// which order, where a deletion lands, and every word either says.
//
// THE OFFICE, AN ITEM WHOSE HISTORY HOLDS ITS `Created` ENTRY ALONE, AND NOTHING ELSE. An item
// registered on the wrong job could be put right only by registering it again, which gives it a
// new number and leaves its printed label useless. While nothing has happened to it, nothing a
// site recorded can be lost by moving it, so the office — `Is Admin`, which need not be a site
// manager — may change its job. A site manager who is not the office may not: what a site
// records is where an item was, and the office is who puts a registration right. **#582 deletes
// an item under the same condition**, so the condition is `planOfficeActs`' rather than the job
// change's, and `mayDelete` stands beside `mayChangeJob`.
//
// A DELETION IS A STATUS AND AN ENTRY, AND NO ROW GOES (#582). An item registered by mistake is
// given the status `Deleted` and a `Deleted` entry that says who deleted it and when, and the app
// shows it nowhere again (`lib/assetStatus.js:shownIn`). Its row stays because its number is
// printed: the next registration mints the day's highest number plus one (`lib/ids.js`), so a row
// taken off the base would hand that number, on a label already stuck to something, to the next
// item. Nothing in the app puts a deleted item back; the office does that by hand in Airtable.
//
// THE JOBS ARE THE LIST'S. Which jobs an item may be moved to is `assetListScope`'s answer, the
// one a list's job choice offers, in its order: every job, by its code — every reader's choice
// since #593, and the office's alone before it. A rule that takes a job off that choice takes it
// off this one too, since it is one judgment. And the office's flag is read there, once, which is
// all that list's answer asks it for since #593 (`offline/site-manager.mjs`).
//
// TWO WRITES, THE ENTRY FIRST. The asset's `Job` is a cache of the latest `Asset Log` row's, and
// the latest is the `Created` entry, so the entry is the record and the asset follows it —
// `writeEvent`'s order on the asset page, for its reason: an asset moved with no entry behind it
// says what no history does, where an entry moved with the asset behind it is what the next
// Save finishes. `readJobChange` writes only what differs from the job chosen, so a Save after a
// half-done one writes the half that was not done, and a Save that moves nothing writes nothing.
// The asset's `Status` is not written: the change records no event, so nothing moves it.
//
// A DELETION WRITES IN THE SAME ORDER, THE ENTRY AND THEN THE STATUS — `writeEvent`'s, for its
// reason: the status is a cache of the latest entry, and a status written with no entry behind it
// would hide the item with nothing saying who did. `readDeletion` writes only what is left, so a
// deletion whose status write failed is finished by deleting again — **the history then holds the
// `Created` entry and the `Deleted` one, and that is the second history the condition admits**, so
// finishing is never refused as something recorded since. Nothing is put back.
//
// THE ONE EDIT `Asset Log` TAKES. A row records what was true at a moment, so the log is
// append-only and correcting a scan is another row. A `Created` entry with nothing after it is
// the registration itself, made on the wrong job: what it says is the mistake being put right,
// and no later row read its job. So the entry takes the new job, and no row records the change —
// `lib/airtable/assetLog.js:updateCreatedEntryJob` is the one writer, and it refuses any row but
// an asset's only one.
//
// PURE AND OFFLINE-SAFE, with the extension spelled out: the desk's dialog and the phone's sheet
// — `"use client"` files — ask `readJobChange` before they send, as the action asks it after.
//
// EVERY STRING THE SCREEN RENDERS IS IN `ASSET_OFFICE_COPY`, which `offline/asset-list-view.mjs`
// holds by failing on any JSX text under app/(assets)/.

import { ASSET_EVENT, ASSET_STATUS, JOB_SOURCE, jobSourceOf } from "./assetStatus.js";
import { ASSET_COPY } from "./assetView.js";
import { ASSET_JOB_COPY } from "./assetJob.js";
import { assetListScope } from "./assetListView.js";
import { ASSET_TRANSITION_COPY } from "./assetTransition.js";
import { assetCategoriesPath, assetCategoryPath } from "./assetRoutes.js";

/**
 * What the office may do to this asset (#583, #582): whether its job may change, whether it may be
 * deleted, its `Created` entry — the row id and the job it holds — while it is the only one, the
 * `Deleted` entry a deletion left half done, and the jobs it may change to, each `{ id, jobCode }`.
 *
 * ONE FUNCTION FOR THE PAGE AND THE ACTION, `planTransition`'s arrangement. The page decides the
 * menu's line from the reader, the history and the job list it has already read, so the line
 * costs no read; the action asks again on a fresh read, because a Server Action is reachable
 * without the page and because something may have been recorded since it was drawn.
 *
 * THE HISTORY IS EXACTLY ONE ROW, AND THAT ROW IS `Created`. An item with no row at all — a
 * registration whose log pass failed (#338) — is not one nothing has happened to in the sense
 * the condition means, since its history cannot say so, and the first row recorded after it
 * would be an event rather than its creation.
 *
 * A DELETION ADMITS ONE HISTORY MORE: THE `Created` ENTRY AND THEN A `Deleted` ONE, NOTHING ELSE
 * (#582). That is a deletion whose entry landed and whose status did not, and the item is still
 * drawn; deleting it again writes the status and finishes it, so the condition does not refuse
 * the deletion that left it. Its job may no longer change — something is recorded on it.
 *
 * A READER WHO MAY NOT IS HANDED NO JOBS, so the page sends the browser nothing it will not draw;
 * nor is the office, on an item whose job may no longer change.
 */
export function planOfficeActs({ user, log, jobs }) {
    const rows = Array.isArray(log) ? log : [];
    const created = rows.length === 1 && rows[0]?.event === ASSET_EVENT.CREATED ? rows[0] : null;
    const deleted =
        rows.length === 2 && rows[0]?.event === ASSET_EVENT.CREATED && rows[1]?.event === ASSET_EVENT.DELETED ? rows[1] : null;
    const scope = assetListScope(user, jobs, null);
    if (!scope.office || (!created && !deleted)) {
        return { mayChangeJob: false, mayDelete: false, created: null, deletedEntry: null, jobs: [] };
    }
    return {
        mayChangeJob: created !== null,
        mayDelete: true,
        created: created ? { id: created.id, jobRecordId: created.job?.[0] ?? null } : null,
        deletedEntry: deleted ? { id: deleted.id } : null,
        jobs: created ? scope.jobs.map(({ id, jobCode }) => ({ id, jobCode })) : [],
    };
}

/**
 * The job a change opens on (#583): its `Created` entry's, which is the asset's own while the two
 * agree — and once a change is half done, the job that change chose, since the entry is written
 * first. So a reader who leaves a half-done change and opens it again finishes it with one Save.
 */
export function startingJob(plan, assetJobRecordId) {
    return plan.created?.jobRecordId ?? assetJobRecordId ?? "";
}

/**
 * What a Save of `jobId` writes, or why it writes nothing (#583): `{ jobRecordId, writesEntry,
 * writesAsset, unchanged, refusal }`.
 *
 * EACH HALF IS WRITTEN WHERE IT DIFFERS FROM THE JOB CHOSEN, AND ONLY THERE. The entry's job is
 * the plan's, read with the history; the asset's is handed in, the job the page or the action
 * read off the asset. A change whose second write failed leaves the entry on the new job and the
 * asset on the old, so a Save of the same job writes the asset alone. **Nothing has changed only
 * when both already hold it** — the screen may already show the new job, on the entry, while the
 * asset holds the old one, and a dialog closing there as though nothing had changed would leave
 * the sentence telling the reader to save again false.
 *
 * TWO REFUSALS, AND THE ORDER IS THE APP'S BEFORE THE READER'S. Something recorded since the page
 * was drawn ends the change whatever was chosen, so it is answered first; then a job the list does
 * not offer, which no screen sends — its choice always holds one — and a forged press or a job
 * gone from the base does.
 */
export function readJobChange(plan, { jobId, assetJobRecordId }) {
    if (!plan.mayChangeJob) {
        return { jobRecordId: null, writesEntry: false, writesAsset: false, unchanged: false, refusal: ASSET_OFFICE_COPY.recordedSince };
    }
    const job = plan.jobs.find((each) => each.id === jobId) ?? null;
    if (!job) {
        return { jobRecordId: null, writesEntry: false, writesAsset: false, unchanged: false, refusal: ASSET_OFFICE_COPY.jobNoneChosen };
    }
    const writesEntry = plan.created.jobRecordId !== job.id;
    const writesAsset = (assetJobRecordId ?? null) !== job.id;
    return { jobRecordId: job.id, writesEntry, writesAsset, unchanged: !writesEntry && !writesAsset, refusal: null };
}

/**
 * What a deletion writes, or why it writes nothing (#582): `{ jobRecordId, writesEntry, writesStatus,
 * refusal }`.
 *
 * THE `Deleted` ENTRY WHERE THE HISTORY HAS NONE, AND THE STATUS WHERE THE ASSET IS NOT YET
 * `Deleted`. A deletion whose status write failed has its entry, so pressing again writes the status
 * alone and no second entry; one with both written is a deleted asset, which no reader hands back,
 * so this answers nothing to write rather than a refusal.
 *
 * THE ENTRY TAKES THE ASSET'S JOB, `JOB_SOURCE_OF_EVENT`'s answer for the event: a deletion moves
 * nothing, as a retirement moves nothing, and the office deleting it need be on no job. The status
 * write carries the same job, the cache's other half, so the asset's `Job` stands as it was.
 *
 * ONE REFUSAL: SOMETHING RECORDED SINCE THE PAGE WAS DRAWN, the plan's `mayDelete` read again on a
 * fresh history. The reader's being the office is the wrapper's, and the plan asks it too.
 */
export function readDeletion(plan, { status, assetJobRecordId }) {
    if (!plan.mayDelete) {
        return { jobRecordId: null, writesEntry: false, writesStatus: false, refusal: ASSET_OFFICE_COPY.deleteRecordedSince };
    }
    const jobRecordId = jobSourceOf(ASSET_EVENT.DELETED) === JOB_SOURCE.ASSET ? (assetJobRecordId ?? null) : null;
    return {
        jobRecordId,
        writesEntry: plan.deletedEntry === null,
        writesStatus: status !== ASSET_STATUS.DELETED,
        refusal: null,
    };
}

/**
 * Where the office lands once an item is deleted (#582): its kind's list on the job the item was
 * on, the breadcrumb's level above the page that is gone — or the Tools & Equipment list on that
 * job for an item filed under no kind. The files draw no landing; the list without the item is
 * what says the deletion happened (#321), and a deletion of one of a batch registered by mistake
 * lands beside the rest of it.
 *
 * THE ADDRESS CARRIES THE ITEM'S OWN JOB, which every reader's list may stand on since #593, so
 * nothing is read to choose it; a job the list no longer offers is answered where an address
 * naming none starts (`assetListScope`).
 */
export function deletedLanding(asset) {
    const job = asset?.job?.[0] ?? null;
    const category = asset?.category?.[0] ?? null;
    return category ? assetCategoryPath(category, 1, [], { job }) : assetCategoriesPath(1, job);
}

/** Every word the office's acts add to an asset's page (#583, #582). */
export const ASSET_OFFICE_COPY = {
    // ONE STRING FOR THE MENU'S LINE AND THE DIALOG'S AND THE SHEET'S TITLE, the design's (1f,
    // 1j-f): the line opens what it names, as `Check out` opens its dialog.
    changeJob: "Change job",

    // The field's label at a desk (1f) — the asset page's `Job`, read rather than spelled again,
    // since the history beside it names the same fact with the same word.
    jobLabel: ASSET_COPY.jobLabel,
    jobUnchosen: ASSET_JOB_COPY.unchosen,

    // The commitment at a desk (1f), and at the end of the phone's sheet's head, which the files
    // draw without one (1j-f): there a press on a job does not save, as at a desk, so the sheet
    // says its own commitment where the note's sheet says `Done`. Its working word is 0f's rule.
    save: "Save",
    saving: "Saving…",
    cancel: ASSET_TRANSITION_COPY.cancel,

    // SOMETHING WAS RECORDED SINCE THE PAGE WAS DRAWN, said under the status of the page drawn
    // again (#583), where a refused press is said (1k): the menu's line and its dialog are gone
    // from that page, and the reader pressed Save, so the page says that nothing moved and why.
    recordedSince: "Something has been recorded on this item, so its job can't be changed.",

    // A job the list does not offer. No screen sends one; the registration's word for a job not
    // chosen answers a forged press or a job gone from the base.
    jobNoneChosen: ASSET_JOB_COPY.noneChosen,

    // THE ENTRY MOVED AND THE ASSET DID NOT, which is the one state two writes can leave, named
    // above the dialog's actions or under the sheet's rows while it stays open, and under the
    // status once it is closed. The history beside it already says the new job; the lists still
    // say the old one. Saving again writes the half that is left, and nothing is put back.
    halfDone: ({ from, to }) =>
        `The Created entry is on ${to} now, but the item is still on ${from}, and the lists will say so. Save again to finish.`,

    // A press from a reader who is not the office, which only a page drawn while they were one
    // or a request no screen made reaches. The page drawn again holds neither the line nor its
    // dialog, so this is said under the status.
    noAccess: "Changing an item's job is for Admins.",

    // THE MENU'S LINE, THE DESIGN'S (#582; 1f, 1j): after `Retire this item`, the second act that
    // ends the item, and 0f's Destructive as that one is.
    deleteOpener: "Delete this item",

    // THE QUESTION IT OPENS ASKS AND NAMES THE ITEM, the design's at both widths — 0l's Confirm at a
    // desk and Tools 0a's sheet that confirms — the retirement's shape (`retireHeading`): the kind's
    // name, and the id under it.
    deleteHeading: ({ itemName, assetId }) => `Delete ${itemName || assetId}?`,

    // What becomes true, the design's: the item and its history are drawn nowhere again, and nothing
    // in the app brings them back. The base keeps both, for a hand restore and so the number stays
    // taken, which is the office's to know and not the sentence's.
    deleteBody: "It will be deleted along with its history. This can't be undone.",

    // The commitment, the design's, filled red; and while it is on its way, 0f's Working — the verb
    // in its `-ing` form, which the files draw for neither width.
    deleteSubmit: "Delete item",
    deleteWorking: "Deleting…",

    // SOMETHING WAS RECORDED SINCE THE PAGE WAS DRAWN, said under the status of the page drawn again,
    // as `recordedSince` is for a change of job: the line and its question are gone from that page.
    deleteRecordedSince: "Something has been recorded on this item, so it can't be deleted.",

    // THE ENTRY LANDED AND THE STATUS DID NOT: the history beside it says `Deleted`, and every list
    // still draws the item. Deleting again writes the status alone and finishes it.
    deleteHalfDone: "The Deleted entry is recorded, but the item is still on the lists. Delete it again to finish.",

    // A press from a reader who is not the office, `noAccess`'s case for a deletion.
    deleteNoAccess: "Deleting an item is for Admins.",
};
