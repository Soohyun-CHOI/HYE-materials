"use client";

import { useId, useState } from "react";
import { Button, Choice, Field, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, SheetRows } from "@/app/components/DialogFrame";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as COPY, lendStart, readLend } from "@/lib/assetTransition";

/**
 * `Lend to another job` (#598) — 0l's Compact dialog at a desk (1f) and Tools 0a's sheet of rows on a
 * phone (1j-f), each opened from its own width's `More actions` and drawn by the page's provider
 * (`AssetTransition.js`), which holds which width's stands.
 *
 * NOT THE OFFICE'S `Change job` (`JobChange.js`), THOUGH IT IS BUILT OF THE SAME PARTS. The two differ
 * in four places the files draw: a lending opens on no job, where a change opens on the one its entry
 * holds; it says under its choice whose the item stays, which a change does not; on a phone its
 * commitment is `Lend` at the sheet's foot under its rows, where a change's `Save` stands at the head's
 * end; and what a press writes is `readLend`'s, which a change's is not. One component holding both
 * would carry a switch for each, so the two share the frame, the field, the choice and the rows.
 *
 * IT OFFERS THE JOBS A LIST OFFERS BUT THE ONE THAT OWNS THE ITEM (`planTransition`'s `lendJobs`), in
 * the list's order, and opens on none — or on the job a lending left half done went to, so one press
 * finishes it (`lendStart`). At a desk the job is 0a's choice and `Lend` the commitment; on a phone a
 * press on a row moves the check and sends nothing, and `Lend` under the rows sends. A press with no
 * job chosen is the design's `Choose a job.`, under the field or over the commitment.
 *
 * WHAT A PRESS MAY SEND IS `readLend`, ASKED HERE BEFORE IT IS SENT AND AGAIN BY THE ACTION. The
 * answer is the page's provider's: at a desk every answer is said over the dialog's actions, which
 * stands until the reader closes it, its `Lend` `unavailable` once the page no longer offers a lending
 * (`available`) — somebody lent it first, it is no longer the reader's to record, it moved off the job
 * the dialog was opened on (#616) — and live for one left half done; on a phone any answer closes the sheet and is said under the status (#614). What the
 * dialog offers is the page it was opened from (`plan`, held while it stands).
 *
 * A SENDING IS SAID IN WHAT SENT IT (0f Working, #469). EVERY STRING COMES FROM `ASSET_TRANSITION_COPY`.
 */
function lendForm({ assetId, drawnJobId, jobId }) {
    const formData = new FormData();
    formData.set("assetId", assetId);
    formData.set("drawnJobId", drawnJobId ?? "");
    formData.set("jobId", jobId);
    return formData;
}

/** The desk's dialog (1f): `Job` and its choice with the line under it, `Cancel` and `Lend`. */
export function LendForm({ open, onClose, available, assetId, drawnJobId, plan, pending, refusal, onSend }) {
    const refusalId = useId();
    const [jobId, setJobId] = useState(() => lendStart(plan));
    const [pressed, setPressed] = useState(false);
    const focusRefused = useRefusalFocus();
    const answer = readLend(plan, { drawnJobId, jobId });
    const options = plan.lendJobs.map((job) => ({ value: job.id, label: job.jobCode }));

    const submit = (event) => {
        event.preventDefault();
        if (answer.refusal) {
            setPressed(true);
            focusRefused(event.currentTarget);
            return;
        }
        onSend(lendForm({ assetId, drawnJobId, jobId }));
    };

    return (
        <DialogFrame open={open} onClose={onClose} busy={pending} title={COPY.control[ASSET_EVENT.LENT]} onSubmit={submit}>
            <DialogBody>
                <Field
                    label={COPY.lendJobLabel}
                    labelAs="span"
                    help={COPY.lendHelp({ ownerJobCode: plan.ownerJobCode ?? "" })}
                    refusal={pressed ? answer.refusal : null}
                >
                    <Choice name="jobId" options={options} value={jobId} onChange={setJobId} placeholder={COPY.lendJobUnchosen} />
                </Field>
            </DialogBody>
            <DialogActions refusal={refusal} refusalId={refusalId}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" unavailable={!available} describedBy={!available && refusal ? refusalId : undefined} busyLabel={COPY.working[ASSET_EVENT.LENT]}>
                    {COPY.lendSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * The phone's sheet (1j-f): its title and the line under it, the jobs as rows with the chosen one
 * checked, and `Lend` at its foot. A press behind it, on its handle or a drag down puts it away and
 * sends nothing, as the job change's sheet does, and none of them while it sends (the frame's `busy`).
 */
export function LendRows({ open, onClose, assetId, drawnJobId, plan, pending, onSend }) {
    const [jobId, setJobId] = useState(() => lendStart(plan));
    const [pressed, setPressed] = useState(false);
    const answer = readLend(plan, { drawnJobId, jobId });

    const submit = (event) => {
        event.preventDefault();
        if (answer.refusal) {
            setPressed(true);
            return;
        }
        onSend(lendForm({ assetId, drawnJobId, jobId }));
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending}
            title={COPY.control[ASSET_EVENT.LENT]}
            subtitle={COPY.lendHelp({ ownerJobCode: plan.ownerJobCode ?? "" })}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <SheetRows
                rows={plan.lendJobs.map((job) => ({
                    key: job.id,
                    label: job.jobCode,
                    chosen: job.id === jobId,
                    onPress: () => {
                        setJobId(job.id);
                        setPressed(false);
                    },
                }))}
            />
            <DialogActions refusal={pressed ? answer.refusal : null}>
                <Button type="submit" busyLabel={COPY.working[ASSET_EVENT.LENT]}>
                    {COPY.lendSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

