import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { formatUSD } from "@/lib/format";
import PaidForm from "./PaidForm";

const DONE_MESSAGES = {
    created: "Invoice created.",
    "paid-updated": "Payment status updated.",
};

// President-or-Admin, same reasoning as app/pos/[poId] (#48/#15) — the
// President also needs to see payment status, not just Admins doing the
// day-to-day reconciliation. Marking Paid itself stays Admin-only (see
// actions.js) — this page just renders the toggle form conditionally.
export default async function InvoiceDetailPage({ params, searchParams }) {
    const user = await requireUser();
    const authorized = user.role === "President" || user.isAdmin === true;
    const { invoiceId } = await params;
    const { done } = await searchParams;

    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is President/Admin-only.</p>
            </div>
        );
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    const [items, vendor] = await Promise.all([
        getItemsByInvoice(invoice.id),
        invoice.vendor?.[0] ? getVendorByRecordId(invoice.vendor[0]) : null,
    ]);

    // Linked PO(s): each Invoice Item carries the PO it reconciles against
    // (a multi-PO invoice is real), so the distinct POs are derived from the
    // items rather than reading the Invoice-PO Link join table separately —
    // the two are equivalent by construction (see invoices/new/actions.js).
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    const poRecords = await Promise.all(poRecordIds.map((id) => getPOByRecordId(id)));
    const poById = Object.fromEntries(poRecords.map((po) => [po.id, po]));

    // Issue #16 — surfaced but never blocking: variance is a review prompt,
    // not a gate on marking something paid.
    const hasVariance = invoice.varianceFlag || items.some((it) => it.varianceFlag);
    const file = invoice.file?.[0];

    // Summary rows in the same invoice-style shape as PR/PO (#102), with
    // invoice's own figures. Shipping Fee always renders (as $0.00 when
    // blank): "$0.00 shipping" is accurate info for this invoice. Tariff is
    // deliberately asymmetric — it renders only when the invoice actually
    // itemizes one, because customs duty is often billed separately, so a
    // blank Tariff means "no duty line on this invoice", not "$0.00 of duty";
    // showing "Tariff: $0.00" would wrongly assert the latter. Hiding the row
    // doesn't affect Calculated Total: it's the Airtable formula (Items
    // Subtotal + Shipping Fee + Tariff, blank = 0), so an absent Tariff
    // contributes 0 whether or not the row is shown.
    const summaryRows = [
        { label: "Items Subtotal", value: invoice.itemsSubtotal, strong: false },
        { label: "Shipping Fee", value: invoice.shippingFee, strong: false },
        ...(invoice.tariff != null
            ? [{ label: "Tariff", value: invoice.tariff, strong: false }]
            : []),
        {
            label: "Calculated Total",
            value: invoice.calculatedTotal ?? invoice.itemsSubtotal,
            strong: true,
        },
    ];

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{invoice.invoiceId}</h1>
                <Link href="/invoices" className="text-sm underline">
                    ← All invoices
                </Link>
            </div>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Amount Due (vendor&apos;s stated total)
                </p>
                <p className="text-3xl font-semibold">{formatUSD(invoice.amountDue)}</p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Vendor Invoice #: {invoice.vendorInvoiceCode || "—"}</p>
                <p>Issue Date: {invoice.issueDate}</p>
                <p>Due Date: {invoice.dueDate || "—"}</p>
                {file && (
                    <p>
                        <a href={file.url} target="_blank" rel="noreferrer" className="underline">
                            {file.filename || "Invoice File"}
                        </a>
                    </p>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Purchase Order{poRecords.length === 1 ? "" : "s"}</h2>
                {poRecords.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">None linked.</p>
                ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                        {poRecords.map((po) => (
                            <li key={po.id}>
                                <Link href={`/pos/${po.poId}`} className="underline">
                                    {po.poId}
                                </Link>{" "}
                                — <strong>{po.status}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
                            <th className="pr-2">PO</th>
                            <th className="pr-2">Size</th>
                            <th className="pr-2">Unit</th>
                            <th className="pr-2 text-right">Qty</th>
                            <th className="pr-2 text-right">Unit Price</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it) => (
                            <tr key={it.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">
                                    {it.itemName}
                                    {it.varianceFlag && (
                                        <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
                                            ⚠ Variance
                                        </span>
                                    )}
                                </td>
                                <td className="py-1 pr-2">{poById[it.po?.[0]]?.poId || "—"}</td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{formatUSD(it.unitPrice)}</td>
                                <td className="py-1 pr-2 text-right">{formatUSD(it.amount)}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {summaryRows.map((row, i) => (
                            <tr
                                key={row.label}
                                className={
                                    i === 0 ? "border-t-2 border-zinc-300 dark:border-zinc-700" : undefined
                                }
                            >
                                <td
                                    colSpan={6}
                                    className={
                                        row.strong
                                            ? "py-1 pr-2 text-right font-semibold"
                                            : "py-1 pr-2 text-right text-zinc-500"
                                    }
                                >
                                    {row.label}
                                </td>
                                <td
                                    className={
                                        row.strong
                                            ? "py-1 pr-2 text-right font-semibold"
                                            : "py-1 pr-2 text-right"
                                    }
                                >
                                    {formatUSD(row.value)}
                                </td>
                                <td />
                            </tr>
                        ))}
                    </tfoot>
                </table>
                {invoice.varianceFlag && (
                    <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                        ⚠ Header Variance — the vendor&apos;s Amount Due ({formatUSD(invoice.amountDue)})
                        doesn&apos;t match our Calculated Total ({formatUSD(invoice.calculatedTotal ?? invoice.itemsSubtotal)}).
                    </p>
                )}
            </div>

            <div className="mt-8">
                <h2 className="text-lg font-semibold">Payment</h2>
                {hasVariance && (
                    <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        ⚠ This invoice has variance flags — review before confirming payment.
                    </p>
                )}
                {user.isAdmin ? (
                    <div className="mt-2">
                        <PaidForm invoiceId={invoice.invoiceId} paid={invoice.paid} paidDate={invoice.paidDate} />
                    </div>
                ) : (
                    <p className="mt-2 text-sm">
                        {invoice.paid ? `Paid on ${invoice.paidDate || "—"}` : "Not paid yet."}
                    </p>
                )}
            </div>
        </div>
    );
}
