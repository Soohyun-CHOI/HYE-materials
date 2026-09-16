import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { getAllVendors } from "@/lib/airtable/vendors";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import { summarizeDelivery } from "@/lib/deliveryAllocation";
import { getDeliveryInvoicing } from "@/lib/deliveryReconciliation";
import { describeDeliveryColumn } from "@/lib/deliveryStatus";
import { jobOptionLabel, parseFilters, pickerOptions } from "@/lib/listFilters";
import { withOpsLabel } from "@/lib/airtableOps";
import DeliveriesListClient from "./DeliveriesListClient";

export const metadata = { title: "Deliveries" };

/**
 * Recorded deliveries, newest delivery first (#162).
 *
 * A PLAIN RECORD LIST, not the discrepancy view. #20 is what compares ordered
 * against delivered against invoiced per material; this exists so a recorded
 * delivery is reachable at all — its author needs to find one to delete it, since
 * deletion is the only way to correct an item or a quantity.
 *
 * Scoped by reading each accessible Job's own `Deliveries` reverse-link and
 * resolving the union in one batched pass, rather than scanning the whole table
 * and filtering. That costs 1 + ceil(n/50) queries and degrades with how many Jobs
 * a viewer is on rather than with how large the table grows — deliveries
 * accumulate one per delivery, faster than PRs do, so the PR list's fetch-all shape
 * was the wrong precedent to copy here. It also needs no `Job Record ID` lookup,
 * since a link field cannot be filtered on but a reverse-link can be read.
 *
 * ORDERED BY `Received Date` DESC, tie-broken by `Created At` DESC. Received Date
 * is what a reader is looking for ("what came in this week"), and it is
 * calendar-only, so several deliveries on one day tie — the tie-break is the moment
 * of entry, which is the second reader that keeps Created At from being a
 * single-purpose field.
 */
// Labeled for #190 by #216, which is also the change that removed a duplicate
// read from this page — getDeliveryInvoicing was reading the same Delivery Items
// this function fetches, and neither cost anything visible because nothing here
// was measured. The label is what turns that fix into a number. #224 is the
// sweep across every other unlabeled screen.
export default async function DeliveriesListPage(props) {
    return withOpsLabel("/deliveries", () => renderDeliveriesListPage(props));
}

async function renderDeliveriesListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;

    // #324 — `allJobs` AND THE NARROWED `jobs` ARE TWO LOCALS, AND THE UNNARROWED ONE
    // COSTS NOTHING. Every Job's `Deliveries` reverse-link is already on the records
    // `getAllJobs` returned, so counting every delivery on the base — which is what
    // tells "none exist yet" apart from "none for you" — is one flatMap over an array
    // this page was already discarding. Without it this list told a reader with jobs
    // but no deliveries on them `No deliveries recorded yet.`, which is the sentence
    // `lib/poListView.js`'s rule bars, said to somebody whose company has plenty.
    // `/invoices` keeps the same two locals for a neighboring reason (#314).
    const allJobs = await getAllJobs();
    const jobs = jobsFor(user, allJobs);
    const jobById = new Map(jobs.map((j) => [j.id, j]));
    const deliveriesOnBase = new Set(allJobs.flatMap((j) => j.deliveries || [])).size;

    // getAllJobs already carries each Job's `Deliveries` reverse-link, so the ids
    // come out of the records the access filter has in hand — no query per Job.
    const deliveryIds = jobs.flatMap((j) => j.deliveries || []);

    const [deliveries, vendors] = await Promise.all([
        getDeliveriesByRecordIds(deliveryIds),
        getAllVendors(),
    ]);
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.vendorName]));

    // Issue #166 withheld this level from a non-privileged viewer by not fetching
    // it at all; #211 RELEASED THAT, and the reason is that this list is already
    // Job-scoped. Every row here is a delivery on a job the viewer is assigned to,
    // which is exactly the condition under which #211 admits them to that job's
    // invoices — so "has this been invoiced" is no longer information they are being
    // kept from one screen away. A rule that hides a figure on one screen and shows
    // it on another is not a rule. Payment is the fact that stays behind, and it is
    // not on this page at all.
    //
    // ONE READ OF Delivery Items FOR THE PAGE, NOT TWO (#216). This function
    // fetched its own copy of every listed delivery's lines and then called
    // getDeliveryInvoicing, which fetched the same level again — a duplicate that
    // stood because nothing here was labeled and so nothing measured it. The lines
    // come back from that call now, and the list summarizes what was delivered from
    // them. A read per delivery would still be the per-row round trip #143 ruled
    // out; this is one batched read for the whole page, down from two.
    const { byDelivery: invoicingByDelivery, slices: allItems } =
        await getDeliveryInvoicing(deliveries);

    // `?unbilled=1` IS GONE (#216). Chasing a vendor moved to a strip above
    // /invoices, where the outcome is recorded, and this page is left with the
    // single job of being a log. The two pulled opposite ways — a log reads newest
    // first and an empty one means nothing delivered; a chasing list reads oldest
    // first and an empty one means there is nothing left to do — and nobody visits
    // a query parameter on a schedule. #324 is what turned that one move into the
    // rule the four lists share, and `?over=1` is what it leaves here.
    const itemsByDelivery = new Map();
    for (const item of allItems) {
        const parent = item.delivery?.[0];
        if (!parent) continue;
        if (!itemsByDelivery.has(parent)) itemsByDelivery.set(parent, []);
        itemsByDelivery.get(parent).push(item);
    }

    const rows = deliveries
        .map((d) => {
            // Airtable does not promise an order for a batched read, so sort the
            // slices by their own child ID — which is creation order, which is the
            // order the recorder entered the items. summarizeDelivery presents
            // them by first appearance, so this is what makes "first item" mean
            // the first one they typed.
            const items = (itemsByDelivery.get(d.id) || []).sort((a, b) =>
                (a.deliveryItemId || "").localeCompare(b.deliveryItemId || "")
            );
            return {
                deliveryId: d.deliveryId,
                receivedDate: d.receivedDate || "",
                createdAt: d.createdAt || "",
                jobId: d.job?.[0] ?? null,
                jobCode: jobById.get(d.job?.[0])?.jobCode ?? "—",
                vendorId: d.vendor?.[0] ?? null,
                vendorName: vendorNameById.get(d.vendor?.[0]) ?? "Unknown vendor",
                // #324 — `Recorded By` is the axis this document has, which is why this
                // list carries a reader's-own toggle and `/invoices` does not (#382).
                // Resolved here so nobody's identity reaches the client, the same
                // arrangement `/prs` and `/pos` use for their requester.
                isMine: d.recordedBy?.[0] === user.id,
                hasOverDelivery: items.some((i) => i.overDelivered),
                invoicingChip: invoicingByDelivery.has(d.id)
                    ? describeDeliveryColumn(invoicingByDelivery.get(d.id))
                    : null,
                summary: summarizeDelivery(
                    items.map((i) => ({
                        materialRecordId: i.material?.[0] ?? null,
                        itemName: i.itemName,
                        size: i.size,
                        unit: i.unit,
                        qty: i.qty,
                        over: i.overDelivered,
                    }))
                ),
            };
        })
        .sort((a, b) => {
            if (a.receivedDate !== b.receivedDate) return b.receivedDate.localeCompare(a.receivedDate);
            return b.createdAt.localeCompare(a.createdAt);
        });

    // #324 — the pickers' options come from the rows this reader can already see, and
    // the URL is intersected with them, so a forged `?job=` in a pasted link is
    // dropped before it reaches the client.
    const options = {
        job: pickerOptions(rows, "jobId", (r) =>
            jobOptionLabel(jobById.get(r.jobId)?.jobCode, jobById.get(r.jobId)?.jobName)
        ),
        vendor: pickerOptions(rows, "vendorId", (r) => r.vendorName),
    };
    const initialFilters = parseFilters("/deliveries", sp ?? {}, options);

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Deliveries</h1>
                    <p className="mt-1 text-sm text-zinc-600">
                        Material delivered to site, newest first.
                    </p>
                </div>
                <Link href="/deliveries/new" className="text-sm underline">
                    Record a delivery
                </Link>
            </div>

            {/* #324 — ALL THREE EMPTY STATES ARE THE CLIENT'S NOW, because which one
                applies depends on whether a filter is active and that is state this
                page does not hold. The two sentences that were here said a fourth
                thing between them: "you are on no job" and "nothing recorded yet" are
                one state — nothing in your scope — and the second was false for a
                reader whose jobs simply hold no delivery. The access line survives as
                that state's own sentence, and the packing-list line moved to the state
                it is true of. */}
            <DeliveriesListClient
                rows={rows}
                options={options}
                initialFilters={initialFilters}
                totalCount={deliveriesOnBase}
            />

            <Link href="/" className="mt-8 inline-block text-sm underline">
                Home
            </Link>
        </div>
    );
}
