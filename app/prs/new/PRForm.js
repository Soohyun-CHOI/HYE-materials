"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { createPRAction } from "./actions";
import SignerList from "./SignerList";

const EMPTY_ITEM = { itemName: "", size: "", unit: "", qty: "", rate: "", remark: "" };
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
    // Quotation file is optional and uploaded in the background as soon as
    // it's picked (client-side direct upload to Vercel Blob — see
    // CLAUDE.md's "Quotation file upload" section for why: it needs to
    // stay under the Server Action body-size limit). idle -> uploading ->
    // done | error. A failed upload never blocks submitting the PR itself
    // — it just means no quotation gets attached.
    const [quotation, setQuotation] = useState({ status: "idle" });

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

    async function handleFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setQuotation({ status: "uploading", filename: file.name });
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/quotations/upload",
            });
            setQuotation({ status: "done", url: blob.url, filename: file.name });
        } catch (err) {
            setQuotation({ status: "error", filename: file.name, error: err.message });
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

    const total = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        return sum + qty * rate;
    }, 0);

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

                <div>
                    <label htmlFor="notes" className="block text-sm font-medium">
                        Notes
                    </label>
                    <textarea id="notes" name="notes" rows={3} className={fieldClass} />
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="mt-2 space-y-3">
                    {items.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0);
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
                                    <input
                                        placeholder="Unit"
                                        value={item.unit}
                                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                                        className={inputClass}
                                    />
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
                                        placeholder="Rate"
                                        required
                                        value={item.rate}
                                        onChange={(e) => updateItem(i, "rate", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        placeholder="Remark"
                                        value={item.remark}
                                        onChange={(e) => updateItem(i, "remark", e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
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
                <p className="mt-2 text-sm font-medium">Total (preview): {total.toFixed(2)}</p>
            </div>

            <div>
                <h2 className="text-lg font-semibold">Signers</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Drag to reorder — this is the order they&apos;ll sign in.
                </p>
                <SignerList users={users} signers={signers} onChange={setSigners} />
            </div>

            <div>
                <h2 className="text-lg font-semibold">Quotation (optional)</h2>
                <div className="mt-2 space-y-2">
                    <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleFileChange}
                        className="block text-sm"
                    />
                    {quotation.status === "uploading" && (
                        <p className="text-sm text-zinc-500">Uploading {quotation.filename}...</p>
                    )}
                    {quotation.status === "done" && (
                        <p className="text-sm text-green-700">
                            Uploaded{" "}
                            <a href={quotation.url} target="_blank" rel="noreferrer" className="underline">
                                {quotation.filename}
                            </a>
                        </p>
                    )}
                    {quotation.status === "error" && (
                        <p className="text-sm text-red-600">
                            Upload failed: {quotation.error}. You can try a different file or submit without one.
                        </p>
                    )}
                    {quotation.status === "done" && (
                        <input
                            placeholder="Vendor Quotation Code (optional)"
                            name="vendorQuotationCode"
                            className={inputClass}
                        />
                    )}
                </div>
            </div>

            <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
            <input type="hidden" name="signersJson" value={JSON.stringify(signers)} />
            {quotation.status === "done" && (
                <>
                    <input type="hidden" name="quotationUrl" value={quotation.url} />
                    <input type="hidden" name="quotationFilename" value={quotation.filename} />
                </>
            )}
            <input type="hidden" name="confirmed" ref={confirmedRef} defaultValue="false" />

            {showDuplicateWarning ? (
                <div className="space-y-3 rounded border border-yellow-400 bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                    <p>
                        A matching PR already exists for this Line —{" "}
                        <strong>{state.duplicateWarning.priorPrId}</strong>, submitted by{" "}
                        {state.duplicateWarning.priorRequesterName} on{" "}
                        {state.duplicateWarning.priorDate}. Submit this one anyway?
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
                            disabled={pending}
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
                    disabled={pending || quotation.status === "uploading"}
                    className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
                >
                    {pending ? "Submitting..." : quotation.status === "uploading" ? "Uploading file..." : "Submit PR"}
                </button>
            )}
        </form>
    );
}
