"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { upload } from "@vercel/blob/client";
import { createInvoiceAction } from "./actions";

const EMPTY_ITEM = { itemName: "", qty: "", unitPrice: "", poRecordId: "" };
const inputClass =
    "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-black";

// "PDF Upload" vs "Manual Entry" (added after the initial build) is a
// single form/single state tree with two tabs, not two separate forms —
// PDF or hand-typed, it's the same underlying task (entering an invoice),
// and switching tabs must never lose whatever's already been
// attached/detected/typed. So `activeTab` only ever changes which order
// these render helpers appear in below — every one of them reads/writes
// the exact same state regardless of which tab is active, and PO
// detection (issue #46) always runs on any file upload in either tab
// (a product decision — detection is harmless best-effort, so there's no
// real reason to disable it just because someone started on the Manual
// tab).
const TABS = [
    { id: "pdf", label: "PDF Upload" },
    { id: "manual", label: "Manual Entry" },
];

// The common case (per product decision) is one PO with several invoices —
// an invoice spanning several POs is the supported edge case, not the
// default flow. So "PO" is picked once at the header and seeds every new
// line item's PO, rather than forcing an independent pick on every single
// line — but each line's PO can still be changed on its own for the edge
// case, since Invoice Items each carry their own required PO link.
export default function InvoiceForm({ vendors, pos }) {
    const [state, formAction, pending] = useActionState(createInvoiceAction, null);
    // Default "pdf" — the primary path most people try first.
    const [activeTab, setActiveTab] = useState("pdf");

    // Local copy, not just the prop directly — issue #46's detection can
    // confirm a PO that was created *after* this page's initial server-side
    // getAllPOs() fetch (e.g. approved moments earlier in the same
    // session), which wouldn't be in `pos` yet. Without this, the <select>
    // would have no matching <option> for a detected PO: the browser then
    // visually renders some other option as "selected" while the real
    // value silently stays correct underneath — a misleading display, not
    // just a cosmetic gap, since the user has no reason to notice the
    // mismatch and fix it before submitting.
    const [posList, setPosList] = useState(pos);
    const [vendorId, setVendorId] = useState("");
    const [defaultPoId, setDefaultPoId] = useState("");
    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);
    // Unlike Quotations (#34), the Invoice file is required, not optional —
    // every received vendor invoice must be kept on file — so submit stays
    // disabled until this reaches "done" rather than letting the form
    // proceed without one. Same client-side direct-upload pattern as
    // Quotations otherwise: uploads the moment it's picked (background),
    // never blocks on Server Action body-size limits.
    const [invoiceFile, setInvoiceFile] = useState({ status: "idle" });
    // Issue #46 — best-effort, informational only: null | { level: "info" |
    // "warning", message }. Never blocks anything; the manual Vendor/PO
    // pickers below are the same controls this just pre-fills, so whatever
    // it sets is still fully editable before submit.
    const [poDetection, setPoDetection] = useState(null);

    async function handleInvoiceFileChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setInvoiceFile({ status: "uploading", filename: file.name });
        setPoDetection(null);
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/invoices/upload",
            });
            setInvoiceFile({ status: "done", url: blob.url, filename: file.name });
            await detectAndApplyPOs(blob.url);
        } catch (err) {
            setInvoiceFile({ status: "error", filename: file.name, error: err.message });
        }
    }

    async function detectAndApplyPOs(blobUrl) {
        try {
            const res = await fetch("/api/invoices/detect-po", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ blobUrl }),
            });
            const { confirmed = [], unconfirmed = [], vendorConflict = false } = await res.json();

            if (vendorConflict) {
                setPoDetection({
                    level: "warning",
                    message: `Found PO references from more than one Vendor (${confirmed
                        .map((c) => c.poId)
                        .join(", ")}) — please verify and select manually below.`,
                });
                return;
            }

            if (confirmed.length === 0) {
                if (unconfirmed.length > 0) {
                    setPoDetection({
                        level: "warning",
                        message: `Found what looks like a PO number (${unconfirmed.join(
                            ", "
                        )}) but no matching PO exists — check it wasn't mistyped, or select manually below.`,
                    });
                }
                return; // Nothing to auto-fill — falls back to manual entry as-is.
            }

            // Merge any confirmed PO that isn't already in posList — see
            // the posList comment above for why this can happen (a PO
            // created after this page's own data was fetched).
            setPosList((prev) => {
                const missing = confirmed.filter((c) => !prev.some((po) => po.id === c.recordId));
                if (missing.length === 0) return prev;
                return [
                    ...prev,
                    ...missing.map((c) => ({ id: c.recordId, poId: c.poId, vendorId: c.vendorId })),
                ];
            });

            // Detection is more authoritative than an early Vendor guess —
            // the item PO pickers are Vendor-scoped (see posForVendor
            // below), so the detected PO can't even be selected until the
            // matching Vendor is set.
            if (confirmed[0].vendorId) {
                setVendorId(confirmed[0].vendorId);
            }

            if (confirmed.length === 1) {
                const poRecordId = confirmed[0].recordId;
                setDefaultPoId(poRecordId);
                // Same non-destructive back-fill as handleDefaultPoChange —
                // only fills items that don't have their own PO yet.
                setItems((prev) =>
                    prev.map((item) => (item.poRecordId ? item : { ...item, poRecordId }))
                );
                setPoDetection({
                    level: "info",
                    message: `Detected PO: ${confirmed[0].poId} (auto-filled below).`,
                });
            } else {
                // Multi-PO case: there's no single "default" to seed, so
                // scaffold one item row per detected PO instead — but only
                // if every current item is still untouched (no name/qty/
                // price entered), so this never overwrites real input from
                // someone who uploaded the file after already starting to
                // fill the form in.
                setItems((prev) => {
                    const pristine = prev.every((item) => !item.itemName && !item.qty && !item.unitPrice);
                    if (!pristine) return prev;
                    return confirmed.map((c) => ({ ...EMPTY_ITEM, poRecordId: c.recordId }));
                });
                const unconfirmedNote =
                    unconfirmed.length > 0
                        ? ` (${unconfirmed.length} unrecognized reference${unconfirmed.length > 1 ? "s" : ""} ignored)`
                        : "";
                setPoDetection({
                    level: "info",
                    message: `Detected ${confirmed.length} POs: ${confirmed
                        .map((c) => c.poId)
                        .join(", ")} — auto-filled below, verify each item's assignment.${unconfirmedNote}`,
                });
            }
        } catch (err) {
            // Silent — convenience feature only, manual entry is always
            // available regardless of whether this request itself failed.
            console.error("PO detection request failed", err);
        }
    }

    const posForVendor = useMemo(
        () => posList.filter((po) => po.vendorId === vendorId),
        [posList, vendorId]
    );

    function handleVendorChange(e) {
        const newVendorId = e.target.value;
        setVendorId(newVendorId);
        // POs picked under the previous Vendor almost certainly don't
        // belong to the new one — clear rather than leave a stale,
        // now-invalid selection sitting in state.
        setDefaultPoId("");
        setItems((prev) => prev.map((item) => ({ ...item, poRecordId: "" })));
    }

    function handleDefaultPoChange(e) {
        const newDefaultPoId = e.target.value;
        setDefaultPoId(newDefaultPoId);
        // Back-fills any item that doesn't have its own PO set yet —
        // covers the item(s) already on the form before this was picked
        // (e.g. the first row, added on page load before any selection
        // exists) — without overwriting a line someone already customized
        // for the multi-PO edge case.
        setItems((prev) =>
            prev.map((item) => (item.poRecordId ? item : { ...item, poRecordId: newDefaultPoId }))
        );
    }

    function addItem() {
        setItems((prev) => [...prev, { ...EMPTY_ITEM, poRecordId: defaultPoId }]);
    }

    function removeItem(index) {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }

    function updateItem(index, field, value) {
        setItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
        );
    }

    const itemsTotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        return sum + qty * unitPrice;
    }, 0);

    function renderHeaderFields() {
        return (
            <div className="space-y-4">
                <div>
                    <label htmlFor="vendorId" className="block text-sm font-medium">
                        Vendor
                    </label>
                    <select
                        id="vendorId"
                        name="vendorId"
                        value={vendorId}
                        onChange={handleVendorChange}
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
                    <label htmlFor="vendorInvoiceCode" className="block text-sm font-medium">
                        Vendor Invoice #
                    </label>
                    <input
                        id="vendorInvoiceCode"
                        name="vendorInvoiceCode"
                        placeholder="The vendor's own invoice number, as printed on their document"
                        className={fieldClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="issueDate" className="block text-sm font-medium">
                            Issue Date
                        </label>
                        <input type="date" id="issueDate" name="issueDate" required className={fieldClass} />
                    </div>
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium">
                            Due Date
                        </label>
                        <input type="date" id="dueDate" name="dueDate" className={fieldClass} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="amountDue" className="block text-sm font-medium">
                            Amount Due
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="amountDue"
                            name="amountDue"
                            required
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="shippingFee" className="block text-sm font-medium">
                            Shipping Fee
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="shippingFee"
                            name="shippingFee"
                            className={fieldClass}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="defaultPoId" className="block text-sm font-medium">
                        PO
                    </label>
                    <select
                        id="defaultPoId"
                        value={defaultPoId}
                        onChange={handleDefaultPoChange}
                        disabled={!vendorId}
                        className={fieldClass}
                    >
                        <option value="">
                            {vendorId ? "Select a PO (fills in below, per-line still changeable)" : "Select a Vendor first"}
                        </option>
                        {posForVendor.map((po) => (
                            <option key={po.id} value={po.id}>
                                {po.poId}
                            </option>
                        ))}
                    </select>
                    <p className="mt-1 text-xs text-zinc-500">
                        Most invoices cover a single PO — this fills in every line below.
                        Only change a line&apos;s own PO if this invoice actually spans more than one.
                    </p>
                </div>
            </div>
        );
    }

    function renderFileSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Invoice File</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    The vendor&apos;s original invoice document — required, every received invoice is kept on file.
                </p>
                <div className="mt-2 space-y-2">
                    <input
                        type="file"
                        accept="application/pdf,image/jpeg,image/png"
                        onChange={handleInvoiceFileChange}
                        className="block text-sm"
                    />
                    {invoiceFile.status === "uploading" && (
                        <p className="text-sm text-zinc-500">Uploading {invoiceFile.filename}...</p>
                    )}
                    {invoiceFile.status === "done" && (
                        <p className="text-sm text-green-700">
                            Uploaded{" "}
                            <a href={invoiceFile.url} target="_blank" rel="noreferrer" className="underline">
                                {invoiceFile.filename}
                            </a>
                        </p>
                    )}
                    {invoiceFile.status === "error" && (
                        <p className="text-sm text-red-600">
                            Upload failed: {invoiceFile.error}. Pick a different file to continue —
                            the invoice can&apos;t be created without one.
                        </p>
                    )}
                    {invoiceFile.status === "idle" && (
                        <p className="text-sm text-zinc-500">No file attached yet.</p>
                    )}
                    {poDetection && (
                        <p
                            className={
                                poDetection.level === "warning"
                                    ? "text-sm text-amber-700"
                                    : "text-sm text-blue-700"
                            }
                        >
                            {poDetection.message}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    function renderItemsSection() {
        return (
            <div>
                <h2 className="text-lg font-semibold">Items</h2>
                <div className="mt-2 space-y-3">
                    {items.map((item, i) => {
                        const amount = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
                        return (
                            <div key={i} className="rounded border border-zinc-300 p-3 dark:border-zinc-700">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    <input
                                        placeholder="Item Name"
                                        required
                                        value={item.itemName}
                                        onChange={(e) => updateItem(i, "itemName", e.target.value)}
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
                                        placeholder="Unit Price"
                                        required
                                        value={item.unitPrice}
                                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                        className={inputClass}
                                    />
                                    <select
                                        required
                                        value={item.poRecordId}
                                        onChange={(e) => updateItem(i, "poRecordId", e.target.value)}
                                        disabled={!vendorId}
                                        className={inputClass}
                                    >
                                        <option value="" disabled>
                                            PO
                                        </option>
                                        {posForVendor.map((po) => (
                                            <option key={po.id} value={po.id}>
                                                {po.poId}
                                            </option>
                                        ))}
                                    </select>
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
                <p className="mt-2 text-sm font-medium">Items total (preview): {itemsTotal.toFixed(2)}</p>
            </div>
        );
    }

    return (
        <form action={formAction} className="mt-6 space-y-8">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

            <div className="flex gap-2 border-b border-zinc-300 dark:border-zinc-700">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={
                            activeTab === tab.id
                                ? "border-b-2 border-foreground px-3 pb-2 text-sm font-semibold"
                                : "px-3 pb-2 text-sm text-zinc-500"
                        }
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Same state, same fields, every time — the tab only ever
                reorders these three blocks. PDF Upload leads with the file
                (and whatever it auto-fills below); Manual Entry leads with
                the fields to fill in by hand, with the still-required file
                attachment last. */}
            {activeTab === "pdf" ? (
                <>
                    {renderFileSection()}
                    {renderHeaderFields()}
                    {renderItemsSection()}
                </>
            ) : (
                <>
                    {renderHeaderFields()}
                    {renderItemsSection()}
                    {renderFileSection()}
                </>
            )}

            <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />
            {invoiceFile.status === "done" && (
                <>
                    <input type="hidden" name="invoiceFileUrl" value={invoiceFile.url} />
                    <input type="hidden" name="invoiceFileFilename" value={invoiceFile.filename} />
                </>
            )}

            <button
                type="submit"
                disabled={pending || invoiceFile.status !== "done"}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending
                    ? "Submitting..."
                    : invoiceFile.status === "uploading"
                        ? "Uploading file..."
                        : invoiceFile.status !== "done"
                            ? "Attach the invoice file to continue"
                            : "Create Invoice"}
            </button>
        </form>
    );
}
