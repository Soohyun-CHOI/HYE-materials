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
import { seesEveryInvoice } from "@/lib/invoiceVisibility";
import { OVERAGE_COPY, describeOveragePreview } from "@/lib/overage";
import { getOverageContext } from "@/lib/overagePR";
import { getInvoicesByRecordIds } from "@/lib/airtable/invoices";
import DeleteDeliveryButton from "./DeleteDeliveryButton";
import OverageButton from "./OverageButton";

// The route param IS the human-readable ID, so the tab names the record for
// ZERO Airtable operations (#201) — this reads the URL and nothing else.
export async function generateMetadata({ params }) {
    const { deliveryId } = await params;
    return { title: deliveryId };
}

const DONE_MESSAGES = {
    recorded: "Delivery recorded.",
    updated: "Delivery updated.",
    "photo-replaced": "Packing list photo replaced.",
    "invoice-attached": "Invoice attached.",
    "invoice-detached": "Invoice detached.",
};

/**
 * One recorded arrival (#162).
 *
 * Laid out like app/invoices/[invoiceId] — id and actions in the header, the
 * headline figure in its own box, then the detail rows, the delivery items, and the
 * destructive control alone at the foot behind a rule. Editing is its own page
 * rather than a form on this one, so this page reads as the record and the edit
 * page is where you go to change it.
 *
 * NO PER-ROW IDENTIFIER GATE, unlike #19's price screens, and the reason is that
 * the page gate already subsumes it. Allocation only ever picks ordered items
 * from POs on THIS delivery's Job, and canViewPR clause 4 admits anyone assigned
 * to a PR's Job — so a viewer who passes canAccessJobDeliveries here would pass
 * canViewPR for every PR behind every row. A second gate would re-derive the same
 * answer and could drift from it.
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

    // Resolve each delivery item's PO through its PO Item, one level at a time.
    const poItems = await getPOItemsByRecordIds(items.map((i) => i.poItem?.[0]).filter(Boolean));
    const poItemById = new Map(poItems.map((pi) => [pi.id, pi]));
    const pos = await getPOsByRecordIds(poItems.flatMap((pi) => pi.po));
    const poById = new Map(pos.map((po) => [po.id, po]));

    const [job, vendor, recorder, packingListPO, invoices] = await Promise.all([
        delivery.job?.[0] ? getJobByRecordId(delivery.job[0]) : null,
        delivery.vendor?.[0] ? getVendorByRecordId(delivery.vendor[0]) : null,
        delivery.recordedBy?.[0] ? getUserByRecordId(delivery.recordedBy[0]) : null,
        delivery.packingListPO?.[0] ? getPOsByRecordIds(delivery.packingListPO) : null,
        // #210 — the bills naming this shipment. One batched read, and none at all
        // for a delivery nobody has paired yet. NOT GATED PER INVOICE, and that is
        // #167's exception on this page rather than a new one: the recorder is the
        // person who pairs them, from a dropdown that showed them these very
        // numbers, so printing them back discloses nothing they have not seen. A
        // number whose invoice is outside their scope still leads to the ordinary
        // not-found text, which is what the link is allowed to do.
        getInvoicesByRecordIds(delivery.invoices || []),
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
            over: item.overDelivered,
            poId: po?.poId ?? null,
            poItemId: poItem?.poItemId ?? null,
        };
    });

    const banners = describeDelivery(rows);

    // Issue #167 — the correction affordance, one entry per over-delivered row.
    // Costs no query on an ordinary delivery: getOverageContext returns immediately
    // when no row is flagged and none carries a correction already. Job-scoped
    // rather than office-gated, per the issue — raising the request is site work,
    // which narrows what #166 withheld on the deliveries LIST. See
    // createOverageDraftAction on what that reveals and what it does not.
    const overageByRow = await getOverageContext(items, { deliveryId: delivery.deliveryId });
    const overages = items
        .filter((item) => overageByRow.has(item.id))
        .map((item) => {
            const context = overageByRow.get(item.id);
            return {
                id: item.id,
                label: [item.itemName, item.size].filter(Boolean).join(" "),
                eligible: context.eligibility.eligible,
                inferred: Boolean(context.eligibility.inferred),
                messages: describeOveragePreview(context.eligibility, {
                    ...context.facts,
                    signersDropped: 0,
                }).map((m) => m.text),
            };
        });

    const mayDelete = canDeleteDelivery(user, delivery);
    // #211 — the third voice of the confirmation names the vendor as already paid,
    // and payment is President-or-Admin. Deletion is author-or-Admin on a
    // Job-scoped record, so without this flag a site recorder was reading the one
    // invoice fact this app keeps from them, inside a modal.
    const deleteCopy = mayDelete
        ? await resolveDeleteCopy(delivery, items, { seesPayment: seesEveryInvoice(user) })
        : null;
    const photo = delivery.packingListFile?.[0] ?? null;

    // The headline is what was delivered, in the same shape the list uses — one summary
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
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[sp.done]}
                </p>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Received{summary ? ` — ${summary.itemCount} item${summary.itemCount === 1 ? "" : "s"}` : ""}
                </p>
                <ul className="mt-1 space-y-0.5">
                    {grouped.map((item) => (
                        <li key={item.key} className="flex items-baseline gap-2 text-lg font-semibold">
                            <span className="tabular-nums">{item.qty}</span>
                            <span>{item.unit}</span>
                            <span className="text-base font-normal text-zinc-600">
                                {[item.itemName, item.size].filter(Boolean).join(" ")}
                            </span>
                            {item.over && (
                                <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                                    Over-delivered
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
                    className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                    {b.text}
                </p>
            ))}

            {/* Issue #167 — the correction, right under the banner that reports the
                over-delivery, because that is where a reader has just been told
                there is one. An INELIGIBLE row still says why rather than showing
                nothing: "there is no invoice yet" and "the excess spans two
                invoices" are both answers, and a missing button is not. */}
            {overages.map((overage) => (
                <div
                    key={overage.id}
                    className="mt-2 rounded border border-zinc-200 px-3 py-2 text-sm"
                >
                    <p className="font-medium">Correction — {overage.label}</p>
                    {overage.messages.map((text, i) => (
                        <p key={i} className="mt-1 text-zinc-600">
                            {text}
                        </p>
                    ))}
                    {overage.eligible && (
                        <div className="mt-2">
                            <OverageButton
                                deliveryItemId={overage.id}
                                messages={overage.messages}
                                inferred={overage.inferred}
                                inferredLabel={OVERAGE_COPY.preview.inferred().text}
                            />
                        </div>
                    )}
                </div>
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
                    {packingListPO?.[0] ? (
                        <Link
                            href={`/pos/${encodeURIComponent(packingListPO[0].poId)}`}
                            className="underline"
                        >
                            {packingListPO[0].poId}
                        </Link>
                    ) : (
                        "none"
                    )}
                </p>
                {/* #210 — the bill or bills this shipment is paired with, beside the
                    PO the packing list named, because both are facts copied off the
                    same document. Plural: one invoice names one delivery, so a
                    shipment accumulates them as the office enters each one. Empty is
                    a reading rather than a gap, and the sentence says which. */}
                <p>
                    <span className="text-zinc-500">Invoices:</span>{" "}
                    {invoices.length === 0 ? (
                        <span className="text-zinc-500">
                            none attached — attach one from Edit once the office has entered it
                        </span>
                    ) : (
                        invoices.map((inv, i) => (
                            <span key={inv.id}>
                                {i > 0 && ", "}
                                <Link
                                    href={`/invoices/${encodeURIComponent(inv.invoiceId)}`}
                                    className="underline"
                                >
                                    {inv.invoiceId}
                                </Link>
                                {inv.vendorInvoiceCode ? ` (${inv.vendorInvoiceCode})` : ""}
                            </span>
                        ))
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
                        <span className="text-amber-700">
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
                            <tr className="border-b border-zinc-200 text-left">
                                <th className="py-2 font-medium">Item</th>
                                <th className="py-2 font-medium">Order</th>
                                <th className="py-2 text-right font-medium">Qty</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-zinc-100 last:border-0"
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
                                            <span className="ml-2 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                                                Over-delivered
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
                <p className="mt-2 text-xs text-zinc-500">
                    The app allocated these lines — oldest order first, skipping ones already
                    fully delivered. The item, the quantity, the vendor and the PO cannot be
                    edited; correcting one means deleting this delivery and entering it again.
                </p>
            </div>

            {mayDelete && (
                <div className="mt-8 border-t border-zinc-200 pt-6">
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
