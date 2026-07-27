"use client";

import { useActionState, useState } from "react";
import { withdrawPOAction } from "./actions";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";

// Issue #138 — the requester's own "withdraw this PO" control, modelled on
// WithdrawPRForm.js (#122): a centered confirm modal rather than an inline
// reveal, since this is a terminal action on a top-level entity from its own
// detail page. Backdrop/card chrome comes from the shared modal-style
// constants (app/components/modalStyles.js, #126); the width class is this
// call site's to supply.
//
// The copy is NOT written here: both the modal wording and the page banner
// branch on whether the president signature is recorded, and they're kept as
// one pair in lib/poWithdraw.js so a later edit can't leave one voice
// describing the old behaviour. The page resolves the branch and passes
// plain strings down (functions can't cross the server/client boundary, and
// lib/poWithdraw.js reaches Airtable — it must never enter the client
// bundle).
//
// No reason field: withdrawal ends the order, it isn't a correction
// dialogue. Server-side re-validation lives in withdrawPOAction ->
// withdrawPOAsRequester, independent of this component rendering at all.
export default function WithdrawPOForm({ poId, title, body }) {
    const [state, formAction, pending] = useActionState(withdrawPOAction, null);
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
                Withdraw this PO
            </button>

            {open && (
                <div className={MODAL_BACKDROP} onClick={close}>
                    {/* On success withdrawPOAction redirects away; only an
                        error returns here, so the modal stays open to show
                        it. */}
                    <form
                        action={formAction}
                        className={`${MODAL_CARD} max-w-md`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input type="hidden" name="poId" value={poId} />
                        <h2 className="text-lg font-semibold">{title}</h2>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
                        {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
                        <div className="mt-4 flex flex-row-reverse gap-3">
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                            >
                                {pending ? "Withdrawing..." : "Withdraw PO"}
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
