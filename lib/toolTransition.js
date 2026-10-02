// What a person may record against a tool item (#362, #363) — the pure half of
// both transitions its page offers: which of them a status allows, what refuses
// them, and every word the screen says.
//
// TWO TRANSITIONS OF DIFFERENT KINDS, WHICH IS lib/toolStatus.js's OWN SPLIT
// APPLIED TO A SCREEN. A check-out or a check-in is SCANNED, and the next scan
// undoes it, so it asks only what the page cannot know: a check-out opens a dialog
// for who the tool goes to, and a check-in is one press for a person on one job and
// a dialog for one on several (#458, `asksBeforeRecording`). Retiring is DESIGNATED
// and has no way back, so its dialog asks a question naming the tool before it
// happens. They are in one module because they are one screen's rule and one set of
// refusals.
//
// AND THAT SAME SPLIT DECIDES WHERE EACH ONE'S JOB COMES FROM, which is the
// second thing that differs and the one that is easy to get wrong. A scan takes
// it from the actor, because the actor is holding the tool. A retirement takes
// it from the tool item, because designating is not handling — see
// `readRetirement`, which carries the argument and the row on this base that
// proved it. This paragraph said "one job rule" until #363 measured otherwise.
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
// alone. This one is imported by the page, the two dialogs and the action, and
// the action is not a screen at all. Keeping them apart leaves that module's
// name true and its check's title true with it.
//
// PURE AND OFFLINE-SAFE. It imports ./toolStatus.js, ./toolItemView.js and
// ./toolJob.js with the extension spelled out, which is
// lib/materialPriceView.js's precedent (#19): the offline tier runs under plain
// `node` with no loader. Nothing here reaches lib/airtable/, so the dialogs —
// "use client" files — can import it, and the transition's asks `readSubmission`
// before it sends exactly as the action asks it after (#458).
//
// EVERY STRING THE SCREEN RENDERS IS IN `TOOL_TRANSITION_COPY` AND NONE IS IN
// JSX, which is this axis's arrangement since #338 and what
// `offline/tool-list-view.mjs` holds by reading every file under app/(tools)/.
//
// AND #376 PUT THE RECIPIENT HERE RATHER THAN IN A MODULE OF ITS OWN. Who a tool
// went to is part of what a check-out records, which is this module's subject, and
// its readers are the two this module already has — the page that offers the
// control and the action that writes the row. A module of its own would also cost
// a line in CLAUDE.md's service-layer list, which was at its ceiling when #376
// decided this. THE CONDITION FOR SPLITTING IT OUT IS A THIRD CONSUMER, which is
// `assignedJobsFor`'s mechanism twice measured: that one sat under a narrower name
// until #363 was the third caller, and `countsAsOrdered` before it.
//
// FOUR WORDS ARE IMPORTED RATHER THAN RE-SPELLED — the `Job` label and, since
// #376, the `Checked out to` one from the screen's own constant, and the picker's
// two from lib/toolJob.js. They are one control and one rule on two screens, and a
// second copy of any of them is a second word for one fact the first time somebody
// rewords one; that is lib/toolListView.js's own reason for reading its three
// labels out of lib/toolItemView.js. The fourth is the sharpest case: this control
// writes the history entry that `logRowFacts` labels, so the two are literally the
// same word on the same screen. `noJob` is NOT among them: the sentence names the
// act, and registering a tool item and recording an event against one are two acts.

import { TOOL_EVENT, eventOfferedBy, mayRetireFrom } from "./toolStatus.js";
import { TOOL_ITEM_COPY } from "./toolItemView.js";
import { TOOL_JOB_COPY, assignedJobsFor, onlyJob } from "./toolJob.js";
import { normalizeItemText, textMatchKey } from "./itemNaming.js";

/**
 * How many recent names are offered before anybody types (#376) — the rows of the name
 * sheet a phone types in, and the suggestions under the dialog's field (#458).
 *
 * A DISPLAY CHOICE OVER A COMPLETE LIST, WHICH IS THE WHOLE REASON IT IS A NUMBER
 * HERE RATHER THAN A LIMIT ON THE QUERY. `recentNamesFor` folds every name the
 * page loaded for this job, and typing narrows that whole list — so a name below
 * the cut is one keystroke away rather than absent. That makes this Design's to
 * change, and the brief says so; a server-side limit would have made it a fact
 * about the data that no design could move.
 */
export const RECENT_NAMES_SHOWN = 3;

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
 * Whether the offered transition asks something before it records — a dialog — or
 * records on the press (#458).
 *
 * IT ASKS ONLY WHAT THE PAGE CANNOT KNOW, AND THE TWO QUESTIONS ARE OLDER THAN THE
 * DIALOG. A check-out records who the tool went to (#376), so it always asks. A job is
 * stated when the person holds one assignment and chosen when they hold several, which is
 * #338's rule as #362 read it for this screen and `onlyJob` is its one spelling — so a
 * check-in asks only a person on several jobs, and for a person on one it is the press
 * the screen offered before the design drew the dialogs. The design draws exactly that
 * split (1d's check-in records on the press; 1e's is a dialog for somebody on several).
 *
 * A PLAN THAT REFUSES HAS NOTHING TO OFFER, so the page never asks this of one: a terminal
 * status and a person with no job are both answered before any control is drawn.
 */
export function asksBeforeRecording(plan) {
    return plan.event === TOOL_EVENT.CHECKED_OUT || onlyJob(plan.jobs) === null;
}

/**
 * The people this job has recently handed tools to, most recent first (#376).
 *
 * ONE ENTRY PER PERSON, FOLDED ON THE KEY THE WHOLE APP TYPES AGAINST. `Mike R`
 * and `mike r` are one person, so they are one entry — `itemNaming.js:textMatchKey`
 * is the fold, the same one a tool's name has used since #338, and writing a second
 * one here would be two answers to "are these the same person" the first time
 * somebody touched one of them.
 *
 * THE SPELLING SHOWN IS THE MOST RECENT ONE, which falls out of walking newest
 * first and keeping the first of each key rather than being a rule of its own. It
 * is the useful direction: somebody who corrects how their name is written sees the
 * correction, where keeping the oldest would make the list argue with them.
 *
 * SORTED HERE RATHER THAN TRUSTED FROM THE READER. The query asks Airtable for
 * `Event At` descending and this sorts again, which is not belt-and-braces — the
 * ordering is the RULE ("most recently checked out to") and a rule that lives in a
 * query option cannot be checked without credentials. `Event At` is a stored UTC
 * ISO 8601 instant, so comparing the strings is comparing the moments.
 *
 * SCOPED TO ONE JOB, THE ONE THE EVENT WILL BE RECORDED ON. The page loads the
 * rows for every job its reader is assigned to, because a person with two jobs can
 * move the picker and a second round trip per move is exactly what this arrangement
 * exists to avoid; narrowing to the chosen one happens here.
 *
 * ONLY `Checked Out` ROWS CARRY A NAME, so only they are read. A row of any other
 * event with one is a defect upstream — `createToolLogEntry` refuses to write it —
 * and this would ignore it rather than showing it.
 */
export function recentNamesFor(rows, { jobCode }) {
    if (!jobCode) return [];
    const seen = new Set();
    const out = [];
    for (const row of (rows || [])
        .filter((r) => r?.event === TOOL_EVENT.CHECKED_OUT && r?.jobCode === jobCode)
        .filter((r) => textMatchKey(r.checkedOutTo))
        .sort((a, b) => String(b.eventAt ?? "").localeCompare(String(a.eventAt ?? "")))) {
        const key = textMatchKey(row.checkedOutTo);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(normalizeItemText(row.checkedOutTo));
    }
    return out;
}

/**
 * The recent names a typed fragment still matches (#376).
 *
 * IN THE BROWSER AND NEVER AT THE SERVER, which is #338's arrangement one screen
 * over: the page loads the list once and the dialog narrows it as somebody types, so
 * a keystroke costs nothing. The whole list is the haystack rather than the few
 * offered first, which is what makes the shown count a display choice.
 *
 * CONTAINS RATHER THAN STARTS WITH. People are found by the half of their name the
 * person at the keyboard remembers, and on a site that is as often the surname —
 * `r` has to reach `Mike R`. The same fold as the list itself, so the search
 * ignores case and spacing exactly where the de-duplication does.
 *
 * NOTHING TYPED IS NOT A FILTER MATCHING NOTHING — it is the unsearched list, which
 * is `lib/materialPriceView.js`'s own reading of an empty query.
 */
export function narrowNames(names, typed) {
    const needle = textMatchKey(typed);
    if (!needle) return names || [];
    return (names || []).filter((name) => textMatchKey(name).includes(needle));
}

/**
 * The names offered for what is typed now (#376, #458): every one that still matches,
 * or — with nothing typed — the first `RECENT_NAMES_SHOWN`.
 *
 * ONE ANSWER FOR BOTH WIDTHS. The dialog's field offers these as suggestions and the
 * name sheet a phone types in lists them as rows, so the cut and the narrowing are one
 * function rather than an expression in each; it stood inline in the transition form
 * until the second reader arrived. Nothing typed is decided by the same fold
 * `narrowNames` uses, so a field of spaces offers what an empty one does.
 */
export function offeredNames(names, typed) {
    return textMatchKey(typed) ? narrowNames(names, typed) : (names || []).slice(0, RECENT_NAMES_SHOWN);
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
 * AND THE STALENESS IS ANSWERED RATHER THAN ONLY REPORTED SINCE #378. The action
 * re-renders the page as it returns this, so what the reader meets is the base's
 * own answer with a sentence over it — which is why the sentence carries neither a
 * status nor an instruction any more.
 *
 * THE JOB IS ADMITTED ONLY FROM `plan.jobs`, so a forged submission cannot file an
 * event against a site the actor is not on. Nothing anywhere on this axis types a
 * job.
 *
 * A CHECK-OUT CANNOT BE RECORDED WITHOUT A NAME (#376), AND SINCE #458 THE SCREEN
 * ASKS THIS FUNCTION RATHER THAN A RULE OF ITS OWN. The dialog's commitment acts only
 * when this answers with no refusal, and its submit asks again before it sends; the
 * action asks once more, because a Server Action is reachable without a screen —
 * `readQuantity`'s argument (#338), and the one #363 cited. Until then the form held a
 * check of its own, `name.trim()`, beside this one. Whitespace alone is not a name —
 * the value is normalized before it is judged, so `"   "` is refused by the same
 * sentence an empty field is.
 *
 * AND THE NAME IS READ ONLY WHERE THE EVENT CARRIES ONE. A check-in returns a tool
 * to stock and has no recipient, so a name submitted with one is DROPPED rather
 * than refused — the same treatment the submitted event gets, for the same reason:
 * the form's word for a fact is evidence about the form. Nothing forged can put a
 * name on a row that should not have one, and `createToolLogEntry` refuses that
 * combination anyway.
 *
 * THE ORDER IS `planTransition`'s: what the app knows before what the person typed.
 * A stale page is answered first, then the job the screen supplied, then the name —
 * so nobody is told their name is missing in front of a page that would refuse them
 * either way.
 */
export function readSubmission(plan, { event, jobId, checkedOutTo }) {
    // EVERY RETURN NAMES ITS WHOLE SHAPE, SPREAD INTO NONE OF THEM. The shape is
    // what `offline/tool-transition.mjs` reads off this function — which value each
    // key comes from is the assertion with teeth — and a spread hides three keys
    // behind one node. Repetition here is what makes the rule legible to the check
    // and to a reader, which is the same trade the four refusals above already take.
    if (plan.refusal) {
        return { event: null, job: null, checkedOutTo: null, refusal: plan.refusal };
    }

    if (event !== plan.event) {
        return { event: null, job: null, checkedOutTo: null, refusal: TOOL_TRANSITION_COPY.moved };
    }

    const job = plan.jobs.find((candidate) => candidate.id === jobId) ?? null;
    if (!job) {
        return { event: null, job: null, checkedOutTo: null, refusal: TOOL_TRANSITION_COPY.jobNotYours };
    }

    const name = plan.event === TOOL_EVENT.CHECKED_OUT ? normalizeItemText(checkedOutTo) : "";
    if (plan.event === TOOL_EVENT.CHECKED_OUT && !name) {
        return { event: null, job: null, checkedOutTo: null, refusal: TOOL_TRANSITION_COPY.nameRequired };
    }

    return { event: plan.event, job, checkedOutTo: name || null, refusal: null };
}

/**
 * Whether a retirement may be recorded, and which job the row carries (#363).
 *
 * NOTHING IS SUBMITTED AND NOTHING IS COMPARED, which is where this parts from
 * `readSubmission` above on both counts.
 *
 * NO EVENT, because there is one direction. A scan has two and the button names
 * one of them, so the form's word has to be checked against the stored status or
 * the app can record the opposite of what it said. `Retired` is `Retired` from
 * anywhere it is allowed, so there is nothing a stale page could have named
 * wrongly and the action writes `TOOL_EVENT.RETIRED` from the vocabulary. A
 * stale page is answered by the PLAN instead: if somebody retired this first,
 * the fresh read makes `mayRetire` false and the refusal is the terminal
 * sentence, which is the true one.
 *
 * AND NO JOB, WHICH REVERSES WHAT #363 FIRST BUILT AND IS THE MORE INTERESTING
 * HALF. It asked the actor for a job, the way registration and the two scans do,
 * and that was wrong for a reason the base proved before the branch merged:
 * `HYE-TL-260909-004` was checked in on `26-DEMO-02` and then retired on
 * `26-DEMO-01`, so the row and the cache it fed both claimed a site the tool had
 * never been on, and `which tools were on 26-DEMO-02` lost it.
 *
 * THE RULE WAS NEVER GENERAL, WHICH IS WHY THIS IS NOT AN EXCEPTION. Every place
 * it is written down enumerates three events — registration, check-out,
 * check-in — because three existed. What is stated universally beside it is the
 * INVARIANT: the job is where the tool item was at that event, never blank, and
 * `Tool Items."Job"` caches the latest one. The actor's assignment is the
 * MECHANISM three events learn that by, and it is sound because in all three the
 * actor has the tool in their hands. Retiring is the one DESIGNATED event —
 * `TOOL_EVENT`'s own docstring already splits the vocabulary on that line — and
 * the person designating need not be anywhere near the tool. So the fourth event
 * learns the same invariant from the tool item itself.
 *
 * FROM THE CACHE RATHER THAN FROM THE PREVIOUS LOG ROW, which are the same value
 * by construction. The cache is never blank even when the history is (#338's
 * unlogged state leaves a tool item with a job and no rows), and the action
 * already holds the record — reading the log would cost an operation on the
 * screen a scan lands on.
 *
 * IT STILL STORES AT THAT MOMENT AND LOOKS NOTHING UP LATER. That standing rule
 * bars referencing a MUTABLE external — the actor's `Assigned Jobs` — when the
 * row is READ. This copies an immutable stored value when the row is WRITTEN,
 * which is the same shape the other three take.
 *
 * A BLANK IS NOT REFUSED HERE AND IS NOT IGNORED EITHER: `createToolLogEntry`
 * throws on a missing job, the way `createToolItems` does, so the invariant is
 * held at the writer for all four events rather than by a sentence here for a
 * state no path produces.
 *
 * THE SECOND GUARD IS UNREACHABLE ON TODAY'S VOCABULARY AND IS NOT DEAD CODE. A
 * status is un-retirable only when it is terminal, and a terminal status has
 * already produced `plan.refusal`, so the two branches say the same sentence.
 * What it is there for is a Server Action being directly callable against a
 * FOURTH status that offers a scan and forbids a retirement — and the sentence
 * would then be slightly wrong, which is a thing the issue adding that status
 * has to fix. `MAY_RETIRE_FROM_STATUS`'s throw is what forces it to look.
 */
export function readRetirement(plan, { currentJobRecordId }) {
    if (plan.refusal) return { jobRecordId: null, refusal: plan.refusal };

    if (!plan.mayRetire) {
        return { jobRecordId: null, refusal: TOOL_TRANSITION_COPY.noTransition({ status: plan.status }) };
    }

    return { jobRecordId: currentJobRecordId, refusal: null };
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
    //
    // AND ONE STRING FOR THE OPENER, THE DIALOG'S TITLE AND ITS COMMITMENT (#458),
    // which is the registration's arrangement with its openers: the design draws all
    // three saying it (1c, 1e), and an opener and what it opens cannot drift apart.
    control: {
        [TOOL_EVENT.CHECKED_OUT]: "Check out",
        [TOOL_EVENT.CHECKED_IN]: "Check in",
    },

    // WHAT THE DIALOG'S COMMITMENT SAYS WHILE ITS EVENT IS ON ITS WAY (#469), keyed by the
    // event as `control` is, so a fifth event cannot arrive without one. 0f's Working: the
    // verb in its `-ing` form with an ellipsis and no count. The design draws no submitting
    // state for these dialogs, so these are 0f's rule applied to the control's own verb, the
    // particle kept — `Checking…` alone would not say which way the tool is going.
    working: {
        [TOOL_EVENT.CHECKED_OUT]: "Checking out…",
        [TOOL_EVENT.CHECKED_IN]: "Checking in…",
    },

    // The app's word for abandoning a dialog, on all three of this page's (#458) — the
    // retirement's said it alone until then, as `retireCancel`.
    cancel: "Cancel",

    // ── who the tool went to (#376) ────────────────────────────────────────
    //
    // ONE STRING FOR THE FIELD'S LABEL AND THE NAME SHEET'S TITLE, WHICH IS ONE WORD
    // FOR ONE FACT RATHER THAN A SAVING. The dialog labels its field with it and the
    // sheet a phone types in carries it as a title; they name the same thing, and two
    // constants would be two words the first time somebody reworded one. Until #458 it
    // was the field's placeholder too, with no label — the field stood on the page then,
    // and the design's dialog gives it a label and an example instead (1c).
    //
    // `Checked out to` RATHER THAN A NOUN FOR THE PERSON. It is the field's own
    // name on the base and the event it belongs to, so the screen, the schema and
    // the history entry all say one thing; a noun would have had to be coined, and
    // `recipient` names a role this app has no other use for.
    //
    // READ OUT OF `TOOL_ITEM_COPY` AND NOT SPELLED AGAIN — the fourth word this
    // module borrows, and for the header's reason. The history entry this control
    // writes is labeled with the same string on the same screen, so two constants
    // would be two words for one fact the first time somebody reworded one.
    checkedOutToLabel: TOOL_ITEM_COPY.checkedOutToLabel,

    // What the field shows while it holds nothing — the design's example of a name
    // (1c, and 1f's name sheet), now that the field has a label of its own.
    namePlaceholder: "e.g. Jane Doe",

    // The head of the list of names, on both widths (#458): the suggestions under the
    // dialog's field and the rows in the name sheet say one thing, so the two widths do
    // not name one list twice. `at this job` rather than `on this job`, because a
    // person is at a site where a tool is on a job — the same preposition the sentence
    // below uses for the tools and this one uses for the people.
    recentHeading: "Recently at this job",

    // NOBODY HAS BEEN HANDED A TOOL ON THIS JOB YET, which is the first handout of
    // a project rather than an error. It says what has not happened rather than
    // that the list is empty, and it keeps `yet` — unlike the history's own empty
    // sentence, where what is missing can never arrive. Here it will: this is the
    // one screen that fills it. The name sheet says it; the dialog's suggestions are
    // a list that does not open with nothing in it.
    noRecentNames: "No tools have gone out on this job yet.",

    // The way out of the name sheet for a reader who typed rather than picked. A pick
    // closes it, `Escape` closes it, and on a phone neither of those is available
    // to somebody who has just finished typing — so the sheet states its own end.
    // NOT `Cancel`: nothing is abandoned, the name typed in it is kept.
    sheetDone: "Done",

    // The name of the mark that empties the name sheet's field once it holds a value
    // (Tools 0a's Field). It carries no word on screen, so this is all a screen reader
    // has for it — the frame's `Close` is the same arrangement.
    clearName: "Clear",

    // A check-out cannot be recorded without one, and the sentence names the ACT —
    // `to check out` is what a name is wanted for. The design's (1g), since #458; it
    // was `Checking out needs a name.` The dialog cannot send a check-out without a
    // name, since its commitment waits for one, so this is the action's answer to a
    // submission no screen produced.
    nameRequired: "Enter a name to check out.",

    // The same control and the same rule as the registration dialog's, so the same
    // words. See the header for which three are shared and why `noJob` is not.
    //
    // THE TRANSITION USES THEM AND THE RETIREMENT DOES NOT, which is the whole
    // of #363's reversal on this screen: a retirement inherits the tool item's
    // job rather than asking, so its dialog carries no choice and the page puts
    // the question once. Two pickers on one screen was the defect that found
    // the rule — the same question twice, and free to disagree.
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
        `This tool is ${status}, so nothing more can be recorded against it.`,

    // WHAT A FRESHLY RENDERED PAGE CANNOT SAY, AND NOTHING ELSE (#378). Until that
    // issue this told the reader the page was out of date and to open it again,
    // because the app could not fix it and they could. The action refreshes as it
    // refuses now, so the status, the control's direction and the history are all
    // true by the time this is read — and the instruction has nothing left to do.
    //
    // WHICH LEAVES THE TWO FACTS THE NEW SCREEN LOOKS IDENTICAL TO A SUCCESS
    // WITHOUT. A press that worked and a press that was refused both end on a
    // flipped control, a moved status and one more history entry; the difference
    // is whose entry it is. So the sentence says that the press recorded nothing
    // and that somebody else is responsible for what is now on screen.
    //
    // IT NAMES NO STATUS, WHICH IS THIS ISSUE APPLIED TO ITS OWN SENTENCE. The
    // status is in the header directly above, freshly rendered; restating it here
    // would be the app declining to believe the thing it just did, and it is one
    // fact twice (#318). The screen this is read on is a phone held in one hand.
    //
    // `scanned` RATHER THAN `moved`, BECAUSE `movesJob` BELOW ALREADY OWNS THAT
    // WORD FOR A TOOL CHANGING SITE. A reader meeting both would have one word for
    // two things on one screen. And a scan is what this refusal is always about: a
    // retirement leaves a status that allows nothing, so it produces `noTransition`
    // and never this.
    //
    // A PLAIN STRING RATHER THAN A BUILDER, WHICH IS THE PARAGRAPH ABOVE IN THE
    // SIGNATURE. Everything in this constant that interpolates is a function and
    // everything that does not is a string; a builder taking nothing would read as
    // a leftover and would leave the status looking like something a caller could
    // put back.
    moved: "Nothing was recorded. Somebody else scanned this first.",

    // See jobMoveNotice.
    movesJob: ({ from, to }) =>
        `This tool was last scanned on ${from}. Recording this on ${to} moves it there.`,

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
    // is not decoration: `Check out` and `Retire this tool` sit on one screen, one
    // is pressed dozens of times a day and one is that tool item's last, and the
    // words are the half of the difference this file owns. The other half was
    // structural until #458 — the transition control SUBMITTED and this one OPENED —
    // and a check-out opens a dialog of its own now; what stays apart is what this one
    // opens, a question naming the tool with a red commitment and no way back.
    // `Withdraw this PO` is the precedent for the wording. `tool` rather than
    // `tool item` since #455, the design's.
    retireOpener: "Retire this tool",

    // THE TITLE ASKS AND NAMES THE RECORD (#458), which 0l's Confirm and Tools 0a's
    // sheet that confirms both state, in the same words at both widths: the tool's name
    // here, and the line under it holds only the tool item's id. It was `Retire this
    // tool?` — the opener as a question, `Withdraw this PO?`'s shape — and a person who
    // opened this by accident now meets what they are about to end by its name, with
    // the id to hold against the sticker. A tool item whose tool did not resolve is
    // named by its id instead.
    retireHeading: ({ toolName, toolItemId }) => `Retire ${toolName || toolItemId}?`,

    // THE BODY IS THE POINT OF THE DIALOG AND NOT A WARNING WRAPPED AROUND A BUTTON.
    // `docs/briefs/_shared.md` says it of the three deletion voices: they are accurate
    // accounts of what becomes true, and that voice is what a confirmation is for. 0l's
    // Confirm asks for the one sentence that says what the act ends, and these are the
    // design's words (1c, 1f) since #458: it leaves the count, nothing more can be
    // recorded, and the app's ending for an act with no way back. The sentence before
    // them added that the row and its history stay.
    retireBody:
        "It will be removed from inventory, and no more check-outs or check-ins can be " +
        "recorded. This can't be undone.",

    // THE CONFIRM NAMES WHAT IT RETIRES, the design's `Retire tool` (#455). It said
    // `Retire` until then, on the reading that the heading above had already named
    // the object; the design gives the last press its object as well, so the button
    // a person presses to end a tool says what it ends even read on its own. It is
    // the verb of the act the title asks about, which is 0l's Confirm.
    retireSubmit: "Retire tool",
    // And while the retirement is on its way (#469): 0f's Working, the verb alone in its
    // `-ing` form with an ellipsis. The object goes with the count 0f leaves out, and the
    // design draws no submitting state for this dialog, so the word is 0f's rule applied.
    retireWorking: "Retiring…",
};
