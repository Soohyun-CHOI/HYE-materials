import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getInvoiceReconciliation } from "@/lib/deliveryReconciliation";
import { STATUS_COPY, describeInvoiceColumn } from "@/lib/deliveryStatus";
import { linkedDelivery } from "@/lib/deliveryInvoiceLink";
import { PAIRING, describePairing, describeTieBreak } from "@/lib/deliveryInvoiceMatch";
import { QualifierMarker, StatusChip } from "@/app/components/DeliveryStatusMarks";
import { foldInvoiceItems } from "@/lib/invoiceItemFold";
import { invoiceDeliveryEntries } from "@/lib/invoiceDeliveryEntries";
import { ORDER_BREAKDOWN_COPY, billedItemsByOrder } from "@/lib/invoiceOrderBreakdown";
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

// The two tones a delivery entry can wear (#241), as colors. The DECISION is
// lib/deliveryStatus.js's — an entry is a discrepancy or it is an invoice item
// nothing was measured against — and only which amber is settled here, the same split
// app/components/DeliveryStatusMarks.js states for the chips. Not in that file
// although it holds the other tone map: these are text colors on a detail list, not
// the closed set of chip states, and one map serving both would tie a discrepancy in
// a sentence to the background of a chip that means something else.
const ENTRY_TONE_CLASS = {
    exception: "text-amber-700",
    unjudged: "text-zinc-500",
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

    // Issue #237 — which order each item was billed against, for the `Purchase Orders`
    // section below, and only where the folded items disagree about that. Reads the
    // fold's `rowIds` against the invoice items already loaded, so it costs no query:
    // an Invoice Item carries its own `PO` and `PO Item`, and the order records are the
    // ones that section already renders. The rule is lib/invoiceOrderBreakdown.js.
    const orderBreakdown = billedItemsByOrder({ folded: foldedItems, items });

    // Issue #241 — the delivery section's entries, one per FOLDED item rather than
    // one per invoice item, so what counts as one material is decided once for this
    // page. The same fold, joined to the reconciliation rows on the invoice item's
    // record id; shares are added rather than re-derived, and an entry with nothing
    // to say does not come back at all. Costs no query — both inputs are computed
    // above. The rule is lib/invoiceDeliveryEntries.js.
    const deliveryEntries = invoiceDeliveryEntries({
        folded: foldedItems,
        rows: reconciliation.rows,
        hasDelivery: reconciliation.summary.hasDelivery,
    });

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

            {/* Issue #237 — THE ITEMS HANG UNDER THE ORDERS HERE, AND ONLY WHERE THE
                FOLDED ITEMS DISAGREE ABOUT WHICH ORDERS THEY TOUCH. #167 took the `PO`
                column off the items table because a folded row spans two orders and
                left the question with the delivery section; #232 scoped that section to
                one delivery, where an order is not a fact. This is the section whose
                subject IS an order, so it is the answer's third and last home.

                THE NESTING IS #233's, DELIBERATELY UNCHANGED: the parent line is the
                document's identity and its own facts, the child list is the pair facts
                in smaller gray text at `pl-4`. `/pos/[poId]` puts an invoice's charges
                under the invoice the same way, so a reader crossing between the two
                screens meets one grammar rather than two. What differs is the price —
                see lib/invoiceOrderBreakdown.js for why a line here carries only the
                quantity.

                AN ORDER WITH NO CHILD LINE IS NOT A BUG. It is reached only through an
                item with no ordered item behind it, which names no order; the order is
                still charged, so it keeps its line, and the empty space under it is the
                honest answer. The section's OWN list is unchanged — it comes from every
                item's `PO`, free-text ones included.

                THE SECTION STAYS ABOVE THE ITEMS TABLE, so these names precede the
                table they mirror. Moving it below would be a change to a layout this
                issue was not asked to redraw, and the list appears only in the
                ambiguous case; its subject is the order, which is what this position
                already says. */}
            <div className="mt-6">
                <h2 className="text-lg font-semibold">Purchase Order{poRecords.length === 1 ? "" : "s"}</h2>
                {poRecords.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">None linked.</p>
                ) : (
                    <ul className={`mt-2 text-sm ${orderBreakdown.shown ? "space-y-2" : "space-y-1"}`}>
                        {poRecords.map((po) => {
                            const billed = orderBreakdown.shown
                                ? orderBreakdown.byOrder.get(po.id) ?? []
                                : [];
                            return (
                                <li key={po.id}>
                                    <p className="flex flex-wrap items-center gap-x-2">
                                        <Link href={`/pos/${po.poId}`} className="underline">
                                            {po.poId}
                                        </Link>
                                        <span>
                                            — <strong>{po.status}</strong>
                                        </span>
                                    </p>
                                    {billed.length > 0 && (
                                        <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                            {billed.map((b) => (
                                                <li key={b.key}>
                                                    {ORDER_BREAKDOWN_COPY.billed(b).text}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            );
                        })}
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

                SCOPED TO THIS INVOICE SINCE #232, AND ITS DENSITY NOW FOLLOWS THE
                STATE. `Invoices."Delivery"` is a single link, so the delivery a
                reader wants named is the SAME one for every box; naming it per box
                printed one document as many times as the invoice has items, which is
                the repetition #233 took off the order's page.

                THE INVOICE LEVEL SAYS WHAT THE STATE IS AND A BOX POINTS AT AN
                EXCEPTION — that is the whole layout, and it follows from the
                one-delivery premise (docs/notes, "The one-delivery premise"). What
                this invoice bills arrives on the delivery it matches or not at all,
                so "everything billed was delivered" is one fact about one document:
                the chip states it, and a box repeating it would state it once per
                invoice item.

                SO THREE STATES AT THREE DENSITIES. Matched to nothing: one sentence
                and no item list at all — this section is about a delivery, and with
                none matched there is nothing per item to say. Matched and covered:
                the delivery, and nothing under it, since #241 dropped the entry that
                agrees. Matched and short: the amber box, then one entry per material
                that disagrees, carrying its figures.

                THE CHIP AND THE BOX BELOW IT ARE THE FACT AND THE ASK. `Mismatch` is
                a chip value since #232's third pass, so the discrepancy is a word a
                reader meets without hovering; a `!` marker stood beside `Delivered`
                and qualified a word that had already been read, with its sentence in
                a tooltip that reaches neither touch nor a keyboard. The sentence is
                the amber box, shaped like the variance prompt further down this same
                page because it is the same grade of fact — a person must look before
                money moves.

                COLOR ON THE ENTRY, NAME INCLUDED, AND #232's RULE HERE WAS THE
                OPPOSITE. That issue colored the verdict alone and left the name black,
                because its first version colored everything and the color then
                distinguished nothing — which was true of a list holding EVERY invoice
                item, where the silent ones would have been colored too. #241 emptied
                that premise: the list holds only what disagrees, so coloring the name
                cannot reach a normal item and the color says exactly `this one is the
                problem`. A black name over an amber sentence had the color attached to
                nothing a reader could name, and with several short items black and
                amber alternate down the page.

                THE TONE IS THE VERDICT'S, so `Not compared — no ordered item` is gray
                in both halves — an invoice item nothing was measured against is not a
                problem, and an amber name over that sentence would contradict it. An
                entry the order-scoped aside alone put in the list has no verdict and
                is amber: something exceeding an ordered item is why it is here. The
                aside itself stays uncolored, which is #232's distinction and holds —
                it is the ordered item's fact rather than this bill's.

                THE NAMED SLOTS STILL DO THEIR WORK, and that half of #232's argument
                is untouched: lib/deliveryStatus.js returns `verdict` and `againstOrder`
                as separate slots rather than a list, so the aside cannot be colored by
                a caller iterating one collection. Both slots can be null and the module
                decides which — a call site cannot withhold one either. What moved is
                only WHICH tone, and that is a semantic decision, so it comes from the
                module too; ENTRY_TONE_CLASS at the top of this file holds the colors,
                because which amber is a rendering decision. */}
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

                {/* AFTER THE DELIVERY IS NAMED, NOT BEFORE IT, and the order is the
                    sentence's own grammar. It says the invoice bills more than the
                    delivery matched to it delivered, so a reader meets the delivery
                    it is about first and the claim about it second — putting the
                    accusation above the document it accuses would have the reader
                    scroll back for the subject. It also keeps the section's first
                    line the same line in all three states, which is what makes the
                    box read as an addition rather than as a different layout.

                    Its own sentence rather than the chip's, at detail density: the
                    chip is one word and this is what does not match plus who has to
                    act. See STATUS_COPY.detail.mismatch for why it carries no figure
                    and why it wears the variance prompt's shape. */}
                {reconciliation.summary.key === "mismatch" && (
                    <p className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {STATUS_COPY.detail.mismatch().text}
                    </p>
                )}

                {/* ONLY WHAT DISAGREES, AND ONE ENTRY PER MATERIAL (#241). Two rules
                    decide what is here, and both live in lib/invoiceDeliveryEntries.js
                    rather than in this condition — the offline tier cannot read JSX,
                    and "the list vanished" is a failure that looks exactly like a
                    normal invoice.

                    NO LIST WITHOUT A MATCHED DELIVERY is #232's and is unchanged: with
                    nothing matched there is no second term, so an entry per invoice
                    item was a list of names with no fact in any of them, and the
                    sentence above is the whole answer. `Not compared — no ordered item`
                    goes with them, since it says why an invoice item was left out of a
                    comparison that is not happening.

                    NO ENTRY THAT AGREES is #241's, and the fold is what forced it. #232
                    kept a silent entry when the list was one per invoice item; folded,
                    the list is the name column of the items table directly above —
                    same count, same names, same order. The invoice level says what the
                    state is and the item level points at an exception, which is the
                    division #232 settled and this is the last cell of it. So a covered
                    invoice renders no list at all: the delivery, named once, is the
                    section. `This invoice has no lines.` went with the same edit — an
                    invoice with no items has no exceptions either, and the items table
                    above already says it is empty. */}
                {deliveryEntries.length > 0 && (
                    <ul className="mt-3 space-y-2 text-sm">
                        {deliveryEntries.map((entry) => {
                            const lines = entry.lines;
                            return (
                                /* NO BORDER SINCE #232's THIRD PASS. It was a box
                                   drawn around `Ordered · Billed · Delivered`, a share
                                   line, a verdict, an aside and a delivery list; with
                                   the inside emptied it framed a name. A list is
                                   enough, and the border was making a silent entry
                                   look like a card that had failed to load.

                                   KEYED ON THE FOLD'S OWN KEY (#241), which is what an
                                   entry now is. An `Invoice Item ID` would have to pick
                                   one of the rows a folded entry stands for. */
                                <li key={entry.key}>
                                    {/* NO PO LINK (#232's third pass), and since #241
                                        no entry it could hang on: a folded entry can
                                        span two orders, which is #167's own reason the
                                        items table has no such column. #167 put it here
                                        because the items table dropped its PO column —
                                        a row an overage split produced spans two
                                        orders once folded, so that cell had no single
                                        value — and this section was the nearest place
                                        with one order per entry. It is the wrong place
                                        on two counts: which order an item was billed
                                        against is not a delivery fact, and it is not
                                        a fact a reader of THIS screen acts on, since
                                        nothing about whether to pay turns on it. #237
                                        took the question, under `Purchase Orders`
                                        above, answered only where the folded items do
                                        not all touch the same set of orders — which is
                                        where the ambiguity #167 was solving actually
                                        lives. */}
                                    <span className={`font-medium ${ENTRY_TONE_CLASS[entry.tone]}`}>
                                        {[entry.itemName, entry.size].filter(Boolean).join(" ") || "—"}
                                    </span>

                                    {/* NO FIGURES LINE. `Billed 15 · Delivered 15`
                                        stood here and was the same on every box of a
                                        normal invoice; the two sentences below carry
                                        the quantities on the entries that have
                                        something to say. `Billed` is also in the items
                                        table directly above this section — and since
                                        #241 the entry and that row are the same unit,
                                        so a figure here is against the same quantity a
                                        reader just read there. */}
                                    {lines.verdict && (
                                        <p className={ENTRY_TONE_CLASS[entry.tone]}>
                                            {lines.verdict.text}
                                        </p>
                                    )}

                                    {/* CONDITIONAL AGAIN (#232, second pass). It was
                                        made unconditional to anchor the figures line
                                        above it; that line is gone, so a normal box
                                        has nothing to anchor and stays silent. Its
                                        `N ordered` term went with it — that question
                                        is `/pos/[poId]`'s `Qty` column, one click
                                        away and on a page that names this invoice
                                        since #233. */}
                                    {lines.againstOrder && (
                                        <p className="text-zinc-600">
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
