"use client";

import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as COPY } from "@/lib/assetTransition";

/**
 * The question before an item on loan goes back to the job that owns it (#598) — 0l's Confirm at a
 * desk and 1j's sheet that confirms below the phone's edge (1f, 1j-g), the retirement's frame
 * (`RetirementConfirm`), as the files draw the two alike.
 *
 * A PART, OPENED BY `More actions`' `Return to owner` at either width and drawn once for both by the
 * page's provider (`AssetTransition.js`), which holds the return's answer: a refusal that takes this
 * away — the item returned or moved since, so the reader no longer records on it — is said under the
 * status of the page drawn again. So it is handed whether it is open, the asset and the job it was
 * drawn on, the two jobs it names, the wait and the sentence it says.
 *
 * THE TITLE ASKS AND NAMES THE ITEM AND THE JOB IT GOES BACK TO, AND THE LINE UNDER IT IS THE ID; the
 * one sentence says what becomes true — the item is on its owner's list again and this job no longer
 * records it — and the commitment is the Accent's, `Return item`: the act undoes a loan and ends
 * nothing, so it is no Destructive. It takes no input: the return's job is the owner's
 * (`readReturn`), and nothing crosses the wire but the asset's id and the job the page was drawn on.
 *
 * NOTHING CLOSES IT WHILE IT IS SENDING (the frame's `busy`), the retirement's arrangement. A return
 * left half done is said above its actions, and pressing again finishes it; a landing draws the page
 * again on the owner job, and this goes with the line that opened it.
 */
export default function ReturnConfirm({ open, onClose, assetId, drawnJobId, itemName, ownerJobCode, jobCode, busy, refusal, send }) {
    const submit = (event) => {
        event.preventDefault();
        send(new FormData(event.currentTarget));
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={busy}
            title={COPY.returnHeading({ itemName, assetId, ownerJobCode })}
            recordId={assetId}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="drawnJobId" value={drawnJobId ?? ""} />
            <DialogBody>
                <DialogMessage>{COPY.returnBody({ ownerJobCode, jobCode })}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={refusal}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" busyLabel={COPY.working[ASSET_EVENT.RETURNED_TO_OWNER]}>
                    {COPY.returnSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}
