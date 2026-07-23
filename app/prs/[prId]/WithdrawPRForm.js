"use client";

import { useActionState, useState } from "react";
import { withdrawAction } from "./actions";

// Issue #122 — the Requester's own "withdraw this PR" control. Distinct
// from SigningPanel (which is the current signer's turn-gated actions):
// withdraw is a Requester-level action independent of whose turn it is, so
// it lives in its own section on the detail page.
//
// Progressive-disclosure confirm rather than a browser confirm() —
// consistent with ReturnForCorrectionForm's reveal-in-place and the drafts
// list's inline delete confirm (#109). The button reveals a short warning
// plus Confirm/Cancel; withdraw is terminal (no revive path), so the
// warning says so. No reason field: withdraw ends the request, it isn't a
// correction dialogue.
export default function WithdrawPRForm({ prId }) {
    const [state, formAction, pending] = useActionState(withdrawAction, null);
    const [confirming, setConfirming] = useState(false);

    if (!confirming) {
        return (
            <div>
                {state?.error && (
                    <p className="mb-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {state.error}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="rounded border border-red-300 px-4 py-2 text-sm text-red-700 dark:border-red-800"
                >
                    Withdraw this PR
                </button>
            </div>
        );
    }

    return (
        <form
            action={formAction}
            className="space-y-3 rounded border border-red-300 p-4 dark:border-red-800"
        >
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="prId" value={prId} />
            <p className="text-sm">
                Withdraw this PR? This ends the request and can&apos;t be undone. The PR stays on
                record as <strong>Withdrawn</strong> with its history intact — it just can no longer
                be signed.
            </p>
            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                    {pending ? "Withdrawing..." : "Withdraw PR"}
                </button>
                <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    disabled={pending}
                    className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
