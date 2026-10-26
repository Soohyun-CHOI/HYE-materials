"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
    CONTROLS_COPY as COPY,
    buttonBusyState,
    comboboxList,
    editableComboboxKey,
    menuIndex,
    movedIndex,
    multiSelectKey,
    numberFieldText,
    radioKey,
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
 * field on the asset screens themselves; a screen importing them from the frame would
 * import a dialog it does not have. Their words are `lib/controls.js`'s for the same
 * reason, apart from the frame's in `lib/dialogFrame.js`.
 *
 * A SCREEN TAKES ITS LOOK FROM THESE AND WRITES NO VALUE. Every class reads a name
 * `app/designValues.css` declares, and until #258 only a file nothing outside
 * `app/(assets)/` and `app/login/` calls may do that — `offline/design-values.mjs` walks the
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
 * IN A SHEET ON A PHONE THEY TAKE THE PHONE'S SIZES, AND NOWHERE ELSE (#458). The asset
 * page's dialogs open as Tools 0a's sheets below the phone's edge, and there a button is
 * 48 and full width, 17 at 600, a bordered one a text button, and a field's label 15. The
 * frame marks such a dialog `data-sheet`, so those sizes are `max-sm:in-data-[sheet]:`
 * classes — CSS decides both conditions, the width and the ancestor, and a control in any
 * other dialog or on a page keeps 0a's at every width; the registration's and the labels'
 * dialogs are a desk's. `SheetField` is the phone's own field: it opens one of 1j's sheets
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
 * keystroke; none is disabled, so focus stays where the submission found it. `busy` is
 * `"action"` while the form waits on an action other than its submit (#527,
 * `lib/controls.js:buttonBusyState`), and then the submit locks with the rest.
 */
export function FormBusy({ busy, children }) {
    return <FormBusyContext.Provider value={busy}>{children}</FormBusyContext.Provider>;
}

/**
 * Where focus goes when a press is refused for what its fields hold (#522): to the first
 * field that refuses, in the order the form draws them, so the reader starts at what to fix
 * and a screen reader reads that field's refusal with it. 1k-b draws the caret in the refused
 * name; the asset page's foot bar and desk dialog and the registration ask it of every press
 * they turn away themselves.
 *
 * A FIELD SAYS IT REFUSES ON THE BOX AROUND IT (`data-refused`, set by `Field` and
 * `ChipChoice`), since what takes focus inside differs — a choice, a text field, a sheet's
 * field, a group of chips — and one field can hold a desk's control and a phone's, one of them
 * hidden. The first control in it that is drawn and in the tab order takes focus; it is asked
 * once the refusal has rendered, which is why the press hands its form over rather than
 * focusing at once.
 */
export function useRefusalFocus() {
    const formRef = useRef(null);
    const [asked, setAsked] = useState(0);
    useEffect(() => {
        const form = formRef.current;
        if (asked === 0 || !form) return;
        for (const field of form.querySelectorAll("[data-refused]")) {
            const target = [...field.querySelectorAll("input, button, [tabindex]")].find(
                (element) => element.tabIndex >= 0 && element.type !== "hidden" && element.getClientRects().length > 0
            );
            if (target) {
                target.focus();
                return;
            }
        }
    }, [asked]);
    return useCallback((form) => {
        formRef.current = form;
        setAsked((count) => count + 1);
    }, []);
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
 * through; the asset page draws it for a press somebody else's scan got in front of
 * (1k). Where it stands, and whether a desk draws something else in its place, is its
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
 * A refusal about the whole of what a form asks — a dialog's (0l Actions), and an asset
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
 *
 * A LINE THAT REFUSES NOTHING TAKES THE SAME LOOK AS `role="status"` (#527): 1l sets what an edit
 * will do — `Its 10 items take the new name.` — as this line before the press, which is a note
 * the reader reads rather than an answer to a press, so it is heard when it changes and not as
 * an alert. `DialogActions`' `note` is its one caller.
 */
export function Refusal({ centered = false, role = "alert", children }) {
    return (
        <p
            role={role}
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
// the phone's edge, the phone's 50 at 17 with its rounder corner (Tools 0a Button). And 0a's
// Control, 32 at 13, which 1a draws under a list a band has emptied (#520).
const BUTTON_SIZE = {
    md: "inline-flex h-control shrink-0 text-body-sm",
    lg: "inline-flex h-control-lg shrink-0 text-body",
    xl: "flex h-control-xl w-full text-body max-sm:h-mobile-button max-sm:rounded-mobile-control max-sm:text-mobile-heading",
};

// The room either side of the words, by size — and a ghost's own, whatever its size (#520).
const BUTTON_INSET = { md: "px-control-md-inset-x", lg: "px-control-lg-inset-x", xl: "px-control-lg-inset-x" };
const GHOSTS = ["ghost", "ghostDanger"];
const insetOf = (variant, size) =>
    GHOSTS.includes(variant) ? "px-ghost-inset-x" : variant === "faced" ? "pr-faced-inset-right pl-faced-inset-left" : BUTTON_INSET[size];

// A ghost is "one step under what stands around it — 32 with 10 in a row of 36 buttons" (0f
// Ghost), so one standing with 0a's 36 is the Control's 32 and keeps the row's 14 (1l, #527);
// at `md` it is 32 at 13, as 1b draws its `Back` among 32s' words.
const sizeOf = (variant, size) => (GHOSTS.includes(variant) && size === "lg" ? "inline-flex h-control shrink-0 text-body" : BUTTON_SIZE[size]);

// 0f: a filled action hovers to its Accent hover and keeps its white ink, and one that
// cannot act yet keeps its fill at 40% and takes no hover; a bordered one fills at Wash
// and leaves its Edge alone. A destructive commitment is filled red and hovers to Red's
// Accent hover (0f Destructive, 0d) — the retirement's (#458). A ghost is its word alone in
// Ink, 10 either side, and fills at Hover (Ghost, 0f Faced) — a dialog's `Back` (1b, #520). A
// busy one of any kind takes no hover (0f Working), and neither does one locked with it
// (#469): both are `aria-disabled`, which is what the hover is written against. It is written
// against what is NOT disabled rather than what is enabled, so a link drawn as an action
// hovers too. A ghost that removes or reverses the record is 0f's Destructive at a ghost's
// size: transparent at rest, red on red's Face under the pointer — 1l's `Discontinue` (#527).
// A faced action is 0f's Faced, no outline at a 36, its mark and word in Ink 2 lifting to Ink as
// it fills at Hover (0f Ink on hover) — the category list's way to the catalog (1a, #566).
const BUTTON_VARIANT = {
    filled: "bg-primary text-white not-disabled:not-aria-disabled:hover:bg-primary-hover disabled:bg-primary-disabled",
    bordered: "border border-border bg-white text-foreground-default not-disabled:not-aria-disabled:hover:bg-hover-subtle",
    danger: "bg-danger text-white not-disabled:not-aria-disabled:hover:bg-danger-hover",
    ghost: "text-foreground-default not-disabled:not-aria-disabled:hover:bg-hover",
    ghostDanger: "text-foreground-default not-disabled:not-aria-disabled:hover:bg-danger-subtle not-disabled:not-aria-disabled:hover:text-danger",
    faced: "text-foreground-muted not-disabled:not-aria-disabled:hover:bg-hover not-disabled:not-aria-disabled:hover:text-foreground-default",
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
    ghost: "",
    ghostDanger: "",
    faced: "",
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
 *
 * AN ICON BUTTON TAKES IT TOO (#531): the asset page's `More actions` is busy while the
 * `Send for repair` chosen from its menu is on its way, and lays the spinner over its dots
 * the same way, in a button that is `group/button`, positioned and marked `data-busy`.
 */
export function ButtonLabel({ size, busyLabel, children }) {
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
 * undone, `ghost` for one that is its word alone — a dialog's `Back`, at `md` (#520) — its
 * Destructive kind `ghostDanger` (1l's `Discontinue`, #527), and `bordered` for the rest.
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
 *
 * `holdWidthOf` IS WORDS THE ACTION KEEPS ROOM FOR (#522): a commitment whose words carry a
 * count the reader changes in place holds the width of a longer form of them, unseen and
 * unread, so it does not grow and shrink under the reader's hand — 1b's `Add 1 item`, as wide
 * as `Add 99 items`. Its figures are tabular, so no count is wider than another of its digits.
 *
 * `ariaLabel` IS A NAME LONGER THAN THE WORDS (#553): 1a's `Export` is named `Export to Excel`,
 * which says what the press makes. It holds the words drawn, so a reader who says what they see
 * still reaches it, and a caller drops it while busy, so the working word is the name then.
 *
 * `ref` IS THE BUTTON ITSELF (#566), for a caller that hands focus back to it — 1a's `Export`,
 * which a toast reporting its press returns focus to.
 */
export function Button({ variant = "filled", size = "lg", type = "button", disabled = false, disabledReason, describedBy, busy = false, busyLabel, holdWidthOf, ariaLabel, ref, onClick, children }) {
    const reasonId = useId();
    // What the form waits on, as the frame said it: its submit, or `"action"` (#527).
    const formWaits = useContext(FormBusyContext);
    const state = buttonBusyState({ busy, formBusy: formWaits, submits: type === "submit", disabled });
    const working = state === "working";
    const explained = disabled && Boolean(disabledReason);
    const button = (
        <button
            ref={ref}
            type={type}
            disabled={disabled}
            onClick={state ? (event) => event.preventDefault() : onClick}
            aria-label={ariaLabel}
            aria-describedby={explained ? reasonId : describedBy}
            aria-busy={working || undefined}
            aria-disabled={state ? true : undefined}
            data-busy={working || undefined}
            className={`group/button ${BUTTON} ${sizeOf(variant, size)} ${insetOf(variant, size)} ${BUTTON_VARIANT[variant]} ${SHEET_BUTTON} ${SHEET_BUTTON_VARIANT[variant]}`}
        >
            <ButtonLabel size={size} busyLabel={busyLabel}>
                {holdWidthOf ? (
                    <span className="inline-grid justify-items-center tabular-nums">
                        <span aria-hidden="true" className="invisible col-start-1 row-start-1">
                            {holdWidthOf}
                        </span>
                        <span className="col-start-1 row-start-1">{children}</span>
                    </span>
                ) : (
                    children
                )}
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
 * A link drawn as an action, for the places an action goes somewhere rather than doing
 * something — the sign-in screens' `Go to sign in` (#473) and the category list's `Catalog`
 * (#527). It is `Button`'s look and has none of its states: a link is never disabled and never
 * busy. `mark` is the caller's 16 mark leading the words, 8 before them — `Catalog`'s book
 * (1a, #566) — drawn by the caller so the shape it names is a literal there.
 */
export function ButtonLink({ variant = "filled", size = "lg", href, mark, children }) {
    return (
        <Link
            href={href}
            className={`${BUTTON} ${sizeOf(variant, size)} ${insetOf(variant, size)} ${BUTTON_VARIANT[variant]} ${SHEET_BUTTON} ${SHEET_BUTTON_VARIANT[variant]}${mark ? " gap-gap" : ""}`}
        >
            {mark}
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
 *
 * `labelNote` IS A WORD BESIDE THE LABEL, 8 AFTER IT AT 400 IN INK 3 (1l, #527) — the catalog's
 * `Optional` beside a level a row may leave empty. It is part of the label, so the field is named
 * `Size Optional` and assistive tech hears that it may be left empty.
 *
 * `count` IS HOW MUCH THE FIELD HOLDS AGAINST WHAT IT MAY, AT THE LINE'S END (0a Note, 1f, 1j-b2;
 * #533): `28/50` in the line's ink, 12 after what the line says, and in Red with the field while
 * it refuses. It describes the field as the line does, and is not read out as it changes, which
 * a count would be on every keystroke.
 */
export function Field({ label, labelNote, labelAs = "label", labelHidden = false, size = "lg", help, note, refusal, reserveMessage = false, count, children }) {
    const base = useId();
    const control = `${base}control`;
    const labelId = `${base}label`;
    const messageId = `${base}message`;
    const countId = `${base}count`;
    const said = refusal || note || help;
    const described = [said ? messageId : null, count !== undefined ? countId : null].filter(Boolean).join(" ") || undefined;
    const context = { control, labelId, messageId: described, refused: Boolean(refusal) };
    const xl = size === "xl";
    const labelClass = labelHidden ? "sr-only" : `mb-gap ${FIELD_LABEL} ${xl ? "max-sm:text-mobile-body-sm" : ""}`;
    const message = (said || reserveMessage) && (
        <div
            id={messageId}
            aria-live="polite"
            className={
                count === undefined
                    ? `mt-input-message-stack ${FIELD_MESSAGE} ${labelHidden ? "text-center max-sm:text-left" : ""} ${
                          xl ? "max-sm:px-mobile-input-message-inset-x max-sm:text-mobile-body-sm" : ""
                      }`
                    : "min-w-0 flex-1"
            }
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
    );

    // In a sheet below the phone's edge a label is 15 at 500, still 8 above its field (Tools
    // 0a Field label), and what is said under it is 15 too (Beside) — #458.
    return (
        <FieldContext.Provider value={context}>
            <div data-refused={refusal ? "" : undefined} className="flex min-w-0 flex-col">
                {labelAs === "label" ? (
                    <label id={labelId} htmlFor={control} className={labelClass}>
                        {label}
                        {labelNote && <span className="ml-gap font-normal text-foreground-subtle">{labelNote}</span>}
                    </label>
                ) : (
                    <span id={labelId} onClick={() => document.getElementById(control)?.focus()} className={labelClass}>
                        {label}
                        {labelNote && <span className="ml-gap font-normal text-foreground-subtle">{labelNote}</span>}
                    </span>
                )}
                {children}
                {count === undefined ? (
                    message
                ) : (
                    <div
                        className={`mt-input-message-stack flex items-start gap-field-count-inline ${FIELD_MESSAGE} ${
                            xl ? "max-sm:px-mobile-input-message-inset-x max-sm:text-mobile-body-sm" : ""
                        }`}
                    >
                        {message}
                        <span id={countId} className={`ml-auto shrink-0 tabular-nums ${refusal ? "text-danger" : "text-foreground-subtle"}`}>
                            {count}
                        </span>
                    </div>
                )}
            </div>
        </FieldContext.Provider>
    );
}

/**
 * A FIELD TAKES 16 UNDER A FINGER, WHATEVER IT IS DRAWN AT (#568): Safari zooms the page to a
 * field set smaller than 16 as it takes focus, and a desk's field is 13 or 14. So every field
 * a press can type into — here, `NumberField`, `Combobox`, `SearchField`, the dialog's search
 * and the job step's — reads Tools 0a's field value, `--text-mobile-body`, under
 * `pointer: coarse`, and keeps its height. Touch rather than the phone's edge, because a phone
 * turned on its side is wider than the edge and draws the desk; and no drawing sets a desk's
 * field under a finger, so the size is this app's decision rather than the design's
 * (`docs/notes/design-system.md`). `offline/phone-screens-still.mjs` holds every field.
 */
const TEXT_INPUT_SIZE = {
    lg: "h-control-lg px-input-inset-x text-body pointer-coarse:text-mobile-body",
    xl: "h-control-xl px-input-inset-x text-body max-sm:h-mobile-input max-sm:gap-mobile-input-gap max-sm:rounded-mobile-control max-sm:px-mobile-input-inset-x max-sm:text-mobile-body pointer-coarse:text-mobile-body",
};

/**
 * A text field (0f Field): white on an Edge border, Edge focus while it holds the caret,
 * red while its field refuses it, the caret in Accent, 12 either side of what it holds (0a
 * Side room) — a dialog's field held a 36 button's 16 until #505, which the drawings never
 * drew. `onChange` is handed the value.
 *
 * THE EDGE IS A BORDER, SO THE ROOM IS MEASURED INSIDE IT (#522). Every drawing sets a field's
 * words 12 inside its 1px Edge at a desk and 16 inside it on a phone, 13 and 17 from the
 * field's outer side; an inset ring takes no room, and until #522 stood every value and the
 * phone's domain 1px left of the drawings and a desk's domain 1px right, the first seen on the
 * sign-in field at 375.
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
    const formBusy = Boolean(useContext(FormBusyContext));
    const locked = readOnly || formBusy;
    const ownRef = useRef(null);
    const ref = inputRef ?? ownRef;
    const suffixId = `${field.control}suffix`;
    const describedBy = [field.messageId, suffix ? suffixId : null].filter(Boolean).join(" ") || undefined;
    const clearable = size === "xl" && !locked && value !== "";

    return (
        <div
            onClick={() => ref.current?.focus()}
            className={`flex min-w-0 cursor-text items-center rounded-control border bg-white ${
                field.refused ? "border-danger" : "border-border focus-within:border-border-focus"
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

/**
 * A phone field's clear × (Tools 0a Field): drawn below the phone's edge only, and a text button's
 * press. The job step's search is the second field to carry it (#554), a field whose desk look is
 * a search's rather than a form field's, so it takes the × rather than the whole `TextInput`.
 */
export function ClearButton({ onClear }) {
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
 * The one field in a sheet (Tools 0a Field): filled at Ink 5.5% with no edge, 50 tall, 16
 * inside, its value at 16 and an Accent caret, and a clear × at its end once it holds a value.
 * Enter and the keyboard's `done` key are `onDone`.
 *
 * TWO SHEETS TYPE INTO IT, SO IT IS ONE PART (#533). 1j's name sheet drew it inline from #458;
 * the note sheet is the second (1j-b2), and two copies of one field would be two answers to how
 * it looks. The clear's target ends 2 inside the field's edge, the field keeping its 16, as
 * 1j-b2 draws it — the one sheet field the files of 2026-10-16 draw a clear on — where the name
 * sheet's ended on the edge itself, its 16 given up while it held a value. Inside a `Field` it takes the field's id, its line and whether it refuses, a refusal
 * drawing the Red edge as a ring inside the field (1j-b2), and the field's label names it; the
 * name sheet's stands alone, and `label` names it. Inside a busy form it is read-only and offers
 * no clear (#469).
 */
export function SheetInput({ value, onChange, onDone, placeholder, label, clearLabel, inputRef }) {
    const field = useField();
    const locked = Boolean(useContext(FormBusyContext));
    const ownRef = useRef(null);
    const ref = inputRef ?? ownRef;
    const clearable = Boolean(value) && !locked;

    return (
        <div
            className={`flex h-mobile-input items-center rounded-mobile-control bg-mobile-input-background px-mobile-input-inset-x ${
                field.refused ? "ring-1 ring-danger ring-inset" : ""
            }`}
        >
            <input
                ref={ref}
                id={field.control}
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (!locked) onDone();
                }}
                readOnly={locked}
                placeholder={placeholder}
                aria-label={label}
                aria-describedby={field.messageId}
                aria-invalid={field.refused || undefined}
                autoComplete="off"
                enterKeyHint="done"
                className="h-full min-w-0 flex-1 bg-transparent text-mobile-body text-foreground-default caret-primary outline-none placeholder:text-foreground-subtle"
            />
            {clearable && (
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={() => {
                        onChange("");
                        ref.current?.focus();
                    }}
                    className="-mr-[calc(var(--spacing-mobile-input-inset-x)-var(--spacing-mobile-sheet-input-clear-inset-right))] flex size-mobile-touch-target shrink-0 items-center justify-center text-foreground-subtle active:opacity-mobile-pressed"
                >
                    <Icon name="x" className="size-mobile-input-clear-icon" />
                </button>
            )}
        </div>
    );
}

/**
 * A field on a phone that one of 1j's sheets sets (Tools 0a Field, #458): it shows what was
 * chosen, or its placeholder at Ink 3, and a press opens the sheet that chooses. 50 tall,
 * 16 inside, its value at 16, white with an Edge border at the phone's Radius, as every form
 * field rests (0f); a chevron says it opens a list. With no `onOpen` it states its value and
 * takes no press — 1j draws one job that way, for a person on one assignment.
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
    const formBusy = Boolean(useContext(FormBusyContext));
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
 * when a press opens the sheet that chooses. The icon and the chevron are 0a's 16 box since
 * #522, as 1j draws both; they were 14 and 11, the chevron an earlier drawing's own figure. With no `onOpen` it states its value and takes
 * no press, which is the one job of a person on one assignment (1j-b).
 *
 * ITS TARGET IS TALLER THAN ITS PILL: it reaches up into the bar's room above it, as 1j
 * draws it, so a press anywhere in the 52 above the pill's foot opens it — more than the 48
 * the phone's Target asks for, without the pill growing. Held, it takes the Wash, which is
 * what any control but a text button does under a press (Tools 0a Field). It is named by the
 * field around it and its value, and inside a busy form it opens nothing (#469).
 */
export function SheetChip({ value, placeholder, onOpen, icon }) {
    const field = useField();
    const formBusy = Boolean(useContext(FormBusyContext));
    const valueId = useId();
    const pill = `inline-flex h-mobile-chip max-w-full items-center gap-gap rounded-full border pl-mobile-chip-inset-x text-mobile-body-sm ${
        onOpen ? "pr-mobile-chip-inset-right" : "pr-mobile-chip-inset-x"
    } ${field.refused ? "border-danger" : "border-border"}`;
    const content = (
        <>
            <span className="flex size-icon shrink-0 items-center justify-center text-foreground-subtle">{icon}</span>
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
                    <Icon name="chevron-down" className="size-icon shrink-0 text-foreground-subtle" />
                </span>
            </button>
        </div>
    );
}

/**
 * A row's box (0b, 1d; #463): 16 at the Badge radius in a 32 target that gives its room back,
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
    "flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-control text-foreground-subtle not-aria-disabled:hover:bg-hover not-aria-disabled:hover:text-foreground-default";

/**
 * A number field with its steps (0f Field): 120 wide, a 30 − and + inside it 3 from its
 * ends, the figure centered between them, and every edge the form field's — white, an Edge
 * ring, Edge focus while it holds the caret, red while it refuses. The steps are the one
 * control inside another that fills at Hover as well as changing its ink (0f Nested).
 *
 * The figure is text rather than `type="number"`, as the design draws it: the browser's
 * own spinner and its own refusal bubble are neither this app's nor the design's, so what
 * a count may be is `lib/assetRegistration.js:readQuantity`'s to say in the field's own
 * line. What it keeps of a keystroke and what a step does are `lib/controls.js`'s. Inside a
 * busy form the figure is read-only and the steps take no press (#469).
 */
export function NumberField({ name, value, onChange, min, max }) {
    const field = useField();
    const formBusy = Boolean(useContext(FormBusyContext));
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
                className="h-control-sm min-w-0 flex-1 bg-transparent text-center text-body tabular-nums text-foreground-default caret-primary outline-none pointer-coarse:text-mobile-body"
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
 * caller's `value`, and the placeholder is what it shows while nothing is chosen, at Ink 3 —
 * a `value` no option holds, `null` among them, since an option's value can be `""` (#514).
 * What it shows sits 12 in at 400, a form field's (0a Side room), as the text field's does
 * — until #505 it held a 36 button's 16 at 500, which no drawing drew.
 * What submits is the hidden input under `name`, carrying the chosen option's value; a choice
 * with no `name` submits nothing and draws no input.
 *
 * INSIDE A BUSY FORM IT IS READ-ONLY (#469): it keeps focus and its look, and no key and no
 * press opens it or changes what it holds. Tab still leaves.
 *
 * TWO MORE LOOKS, ONE PATTERN (#519). `look="chip"` is the job a list stands on, at the start of
 * its band since the files of 2026-10-23 (1a, #566), where #519 drew it in the head with `Job`
 * before the value at 36: a 32 control at least 128 wide, a 14 pin in Ink 3 leading the job at 13
 * and 500 in Ink, its 12 chevron in Ink 3 at the end, 6 between each, 9 before the pin and 8 after
 * the chevron, on an Edge and white, holding its Wash under the pointer and while its list is
 * open, the list from its left at least 160 wide with 32 rows. Its Edge turns to Edge focus for
 * the keyboard alone (#522): 1a draws a chip a press opened on its Edge, a bordered control's
 * Open being its Wash (0f). `look="crumb"` is the same choice standing as a breadcrumb
 * level (1d, 1f): the level's 26, its side room pulled back and its 13 at 600 in Ink 2, a 12
 * chevron 6 after the word, and its list from the level's left with 32 rows. `look="sort"` is the
 * order a list stands in (1a, 1d, 1l, #540): a 32 with no outline, 7 before a 14 `arrow-up-down` in
 * Ink 3, the order's name at 13 and 500 in Ink and a 12 chevron in Ink 3, 6 between each and 8
 * after it, Hover under the pointer and while its list is open, and its list set against its right
 * end with 32 rows, each holding room for the check at its end so the list does not change width
 * with what is chosen. None of the three shows the field's label, which a screen reader hears as
 * the name.
 *
 * AN OPTION MAY CARRY A `note`, SAID AFTER ITS LABEL (#519): a job's name after its code, at Ink
 * 3 and 8 on, in the field and in its list, as 1b and 1i draw a dialog's job. A list with a
 * note in it, and a level's list, sets each label at 500 (`Menu.js`). The type-ahead reads the
 * label alone, so a key goes to the code it starts.
 */
export function Choice({ name, options, value, onChange, placeholder, look = "field" }) {
    const field = useField();
    const formBusy = Boolean(useContext(FormBusyContext));
    const listId = `${field.control}list`;
    const chosen = options.findIndex((option) => option.value === value);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(chosen);
    // Whether a key put visual focus where it is, which is what shades it (`Menu`, #522).
    const [keyed, setKeyed] = useState(false);
    const anchorRef = useRef(null);
    const search = useRef({ text: "", timer: null });
    const strong = look === "crumb" || options.some((option) => option.note);

    const choose = (index) => {
        if (index >= 0 && index < options.length) onChange(options[index].value);
    };
    const show = (byKey) => {
        setActive(chosen);
        setKeyed(byKey);
        setOpen(true);
    };

    const onKeyDown = (event) => {
        if (formBusy) return;
        const action = selectOnlyKey(event, open);
        if (!action) return;
        event.preventDefault();
        setKeyed(true);
        switch (action) {
            case "open":
                show(true);
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
        <div className={look === "field" ? "relative min-w-0" : "relative flex"}>
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
                    else show(false);
                }}
                onBlur={() => {
                    if (!open) return;
                    choose(active);
                    setOpen(false);
                }}
                className={CHOICE_LOOK[look](field.refused)}
            >
                {look === "chip" && <Icon name="map-pin" className="size-icon-sm shrink-0 text-foreground-subtle" />}
                {look === "sort" && <Icon name="arrow-up-down" className="size-icon-sm shrink-0 text-foreground-subtle" />}
                {chosen >= 0 && options[chosen].note ? (
                    <span className="flex min-w-0 flex-1 gap-gap text-foreground-default">
                        <span className="shrink-0">{options[chosen].label}</span>
                        <span className="min-w-0 truncate text-foreground-subtle">{options[chosen].note}</span>
                    </span>
                ) : (
                    <span
                        className={`min-w-0 truncate ${look === "chip" ? "flex-1 text-left" : ""} ${
                            look === "crumb" ? "" : chosen >= 0 ? "text-foreground-default" : "text-foreground-subtle"
                        }`}
                    >
                        {chosen >= 0 ? options[chosen].label : placeholder}
                    </span>
                )}
                {/* Each look's chevron: a field's 14 at its end, the chip's 12 (1a, #566), the
                    level's 12 running into its side room (1d, 1f), and the sort's 12 (#540). */}
                <Icon
                    name="chevron-down"
                    className={
                        look === "crumb"
                            ? "-mr-breadcrumb-chevron-bleed size-breadcrumb-chevron shrink-0"
                            : look === "chip"
                              ? "size-job-chip-chevron shrink-0 text-foreground-subtle"
                              : look === "sort"
                                ? "size-sort-chevron shrink-0 text-foreground-subtle"
                                : "size-icon-sm shrink-0 text-foreground-subtle"
                    }
                />
            </div>
            {name && <input type="hidden" name={name} value={value} />}
            <Menu
                id={listId}
                anchorRef={anchorRef}
                shown={open}
                labelId={field.labelId}
                fit={look === "field" ? "field" : look === "sort" ? "end" : "start"}
                minWidth={look === "chip" ? "var(--min-width-job-chip-list)" : undefined}
                rows={look === "field" ? "lg" : "sm"}
                checkSlot={look === "sort"}
                options={options.map((option, index) => ({
                    key: option.value,
                    label: option.label,
                    note: option.note,
                    strong,
                    selected: index === chosen,
                    checked: index === chosen,
                }))}
                active={active}
                shade={keyed}
                onPick={(index) => {
                    choose(index);
                    setOpen(false);
                }}
            />
        </div>
    );
}

// Each look's frame, handed whether the field refuses its value, which only a form field shows.
const CHOICE_LOOK = {
    field: (refused) =>
        `flex h-control-lg w-full cursor-pointer items-center justify-between gap-gap rounded-control border bg-white px-input-inset-x text-body outline-none aria-readonly:cursor-default not-aria-readonly:hover:bg-hover-subtle ${
            refused ? "border-danger" : "border-border focus:border-border-focus"
        }`,
    chip: () =>
        "flex h-control min-w-job-chip cursor-pointer items-center gap-control-icon-gap rounded-control border border-border bg-white pr-job-chip-inset-right pl-job-chip-inset-left text-body-sm font-medium whitespace-nowrap tabular-nums outline-none not-aria-readonly:hover:bg-hover-subtle focus-visible:border-border-focus aria-expanded:bg-hover-subtle",
    crumb: () =>
        "-mx-control-inline-inset-x flex h-control-inline cursor-pointer items-center gap-breadcrumb-chevron-gap rounded-control px-control-inline-inset-x text-body-sm font-semibold whitespace-nowrap text-foreground-muted tabular-nums not-aria-readonly:hover:bg-hover aria-expanded:bg-hover",
    // The sort (#540): drawn with no outline, so its Edge focus stands on a border that is
    // transparent at rest, its room either side taken in by that border's 1.
    sort: () =>
        "flex h-control cursor-pointer items-center gap-control-icon-gap rounded-control border border-transparent pr-[calc(var(--spacing-sort-inset-right)-1px)] pl-[calc(var(--spacing-sort-inset-left)-1px)] text-body-sm font-medium whitespace-nowrap outline-none not-aria-readonly:hover:bg-hover focus-visible:border-border-focus aria-expanded:bg-hover",
};

/**
 * 0f's segmented row (1l, #527) — "a choice is the bordered list with its chevron, or a
 * segmented row; which of the two is a design call" (0l), and 1l calls it for the catalog's
 * type, and until #552 its class. A white track on an Edge border, 36 tall, 2 inside, at the Group radius, its
 * options sharing its width, each at 14 and 500 with 6 either side; the chosen one a pill on the
 * Face at the Control radius with its word in Accent, the rest at Ink 3, lifting to Ink under
 * the pointer. A new choice slides the pill across, at once with reduced motion. A field that
 * refuses turns the track Red, and the keyboard's focus turns it Edge focus, as a field's.
 *
 * A RADIO GROUP, AS 0l's CHIPS ARE (`ChipChoice`): one stop for Tab, on the option chosen or the
 * first while none is, the arrows moving and choosing as they go (`lib/controls.js:radioKey`).
 * It is named by the field around it, and the field's label puts focus on that stop. What it
 * submits is the hidden input under `name`. Inside a busy form it takes no press and no key.
 */
export function SegmentedChoice({ name, options, value, onChange }) {
    const field = useField();
    const formBusy = Boolean(useContext(FormBusyContext));
    const groupRef = useRef(null);
    const chosen = options.findIndex((option) => option.value === value);
    const stop = chosen < 0 ? 0 : chosen;

    const choose = (index) => {
        if (!formBusy && index >= 0 && index < options.length) onChange(options[index].value);
    };
    const onKeyDown = (index) => (event) => {
        const action = radioKey(event);
        if (!action) return;
        event.preventDefault();
        if (formBusy) return;
        const next = action === "check" ? index : menuIndex(index, options.length, action);
        choose(next);
        groupRef.current?.querySelector(`[data-index="${next}"]`)?.focus();
    };

    return (
        <div
            ref={groupRef}
            role="radiogroup"
            aria-labelledby={field.labelId}
            aria-describedby={field.messageId}
            aria-invalid={field.refused || undefined}
            style={{ "--segmented-count": options.length, "--segmented-at": stop }}
            className={`relative flex h-control-lg rounded-card border bg-white p-segmented-inset ${
                field.refused ? "border-danger" : "border-border has-focus-visible:border-border-focus"
            }`}
        >
            <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-segmented-inset left-[calc(var(--spacing-segmented-inset)+(100%-2*var(--spacing-segmented-inset))/var(--segmented-count)*var(--segmented-at))] w-[calc((100%-2*var(--spacing-segmented-inset))/var(--segmented-count))] rounded-control bg-selected transition-[left] duration-segmented ease-segmented motion-reduce:transition-none ${
                    chosen < 0 ? "opacity-0" : ""
                }`}
            />
            {options.map((option, index) => {
                const on = index === chosen;
                return (
                    <button
                        key={option.value}
                        id={index === stop ? field.control : undefined}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-disabled={formBusy || undefined}
                        data-index={index}
                        tabIndex={index === stop ? 0 : -1}
                        onClick={() => choose(index)}
                        onKeyDown={onKeyDown(index)}
                        className={`relative min-w-0 flex-1 truncate rounded-control px-segmented-option-inset-x text-body font-medium outline-none ${
                            on ? "text-primary" : "text-foreground-subtle not-aria-disabled:hover:text-foreground-default"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
            {name && <input type="hidden" name={name} value={value ?? ""} />}
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
 *
 * A SUGGESTION CAN BE A THING CHOSEN RATHER THAN WORDS TYPED (#507). With `onPick`, accepting
 * one hands the caller the suggestion itself instead of typing its label: the registration's
 * search picks a tool from the catalog, and one name can stand under two categories, so the
 * label alone would not say which was meant. A suggestion's `key` is what tells two of one
 * label apart in the list, and its label when it has none.
 *
 * A FIELD THAT ALSO TAKES A VALUE NOT AMONG ITS SUGGESTIONS MARKS ONE (0l, 1l; #527): "New at its
 * right end, 12 inside, at Ink 3, so the dialog keeps its height while typing" — `mark`, its
 * `word` drawn and what it means, `said`, for assistive tech alone: the drawing gives the mark
 * that sentence and no line to set it on. The sentence is the field's description and is heard
 * as it comes, so typing a category the type does not hold says once that it will be added.
 *
 * `onBlur` IS ASKED ONCE FOCUS LEAVES THE FIELD, after its list has shut (#538): the catalog's
 * Category field puts what a save would spell in place of what was typed then, so the field shows
 * what is saved. A press on a suggestion keeps focus in the field (`Menu.js`), so it is not asked
 * before a pick, and what it is asked of later is the suggestion's own spelling.
 *
 * A FIELD MAY OPEN ON EVERYTHING IT OFFERS (`every`, #555): the catalog's Category and Name list
 * the whole of what the type, or the type and the category, hold the moment the list opens —
 * as focus arrives, by Tab or a press, on a press in the field while it holds focus, and on Down
 * — with the one the field holds marked `chosen` and scrolled to, so a reader who does not
 * remember what the catalog holds need not guess at its first letters. Typing narrows to
 * `suggestions` until the list shuts, and emptying the field opens the whole list again, since
 * nothing is left to narrow by. The keys are the same either way. `lane` is the most the list
 * stands at before it scrolls in 0i's lane (`Menu.js`), its drawing's.
 */
export function Combobox({ name, value, onChange, onPick, onBlur, suggestions, every, lane, heading, placeholder, listOpen, onListOpenChange, mark }) {
    const field = useField();
    const formBusy = Boolean(useContext(FormBusyContext));
    const listId = `${field.control}list`;
    const markId = `${field.control}mark`;
    const [active, setActive] = useState(-1);
    // Whether something has been typed since the list last opened, which narrows a field that
    // opens on everything it offers.
    const [narrowing, setNarrowing] = useState(false);
    const anchorRef = useRef(null);
    const list = comboboxList({ every, suggestions, narrowing, value });
    const shown = listOpen && list.length > 0 && !formBusy;
    // What the list holds once it opens, nothing typed since.
    const opening = comboboxList({ every, suggestions, narrowing: false, value });

    const open = () => {
        setNarrowing(false);
        setActive(-1);
        onListOpenChange(true);
    };

    const accept = (index) => {
        if (onPick) onPick(list[index]);
        else onChange(list[index].label);
        setActive(-1);
        onListOpenChange(false);
    };

    const onKeyDown = (event) => {
        if (formBusy) return;
        const answer = editableComboboxKey(event, { shown, active, count: shown ? list.length : opening.length });
        if (!answer) return;
        if (answer.stop) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (answer.accept !== undefined) {
            accept(answer.accept);
            return;
        }
        if (answer.shown && !shown) setNarrowing(false);
        setActive(answer.active);
        onListOpenChange(answer.shown);
    };

    return (
        <div className="relative min-w-0">
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
                aria-describedby={[field.messageId, mark !== undefined ? markId : null].filter(Boolean).join(" ") || undefined}
                aria-invalid={field.refused || undefined}
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                readOnly={formBusy}
                onChange={(event) => {
                    onChange(event.target.value);
                    setNarrowing(true);
                    setActive(-1);
                    onListOpenChange(true);
                }}
                onFocus={() => {
                    if (!formBusy) open();
                }}
                onClick={() => {
                    if (!formBusy && !shown) open();
                }}
                onBlur={() => {
                    setActive(-1);
                    onListOpenChange(false);
                    onBlur?.();
                }}
                onKeyDown={onKeyDown}
                className={`h-control-lg w-full rounded-control border bg-white px-input-inset-x text-body text-foreground-default caret-primary outline-none placeholder:text-foreground-subtle pointer-coarse:text-mobile-body ${
                    field.refused ? "border-danger" : "border-border focus:border-border-focus"
                } ${mark?.word ? "pr-input-mark-inset-right" : ""}`}
            />
            {mark?.word && (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-[calc(var(--spacing-input-inset-x)+1px)] -translate-y-1/2 text-body text-foreground-subtle"
                >
                    {mark.word}
                </span>
            )}
            {mark !== undefined && (
                <span id={markId} aria-live="polite" className="sr-only">
                    {mark?.said ?? ""}
                </span>
            )}
            <Menu
                id={listId}
                anchorRef={anchorRef}
                shown={shown}
                labelId={field.labelId}
                heading={heading}
                lane={lane}
                options={list.map((suggestion, index) => ({
                    key: suggestion.key ?? suggestion.label,
                    label: suggestion.label,
                    match: suggestion.match,
                    detail: suggestion.detail,
                    selected: index === active,
                    checked: suggestion.chosen === true,
                }))}
                active={active}
                onPick={accept}
            />
        </div>
    );
}

/**
 * A search field (0f, 1a; #520): 32 tall on the Field ground with no border, its words at 13,
 * a 14 search mark 11 in from its start and the words 32 in, and while it holds anything a
 * 24 × at its end that empties it. Focus gives it a white face and the Edge focus border. It
 * says what it searches as its placeholder and as its name (0h), so it takes no label.
 *
 * WHAT IT HOLDS IS THE CALLER'S, as every control's here is. The × hands back an empty string
 * and puts focus in the field, so the next search is typed at once rather than from a page
 * whose focus fell when the × went.
 *
 * `onEnter` IS WHAT ENTER DOES, WHEN A CALLER GIVES IT ONE (1a, #541): the list's opens the item
 * its search found by its id. A key that composes a character — an input method's Enter — is
 * the method's and does nothing here.
 */
export function SearchField({ label, value, onChange, clearLabel, onEnter }) {
    const inputRef = useRef(null);
    return (
        <div role="search" className="relative h-control w-list-search shrink-0">
            <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-search-icon-inset size-icon-sm -translate-y-1/2 text-foreground-subtle"
            />
            <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                aria-label={label}
                placeholder={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                    if (!onEnter || event.key !== "Enter" || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    onEnter();
                }}
                className="h-control w-full rounded-control border border-transparent bg-background-muted pr-search-inset-right pl-search-inset-left text-body-sm text-foreground-default caret-primary outline-none placeholder:text-foreground-subtle focus:border-border-focus focus:bg-white pointer-coarse:text-mobile-body"
            />
            {value !== "" && (
                <button
                    type="button"
                    aria-label={clearLabel}
                    onClick={() => {
                        onChange("");
                        inputRef.current?.focus();
                    }}
                    className="absolute top-px right-px flex h-[calc(var(--height-control)-2px)] w-clear-button items-center justify-center rounded-r-[calc(var(--radius-control)-1px)] text-foreground-subtle hover:bg-hover hover:text-foreground-default"
                >
                    <Icon name="x" className="size-clear-icon" />
                </button>
            )}
        </div>
    );
}

// A filter chip's two looks (1a, #520). Holding nothing it is a ghost control — its words at
// 13 and 500 in Ink 3 with a 12 chevron 6 after them — that fills at Hover and lifts to Ink
// under the pointer and while its list shows (0f). Holding values it stands on the Face with
// its Edge, its name in Ink 3 and what it holds in Ink, the chevron after them and a 24 × that
// empties it at its end, each part filling at Face hover.
const FILTER_CHIP_GHOST =
    "flex h-control cursor-pointer items-center gap-control-icon-gap rounded-control border border-transparent text-body-sm font-medium whitespace-nowrap text-foreground-subtle outline-none hover:bg-hover hover:text-foreground-default focus-visible:border-border-focus aria-expanded:bg-hover aria-expanded:text-foreground-default";
const FILTER_CHIP_EMPTY = `${FILTER_CHIP_GHOST} pr-filter-chip-inset-right pl-control-inset-x`;
const FILTER_CHIP_HOLDING = "flex h-control items-center rounded-control border border-selected-border bg-selected";
const FILTER_CHIP_HELD =
    "flex h-full cursor-pointer items-center gap-gap rounded-l-[calc(var(--radius-control)-1px)] pr-[calc(var(--spacing-filter-chip-inset-right)-1px)] pl-control-inset-x text-body-sm font-medium whitespace-nowrap outline-none hover:bg-selected-hover focus-visible:bg-selected-hover aria-expanded:bg-selected-hover";

/**
 * A filter chip and the list it opens (0a, 0c, 0f; 1a, #520) — how a list narrows by a set it
 * has no tab for (0n). The list takes several values, each marked with a box and its count at
 * the end, and stays open while values are taken; the chip says its name and, once it holds
 * any, the one value it holds or how many (`several`), with a × beside it that empties it.
 *
 * IT IS `Choice`'s PATTERN, THE SELECT-ONLY COMBOBOX, TAKING SEVERAL. Focus stays on the chip
 * and `aria-activedescendant` names the option under visual focus; what a key does is
 * `lib/controls.js:multiSelectKey` — the pattern's keys, with Enter and Space taking or giving
 * back an option and leaving the list open. Leaving the chip closes the list and takes nothing,
 * since a list taking several takes as it goes. The chip is one element in both looks, so the ×
 * hands focus back to it rather than letting focus fall with the × itself.
 *
 * WHAT IT HOLDS IS THE CALLER'S: `options` are `{ value, label, count }`, `values` the values
 * taken, and `onChange` is handed the values taken in the options' order.
 *
 * A CHIP MARKED `single` TAKES ONE VALUE (1b, #520) — the registration's type and category, at
 * the end of its search's row. It is then `Choice`'s pattern to the letter: its list marks the
 * value held with a check at the row's end and no box, a press or Enter chooses and closes, and
 * leaving the chip chooses what is under visual focus (`lib/controls.js:selectOnlyKey`). Holding
 * one, it says the value alone, as 1b draws it, where a chip taking several says its name before
 * what it holds. Its `values` and `onChange` keep the one shape, an empty list or one value.
 * `fit` is where its list opens, as `Menu`'s: from its left, or set against its right end for a
 * chip at the end of its row; and `lane` the height a list drawn as a lane of its own stops at
 * (`Menu`'s, #555), 1l's band.
 */
export function FilterChip({ label, options, values, onChange, clearLabel, several, single = false, fit = "start", lane }) {
    const id = useId();
    const labelId = `${id}label`;
    const listId = `${id}list`;
    const chipRef = useRef(null);
    const anchorRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    // Whether a key put visual focus where it is, which is what shades it (`Menu`, #522).
    const [keyed, setKeyed] = useState(false);
    const search = useRef({ text: "", timer: null });
    const taken = new Set(values);
    const held = options.filter((option) => taken.has(option.value));
    const chosen = single ? options.findIndex((option) => taken.has(option.value)) : -1;

    const toggle = (index) => {
        const option = options[index];
        if (!option) return;
        const next = taken.has(option.value) ? held.filter((each) => each !== option) : [...held, option];
        onChange(options.filter((each) => next.includes(each)).map((each) => each.value));
    };
    const choose = (index) => {
        if (index >= 0 && index < options.length) onChange([options[index].value]);
    };
    // Where the list opens: on the value held for one value, as `Choice` does — on none while
    // it holds none — and on the first value held, or the first option, for several.
    const opening = () => (single ? chosen : Math.max(0, options.findIndex((option) => taken.has(option.value))));

    const onKeyDown = (event) => {
        const action = single ? selectOnlyKey(event, open) : multiSelectKey(event, open);
        if (!action) return;
        event.preventDefault();
        setKeyed(true);
        switch (action) {
            case "open":
                setActive(opening());
                setOpen(true);
                return;
            case "first":
            case "last":
            case "next":
            case "previous":
            case "pageUp":
            case "pageDown":
                if (!open) setOpen(true);
                setActive(movedIndex(open ? active : single ? chosen : opening() - 1, options.length - 1, action));
                return;
            case "toggle":
                toggle(active);
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
                    (open ? active : single ? chosen : -1) + 1
                );
                if (found >= 0) setActive(found);
                return;
            }
            default:
                return;
        }
    };

    return (
        <div className="relative flex shrink-0">
            <span id={labelId} hidden>
                {label}
            </span>
            <div ref={anchorRef} className={held.length > 0 ? FILTER_CHIP_HOLDING : "flex"}>
                <div
                    ref={chipRef}
                    role="combobox"
                    tabIndex={0}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-labelledby={labelId}
                    aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
                    onKeyDown={onKeyDown}
                    onClick={() => {
                        if (!open) {
                            setActive(opening());
                            setKeyed(false);
                        }
                        setOpen(!open);
                    }}
                    onBlur={() => {
                        if (single && open) choose(active);
                        setOpen(false);
                    }}
                    className={held.length > 0 ? FILTER_CHIP_HELD : FILTER_CHIP_EMPTY}
                >
                    {held.length > 0 ? (
                        <>
                            {!single && <span className="text-foreground-subtle">{label}</span>}
                            <span className="text-foreground-default">{held.length === 1 ? held[0].label : several(held.length)}</span>
                        </>
                    ) : (
                        label
                    )}
                    <Icon name="chevron-down" className={`size-filter-chip-chevron shrink-0 ${held.length > 0 ? "text-foreground-subtle" : ""}`} />
                </div>
                {held.length > 0 && (
                    <button
                        type="button"
                        aria-label={clearLabel}
                        onClick={() => {
                            setOpen(false);
                            onChange([]);
                            chipRef.current?.focus();
                        }}
                        className="flex h-full w-clear-button items-center justify-center rounded-r-[calc(var(--radius-control)-1px)] text-foreground-subtle hover:bg-selected-hover hover:text-foreground-default"
                    >
                        <Icon name="x" className="size-clear-icon" />
                    </button>
                )}
            </div>
            <Menu
                id={listId}
                anchorRef={anchorRef}
                shown={open}
                labelId={labelId}
                fit={fit}
                lane={lane}
                rows="sm"
                multiselectable={!single}
                options={options.map((option, index) => ({
                    key: option.value,
                    label: option.label,
                    detail: option.count,
                    selected: taken.has(option.value),
                    checked: single && index === chosen,
                }))}
                active={active}
                shade={keyed}
                onPick={
                    single
                        ? (index) => {
                              choose(index);
                              setOpen(false);
                          }
                        : toggle
                }
            />
        </div>
    );
}

/**
 * A filter that narrows by one condition and holds no value (1l, #527) — the catalog's
 * `Discontinued only`. Off, it is a filter chip's ghost with no chevron and 10 either side, since
 * it opens nothing; on, it is a held filter chip's two parts: its words in Ink on the Face inside
 * the Edge, and a 24 × at its end that turns it off.
 *
 * A TOGGLE BUTTON IN BOTH LOOKS (`aria-pressed`), so assistive tech hears one control that is on
 * or off and turns it either way with the same press; the × is a pointer's second way off, named
 * for the filter as a chip's is, and hands focus back to the toggle rather than letting it fall
 * with itself.
 */
export function ToggleChip({ label, on, onChange, clearLabel }) {
    const toggleRef = useRef(null);
    const toggle = (
        <button
            ref={toggleRef}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(!on)}
            className={on ? `${FILTER_CHIP_HELD} text-foreground-default` : `${FILTER_CHIP_GHOST} px-control-inset-x`}
        >
            {label}
        </button>
    );
    if (!on) return <div className="flex shrink-0">{toggle}</div>;
    return (
        <div className={`${FILTER_CHIP_HOLDING} shrink-0`}>
            {toggle}
            <button
                type="button"
                aria-label={clearLabel}
                onClick={() => {
                    onChange(false);
                    toggleRef.current?.focus();
                }}
                className="flex h-full w-clear-button items-center justify-center rounded-r-[calc(var(--radius-control)-1px)] text-foreground-subtle hover:bg-selected-hover hover:text-foreground-default"
            >
                <Icon name="x" className="size-clear-icon" />
            </button>
        </div>
    );
}

// A chip of 0l's chips: 36 tall, its option at 14 and 400 like a field's value, 12 either side,
// on white inside the Edge, filling at Wash under the pointer (0f Bordered); the one chosen on
// the Face inside its Edge, filling at Face hover. Neither moves while a form waits (#469).
const CHIP = "flex h-control-lg min-w-0 items-center justify-center rounded-control border px-input-inset-x text-body tabular-nums outline-none focus-visible:border-border-focus";
const CHIP_LOOK = {
    resting: "border-border bg-white not-aria-disabled:hover:bg-hover-subtle",
    chosen: "border-selected-border bg-selected not-aria-disabled:hover:bg-selected-hover",
};

/**
 * 0l's chips (1b, #520): "when the options are few and short and choosing among them is the
 * dialog's main task, they are laid out instead as 36 chips … in an equal-width grid, each as
 * wide as the longest option, 8 apart; the chosen chip takes the selected Face and Edge." The
 * registration's size and model are the first. The label sits 8 above them at 13 and 500, as a
 * field's does, and a refusal at the right end of its line at 13 in red.
 *
 * EACH AS WIDE AS THE LONGEST OPTION, WHICH ONLY THE BROWSER CAN MEASURE. The grid fills its row
 * with as many columns as fit at that width, then shares what is left among them, so a row of
 * short sizes runs five across at 432 and a model longer than half the row runs one. The widest
 * label is measured once its chips are drawn — and again once the faces have loaded, which can
 * widen it — and handed to the grid as `--chip-label-width`; the chip adds its 12 either side
 * and its Edge, and stands at least 72, 1b's narrowest. Until the measure the grid lays out at
 * 72, and it runs before the first paint.
 *
 * IT IS A RADIO GROUP, THE AUTHORING PRACTICES' (`lib/controls.js:radioKey`): one stop for Tab,
 * on the chip chosen or on the first while none is, the arrows moving and choosing as they go,
 * and wrapping. An option marked `empty` is the one leaving the choice empty — `None`, `Not
 * specified` — set in Ink 3, as 1b sets it.
 */
export function ChipChoice({ label, options, value, onChange, refusal }) {
    const labelId = useId();
    const refusalId = useId();
    const gridRef = useRef(null);
    const formBusy = Boolean(useContext(FormBusyContext));
    const chosen = options.findIndex((option) => option.value === value);
    const labels = options.map((option) => option.label).join("\n");

    useLayoutEffect(() => {
        const grid = gridRef.current;
        if (!grid) return undefined;
        let drawn = true;
        const measure = () => {
            if (!drawn) return;
            const widest = Math.max(0, ...[...grid.querySelectorAll("[data-chip-label]")].map((each) => each.scrollWidth));
            grid.style.setProperty("--chip-label-width", `${widest}px`);
        };
        measure();
        document.fonts?.ready.then(measure);
        return () => {
            drawn = false;
        };
    }, [labels]);

    const choose = (index) => {
        if (!formBusy && index >= 0 && index < options.length) onChange(options[index].value);
    };
    const onKeyDown = (index) => (event) => {
        const action = radioKey(event);
        if (!action) return;
        event.preventDefault();
        if (formBusy) return;
        const next = action === "check" ? index : menuIndex(index, options.length, action);
        choose(next);
        gridRef.current?.querySelector(`[data-index="${next}"]`)?.focus();
    };

    return (
        <div data-refused={refusal ? "" : undefined} className="flex flex-col">
            <div className="flex items-baseline justify-between gap-gap-lg pb-gap">
                <span id={labelId} className={FIELD_LABEL}>
                    {label}
                </span>
                {refusal && (
                    <span id={refusalId} role="alert" className="text-body-sm text-danger">
                        {refusal}
                    </span>
                )}
            </div>
            <div
                ref={gridRef}
                role="radiogroup"
                aria-labelledby={labelId}
                aria-describedby={refusal ? refusalId : undefined}
                aria-invalid={refusal ? true : undefined}
                className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(var(--min-width-dialog-chip),calc(var(--chip-label-width,0px)+2*var(--spacing-input-inset-x)+2px))),1fr))] gap-gap"
            >
                {options.map((option, index) => {
                    const on = index === chosen;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            aria-disabled={formBusy || undefined}
                            data-index={index}
                            tabIndex={on || (chosen < 0 && index === 0) ? 0 : -1}
                            onClick={() => choose(index)}
                            onKeyDown={onKeyDown(index)}
                            className={`${CHIP} ${on ? CHIP_LOOK.chosen : CHIP_LOOK.resting}`}
                        >
                            <span data-chip-label="" className={`min-w-0 truncate ${option.empty ? "text-foreground-subtle" : "text-foreground-default"}`}>
                                {option.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
