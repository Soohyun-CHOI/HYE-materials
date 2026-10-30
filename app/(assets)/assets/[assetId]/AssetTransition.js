"use client";

import { Fragment, createContext, startTransition, useActionState, useContext, useState } from "react";
import Instant from "@/app/components/Instant";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as COPY } from "@/lib/assetTransition";
import { recordAssetEventAction } from "./actions";
import { changeAssetJobAction, deleteAssetAction } from "./officeActions";
import DeleteConfirm from "./DeleteConfirm";
import RetirementConfirm from "./RetirementConfirm";

/**
 * What the asset page's controls share (#463): the one transition's answer, whether its
 * dialog is open, and the retirement's question.
 *
 * ONE ANSWER FOR THREE PLACES. The design asks for a transition in two drawings — a desk's
 * header opens a dialog or records on the press (1f, 1g), a phone's foot bar asks in fields
 * that stay on the page (1j) — and says a refused press in a third, the title block (1k). So
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
 * beside the transition and the phone's in its top bar (1f, 1j), one question for both. It
 * holds its own answer (`RetirementConfirm`), and whatever opened it gets focus back: the
 * menu hands focus to its button before it opens the question.
 *
 * SENDING AN ITEM FOR REPAIR IS THE SAME ACTION FROM THE MENU, AND ITS WAIT IS THE MENU'S
 * (#531). `More actions` sends `Sent for repair` through the one answer, so a refusal stands
 * where the press's does, under the status (1k). The design draws no confirmation and no
 * wait for it, so 0f's rule says it in what sent it: the menu has closed, focus is on its
 * button, and the button is busy while the sending is on its way — so this holds which event
 * is on its way (`sending`), set by every submission as it goes, and `pending` is the press's
 * and its dialog's alone. While the menu's is on its way the press locks rather than
 * drawing a wait it is not doing.
 *
 * WHAT A DESK'S DIALOG HELD GOES TO THE FOOT BAR WHEN THE WINDOW CROSSES THE PHONE'S EDGE
 * (#495). The header row the dialog opens from is not drawn below the edge, so the frame
 * closes the dialog there (`DialogFrame.js`), and the job and the name it was given are
 * `carried` to the bar, which takes them as its own — a phone turned upright mid-check-out
 * finds the bar filled rather than empty. Only that way: a dialog opened at a desk starts
 * where an opening starts (0l), whatever the bar was left holding.
 *
 * THE OFFICE'S JOB CHANGE HOLDS ITS ANSWER HERE TOO (#583), for the reason the transition's is:
 * it is said in two places. While the dialog or the sheet that sent it stands open, above its
 * actions or under its rows; otherwise under the status, where a refused press is said (1k) —
 * which is where a change refused because something was recorded since lands, since that page
 * holds neither the menu's line nor its dialog. `More actions` opens it at each width, and which
 * width opened it is held, so the desk's dialog and the phone's sheet are never open together.
 * Whichever was sent last is the one the status says.
 *
 * AND THE OFFICE'S DELETION (#582), for the same reason: its question (`DeleteConfirm`) says a
 * deletion left half done above its actions, and a refusal that takes its line away — something
 * recorded since, a reader no longer the office — is said under the status of the page drawn
 * again. One question for both widths, as the retirement's is; a landing leaves the page.
 */
const TransitionContext = createContext(null);

/** The page's transition, as the provider holds it. */
export function useAssetTransition() {
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

export default function AssetTransition({ plan, office, assetJobRecordId, assetId, itemName, children }) {
    const [answer, formAction, pending] = useActionState(recordAssetEventAction, null);
    const [jobAnswer, jobFormAction, jobPending] = useActionState(changeAssetJobAction, null);
    const [deleteAnswer, deleteFormAction, deletePending] = useActionState(deleteAssetAction, null);
    // Whether the deletion's question is open (#582), how many openings there have been, and which
    // of them sent the latest answer.
    const [deleting, setDeleting] = useState(false);
    const [deleteOpening, setDeleteOpening] = useState(0);
    const [deleteSentFor, setDeleteSentFor] = useState(null);
    // A deletion the plan no longer offers is no longer open, as a change of job is not.
    if (deleting && !office?.mayDelete) setDeleting(false);
    const deleteSaidInDialog = deleting && deleteSentFor === deleteOpening;
    const deleteSentence = deleteAnswer?.error ? <>{deleteAnswer.error}</> : null;
    // Which width's job change is open (#583), how many openings there have been, which of them
    // sent the latest answer, and which action was sent last.
    const [changingOn, setChangingOn] = useState(null);
    const [jobOpening, setJobOpening] = useState(0);
    const [jobSentFor, setJobSentFor] = useState(null);
    const [lastSent, setLastSent] = useState(null);
    // A change the plan no longer offers is no longer open: something was recorded since, and the
    // page drawn again holds no line to open it from.
    if (changingOn !== null && !office?.mayChangeJob) setChangingOn(null);
    const jobSaidInDialog = changingOn !== null && jobSentFor === jobOpening;
    // Each answer as the sentence a screen draws: the transition's with its moment in the reader's
    // zone, the job change's as it came.
    const transitionSentence = useRefusalSentence(answer);
    const jobSentence = jobAnswer?.error ? <>{jobAnswer.error}</> : null;
    const [openedFor, setOpenedFor] = useState(null);
    const [opening, setOpening] = useState(0);
    const [retiring, setRetiring] = useState(false);
    const [carried, setCarried] = useState(null);
    // Which event the latest submission sent (#531), so the wait is drawn on what sent it.
    const [sending, setSending] = useState(null);
    const repairing = sending === ASSET_EVENT.SENT_FOR_REPAIR;
    const send = (formData) => {
        setSending(String(formData.get("event") ?? ""));
        setLastSent("event");
        startTransition(() => formAction(formData));
    };
    // The opening ends with the event it was for. A landing takes it away with the page's
    // state and a refusal does not, so two refusals that flip the status out and back would
    // otherwise find it naming the event again and open the dialog with nobody asking.
    if (openedFor !== null && openedFor !== plan.event) setOpenedFor(null);
    const open = openedFor !== null && openedFor === plan.event;

    const shared = {
        plan,
        assetId,
        answer,
        formAction,
        // The press's and its dialog's wait, and the menu's (#531): one action, two places it
        // is drawn.
        pending: pending && !repairing,
        repairPending: pending && repairing,
        send,
        // A press that posts its own form says which event it sends, as `send` does.
        sends: (event) => {
            setSending(event);
            setLastSent("event");
        },
        sendForRepair: () => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("event", ASSET_EVENT.SENT_FOR_REPAIR);
            send(formData);
        },
        open,
        opening,
        openDialog: () => {
            setOpening((count) => count + 1);
            setOpenedFor(plan.event);
        },
        closeDialog: () => setOpenedFor(null),
        // A new object each time, so the bar takes every handing-over, the same choice twice
        // included (#495 — the header).
        carried,
        carry: ({ jobId, name }) => setCarried({ jobId, name }),
        openRetirement: () => setRetiring(true),
        // What is said under the status: the answer of whichever was sent last, unless a dialog of
        // its own is saying it.
        statusSentence:
            lastSent === "job"
                ? jobSaidInDialog
                    ? null
                    : jobSentence
                : lastSent === "delete"
                  ? deleteSaidInDialog
                      ? null
                      : deleteSentence
                  : open
                    ? null
                    : transitionSentence,
        office,
        jobChange: {
            assetJobRecordId,
            openOn: changingOn,
            opening: jobOpening,
            start: (on) => {
                setJobOpening((count) => count + 1);
                setChangingOn(on);
            },
            close: () => setChangingOn(null),
            pending: jobPending,
            send: (formData) => {
                setJobSentFor(jobOpening);
                setLastSent("job");
                startTransition(() => jobFormAction(formData));
            },
            refusal: jobSaidInDialog ? jobSentence : null,
        },
        // `More actions` opens the deletion's question at either width (#582).
        openDeletion: () => {
            setDeleteOpening((count) => count + 1);
            setDeleting(true);
        },
    };

    return (
        <TransitionContext.Provider value={shared}>
            {children}
            {plan.mayRetire && (
                <RetirementConfirm open={retiring} onClose={() => setRetiring(false)} assetId={assetId} itemName={itemName} />
            )}
            {office?.mayDelete && (
                <DeleteConfirm
                    open={deleting}
                    onClose={() => setDeleting(false)}
                    assetId={assetId}
                    itemName={itemName}
                    busy={deletePending}
                    refusal={deleteSaidInDialog ? deleteSentence : null}
                    send={(formData) => {
                        setDeleteSentFor(deleteOpening);
                        setLastSent("delete");
                        startTransition(() => deleteFormAction(formData));
                    }}
                />
            )}
        </TransitionContext.Provider>
    );
}
