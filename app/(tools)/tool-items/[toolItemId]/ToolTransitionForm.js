"use client";

import { useActionState, useState } from "react";
import { TOOL_TRANSITION_COPY as COPY, jobMoveNotice } from "@/lib/toolTransition";
import { recordToolItemEventAction } from "./actions";

/**
 * The one transition this tool item's status allows (#362).
 *
 * NO MODAL, AND THE RULE IS THIS REPOSITORY'S OWN. CLAUDE.md: a modal is for an
 * act that cannot be undone; an act that can is edited in place (#318). A
 * check-out can be undone by a check-in — `lib/airtable/toolLog.js` says
 * correcting a mistaken scan is another row — so the confirmation the issue asks
 * for is that ARRIVING IS NOT ACTING. A QR opens the page, the page states the
 * printed id and the current status, and pressing this is the act. #363 is the
 * transition that cannot be undone and that issue carries the weight instead: a
 * required reason, which its own body calls what stands between a mis-tap and a
 * state the app cannot leave.
 *
 * THE COST OF THE OTHER ANSWER IS WHAT SETTLES IT RATHER THAN THE RULE ALONE. A
 * project starts with a manager scanning their job's tools out one at a time and
 * ends with them scanning back what returned, so a transition is dozens a day and
 * a second tap is dozens more. A confirmation heavy enough to be worth avoiding
 * is one people avoid, on paper, and the moment that happens this system holds
 * nothing. What a modal would add is a restatement of the id and the status the
 * page has already put in front of them.
 *
 * IT CARRIES NO CLASS, NO WIDTH, NO COLOR AND NO SPACING — #336's rule for this
 * axis, and it bites hardest here: this is the first control in the app a gloved
 * hand presses, and the size that makes it is #258's to decide. The brief says
 * so, because the design work cannot read this file.
 *
 * EVERY STRING COMES FROM `TOOL_TRANSITION_COPY`, which `offline/
 * tool-list-view.mjs` holds by failing on any JSX text under app/(tools)/.
 *
 * THE SUBMIT IS DISABLED WHILE PENDING, which is not a nicety: `withKeyLock`
 * serializes within one invocation only, so the frontend guard is the other half
 * of every double-write argument on this axis.
 */
export default function ToolTransitionForm({ toolItemId, event, jobs, currentJobCode }) {
    const [state, formAction, pending] = useActionState(recordToolItemEventAction, null);
    // One assignment is used without asking and several are chosen from, which is
    // #338's pair with no path that types a job. The state exists only for the
    // move notice below — with one job there is nothing to pick, so the value is
    // known from the start and the notice is decided on the first render.
    const [jobId, setJobId] = useState(jobs.length === 1 ? jobs[0].id : "");

    const chosen = jobs.find((job) => job.id === jobId) ?? null;
    const movesJob = jobMoveNotice({ from: currentJobCode, to: chosen?.jobCode });

    return (
        <form action={formAction}>
            <input type="hidden" name="toolItemId" value={toolItemId} />
            {/* The event the page offered. The action re-derives it from the
                stored status and compares — it never writes this value — so a
                page opened before somebody else moved the tool is refused
                instead of recording the opposite of what the button says. */}
            <input type="hidden" name="event" value={event} />

            {state?.error && <p role="alert">{state.error}</p>}

            <div>
                <label htmlFor="jobId">{COPY.jobLabel}</label>
                {jobs.length === 1 ? (
                    <>
                        <input type="hidden" name="jobId" value={jobs[0].id} />
                        <span id="jobId">{jobs[0].jobCode}</span>
                    </>
                ) : (
                    <select
                        id="jobId"
                        name="jobId"
                        required
                        value={jobId}
                        onChange={(e) => setJobId(e.target.value)}
                    >
                        <option value="" disabled>
                            {COPY.jobUnchosen}
                        </option>
                        {jobs.map((job) => (
                            <option key={job.id} value={job.id}>
                                {job.jobCode}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* The two `Job` values on this screen disagreeing is not a labeling
                problem, it is the tool changing site — said out loud rather than
                left for the reader to notice two different job codes under one
                word. */}
            {movesJob && <p>{movesJob}</p>}

            <button type="submit" disabled={pending}>
                {COPY.control[event]}
            </button>
        </form>
    );
}
