"use server";

import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { upsertTool } from "@/lib/airtable/tools";
import { createToolItems } from "@/lib/airtable/toolItems";
import { createToolLogEntry } from "@/lib/airtable/toolLog";
import { TOOL_EVENT } from "@/lib/toolStatus";
import {
    TOOL_REGISTRATION_COPY,
    assignedJobsFor,
    readQuantity,
} from "@/lib/toolRegistration";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Register `count` tool items of one tool (#338), and the first row of each
 * one's history.
 *
 * NOT WRAPPED, AND LISTED AS AN EXEMPTION WITH THAT REASON. `requireUser()`
 * settles only that this is an active session; the authorization that decides
 * anything is that the submitted job is one the actor's own
 * `Users."Assigned Jobs"` names — a per-record comparison in the body, which is
 * the shape withdrawPOAction and the delivery actions already take. No role
 * helper fits: registering a tool is site work, so an Admin on no job must be
 * refused and a non-Admin employee on a job must pass.
 *
 * REFUSES BY RETURNING `{ error }` BECAUSE THE CALL SITE BINDS (#185).
 * ToolRegistrationForm.js reads this through `useActionState`, so a refusal
 * lands in `state` and the form renders it in the one slot it already has for
 * the validation refusals below.
 *
 * THE JOB IS NEVER TAKEN FROM THE FORM'S WORD FOR IT. What arrives is a Job
 * record id, and it is admitted only if `assignedJobsFor` returns a job with
 * that id — so a forged submission cannot file a tool item against a site the
 * actor is not on. Where the value comes from on the screen is one assignment
 * used without asking, or a choice among several; nothing types one.
 *
 * TWO WRITES IN SEQUENCE AND NEVER NESTED, WHICH IS FORCED RATHER THAN CHOSEN.
 * `createToolItems` holds the day-prefix lock across its whole batch and
 * `createToolLogEntry` takes a per-tool-item lock of its own, so writing each
 * log row inside the batch would nest two `withKeyLock` calls — the thing
 * CLAUDE.md's concurrency section forbids, and the reason lib/materialsCache.js
 * takes its two locks in sequence. The cost of obeying it is that a failure in
 * the log pass can leave more than one tool item without a `Registered` row, and
 * the copy names those separately.
 *
 * NOTHING ROLLS BACK. `createToolItems`' own header carries the argument: undoing
 * the rows would free ids the daily counter has already spent, and `nextSequence`
 * is MAX + 1, so a gap costs nothing while a reused number costs two labels on
 * two tools. What this action owes the person instead is an exact account, which
 * is why it returns every minted id rather than a count.
 */
export async function registerToolItemsAction(prevState, formData) {
    return withOpsLabel("registerToolItemsAction", async () => {
        const user = await requireUser();

        const toolName = String(formData.get("toolName") ?? "").trim();
        if (!toolName) return { error: TOOL_REGISTRATION_COPY.nameMissing };

        const { count, refusal } = readQuantity(formData.get("quantity"));
        if (refusal) return { error: refusal };

        // One list for however many jobs this person is on, which is the shape
        // `/deliveries` uses. The picker's options and this check read the same
        // function, so a job the screen could not offer cannot be admitted here.
        const jobs = assignedJobsFor(user, await getAllJobs());
        if (jobs.length === 0) return { error: TOOL_REGISTRATION_COPY.noJob };

        const submittedJobId = String(formData.get("jobId") ?? "");
        const job = jobs.find((candidate) => candidate.id === submittedJobId) ?? null;
        if (!job) return { error: TOOL_REGISTRATION_COPY.jobNotYours };

        const { tool } = await upsertTool({ toolName });

        const { created, failed } = await createToolItems({
            toolRecordId: tool.id,
            jobRecordId: job.id,
            count,
        });

        // The `Registered` row is this action's to write — `createToolItems`
        // creates the tool item and its cached `Status` and says so. One row per
        // tool item that was actually created, and a failure STOPS the pass
        // rather than trying the rest, which is `createToolItems`' own posture
        // one level up and for its reason: a log write that fails is failing
        // systemically far more often than per row, and firing a hundred more
        // requests at a rate limit makes the account worse rather than shorter.
        // The rows before it are complete and the ones after it are named as
        // unlogged, which is a state with no repair (see the copy).
        const logged = [];
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
                    event: TOOL_EVENT.REGISTERED,
                    jobRecordId: job.id,
                    recordedByUserId: user.id,
                });
                logged.push(toolItem.toolItemId);
            } catch {
                unlogged.push(toolItem.toolItemId);
            }
        }

        return {
            toolName: tool.toolName,
            jobCode: job.jobCode,
            requested: count,
            toolItemIds: created.map((toolItem) => toolItem.toolItemId),
            unloggedToolItemIds: unlogged,
            // `failed` carries the error objects `createToolItems` collected; the
            // screen needs only that the count came up short, which the two
            // numbers above already say. Read here so a future reader sees it was
            // considered rather than missed.
            shortBy: failed.length > 0 ? count - created.length : 0,
        };
    });
}
