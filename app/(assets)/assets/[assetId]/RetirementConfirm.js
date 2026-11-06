"use client";

import { useId } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { ASSET_TRANSITION_COPY as COPY } from "@/lib/assetTransition";

/**
 * The question before an asset is retired (#363, #458) — 0l's Confirm at a desk, and 1j's
 * sheet that confirms below the phone's edge.
 *
 * A PART, OPENED BY WHATEVER OFFERS THE RETIREMENT. 1f and 1j put that offer in a `More
 * actions` menu (`MoreActions.js`, #463), the desk's or the phone's, and the page's provider
 * (`AssetTransition.js`) draws this once for both. **The provider holds its answer since #597**,
 * as it holds the deletion's (#582): a retirement refused because the item is no longer the
 * reader's to record is said where the press was (#614), in this question at a desk and under the
 * status on a phone. So
 * this is handed whether it is open, which asset on which job, whether it is sending, the
 * refusal it says, and where to send.
 *
 * THE TITLE ASKS AND NAMES THE ASSET, AND THE LINE UNDER IT IS THE ID AND NOTHING ELSE —
 * 0l's Confirm and Tools 0a's sheet that confirms, which say the same words at both widths,
 * so one component draws both. The one sentence says what the act ends (`retireBody`), and
 * the commitment is filled red with the act's verb (0f Destructive).
 *
 * IT TAKES NO INPUT AT ALL — no reason, and no job (#363). A retirement inherits the asset's
 * own job, as every event after a registration does since #597; nothing crosses the wire but
 * the asset's id and the job the page was drawn on, which the action compares (`drawnJobId`).
 *
 * NOTHING CLOSES IT WHILE IT IS SENDING (the frame's `busy`), and a press on what lies
 * behind it closes it only as 1j's sheet, where the design draws that — never as 0l's
 * dialog. While it sends, the red commitment keeps its fill and after 300ms says
 * `Retiring…`, and `Cancel` locks with it (#469); neither is disabled, so focus stays on the
 * commitment that was pressed. A landing takes it away with the page it stood on, and the frame
 * then hands focus to the page's heading. A retirement somebody else's got in front of says
 * `This item is retired.` since #614, where until then it said nothing and left the page to.
 *
 * WHERE ITS ANSWER IS SAID IS THE PROVIDER'S (#614): at a desk above its actions, every refusal and a
 * press left half done alike, the question standing until the reader closes it, its commitment
 * `unavailable` and described by the sentence once the page drawn again no longer offers the act or
 * the item moved off the job it was opened on (`available`, #616), live while neither; on a phone any
 * answer closes it and is said under the status, as the files of 2026-11-05 draw both.
 */
export default function RetirementConfirm({ open, onClose, available, assetId, drawnJobId, itemName, busy, refusal, send }) {
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
            title={COPY.retireHeading({ itemName, assetId })}
            recordId={assetId}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <input type="hidden" name="assetId" value={assetId} />
            <input type="hidden" name="drawnJobId" value={drawnJobId ?? ""} />
            <DialogBody>
                <DialogMessage>{COPY.retireBody}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={refusal} refusalId={refusalId}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button variant="danger" type="submit" unavailable={!available} describedBy={!available && refusal ? refusalId : undefined} busyLabel={COPY.retireWorking}>
                    {COPY.retireSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}
