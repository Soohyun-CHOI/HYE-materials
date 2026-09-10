// What a person may record against a tool item (#362, #363) — the pure half of
// both transitions its page offers: which of them a status allows, what refuses
// them, and every word the screen says.
//
// TWO TRANSITIONS OF DIFFERENT KINDS, WHICH IS lib/toolStatus.js's OWN SPLIT
// APPLIED TO A SCREEN. A check-out or a check-in is SCANNED — one press, because
// the next press undoes it. Retiring is DESIGNATED and has no way back, so it
// takes a modal that says what becomes true before it happens. They are in one
// module because they are one screen's rule, one job rule and one set of
// refusals; what differs is the weight, and that is a difference the two
// controls carry rather than two modules.
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
// ./toolJob.js with the extension spelled out, which is
// lib/materialPriceView.js's precedent (#19): the offline tier runs under plain
// `node` with no loader. Nothing here reaches lib/airtable/, so both forms —
// "use client" files — can import it.
//
// EVERY STRING THE SCREEN RENDERS IS IN `TOOL_TRANSITION_COPY` AND NONE IS IN
// JSX, which is this axis's arrangement since #338 and what
// `offline/tool-list-view.mjs` holds by reading every file under app/(tools)/.
//
// THREE WORDS ARE IMPORTED RATHER THAN RE-SPELLED — the `Job` label from the
// screen's own constant, and the picker's two from lib/toolJob.js. They are one
// control and one rule on two screens, and a second copy of any of them is a
// second word for one fact the first time somebody rewords one; that is
// lib/toolListView.js's own reason for reading its three labels out of
// lib/toolItemView.js. `noJob` is NOT among them: the sentence names the act,
// and registering a tool item and recording an event against one are two acts.

import { TOOL_EVENT, eventOfferedBy, mayRetireFrom } from "./toolStatus.js";
import { TOOL_ITEM_COPY } from "./toolItemView.js";
import { TOOL_JOB_COPY, assignedJobsFor } from "./toolJob.js";

/**
 * What this person may record against a tool item in this status, or why not.
 *
 * ONE FUNCTION FOR BOTH CONTROLS AND THE REFUSAL, so no call site can take one
 * without having consulted the other. That is `readQuantity`'s shape (#338) and
 * `pageOfToolItems`' (#339) for the same reason: a caller that assembles the
 * verdict itself is a caller that can assemble half of it. #363 widened it
 * rather than adding a second planner, because the two refusals below are the
 * same two for either control — a terminal status offers neither, and somebody
 * on no job may record neither.
 *
 * THE TWO ANSWERS COME FROM TWO MAPS AND NOT FROM EACH OTHER. `event` is what a
 * SCAN offers and `mayRetire` is whether a person may DESIGNATE the end; they
 * agree on today's three statuses and lib/toolStatus.js records why that is a
 * coincidence rather than a derivation.
 *
 * THE STATUS IS THE STORED ONE AND NEVER A SUBMITTED ONE. The page passes what
 * it read and the action passes what it re-read, so the offer is a fact about
 * the base rather than about the page a person was looking at. What the page
 * was looking at is `readSubmission`'s question.
 *
 * TWO REFUSALS AND THEIR ORDER IS DELIBERATE. A terminal tool item offers
 * nothing to anybody, so it is answered before the reader is asked about at all
 * — telling somebody with no job assignment to go and get one, in front of a
 * tool item that would refuse them anyway, is a true sentence pointing at the
 * wrong problem.
 */
export function planTransition({ user, jobs, status }) {
    const event = eventOfferedBy(status);
    const mayRetire = mayRetireFrom(status);

    if (!event && !mayRetire) {
        return {
            status,
            event: null,
            mayRetire: false,
            jobs: [],
            refusal: TOOL_TRANSITION_COPY.noTransition({ status }),
        };
    }

    const mine = assignedJobsFor(user, jobs);
    if (mine.length === 0) {
        return { status, event: null, mayRetire: false, jobs: [], refusal: TOOL_TRANSITION_COPY.noJob };
    }

    return { status, event, mayRetire, jobs: mine, refusal: null };
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
 * Whether a retirement may be recorded, and which job it names (#363).
 *
 * NO EVENT IS SUBMITTED AND NONE IS COMPARED, which is the one place this parts
 * from `readSubmission` above. A scan transition has two directions and the
 * button names one of them, so the form's word has to be checked against the
 * stored status or the app can record the opposite of what it said. Retiring
 * has one direction: `Retired` from anywhere it is allowed. There is nothing a
 * stale page could have named wrongly, so there is nothing to compare, and the
 * action writes `TOOL_EVENT.RETIRED` from the vocabulary rather than from any
 * value that crossed the wire.
 *
 * A STALE PAGE IS THEREFORE ANSWERED BY THE PLAN RATHER THAN BY A COMPARISON.
 * If somebody else retired the tool item first, the fresh read makes `mayRetire`
 * false and the refusal is the terminal sentence — which is the true one.
 *
 * THE SECOND GUARD IS UNREACHABLE ON TODAY'S VOCABULARY AND IS NOT DEAD CODE. A
 * status is un-retirable only when it is terminal, and a terminal status has
 * already produced `plan.refusal`, so the two branches say the same sentence.
 * What it is there for is a Server Action being directly callable against a
 * FOURTH status that offers a scan and forbids a retirement — and the sentence
 * would then be slightly wrong, which is a thing the issue adding that status
 * has to fix. `MAY_RETIRE_FROM_STATUS`'s throw is what forces it to look.
 *
 * THE JOB IS ADMITTED ONLY FROM `plan.jobs`, exactly as above: a retirement
 * happens on a site too, and `Tool Log."Job"` is never blank.
 */
export function readRetirement(plan, { jobId }) {
    if (plan.refusal) return { job: null, refusal: plan.refusal };

    if (!plan.mayRetire) {
        return { job: null, refusal: TOOL_TRANSITION_COPY.noTransition({ status: plan.status }) };
    }

    const job = plan.jobs.find((candidate) => candidate.id === jobId) ?? null;
    if (!job) return { job: null, refusal: TOOL_TRANSITION_COPY.jobNotYours };

    return { job, refusal: null };
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
    // Both transitions on this screen use them — the modal carries the picker
    // too, since a retirement happens on a site like anything else here.
    jobLabel: TOOL_ITEM_COPY.jobLabel,
    jobUnchosen: TOOL_JOB_COPY.unchosen,
    jobNotYours: TOOL_JOB_COPY.notYours,

    // A person with no assignment cannot record an event, and the screen says what
    // to do rather than what went wrong: there is no self-service path to a job
    // assignment, so the only next step is asking for one. Registration's sentence
    // says the same thing about a different act.
    noJob:
        "You are not assigned to a job, so there is no job to record this on. " +
        "Ask for a job assignment first.",

    // BUILT FROM THE STATUS RATHER THAN NAMING `Retired`, because the sentence is
    // about a status that allows nothing and `Retired` is only the one that does
    // that today.
    //
    // #362 WROTE IT AS `no check-out or check-in to record` AND #363 WIDENED IT
    // IN THE SAME COMMIT AS THE THING THAT MADE IT NARROW. With a retire control
    // beside the transition, a sentence naming two of the three absent controls
    // enumerates rather than states, and the fact a reader needs is that the
    // status is the end. It is also the sentence a person meets immediately
    // after retiring, which is what makes the terminal reading the useful one.
    noTransition: ({ status }) =>
        `This tool item is ${status}, so nothing more can be recorded against it.`,

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

    // ── retiring (#363) ────────────────────────────────────────────────────
    //
    // THE OPENER NAMES ITS OBJECT WHERE THE TRANSITION CONTROLS DO NOT, and that
    // is not decoration: `Check out` and `Retire this tool item` sit on one
    // screen, one is pressed dozens of times a day and one is that tool item's
    // last, and the words are the half of the difference this file owns. The
    // other half is structural — the transition control SUBMITS and this one
    // OPENS — and no styling can collapse either. `Withdraw this PO` is the
    // precedent for both the shape and the wording.
    retireOpener: "Retire this tool item",

    // The heading repeats the opener as a question, which is `Withdraw this PO`
    // / `Withdraw this PO?` exactly. A person who opened this by accident should
    // meet the thing they pressed.
    retireHeading: "Retire this tool item?",

    // THE BODY IS THE WHOLE POINT OF THE MODAL AND NOT A WARNING WRAPPED AROUND
    // A BUTTON. `docs/briefs/_shared.md` says it of the three deletion voices:
    // they are accurate accounts of what becomes true, and that voice is what a
    // confirmation is for. Three facts, in the order a person needs them — it
    // leaves the count, nothing further can be recorded, and the record stays —
    // and then the app's one ending for an act with no way back.
    retireBody:
        "It stops counting as something the company holds, and nothing more can be " +
        "recorded against it. Its row and its whole history stay. This cannot be undone.",

    // Inside a modal the heading has already named the object, so #303's rule
    // for a label with no sentence around it drops the modifier.
    retireSubmit: "Retire",
    // The app's word for abandoning a modal, unchanged from every other one.
    retireCancel: "Cancel",
};
