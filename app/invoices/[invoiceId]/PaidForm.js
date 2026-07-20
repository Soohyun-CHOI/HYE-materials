"use client";

import { useActionState, useState } from "react";
import { updatePaidAction } from "./actions";

function todayIso() {
    return new Date().toISOString().slice(0, 10);
}

export default function PaidForm({ invoiceId, paid, paidDate }) {
    const [state, formAction, pending] = useActionState(updatePaidAction, null);
    const [checked, setChecked] = useState(paid);
    const [date, setDate] = useState(paidDate || todayIso());

    return (
        <form action={formAction} className="space-y-2">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="invoiceId" value={invoiceId} />
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    name="paid"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                />
                Paid
            </label>
            {checked && (
                <div>
                    <label htmlFor="paidDate" className="block text-sm font-medium">
                        Paid Date
                    </label>
                    <input
                        type="date"
                        id="paidDate"
                        name="paidDate"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-black"
                    />
                </div>
            )}
            <button
                type="submit"
                disabled={pending}
                className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            >
                {pending ? "Saving..." : "Save"}
            </button>
        </form>
    );
}
