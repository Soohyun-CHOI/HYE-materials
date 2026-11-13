"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateInvoiceAction } from "../actions";
import { ACCEPTANCE_COPY, ITEM_VARIANCE_KINDS, VARIANCE_COPY, varianceState } from "@/lib/variance";

const inputClass =
    "rounded border border-zinc-300 px-2 py-1";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50";

// Issue #117 Tier 1 — edit an invoice's header fields and the VALUES of its
// existing invoice items. Size/Maker/Unit are frozen copies from the linked PO Item
// (reference-only, shown disabled), and the PO/PO Item links, plus
// adding/removing invoice items, are out of scope here (delete + recreate for those).
export default function EditInvoiceForm({ invoice, items: initialItems, vendors }) {
    const [state, formAction, pending] = useActionState(updateInvoiceAction, null);

    const [items, setItems] = useState(
        initialItems.map((it) => ({
            id: it.id,
            itemName: it.itemName ?? "",
            size: it.size ?? "",
            maker: it.maker ?? "",
            unit: it.unit ?? "",
            qty: it.qty ?? "",
            unitPrice: it.unitPrice ?? "",
            remark: it.remark ?? "",
            poId: it.poId || "—",
            // #648 — each kind open or accepted, as the record holds it when the form opens.
            priceVariance: varianceState(it, "price"),
            quantityVariance: varianceState(it, "quantity"),
        }))
    );

    function updateItem(index, field, value) {
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
    }

    const itemsSubtotal = items.reduce(
        (sum, it) => sum + (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0),
        0
    );

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
                        defaultValue={invoice.vendor?.[0] || ""}
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
                        Vendor Invoice # (optional)
                    </label>
                    <input
                        id="vendorInvoiceCode"
                        name="vendorInvoiceCode"
                        defaultValue={invoice.vendorInvoiceCode || ""}
                        className={fieldClass}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="issueDate" className="block text-sm font-medium">
                            Issue Date
                        </label>
                        <input
                            type="date"
                            id="issueDate"
                            name="issueDate"
                            defaultValue={invoice.issueDate || ""}
                            required
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium">
                            Due Date (optional)
                        </label>
                        <input
                            type="date"
                            id="dueDate"
                            name="dueDate"
                            defaultValue={invoice.dueDate || ""}
                            className={fieldClass}
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="invoiceTotal" className="block text-sm font-medium">
                        Invoice Total
                    </label>
                    <input
                        type="number"
                        step="0.01"
                        id="invoiceTotal"
                        name="invoiceTotal"
                        defaultValue={invoice.invoiceTotal ?? ""}
                        required
                        className={fieldClass}
                    />
                    <p className="mt-1 text-xs text-zinc-500">
                        The figure printed on the vendor&apos;s invoice. Editing it re-checks
                        it against our calculated total.
                    </p>
                </div>

                {/* #283 — Sales Tax joins the group Tariff is already in, and it
                    follows THIS screen's convention rather than the create form's:
                    an always-visible optional field with a placeholder saying what
                    blank means. The two screens differ on purpose — a correction
                    screen shows every correctable value, including the ones this
                    invoice does not have, while a create form asks only for what
                    the document in front of the reader actually states. Moving
                    either convention onto the other screen was considered and
                    declined. A third field in a two-column grid is a third column. */}
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label htmlFor="shippingFee" className="block text-sm font-medium">
                            Shipping Fee
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="shippingFee"
                            name="shippingFee"
                            defaultValue={invoice.shippingFee ?? 0}
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="tariff" className="block text-sm font-medium">
                            Tariff (optional)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="tariff"
                            name="tariff"
                            defaultValue={invoice.tariff ?? ""}
                            placeholder="Leave blank if none"
                            className={fieldClass}
                        />
                    </div>
                    <div>
                        <label htmlFor="salesTax" className="block text-sm font-medium">
                            Sales Tax (optional)
                        </label>
                        <input
                            type="number"
                            step="0.01"
                            id="salesTax"
                            name="salesTax"
                            defaultValue={invoice.salesTax ?? ""}
                            placeholder="Leave blank if none"
                            className={fieldClass}
                        />
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-semibold">Items</h2>
                <p className="text-sm text-zinc-600">
                    Edit item values. Size/Maker/Unit and the linked PO are fixed here — to change an
                    item&apos;s PO or add/remove items, delete and recreate the invoice.
                </p>
                <div className="mt-2 space-y-3">
                    {items.map((it, i) => {
                        const amount = (parseFloat(it.qty) || 0) * (parseFloat(it.unitPrice) || 0);
                        return (
                            <div key={it.id} className="rounded border border-zinc-300 p-3">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    <input
                                        placeholder="Item Name"
                                        required
                                        value={it.itemName}
                                        onChange={(e) => updateItem(i, "itemName", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        value={it.size}
                                        disabled
                                        placeholder="Size"
                                        className={`${inputClass} opacity-60`}
                                    />
                                    <input
                                        value={it.maker}
                                        disabled
                                        placeholder="Maker"
                                        className={`${inputClass} opacity-60`}
                                    />
                                    <input
                                        value={it.unit}
                                        disabled
                                        placeholder="Unit"
                                        className={`${inputClass} opacity-60`}
                                    />
                                    <input
                                        type="number"
                                        placeholder="Qty"
                                        required
                                        value={it.qty}
                                        onChange={(e) => updateItem(i, "qty", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Unit Price"
                                        required
                                        value={it.unitPrice}
                                        onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                                        className={inputClass}
                                    />
                                    <input
                                        placeholder="Remark"
                                        value={it.remark}
                                        onChange={(e) => updateItem(i, "remark", e.target.value)}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                                    <span>
                                        PO: {it.poId}
                                        {/* #648 — an accepted variance reads as accepted here
                                            too, and says what a save will do to it: a changed
                                            quantity or unit price is a changed figure it was
                                            accepted on. */}
                                        {ITEM_VARIANCE_KINDS.map((kind) => {
                                            const state = it[`${kind}Variance`];
                                            if (!state) return null;
                                            const accepted = state === "accepted";
                                            return (
                                                <span
                                                    key={kind}
                                                    className={`ml-2 rounded px-1 text-xs ${
                                                        accepted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                                    }`}
                                                >
                                                    {accepted ? ACCEPTANCE_COPY.badge[kind] : VARIANCE_COPY[kind]}
                                                </span>
                                            );
                                        })}
                                        {ITEM_VARIANCE_KINDS.some((kind) => it[`${kind}Variance`] === "accepted") && (
                                            <span className="block text-xs text-zinc-500">{ACCEPTANCE_COPY.editNote}</span>
                                        )}
                                    </span>
                                    <span>Amount (preview): {amount.toFixed(2)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <p className="mt-2 text-sm font-medium">
                    Items Subtotal (preview): {itemsSubtotal.toFixed(2)}
                </p>
            </div>

            <input type="hidden" name="invoiceId" value={invoice.invoiceId} />
            <input
                type="hidden"
                name="itemsJson"
                value={JSON.stringify(
                    items.map((it) => ({
                        id: it.id,
                        itemName: it.itemName,
                        qty: it.qty,
                        unitPrice: it.unitPrice,
                        remark: it.remark,
                    }))
                )}
            />

            <div className="flex flex-row-reverse items-center gap-3">
                <button
                    type="submit"
                    disabled={pending}
                    className="rounded bg-foreground px-3 py-2 text-sm text-background disabled:opacity-50"
                >
                    {pending ? "Saving..." : "Save changes"}
                </button>
                <Link href={`/invoices/${invoice.invoiceId}`} className="text-sm underline">
                    Cancel
                </Link>
            </div>
        </form>
    );
}
