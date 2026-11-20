"use client";

import { startTransition, useActionState, useState } from "react";
import { qtyText } from "@/lib/materialStock";
import { TRANSIT_COPY } from "@/lib/materialTransit";
import { sendMaterialsAction } from "./actions";
import { useReaderTimeZone, useReaderToday } from "./readerDay";

const COPY = TRANSIT_COPY.send;

/**
 * Send materials from one of the addresses holding some to an address of an open job (#677) —
 * this job's own others first, then every other open job's, grouped by job. The address it leaves
 * is asked only where there is a choice, and the one it leaves is not offered as where it goes. The
 * date starts at the reader's today and may be set back, never forward; the press sends the
 * reader's zone, so the server judges "later than today" by their day.
 *
 * `IssueForm`'s shape and for its reasons: every field is held here and the form is sent from
 * `onSubmit`, so a refusal keeps what was chosen and typed; the button is held while a press is in
 * flight; a send that stood redraws the page with its row and clears the quantity.
 */
export default function SendForm({ jobRecordId, materialRecordId, unit, addresses, destinations }) {
    const [state, formAction, pending] = useActionState(sendMaterialsAction, null);
    const [pickedFrom, setFrom] = useState("");
    // One address holding some is the address without asking — read on every render, since the form
    // is drawn before the material reaches an address (a receipt) and keeps its state after.
    const fromAddressRecordId = addresses.length === 1 ? addresses[0].addressRecordId : pickedFrom;
    const [destination, setDestination] = useState("");
    const [qty, setQty] = useState("");
    const [typedDate, setTypedDate] = useState(null);
    const today = useReaderToday();
    const timeZone = useReaderTimeZone();
    const sentDate = typedDate ?? today;

    const [clearedFor, setClearedFor] = useState(null);
    if (state?.sent && clearedFor !== state.sent) {
        setClearedFor(state.sent);
        setQty("");
    }

    if (addresses.length === 0) return null;
    if (destinations.length === 0) return <p className="mt-8 text-sm text-zinc-600">{COPY.nowhere}</p>;

    // The address it leaves is no place to send it to, and a choice the new address hides is none.
    const offered = destinations
        .map((job) => ({
            ...job,
            addresses: job.addresses.filter((a) => !(job.jobRecordId === jobRecordId && a.addressRecordId === fromAddressRecordId)),
        }))
        .filter((job) => job.addresses.length > 0);
    const chosen = offered.some((job) => job.addresses.some((a) => `${job.jobRecordId}|${a.addressRecordId}` === destination)) ? destination : "";
    const [toJobRecordId = "", toAddressRecordId = ""] = chosen ? chosen.split("|") : [];

    function handleSubmit(event) {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        startTransition(() => formAction(new FormData(event.currentTarget)));
    }

    return (
        <form onSubmit={handleSubmit} className="mt-8 max-w-sm space-y-4 rounded border border-zinc-200 p-4">
            <h2 className="text-lg font-semibold">{COPY.heading}</h2>
            <input type="hidden" name="jobRecordId" value={jobRecordId} />
            <input type="hidden" name="materialRecordId" value={materialRecordId} />
            <input type="hidden" name="toJobRecordId" value={toJobRecordId} />
            <input type="hidden" name="toAddressRecordId" value={toAddressRecordId} />
            <input type="hidden" name="timeZone" value={timeZone} />
            {state?.error ? (
                <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            ) : null}
            {addresses.length === 1 ? (
                <input type="hidden" name="fromAddressRecordId" value={addresses[0].addressRecordId} />
            ) : (
                <div>
                    <label htmlFor="send-from" className="block text-sm font-medium">
                        {COPY.from}
                    </label>
                    <select
                        id="send-from"
                        name="fromAddressRecordId"
                        value={fromAddressRecordId}
                        onChange={(e) => setFrom(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    >
                        <option value="">{COPY.fromPlaceholder}</option>
                        {addresses.map((at) => (
                            <option key={at.addressRecordId} value={at.addressRecordId}>
                                {at.label} ({qtyText(at.inStock, unit)})
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label htmlFor="send-to" className="block text-sm font-medium">
                    {COPY.to}
                </label>
                <select
                    id="send-to"
                    value={chosen}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                >
                    <option value="">{COPY.toPlaceholder}</option>
                    {offered.map((job) => (
                        <optgroup key={job.jobRecordId} label={job.jobCode}>
                            {job.addresses.map((a) => (
                                <option key={a.addressRecordId} value={`${job.jobRecordId}|${a.addressRecordId}`}>
                                    {a.label}
                                </option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="send-qty" className="block text-sm font-medium">
                    {COPY.qty}
                    {unit ? ` (${unit})` : ""}
                </label>
                <input
                    id="send-qty"
                    name="qty"
                    inputMode="numeric"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <div>
                <label htmlFor="send-date" className="block text-sm font-medium">
                    {COPY.date}
                </label>
                <input
                    id="send-date"
                    name="sentDate"
                    type="date"
                    max={today || undefined}
                    value={sentDate}
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
