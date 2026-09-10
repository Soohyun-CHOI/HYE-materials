// Checking a tool item out and back in (#362) — the pure half of the tools
// track's first transition: what one press may do, what refuses it, and every
// word the screen says.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE PAGE. That is lib/prItemMerge.js's
// arrangement and lib/toolRegistration.js's one screen over, and it is why this
// is a module rather than lines inside the page: the page has to know what to
// OFFER and the action has to reach the same verdict about what to WRITE, and a
// Server Action is directly callable, so the second is not the first's
// consequence. One rule, two readers, no second implementation.
//
// IT IS NOT PART OF lib/toolItemView.js, WHICH IS THE OTHER PLACE IT COULD HAVE
// GONE. That module is what one tool item's page SHOWS, imported by the page
// alone. This one is imported by three — the page, the form and the action —
// and the third is not a screen at all. Keeping them apart leaves that module's
// name true and its check's title true with it.
//
// PURE AND OFFLINE-SAFE. It imports ./toolStatus.js, ./toolItemView.js and
// ./toolRegistration.js with the extension spelled out, which is
// lib/materialPriceView.js's precedent (#19): the offline tier runs under plain
// `node` with no loader. Nothing here reaches lib/airtable/, so the form — a
// "use client" file — can import it.
//
// EVERY STRING THE SCREEN RENDERS IS IN `TOOL_TRANSITION_COPY` AND NONE IS IN
// JSX, which is this axis's arrangement since #338 and what
// `offline/tool-list-view.mjs` holds by reading every file under app/(tools)/.
//
// THREE WORDS ARE IMPORTED RATHER THAN RE-SPELLED — the `Job` label, the
// unchosen-job option and the not-your-job refusal. They are the same control
// and the same rule on two screens, and a second copy of any of them is a
// second word for one fact the first time somebody rewords one; that is
// lib/toolListView.js's own reason for reading its three labels out of
// lib/toolItemView.js. `noJob` is NOT among them: the sentence names the act,
// and registering a tool item and recording a check-out are two acts.

import { TOOL_EVENT, eventOfferedBy } from "./toolStatus.js";
import { TOOL_ITEM_COPY } from "./toolItemView.js";
import { TOOL_REGISTRATION_COPY, assignedJobsFor } from "./toolRegistration.js";

/**
 * What this person may record against a tool item in this status, or why not.
 *
 * ONE FUNCTION FOR THE OFFER AND THE REFUSAL, so no call site can take one
 * without having consulted the other. That is `readQuantity`'s shape (#338) and
 * `pageOfToolItems`' (#339) for the same reason: a caller that assembles the
 * verdict itself is a caller that can assemble half of it.
 *
 * THE STATUS IS THE STORED ONE AND NEVER A SUBMITTED ONE. The page passes what
 * it read and the action passes what it re-read, so the offer is a fact about
 * the base rather than about the page a person was looking at. What the page
 * was looking at is `readSubmission`'s question.
 *
 * TWO REFUSALS AND THEIR ORDER IS DELIBERATE. A retired tool item offers nothing
 * to anybody, so it is answered before the reader is asked about at all —
 * telling somebody with no job assignment to go and get one, in front of a tool
 * item that would refuse them anyway, is a true sentence pointing at the wrong
 * problem.
 */
export function planTransition({ user, jobs, status }) {
    const event = eventOfferedBy(status);
    if (!event) {
        return { status, event: null, jobs: [], refusal: TOOL_TRANSITION_COPY.noTransition({ status }) };
    }

    const mine = assignedJobsFor(user, jobs);
    if (mine.length === 0) {
        return { status, event: null, jobs: [], refusal: TOOL_TRANSITION_COPY.noJob };
    }

    return { status, event, jobs: mine, refusal: null };
}

/**
 * Whether a submission still matches what the plan offers, and which job it names.
 *
 * THE EVENT IS COMPARED AND NEVER TAKEN. What gets written is `plan.event`, which
 * came from the stored status; the submitted one is read only to find out whether
 * the person was looking at this state when they pressed. That is
 * `registerToolItemsAction`'s rule about the job — the form's word for a fact is
 * evidence about the form, not about the base.
 *
 * WHAT THE COMPARISON ACTUALLY CLOSES IS A STALE PAGE, WHICH IS THE COMMON HALF OF
 * A RACE RATHER THAN ALL OF IT. Two invocations can still both read `In Stock` and
 * both write `Checked Out`; see the action's header for why no lock is added. What
 * this stops is the failure with a person behind it: a page opened an hour ago, or
 * left open while somebody else moved the tool, whose button says `Check out` while
 * the tool item is already `Out` — pressing it would record a check-in, which is
 * the app doing the opposite of what the control said.
 *
 * THE JOB IS ADMITTED ONLY FROM `plan.jobs`, so a forged submission cannot file an
 * event against a site the actor is not on. Nothing anywhere on this axis types a
 * job.
 */
export function readSubmission(plan, { event, jobId }) {
    if (plan.refusal) return { event: null, job: null, refusal: plan.refusal };

    if (event !== plan.event) {
        return {
            event: null,
            job: null,
            refusal: TOOL_TRANSITION_COPY.moved({ status: plan.status }),
        };
    }

    const job = plan.jobs.find((candidate) => candidate.id === jobId) ?? null;
    if (!job) {
        return { event: null, job: null, refusal: TOOL_TRANSITION_COPY.jobNotYours };
    }

    return { event: plan.event, job, refusal: null };
}

/**
 * The sentence for a transition that moves the tool item to another job, or null.
 *
 * THE ONE PLACE TWO `Job` VALUES MEET ON THIS SCREEN. The header states where the
 * tool item was last scanned and the control states where this event will be
 * recorded, and both are `Job` because both are the same fact — the job an event
 * happened on — which is what makes them one word rather than two. When they
 * differ, the difference is not a labeling problem to solve but the thing that is
 * happening: a tool carried from one site to another is checked in by whoever
 * receives it, and this app records that as it happened rather than refusing it.
 * So the screen says so.
 *
 * NULL WHERE THERE IS NOTHING TO SAY — the two agree, or one of them is not known
 * yet, which is what an unchosen picker looks like.
 */
export function jobMoveNotice({ from, to }) {
    if (!from || !to || from === to) return null;
    return TOOL_TRANSITION_COPY.movesJob({ from, to });
}

/**
 * Every word the transition adds to the tool item's page.
 *
 * THE SECTION HAS NO HEADING WORD, AND THAT IS A DECISION RATHER THAN AN OMISSION.
 * The two headings already on this page name things — `Label`, `History`. A
 * heading over the control would have to name the ACT generically, and every
 * candidate for that is an explanatory word rather than one this app says:
 * `transition` is what these notes call it, the way `kind` is what they call what
 * separates `Tools` from `Tool Items`, and #338 records how close `kind` came to
 * reaching a column head by accident. The control names itself.
 */
export const TOOL_TRANSITION_COPY = {
    // KEYED BY THE EVENT RATHER THAN WRITTEN AS TWO FIELDS, so a fifth event
    // cannot arrive without a word for it — `summarizeTools` builds its row from
    // `TOOL_STATUS_VALUES` for the same reason, and the check asserts every event
    // this screen can offer has an entry here.
    //
    // THE IMPERATIVE IS THE CONTROL AND THE PARTICIPLE IS THE RECORD, which is
    // not two words for one fact: `Approve` / `Approved` and `Withdraw this PO` /
    // `Withdrawn` already draw the same pair. The event stored in `Tool Log` is
    // `Checked Out`; the thing a person presses is `Check out`.
    //
    // NO MODIFIER ON EITHER, per #303's rule for a label with no sentence around
    // it: nothing else on this screen competes for the words, so `Check out` names
    // its subject the way the screen's own heading does.
    control: {
        [TOOL_EVENT.CHECKED_OUT]: "Check out",
        [TOOL_EVENT.CHECKED_IN]: "Check in",
    },

    // The same control and the same rule as the registration form's, so the same
    // words. See the header for which three are shared and why `noJob` is not.
    jobLabel: TOOL_ITEM_COPY.jobLabel,
    jobUnchosen: TOOL_REGISTRATION_COPY.jobUnchosen,
    jobNotYours: TOOL_REGISTRATION_COPY.jobNotYours,

    // A person with no assignment cannot record an event, and the screen says what
    // to do rather than what went wrong: there is no self-service path to a job
    // assignment, so the only next step is asking for one. Registration's sentence
    // says the same thing about a different act.
    noJob:
        "You are not assigned to a job, so there is no job to record this on. " +
        "Ask for a job assignment first.",

    // BUILT FROM THE STATUS RATHER THAN NAMING `Retired`, because the sentence is
    // about a status offering nothing and `Retired` is only the one that does that
    // today. Unreachable until #363 writes that row — the offline check holds it,
    // and the first reader will be that issue's.
    noTransition: ({ status }) =>
        `This tool item is ${status}, so there is no check-out or check-in to record.`,

    // The page a person pressed is not the base's answer any more. It names the
    // status rather than the act, because what they need is where the tool item
    // actually is; the control they meet after reopening will say the rest.
    moved: ({ status }) =>
        `This page is out of date: the tool item is ${status} now. ` +
        `Open it again before recording anything.`,

    // See jobMoveNotice.
    movesJob: ({ from, to }) =>
        `This tool item was last scanned on ${from}. Recording this on ${to} moves it there.`,

    // THE ONE STATE WHERE THE LOG AND THE TOOL ITEM'S OWN STATUS DISAGREE, named
    // on screen rather than repaired — the shape `lib/rollbackReport.js` already
    // has for a failed restore, and #338's for a tool item whose registration row
    // was not written. It says three things a person can act on: the event is
    // safely on the record, what everybody else will read until this is fixed, and
    // that pressing again fixes it. It does, in both directions: the next press
    // offers the transition the stale status implies, records that event again and
    // writes the status, and the two agree. The cost is a duplicate log row, which
    // is what an append-only log already pays for a mistaken scan.
    statusNotUpdated: ({ toolItemId, event, status }) =>
        `${event} was recorded against ${toolItemId}, but its status was not updated — ` +
        `it still reads ${status}, and the tool lists will say so. Do it again.`,
};
