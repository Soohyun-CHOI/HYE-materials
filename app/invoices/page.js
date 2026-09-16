import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllInvoices } from "@/lib/airtable/invoices";
import { getInvoiceItemsByRecordIds } from "@/lib/airtable/invoiceItems";
import { getAllVendors } from "@/lib/airtable/vendors";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import {
    getDeliveryInvoicing,
    getInvoiceDeliveryStatus,
    getOrderedItemsWithDelivery,
} from "@/lib/deliveryReconciliation";
import { resolveInvoiceScope } from "@/lib/invoiceVisibility";
import { jobForInvoices } from "@/lib/invoiceJob";
import { accessibleJobs } from "@/lib/deliveryAccess";
import { summarizeDelivery } from "@/lib/deliveryAllocation";
import {
    INVOICE_PAYMENT_WORDS,
    daysWaiting,
    describeInvoiceColumn,
    describeInvoiceOverdue,
    invoicePayment,
    invoicePaymentWord,
    isNotFullyInvoiced,
    selectInvoicesAwaitingDelivery,
    sortLongestWaitingFirst,
} from "@/lib/deliveryStatus";
import { jobOptionLabel, parseFilters, pickerOptions } from "@/lib/listFilters";
import { withOpsLabel } from "@/lib/airtableOps";
import { VARIANCE_COPY } from "@/lib/variance";
import AwaitingInvoiceStrip from "./AwaitingInvoiceStrip";
import AwaitingDeliveryStrip from "./AwaitingDeliveryStrip";
import InvoicesListClient from "./InvoicesListClient";

export const metadata = { title: "Invoices" };

// ROW-SCOPED, NOT ROLE-SCOPED (#211), and the same shape #119 gave the PR list:
// any active session reaches the page, and each row is judged per record. This
// replaced a President-or-Admin route gate whose reason was never recorded
// anywhere — #132 wrote "the invoice pages stay President-or-Admin" as a scope
// boundary for that issue rather than as a decision, so there was no argument to
// overturn. What replaced it: the employee who counted the material is the only
// reader positioned to notice that a vendor invoiced for thirteen and shipped ten,
// and the line as drawn was already leaking anyway — #167 hands that same employee
// the vendor's invoice PDF as a quotation, and /pos/[poId] shows them the Amount
// column, so what the company agreed to pay was fully in view while what the
// vendor charged was not.
//
// NOTHING ON THIS SCREEN IS WITHHELD FROM A READER WHO REACHES THE ROW (#309).
// Payment was, on #211's own ground that a vendor's own staff might ask about it on
// site; the office asked for the opposite, so the gate deciding whether a document
// is visible is now the only gate on reading it. What that costs is the second
// column budget — see the colgroup — and what it does NOT touch is the write:
// recording payment is `/invoices/[invoiceId]`'s Admin-only form and this list has
// never offered it.
//
// AND SINCE #314 THE PAGE ASKS NO PRIVILEGE QUESTION AT ALL. The last one was a cost
// decision — whether to fetch the invoice items the gate walks from — and the `Job`
// column needs that walk's records whoever is reading, so the branch is gone and the
// two readers run one path. **That is the property, not a side effect:** the office
// and a site employee now spend the same operations on this screen and read the same
// eight columns, and a rendered fact derived on one side of a privilege test is the
// mutant #309 removed from the payment cell and this issue must not reintroduce one
// column along. `offline/job-column.mjs` holds it.
//
// Labeled for #190 by #216, and for the reason #224 exists: this page had no
// label, so its cost had never been measured and #216 could not have shown what
// its own strip added. The strip also removed a duplicate read inside
// getDeliveryInvoicing that had been standing on /deliveries unseen for the same
// reason. Labeling the screen you are changing is what makes a before and after
// possible at all; the sweep across every other screen is #224's.
export default async function InvoiceListPage(props) {
    return withOpsLabel("/invoices", () => renderInvoiceListPage(props));
}

async function renderInvoiceListPage({ searchParams }) {
    const user = await requireUser();
    // #324 — THIS PAGE TOOK NO `searchParams` AT ALL, which is the shape of it having
    // carried no filter: there was no state to read back. It has four axes' worth now,
    // parsed and validated here so a forged value never reaches the browser.
    const sp = await searchParams;

    // Jobs join the first batch since #314 — the strip below has always needed them
    // and the `Job` column needs the same read, so the column costs this page no
    // query of its own. `allJobs` and the narrowed `deliveryJobs` are two locals on
    // purpose; see the column's own note.
    const [allInvoices, vendors, allJobs] = await Promise.all([
        getAllInvoices(),
        getAllVendors(),
        getAllJobs(),
    ]);
    const vendorNameById = Object.fromEntries(vendors.map((v) => [v.id, v.vendorName]));
    const jobById = new Map(allJobs.map((j) => [j.id, j]));

    // THE GATE'S WALK, RUN FOR EVERY READER SINCE #314 — and the privilege question
    // this page used to ask is gone with it. `seesEveryInvoice` decided whether to
    // fetch the items at all, because the walk was only ever for the gate and a
    // President or an Admin needs no gate. The `Job` column needs what that walk
    // RESOLVES rather than what it decides: an invoice holds no job, so the only way
    // to one is through the order to the request behind it, and that is the walk.
    //
    // SO THE COST DECISION BECAME A CORRECTNESS ONE AND LEFT THIS FILE. Resolving the
    // job from a walk one reader skips is a rendered fact derived two ways, which is
    // the shape #309 spent a whole issue removing from this very table. The judgment
    // is `lib/invoiceJob.js` and takes no reader; what varies by reader is which rows
    // survive `visible`, which is the only thing that ever should.
    const invoiceItems = await getInvoiceItemsByRecordIds(
        allInvoices.flatMap((inv) => inv.invoiceItems || [])
    );
    const { visible: visibleIds, poById, prById } = await resolveInvoiceScope(
        user,
        allInvoices,
        invoiceItems
    );
    const invoices = allInvoices.filter((inv) => visibleIds.has(inv.id));

    // #314 — the job each invoice charges for, from the records the walk above already
    // resolved. No query: the orders and the requests are in hand, and a request
    // carries `Job` as a lookup through its discipline.
    const jobByInvoice = jobForInvoices({ invoiceItems, poById, prById });

    // Issue #166 — whether what each invoice invoiced for has been delivered. TWO
    // operations for a page of any size, down from five: #210 stores the pairing on
    // `Invoices."Delivery"`, so the two levels that existed only to attribute an
    // answer — every OTHER invoice on the same ordered item, and those invoices' parents
    // for their `Issue Date` — are nobody's business any more. It read THREE until
    // #314, whose third was the `Invoice Items` level this page now holds and hands
    // over; the read did not get cheaper, it stopped happening twice. The per-row
    // alternative is what #143 ruled out and #162 measured at over 200 calls. The
    // rule itself is lib/deliveryStatus.js.
    //
    // RUN OVER THE GATED ROWS, so a refused invoice's items never reach the wire
    // either — the same call #169 makes when it gathers PO Item ids from the rows
    // canViewPR already admitted.
    // #256 — `orderedItemsByInvoice` is the level this call already read and used to
    // discard, so the second strip's selection costs no query for it.
    //
    // #314 — AND THE LEVEL IT USED TO READ IS HANDED OVER, FILTERED TO THE GATED ROWS.
    // The filter is the gather rule, not an optimization: `orderedItemsByInvoice`
    // feeds a `PO Items` read below, so passing every invoice's items would put a
    // refused row's ordered items on the wire. Same line #169 draws on `/pos` and
    // `offline/po-payment-column.mjs` holds there.
    const { byInvoice: statusByInvoice, orderedItemsByInvoice } = await getInvoiceDeliveryStatus(
        invoices,
        invoiceItems.filter((item) => visibleIds.has(item.invoice?.[0]))
    );

    // #216 — THE STRIP'S ROWS ARE DELIVERIES, SO THEY ARE GATED AS DELIVERIES.
    // That is the one thing this strip does not inherit from #176, where the
    // strip and the table below it were both `canViewPR` and the distinction
    // could not show. Here the table is invoices, judged by the
    // getVisibleInvoiceIds walk, and the strip is deliveries, judged by
    // canAccessJobDeliveries — Job assignment, or the office. The two admit
    // different people: an employee can reach an invoice through a purchase
    // order they raised without being assigned to that job, and a delivery on
    // that job is not theirs to see. A strip uses its OWN rows' rule.
    //
    // Reading each accessible Job's `Deliveries` reverse-link is the same shape
    // /deliveries uses, and for its reason: it degrades with how many jobs a
    // viewer is on rather than with how large the table grows.
    //
    // #314 — NARROWED FROM `allJobs`, AND THE TWO LOCALS MUST NOT BE FOLDED. This one
    // is the jobs the reader may act on for DELIVERIES; the `Job` column reads
    // `jobById`, built from every job, because the column names the job an invoice
    // charges for and that judgment takes no reader. Feeding the column from this
    // narrowed list would blank the cell for a job outside the reader's delivery
    // scope, which is a reader-dependent column arriving by the back door.
    const deliveryJobs = accessibleJobs(user, allJobs);
    const jobDeliveries = await getDeliveriesByRecordIds(
        deliveryJobs.flatMap((j) => j.deliveries || [])
    );
    // One call, and it now hands back the Delivery Item rows it read — before
    // #216 it kept them and every caller read the same level again. `slices` is
    // what builds "what was delivered" below.
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
                // BOTH NAMES, AND NEITHER IS REDUNDANT (#256). `waitingSince` is what
                // the shared sort orders by, neutral because a third caller now passes
                // an invoice's date; `receivedDate` is what the row RENDERS, where the
                // specific name is the honest one — the strip prints a delivery's
                // received date and says so.
                waitingSince: d.receivedDate || "",
                receivedDate: d.receivedDate || "",
                // The tie-break, generalized off `createdAt` in #256's second pass so
                // the invoice axis could pass an id instead. Sort-only: nothing renders
                // it, which is why this one is renamed rather than doubled.
                createdKey: d.createdAt || "",
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

    // #256 — the other direction. Selection is the chip's own key, so no invoice can
    // sit here and read differently in the table; the split into two row kinds needs
    // only whether anything was delivered against the ordered items each invoice charges,
    // which is one batched read over ids the call above already returned.
    const awaitingDeliveryRows = selectInvoicesAwaitingDelivery({
        invoices,
        statusByInvoice,
        orderedItemsByInvoice,
        deliveredOrderedItems: await getOrderedItemsWithDelivery(
            [...orderedItemsByInvoice.values()].flat()
        ),
        vendorNameById,
        today,
    });


    // #324 — EVERY ROW PRE-SHAPED ON THE SERVER, which is the arrangement the other
    // three lists already use and this one did not, because it had no client component
    // to hand a row to. Each judgment is made exactly where it was: the chip is
    // `describeInvoiceColumn`'s, the payment word and the overdue badge come out of one
    // `invoicePayment` call against the page's single `today`, and the job was resolved
    // by the walk that gated the row. The browser reads keys.
    const rows = invoices.map((inv) => {
        const summary = statusByInvoice.get(inv.id);
        const payment = invoicePayment(inv, today);
        const { badge } = describeInvoiceOverdue(payment);
        return {
            id: inv.id,
            invoiceId: inv.invoiceId,
            vendorId: inv.vendor?.[0] ?? null,
            vendorName: vendorNameById[inv.vendor?.[0]] || "—",
            jobId: jobByInvoice.get(inv.id) ?? null,
            jobCode: jobById.get(jobByInvoice.get(inv.id))?.jobCode || null,
            issueDate: inv.issueDate || "",
            dueDate: inv.dueDate || "",
            amountDue: inv.amountDue,
            deliveryChip: summary ? describeInvoiceColumn(summary) : null,
            paid: payment.paid,
            // The value the `Status` filter matches on AND the word the cell prints,
            // which is one string rather than two that agree.
            status: invoicePaymentWord(payment),
            paymentWord: invoicePaymentWord(payment),
            overdueBadge: badge ? badge.text : null,
            varianceBadge: inv.varianceFlag ? VARIANCE_COPY.header : null,
        };
    });

    // #324 — the pickers read the rows this reader can already see. `jobById` is built
    // from EVERY job rather than from `deliveryJobs`, for the reason #314 recorded when
    // it refused to fold those two locals: the job an invoice charges for is a
    // judgment that takes no reader, so narrowing the map would blank a cell — and now
    // drop an option — for a job outside this reader's DELIVERY scope, which is a
    // different scope from the one that admitted the row.
    const options = {
        job: pickerOptions(rows, "jobId", (r) =>
            jobOptionLabel(r.jobCode, jobById.get(r.jobId)?.jobName)
        ),
        vendor: pickerOptions(rows, "vendorId", (r) => r.vendorName),
        // THE TWO PAYMENT WORDS, AND NOT A THIRD. `Overdue` is a qualifier on
        // `Not paid` rather than a fourth state — it composes with the word above it
        // (#316) — so offering it here would make the select's options overlap and a
        // reader picking `Not paid` would wonder what they had excluded.
        status: [INVOICE_PAYMENT_WORDS.paid, INVOICE_PAYMENT_WORDS.notPaid],
    };
    const initialFilters = parseFilters("/invoices", sp ?? {}, options);

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

            {/* Above the list, because a delivery nobody has invoiced for cannot
                appear in a list of invoices — there is no invoice to carry the
                row. Renders nothing when there is nothing, which is the correct
                and common state.

                NEITHER STRIP IS NARROWED BY THE BAR BELOW IT (#324). A strip's rows
                are gated by their OWN rule — these are deliveries under
                canAccessJobDeliveries where the table is invoices under the
                getVisibleInvoiceIds walk (#216) — and its heading carries a count of
                what is waiting. Filtering it would make that count a filtered count
                and the sentence false. */}
            <AwaitingInvoiceStrip rows={awaitingInvoiceRows} />

            {/* #256 — SECOND, AND THE ORDER IS THE DOCUMENTS' OWN. A delivery waiting
                for an invoice comes before an invoice waiting for a delivery in the flow the
                two describe, so reading down the page puts the two ends of one
                situation in the order they occur and neither heading has to say which
                end it is. See the strip's own header for why that beat the adjacency
                argument. Renders nothing when there is nothing, like the one above. */}
            <AwaitingDeliveryStrip rows={awaitingDeliveryRows} />

            {/* THE THREE EMPTY STATES ARE THE CLIENT'S SINCE #324, and this list had
                two: `No invoices yet.` and the scope sentence, with no third for a
                filter because there were no filters. The `yet` rule is unchanged and
                is why they were two rather than one — an employee whose jobs carry no
                invoice is not looking at an empty base — and `allInvoices.length` is
                still what tells the two apart. */}
            <InvoicesListClient
                rows={rows}
                options={options}
                initialFilters={initialFilters}
                totalCount={allInvoices.length}
            />
        </div>
    );
}
