"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { upsertTool } from "@/lib/airtable/tools";
import { createToolItems } from "@/lib/airtable/toolItems";
import { createToolLogEntry } from "@/lib/airtable/toolLog";
import { TOOL_EVENT } from "@/lib/toolStatus";
import { assignedJobsFor } from "@/lib/toolJob";
import { pageHolding } from "@/lib/toolListView";
import { TOOL_REGISTRATION_COPY, readRegistration } from "@/lib/toolRegistration";
import { toolPath } from "@/lib/toolRoutes";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Register `count` tool items of one tool (#338), and the first row of each
 * one's history.
 *
 * IT LIVED BESIDE `/tools/new` UNTIL #456, which took the route away: the form is a
 * dialog now, opened from the tool list and from a tool's own page — the offer a
 * registration that fell short makes is on that page too — so the action sits beside
 * both, under `/tools`. Nothing about what it writes moved with it.
 *
 * NOT WRAPPED, AND LISTED AS AN EXEMPTION WITH THAT REASON. `requireUser()`
 * settles only that this is an active session; the authorization that decides
 * anything is that the submitted job is one the actor's own
 * `Users."Assigned Jobs"` names — a per-record comparison in the body, which is
 * the shape withdrawPOAction and the delivery actions already take. No role
 * helper fits: registering a tool is site work, so an Admin on no job must be
 * refused and a non-Admin employee on a job must pass.
 *
 * REFUSES BY RETURNING, BECAUSE THE CALL SITE BINDS (#185). RegistrationDialog.js reads
 * this through `useActionState`, so a refusal lands in `state` and the dialog renders
 * it where it belongs: `{ fields }` names each refusal about one field under that field,
 * and `{ error }` is the one line above the actions that a refusal about the whole
 * registration takes — a reader on no job, and a batch that wrote nothing, which since
 * #449 is the only return that is not a check made before the writes. **What a
 * submission may be is `readRegistration`'s**, the same function the dialog asks before
 * it sends anything, so the two cannot refuse differently.
 *
 * WHAT IT WROTE IS SAID BY LANDING ON IT (#449). A registration that writes a tool
 * item redirects to its tool's page, on the page of that list holding the first tool
 * item it wrote, with every one it wrote selected — so the ids survive a reload and
 * their labels are one press of that page's print control. The address also carries
 * the two things the landing cannot show: how many were asked for and not written —
 * with how many were asked for beside it, since #455's `3 of 5 tools created` needs
 * both — and which of those written have no `Created` row (`toolPath`'s fourth
 * argument, read back by `readRegistrationAccount`). Both halves of the address
 * were in hand without a read: `upsertTool` returns the row it found or made, and
 * that row's `Tool Items` array is the one it had before this batch, so its length
 * is the position the first new tool item takes.
 *
 * THE TOOL IS FOUND BY THE NAME SUBMITTED, FROM EVERY OPENER. A tool's page and the offer
 * open the dialog on that tool and submit its name as a hidden field, and the list's
 * dialog submits what was typed; `upsertTool` finds or makes the row either way. So on a
 * base holding two `Tools` rows with one key — `withKeyLock`'s residual (#338) — a
 * registration opened on one of them lands under whichever row the lookup returns, which
 * need not be the page it was opened from. Nothing has observed it: the base's tools
 * carry distinct keys. The repair is #338's, merging the two rows by hand.
 *
 * TWO WRITES IN SEQUENCE AND NEVER NESTED, WHICH IS FORCED RATHER THAN CHOSEN.
 * `createToolItems` holds the day-prefix lock across its whole batch and
 * `createToolLogEntry` takes a per-tool-item lock of its own, so writing each
 * log row inside the batch would nest two `withKeyLock` calls — the thing
 * CLAUDE.md's concurrency section forbids, and the reason lib/materialsCache.js
 * takes its two locks in sequence. The cost of obeying it is that a failure in
 * the log pass can leave more than one tool item without a `Created` row, and
 * the landing names those separately.
 *
 * NOTHING ROLLS BACK. `createToolItems`' own header carries the argument: undoing
 * the rows would free ids the daily counter has already spent, and `nextSequence`
 * is MAX + 1, so a gap costs nothing while a reused number costs two labels on
 * two tools. What this action owes the person instead is an exact account, which
 * is why the landing selects every minted id rather than counting them.
 *
 * TWO THINGS NOBODY HAS OBSERVED, RECORDED WHERE THEY WOULD BE MET. A registration of
 * the same tool in another invocation, landing between `upsertTool`'s read and this
 * batch, moves where this one's tool items sit, so the landing can open a page early;
 * the selection is by id, so the list's own sentence still says how many are not on
 * it. And a THROW — from `upsertTool`, or from the day-prefix query `createToolItems`
 * makes before its first create — reaches no line in the dialog, as it reached none on
 * the form before #449: it fails before anything this action could word, where the
 * refusal below is for a batch that ran and wrote none.
 */
export async function registerToolItemsAction(prevState, formData) {
    return withOpsLabel("registerToolItemsAction", async () => {
        const user = await requireUser();

        // One list for however many jobs this person is on, which is the shape
        // `/deliveries` uses. The dialog's choice and this check read the same
        // function, so a job the dialog could not offer cannot be admitted here.
        const jobs = assignedJobsFor(user, await getAllJobs());
        const reading = readRegistration(
            {
                toolName: formData.get("toolName"),
                quantity: formData.get("quantity"),
                jobId: formData.get("jobId"),
            },
            jobs
        );
        if (!reading.registration) return reading;
        const { toolName, count, job } = reading.registration;

        const { tool } = await upsertTool({ toolName });

        // `createToolItems` also hands back what failed, with the error. The landing
        // needs only how many were not written, which is the count less what was: the
        // batch stops at its first failed create and attempts nothing after it, so the
        // failure names one tool item where the shortfall can be many.
        const { created } = await createToolItems({
            toolRecordId: tool.id,
            jobRecordId: job.id,
            count,
        });

        // NOTHING WAS WRITTEN, SO THERE IS NOTHING TO LAND ON (#449). The tool exists —
        // it was found or made above — but its page would show no selection and nothing
        // to print, so the person stays in the dialog, told above its actions.
        if (created.length === 0) return { error: TOOL_REGISTRATION_COPY.noneWritten };

        // The `Created` row is this action's to write — `createToolItems`
        // creates the tool item and its cached `Status` and says so. One row per
        // tool item that was actually created, and a failure STOPS the pass
        // rather than trying the rest, which is `createToolItems`' own posture
        // one level up and for its reason: a log write that fails is failing
        // systemically far more often than per row, and firing a hundred more
        // requests at a rate limit makes the account worse rather than shorter.
        // The rows before it are complete and the ones after it are named as
        // unlogged, which is a state with no repair (see the copy).
        const unlogged = [];
        for (const toolItem of created) {
            if (unlogged.length > 0) {
                unlogged.push(toolItem.toolItemId);
                continue;
            }
            try {
                await createToolLogEntry({
                    toolItemRecordId: toolItem.id,
                    toolItemId: toolItem.toolItemId,
                    event: TOOL_EVENT.CREATED,
                    jobRecordId: job.id,
                    recordedByUserId: user.id,
                });
            } catch {
                unlogged.push(toolItem.toolItemId);
            }
        }

        // OUTSIDE EVERY `try`, AND IT HAS TO BE. `redirect` throws to navigate, so a
        // `catch` around it would take the navigation for a failed log write.
        redirect(
            toolPath(
                tool.id,
                pageHolding(tool.toolItems.length),
                created.map((toolItem) => toolItem.toolItemId),
                { asked: count, unwritten: count - created.length, unlogged }
            )
        );
    });
}
