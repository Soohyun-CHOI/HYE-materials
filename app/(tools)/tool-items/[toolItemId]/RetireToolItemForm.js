"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { TOOL_TRANSITION_COPY as COPY } from "@/lib/toolTransition";
import { retireToolItemAction } from "./actions";

/**
 * Retiring one tool item (#363) — the transition with no way out.
 *
 * A MODAL, WHERE THE TRANSITION BESIDE IT IS ONE PRESS, AND THE RULE DECIDES IT
 * RATHER THAN TASTE. CLAUDE.md: a modal is for an act that cannot be undone; an
 * act that can is edited in place. #362 read that the other way and was right to
 * — a check-out is undone by the check-in the same control offers a moment later
 * — and nothing undoes this. The frequency points the same way: a tool item is
 * retired once, ever, so a heavier confirmation costs nothing anybody meets
 * twice, where a second tap on a check-out is dozens a day and is what sends
 * people back to paper.
 *
 * THE BODY IS WHAT THE MODAL IS FOR. `docs/briefs/_shared.md` says it of the
 * three deletion voices: they are accurate accounts of what becomes true rather
 * than warnings, and that voice is the point of a confirmation. A person who
 * opened this by accident meets the sentence before the button.
 *
 * IT ASKS FOR NO REASON, AND THAT IS A RULE #363 RETIRED RATHER THAN
 * IMPLEMENTED. A required note on this event was pending from #334 on two
 * grounds — a record of who was responsible, and irreversibility. #335 deleted
 * the `Lost` event and the first ground with it; this modal is the second. With
 * neither left, `Tool Log."Notes"` had nothing to hold — no code reads it as of
 * this commit and it came off the base by hand.
 *
 * IT ASKS FOR NO JOB EITHER, WHICH #363 REVERSED AFTER SHIPPING IT ONCE. A
 * picker here put the same question to a person twice on one screen, and the two
 * answers were free to disagree — which one of them did, on the base, before the
 * branch merged. A retirement inherits the tool item's own job instead, because
 * retiring does not move a tool. So this modal takes no input at all: it is a
 * sentence and two ways out.
 *
 * THE SECOND OVERLAY IN THIS APP THAT HONORS CLAUDE.md's KEYBOARD RULE —
 * `Escape` as well as the opener closes it, and focus goes back to the control
 * that opened it. `app/components/FileViewer.js` was the first and the other ten
 * still do not, so this app now has two kinds of modal. That inconsistency is
 * recorded rather than fixed: repairing ten overlays is not this issue, and
 * `docs/briefs/_shared.md` carries the fact where the next pass over modals will
 * meet it.
 *
 * IT CARRIES THE ONE CLASS THIS AXIS HAS, AND THAT IS NOT #336 BEING BROKEN. The
 * tools screens invent no width, color or spacing; what this imports is the
 * app's single source for modal chrome, and an overlay with no positioning is
 * not an unstyled modal but an inline paragraph — which would quietly undo the
 * decision above. `max-w-md` is the width four other modals already use, so it
 * is the app's value rather than one chosen here, and #258 restyles all of them
 * in one place.
 *
 * EVERY STRING COMES FROM `TOOL_TRANSITION_COPY`, which
 * `offline/tool-list-view.mjs` holds by failing on any JSX text under
 * app/(tools)/.
 */
export default function RetireToolItemForm({ toolItemId }) {
    const [state, formAction, pending] = useActionState(retireToolItemAction, null);
    const [open, setOpen] = useState(false);
    const openerRef = useRef(null);
    const cardRef = useRef(null);

    const close = useCallback(() => {
        // Never yank the modal out from under an in-flight submit, which is
        // WithdrawPOForm's rule and applies to `Escape` as much as to `Cancel`.
        if (pending) return;
        setOpen(false);
        // Back to the control that opened this, not to the top of the document:
        // the reader was in the middle of a tool item and lands where they left.
        openerRef.current?.focus();
    }, [pending]);

    useEffect(() => {
        if (!open) return;
        cardRef.current?.focus();
        const onKey = (e) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, close]);

    return (
        <>
            {/* AN OPENER RATHER THAN A SUBMIT, WHICH IS THE HALF OF THE
                DIFFERENCE FROM THE TRANSITION CONTROL THAT NO STYLING CAN
                COLLAPSE. Pressing this acts on nothing. The other half is the
                wording: it names its object where `Check out` does not. */}
            <button type="button" ref={openerRef} onClick={() => setOpen(true)}>
                {COPY.retireOpener}
            </button>

            {open && (
                <div className={MODAL_BACKDROP} onClick={close}>
                    {/* The card stops the backdrop's close, so a click inside it
                        does not dismiss it. The backdrop click is an addition to
                        the two the keyboard rule asks for, not a substitute. */}
                    <form
                        action={formAction}
                        ref={cardRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="retire-heading"
                        tabIndex={-1}
                        onClick={(e) => e.stopPropagation()}
                        className={`${MODAL_CARD} max-w-md`}
                    >
                        <input type="hidden" name="toolItemId" value={toolItemId} />

                        <h2 id="retire-heading">{COPY.retireHeading}</h2>
                        <p>{COPY.retireBody}</p>

                        {state?.error && <p role="alert">{state.error}</p>}

                        {/* NO JOB CONTROL, AND NO JOB LINE EITHER. The row
                            inherits the tool item's own job, because retiring
                            does not move a tool — `readRetirement` carries the
                            argument. So there is nothing to ask, which is also
                            what stops this screen putting one question to a
                            person twice: the transition form behind it asks it
                            once, and while both asked they were free to
                            disagree. The inherited value is not restated here
                            either — the page's header says it and this does not
                            change it, so a second statement would be one fact
                            twice (#318). The job-move line is the transition's
                            alone, since that sentence says the tool has gone
                            somewhere. */}
                        <button type="submit" disabled={pending}>
                            {COPY.retireSubmit}
                        </button>
                        <button type="button" onClick={close} disabled={pending}>
                            {COPY.retireCancel}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
