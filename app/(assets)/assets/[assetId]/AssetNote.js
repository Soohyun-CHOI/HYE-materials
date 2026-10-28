"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { Button, Field, Refusal, SheetInput, TextInput, useRefusalFocus } from "@/app/components/Controls";
import { DialogActions, DialogBody, DialogFrame } from "@/app/components/DialogFrame";
import Icon from "@/app/components/Icon";
import { ASSET_NOTE_COPY as COPY, readNoteSubmission } from "@/lib/assetNote";
import { updateAssetNoteAction } from "./actions";

/**
 * An item's note (#533), 12 under its status at both widths — 0a's Note, which 1f draws at a
 * desk and 1j on a phone — and the dialog and the sheet that write it.
 *
 * READ BY EVERYBODY, WRITTEN BY WHOEVER `writable` SAYS. The page hands down
 * `planTransition`'s `mayWriteNote`: a site manager on a job, while the item is in stock or
 * out. A note there is reads beside its speech-bubble mark in Ink 2 for everybody (1f, 1j-c,
 * 1j-d); with none, a reader who may write meets `Add note` at a desk and the line holding
 * `Add a note` on a phone (1f, 1j-a), and anybody else meets nothing (0a Note).
 *
 * AT A DESK THE OPENER STANDS BESIDE THE NOTE, ON A PHONE THE LINE IS THE OPENER. 1f draws
 * `Edit` after the note, an Inline control 8 after it, and `Add note` in Accent with its plus
 * mark where no note is; 0a makes the phone's whole line the target, at least 48 tall and
 * reaching 12 past the text either side, washed while pressed at the phone's Radius. Each
 * width opens its own: the desk's dialog (1f) and the phone's sheet over the keyboard
 * (1j-b2), each inside the part of the page only its width draws, so the frame closes one
 * left open as the window crosses the phone's edge (#495).
 *
 * WHAT A PRESS MAY SEND IS `readNoteSubmission`, ASKED HERE BEFORE IT IS SENT AND AGAIN BY THE
 * ACTION. Too much typed is refused under the field in Red with the count, and focus goes to
 * the field (`useRefusalFocus`); a note that tidies to the one there is closes and sends
 * nothing; anything else is sent with the note this page was drawn with, which the action
 * compares. A cleared field and the desk's `Remove note` send the empty string, the note
 * cleared.
 *
 * THE ACTION'S ANSWER IS SAID WHERE THE PRESS WAS — above the dialog's actions, or under the
 * sheet's field — and only to the opening that sent it, so a sentence about a press a reader
 * walked away from does not greet the next opening. The page is drawn again as the action
 * refuses (#378): a note somebody else changed stands above the dialog while what was typed
 * stays in its field, and a second press writes over it knowingly. A reader who may no longer
 * write meets the page without the control and nothing said, and the dialog goes with it.
 *
 * A SENDING IS SAID IN WHAT SENT IT (0f Working, #469). The frame is busy while it is on its
 * way: the commitment, the `Remove note` that sent instead (the frame's `"action"`), or the
 * sheet's `Done`, each with its `-ing` word heard and its spinner seen, and everything else
 * locked. A note that lands redirects, the page is drawn again, and this goes with it.
 *
 * EVERY STRING COMES FROM `ASSET_NOTE_COPY`, which `offline/asset-list-view.mjs` holds by failing
 * on any JSX text under app/(assets)/.
 */
export default function AssetNote({ assetId, note, writable }) {
    const [answer, formAction, pending] = useActionState(updateAssetNoteAction, null);
    // Which width's opening is open, and how many there have been: each opening starts from the
    // note as the page now draws it.
    const [openOn, setOpenOn] = useState(null);
    const [opening, setOpening] = useState(0);
    const [sentFor, setSentFor] = useState(null);
    // What sent the note on its way: the form's commitment, or the desk's `Remove note`, which
    // is an action of the dialog's that is not its submit (#527's `"action"`).
    const [sentBy, setSentBy] = useState(null);

    if (!note && !writable) return null;

    const open = (width) => {
        setOpening((count) => count + 1);
        setOpenOn(width);
    };
    const close = () => setOpenOn(null);
    const send = (typed, by) => {
        const formData = new FormData();
        formData.set("assetId", assetId);
        formData.set("note", typed);
        formData.set("previous", note);
        setSentFor(opening);
        setSentBy(by);
        startTransition(() => formAction(formData));
    };
    const refusal = answer?.error && sentFor === opening ? answer.error : null;
    const shared = { note, pending, sentBy, refusal, onClose: close, onSend: send };

    return (
        <>
            <div className="flex items-start gap-gap text-body max-sm:hidden">
                {note ? (
                    <>
                        <span className="flex h-[var(--text-body--line-height)] shrink-0 items-center">
                            <Icon name="message-square" className="size-icon-sm text-foreground-muted" />
                        </span>
                        <span className="min-w-0 text-pretty text-foreground-muted">{note}</span>
                        {writable && (
                            <button
                                type="button"
                                aria-label={COPY.editNote}
                                onClick={() => open("desk")}
                                className="-my-[calc((var(--height-control-inline)-var(--text-body--line-height))/2)] inline-flex h-control-inline shrink-0 items-center rounded-control px-control-inline-inset-x text-body-sm font-semibold text-foreground-default hover:bg-hover"
                            >
                                {COPY.edit}
                            </button>
                        )}
                    </>
                ) : (
                    <button
                        type="button"
                        onClick={() => open("desk")}
                        className="-my-[calc((var(--height-control-inline)-var(--text-body--line-height))/2)] -mr-control-inline-inset-x -ml-note-add-bleed-left inline-flex h-control-inline items-center gap-note-add-gap rounded-control pr-control-inline-inset-x pl-note-add-bleed-left text-body-sm font-semibold text-primary hover:bg-hover"
                    >
                        <Icon name="plus" className="size-icon-sm shrink-0" />
                        {COPY.addNote}
                    </button>
                )}
                {writable && <NoteDialog key={opening} open={openOn === "desk"} {...shared} />}
            </div>
            <div className="sm:hidden">
                <PhoneNote note={note} writable={writable} onOpen={() => open("phone")} />
                {writable && <NoteSheet key={opening} open={openOn === "phone"} {...shared} />}
            </div>
        </>
    );
}

/**
 * The phone's line (0a Note, 1j): the mark 16 beside the note at 15 in Ink 2, or `Add a note` in
 * Ink 3, wrapping if it must. For whoever may write the whole line is the press, named `Edit
 * note` over a note, which it is described by, as 1j names it; for anybody else it is the note
 * alone.
 */
function PhoneNote({ note, writable, onOpen }) {
    const textId = useId();
    const line = (
        <>
            <span className="flex h-[var(--text-mobile-body-sm--line-height)] shrink-0 items-center">
                <Icon name="message-square" className="size-icon text-foreground-muted" />
            </span>
            <span id={textId} className={`min-w-0 text-pretty ${note ? "text-foreground-muted" : "text-foreground-subtle"}`}>
                {note || COPY.addANote}
            </span>
        </>
    );
    if (!writable) return <p className="flex items-start gap-gap text-mobile-body-sm">{line}</p>;
    return (
        <button
            type="button"
            aria-label={note ? COPY.editNote : undefined}
            aria-describedby={note ? textId : undefined}
            onClick={onOpen}
            className="-mx-mobile-note-bleed-x -my-mobile-note-bleed-y flex min-h-mobile-touch-target w-[calc(100%+2*var(--spacing-mobile-note-bleed-x))] items-start gap-gap rounded-mobile-control px-mobile-note-bleed-x py-mobile-note-bleed-y text-left text-mobile-body-sm active:bg-hover-subtle"
        >
            {line}
        </button>
    );
}

/**
 * What a press of the commitment sends, said as its `-ing` word: a note cleared is a removal,
 * a first note an addition, and anything else a save.
 */
function workingOf(answer, note) {
    if (answer.note === "") return "remove";
    return note ? "save" : "add";
}

/**
 * The desk's dialog (1f): 0l's Compact 420, titled `Edit note` or `Add note`, the field and the
 * line under it with the count at its end, and `Remove note` at the actions' left while there is
 * a note to remove.
 */
function NoteDialog({ open, onClose, note, pending, sentBy, refusal, onSend }) {
    const [draft, setDraft] = useState(note);
    const [pressed, setPressed] = useState(false);
    const focusRefused = useRefusalFocus();
    const answer = readNoteSubmission({ mayWriteNote: true }, { typed: draft, previous: note, stored: note });
    const removing = pending && sentBy === "action";

    const submit = (event) => {
        event.preventDefault();
        if (answer.refusal) {
            setPressed(true);
            focusRefused(event.currentTarget);
            return;
        }
        if (answer.unchanged) {
            onClose();
            return;
        }
        onSend(draft, "submit");
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending ? (removing ? "action" : true) : false}
            title={note ? COPY.editNote : COPY.addNote}
            onSubmit={submit}
        >
            <DialogBody>
                <Field label={COPY.label} help={COPY.help} refusal={pressed ? answer.refusal : null} count={COPY.count(draft.length)}>
                    <TextInput value={draft} onChange={setDraft} placeholder={COPY.placeholder} autoComplete="off" />
                </Field>
            </DialogBody>
            <DialogActions
                refusal={refusal}
                secondary={
                    note ? (
                        <Button variant="ghost" size="md" busy={removing} busyLabel={COPY.working.remove} onClick={() => onSend("", "action")}>
                            {COPY.remove}
                        </Button>
                    ) : undefined
                }
            >
                <Button variant="bordered" onClick={onClose}>
                    {COPY.cancel}
                </Button>
                <Button type="submit" busyLabel={COPY.working[workingOf(answer, note)]}>
                    {note ? COPY.save : COPY.addNote}
                </Button>
            </DialogActions>
        </DialogFrame>
    );
}

/**
 * The phone's sheet (1j-b2): Tools 0a's sheet holding one field, titled as the dialog is, with
 * `Done` at its head's end — which saves, and on a cleared field removes the note (0a Note) —
 * and the line under the field, at 15 and Ink 3, 4 in, the count at its end. A press behind it
 * or on its handle, or a drag down (#580), puts it away and saves nothing, as the name sheet's
 * does — and none of them while it saves, the frame's `busy`; until #580 its handle did.
 */
function NoteSheet({ open, onClose, note, pending, refusal, onSend }) {
    const [draft, setDraft] = useState(note);
    const [pressed, setPressed] = useState(false);
    const answer = readNoteSubmission({ mayWriteNote: true }, { typed: draft, previous: note, stored: note });
    const working = workingOf(answer, note);

    const done = () => {
        if (answer.refusal) {
            setPressed(true);
            return;
        }
        if (answer.unchanged) {
            onClose();
            return;
        }
        onSend(draft, "submit");
    };

    return (
        <DialogFrame
            open={open}
            onClose={onClose}
            busy={pending}
            title={note ? COPY.editNote : COPY.addNote}
            sheet
            closesOnBackdrop
            done={{ label: COPY.done, onPress: done, busyLabel: COPY.working[working] }}
        >
            <div className="flex flex-col px-mobile-gutter">
                <Field label={COPY.label} labelHidden size="xl" help={COPY.help} refusal={pressed ? answer.refusal : null} count={COPY.count(draft.length)}>
                    <SheetInput value={draft} onChange={setDraft} onDone={done} placeholder={COPY.placeholder} clearLabel={COPY.clear} />
                </Field>
                {refusal && (
                    <div className="pt-mobile-drawer-body-stack">
                        <Refusal>{refusal}</Refusal>
                    </div>
                )}
            </div>
        </DialogFrame>
    );
}
