// The job a `Tool Log` row is filed against (#363) — whose jobs an actor may
// pick, and the two words the picker says.
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
 * The two words the job picker says, wherever it appears on this axis.
 *
 * BOTH SCREENS READ THESE RATHER THAN SPELLING THEM, which is the whole reason
 * they moved: it is one control and one rule on two screens, and a second copy
 * of either is a second word for one fact the first time somebody rewords one.
 * Each screen's own copy constant keeps its existing key names and reads the
 * value from here, so no component changed when this moved.
 */
export const TOOL_JOB_COPY = {
    // A picker with nothing chosen needs a word that is not the field's own name.
    // Measured in a browser (#338): with the label reused, the control read
    // `Job / Job / 26-DEMO-01`, one word standing for both the axis and the
    // absence of a value — the distinction `Payment` / `Paid` already draws
    // between a column head and a cell.
    unchosen: "Pick a job",

    // The refusal for a job the actor is not assigned to. It says what to do
    // rather than what went wrong, and it is the same sentence on both screens
    // because it is the same rule being applied.
    notYours: "Pick a job you are assigned to.",
};
