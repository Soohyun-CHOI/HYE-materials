"use client";

import { startTransition, useActionState, useState } from "react";
import { TRANSIT_COPY } from "@/lib/materialTransit";
import { cancelSendAction, receiveMaterialsAction, writeOffMaterialsAction } from "./actions";
import { useReaderTimeZone, useReaderToday } from "./readerDay";

// What can be done to one send still in transit (#677), each under the row that names it: the
// receiving job receives what arrived, the sending job takes back what has not, and the office
// writes off what never will. Each is `IssueForm`'s shape — sent from `onSubmit`, held while in
// flight, a refusal over the fields it was about — and what it did is said by arriving (#321): the
// page redraws with the send's new remainder and the activity row that records it.

function Refusal({ state }) {
    return state?.error ? (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
        </p>
    ) : null;
}

function submitter(formAction, pending) {
    return (event) => {
        event.preventDefault();
        if (pending) return; // a second press while the first is on its way
        startTransition(() => formAction(new FormData(event.currentTarget)));
    };
}

/**
 * Receive what arrived of a send: how many, and the day — which starts at the reader's today and
 * may be set back to the day it was sent, never before it or past today.
 */
export function ReceiveForm({ sentRecordId, unit, sentDate }) {
    const COPY = TRANSIT_COPY.receive;
    const [state, formAction, pending] = useActionState(receiveMaterialsAction, null);
    const [qty, setQty] = useState("");
    const [typedDate, setTypedDate] = useState(null);
    const today = useReaderToday();
    const timeZone = useReaderTimeZone();
    const receivedDate = typedDate ?? today;
    const id = `receive-${sentRecordId}`;

    const [clearedFor, setClearedFor] = useState(null);
    if (state?.received && clearedFor !== state.received) {
        setClearedFor(state.received);
        setQty("");
    }

    return (
        <form onSubmit={submitter(formAction, pending)} className="mt-2 flex flex-wrap items-end gap-3">
            <input type="hidden" name="sentRecordId" value={sentRecordId} />
            <input type="hidden" name="timeZone" value={timeZone} />
            <div className="basis-full">
                <Refusal state={state} />
            </div>
            <div>
                <label htmlFor={`${id}-qty`} className="block text-sm font-medium">
                    {COPY.qty}
                    {unit ? ` (${unit})` : ""}
                </label>
                <input
                    id={`${id}-qty`}
                    name="qty"
                    inputMode="numeric"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-28 rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <div>
                <label htmlFor={`${id}-date`} className="block text-sm font-medium">
                    {COPY.date}
                </label>
                <input
                    id={`${id}-date`}
                    name="receivedDate"
                    type="date"
                    min={sentDate || undefined}
                    max={today || undefined}
                    value={receivedDate}
                    onChange={(e) => setTypedDate(e.target.value)}
                    className="mt-1 rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <button type="submit" disabled={pending} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-60">
                {pending ? COPY.busy : COPY.submit}
            </button>
        </form>
    );
}

/** Take back what has not arrived of a send, to the address it left: all of it unless fewer are typed. */
export function CancelSendForm({ sentRecordId, remaining, unit }) {
    const COPY = TRANSIT_COPY.cancel;
    const [state, formAction, pending] = useActionState(cancelSendAction, null);
    const [qty, setQty] = useState(String(remaining));
    const timeZone = useReaderTimeZone();
    const id = `cancel-${sentRecordId}`;

    return (
        <form onSubmit={submitter(formAction, pending)} className="mt-2 flex flex-wrap items-end gap-3">
            <input type="hidden" name="sentRecordId" value={sentRecordId} />
            <input type="hidden" name="timeZone" value={timeZone} />
            <div className="basis-full">
                <Refusal state={state} />
            </div>
            <div>
                <label htmlFor={`${id}-qty`} className="block text-sm font-medium">
                    {COPY.qty}
                    {unit ? ` (${unit})` : ""}
                </label>
                <input
                    id={`${id}-qty`}
                    name="qty"
                    inputMode="numeric"
                    autoComplete="off"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="mt-1 w-28 rounded border border-zinc-300 px-3 py-2"
                />
            </div>
            <button type="submit" disabled={pending} className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-60">
                {pending ? COPY.busy : COPY.submit}
            </button>
        </form>
    );
}

/**
 * Write off all that is left of a send — the office's. One press asks, naming the quantity, and the
 * second writes it off; the quantity asked about is the one sent, so a remainder that moved since
 * the page was drawn is refused rather than written off unseen.
 */
export function WriteOffForm({ sentRecordId, remaining, unit }) {
    const COPY = TRANSIT_COPY.writeOff;
    const [state, formAction, pending] = useActionState(writeOffMaterialsAction, null);
    const [asking, setAsking] = useState(false);
    const timeZone = useReaderTimeZone();

    if (!asking) {
        return (
            <div className="mt-2 space-y-2">
                <Refusal state={state} />
                <button type="button" onClick={() => setAsking(true)} className="rounded border border-zinc-300 px-4 py-2 text-sm">
                    {COPY.open}
                </button>
            </div>
        );
    }
    return (
        <form onSubmit={submitter(formAction, pending)} className="mt-2 space-y-2">
            <input type="hidden" name="sentRecordId" value={sentRecordId} />
            <input type="hidden" name="qty" value={remaining} />
            <input type="hidden" name="timeZone" value={timeZone} />
            <Refusal state={state} />
            <p className="text-sm">{COPY.confirm(remaining, unit)}</p>
            <div className="flex gap-3">
                <button type="submit" disabled={pending} className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:opacity-60">
                    {pending ? COPY.busy : COPY.submit(remaining, unit)}
                </button>
                <button type="button" disabled={pending} onClick={() => setAsking(false)} className="rounded border border-zinc-300 px-4 py-2 text-sm disabled:opacity-60">
                    {COPY.keep}
                </button>
            </div>
        </form>
    );
}
