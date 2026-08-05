"use client";

import { useActionState, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { InferredMarker } from "@/app/components/DeliveryStatusMarks";
import { createOverageDraftAction } from "./actions";

/**
 * Raise the corrective request for one over-delivery (#167).
 *
 * THE PREVIEW IS RESOLVED ON THE SERVER — `messages` arrives as plain strings from
 * lib/overage.js:describeOveragePreview, the same arrangement DeleteDeliveryButton
 * uses for its three voices. Every input the preview names (the unit price, the
 * invoice, how many signers were dropped) needs Airtable reads, and a function
 * cannot cross the boundary anyway, so this component never decides what the button
 * is about to do.
 *
 * The inferred marker is #166's own component, because it is #166's ambiguity: the
 * ordered item carries more than one bill and the oldest is taken. Reusing the
 * component keeps the two markers from becoming two shapes for one idea.
 */
export default function OverageButton({ deliveryItemId, messages, inferred, inferredLabel }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, pending] = useActionState(createOverageDraftAction, {});

    return (
        <>
            <span className="inline-flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700"
                >
                    Raise a correction
                </button>
                {inferred && <InferredMarker label={inferredLabel} />}
            </span>

            {state?.error && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-500">{state.error}</p>
            )}

            {open && (
                <div className={MODAL_BACKDROP}>
                    <div className={`${MODAL_CARD} max-w-lg`}>
                        <h2 className="text-lg font-medium">Raise a correction for this over-delivery</h2>
                        <div className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                            {messages.map((m, i) => (
                                <p key={i}>{m}</p>
                            ))}
                        </div>

                        <form action={formAction} className="mt-5 flex justify-end gap-3">
                            <input type="hidden" name="deliveryItemId" value={deliveryItemId} />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={pending}
                                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-50"
                            >
                                {pending ? "Opening the draft…" : "Open the draft"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
