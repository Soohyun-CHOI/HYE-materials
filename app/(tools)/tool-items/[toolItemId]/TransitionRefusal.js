"use client";

import { Notice, Refusal } from "@/app/components/Controls";
import { useRefusalSentence, useToolItemTransition } from "./ToolItemTransition";

/**
 * A refused press, said in the title block under the status (#463) — 1g's Notice on a phone,
 * 16 under the status line, and a desk's refusal line in the same place, which 1c leaves for
 * it. One of the two is drawn at any width, so assistive tech hears it once.
 *
 * WHERE THE STATUS IS, BECAUSE THAT IS WHAT THE REFUSAL IS ABOUT. The action re-renders the
 * page as it refuses (#378), so the status above this is already the one somebody else's scan
 * left, and the sentence says who scanned and when (`moved`). Every other refusal of the
 * press stands here too — the status left unwritten, a job taken away — except while a desk's
 * dialog is open, which says it above its actions instead.
 */
export default function TransitionRefusal() {
    const { answer, open } = useToolItemTransition();
    const sentence = useRefusalSentence(answer);
    if (!sentence || open) return null;
    return (
        <>
            <div className="max-sm:hidden">
                <Refusal>{sentence}</Refusal>
            </div>
            <div className="mt-mobile-title-notice-offset sm:hidden">
                <Notice>{sentence}</Notice>
            </div>
        </>
    );
}
