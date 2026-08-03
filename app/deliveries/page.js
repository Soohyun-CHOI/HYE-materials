import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getAllJobs } from "@/lib/airtable/jobs";
import { getDeliveriesByRecordIds } from "@/lib/airtable/deliveries";
import { getAllVendors } from "@/lib/airtable/vendors";
import { accessibleJobs as jobsFor } from "@/lib/deliveryAccess";

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

    const rows = deliveries
        .map((d) => ({
            deliveryId: d.deliveryId,
            receivedDate: d.receivedDate || "",
            createdAt: d.createdAt || "",
            jobCode: jobById.get(d.job?.[0])?.jobCode ?? "—",
            vendorName: vendorNameById.get(d.vendor?.[0]) ?? "Unknown vendor",
            lineCount: d.deliveryItems.length,
        }))
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
                    <table className="w-full min-w-[40rem] table-fixed text-sm">
                        <colgroup>
                            <col style={{ width: "12rem" }} />
                            <col style={{ width: "7rem" }} />
                            <col style={{ width: "8rem" }} />
                            <col style={{ width: "13rem" }} />
                            <col style={{ width: "5rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                                <th className="py-2 font-medium">Delivery</th>
                                <th className="py-2 font-medium">Received</th>
                                <th className="py-2 font-medium">Job</th>
                                <th className="py-2 font-medium">Vendor</th>
                                <th className="py-2 text-right font-medium">Lines</th>
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
                                    <td className="py-2">{row.receivedDate || "—"}</td>
                                    <td className="py-2">{row.jobCode}</td>
                                    <td className="py-2">{row.vendorName}</td>
                                    <td className="py-2 text-right tabular-nums">{row.lineCount}</td>
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
