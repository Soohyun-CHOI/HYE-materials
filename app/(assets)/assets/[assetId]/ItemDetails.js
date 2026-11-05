"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button, Field, FormBusy, Refusal, SheetInput, TextInput, useRefusalFocus } from "@/app/components/Controls";
import { DialogFrame } from "@/app/components/DialogFrame";
import Icon from "@/app/components/Icon";
import { ASSET_NOTE_COPY, readNoteSubmission } from "@/lib/assetNote";
import { ASSET_SERIAL_COPY, readSerialSubmission, serialKey } from "@/lib/assetSerial";
import { ASSET_COPY } from "@/lib/assetView";
import { useAssetTransition } from "./AssetTransition";

/**
 * An item's two details (#533, #601) — its serial number and its note — at both widths: the desk's
 * `Details` block at the head of the record rail (1f, 1g), and the phone's two lines under the status
 * with a sheet each over the keyboard (1j, 0a Value line, 0a Note). One part for the two, since the
 * two are one kind of thing: a value somebody keeps on the item, written in place, no event.
 *
 * READ BY EVERYBODY, WRITTEN BY WHOEVER THE PLAN SAYS. The page hands down `planTransition`'s
 * `mayWriteSerial` and `mayWriteNote` — one answer, a site manager on the item's own job while it is
 * in stock or out (#597, `lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS`). A line with a value is read
 * by everybody; one with none stands only for a reader who may write it, as `Add` at a desk and the
 * line holding its name in Ink 3 on a phone, and for anybody else is not drawn — nor, with neither
 * line drawn, is `Details` (1f `Admin`).
 *
 * AT A DESK A ROW IS EDITED WHERE IT STANDS (1f, since the files of 2026-11-04). `Edit` at the row's
 * end, or `Add` with its plus mark in the value's column, turns the row into a field, the value in it
 * and the caret at its end, with `Cancel` and `Save` under it; `Escape` is `Cancel`, and focus goes
 * back to what opened it. A cleared field saved removes the value, so the note's `Remove note`, which
 * its dialog drew from #533 until these files took the dialog away, has no place left to stand.
 *
 * ON A PHONE THE WHOLE LINE IS THE PRESS (0a), at least 48 and 12 past the text either side — and
 * where both lines are presses, the serial number's reaches 22 above its text and 6 below and the
 * note's 6 above and 22 below, so each keeps 48 and neither covers the other (0a Value line). **What a
 * press washes is the line 6 above and below its text and 12 past it, in Hover, however far its
 * target reaches** (0a Note, #607): the target past that is the button's `::after`, which a press
 * on it holds the button `:active` through. It opens a sheet holding `SheetInput`, whose `Done`
 * saves and on a cleared field removes.
 *
 * WHAT A PRESS MAY SEND IS ASKED HERE BEFORE IT IS SENT AND AGAIN BY THE ACTION — `readNoteSubmission`
 * and `readSerialSubmission`, the one order (`lib/assetNote.js:readDetailSubmission`). Too much typed is
 * refused under the field with focus in it; a value kept to the one there closes and sends nothing.
 * **A serial number another item of the kind holds is the action's to refuse**, on the base as it is
 * when it saves: the sentence names that item under the field in Red, its id in the id's face, and
 * goes once the field no longer holds the number refused, since it is about that number alone.
 *
 * THE ANSWER IS THE PROVIDER'S (`AssetTransition.js:useDetail`), said where the press was while the
 * opening that sent it stands, and under the status once the page has ended it (#597).
 *
 * EVERY STRING COMES FROM `ASSET_SERIAL_COPY`, `ASSET_NOTE_COPY` OR `ASSET_COPY`, which
 * `offline/asset-list-view.mjs` holds by failing on any JSX text under app/(assets)/.
 */

/** The two details, each with what it reads, what it is called and how it is typed. */
const DETAILS = {
    serial: {
        copy: ASSET_SERIAL_COPY,
        rowLabel: ASSET_SERIAL_COPY.rowLabel,
        name: ASSET_SERIAL_COPY.label,
        addName: ASSET_SERIAL_COPY.addSerial,
        editName: ASSET_SERIAL_COPY.editSerial,
        emptyText: ASSET_SERIAL_COPY.addSerial,
        mark: <Icon name="barcode" className="size-icon text-foreground-muted" />,
        face: "figures",
        // A serial number is a maker's, set with even figures and not in the portal's id face (0h,
        // #607), and a desk types it as it is read.
        fieldFace: "[&_input]:tabular-nums",
        read: (input) => readSerialSubmission({ mayWriteSerial: true }, input),
        valueOf: (answer) => answer.serialNumber,
        // A maker's number is typed as printed: the keyboard starts in capitals, and nothing corrects it.
        typing: { autoCapitalize: "characters", autoCorrect: "off", spellCheck: false },
    },
    note: {
        copy: ASSET_NOTE_COPY,
        rowLabel: ASSET_NOTE_COPY.label,
        name: ASSET_NOTE_COPY.label,
        addName: ASSET_NOTE_COPY.addNote,
        editName: ASSET_NOTE_COPY.editNote,
        emptyText: ASSET_NOTE_COPY.addANote,
        mark: <Icon name="message-square" className="size-icon text-foreground-muted" />,
        face: "text",
        fieldFace: "",
        read: (input) => readNoteSubmission({ mayWriteNote: true }, input),
        valueOf: (answer) => answer.note,
        help: ASSET_NOTE_COPY.help,
        count: ASSET_NOTE_COPY.count,
        typing: {},
    },
};

/**
 * What a press of the commitment sends, said as its `-ing` word: a value cleared is a removal, a
 * first value an addition, and anything else a save.
 */
function workingOf(detail, answer, stored) {
    if (detail.valueOf(answer) === "") return "remove";
    return stored ? "save" : "add";
}

/**
 * The action's answer as the field draws it: a serial number taken names the item holding it in the
 * id's face, while the field still holds the number refused (`taken`); anything else is the sentence
 * as it came (`said`), drawn where the dialog's actions would say it.
 */
function serverAnswer(control, draft) {
    if (!control.refusal) return { taken: null, said: null };
    if (!control.takenBy) return { taken: null, said: control.refusal };
    if (serialKey(draft) !== serialKey(control.sentValue)) return { taken: null, said: null };
    return {
        taken: (
            <>
                <span className="font-id tracking-id">{control.takenBy}</span> {ASSET_SERIAL_COPY.takenRest}
            </>
        ),
        said: null,
    };
}

/** The value as a line shows it: a serial number with even figures, wrapping anywhere (0h, #607). */
const VALUE_FACE = { figures: "tabular-nums [overflow-wrap:anywhere]", text: "text-pretty" };

/**
 * The desk's `Details` block (1f, 1g): its name, then a row for each detail that has a value or that
 * the reader may write, the serial number first — 40 over the label's block, at the rail's head.
 */
export function DetailsBlock({ serialNumber, note, mayWriteSerial, mayWriteNote }) {
    const rows = [
        { kind: "serial", value: serialNumber, writable: mayWriteSerial },
        { kind: "note", value: note, writable: mayWriteNote },
    ].filter((row) => row.value || row.writable);
    if (rows.length === 0) return null;
    return (
        <section className="pb-details-block-stack">
            <h2 className="pb-heading-sm-stack text-heading-sm text-foreground-subtle">{ASSET_COPY.detailsHeading}</h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-details-label-inline gap-y-details-row-stack">
                {rows.map((row) => (
                    <DetailsRow key={row.kind} {...row} />
                ))}
            </dl>
        </section>
    );
}

/** One row of `Details`: its label, and its value with `Edit`, or `Add`, or the field editing it. */
function DetailsRow({ kind, value, writable }) {
    const detail = DETAILS[kind];
    const control = useAssetTransition()[kind];
    const open = writable && control.openOn === "desk";
    const openerRef = useRef(null);
    // Focus goes back to what opened the field once it has closed and the opener is drawn again.
    const returning = useRef(false);
    useEffect(() => {
        if (!returning.current || open) return;
        returning.current = false;
        openerRef.current?.focus();
    }, [open]);
    const close = () => {
        returning.current = true;
        control.close();
    };

    return (
        <>
            <dt className="text-body-sm whitespace-nowrap text-foreground-subtle">{detail.rowLabel}</dt>
            {/* A column of one: what it holds stands on the row's line and not on a line box of its own,
                which a 26 control set inline in one drew 22. */}
            <dd className="flex min-w-0 flex-col items-start text-body">
                {open ? (
                    <RowEditor key={control.opening} kind={kind} value={value} control={control} onClose={close} />
                ) : value ? (
                    <div className="flex items-start justify-between gap-details-edit-inline self-stretch">
                        <span className={`min-w-0 text-foreground-default ${VALUE_FACE[detail.face]}`}>{value}</span>
                        {/* `Edit` at the row's end, an Inline control pulled out by its side room so its
                            ink meets the rail's edge (1f). */}
                        {writable && (
                            <button ref={openerRef} type="button" aria-label={detail.editName} onClick={() => control.start("desk")} className="-my-[calc((var(--height-control-inline)-var(--text-body--line-height))/2)] -mr-control-inline-inset-x inline-flex h-control-inline shrink-0 items-center rounded-control px-control-inline-inset-x text-body-sm font-semibold text-foreground-default hover:bg-hover">
                                {detail.copy.edit}
                            </button>
                        )}
                    </div>
                ) : (
                    // `Add` in the value's column, its face reaching 8 left of it and its plus mark 3 (1f).
                    <button ref={openerRef} type="button" aria-label={detail.addName} onClick={() => control.start("desk")} className="-my-[calc((var(--height-control-inline)-var(--text-body--line-height))/2)] -ml-details-add-bleed-left inline-flex h-control-inline items-center gap-note-add-gap rounded-control pr-control-inline-inset-x pl-note-add-bleed-left text-body-sm font-semibold text-primary hover:bg-selected hover:text-primary-hover">
                        <Icon name="plus" className="size-icon-sm shrink-0" />
                        {detail.copy.add}
                    </button>
                )}
            </dd>
        </>
    );
}

/**
 * A row edited where it stands (1f): the field, 32 and centered on the row's line, the value in it
 * and the caret at its end; the note's line and count under it; `Cancel` and `Save` 12 under that.
 */
function RowEditor({ kind, value, control, onClose }) {
    const detail = DETAILS[kind];
    const [draft, setDraft] = useState(value);
    const [pressed, setPressed] = useState(false);
    const focusRefused = useRefusalFocus();
    const inputRef = useRef(null);
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    }, []);
    const answer = detail.read({ typed: draft, previous: value, stored: value });
    const server = serverAnswer(control, draft);

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
        control.send({ typed: draft, previous: value, by: "submit" });
    };

    return (
        <form
            onSubmit={submit}
            onKeyDown={(event) => {
                if (event.key !== "Escape" || control.pending) return;
                event.preventDefault();
                onClose();
            }}
            className={`-mt-[calc((var(--height-control)-var(--text-body--line-height))/2)] flex flex-col self-stretch ${detail.fieldFace}`}
        >
            <FormBusy busy={control.pending}>
                <Field
                    label={detail.name}
                    labelHidden
                    centered={false}
                    help={detail.help}
                    refusal={(pressed ? answer.refusal : null) ?? server.taken}
                    count={detail.count?.(draft.length)}
                >
                    <TextInput size="md" value={draft} onChange={setDraft} inputRef={inputRef} autoComplete="off" {...detail.typing} />
                </Field>
                {server.said && (
                    <div className="pt-details-actions-stack">
                        <Refusal>{server.said}</Refusal>
                    </div>
                )}
                <div className="flex justify-end gap-gap pt-details-actions-stack">
                    <Button variant="bordered" size="md" onClick={onClose}>
                        {detail.copy.cancel}
                    </Button>
                    <Button type="submit" size="md" busyLabel={detail.copy.working[workingOf(detail, answer, value)]}>
                        {detail.copy.save}
                    </Button>
                </div>
            </FormBusy>
        </form>
    );
}

// Each line's press on a phone (0a Note, 0a Value line): the button is the face a press washes in
// Hover — 6 above and below its text and 12 past it either side, rounded at 12, however far the
// target reaches (#607) — and its `::after` is the target past the face: alone, 14 above and below
// the text; paired, the serial number's 22 up and the note's 22 down, each 6 toward the other (#601).
const DETAIL_PRESS =
    "relative -mx-mobile-note-bleed-x -my-mobile-detail-bleed-inner flex w-[calc(100%+2*var(--spacing-mobile-note-bleed-x))] items-start gap-gap rounded-mobile-control px-mobile-note-bleed-x py-mobile-detail-bleed-inner text-left text-mobile-body-sm active:bg-hover after:absolute after:inset-x-0";
const DETAIL_TARGET = {
    alone: "after:inset-y-[calc(var(--spacing-mobile-detail-bleed-inner)-var(--spacing-mobile-note-bleed-y))]",
    upper: "after:top-[calc(var(--spacing-mobile-detail-bleed-inner)-var(--spacing-mobile-detail-bleed-outer))] after:bottom-0",
    lower: "after:top-0 after:bottom-[calc(var(--spacing-mobile-detail-bleed-inner)-var(--spacing-mobile-detail-bleed-outer))]",
};

/**
 * The phone's two lines (1j, 0a Value line, 0a Note): the serial number 12 under the status and the
 * note 12 under it, each drawn while it has a value or the reader may write it.
 */
export function PhoneDetails({ serialNumber, note, mayWriteSerial, mayWriteNote }) {
    const paired = mayWriteSerial && mayWriteNote;
    return (
        <>
            {(serialNumber || mayWriteSerial) && <PhoneDetail kind="serial" value={serialNumber} writable={mayWriteSerial} target={paired ? "upper" : "alone"} />}
            {(note || mayWriteNote) && <PhoneDetail kind="note" value={note} writable={mayWriteNote} target={paired ? "lower" : "alone"} />}
        </>
    );
}

/**
 * One line on a phone: its mark 16 in Ink 2 beside the value at 15 in Ink 2 — a serial number with
 * even figures (0h, #607) — or the line's name in Ink 3 where there is none. For whoever may write it the whole line
 * is the press, named for what it edits and described by the value; for anybody else it is the value
 * alone, and a serial number's name is said to assistive tech alone (0a Value line).
 */
function PhoneDetail({ kind, value, writable, target }) {
    const detail = DETAILS[kind];
    const control = useAssetTransition()[kind];
    const textId = useId();
    const content = (
        <>
            <span className="flex h-[var(--text-mobile-body-sm--line-height)] shrink-0 items-center">
                {detail.mark}
            </span>
            <span id={textId} className={`min-w-0 ${value ? `text-foreground-muted ${VALUE_FACE[detail.face]}` : "text-pretty text-foreground-subtle"}`}>
                {value && kind === "serial" && <span className="sr-only">{detail.name} </span>}
                {value || detail.emptyText}
            </span>
        </>
    );
    return (
        <div className="sm:hidden">
            {writable ? (
                <button
                    type="button"
                    aria-label={value ? detail.editName : undefined}
                    aria-describedby={value ? textId : undefined}
                    onClick={() => control.start("phone")}
                    className={`${DETAIL_PRESS} ${DETAIL_TARGET[target]}`}
                >
                    {content}
                </button>
            ) : (
                <p className="flex items-start gap-gap text-mobile-body-sm">{content}</p>
            )}
            {writable && <DetailSheet key={control.opening} kind={kind} value={value} open={control.openOn === "phone"} control={control} />}
        </div>
    );
}

/**
 * A line's sheet (1j-b2, 1j-b3): Tools 0a's sheet holding one field, titled to add or edit, with `Done`
 * at its head's end — which saves, and on a cleared field removes (0a) — and under the field the
 * note's line with its count, or a serial number's refusal. A press behind it or on its handle, or a
 * drag down (#580), puts it away and saves nothing, and none of them while it saves.
 */
function DetailSheet({ kind, value, open, control }) {
    const detail = DETAILS[kind];
    const [draft, setDraft] = useState(value);
    const [pressed, setPressed] = useState(false);
    const answer = detail.read({ typed: draft, previous: value, stored: value });
    const server = serverAnswer(control, draft);

    const done = () => {
        if (answer.refusal) {
            setPressed(true);
            return;
        }
        if (answer.unchanged) {
            control.close();
            return;
        }
        control.send({ typed: draft, previous: value, by: "submit" });
    };

    return (
        <DialogFrame
            open={open}
            onClose={control.close}
            busy={control.pending}
            title={value ? detail.editName : detail.addName}
            sheet
            closesOnBackdrop
            done={{ label: detail.copy.done, onPress: done, busyLabel: detail.copy.working[workingOf(detail, answer, value)] }}
        >
            <div className="flex flex-col px-mobile-gutter">
                <Field label={detail.name} labelHidden size="xl" help={detail.help} refusal={(pressed ? answer.refusal : null) ?? server.taken} count={detail.count?.(draft.length)}>
                    <SheetInput value={draft} onChange={setDraft} onDone={done} clearLabel={detail.copy.clear} {...detail.typing} />
                </Field>
                {server.said && (
                    <div className="pt-mobile-drawer-body-stack">
                        <Refusal>{server.said}</Refusal>
                    </div>
                )}
            </div>
        </DialogFrame>
    );
}
