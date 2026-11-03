"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withSiteManagerAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAssetByAssetId, updateAssetCache, updateAssetNote } from "@/lib/airtable/assets";
import { withKeyLock } from "@/lib/airtable/client";
import { createAssetLogEntry, getAssetLogByAsset } from "@/lib/airtable/assetLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { ASSET_COPY } from "@/lib/assetView";
import { actorName } from "@/lib/userName";
import { ASSET_EVENT, statusAfterEvent } from "@/lib/assetStatus";
import {
    ASSET_TRANSITION_COPY,
    planTransition,
    readLend,
    readRetirement,
    readReturn,
    readSubmission,
    recordingRefusal,
} from "@/lib/assetTransition";
import { readNoteSubmission } from "@/lib/assetNote";
import { assetPath } from "@/lib/assetRoutes";
import { normalizeItemText } from "@/lib/itemNaming";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Check one asset out, or back in (#362), or send it for repair or take it back (#531) —
 * one `Asset Log` row and the two cached fields that follow it.
 *
 * ONE ACTION FOR EVERY EVENT BUT THE RETIREMENT, BECAUSE THE EVENT IS DERIVED RATHER THAN
 * CHOSEN. `planTransition` reads what may be recorded off the stored status — the page's
 * press, and from stock the menu's `Send for repair` — so a second action would be a
 * second place applying one rule and could be called against a status that does not
 * offer it. What the form sends is compared, never used — see `readSubmission`. The
 * retirement has an action of its own because it holds its own answer in its own
 * question; a repair asks nothing, so its answer stands where a scan's does, under the
 * status (1k).
 *
 * EVERY ROW TAKES THE ASSET'S JOB, which `readSubmission` hands back from the job the asset
 * holds as just read: a repair's since #531 — an item goes to its maker and comes back to the
 * job it left, as a retirement moves nothing — and a check-out's and a check-in's since #597,
 * which took the job the actor chose from their own until then and could move the item to it
 * (`lib/assetStatus.js:JOB_SOURCE_OF_EVENT`). No submitted job is read.
 *
 * ONLY A SITE MANAGER RECORDS, AND THE WRAPPER DECIDES THAT BEFORE THIS BODY RUNS
 * (#506). `withSiteManagerAction` refuses anybody else — the page they pressed on,
 * rendered again without the controls, and nothing said. **What this body decides is the
 * asset (#597)**: only a site manager on the job the item sits on records on it
 * (`lib/assetJob.js:recordsOn`, through `planTransition` on a fresh read), with no office
 * clause — recording is site work — and deliberately not `canAccessJobDeliveries`, which
 * admits the office to every job. It is a per-record comparison now, where a site manager
 * recorded against any asset until #597, and a refused one is SAID rather than drawn: the
 * item moved to a job the reader is not on (#583), or the reader was taken off its job, or it
 * moved to another of theirs since the page was drawn, which the form's `drawnJobId` shows and
 * which is never written (`recordingRefusal`). Anyone signed in still reads every asset (#337).
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE THE CALL SITE BINDS (#185).
 * `AssetTransition.js` reads this through `useActionState` for both of the page's
 * drawings (#463), so every refusal lands in the one place it has for them — above
 * the desk's dialog's actions while it stands open, and under the status otherwise,
 * where 1k says a refused press. **It goes through `refuse`, which re-renders the
 * page as it answers (#378)** — a returned sentence on a page nothing re-rendered is
 * true beside a screen that contradicts it.
 *
 * THE TWO WRITES ARE `writeEvent`'s, SHARED WITH THE RETIREMENT BELOW SINCE
 * #363. The ordering, the try boundary and the report of a cache that did not
 * move are one rule and live in one place; that function's header carries the
 * argument.
 *
 * EIGHT AIRTABLE OPERATIONS, MEASURED: the session twice — the wrapper's gate reads
 * it and drops it, and this body reads it again (#506) — the asset, the job list,
 * THREE for the log row — `generateChildId`'s parent find, the sibling read that
 * finds the highest sequence, and the create — and one for the cache. None of
 * them is per row of anything: the sibling read is one query per 50, so an asset
 * with two hundred events costs eleven rather than two hundred and seven.
 *
 * A REFUSAL COSTS FOUR AND WRITES NOTHING: the session twice, the asset and the
 * job list, which are what the verdict is reached from — three of them measured
 * before #506 put the gate's read in front. The two writes are downstream of it.
 * **One that somebody else's scan got in front of costs six (#463)**: the design's
 * sentence names who recorded first and when (1k), so `refuseStale` reads the asset's
 * latest `Asset Log` row and the person who recorded it, one operation each.
 *
 * SEVEN ON THE FIRST EVENT AFTER A REGISTRATION THAT LOST ITS LOG ROW, because
 * `findChildRecords` on an empty link array costs nothing. That is #338's
 * unlogged state, and it is why this figure is stated as the ordinary case
 * rather than as a law.
 *
 * NO LOCK, AND THAT IS FORCED RATHER THAN CHOSEN. Wrapping this in
 * `withKeyLock` on the asset would NEST with the per-parent lock
 * `generateChildId` takes inside `createAssetLogEntry`, which CLAUDE.md's
 * concurrency section forbids and `lib/materialsCache.js` is the precedent
 * against. It would also buy little: `withKeyLock` serializes within one process
 * or invocation, so two concurrent Vercel invocations read the same status
 * either way. WHAT THAT LEAVES, UNOBSERVED AND WRITTEN DOWN HERE RATHER THAN
 * GUARDED: two people scanning one physical asset at the same instant can both
 * confirm, both rows land — which is correct, an append-only log records what
 * happened — and the cache takes whichever update lands last, so it can disagree
 * with the final row. One more scan repairs it. Nobody has hit this; the
 * situation it describes is two people handing one drill over at once.
 *
 * ON SUCCESS IT REDIRECTS TO THE PAGE IT CAME FROM AND SAYS NOTHING (#321). The
 * status flips, a history entry appears and the control now reads the other way
 * — that IS the confirmation, and a banner would say what the page already says
 * while standing between the reader and the next scan. **A refusal reaches the
 * same fresh page by the other mechanism and keeps its sentence**; `refuse`
 * carries why the two differ.
 */
export const recordAssetEventAction = withSiteManagerAction(recordAssetEventHandler);

async function recordAssetEventHandler(prevState, formData) {
    return withOpsLabel("recordAssetEventAction", async () => {
        const user = await requireUser();

        // The PRINTED id, which is what the page was reached by and what the form
        // carries. The lookup is case-insensitive, so a forged or hand-typed
        // spelling resolves the same way the page's own does.
        const asset = await getAssetByAssetId(String(formData.get("assetId") ?? ""));
        // Reachable by a submission the screen did not produce, and by a press on
        // a page drawn before the office deleted the asset (#582), which no reader
        // hands back since. It answers in the page's own words rather than coining
        // a refusal of its own: the page drawn again is the code no asset carries.
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);

        // THE PLAN IS BUILT FROM THE STORED STATUS AND THE STORED JOB, NOT THE SUBMITTED
        // ONES, so the offer this compares against is a fact about the base. The job list
        // is the whole table, which is the shape `/deliveries` and #338 both use; the plan
        // reads the item's job's code off it, for a refusal to name (#597).
        const plan = planTransition({
            user,
            jobs: await getAllJobs(),
            status: asset.status,
            assetJobId: asset.job?.[0],
            ownerJobId: asset.ownerJob?.[0],
        });
        const { event, jobRecordId, checkedOutTo, refusal, stale } = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            drawnJobId: String(formData.get("drawnJobId") ?? ""),
            checkedOutTo: String(formData.get("checkedOutTo") ?? ""),
        });
        // The page was looking at a status somebody else has moved since: say who, and
        // when, and what the press was (#463).
        if (stale) return refuseStale({ asset, refusal, attempted: String(formData.get("event") ?? "") });
        if (refusal) return refuse(refusal);

        // The asset's own job, for every event (#531, #597). The name is the reader's answer
        // rather than the form's (#376) — normalized, and null on every event but a check-out
        // whatever the form sent.
        const failed = await writeEvent({
            asset,
            event,
            jobRecordId,
            checkedOutTo,
            user,
            from: plan.status,
        });
        if (failed) return failed;

        redirect(assetPath(asset.assetId));
    });
}

/**
 * Retire one asset (#363) — the transition with no way out.
 *
 * A QUESTION BEFORE IT HAPPENS, WHERE A SCAN ASKS ONLY WHAT IT NEEDS. CLAUDE.md held
 * that a modal is for an act that cannot be undone and an act that can is edited in
 * place, until #459 dropped it; where a dialog goes is the design's now, and since
 * #458 a check-out opens a dialog too, for the name it records. What still differs
 * is this one's: it asks a question naming the asset before an act nothing undoes,
 * where the transition's is the fields of an act the next scan undoes. The
 * frequency argument points the same way — an asset is retired once, ever, so
 * a heavier confirmation costs nothing anybody will meet twice.
 *
 * NO REASON IS ASKED FOR, AND THAT IS A RULE THIS ISSUE RETIRED RATHER THAN
 * IMPLEMENTED. A required note on this event was recorded as pending from #334,
 * on two grounds: a record of who was responsible, and the act being
 * irreversible. #335 deleted the `Lost` event and the first ground with it, and
 * the modal above carries the second — so nothing was left holding the rule up.
 * `Tool Log."Notes"` is read by nothing as of this commit and comes off the base
 * by hand, since the Metadata API has no field DELETE.
 *
 * THE SAME WRAPPER AND THE SAME AXIS as the action above (#506): only a site manager
 * gets past `withSiteManagerAction`, and the body asks the rest of it — since #597 that the
 * item sits on one of the reader's jobs, the per-record comparison the action above makes.
 *
 * NOTHING CROSSES THE WIRE BUT THE ASSET'S ID AND THE JOB THE PAGE WAS DRAWN ON. There is
 * one direction, so the event is `ASSET_EVENT.RETIRED` from the vocabulary; and the job is
 * the asset's owner job (#598) — its own unless it is on loan, when the retirement takes it back
 * to the job that owns it as it ends — because retiring takes nothing anywhere else and the person
 * designating need not be near it. `readRetirement` carries both arguments, including the
 * row on this base that proved the second one. The drawn job is compared and never
 * written (`recordingRefusal`, #597).
 *
 * WHICH LEAVES THE BODY'S QUESTION AS `planTransition`'s: whether the actor records on this
 * item. **A retirement somebody else got in front of says nothing (#378)**: the page drawn
 * again draws a status that allows nothing, and the question goes with its opener, so the
 * plan's terminal sentence is not returned — it would stand under the status the page already
 * shows is the end. One refused because the item is no longer the reader's to record is
 * returned, and said there (#597).
 *
 * EIGHT OPERATIONS, the same eight the action above spends, for the same
 * reasons and in the same order.
 */
export const retireAssetAction = withSiteManagerAction(retireAssetHandler);

async function retireAssetHandler(prevState, formData) {
    return withOpsLabel("retireAssetAction", async () => {
        const user = await requireUser();

        const asset = await getAssetByAssetId(String(formData.get("assetId") ?? ""));
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);

        // The same planner on a fresh read, which is also how a stale page is
        // answered here: somebody who retired this first makes `mayRetire` false
        // and the refusal is the terminal sentence, which the page says itself.
        const plan = planTransition({
            user,
            jobs: await getAllJobs(),
            status: asset.status,
            assetJobId: asset.job?.[0],
            ownerJobId: asset.ownerJob?.[0],
        });
        // THE JOB IS THE ASSET'S OWNER JOB AND THE FORM SENDS NONE TO WRITE (#598). Retiring
        // moves an asset only off a loan, back to the job that owns it; `readRetirement`
        // carries the argument and the row on this base that proved the rest.
        const { jobRecordId, refusal } = readRetirement(plan, {
            drawnJobId: String(formData.get("drawnJobId") ?? ""),
        });
        if (refusal === ASSET_TRANSITION_COPY.noTransition) return refuse(null);
        if (refusal) return refuse(refusal);

        const failed = await writeEvent({
            asset,
            event: ASSET_EVENT.RETIRED,
            jobRecordId,
            user,
            from: plan.status,
        });
        if (failed) return failed;

        redirect(assetPath(asset.assetId));
    });
}

/**
 * Lend one asset to another job (#598) — a `Lent` entry on the job chosen, and the asset's `Job`
 * moved to it, in stock there; its `Owner Job` stays. Or return one to its owner job — a
 * `Returned to owner` entry on that job and the asset's `Job` put back to it. A site manager on
 * the job the item stands on does either: the owner's lends, the borrower's returns.
 *
 * THE SAME WRAPPER AND THE SAME PLAN ON A FRESH READ, AND THE ITEM'S LATEST ENTRY WITH IT. Only a
 * site manager gets past `withSiteManagerAction`; `planTransition` asks the rest of the read it is
 * handed — that the reader records on the job the item stands on, that it is in stock, that it
 * stands on its owner job to be lent and on another to be returned, and which jobs a lending may
 * choose — and `readLend` / `readReturn` the press, in `readSubmission`'s order. The latest
 * entry is read, one operation, because it is what says a loan is half done (`pendingLoan`).
 *
 * THE ENTRY FIRST, THEN THE ITEM, AND A HALF-DONE LOAN IS FINISHED BY PRESSING AGAIN — #582's
 * deletion's shape, written out here rather than through `writeEvent`, which would write a second
 * entry: a press whose entry stands writes the item alone. A failed entry write writes nothing and
 * throws; a failed item write after it is named on the page and logged with the record id, never
 * written back (`lendHalfDone`, `returnHalfDone`).
 *
 * NO LOCK, `writeEvent`'s reason. **Unobserved, and recorded here rather than guarded**: a site
 * manager recording another event on an item whose loan was left half done — a check-out on the
 * owner job under a `Lent` entry whose item did not move — leaves a history whose latest entry is
 * no loan's, so the half-done loan reads as none and is finished in Airtable.
 *
 * NINE OPERATIONS: the session twice, the asset, the job list, its latest entry, THREE for the
 * entry (`generateChildId`'s parent find, the sibling read and the create) and one for the item.
 * A half-done one's finish is the first five and the item; a refusal is at most the first five and
 * the page drawn again, and one somebody got in front of two more, `refuseStale`'s.
 *
 * ON SUCCESS IT REDIRECTS TO THE PAGE IT CAME FROM AND SAYS NOTHING (#321): the job under the title,
 * `On loan from` beside it or gone, and the entry at the history's head say it.
 */
export const lendAssetAction = withSiteManagerAction(lendAssetHandler);

async function lendAssetHandler(prevState, formData) {
    return withOpsLabel("lendAssetAction", async () => {
        const user = await requireUser();
        const asset = await getAssetByAssetId(String(formData.get("assetId") ?? ""));
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);
        const plan = await planLoan({ user, asset });
        const answer = readLend(plan, {
            drawnJobId: String(formData.get("drawnJobId") ?? ""),
            jobId: String(formData.get("jobId") ?? ""),
        });
        if (answer.stale) return refuseStale({ asset, refusal: answer.refusal, attempted: ASSET_EVENT.LENT });
        if (answer.refusal) return refuse(answer.refusal);
        const to = plan.lendJobs.find((job) => job.id === answer.jobRecordId)?.jobCode ?? "";
        const failed = await writeLoan({
            asset,
            event: ASSET_EVENT.LENT,
            answer,
            user,
            halfDone: ASSET_TRANSITION_COPY.lendHalfDone({ from: plan.jobCode ?? "", to }),
        });
        if (failed) return failed;
        redirect(assetPath(asset.assetId));
    });
}

/** Return one asset to its owner job (#598) — see `lendAssetAction`. */
export const returnAssetToOwnerAction = withSiteManagerAction(returnAssetToOwnerHandler);

async function returnAssetToOwnerHandler(prevState, formData) {
    return withOpsLabel("returnAssetToOwnerAction", async () => {
        const user = await requireUser();
        const asset = await getAssetByAssetId(String(formData.get("assetId") ?? ""));
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);
        const plan = await planLoan({ user, asset });
        const answer = readReturn(plan, { drawnJobId: String(formData.get("drawnJobId") ?? "") });
        if (answer.stale) return refuseStale({ asset, refusal: answer.refusal, attempted: ASSET_EVENT.RETURNED_TO_OWNER });
        if (answer.refusal) return refuse(answer.refusal);
        const failed = await writeLoan({
            asset,
            event: ASSET_EVENT.RETURNED_TO_OWNER,
            answer,
            user,
            halfDone: ASSET_TRANSITION_COPY.returnHalfDone({ from: plan.jobCode ?? "" }),
        });
        if (failed) return failed;
        redirect(assetPath(asset.assetId));
    });
}

/** The plan a loan's press is judged by: the job list and the item's latest entry, read together. */
async function planLoan({ user, asset }) {
    const latestId = asset.assetLog?.at(-1);
    const [jobs, rows] = await Promise.all([getAllJobs(), latestId ? getAssetLogByAsset(asset.id, { rowIds: [latestId] }) : []]);
    return planTransition({
        user,
        jobs,
        status: asset.status,
        assetJobId: asset.job?.[0],
        ownerJobId: asset.ownerJob?.[0],
        latest: rows[0] ?? null,
    });
}

/**
 * A loan's two writes: the entry where the answer says it is due, then the item's `Job` and its
 * status, `statusAfterEvent`'s — `In stock`, as it stood. Not exported, `writeEvent`'s reason.
 */
async function writeLoan({ asset, event, answer, user, halfDone }) {
    if (answer.writesEntry) {
        await createAssetLogEntry({
            assetRecordId: asset.id,
            assetId: asset.assetId,
            event,
            jobRecordId: answer.jobRecordId,
            recordedByUserId: user.id,
        });
    }
    try {
        await updateAssetCache({ assetRecordId: asset.id, status: statusAfterEvent(event), jobRecordId: answer.jobRecordId });
    } catch (error) {
        console.error("Asset job not moved after its loan entry was written (#598)", {
            assetRecordId: asset.id,
            assetId: asset.assetId,
            event,
            jobRecordId: answer.jobRecordId,
            error,
        });
        return refuse(halfDone);
    }
    return null;
}

/**
 * Write an asset's note, or clear it (#533) — `Assets."Note"` in place, and nothing else.
 *
 * NO `Asset Log` ROW, BECAUSE A NOTE IS NO EVENT. The two actions above append one and move
 * the caches; this writes the one field no event writes, so the item's history and the day
 * its category's list says it last changed are left as they were (`lib/assetNote.js`).
 *
 * THE SAME WRAPPER, AND THE SAME ANSWER TO WHO (#506). Only a site manager gets past
 * `withSiteManagerAction`, and the body asks `planTransition` the rest — that the item sits on
 * one of the reader's jobs (#597) and that the status allows a note (`mayWriteNote`) — which is
 * the answer the page drew its control on. A note records no job, and is still refused, and
 * said, when the item is no longer the reader's to write or moved since the page was drawn:
 * `recordingRefusal`, asked first, as the other two ask it.
 *
 * WHAT THE PAGE WAS DRAWN WITH IS COMPARED, NEVER WRITTEN (#378). The form carries the note it
 * opened on as `previous`, and `readNoteSubmission` refuses a press whose note somebody else has
 * changed since — said, and the page drawn again under the dialog that stays open — and answers
 * a reader who may no longer write with the page drawn again and nothing said, #378's terminal
 * case: the control is gone from it and the reason is on it.
 *
 * A READ AND A WRITE UNDER ONE LOCK, keyed by the printed id the form carries, folded as the
 * lookup folds it — so two presses in one process cannot both pass the comparison. It nests
 * nothing: the writer takes no lock of its own. Two invocations still race, `withKeyLock`'s
 * standing limit, and the later write wins; a reader who loses that race sees the other note
 * once the page is opened again.
 *
 * FIVE OPERATIONS: the session twice — the wrapper's gate and this body — the asset, the job
 * list `planTransition` reads assignments against, and the write. A refusal is the first four
 * and the page drawn again; a note left as it was writes nothing and lands as a success does.
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE ITS CALL SITE BINDS (#185): the page's provider
 * (`AssetTransition.js`) reads it through `useActionState` since #597, where `AssetNote.js` did,
 * and it is said above the dialog's actions or under the sheet's field while the opening that
 * sent it stands, and under the status once the page has ended it. A success redirects to the
 * page it came from and says nothing (#321).
 */
export const updateAssetNoteAction = withSiteManagerAction(updateAssetNoteHandler);

async function updateAssetNoteHandler(prevState, formData) {
    return withOpsLabel("updateAssetNoteAction", async () => {
        const user = await requireUser();
        const asked = String(formData.get("assetId") ?? "");

        const outcome = await withKeyLock(`asset-note:${normalizeItemText(asked).toLowerCase()}`, async () => {
            const asset = await getAssetByAssetId(asked);
            if (!asset) return { refusal: ASSET_COPY.notFoundHeading };

            const plan = planTransition({ user, jobs: await getAllJobs(), status: asset.status, assetJobId: asset.job?.[0], ownerJobId: asset.ownerJob?.[0] });
            const recording = recordingRefusal(plan, { drawnJobId: String(formData.get("drawnJobId") ?? ""), attempted: null });
            if (recording) return { refusal: recording };
            const answer = readNoteSubmission(plan, {
                typed: String(formData.get("note") ?? ""),
                previous: String(formData.get("previous") ?? ""),
                stored: asset.note,
            });
            if (answer.ended || answer.refusal) return answer;
            if (!answer.unchanged) await updateAssetNote({ assetRecordId: asset.id, note: answer.note });
            return { landed: asset.assetId };
        });

        if (outcome.ended) return refuse(null);
        if (outcome.refusal) return refuse(outcome.refusal);
        redirect(assetPath(outcome.landed));
    });
}

/**
 * The one shape a refusal takes here, and the re-render that goes with it (#378).
 *
 * EVERY REFUSAL THESE THREE ACTIONS RETURN SAYS THE PAGE IS OUT OF DATE, WHICH IS
 * WHY THIS IS ONE PLACE RATHER THAN A JUDGMENT PER REFUSAL. Each reaches its
 * verdict through `planTransition` on a status just read from the base — the note's
 * on its note too (#533) — and the
 * page reaches its own from the same function — so an action that refuses is one
 * whose caller is looking at something the base no longer says. Returning and no
 * more leaves every one of those facts on screen as it was: the status, the
 * control's direction and the history all still read what they did before the
 * press, and the refusal is the one true line on a page contradicting it.
 *
 * `refresh()` IS WHAT SENDS THE SENTENCE AND A FRESH RENDER TOGETHER, and the
 * mechanism is exact rather than hopeful. Measured against the installed 16.2.10
 * rather than read off the documentation: `server/app-render/action-handler.js`
 * skips rendering the page unless `workStore.pathWasRevalidated` says otherwise,
 * and `refresh()` does nothing but set it. So one response carries the return
 * value AND the page, and `useActionState` keeps the sentence while the tree
 * under it moves.
 *
 * NOT `revalidatePath`, WHICH WOULD DO NOTHING HERE. A dynamic route passed to it
 * with no `type` warns and has no effect, and there is no cached data on this axis
 * to purge in any case — what wants re-rendering is one page, not a cache. NOT
 * `router.refresh()` either: a second round trip, and the rule would live in the
 * two forms rather than at the one place that decides to refuse.
 *
 * THE SUCCESS PATH KEEPS ITS REDIRECT, AND THE TWO MECHANISMS ARE TWO ACTS. A
 * redirect is a navigation and throws away the client state it leaves — the
 * scroll, an open modal, the chosen job, the slot this sentence lives in — and
 * that is right when there is nothing to keep. After a refusal there is exactly
 * one thing to keep. So a success navigates and a refusal re-renders in place.
 *
 * IT WORKS ONLY INSIDE A SERVER ACTION, since `refresh()` throws anywhere else.
 * That is a constraint on this function rather than a hazard: its callers are the
 * three actions' handlers and the writer two of them share. A press `withSiteManagerAction`
 * turns away never gets this far, and is answered the same way — a fresh render —
 * by the wrapper's own refusal (#506), with nothing said.
 *
 * NOT EXPORTED, for `writeEvent`'s reason — an export of a `"use server"` module
 * is an entry point callable from a browser.
 *
 * `moved` RIDES BESIDE THE SENTENCE FOR A STALE PRESS (#463): who recorded the latest
 * entry, what it was, and when, which the page turns into 1k's sentence in the reader's
 * own zone. `error` is still the whole sentence without them, so nothing that reads
 * only `error` says less than it did.
 *
 * AND A REFUSAL THE PAGE SAYS ON ITS OWN IS `null`, the page and nothing beside it (#533): a
 * note pressed on an item somebody retired or sent for repair since, or a retirement somebody
 * got in front of, whose fresh page draws no control to write with — #378's terminal case,
 * which the wrapper's own refusal answers the same way (#506). A press by a reader the item is
 * no longer the reader's to record is not one of them since #597: the page drawn again shows
 * the item's job and no control, and nothing on it says the press was theirs and was lost.
 */
function refuse(error, moved = null) {
    refresh();
    if (error === null) return null;
    return moved ? { error, moved } : { error };
}

/**
 * The refusal for a press somebody else's scan got in front of (#463): the design names
 * them and the moment — `Jisoo Park checked this out a moment ago. Your check-out wasn't
 * saved.` (1k) — so this reads the asset's latest `Asset Log` row and who recorded it.
 *
 * THE LATEST ROW IS THE LINK ARRAY'S LAST, which is creation order and for an append-only
 * table the newest; read through `findChildRecords` as one id, so one operation, and the
 * recorder is one more. That row is what flipped the status the page was looking at — or,
 * rarer, a row whose cache write failed (`statusNotUpdated`), and either way it is the scan
 * the reader's press came after. The person is named in full (`actorName`), the moment is
 * the row's own `Event At`, and the page writes it in the reader's zone.
 *
 * A READ THAT FAILS DOES NOT TURN A REFUSAL INTO AN ERROR: the press was refused either way,
 * so it says the sentence `readSubmission` gave, which names nobody, and logs why.
 */
async function refuseStale({ asset, refusal, attempted }) {
    try {
        const latestId = asset.assetLog?.at(-1);
        const [latest] = latestId ? await getAssetLogByAsset(asset.id, { rowIds: [latestId] }) : [];
        if (!latest) return refuse(refusal);
        const recorderId = latest.recordedBy?.[0];
        const [recorder] = recorderId ? await getUsersByRecordIds([recorderId]) : [];
        return refuse(refusal, { by: actorName(recorder) || null, event: latest.event, at: latest.eventAt ?? null, attempted });
    } catch (error) {
        console.error("The latest Asset Log row was not read for a stale press (#463)", { assetId: asset.assetId, error });
        return refuse(refusal);
    }
}

/**
 * The two writes every recorded event makes, and the one that can half-fail.
 *
 * ONE IMPLEMENTATION FOR BOTH ACTIONS, WHICH #363 EXTRACTED RATHER THAN COPYING.
 * The ordering, the try boundary and the report are one rule — a second copy is
 * two places that have to stay in step, and CLAUDE.md's own section says a
 * duplication is not closed by leaving it as two. What differs between the two
 * callers is which event they arrive with, and that is decided above.
 *
 * NOT EXPORTED, so it is not a Server Action and not an entry point: only an
 * export of a `"use server"` module is callable from a browser.
 *
 * THE LOG GOES FIRST AND NOTHING ROLLS BACK. Airtable has no cross-table
 * transaction, so the row and the cache are two writes whichever way they are
 * arranged; `createAssetLogEntry`'s own header is why neither hides inside the
 * other. The log is the RECORD and the cache is derived from it, so a cache
 * written with no row behind it loses the event with nowhere else holding it,
 * while a row with a stale cache is recoverable and is reported. `Asset Log` is
 * append-only — there is no delete — so undoing the first write is not
 * available even in principle.
 *
 * A FAILED CACHE WRITE IS NAMED ON SCREEN AND LOGGED WITH ITS RECORD ID, NEVER
 * SWALLOWED — and never written back to Airtable, which is what just failed.
 * That is `lib/rollbackReport.js`'s rule for a failed restore and the shape
 * fits: the event is on the record, the asset's own status is not, and the
 * person who caused it is the only one who knows. Doing it again writes the same
 * event and lands the status, so the repair is the control they are already
 * looking at.
 *
 * **AND IT REPORTS THROUGH `refuse`, WHICH IS THE CASE THAT MOST NEEDED IT
 * (#378).** This is the one answer here that means something was written, and
 * until this issue it stood on a page where the row it says is safe was nowhere
 * to be seen. Re-rendering puts the new entry at the foot of the history and
 * leaves the status where the sentence says it is, so the screen and the sentence
 * agree for the first time.
 *
 * `from` IS THE STATUS THE ASSET STILL READS — the one the plan was built
 * on — because that is what the sentence has to tell them, not the one the event
 * was meant to leave behind.
 *
 * IT TAKES A JOB RECORD ID RATHER THAN A JOB, the asset's cached link as read, which
 * every event here records on since #597 — a scan resolved a job object out of the
 * actor's own assignments until then. Writing it back to the cache writes the value
 * the cache holds, and keeps this function ignorant of which kind of event it is
 * writing, which is what lets it be one implementation.
 */
async function writeEvent({ asset, event, jobRecordId, checkedOutTo, user, from }) {
    await createAssetLogEntry({
        assetRecordId: asset.id,
        assetId: asset.assetId,
        event,
        jobRecordId,
        recordedByUserId: user.id,
        // Present on a check-out and absent on every other event (#376). The
        // retirement below passes nothing, which is the same statement from the
        // other side; `createAssetLogEntry` refuses either half being wrong.
        checkedOutTo,
    });

    try {
        await updateAssetCache({
            assetRecordId: asset.id,
            status: statusAfterEvent(event),
            jobRecordId,
        });
    } catch (error) {
        console.error(
            "Asset status not updated after its Asset Log row was written (#362)",
            {
                assetRecordId: asset.id,
                assetId: asset.assetId,
                event,
                error,
            }
        );
        return refuse(
            ASSET_TRANSITION_COPY.statusNotUpdated({
                assetId: asset.assetId,
                event,
                status: from,
            })
        );
    }

    return null;
}
