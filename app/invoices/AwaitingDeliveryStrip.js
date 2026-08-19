import Link from "next/link";
import { AWAITING_DELIVERY_COPY } from "@/lib/deliveryStatus";

// Bills nobody has matched to a delivery, above the list of invoices (#256). The
// fourth strip built to the shape #176 set, and the second on this page; the
// selection rule, the two row kinds and the ordering are lib/deliveryStatus.js's,
// so this file is the rendering and nothing else.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING — #176's rule, restated by #216's issue
// body and by this one's. A standing all-clear above every list is a thing people
// learn to skip, and then it is not a signal on the day it changes.
//
// NOT A TABLE. A strip is not a column, so it re-cuts no column budget — the
// structural fact, which is all that transfers from #216's header on this point. The
// pixel figures there were that issue's constraint and the Design System milestone
// reopens them, so nothing here reasons from a width.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY IT SITS BELOW #216's STRIP AND ABOVE THE TABLE
//
// The two strips are the two ends of one situation: a delivery waiting for a bill,
// and a bill waiting for a delivery. Read down the page they are in the order the
// documents themselves occur — material arrives, then it is billed — so the layout
// says which end is which without either heading having to explain it. That is the
// reason, and it is stronger than the one considered first: this strip's rows also
// appear in the table directly below, which argues for adjacency and equally well
// against it, since a row rendered twice is a duplication rather than a relationship.
//
// The duplication is real and is the point. The table carries no wait and no
// ordering; the strip is the same rows read as a worklist, which is the only thing
// on this page that distinguishes an invoice filed this morning from one filed two
// months ago. It is the first strip in the app whose rows are a subset of the list
// below it — #176's and #217's report on rows that have no place in their tables at
// all — so the argument #166 used to take a duplicated tag off this very page does
// not reach it: that tag said the same thing twice in one frame, and this says a
// different thing about the same documents.
//
// NEITHER STRIP'S CONTENTS DEPEND ON THE OTHER'S. An unbilled delivery and an
// unmatched bill for the same material appear in both, once each, and suppressing
// either would make one strip's rule a function of the other's — a coupling nobody
// could reason about later, and the two admit different readers anyway: #216's rows
// are Job-scoped arrivals and these are invoices under #211's walk.
//
// THEY ARE TOLD APART WITHOUT COLOR. Each heading names its own subject and counts
// its own rows, and every row leads with a document id whose prefix differs —
// `HYE-DL-` against `HYE-INV-`. Nothing here relies on the two boxes looking
// different from one another.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT A ROW LEADS TO
//
// The Invoice ID, and nothing else. #216's three prefill measurements do not
// transfer — they are about creating an invoice from a delivery — and the inverse
// fails on a simpler point: prefilling a delivery form from a bill would guess a
// packing list's contents from an invoice, which inverts which of the two documents
// is the record of what arrived.
//
// No `Record delivery` link either. That is Job-scoped site work, and the office
// staff most likely to be reading this page are not assigned to the job, so the
// control would be addressed to readers who cannot use it — #216's rule about copy
// naming a control, one step further along.
//
// And no link to a delivery on a `delivered, not matched` row, although one exists
// by definition. There may be several, and naming one would be this app asserting a
// pairing it did not make; the invoice's own page is where the reader goes to see
// what it charges and against which orders.

export default function AwaitingDeliveryStrip({ rows }) {
    if (!rows || rows.length === 0) return null;

    return (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">{AWAITING_DELIVERY_COPY.heading(rows.length)}</h2>
            <p className="mt-1 text-sm text-zinc-700">{AWAITING_DELIVERY_COPY.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <li key={row.invoiceId} className="flex items-baseline gap-3 text-sm">
                        <Link
                            href={`/invoices/${row.invoiceId}`}
                            className="shrink-0 font-medium underline"
                        >
                            {row.invoiceId}
                        </Link>
                        {/* The date is the fact and the count is the reading of it —
                            the same pairing #216's row makes, and the same date this
                            page's own `Issue Date` column shows for the row, so a
                            reader can check the count against either. */}
                        <span className="shrink-0 tabular-nums text-zinc-600">
                            {row.waitingSince || "no date"}
                            {row.daysWaiting != null && ` · ${row.daysWaiting}d`}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-zinc-700">
                            {row.vendorName}
                            {" · "}
                            {AWAITING_DELIVERY_COPY.kind[row.kind]}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
