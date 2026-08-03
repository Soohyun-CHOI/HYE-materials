import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getItemsByDelivery } from "@/lib/airtable/deliveryItems";
import { getPOItemsByRecordIds } from "@/lib/airtable/poItems";
import { getPOsByRecordIds } from "@/lib/airtable/purchaseOrders";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { describeDelivery, groupRowsByItem, summarizeDelivery } from "@/lib/deliveryAllocation";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { canDeleteDelivery, resolveDeleteCopy } from "@/lib/deliveryDelete";
import DeleteDeliveryButton from "./DeleteDeliveryButton";

const DONE_MESSAGES = {
    recorded: "Delivery recorded.",
    updated: "Delivery updated.",
    "photo-replaced": "Packing list photo replaced.",
};

/**
 * One recorded arrival (#162).
 *
 * Laid out like app/invoices/[invoiceId] — id and actions in the header, the
 * headline figure in its own box, then the detail rows, the lines, and the
 * destructive control alone at the foot behind a rule. Editing is its own page
 * rather than a form on this one, so this page reads as the record and the edit
 * page is where you go to change it.
 *
 * NO PER-ROW IDENTIFIER GATE, unlike #19's price screens, and the reason is that
 * the page gate already subsumes it. Allocation only ever picks lines from POs on
 * THIS delivery's Job, and canViewPR clause 4 admits anyone assigned to a PR's
 * Job — so a viewer who passes canAccessJobDeliveries here would pass canViewPR
 * for every PR behind every row. A second gate would re-derive the same answer
 * and could drift from it.
 */
export default async function DeliveryDetailPage({ params, searchParams }) {
    const user = await requireUser();
    const { deliveryId } = await params;
    const sp = await searchParams;

    const delivery = await getDeliveryById(decodeURIComponent(deliveryId));

    // A delivery outside the viewer's Jobs is indistinguishable from one that
    // does not exist. Both render the ordinary not-found text.
    if (!delivery || !canAccessJobDeliveries(user, delivery.job?.[0])) {
        return (
            <div className="mx-auto w-full max-w-3xl p-8">
                <h1 className="text-2xl font-semibold">Delivery not found</h1>
                <Link href="/deliveries" className="mt-6 inline-block text-sm underline">
                    ← All deliveries
                </Link>
            </div>
        );
    }

    const items = await getItemsByDelivery(delivery.id);

    // Resolve each line's PO through its PO Item, one level at a time.
    const poItems = await getPOItemsByRecordIds(items.map((i) => i.poItem?.[0]).filter(Boolean));
    const poItemById = new Map(poItems.map((pi) => [pi.id, pi]));
    const pos = await getPOsByRecordIds(poItems.flatMap((pi) => pi.po));
    const poById = new Map(pos.map((po) => [po.id, po]));

    const [job, vendor, recorder, namedPo] = await Promise.all([
        delivery.job?.[0] ? getJobByRecordId(delivery.job[0]) : null,
        delivery.vendor?.[0] ? getVendorByRecordId(delivery.vendor[0]) : null,
        delivery.recordedBy?.[0] ? getUserByRecordId(delivery.recordedBy[0]) : null,
        delivery.po?.[0] ? getPOsByRecordIds(delivery.po) : null,
    ]);

    const rows = items.map((item) => {
        const poItem = item.poItem?.[0] ? poItemById.get(item.poItem[0]) : null;
        const po = poItem?.po?.[0] ? poById.get(poItem.po[0]) : null;
        return {
            id: item.id,
            deliveryItemId: item.deliveryItemId,
            materialRecordId: item.material?.[0] ?? null,
            itemName: item.itemName,
            size: item.size,
            unit: item.unit,
            qty: item.qty,
            over: item.overDelivery,
            poId: po?.poId ?? null,
            poItemId: poItem?.poItemId ?? null,
        };
    });

    const banners = describeDelivery(rows);
    const mayDelete = canDeleteDelivery(user, delivery);
    const deleteCopy = mayDelete ? await resolveDeleteCopy(delivery, items) : null;
    const photo = delivery.packingListFile?.[0] ?? null;

    // The headline is what arrived, in the same shape the list uses — one summary
    // rule, so the row a reader clicked and the page they land on cannot describe
    // the same delivery differently. There is no single figure to show instead:
    // a delivery can hold several items with different units, so the invoice's
    // Amount Due has no counterpart here.
    const summary = summarizeDelivery(rows);
    const grouped = groupRowsByItem(rows);

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{delivery.deliveryId}</h1>
                <div className="flex items-center gap-4">
                    {/* Editing is open to the same set that may view — Job
                        membership — because what it changes (the received date,
                        the note, the photo) is a correction to the record rather
                        than to what the arrival was allocated against. */}
                    <Link
                        href={`/deliveries/${encodeURIComponent(delivery.deliveryId)}/edit`}
                        className="text-sm underline"
                    >
                        Edit
                    </Link>
                    <Link href="/deliveries" className="text-sm underline">
                        ← All deliveries
                    </Link>
                </div>
            </div>

            {sp?.done && DONE_MESSAGES[sp.done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                    {DONE_MESSAGES[sp.done]}
                </p>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Received{summary ? ` — ${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}` : ""}
                </p>
                <ul className="mt-1 space-y-0.5">
                    {grouped.map((item) => (
                        <li key={item.key} className="flex items-baseline gap-2 text-lg font-semibold">
                            <span className="tabular-nums">{item.qty}</span>
                            <span>{item.unit}</span>
                            <span className="text-base font-normal text-zinc-600 dark:text-zinc-400">
                                {[item.itemName, item.size].filter(Boolean).join(" ")}
                            </span>
                            {item.over && (
                                <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                    over-delivery
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Keyed by index: with several items the same branch can fire more
                than once, so `key` is the semantic branch, not a unique id. */}
            {banners.map((b, i) => (
                <p
                    key={`${b.key}-${i}`}
                    className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                >
                    {b.text}
                </p>
            ))}

            <div className="mt-4 space-y-1 text-sm">
                <p>
                    <span className="text-zinc-500">Job:</span>{" "}
                    {job ? `${job.jobCode} — ${job.jobName}` : "—"}
                </p>
                <p>
                    <span className="text-zinc-500">Vendor:</span> {vendor?.vendorName ?? "—"}
                </p>
                <p>
                    <span className="text-zinc-500">Received Date:</span>{" "}
                    {delivery.receivedDate || "—"}
                </p>
                <p>
                    <span className="text-zinc-500">PO on packing list:</span>{" "}
                    {namedPo?.[0] ? (
                        <Link
                            href={`/pos/${encodeURIComponent(namedPo[0].poId)}`}
                            className="underline"
                        >
                            {namedPo[0].poId}
                        </Link>
                    ) : (
                        "none"
                    )}
                </p>
                <p>
                    <span className="text-zinc-500">Recorded by:</span> {recorder?.userName ?? "—"}{" "}
                    {delivery.createdAt && (
                        <span className="text-zinc-500">
                            on {new Date(delivery.createdAt).toLocaleString()}
                        </span>
                    )}
                </p>
                <p>
                    <span className="text-zinc-500">Packing list:</span>{" "}
                    {photo ? (
                        <a href={photo.url} target="_blank" rel="noreferrer" className="underline">
                            {photo.filename || "Open"}
                        </a>
                    ) : (
                        <span className="text-amber-700 dark:text-amber-500">
                            not attached — if it was just uploaded, reload in a moment
                        </span>
                    )}
                </p>
                {delivery.notes && (
                    <p>
                        <span className="text-zinc-500">Notes:</span> {delivery.notes}
                    </p>
                )}
            </div>

            <div className="mt-8">
                <h2 className="text-lg font-semibold">Recorded against</h2>
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[32rem] table-fixed text-sm">
                        <colgroup>
                            <col style={{ width: "13rem" }} />
                            <col style={{ width: "11rem" }} />
                            <col style={{ width: "8rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                                <th className="py-2 font-medium">Item</th>
                                <th className="py-2 font-medium">Order</th>
                                <th className="py-2 text-right font-medium">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                                >
                                    <td className="py-2">
                                        {[row.itemName, row.size].filter(Boolean).join(" ")}
                                    </td>
                                    <td className="py-2">
                                        {row.poId ? (
                                            <Link
                                                href={`/pos/${encodeURIComponent(row.poId)}`}
                                                className="underline"
                                            >
                                                {row.poId}
                                            </Link>
                                        ) : (
                                            <span className="text-zinc-500">
                                                not against any order
                                            </span>
                                        )}
                                        {row.over && (
                                            <span className="ml-2 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                over-delivery
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 text-right tabular-nums">
                                        {row.qty}
                                        {row.unit ? ` ${row.unit}` : ""}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
                    The app allocated these lines — oldest outstanding order first. The item, the
                    quantity, the vendor and the PO cannot be edited; correcting one means deleting
                    this delivery and entering it again.
                </p>
            </div>

            {mayDelete && (
                <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <DeleteDeliveryButton
                        deliveryId={delivery.deliveryId}
                        title={deleteCopy.title}
                        body={deleteCopy.body}
                    />
                </div>
            )}
        </div>
    );
}
