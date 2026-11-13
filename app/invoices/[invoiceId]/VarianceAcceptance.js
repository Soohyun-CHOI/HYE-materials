"use client";

import { useActionState, useState } from "react";
import Instant from "@/app/components/Instant";
import { DAY_FORMAT } from "@/lib/format";
import { ACCEPTANCE_COPY, VARIANCE_COPY } from "@/lib/variance";
import { acceptVarianceAction } from "./actions";

// AN INVOICE'S VARIANCE AND, FOR AN ADMIN, THE CONTROL THAT ACCEPTS IT (#648).
//
// THE MARK IS WHAT EVERY READER SEES, AND THE CONTROL SITS BESIDE IT. A variance an Admin has
// accepted reads as accepted for everybody who reaches the row — who, when and why with it —
// because what the office decided about an invoice is a fact of the invoice, of the grade
// payment is (#309). `canAccept` is the page's `user.isAdmin`, the screen half of #185's pair
// with `acceptVarianceAction`'s `withAdminAction`, passed as a prop for the reason
// `PaymentSection.js` gives: a branch on the privilege at the page would carry the fact on one
// side and nothing on the other. Only the `Accept` button and its form are behind it.
//
// THE FORM OPENS WHERE THE MARK IS, `Edit payment`'s shape: the opener goes while it is open,
// `Cancel` closes it, and a save closes it because the action redirects and the segment is
// replaced. `Reason` is not `required`: the action refuses a blank one — and one of spaces,
// which the attribute would let through — in the app's own words, inside the form.

/** The badge, the line under it, and the control — for an item's price or quantity variance. */
export function VarianceMark({ kind, state, invoiceId, itemRecordIds, note, canAccept }) {
    const [opened, setOpened] = useState(false);
    const accepted = state === "accepted";
    return (
        <>
            <span
                className={`ml-1 rounded px-1 text-xs ${
                    accepted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
            >
                {accepted ? ACCEPTANCE_COPY.badge[kind] : VARIANCE_COPY[kind]}
            </span>
            {canAccept && !accepted && !opened && (
                <button type="button" onClick={() => setOpened(true)} className="ml-1 text-xs text-zinc-500 underline">
                    {ACCEPTANCE_COPY.open}
                </button>
            )}
            <AcceptanceNote note={note} />
            {canAccept && !accepted && opened && (
                <AcceptForm
                    invoiceId={invoiceId}
                    kind={kind}
                    itemRecordIds={itemRecordIds}
                    onCancel={() => setOpened(false)}
                />
            )}
        </>
    );
}

/**
 * The totals box: red while the vendor's total and ours differ and nobody has accepted it,
 * green once an Admin has. Both sentences arrive resolved — the page formats the figures.
 */
export function TotalsVariance({ state, invoiceId, openText, acceptedText, note, canAccept }) {
    const [opened, setOpened] = useState(false);
    const accepted = state === "accepted";
    return (
        <div
            className={`mt-2 rounded border px-3 py-2 text-sm ${
                accepted ? "border-green-300 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-700"
            }`}
        >
            <p>
                {accepted ? acceptedText : openText}
                {canAccept && !accepted && !opened && (
                    <button type="button" onClick={() => setOpened(true)} className="ml-2 text-xs text-zinc-600 underline">
                        {ACCEPTANCE_COPY.open}
                    </button>
                )}
            </p>
            <AcceptanceNote note={note} />
            {canAccept && !accepted && opened && (
                <AcceptForm invoiceId={invoiceId} kind="totals" itemRecordIds={[]} onCancel={() => setOpened(false)} />
            )}
        </div>
    );
}

/**
 * Who accepted it, when and why — or, for a variance open again, when it was reopened. The day
 * is the reader's own, as `Recorded by` draws it. `byName` is resolved on the server by
 * `lib/userName.js`, an em dash where the row names nobody.
 */
function AcceptanceNote({ note }) {
    if (!note) return null;
    if (note.kind === "accepted") {
        return (
            <span className="block text-xs text-zinc-500">
                {ACCEPTANCE_COPY.acceptedBy} {note.byName || "—"}
                {note.at && (
                    <>
                        {" "}
                        <span aria-hidden="true">·</span> <Instant at={note.at} format={DAY_FORMAT} />
                    </>
                )}
                {note.reason && <> — {note.reason}</>}
            </span>
        );
    }
    return (
        <span className="block text-xs text-zinc-500">
            {ACCEPTANCE_COPY.reopened}
            {note.at && (
                <>
                    {" "}
                    <span aria-hidden="true">·</span> <Instant at={note.at} format={DAY_FORMAT} />
                </>
            )}{" "}
            — {ACCEPTANCE_COPY.reopenedWhy}
        </span>
    );
}

/** The reason and the two buttons. One form per mark, so a refusal lands beside its own badge. */
function AcceptForm({ invoiceId, kind, itemRecordIds, onCancel }) {
    const [state, formAction, pending] = useActionState(acceptVarianceAction, null);
    const fieldId = `reason-${kind}-${itemRecordIds[0] ?? "invoice"}`;
    return (
        <form action={formAction} className="mt-1 block space-y-1 text-zinc-900">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>
            )}
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <input type="hidden" name="kind" value={kind} />
            {itemRecordIds.map((id) => (
                <input key={id} type="hidden" name="invoiceItemId" value={id} />
            ))}
            <label htmlFor={fieldId} className="block text-xs font-medium">
                {ACCEPTANCE_COPY.reasonLabel}
            </label>
            <textarea
                id={fieldId}
                name="reason"
                rows={2}
                autoFocus
                className="block w-full max-w-md rounded border border-zinc-300 px-2 py-1 text-sm"
            />
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-foreground px-3 py-1 text-xs text-background disabled:opacity-50"
                >
                    {pending ? ACCEPTANCE_COPY.pending : ACCEPTANCE_COPY.submit}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={pending}
                    className="text-xs text-zinc-500 underline disabled:opacity-50"
                >
                    {ACCEPTANCE_COPY.cancel}
                </button>
            </div>
        </form>
    );
}
