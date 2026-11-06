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
// the action refuses on: a site manager on the item's own job (#597), in every status the app
// shows since #612 (lib/assetStatus.js:mayWriteDetailsIn). Everybody else reads it, and a
// reader who may not write meets nothing where an item has none (0a Note). The action asks
// `recordingRefusal` before this module, as the other two do (#597): a note records no job, but
// a page drawn on the job the item has since left is one whose press is said and not saved.
//
// APPLIED BY THE ACTION, PREVIEWED BY THE PAGE — lib/assetTransition.js's arrangement. The
// desk's row and the phone's sheet ask `readNoteSubmission` of what is typed before they
// send, against the note the page drew, and the action asks it again against the note it read,
// so a refusal the screen shows and one the action returns are one function's.
//
// PURE AND OFFLINE-SAFE. It imports ./itemNaming.js and ./assetTransition.js with the
// extension spelled out, the precedent this axis's pure modules set for the offline tier's
// loaderless `node`; nothing here reaches lib/airtable/, so the row and the sheet — "use
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
    const { value, refusal } = readDetail(typed, noteDetail());
    return { note: value, refusal };
}

/**
 * One of an item's details as typed (#533, #601): `{ value, refusal }` — the value `detail.keep` makes of
 * it, or the detail's `tooLong` past `detail.max`, measured on what is typed. The note's rule, and the
 * serial number's since #601 (`lib/assetSerial.js`), each with its own keeper, limit and words.
 */
function readDetail(typed, detail) {
    const text = String(typed ?? "");
    if (text.length > detail.max) return { value: null, refusal: detail.tooLong };
    return { value: detail.keep(text), refusal: null };
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
 * `ended` COMES FIRST AND SAYS NOTHING. The plan stopped allowing it — since #612 only a status no
 * screen shows does, where until then an item retired or sent for repair did — so the page drawn
 * again draws no control to write with, and the fact the reader needs is on it, which is #378's
 * terminal case. A reader no longer on the item's job is told
 * before this is asked (`lib/assetTransition.js:recordingRefusal`, #597), since the page drawn
 * again does not say that the press was theirs and was not saved.
 * A changed note is asked before the length, since a reader who typed too much over a note
 * somebody else replaced needs the second fact first.
 */
export function readNoteSubmission(plan, input) {
    const answer = readDetailSubmission(Boolean(plan?.mayWriteNote), input, noteDetail());
    return Object.hasOwn(answer, "value") ? { note: answer.value } : answer;
}

/**
 * What a press writing one of an item's details does (#601) — `readNoteSubmission`'s order, asked of the
 * note and of the serial number alike, so the two cannot answer a press in two orders: `{ ended: true }`
 * when `may` is false, `{ refusal, stale: true }` when the value the screen was drawn with is not the
 * one stored, `{ refusal }` when what was typed cannot be kept, `{ unchanged: true }` when it keeps to
 * the value there, and `{ value }` otherwise — the empty string for a value cleared. `detail` is
 * `{ keep, max, tooLong, changedFirst }`.
 */
export function readDetailSubmission(may, { typed, previous, stored }, detail) {
    if (!may) return { ended: true };
    if (detail.keep(previous) !== detail.keep(stored)) return { refusal: detail.changedFirst, stale: true };
    const { value, refusal } = readDetail(typed, detail);
    if (refusal) return { refusal };
    if (value === detail.keep(stored)) return { unchanged: true };
    return { value };
}

/** The note as a detail (#601): its keeper, its limit and its two refusals. */
function noteDetail() {
    return { keep: keptNote, max: NOTE_MAX, tooLong: ASSET_NOTE_COPY.tooLong, changedFirst: ASSET_NOTE_COPY.changedFirst };
}

/**
 * Every word the screens say about a note (#533) — the asset's page at both widths and 1d's
 * column head.
 */
export const ASSET_NOTE_COPY = {
    // ONE WORD FOR THE FIELD AND THE COLUMN: the desk's row in `Details` and the name its field is
    // heard by, the name the phone sheet's field is heard by, and the head of 1d's column (1d, 1f,
    // 1j-b2). It is the field's name on
    // the base too, `Assets."Note"` — a screen word and a field that are one string, so nobody
    // searches the base for a word that is not there (`docs/notes/naming.md`).
    label: "Note",

    // THE TWO OPENINGS, AND THEIR TITLES. With no note, the desk's `Add` is named `Add note` (1f),
    // and the phone's sheet is titled so; with one, the sheet is `Edit note` (1j-b2), the desk's
    // opener at the row's end says `Edit` and is named `Edit note`, and so is the phone's line, as
    // the design names it. Until the files of 2026-11-04 a desk opened a dialog titled the same. The phone's
    // line holding no note reads `Add a note` (1j-a, 0a Note), a sentence in the line's place
    // rather than an opener's word, and is named by it.
    addNote: "Add note",
    editNote: "Edit note",
    edit: "Edit",
    addANote: "Add a note",
    // THE DESK'S OPENER WHERE THERE IS NONE, IN `Details` SINCE #601 (1f): `Add` with its plus mark,
    // named `Add note` — the row's label says what it adds.
    add: "Add",

    // THE LINE UNDER THE FIELD, AND THE COUNT AT ITS END (0a Note, 1f, 1j-b2). Built from the
    // limit, so the sentence and the count cannot name two figures.
    help: `Up to ${NOTE_MAX} characters.`,
    count: (length) => `${length}/${NOTE_MAX}`,
    // THE FIELD'S REFUSAL, in the help's place: what to do rather than the ceiling's word, Soo's
    // since #612, where it was the design's `Max 50 characters.` (1f, 1j-b2) from #533. The help
    // above it keeps the figure, so the two still name one.
    tooLong: `Use ${NOTE_MAX} characters or fewer.`,

    // THE DESK ROW'S ACTIONS, UNDER ITS FIELD (1f): `Save` whether a note is there or not, the
    // design's word since the files of 2026-11-04, which took away the dialog whose commitment said
    // `Add note` over none and whose `Remove note` stood at its left — a cleared field saved removes
    // it. `Cancel` is the app's word for abandoning what was typed, the transition's, read out of it
    // rather than spelled again.
    save: "Save",
    cancel: ASSET_TRANSITION_COPY.cancel,
    // THE PHONE SHEET'S END, WHICH SAVES (0a Note: "Done saves"). The name sheet's `Done` is the
    // same word for a different act — it puts the sheet away and keeps what was typed for the
    // field behind it — so each module keeps its own.
    done: "Done",
    // The name of the mark that empties the sheet's field (Tools 0a's Field), the name sheet's.
    clear: ASSET_TRANSITION_COPY.clearName,

    // WHAT A SENDING SAYS WHILE IT IS ON ITS WAY: 0f's Working, the verb in its `-ing` form with
    // an ellipsis — the change the press makes, `Save` and `Done` alike, as Tools 0a and Invoices
    // 0f say it since the files of 2026-11-06 (#616) — heard and not seen, as every action on this
    // page shows its spinner alone (#495).
    working: {
        save: "Saving…",
        add: "Adding…",
        remove: "Removing…",
    },

    // A NOTE SOMEBODY ELSE CHANGED WHILE THIS ONE WAS BEING WRITTEN, in 1k's order since #612,
    // Soo's: what happened first, then what became of the press — as `Jisoo Park already checked
    // this out on …. Your check-out wasn't saved.` does — and names nobody, since nothing records
    // who wrote a note. The page is drawn again with it (#378), so the note above the field is
    // already the other person's.
    changedFirst: "Someone else changed this note first. Nothing was saved.",
};
