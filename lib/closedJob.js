// Whether a job's work has ended (#488), the jobs a new choice of one offers, and every word a
// closed job says.
//
// A JOB IS CLOSED WHILE ITS `Closed Date` HOLDS A DAY, whichever day it is, and open while it holds
// none. The office types the day in Airtable until the job's page (#487) closes and reopens a job;
// `lib/airtable/jobs.js` reads it with the rest of the row as `closedDate`, so no screen spends a read
// on it. Why one date and no checkbox is `docs/notes/naming.md`'s.
//
// A CLOSED JOB IS OFFERED NOWHERE A JOB IS NEWLY CHOSEN, AND EVERY ONE OF THOSE PLACES ASKS THIS
// MODULE: a purchase request, a delivery, a direct purchase, an asset's registration, its lending
// and the office's change of its job, the sign-in job step, a new address and a new discipline. The
// screen offers `offeredJobs`, and the write behind it asks `closedJobRefusal` of the job it is
// about to name, before its first write — so the list a page draws and what its action accepts are
// one judgment, and a press sent without the page meets the same one.
//
// WHAT A RECORD ALREADY NAMES IS NOT A NEW CHOICE. A draft request on a job that has since closed
// keeps it, a lending left half done is finished to its job, and an asset's own job stays its own:
// each place hands the job its record holds as `held`, and a held job is offered and accepted
// closed or not. Every screen that only shows a job — a document, an asset, an asset log row, a
// list's filter — never asks this module, and the Equipment & Tools list's job choice keeps every
// job, closed ones included (`lib/assetListView.js:assetListScope`), since what is on a closed
// job's site is still there and still recorded.
//
// PURE AND OFFLINE-SAFE, importing nothing, so `offline/closed-job.mjs` can call every function
// here and the "use client" forms that reach it through the assets axis's modules can import it.

/** The ids a caller holds, from one id, none, or several. */
function heldIds(held) {
    return new Set((Array.isArray(held) ? held : [held]).filter((id) => typeof id === "string" && id !== ""));
}

/** Whether this job's work has ended: its `Closed Date` holds a day. */
export function isClosed(job) {
    return typeof job?.closedDate === "string" && job.closedDate !== "";
}

/**
 * The jobs a new choice offers, out of a loaded list and in its order: every open one, and the one
 * the record being chosen for already names (`held`, an id or several), closed or not.
 */
export function offeredJobs(jobs, held = []) {
    const keep = heldIds(held);
    return (Array.isArray(jobs) ? jobs : []).filter((job) => !isClosed(job) || keep.has(job.id));
}

/**
 * Why a write may not name this job, or null: it is closed and the record does not already name it
 * (`held`). A job that is not a value is no refusal of this module's — each write says its own words
 * for a job missing or not its reader's.
 */
export function closedJobRefusal(job, held = []) {
    if (!job || !isClosed(job) || heldIds(held).has(job.id)) return null;
    return CLOSED_JOB_COPY.refusal(job.jobCode);
}

/**
 * Whether a screen's choice is empty because every job it may offer is closed, and which of two
 * sentences says so (#488): null when it offers a job, or when it may offer none at all (the
 * screen's own `not assigned` case); `"every"` when the reader may use every job there is, the
 * office's case; and `"yours"` otherwise — the jobs a site reader is assigned to.
 *
 * `jobs` is every job, `reachable` the ones this reader may use. Comparing the two tells the office
 * from a site with no office clause of this module's own, and it is true either way: a reader who
 * may use every job is told every job is closed. A job a draft keeps once closed is no open job,
 * so the sentence stands under it too — it is why nothing else is offered.
 */
export function noOpenJob(jobs, reachable) {
    const mine = Array.isArray(reachable) ? reachable : [];
    if (mine.length === 0 || offeredJobs(mine).length > 0) return null;
    return mine.length === (Array.isArray(jobs) ? jobs.length : 0) ? "every" : "yours";
}

/**
 * Every word a closed job says. The refusal states the fact and no verb: the screens choosing a job
 * say `Select`, `Pick` and `Choose`, and the choice drawn again under it says what to do. The two
 * screens whose choice can be left empty by closed jobs say why, each in the shape of its own
 * `not assigned` sentence.
 */
export const CLOSED_JOB_COPY = {
    refusal: (jobCode) => `${jobCode || "That job"} is closed.`,
    noOpenJob: {
        delivery: {
            every: "Every job is closed, so there is nothing to record a delivery against.",
            yours:
                "Every job you are assigned to is closed, so there is nothing to record a delivery against. " +
                "An Admin can add you to a job in Airtable.",
        },
        request: {
            every: "Every job is closed, so there is no job to raise a request on.",
            yours:
                "Every job you are assigned to is closed, so there is no job to raise a request on. " +
                "An Admin can add you to a job in Airtable.",
        },
    },
};
