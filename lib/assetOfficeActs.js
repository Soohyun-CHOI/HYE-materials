// What the office may do to an asset nothing has happened to (#583): the one condition, the jobs
// its job may change to, what a Save writes and in which order, and every word it says.
//
// THE OFFICE, AN ITEM WHOSE HISTORY HOLDS ITS `Created` ENTRY ALONE, AND NOTHING ELSE. An item
// registered on the wrong job could be put right only by registering it again, which gives it a
// new number and leaves its printed label useless. While nothing has happened to it, nothing a
// site recorded can be lost by moving it, so the office — `Is Admin`, which need not be a site
// manager — may change its job. A site manager who is not the office may not: what a site
// records is where an item was, and the office is who puts a registration right. **#582 deletes
// an item under the same condition**, so the condition is `planOfficeActs`' rather than the job
// change's, and that issue adds its answer beside `mayChangeJob`.
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

import { ASSET_EVENT } from "./assetStatus.js";
import { ASSET_COPY } from "./assetView.js";
import { ASSET_JOB_COPY } from "./assetJob.js";
import { assetListScope } from "./assetListView.js";
import { ASSET_TRANSITION_COPY } from "./assetTransition.js";

/**
 * What the office may do to this asset (#583): whether its job may change, its `Created` entry
 * — the row id and the job it holds — and the jobs it may change to, each `{ id, jobCode }`.
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
 * A READER WHO MAY NOT IS HANDED NO JOBS, so the page sends the browser nothing it will not draw.
 */
export function planOfficeActs({ user, log, jobs }) {
    const rows = Array.isArray(log) ? log : [];
    const created = rows.length === 1 && rows[0]?.event === ASSET_EVENT.CREATED ? rows[0] : null;
    const scope = assetListScope(user, jobs, null);
    if (!scope.office || !created) {
        return { mayChangeJob: false, created: null, jobs: [] };
    }
    return {
        mayChangeJob: true,
        created: { id: created.id, jobRecordId: created.job?.[0] ?? null },
        jobs: scope.jobs.map(({ id, jobCode }) => ({ id, jobCode })),
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

/** Every word the office's acts add to an asset's page (#583). */
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
};
