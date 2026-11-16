"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { updateInvoiceAction } from "../actions";
import { ACCEPTANCE_COPY, ITEM_VARIANCE_KINDS, VARIANCE_COPY } from "@/lib/variance";
import { INVOICE_SPREAD_COPY } from "@/lib/invoiceSpread";

const inputClass =
    "rounded border border-zinc-300 px-2 py-1";
const fieldClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 disabled:opacity-50";

// Issue #117 Tier 1 — edit an invoice's header fields and the VALUES of its
// existing items. Size/Maker/Unit are frozen copies from the linked PO Item
// (reference-only, shown disabled), and adding/removing items is out of scope here
// (delete + recreate for those).
//
// #660 — AN ITEM IS THE VENDOR'S AS IT WAS WRITTEN, AND ONE ON MORE THAN ONE ORDER TAKES A
// QUANTITY PER ORDER. The page hands down each item (`Invoice Items."Position"`) with a share
// per ordered item it may be spread over — its material at its ordered price, on the invoice's
// orders (`lib/invoiceSpread.js:editableShares`) — so the office can move quantity between
// orders, or onto one the save spread nothing to. A share set to nothing is removed on save
// and a share given a quantity is made; the name, the unit price and the remark are the
// item's, written on every share. `updateInvoiceAction` plans the writes with
// `planShareEdits` against what it reads, so this form's figures are a request.
export default function EditInvoiceForm({ invoice, positions, vendors }) {
    const [state, formAction, pending] = useActionState(updateInvoiceAction, null);

    const [items, setItems] = useState(
        positions.map((p) => ({
            key: p.key,
            itemName: p.itemName ?? "",
            size: p.size ?? "",
            maker: p.maker ?? "",
            unit: p.unit ?? "",
            unitPrice: p.unitPrice ?? "",
            remark: p.remark ?? "",
            perOrder: p.perOrder,
            shares: p.shares.map((s) => ({ ...s, qty: s.qty ?? 0 })),
        }))
    );

    function updateItem(index, field, value) {
        setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
    }

    function updateShare(index, shareIndex, value) {
        setItems((prev) =>
            prev.map((it, i) =>
                i === index
                    ? { ...it, shares: it.shares.map((s, j) => (j === shareIndex ? { ...s, qty: value } : s)) }
                    : it
            )
        );
    }

    const totalOf = (it) => it.shares.reduce((sum, s) => sum + (parseFloat(s.qty) || 0), 0);
    const itemsSubtotal = items.reduce((sum, it) => sum + totalOf(it) * (parseFloat(it.unitPrice) || 0), 0);

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
                <p className="text-sm text-zinc-600">{INVOICE_SPREAD_COPY.editIntro}</p>
                <div className="mt-2 space-y-3">
                    {items.map((it, i) => {
                        const total = totalOf(it);
                        const amount = total * (parseFloat(it.unitPrice) || 0);
                        return (
                            <div key={it.key} className="rounded border border-zinc-300 p-3">
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
                                    {!it.perOrder && (
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            required
                                            value={it.shares[0]?.qty ?? ""}
                                            onChange={(e) => updateShare(i, 0, e.target.value)}
                                            className={inputClass}
                                        />
                                    )}
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
                                {/* #660 — A QUANTITY PER ORDER, each with what is uninvoiced on it
                                    apart from this invoice, and the item's total under them. An
                                    order at nothing is one this item will not charge once saved. */}
                                {it.perOrder && (
                                    <div className="mt-2 space-y-1">
                                        {it.shares.map((s, j) => (
                                            <div key={s.invoiceItemId || s.orderedItemId || j} className="flex flex-wrap items-center gap-2 text-sm">
                                                <label
                                                    htmlFor={`share-${i}-${j}`}
                                                    className="w-44 shrink-0 text-zinc-600"
                                                >
                                                    {s.poId || "—"}
                                                </label>
                                                <input
                                                    id={`share-${i}-${j}`}
                                                    type="number"
                                                    min="0"
                                                    value={s.qty}
                                                    onChange={(e) => updateShare(i, j, e.target.value)}
                                                    className={`${inputClass} w-24`}
                                                />
                                                {s.uninvoiced != null && (
                                                    <span className="text-xs text-zinc-500">
                                                        {INVOICE_SPREAD_COPY.uninvoiced(s.uninvoiced, it.unit)}
                                                    </span>
                                                )}
                                                <VarianceBadges share={s} />
                                            </div>
                                        ))}
                                        <p className="text-sm text-zinc-600">{INVOICE_SPREAD_COPY.total(total, it.unit)}</p>
                                    </div>
                                )}
                                <div className="mt-2 flex items-center justify-between text-sm text-zinc-600">
                                    <span>
                                        {!it.perOrder && (
                                            <>
                                                PO: {it.shares[0]?.poId || "—"}
                                                <VarianceBadges share={it.shares[0]} />
                                            </>
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
                        key: it.key,
                        itemName: it.itemName,
                        unitPrice: it.unitPrice,
                        remark: it.remark,
                        shares: it.shares.map((s) => ({
                            invoiceItemId: s.invoiceItemId || null,
                            orderedItemId: s.orderedItemId || null,
                            qty: s.qty,
                        })),
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

// #648 — an accepted variance reads as accepted here too, and says what a save will do to it:
// a changed quantity or unit price is a changed figure it was accepted on. #660 — one share's,
// beside its order's quantity where the item takes one per order.
function VarianceBadges({ share }) {
    if (!share) return null;
    const kinds = ITEM_VARIANCE_KINDS.filter((kind) => share[`${kind}Variance`]);
    if (kinds.length === 0) return null;
    return (
        <>
            {kinds.map((kind) => {
                const accepted = share[`${kind}Variance`] === "accepted";
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
            {kinds.some((kind) => share[`${kind}Variance`] === "accepted") && (
                <span className="block text-xs text-zinc-500">{ACCEPTANCE_COPY.editNote}</span>
            )}
        </>
    );
}
