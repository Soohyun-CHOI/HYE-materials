"use client";

import { useActionState } from "react";
import { approveAction } from "./actions";

export default function ApproveForm({ prId, isAgreement, onCancel }) {
    const [state, formAction, pending] = useActionState(approveAction, null);

    return (
        <form
            action={formAction}
            className="space-y-3 rounded border border-zinc-300 p-4 dark:border-zinc-700"
        >
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="prId" value={prId} />

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
                >
                    {pending
                        ? isAgreement
                            ? "Agreeing..."
                            : "Approving..."
                        : isAgreement
                          ? "Confirm agreement"
                          : "Confirm approval"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
