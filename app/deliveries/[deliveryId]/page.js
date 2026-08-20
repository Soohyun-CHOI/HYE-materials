import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getDeliveryById } from "@/lib/airtable/deliveries";
import { getItemsByDelivery } from "@/lib/airtable/deliveryItems";
import { getPOItemsByRecordIds } from "@/lib/airtable/poItems";
import { getPOsByRecordIds } from "@/lib/airtable/purchaseOrders";
import { getJobByRecordId } from "@/lib/airtable/jobs";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getUserByRecordId } from "@/lib/airtable/users";
import {
    ALLOCATION_COPY,
    describeDelivery,
    groupRowsByItem,
    groupRowsByItemAndOrder,
    summarizeDelivery,
} from "@/lib/deliveryAllocation";
import { canAccessJobDeliveries } from "@/lib/deliveryAccess";
import { canDeleteDelivery, resolveDeleteCopy } from "@/lib/deliveryDelete";
import { seesEveryInvoice } from "@/lib/invoiceVisibility";
import { describeOveragePreview, tieBreakLabel } from "@/lib/overage";
import { getOverageContext } from "@/lib/overagePR";
import { getInvoicesByRecordIds } from "@/lib/airtable/invoices";
import DeleteDeliveryButton from "./DeleteDeliveryButton";
import OverageButton from "./OverageButton";
import { withOpsLabel } from "@/lib/airtableOps";

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
 * One recorded delivery (#162).
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
// Labeled for #190 by #224, the sweep across every entry point that opened no
// scope. An outer wrapper, so the page's own logic keeps its indentation, and
// the route TEMPLATE, so repeated loads aggregate into one row.
export default async function DeliveryDetailPage(props) {
    return withOpsLabel("/deliveries/[deliveryId]", () => renderDeliveryDetailPage(props));
}

async function renderDeliveryDetailPage({ params, searchParams }) {
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

    // Issue #193 — the delivery's rows come from the ids `delivery` already carries,
    // so this neither re-finds the delivery nor fetches its rows one at a time.
    // Every level below it was already batched (#166, #210); this was the one level
    // still paying per row, which is why it read three finds on a three-row delivery.
    const items = await getItemsByDelivery(delivery.id, { rowIds: delivery.deliveryItems });

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
        // #210 — the invoices naming this delivery. One batched read, and none at all
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
            // #238 — the order half of the table's fold key. The printed `poId` is
            // what the cell shows and the record id is what the key is made of, so
            // two orders cannot merge on a label they happen to share.
            poRecordId: po?.id ?? null,
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
    const overageByRow = await getOverageContext(items, {
        // #217 — a map, because getOverageContext now takes rows spanning deliveries
        // so the strip above /prs can walk them all at once. One entry here.
        deliveryIds: new Map([[delivery.id, delivery.deliveryId]]),
    });
    const overages = items
        .filter((item) => overageByRow.has(item.id))
        .map((item) => {
            const context = overageByRow.get(item.id);
            return {
                id: item.id,
                label: [item.itemName, item.size].filter(Boolean).join(" "),
                eligible: context.eligibility.eligible,
                // #265 — the marker is the TIE-BREAK now, not an inference: #219's
                // tiers are gone and a correction is offered only where the excess is
                // billed, so what the `!` reports is that several invoices could have
                // supplied the quotation at the same price. #217 put the lookup in
                // lib/overage.js because the strip renders the same marker.
                tieBreakLabel: tieBreakLabel(context.eligibility),
                // `signersDropped: 0` WAS FORCED HERE AND IS NOT ANY MORE (#217). It
                // made the one message that reports a dropped signer unreachable on
                // the only screen that shows the preview, while getOverageContext paid
                // to compute the count — measured at 14 of the 19 operations that walk
                // cost, for a fact no render could reach. Nothing else about the box
                // changes: the count is 0 on every row of this base today.
                messages: describeOveragePreview(context.eligibility, context.facts),
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

    // Issue #238 — the table below reads one row per material AND order, so an
    // delivery split into a within piece and an excess against one order is one row
    // rather than two differing only by a tag. A pure regrouping of the rows above:
    // no query, and nothing here reaches the flag, the banners or `summarizeDelivery`
    // — those judge, and this only reads. The rule is lib/deliveryAllocation.js.
    const tableRows = groupRowsByItemAndOrder(rows);

    return (
        <div className="mx-auto w-full max-w-3xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{delivery.deliveryId}</h1>
                <div className="flex items-center gap-4">
                    {/* Editing is open to the same set that may view — Job
                        membership — because what it changes (the received date,
                        the note, the photo) is a correction to the record rather
                        than to what the delivery was allocated against. */}
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
                    {/* #217 — a message that names a request arrives in parts so the
                        id can be a link: copy stays a pure module with no JSX in it,
                        and this is the one site that can render one. Everything else
                        is the flattened sentence, which is also what the Server
                        Action returns as its refusal. */}
                    {overage.messages.map((message, i) => (
                        <p key={i} className="mt-1 text-zinc-600">
                            {message.prId ? (
                                <>
                                    {message.prefix}
                                    <Link
                                        href={`/prs/${encodeURIComponent(message.prId)}`}
                                        className="underline"
                                    >
                                        {message.prId}
                                    </Link>
                                    {message.suffix}
                                </>
                            ) : (
                                message.text
                            )}
                        </p>
                    ))}
                    {overage.eligible && (
                        <div className="mt-2">
                            <OverageButton
                                deliveryItemId={overage.id}
                                messages={overage.messages.map((m) => m.text)}
                                tieBreakLabel={overage.tieBreakLabel}
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
                {/* #210 — the invoice or invoices this delivery is paired with, beside the
                    PO the packing list named, because both are facts copied off the
                    same document. Plural: one invoice names one delivery, so a
                    delivery accumulates them as the office enters each one. Empty is
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
                            {/* ONE ROW PER MATERIAL AND ORDER (#238). A stored row is
                                one allocated slice, so a delivery that filled an order
                                and then exceeded it is two of them — the same name, the
                                same order, differing only in a tag and a quantity. What
                                is real there is the split, not two deliveries, and this
                                table is where a reader meets the delivery first.

                                THE `Over-delivered` TAG WENT WITH THE FOLD rather than
                                moving onto the folded row: that row holds the within
                                piece and the excess together, so a tag on it would say
                                the whole quantity was excess. The figure beside the
                                total says which part, which the tag could not, and the
                                word itself is still on this page twice — the headline
                                item above and the banner that reports the excess in a
                                sentence naming the order.

                                Nothing below this fold judges. `Over Delivered` is
                                stored per row, the banners read the raw rows, and
                                `summarizeDelivery` — shared with `/deliveries` and the
                                strip on `/invoices` — reads them too, so no screen can
                                describe this delivery differently because its table
                                regrouped. */}
                            {tableRows.map((row) => (
                                <tr
                                    key={row.key}
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
                                    </td>
                                    {/* COLOR ON THE EXCESS ALONE, which is #241's rule
                                        at its other half. There an entry was wholly an
                                        exception, so its name took the tone; here the
                                        row is partly one, and coloring the total would
                                        say the 10 delivered inside the order is a
                                        problem too. Amber rather than the red
                                        `/pos/[poId]` gives the same word — see the
                                        notes for why the two differ. */}
                                    <td className="py-2 text-right tabular-nums">
                                        {row.qty}
                                        {row.unit ? ` ${row.unit}` : ""}
                                        {row.overQty > 0 && (
                                            <span className="ml-1 whitespace-nowrap text-amber-700">
                                                {ALLOCATION_COPY.table.overPortion(row.overQty).text}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* `these lines` stood here until #219 and was the rule #227 swept
                    for, surviving because that check reads *_COPY constants and this
                    is rendered text. A `Line` on this base is a child of a Job. */}
                <p className="mt-2 text-xs text-zinc-500">
                    The app allocated these rows — oldest order first, skipping ones already
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
