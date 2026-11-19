"use client";

import { startTransition, useActionState, useState, useSyncExternalStore } from "react";
import { dayOf, readerTimeZone } from "@/lib/format";
import { INVENTORY_COPY, isoDay, qtyText } from "@/lib/materialStock";
import { issueMaterialsAction } from "./actions";

const COPY = INVENTORY_COPY.issue;

const noSubscription = () => () => {};
const readerToday = () => isoDay(dayOf(new Date(), readerTimeZone()));
const noToday = () => "";

/**
 * Issue materials from one of the addresses holding some (#675). The address is asked only
 * where there is a choice; the date starts at the reader's today, in their own zone — known only
 * in their browser, so the server draws it empty — and may be set back to the day the materials
 * were actually taken. The button is held while the issue is in flight, so one press records one
 * row (`lib/materialStock.server.js`, its first guard).
 *
 * EVERY FIELD IS HELD HERE, AND THE FORM IS SENT FROM `onSubmit` RATHER THAN AS ITS `action`: a
 * form action resets the form once it returns — the address picker included, seen on the test
 * base — and a refusal must keep what was chosen and typed, as `/login/name` does. What it did is said by
 * arriving (#321): a stood issue redraws the page with the new count and the activity row that
 * records it, and the quantity clears for the next.
 */
export default function IssueForm({ jobRecordId, materialRecordId, unit, addresses }) {
    const [state, formAction, pending] = useActionState(issueMaterialsAction, null);
    const [addressRecordId, setAddressRecordId] = useState(addresses.length === 1 ? addresses[0].addressRecordId : "");
    const [qty, setQty] = useState("");
    const [typedDate, setTypedDate] = useState(null);
    const today = useSyncExternalStore(noSubscription, readerToday, noToday);
    const eventDate = typedDate ?? today;

    // The quantity clears once per issue that stood, judged while rendering rather than in an
    // effect: the answer is in hand here.
    const [clearedFor, setClearedFor] = useState(null);
    if (state?.issued && clearedFor !== state.issued) {
        setClearedFor(state.issued);
        setQty("");
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        const form = new FormData(event.currentTarget);
        startTransition(() => formAction(form));
    }

    if (addresses.length === 0) {
        return <p className="mt-8 text-sm text-zinc-600">{INVENTORY_COPY.material.nothingInStock}</p>;
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-4 rounded border border-zinc-200 p-4">
            <h2 className="text-lg font-semibold">{COPY.heading}</h2>
            <input type="hidden" name="jobRecordId" value={jobRecordId} />
            <input type="hidden" name="materialRecordId" value={materialRecordId} />
            {state?.error ? (
                <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            ) : null}
            {addresses.length === 1 ? (
                <input type="hidden" name="addressRecordId" value={addresses[0].addressRecordId} />
            ) : (
                <div>
                    <label htmlFor="issue-address" className="block text-sm font-medium">
                        {COPY.address}
                    </label>
                    <select
                        id="issue-address"
                        name="addressRecordId"
                        value={addressRecordId}
                        onChange={(e) => setAddressRecordId(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    >
                        <option value="">{COPY.addressPlaceholder}</option>
                        {addresses.map((at) => (
                            <option key={at.addressRecordId} value={at.addressRecordId}>
                                {at.label} ({qtyText(at.inStock, unit)})
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label htmlFor="issue-qty" className="block text-sm font-medium">
                    {COPY.qty}
                    {unit ? ` (${unit})` : ""}
                </label>
                <input
                    id="issue-qty"
                    name="qty"
                    inputMode="numeric"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <div>
                <label htmlFor="issue-date" className="block text-sm font-medium">
                    {COPY.date}
                </label>
                <input
                    id="issue-date"
                    name="eventDate"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setTypedDate(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60">
                {pending ? COPY.busy : COPY.submit}
            </button>
        </form>
    );
}
