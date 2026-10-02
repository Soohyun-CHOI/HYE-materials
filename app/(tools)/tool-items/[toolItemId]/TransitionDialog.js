"use client";

import { startTransition, useActionState, useState } from "react";
import { Button, Choice, Combobox, Field, SheetField } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import { onlyJob } from "@/lib/toolJob";
import { TOOL_EVENT } from "@/lib/toolStatus";
import {
    TOOL_TRANSITION_COPY as COPY,
    asksBeforeRecording,
    jobMoveNotice,
    offeredNames,
    readSubmission,
    recentNamesFor,
} from "@/lib/toolTransition";
import { recordToolItemEventAction } from "./actions";
import JobSheet from "./JobSheet";
import NameSheet from "./NameSheet";

/**
 * The one transition this tool item's status allows (#362), and the dialog it opens when it
 * has something to ask (#458).
 *
 * A PRESS WHEN THERE IS NOTHING TO ASK, A DIALOG WHEN THERE IS. A check-out records who the
 * tool went to, so it always opens the design's dialog (1c) with the job and the name
 * together; a check-in asks only a person on several jobs (1e), and for one on a single job it
 * records on the press (1d), as every transition did until #458. `asksBeforeRecording` is the
 * split, and the press and the opener are one button, so a refusal that turns one into the
 * other — it re-renders the page in place (#378) — leaves the reader on the same control,
 * which the frame hands focus back to as the dialog goes.
 *
 * A CONFIRMATION THAT IS ARRIVING, NOT ACTING, STILL HOLDS FOR THE PRESS (#362). A scan opens
 * the page, the page states the printed id and the status, and the press is the act — the
 * next scan undoes it, so a second tap on every one of them is friction people route around.
 * The dialog is what the design draws where the act needs an answer first, not a second
 * confirmation.
 *
 * WHAT A SUBMISSION MAY BE IS `readSubmission`, ASKED BEFORE IT IS SENT AND AGAIN BY THE
 * ACTION. The dialog's commitment acts only when that answers with no refusal — a job among the
 * reader's own and, for a check-out, a name — which is the design's (1c, 1e): a check-out's
 * two answers can be missing but never wrong, so the act "cannot act yet" (0f), and the empty
 * field is the reason, with no line before it. The form's own `name.trim()` went with the form.
 *
 * IT IS OPEN WHILE THE OFFERED EVENT IS THE ONE IT WAS OPENED FOR, WHICH IS A REFUSAL'S CASE. A
 * press that lands redirects, and the router answers an action's redirect by remounting the
 * tree under the component that called it — this one — which is what `refuse` in `actions.js`
 * calls throwing the client state away; so the dialog goes with its landing and the frame
 * hands focus to the page's heading, the opener having gone too. A refusal re-renders in
 * place: one that somebody else scanned first flips the status under the open dialog, the
 * page offers the other event, and the dialog is gone while its sentence stands on the page
 * where the control is, as every refusal on this screen did; one the dialog can stand open
 * for — a job the reader is no longer assigned to, or the status left unwritten — is said
 * above its actions, and a job taken away takes the opening's start again (#469).
 *
 * A PRESS THAT LANDS LEAVES FOCUS ON THE DOCUMENT, by the mechanism #362's form had too: the
 * press is disabled while it sends, which takes focus off it, and the remount brings nothing
 * back. A dialog's landing reaches the heading only because the frame's dialog was open as the
 * tree went.
 *
 * TWO WIDTHS, AND EACH ASKS IN ITS OWN DRAWING. At a desk the job is 0a's choice and the name
 * the registration's own combobox (1j), its suggestions this job's recent names under
 * `Recently at this job`. Below the phone's edge the dialog is Tools 0a's sheet, and the job
 * and the name are fields that open 1f's job sheet and name sheet — the parts #463's foot bar
 * opens later, as they are. One state behind both, so the field behind a sheet and the sheet
 * are one value.
 *
 * A SUBMISSION IN FLIGHT IS SAID IN THE DIALOG AND NOWHERE ELSE (#469). The frame is `busy`
 * while the dialog's event is on its way, so the commitment keeps its fill and after 300ms
 * gives its label way to `Checking out…` or `Checking in…`, every other control locks with
 * it, and the frame will not close — the frontend half of every double-write argument on this
 * axis, since `withKeyLock` serializes within one invocation only. None of it is disabled, so
 * focus stays on the commitment the reader pressed. **The press itself stays disabled while it
 * sends** (`disabled={pending}`) — the check-in on one job, which records with no dialog — as
 * #362's form had it; #469 is about a dialog's commitment and left the press as it was.
 *
 * EVERY STRING COMES FROM `TOOL_TRANSITION_COPY`, which `offline/tool-list-view.mjs` holds by
 * failing on any JSX text under app/(tools)/.
 */
export default function TransitionDialog({ plan, toolItemId, currentJobCode, recentCheckOuts }) {
    const [state, formAction, pending] = useActionState(recordToolItemEventAction, null);
    const refusal = state?.error ?? null;
    const [openedFor, setOpenedFor] = useState(null);
    const [opening, setOpening] = useState(0);
    // The opening ends with the event it was for. A landing takes it away with the page's
    // state and a refusal does not, so two refusals that flip the status out and back would
    // otherwise find it naming the event again and open the dialog with nobody asking.
    if (openedFor !== null && openedFor !== plan.event) setOpenedFor(null);
    const open = openedFor !== null && openedFor === plan.event;
    const asks = asksBeforeRecording(plan);
    const one = onlyJob(plan.jobs);

    const send = (formData) => startTransition(() => formAction(formData));

    return (
        <>
            {refusal && !open && <p role="alert">{refusal}</p>}
            <form
                action={asks ? undefined : formAction}
                onSubmit={(event) => {
                    if (!asks) return;
                    event.preventDefault();
                    setOpening((count) => count + 1);
                    setOpenedFor(plan.event);
                }}
            >
                {/* THE PRESS POSTS WHAT IT RECORDS: the event the page offered, which the action
                    compares and never writes, and the one job there is. The opener posts
                    nothing — what it opens asks first. */}
                {!asks && (
                    <>
                        <input type="hidden" name="toolItemId" value={toolItemId} />
                        <input type="hidden" name="event" value={plan.event} />
                        <input type="hidden" name="jobId" value={one.id} />
                    </>
                )}
                <Button type="submit" disabled={pending}>
                    {COPY.control[plan.event]}
                </Button>
            </form>
            {asks && (
                <TransitionForm
                    key={opening}
                    open={open}
                    onClose={() => setOpenedFor(null)}
                    plan={plan}
                    toolItemId={toolItemId}
                    currentJobCode={currentJobCode}
                    recentCheckOuts={recentCheckOuts}
                    pending={pending}
                    refusal={open ? refusal : null}
                    onSend={send}
                />
            )}
        </>
    );
}

/** The dialog itself: the job, for a check-out the name, and the commitment. */
function TransitionForm({ open, onClose, plan, toolItemId, currentJobCode, recentCheckOuts, pending, refusal, onSend }) {
    // With one job it is already chosen, and with several nothing is (0l) — the tool item's
    // own job is not chosen for anybody: a person on several assignments is asked because the
    // app does not know which site they are at.
    const [jobId, setJobId] = useState(() => onlyJob(plan.jobs)?.id ?? "");
    const [name, setName] = useState("");
    const [listOpen, setListOpen] = useState(false);
    const [sheet, setSheet] = useState(null);
    // A CHOSEN JOB THE PLAN NO LONGER HOLDS STARTS AGAIN WHERE AN OPENING STARTS (#469). A
    // refusal re-renders the page in place (#378), and the jobs the page plans with can be
    // fewer than the dialog opened with — the office took the chosen one away between the
    // opening and the press. A choice they no longer hold takes the opening's start again: the
    // one job there is, or none of several (0l). Kept, it was no choice at all, and below the
    // phone's edge with one job left it was a stated field saying `Choose a job` that nothing
    // could open, over a commitment that could not act — seen in a browser.
    const start = onlyJob(plan.jobs)?.id ?? "";
    if (jobId !== start && !plan.jobs.some((job) => job.id === jobId)) setJobId(start);

    const asksName = plan.event === TOOL_EVENT.CHECKED_OUT;
    const several = onlyJob(plan.jobs) === null;
    const chosen = plan.jobs.find((job) => job.id === jobId) ?? null;
    const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode }));
    // WHO THIS JOB HAS RECENTLY HANDED TOOLS TO, NARROWED IN THE BROWSER (#376). The page
    // loaded the rows for every job this reader is on; the chosen job decides which of them
    // the names are about, and typing narrows them further.
    const recent = recentNamesFor(recentCheckOuts, { jobCode: chosen?.jobCode });
    const offered = offeredNames(recent, name);
    const reading = readSubmission(plan, { event: plan.event, jobId, checkedOutTo: name });

    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const answer = readSubmission(plan, {
            event: String(formData.get("event") ?? ""),
            jobId: String(formData.get("jobId") ?? ""),
            checkedOutTo: String(formData.get("checkedOutTo") ?? ""),
        });
        if (answer.refusal) return;
        onSend(formData);
    };

    return (
        <>
            <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.control[plan.event]} onSubmit={submit} sheet>
                <input type="hidden" name="toolItemId" value={toolItemId} />
                {/* The event the page offered. The action re-derives it from the stored
                    status and compares — it never writes this value. */}
                <input type="hidden" name="event" value={plan.event} />
                <DialogBody>
                    {/* The two `Job` values on this screen disagreeing is the tool changing site,
                        said under the field rather than left for the reader to notice. */}
                    <Field label={COPY.jobLabel} labelAs="span" note={jobMoveNotice({ from: currentJobCode, to: chosen?.jobCode })}>
                        <div className="max-sm:hidden">
                            <Choice name="jobId" options={options} value={jobId} onChange={setJobId} placeholder={COPY.jobUnchosen} />
                        </div>
                        <SheetField
                            value={chosen?.jobCode}
                            placeholder={COPY.jobUnchosen}
                            onOpen={several ? () => setSheet("job") : undefined}
                            chevron={several}
                        />
                    </Field>
                    {asksName && (
                        <Field label={COPY.checkedOutToLabel}>
                            <div className="max-sm:hidden">
                                <Combobox
                                    name="checkedOutTo"
                                    value={name}
                                    onChange={setName}
                                    suggestions={offered.map((person) => ({ label: person }))}
                                    heading={COPY.recentHeading}
                                    placeholder={COPY.namePlaceholder}
                                    listOpen={listOpen}
                                    onListOpenChange={setListOpen}
                                />
                            </div>
                            <SheetField value={name} placeholder={COPY.namePlaceholder} onOpen={() => setSheet("name")} />
                        </Field>
                    )}
                </DialogBody>
                <DialogActions refusal={refusal}>
                    <Button variant="bordered" onClick={onClose}>
                        {COPY.cancel}
                    </Button>
                    <Button type="submit" disabled={Boolean(reading.refusal)} busyLabel={COPY.working[plan.event]}>
                        {COPY.control[plan.event]}
                    </Button>
                </DialogActions>
            </DialogFrame>
            {several && (
                <JobSheet
                    open={open && sheet === "job"}
                    onClose={() => setSheet(null)}
                    title={COPY.jobLabel}
                    options={options}
                    value={jobId}
                    onChoose={setJobId}
                />
            )}
            {asksName && (
                <NameSheet
                    open={open && sheet === "name"}
                    onClose={() => setSheet(null)}
                    value={name}
                    onChange={setName}
                    names={offered}
                    jobChosen={Boolean(chosen)}
                    hasRecent={recent.length > 0}
                />
            )}
        </>
    );
}
