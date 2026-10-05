"use client";

import { useState } from "react";
import BottomBar from "@/app/components/BottomBar";
import { Button, Field, FormBusy, SheetChip, SheetField } from "@/app/components/Controls";
import { chosenJobId, onlyJob } from "@/lib/toolJob";
import { TOOL_EVENT } from "@/lib/toolStatus";
import { TOOL_TRANSITION_COPY as COPY, fieldRefusals, offeredNames, readSubmission, recentNamesFor } from "@/lib/toolTransition";
import JobSheet from "./JobSheet";
import NameSheet from "./NameSheet";
import { useToolItemTransition } from "./ToolItemTransition";

/** The job pill's mark, a pin (1f), in the ink of the pill's word. */
function PinIcon() {
    return (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-full">
            <path d="M8 14.5s5-4.1 5-7.8A5 5 0 0 0 3 6.7c0 3.7 5 7.8 5 7.8Z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="6.6" r="1.7" fill="currentColor" />
        </svg>
    );
}

/** The name field's mark, a person (1f). */
function PersonIcon() {
    return (
        <svg viewBox="0 0 16 17" fill="none" aria-hidden="true" className="size-full">
            <circle cx="8" cy="5" r="3.1" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2.2 15.2c0-3.1 2.6-4.6 5.8-4.6s5.8 1.5 5.8 4.6" stroke="currentColor" strokeWidth="1.4" />
        </svg>
    );
}

/**
 * The one transition this tool item's status allows, as a phone asks it (#463): 1f's foot
 * bar, Tools 0a's, which the sign-in steps drew first (#473) — the job as a pill, for a
 * check-out who it goes to, and the press, rows 12 apart at the screen's foot and riding on
 * the keyboard.
 *
 * THE FIELDS STAY ON THE PAGE AND OPEN 1f's SHEETS, which #458 built as parts for exactly
 * this: the pill opens the job sheet for a person on several jobs and states the one job of a
 * person on one; the name field opens the name sheet, the people this job has recently handed
 * tools to under the field a phone types in. With one job and a check-in there is nothing to
 * ask, so the bar is the pill and the press, and the press records.
 *
 * THE PRESS ACTS WHATEVER IS MISSING, AND SAYS WHAT IS (1g). A desk's dialog holds its
 * commitment back until the job and the name are given (0f); the bar keeps its press, and a
 * press with either missing is answered under the field it is about — both at once, as the
 * name step answers both its names (#473), by `fieldRefusals`, the reading `readSubmission`
 * makes in its own order. Nothing is sent until that refuses nothing, and the action asks
 * again. A refusal stands until the field holds what it asked for, and a refusal of the
 * press itself is said in the title block (`TransitionRefusal.js`), not here.
 *
 * WHILE THE PRESS IS ON ITS WAY THE BAR IS BUSY (#469's rule, here #463's): the press keeps
 * its fill and shows the phone's spinner alone, Tools 0a's Busy, and the pill and the field
 * lock — they keep their look and open nothing. Nothing is disabled, so focus stays on the
 * press.
 *
 * THE JOB STARTS WHERE A DIALOG'S STARTS AND STARTS THERE AGAIN — the one job there is, or
 * none of several, and a chosen job the page's plan no longer holds goes back to that start
 * (`chosenJobId`, #469). The bar draws no move notice under its pill: the design draws the
 * pill alone (1f), and a desk's dialog is where the two `Job` values meet.
 *
 * WITH NOTHING TO RECORD THE BAR SAYS WHY, in the press's place: a retired tool (1f-c), or a
 * reader on no job. **Below the phone's edge and nowhere else**, which the bar's own class
 * decides, so the sticky bar is not held inside a wrapper of its own.
 */
export default function TransitionBar({ recentCheckOuts }) {
    const { plan, toolItemId, pending, send } = useToolItemTransition();
    const [jobId, setJobId] = useState(() => onlyJob(plan.jobs)?.id ?? "");
    const [name, setName] = useState("");
    const [sheet, setSheet] = useState(null);
    // Which event a press asked for. A refusal that flips the status offers the other event
    // and the fields that go with it, which nobody has pressed for yet.
    const [pressedFor, setPressedFor] = useState(null);
    const kept = chosenJobId(plan.jobs, jobId);
    if (kept !== jobId) setJobId(kept);

    if (plan.refusal) {
        return (
            <BottomBar stack={null} bleed={false} phoneOnly>
                <p className="text-mobile-body text-pretty text-foreground-subtle">{plan.refusal}</p>
            </BottomBar>
        );
    }
    if (!plan.event) return null;

    const asksName = plan.event === TOOL_EVENT.CHECKED_OUT;
    const several = onlyJob(plan.jobs) === null;
    const chosen = plan.jobs.find((job) => job.id === kept) ?? null;
    const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode }));
    const recent = recentNamesFor(recentCheckOuts, { jobCode: chosen?.jobCode });
    const offered = offeredNames(recent, name);
    const pressed = pressedFor === plan.event;
    const refusals = fieldRefusals(plan, { jobId: kept, checkedOutTo: name });

    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const answer = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            jobId: String(formData.get("jobId") ?? ""),
            checkedOutTo: String(formData.get("checkedOutTo") ?? ""),
        });
        if (answer.refusal) {
            setPressedFor(plan.event);
            return;
        }
        send(formData);
    };

    return (
        <BottomBar stack={null} bleed={false} phoneOnly>
            <form onSubmit={submit} className="flex flex-col gap-mobile-bottom-bar-stack">
                <input type="hidden" name="toolItemId" value={toolItemId} />
                <input type="hidden" name="event" value={plan.event} />
                <input type="hidden" name="jobId" value={kept} />
                {asksName && <input type="hidden" name="checkedOutTo" value={name} />}
                <FormBusy busy={pending}>
                    <Field label={COPY.jobLabel} labelAs="span" labelHidden size="xl" refusal={pressed ? refusals.jobRefusal : null}>
                        <SheetChip
                            value={chosen?.jobCode}
                            placeholder={COPY.jobUnchosen}
                            icon={<PinIcon />}
                            onOpen={several ? () => setSheet("job") : undefined}
                        />
                    </Field>
                    {asksName && (
                        <Field label={COPY.checkedOutToLabel} labelAs="span" labelHidden size="xl" refusal={pressed ? refusals.nameRefusal : null}>
                            <SheetField value={name} placeholder={COPY.checkedOutToLabel} icon={<PersonIcon />} onOpen={() => setSheet("name")} />
                        </Field>
                    )}
                    <Button type="submit" size="xl" busyLabel={COPY.working[plan.event]}>
                        {COPY.control[plan.event]}
                    </Button>
                </FormBusy>
            </form>
            {several && (
                <JobSheet
                    open={sheet === "job"}
                    onClose={() => setSheet(null)}
                    title={COPY.jobLabel}
                    options={options}
                    value={kept}
                    onChoose={setJobId}
                />
            )}
            {asksName && (
                <NameSheet
                    open={sheet === "name"}
                    onClose={() => setSheet(null)}
                    value={name}
                    onChange={setName}
                    names={offered}
                    jobChosen={Boolean(chosen)}
                    hasRecent={recent.length > 0}
                />
            )}
        </BottomBar>
    );
}
