import { requireUser } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import PaidForm from "./PaidForm";

const DONE_MESSAGES = {
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

    // Issue #16 — surfaced but never blocking: variance is a review
    // prompt, not a gate on marking something paid.
    const hasVariance = invoice.varianceFlag || items.some((it) => it.varianceFlag);
    const file = invoice.file?.[0];

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <h1 className="text-2xl font-semibold">{invoice.invoiceId}</h1>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            <div className="mt-4 space-y-1 text-sm">
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Vendor Invoice #: {invoice.vendorInvoiceCode || "—"}</p>
                <p>Issue Date: {invoice.issueDate}</p>
                <p>Due Date: {invoice.dueDate || "—"}</p>
                <p>Amount Due (Vendor&apos;s Stated Total): {invoice.amountDue}</p>
                <p>Shipping Fee: {invoice.shippingFee ?? 0}</p>
                {invoice.tariff != null && <p>Tariff: {invoice.tariff}</p>}
                <p>Items Subtotal: {invoice.itemsSubtotal ?? 0}</p>
                <p>Calculated Total: {invoice.calculatedTotal ?? 0}</p>
                {invoice.varianceFlag && (
                    <p className="text-red-600">⚠ Header Variance (Amount Due vs Calculated Total)</p>
                )}
                {file && (
                    <p>
                        <a href={file.url} target="_blank" rel="noreferrer" className="underline">
                            {file.filename || "Invoice File"}
                        </a>
                    </p>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
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
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{it.unitPrice}</td>
                                <td className="py-1 pr-2 text-right">{it.amount}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
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
