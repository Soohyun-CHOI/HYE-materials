// Single source for the centered-overlay modal chrome shared across the
// app (issue #126). Previously these exact Tailwind strings were hardcoded
// in five places — the invoice delete confirm (DeleteInvoiceButton.js),
// PRForm's resume / draft-list / draft-saved modals, and the withdraw
// confirm (WithdrawPRForm.js, #122). All five now import from here.
//
// MODAL_CARD deliberately carries NO max-w-* width: width is the caller's
// responsibility, appended per call site (max-w-md for the four standard
// modals, max-w-lg for the wider drafts-list modal). Baking a default
// width into the constant and overriding it at one call site would put two
// competing max-w-* classes on the same element, where the winner is
// decided by Tailwind's CSS source order, not the className string order —
// fragile. Keeping width out entirely means each element has exactly one
// max-w-* class, so it always applies, and the rendered result is
// byte-for-byte what each modal had before this extraction.

export const MODAL_BACKDROP =
    "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";

export const MODAL_CARD =
    "w-full rounded-lg border border-zinc-300 bg-white p-5 shadow-lg";
