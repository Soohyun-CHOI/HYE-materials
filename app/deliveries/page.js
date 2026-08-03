import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "@/lib/airtable/deliveryItems";
import { getAllVendors } from "@/lib/airtable/vendors";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";
import { summarizeDelivery } from "@/lib/deliveryAllocation";

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
                summary: summarizeDelivery(
                    items.map((i) => ({
                        materialRecordId: i.material?.[0] ?? null,
                        itemName: i.itemName,
                        size: i.size,
                        unit: i.unit,
                        qty: i.qty,
                        over: i.overDelivery,
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
                        Material recorded as arrived, newest first.
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
                <div className="mt-6 overflow-x-auto">
                    {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE
                        PAGE HAS: `max-w-4xl` is 56rem and `p-8` takes 4rem, leaving
                        832px. #19's tables are 52rem for that same reason. The
                        first version declared 55rem, which overflowed by 3rem and
                        put a scrollbar on every desktop render.

                        Column order is Delivery / Vendor / Received / What arrived
                        / Job. The four narrow columns are sized from their widest
                        realistic content and the flexible one takes the remainder,
                        so a long summary wraps inside its own cell rather than
                        widening the table. `min-w` still guards the small-viewport
                        case: below 832px the wrapper scrolls instead of letting
                        `w-full` shrink the table and wrap every row. */}
                    <table className="w-full min-w-[52rem] table-fixed text-sm">
                        <colgroup>
                            <col style={{ width: "9rem" }} />
                            <col style={{ width: "11rem" }} />
                            <col style={{ width: "6.5rem" }} />
                            <col style={{ width: "19rem" }} />
                            <col style={{ width: "6.5rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                                <th className="py-2 font-medium">Delivery</th>
                                <th className="py-2 font-medium">Vendor</th>
                                <th className="py-2 font-medium">Received</th>
                                <th className="py-2 font-medium">What arrived</th>
                                <th className="py-2 font-medium">Job</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.deliveryId}
                                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                                >
                                    <td className="py-2">
                                        <Link
                                            href={`/deliveries/${encodeURIComponent(row.deliveryId)}`}
                                            className="underline"
                                        >
                                            {row.deliveryId}
                                        </Link>
                                    </td>
                                    <td className="py-2">{row.vendorName}</td>
                                    <td className="py-2">{row.receivedDate || "—"}</td>
                                    <td className="py-2">
                                        {row.summary ? (
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <span>
                                                    {row.summary.first.label}{" "}
                                                    <span className="tabular-nums">
                                                        {row.summary.first.qty}
                                                    </span>
                                                    {row.summary.first.unit
                                                        ? ` ${row.summary.first.unit}`
                                                        : ""}
                                                </span>
                                                {/* A COUNT, not part of the item name — so it
                                                    carries its own chip. Reading "+2" as text
                                                    after the label makes it look like a size or
                                                    a grade on the item itself. */}
                                                {row.summary.extraCount > 0 && (
                                                    <span
                                                        title={`${row.summary.itemCount} items on this delivery`}
                                                        className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                                    >
                                                        +{row.summary.extraCount}
                                                    </span>
                                                )}
                                                {row.summary.hasOverDelivery && (
                                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        over-delivery
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500">—</span>
                                        )}
                                    </td>
                                    <td className="py-2">{row.jobCode}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Link href="/" className="mt-8 inline-block text-sm underline">
                Home
            </Link>
        </div>
    );
}
