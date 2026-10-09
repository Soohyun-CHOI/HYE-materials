"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withSiteManagerAction } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getAllTools } from "@/lib/airtable/tools";
import { createToolItems } from "@/lib/airtable/toolItems";
import { createFirstToolLogEntries } from "@/lib/airtable/toolLog";
import { readCatalog } from "@/lib/toolCatalog";
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
 * registration takes — a reader on no job, a kind the catalog no longer offers (#507),
 * and a batch that wrote nothing, which since #449 is the only return that is not a check
 * made before the writes. **What a submission may be is `readRegistration`'s**, the same
 * function the dialog asks before it sends anything, so the two cannot refuse differently.
 *
 * THE KIND IS PICKED, NOT TYPED, AND ONLY ONE THE CATALOG OFFERS IS TAKEN (#507). What
 * arrives is a `Tools` record id, the row the dialog's two steps narrowed to — or the row a
 * kind's page opened it on — and this asks `readRegistration` of it against the catalog as
 * the base holds it now, `readCatalog`'s rows, which is the shape the dialog asked of the
 * page's read. A row the office has since emptied, given a path another row names, or never
 * had is refused above the actions, and the page is drawn again with the refusal
 * (`refresh()`, #378), so the dialog's two steps offer what the catalog holds now while it
 * keeps what was chosen. **Nothing here writes a `Tools` row**: a kind is the office's to
 * add in Airtable, where the name typed on this dialog was found or created from #338
 * (`upsertTool`, gone).
 *
 * WHAT IT WROTE IS SAID BY LANDING ON IT (#449). A registration that writes a tool
 * item redirects to its tool's page, on the list's first page, with every one it wrote
 * selected — so the ids survive a reload and their labels are one press of that page's
 * print control. The address also carries the two things the landing cannot show: how
 * many were asked for and not written — with how many were asked for beside it, since
 * the fork's title, `3 of 5 tools added` (#455, #485), needs both — and which of those
 * written have no `Created` row (`toolPath`'s fourth argument, read back by
 * `readRegistrationAccount`). The record id is the one the registration picked.
 *
 * THE FIRST PAGE, BECAUSE THE LIST READS NEWEST FIRST (#463). What a registration wrote
 * is the newest the tool holds, so it begins the list whatever the tool held before,
 * and a run longer than a page goes on to the next. Until #463 the list read oldest
 * first and the landing was the page holding the first tool item written, at the
 * position the row's `Tool Items` array had reached before this batch.
 *
 * THE KIND IS THE ROW SUBMITTED, FROM EVERY OPENER. A kind's page and the offer open the
 * dialog on that kind and submit its record id as a hidden field, and the list's dialog
 * submits the row its two steps picked, so what is added lands under the row the reader
 * chose — on the page it was opened from, when it was opened on one. Until #507 the tool was
 * found by the name submitted, so two rows with one key could take a registration opened on
 * the other; a catalog row is named by its id here, and two rows naming one path are the
 * catalog's to repair, reported by `scripts/import/create_tool_catalog_507.mjs`.
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
 * many are not on this one. And a THROW — from a read of the jobs or the catalog, or from
 * the day-prefix query `createToolItems` makes before its first create — reaches no line in
 * the dialog, as it reached none on the form before #449: it fails before anything this
 * action could word, where the refusal below is for a batch that ran and wrote none.
 */
export const registerToolItemsAction = withSiteManagerAction(registerToolItemsHandler);

async function registerToolItemsHandler(prevState, formData) {
    return withOpsLabel("registerToolItemsAction", async () => {
        const user = await requireUser();

        // One list for however many jobs this person is on, which is the shape
        // `/deliveries` uses. The dialog's choice and this check read the same
        // function, so a job the dialog could not offer cannot be admitted here. The
        // catalog beside it, read as the base holds it now (#507): the page's read is as old
        // as the page, and a kind is admitted only if the catalog still offers it.
        const [allJobs, tools] = await Promise.all([getAllJobs(), getAllTools()]);
        const reading = readRegistration(
            {
                toolRecordId: formData.get("toolRecordId"),
                quantity: formData.get("quantity"),
                jobId: formData.get("jobId"),
            },
            assignedJobsFor(user, allJobs),
            readCatalog(tools).offered
        );
        if (!reading.registration) {
            // A kind the catalog no longer offers is the page out of date, so it is drawn
            // again with the refusal (#378); every other refusal is the reader's to answer.
            if (reading.stale) refresh();
            return reading;
        }
        const { tool, count, job } = reading.registration;

        // `createToolItems` also hands back the failure that stopped it. The landing
        // needs only how many were not written, which is the count less what was: a
        // failed request is read back by its ids before it is counted, and nothing
        // after it is sent (#470), so `created` is every tool item the base holds.
        const { created } = await createToolItems({
            toolRecordId: tool.id,
            jobRecordId: job.id,
            count,
        });

        // NOTHING WAS WRITTEN, SO THERE IS NOTHING TO LAND ON (#449). The kind is the
        // catalog's either way, but its page would show no selection and nothing to print,
        // so the person stays in the dialog, told above its actions.
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
