import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getInvoiceDeliveryStatus } from "@/lib/deliveryReconciliation";
import { STATUS_COPY, describeInvoiceColumn } from "@/lib/deliveryStatus";
import { InferredMarker, StatusChip } from "@/app/components/DeliveryStatusMarks";
import { formatUSD } from "@/lib/format";

export const metadata = { title: "Invoices" };

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
                <div className="mt-6 overflow-x-auto">
                {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE
                    PAGE HAS: `max-w-4xl` is 56rem and `p-8` takes 4rem, leaving
                    832px. #19's tables and the deliveries list are 52rem for the
                    same reason.

                    #166 gave this table a colgroup it did not have. An auto-layout
                    table sizes its columns from its own rows, so the Delivery
                    column was as wide as the longest phrase in it and every other
                    column moved when one invoice's status changed. With chips the
                    content is a closed set, so the widths can be declared from the
                    widest chip rather than discovered per page load.

                    MEASURED, NOT GUESSED, and this table has almost no slack:
                    seven columns need 832px against the 832px the page has. Six of
                    the seven are bounded by construction and cannot grow — an
                    Invoice ID is a fixed format (128px), a date is 10 characters
                    (80px), the Delivery column is a closed set of three chips plus
                    a marker (120px), Amount Due is bound by its own header (78px),
                    and Status by `Paid 2026-07-27` beside a `⚠ Variance` badge
                    (176px, and the reason the last column drops its right padding).
                    So VENDOR IS WHERE THE SLACK ISN'T: 8rem holds the longest name
                    on this base at 16 characters with nothing to spare, and it is
                    also the one column where wrapping would be least harmful if a
                    longer supplier is ever added. */}
                <table className="w-full min-w-[52rem] table-fixed text-sm">
                    <colgroup>
                        <col style={{ width: "8.5rem" }} />
                        <col style={{ width: "8rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "8rem" }} />
                        <col style={{ width: "11rem" }} />
                    </colgroup>
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
                                    than delivered" and not "over-billed", because at
                                    any one moment the two are the same measurement.

                                    ONE CHIP, AND NO EXCEPTION TAGS. The two
                                    beyond-the-order tags this column used to carry
                                    both left it, for different reasons. `beyond
                                    order` (billed > ordered) is already on this very
                                    page as the `⚠ Variance` badge in the items
                                    table, which `Invoice Items.Variance Flag`
                                    drives — one fact rendered twice on one screen.
                                    `over-delivery` (delivered > ordered) is not a
                                    fact about THIS invoice at all but about the
                                    ordered item, and inside a column headed
                                    `Delivery` it reads as "more arrived than this
                                    bill covers", which is a different and wrong
                                    claim. Both facts are on the invoice detail,
                                    under the ordered item they belong to. */}
                                <td className="py-1 pr-2">
                                    {(() => {
                                        const summary = statusByInvoice.get(inv.id);
                                        if (!summary) return <span className="text-zinc-500">—</span>;
                                        return (
                                            <span className="flex items-center gap-1">
                                                <StatusChip chip={describeInvoiceColumn(summary)} />
                                                {summary.estimated && (
                                                    <InferredMarker
                                                        label={STATUS_COPY.column.inferred().text}
                                                    />
                                                )}
                                            </span>
                                        );
                                    })()}
                                </td>
                                {/* NO RIGHT PADDING ON THE LAST COLUMN — there is
                                    nothing to its right to separate it from, and
                                    this table's budget is tight enough that those
                                    8px are the difference between `Paid 2026-07-27`
                                    beside a `⚠ Variance` badge fitting on one line
                                    and wrapping. */}
                                <td className="py-1">
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
                </div>
            )}
        </div>
    );
}
