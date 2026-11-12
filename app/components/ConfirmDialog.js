"use client";

import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";

// Generic, reusable confirmation modal — replaces window.confirm() (native,
// unstyled, always prefixed with the origin) wherever the app needs a
// "are you sure?" gate before a destructive/irreversible-feeling action.
// Stateless: the caller owns `open` and what happens on confirm/cancel.
//
// ON THE OLD FRAME, UNTIL ITS SCREEN TAKES THE DESIGN (#258). It drew its own
// backdrop and card, the same classes as `modalStyles.js`' but for a backdrop at
// 50% where that file's is 40%, so the app had three modal stylings rather than
// the two CLAUDE.md names; #258 put it on that file's, which moved the backdrop
// to 40% and nothing else. What it still lacks is the design frame's behavior —
// it does not close on `Escape` and hands focus back to nothing — and
// `DialogFrame.js` is that behavior: the invoice form's design
// moves it there, as it does the form's other dialogs, and
// `offline/dialog-frame.mjs` lists every file still on this frame until then.
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel = "Continue",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    return (
        <div className={MODAL_BACKDROP} onClick={onCancel}>
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className={`${MODAL_CARD} max-w-sm`}
            >
                {title && <h2 className="text-base font-semibold">{title}</h2>}
                <p className="mt-2 text-sm text-zinc-600">{message}</p>
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded bg-foreground px-3 py-1.5 text-sm text-background"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
