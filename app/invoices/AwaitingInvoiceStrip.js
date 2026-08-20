import Link from "next/link";
import { AWAITING_INVOICE_COPY } from "@/lib/deliveryStatus";

// Deliveries nobody has billed for, above the list of invoices (#216). The
// second of three strips built to the shape #176 set; the selection rule and the
// ordering are lib/deliveryStatus.js's and were already there, so this file is
// the rendering and nothing else.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING, which is how the screen says the
// state is normal — #176's rule, and #216's issue body states it independently.
// A standing all-clear above every list is a thing people learn to skip, and then
// it is not a signal on the day it changes.
//
// NOT A TABLE, AND OUTSIDE THE TABLE'S WIDTH BUDGET. The invoice table is
// `table-fixed` with a declared `colgroup` summing to exactly 52rem, and since
// #211 it carries TWO budgets — the last column is 11rem for a viewer who sees
// payment and 5rem for one who does not, with the 6rem going to Vendor. A strip
// is not a column, so it re-cuts neither. What it shares is the page's 832px.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY NO ROW LEADS TO THE INVOICE FORM, AND WHY NOTHING IS PREFILLED
//
// The obvious shape — a `Record invoice` link per row, or one that arrives at
// /invoices/new with this delivery's vendor and orders already chosen — is not
// here, and it is not an oversight. Three things, none of which anyone has
// looked at:
//
//   1. TWO SOURCES OF TRUTH WITH NO RULE BETWEEN THEM. #92's detect-po reads the
//      vendor and the purchase order off the uploaded invoice PDF, which is the
//      document being recorded. A prefill derived from the delivery is a second
//      answer to the same question, and nothing in this app says which wins when
//      they disagree.
//   2. THE FORM'S PO LIST IS THE OPEN ONES (#57). A delivery's order may be
//      closed, in which case a prefilled slot would name a purchase order absent
//      from the list the form offers, and `selectedPos` — which filters the
//      prefill against that list — would quietly drop it. Reaching a closed order
//      is the form's own "search closed POs" path, i.e. real form logic rather
//      than a parameter.
//   3. IT IS NOT ONE ORDER. Measured on this base: of the 13 deliveries waiting,
//      9 span one purchase order and 4 span two, because planDelivery matches
//      candidates per MATERIAL and one delivery can fill ordered items on two
//      orders. So a prefill is not "set the field", it is "seed N slots", which
//      is the detection path's whole complexity.
//
// AND NARROWING THE ITEM PICKER TO THIS DELIVERY WOULD BE WORSE THAN NOT
// PREFILLING. An invoice can legitimately bill for something the delivery did not
// bring — that is exactly the discrepancy #210's mismatch marker exists to catch —
// so a picker restricted to what was delivered would make the real case unenterable and
// the marker unreachable.
//
// So this strip is a list and nothing else: which deliveries are unbilled and how
// long they have waited, which is what replaces the month-end email. Recording an
// invoice is the `New invoice` button already at the top of this page; a second
// control going to the same place would be one fact rendered twice on one screen,
// which is the reason #166 took the `beyond order` tag off this list.
//
// The Delivery ID does link, to the delivery — the packing list photo is there
// and looking at it is a real per-row action rather than a duplicate of a control
// the page already has.

export default function AwaitingInvoiceStrip({ rows }) {
    if (!rows || rows.length === 0) return null;

    return (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">{AWAITING_INVOICE_COPY.heading(rows.length)}</h2>
            <p className="mt-1 text-sm text-zinc-700">{AWAITING_INVOICE_COPY.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <li key={row.deliveryId} className="flex items-baseline gap-3 text-sm">
                        <Link
                            href={`/deliveries/${row.deliveryId}`}
                            className="shrink-0 font-medium underline"
                        >
                            {row.deliveryId}
                        </Link>
                        {/* The date is the fact and the count is the reading of
                            it — see daysWaiting for the two properties that make
                            the count worth checking against the date. */}
                        <span className="shrink-0 tabular-nums text-zinc-600">
                            {row.receivedDate || "no date"}
                            {row.daysWaiting != null && ` · ${row.daysWaiting}d`}
                        </span>
                        {/* What was delivered, in the shape /deliveries already uses
                            for the same summary — first item, then a `+N` for the
                            rest — so a reader who knows one list reads the other.
                            The summary object is `summarizeDelivery`'s; nothing
                            here re-derives the label. */}
                        <span className="min-w-0 flex-1 truncate text-zinc-700">
                            {row.vendorName}
                            {row.summary && (
                                <>
                                    {" · "}
                                    {row.summary.first.label} {row.summary.first.qty}
                                    {row.summary.first.unit ? ` ${row.summary.first.unit}` : ""}
                                    {row.summary.extraCount > 0 && ` +${row.summary.extraCount}`}
                                </>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
