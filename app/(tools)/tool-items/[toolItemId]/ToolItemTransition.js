"use client";

import { Fragment, createContext, startTransition, useActionState, useContext, useState } from "react";
import Instant from "@/app/components/Instant";
import { TOOL_TRANSITION_COPY as COPY } from "@/lib/toolTransition";
import { recordToolItemEventAction } from "./actions";
import RetirementConfirm from "./RetirementConfirm";

/**
 * What the tool item page's controls share (#463): the one transition's answer, whether its
 * dialog is open, and the retirement's question.
 *
 * ONE ANSWER FOR THREE PLACES. The design asks for a transition in two drawings — a desk's
 * header opens a dialog or records on the press (1c, 1d), a phone's foot bar asks in fields
 * that stay on the page (1f) — and says a refused press in a third, the title block (1g). So
 * the action's answer is held once, here, and each reads it: two `useActionState`s would be
 * two answers to one press the first time the window crossed the phone's edge between the
 * press and the answer. The page renders under this, so a press that lands redirects and the
 * router remounts this tree as it did the dialog's (#458) — every opening, choice and answer
 * goes with it — and a refusal re-renders the page in place (#378), keeping the answer.
 *
 * THE DIALOG IS OPEN WHILE THE OFFERED EVENT IS THE ONE IT WAS OPENED FOR, decided here
 * because the header's sentence and the dialog's actions are the two places a refusal can
 * stand and they must not both say it. A refusal that flips the status under an open dialog
 * ends the opening: the page offers the other event, the dialog goes, and its sentence stands
 * in the header where the control is.
 *
 * THE RETIREMENT'S QUESTION IS HERE TOO, AND OPENED FROM EITHER `More actions` — the desk's
 * beside the transition and the phone's in its top bar (1c, 1f), one question for both. It
 * holds its own answer (`RetirementConfirm`), and whatever opened it gets focus back: the
 * menu hands focus to its button before it opens the question.
 */
const TransitionContext = createContext(null);

/** The page's transition, as the provider holds it. */
export function useToolItemTransition() {
    return useContext(TransitionContext);
}

/**
 * The sentence a refused press says (#463), or null. A press somebody else's scan got in front
 * of names who recorded first and when (`moved`), its moment drawn in the reader's own zone
 * in the design's notation, as a sentence holds one (#495); any other refusal is the action's
 * sentence as it came.
 */
export function useRefusalSentence(answer) {
    if (!answer) return null;
    if (answer.moved) {
        return COPY.moved(answer.moved).map((part, index) =>
            typeof part === "string" ? <Fragment key={index}>{part}</Fragment> : <Instant key={index} at={part.at} sentence />
        );
    }
    return answer.error ?? null;
}

export default function ToolItemTransition({ plan, toolItemId, toolName, children }) {
    const [answer, formAction, pending] = useActionState(recordToolItemEventAction, null);
    const [openedFor, setOpenedFor] = useState(null);
    const [opening, setOpening] = useState(0);
    const [retiring, setRetiring] = useState(false);
    // The opening ends with the event it was for. A landing takes it away with the page's
    // state and a refusal does not, so two refusals that flip the status out and back would
    // otherwise find it naming the event again and open the dialog with nobody asking.
    if (openedFor !== null && openedFor !== plan.event) setOpenedFor(null);
    const open = openedFor !== null && openedFor === plan.event;

    const shared = {
        plan,
        toolItemId,
        answer,
        formAction,
        pending,
        send: (formData) => startTransition(() => formAction(formData)),
        open,
        opening,
        openDialog: () => {
            setOpening((count) => count + 1);
            setOpenedFor(plan.event);
        },
        closeDialog: () => setOpenedFor(null),
        openRetirement: () => setRetiring(true),
    };

    return (
        <TransitionContext.Provider value={shared}>
            {children}
            {plan.mayRetire && (
                <RetirementConfirm open={retiring} onClose={() => setRetiring(false)} toolItemId={toolItemId} toolName={toolName} />
            )}
        </TransitionContext.Provider>
    );
}
