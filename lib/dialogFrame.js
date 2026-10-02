// The words the dialog frame says (#456) — the frame being `app/components/DialogFrame.js`,
// Claude Design's 0l drawn once for every dialog on the tools axis — and since #469 the one
// judgment it makes about focus.
//
// THE FRAME'S OWN WORDS AND NOBODY ELSE'S. What a dialog asks, and the words of its
// controls, belong to the dialog and to `lib/controls.js`; this holds only what the frame
// draws whatever it is opened for, which is its close. Split along the frame's own edge,
// the one `app/components/DialogFrame.js` and `app/components/Controls.js` are split on:
// a screen drawing a button imports the controls and never the frame, so the frame's
// words cannot ride into a module that has no dialog in it.
//
// PURE AND OFFLINE-SAFE, importing nothing, so the frame — a `"use client"` file — can
// import it and `scripts/screen-strings.mjs` and the vocabulary checks can read it.

export const DIALOG_FRAME_COPY = {
    // The close's accessible name. It carries a mark and no word, so this is the only
    // thing a screen reader has for it (0l Head).
    close: "Close",
};

/**
 * Whether an open dialog has let focus fall with nowhere to go (#469), which is when the
 * frame puts it back inside: something in the dialog held focus, that thing can no longer
 * hold it — disabled under it, or taken off the page — and focus is still on it or has
 * fallen to the document.
 *
 * THE BROWSER SAYS NOTHING WHEN IT HAPPENS, which is why this is asked of facts rather than
 * of an event. Measured in this repository's browser on a page of its own: a focused button
 * disabled gives up focus to the document after the next style update, with no `blur` and
 * no `focusout`, and one taken off the page gives it up at once, with none either. So the
 * frame asks this whenever what it holds changes, and the answer is all that decides.
 *
 * FOCUS ANYWHERE ELSE WENT THERE ON PURPOSE, as it does into a sheet opened over the
 * dialog, and a dialog that is shut has nothing to keep: the browser hands focus back to
 * the opener as it closes, and the frame's own closing rules say where it goes from there.
 */
export function focusLost({ open, held, heldCanHold, onHeld, onDocument }) {
    return Boolean(open && held && !heldCanHold && (onHeld || onDocument));
}
