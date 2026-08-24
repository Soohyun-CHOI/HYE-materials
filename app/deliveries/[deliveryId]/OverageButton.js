"use client";

import { useActionState, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { QualifierMarker } from "@/app/components/DeliveryStatusMarks";
import { createOverageDraftAction } from "./actions";

/**
 * Raise the overage request for one over-delivery (#167).
 *
 * THE PREVIEW IS RESOLVED ON THE SERVER — `messages` arrives as plain strings from
 * lib/overage.js:describeOveragePreview, the same arrangement DeleteDeliveryButton
 * uses for its three voices. Every input the preview names (the unit price, the
 * invoice, how many signers were dropped) needs Airtable reads, and a function
 * cannot cross the boundary anyway, so this component never decides what the button
 * is about to do.
 *
 * The marker is #166's own component, because it began as #166's ambiguity: the
 * ordered item carries more than one invoice and the oldest is taken. Reusing the
 * component keeps the markers in this app from becoming several shapes for one idea —
 * which is also why #210 renamed it `QualifierMarker`, having removed the OTHER
 * inference the old name was taken from.
 *
 * #265 CHANGED WHAT IT MEANS AND KEPT THE SHAPE. It stood for an INFERENCE until
 * then: the app had picked a document without being able to say the excess was invoiced
 * at all. The agreement rule made that guess unnecessary — a request is offered
 * only where the two documents meet above the order — so what is left is a TIE-BREAK,
 * and the sentence says several invoices could have supplied the quotation at the same
 * price. The `!` is the same `!`; it no longer says the app guessed.
 *
 * `tieBreakLabel` is the sentence lib/overage.js already writes for the preview, so
 * the tooltip and the line inside the modal cannot come to explain the same choice
 * differently. IT IS ALSO THE WHOLE CONDITION: it arrives null when nothing was passed
 * over, so a separate flag would be a second copy of one fact that could disagree
 * with it.
 */
export default function OverageButton({ deliveryItemId, messages, tieBreakLabel }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, pending] = useActionState(createOverageDraftAction, {});

    return (
        <>
            <span className="inline-flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="rounded border border-zinc-300 px-2 py-0.5 text-xs"
                >
                    Raise the request
                </button>
                {tieBreakLabel && <QualifierMarker label={tieBreakLabel} />}
            </span>

            {state?.error && (
                <p className="mt-1 text-xs text-red-700">{state.error}</p>
            )}

            {open && (
                <div className={MODAL_BACKDROP}>
                    <div className={`${MODAL_CARD} max-w-lg`}>
                        <h2 className="text-lg font-medium">Raise a request for this over-delivery</h2>
                        <div className="mt-3 space-y-2 text-sm text-zinc-600">
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
                                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
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
