"use client";

import { useId, useState } from "react";
import { Button, Choice, Field, Refusal, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, SheetRows } from "@/app/components/DialogFrame";
import { ASSET_OFFICE_COPY as COPY, readJobChange, startingJob } from "@/lib/assetOfficeActs";

/**
 * The office's `Change job` (#583) — 0l's Compact dialog at a desk (1f) and Tools 0a's sheet of
 * rows on a phone (1j-f), each opened from its own width's `More actions` and drawn by the page's
 * provider (`AssetTransition.js`), which holds which width's stands.
 *
 * IT OPENS ON THE JOB ITS `Created` ENTRY HOLDS (`startingJob`), which is the asset's own until a
 * change is half done, and offers the jobs a list's job choice offers, in its order
 * (`planOfficeActs`). At a desk the job is 0a's choice and `Save` the commitment; on a phone a
 * press on a row moves the check and saves nothing, and `Save` at the head's end saves — where
 * the note's sheet says `Done` — since the files draw the sheet's rows and no commitment.
 *
 * WHAT A SAVE MAY SEND IS `readJobChange`, ASKED HERE BEFORE IT IS SENT AND AGAIN BY THE ACTION.
 * A job that is the one both halves hold closes and sends nothing; anything else is sent. A job
 * the list does not offer, which no screen sends, is refused under the field.
 *
 * THE ANSWER IS THE PAGE'S PROVIDER'S (`AssetTransition.js`). At a desk every answer is said above
 * the dialog's actions, which stands until the reader closes it — `Save` `unavailable` once the page
 * no longer offers the change (`available`), something recorded since or the reader no longer the
 * office, and live for a change left half done; on a phone any answer closes the sheet and is said
 * under the status, as the files of 2026-11-05 draw both (#614). What the dialog offers is the office
 * it was opened from (`plan`, held while it stands).
 *
 * A SENDING IS SAID IN WHAT SENT IT (0f Working, #469): the frame is busy, `Save` says `Saving…`
 * — the phone's spinner alone — and everything else locks. A change that lands redirects, the
 * page is drawn again, and this goes with it.
 *
 * EVERY STRING COMES FROM `ASSET_OFFICE_COPY`.
 */
export function JobChangeForm({ open, onClose, available, assetId, plan, assetJobRecordId, assetOwnerJobRecordId, pending, refusal, onSend }) {
    const refusalId = useId();
    const [jobId, setJobId] = useState(() => startingJob(plan, assetJobRecordId));
    const [pressed, setPressed] = useState(false);
    const focusRefused = useRefusalFocus();
    const answer = readJobChange(plan, { jobId, assetJobRecordId, assetOwnerJobRecordId });
    const options = plan.jobs.map((job) => ({ value: job.id, label: job.jobCode }));

    const submit = (event) => {
        event.preventDefault();
        if (answer.refusal) {
            setPressed(true);
            focusRefused(event.currentTarget);
            return;
        }
        if (answer.unchanged) {
            onClose();
            return;
        }
        onSend(new FormData(event.currentTarget));
    };

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.changeJob} onSubmit={submit}>
            <input type="hidden" name="assetId" value={assetId} />
            <DialogBody>
                <Field label={COPY.jobLabel} labelAs="span" refusal={pressed ? answer.refusal : null}>
                    <Choice name="jobId" options={options} value={jobId} onChange={setJobId} placeholder={COPY.jobUnchosen} />
                </Field>
            </DialogBody>
            <DialogActions refusal={refusal} refusalId={refusalId}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" unavailable={!available} describedBy={!available && refusal ? refusalId : undefined} busyLabel={COPY.saving}>
                    {COPY.save}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * The phone's sheet (1j-f): its title, the jobs as rows with the chosen one checked, and `Save` at
 * the head's end. A press behind it, on its handle or a drag down puts it away and saves nothing,
 * as the note's sheet does, and none of them while it saves (the frame's `busy`).
 */
export function JobChangeRows({ open, onClose, assetId, plan, assetJobRecordId, assetOwnerJobRecordId, pending, onSend }) {
    const [jobId, setJobId] = useState(() => startingJob(plan, assetJobRecordId));
    const [pressed, setPressed] = useState(false);
    const answer = readJobChange(plan, { jobId, assetJobRecordId, assetOwnerJobRecordId });
    const said = pressed ? answer.refusal : null;

    const save = () => {
        if (answer.refusal) {
            setPressed(true);
            return;
        }
        if (answer.unchanged) {
            onClose();
            return;
        }
        const formData = new FormData();
        formData.set("assetId", assetId);
        formData.set("jobId", jobId);
        onSend(formData);
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending}
            title={COPY.changeJob}
            sheet
            closesOnBackdrop
            done={{ label: COPY.save, onPress: save, busyLabel: COPY.saving }}
        >
            <SheetRows
                rows={plan.jobs.map((job) => ({
                    key: job.id,
                    label: job.jobCode,
                    chosen: job.id === jobId,
                    onPress: () => setJobId(job.id),
                }))}
            />
            {said && (
                <div className="px-mobile-gutter pt-mobile-drawer-body-stack">
                    <Refusal>{said}</Refusal>
                </div>
            )}
        </DialogFrame>
    );
}
