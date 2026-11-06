"use client";

import { Notice } from "@/app/components/Controls";
import { useAssetTransition } from "./AssetTransition";

/**
 * A refused press on a phone, said in the title block under the status (#463) — 1k's Notice, 16
 * under the status line. Below the phone's edge alone since #614: a desk says a refusal in the
 * dialog or the question that sent it, which stands until the reader closes it, and a desk's press
 * with no dialog says its own in 0k's toast (`AssetTransition.js`), as the files of 2026-11-05 draw
 * both; until then a desk said here every refusal its dialog was not saying.
 *
 * WHERE THE STATUS IS, BECAUSE THAT IS WHAT THE REFUSAL IS ABOUT. The action re-renders the
 * page as it refuses (#378), so the status above this is already the one somebody else's scan
 * left, and the sentence says who scanned and when (`moved`). Every answer a phone's press gets
 * stands here — the foot bar's, the menu's sending, and the sheet's or the question's, which the
 * answer closes, a press left half done among them (Tools 0a Notice, 1k-f) — but a detail's sheet's
 * own, which it keeps (1j-b2, 1j-b3). So what this says is the answer of whichever was sent last,
 * which the provider decides (`statusSentence`).
 */
export default function TransitionRefusal() {
    const { statusSentence: sentence } = useAssetTransition();
    if (!sentence) return null;
    return (
        <div className="mt-mobile-title-alert-stack sm:hidden">
            <Notice>{sentence}</Notice>
        </div>
    );
}
