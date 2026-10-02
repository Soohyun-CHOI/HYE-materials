"use client";

import Link from "next/link";
import { createContext, useContext, useId, useRef, useState } from "react";
import {
    CONTROLS_COPY as COPY,
    editableComboboxKey,
    movedIndex,
    numberFieldText,
    selectOnlyKey,
    stepNumber,
    typeaheadIndex,
} from "@/lib/controls";
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
 * a spinner before the work's own `-ing` word — the delay is a name and the switch is CSS,
 * so an answer inside it changes nothing on the screen. Its caller says when it is busy and
 * what that word is, and locks the rest of its form; the sign-in screens are the first
 * caller, and the dialogs take it when #469 hands their frame the same state.
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
 * and shows what the sheet chose.
 */

const FieldContext = createContext(null);

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
 * stands before (0l Actions, 0o, Tools 0a Field error). It was the dialog frame's own until
 * #473, when the sign-in screens drew the same mark before their refusals.
 */
function AlertMark() {
    return (
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true" className="size-icon shrink-0">
            <circle cx="9" cy="9" r="7.3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 5.2v4.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="9" cy="12.6" r="1" fill="currentColor" />
        </svg>
    );
}

/**
 * A refusal about the whole of what a form asks — a dialog's (0l Actions) or a sign-in
 * page's (0o Refusal): the alert mark 8 before one sentence at 13, both in Red, and at 15 in
 * a sheet below the phone's edge (#458). The two were drawn alike and are one component
 * since #473; a sign-in page centers it under its fields.
 */
export function Refusal({ align = "start", children }) {
    return (
        <p
            role="alert"
            className={`flex items-center gap-gap text-body-sm text-danger max-sm:in-data-[sheet]:text-mobile-body-sm ${align === "center" ? "justify-center" : ""}`}
        >
            <AlertMark />
            <span>{children}</span>
        </p>
    );
}

const BUTTON = "items-center justify-center whitespace-nowrap rounded-control font-ui font-semibold disabled:cursor-default data-busy:cursor-default";

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
// no hover (0f Working), and the hover is written against what is NOT disabled rather than
// what is enabled, so a link drawn as an action hovers too.
const BUTTON_VARIANT = {
    filled: "bg-primary text-white not-disabled:not-data-busy:hover:bg-primary-hover disabled:bg-primary-disabled",
    bordered: "border border-border bg-white text-foreground-default not-disabled:not-data-busy:hover:bg-hover-subtle",
    danger: "bg-danger text-white not-disabled:not-data-busy:hover:bg-danger-hover",
};

// In a sheet below the phone's edge (Tools 0a Button, #458): full width, 48, 17 at 600, at
// the phone's Radius; a filled one takes its hover fill while held, and a bordered one is a
// text button that dims to 0.5 while held ("Cancel under it as a text button") — neither
// while it is busy, which takes no press.
const SHEET_BUTTON =
    "max-sm:in-data-[sheet]:h-mobile-dialog-button max-sm:in-data-[sheet]:w-full max-sm:in-data-[sheet]:rounded-mobile-control max-sm:in-data-[sheet]:text-mobile-heading";
const SHEET_BUTTON_VARIANT = {
    filled: "max-sm:in-data-[sheet]:not-data-busy:active:bg-primary-hover",
    bordered:
        "max-sm:in-data-[sheet]:border-0 max-sm:in-data-[sheet]:bg-transparent max-sm:in-data-[sheet]:not-data-busy:active:opacity-mobile-pressed",
    danger: "max-sm:in-data-[sheet]:not-data-busy:active:bg-danger-hover",
};

/** 0f's spinner, in the ink of the label it stands for: 16, and the phone's 20 on a sign-in page. */
function Spinner({ size }) {
    return (
        <span
            aria-hidden="true"
            className={`block size-spinner shrink-0 animate-spinner rounded-full border-2 border-spinner-track border-t-current ${
                size === "xl" ? "max-sm:size-mobile-spinner" : ""
            }`}
        />
    );
}

/**
 * The words on an action, and the ones it says while busy, laid in one cell so the action
 * is as wide as the wider of the two and does not move when one gives way to the other (0f).
 * The switch waits `--transition-delay-busy` either way it is entered and none on the way
 * back, and what is not shown is not read: an invisible label leaves the accessibility tree.
 */
function ButtonLabel({ size, busyLabel, children }) {
    if (!busyLabel) return children;
    return (
        <span className="grid">
            <span className="col-start-1 row-start-1 transition-[visibility] duration-0 group-data-busy/button:invisible group-data-busy/button:delay-busy">
                {children}
            </span>
            <span className="invisible col-start-1 row-start-1 flex items-center justify-center gap-gap transition-[visibility] duration-0 group-data-busy/button:visible group-data-busy/button:delay-busy">
                <Spinner size={size} />
                <span className={size === "xl" ? "max-sm:sr-only" : undefined}>{busyLabel}</span>
            </span>
        </span>
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
 * away — a submit included, so a second press cannot send the form twice — and says it is
 * busy to assistive tech; `busyLabel` is the `-ing` word it shows once the wait passes the
 * delay. On a phone at `xl` the spinner alone stands in the label's place (Tools 0a Busy),
 * and the word stays for assistive tech. A `danger` commitment keeps its red the same way,
 * and in a sheet an action keeps 0f's spinner and word: Tools 0a draws a busy action on a
 * step page and in no sheet.
 */
export function Button({ variant = "filled", size = "lg", type = "button", disabled = false, disabledReason, busy = false, busyLabel, onClick, children }) {
    const reasonId = useId();
    const explained = disabled && Boolean(disabledReason);
    const button = (
        <button
            type={type}
            disabled={disabled}
            onClick={busy ? (event) => event.preventDefault() : onClick}
            aria-describedby={explained ? reasonId : undefined}
            aria-busy={busy || undefined}
            aria-disabled={busy || undefined}
            data-busy={busy || undefined}
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
 */
export function TextInput({ size = "lg", suffix, value, onChange, readOnly = false, inputRef, placeholder, ...input }) {
    const field = useField();
    const ownRef = useRef(null);
    const ref = inputRef ?? ownRef;
    const suffixId = `${field.control}suffix`;
    const describedBy = [field.messageId, suffix ? suffixId : null].filter(Boolean).join(" ") || undefined;
    const clearable = size === "xl" && !readOnly && value !== "";

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
                    readOnly={readOnly}
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
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-mobile-input-clear-icon">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
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
 * points at stays the desk control's.
 */
export function SheetField({ value, placeholder, onOpen, chevron = false }) {
    const field = useField();
    const valueId = useId();
    const look =
        "flex h-mobile-input w-full items-center justify-between gap-gap rounded-mobile-control border border-border bg-white px-mobile-input-inset-x text-mobile-body sm:hidden";
    const said = (
        <span id={valueId} className={`min-w-0 truncate ${value ? "text-foreground-default" : "text-foreground-subtle"}`}>
            {value || placeholder}
        </span>
    );
    if (!onOpen) {
        return <div className={look}>{said}</div>;
    }
    return (
        <button
            type="button"
            aria-haspopup="dialog"
            aria-labelledby={field.labelId ? `${field.labelId} ${valueId}` : valueId}
            onClick={onOpen}
            className={`${look} text-left outline-none focus-visible:border-border-focus active:bg-hover-subtle`}
        >
            {said}
            {chevron && (
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm shrink-0 text-foreground-subtle">
                    <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}

const STEP =
    "flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-control text-foreground-muted hover:bg-hover hover:text-foreground-default";

/**
 * A number field with its steps (0f Field): 120 wide, a 30 − and + inside it 3 from its
 * ends, the figure centered between them, and every edge the form field's — white, an Edge
 * ring, Edge focus while it holds the caret, red while it refuses. The steps are the one
 * control inside another that fills at Hover as well as changing its ink (0f Nested).
 *
 * The figure is text rather than `type="number"`, as the design draws it: the browser's
 * own spinner and its own refusal bubble are neither this app's nor the design's, so what
 * a count may be is `lib/toolRegistration.js:readQuantity`'s to say in the field's own
 * line. What it keeps of a keystroke and what a step does are `lib/controls.js`'s.
 */
export function NumberField({ name, value, onChange, min, max }) {
    const field = useField();
    return (
        <div
            className={`flex h-control-lg w-number-input items-center rounded-control bg-white px-stepper-inset inset-ring ${
                field.refused ? "inset-ring-danger" : "inset-ring-border focus-within:inset-ring-border-focus"
            }`}
        >
            <button type="button" aria-label={COPY.fewer} onClick={() => onChange(stepNumber(value, -1, { min, max }))} className={STEP}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm">
                    <path d="M3.5 8h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
            </button>
            <input
                id={field.control}
                name={name}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={(event) => onChange(numberFieldText(event.target.value, max))}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                className="h-control-sm min-w-0 flex-1 bg-transparent text-center text-body tabular-nums text-foreground-default caret-primary outline-none"
            />
            <button type="button" aria-label={COPY.more} onClick={() => onChange(stepNumber(value, 1, { min, max }))} className={STEP}>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm">
                    <path d="M3.5 8h9M8 3.5v9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
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
 */
export function Choice({ name, options, value, onChange, placeholder }) {
    const field = useField();
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
                onKeyDown={onKeyDown}
                onClick={() => (open ? setOpen(false) : show())}
                onBlur={() => {
                    if (!open) return;
                    choose(active);
                    setOpen(false);
                }}
                className={`flex h-control-lg w-full cursor-pointer items-center justify-between gap-gap rounded-control border bg-white px-control-lg-inset-x text-body font-medium outline-none hover:bg-hover-subtle ${
                    field.refused ? "border-danger" : "border-border focus:border-border-focus"
                }`}
            >
                <span className={`min-w-0 truncate ${chosen >= 0 ? "text-foreground-default" : "text-foreground-subtle"}`}>
                    {chosen >= 0 ? options[chosen].label : placeholder}
                </span>
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-icon-sm shrink-0 text-foreground-subtle">
                    <path d="M4 6.5 8 10.5l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
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
 * types in.
 */
export function Combobox({ name, value, onChange, suggestions, heading, placeholder, listOpen, onListOpenChange }) {
    const field = useField();
    const listId = `${field.control}list`;
    const [active, setActive] = useState(-1);
    const anchorRef = useRef(null);
    const shown = listOpen && suggestions.length > 0;

    const accept = (index) => {
        onChange(suggestions[index].label);
        setActive(-1);
        onListOpenChange(false);
    };

    const onKeyDown = (event) => {
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
                onChange={(event) => {
                    onChange(event.target.value);
                    setActive(-1);
                    onListOpenChange(true);
                }}
                onFocus={() => onListOpenChange(true)}
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
                    detail: suggestion.detail,
                    selected: index === active,
                }))}
                active={active}
                onPick={accept}
            />
        </>
    );
}
