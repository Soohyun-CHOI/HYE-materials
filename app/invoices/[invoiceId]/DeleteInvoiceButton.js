"use client";

import { useState } from "react";
import { deleteInvoiceAction } from "./actions";

// Issue #117 — delete control on the invoice detail page. Clicking Delete
// swaps into an inline confirm (Cancel / Delete) rather than opening a modal,
// matching the #109 draft-delete pattern (no stacked modals). On success the
// server action redirects to the list; only errors return here.
export default function DeleteInvoiceButton({ invoiceId }) {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

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

    if (!confirming) {
        return (
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
            >
                Delete invoice
            </button>
        );
    }

    return (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <p>Delete this invoice and its line items? This can&apos;t be undone.</p>
            {error && <p className="mt-1 text-red-600">{error}</p>}
            <div className="mt-2 flex flex-row-reverse gap-2">
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
                >
                    {deleting ? "Deleting..." : "Delete"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setConfirming(false);
                        setError(null);
                    }}
                    disabled={deleting}
                    className="rounded border border-zinc-300 px-3 py-1 disabled:opacity-50 dark:border-zinc-700"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
