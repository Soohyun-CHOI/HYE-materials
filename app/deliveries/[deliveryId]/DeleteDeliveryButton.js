"use client";

import { useActionState, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { deleteDeliveryAction } from "./actions";

/**
 * Delete confirmation (#162).
 *
 * `title` and `body` are resolved on the SERVER by
 * lib/deliveryDelete.js:resolveDeleteCopy and passed in as plain strings — the
 * three voices branch on whether the affected PO lines are invoiced and whether
 * their invoice is paid, which needs Airtable reads, and functions cannot cross
 * the server/client boundary anyway. Keeping the branch there means this
 * component never decides what the deletion means.
 *
 * Consumes MODAL_BACKDROP/MODAL_CARD rather than inlining the chrome (#126).
 */
export default function DeleteDeliveryButton({ deliveryId, title, body }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, pending] = useActionState(deleteDeliveryAction, {});

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
            >
                Delete this delivery
            </button>

            {state?.error && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-500">{state.error}</p>
            )}

            {open && (
                <div className={MODAL_BACKDROP}>
                    <div className={`${MODAL_CARD} max-w-md`}>
                        <h2 className="text-lg font-medium">{title}</h2>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>

                        <form action={formAction} className="mt-5 flex justify-end gap-3">
                            <input type="hidden" name="deliveryId" value={deliveryId} />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={pending}
                                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
                            >
                                Keep it
                            </button>
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                                {pending ? "Deleting…" : "Delete"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
