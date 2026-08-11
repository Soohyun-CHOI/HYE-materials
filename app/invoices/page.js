import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getInvoiceItemsByRecordIds } from "@/lib/airtable/invoiceItems";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getInvoiceDeliveryStatus } from "@/lib/deliveryReconciliation";
import { getVisibleInvoiceIds, seesEveryInvoice } from "@/lib/invoiceVisibility";
import { STATUS_COPY, describeInvoiceColumn } from "@/lib/deliveryStatus";
import { InferredMarker, StatusChip } from "@/app/components/DeliveryStatusMarks";
import { formatUSD } from "@/lib/format";

export const metadata = { title: "Invoices" };

// ROW-SCOPED, NOT ROLE-SCOPED (#211), and the same shape #119 gave the PR list:
// any active session reaches the page, and each row is judged per record. This
// replaced a President-or-Admin route gate whose reason was never recorded
// anywhere — #132 wrote "the invoice pages stay President-or-Admin" as a scope
// boundary for that issue rather than as a decision, so there was no argument to
// overturn. What replaced it: the employee who counted the material is the only
// reader positioned to notice that a vendor billed for thirteen and shipped ten,
// and the line as drawn was already leaking anyway — #167 hands that same employee
// the vendor's invoice PDF as a quotation, and /pos/[poId] shows them the Amount
// column, so what the company agreed to pay was fully in view while what the
// vendor charged was not.
//
// PAYMENT IS THE ONE THING STILL WITHHELD, and that line is #211's own rather than
// inherited: whether a vendor has been paid is the fact a vendor's own staff might
// ask about on site, and the only one on this screen a recorder has no use for. It
// is withheld by not rendering it — this is a Server Component that hands nothing
// to a Client Component, so an unrendered field is not in the payload either.
export default async function InvoiceListPage() {
    const user = await requireUser();
    const privileged = seesEveryInvoice(user);

    const [allInvoices, vendors] = await Promise.all([getAllInvoices(), getAllVendors()]);
    const vendorNameById = Object.fromEntries(vendors.map((v) => [v.id, v.vendorName]));

    // The gate's own walk, and NOT PAID FOR BY THE AUDIENCE THAT DOES NOT NEED IT:
    // a President or an Admin sees every invoice, so their answer needs no lines,
    // no orders and no requests. For everyone else this is one batched read here
    // plus the two inside getVisibleInvoiceIds — constant in the number of rows.
    const invoiceItems = privileged
        ? []
        : await getInvoiceItemsByRecordIds(allInvoices.flatMap((inv) => inv.invoiceItems || []));
    const visibleIds = await getVisibleInvoiceIds(user, allInvoices, invoiceItems);
    const invoices = allInvoices.filter((inv) => visibleIds.has(inv.id));

    // Issue #166 — whether what each invoice billed for has been recorded as
    // arrived. FIVE operations for a page of any size, each fetching a whole level
    // keyed on ids from the level above: the invoices already carry their own
    // `Invoice Items` array, and two of the five exist because the answer is
    // attributed to ONE invoice, which means reading every other bill on the same
    // ordered line. The per-row alternative is what #143 ruled out and #162
    // measured at over 200 calls. The rule itself is lib/deliveryStatus.js.
    //
    // RUN OVER THE GATED ROWS, so a refused invoice's lines never reach the wire
    // either — the same call #169 makes when it gathers PO Item ids from the rows
    // canViewPR already admitted.
    const statusByInvoice = await getInvoiceDeliveryStatus(invoices);

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Invoices</h1>
                {/* Recording an invoice is office work and /invoices/new is
                    Admin-only, so an employee who can now read this list must not
                    be offered a button that lands on a refusal — the same reason
                    the detail page gates its Edit link. */}
                {user.isAdmin && (
                    <Link
                        href="/invoices/new"
                        className="rounded bg-foreground px-3 py-2 text-sm text-background"
                    >
                        New invoice
                    </Link>
                )}
            </div>

            {/* TWO EMPTY STATES, because they are two different facts (#168's
                rule). `yet` belongs only to the first: an employee whose jobs carry
                no invoice is not looking at an empty base, and telling them to wait
                would be false. Order is load-bearing — the base-empty case is
                tested first, or a viewer on a base with invoices they cannot see
                would be told none exist. */}
            {allInvoices.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">No invoices yet.</p>
            ) : invoices.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    No invoices to show. You see an invoice when it bills a purchase order you
                    raised or one on a job you are assigned to.
                </p>
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
                    longer supplier is ever added.

                    TWO BUDGETS SINCE #211, the way /pos/[poId] carries two column
                    counts. The last column holds two unrelated things — payment,
                    which is President-or-Admin, and the variance badge, which is
                    not — so for an employee it keeps the badge alone and needs
                    5rem rather than 11rem. THE 6rem THAT FREES GOES TO VENDOR,
                    which is the column this very comment records as having none:
                    14rem clears the longest name on this base by 6rem instead of
                    by nothing. Both rows still sum to exactly 52rem; a column is
                    never appended and the budget is re-cut (#166). */}
                <table className="w-full min-w-[52rem] table-fixed text-sm">
                    <colgroup>
                        <col style={{ width: "8.5rem" }} />
                        <col style={{ width: privileged ? "8rem" : "14rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "8rem" }} />
                        <col style={{ width: privileged ? "11rem" : "5rem" }} />
                    </colgroup>
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Invoice ID</th>
                            <th className="pr-2">Vendor</th>
                            <th className="pr-2">Issue Date</th>
                            <th className="pr-2">Due Date</th>
                            <th className="pr-2 text-right">Amount Due</th>
                            <th className="pr-2">Delivery</th>
                            {/* NAMED FOR WHAT IT HOLDS. `Status` over a cell that
                                carries only a variance badge would head a column
                                whose subject is missing, and an employee would read
                                the empty cells as a status nobody set. */}
                            <th className="pr-2">{privileged ? "Status" : "Variance"}</th>
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
                                    {/* PAYMENT IS PRESIDENT-OR-ADMIN (#211). The
                                        line is drawn around whether this vendor has
                                        been paid, not around the word payment: the
                                        variance badge beside it is billed-against-
                                        ordered and stays for every viewer, since
                                        catching that is the reason an employee is
                                        on this page at all. */}
                                    {privileged && (
                                        <span
                                            className={
                                                inv.paid
                                                    ? "text-green-700 dark:text-green-400"
                                                    : "text-zinc-500"
                                            }
                                        >
                                            {inv.paid ? `Paid${inv.paidDate ? ` ${inv.paidDate}` : ""}` : "Unpaid"}
                                        </span>
                                    )}
                                    {inv.varianceFlag && (
                                        <span
                                            className={`${privileged ? "ml-1 " : ""}rounded bg-red-100 px-1 text-xs text-red-700 dark:bg-red-950 dark:text-red-400`}
                                        >
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
