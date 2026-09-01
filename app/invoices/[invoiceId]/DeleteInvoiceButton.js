"use client";

import { useState } from "react";
import { deleteInvoiceAction } from "./actions";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";

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
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700"
            >
                Delete invoice
            </button>

            {open && (
                <div className={MODAL_BACKDROP} onClick={close}>
                    <div
                        className={`${MODAL_CARD} max-w-md`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-lg font-semibold">Delete this invoice?</h2>
                        <p className="mt-2 text-sm text-zinc-600">
                            {/* THE SPACE IS EXPLICIT BECAUSE JSX EATS IT. A text node
                                that starts a new line loses its leading whitespace, so
                                `{invoiceId}` at the end of one line and ` and its…` on
                                the next rendered as `HYE-INV-260901-01and its invoice
                                items`. Read in a browser during #321, which needed this
                                modal to be the thing that names the invoice before it
                                goes — deleting an invoice lands on the list and says
                                nothing there. */}
                            {invoiceId}{" "}
                            and its invoice items will be permanently deleted. The linked
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
                                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50"
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
