"use client";

import { useActionState } from "react";
import { signPOAction } from "./actions";

export default function SignForm({ poId }) {
    const [state, formAction, pending] = useActionState(signPOAction, null);

    return (
        <form action={formAction} className="space-y-3">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="poId" value={poId} />
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Signing..." : "Sign PO"}
            </button>
        </form>
    );
}
