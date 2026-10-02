"use client";

import { startTransition, useActionState } from "react";
import { Button } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame, DialogMessage } from "@/app/components/DialogFrame";
import { TOOL_TRANSITION_COPY as COPY } from "@/lib/toolTransition";
import { retireToolItemAction } from "./actions";

/**
 * The question before a tool item is retired (#363, #458) — 0l's Confirm at a desk, and 1f's
 * sheet that confirms below the phone's edge.
 *
 * A PART, OPENED BY WHATEVER OFFERS THE RETIREMENT. The tool item page's `Retire this tool`
 * opens it today (`RetirementDialog.js`); 1c and 1f put that offer in a `More actions` menu,
 * which is #463's, and that menu opens this as it is. It holds the retirement's own answer,
 * so whatever opens it hands over only whether it is open and which tool item.
 *
 * THE TITLE ASKS AND NAMES THE TOOL, AND THE LINE UNDER IT IS THE ID AND NOTHING ELSE —
 * 0l's Confirm and Tools 0a's sheet that confirms, which say the same words at both widths,
 * so one component draws both. The one sentence says what the act ends (`retireBody`), and
 * the commitment is filled red with the act's verb (0f Destructive).
 *
 * IT TAKES NO INPUT AT ALL — no reason, and no job (#363). A retirement inherits the tool
 * item's own job, so the page asks the job question once, in the transition's dialog, and
 * the two cannot disagree; nothing crosses the wire but the tool item's id.
 *
 * NOTHING CLOSES IT WHILE IT IS SENDING (the frame's `busy`), and a press on what lies
 * behind it closes it only as 1f's sheet, where the design draws that — never as 0l's
 * dialog. A refusal it can stand open for — the status left unwritten — is said above its
 * actions; one that ends the offer, somebody having retired the tool item first, takes the
 * dialog away with its opener, and the page says the status is the end (#378). A landing
 * does the same, and the frame then hands focus to the page's heading.
 */
export default function RetirementConfirm({ open, onClose, toolItemId, toolName }) {
    const [state, formAction, pending] = useActionState(retireToolItemAction, null);

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
            title={COPY.retireHeading({ toolName, toolItemId })}
            recordId={toolItemId}
            onSubmit={submit}
            sheet
            closesOnBackdrop
        >
            <input type="hidden" name="toolItemId" value={toolItemId} />
            <DialogBody>
                <DialogMessage>{COPY.retireBody}</DialogMessage>
            </DialogBody>
            <DialogActions refusal={state?.error}>
                <Button variant="bordered" onClick={onClose} disabled={pending}>
                    {COPY.cancel}
                </Button>
                <Button variant="danger" type="submit" disabled={pending}>
                    {COPY.retireSubmit}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}
