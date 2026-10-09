"use client";

import { useState } from "react";
import { Button, Choice, Combobox, Field, SheetField } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import { chosenJobId, onlyJob } from "@/lib/assetJob";
import { ASSET_EVENT } from "@/lib/assetStatus";
import {
    ASSET_TRANSITION_COPY as COPY,
    asksBeforeRecording,
    jobMoveNotice,
    matchedPart,
    namesAreRecent,
    offeredNames,
    readSubmission,
    recentNamesFor,
} from "@/lib/assetTransition";
import JobSheet from "./JobSheet";
import NameSheet from "./NameSheet";
import { useRefusalSentence, useAssetTransition } from "./AssetTransition";

/**
 * The one transition this asset's status allows (#362), as a desk asks it: the press or
 * the opener in the page's header, and the dialog it opens when it has something to ask
 * (#458). A phone asks in its foot bar instead (`TransitionBar.js`, #463), and the page draws
 * this from the phone's edge up.
 *
 * A PRESS WHEN THERE IS NOTHING TO ASK, A DIALOG WHEN THERE IS. A check-out records who the
 * asset went to, so it always opens the design's dialog (1f) with the job and the name
 * together; a check-in asks only a person on several jobs (1i), and for one on a single job it
 * records on the press (1g). `asksBeforeRecording` is the split, and the press and the opener
 * are one button, so a refusal that turns one into the other — it re-renders the page in
 * place (#378) — leaves the reader on the same control, which the frame hands focus back to
 * as the dialog goes.
 *
 * A CONFIRMATION THAT IS ARRIVING, NOT ACTING, STILL HOLDS FOR THE PRESS (#362). A scan opens
 * the page, the page states the printed id and the status, and the press is the act — the
 * next scan undoes it, so a second tap on every one of them is friction people route around.
 * The dialog is what the design draws where the act needs an answer first.
 *
 * WHAT A SUBMISSION MAY BE IS `readSubmission`, ASKED BEFORE IT IS SENT AND AGAIN BY THE
 * ACTION. The dialog's commitment acts only when that answers with no refusal — a job among the
 * reader's own and, for a check-out, a name — which is the design's (1f, 1i): a check-out's
 * two answers can be missing but never wrong, so the act "cannot act yet" (0f), and the empty
 * field is the reason, with no line before it.
 *
 * THE ANSWER IS THE PAGE'S, NOT THIS CONTROL'S (#463). The press and the dialog send through
 * `AssetTransition`, which holds the action's answer and whether the dialog is open: a
 * refusal the dialog can stand open for — a job the reader is no longer assigned to, or the
 * status left unwritten — is said above its actions, and every other stands in the page's
 * header, where the design says a refused press (1k). A job taken away takes the opening's
 * start again (#469), by `chosenJobId`, which the foot bar asks too.
 *
 * A PRESS THAT LANDS LEAVES FOCUS ON THE DOCUMENT, as #362's form did: the redirect remounts
 * the page and brings nothing back. A dialog's landing reaches the heading only because the
 * frame's dialog was open as the tree went.
 *
 * TWO WIDTHS IN THE DIALOG, AND EACH ASKS IN ITS OWN DRAWING. At a desk the job is 0a's choice
 * and the name the registration's own combobox (1b), its suggestions this job's recent names
 * under `Recently at this job` — the head while nothing is typed, and once somebody types,
 * the names that match with the matching part at 600 and no head (1f, #495). Below the
 * phone's edge the frame is Tools 0a's sheet, and the job and the name are fields that open
 * 1j's job sheet and name sheet. One state behind both, so the field behind a sheet and the
 * sheet are one value.
 *
 * ON THIS PAGE THAT SHEET IS NEVER SEEN. The row the press stands in is hidden below the
 * phone's edge, where the foot bar asks instead (#463), and a dialog left open as the window
 * narrows past it went with the row while it stayed modal — measured at 375: `:modal`, and
 * no box. Since #495 the frame closes it there, and the job and the name it was given go to
 * the foot bar (`AssetTransition.js`), so a phone turned upright mid-check-out keeps
 * them.
 *
 * A SUBMISSION IN FLIGHT IS SAID IN WHAT SENT IT (#469). The frame is `busy` while the
 * dialog's event is on its way, so the commitment keeps its fill and after 300ms gives its
 * label way to `Checking out…` or `Checking in…`, every other control locks with it, and the
 * frame will not close. **The press says it the same way since #463** — 0f's Working, its
 * fill kept and its event's `-ing` word after the wait — where it was disabled while it sent,
 * which gave focus up to the document before the answer came.
 *
 * EVERY STRING COMES FROM `ASSET_TRANSITION_COPY`, which `offline/asset-list-view.mjs` holds by
 * failing on any JSX text under app/(assets)/.
 */
export default function TransitionDialog({ currentJobCode, recentCheckOuts }) {
    const { plan, assetId, answer, formAction, pending, send, open, opening, openDialog, closeDialog, carry } = useAssetTransition();
    const refusal = useRefusalSentence(answer);
    const asks = asksBeforeRecording(plan);
    const one = onlyJob(plan.jobs);

    return (
        <>
            <form
                action={asks ? undefined : formAction}
                onSubmit={(event) => {
                    if (!asks) return;
                    event.preventDefault();
                    openDialog();
                }}
            >
                {/* THE PRESS POSTS WHAT IT RECORDS: the event the page offered, which the action
                    compares and never writes, and the one job there is. The opener posts
                    nothing — what it opens asks first. */}
                {!asks && (
                    <>
                        <input type="hidden" name="assetId" value={assetId} />
                        <input type="hidden" name="event" value={plan.event} />
                        <input type="hidden" name="jobId" value={one.id} />
                    </>
                )}
                <Button type="submit" busy={!asks && pending} busyLabel={asks ? undefined : COPY.working[plan.event]}>
                    {COPY.control[plan.event]}
                </Button>
            </form>
            {asks && (
                <TransitionForm
                    key={opening}
                    open={open}
                    onClose={closeDialog}
                    plan={plan}
                    assetId={assetId}
                    currentJobCode={currentJobCode}
                    recentCheckOuts={recentCheckOuts}
                    pending={pending}
                    refusal={open ? refusal : null}
                    onSend={send}
                    onCarry={carry}
                />
            )}
        </>
    );
}

/** The dialog itself: the job, for a check-out the name, and the commitment. */
function TransitionForm({ open, onClose, plan, assetId, currentJobCode, recentCheckOuts, pending, refusal, onSend, onCarry }) {
    // With one job it is already chosen, and with several nothing is (0l) — the asset's
    // own job is not chosen for anybody: a person on several assignments is asked because the
    // app does not know which site they are at.
    const [jobId, setJobId] = useState(() => onlyJob(plan.jobs)?.id ?? "");
    const [name, setName] = useState("");
    const [listOpen, setListOpen] = useState(false);
    const [sheet, setSheet] = useState(null);
    // A CHOSEN JOB THE PLAN NO LONGER HOLDS STARTS AGAIN WHERE AN OPENING STARTS (#469) — see
    // `chosenJobId`, which the phone's foot bar asks of its own choice too (#463).
    const kept = chosenJobId(plan.jobs, jobId);
    if (kept !== jobId) setJobId(kept);

    const asksName = plan.event === ASSET_EVENT.CHECKED_OUT;
    const several = onlyJob(plan.jobs) === null;
    const chosen = plan.jobs.find((job) => job.id === kept) ?? null;
    const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode }));
    // WHO THIS JOB HAS RECENTLY HANDED ASSETS TO, NARROWED IN THE BROWSER (#376). The page
    // loaded the rows for every job this reader is on; the chosen job decides which of them
    // the names are about, and typing narrows them further.
    const recent = recentNamesFor(recentCheckOuts, { jobCode: chosen?.jobCode });
    const offered = offeredNames(recent, name);
    const reading = readSubmission(plan, { event: plan.event, jobId: kept, checkedOutTo: name });

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
            <DialogFrame
                open={open}
                onClose={onClose}
                onHidden={() => onCarry({ jobId: kept, name })}
                busy={pending}
                title={COPY.control[plan.event]}
                onSubmit={submit}
                sheet
            >
                <input type="hidden" name="assetId" value={assetId} />
                {/* The event the page offered. The action re-derives it from the stored
                    status and compares — it never writes this value. */}
                <input type="hidden" name="event" value={plan.event} />
                <DialogBody>
                    {/* The two `Job` values on this screen disagreeing is the asset changing site,
                        said under the field rather than left for the reader to notice. */}
                    <Field label={COPY.jobLabel} labelAs="span" note={jobMoveNotice({ from: currentJobCode, to: chosen?.jobCode })}>
                        <div className="max-sm:hidden">
                            <Choice name="jobId" options={options} value={kept} onChange={setJobId} placeholder={COPY.jobUnchosen} />
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
                                    suggestions={offered.map((person) => ({ label: person, match: matchedPart(person, name) }))}
                                    heading={namesAreRecent(name) ? COPY.recentHeading : undefined}
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
                    value={kept}
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
