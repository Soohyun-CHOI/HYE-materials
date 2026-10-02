"use client";

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
 * `app/(tools)/` calls may do that — `offline/design-values.mjs` walks the import graph,
 * so a screen above the tools axis importing one of these fails it wherever the file sits.
 * **The materials screens keep their own controls until then**, and one of them is the
 * same kind of thing: `app/admin/disciplines/new/JobCombobox.js` is a searchable combobox
 * written for that form alone, unstyled, with keys of its own. #258 is where the screens
 * above this axis take these controls, and it is the condition for that one going too.
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
 */
function useField() {
    const own = useId();
    return useContext(FieldContext) ?? { control: `${own}control`, labelId: undefined, messageId: undefined, refused: false };
}

const BUTTON = "inline-flex h-control-lg shrink-0 items-center justify-center whitespace-nowrap rounded-control px-control-lg-inset-x font-ui text-body font-semibold disabled:cursor-default";

// 0f: a filled action hovers to its Accent hover and keeps its white ink, and one that
// cannot act yet keeps its fill at 40% and takes no hover; a bordered one fills at Wash
// and leaves its Edge alone. A destructive commitment is filled red and hovers to Red's
// Accent hover (0f Destructive, 0d) — the retirement's (#458).
const BUTTON_VARIANT = {
    filled: "bg-primary text-white enabled:hover:bg-primary-hover disabled:bg-primary-disabled",
    bordered: "border border-border bg-white text-foreground-default enabled:hover:bg-hover-subtle",
    danger: "bg-danger text-white enabled:hover:bg-danger-hover",
};

// In a sheet below the phone's edge (Tools 0a Button, #458): full width, 48, 17 at 600, at
// the phone's Radius; a filled one takes its hover fill while held, and a bordered one is a
// text button that dims to 0.5 while held ("Cancel under it as a text button").
const SHEET_BUTTON =
    "max-sm:in-data-[sheet]:h-mobile-dialog-button max-sm:in-data-[sheet]:w-full max-sm:in-data-[sheet]:rounded-mobile-control max-sm:in-data-[sheet]:text-mobile-heading";
const SHEET_BUTTON_VARIANT = {
    filled: "max-sm:in-data-[sheet]:active:bg-primary-hover",
    bordered:
        "max-sm:in-data-[sheet]:border-0 max-sm:in-data-[sheet]:bg-transparent max-sm:in-data-[sheet]:active:opacity-mobile-pressed",
    danger: "max-sm:in-data-[sheet]:active:bg-danger-hover",
};

/**
 * An action (0a's Commitment, 36): `filled` for the one a screen or a dialog exists for,
 * `danger` for a dialog's commitment that cannot be undone, `bordered` for the rest.
 *
 * A DISABLED ACTION SAYS WHY BEFORE IT, ON ITS OWN LINE (0f Disabled): the reason sits 14
 * before the button at 13 and Ink 3, and the button names it as its description, so a
 * screen reader reaching the control hears what stops it. That is the one place the rule
 * is drawn, so every opener that cannot act says so the same way.
 */
export function Button({ variant = "filled", type = "button", disabled = false, disabledReason, onClick, children }) {
    const reasonId = useId();
    const explained = disabled && Boolean(disabledReason);
    const button = (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            aria-describedby={explained ? reasonId : undefined}
            className={`${BUTTON} ${BUTTON_VARIANT[variant]} ${SHEET_BUTTON} ${SHEET_BUTTON_VARIANT[variant]}`}
        >
            {children}
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
 * A labeled field and the line under it (0l Compact): the label at 13 and 500, 8 above
 * its control, and under the control one line — a refusal about this field in red, or a
 * note at Ink 2, or its help at Ink 3, in that order of precedence.
 *
 * `labelAs="span"` is for a control that is not a form element — a choice is a combobox
 * on a `div`, which a `<label>` cannot point at — and then the label is its name through
 * `aria-labelledby`, and pressing the label focuses the control, as a label would.
 * `reserveMessage` keeps the line's height while it is empty, for a field whose note comes
 * and goes as somebody types, so the dialog does not jump under their hand.
 */
export function Field({ label, labelAs = "label", help, note, refusal, reserveMessage = false, children }) {
    const base = useId();
    const control = `${base}control`;
    const labelId = `${base}label`;
    const messageId = `${base}message`;
    const said = refusal || note || help;
    const context = { control, labelId, messageId: said ? messageId : undefined, refused: Boolean(refusal) };

    // In a sheet below the phone's edge a label is 15 at 500, still 8 above its field (Tools
    // 0a Field label), and what is said under it is 15 too (Beside) — #458.
    return (
        <FieldContext.Provider value={context}>
            <div className="flex min-w-0 flex-col gap-gap">
                {labelAs === "label" ? (
                    <label id={labelId} htmlFor={control} className={FIELD_LABEL}>
                        {label}
                    </label>
                ) : (
                    <span id={labelId} onClick={() => document.getElementById(control)?.focus()} className={FIELD_LABEL}>
                        {label}
                    </span>
                )}
                {children}
                {(said || reserveMessage) && (
                    <div id={messageId} aria-live="polite" className={FIELD_MESSAGE}>
                        {refusal ? (
                            <p role="alert" className="text-danger">
                                {refusal}
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
