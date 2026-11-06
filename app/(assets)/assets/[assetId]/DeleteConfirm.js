"use client";

import { useId } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { ASSET_OFFICE_COPY as COPY } from "@/lib/assetOfficeActs";

/**
 * The question before the office deletes an item nothing has happened to (#582) — 0l's Confirm at
 * a desk and 1j's sheet that confirms below the phone's edge, the retirement's frame
 * (`RetirementConfirm`), as the files draw both alike.
 *
 * A PART, OPENED BY `More actions`' `Delete this item` at either width and drawn once for both by
 * the page's provider (`AssetTransition.js`), which holds the deletion's answer. So it is handed whether
 * it is open and whether the page still offers it, the asset, the wait and the sentence it says.
 *
 * WHERE ITS ANSWER IS SAID IS THE PROVIDER'S (#614): at a desk above its actions, every refusal and a
 * press left half done alike, the question standing until the reader closes it, its commitment
 * `unavailable` and described by the sentence once the page drawn again no longer offers the act
 * (`available`), live while it does; on a phone any answer closes it and is said under the status,
 * as the files of 2026-11-05 draw both.
 *
 * THE TITLE ASKS AND NAMES THE ITEM, AND THE LINE UNDER IT IS THE ID AND NOTHING ELSE; the one
 * sentence says what becomes true; the commitment is filled red with the act's verb (0f
 * Destructive). It takes no input: the deletion's job is the asset's own (`readDeletion`), and
 * nothing crosses the wire but the asset's id.
 *
 * NOTHING CLOSES IT WHILE IT IS SENDING (the frame's `busy`), and a press on what lies behind it
 * closes it only as 1j's sheet, the retirement's arrangement. While it sends, the red commitment
 * keeps its fill and after 300ms says `Deleting…`, and `Cancel` locks with it (#469). A deletion
 * left half done is said above its actions, and pressing again finishes it; a landing goes to the
 * item's kind's list (`deletedLanding`), and the page this stood on goes with it.
 */
export default function DeleteConfirm({ open, onClose, available, assetId, itemName, busy, refusal, send }) {
    const refusalId = useId();
    const submit = (event) => {
        event.preventDefault();
        send(new FormData(event.currentTarget));
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={busy}
            title={COPY.deleteHeading({ itemName, assetId })}
            recordId={assetId}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <input type="hidden" name="assetId" value={assetId} />
            <DialogBody>
                <DialogMessage>{COPY.deleteBody}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={refusal} refusalId={refusalId}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button variant="danger" type="submit" unavailable={!available} describedBy={!available && refusal ? refusalId : undefined} busyLabel={COPY.deleteWorking}>
                    {COPY.deleteSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}
