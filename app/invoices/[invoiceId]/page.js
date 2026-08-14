import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getInvoiceReconciliation } from "@/lib/deliveryReconciliation";
import { describeInvoiceColumn, describeInvoiceLine } from "@/lib/deliveryStatus";
import { linkedDelivery } from "@/lib/deliveryInvoiceLink";
import { PAIRING, describePairing, describeTieBreak } from "@/lib/deliveryInvoiceMatch";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import { foldInvoiceItems } from "@/lib/invoiceItemFold";
import { getVisibleInvoiceIds, seesEveryInvoice } from "@/lib/invoiceVisibility";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { formatUSD } from "@/lib/format";
import { withOpsLabel } from "@/lib/airtableOps";
import PaidForm from "./PaidForm";
import DeleteInvoiceButton from "./DeleteInvoiceButton";

// The route param IS the human-readable ID, so the tab names the record for
// ZERO Airtable operations (#201) — this reads the URL and nothing else.
export async function generateMetadata({ params }) {
    const { invoiceId } = await params;
    return { title: invoiceId };
}

const DONE_MESSAGES = {
    created: "Invoice created.",
    updated: "Invoice updated.",
    "paid-updated": "Payment status updated.",
};

// ROW-SCOPED, NOT ROLE-SCOPED (#211), gated exactly the way app/pos/[poId] is:
// President and Admin reach every invoice, and anyone else reaches one that bills
// an order whose request they raised or whose request sits on a job they are
// assigned to. The walk from invoice to request is lib/invoiceVisibility.js and the
// judgment inside it is canViewPR, so this page adds no rule of its own. It
// replaced a President-or-Admin route gate that had no recorded reason: #132's "the
// invoice pages stay President-or-Admin" scoped that issue rather than deciding
// this one.
//
// A REFUSAL RENDERS THE NOT-FOUND TEXT, never a refusal that confirms the record
// exists — the same posture the PR list, the PR detail and the PO detail all take.
//
// MARKING PAID STAYS ADMIN-ONLY (actions.js) and READING payment status is now
// President-or-Admin: whether the vendor has been paid is the one fact here a
// recorder has no use for and a vendor's own staff might ask about on site. That is
// #211's own line, not one inherited from the route gate it replaced.
//
// LABELED IN #232, THE WAY `/pos/[poId]` AND `/prs/[prId]` ARE. An outer wrapper, so
// the page body keeps its indentation, and the route TEMPLATE, so repeated loads
// aggregate into one row. It was added by the issue that narrowed this page's
// delivery reads, because an unlabeled screen has no before and after: the counter
// writes a per-scope record only for a labeled render, and #216 is the precedent —
// a duplicate read on `/deliveries` stood invisible for as long as that page carried
// no label.
export default async function InvoiceDetailPage(props) {
    return withOpsLabel("/invoices/[invoiceId]", () => renderInvoiceDetailPage(props));
}

async function renderInvoiceDetailPage({ params, searchParams }) {
    const user = await requireUser();
    const privileged = seesEveryInvoice(user);
    const { invoiceId } = await params;
    const { done, paired, tied } = await searchParams;
    // #231 — a key, never a sentence. An unknown or absent value words nothing,
    // which is also what makes `none` need no entry: describePairing returns null
    // for anything it has no voice for. `tied` is the qualifier and is read the
    // same way: anything but the flag the action sends words nothing.
    const pairingMessage = describePairing({ key: paired }, "banner");
    const tieBreakMessage = describeTieBreak({ tieBreak: tied === "1" }, "banner");

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    const [items, vendor] = await Promise.all([
        getItemsByInvoice(invoice.id),
        invoice.vendor?.[0] ? getVendorByRecordId(invoice.vendor[0]) : null,
    ]);

    // AFTER the invoice items are loaded, because the gate is answered through
    // them — an Invoice Item carries its own `PO` link, which is how one invoice
    // reaches the requests behind it. Two operations for a non-privileged viewer
    // and none for the office. The invoice items are what this page renders
    // anyway, so nothing is read twice to ask the question.
    const visibleIds = await getVisibleInvoiceIds(user, [invoice], items);
    if (!visibleIds.has(invoice.id)) {
        return <div className="p-8">Invoice not found.</div>;
    }

    // Linked PO(s): each Invoice Item carries the PO it reconciles against
    // (a multi-PO invoice is real), so the distinct POs are derived from the
    // items rather than reading the Invoice-PO Link join table separately —
    // the two are equivalent by construction (see invoices/new/actions.js).
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    const poRecords = await Promise.all(poRecordIds.map((id) => getPOByRecordId(id)));
    const poById = Object.fromEntries(poRecords.map((po) => [po.id, po]));

    // Issue #166 — the delivery side of this invoice, and since #210 the delivery it
    // matches rather than an estimate of which one answered it. Up to three
    // operations on top of what the page already holds (PO Items, Delivery Items,
    // Deliveries), keyed on ids from the level above; the invoice's own invoice items
    // are already loaded, so there is no query for them, and the pairing is a field
    // on the record above. Down from five — the two that went existed only to order
    // the other bills on the same ordered item so one of them could be picked. #232
    // took the third off an invoice that matches no delivery, which reads TWO: that
    // level is the matched delivery now rather than every arrival on the ordered
    // items. The rule is lib/deliveryStatus.js.
    const reconciliation = await getInvoiceReconciliation(items, {
        linkedDeliveryRecordId: linkedDelivery(invoice),
    });

    // Issue #167 — fold the rows an overage split produced back into one, so the
    // table still reads line-for-line against the vendor's PDF. The key is #18's
    // Material link plus the unit price (lib/invoiceItemFold.js); the material comes
    // from the reconciliation, which already holds every invoice item's ordered
    // item, so folding costs no query. Nothing folds on an invoice no correction
    // touched.
    const materialByLine = new Map(
        reconciliation.rows.map((r) => [r.invoiceItemId, r.materialRecordId])
    );
    const foldedItems = foldInvoiceItems(
        items.map((it) => ({ ...it, materialRecordId: materialByLine.get(it.invoiceItemId) ?? null }))
    );

    // Issue #16 — surfaced but never blocking: variance is a review prompt,
    // not a gate on marking something paid.
    const hasVariance = invoice.varianceFlag || items.some((it) => it.varianceFlag);
    const file = invoice.file?.[0];

    // Summary rows in the same invoice-style shape as PR/PO (#102), with
    // invoice's own figures. Shipping Fee always renders (as $0.00 when
    // blank): "$0.00 shipping" is accurate info for this invoice. Tariff is
    // deliberately asymmetric — it renders only when the invoice actually
    // itemizes one, because customs duty is often billed separately, so a
    // blank Tariff means "no duty line on this invoice", not "$0.00 of duty";
    // showing "Tariff: $0.00" would wrongly assert the latter. Hiding the row
    // doesn't affect Calculated Total: it's the Airtable formula (Items
    // Subtotal + Shipping Fee + Tariff, blank = 0), so an absent Tariff
    // contributes 0 whether or not the row is shown.
    const summaryRows = [
        { label: "Items Subtotal", value: invoice.itemsSubtotal, strong: false },
        { label: "Shipping Fee", value: invoice.shippingFee, strong: false },
        ...(invoice.tariff != null
            ? [{ label: "Tariff", value: invoice.tariff, strong: false }]
            : []),
        {
            label: "Calculated Total",
            value: invoice.calculatedTotal ?? invoice.itemsSubtotal,
            strong: true,
        },
    ];

    return (
        <div className="mx-auto w-full max-w-2xl p-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">{invoice.invoiceId}</h1>
                <div className="flex items-center gap-4">
                    {user.isAdmin && (
                        <Link href={`/invoices/${invoice.invoiceId}/edit`} className="text-sm underline">
                            Edit
                        </Link>
                    )}
                    <Link href="/invoices" className="text-sm underline">
                        ← All invoices
                    </Link>
                </div>
            </div>

            {done && DONE_MESSAGES[done] && (
                <p className="mt-4 rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
                    {DONE_MESSAGES[done]}
                </p>
            )}

            {/* #231 — what the app worked out about this bill's shipment, said once
                and only on the way in from creation. It is not part of the record,
                so it lives on the query string rather than being re-derived on
                every load: a reader returning to this page sees the delivery
                section below, which is the standing answer. `none` sends no
                parameter, so there is no voice here for it. */}
            {pairingMessage && (
                <div
                    className={`mt-4 rounded border px-3 py-2 text-sm ${
                        pairingMessage.key === PAIRING.matched && !tieBreakMessage
                            ? "border-zinc-300 bg-zinc-50 text-zinc-700"
                            : "border-amber-300 bg-amber-50 text-amber-800"
                    }`}
                >
                    <p>{pairingMessage.text}</p>
                    {/* One box, two sentences — the tie-break is how the match above
                        was decided, not a second thing that happened. */}
                    {tieBreakMessage && <p className="mt-1">{tieBreakMessage.text}</p>}
                </div>
            )}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Amount Due (vendor&apos;s stated total)
                </p>
                <p className="text-3xl font-semibold">{formatUSD(invoice.amountDue)}</p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Vendor Invoice #: {invoice.vendorInvoiceCode || "—"}</p>
                <p>Issue Date: {invoice.issueDate}</p>
                <p>Due Date: {invoice.dueDate || "—"}</p>
                {file && (
                    <p>
                        <a href={file.url} target="_blank" rel="noreferrer" className="underline">
                            {file.filename || "Invoice File"}
                        </a>
                    </p>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Purchase Order{poRecords.length === 1 ? "" : "s"}</h2>
                {poRecords.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">None linked.</p>
                ) : (
                    <ul className="mt-2 space-y-1 text-sm">
                        {poRecords.map((po) => (
                            <li key={po.id}>
                                <Link href={`/pos/${po.poId}`} className="underline">
                                    {po.poId}
                                </Link>{" "}
                                — <strong>{po.status}</strong>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                {/* Issue #167 — NO PO COLUMN, and dropping it is not a preference.
                    A row an overage split produced spans two orders once folded, so
                    there is no single value for that cell: it is unrepresentable
                    rather than merely inconvenient. The order did not disappear from
                    the page — the Delivery section below is one box per ORDERED
                    ITEM, which by construction has exactly one, and a split shows as
                    two boxes each naming its own. Both halves of that trade are in
                    this one commit on purpose: removing the column alone would take
                    the order off the page entirely. */}
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
                            <th className="pr-2">Size</th>
                            <th className="pr-2">Unit</th>
                            <th className="pr-2 text-right">Qty</th>
                            <th className="pr-2 text-right">Unit Price</th>
                            <th className="pr-2 text-right">Amount</th>
                            <th className="pr-2">Remark</th>
                        </tr>
                    </thead>
                    <tbody>
                        {foldedItems.map((it) => (
                            <tr key={it.key} className="border-t border-zinc-200">
                                <td className="py-1 pr-2">
                                    {it.itemName}
                                    {it.varianceFlag && (
                                        <span className="ml-1 rounded bg-red-100 px-1 text-xs text-red-700">
                                            ⚠ Variance
                                        </span>
                                    )}
                                </td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.unit}</td>
                                <td className="py-1 pr-2 text-right">{it.qty}</td>
                                <td className="py-1 pr-2 text-right">{formatUSD(it.unitPrice)}</td>
                                <td className="py-1 pr-2 text-right">{formatUSD(it.amount)}</td>
                                <td className="py-1 pr-2">{it.remark}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {summaryRows.map((row, i) => (
                            <tr
                                key={row.label}
                                className={
                                    i === 0 ? "border-t-2 border-zinc-300" : undefined
                                }
                            >
                                <td
                                    colSpan={5}
                                    className={
                                        row.strong
                                            ? "py-1 pr-2 text-right font-semibold"
                                            : "py-1 pr-2 text-right text-zinc-500"
                                    }
                                >
                                    {row.label}
                                </td>
                                <td
                                    className={
                                        row.strong
                                            ? "py-1 pr-2 text-right font-semibold"
                                            : "py-1 pr-2 text-right"
                                    }
                                >
                                    {formatUSD(row.value)}
                                </td>
                                <td />
                            </tr>
                        ))}
                    </tfoot>
                </table>
                {invoice.varianceFlag && (
                    <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                        ⚠ Header Variance — the vendor&apos;s Amount Due ({formatUSD(invoice.amountDue)})
                        doesn&apos;t match our Calculated Total ({formatUSD(invoice.calculatedTotal ?? invoice.itemsSubtotal)}).
                    </p>
                )}
            </div>

            {/* Issue #166 — was the material this invoice billed for delivered.
                One box per invoice item, in the items table's own order.

                THE HEADING CHIP IS THE ONE THE LIST SHOWS, from the same function,
                so the row a reader clicked and the page they land on cannot
                describe the invoice differently — #162's summarizeDelivery is
                shared between its list and its detail for the same reason.

                SCOPED TO THIS INVOICE SINCE #232, WHICH IS WHY THE DOCUMENT SITS
                HERE AND THE QUANTITIES SIT IN THE BOXES. `Invoices."Delivery"` is a
                single link, so the delivery a reader wants named is the SAME one for
                every box; naming it per box printed one document as many times as
                the invoice has items, which is the repetition #233 took off the
                order's page. What differs box to box is how much of that delivery
                answered THAT ordered item, and that is what a box still carries.

                THE FIGURES IN A BOX ARE THIS INVOICE'S. `Billed` is what this bill
                charges, not the `Invoiced Qty` rollup across every invoice, and
                `Delivered` is what the matched delivery brought of that ordered item.
                Before #232 both were the ordered item's, which is how
                `HYE-INV-260804-04` came to read `Billed 30` while billing 15 under a
                delivery belonging to another bill. `This bill:` existed only to
                caption the first of those and went with it.

                THE ORDER IS NOT GONE FROM THE BOX — IT IS ON ONE LINE THAT SAYS SO.
                `Against the order:` is the only order-scoped statement left, and its
                label is what keeps the two scopes apart, so it renders on every
                judged box rather than only on an exception. See
                STATUS_COPY.detail.againstOrder before making it conditional again.

                COLOR ON THE VERDICT ONLY. lib/deliveryStatus.js returns named
                slots rather than a list precisely so a call site cannot color the
                asides too, which is how the first version came out all amber with
                the color distinguishing nothing. Both slots can be null now and the
                module decides which — a call site cannot withhold one either. */}
            <div className="mt-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Delivery</h2>
                    <StatusChip chip={describeInvoiceColumn(reconciliation.summary)} />
                </div>

                {/* #232 — THE MATCHED DELIVERY, ONCE, AND NOTHING OF ITS OWN BESIDE
                    IT. No ordered items: a delivery can carry bills this invoice has
                    nothing to do with, so listing what it brought would show orders
                    this invoice never charged. No marker either — a document named
                    directly under this invoice's own heading is this invoice's
                    structurally, which is the argument #166 used when it moved these
                    inside the boxes and is why `— attached to this invoice` retires
                    here rather than moving.

                    `matched` is #231's word, from PAIRING_COPY, and it says the fact
                    the state actually is: nothing has been matched to this bill, as
                    against the material not having arrived. Those became different
                    facts when #210 stored the pairing, and the verdict inside each
                    box used to conflate them by saying `Nothing delivered yet` under
                    an empty list. */}
                {reconciliation.delivery ? (
                    <p className="mt-1 text-sm text-zinc-600">
                        <Link
                            href={`/deliveries/${encodeURIComponent(reconciliation.delivery.deliveryId)}`}
                            className="underline"
                        >
                            {reconciliation.delivery.deliveryId}
                        </Link>{" "}
                        ({reconciliation.delivery.receivedDate || "—"})
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-zinc-600">
                        No delivery has been matched to this invoice yet.
                    </p>
                )}

                {reconciliation.rows.length === 0 ? (
                    <p className="mt-1 text-sm text-zinc-600">
                        This invoice has no lines.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-2 text-sm">
                        {reconciliation.rows.map((row) => {
                            const lines = describeInvoiceLine(row.status, row.unit, {
                                hasDelivery: reconciliation.summary.hasDelivery,
                            });
                            return (
                                <li
                                    key={row.invoiceItemId}
                                    className="rounded border border-zinc-200 p-3"
                                >
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        <span className="font-medium">
                                            {[row.itemName, row.size].filter(Boolean).join(" ") || "—"}
                                        </span>
                                        {/* Issue #167 — the order this box is scoped
                                            to. It moved here from the items table's
                                            PO column, which a folded row cannot
                                            fill; a box always has exactly one. */}
                                        {row.poRecordId && poById[row.poRecordId] && (
                                            <Link
                                                href={`/pos/${encodeURIComponent(poById[row.poRecordId].poId)}`}
                                                className="text-xs text-zinc-500 underline"
                                            >
                                                {poById[row.poRecordId].poId}
                                            </Link>
                                        )}
                                    </div>

                                    {/* THIS INVOICE'S TWO FIGURES (#232). `Delivered`
                                        renders only where there is a delivery to have
                                        delivered it — the same one condition that
                                        decides the verdict below, so the box never
                                        shows a quantity whose subject the section
                                        heading says does not exist. */}
                                    {row.status && (
                                        <p className="mt-0.5 text-xs tabular-nums text-zinc-500">
                                            Billed {row.billedOnThisInvoice}
                                            {row.unit ? ` ${row.unit}` : ""}
                                            {reconciliation.summary.hasDelivery && (
                                                <>
                                                    {" · Delivered "}
                                                    {row.status.delivered}
                                                    {row.unit ? ` ${row.unit}` : ""}
                                                </>
                                            )}
                                        </p>
                                    )}

                                    {lines.verdict && (
                                        <p
                                            className={
                                                lines.verdict.key === "all-delivered"
                                                    ? "mt-1 text-green-700"
                                                    : lines.verdict.key === "not-compared"
                                                      ? "mt-1 text-zinc-500"
                                                      : "mt-1 text-amber-700"
                                            }
                                        >
                                            {lines.verdict.text}
                                        </p>
                                    )}

                                    {lines.againstOrder && (
                                        <p className="mt-1 text-zinc-600">
                                            {lines.againstOrder.text}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* HOISTED OUT OF THE PAYMENT SECTION BY #211, because it is a fact
                about the invoice and that section is now President-or-Admin. It has
                to outlive the gate: the amber prompt is the only thing that raises a
                INVOICE-ITEM-only variance to invoice level, and an invoice item
                billed for thirteen against ten delivered is exactly what the
                employee who counted the material is here to catch. Its wording
                is untouched — naming the two
                variance kinds apart is #179's, and copy that mentions payment does
                not disclose whether THIS vendor was paid, which is where the line
                actually runs. */}
            {hasVariance && (
                <p className="mt-8 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠ This invoice has variance flags — review before confirming payment.
                </p>
            )}

            {/* PRESIDENT-OR-ADMIN (#211) — the whole section, heading included. A
                heading with nothing under it would tell an employee there is a
                payment fact here and refuse to say it, which is worse than not
                raising the subject. The Admin-only toggle inside is unchanged;
                what moved is who may READ the answer. */}
            {privileged && (
                <div className="mt-8">
                    <h2 className="text-lg font-semibold">Payment</h2>
                    {user.isAdmin ? (
                        <div className="mt-2">
                            <PaidForm invoiceId={invoice.invoiceId} paid={invoice.paid} paidDate={invoice.paidDate} />
                        </div>
                    ) : (
                        <p className="mt-2 text-sm">
                            {invoice.paid ? `Paid on ${invoice.paidDate || "—"}` : "Not paid yet."}
                        </p>
                    )}
                </div>
            )}

            {user.isAdmin && (
                <div className="mt-8 border-t border-zinc-200 pt-6">
                    <DeleteInvoiceButton invoiceId={invoice.invoiceId} />
                </div>
            )}
        </div>
    );
}
