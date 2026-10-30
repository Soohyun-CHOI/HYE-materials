// The jobs a reader is asked for at sign-in (#554), and the one place that decides it.
//
// A PERSON'S JOBS WERE SET BY HAND IN AIRTABLE AND NOWHERE ELSE, so somebody who signed in
// before the office had assigned them stood on Tools & Equipment's `No job yet` and could do
// nothing until the office was told. The step after the name asks them instead: which jobs
// they work on, every job there is to pick from, and what they pick is their `Assigned Jobs`.
// It is asked once — the first assignment — and a reader holding a job is never shown it
// again: their jobs are the office's to change from then on, by hand as before.
//
// WHO IS ASKED IS A PROPERTY OF THE ROW THE SESSION ALREADY READ. `requireUser()` asks
// `needsJobs` of the user `getActiveUser()` fetched, so the question costs no Airtable
// operation on any screen, exactly as `needsName` costs none (#381). It asks only a reader
// who has a name, so the name comes first and this step second without either knowing the
// other's address.
//
// THE OFFICE AND THE PRESIDENT ARE NOT ASKED, and that clause is this module's own. It is
// the same pair `lib/deliveryAccess.js:canAccessJobDeliveries` admits to every job without an
// assignment, which is why neither needs one to work; but that is a different question — may
// this person act on this job — and the assets axis's list stands every reader on every job
// since #593 (`lib/assetListView.js:assetListScope`), so there is no one "on every job" rule in
// the app for both to read. A reader neither asked nor assigned — the office or the President
// with no job — starts that list on all jobs, where `No job yet` stood until #593.
//
// PURE AND OFFLINE-SAFE, its imports spelled with their extensions, so `offline/user-jobs.mjs`
// can call every function here and the step's form — a `"use client"` file — can import it.

import { compareCatalogText } from "./assetCategory.js";
import { DESTINATION_PARAM, safeDestination } from "./loginDestination.js";
import { needsName } from "./userName.js";
import { matchesTokens, searchTokens } from "./searchTokens.js";

/**
 * The address a reader with no job is sent to. Under `/login` for `lib/userName.js`'s
 * reason: it is a step of the sign-in flow, the design's own address for it (Sign in 1k), and
 * `lib/loginDestination.js` bars everything under `/login` from being a destination, so
 * nothing can deliver a reader back into it.
 */
const JOBS_PATH = "/login/jobs";

/** The form field each chosen job's record id is sent in, once per job. */
export const JOBS_PARAM = "job";

/**
 * The job step, carrying where the reader was going. It judges the destination itself,
 * as every builder of a sign-in address does (#373).
 */
export function jobsPath(destination) {
    const safe = safeDestination(destination);
    return safe ? `${JOBS_PATH}?${DESTINATION_PARAM}=${encodeURIComponent(safe)}` : JOBS_PATH;
}

/**
 * Is this address the job step itself? What stops the gate redirecting the step to itself,
 * and a predicate rather than a comparison in `lib/authz.js`, which must not spell the address.
 */
export function isJobsStep(path) {
    return String(path ?? "").split("?")[0] === JOBS_PATH;
}

/**
 * Is this reader asked for their jobs? Somebody with a name, neither the office (`Is Admin`)
 * nor the President, whose `Assigned Jobs` holds none.
 *
 * A READER WITH NO NAME IS NOT ASKED YET, so the name step comes first wherever the two meet:
 * the gate asks for the name, and this answers no until there is one.
 */
export function needsJobs(user) {
    if (!user || needsName(user)) return false;
    if (user.isAdmin === true || user.role === "President") return false;
    return !(Array.isArray(user.assignedJobs) && user.assignedJobs.length > 0);
}

/**
 * Every job there is, in the order the asset lists say them — by code, a run of digits read as
 * a number (`compareCatalogText`) — as `{ id, jobCode, jobName }`. The step offers all of them:
 * which jobs a person works on is theirs to say, and the office corrects it.
 */
export function jobsOffered(jobs) {
    const all = Array.isArray(jobs) ? jobs : [];
    return all
        .map(({ id, jobCode, jobName }) => ({ id, jobCode: jobCode ?? "", jobName: jobName ?? "" }))
        .sort((a, b) => compareCatalogText(a.jobCode, b.jobCode));
}

/**
 * The ids a submission chose that are jobs now, once each and in the jobs' own order.
 *
 * A JOB GONE SINCE THE PAGE WAS DRAWN IS LEFT OUT RATHER THAN REFUSED: there is nothing left to
 * assign, and the rest of the reader's choice still stands. Anything that is not a job's id —
 * a forged one, another table's — is left out the same way, so nothing but a job's id reaches
 * the write.
 */
export function chosenJobIds(asked, jobs) {
    const wanted = new Set((Array.isArray(asked) ? asked : []).map(String));
    return jobsOffered(jobs)
        .filter((job) => wanted.has(job.id))
        .map((job) => job.id);
}

/**
 * The rows the step lists for what is typed (Sign in 1k, 1l): every job while nothing is, and
 * otherwise the jobs whose code and name carry every word typed — `lib/searchTokens.js`'s
 * rule, the app's one for a search box.
 *
 * WHILE SEARCHING, THE JOBS CHOSEN BEFORE THE SEARCH BEGAN STAY AT THE TOP, as the design draws
 * it: `pinned` is the choice as it stood when the first character was typed, and those of them
 * the search does not find stand first, the matches after them, both in code order. A job
 * chosen during the search is not pinned, so it leaves the list when the search moves past it.
 * `noMatch` is a search that found nothing, which the step says beneath any pinned rows.
 */
export function jobRows({ jobs, chosen = [], query = "", pinned = [] }) {
    const all = jobsOffered(jobs);
    const on = new Set(chosen);
    const rowOf = (job) => ({ ...job, on: on.has(job.id) });
    const tokens = searchTokens(query);
    if (tokens.length === 0) return { rows: all.map(rowOf), noMatch: false };
    const hits = all.filter((job) => matchesTokens(`${job.jobCode} ${job.jobName}`, tokens));
    const found = new Set(hits.map((job) => job.id));
    const held = new Set(pinned);
    const kept = all.filter((job) => held.has(job.id) && !found.has(job.id));
    return { rows: [...kept, ...hits].map(rowOf), noMatch: hits.length === 0 };
}

/**
 * Everything the job step says (Sign in 1k, 1l). The design's words, but for `failed`, which
 * it draws no state for: the name step's sentence for a write that did not happen, about jobs.
 */
export const USER_JOBS_COPY = {
    heading: "Choose your jobs",
    sentence: "Pick every job you work on.",
    search: "Search jobs",
    list: "Jobs",
    noneMatch: "No jobs match",
    /** The query a search found nothing for, as the step echoes it after `noneMatch`. */
    echo: (query) => `“${String(query ?? "").trim()}”`,
    /** The action: how many it saves, once any is chosen. */
    action: (count) => (count > 0 ? `Continue with ${count} ${count === 1 ? "job" : "jobs"}` : "Continue"),
    working: "Saving…",
    refusal: {
        none: "Choose at least one job.",
        failed: "Couldn't save your jobs. Try again.",
    },
};
