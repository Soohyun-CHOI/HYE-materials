// The job a `Tool Log` row is filed against (#363) — whose jobs an actor may
// pick, and the words the picker says.
//
// IT LIVED IN lib/toolRegistration.js UNTIL THE THIRD CALLER, WHICH IS THE
// MECHANISM RATHER THAN A TIDY-UP. #338 wrote `assignedJobsFor` for the
// registration form and #362 read it from the transition screen, leaving the
// module's name narrower than its contents and writing the move condition down:
// a third caller. Retiring a tool item is the third — every `Tool Log` row
// carries a job and every one of them takes it from the actor — so this is
// `countsAsOrdered`'s path exactly, which sat in lib/materialPriceView.js with
// the same condition until #169 fired it (docs/notes/verification.md).
//
// WHAT DID NOT COME WITH IT, and both absences are decisions. `canRegisterTool
// Items` stays behind: its name and its screen are registration's, and it is
// that form asking whether this person may use it. The two `noJob` sentences
// stay on their screens, because each names its own act — registering a tool
// item and recording an event against one are not the same thing to tell
// somebody they cannot do.
//
// `Job` IS NOT HERE EITHER. That label is the tool item page's header, its
// history rows and this picker all naming one field, so it lives with the
// screen that has the most of it — lib/toolItemView.js:TOOL_ITEM_COPY — and
// both forms read it from there.
//
// PURE AND OFFLINE-SAFE, importing nothing. `scripts/tests/offline/
// tool-job.mjs` pins it with no credentials, and both forms are "use client"
// files that reach it through their own copy constants.

/**
 * The jobs this person may file a `Tool Log` event against, out of a loaded list.
 *
 * THEIR OWN ASSIGNMENTS, AND DELIBERATELY WITH NO OFFICE CLAUSE — which is what
 * makes this a different judgment from `lib/deliveryAccess.js:accessibleJobs`
 * rather than a second copy of it. That one admits President and Admin to every
 * job, because invoicing and reconciliation are office work and an Admin can
 * already delete a delivery. The tools track does not pass through the office at
 * all: a site person buys the tool, registers it and keeps it, and the job a
 * `Tool Log` row carries is the job the event HAPPENED on. An Admin assigned to
 * no job has no such job, so there is nothing for them to file an event against
 * and widening this would invent one.
 *
 * Nobody types a job anywhere on this axis. One assignment is used without
 * asking, several are chosen from, and none is a refusal — see the copy below.
 */
export function assignedJobsFor(user, jobs) {
    const assigned = new Set(user?.assignedJobs || []);
    return (jobs || []).filter((job) => assigned.has(job.id));
}

/**
 * The job a person on exactly one assignment files against, or null (#458).
 *
 * "ONE ASSIGNMENT IS USED WITHOUT ASKING" IS THIS FUNCTION, AND NOTHING ELSE SPELLS IT.
 * The registration's choice starts on it, the transition's choice starts on it, and a
 * check-in records on the press only when there is one — `lib/toolTransition.js:
 * asksBeforeRecording` — so three screens' readings of "one job" are one expression.
 * `jobs` is `assignedJobsFor`'s answer, never the whole table.
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
 * could not act, seen in a browser in #469. The transition's dialog asked it inline until
 * #463 gave the phone's foot bar the same choice, which is the second reader.
 */
export function chosenJobId(jobs, jobId) {
    if (jobId && (jobs || []).some((job) => job.id === jobId)) return jobId;
    return onlyJob(jobs)?.id ?? "";
}

/**
 * The words the job picker says, wherever it appears on this axis.
 *
 * BOTH SCREENS READ THESE RATHER THAN SPELLING THEM, which is the whole reason
 * they moved: it is one control and one rule on two screens, and a second copy
 * of either is a second word for one fact the first time somebody rewords one.
 * Each screen's own copy constant keeps its existing key names and reads the
 * value from here, so no component changed when this moved.
 *
 * THE VERB IS THE DESIGN'S SINCE #456, `Choose` where it was `Pick`: 0l writes a
 * choice with nothing chosen as `Choose a …`, and the registration dialog is the
 * first screen drawn from it. The check-out's picker on the tool item page says
 * the same words from the same keys, so it moved with it.
 */
export const TOOL_JOB_COPY = {
    // A picker with nothing chosen needs a word that is not the field's own name.
    // Measured in a browser (#338): with the label reused, the control read
    // `Job / Job / 26-DEMO-01`, one word standing for both the axis and the
    // absence of a value — the distinction `Payment` / `Paid` already draws
    // between a column head and a cell.
    unchosen: "Choose a job",

    // The refusal for a submission that chose no job at all — the design's, for the
    // field left at its placeholder (1j). A different fact from the one below: this
    // reader simply has not chosen yet.
    noneChosen: "Choose a job.",

    // The refusal for a job the actor is not assigned to. It says what to do
    // rather than what went wrong, and it is the same sentence on both screens
    // because it is the same rule being applied.
    notYours: "Choose a job you are assigned to.",
};
