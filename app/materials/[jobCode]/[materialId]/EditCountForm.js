"use client";

import { startTransition, useActionState, useState } from "react";
import { INVENTORY_COPY, MATERIAL_LOG_REASONS, countEditChange, qtyText, readQty, signedQtyText } from "@/lib/materialStock";
import { editCountAction } from "./actions";
import { useReaderTimeZone } from "./readerDay";

const COPY = INVENTORY_COPY.countEdit;

/**
 * Edit a material's count at one of the addresses its stock table draws (#678): the count there
 * now, a reason and, if the editor has more to say, notes. The address is asked only where there is
 * a choice. A person knows the count rather than the difference, so the count is what is typed — and
 * the change it will record is said under it before the press, so a mistyped count is seen while it
 * can still be fixed.
 *
 * THE FIGURE THE PAGE DREW TRAVELS WITH THE PRESS (`shownQty`), and the server refuses an address
 * whose stock is no longer that figure: the same count would be a different change then
 * (`lib/materialStock.server.js`). The day recorded is the reader's today, in the zone the press
 * sends, as a cancel's is (#677).
 *
 * `IssueForm`'s shape and for its reasons: every field is held here and the form is sent from
 * `onSubmit`, so a refusal keeps what was chosen and typed; the button is held while a press is in
 * flight; an edit that stood redraws the page with its row and clears what was typed.
 */
export default function EditCountForm({ jobRecordId, materialRecordId, unit, addresses }) {
    const [state, formAction, pending] = useActionState(editCountAction, null);
    const [picked, setPicked] = useState("");
    // One address is the address without asking — read on every render, since a press redraws the
    // page with its figures and the form keeps its state.
    const addressRecordId = addresses.length === 1 ? addresses[0].addressRecordId : picked;
    const at = addresses.find((a) => a.addressRecordId === addressRecordId) ?? null;
    const [counted, setCounted] = useState("");
    const [reason, setReason] = useState("");
    const [notes, setNotes] = useState("");
    const timeZone = useReaderTimeZone();

    const [clearedFor, setClearedFor] = useState(null);
    if (state?.edited && clearedFor !== state.edited) {
        setClearedFor(state.edited);
        setCounted("");
        setReason("");
        setNotes("");
    }

    if (addresses.length === 0) return null;

    const change = countEditChange({ counted: readQty(counted), inStock: at?.inStock });

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
            <input type="hidden" name="shownQty" value={at ? String(at.inStock) : ""} />
            <input type="hidden" name="timeZone" value={timeZone} />
            {state?.error ? (
                <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            ) : null}
            {addresses.length === 1 ? (
                <>
                    <input type="hidden" name="addressRecordId" value={addresses[0].addressRecordId} />
                    <p className="text-sm text-zinc-600">{COPY.at(addresses[0].label, addresses[0].inStock, unit)}</p>
                </>
            ) : (
                <div>
                    <label htmlFor="count-address" className="block text-sm font-medium">
                        {COPY.address}
                    </label>
                    <select
                        id="count-address"
                        name="addressRecordId"
                        value={addressRecordId}
                        onChange={(e) => setPicked(e.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                    >
                        <option value="">{COPY.addressPlaceholder}</option>
                        {addresses.map((a) => (
                            <option key={a.addressRecordId} value={a.addressRecordId}>
                                {a.label} ({qtyText(a.inStock, unit)})
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div>
                <label htmlFor="count-counted" className="block text-sm font-medium">
                    {COPY.counted}
                    {unit ? ` (${unit})` : ""}
                </label>
                <input
                    id="count-counted"
                    name="countedQty"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-describedby="count-change"
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
                <p id="count-change" aria-live="polite" className="mt-1 min-h-5 text-sm text-zinc-600">
                    {change === null ? "" : change === 0 ? COPY.noChange : COPY.change(signedQtyText(change, unit))}
                </p>
            </div>
            <div>
                <label htmlFor="count-reason" className="block text-sm font-medium">
                    {COPY.reason}
                </label>
                <select
                    id="count-reason"
                    name="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                >
                    <option value="">{COPY.reasonPlaceholder}</option>
                    {MATERIAL_LOG_REASONS.map((r) => (
                        <option key={r} value={r}>
                            {r}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="count-notes" className="block text-sm font-medium">
                    {COPY.notes} <span className="font-normal text-zinc-500">{COPY.optional}</span>
                </label>
                <textarea
                    id="count-notes"
                    name="notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60">
                {pending ? COPY.busy : COPY.submit}
            </button>
        </form>
    );
}
