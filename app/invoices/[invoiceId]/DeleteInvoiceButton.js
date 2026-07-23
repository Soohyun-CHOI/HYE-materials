"use client";

import { useState } from "react";
import { deleteInvoiceAction } from "./actions";

// Issue #117 — delete control on the invoice detail page. Clicking Delete
// opens a centered confirm modal (dimmed backdrop) rather than an inline
// swap: this lives on a full page (not inside another modal, so there's no
// stacked-modal problem the way #109's in-list delete had), and a pop-up
// confirm guards a destructive action against accidental clicks. On success
// the server action redirects to the list; only errors return here.
export default function DeleteInvoiceButton({ invoiceId }) {
    const [open, setOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

    function close() {
        if (deleting) return;
        setOpen(false);
        setError(null);
    }

    async function handleDelete() {
        setDeleting(true);
        setError(null);
        try {
            const res = await deleteInvoiceAction(invoiceId);
            // Reached only on failure — a success redirects away.
            if (res?.error) setError(res.error);
            setDeleting(false);
        } catch {
            setError("Couldn't delete the invoice. Please try again.");
            setDeleting(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
            >
                Delete invoice
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                    onClick={close}
                >
                    <div
                        className="w-full max-w-md rounded-lg border border-zinc-300 bg-white p-5 shadow-lg dark:border-zinc-700 dark:bg-black"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold">Delete this invoice?</h2>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {invoiceId} and its line items will be permanently deleted. The linked
                            purchase order(s) are not affected. This can&apos;t be undone.
                        </p>
                        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
                        <div className="mt-4 flex flex-row-reverse gap-3">
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                            >
                                {deleting ? "Deleting..." : "Delete"}
                            </button>
                            <button
                                type="button"
                                onClick={close}
                                disabled={deleting}
                                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
