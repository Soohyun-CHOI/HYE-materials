"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createInvoiceAction } from "./actions";

const EMPTY_ITEM = { itemName: "", qty: "", unitPrice: "", poRecordId: "" };
const inputClass =
    "rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50 dark:border-zinc-700 dark:bg-black";

// The common case (per product decision) is one PO with several invoices —
// an invoice spanning several POs is the supported edge case, not the
// default flow. So "PO" is picked once at the header and seeds every new
// line item's PO, rather than forcing an independent pick on every single
// line — but each line's PO can still be changed on its own for the edge
// case, since Invoice Items each carry their own required PO link.
export default function InvoiceForm({ vendors, pos }) {
    const [state, formAction, pending] = useActionState(createInvoiceAction, null);

    const [vendorId, setVendorId] = useState("");
    const [defaultPoId, setDefaultPoId] = useState("");
    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

    const posForVendor = useMemo(
        () => pos.filter((po) => po.vendorId === vendorId),
        [pos, vendorId]
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

    return (
        <form action={formAction} className="mt-6 space-y-8">
            {state?.error && (
                <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {state.error}
                </p>
            )}

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

            <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

            <button
                type="submit"
                disabled={pending}
                className="w-full rounded bg-foreground px-3 py-2 text-background disabled:opacity-50"
            >
                {pending ? "Submitting..." : "Create Invoice"}
            </button>
        </form>
    );
}
