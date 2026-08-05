import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "@/lib/airtable/deliveryItems";
import { getAllVendors } from "@/lib/airtable/vendors";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import { summarizeDelivery } from "@/lib/deliveryAllocation";
import { getDeliveryInvoicing } from "@/lib/deliveryReconciliation";
import { describeDeliveryColumn, resolveDeliveryFilters } from "@/lib/deliveryStatus";
import DeliveriesListClient from "./DeliveriesListClient";

/**
 * Recorded deliveries, newest arrival first (#162).
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
 * accumulate one per arrival, faster than PRs do, so the PR list's fetch-all shape
 * was the wrong precedent to copy here. It also needs no `Job Record ID` lookup,
 * since a link field cannot be filtered on but a reverse-link can be read.
 *
 * ORDERED BY `Received Date` DESC, tie-broken by `Created At` DESC. Received Date
 * is what a reader is looking for ("what came in this week"), and it is
 * calendar-only, so several arrivals on one day tie — the tie-break is the moment
 * of entry, which is the second reader that keeps Created At from being a
 * single-purpose field.
 */
export default async function DeliveriesListPage({ searchParams }) {
    const user = await requireUser();
    const sp = await searchParams;

    const jobs = jobsFor(user, await getAllJobs());
    const jobById = new Map(jobs.map((j) => [j.id, j]));

    // getAllJobs already carries each Job's `Deliveries` reverse-link, so the ids
    // come out of the records the access filter has in hand — no query per Job.
    const deliveryIds = jobs.flatMap((j) => j.deliveries || []);

    const [deliveries, vendors] = await Promise.all([
        getDeliveriesByRecordIds(deliveryIds),
        getAllVendors(),
    ]);
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.vendorName]));

    // Every listed delivery's lines in ONE batched read, keyed on the ids the
    // delivery records already carry — the list summarizes what arrived, and a
    // read per delivery would be the per-row round trip #143 ruled out.
    const allItems = await getDeliveryItemsByRecordIds(
        deliveries.flatMap((d) => d.deliveryItems || [])
    );
    // Issue #166 — THE INVOICING LEVEL IS NOT FETCHED FOR A NON-PRIVILEGED
    // VIEWER, which is the withholding rather than a hidden column. This list is
    // Job-scoped, so site staff reach it; whether a vendor has billed for an
    // arrival is office information. A page that fetched it and then declined to
    // render the column would still ship it in the payload — /pos/[poId] filters
    // invoice-derived fields out on the SERVER for exactly this reason (#132), and
    // this follows it. The pleasant side effect is that the two extra levels are
    // only paid for by the audience that may see them.
    const showInvoicing = user.role === "President" || user.isAdmin === true;
    const invoicingByDelivery = showInvoicing
        ? await getDeliveryInvoicing(deliveries)
        : new Map();

    // WHICH FILTERS EXIST FOR THIS VIEWER, decided by the same rule the client
    // re-applies to its own state — so `?unbilled=1` is treated as ABSENT rather
    // than ignored for a viewer whose rows carry no invoicing key at all. A
    // filter over a column that was never fetched would silently empty the list.
    const filters = resolveDeliveryFilters({
        unbilled: sp?.unbilled === "1",
        over: sp?.over === "1",
        showInvoicing,
    });

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
                jobCode: jobById.get(d.job?.[0])?.jobCode ?? "—",
                vendorName: vendorNameById.get(d.vendor?.[0]) ?? "Unknown vendor",
                // Only ever populated when showInvoicing — see above. The
                // filter has nothing to act on otherwise, which is the rule
                // rather than a coincidence.
                hasOverDelivery: items.some((i) => i.overDelivered),
                invoicingKey: invoicingByDelivery.get(d.id)?.key ?? null,
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

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <div className="flex items-baseline justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold">Deliveries</h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Material delivered to site, newest first.
                    </p>
                </div>
                <Link href="/deliveries/new" className="text-sm underline">
                    Record a delivery
                </Link>
            </div>

            {sp?.done === "deleted" && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                    Delivery deleted.
                </p>
            )}

            {jobs.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    You are not assigned to any job yet, so there are no deliveries to show. An Admin
                    can add you to a job in Airtable.
                </p>
            ) : rows.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    No deliveries recorded yet. Record one as material arrives — the packing list
                    photo is what makes it a record.
                </p>
            ) : (
                <DeliveriesListClient
                    rows={rows}
                    showInvoicing={showInvoicing}
                    initialUnbilled={filters.unbilled}
                    initialOver={filters.over}
                />
            )}

            <Link href="/" className="mt-8 inline-block text-sm underline">
                Home
            </Link>
        </div>
    );
}
