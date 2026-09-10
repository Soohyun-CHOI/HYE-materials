"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getToolItemByToolItemId, updateToolItemCache } from "@/lib/airtable/toolItems";
import { createToolLogEntry } from "@/lib/airtable/toolLog";
import { TOOL_ITEM_COPY } from "@/lib/toolItemView";
import { statusAfterEvent } from "@/lib/toolStatus";
import { TOOL_TRANSITION_COPY, planTransition, readSubmission } from "@/lib/toolTransition";
import { toolItemPath } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Check one tool item out, or back in (#362) — one `Tool Log` row and the two
 * cached fields that follow it.
 *
 * ONE ACTION FOR BOTH DIRECTIONS, BECAUSE THE EVENT IS DERIVED RATHER THAN
 * CHOSEN. `eventOfferedBy` reads it off the stored status, so two actions would
 * be two places applying one rule and one of them could be called against a
 * status that does not offer it. What the form sends is compared, never used —
 * see `readSubmission`.
 *
 * NOT WRAPPED, AND LISTED AS AN EXEMPTION WITH THAT REASON. This is #338's axis
 * exactly: `requireUser()` settles only that this is an active session, and the
 * authorization that decides anything is that the submitted job is one the
 * actor's own `Users."Assigned Jobs"` names. No role helper fits — scanning a
 * tool is site work, so an Admin on no job must be refused and a non-Admin
 * employee on a job must pass — and deliberately not `canAccessJobDeliveries`,
 * which admits the office to every job. Nothing here is scoped per tool item:
 * anyone signed in may reach any of them (#337), which is why the only
 * per-record comparison is about the job.
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE THE CALL SITE BINDS (#185).
 * ToolTransitionForm.js reads this through `useActionState`, so every refusal
 * lands in the one slot that form has for them.
 *
 * TWO WRITES IN SEQUENCE, THE LOG FIRST, AND NOTHING ROLLS BACK. Airtable has no
 * cross-table transaction, so the row and the cache are two writes whichever way
 * they are arranged; `createToolLogEntry`'s own header is why neither hides
 * inside the other. The log goes first because it is the RECORD and the cache is
 * derived from it: a cache written with no row behind it loses the event with
 * nowhere else holding it, while a row with a stale cache is recoverable and is
 * reported. `Tool Log` is append-only — there is no delete — so undoing the
 * first write is not available even in principle.
 *
 * SEVEN AIRTABLE OPERATIONS, MEASURED: the session, the tool item, the job list,
 * THREE for the log row — `generateChildId`'s parent find, the sibling read that
 * finds the highest sequence, and the create — and one for the cache. None of
 * them is per row of anything: the sibling read is one query per 50, so a tool
 * item with two hundred events costs eight rather than two hundred and six.
 *
 * A REFUSAL COSTS THREE AND WRITES NOTHING, also measured: the session, the tool
 * item and the job list, which are what the verdict is reached from. The two
 * writes are downstream of it.
 *
 * SIX ON THE FIRST EVENT AFTER A REGISTRATION THAT LOST ITS LOG ROW, because
 * `findChildRecords` on an empty link array costs nothing. That is #338's
 * unlogged state, and it is why this figure is stated as the ordinary case
 * rather than as a law.
 *
 * NO LOCK, AND THAT IS FORCED RATHER THAN CHOSEN. Wrapping this in
 * `withKeyLock` on the tool item would NEST with the per-parent lock
 * `generateChildId` takes inside `createToolLogEntry`, which CLAUDE.md's
 * concurrency section forbids and `lib/materialsCache.js` is the precedent
 * against. It would also buy little: `withKeyLock` serializes within one process
 * or invocation, so two concurrent Vercel invocations read the same status
 * either way. WHAT THAT LEAVES, UNOBSERVED AND WRITTEN DOWN HERE RATHER THAN
 * GUARDED: two people scanning one physical tool at the same instant can both
 * confirm, both rows land — which is correct, an append-only log records what
 * happened — and the cache takes whichever update lands last, so it can disagree
 * with the final row. One more scan repairs it. Nobody has hit this; the
 * situation it describes is two people handing one drill over at once.
 *
 * ON SUCCESS IT REDIRECTS TO THE PAGE IT CAME FROM AND SAYS NOTHING (#321). The
 * status flips, a history entry appears and the control now reads the other way
 * — that IS the confirmation, and a banner would say what the page already says
 * while standing between the reader and the next scan.
 */
export async function recordToolItemEventAction(prevState, formData) {
    return withOpsLabel("recordToolItemEventAction", async () => {
        const user = await requireUser();

        // The PRINTED id, which is what the page was reached by and what the form
        // carries. The lookup is case-insensitive, so a forged or hand-typed
        // spelling resolves the same way the page's own does.
        const toolItem = await getToolItemByToolItemId(String(formData.get("toolItemId") ?? ""));
        // Reachable only by a submission the screen did not produce — the form
        // renders under a tool item the page has already found, and this app
        // offers no way to delete one. It answers in the page's own words rather
        // than coining a refusal of its own for a state with no screen behind it.
        if (!toolItem) return { error: TOOL_ITEM_COPY.notFoundHeading };

        // THE PLAN IS BUILT FROM THE STORED STATUS, NOT THE SUBMITTED ONE, so the
        // offer this compares against is a fact about the base. The job list is
        // the whole table, which is the shape `/deliveries` and #338 both use, and
        // `assignedJobsFor` narrows it to the actor's own inside `planTransition`.
        const plan = planTransition({
            user,
            jobs: await getAllJobs(),
            status: toolItem.status,
        });
        const { event, job, refusal } = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            jobId: String(formData.get("jobId") ?? ""),
        });
        if (refusal) return { error: refusal };

        await createToolLogEntry({
            toolItemRecordId: toolItem.id,
            toolItemId: toolItem.toolItemId,
            event,
            jobRecordId: job.id,
            recordedByUserId: user.id,
        });

        // NAMED ON SCREEN AND LOGGED WITH ITS RECORD ID, NEVER SWALLOWED — and
        // never written back to Airtable, which is what just failed. That is
        // CLAUDE.md's rule for a failed restore and the shape fits: the event is
        // on the record, the tool item's own status is not, and the person who
        // caused it is the only one who knows. Pressing again writes the same
        // event and lands the status, so the repair is the control they are
        // already looking at.
        try {
            await updateToolItemCache({
                toolItemRecordId: toolItem.id,
                status: statusAfterEvent(event),
                jobRecordId: job.id,
            });
        } catch (error) {
            console.error(
                "Tool item status not updated after its Tool Log row was written (#362)",
                {
                    toolItemRecordId: toolItem.id,
                    toolItemId: toolItem.toolItemId,
                    event,
                    error,
                }
            );
            return {
                error: TOOL_TRANSITION_COPY.statusNotUpdated({
                    toolItemId: toolItem.toolItemId,
                    event,
                    status: plan.status,
                }),
            };
        }

        redirect(toolItemPath(toolItem.toolItemId));
    });
}
