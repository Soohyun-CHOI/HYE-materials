"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createPRAction } from "./actions";
import SignerList from "./SignerList";
import { CANONICAL_UNITS } from "@/lib/units";

// quotationIndex: null until the Requester picks one (issue #67) — only
// meaningful once 2+ Quotations exist; ignored (and auto-resolved server-
// side to the sole Quotation, if any) when there's 0 or 1.
const EMPTY_ITEM = { itemName: "", size: "", unit: "", qty: "", unitPrice: "", remark: "", quotationIndex: null };
const EMPTY_QUOTATION = { file: { status: "idle" }, vendorQuotationCode: "" };
const inputClass =
    "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-black";

export default function PRForm({ myJobs, otherJobs, lines, vendors, users }) {
    const [state, formAction, pending] = useActionState(createPRAction, null);

    const [jobId, setJobId] = useState("");
    const [lineId, setLineId] = useState("");
    const [vendorId, setVendorId] = useState("");
    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
    const [signers, setSigners] = useState([]);
    // Issue #69 — optional, left blank when the Requester doesn't know the
    // shipping cost yet at creation time.
    const [shippingFee, setShippingFee] = useState("");
    // Issue #67 — a PR can have more than one Quotation over its lifetime
    // (a Vendor can send more than one quote), each with its own file and
    // Vendor Quotation Code; PR Items link to whichever one they're
    // actually based on. At least one is required, so — like Items —
    // this starts with one entry already visible rather than making the
    // Requester click "+ Add another quotation" first; the last
    // remaining entry can't be removed (see the Remove button below),
    // only added to. Each entry's file is uploaded in the background as
    // soon as it's picked (client-side direct upload to Vercel Blob — see
    // CLAUDE.md's "Quotation file upload" section: keeps the Server
    // Action body under Vercel's size limit). idle -> uploading -> done |
    // error — a file is required per entry before the PR can submit.
    const [quotations, setQuotations] = useState([{ ...EMPTY_QUOTATION }]);

    // Issue #61 — the duplicate-submission warning is a confirm-then-resubmit
    // round trip through the same Server Action, not a separate pre-check
    // fetch. `confirmedRef` is a plain DOM ref (not React state) so "Submit
    // anyway" can flip the hidden input's value synchronously before the
    // native form submission fires — a state update here wouldn't reliably
    // commit to the DOM in time. `warningDismissed` resets on every new
    // action result so a later real resubmission re-evaluates the warning.
    const confirmedRef = useRef(null);
    const [warningDismissed, setWarningDismissed] = useState(false);

    useEffect(() => {
        setWarningDismissed(false);
        // A generic error (unrelated to the duplicate warning) means this
        // attempt already carried confirmed=true and still failed — reset it
        // so the next honest resubmission re-runs the duplicate check rather
        // than silently skipping it forever.
        if (state?.error && confirmedRef.current) {
            confirmedRef.current.value = "false";
        }
    }, [state]);

    function addQuotation() {
        setQuotations((prev) => [...prev, { ...EMPTY_QUOTATION }]);
    }

    function removeQuotation(index) {
        setQuotations((prev) => prev.filter((_, i) => i !== index));
        // A removed Quotation's index shifts every later one down by one,
        // and items pointing at it no longer have a valid target — rather
        // than silently relinking to whatever now occupies that index,
        // clear any item's choice that's no longer valid and shift the
        // rest to match.
        setItems((prev) =>
            prev.map((item) => {
                if (item.quotationIndex == null) return item;
                if (item.quotationIndex === index) return { ...item, quotationIndex: null };
                if (item.quotationIndex > index) return { ...item, quotationIndex: item.quotationIndex - 1 };
                return item;
            })
        );
    }

    function updateQuotationCode(index, value) {
        setQuotations((prev) =>
            prev.map((q, i) => (i === index ? { ...q, vendorQuotationCode: value } : q))
        );
    }

    async function handleQuotationFileChange(index, e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setQuotations((prev) =>
            prev.map((q, i) => (i === index ? { ...q, file: { status: "uploading", filename: file.name } } : q))
        );
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/quotations/upload",
            });
            setQuotations((prev) =>
                prev.map((q, i) =>
                    i === index ? { ...q, file: { status: "done", url: blob.url, filename: file.name } } : q
                )
            );
        } catch (err) {
            setQuotations((prev) =>
                prev.map((q, i) =>
                    i === index ? { ...q, file: { status: "error", filename: file.name, error: err.message } } : q
                )
            );
        }
    }

    const linesForJob = useMemo(
        () => lines.filter((l) => l.jobId === jobId),
        [lines, jobId]
    );

    function handleJobChange(e) {
        setJobId(e.target.value);
        setLineId(""); // a Line from the previous Job no longer applies
    }

    function addItem() {
        setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
    }

    function removeItem(index) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    function updateItem(index, field, value) {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    }

    const itemsSubtotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return sum + qty * unitPrice;
    }, 0);
    // Issue #69, renamed #78 — preview only, mirrors the Total Amount
    // formula field (Items Subtotal + Shipping Fee, blank treated as 0).
    const totalAmount = itemsSubtotal + (parseFloat(shippingFee) || 0);

    // Issue #67 — the per-item Quotation column only earns its keep once
    // there's an actual choice to make; with 0 or 1 Quotations every item
    // resolves to the same (possibly nonexistent) one automatically.
    const showQuotationColumn = quotations.length >= 2;
    const quotationLabel = (index) => quotations[index]?.vendorQuotationCode || `Quotation ${index + 1}`;
    // At least one Quotation is required (not optional) — a PR always
    // needs the vendor's actual quote on file.
    const quotationsIncomplete = quotations.length === 0 || quotations.some((q) => q.file.status !== "done");

    const showDuplicateWarning = Boolean(state?.duplicateWarning) && !warningDismissed;

    return (
        <form action={formAction} className="mt-6 space-y-8">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            <div className="space-y-4">
                <div>
                    <label htmlFor="jobId" className="block text-sm font-medium">
                        Job
                    </label>
                    <select id="jobId" value={jobId} onChange={handleJobChange} required className={fieldClass}>
                        <option value="" disabled>
                            Select a Job
                        </option>
                        {myJobs.length > 0 && (
                            <optgroup label="My Jobs">
                                {myJobs.map((j) => (
                                    <option key={j.id} value={j.id}>
                                        {j.jobCode} — {j.jobName}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        <optgroup label={myJobs.length > 0 ? "All Jobs" : "Jobs"}>
                            {otherJobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.jobCode} — {j.jobName}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>

                <div>
                    <label htmlFor="lineId" className="block text-sm font-medium">
                        Line
                    </label>
                    <select
                        id="lineId"
                        name="lineId"
                        value={lineId}
                        onChange={(e) => setLineId(e.target.value)}
                        required
                        disabled={!jobId}
                        className={fieldClass}
                    >
                        <option value="" disabled>
                            {jobId ? "Select a Line" : "Select a Job first"}
                        </option>
                        {linesForJob.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.lineName}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="vendorId" className="block text-sm font-medium">
                        Vendor
                    </label>
                    <select
                        id="vendorId"
                        name="vendorId"
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        required
                        className={fieldClass}
                    >
                        <option value="" disabled>
                            Select a Vendor
                        </option>
                        {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                                {v.vendorName}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold">Quotations</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    A Vendor can send more than one quotation — add one entry per quotation received.
                </p>
                <div className="mt-2 space-y-3">
                    {quotations.map((q, i) => (
                        <div key={i} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">{quotationLabel(i)}</span>
                                {quotations.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeQuotation(i)}
                                        className="text-sm text-red-600"
                                    >
                                        Remove
                                    </button>
                                )}
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
                                        Upload failed: {q.file.error}. Try a different file
                                        {quotations.length > 1 ? ", or remove this entry." : "."}
                                    </p>
                                )}
                                {q.file.status !== "done" && (
                                    <p className="text-sm text-zinc-500">
                                        A file is required for each quotation — attach one
                                        {quotations.length > 1 ? " or remove this entry." : "."}
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
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="mt-2 space-y-3">
                    {items.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                        return (
                            <div key={i} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    <input
                                        placeholder="Item Name"
                                        required
                                        value={item.itemName}
                                        onChange={(e) => updateItem(i, "itemName", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        placeholder="Size"
                                        value={item.size}
                                        onChange={(e) => updateItem(i, "size", e.target.value)}
                                        className={inputClass}
                                    />
                                    <select
                                        value={item.unit}
                                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                                        className={inputClass}
                                    >
                                        <option value="">Unit</option>
                                        {CANONICAL_UNITS.map((u) => (
                                            <option key={u} value={u}>
                                                {u}
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        required
                                        value={item.qty}
                                        onChange={(e) => updateItem(i, "qty", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Unit Price"
                                        required
                                        value={item.unitPrice}
                                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        placeholder="Remark"
                                        value={item.remark}
                                        onChange={(e) => updateItem(i, "remark", e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                {showQuotationColumn && (
                                    <div className="mt-2">
                                        <label className="block text-xs text-zinc-500">Quotation</label>
                                        <select
                                            value={item.quotationIndex ?? 0}
                                            onChange={(e) => updateItem(i, "quotationIndex", Number(e.target.value))}
                                            className={inputClass}
                                        >
                                            {quotations.map((_, qi) => (
                                                <option key={qi} value={qi}>
                                                    {quotationLabel(qi)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="mt-2 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                                    <span>Amount (preview): {amount.toFixed(2)}</span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(i)}
                                            className="text-red-600"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={addItem}
                    className="mt-3 rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
                >
                    + Add item
                </button>
                <p className="mt-2 text-sm font-medium">Items Subtotal (preview): {itemsSubtotal.toFixed(2)}</p>
            </div>

            <div>
                <label htmlFor="shippingFee" className="block text-sm font-medium">
                    Shipping Fee (optional)
                </label>
                <input
                    type="number"
                    step="0.01"
                    id="shippingFee"
                    name="shippingFee"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    className={fieldClass}
                />
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Total Amount (preview): {totalAmount.toFixed(2)}
                </p>
            </div>

            <div>
                <h2 className="text-lg font-semibold">Signers</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Drag to reorder — this is the order they&apos;ll sign in.
                </p>
                <SignerList users={users} signers={signers} onChange={setSigners} />
            </div>

            <div>
                <label htmlFor="notes" className="block text-sm font-medium">
                    Notes
                </label>
                <textarea id="notes" name="notes" rows={3} className={fieldClass} />
            </div>

            <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
            <input type="hidden" name="signersJson" value={JSON.stringify(signers)} />
            <input
                type="hidden"
                name="quotationsJson"
                value={JSON.stringify(
                    quotations.map((q) => ({
                        url: q.file.url,
                        filename: q.file.filename,
                        vendorQuotationCode: q.vendorQuotationCode,
                    }))
                )}
            />
            <input type="hidden" name="confirmed" ref={confirmedRef} defaultValue="false" />

            {showDuplicateWarning ? (
                <div className="space-y-3 rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                    <p>
                        A matching PR already exists for this Line —{" "}
                        <strong>{state.duplicateWarning.priorPrId}</strong>, submitted by{" "}
                        {state.duplicateWarning.priorRequesterName} on{" "}
                        {new Date(state.duplicateWarning.priorDate).toLocaleDateString()}. Submit
                        this one anyway?
                    </p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setWarningDismissed(true)}
                            className="rounded border border-yellow-600 px-3 py-1 text-yellow-900 dark:text-yellow-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={pending || quotationsIncomplete}
                            onClick={() => {
                                confirmedRef.current.value = "true";
                            }}
                            className="rounded bg-yellow-600 px-3 py-1 text-white disabled:opacity-50"
                        >
                            {pending ? "Submitting..." : "Submit anyway"}
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="submit"
                    disabled={pending || quotationsIncomplete}
                    className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
                >
                    {pending ? "Submitting..." : "Submit PR"}
                </button>
            )}
        </form>
    );
}
