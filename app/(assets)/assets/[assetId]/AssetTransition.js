"use client";

import { Fragment, createContext, startTransition, useActionState, useContext, useRef, useState } from "react";
import Instant from "@/app/components/Instant";
import Toast from "@/app/components/Toast";
import { ASSET_EVENT } from "@/lib/assetStatus";
import { ASSET_TRANSITION_COPY as COPY } from "@/lib/assetTransition";
import { ASSET_COPY } from "@/lib/assetView";
import { lendAssetAction, recordAssetEventAction, retireAssetAction, returnAssetToOwnerAction, updateAssetNoteAction, updateAssetSerialAction } from "./actions";
import { changeAssetJobAction, deleteAssetAction } from "./officeActions";
import DeleteConfirm from "./DeleteConfirm";
import { JobChangeForm, JobChangeRows } from "./JobChange";
import { LendForm, LendRows } from "./LendDialog";
import RetirementConfirm from "./RetirementConfirm";
import ReturnConfirm from "./ReturnConfirm";
import TransitionForm from "./TransitionForm";

/**
 * What the asset page's controls share (#463): every answer an action gives the page, which of
 * the page's openings stands and at which width, and the dialogs, questions and sheets those
 * openings draw.
 *
 * ONE ANSWER FOR EVERY PLACE IT IS SAID. The design asks for a transition in two drawings — a
 * desk's header opens a dialog or records on the press (1f, 1g), a phone's foot bar asks in
 * fields that stay on the page (1j) — and says a refused press in the dialog, in a toast or in
 * the title block (1f, 1k). So each action's answer is held once, here, and each place reads it:
 * two `useActionState`s would be two answers to one press the first time the window crossed the
 * phone's edge between the press and the answer. The page renders under this, so a press that
 * lands redirects and the router remounts this tree as it did the dialog's (#458) — every
 * opening, choice and answer goes with it — and a refusal re-renders the page in place (#378),
 * keeping the answer.
 *
 * WHERE A REFUSAL IS SAID IS WHERE ITS PRESS WAS, AS THE FILES OF 2026-11-05 DRAW IT (#614).
 * - **At a desk, an opening stands until the reader closes it**: the check-out's dialog, the
 *   lending's and the job change's, and the retirement's, the return's and the deletion's
 *   questions. A refusal and a press left half done are said in it, over its actions, whatever
 *   the page drawn again now offers — the item moved, somebody got in front, the press no longer
 *   offered — and its commitment stays drawn, `unavailable` and described by the sentence when
 *   the page no longer offers the act, live when it does. What an opening shows is what it was
 *   opened on (`useHeldWhileOpen`), so its title and its choices do not change under the reader.
 *   Until #614 the page drawn again ended every opening it no longer offered, and the sentence
 *   stood under the status.
 * - **A desk's press with no dialog says its answer in 0k's toast** — a check-in and a return
 *   from repair in the header, a sending from `More actions` — which stays until it is dismissed
 *   or the next press (`Toast.js`), where until #614 it stood under the status.
 * - **On a phone, every answer to a sheet or a question ends it**, and the page as it now stands
 *   says the answer in the Notice under the status (Tools 0a Notice, 1k); the foot bar's presses
 *   and the menu's sending have no sheet and say theirs there already. A detail's sheet keeps its
 *   own answers — a value somebody else changed, too much typed, a number another item holds —
 *   since 1j-b2 and 1j-b3 draw them in the sheet; only one the page ends, the detail no longer the
 *   reader's to write, is said under the status. Until #614 a lending, a job change, a return, a
 *   retirement and a deletion left half done stayed in their sheet or question.
 * Which width an opening stands at is held from the press that opened it, the menu's at either
 * width (`More actions`), so the desk's dialog and the phone's sheet are never open together.
 *
 * SENDING AN ITEM FOR REPAIR IS THE SAME ACTION FROM THE MENU, AND ITS WAIT IS THE MENU'S
 * (#531). `More actions` sends `Sent for repair` through the one answer, said where a desk's or
 * a phone's press with no dialog says its own. The design draws no confirmation for it, so 0f's
 * rule says its wait in what sent it: the menu has closed, focus is on its button, and the button
 * is busy while the sending is on its way — so this holds which event is on its way (`sending`),
 * set by every submission as it goes, and `pending` is the press's and its dialog's alone. While
 * the menu's is on its way the press locks rather than drawing a wait it is not doing.
 *
 * WHAT A DESK'S DIALOG HELD GOES TO THE FOOT BAR WHEN THE WINDOW CROSSES THE PHONE'S EDGE
 * (#495). The header row the dialog opens from is not drawn below the edge, so the frame
 * closes the dialog there (`DialogFrame.js`), and the name it was given is `carried` to the
 * bar, which takes it as its own — a phone turned upright mid-check-out finds the bar filled
 * rather than empty. Only that way: a dialog opened at a desk starts where an opening starts
 * (0l), whatever the bar was left holding.
 *
 * EVERY FORM CARRIES THE ITEM'S JOB AS THE PAGE WAS DRAWN (#597), `drawnJobId`, which each action
 * compares and never writes (`lib/assetTransition.js:recordingRefusal`). A desk's opening that
 * stands across a page drawn again on another job posts the job it stands on now, so a press
 * after `This item is on 26-USA-07 now.` records there, as the page now says.
 */
const TransitionContext = createContext(null);

/**
 * One of the item's details as the page holds it (#533, #601): which width's opening is open — `"desk"` or
 * `"phone"` — and how many there have been, which of them sent the latest answer, what sent it and the
 * value it sent, and the answer. The note's slot from #597, made one function when the serial number
 * took a second, so the two cannot hold an answer two ways. `field` is the form's name for the value,
 * `onSent` what the provider marks as sent last.
 *
 * AN ANSWER IS THE OPENING'S THAT SENT IT (`saidInOpening`), so a sentence about a press a reader
 * walked away from does not greet the next opening; `end` counts an opening the page ends as a new
 * one, so its answer leaves it for the status. `takenBy` is the printed id of the item a serial number
 * was refused for (#601), and `sentValue` what was sent, which the field compares its draft against.
 */
function useDetail(action, { field, assetId, drawnJobId, onSent }) {
    const [answer, formAction, pending] = useActionState(action, null);
    const [openOn, setOpenOn] = useState(null);
    const [opening, setOpening] = useState(0);
    const [sentFor, setSentFor] = useState(null);
    const [sentBy, setSentBy] = useState(null);
    const [sentValue, setSentValue] = useState(null);
    const sentence = answer?.error ? <>{answer.error}</> : null;
    const saidInOpening = sentFor === opening;
    return {
        openOn,
        opening,
        pending,
        sentBy,
        sentValue,
        sentence,
        saidInOpening,
        refusal: saidInOpening ? sentence : null,
        takenBy: saidInOpening ? (answer?.takenBy ?? null) : null,
        start: (on) => {
            setOpening((count) => count + 1);
            setOpenOn(on);
        },
        close: () => setOpenOn(null),
        end: () => {
            setOpenOn(null);
            setOpening((count) => count + 1);
        },
        send: ({ typed, previous, by }) => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("drawnJobId", drawnJobId ?? "");
            formData.set(field, typed);
            formData.set("previous", previous);
            setSentFor(opening);
            setSentBy(by);
            setSentValue(typed);
            onSent();
            startTransition(() => formAction(formData));
        },
    };
}

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

/**
 * What an opening was opened on, while it stands (#614): a desk's dialog that outlives the page it
 * was opened from draws its title, its sentence and its choices from the page as it was, and follows
 * the page again once it is closed. Its commitment asks the page as it is now.
 */
export function useHeldWhileOpen(open, value) {
    const [held, setHeld] = useState(value);
    if (!open && held !== value) setHeld(value);
    return open ? held : value;
}

/**
 * One opening of a dialog, a question or a sheet (#614): the width it stands at — `"desk"` or
 * `"phone"` — or null, how many there have been, which of them sent the latest answer, and whether
 * that answer has come. `said` is whether the standing opening says its answer; `answered` whether
 * the answer it sent has come back, told from the one standing when it was sent, so a phone's
 * opening ends on its own answer and never on an earlier one.
 */
function useOpening(answer, pending) {
    const [on, setOn] = useState(null);
    const [count, setCount] = useState(0);
    const [sentFor, setSentFor] = useState(null);
    const [before, setBefore] = useState(null);
    const said = on !== null && sentFor === count;
    return {
        on,
        count,
        said,
        answered: said && !pending && answer !== null && answer !== before,
        start: (width) => {
            setCount((n) => n + 1);
            setOn(width);
        },
        close: () => setOn(null),
        end: () => {
            setOn(null);
            setCount((n) => n + 1);
        },
        sent: () => {
            setSentFor(count);
            setBefore(answer);
        },
    };
}

export default function AssetTransition({ plan, office, assetJobRecordId, assetOwnerJobRecordId = null, assetId, itemName, recentCheckOuts = [], children }) {
    const [answer, formAction, pending] = useActionState(recordAssetEventAction, null);
    const [retireAnswer, retireFormAction, retirePending] = useActionState(retireAssetAction, null);
    const [lendAnswer, lendFormAction, lendPending] = useActionState(lendAssetAction, null);
    const [returnAnswer, returnFormAction, returnPending] = useActionState(returnAssetToOwnerAction, null);
    const [jobAnswer, jobFormAction, jobPending] = useActionState(changeAssetJobAction, null);
    const [deleteAnswer, deleteFormAction, deletePending] = useActionState(deleteAssetAction, null);
    const retiring = useOpening(retireAnswer, retirePending);
    const lending = useOpening(lendAnswer, lendPending);
    const returning = useOpening(returnAnswer, returnPending);
    const changing = useOpening(jobAnswer, jobPending);
    const deleting = useOpening(deleteAnswer, deletePending);
    // Which action was sent last, whose answer the status says on a phone.
    const [lastSent, setLastSent] = useState(null);
    // The item's two details (#533, #601): the note and the serial number, a slot each.
    const note = useDetail(updateAssetNoteAction, { field: "note", assetId, drawnJobId: assetJobRecordId, onSent: () => setLastSent("note") });
    const serial = useDetail(updateAssetSerialAction, { field: "serialNumber", assetId, drawnJobId: assetJobRecordId, onSent: () => setLastSent("serial") });
    const [carried, setCarried] = useState(null);
    // Which event the latest submission sent (#531), so the wait is drawn on what sent it, and where
    // it was pressed (#614): the desk's dialog, a desk's press with no dialog, or a phone's.
    const [sending, setSending] = useState(null);
    const [eventVia, setEventVia] = useState(null);
    const repairing = sending === ASSET_EVENT.SENT_FOR_REPAIR;
    // The check-out's dialog (1f, 1i), a desk's alone: the event it was opened for, its openings and
    // which of them sent the latest answer.
    const [openedFor, setOpenedFor] = useState(null);
    const [opening, setOpening] = useState(0);
    const [eventSentFor, setEventSentFor] = useState(null);
    const open = openedFor !== null;
    // The control a desk's press with no dialog was made on, which the toast hands focus back to while
    // it stands, and the answer a dismissed toast said (#614).
    const pressedOn = useRef(null);
    const [dismissed, setDismissed] = useState(null);

    // Each answer as the sentence a screen draws: the transition's and a loan's with its moment in the
    // reader's zone, the others as they came.
    const transitionSentence = useRefusalSentence(answer);
    const lendSentence = useRefusalSentence(lendAnswer);
    const returnSentence = useRefusalSentence(returnAnswer);
    const retireSentence = retireAnswer?.error ? <>{retireAnswer.error}</> : null;
    const jobSentence = jobAnswer?.error ? <>{jobAnswer.error}</> : null;
    const deleteSentence = deleteAnswer?.error ? <>{deleteAnswer.error}</> : null;

    // A PHONE'S OPENING THE PAGE ENDS, OR ITS ANSWER DOES (#597, #614): the plan no longer offering
    // it, the page drawn on another job, or its own answer come back. Each ended opening counts as a
    // new one, so its answer is no longer its sheet's and the status says it. A desk's stands.
    const phone = (each) => each.on === "phone";
    if (phone(retiring) && (!plan.mayRetire || retiring.answered)) retiring.end();
    if (phone(lending) && (!plan.mayLend || lending.answered)) lending.end();
    if (phone(returning) && (!plan.mayReturn || returning.answered)) returning.end();
    if (phone(changing) && (!office?.mayChangeJob || changing.answered)) changing.end();
    if (phone(deleting) && (!office?.mayDelete || deleting.answered)) deleting.end();
    if (note.openOn === "phone" && !plan.mayWriteNote) note.end();
    if (serial.openOn === "phone" && !plan.mayWriteSerial) serial.end();
    const [drawnOn, setDrawnOn] = useState(assetJobRecordId);
    if (drawnOn !== assetJobRecordId) {
        setDrawnOn(assetJobRecordId);
        for (const each of [retiring, lending, returning]) if (phone(each)) each.end();
        if (note.openOn === "phone") note.end();
        if (serial.openOn === "phone") serial.end();
    }

    const eventSaidInDialog = open && eventVia === "dialog" && eventSentFor === opening;
    // What a phone's status says: the answer of whichever was sent last, unless the opening that sent
    // it says it — or, for the transition, a desk's dialog or its toast does.
    const said = {
        event: eventSaidInDialog || eventVia === "desk" ? null : transitionSentence,
        retire: retiring.said ? null : retireSentence,
        note: note.saidInOpening ? null : note.sentence,
        serial: serial.saidInOpening ? null : serial.sentence,
        job: changing.said ? null : jobSentence,
        delete: deleting.said ? null : deleteSentence,
        lend: lending.said ? null : lendSentence,
        return: returning.said ? null : returnSentence,
    };
    // A desk's press with no dialog says its answer in the toast until it is dismissed or the next press.
    const toastShown = eventVia === "desk" && lastSent === "event" && !pending && transitionSentence !== null && answer !== dismissed;

    const send = (formData, via) => {
        setSending(String(formData.get("event") ?? ""));
        setLastSent("event");
        setEventVia(via);
        if (via === "dialog") setEventSentFor(opening);
        if (via === "desk") pressedOn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        startTransition(() => formAction(formData));
    };
    // Each opening's own action, marked as sent by that opening and as the last action sent.
    const sendFrom = (each, key, action) => (formData) => {
        each.sent();
        setLastSent(key);
        startTransition(() => action(formData));
    };

    const shared = {
        plan,
        assetId,
        // The item's job as this page was drawn (#597), which every form posts beside what it
        // records, for the action to compare.
        drawnJobId: assetJobRecordId,
        answer,
        formAction,
        // The press's and its dialog's wait, and the menu's (#531): one action, two places it
        // is drawn.
        pending: pending && !repairing,
        repairPending: pending && repairing,
        send,
        // A press that posts its own form says which event it sends and where it was made, as `send` does.
        sends: (event, via) => {
            setSending(event);
            setLastSent("event");
            setEventVia(via);
            if (via === "desk") pressedOn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        },
        sendForRepair: (via) => {
            const formData = new FormData();
            formData.set("assetId", assetId);
            formData.set("drawnJobId", assetJobRecordId ?? "");
            formData.set("event", ASSET_EVENT.SENT_FOR_REPAIR);
            send(formData, via);
        },
        open,
        openDialog: () => {
            setOpening((count) => count + 1);
            setOpenedFor(plan.event);
        },
        // A new object each time, so the bar takes every handing-over, the same name twice
        // included (#495 — the header).
        carried,
        statusSentence: said[lastSent ?? "event"],
        office,
        // `More actions` opens each of these at its width (#583, #598, #363, #582).
        jobChange: { start: changing.start },
        lend: { start: lending.start },
        openReturn: returning.start,
        openRetirement: retiring.start,
        openDeletion: deleting.start,
        // The two details' openings and answers (#533, #597, #601): `ItemDetails.js` draws the desk's rows and
        // the phone's lines and sheets, and sends through here.
        note,
        serial,
    };

    // Every opening's content as it was opened on (#614), and whether the page as it is still offers it.
    // Each holds a prop the page hands down, which keeps its identity between renders: a value built here
    // would differ every render and never be held.
    const heldPlan = useHeldWhileOpen(open, plan);
    const heldReturnPlan = useHeldWhileOpen(returning.on !== null, plan);
    const heldLendPlan = useHeldWhileOpen(lending.on !== null, plan);
    const heldOffice = useHeldWhileOpen(changing.on !== null, office);

    return (
        <TransitionContext.Provider value={shared}>
            {children}
            {opening > 0 && (
                <TransitionForm
                    key={opening}
                    open={open}
                    onClose={() => setOpenedFor(null)}
                    plan={heldPlan}
                    available={plan.records && plan.event === openedFor}
                    assetId={assetId}
                    drawnJobId={assetJobRecordId}
                    recentCheckOuts={recentCheckOuts}
                    pending={pending && !repairing}
                    refusal={eventSaidInDialog ? transitionSentence : null}
                    onSend={(formData) => send(formData, "dialog")}
                    onCarry={({ name }) => setCarried({ name })}
                />
            )}
            {(plan.mayLend || lending.count > 0) && (
                <>
                    <LendForm
                        key={`desk-${lending.count}`}
                        open={lending.on === "desk"}
                        onClose={lending.close}
                        available={plan.mayLend}
                        assetId={assetId}
                        drawnJobId={assetJobRecordId}
                        plan={heldLendPlan}
                        pending={lendPending}
                        refusal={lending.said ? lendSentence : null}
                        onSend={sendFrom(lending, "lend", lendFormAction)}
                    />
                    <LendRows
                        key={`phone-${lending.count}`}
                        open={lending.on === "phone"}
                        onClose={lending.close}
                        assetId={assetId}
                        drawnJobId={assetJobRecordId}
                        plan={heldLendPlan}
                        pending={lendPending}
                        onSend={sendFrom(lending, "lend", lendFormAction)}
                    />
                </>
            )}
            {(office?.mayChangeJob || changing.count > 0) && (
                <>
                    <JobChangeForm
                        key={`desk-${changing.count}`}
                        open={changing.on === "desk"}
                        onClose={changing.close}
                        available={Boolean(office?.mayChangeJob)}
                        assetId={assetId}
                        plan={heldOffice}
                        assetJobRecordId={assetJobRecordId}
                        assetOwnerJobRecordId={assetOwnerJobRecordId}
                        pending={jobPending}
                        refusal={changing.said ? jobSentence : null}
                        onSend={sendFrom(changing, "job", jobFormAction)}
                    />
                    <JobChangeRows
                        key={`phone-${changing.count}`}
                        open={changing.on === "phone"}
                        onClose={changing.close}
                        assetId={assetId}
                        plan={heldOffice}
                        assetJobRecordId={assetJobRecordId}
                        assetOwnerJobRecordId={assetOwnerJobRecordId}
                        pending={jobPending}
                        onSend={sendFrom(changing, "job", jobFormAction)}
                    />
                </>
            )}
            {(plan.mayRetire || retiring.count > 0) && (
                <RetirementConfirm
                    open={retiring.on !== null}
                    onClose={retiring.close}
                    available={plan.mayRetire}
                    assetId={assetId}
                    drawnJobId={assetJobRecordId}
                    itemName={itemName}
                    busy={retirePending}
                    refusal={retiring.said ? retireSentence : null}
                    send={sendFrom(retiring, "retire", retireFormAction)}
                />
            )}
            {(plan.mayReturn || returning.count > 0) && (
                <ReturnConfirm
                    open={returning.on !== null}
                    onClose={returning.close}
                    available={plan.mayReturn}
                    assetId={assetId}
                    drawnJobId={assetJobRecordId}
                    itemName={itemName}
                    ownerJobCode={heldReturnPlan.ownerJobCode ?? ""}
                    jobCode={heldReturnPlan.jobCode ?? ""}
                    busy={returnPending}
                    refusal={returning.said ? returnSentence : null}
                    send={sendFrom(returning, "return", returnFormAction)}
                />
            )}
            {(office?.mayDelete || deleting.count > 0) && (
                <DeleteConfirm
                    open={deleting.on !== null}
                    onClose={deleting.close}
                    available={Boolean(office?.mayDelete)}
                    assetId={assetId}
                    itemName={itemName}
                    busy={deletePending}
                    refusal={deleting.said ? deleteSentence : null}
                    send={sendFrom(deleting, "delete", deleteFormAction)}
                />
            )}
            <Toast
                shown={toastShown}
                line={transitionSentence}
                dismissLabel={ASSET_COPY.dismiss}
                onDismiss={() => setDismissed(answer)}
                opener={pressedOn}
                desk
            />
        </TransitionContext.Provider>
    );
}
