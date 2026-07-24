"use client";

import { useActionState, useState } from "react";
import { withdrawAction } from "./actions";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";

// Issue #122 — the Requester's own "withdraw this PR" control. Distinct
// from SigningPanel (which is the current signer's turn-gated actions):
// withdraw is a Requester-level action independent of whose turn it is, so
// it lives in its own section on the detail page.
//
// A centered confirm modal (not an inline reveal) guards this: withdraw is
// a terminal action on a top-level entity, occurring on its own full detail
// page — the same weight as the invoice delete confirm
// (DeleteInvoiceButton.js), and unlike the drafts-list inline confirm
// (#109), which was inline only to avoid stacking a second modal on top of
// the already-open drafts modal. The backdrop/card chrome comes from the
// shared modal-style constants (app/components/modalStyles.js, #126); this
// modal supplies its own max-w-md width.
//
// Only the confirmation UI is a modal — withdrawAction, its requester +
// In-Review re-validation, and the ?done=withdrawn redirect are unchanged;
// the confirm button still submits the same form (useActionState +
// formData with a hidden prId). No reason field: withdraw ends the request,
// it isn't a correction dialogue.
export default function WithdrawPRForm({ prId }) {
    const [state, formAction, pending] = useActionState(withdrawAction, null);
    const [open, setOpen] = useState(false);

    function close() {
        // Never yank the modal out from under an in-flight submit.
        if (pending) return;
        setOpen(false);
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 dark:border-red-800 dark:text-red-400"
            >
                Withdraw this PR
            </button>

            {open && (
                <div className={MODAL_BACKDROP} onClick={close}>
                    {/* On success withdrawAction redirects away; only an error
                        returns here, so the modal stays open to show it. */}
                    <form
                        action={formAction}
                        className={`${MODAL_CARD} max-w-md`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input type="hidden" name="prId" value={prId} />
                        <h2 className="text-lg font-semibold">Withdraw this PR?</h2>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            This ends the request and can&apos;t be undone. {prId} stays on record as{" "}
                            <strong>Withdrawn</strong> with its history intact — it just can no longer
                            be signed.
                        </p>
                        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
                        <div className="mt-4 flex flex-row-reverse gap-3">
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                            >
                                {pending ? "Withdrawing..." : "Withdraw PR"}
                            </button>
                            <button
                                type="button"
                                onClick={close}
                                disabled={pending}
                                className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
}
