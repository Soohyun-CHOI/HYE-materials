import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getInvoiceDeliveryStatus } from "@/lib/deliveryReconciliation";
import { STATUS_COPY, describeInvoiceColumn } from "@/lib/deliveryStatus";
import { formatUSD } from "@/lib/format";

// President-or-Admin, same access rule as the invoice detail and PO pages
// (#48/#15). Invoices have no per-requester scoping — anyone allowed to view
// invoices sees them all. The gate is an inline check (no dedicated helper),
// matching app/pos/[poId] and app/invoices/[invoiceId].
export default async function InvoiceListPage() {
    const user = await requireUser();
    const authorized = user.role === "President" || user.isAdmin === true;

    if (!authorized) {
        return (
            <div className="flex flex-1 items-center justify-center p-8">
                <p>Not authorized. This page is President/Admin-only.</p>
            </div>
        );
    }

    const [invoices, vendors] = await Promise.all([getAllInvoices(), getAllVendors()]);
    const vendorNameById = Object.fromEntries(vendors.map((v) => [v.id, v.vendorName]));

    // Issue #166 — whether what each invoice billed for has been recorded as
    // arrived. FIVE operations for a page of any size, each fetching a whole level
    // keyed on ids from the level above: the invoices already carry their own
    // `Invoice Items` array, and two of the five exist because the answer is
    // attributed to ONE invoice, which means reading every other bill on the same
    // ordered line. The per-row alternative is what #143 ruled out and #162
    // measured at over 200 calls. The rule itself is lib/deliveryStatus.js.
    const statusByInvoice = await getInvoiceDeliveryStatus(invoices);

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Invoices</h1>
                <Link
                    href="/invoices/new"
                    className="rounded bg-foreground px-3 py-2 text-sm text-background"
                >
                    New invoice
                </Link>
            </div>

            {invoices.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No invoices yet.</p>
            ) : (
                <table className="mt-6 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Invoice ID</th>
                            <th className="pr-2">Vendor</th>
                            <th className="pr-2">Issue Date</th>
                            <th className="pr-2">Due Date</th>
                            <th className="pr-2 text-right">Amount Due</th>
                            <th className="pr-2">Delivery</th>
                            <th className="pr-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.map((inv) => (
                            <tr key={inv.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">
                                    <Link href={`/invoices/${inv.invoiceId}`} className="underline">
                                        {inv.invoiceId}
                                    </Link>
                                </td>
                                <td className="py-1 pr-2">{vendorNameById[inv.vendor?.[0]] || "—"}</td>
                                <td className="py-1 pr-2">{inv.issueDate || "—"}</td>
                                <td className="py-1 pr-2">{inv.dueDate || "—"}</td>
                                <td className="py-1 pr-2 text-right">{formatUSD(inv.amountDue)}</td>
                                {/* Issue #166 — a FACT, never a verdict: "more billed
                                    than recorded as arrived" and not "over-billed",
                                    because at any one moment the two are the same
                                    measurement. The beyond-order tags are the second
                                    comparison and sit beside the phrase rather than
                                    inside it, since a line can be covered AND beyond
                                    the order at once. */}
                                <td className="py-1 pr-2">
                                    {(() => {
                                        const summary = statusByInvoice.get(inv.id);
                                        if (!summary) return <span className="text-zinc-500">—</span>;
                                        const phrase = describeInvoiceColumn(summary);
                                        return (
                                            <span className="flex flex-wrap items-center gap-1">
                                                <span
                                                    className={
                                                        summary.key === "all-arrived"
                                                            ? "text-green-700 dark:text-green-400"
                                                            : summary.key === "none-arrived"
                                                              ? "text-amber-700 dark:text-amber-500"
                                                              : "text-zinc-600 dark:text-zinc-400"
                                                    }
                                                >
                                                    {phrase.text}
                                                </span>
                                                {/* Issue #166 — the estimate
                                                    qualifier is a TAG, not a
                                                    fourth set of copy: it
                                                    composes with any state
                                                    rather than doubling them,
                                                    the same shape #19's
                                                    `PO unsigned` uses. */}
                                                {summary.estimated && (
                                                    <span
                                                        title="This invoice shares an order line with another bill and the arrivals cannot be told apart, so the oldest bill is treated as settled first."
                                                        className="whitespace-nowrap rounded bg-zinc-200 px-1 text-xs text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                                    >
                                                        {STATUS_COPY.column.estimated().text}
                                                    </span>
                                                )}
                                                {summary.anyArrivedBeyondOrder && (
                                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        over-delivery
                                                    </span>
                                                )}
                                                {summary.anyBilledBeyondOrder && (
                                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        beyond order
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    })()}
                                </td>
                                <td className="py-1 pr-2">
                                    <span
                                        className={
                                            inv.paid
                                                ? "text-green-700 dark:text-green-400"
                                                : "text-zinc-500"
                                        }
                                    >
                                        {inv.paid ? `Paid${inv.paidDate ? ` ${inv.paidDate}` : ""}` : "Unpaid"}
                                    </span>
                                    {inv.varianceFlag && (
                                        <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-400">
                                            ⚠ Variance
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
