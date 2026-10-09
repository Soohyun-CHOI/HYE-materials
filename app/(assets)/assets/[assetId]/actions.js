"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withSiteManagerAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAssetByAssetId, updateAssetCache } from "@/lib/airtable/assets";
import { createAssetLogEntry, getAssetLogByAsset } from "@/lib/airtable/assetLog";
import { getUsersByRecordIds } from "@/lib/airtable/users";
import { ASSET_COPY } from "@/lib/assetView";
import { actorName } from "@/lib/userName";
import { ASSET_EVENT, statusAfterEvent } from "@/lib/assetStatus";
import {
    ASSET_TRANSITION_COPY,
    planTransition,
    readRetirement,
    readSubmission,
} from "@/lib/assetTransition";
import { assetPath } from "@/lib/assetRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Check one asset out, or back in (#362) — one `Asset Log` row and the two
 * cached fields that follow it.
 *
 * ONE ACTION FOR BOTH DIRECTIONS, BECAUSE THE EVENT IS DERIVED RATHER THAN
 * CHOSEN. `eventOfferedBy` reads it off the stored status, so two actions would
 * be two places applying one rule and one of them could be called against a
 * status that does not offer it. What the form sends is compared, never used —
 * see `readSubmission`.
 *
 * ONLY A SITE MANAGER RECORDS, AND THE WRAPPER DECIDES THAT BEFORE THIS BODY RUNS
 * (#506). `withSiteManagerAction` refuses anybody else — the page they pressed on,
 * rendered again without the controls, and nothing said. What this body still decides
 * is the job, #338's axis exactly, as it did while this action was an exemption: the
 * submitted job has to be one the actor's own `Users."Assigned Jobs"` names, with no
 * office clause — scanning an asset is site work, so a site manager on no job is refused
 * whatever else they are — and deliberately not `canAccessJobDeliveries`, which admits
 * the office to every job. Nothing here is scoped per asset: a site manager may
 * record against any of them, as anyone signed in may read them (#337), which is why
 * the only per-record comparison is about the job.
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
        // Reachable only by a submission the screen did not produce — the form
        // renders under an asset the page has already found, and this app
        // offers no way to delete one. It answers in the page's own words rather
        // than coining a refusal of its own for a state with no screen behind it.
        if (!asset) return refuse(ASSET_COPY.notFoundHeading);

        // THE PLAN IS BUILT FROM THE STORED STATUS, NOT THE SUBMITTED ONE, so the
        // offer this compares against is a fact about the base. The job list is
        // the whole table, which is the shape `/deliveries` and #338 both use, and
        // `assignedJobsFor` narrows it to the actor's own inside `planTransition`.
        const plan = planTransition({
            user,
            jobs: await getAllJobs(),
            status: asset.status,
        });
        const { event, job, checkedOutTo, refusal, stale } = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            jobId: String(formData.get("jobId") ?? ""),
            checkedOutTo: String(formData.get("checkedOutTo") ?? ""),
        });
        // The page was looking at a status somebody else has moved since: say who, and
        // when, and what the press was (#463).
        if (stale) return refuseStale({ asset, refusal, attempted: String(formData.get("event") ?? "") });
        if (refusal) return refuse(refusal);

        // The actor's own job, because a scan is the actor handling the asset. The
        // name is the reader's answer rather than the form's (#376) — normalized,
        // and null on a check-in whatever the form sent.
        const failed = await writeEvent({
            asset,
            event,
            jobRecordId: job.id,
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
 * gets past `withSiteManagerAction`, and the body asks the rest of it. Nothing on this
 * axis is scoped per asset (#337).
 *
 * NOTHING CROSSES THE WIRE BUT THE ASSET'S ID. There is one direction, so
 * the event is `ASSET_EVENT.RETIRED` from the vocabulary; and the job is the asset's
 * own, because retiring does not move an asset and the person designating
 * need not be near it. `readRetirement` carries both arguments, including the
 * row on this base that proved the second one.
 *
 * WHICH LEAVES THE BODY'S QUESTION AS `planTransition`'s: the actor must hold at
 * least one assigned job. There is no submitted job left to compare, and that is a
 * smaller surface rather than a weaker one — the forgery it used to refuse existed
 * only because the value was submitted.
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
        // and the refusal is the terminal sentence.
        const plan = planTransition({
            user,
            jobs: await getAllJobs(),
            status: asset.status,
        });
        // THE JOB IS THE ASSET'S OWN AND THE FORM SENDS NONE. Retiring does
        // not move an asset, so the row records where it was; `readRetirement`
        // carries the argument and the row on this base that proved it.
        const { jobRecordId, refusal } = readRetirement(plan, {
            currentJobRecordId: asset.job?.[0],
        });
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
 * The one shape a refusal takes here, and the re-render that goes with it (#378).
 *
 * EVERY REFUSAL THESE TWO ACTIONS RETURN SAYS THE PAGE IS OUT OF DATE, WHICH IS
 * WHY THIS IS ONE PLACE RATHER THAN A JUDGMENT PER REFUSAL. Both reach their
 * verdict through `planTransition` on a status just read from the base, and the
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
 * two actions' handlers and the writer they share. A press `withSiteManagerAction`
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
 */
function refuse(error, moved = null) {
    refresh();
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
 * IT TAKES A JOB RECORD ID RATHER THAN A JOB, BECAUSE THE TWO CALLERS FIND ONE
 * DIFFERENTLY. A scan resolves a job object out of the actor's own assignments;
 * a retirement reads the asset's cached link and never sees a job object at
 * all. Narrowing the parameter to the thing both actually have keeps this
 * function ignorant of which kind of event it is writing, which is what lets it
 * be one implementation.
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
