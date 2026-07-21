"use client";

// Generic, reusable confirmation modal — replaces window.confirm() (native,
// unstyled, always prefixed with the origin) wherever the app needs a
// "are you sure?" gate before a destructive/irreversible-feeling action.
// Stateless: the caller owns `open` and what happens on confirm/cancel.
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
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-lg border border-zinc-300 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
                {title && <h2 className="text-base font-semibold">{title}</h2>}
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
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
