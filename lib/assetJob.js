// The job an `Asset Log` row is filed against (#363) — who records on an item on a
// job (#597), whose jobs a registration may pick, and the words the picker says.
//
// SINCE #597 ONE EVENT TAKES ITS JOB FROM THE ACTOR, AND IT IS THE REGISTRATION. An item's
// job is the one it sits on, and every event after its first records there: a check-out
// and a check-in ask no job and leave the item where it is, as a repair and a retirement
// already did (lib/assetStatus.js:JOB_SOURCE_OF_EVENT). What the actor's assignments still
// decide is whether they record on the item at all — `recordsOn` — and, for a
// registration, which of their jobs the new items start on.
//
// IT LIVED IN lib/assetRegistration.js UNTIL THE THIRD CALLER, WHICH IS THE
// MECHANISM RATHER THAN A TIDY-UP. #338 wrote `assignedJobsFor` for the
// registration form and #362 read it from the transition screen, leaving the
// module's name narrower than its contents and writing the move condition down:
// a third caller. Retiring an asset is the third — every `Asset Log` row
// carries a job and every one of them takes it from the actor — so this is
// `countsAsOrdered`'s path exactly, which sat in lib/materialPriceView.js with
// the same condition until #169 fired it (docs/notes/verification.md).
//
// WHAT DID NOT COME WITH IT, and both absences are decisions. `canRegisterTool
// Items` stays behind: its name and its screen are registration's, and it is
// that form asking whether this person may use it. The registration's `noJob`
// sentence stays on its screen, because it names its act; the asset page said one
// of its own about recording until #597, when a site manager on no job came to
// read that page as anybody does.
//
// `Job` IS NOT HERE EITHER. That label names one field wherever a screen heads
// a job — a list's column, the export's, the choices — so it lives with the
// screen it started on, lib/assetView.js:ASSET_COPY, and they read it from there.
//
// PURE AND OFFLINE-SAFE, importing two modules with their extensions spelled out:
// the order every asset list says words in, and who records at all. `scripts/tests/
// offline/asset-job.mjs` pins it with no credentials, and the registration's dialog and
// the asset page's controls are "use client" files that reach it.

import { compareCatalogText } from "./assetCategory.js";
import { isSiteManager } from "./siteManager.js";

/**
 * Whether this reader records on an item that sits on this job (#597): a site manager
 * (`lib/siteManager.js`) assigned to the job, and nobody else.
 *
 * AN ITEM'S JOB IS THE ONE IT SITS ON, `Assets."Job"`, AND ONLY A SITE MANAGER ON THAT JOB
 * RECORDS ON IT — checking it out or in, sending it for repair and taking it back, retiring
 * it, writing its note and printing its label. Until #597 a site manager recorded on every
 * item, on any job, and a check-out or a check-in could move the item to the job they chose.
 *
 * ONE JUDGMENT, ASKED OF WHAT EACH CALLER HAS ALREADY READ. The asset's page asks it through
 * `lib/assetTransition.js:planTransition` of the reader and the item it read, and the three
 * actions behind its controls ask the same plan on a fresh read; a list asks it of the job it
 * stands on (`lib/assetListView.js:listRecording`); and the label read asks it of each item it
 * reads. None of them reads anything more to answer it.
 *
 * NO OFFICE CLAUSE, `assignedJobsFor`'s reason below: the office records nothing on this axis
 * that a site does, and its own acts are `lib/assetOfficeActs.js`'s. A job that is not a value
 * — an item read with no `Job`, which the writers refuse to leave — is nobody's.
 */
export function recordsOn(user, jobId) {
    if (!isSiteManager(user) || typeof jobId !== "string" || jobId === "") return false;
    return (user?.assignedJobs || []).includes(jobId);
}

/**
 * Every job a list's job choice offers, in its order (#593, #598): the loaded list by its codes, as
 * `compareCatalogText` orders a code. `lib/assetListView.js:assetListScope` stands a list on these,
 * and a lending offers them less the job lending (`lib/assetTransition.js:planTransition`), so the
 * jobs an item may go to are the jobs a reader may look at, and a rule taking a job off the choice —
 * #488's, for a job that has ended — takes it off both. Here rather than in the list's module, which
 * imports the transition's through the note's, so the two can share it with no cycle.
 */
export function listedJobs(jobs) {
    return [...(Array.isArray(jobs) ? jobs : [])].sort((a, b) => compareCatalogText(a.jobCode, b.jobCode));
}

/**
 * The jobs this person is assigned to, out of a loaded list — the jobs a registration may
 * put items on, and the ones `recordsOn` admits a site manager to (#597).
 *
 * THEIR OWN ASSIGNMENTS, AND DELIBERATELY WITH NO OFFICE CLAUSE — which is what
 * makes this a different judgment from `lib/deliveryAccess.js:accessibleJobs`
 * rather than a second copy of it. That one admits President and Admin to every
 * job, because invoicing and reconciliation are office work and an Admin can
 * already delete a delivery. The assets track does not pass through the office at
 * all: a site person buys the asset, registers it and keeps it, and the job a
 * `Asset Log` row carries is the job the event HAPPENED on. An Admin assigned to
 * no job has no such job, so there is nothing for them to file an event against
 * and widening this would invent one.
 *
 * Nobody types a job anywhere on this axis. For a registration one assignment is
 * used without asking, several are chosen from, and none is a refusal — see the copy
 * below; every later event records on the item's own job and asks none (#597).
 *
 * IN THE ORDER OF THEIR CODES (#538), as the files of 2026-10-16 list a reader's
 * jobs in the chip's menu and the breadcrumb's, whichever one the screen stands
 * on — so every choice of a job on this axis lists them alike, where the Jobs
 * table's order came through to the registration and the transition until then.
 */
export function assignedJobsFor(user, jobs) {
    const assigned = new Set(user?.assignedJobs || []);
    return (jobs || []).filter((job) => assigned.has(job.id)).sort((a, b) => compareCatalogText(a.jobCode, b.jobCode));
}

/**
 * The job a person on exactly one assignment files against, or null (#458).
 *
 * "ONE ASSIGNMENT IS USED WITHOUT ASKING" IS THIS FUNCTION, AND NOTHING ELSE SPELLS IT.
 * The registration's choice starts on it. The transition's choice started on it too, and a
 * check-in recorded on the press only for a person on one job, until #597 took the job out
 * of both. `jobs` is `assignedJobsFor`'s answer, never the whole table.
 */
export function onlyJob(jobs) {
    return Array.isArray(jobs) && jobs.length === 1 ? jobs[0] : null;
}

/**
 * The job a choice holds now that the jobs it chose from may have changed (#469, #463):
 * the one chosen while it is still among them, and otherwise where a choice starts — the
 * one job there is, or none of several (`""`).
 *
 * A REFUSAL RE-RENDERS THE PAGE IN PLACE (#378), AND THE JOBS IT PLANS WITH CAN BE FEWER
 * THAN THE CHOICE WAS MADE FROM — the office took the chosen one away between the choice
 * and the press. Kept, it was no choice at all: below the phone's edge, with one job left,
 * a stated field saying `Choose a job` that nothing could open, over a commitment that
 * could not act, seen in a browser in #469 on the transition's choice, which #597 took away.
 *
 * THE REGISTRATION'S CHOICE STARTS ON IT (#565), handed the job the list it opens over
 * stands on rather than one chosen earlier: the same question — is this job still among the
 * ones offered — asked of the reader's assignments, so the list's job is chosen when it is one
 * of theirs, and a job the reader may view and is not assigned to — any job, since #593 — or
 * none on all jobs, starts where a choice starts.
 */
export function chosenJobId(jobs, jobId) {
    if (jobId && (jobs || []).some((job) => job.id === jobId)) return jobId;
    return onlyJob(jobs)?.id ?? "";
}

/**
 * The words the job picker says, wherever it appears on this axis.
 *
 * EVERY SCREEN READS THESE RATHER THAN SPELLING THEM, which is the whole reason
 * they moved: it is one control and one rule on each screen that asks a job, and a
 * second copy of either is a second word for one fact the first time somebody rewords
 * one. Each screen's own copy constant keeps its existing key names and reads the
 * value from here, so no component changed when this moved. The registration and the
 * office's job change (#583) read them; the check-out's picker did until #597.
 *
 * THE VERB IS THE DESIGN'S SINCE #456, `Choose` where it was `Pick`: 0l writes a
 * choice with nothing chosen as `Choose a …`, and the registration dialog is the
 * first screen drawn from it.
 */
export const ASSET_JOB_COPY = {
    // A picker with nothing chosen needs a word that is not the field's own name.
    // Measured in a browser (#338): with the label reused, the control read
    // `Job / Job / 26-DEMO-01`, one word standing for both the axis and the
    // absence of a value — the distinction `Payment` / `Paid` already draws
    // between a column head and a cell.
    unchosen: "Choose a job",

    // The refusal for a submission that chose no job at all — the design's, for the
    // field left at its placeholder (1b). A different fact from the one below: this
    // reader simply has not chosen yet.
    noneChosen: "Choose a job.",

    // The refusal for a job the actor is not assigned to. It says what to do
    // rather than what went wrong; the registration says it, and the check-out
    // said the same sentence for the same rule until #597.
    notYours: "Choose a job you are assigned to.",
};
