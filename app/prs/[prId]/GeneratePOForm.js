"use client";

import { useActionState } from "react";
import { generatePOAction } from "./actions";

// Fallback UI for when the auto-trigger in approveAction/editAndContinueAction
// failed (see lib/poGeneration.js) — an Approved PR with no PO is a real gap,
// so unlike email notifications this needs a visible retry path rather than
// being silently swallowed.
export default function GeneratePOForm({ prId }) {
    const [state, formAction, pending] = useActionState(generatePOAction, null);

    return (
        <form action={formAction} className="space-y-2">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="prId" value={prId} />
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Generating..." : "Generate PO"}
            </button>
        </form>
    );
}
