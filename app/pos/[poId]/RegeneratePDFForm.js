"use client";

import { useActionState } from "react";
import { regeneratePDFAction } from "./actions";

// Fallback for when signPOAction's PDF step failed (see lib/poPdf.js) — a
// Signed PO with no PDF is a real gap, so unlike the email notifications
// elsewhere in this project, this needs a visible retry rather than being
// silently swallowed.
export default function RegeneratePDFForm({ poId }) {
    const [state, formAction, pending] = useActionState(regeneratePDFAction, null);

    return (
        <form action={formAction} className="space-y-2">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="poId" value={poId} />
            <button
                type="submit"
                disabled={pending}
                className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700 disabled:opacity-50"
            >
                {pending ? "Generating..." : "Regenerate PDF"}
            </button>
        </form>
    );
}
