import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getItemsByDelivery } from "@/lib/airtable/deliveryItems";
import { getPOItemsByRecordIds } from "@/lib/airtable/poItems";
import { getPOsByRecordIds } from "@/lib/airtable/purchaseOrders";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import { describeDelivery } from "@/lib/deliveryAllocation";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { canDeleteDelivery, resolveDeleteCopy } from "@/lib/deliveryDelete";
import DeliveryEditForm from "./DeliveryEditForm";
import DeleteDeliveryButton from "./DeleteDeliveryButton";

const DONE_MESSAGES = {
    recorded: "Delivery recorded.",
    updated: "Saved.",
    "photo-replaced": "Photo replaced.",
};

/**
 * One recorded arrival (#162).
 *
 * NO PER-ROW IDENTIFIER GATE, unlike #19's price screens, and the reason is that
 * the page gate already subsumes it. Allocation only ever picks lines from POs on
 * THIS delivery's Job, and canViewPR clause 4 admits anyone assigned to a PR's
 * Job — so a viewer who passes canAccessJobDeliveries here would pass canViewPR
 * for every PR behind every row. Adding a second gate would be a re-derivation of
 * the same answer, and one that could drift from it.
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
                    All deliveries
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
            itemName: item.itemName,
            size: item.size,
            unit: item.unit,
            qty: item.qty,
            over: item.overDelivery,
            poId: po?.poId ?? null,
            poRecordId: po?.id ?? null,
            poItemId: poItem?.poItemId ?? null,
        };
    });

    const banners = describeDelivery(rows);
    const mayDelete = canDeleteDelivery(user, delivery);
    const deleteCopy = mayDelete ? await resolveDeleteCopy(delivery, items) : null;
    const photo = delivery.packingListFile?.[0] ?? null;

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <h1 className="text-2xl font-semibold">{delivery.deliveryId}</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {job ? `${job.jobCode} — ${job.jobName}` : "Unknown job"} ·{" "}
                {vendor?.vendorName ?? "Unknown vendor"}
            </p>

            {sp?.done && DONE_MESSAGES[sp.done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
                    {DONE_MESSAGES[sp.done]}
                </p>
            )}

            {banners.map((b) => (
                <p
                    key={b.key}
                    className="mt-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                >
                    {b.text}
                </p>
            ))}

            <dl className="mt-6 grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
                <dt className="text-zinc-500">Received</dt>
                <dd>{delivery.receivedDate || "—"}</dd>
                <dt className="text-zinc-500">Recorded by</dt>
                <dd>{recorder?.userName ?? "—"}</dd>
                <dt className="text-zinc-500">Recorded at</dt>
                <dd>{delivery.createdAt ? new Date(delivery.createdAt).toLocaleString() : "—"}</dd>
                <dt className="text-zinc-500">PO on packing list</dt>
                <dd>
                    {namedPo?.[0] ? (
                        <Link href={`/pos/${encodeURIComponent(namedPo[0].poId)}`} className="underline">
                            {namedPo[0].poId}
                        </Link>
                    ) : (
                        <span className="text-zinc-500">none</span>
                    )}
                </dd>
            </dl>

            <h2 className="mt-8 text-lg font-medium">Recorded against</h2>
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
                                        <span className="text-zinc-500">not against any order</span>
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
                quantity, the vendor and the PO cannot be edited; correcting one means deleting this
                delivery and entering it again.
            </p>

            <h2 className="mt-8 text-lg font-medium">Packing list</h2>
            {photo ? (
                <a href={photo.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">
                    {photo.filename || "Open the packing list"}
                </a>
            ) : (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
                    No photo is attached. If it was just uploaded, reload in a moment; if it stays
                    empty, replace it below.
                </p>
            )}

            <DeliveryEditForm
                deliveryId={delivery.deliveryId}
                receivedDate={delivery.receivedDate || ""}
                notes={delivery.notes || ""}
            />

            {mayDelete && (
                <div className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
                    <DeleteDeliveryButton
                        deliveryId={delivery.deliveryId}
                        title={deleteCopy.title}
                        body={deleteCopy.body}
                    />
                </div>
            )}

            <Link href="/deliveries" className="mt-8 inline-block text-sm underline">
                All deliveries
            </Link>
        </div>
    );
}
