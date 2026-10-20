// An item's note (#533) — the one line a site manager keeps on an asset: what a typed note
// becomes, when a press writing one is refused, and every word the screens say about it.
//
// NOT AN EVENT, WHICH IS THE FACT EVERYTHING HERE FOLLOWS FROM. A check-out, a check-in, a
// repair and a retirement each append an `Asset Log` row and move the two caches on `Assets`;
// a note is `Assets."Note"` and nothing else, written in place. So changing it adds nothing to
// the item's history, nothing records who wrote it or when, and a category's list, which says
// the day each item last changed off that history (#520), moves no day for it. The label does
// not print it: a label is built from the printed id alone (`lib/assetLabelQR.js`).
//
// WHO MAY WRITE IT IS `planTransition`'s `mayWriteNote`, the one answer the page offers on and
// the action refuses on: a site manager on a job, while the item is in stock or out
// (lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS). Everybody else reads it, and a reader who
// may not write meets nothing where an item has none (0a Note).
//
// APPLIED BY THE ACTION, PREVIEWED BY THE PAGE — lib/assetTransition.js's arrangement. The
// desk's dialog and the phone's sheet ask `readNoteSubmission` of what is typed before they
// send, against the note the page drew, and the action asks it again against the note it read,
// so a refusal the screen shows and one the action returns are one function's.
//
// PURE AND OFFLINE-SAFE. It imports ./itemNaming.js and ./assetTransition.js with the
// extension spelled out, the precedent this axis's pure modules set for the offline tier's
// loaderless `node`; nothing here reaches lib/airtable/, so the dialog and the sheet — "use
// client" files — import it, and so does `lib/airtable/assets.js`, whose writer holds the
// limit as its backstop.
//
// EVERY STRING A SCREEN RENDERS ABOUT A NOTE IS IN `ASSET_NOTE_COPY` AND NONE IS IN JSX, this
// axis's arrangement since #338, held by `offline/asset-list-view.mjs`.

import { ASSET_TRANSITION_COPY } from "./assetTransition.js";
import { normalizeItemText } from "./itemNaming.js";

/**
 * The most a note may hold, in characters (1f, 1j-b2): the design's `MAX`, which its count
 * under the field reads against.
 */
export const NOTE_MAX = 50;

/**
 * A note as it is kept, and as a stored one is compared: trimmed, each run of spaces one
 * space, its case as typed — `normalizeItemText`, which is the design's own tidy word for word
 * (1f's script). A stored note nobody wrote reads as the empty string.
 */
export function keptNote(value) {
    return normalizeItemText(value);
}

/**
 * What a typed note becomes, or why it cannot be kept: `{ note, refusal }`.
 *
 * THE LIMIT IS MEASURED ON WHAT IS TYPED, AND WHAT IS KEPT IS THE NOTE TIDIED. The count under
 * the field is the field's own length — `String.length`, which the design's script counts — so
 * the count and the refusal can never disagree: a field reading `51/50` refuses, even where the
 * tidy would take a doubled space out. The design refuses on what is typed the same way.
 *
 * AN EMPTY NOTE IS A CLEARED ONE (0a Note: "Done on a cleared field removes the note"), and so is
 * one holding spaces alone, which tidies to nothing. There is no third state between a note and
 * none.
 */
export function readNote(typed) {
    const text = String(typed ?? "");
    if (text.length > NOTE_MAX) return { note: null, refusal: ASSET_NOTE_COPY.tooLong };
    return { note: keptNote(text), refusal: null };
}

/**
 * What a press writing a note does, in the order it is asked: `{ ended: true }` when this
 * reader may not write this item's note now, `{ refusal, stale: true }` when the note the
 * screen showed is not the one stored, `{ refusal }` when what was typed cannot be kept,
 * `{ unchanged: true }` when it tidies to the note already there, and `{ note }` otherwise —
 * the empty string for a note cleared.
 *
 * `previous` IS THE NOTE THE SCREEN WAS DRAWN WITH, which the form carries beside what was
 * typed (#378's question for a press, asked of a note). A note somebody else changed since is
 * refused rather than overwritten unseen: the page is drawn again as the refusal arrives, so the
 * reader sees the note that is there now with what they typed still in the field, and a second
 * press overwrites it knowingly.
 *
 * `ended` COMES FIRST AND SAYS NOTHING. The plan stopped allowing it — the item retired or sent
 * for repair, the reader no longer a site manager or on no job — so the page drawn again draws no
 * control to write with, and the fact the reader needs is on it, which is #378's terminal case.
 * A changed note is asked before the length, since a reader who typed too much over a note
 * somebody else replaced needs the second fact first.
 */
export function readNoteSubmission(plan, { typed, previous, stored }) {
    if (!plan?.mayWriteNote) return { ended: true };
    if (keptNote(previous) !== keptNote(stored)) return { refusal: ASSET_NOTE_COPY.changedFirst, stale: true };
    const { note, refusal } = readNote(typed);
    if (refusal) return { refusal };
    if (note === keptNote(stored)) return { unchanged: true };
    return { note };
}

/**
 * Every word the screens say about a note (#533) — the asset's page at both widths and 1d's
 * column head.
 */
export const ASSET_NOTE_COPY = {
    // ONE WORD FOR THE FIELD AND THE COLUMN: the desk dialog's label, the name the phone sheet's
    // field is heard by, and the head of 1d's column (1d, 1f, 1j-b2). It is the field's name on
    // the base too, `Assets."Note"` — a screen word and a field that are one string, so nobody
    // searches the base for a word that is not there (`docs/notes/naming.md`).
    label: "Note",

    // THE TWO OPENINGS, AND THEIR TITLES. With no note, the desk's opener, the dialog's title
    // and its commitment say `Add note` (1f), and the phone's sheet is titled the same; with one,
    // the dialog and the sheet are `Edit note` (1f, 1j-b2), the desk's opener beside the note
    // says `Edit`, and the phone's line is named `Edit note`, as the design names it. The phone's
    // line holding no note reads `Add a note` (1j-a, 0a Note), a sentence in the line's place
    // rather than an opener's word, and is named by it.
    addNote: "Add note",
    editNote: "Edit note",
    edit: "Edit",
    addANote: "Add a note",

    // What the field shows while it holds nothing — the design's example (1f, 1j-b2).
    placeholder: "e.g. At the Riverside yard",
    // THE LINE UNDER THE FIELD, AND THE COUNT AT ITS END (0a Note, 1f, 1j-b2). Built from the
    // limit, so the sentence and the count cannot name two figures.
    help: `Up to ${NOTE_MAX} characters.`,
    count: (length) => `${length}/${NOTE_MAX}`,
    // THE FIELD'S REFUSAL, in the help's place, the design's (1f, 1j-b2): `Max`, as the
    // registration's `Max 100 at a time.` says its own ceiling.
    tooLong: `Max ${NOTE_MAX} characters.`,

    // THE DESK DIALOG'S ACTIONS (1f): its commitment `Save` over a note there is and `Add note`
    // over none, and `Remove note` at the left while there is one to remove — the design's
    // words. `Cancel` is the app's word for abandoning a dialog, the transition's, read out of
    // it rather than spelled again.
    save: "Save",
    remove: "Remove note",
    cancel: ASSET_TRANSITION_COPY.cancel,
    // THE PHONE SHEET'S END, WHICH SAVES (0a Note: "Done saves"). The name sheet's `Done` is the
    // same word for a different act — it puts the sheet away and keeps what was typed for the
    // field behind it — so each module keeps its own.
    done: "Done",
    // The name of the mark that empties the sheet's field (Tools 0a's Field), the name sheet's.
    clear: ASSET_TRANSITION_COPY.clearName,

    // WHAT A SENDING SAYS WHILE IT IS ON ITS WAY: 0f's Working, the verb in its `-ing` form with
    // an ellipsis. The design draws no submitting state for the note, so these are 0f's rule
    // applied to each commitment's own verb — heard and not seen, as every action on this page
    // shows its spinner alone (#495).
    working: {
        save: "Saving…",
        add: "Adding…",
        remove: "Removing…",
    },

    // A NOTE SOMEBODY ELSE CHANGED WHILE THIS ONE WAS BEING WRITTEN. The design draws no
    // sentence for it, so it takes 1k's two halves in the order a reader needs them: what
    // became of the press, then why — and names nobody, since nothing records who wrote a note.
    // The page is drawn again with it (#378), so the note above the field is already the other
    // person's.
    changedFirst: "Nothing was saved. Someone else changed this note first.",
};
