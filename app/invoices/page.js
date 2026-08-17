import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getInvoiceItemsByRecordIds } from "@/lib/airtable/invoiceItems";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { getDeliveryInvoicing, getInvoiceDeliveryStatus } from "@/lib/deliveryReconciliation";
import { getVisibleInvoiceIds, seesEveryInvoice } from "@/lib/invoiceVisibility";
import { accessibleJobs } from "@/lib/deliveryAccess";
import { summarizeDelivery } from "@/lib/deliveryAllocation";
import {
    daysWaiting,
    describeInvoiceColumn,
    isNotFullyInvoiced,
    sortLongestWaitingFirst,
} from "@/lib/deliveryStatus";
import { withOpsLabel } from "@/lib/airtableOps";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import { formatUSD } from "@/lib/format";
import AwaitingInvoiceStrip from "./AwaitingInvoiceStrip";

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
// Labeled for #190 by #216, and for the reason #224 exists: this page had no
// label, so its cost had never been measured and #216 could not have shown what
// its own strip added. The strip also removed a duplicate read inside
// getDeliveryInvoicing that had been standing on /deliveries unseen for the same
// reason. Labeling the screen you are changing is what makes a before and after
// possible at all; the sweep across every other screen is #224's.
export default async function InvoiceListPage() {
    return withOpsLabel("/invoices", () => renderInvoiceListPage());
}

async function renderInvoiceListPage() {
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

    // Issue #166 — whether what each invoice billed for has been delivered. THREE
    // operations for a page of any size, down from five: #210 stores the pairing on
    // `Invoices."Delivery"`, so the two levels that existed only to attribute an
    // answer — every OTHER bill on the same ordered item, and those bills' parents
    // for their `Issue Date` — are nobody's business any more. The per-row
    // alternative is what #143 ruled out and #162 measured at over 200 calls. The
    // rule itself is lib/deliveryStatus.js.
    //
    // RUN OVER THE GATED ROWS, so a refused invoice's lines never reach the wire
    // either — the same call #169 makes when it gathers PO Item ids from the rows
    // canViewPR already admitted.
    const statusByInvoice = await getInvoiceDeliveryStatus(invoices);

    // #216 — THE STRIP'S ROWS ARE DELIVERIES, SO THEY ARE GATED AS DELIVERIES.
    // That is the one thing this strip does not inherit from #176, where the
    // strip and the table below it were both `canViewPR` and the distinction
    // could not show. Here the table is invoices, judged by the
    // getVisibleInvoiceIds walk, and the strip is arrivals, judged by
    // canAccessJobDeliveries — Job assignment, or the office. The two admit
    // different people: an employee can reach an invoice through a purchase
    // order they raised without being assigned to that job, and a delivery on
    // that job is not theirs to see. A strip uses its OWN rows' rule.
    //
    // Reading each accessible Job's `Deliveries` reverse-link is the same shape
    // /deliveries uses, and for its reason: it degrades with how many jobs a
    // viewer is on rather than with how large the table grows.
    const deliveryJobs = accessibleJobs(user, await getAllJobs());
    const jobDeliveries = await getDeliveriesByRecordIds(
        deliveryJobs.flatMap((j) => j.deliveries || [])
    );
    // One call, and it now hands back the Delivery Item rows it read — before
    // #216 it kept them and every caller read the same level again. `slices` is
    // what builds "what arrived" below.
    const { byDelivery: invoicingByDelivery, slices: deliverySlices } =
        await getDeliveryInvoicing(jobDeliveries);

    const slicesByDelivery = new Map();
    for (const slice of deliverySlices) {
        const parent = slice.delivery?.[0];
        if (!parent) continue;
        if (!slicesByDelivery.has(parent)) slicesByDelivery.set(parent, []);
        slicesByDelivery.get(parent).push(slice);
    }

    // The server's day, taken once so every row is measured against the same one.
    // See daysWaiting for what that does and does not promise.
    const today = new Date().toISOString().slice(0, 10);

    const awaitingInvoiceRows = sortLongestWaitingFirst(
        jobDeliveries
            .filter((d) => isNotFullyInvoiced(invoicingByDelivery.get(d.id)?.key))
            .map((d) => ({
                deliveryId: d.deliveryId,
                receivedDate: d.receivedDate || "",
                createdAt: d.createdAt || "",
                vendorName: vendorNameById[d.vendor?.[0]] || "Unknown vendor",
                daysWaiting: daysWaiting(d.receivedDate, today),
                summary: summarizeDelivery(
                    // Sorted by child ID, which is the order the recorder typed
                    // them, so "first item" means the first one they entered —
                    // the same reason /deliveries sorts before summarizing.
                    (slicesByDelivery.get(d.id) || [])
                        .slice()
                        .sort((a, b) =>
                            (a.deliveryItemId || "").localeCompare(b.deliveryItemId || "")
                        )
                        .map((i) => ({
                            materialRecordId: i.material?.[0] ?? null,
                            itemName: i.itemName,
                            size: i.size,
                            unit: i.unit,
                            qty: i.qty,
                            over: i.overDelivered,
                        }))
                ),
            }))
    );

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

            {/* Above the list, because a delivery nobody has billed for cannot
                appear in a list of invoices — there is no invoice to carry the
                row. Renders nothing when there is nothing, which is the correct
                and common state. */}
            <AwaitingInvoiceStrip rows={awaitingInvoiceRows} />

            {/* TWO EMPTY STATES, because they are two different facts (#168's
                rule). `yet` belongs only to the first: an employee whose jobs carry
                no invoice is not looking at an empty base, and telling them to wait
                would be false. Order is load-bearing — the base-empty case is
                tested first, or a viewer on a base with invoices they cannot see
                would be told none exist. */}
            {allInvoices.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600">No invoices yet.</p>
            ) : invoices.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600">
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
                    (80px), the Delivery column is a closed set of TWO chips plus a
                    marker since #210 and its widest is `Awaiting delivery` (120px,
                    unchanged: the state that left was not the widest one), Amount
                    Due is bound by its own header (78px),
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
                            <tr key={inv.id} className="border-t border-zinc-200">
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

                                    TWO CHIPS AND A MISMATCH MARKER SINCE #210. The
                                    chip is the link's own two states — the shipment
                                    is named or it is not — and a quantity shortfall
                                    is the marker beside it, which is #166's
                                    marker-vs-chip shape inherited rather than
                                    re-argued. `Partly delivered` left this column
                                    with the inference that produced it: the old fill
                                    put an invoice whose own shipment had not arrived
                                    into that state routinely.

                                    STILL NO EXCEPTION TAGS. The two beyond-the-order
                                    tags this column used to carry both left it, for
                                    different reasons. `beyond order` (billed >
                                    ordered) is already on this very page as the
                                    `⚠ Variance` badge in the items table, which
                                    `Invoice Items.Variance Flag` drives — one fact
                                    rendered twice on one screen. `over-delivery`
                                    (delivered > ordered) is not a fact about THIS
                                    invoice at all but about the ordered item, and
                                    inside a column headed `Delivery` it reads as
                                    "more arrived than this bill covers", which is a
                                    different and wrong claim. Both facts are on the
                                    invoice detail, under the ordered item they
                                    belong to. */}
                                {/* THE CHIP ALONE SINCE #232 — a `!` marker stood
                                    beside it and is retired. The discrepancy is a
                                    third chip value now, so the cell says `Mismatch`
                                    in words; the marker would have qualified a word
                                    the reader had already read, with a sentence only
                                    a hover could reach. Still one function, shared
                                    with the detail, so this cell and that page cannot
                                    describe one invoice differently. */}
                                <td className="py-1 pr-2">
                                    {(() => {
                                        const summary = statusByInvoice.get(inv.id);
                                        if (!summary) return <span className="text-zinc-500">—</span>;
                                        return <StatusChip chip={describeInvoiceColumn(summary)} />;
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
                                                    ? "text-green-700"
                                                    : "text-zinc-500"
                                            }
                                        >
                                            {inv.paid ? `Paid${inv.paidDate ? ` ${inv.paidDate}` : ""}` : "Unpaid"}
                                        </span>
                                    )}
                                    {inv.varianceFlag && (
                                        <span
                                            className={`${privileged ? "ml-1 " : ""}rounded bg-red-100 px-1 text-xs text-red-700`}
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
