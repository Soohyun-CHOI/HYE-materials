"use client";

import { useState } from "react";
import { Button } from "@/app/components/Controls";
import { TOOL_TRANSITION_COPY as COPY } from "@/lib/toolTransition";
import RetirementConfirm from "./RetirementConfirm";

/**
 * Retiring one tool item (#363) — the transition with no way out — as the control that opens
 * its question and the question, which is `RetirementConfirm` (#458).
 *
 * AN OPENER, AND THE HALF OF THE DIFFERENCE FROM THE TRANSITION THAT WORDS CARRY. It names
 * its object where `Check out` does not, and it is a bordered 0a button beside the
 * transition's filled one. Both open a dialog since #458 — a check-out asks who the tool goes
 * to — so what stays apart is what each opens: this one a question naming the tool, with a
 * red commitment and `This can't be undone.`, the other the fields of an act the next scan
 * undoes. The design puts this opener in `More actions` (1c, 1f), which is #463's; until then
 * it stands on the page beside the transition, as it did.
 *
 * THE DIALOG IS OPEN WHILE THIS SAYS SO, and every way out of it hands focus back here, which
 * the browser's own modal dialog does (the frame's header) — except a landing, which leaves
 * the page nothing to retire and takes this opener away with its question; the frame hands
 * focus to the page's heading then.
 *
 * EVERY STRING COMES FROM `TOOL_TRANSITION_COPY`, which `offline/tool-list-view.mjs` holds by
 * failing on any JSX text under app/(tools)/.
 */
export default function RetirementDialog({ toolItemId, toolName }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button variant="bordered" onClick={() => setOpen(true)}>
                {COPY.retireOpener}
            </Button>
            <RetirementConfirm open={open} onClose={() => setOpen(false)} toolItemId={toolItemId} toolName={toolName} />
        </>
    );
}
