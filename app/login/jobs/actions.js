"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { assignFirstJobs } from "@/lib/airtable/users";
import { DEFAULT_DESTINATION, DESTINATION_PARAM, safeDestination } from "@/lib/loginDestination";
import { chosenJobIds, JOBS_PARAM, needsJobs, USER_JOBS_COPY } from "@/lib/userJobs";
import { withOpsLabel } from "@/lib/airtableOps";

/**
 * Save the jobs a reader just chose as their `Assigned Jobs`, and send them where they were
 * going (#554).
 *
 * THE READER'S OWN ROW, ONLY WHILE IT HOLDS NO JOB. The row written is the one `requireUser()`
 * resolved the session to — nothing in the form names a person, so no other row is reachable —
 * and `needsJobs` is asked of it first: a reader who holds a job, the office and the President
 * are never asked, so for them this writes nothing and sends them on, the answer the step's page
 * gives them. `assignFirstJobs` reads the row again before it writes and writes nothing over a
 * job somebody assigned in the meantime.
 *
 * NOT WRAPPED, AND LISTED AS AN EXEMPTION WITH THAT REASON, as the name step's action is: the
 * gate is the session plus a state of the caller's own row, which no role describes.
 *
 * WHAT IS WRITTEN IS A JOB'S ID AND NOTHING ELSE. The ids sent are matched against the jobs read
 * now (`chosenJobIds`), so a job gone since the page was drawn is left out; if none is left the
 * press is refused with the step's own sentence and the page drawn again (#378), so the list is
 * the one the base holds now.
 *
 * REFUSES BY RETURNING BECAUSE THE CALL SITE BINDS (#185): `JobsForm.js` reads this through
 * `useActionState` — `{ refusal }` for a choice of nothing, `{ error }` for a write that did not
 * happen. On success the redirect is the answer (#321).
 *
 * FOUR OPERATIONS: the session, the jobs, the row read again, and the write.
 */
export async function chooseJobsAction(prevState, formData) {
    const { destination, ...result } = await withOpsLabel("chooseJobsAction", async () => {
        const user = await requireUser();
        const goingTo = safeDestination(formData.get(DESTINATION_PARAM)) ?? DEFAULT_DESTINATION;
        if (!needsJobs(user)) return { destination: goingTo };

        const asked = formData.getAll(JOBS_PARAM).map(String);
        if (asked.length === 0) return { refusal: USER_JOBS_COPY.refusal.none };
        const jobIds = chosenJobIds(asked, await getAllJobs());
        if (jobIds.length === 0) {
            refresh();
            return { refusal: USER_JOBS_COPY.refusal.none };
        }

        try {
            await assignFirstJobs(user.id, jobIds);
        } catch (err) {
            console.error("chooseJobsAction could not store the jobs", err);
            return { error: USER_JOBS_COPY.refusal.failed };
        }
        return { destination: goingTo };
    });

    // Outside the scope, for `setUserNameAction`'s reason: `redirect()` throws a digest.
    if (destination) redirect(destination);
    return result;
}
