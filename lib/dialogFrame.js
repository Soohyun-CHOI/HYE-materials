// The words the dialog frame says (#456) — the frame being `app/components/DialogFrame.js`,
// Claude Design's 0l drawn once for every dialog on the tools axis.
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
