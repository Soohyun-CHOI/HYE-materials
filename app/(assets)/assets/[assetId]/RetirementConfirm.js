"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { ASSET_TRANSITION_COPY as COPY } from "@/lib/assetTransition";
import { retireAssetAction } from "./actions";

/**
 * The question before an asset is retired (#363, #458) — 0l's Confirm at a desk, and 1j's
 * sheet that confirms below the phone's edge.
 *
 * A PART, OPENED BY WHATEVER OFFERS THE RETIREMENT. 1f and 1j put that offer in a `More
 * actions` menu (`MoreActions.js`, #463), the desk's or the phone's, and the page's provider
 * (`AssetTransition.js`) draws this once for both. It holds the retirement's own answer,
 * so whatever opens it hands over only whether it is open and which asset.
 *
 * THE TITLE ASKS AND NAMES THE ASSET, AND THE LINE UNDER IT IS THE ID AND NOTHING ELSE —
 * 0l's Confirm and Tools 0a's sheet that confirms, which say the same words at both widths,
 * so one component draws both. The one sentence says what the act ends (`retireBody`), and
 * the commitment is filled red with the act's verb (0f Destructive).
 *
 * IT TAKES NO INPUT AT ALL — no reason, and no job (#363). A retirement inherits the asset's
 * own job, so the page asks the job question once, in the transition's dialog, and
 * the two cannot disagree; nothing crosses the wire but the asset's id.
 *
 * NOTHING CLOSES IT WHILE IT IS SENDING (the frame's `busy`), and a press on what lies
 * behind it closes it only as 1j's sheet, where the design draws that — never as 0l's
 * dialog. While it sends, the red commitment keeps its fill and after 300ms says
 * `Retiring…`, and `Cancel` locks with it (#469); neither is disabled, so focus stays on the
 * commitment that was pressed. A refusal it can stand open for — the status left unwritten —
 * is said above its actions; one that ends the offer, somebody having retired the asset
 * first, takes the dialog away with its opener, and the page says the status is the end
 * (#378). A landing does the same, and the frame then hands focus to the page's heading.
 */
export default function RetirementConfirm({ open, onClose, assetId, itemName }) {
    const [state, formAction, pending] = useActionState(retireAssetAction, null);

    const submit = (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending}
            title={COPY.retireHeading({ itemName, assetId })}
            recordId={assetId}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <input type="hidden" name="assetId" value={assetId} />
            <DialogBody>
                <DialogMessage>{COPY.retireBody}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={state?.error}>
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button variant="danger" type="submit" busyLabel={COPY.retireWorking}>
                    {COPY.retireSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}
