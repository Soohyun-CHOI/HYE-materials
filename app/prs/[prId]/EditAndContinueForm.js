"use client";

import { useActionState, useState } from "react";
import { editAndContinueAction } from "./actions";

const inputClass = "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";

export default function EditAndContinueForm({ prId, items, onCancel }) {
    const [state, formAction, pending] = useActionState(editAndContinueAction, null);
    const [rows, setRows] = useState(
        items.map((it) => ({
            id: it.id,
            itemName: it.itemName || "",
            size: it.size || "",
            unit: it.unit || "",
            qty: it.qty ?? "",
            rate: it.rate ?? "",
            remark: it.remark || "",
        }))
    );

    function updateRow(index, field, value) {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    }

    return (
        <form
            action={formAction}
            className="space-y-3 rounded border border-zinc-300 p-4 dark:border-zinc-700"
        >
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}
            <input type="hidden" name="prId" value={prId} />

            <div className="space-y-2">
                {rows.map((row, i) => (
                    <div key={row.id} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <input
                            value={row.itemName}
                            onChange={(e) => updateRow(i, "itemName", e.target.value)}
                            placeholder="Item Name"
                            className={inputClass}
                        />
                        <input
                            value={row.size}
                            onChange={(e) => updateRow(i, "size", e.target.value)}
                            placeholder="Size"
                            className={inputClass}
                        />
                        <input
                            value={row.unit}
                            onChange={(e) => updateRow(i, "unit", e.target.value)}
                            placeholder="Unit"
                            className={inputClass}
                        />
                        <input
                            type="number"
                            value={row.qty}
                            onChange={(e) => updateRow(i, "qty", e.target.value)}
                            placeholder="Qty"
                            className={inputClass}
                        />
                        <input
                            type="number"
                            step="0.01"
                            value={row.rate}
                            onChange={(e) => updateRow(i, "rate", e.target.value)}
                            placeholder="Rate"
                            className={inputClass}
                        />
                        <input
                            value={row.remark}
                            onChange={(e) => updateRow(i, "remark", e.target.value)}
                            placeholder="Remark"
                            className={inputClass}
                        />
                    </div>
                ))}
            </div>

            <div>
                <label htmlFor="editNotes" className="block text-sm font-medium">
                    Notes (optional)
                </label>
                <textarea
                    id="editNotes"
                    name="notes"
                    rows={2}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black"
                />
            </div>

            <input type="hidden" name="itemsJson" value={JSON.stringify(rows)} />

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
                >
                    {pending ? "Saving..." : "Save and continue"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    className="rounded border border-zinc-300 px-4 py-2 dark:border-zinc-700"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
}
