"use server";

import { redirect } from "next/navigation";
import { requireUser, withSiteManagerAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { upsertTool } from "@/lib/airtable/tools";
import { createToolItems } from "@/lib/airtable/toolItems";
import { createFirstToolLogEntries } from "@/lib/airtable/toolLog";
import { assignedJobsFor } from "@/lib/toolJob";
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
 * ONLY A SITE MANAGER ADDS TOOLS, AND THE WRAPPER DECIDES THAT BEFORE THIS BODY RUNS
 * (#506). `withSiteManagerAction` refuses anybody else — the page they pressed on,
 * rendered again without the dialog, and nothing said — so the role is not a check here
 * at all. What this body still decides is the job, as it did when this action was an
 * exemption: the submitted job has to be one the actor's own `Users."Assigned Jobs"`
 * names, with no office clause, so a site manager on no job is refused in the dialog's
 * words. `Is Admin` decides neither: the office's flag opens the office's screens, and
 * the tools track does not pass through the office.
 *
 * THE SESSION IS READ TWICE. The wrapper's gate reads the person to decide and drops
 * them, and this body reads them again for their jobs and for `Recorded By` — one
 * operation, the one #382 records `createInvoiceAction` paying for the same reason.
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
 * item redirects to its tool's page, on the list's first page, with every one it wrote
 * selected — so the ids survive a reload and their labels are one press of that page's
 * print control. The address also carries the two things the landing cannot show: how
 * many were asked for and not written — with how many were asked for beside it, since
 * the fork's title, `3 of 5 tools added` (#455, #485), needs both — and which of those
 * written have no `Created` row (`toolPath`'s fourth argument, read back by
 * `readRegistrationAccount`). The record id was in hand without a read: `upsertTool`
 * returns the row it found or made.
 *
 * THE FIRST PAGE, BECAUSE THE LIST READS NEWEST FIRST (#463). What a registration wrote
 * is the newest the tool holds, so it begins the list whatever the tool held before,
 * and a run longer than a page goes on to the next. Until #463 the list read oldest
 * first and the landing was the page holding the first tool item written, at the
 * position the row's `Tool Items` array had reached before this batch.
 *
 * THE TOOL IS FOUND BY THE NAME SUBMITTED, FROM EVERY OPENER. A tool's page and the offer
 * open the dialog on that tool and submit its name as a hidden field, and the list's
 * dialog submits what was typed; `upsertTool` finds or makes the row either way. So on a
 * base holding two `Tools` rows with one key — `withKeyLock`'s residual (#338) — a
 * registration opened on one of them lands under whichever row the lookup returns, which
 * need not be the page it was opened from. Nothing has observed it: the base's tools
 * carry distinct keys. The repair is #338's, merging the two rows by hand.
 *
 * TWO WRITES IN SEQUENCE, AND SINCE #470 THAT IS CHOSEN RATHER THAN FORCED.
 * `createToolItems` holds the day-prefix lock across its whole batch, and the log
 * pass took a per-tool-item lock of its own until #470, so writing each log row
 * inside the batch would have nested two `withKeyLock` calls — the thing
 * CLAUDE.md's concurrency section forbids, and the reason lib/materialsCache.js
 * takes its two locks in sequence. `createFirstToolLogEntries` takes no lock, since
 * a tool item this invocation just made has no history to read, so nothing forbids
 * it now; the pass stays after the batch because inside it would hold the lock every
 * registration in this process waits on through writes that mint nothing under it.
 * The cost is the one obeying the rule had: a failure in the log pass can leave
 * more than one tool item without a `Created` row, and the landing names those
 * separately.
 *
 * NOTHING ROLLS BACK. `createToolItems`' own header carries the argument: undoing
 * the rows would free ids the daily counter has already spent, and `nextSequence`
 * is MAX + 1, so a gap costs nothing while a reused number costs two labels on
 * two tools. What this action owes the person instead is an exact account, which
 * is why the landing selects every minted id rather than counting them.
 *
 * TWO THINGS NOBODY HAS OBSERVED, RECORDED WHERE THEY WOULD BE MET. A registration of
 * the same tool in another invocation, writing after this batch and before the landing
 * renders, puts its tool items above this one's, so some of what this one wrote can
 * stand on the next page; the selection is by id, so the selection bar still says how
 * many are not on this one. And a THROW — from `upsertTool`, or from the day-prefix
 * query `createToolItems` makes before its first create — reaches no line in the
 * dialog, as it reached none on the form before #449: it fails before anything this
 * action could word, where the refusal below is for a batch that ran and wrote none.
 */
export const registerToolItemsAction = withSiteManagerAction(registerToolItemsHandler);

async function registerToolItemsHandler(prevState, formData) {
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

        // `createToolItems` also hands back the failure that stopped it. The landing
        // needs only how many were not written, which is the count less what was: a
        // failed request is read back by its ids before it is counted, and nothing
        // after it is sent (#470), so `created` is every tool item the base holds.
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
        // tool item that was actually created, ten to a request since #470, and a
        // failed request STOPS the pass rather than sending the rest, which is
        // `createToolItems`' own posture and for its reason: a log write that fails
        // is failing systemically far more often than per row. What did not land is
        // named as unlogged, which is a state with no repair (see the copy); a
        // request whose answer was lost is read back first, so a row that did land
        // is never named.
        const { unlogged } = await createFirstToolLogEntries({
            toolItems: created,
            jobRecordId: job.id,
            recordedByUserId: user.id,
        });

        // OUTSIDE EVERY `try`, AND IT HAS TO BE. `redirect` throws to navigate, so a
        // `catch` around it would take the navigation for a failed log write.
        redirect(
            toolPath(
                tool.id,
                1,
                created.map((toolItem) => toolItem.toolItemId),
                { asked: count, unwritten: count - created.length, unlogged }
            )
        );
    });
}
