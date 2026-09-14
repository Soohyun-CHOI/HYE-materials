// What a person may record against a tool item (#362, #363) — the pure half of
// both transitions its page offers: which of them a status allows, what refuses
// them, and every word the screen says.
//
// TWO TRANSITIONS OF DIFFERENT KINDS, WHICH IS lib/toolStatus.js's OWN SPLIT
// APPLIED TO A SCREEN. A check-out or a check-in is SCANNED — one press, because
// the next press undoes it. Retiring is DESIGNATED and has no way back, so it
// takes a modal that says what becomes true before it happens. They are in one
// module because they are one screen's rule and one set of refusals.
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
// AND #376 PUT THE RECIPIENT HERE RATHER THAN IN A MODULE OF ITS OWN. Who a tool
// went to is part of what a check-out records, which is this module's subject, and
// its readers are the two this module already has — the page that offers the
// control and the action that writes the row. A module of its own would also cost
// a line in CLAUDE.md's service-layer list, which is at its ceiling. THE CONDITION
// FOR SPLITTING IT OUT IS A THIRD CONSUMER, which is `assignedJobsFor`'s mechanism
// twice measured: that one sat under a narrower name until #363 was the third
// caller, and `countsAsOrdered` before it.
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
import { TOOL_JOB_COPY, assignedJobsFor } from "./toolJob.js";
import { normalizeItemText, textMatchKey } from "./itemNaming.js";

/**
 * How many recent names the sheet shows before anybody types (#376).
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
 * over: the page loads the list once and the form narrows it as somebody types, so
 * a keystroke costs nothing. The whole list is the haystack rather than the few the
 * sheet shows first, which is what makes the shown count a display choice.
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
 * A CHECK-OUT CANNOT BE RECORDED WITHOUT A NAME, AND THIS IS THE HALF THE FORM
 * CANNOT BE (#376). The field is required on the screen too, and that is not a
 * duplication to collapse: a control constrains the person in front of it and a
 * Server Action is reachable without one, which is `readQuantity`'s argument (#338)
 * and the one #363 cited. Whitespace alone is not a name — the value is normalized
 * before it is judged, so `"   "` is refused by the same sentence an empty field is.
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
    control: {
        [TOOL_EVENT.CHECKED_OUT]: "Check out",
        [TOOL_EVENT.CHECKED_IN]: "Check in",
    },

    // ── who the tool went to (#376) ────────────────────────────────────────
    //
    // ONE STRING FOR THE FIELD AND THE SHEET, WHICH IS ONE WORD FOR ONE FACT RATHER
    // THAN A SAVING. The field carries it as its placeholder and the sheet that
    // opens from it carries it as a title; they name the same thing, and two
    // constants would be two words the first time somebody reworded one. There is
    // no separate label: the placeholder IS the label, which is the design's, and
    // the sheet's title is what a reader sees once the keyboard is up.
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

    // The list under it. `at this job` rather than `on this job`, because a person
    // is at a site where a tool is on a job — the same preposition the sentence
    // below uses for the tools and this one uses for the people.
    recentHeading: "Recently at this job",

    // NOBODY HAS BEEN HANDED A TOOL ON THIS JOB YET, which is the first handout of
    // a project rather than an error. It says what has not happened rather than
    // that the list is empty, and it keeps `yet` — unlike the history's own empty
    // sentence, where what is missing can never arrive. Here it will: this is the
    // one screen that fills it.
    noRecentNames: "No tools have gone out on this job yet.",

    // The way out of the sheet for a reader who typed rather than picked. A pick
    // closes it, `Escape` closes it, and on a phone neither of those is available
    // to somebody who has just finished typing — so the sheet states its own end.
    // NOT `Cancel`: nothing is abandoned, the name typed in it is kept.
    sheetDone: "Done",

    // A check-out cannot be recorded without one, and the sentence names the ACT
    // rather than the field — `Checking out` is what is being refused, which is
    // what tells the reader why a name is wanted at all. Both the form and the
    // action answer with it, so a person who reaches it either way reads one
    // sentence.
    nameRequired: "Checking out needs a name.",

    // The same control and the same rule as the registration form's, so the same
    // words. See the header for which three are shared and why `noJob` is not.
    //
    // THE TRANSITION USES THEM AND THE RETIREMENT DOES NOT, which is the whole
    // of #363's reversal on this screen: a retirement inherits the tool item's
    // job rather than asking, so the modal carries no picker and the page puts
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
        `This tool item is ${status}, so nothing more can be recorded against it.`,

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
