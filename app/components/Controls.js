"use client";

import Link from "next/link";
import { createContext, useContext, useId, useRef, useState } from "react";
import {
    CONTROLS_COPY as COPY,
    buttonBusyState,
    editableComboboxKey,
    movedIndex,
    numberFieldText,
    selectOnlyKey,
    stepNumber,
    typeaheadIndex,
} from "@/lib/controls";
import Icon from "./Icon";
import Menu from "./Menu";

/*
 * The controls Claude Design draws in 0a and 0f (#456): a button, a field with its label
 * and the line under it, a number field with its steps, a choice among fixed options, and
 * a typed value with suggestions.
 *
 * A CONTROL IS NOT A DIALOG'S, WHICH IS WHY THESE ARE NOT IN `DialogFrame.js`. The
 * registration dialog is their first caller, and #463 draws the same button and the same
 * field on the tools screens themselves; a screen importing them from the frame would
 * import a dialog it does not have. Their words are `lib/controls.js`'s for the same
 * reason, apart from the frame's in `lib/dialogFrame.js`.
 *
 * A SCREEN TAKES ITS LOOK FROM THESE AND WRITES NO VALUE. Every class reads a name
 * `app/designValues.css` declares, and until #258 only a file nothing outside
 * `app/(tools)/` and `app/login/` calls may do that — `offline/design-values.mjs` walks the
 * import graph, so a screen above those importing one of these fails it wherever the file
 * sits. **The materials screens keep their own controls until then**, and one of them is
 * the same kind of thing: `app/admin/disciplines/new/JobCombobox.js` is a searchable
 * combobox written for that form alone, unstyled, with keys of its own. #258 is where the
 * screens above this axis take these controls, and it is the condition for that one going
 * too.
 *
 * TWO SIZES, AND THE SIGN-IN SCREENS ARE THE SECOND (#473). `lg` is a dialog's — 0a's 36,
 * the size every control here was drawn at first — and `xl` a sign-in page's: 40 at a desk,
 * the column's width, and below the phone's edge the phone's own button and field (Tools
 * 0a). A dialog's controls take the phone's sizes only where the dialog opens as a sheet,
 * below.
 *
 * A BUSY ACTION IS DRAWN HERE AND NOWHERE ELSE (0f Working, #473). An action whose work has
 * started keeps its fill and its ink, takes no press, and after 300ms gives its label way to
 * a spinner — alone in an action as wide as its words, before the work's own `-ing` word in
 * one that spans its column (#495) — the delay is a name and the switch is CSS, so an answer
 * inside it changes nothing on the screen. The sign-in steps say when an action is busy
 * themselves, and lock their own fields.
 *
 * A DIALOG'S FRAME SAYS IT FOR EVERYTHING IT HOLDS (#469). The frame takes `busy` while a
 * dialog's submission is in flight, as it has since #456 so as not to close, and wraps what
 * it holds in `FormBusy`: the form's submit draws Working, and every other control locks —
 * it keeps its look and takes no press and no keystroke (0f: "the other controls of its form
 * or dialog lock with it"). NOTHING IN IT IS DISABLED, which is what keeps focus where the
 * submission found it: a disabled control gives focus up to the document, which is what the
 * dialogs' commitments did while they sent until this issue (#458). What a button is under it
 * is `lib/controls.js:buttonBusyState`. A dialog names its commitment's `-ing` word, as
 * `busyLabel`, and does nothing else.
 *
 * A FIELD SAYS WHO IT IS TO WHAT IT HOLDS. `Field` renders the label and the one line
 * under the control — help, a note, or a refusal about this field, which takes the help's
 * place and rings the control in red (0l) — and hands the control, through context, the
 * id its label points at, the id of that line and whether it refuses. So a control inside
 * a field is labeled, described and marked invalid without its caller wiring three ids.
 *
 * IN A SHEET ON A PHONE THEY TAKE THE PHONE'S SIZES, AND NOWHERE ELSE (#458). The tool item
 * page's dialogs open as Tools 0a's sheets below the phone's edge, and there a button is
 * 48 and full width, 17 at 600, a bordered one a text button, and a field's label 15. The
 * frame marks such a dialog `data-sheet`, so those sizes are `max-sm:in-data-[sheet]:`
 * classes — CSS decides both conditions, the width and the ancestor, and a control in any
 * other dialog or on a page keeps 0a's at every width; the registration's and the labels'
 * dialogs are a desk's. `SheetField` is the phone's own field: it opens one of 1f's sheets
 * and shows what the sheet chose. **A busy action in a sheet is Tools 0a's Busy (#469)** —
 * the phone's spinner alone, the word left for assistive tech — as it is on a sign-in step.
 */

const FieldContext = createContext(null);

// Whether the form these controls stand in waits on its submission (#469).
const FormBusyContext = createContext(false);

/**
 * The controls of a form whose submission is in flight (0f Working, #469) — what the dialog
 * frame wraps around everything it holds, with its own `busy`. Inside it the form's submit
 * draws Working and every other control locks, keeping its look and taking no press and no
 * keystroke; none is disabled, so focus stays where the submission found it.
 */
export function FormBusy({ busy, children }) {
    return <FormBusyContext.Provider value={busy}>{children}</FormBusyContext.Provider>;
}

/**
 * Everything a control inside a `Field` needs of it — and outside one, an id of its own
 * and nothing else, so a control standing alone still names its list.
 *
 * EXPORTED FOR A CONTROL DRAWN OUTSIDE THIS FILE (#473): the sign-in code's six boxes are
 * one field the sign-in screen draws itself, and it is named, described and marked invalid
 * by the `Field` around it the way every control here is.
 */
export function useField() {
    const own = useId();
    return useContext(FieldContext) ?? { control: `${own}control`, labelId: undefined, messageId: undefined, refused: false };
}

/**
 * The mark before a refusal: a circle and an exclamation, 16, in the ink of the sentence it
 * stands before (0l Actions, Tools 0a Field error). It was the dialog frame's own until
 * #473, when the sign-in screens drew the same mark before their refusals; #148's drawings
 * gave a sign-in page's own refusal the info mark instead.
 */
function AlertMark() {
    return <Icon name="circle-alert" className="size-icon shrink-0" />;
}

/**
 * The mark before what a notice says: a circle with an i in it, in Ink 2 — 18 in Tools 0a's
 * Notice, and 16 beside a sentence on a sign-in page (#148) or a dialog's (#495). In Ink 3 it
 * leads the reason a selection bar's action gives (0b, #495), the ink that reason is set in.
 * Its line is every mark's since #502, where the 16 had drawn its ring a touch heavier.
 */
const INFO_MARK_TONE = { muted: "text-foreground-muted", subtle: "text-foreground-subtle" };

export function InfoMark({ size = "size-mobile-alert-icon", tone = "muted" }) {
    return <Icon name="info" className={`${size} shrink-0 ${INFO_MARK_TONE[tone]}`} />;
}

/**
 * Tools 0a's Notice — something the reader did not cause and cannot fix in place: the ink
 * at 4.5% on the phone's Radius, 14 and 16 inside, the 18 info mark 10 before one sentence
 * at 16 in Ink. It is a refusal, so assistive tech hears it as one.
 *
 * MOVED HERE FROM THE SIGN-IN STEPS IN #463, which drew it for a request that did not go
 * through; the tool item page draws it for a press somebody else's scan got in front of
 * (1g). Where it stands, and whether a desk draws something else in its place, is its
 * caller's.
 */
export function Notice({ children }) {
    return (
        <div
            role="alert"
            className="flex gap-mobile-alert-gap rounded-mobile-control bg-background-muted px-mobile-alert-inset-x py-mobile-alert-inset-y text-mobile-body text-pretty text-foreground-default"
        >
            <span className="flex h-[var(--text-mobile-body--line-height)] items-center">
                <InfoMark />
            </span>
            <span>{children}</span>
        </div>
    );
}

/**
 * A refusal about the whole of what a form asks — a dialog's (0l Actions), and a tool item
 * page's at a desk (#463): the 16 info mark 6 before one sentence at 13, both in Ink 2, and at
 * 15 in a sheet below the phone's edge (#458). The mark stands on the sentence's first line.
 *
 * INK 2 BEHIND THE INFO MARK SINCE #495, WHERE IT WAS THE ALERT MARK IN RED. The design's
 * final files set a message about the whole dialog the way #148's had set a sign-in page's:
 * it is something the reader did not cause and cannot fix in place, and Red is kept for a
 * field's refusal, which is the reader's own value refused (0l, 0o). A sign-in page drew this
 * line in Red from #473 until #148 and draws its own in Ink 2 since.
 *
 * ITS ROLE STAYS `alert`, WHICH IS THIS APP'S RULE AND NOT THE DRAWING'S `status`. It answers
 * the reader's own press with a refusal, and the role says how that is heard, whatever ink the
 * drawing sets it in: a field's refusal and the phone's Notice are alerts for the same reason.
 *
 * `centered` IS A SIGN-IN STEP'S LINE (0o, #495): centered in the step's column from the
 * phone's edge up, and below it set left at 15 and 4 in, as the line under a code stands. The
 * steps drew it as a line of their own from #148, `role="status"` as the drawing has it, and
 * it moved here when a dialog came to draw the same line — the move a part shared by a second
 * screen waits on, as the Notice's did (#463).
 */
export function Refusal({ centered = false, children }) {
    return (
        <p
            role="alert"
            className={`flex items-start gap-refusal-gap text-body-sm text-foreground-muted ${
                centered
                    ? "justify-center max-sm:justify-start max-sm:gap-mobile-input-message-gap max-sm:px-mobile-input-message-inset-x max-sm:text-mobile-body-sm"
                    : "max-sm:in-data-[sheet]:text-mobile-body-sm"
            }`}
        >
            <span className="flex h-[var(--text-body-sm--line-height)] shrink-0 items-center">
                <InfoMark size="size-icon" />
            </span>
            <span>{children}</span>
        </p>
    );
}

// The hand under the pointer is `app/globals.css`'s, given to every button that acts and
// withheld from one disabled or `aria-disabled`, a busy or locked one among them (#501).
const BUTTON = "relative items-center justify-center whitespace-nowrap rounded-control font-ui font-semibold";

// 0a's Commitment, 36, and a sign-in page's action, 40 and its column's width — and below
// the phone's edge, the phone's 50 at 17 with its rounder corner (Tools 0a Button).
const BUTTON_SIZE = {
    lg: "inline-flex h-control-lg shrink-0 px-control-lg-inset-x text-body",
    xl: "flex h-control-xl w-full px-control-xl-inset-x text-body max-sm:h-mobile-button max-sm:rounded-mobile-control max-sm:text-mobile-heading",
};

// 0f: a filled action hovers to its Accent hover and keeps its white ink, and one that
// cannot act yet keeps its fill at 40% and takes no hover; a bordered one fills at Wash
// and leaves its Edge alone. A destructive commitment is filled red and hovers to Red's
// Accent hover (0f Destructive, 0d) — the retirement's (#458). A busy one of any kind takes
// no hover (0f Working), and neither does one locked with it (#469): both are
// `aria-disabled`, which is what the hover is written against. It is written against what is
// NOT disabled rather than what is enabled, so a link drawn as an action hovers too.
const BUTTON_VARIANT = {
    filled: "bg-primary text-white not-disabled:not-aria-disabled:hover:bg-primary-hover disabled:bg-primary-disabled",
    bordered: "border border-border bg-white text-foreground-default not-disabled:not-aria-disabled:hover:bg-hover-subtle",
    danger: "bg-danger text-white not-disabled:not-aria-disabled:hover:bg-danger-hover",
};

// In a sheet below the phone's edge (Tools 0a Button, #458): full width, 48, 17 at 600, at
// the phone's Radius; a filled one takes its hover fill while held, and a bordered one is a
// text button that dims to 0.5 while held ("Cancel under it as a text button") — neither
// while it is busy or locked, which takes no press.
const SHEET_BUTTON =
    "max-sm:in-data-[sheet]:h-mobile-dialog-button max-sm:in-data-[sheet]:w-full max-sm:in-data-[sheet]:rounded-mobile-control max-sm:in-data-[sheet]:text-mobile-heading";
const SHEET_BUTTON_VARIANT = {
    filled: "max-sm:in-data-[sheet]:not-aria-disabled:active:bg-primary-hover",
    bordered:
        "max-sm:in-data-[sheet]:border-0 max-sm:in-data-[sheet]:bg-transparent max-sm:in-data-[sheet]:not-aria-disabled:active:opacity-mobile-pressed",
    danger: "max-sm:in-data-[sheet]:not-aria-disabled:active:bg-danger-hover",
};

/**
 * 0f's spinner, in the ink of the label it stands for: 16, and the phone's 20 on a sign-in
 * page or in a sheet (Tools 0a Busy, #469).
 */
function Spinner({ size }) {
    return (
        <span
            aria-hidden="true"
            className={`block size-spinner shrink-0 animate-spinner rounded-full border-2 border-spinner-track border-t-current ${
                size === "xl" ? "max-sm:size-mobile-spinner" : "max-sm:in-data-[sheet]:size-mobile-spinner"
            }`}
        />
    );
}

/**
 * The words on an action, and what it shows while busy laid over them, so the action keeps
 * the width its words give it and does not move when one gives way to the other (0f). The
 * switch waits `--transition-delay-busy` either way it is entered and none on the way back,
 * and what is not shown is not read: an invisible label leaves the accessibility tree.
 *
 * AN ACTION AS WIDE AS ITS WORDS SHOWS THE SPINNER ALONE (0f Working, #495). It keeps its
 * resting width and the 16 spinner stands centered in its label's place, the `-ing` word for
 * assistive tech alone. An action that spans its column — a sign-in page's, at `xl` — shows
 * the spinner 8 before that word instead. Until #495 every action showed the word and held
 * at least its width, 0f's minimum width then: 1j's `min-width: 124px` for `Creating…`, which
 * a grid cell holding both labels reached from the words themselves (#469). The files of
 * 2026-10-05 took the minimum away with the word.
 *
 * BELOW THE PHONE'S EDGE THE SPINNER STANDS ALONE, on a sign-in step and in a sheet alike
 * (Tools 0a Busy, #469), at the phone's 20. #473 kept the desk's word in a sheet on the
 * reading that 0a draws Busy only for a step; a sheet's button is 0a's Button already — its
 * height, width and type are the phone's — and the design hands the app frame's Busy to the
 * phone (`docs/notes/design-system.md` has the argument).
 */
function ButtonLabel({ size, busyLabel, children }) {
    if (!busyLabel) return children;
    return (
        <>
            <span className="transition-[visibility] duration-0 group-data-busy/button:invisible group-data-busy/button:delay-busy">{children}</span>
            <span className="invisible absolute inset-0 flex items-center justify-center gap-gap transition-[visibility] duration-0 group-data-busy/button:visible group-data-busy/button:delay-busy">
                <Spinner size={size} />
                <span className={size === "xl" ? "max-sm:sr-only" : "sr-only"}>{busyLabel}</span>
            </span>
        </>
    );
}

/**
 * An action (0a's Commitment, 36, or `size="xl"`, a sign-in page's 40): `filled` for the
 * one a screen or a dialog exists for, `danger` for a dialog's commitment that cannot be
 * undone, `bordered` for the rest.
 *
 * A DISABLED ACTION SAYS WHY BEFORE IT, ON ITS OWN LINE (0f Disabled): the reason sits 14
 * before the button at 13 and Ink 3, and the button names it as its description, so a
 * screen reader reaching the control hears what stops it. That is the one place the rule
 * is drawn, so every opener that cannot act says so the same way.
 *
 * A BUSY ACTION IS NOT A DISABLED ONE (0f Working). `busy` keeps the fill, turns a press
 * away — a submit included, so a second press cannot send the form twice, and Enter in a
 * field cannot either, since the press it makes on the form's submit is turned away too —
 * and says it is busy to assistive tech; `busyLabel` is the `-ing` word it says once the
 * wait passes the delay. An action as wide as its words shows the spinner alone and keeps
 * that word for assistive tech, and one that spans its column, at `xl`, draws the word after
 * the spinner (#495); below the phone's edge, at `xl` and in a sheet, the spinner alone
 * stands in the label's place (Tools 0a Busy, #469). A `danger` commitment keeps its red
 * the same way.
 *
 * INSIDE A BUSY FORM IT NEEDS NO `busy` OF ITS OWN (#469): the form's submit is the one
 * working, and any other button is locked — `aria-disabled`, its look kept, its press turned
 * away — which is `lib/controls.js:buttonBusyState`'s answer to the two.
 *
 * `describedBy` IS A REASON DRAWN SOMEWHERE ELSE (#495): a selection bar sets its action's
 * reason in a column of its own that comes and goes with the bar's motion (0b), so the
 * button points at it rather than drawing one before itself.
 */
export function Button({ variant = "filled", size = "lg", type = "button", disabled = false, disabledReason, describedBy, busy = false, busyLabel, onClick, children }) {
    const reasonId = useId();
    const formBusy = useContext(FormBusyContext);
    const state = buttonBusyState({ busy, formBusy, submits: type === "submit", disabled });
    const working = state === "working";
    const explained = disabled && Boolean(disabledReason);
    const button = (
        <button
            type={type}
            disabled={disabled}
            onClick={state ? (event) => event.preventDefault() : onClick}
            aria-describedby={explained ? reasonId : describedBy}
            aria-busy={working || undefined}
            aria-disabled={state ? true : undefined}
            data-busy={working || undefined}
            className={`group/button ${BUTTON} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${SHEET_BUTTON} ${SHEET_BUTTON_VARIANT[variant]}`}
        >
            <ButtonLabel size={size} busyLabel={busyLabel}>
                {children}
            </ButtonLabel>
        </button>
    );
    if (!explained) return button;
    return (
        <span className="inline-flex items-center gap-gap-lg">
            <span id={reasonId} className="font-ui text-body-sm text-foreground-subtle">
                {disabledReason}
            </span>
            {button}
        </span>
    );
}

const FIELD_LABEL = "text-body-sm font-medium text-foreground-default max-sm:in-data-[sheet]:text-mobile-body-sm";
const FIELD_MESSAGE =
    "min-h-[var(--text-body-sm--line-height)] text-body-sm max-sm:in-data-[sheet]:min-h-[var(--text-mobile-body-sm--line-height)] max-sm:in-data-[sheet]:text-mobile-body-sm";

/**
 * A link drawn as an action, for the one place an action goes somewhere rather than doing
 * something — the sign-in screens' `Go to sign in` (#473). It is `Button`'s look and has
 * none of its states: a link is never disabled and never busy.
 */
export function ButtonLink({ variant = "filled", size = "lg", href, children }) {
    return (
        <Link href={href} className={`${BUTTON} ${BUTTON_SIZE[size]} ${BUTTON_VARIANT[variant]} ${SHEET_BUTTON} ${SHEET_BUTTON_VARIANT[variant]}`}>
            {children}
        </Link>
    );
}

/**
 * A labeled field and the line under it (0l Compact): the label at 13 and 500, 8 above
 * its control, and 6 under the control one line — a refusal about this field in red, or a
 * note at Ink 2, or its help at Ink 3, in that order of precedence.
 *
 * THE LINE SAT 8 UNDER THE CONTROL UNTIL #473, the label's 8 again, where 0l, the
 * registration dialog's own drawing and the sign-in screens all put it 6 under. It moved
 * to 6 when the sign-in screens took this field, so the dialog's lines rose by 2.
 *
 * `labelAs="span"` is for a control that is not a form element — a choice is a combobox
 * on a `div`, which a `<label>` cannot point at — and then the label is its name through
 * `aria-labelledby`, and pressing the label focuses the control, as a label would.
 * `reserveMessage` keeps the line's height while it is empty, for a field whose note comes
 * and goes as somebody types, so the dialog does not jump under their hand.
 *
 * `labelHidden` IS A FIELD ALONE ON ITS PAGE, NAMED BY THE SENTENCE ABOVE IT (0o): it shows
 * no label and keeps it for assistive tech, and its refusal is centered under it at a desk.
 * `size="xl"` is a sign-in page's field, which below the phone's edge takes the phone's
 * label at 15 and its refusal behind the alert mark, 4 in (Tools 0a Field label, Field error).
 */
export function Field({ label, labelAs = "label", labelHidden = false, size = "lg", help, note, refusal, reserveMessage = false, children }) {
    const base = useId();
    const control = `${base}control`;
    const labelId = `${base}label`;
    const messageId = `${base}message`;
    const said = refusal || note || help;
    const context = { control, labelId, messageId: said ? messageId : undefined, refused: Boolean(refusal) };
    const xl = size === "xl";
    const labelClass = labelHidden ? "sr-only" : `mb-gap ${FIELD_LABEL} ${xl ? "max-sm:text-mobile-body-sm" : ""}`;

    // In a sheet below the phone's edge a label is 15 at 500, still 8 above its field (Tools
    // 0a Field label), and what is said under it is 15 too (Beside) — #458.
    return (
        <FieldContext.Provider value={context}>
            <div className="flex min-w-0 flex-col">
                {labelAs === "label" ? (
                    <label id={labelId} htmlFor={control} className={labelClass}>
                        {label}
                    </label>
                ) : (
                    <span id={labelId} onClick={() => document.getElementById(control)?.focus()} className={labelClass}>
                        {label}
                    </span>
                )}
                {children}
                {(said || reserveMessage) && (
                    <div
                        id={messageId}
                        aria-live="polite"
                        className={`mt-input-message-stack ${FIELD_MESSAGE} ${labelHidden ? "text-center max-sm:text-left" : ""} ${
                            xl ? "max-sm:px-mobile-input-message-inset-x max-sm:text-mobile-body-sm" : ""
                        }`}
                    >
                        {refusal ? (
                            <p role="alert" className={`text-danger ${xl ? "max-sm:flex max-sm:gap-mobile-input-message-gap" : ""}`}>
                                {xl && (
                                    <span className="hidden h-[var(--text-mobile-body-sm--line-height)] items-center max-sm:flex">
                                        <AlertMark />
                                    </span>
                                )}
                                <span>{refusal}</span>
                            </p>
                        ) : note ? (
                            <p className="text-foreground-muted">{note}</p>
                        ) : help ? (
                            <p className="text-foreground-subtle tabular-nums">{help}</p>
                        ) : null}
                    </div>
                )}
            </div>
        </FieldContext.Provider>
    );
}

const TEXT_INPUT_SIZE = {
    lg: "h-control-lg px-control-lg-inset-x text-body",
    xl: "h-control-xl px-control-xl-inset-x text-body max-sm:h-mobile-input max-sm:gap-mobile-input-gap max-sm:rounded-mobile-control max-sm:px-mobile-input-inset-x max-sm:text-mobile-body",
};

/**
 * A text field (0f Field): white on an Edge border, Edge focus while it holds the caret,
 * red while its field refuses it, the caret in Accent. `onChange` is handed the value.
 *
 * A `suffix` IS FIXED BESIDE WHAT IS TYPED (#473): the sign-in's email field takes only the
 * part before the company's domain and shows the domain here. At a desk it sits at the
 * field's right end, 12 inside its edge (0o); on a phone it follows the typed words with no
 * space between, so the field reads as the address being written (Tools 0a Email) — the
 * typed words are measured by an unseen copy of them, since an input does not size itself
 * to its value. It is the field's description beside any line under it, so assistive tech
 * reads the domain with the field. The caller leaves it out when the field may not show it.
 *
 * AT `xl`, BELOW THE PHONE'S EDGE, A FIELD THAT HOLDS A VALUE CARRIES A CLEAR × AT ITS END
 * (Tools 0a Field), its target the least a touch target takes and pulled into the field's
 * own room as the drawings place it. A read-only field — one whose form is busy — has none.
 * A field inside a busy form is read-only whatever its caller says (#469).
 */
export function TextInput({ size = "lg", suffix, value, onChange, readOnly = false, inputRef, placeholder, ...input }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const locked = readOnly || formBusy;
    const ownRef = useRef(null);
    const ref = inputRef ?? ownRef;
    const suffixId = `${field.control}suffix`;
    const describedBy = [field.messageId, suffix ? suffixId : null].filter(Boolean).join(" ") || undefined;
    const clearable = size === "xl" && !locked && value !== "";

    return (
        <div
            onClick={() => ref.current?.focus()}
            className={`flex min-w-0 cursor-text items-center rounded-control bg-white inset-ring ${
                field.refused ? "inset-ring-danger" : "inset-ring-border focus-within:inset-ring-border-focus"
            } ${TEXT_INPUT_SIZE[size]}`}
        >
            <span className={`grid min-w-0 ${suffix ? "flex-1 max-sm:flex-initial" : "flex-1"}`}>
                {suffix && (
                    <span aria-hidden="true" className="invisible col-start-1 row-start-1 overflow-hidden whitespace-pre">
                        {value || placeholder}
                    </span>
                )}
                <input
                    ref={ref}
                    id={field.control}
                    type="text"
                    size={1}
                    value={value}
                    placeholder={placeholder}
                    onChange={(event) => onChange(event.target.value)}
                    readOnly={locked}
                    aria-describedby={describedBy}
                    aria-invalid={field.refused || undefined}
                    className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-foreground-default caret-primary outline-none placeholder:text-foreground-subtle"
                    {...input}
                />
            </span>
            {suffix && (
                <span id={suffixId} className="shrink-0 whitespace-nowrap text-foreground-subtle max-sm:-ml-mobile-input-gap">
                    {suffix}
                </span>
            )}
            {clearable && (
                <ClearButton
                    onClear={() => {
                        onChange("");
                        ref.current?.focus();
                    }}
                />
            )}
        </div>
    );
}

/** A phone field's clear × (Tools 0a Field): drawn below the phone's edge only, and a text button's press. */
function ClearButton({ onClear }) {
    return (
        <button
            type="button"
            aria-label={COPY.clear}
            onClick={(event) => {
                event.stopPropagation();
                onClear();
            }}
            className="-mr-[calc(var(--spacing-mobile-input-inset-x)-var(--spacing-mobile-input-clear-inset-right))] ml-auto hidden size-mobile-touch-target shrink-0 items-center justify-center text-foreground-subtle active:opacity-mobile-pressed max-sm:inline-flex"
        >
            <Icon name="x" className="size-mobile-input-clear-icon" />
        </button>
    );
}

/**
 * Part of a note that names something the note is about — a tool, a count — in Ink
 * rather than the note's Ink 2 (1j's preview under a typed name).
 */
export function NoteEmphasis({ children }) {
    return <span className="text-foreground-default tabular-nums">{children}</span>;
}

/**
 * A field on a phone that one of 1f's sheets sets (Tools 0a Field, #458): it shows what was
 * chosen, or its placeholder at Ink 3, and a press opens the sheet that chooses. 50 tall,
 * 16 inside, its value at 16, white with an Edge border at the phone's Radius, as every form
 * field rests (0f); a chevron says it opens a list. With no `onOpen` it states its value and
 * takes no press — 1f draws one job that way, for a person on one assignment.
 *
 * IT IS DRAWN BELOW THE PHONE'S EDGE AND NOWHERE ELSE, so its caller draws the desk's control
 * beside it with `max-sm:hidden`. It takes its name from the field around it and its own
 * value, so a screen reader hears `Job, 26-DEMO-01` and not the value alone; the id the label
 * points at stays the desk control's. Inside a busy form it opens nothing (#469).
 *
 * AN `icon` STANDS 10 BEFORE ITS VALUE, AT 18 IN INK 3 (Tools 0a Field: "an 18 icon 10
 * before it unless the field carries a label") — the foot bar's name field, whose label is
 * for assistive tech alone (#463). There its placeholder is the label's own words, so while
 * it holds nothing it is named by the label alone rather than by the same words twice. A
 * field that refuses takes the Red edge (Tools 0a Field error), the line under it its
 * `Field`'s.
 */
export function SheetField({ value, placeholder, onOpen, chevron = false, icon }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const valueId = useId();
    const look = `flex h-mobile-input w-full items-center gap-mobile-input-gap rounded-mobile-control border bg-white px-mobile-input-inset-x text-mobile-body sm:hidden ${
        field.refused ? "border-danger" : "border-border"
    } ${icon ? "" : "justify-between"}`;
    const said = (
        <span id={valueId} className={`min-w-0 truncate ${icon ? "flex-1" : ""} ${value ? "text-foreground-default" : "text-foreground-subtle"}`}>
            {value || placeholder}
        </span>
    );
    const mark = icon && <span className="flex size-mobile-input-icon shrink-0 items-center justify-center text-foreground-subtle">{icon}</span>;
    if (!onOpen) {
        return (
            <div className={look}>
                {mark}
                {said}
            </div>
        );
    }
    const named = icon && !value ? field.labelId : field.labelId ? `${field.labelId} ${valueId}` : valueId;
    return (
        <button
            type="button"
            aria-haspopup="dialog"
            aria-labelledby={named}
            aria-describedby={field.messageId}
            aria-disabled={formBusy || undefined}
            onClick={formBusy ? undefined : onOpen}
            className={`${look} text-left outline-none ${field.refused ? "" : "focus-visible:border-border-focus"} not-aria-disabled:active:bg-hover-subtle`}
        >
            {mark}
            {said}
            {chevron && <Icon name="chevron-down" className="size-icon-sm shrink-0 text-foreground-subtle" />}
        </button>
    );
}

/**
 * Tools 0a's Pill as a field (#463) — the foot bar's job: 36 tall and round, 14 inside, an
 * Edge border on no ground, its icon 8 before its value at 15, and a chevron 12 inside its end
 * when a press opens the sheet that chooses. With no `onOpen` it states its value and takes
 * no press, which is the one job of a person on one assignment (1f-b).
 *
 * ITS TARGET IS TALLER THAN ITS PILL: it reaches up into the bar's room above it, as 1f
 * draws it, so a press anywhere in the 52 above the pill's foot opens it — more than the 48
 * the phone's Target asks for, without the pill growing. Held, it takes the Wash, which is
 * what any control but a text button does under a press (Tools 0a Field). It is named by the
 * field around it and its value, and inside a busy form it opens nothing (#469).
 */
export function SheetChip({ value, placeholder, onOpen, icon }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const valueId = useId();
    const pill = `inline-flex h-mobile-chip max-w-full items-center gap-gap rounded-full border pl-mobile-chip-inset-x text-mobile-body-sm ${
        onOpen ? "pr-mobile-chip-inset-right" : "pr-mobile-chip-inset-x"
    } ${field.refused ? "border-danger" : "border-border"}`;
    const content = (
        <>
            <span className="flex size-icon-sm shrink-0 items-center justify-center text-foreground-subtle">{icon}</span>
            <span id={valueId} className={`min-w-0 truncate ${value ? "text-foreground-default" : "text-foreground-subtle"}`}>
                {value || placeholder}
            </span>
        </>
    );
    if (!onOpen) {
        return (
            <div className="flex sm:hidden">
                <span className={pill}>{content}</span>
            </div>
        );
    }
    return (
        <div className="flex sm:hidden">
            <button
                type="button"
                aria-haspopup="dialog"
                aria-labelledby={field.labelId ? `${field.labelId} ${valueId}` : valueId}
                aria-describedby={field.messageId}
                aria-disabled={formBusy || undefined}
                onClick={formBusy ? undefined : onOpen}
                className="group/chip -mt-mobile-bottom-bar-inset-top inline-flex max-w-full pt-mobile-bottom-bar-inset-top text-left outline-none [&:not([aria-disabled]):active>span]:bg-hover-subtle"
            >
                <span className={`${pill} ${field.refused ? "" : "group-focus-visible/chip:border-border-focus"}`}>
                    {content}
                    <Icon name="chevron-down" className="size-mobile-chip-chevron shrink-0 text-foreground-subtle" />
                </span>
            </button>
        </div>
    );
}

/**
 * A row's box (0b, 1b; #463): 16 at the Badge radius in a 32 target that gives its room back,
 * so the box keeps the 16 column it is drawn in and a row's text stays where it was. Empty,
 * it is white on an Ink 5 edge and takes the Wash under the pointer; checked, the Accent with
 * a white check, and mixed — some of a page — the Accent with a dash, both going to the
 * Accent hover under the pointer.
 *
 * A NATIVE CHECKBOX UNDER THE DRAWING, where the design's is a button with a checkbox's
 * role. The browser already says checked, unchecked and mixed, toggles on Space and joins a
 * form, so what is drawn over it is the look alone; `indeterminate` is a property with no
 * attribute and is set on the element. It stands above a row whose link covers the row
 * (`ListTable.js`), so a press on the box selects rather than opening the row — above it
 * within the row, a stacking context of its own, so the box never rises over the column
 * head its row scrolls under (#501). It is named by `label`, since a box in a column
 * carries no words of its own.
 */
export function Checkbox({ label, checked, indeterminate = false, onChange }) {
    return (
        <label className="group/checkbox relative z-10 -mx-[calc((var(--height-control)-var(--size-icon))/2)] -my-[calc((var(--height-control)-var(--text-body--line-height))/2)] flex aspect-square h-control shrink-0 cursor-pointer items-center justify-center self-center rounded-control">
            <input
                type="checkbox"
                aria-label={label}
                checked={checked}
                onChange={onChange}
                ref={(box) => {
                    if (box) box.indeterminate = indeterminate;
                }}
                className="peer size-icon cursor-pointer appearance-none rounded-badge border border-checkbox-border bg-white group-hover/checkbox:bg-[linear-gradient(var(--color-hover-subtle),var(--color-hover-subtle))] checked:border-primary checked:bg-primary group-hover/checkbox:checked:border-primary-hover group-hover/checkbox:checked:bg-primary-hover indeterminate:border-primary indeterminate:bg-primary group-hover/checkbox:indeterminate:border-primary-hover group-hover/checkbox:indeterminate:bg-primary-hover"
            />
            <Icon name="check" className="pointer-events-none absolute hidden size-checkbox-mark text-white peer-checked:block" />
            <Icon name="minus" className="pointer-events-none absolute hidden size-checkbox-mark text-white peer-indeterminate:block" />
        </label>
    );
}

const STEP =
    "flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-control text-foreground-muted not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground-default";

/**
 * A number field with its steps (0f Field): 120 wide, a 30 − and + inside it 3 from its
 * ends, the figure centered between them, and every edge the form field's — white, an Edge
 * ring, Edge focus while it holds the caret, red while it refuses. The steps are the one
 * control inside another that fills at Hover as well as changing its ink (0f Nested).
 *
 * The figure is text rather than `type="number"`, as the design draws it: the browser's
 * own spinner and its own refusal bubble are neither this app's nor the design's, so what
 * a count may be is `lib/toolRegistration.js:readQuantity`'s to say in the field's own
 * line. What it keeps of a keystroke and what a step does are `lib/controls.js`'s. Inside a
 * busy form the figure is read-only and the steps take no press (#469).
 */
export function NumberField({ name, value, onChange, min, max }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const step = (delta) => () => {
        if (!formBusy) onChange(stepNumber(value, delta, { min, max }));
    };
    return (
        <div
            className={`flex h-control-lg w-number-input items-center rounded-control bg-white px-stepper-inset-x inset-ring ${
                field.refused ? "inset-ring-danger" : "inset-ring-border focus-within:inset-ring-border-focus"
            }`}
        >
            <button type="button" aria-label={COPY.fewer} aria-disabled={formBusy || undefined} onClick={step(-1)} className={STEP}>
                <Icon name="minus" className="size-icon-sm" />
            </button>
            <input
                id={field.control}
                name={name}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={(event) => onChange(numberFieldText(event.target.value, max))}
                readOnly={formBusy}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                className="h-control-sm min-w-0 flex-1 bg-transparent text-center text-body tabular-nums text-foreground-default caret-primary outline-none"
            />
            <button type="button" aria-label={COPY.more} aria-disabled={formBusy || undefined} onClick={step(1)} className={STEP}>
                <Icon name="plus" className="size-icon-sm" />
            </button>
        </div>
    );
}

/** How long a typed search goes on collecting keys before it starts again. */
const TYPEAHEAD_MS = 500;

/**
 * A choice among fixed options — WAI-ARIA's select-only combobox, opening `Menu` (0l: "a
 * choice is the bordered list with its chevron").
 *
 * DOM FOCUS STAYS ON THE COMBOBOX and `aria-activedescendant` names the option under
 * visual focus, which is the pattern; `lib/controls.js:selectOnlyKey` says what each key
 * does and this applies it. Leaving it with the list open chooses what is under visual
 * focus and closes it, as the pattern does with a blur, and Escape closes it choosing
 * nothing — and stops there, so a dialog around it stays open.
 *
 * WITH ONE OPTION IT IS ALREADY CHOSEN, AND WITH SEVERAL IT STARTS EMPTY (0l): that is the
 * caller's `value`, and the placeholder is what it shows while nothing is chosen, at Ink 3.
 * What submits is the hidden input under `name`, carrying the chosen option's value.
 *
 * INSIDE A BUSY FORM IT IS READ-ONLY (#469): it keeps focus and its look, and no key and no
 * press opens it or changes what it holds. Tab still leaves.
 */
export function Choice({ name, options, value, onChange, placeholder }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const listId = `${field.control}list`;
    const chosen = options.findIndex((option) => option.value === value);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(chosen);
    const anchorRef = useRef(null);
    const search = useRef({ text: "", timer: null });

    const choose = (index) => {
        if (index >= 0 && index < options.length) onChange(options[index].value);
    };
    const show = () => {
        setActive(chosen);
        setOpen(true);
    };

    const onKeyDown = (event) => {
        if (formBusy) return;
        const action = selectOnlyKey(event, open);
        if (!action) return;
        event.preventDefault();
        switch (action) {
            case "open":
                show();
                return;
            case "first":
            case "last":
            case "next":
            case "previous":
            case "pageUp":
            case "pageDown":
                if (!open) setOpen(true);
                setActive(movedIndex(open ? active : chosen, options.length - 1, action));
                return;
            case "closeSelect":
                choose(active);
                setOpen(false);
                return;
            case "close":
                event.stopPropagation();
                setOpen(false);
                return;
            case "type": {
                const typed = search.current;
                window.clearTimeout(typed.timer);
                typed.text = event.key.length === 1 ? typed.text + event.key : "";
                typed.timer = window.setTimeout(() => {
                    typed.text = "";
                }, TYPEAHEAD_MS);
                if (!open) setOpen(true);
                const found = typeaheadIndex(
                    options.map((option) => option.label),
                    typed.text,
                    (open ? active : chosen) + 1
                );
                if (found >= 0) setActive(found);
                return;
            }
            default:
                return;
        }
    };

    return (
        <div className="relative min-w-0">
            <div
                ref={anchorRef}
                id={field.control}
                role="combobox"
                tabIndex={0}
                aria-controls={listId}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-labelledby={field.labelId}
                aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                aria-readonly={formBusy || undefined}
                onKeyDown={onKeyDown}
                onClick={() => {
                    if (formBusy) return;
                    if (open) setOpen(false);
                    else show();
                }}
                onBlur={() => {
                    if (!open) return;
                    choose(active);
                    setOpen(false);
                }}
                className={`flex h-control-lg w-full cursor-pointer items-center justify-between gap-gap rounded-control border bg-white px-control-lg-inset-x text-body font-medium outline-none aria-readonly:cursor-default not-aria-readonly:hover:bg-hover-subtle ${
                    field.refused ? "border-danger" : "border-border focus:border-border-focus"
                }`}
            >
                <span className={`min-w-0 truncate ${chosen >= 0 ? "text-foreground-default" : "text-foreground-subtle"}`}>
                    {chosen >= 0 ? options[chosen].label : placeholder}
                </span>
                <Icon name="chevron-down" className="size-icon-sm shrink-0 text-foreground-subtle" />
            </div>
            <input type="hidden" name={name} value={value} />
            <Menu
                id={listId}
                anchorRef={anchorRef}
                shown={open}
                labelId={field.labelId}
                options={options.map((option, index) => ({
                    key: option.value,
                    label: option.label,
                    selected: index === chosen,
                    checked: index === chosen,
                }))}
                active={active}
                onPick={(index) => {
                    choose(index);
                    setOpen(false);
                }}
            />
        </div>
    );
}

/**
 * A typed value with suggestions under it — WAI-ARIA's editable combobox with list
 * autocomplete and manual selection, opening `Menu`.
 *
 * WHAT IT SUGGESTS IS THE CALLER'S, AND SO IS WHETHER THE LIST MAY SHOW. The caller hands
 * over the suggestions for what is typed now, and holds `listOpen`, which this asks to
 * change as focus arrives and leaves, as somebody types and as Escape or a pick shuts it —
 * so the caller knows when the list is on screen and can say something else in its place.
 * The list shows when it is open and there is something in it. Typing never selects a
 * suggestion: Down and Up move visual focus into the list, and Enter, Tab or a press
 * accepts one, which is the pattern's manual selection; `editableComboboxKey` says what
 * each key does. `heading` is a word the list carries above its suggestions — the
 * check-out's `Recently at this job` (#458), the same words as the name sheet a phone
 * types in — and a suggestion's `match` the part of it what is typed matched, set at 600
 * (#495). Inside a busy form it is read-only and its list does not show (#469).
 */
export function Combobox({ name, value, onChange, suggestions, heading, placeholder, listOpen, onListOpenChange }) {
    const field = useField();
    const formBusy = useContext(FormBusyContext);
    const listId = `${field.control}list`;
    const [active, setActive] = useState(-1);
    const anchorRef = useRef(null);
    const shown = listOpen && suggestions.length > 0 && !formBusy;

    const accept = (index) => {
        onChange(suggestions[index].label);
        setActive(-1);
        onListOpenChange(false);
    };

    const onKeyDown = (event) => {
        if (formBusy) return;
        const answer = editableComboboxKey(event, { shown, active, count: suggestions.length });
        if (!answer) return;
        if (answer.stop) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (answer.accept !== undefined) {
            accept(answer.accept);
            return;
        }
        setActive(answer.active);
        onListOpenChange(answer.shown);
    };

    return (
        <>
            <input
                ref={anchorRef}
                id={field.control}
                name={name}
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={shown}
                aria-controls={listId}
                aria-activedescendant={shown && active >= 0 ? `${listId}-${active}` : undefined}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                readOnly={formBusy}
                onChange={(event) => {
                    onChange(event.target.value);
                    setActive(-1);
                    onListOpenChange(true);
                }}
                onFocus={() => {
                    if (!formBusy) onListOpenChange(true);
                }}
                onBlur={() => {
                    setActive(-1);
                    onListOpenChange(false);
                }}
                onKeyDown={onKeyDown}
                className={`h-control-lg w-full rounded-control bg-white px-control-lg-inset-x text-body text-foreground-default caret-primary outline-none inset-ring placeholder:text-foreground-subtle ${
                    field.refused ? "inset-ring-danger" : "inset-ring-border focus:inset-ring-border-focus"
                }`}
            />
            <Menu
                id={listId}
                anchorRef={anchorRef}
                shown={shown}
                labelId={field.labelId}
                heading={heading}
                options={suggestions.map((suggestion, index) => ({
                    key: suggestion.label,
                    label: suggestion.label,
                    match: suggestion.match,
                    detail: suggestion.detail,
                    selected: index === active,
                }))}
                active={active}
                onPick={accept}
            />
        </>
    );
}
