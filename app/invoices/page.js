import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getAllVendors } from "@/lib/airtable/vendors";
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
