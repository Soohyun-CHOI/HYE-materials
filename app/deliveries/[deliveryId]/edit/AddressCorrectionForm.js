"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { ADDRESS_CHOICE_COPY } from "@/lib/addressChoice";
import { DELIVERY_ADDRESS_COPY, DELIVERY_ADDRESS_CORRECTION_COPY as COPY, addAddressPath } from "@/lib/deliveryAddress";
import { correctDeliveryAddressAction } from "../actions";

// EVERY IMPORT HERE MUST BE CLIENT-SAFE: importing a module EXECUTES it, and anything reaching
// lib/airtable/client.js throws in the browser. `lib/deliveryAddress.js` and
// `lib/addressChoice.js` are pure; scripts/tests/offline/client-import-safety.mjs fails the mistake.

/**
 * Correct the delivery's address to another of its job's (#680) — a form of its own, as the photo
 * is, because it has its own refusals and its own row on the delivery's activity.
 *
 * THE OPTIONS ARE THE JOB'S ADDRESSES LESS THE ONE IT STANDS AT, worked out on the server by
 * `correctionOptions`, the list the entry form offers. With none there is nothing to pick, so the
 * reader is told why and given the way to add one. The form names the address it was drawn with,
 * so a correction made elsewhere since is refused rather than recorded as starting from the wrong
 * place.
 *
 * SENT FROM `onSubmit` RATHER THAN AS THE FORM'S `action`: a form action resets the form once it
 * returns, the picker included, and a refusal keeps what was picked — `IssueForm`'s reason (#675).
 * A correction that stands lands on the delivery, whose address line and activity say it (#321).
 */
export default function AddressCorrectionForm({ deliveryId, shownAddressId, options, jobCode, standsOffJobLabel }) {
    const [state, formAction, pending] = useActionState(correctDeliveryAddressAction, null);
    const [picked, setPicked] = useState("");
    // A pick the list no longer holds is no pick: a stale page refused as out of date redraws
    // with the delivery where it now stands, and the address it was picking may be that one.
    const addressRecordId = options.some((address) => address.id === picked) ? picked : "";

    function handleSubmit(event) {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        startTransition(() => formAction(new FormData(event.currentTarget)));
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 space-y-3 border-t border-zinc-200 pt-6">
            <input type="hidden" name="deliveryId" value={deliveryId} />
            <input type="hidden" name="shownAddressId" value={shownAddressId} />
            <div>
                <label htmlFor="correctAddress" className="block text-sm font-medium">
                    {ADDRESS_CHOICE_COPY.label}
                </label>
                <p className="mt-1 text-xs text-zinc-500">{COPY.lead}</p>
                {standsOffJobLabel ? <p className="mt-1 text-xs text-amber-700">{COPY.standsOffJob(standsOffJobLabel)}</p> : null}
                {options.length > 0 ? (
                    <select
                        id="correctAddress"
                        name="addressRecordId"
                        value={addressRecordId}
                        onChange={(e) => setPicked(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    >
                        <option value="">{ADDRESS_CHOICE_COPY.pickerUnchosen}</option>
                        {options.map((address) => (
                            <option key={address.id} value={address.id}>
                                {address.addressLabel}
                            </option>
                        ))}
                    </select>
                ) : (
                    <p className="mt-1 text-sm text-zinc-600">
                        {COPY.noOther(jobCode)}{" "}
                        <Link href={addAddressPath(jobCode)} className="underline">
                            {DELIVERY_ADDRESS_COPY.addAddress}
                        </Link>
                    </p>
                )}
            </div>
            {state?.error ? (
                <p role="alert" className="text-sm text-red-700">
                    {state.error}
                </p>
            ) : null}
            {options.length > 0 ? (
                <button
                    type="submit"
                    disabled={pending || !addressRecordId}
                    className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50"
                >
                    {pending ? COPY.busy : COPY.submit}
                </button>
            ) : null}
        </form>
    );
}
