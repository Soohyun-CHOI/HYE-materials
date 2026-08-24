"use client";

import { useActionState, useState } from "react";
import { MODAL_BACKDROP, MODAL_CARD } from "@/app/components/modalStyles";
import { DIRECT_PURCHASE_COPY } from "@/lib/directPurchase";
import { claimDirectPurchaseAction } from "./actions";

/**
 * Raise the purchase request for one direct purchase (#272).
 *
 * A PREVIEW RATHER THAN A BARE BUTTON, which is #217's rule for the strip beside
 * this one: pressing it makes you the requester of a document somebody else
 * recorded, so the modal says what the draft will arrive with and what it will
 * not. It also says the row stays on the list until the request is submitted —
 * the behavior `lib/prWait.js` exists for, and the one thing a reader would
 * otherwise be surprised by.
 *
 * The words are lib/directPurchase.js's, as the strip's are: this file is the
 * rendering and the open/closed state, and nothing else.
 */
export default function DirectPurchaseButton({ directPurchaseId, vendorName, vendorInvoiceCode }) {
    const [open, setOpen] = useState(false);
    const [state, formAction, pending] = useActionState(claimDirectPurchaseAction, {});

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-zinc-300 px-2 py-0.5 text-xs"
            >
                {DIRECT_PURCHASE_COPY.claim.confirm}
            </button>

            {state?.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}

            {open && (
                <div className={MODAL_BACKDROP}>
                    <div className={`${MODAL_CARD} max-w-lg`}>
                        <h2 className="text-lg font-medium">{DIRECT_PURCHASE_COPY.claim.heading}</h2>
                        <div className="mt-3 space-y-2 text-sm text-zinc-600">
                            <p>
                                {
                                    DIRECT_PURCHASE_COPY.claim.summary({ vendorName, vendorInvoiceCode })
                                        .text
                                }
                            </p>
                            <p>{DIRECT_PURCHASE_COPY.claim.stays.text}</p>
                        </div>

                        <form action={formAction} className="mt-5 flex justify-end gap-3">
                            <input type="hidden" name="directPurchaseId" value={directPurchaseId} />
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={pending}
                                className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                            >
                                {DIRECT_PURCHASE_COPY.claim.cancel}
                            </button>
                            <button
                                type="submit"
                                disabled={pending}
                                className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
                            >
                                {pending ? "Opening..." : DIRECT_PURCHASE_COPY.claim.confirm}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
