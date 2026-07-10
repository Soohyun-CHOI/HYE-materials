"use client";

import { useActionState } from "react";
import { returnForCorrectionAction } from "./actions";

// Defaults to "Requester" — per product decision, returning a PR for
// correction to the person who originally filled it out is by far the
// most common case; the dropdown covers the rarer "send it to an earlier
// signer instead" case.
export default function ReturnForCorrectionForm({ prId, targets, usersById, onCancel }) {
    const [state, formAction, pending] = useActionState(returnForCorrectionAction, null);

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

            <div>
                <label htmlFor="target" className="block text-sm font-medium">
                    Send back to
                </label>
                <select
                    id="target"
                    name="target"
                    defaultValue="requester"
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                >
                    {targets.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.type === "requester"
                                ? `Requester (${usersById[t.userId]?.userName || "?"})`
                                : `${t.sequenceOrder}. ${usersById[t.userId]?.userName || "?"}`}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="returnNotes" className="block text-sm font-medium">
                    What needs to be corrected?
                </label>
                <textarea
                    id="returnNotes"
                    name="notes"
                    rows={3}
                    required
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                />
            </div>

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
                >
                    {pending ? "Sending..." : "Send back"}
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
