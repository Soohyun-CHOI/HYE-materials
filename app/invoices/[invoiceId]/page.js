import Link from "next/link";
import FileViewer from "@/app/components/FileViewer";
import { requireUser } from "@/lib/authz";
import { FILE_AXIS } from "@/lib/fileLinks";
import { getInvoiceById } from "@/lib/airtable/invoices";
import { getItemsByInvoice } from "@/lib/airtable/invoiceItems";
import { getInvoiceReconciliation } from "@/lib/deliveryStatus.server";
import {
    STATUS_COPY,
    describeInvoiceColumn,
    describeInvoiceOverdue,
    describeInvoiceWait,
    invoicePayment,
} from "@/lib/deliveryStatus";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import UndrawnPage from "@/app/components/UndrawnPage";
import { foldInvoiceItems } from "@/lib/invoiceItemFold";
import { invoiceDeliveryEntries } from "@/lib/invoiceDeliveryEntries";
import { itemLabel } from "@/lib/materialIdentity";
// #330 — one fact, one sentence, shared with `updateInvoiceAction`'s refusal.
import { ITEMS_MISSING_COPY, invoiceItemsMissing } from "@/lib/invoiceItemsMissing";
import { ORDER_BREAKDOWN_COPY, chargesByOrder } from "@/lib/invoiceOrderBreakdown";
// #309 — the WALK only. This page loads the invoice items it renders anyway, so it
// never had a use for `seesEveryInvoice`'s cost shortcut; it imported the helper to
// gate the Payment section, and payment no longer has a gate.
import { getVisibleInvoiceIds } from "@/lib/invoiceVisibility";
import { getVendorByRecordId } from "@/lib/airtable/vendors";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { getUserByRecordId, getUsersByRecordIds } from "@/lib/airtable/users";
import { getInvoiceVarianceLogEntries } from "@/lib/airtable/invoiceVarianceLog";
// #382 — the first name, which is what a screen REPORTING a person prints. The
// delivery detail's `Recorded by` line takes it from here for the same reason.
import { userName } from "@/lib/userName";
import { DAY_FORMAT, formatUSD } from "@/lib/format";
import Instant from "@/app/components/Instant";
// #179 — the variance kinds are named in one place, beside the predicates that set
// them; #623 gave them the design's names.
import {
    ACCEPTANCE_COPY,
    ITEM_VARIANCE_KINDS,
    PAYMENT_CHECK_COPY,
    VARIANCE_COPY,
    openVariances,
    varianceNote,
    varianceState,
} from "@/lib/variance";
import { withOpsLabel } from "@/lib/airtableOps";
import PaymentSection from "./PaymentSection";
import { TotalsVariance, VarianceMark } from "./VarianceAcceptance";
import DeleteInvoiceButton from "./DeleteInvoiceButton";

// The route param IS the human-readable ID, so the tab names the record for
// ZERO Airtable operations (#201) — this reads the URL and nothing else.
export async function generateMetadata({ params }) {
    const { invoiceId } = await params;
    return { title: invoiceId };
}

// The tone a delivery row can wear (#241, #640), as a color. The DECISION is
// lib/deliveryStatus.js's and only which amber is settled here, the same split
// app/components/DeliveryStatusMarks.js states for the chips. Not in that file
// although it holds the other tone map: these are text colors on a detail table, not
// the closed set of chip states, and one map serving both would tie a row's wait to
// the background of a chip that means something else.
//
// `waiting` IS #640's, AND IT REPLACED `exception`: a row whose quantity has not all
// arrived is material still to come under the three-way match, not a discrepancy
// against one delivery. A row answered in full carries no tone and wears no color.
const ENTRY_TONE_CLASS = {
    waiting: "text-amber-700",
};

// ROW-SCOPED, NOT ROLE-SCOPED (#211), gated exactly the way app/pos/[poId] is:
// President and Admin reach every invoice, and anyone else reaches one that charges
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
// MARKING PAID STAYS ADMIN-ONLY (actions.js) AND READING PAYMENT IS OPEN TO EVERY
// READER OF THE ROW (#309). #211 made reading it President-or-Admin, on the ground
// that a vendor's own staff might ask about it on site; the office asked for the
// opposite. That issue had no need to tell reading and writing apart, because one
// answer stood behind both — and this page is where they split: the section is
// ungated and the CONTROL inside it is `user.isAdmin`, which is what
// `updatePaidAction` is wrapped with. **SINCE #318 THAT ANSWER TRAVELS AS `canEdit`
// RATHER THAN AS A BRANCH HERE**, and the two conditions are still deliberately not
// one expression: the section's body is unconditional and only the control asks.
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

async function renderInvoiceDetailPage({ params }) {
    const user = await requireUser();
    const { invoiceId } = await params;
    // #231's `?paired` and `?tied` WERE READ HERE AND ARE GONE WITH THE PAIRING (#640).
    // They carried, on the way in from creation, which delivery the app had matched the
    // new invoice to; nothing is matched now, so there is nothing to say on arrival and
    // the page reads no query string at all.

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
        return <div className="p-8">Invoice not found.</div>;
    }

    const [items, vendor] = await Promise.all([
        // #640 — FROM THE IDS THE INVOICE ALREADY CARRIES, so the invoice is not found a
        // second time to read its own link array (#193's shape, which the delivery detail
        // has had since that issue). That find was one operation on every load, and it is
        // what pays for the one the delivery section can now need: the other invoices on
        // an ordered item partly delivered (lib/deliveryStatus.server.js).
        getItemsByInvoice(invoice.id, { rowIds: invoice.invoiceItems || [] }),
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
    // items — the one record of which orders an invoice charges.
    const poRecordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
    // #382 — the person who entered this invoice, read BESIDE the orders rather than
    // before the gate above: a reader who is refused the record pays nothing for a
    // name they will not see, and folding it into a round trip the page was already
    // making costs no wall-clock time. One operation, and none at all on an invoice
    // entered before the field existed.
    //
    // #648 — AND WHO ACCEPTED EACH VARIANCE, which is the one read this page can add. The
    // `Invoice Variance Log` rows come off the ids the invoice already carries, in the same round trip
    // as the orders, and an invoice nobody has accepted anything on has none and reads nothing
    // — every invoice until an Admin accepts one. Where there are rows, the people they name
    // are read in ONE batch with the recorder rather than beside it, so the people cost the
    // one operation the recorder always did and the log is the only operation added.
    const logIds = invoice.invoiceVarianceLog || [];
    const recorderId = invoice.recordedBy?.[0] ?? null;
    const [poRecords, invoiceVarianceLog, recorderAlone] = await Promise.all([
        Promise.all(poRecordIds.map((id) => getPOByRecordId(id))),
        getInvoiceVarianceLogEntries(logIds),
        logIds.length === 0 && recorderId ? getUserByRecordId(recorderId) : null,
    ]);
    const peopleIds = [recorderId, ...invoiceVarianceLog.flatMap((e) => e.recordedBy)].filter(Boolean);
    const people =
        logIds.length === 0
            ? recorderAlone
                ? [recorderAlone]
                : []
            : peopleIds.length > 0
              ? await getUsersByRecordIds([...new Set(peopleIds)])
              : [];
    const personById = new Map(people.map((p) => [p.id, p]));
    const recorder = recorderId ? personById.get(recorderId) ?? null : null;

    // Issue #166 — the delivery side of this invoice, as the three-way match reads it
    // since #640: the ordered items this invoice charges, their delivered and invoiced
    // totals, and how much of this invoice the oldest-first fill answered. `PO Items`,
    // then the `Delivery Items` that name the deliveries the section lists, and the
    // other invoices' items only when an ordered item is partly delivered and charged
    // by another invoice too. The invoice's own items are already loaded and are never
    // read again. The rule is lib/deliveryStatus.js.
    const reconciliation = await getInvoiceReconciliation(items);

    // Issue #167 — fold the rows an overage split produced back into one, so the
    // table still reads line-for-line against the vendor's PDF. The key is #18's
    // Material link plus the unit price (lib/invoiceItemFold.js); the material comes
    // from the reconciliation, which already holds every invoice item's ordered
    // item, so folding costs no query. Nothing folds on an invoice no correction
    // touched.
    const materialByOrderedItem = new Map(
        reconciliation.rows.map((r) => [r.invoiceItemId, r.materialRecordId])
    );
    const foldedItems = foldInvoiceItems(
        items.map((it) => ({ ...it, materialRecordId: materialByOrderedItem.get(it.invoiceItemId) ?? null }))
    );

    // Issue #237 — which order each item was invoiced against, for the `Purchase Orders`
    // section below, and only where the folded items disagree about that. Reads the
    // fold's `rowIds` against the invoice items already loaded, so it costs no query:
    // an Invoice Item carries its own `PO` and `PO Item`, and the order records are the
    // ones that section already renders. The rule is lib/invoiceOrderBreakdown.js.
    //
    // Issue #408 — and what each of those charges was measured against. The ordered
    // quantities come off the reconciliation, which read `PO Items` to compare
    // quantities and now hands the level back, so the denominator costs NO operation
    // and no extra field: `findByRecordIds` passes no `fields`, so `Qty` was already
    // on the records this page had (lib/airtable/poItems.js says so of its own).
    const orderBreakdown = chargesByOrder({
        folded: foldedItems,
        items,
        orderedQtyByOrderedItem: reconciliation.orderedQtyByOrderedItem,
    });

    // Issue #241 — the delivery section's rows, one per FOLDED item rather than one
    // per invoice item, so what counts as one material is decided once for this page.
    // The same fold, joined to the reconciliation rows on the invoice item's record id;
    // figures are added rather than re-derived, and since #640 every item has a row.
    // Costs no query — both inputs are computed above. The rule is
    // lib/invoiceDeliveryEntries.js.
    const deliveryEntries = invoiceDeliveryEntries({
        folded: foldedItems,
        rows: reconciliation.rows,
    });

    // Issue #16 — surfaced but never blocking: a variance is a review prompt, not a
    // gate on marking something paid. #179 — the ITEMS only, a price variance or a
    // quantity variance (#623). Totals differ is stated once, in the red box under the
    // totals, and the two used to be one condition here, which printed that fact twice
    // on one page. #648 — an OPEN one: a variance an Admin has accepted is settled, and the
    // prompt asks a reader to take up something nobody has.
    const hasItemVariance = foldedItems.some((it) =>
        ITEM_VARIANCE_KINDS.some((kind) => it[`${kind}Variance`] === "open")
    );
    const file = invoice.file?.[0];

    // #648 — what each mark says beside its badge: who accepted it, when and why, or when it
    // was reopened. Resolved here with the name, so the Client Component draws words and a
    // day, and nobody's record reaches the browser.
    const noteFor = (kind, rowIds, state) => {
        const note = varianceNote(invoiceVarianceLog, kind, rowIds, state);
        if (!note) return null;
        return note.kind === "accepted"
            ? { ...note, byName: userName(personById.get(note.by)) || null }
            : note;
    };
    const totalsState = varianceState(invoice, "totals");
    const totalsFigures = [
        formatUSD(invoice.invoiceTotal),
        formatUSD(invoice.calculatedTotal ?? invoice.itemsSubtotal),
    ];

    // #316 — the server's day, for the two judgments on this page that need one: the
    // payment's lateness and, since #640, how long the invoice has waited on a delivery.
    // `/invoices` and `/pos` take it the same way and for the same reason; `daysWaiting`
    // documents what a server day does and does not promise, and both judgments inherit
    // its properties. Costs no Airtable operation: `Paid Date`, `Due Date` and `Issue
    // Date` are already on the record this page loaded, so today is the only new input.
    const today = new Date().toISOString().slice(0, 10);
    const wait = describeInvoiceWait(reconciliation.summary, invoice.issueDate, today);

    // Summary rows in the same invoice-style shape as PR/PO (#102), with
    // invoice's own figures. Shipping Fee always renders (as $0.00 when
    // blank): "$0.00 shipping" is accurate info for this invoice. Tariff is
    // deliberately asymmetric — it renders only when the invoice actually
    // itemizes one, because customs duty is often invoiced separately, so a
    // blank Tariff means "no duty line on this invoice", not "$0.00 of duty";
    // showing "Tariff: $0.00" would wrongly assert the latter. Hiding the row
    // doesn't affect Calculated Total: it's the Airtable formula (Items
    // Subtotal + Shipping Fee + Tariff + Sales Tax, blank = 0), so an absent
    // Tariff contributes 0 whether or not the row is shown.
    //
    // #283 — Sales Tax takes the same asymmetry for the same reason, and it goes
    // AFTER Tariff. On the document being transcribed a duty is a cost of the
    // goods and prints with them, while a tax is assessed on the sale and prints
    // last before the total, so this order is the vendor's own; it is also the
    // formula's argument order and the create form's slot order. Appending
    // rather than inserting also leaves an invoice that has a tariff and no tax
    // rendering exactly as it did before this issue.
    //
    // `!= null` ADMITS 0, which is deliberate on both terms: a document stating
    // a zero tax gets a `$0.00` row, because "this document says no tax was
    // charged" is a different and true claim from "this document has no tax
    // line". Nothing in the app currently stores that 0 — both forms coerce a
    // typed zero to blank — so the row is reachable today only from a hand edit
    // in Airtable, and the reading side is right either way.
    const summaryRows = [
        { label: "Items Subtotal", value: invoice.itemsSubtotal, strong: false },
        { label: "Shipping Fee", value: invoice.shippingFee, strong: false },
        ...(invoice.tariff != null
            ? [{ label: "Tariff", value: invoice.tariff, strong: false }]
            : []),
        ...(invoice.salesTax != null
            ? [{ label: "Sales Tax", value: invoice.salesTax, strong: false }]
            : []),
        {
            label: "Calculated Total",
            value: invoice.calculatedTotal ?? invoice.itemsSubtotal,
            strong: true,
        },
    ];

    return (
        <UndrawnPage measure="document">
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

            {/* #231's arrival box stood here — which delivery the app had matched the new
                invoice to, carried on `?paired` and `?tied` — and went with the pairing
                (#640). The delivery section below is the standing answer on every load. */}

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Invoice total
                </p>
                <p className="text-3xl font-semibold">{formatUSD(invoice.invoiceTotal)}</p>
            </div>

            <div className="mt-4 space-y-1 text-sm">
                <p>Vendor: {vendor?.vendorName || "—"}</p>
                <p>Vendor Invoice #: {invoice.vendorInvoiceCode || "—"}</p>
                <p>Issue Date: {invoice.issueDate}</p>
                <p>Due Date: {invoice.dueDate || "—"}</p>
                {/* Issue #382 — who to ask about a figure that looks wrong. The same
                    word and the same position the delivery detail gives it, one line
                    above the document itself.

                    AND WHEN, SINCE #623, IN THE DESIGN'S WORDS: `Recorded by {name} ·
                    {day}`, the day the invoice was entered as the reader's own zone
                    has it. No colon, as the design writes it, where the delivery's
                    undesigned line keeps `Recorded by:` and `on {instant}`. The day
                    alone, as the design draws it: an Invoice ID already dates the
                    record, and a time would be a precision the design did not ask for.

                    ALWAYS DRAWN, WITH AN EM DASH WHEN NOBODY IS RECORDED, like the
                    three lines over it. Every invoice entered before #382 has none, and
                    "nobody is recorded" is the thing such a reader needs told — hiding
                    the line would leave them unaware the app holds it at all. A row
                    with no `Created At` — one made by hand in Airtable — draws the name
                    alone, since a day the base does not hold has nothing to stand for. */}
                <p>
                    Recorded by {userName(recorder) || "—"}
                    {invoice.createdAt && (
                        <>
                            {" "}
                            <span aria-hidden="true">·</span>{" "}
                            <Instant at={invoice.createdAt} format={DAY_FORMAT} />
                        </>
                    )}
                </p>
                {file && (
                    <p>
                        {/* Issue #331 — the vendor's document opens over this page
                            rather than in a tab that names neither it nor the way
                            back. Our own route, re-read per request, so the href
                            outlives the Airtable url it used to be. */}
                        <FileViewer
                            axis={FILE_AXIS.invoice}
                            documentId={invoice.invoiceId}
                            filename={file.filename}
                            contentType={file.type}
                        >
                            {file.filename || "Invoice File"}
                        </FileViewer>
                    </p>
                )}
            </div>

            {/* Issue #237 — THE ITEMS HANG UNDER THE ORDERS HERE, AND ONLY WHERE THE
                FOLDED ITEMS DISAGREE ABOUT WHICH ORDERS THEY TOUCH. #167 took the `PO`
                column off the items table because a folded row spans two orders and
                left the question with the delivery section; #232 scoped that section to
                one delivery, where an order is not a fact. This is the section whose
                subject IS an order, so it is the answer's third and last home.

                THE NESTING IS #233's, DELIBERATELY UNCHANGED: the parent row is the
                document's identity and its own facts, the child list is the pair facts
                in smaller gray text at `pl-4`. `/pos/[poId]` puts an invoice's charges
                under the invoice the same way, so a reader crossing between the two
                screens meets one grammar rather than two. What differs is the price —
                see lib/invoiceOrderBreakdown.js for why a line here carries only the
                quantity.

                AN ORDER WITH NO CHILD ROW IS NOT A BUG. It is reached only through an
                item with no ordered item behind it, which names no order; the order is
                still charged, so it keeps its row, and the empty space under it is the
                honest answer. The section's OWN list is unchanged — it comes from every
                item's `PO`, free-text ones included.

                THE SECTION STAYS ABOVE THE ITEMS TABLE, so these names precede the
                table they mirror. Moving it below would be a change to a layout this
                issue was not asked to redraw, and the list appears only in the
                ambiguous case; its subject is the order, which is what this position
                already says. */}
            {/* #330 — THE HEADING GOES WITH THE LIST, because the one state that
                empties this section is the one the Items section now speaks for.
                `poRecords` is derived from the invoice items, so an invoice whose
                rows were removed in Airtable has no order to name either — and a
                heading standing over nothing is the same defect the section below
                exists to end, one section up. */}
            {poRecords.length > 0 && (
            <div className="mt-6">
                <h2 className="text-lg font-semibold">Purchase Order{poRecords.length === 1 ? "" : "s"}</h2>
                {/* A `None linked.` empty state stood here (#278), on the ground that
                    every invoice links at least one order: `createInvoiceAction`
                    requires a `PO` per item. **#330 is the counter-example that
                    ground did not have** — the two invoices which rendered it were
                    hand-entered, and a hand edit can still empty an invoice today.
                    What replaced the sentence is not another sentence here: the
                    absence is stated once, where the rows would be, and this section
                    is simply not drawn. */}
                {poRecords.length > 0 && (
                    <ul className={`mt-2 text-sm ${orderBreakdown.shown ? "space-y-2" : "space-y-1"}`}>
                        {poRecords.map((po) => {
                            const charges = orderBreakdown.shown
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
                                    {charges.length > 0 && (
                                        <ul className="mt-0.5 pl-4 text-xs text-zinc-500">
                                            {charges.map((b) => (
                                                <li key={b.key}>
                                                    {ORDER_BREAKDOWN_COPY.charged(b).text}
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
            )}

            <div className="mt-6">
                <h2 className="text-lg font-semibold">Items</h2>
                {/* Issue #167 — NO PO COLUMN, and dropping it is not a preference.
                    A row an overage split produced spans two orders once folded, so
                    there is no single value for that cell: it is unrepresentable
                    rather than merely inconvenient. The order did not disappear from
                    the page: #167 put it in the Delivery section's per-ordered-item
                    boxes, and since #237 it is the `Purchase Orders` section above,
                    which names the order each folded item was charged against where
                    the items disagree about it. This said the Delivery section was
                    one box per ordered item until #640 — false since #241 folded it. */}
                {/* #330 — THE SENTENCE REPLACES THE WHOLE TABLE, heads and totals
                    footer included, and that is the decision rather than a detail.
                    An empty `tbody` under eight column heads reads as an invoice that
                    charges for nothing; worse, the footer is arithmetic over an
                    absence — `formatUSD(undefined)` is `$0.00`, so it printed
                    `Items Subtotal $0.00` and a `Calculated Total` equal to the
                    shipping fee, which is a figure about this invoice that nobody
                    should act on.

                    THE SHAPE IS THE LISTS' OWN, one level down: `/invoices` renders
                    `LIST_EMPTY_COPY` INSTEAD of its table, never a sentence inside
                    one. The words are `lib/invoiceItemsMissing.js`'s, shared with the
                    refusal `updateInvoiceAction` gives, because the two say the same
                    thing about the same record.

                    `Invoice Total` ABOVE IS UNTOUCHED. It is the vendor's stated total,
                    the one figure here that is still true, and it is what makes this
                    state legible at all — a claim with nothing behind it. */}
                {invoiceItemsMissing(invoice) ? (
                    <p className="mt-2 text-sm text-zinc-600">{ITEMS_MISSING_COPY.absent}</p>
                ) : (
                <>
                <table className="mt-2 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">Item</th>
                            <th className="pr-2">Size</th>
                            <th className="pr-2">Maker</th>
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
                                    {/* #623 — `Price variance` and `Quantity variance`,
                                        one badge each, since the two are stored apart:
                                        the unit price against the order's, and what
                                        every invoice has charged against this ordered
                                        item against what it ordered. Each badge names
                                        its cause now, which the one `Order variance`
                                        flag #179 drew could not. What each was compared
                                        against is on the order's own page, beside the
                                        quantity and the price (#233).

                                        #648 — EACH ONE OPEN OR ACCEPTED, and an Admin may
                                        accept an open one with a reason beside it. A folded
                                        row's state and its `Accept` cover every member
                                        carrying that kind; the action writes only those
                                        still open. */}
                                    {ITEM_VARIANCE_KINDS.map((kind) => {
                                        const state = it[`${kind}Variance`];
                                        return state ? (
                                            <VarianceMark
                                                key={kind}
                                                kind={kind}
                                                state={state}
                                                invoiceId={invoice.invoiceId}
                                                itemRecordIds={it.rowIds}
                                                note={noteFor(kind, it.rowIds, state)}
                                                canAccept={user.isAdmin}
                                            />
                                        ) : null;
                                    })}
                                </td>
                                <td className="py-1 pr-2">{it.size}</td>
                                <td className="py-1 pr-2">{it.maker}</td>
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
                                    colSpan={6}
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
                {/* #179 — THE SAME LABEL THE LIST'S BADGE CARRIES, leading the
                    sentence that states the two figures. One kind, one word, on the
                    row a reader clicks and the page they land on.

                    #330 PUT IT INSIDE THE BRANCH ABOVE, so it goes with the totals it
                    is a reading of. This box compares the vendor's stated total
                    against what the items add up to; with no items there is nothing
                    they add up to, and the stored flag was computed when there were —
                    so it would print a red disagreement about the vendor's arithmetic
                    on a record whose own contents are missing. */}
                {/* #648 — GREEN ONCE AN ADMIN HAS ACCEPTED IT, with who, when and why under
                    it, and the same comparison after the accepted badge's words; red with an
                    `Accept` beside it for an Admin until then. */}
                {totalsState && (
                    <TotalsVariance
                        state={totalsState}
                        invoiceId={invoice.invoiceId}
                        openText={VARIANCE_COPY.totalsDetail(...totalsFigures)}
                        acceptedText={ACCEPTANCE_COPY.totalsDetail(...totalsFigures)}
                        note={noteFor("totals", [], totalsState)}
                        canAccept={user.isAdmin}
                    />
                )}
                </>
                )}
            </div>

            {/* Issue #166 — has what this invoice charges for been delivered, as the
                three-way match answers it since #640: through the ordered items this
                invoice and the deliveries both name, never through a delivery named on
                the invoice.

                THE HEADING CHIP IS THE ONE THE LIST SHOWS, from the same function and the
                same per-item figures, and the wait beside it is the one the list row and
                the strip above the list print (`describeInvoiceWait`) — so the row a
                reader clicked and the page they land on cannot describe the invoice
                differently. #162's summarizeDelivery is shared between its list and its
                detail for the same reason.

                THEN THE DELIVERIES, ONCE, AS THE ORDERED ITEMS' RATHER THAN THIS
                INVOICE'S: every delivery that brought one of these ordered items, oldest
                entered first. A delivery is not any one invoice's under the three-way
                match, so the section names them without claiming which of them answered
                this one — the table says how much did.

                THEN ONE ROW PER ITEM, EVERY ITEM. The ordered item's three totals — what
                was ordered, and what every delivery and every invoice on it add up to —
                then how much of THIS invoice's quantity the oldest-first fill answered.
                The heads say `to date` because those two totals are not this invoice's;
                `This invoice` is the column that is. A row still waiting wears amber on its
                name and its last cell, the tone the module decides; which amber is
                ENTRY_TONE_CLASS above.

                WHAT WENT WITH #640: `No delivery has been matched to this invoice yet.`,
                the amber `Delivery variance` box, and the per-item verdicts and
                `Against the ordered item:` aside. Each compared this invoice with the one
                delivery `Invoices."Delivery"` named, or stated a figure these columns now
                show; docs/notes/deliveries-and-invoices.md has the record. */}
            <div className="mt-8">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">Delivery</h2>
                    <StatusChip chip={describeInvoiceColumn(reconciliation.summary)} />
                    {wait && <span className="text-sm tabular-nums text-zinc-500">{wait.text}</span>}
                </div>

                {reconciliation.deliveries.length > 0 ? (
                    <p className="mt-1 text-sm text-zinc-600">
                        {STATUS_COPY.detail.deliveries.label}:{" "}
                        {reconciliation.deliveries.map((d, i) => (
                            <span key={d.id}>
                                {i > 0 && ", "}
                                <Link
                                    href={`/deliveries/${encodeURIComponent(d.deliveryId)}`}
                                    className="underline"
                                >
                                    {d.deliveryId}
                                </Link>
                            </span>
                        ))}
                    </p>
                ) : (
                    <p className="mt-1 text-sm text-zinc-600">
                        {STATUS_COPY.detail.deliveries.none().text}
                    </p>
                )}

                {deliveryEntries.length > 0 && (
                    <table className="mt-3 w-full text-sm">
                        <thead>
                            <tr className="text-left text-zinc-500">
                                <th className="pr-2">{STATUS_COPY.detail.heads.item}</th>
                                <th className="pr-2 text-right">{STATUS_COPY.detail.heads.ordered}</th>
                                <th className="pr-2 text-right">{STATUS_COPY.detail.heads.delivered}</th>
                                <th className="pr-2 text-right">{STATUS_COPY.detail.heads.invoiced}</th>
                                <th className="pr-2 text-right">{STATUS_COPY.detail.heads.thisInvoice}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveryEntries.map((entry) => (
                                /* KEYED ON THE FOLD'S OWN KEY (#241), which is what a row
                                   now is. An `Invoice Item ID` would have to pick one of
                                   the rows a folded entry stands for. */
                                <tr key={entry.key} className="border-t border-zinc-200">
                                    <td className={`py-1 pr-2 ${ENTRY_TONE_CLASS[entry.tone] ?? ""}`}>
                                        {itemLabel(entry) || "—"}
                                    </td>
                                    <td className="py-1 pr-2 text-right tabular-nums">{entry.copy.ordered}</td>
                                    <td className="py-1 pr-2 text-right tabular-nums">{entry.copy.delivered}</td>
                                    <td className="py-1 pr-2 text-right tabular-nums">{entry.copy.invoiced}</td>
                                    <td
                                        className={`py-1 pr-2 text-right tabular-nums ${
                                            ENTRY_TONE_CLASS[entry.copy.thisInvoice.tone] ?? ""
                                        }`}
                                    >
                                        {entry.copy.thisInvoice.text}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* HOISTED OUT OF THE PAYMENT SECTION BY #211, and it stays out (#309).
                The gate it had to outlive is gone, so the hoist is no longer load
                bearing for access — but the placement is still right, and for the
                reason it was made: this prompt is the only thing that raises an
                invoice-item variance to invoice level, and an item invoiced at other
                than what the order agreed is exactly what the employee reading this
                page is here to catch, which is not a payment fact. #211's own
                distinction survives its line: copy that MENTIONS payment never
                disclosed whether THIS vendor was paid.

                #179 NARROWED IT TO THE ITEM KIND AND REWORDED IT. It said
                `variance flags`, one word for two kinds, and fired on either — but
                the header kind already has a sentence on this page, in the red box
                under the totals, which states both figures and sat outside the
                Payment gate. Firing on both printed one fact twice on one screen.
                **That box being ungated is what #309 read back**: the list's badge
                for the same fact was behind the payment gate, so #179 was standing on
                an openness it did not extend to the mark pointing at it.
                And `review before confirming payment` named an action most of this
                prompt's readers cannot take, which is what #211 created and this
                issue's comment records; the action is now one anybody can take and
                payment is the deadline rather than the act — #232's grammar, in the
                amber box further up this same page. */}
            {hasItemVariance && (
                <p className="mt-8 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {VARIANCE_COPY.itemPrompt().text}
                </p>
            )}

            {/* UNGATED SINCE #309 — the whole section, heading included. #211 made it
                President-or-Admin and put the heading inside the gate deliberately,
                because a heading with nothing under it tells a reader a payment fact
                exists here and refuses to say it. That reasoning was sound and its
                subject is gone: there is nothing to withhold, so there is nothing for
                the heading to announce and hide.

                AND THE SECTION READS THE SAME FOR EVERY READER SINCE #318. #309 split
                reading from writing and this screen did not follow: the body branched
                on `user.isAdmin`, so an Admin got the form and everybody else got a
                sentence and neither saw what the other did. The fact and the control
                for it were alternatives — which is what forced #316 to place its own
                sentence outside that branch to reach both readers at all. The body is
                one thing now, and what an Admin has in addition is a control beside it.

                `canEdit` IS A PROP RATHER THAN A BRANCH HERE, AND THAT IS #185's PAIR
                RULE UNCHANGED. `updatePaidAction` is `withAdminAction`, so the screen
                condition is still `user.isAdmin`; what moved is where it is asked.
                `{user.isAdmin && <PaymentSection paidDate={…}/>}` would be a privilege
                branch carrying the payment fact on one side and nothing on the other,
                which is the shape `offline/invoice-visibility.mjs`'s third assertion
                reports — a false positive here, and structurally identical to the real
                defect, so the branch goes rather than the rule. See that file and
                `PaymentSection.js`'s own header.

                NOTHING HERE CLOSES THE CONTROL AFTER A SAVE, AND THAT WAS MEASURED
                RATHER THAN ASSUMED. This carried a `key` on the record's payment values
                first, on the reasoning that a save changes the props and a changed key
                remounts the section closed. It does close — and it closes with the key
                removed too, because `updatePaidAction` REDIRECTS, and a redirect from a
                Server Action replaces the segment rather than re-rendering it in place,
                so the Client Component remounts whatever its key says. Read in a browser
                both ways, including a save that changed nothing. The key went rather
                than stay with a comment explaining a property it did not have.

                ONE PROP CARRIES THE PAYMENT SINCE #318. It was `paid` and `paidDate`,
                a flag and a date that could disagree; the flag is gone from the base
                and the date is the whole of the fact, so the section is handed one
                value and cannot be told two things about one invoice.

                THE LATENESS SENTENCE IS RESOLVED HERE AND RENDERED THERE (#316). The
                copy lives in `lib/deliveryStatus.js` and nothing under `app/` holds a
                second copy of it, so the server picks the words and the Client
                Component renders the slot it was given — `/pos` hands `POListClient` a
                resolved chip for the same reason. */}
            <div className="mt-8">
                <h2 className="text-lg font-semibold">Payment</h2>
                <PaymentSection
                    invoiceId={invoice.invoiceId}
                    paidDate={invoice.paidDate}
                    overdue={describeInvoiceOverdue(invoicePayment(invoice, today)).sentence}
                    outstanding={{
                        variances: openVariances({
                            folded: foldedItems.map((it) => ({ ...it, label: itemLabel(it) || it.itemName })),
                            invoice,
                        }),
                        delivery:
                            reconciliation.summary?.key === "awaiting-delivery"
                                ? PAYMENT_CHECK_COPY.delivery(
                                      describeInvoiceColumn(reconciliation.summary).text,
                                      wait?.text
                                  )
                                : null,
                    }}
                    canEdit={user.isAdmin}
                />
            </div>

            {user.isAdmin && (
                <div className="mt-8 border-t border-zinc-200 pt-6">
                    <DeleteInvoiceButton invoiceId={invoice.invoiceId} />
                </div>
            )}
        </UndrawnPage>
    );
}
