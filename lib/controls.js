// The 0a controls' pure half (#456): the words they say, the step a number field takes,
// what a key does to a combobox's list, and what a button is while its form waits on a
// submission (#469) — `app/components/Controls.js` and `app/components/Menu.js` are the
// components, and this is everything in them a check can hold without rendering.
//
// SPLIT FROM THE FRAME'S WORDS ON THE FRAME'S OWN EDGE. A control is not a dialog's: a
// button, a field and a choice are what #463 draws on the screens as well, so a screen
// imports the controls and never the frame, and `lib/dialogFrame.js` keeps the one word
// the frame says.
//
// THE KEYS ARE WAI-ARIA'S PATTERNS, FOLLOWED RATHER THAN APPROXIMATED. A choice among
// fixed options is the Authoring Practices' select-only combobox, a typed value with
// suggestions is its editable combobox with list autocomplete and manual selection, and
// a button that opens a list of actions is its menu button (#478). The keyboard is the whole of what makes either usable without a
// pointer, so each key's effect is a pure function here and `offline/dialog-frame.mjs`
// holds it by value; the components apply the answer and own nothing about it. Where this app
// departs from the pattern it says so beside the key, and there are two departures:
// Escape on an editable combobox whose list is already shut clears nothing — the
// pattern makes that optional, and inside a dialog it is the dialog's key — and Enter
// with no option under visual focus is left to the form, which submits.
//
// PURE AND OFFLINE-SAFE, importing nothing, so both `"use client"` components can import
// it and `scripts/screen-strings.mjs` can read the words.

export const CONTROLS_COPY = {
    // A number field's two steps, named for what they do to the figure: the field holds
    // a count, so the step is one of them (1b).
    fewer: "One fewer",
    more: "One more",
    // The × a phone field carries at its end once it holds a value (Tools 0a Field), named
    // for what it does to the field (#473).
    clear: "Clear",
};

/**
 * The figure a number field shows after one of its steps.
 *
 * THE DESIGN'S ARITHMETIC, INCLUDING WHAT IT DOES TO A FIGURE OUT OF RANGE. A step down
 * never goes under `min` and a step up never over `max`, and a field holding nothing or
 * something that is not a whole number steps from the bottom: up to `min`, down to `min`.
 * A figure already past `max` steps DOWN by one rather than jumping back into range, so a
 * reader who typed 140 and pressed the step sees 139 and is still refused — the step is a
 * step and not a correction, and the refusal is the field's to say (1b, `Refused`).
 */
export function stepNumber(text, delta, { min, max }) {
    const trimmed = String(text ?? "").trim();
    const figure = /^\d+$/.test(trimmed) ? Number(trimmed) : 0;
    if (delta < 0) return String(Math.max(min, (figure || min) - 1));
    return String(Math.min(max, (figure || min - 1) + 1));
}

/**
 * What a number field keeps of what was typed: its digits, and one more of them than the
 * ceiling has — so a figure past the ceiling can still be typed and refused, which is the
 * state the design draws (1b, `Refused`), where a field clamped as you typed could not
 * show why a count was too many.
 */
export function numberFieldText(raw, max) {
    return String(raw ?? "")
        .replace(/[^0-9]/g, "")
        .slice(0, String(max).length + 1);
}

/**
 * What a button is while the form it stands in waits on its submission (0f Working,
 * #469): `"working"` for the one doing the work, `"locked"` for every other button of
 * that form, and null for one with nothing to wait on.
 *
 * THE ONE THAT SUBMITS IS THE WORK BEING DONE. A dialog hands its frame `busy` while its
 * submission is in flight and the frame hands it to everything it holds, so the form's
 * submit draws 0f's Working — whatever was pressed to send it, the submit or Enter in a
 * field — and every other control locks with it. A button outside such a form is what its
 * own `busy` says, which is how the sign-in steps have it (#473). A disabled button is
 * neither: it cannot act, and it does not hold focus to keep.
 *
 * NEITHER STATE IS DISABLED, AND THAT IS THE POINT OF THEM. A control disabled under the
 * reader's press gives up the focus it holds, which left focus on the document when the
 * dialogs' commitments were disabled while they sent (#458); a working or a locked button
 * keeps it, and turns the press away instead.
 */
export function buttonBusyState({ busy = false, formBusy = false, submits = false, disabled = false }) {
    if (disabled) return null;
    if (busy || (formBusy && submits)) return "working";
    if (formBusy) return "locked";
    return null;
}

/** How far PageUp and PageDown move through a select-only combobox's options. */
const PAGE_STEP = 10;

/**
 * What a key does to a select-only combobox, as the Authoring Practices' action names —
 * or null when the key is not the combobox's.
 *
 * CLOSED, the four that open it are the arrows, Enter and Space; Home and End open it and
 * move; a printable character opens it and searches. OPEN, the arrows and the page keys
 * move, Enter, Space and Alt+Up choose and close, and Escape closes and chooses nothing.
 * Tab is not here: the component closes and chooses on blur, which is what the pattern
 * does with it, so Tab leaves as it always does.
 */
export function selectOnlyKey({ key, altKey = false, ctrlKey = false, metaKey = false }, open) {
    if (!open && ["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) return "open";
    if (key === "Home") return "first";
    if (key === "End") return "last";
    if (key === "Backspace" || key === "Clear" || (key.length === 1 && key !== " " && !altKey && !ctrlKey && !metaKey)) {
        return "type";
    }
    if (!open) return null;
    if (key === "ArrowUp" && altKey) return "closeSelect";
    if (key === "ArrowDown" && !altKey) return "next";
    if (key === "ArrowUp") return "previous";
    if (key === "PageUp") return "pageUp";
    if (key === "PageDown") return "pageDown";
    if (key === "Escape") return "close";
    if (key === "Enter" || key === " ") return "closeSelect";
    return null;
}

/**
 * The option a movement lands on, out of `last + 1` of them, from `current` — which is
 * -1 while nothing holds visual focus, and then the first step down reaches the first.
 * The select-only pattern stops at the ends rather than wrapping.
 */
export function movedIndex(current, last, action) {
    switch (action) {
        case "first":
            return 0;
        case "last":
            return last;
        case "previous":
            return Math.max(0, current - 1);
        case "next":
            return Math.min(last, current + 1);
        case "pageUp":
            return Math.max(0, current - PAGE_STEP);
        case "pageDown":
            return Math.min(last, current + PAGE_STEP);
        default:
            return current;
    }
}

/**
 * Which option a typed search lands on: the first label beginning with it, searching
 * from `start` and wrapping round — or, for a search that is one letter pressed again
 * and again, the next label beginning with that letter, which is how pressing `P` twice
 * reaches the second job that starts with P. -1 when nothing matches.
 */
export function typeaheadIndex(labels, search, start = 0) {
    const from = Math.max(0, Math.min(start, labels.length));
    const ordered = [...labels.slice(from), ...labels.slice(0, from)];
    const begins = (text) => ordered.find((label) => String(label).toLowerCase().startsWith(text.toLowerCase()));
    const found = begins(search);
    if (found !== undefined) return labels.indexOf(found);
    const letters = search.split("");
    if (letters.length > 0 && letters.every((letter) => letter === letters[0])) {
        const again = begins(letters[0]);
        if (again !== undefined) return labels.indexOf(again);
    }
    return -1;
}

/**
 * What a key does to an editable combobox with list autocomplete and manual selection,
 * or null when the key belongs to the textbox — and then its default runs.
 *
 * `shown` is whether the list is on screen, `active` the option holding visual focus (-1
 * while the textbox holds it) and `count` how many options there are. The answer says
 * whether the list shows, which option is active, which one is accepted into the textbox,
 * and whether the key's own default is stopped. Down enters the list at its first option
 * and Up at its last, and both wrap once inside it; Alt with either shows the list and
 * moves nothing. Enter and Tab accept the active option, Enter keeping it from submitting
 * the form and Tab still leaving. Escape shuts a list that is showing. Home, End and the
 * side arrows hand visual focus back to the textbox and move its caret as they always do.
 */
export function editableComboboxKey({ key, altKey = false }, { shown, active, count }) {
    switch (key) {
        case "ArrowDown":
            if (count === 0) return null;
            if (altKey) return { shown: true, active, stop: true };
            return { shown: true, active: active < 0 || active >= count - 1 ? 0 : active + 1, stop: true };
        case "ArrowUp":
            if (count === 0) return null;
            if (active >= 0) return { shown: true, active: active === 0 ? count - 1 : active - 1, stop: true };
            return { shown: true, active: altKey ? -1 : count - 1, stop: true };
        case "Enter":
            if (shown && active >= 0) return { shown: false, active: -1, accept: active, stop: true };
            return shown ? { shown: false, active: -1, stop: false } : null;
        case "Tab":
            if (!shown) return null;
            return active >= 0
                ? { shown: false, active: -1, accept: active, stop: false }
                : { shown: false, active: -1, stop: false };
        case "Escape":
            return shown ? { shown: false, active: -1, stop: true } : null;
        case "Home":
        case "End":
        case "ArrowLeft":
        case "ArrowRight":
            return active >= 0 ? { shown, active: -1, stop: false } : null;
        default:
            return null;
    }
}

/**
 * What a key does on a menu button while its menu is shut — the item the menu opens on —
 * or null when the key is not the pattern's (#478).
 *
 * Down opens it on the first item and Up on the last. Enter and Space are not here: they
 * are the button's own click, which opens the menu on its first item too, so the pointer
 * and the keyboard reach one state.
 */
export function menuButtonKey({ key }) {
    if (key === "ArrowDown") return "first";
    if (key === "ArrowUp") return "last";
    return null;
}

/**
 * What a key does inside an open menu, which holds DOM focus on one of its items, as
 * the pattern's action names — or null when the key is not the menu's (#478).
 *
 * Down and Up move and wrap, Home and End jump to the ends, and a printable character
 * searches. Escape closes the menu and hands focus back to its button. Tab is `leave`:
 * the menu closes and focus goes on as Tab sends it, which is the pattern's rule for a
 * menu outside a menubar — the component lets the key run and closes as focus leaves.
 * Enter and Space are not here, because each item is a button and activates itself.
 */
export function menuKey({ key, altKey = false, ctrlKey = false, metaKey = false }) {
    switch (key) {
        case "ArrowDown":
            return "next";
        case "ArrowUp":
            return "previous";
        case "Home":
            return "first";
        case "End":
            return "last";
        case "Escape":
            return "close";
        case "Tab":
            return "leave";
        default:
            return key.length === 1 && key !== " " && !altKey && !ctrlKey && !metaKey ? "type" : null;
    }
}

/** The item a movement lands on, out of `count` of them: a menu wraps at both ends. */
export function menuIndex(current, count, action) {
    switch (action) {
        case "first":
            return 0;
        case "last":
            return count - 1;
        case "next":
            return (current + 1) % count;
        case "previous":
            return (current - 1 + count) % count;
        default:
            return current;
    }
}
