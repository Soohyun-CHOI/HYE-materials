// What a person may record against an asset (#362, #363, #531) — the pure half of
// every transition its page offers: which of them a status allows, what refuses
// them, and every word the screen says.
//
// THREE KINDS OF TRANSITION, lib/assetStatus.js's MAPS APPLIED TO A SCREEN. The page's
// press is what its status offers: a check-out or a check-in, which the next scan
// undoes, and since #531 an item's return from repair. It asks only what the page
// cannot know: a check-out opens a dialog for who the asset goes to, and a check-in and
// a return are one press (`asksBeforeRecording`). Sending an item for repair is
// chosen from the menu beside the press and asks nothing, since the return undoes it
// (#531). Retiring is chosen from the same menu and has no way back, so its dialog
// asks a question naming the asset before it happens. They are in one module because
// they are one screen's rule and one set of refusals.
//
// AND EVERY ONE OF THEM RECORDS ON THE ITEM'S OWN JOB SINCE #597, which is the thing that
// was easy to get wrong. A scan took its job from the actor until then — a check-out or a
// check-in asked which of the reader's jobs it was on, and the answer could move the item —
// while a retirement and a repair took the asset's (#363, #531; `readRetirement` carries the
// row on this base that proved the first). Now an item's job is the one it sits on, the row
// inherits it whatever the event, and what the reader's assignments decide is whether they
// record on the item at all: `lib/assetJob.js:recordsOn`, which `planTransition` asks first.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE PAGE. That is lib/prItemMerge.js's
// arrangement and lib/assetRegistration.js's one screen over, and it is why this
// is a module rather than lines inside the page: the page has to know what to
// OFFER and the action has to reach the same verdict about what to WRITE, and a
// Server Action is directly callable, so the second is not the first's
// consequence. One rule, two readers, no second implementation.
//
// IT IS NOT PART OF lib/assetView.js, WHICH IS THE OTHER PLACE IT COULD HAVE
// GONE. That module is what one asset's page SHOWS, imported by the page
// alone. This one is imported by the page, the two dialogs and the action, and
// the action is not a screen at all. Keeping them apart leaves that module's
// name true and its check's title true with it.
//
// PURE AND OFFLINE-SAFE. It imports ./assetStatus.js, ./assetView.js,
// ./assetJob.js — who records on an item, which `planTransition` asks first (#506, #597)
// — and ./itemNaming.js, with the extension spelled out, which is
// lib/materialPriceView.js's precedent (#19): the offline tier runs under plain
// `node` with no loader. Nothing here reaches lib/airtable/, so the dialogs —
// "use client" files — can import it, and the transition's asks `readSubmission`
// before it sends exactly as the action asks it after (#458).
//
// EVERY STRING THE SCREEN RENDERS IS IN `ASSET_TRANSITION_COPY` AND NONE IS IN
// JSX, which is this axis's arrangement since #338 and what
// `offline/asset-list-view.mjs` holds by reading every file under app/(assets)/.
//
// AND #376 PUT THE RECIPIENT HERE RATHER THAN IN A MODULE OF ITS OWN. Who an asset
// went to is part of what a check-out records, which is this module's subject, and
// its readers are the two this module already has — the page that offers the
// control and the action that writes the row. A module of its own would also cost
// a line in CLAUDE.md's service-layer list, which was at its ceiling when #376
// decided this. THE CONDITION FOR SPLITTING IT OUT IS A THIRD CONSUMER, which is
// `assignedJobsFor`'s mechanism twice measured: that one sat under a narrower name
// until #363 was the third caller, and `countsAsOrdered` before it.
//
// ONE WORD IS IMPORTED RATHER THAN RE-SPELLED — `Checked out to`, from the screen's
// own constant (#376): this control writes the history entry that reads it in its
// turn, so the two are literally the same words on the same screen, and a second copy
// is a second word for one fact the first time somebody rewords one. The `Job` label
// and the picker's words were imported too until #597 took the job out of the
// transition; lib/assetJob.js keeps them for the registration.

import { ASSET_EVENT, eventOfferedBy, mayRetireFrom, maySendForRepairFrom, mayWriteNoteIn } from "./assetStatus.js";
import { ASSET_COPY } from "./assetView.js";
import { recordsOn } from "./assetJob.js";
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
 * What this person may record against an asset in this status, or why not.
 *
 * ONE FUNCTION FOR BOTH CONTROLS AND THE REFUSAL, so no call site can take one
 * without having consulted the other. That is `readQuantity`'s shape (#338) and
 * `pageOfAssets`' (#339) for the same reason: a caller that assembles the
 * verdict itself is a caller that can assemble half of it. #363 widened it
 * rather than adding a second planner, because what refuses one control refuses
 * every one — a terminal status offers none, and a reader not on the item's job
 * may record none.
 *
 * THE ANSWERS COME FROM FOUR MAPS AND NOT FROM EACH OTHER. `event` is what the page's
 * press offers, `maySendForRepair` whether the menu offers `Send for repair` (#531),
 * `mayRetire` whether a person may DESIGNATE the end, and `mayWriteNote` whether the
 * item's note may be written (#533); the first and the third agree on today's four
 * statuses, the second parts from both, the fourth parts from all three on `In repair`,
 * and lib/assetStatus.js records why each is a map of its own rather than a derivation.
 * The note is here though it records no event, because who may write it is who may
 * record — a site manager on the item's job — and asking that twice would be two answers
 * to it. `records` is that answer on its own, which the page's `Print label` asks (#597).
 *
 * THE STATUS IS THE STORED ONE AND NEVER A SUBMITTED ONE. The page passes what
 * it read and the action passes what it re-read, so the offer is a fact about
 * the base rather than about the page a person was looking at. What the page
 * was looking at is `readSubmission`'s question.
 *
 * FIRST, WHETHER THIS READER RECORDS ON THIS ITEM AT ALL (#506, #597): a site manager on the
 * job the item sits on, `lib/assetJob.js:recordsOn`, asked of the item's `Job` link as it was
 * read. Anybody else is offered nothing and told nothing — no event, no retirement, no note
 * and no refusal, on every status — which is what any reader sees: a reader who is not a site
 * manager, and since #597 a site manager on another job or on none, for whom the job under the
 * item's title already says whose it is. So the page draws no control and no sentence for
 * them, at a desk or on a phone, which is the shape a desk already draws for a retired asset.
 * **Until #597 a site manager on another job's item was offered every control**, and one on no
 * job was told to ask the office for an assignment, which the job under the title now makes a
 * sentence about the wrong problem.
 *
 * THEN A TERMINAL STATUS, which offers nothing to the site manager it is theirs to record, and
 * says so in the place a phone's press stands (`noTransition`).
 *
 * THE ACTIONS ASK THE SAME PLAN ON A FRESH READ, AND `recordingRefusal` IS WHAT THEY ADD: the
 * item may have moved to another job since the page was drawn (#583), or the reader may have
 * been taken off its job, and either is said rather than left to the page — see there.
 * `withSiteManagerAction` refuses a reader who is not a site manager before any body runs.
 *
 * `jobId` AND `jobCode` ARE THE ITEM'S JOB, the link as read and its code off the loaded list,
 * which the screen names a check-out's recent names by and the refusals name the job by.
 */
export function planTransition({ user, jobs, status, assetJobId }) {
    const jobId = typeof assetJobId === "string" && assetJobId !== "" ? assetJobId : null;
    const jobCode = (jobs || []).find((job) => job.id === jobId)?.jobCode ?? null;

    if (!recordsOn(user, jobId)) {
        return { status, jobId, jobCode, records: false, event: null, maySendForRepair: false, mayRetire: false, mayWriteNote: false, refusal: null };
    }

    const event = eventOfferedBy(status);
    const maySendForRepair = maySendForRepairFrom(status);
    const mayRetire = mayRetireFrom(status);
    const mayWriteNote = mayWriteNoteIn(status);

    if (!event && !maySendForRepair && !mayRetire && !mayWriteNote) {
        return {
            status,
            jobId,
            jobCode,
            records: true,
            event: null,
            maySendForRepair: false,
            mayRetire: false,
            mayWriteNote: false,
            refusal: ASSET_TRANSITION_COPY.noTransition,
        };
    }

    return { status, jobId, jobCode, records: true, event, maySendForRepair, mayRetire, mayWriteNote, refusal: null };
}

/**
 * Why a press may not be recorded because of whose item it is now (#597), or null — asked by
 * each of the three actions on a fresh read before anything else about the press, and by the
 * screen of the plan it drew, which answers null.
 *
 * TWO WAYS A PAGE CAN BE OUT OF DATE ABOUT THE JOB, AND THE TWO ARE SAID APART. The reader may
 * no longer record on the item — the office moved it to a job they are not on (#583), or took
 * them off its job — and that names whose it is now: `Only 26-USA-07 can record this item.`
 * Or the item moved to another of the reader's own jobs, so they still record on it, but the
 * page they confirmed named the job it left: `This item is on 26-USA-07 now.` Each ends on what
 * the press saved, `notSaved`, and the page is drawn again under it (#378).
 *
 * `drawnJobId` IS THE ITEM'S JOB AS THE PAGE WAS DRAWN, which every form carries — COMPARED AND
 * NEVER WRITTEN, `readSubmission`'s rule about the event: what a row records is the plan's
 * job, the item's own as just read. A form with none compares as one drawn on no job.
 */
export function recordingRefusal(plan, { drawnJobId, attempted }) {
    if (!plan.records) return ASSET_TRANSITION_COPY.notYours({ jobCode: plan.jobCode, attempted });
    const drawn = typeof drawnJobId === "string" && drawnJobId !== "" ? drawnJobId : null;
    if (drawn !== plan.jobId) return ASSET_TRANSITION_COPY.movedTo({ jobCode: plan.jobCode, attempted });
    return null;
}

/**
 * Whether the offered transition asks something before it records — a dialog — or
 * records on the press (#458).
 *
 * IT ASKS ONLY WHAT THE PAGE CANNOT KNOW. A check-out records who the asset went to (#376),
 * so it always asks; a check-in and a return from repair (#531) ask nothing and record on the
 * press, as 1f, 1g and 1j draw them. **A check-in asked a person on several jobs which one it
 * was on until #597** (1i's dialog, gone from the files of 2026-11-02): it records on the
 * item's own job now, as every event after a registration does.
 *
 * A PLAN THAT REFUSES HAS NOTHING TO OFFER, so the page never asks this of one: a terminal
 * status is answered before any control is drawn.
 */
export function asksBeforeRecording(plan) {
    return plan.event === ASSET_EVENT.CHECKED_OUT;
}

/**
 * The people this job has recently handed assets to, most recent first (#376).
 *
 * ONE ENTRY PER PERSON, FOLDED ON THE KEY THE WHOLE APP TYPES AGAINST. `Mike R`
 * and `mike r` are one person, so they are one entry — `itemNaming.js:textMatchKey`
 * is the fold, the same one a typed tool name used from #338 to #507, and writing a second
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
 * SCOPED TO ONE JOB, THE ONE THE EVENT WILL BE RECORDED ON — the item's own since #597.
 * The page reads that job's rows alone, where it read every job its reader was assigned
 * to while a person with two jobs could move a picker; the rule stays here, so a row on
 * another job is never a name this job is said to have handed an item to.
 *
 * ONLY `Checked out` ROWS CARRY A NAME, so only they are read. A row of any other
 * event with one is a defect upstream — `createAssetLogEntry` refuses to write it —
 * and this would ignore it rather than showing it.
 */
export function recentNamesFor(rows, { jobCode }) {
    if (!jobCode) return [];
    const seen = new Set();
    const out = [];
    for (const row of (rows || [])
        .filter((r) => r?.event === ASSET_EVENT.CHECKED_OUT && r?.jobCode === jobCode)
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
    return namesAreRecent(typed) ? (names || []).slice(0, RECENT_NAMES_SHOWN) : narrowNames(names, typed);
}

/**
 * Whether the names offered are the recent ones rather than the ones a typed fragment matches
 * (#495) — nothing typed, by the fold `narrowNames` uses, so a field of spaces counts as
 * empty. It is what `Recently at this job` stands over: the head names the recent list, and
 * once somebody types, the list is what matches — at a desk the head goes (1f), and on a
 * phone the name sheet says `Matching names` or `No past names match` (#589, `nameListHead`).
 */
export function namesAreRecent(typed) {
    return !textMatchKey(typed);
}

/**
 * The head over the name sheet's list (#589): `Recently at this job` while nothing is typed,
 * `Matching names` while what is typed matches a name `offered` holds, `No past names match`
 * when it matches none, and null — the space empty — on a job nothing has gone out on,
 * whatever is typed. `offered` is `offeredNames`' answer. It said null before a job was
 * chosen too, until #597 left the item's own job the one a check-out is on.
 *
 * THE SPACE IS THE SAME WHATEVER THIS SAYS. The sheet draws the list in a space of one height
 * under its field, so a head changing, or going, moves nothing; what this decides is the words
 * at its top. A job with no recent names says none of the three: there are no past names for a
 * typed one to match, so `No past names match` would say nothing about this job.
 */
export function nameListHead({ hasRecent, typed, offered }) {
    if (!hasRecent) return null;
    if (namesAreRecent(typed)) return ASSET_TRANSITION_COPY.recentHeading;
    return (offered || []).length > 0 ? ASSET_TRANSITION_COPY.matchingHeading : ASSET_TRANSITION_COPY.noMatchHeading;
}

/**
 * The part of a name a typed fragment matched, which the list sets at 600 (1f, 1j; #495):
 * `{ before, match, after }`, or null when nothing is typed or the name does not hold it.
 *
 * WHERE `narrowNames` FOUND IT, ON ITS FOLD, AT THE START OF A WORD WHEN IT IS ONE. The
 * search is contains (#376), so a fragment can stand inside a word; the design marks a
 * name at a word's start, so where the fragment starts one, that is the place marked, and
 * otherwise its first place. A name is shown normalized — one space between words — so its
 * fold differs from it by case alone, and the place read off the fold is the place in the
 * name; a name whose case folding changes its length is not marked at all rather than
 * marked in the wrong place.
 */
export function matchedPart(name, typed) {
    const needle = textMatchKey(typed);
    const shown = String(name ?? "");
    const folded = textMatchKey(shown);
    if (!needle || folded.length !== shown.length) return null;
    let at = -1;
    for (let from = folded.indexOf(needle); from !== -1; from = folded.indexOf(needle, from + 1)) {
        if (at === -1) at = from;
        if (from === 0 || folded[from - 1] === " ") {
            at = from;
            break;
        }
    }
    if (at === -1) return null;
    return { before: shown.slice(0, at), match: shown.slice(at, at + needle.length), after: shown.slice(at + needle.length) };
}

/**
 * What is wrong with the name a person has given (#463) — the name normalized, with a
 * refusal when the event needs one and it is missing, or null.
 *
 * ONE FIELD SINCE #597, WHICH WAS TWO. A check-out asked for its job and its name, and a
 * press with either missing was answered under the field it was about (1k), both at once;
 * the job is the item's own now, so the name is the one field a press can leave empty — under
 * the foot bar's field on a phone and the dialog's at a desk. `readSubmission` below reads the
 * same answer, so the screen and the action cannot disagree about what the field may hold.
 *
 * A PRESS THAT TAKES NO NAME REFUSES NONE: a check-in and a return from repair (#531).
 */
export function fieldRefusals(plan, { checkedOutTo }) {
    const asksName = plan.event === ASSET_EVENT.CHECKED_OUT;
    const name = asksName ? normalizeItemText(checkedOutTo) : "";
    return {
        name,
        nameRefusal: asksName && !name ? ASSET_TRANSITION_COPY.nameRequired : null,
    };
}

/**
 * Whether a submission still matches what the plan offers, and which job it names.
 *
 * THE EVENT IS COMPARED AND NEVER TAKEN. What gets written is `plan.event`, which
 * came from the stored status; the submitted one is read only to find out whether
 * the person was looking at this state when they pressed. That is
 * `registerAssetsAction`'s rule about the job — the form's word for a fact is
 * evidence about the form, not about the base.
 *
 * WHAT THE COMPARISON ACTUALLY CLOSES IS A STALE PAGE, WHICH IS THE COMMON HALF OF
 * A RACE RATHER THAN ALL OF IT. Two invocations can still both read `In stock` and
 * both write `Checked out`; see the action's header for why no lock is added. What
 * this stops is the failure with a person behind it: a page opened an hour ago, or
 * left open while somebody else moved the asset, whose button says `Check out` while
 * the asset is already `Out` — pressing it would record a check-in, which is
 * the app doing the opposite of what the control said.
 *
 * AND THE STALENESS IS ANSWERED RATHER THAN ONLY REPORTED SINCE #378. The action
 * re-renders the page as it returns this, so what the reader meets is the base's
 * own answer with a sentence over it — which is why the sentence carries neither a
 * status nor an instruction any more. **`stale` says which refusal this is (#463)**:
 * the design names who recorded first and when (1k), which this function cannot know,
 * so the action reads the latest entry for a stale answer and nothing else — the
 * sentence here is what it says when that entry cannot be read.
 *
 * THE JOB IS NEVER SUBMITTED (#597): the row takes `plan.jobId`, the item's own job as the
 * action just read it, for every event a press or the menu sends — so a forged `jobId`
 * is read by nothing, and nothing anywhere on this axis types a job. What the form does
 * carry is the job the page was drawn on, `drawnJobId`, which `recordingRefusal` compares
 * first and nothing writes.
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
 * AND THE NAME IS READ ONLY WHERE THE EVENT CARRIES ONE. A check-in returns an asset
 * to stock and has no recipient, so a name submitted with one is DROPPED rather
 * than refused — the same treatment the submitted event gets, for the same reason:
 * the form's word for a fact is evidence about the form. Nothing forged can put a
 * name on a row that should not have one, and `createAssetLogEntry` refuses that
 * combination anyway.
 *
 * THE ORDER IS `planTransition`'s: what the app knows before what the person typed.
 * Whose item it is now is answered first (`recordingRefusal`, #597), then a status that
 * allows nothing, then a stale page, then the name — so nobody is told their name is
 * missing in front of a page that would refuse them either way.
 *
 * TWO EVENTS MAY BE SUBMITTED FROM ONE STATUS SINCE #531, and the comparison is against
 * both: the press's, and `Sent for repair` where the plan offers it from the menu. What is
 * written is still the plan's — the offer the submission named, never the submission's
 * own word — and anything else is a stale page.
 *
 * AND THE ROW'S JOB IS ANSWERED HERE, AS `jobRecordId`: the item's own, `plan.jobId`, for
 * every event this reads — a repair's since #531 and a scan's since #597, which until then
 * was the job the person chose from their own.
 */
export function readSubmission(plan, { event, drawnJobId, checkedOutTo }) {
    // EVERY RETURN NAMES ITS WHOLE SHAPE, SPREAD INTO NONE OF THEM. The shape is
    // what `offline/asset-transition.mjs` reads off this function — which value each
    // key comes from is the assertion with teeth — and a spread hides three keys
    // behind one node. Repetition here is what makes the rule legible to the check
    // and to a reader, which is the same trade the four refusals above already take.
    const recording = recordingRefusal(plan, { drawnJobId, attempted: event });
    if (recording) {
        return { event: null, jobRecordId: null, checkedOutTo: null, refusal: recording, stale: false };
    }

    if (plan.refusal) {
        return { event: null, jobRecordId: null, checkedOutTo: null, refusal: plan.refusal, stale: false };
    }

    const offered = [plan.event, plan.maySendForRepair ? ASSET_EVENT.SENT_FOR_REPAIR : null].find(
        (candidate) => candidate !== null && candidate === event
    );
    if (!offered) {
        return {
            event: null,
            jobRecordId: null,
            checkedOutTo: null,
            refusal: ASSET_TRANSITION_COPY.someoneFirst({ attempted: event }),
            stale: true,
        };
    }

    // Asked of the event the submission named, so a sending for repair from stock — the
    // menu's, beside a press that would check the item out — asks no name.
    const fields = fieldRefusals({ event: offered }, { checkedOutTo });
    if (fields.nameRefusal) {
        return { event: null, jobRecordId: null, checkedOutTo: null, refusal: fields.nameRefusal, stale: false };
    }

    return { event: offered, jobRecordId: plan.jobId, checkedOutTo: fields.name || null, refusal: null, stale: false };
}

/**
 * Whether a retirement may be recorded, and which job the row carries (#363).
 *
 * NOTHING IS SUBMITTED BUT THE JOB THE PAGE WAS DRAWN ON, which is where this parts from
 * `readSubmission` above: `recordingRefusal` compares it first (#597), as it does there,
 * and nothing else about the press is compared.
 *
 * NO EVENT, because there is one direction. A scan has two and the button names
 * one of them, so the form's word has to be checked against the stored status or
 * the app can record the opposite of what it said. `Retired` is `Retired` from
 * anywhere it is allowed, so there is nothing a stale page could have named
 * wrongly and the action writes `ASSET_EVENT.RETIRED` from the vocabulary. A
 * stale page is answered by the PLAN instead: if somebody retired this first,
 * the fresh read makes `mayRetire` false and the refusal is the terminal
 * sentence, which is the true one.
 *
 * AND NO JOB, WHICH REVERSES WHAT #363 FIRST BUILT AND IS THE MORE INTERESTING
 * HALF. It asked the actor for a job, the way registration and the two scans do,
 * and that was wrong for a reason the base proved before the branch merged:
 * `HYE-TL-260909-004`, `HYE-AST-260909-004` since #513, was checked in on
 * `26-DEMO-02` and then retired on `26-DEMO-01`, so the row and the cache it fed both
 * claimed a site the asset had never been on, and `which tools were on 26-DEMO-02`
 * lost it.
 *
 * THE RULE WAS NEVER GENERAL, WHICH IS WHY THIS IS NOT AN EXCEPTION. Every place
 * it is written down enumerates three events — registration, check-out,
 * check-in — because three existed. What is stated universally beside it is the
 * INVARIANT: the job is where the asset was at that event, never blank, and
 * `Assets."Job"` caches the latest one. The actor's assignment was the
 * MECHANISM three events learned that by, sound while in all three the actor
 * had the asset in their hands. Retiring is the one DESIGNATED event —
 * `ASSET_EVENT`'s own docstring already splits the vocabulary on that line — and
 * the person designating need not be anywhere near the asset. So the fourth event
 * learns the same invariant from the asset itself — and since #597 the two scans
 * learn it there too, which leaves the registration the one event that asks.
 *
 * FROM THE CACHE RATHER THAN FROM THE PREVIOUS LOG ROW, which are the same value
 * by construction. The cache is never blank even when the history is (#338's
 * unlogged state leaves an asset with a job and no rows), and the action
 * already holds the record — reading the log would cost an operation on the
 * screen a scan lands on.
 *
 * IT STILL STORES AT THAT MOMENT AND LOOKS NOTHING UP LATER. That standing rule
 * bars referencing a MUTABLE external — the actor's `Assigned Jobs` — when the
 * row is READ. This copies an immutable stored value when the row is WRITTEN,
 * which is the same shape every other event's takes.
 *
 * A BLANK IS NOT REFUSED HERE AND IS NOT IGNORED EITHER: `createAssetLogEntry`
 * throws on a missing job, the way `createAssets` does, so the invariant is
 * held at the writer for every event rather than by a sentence here for a
 * state no path produces.
 *
 * THE SECOND GUARD IS UNREACHABLE ON TODAY'S VOCABULARY AND IS NOT DEAD CODE. A
 * status is un-retirable only when it is terminal, and a terminal status has
 * already produced `plan.refusal`, so the two branches say the same sentence —
 * `In repair`, which #531 added, may be retired. What it is there for is a Server
 * Action being directly callable against a status that offers a press and forbids a
 * retirement — and the sentence would then be slightly wrong, which is a thing the
 * issue adding that status has to fix. `MAY_RETIRE_FROM_STATUS`'s throw is what forces
 * it to look.
 */
export function readRetirement(plan, { drawnJobId }) {
    const recording = recordingRefusal(plan, { drawnJobId, attempted: ASSET_EVENT.RETIRED });
    if (recording) return { jobRecordId: null, refusal: recording };

    if (plan.refusal) return { jobRecordId: null, refusal: plan.refusal };

    if (!plan.mayRetire) {
        return { jobRecordId: null, refusal: ASSET_TRANSITION_COPY.noTransition };
    }

    return { jobRecordId: plan.jobId, refusal: null };
}

/**
 * Every word the transition adds to the asset's page.
 *
 * THE SECTION HAS NO HEADING WORD, AND THAT IS A DECISION RATHER THAN AN OMISSION.
 * The two headings already on this page name things — `Label`, `History`. A
 * heading over the control would have to name the ACT generically, and every
 * candidate for that is an explanatory word rather than one this app says:
 * `transition` is what these notes call it, the way `kind` is what they call what
 * separates `Asset Categories` from `Assets`, and #338 records how close `kind` came to
 * reaching a column head by accident. The control names itself.
 */
export const ASSET_TRANSITION_COPY = {
    // KEYED BY THE EVENT RATHER THAN WRITTEN AS FIELDS, so a new event
    // cannot arrive without a word for it — `summarizeAssetCategories` builds its row from
    // `ASSET_STATUS_VALUES` for the same reason, and the check asserts every event
    // this screen can offer has an entry here.
    //
    // THE IMPERATIVE IS THE CONTROL AND THE PARTICIPLE IS THE RECORD, which is
    // not two words for one fact: `Approve` / `Approved` and `Withdraw this PO` /
    // `Withdrawn` already draw the same pair. The event stored in `Asset Log` is
    // `Checked out`; the thing a person presses is `Check out`.
    //
    // NO MODIFIER ON EITHER, per #303's rule for a label with no sentence around
    // it: nothing else on this screen competes for the words, so `Check out` names
    // its subject the way the screen's own heading does.
    //
    // AND ONE STRING FOR THE OPENER, THE DIALOG'S TITLE AND ITS COMMITMENT (#458),
    // which is the registration's arrangement with its openers: the design draws all
    // three saying it (1f, 1i), and an opener and what it opens cannot drift apart.
    //
    // THE REPAIR'S TWO ARE THE DESIGN'S (#531): `Return from repair`, the press an item in
    // repair offers at both widths (1f, 1j-e), and `Send for repair`, the menu's item above
    // `Retire this item` from stock (1f, 1j-a). Each is the event's own words in the
    // imperative, the base's `Returned from repair` and `Sent for repair`, matched on purpose.
    control: {
        [ASSET_EVENT.CHECKED_OUT]: "Check out",
        [ASSET_EVENT.CHECKED_IN]: "Check in",
        [ASSET_EVENT.SENT_FOR_REPAIR]: "Send for repair",
        [ASSET_EVENT.RETURNED_FROM_REPAIR]: "Return from repair",
    },

    // WHAT THE DIALOG'S COMMITMENT SAYS WHILE ITS EVENT IS ON ITS WAY (#469), keyed by the
    // event as `control` is, so a new event cannot arrive without one. 0f's Working: the
    // verb in its `-ing` form with an ellipsis and no count. The design draws no submitting
    // state for these dialogs, so these are 0f's rule applied to the control's own verb, the
    // particle kept — `Checking…` alone would not say which way the asset is going, and
    // `Sending…` and `Returning…` would not say where. Each is heard and not seen: a busy
    // control shows its spinner alone (#495), `More actions` while a sending for repair
    // is on its way (#531).
    working: {
        [ASSET_EVENT.CHECKED_OUT]: "Checking out…",
        [ASSET_EVENT.CHECKED_IN]: "Checking in…",
        [ASSET_EVENT.SENT_FOR_REPAIR]: "Sending for repair…",
        [ASSET_EVENT.RETURNED_FROM_REPAIR]: "Returning from repair…",
    },

    // The app's word for abandoning a dialog, on all three of this page's (#458) — the
    // retirement's said it alone until then, as `retireCancel`.
    cancel: "Cancel",

    // ── who the asset went to (#376) ───────────────────────────────────────
    //
    // ONE STRING FOR THE FIELD'S LABEL AND THE NAME SHEET'S TITLE, WHICH IS ONE WORD
    // FOR ONE FACT RATHER THAN A SAVING. The dialog labels its field with it and the
    // sheet a phone types in carries it as a title; they name the same thing, and two
    // constants would be two words the first time somebody reworded one. Until #458 it
    // was the field's placeholder too, with no label — the field stood on the page then,
    // and the design's dialog gives it a label and an example instead (1f).
    //
    // `Checked out to` RATHER THAN A NOUN FOR THE PERSON. It is the field's own
    // name on the base and the event it belongs to, so the screen, the schema and
    // the history entry all say one thing; a noun would have had to be coined, and
    // `recipient` names a role this app has no other use for.
    //
    // READ OUT OF `ASSET_COPY` AND NOT SPELLED AGAIN — the fourth word this
    // module borrows, and for the header's reason. The history entry this control
    // writes is labeled with the same string on the same screen, so two constants
    // would be two words for one fact the first time somebody reworded one.
    checkedOutToLabel: ASSET_COPY.checkedOutToLabel,

    // What the field shows while it holds nothing — the design's example of a name
    // (1f, and 1j's name sheet), now that the field has a label of its own.
    namePlaceholder: "e.g. Jane Doe",

    // The head of the list of names, on both widths (#458): the suggestions under the
    // dialog's field and the rows in the name sheet say one thing, so the two widths do
    // not name one list twice. `at this job` rather than `on this job`, because a
    // person is at a site where an asset is on a job.
    recentHeading: "Recently at this job",

    // The name sheet's other two heads (#589), the design's: over the names a typed
    // fragment matches, and over no rows when it matches none. The dialog's suggestions
    // take no head once somebody types, as they did. `No items have gone out on this job
    // yet.` stood where a job's list was empty until #589, which leaves that list's space
    // empty instead (`nameListHead`).
    matchingHeading: "Matching names",
    noMatchHeading: "No past names match",

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
    // `to check out` is what a name is wanted for. The design's (1k), since #458; it
    // was `Checking out needs a name.` The dialog cannot send a check-out without a
    // name, since its commitment waits for one, so this is the action's answer to a
    // submission no screen produced.
    nameRequired: "Enter a name to check out.",

    // A STATUS THAT ALLOWS NOTHING, IN THE DESIGN'S WORDS (#463): what a phone's foot bar
    // holds for a retired asset (1j), and the refusal for a press on one somebody retired
    // first. It names no status, which stands directly above it, and no control.
    //
    // #362 WROTE IT AS `no check-out or check-in to record` AND #363 WIDENED IT IN THE
    // SAME COMMIT AS THE THING THAT MADE IT NARROW, to `This tool is Retired, so nothing
    // more can be recorded against it.` — built from the status, since the sentence is
    // about a status being the end and `Retired` is only the one that is today. The
    // design's sentence states the end without naming either. A desk draws nothing in the
    // actions' place for a retired asset (1f), so this is a phone's and a refusal's.
    noTransition: "Nothing more can be recorded here.",

    // WHAT A FRESHLY RENDERED PAGE CANNOT SAY, AND NOTHING ELSE (#378). Until that
    // issue this told the reader the page was out of date and to open it again,
    // because the app could not fix it and they could. The action refreshes as it
    // refuses now, so the status, the control's direction and the history are all
    // true by the time this is read — and the instruction has nothing left to do.
    //
    // WHICH LEAVES THE TWO FACTS THE NEW SCREEN LOOKS IDENTICAL TO A SUCCESS
    // WITHOUT. A press that worked and a press that was refused both end on a
    // flipped control, a moved status and one more history entry; the difference
    // is whose entry it is. So the sentence says whose it is and that the press
    // saved nothing — the design's (1k), which names the person and the moment since
    // #463 and says `already` since the files of 2026-10-05 (#495): `Jisoo Park already
    // checked this out on 10/05/2026 8:50 AM. Your check-out wasn't saved.`
    //
    // THE PERSON IS WHO RECORDED THE LATEST ENTRY AND THE MOMENT IS ITS OWN, read by the
    // action as it refuses. The person is named in full, as a place naming who did
    // something does (`actorName`); the moment is the entry's `Event At` in the app's
    // notation, as the design's final files draw it inside the sentence — the slashes
    // dimmed, the time a word's space past the date — rather than #463's `a moment ago`,
    // since a relative time needs a clock the sentence would have to keep reading. So the
    // sentence is parts and the moment one of them, `{ at }`, which the page draws in the
    // reader's zone (`Instant.js`). Without the person it says `Someone else`, and without
    // the entry, `someoneFirst`: that someone else got there first, the one string the
    // action itself answers with.
    //
    // IT NAMES NO STATUS, WHICH IS #378 APPLIED TO ITS OWN SENTENCE. The status is in
    // the header directly above, freshly rendered; restating it here would be the app
    // declining to believe the thing it just did, and one fact twice (#318).
    //
    // A press is what this refusal is always about, a scan's or since #531 a repair's: a
    // retirement leaves a status that allows nothing, so it produces `noTransition` and
    // never this.
    moved: ({ by, event, at, attempted }) => {
        const act = ASSET_TRANSITION_COPY.movedAct[event];
        if (!act || !at) return [ASSET_TRANSITION_COPY.someoneFirst({ attempted })];
        return [`${by || "Someone else"} already ${act} on `, { at }, `. ${ASSET_TRANSITION_COPY.notSaved(attempted)}`];
    },
    someoneFirst: ({ attempted }) =>
        `Someone else ${ASSET_TRANSITION_COPY.firstVerb[attempted] ?? "recorded"} this first. ${ASSET_TRANSITION_COPY.notSaved(attempted)}`,
    // WHAT THE ONE WHO GOT IN FRONT DID, AS FAR AS THE REFUSED PRESS CAN TELL WITH NO ENTRY READ,
    // keyed by that press as `control` is. A scan's says `scanned` — rather than `moved`,
    // which named an asset changing site on this screen until #597 and would still read as
    // one beside `movedTo`'s sentence, which names the job it is on now. A repair's says `recorded`
    // (#531): in this app a scan is a check-out or a check-in, and whoever got in front of a
    // sending may have checked the item out, sent it or retired it, which the sentence cannot
    // know. Any other event, which only a forged submission names, says `recorded` too.
    firstVerb: {
        [ASSET_EVENT.CHECKED_OUT]: "scanned",
        [ASSET_EVENT.CHECKED_IN]: "scanned",
        [ASSET_EVENT.SENT_FOR_REPAIR]: "recorded",
        [ASSET_EVENT.RETURNED_FROM_REPAIR]: "recorded",
    },
    notSaved: (attempted) => {
        const noun = ASSET_TRANSITION_COPY.eventNoun[attempted];
        return noun ? `Your ${noun} wasn't saved.` : "Nothing was saved.";
    },
    // What the latest entry did, said of the asset, and what the refused press was, as a
    // noun — keyed by the event as `control` is, so a new event cannot arrive without
    // them. The noun takes its hyphen, `check-out`, as the design writes it since the files
    // of 2026-10-05 (it wrote `checkout` before); the verb takes none, `checked this out`.
    //
    // A REPAIR IS SAID AS WHAT GOT IN FRONT AND NAMES NO PRESS (#531). The design draws no
    // sentence for it, so these follow 1k's: `Jisoo Park already sent this for repair on …`
    // and `… already returned this from repair on …`, the event's own words. There is no
    // noun for either that reads as one — `your send-for-repair` is not English — so a
    // refused repair says the sentence `notSaved` gives an event with none,
    // `Nothing was saved.`, which is as true and names nothing a reader has to parse.
    movedAct: {
        [ASSET_EVENT.CHECKED_OUT]: "checked this out",
        [ASSET_EVENT.CHECKED_IN]: "checked this in",
        [ASSET_EVENT.SENT_FOR_REPAIR]: "sent this for repair",
        [ASSET_EVENT.RETURNED_FROM_REPAIR]: "returned this from repair",
    },
    eventNoun: {
        [ASSET_EVENT.CHECKED_OUT]: "check-out",
        [ASSET_EVENT.CHECKED_IN]: "check-in",
    },

    // ── whose item it is now (#597) ────────────────────────────────────────
    //
    // `recordingRefusal`'s two sentences, said under the status of the page drawn again: the
    // files of 2026-11-02 draw neither, so they are the app's (`docs/briefs/design-copy-
    // findings.md`). Each names the job the item is on now — the job under its title says the
    // same, freshly drawn — and ends on what the press saved, `notSaved`, as 1k's does.
    //
    // ONE FOR A READER WHO NO LONGER RECORDS ON THE ITEM, in the voice the files give a job that
    // records (#598's `26-USA-01 can no longer record it.`): the office moved it to a job they are
    // not on (#583), or took them off its job. `Only` because a site manager there records it and
    // this reader does not.
    notYours: ({ jobCode, attempted }) =>
        [jobCode ? `Only ${jobCode} can record this item.` : null, ASSET_TRANSITION_COPY.notSaved(attempted)].filter(Boolean).join(" "),
    // ONE FOR A READER WHO STILL DOES: the item moved to another of their jobs, and the page they
    // confirmed named the one it left, so the press is refused rather than recorded somewhere
    // the reader did not see. The page drawn again offers it on the new job.
    movedTo: ({ jobCode, attempted }) =>
        [jobCode ? `This item is on ${jobCode} now.` : null, ASSET_TRANSITION_COPY.notSaved(attempted)].filter(Boolean).join(" "),

    // THE ONE STATE WHERE THE LOG AND THE ASSET'S OWN STATUS DISAGREE, named
    // on screen rather than repaired — the shape `lib/rollbackReport.js` already
    // has for a failed restore, and #338's for an asset whose registration row
    // was not written. It says three things a person can act on: the event is
    // safely on the record, what everybody else will read until this is fixed, and
    // that pressing again fixes it. It does, in both directions: the next press
    // offers the transition the stale status implies, records that event again and
    // writes the status, and the two agree. The cost is a duplicate log row, which
    // is what an append-only log already pays for a mistaken scan.
    statusNotUpdated: ({ assetId, event, status }) =>
        `${event} was recorded against ${assetId}, but its status was not updated — ` +
        `it still reads ${status}, and the lists will say so. Do it again.`,

    // ── retiring (#363) ────────────────────────────────────────────────────
    //
    // THE OPENER NAMES ITS OBJECT WHERE THE TRANSITION CONTROLS DO NOT, and that
    // is not decoration: `Check out` and `Retire this item` sit on one screen, one
    // is pressed dozens of times a day and one is that asset's last, and the
    // words are the half of the difference this file owns. The other half was
    // structural until #458 — the transition control SUBMITTED and this one OPENED —
    // and a check-out opens a dialog of its own now; what stays apart is what this one
    // opens, a question naming the asset with a red commitment and no way back.
    // `Withdraw this PO` is the precedent for the wording. `item` since #519, the design's,
    // where it was `tool` from #455 and `tool item` before.
    retireOpener: "Retire this item",

    // THE TITLE ASKS AND NAMES THE RECORD (#458), which 0l's Confirm and Tools 0a's
    // sheet that confirms both state, in the same words at both widths: its category's name
    // here, and the line under it holds only the asset's id. It was `Retire this
    // tool?` — the opener as a question, `Withdraw this PO?`'s shape — and a person who
    // opened this by accident now meets what they are about to end by its name, with
    // the id to hold against the sticker. An asset whose category did not resolve is
    // named by its id instead.
    retireHeading: ({ itemName, assetId }) => `Retire ${itemName || assetId}?`,

    // THE BODY IS THE POINT OF THE DIALOG AND NOT A WARNING WRAPPED AROUND A BUTTON.
    // `docs/briefs/_shared.md` says it of the three deletion voices: they are accurate
    // accounts of what becomes true, and that voice is what a confirmation is for. 0l's
    // Confirm asks for the one sentence that says what the act ends, and these are the
    // design's words (1f, 1j) since #458: it leaves the count, nothing more can be
    // recorded, and the app's ending for an act with no way back. The sentence before
    // them added that the row and its history stay.
    retireBody:
        "It will be removed from inventory, and no more check-outs or check-ins can be " +
        "recorded. This can't be undone.",

    // THE CONFIRM NAMES WHAT IT RETIRES, the design's `Retire item` since #519 and
    // `Retire tool` from #455. It said
    // `Retire` until then, on the reading that the heading above had already named
    // the object; the design gives the last press its object as well, so the button
    // a person presses to end an asset says what it ends even read on its own. It is
    // the verb of the act the title asks about, which is 0l's Confirm.
    retireSubmit: "Retire item",
    // And while the retirement is on its way (#469): 0f's Working, the verb alone in its
    // `-ing` form with an ellipsis. The object goes with the count 0f leaves out, and the
    // design draws no submitting state for this dialog, so the word is 0f's rule applied.
    retireWorking: "Retiring…",
};
