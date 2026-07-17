"use client";

import { useActionState, useState } from "react";
import { upload } from "@vercel/blob/client";
import { editAndContinueAction } from "./actions";

const inputClass = "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";
const EMPTY_NEW_QUOTATION = { file: { status: "idle" }, vendorQuotationCode: "" };

export default function EditAndContinueForm({ prId, items, quotations, onCancel }) {
    const [state, formAction, pending] = useActionState(editAndContinueAction, null);
    // Issue #67 — quotationChoice encodes either an existing Quotation
    // ("existing:<recordId>") or one being added in this same session
    // ("new:<index>", resolved server-side once it has a real id), or ""
    // for none. Pre-filled from the item's actual current link — a PR
    // that started with exactly one Quotation already had every item
    // auto-linked to it at creation time (issue #67's first-quotation
    // path), so this reflects real state, not a UI-invented default;
    // going from 1 Quotation to 2 here must never silently change it.
    const [rows, setRows] = useState(
        items.map((it) => ({
            id: it.id,
            itemName: it.itemName || "",
            size: it.size || "",
            unit: it.unit || "",
            qty: it.qty ?? "",
            rate: it.rate ?? "",
            remark: it.remark || "",
            quotationChoice: it.quotation?.[0] ? `existing:${it.quotation[0]}` : "",
        }))
    );
    // New Quotations being added in this edit session — same shape/upload
    // flow as the creation form's list (see app/prs/new/PRForm.js).
    const [newQuotations, setNewQuotations] = useState([]);

    function updateRow(index, field, value) {
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
    }

    function addQuotation() {
        setNewQuotations((prev) => [...prev, { ...EMPTY_NEW_QUOTATION }]);
    }

    function removeQuotation(index) {
        setNewQuotations((prev) => prev.filter((_, i) => i !== index));
        // Same reasoning as PRForm.js: a removed entry's index shifts
        // every later "new:" one down by one, and rows pointing at it no
        // longer have a valid target.
        const removedValue = `new:${index}`;
        setRows((prev) =>
            prev.map((r) => {
                if (r.quotationChoice === removedValue) return { ...r, quotationChoice: "" };
                if (r.quotationChoice.startsWith("new:")) {
                    const i = Number(r.quotationChoice.slice(4));
                    if (i > index) return { ...r, quotationChoice: `new:${i - 1}` };
                }
                return r;
            })
        );
    }

    function updateQuotationCode(index, value) {
        setNewQuotations((prev) =>
            prev.map((q, i) => (i === index ? { ...q, vendorQuotationCode: value } : q))
        );
    }

    async function handleQuotationFileChange(index, e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setNewQuotations((prev) =>
            prev.map((q, i) => (i === index ? { ...q, file: { status: "uploading", filename: file.name } } : q))
        );
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/quotations/upload",
            });
            setNewQuotations((prev) =>
                prev.map((q, i) =>
                    i === index ? { ...q, file: { status: "done", url: blob.url, filename: file.name } } : q
                )
            );
        } catch (err) {
            setNewQuotations((prev) =>
                prev.map((q, i) =>
                    i === index ? { ...q, file: { status: "error", filename: file.name, error: err.message } } : q
                )
            );
        }
    }

    // Same fallback labeling as PRForm.js/page.js: the Vendor Quotation
    // Code once entered, else a positional placeholder covering both
    // already-existing and newly-added entries in one continuous count.
    const quotationOptions = [
        ...quotations.map((q, i) => ({
            value: `existing:${q.id}`,
            label: q.vendorQuotationCode || `Quotation ${i + 1}`,
        })),
        ...newQuotations.map((q, i) => ({
            value: `new:${i}`,
            label: q.vendorQuotationCode || `Quotation ${quotations.length + i + 1}`,
        })),
    ];
    const showQuotationColumn = quotationOptions.length >= 2;
    const quotationsIncomplete = newQuotations.some((q) => q.file.status !== "done");

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
                    <div key={row.id} className="space-y-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                        {showQuotationColumn && (
                            <div>
                                <label className="block text-xs text-zinc-500">Quotation</label>
                                <select
                                    value={row.quotationChoice}
                                    onChange={(e) => updateRow(i, "quotationChoice", e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">—</option>
                                    {quotationOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div>
                <h3 className="text-sm font-semibold">Quotations</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Add a Quotation this PR didn&apos;t have yet — existing ones aren&apos;t editable here.
                </p>
                <div className="mt-2 space-y-3">
                    {newQuotations.map((q, i) => (
                        <div key={i} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {q.vendorQuotationCode || `Quotation ${quotations.length + i + 1}`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeQuotation(i)}
                                    className="text-sm text-red-600"
                                >
                                    Remove
                                </button>
                            </div>
                            <div className="mt-2 space-y-2">
                                <input
                                    type="file"
                                    accept="application/pdf,image/jpeg,image/png"
                                    onChange={(e) => handleQuotationFileChange(i, e)}
                                    className="block text-sm"
                                />
                                {q.file.status === "uploading" && (
                                    <p className="text-sm text-zinc-500">Uploading {q.file.filename}...</p>
                                )}
                                {q.file.status === "done" && (
                                    <p className="text-sm text-green-700">
                                        Uploaded{" "}
                                        <a href={q.file.url} target="_blank" rel="noreferrer" className="underline">
                                            {q.file.filename}
                                        </a>
                                    </p>
                                )}
                                {q.file.status === "error" && (
                                    <p className="text-sm text-red-600">
                                        Upload failed: {q.file.error}. Try a different file, or remove this entry.
                                    </p>
                                )}
                                {q.file.status !== "done" && (
                                    <p className="text-sm text-zinc-500">
                                        A file is required for each quotation — attach one or remove this entry.
                                    </p>
                                )}
                                <input
                                    placeholder="Vendor Quotation Code (optional)"
                                    value={q.vendorQuotationCode}
                                    onChange={(e) => updateQuotationCode(i, e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addQuotation}
                        className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
                    >
                        + Add another quotation
                    </button>
                </div>
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
            <input
                type="hidden"
                name="newQuotationsJson"
                value={JSON.stringify(
                    newQuotations.map((q) => ({
                        url: q.file.url,
                        filename: q.file.filename,
                        vendorQuotationCode: q.vendorQuotationCode,
                    }))
                )}
            />

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={pending || quotationsIncomplete}
                    className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
                >
                    {pending
                        ? "Saving..."
                        : quotationsIncomplete
                          ? "Attach a file to every quotation..."
                          : "Save and continue"}
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
