import Link from "next/link";
import { AWAITING_SEND_COPY } from "@/lib/poListView";

// Signed orders nobody has sent to the vendor, above the list of orders (#295). The
// fourth strip built to the shape #176 set, and the second on this page; the selection
// rule, the ordering and both sentences are lib/poListView.js's, so this file is the
// rendering and nothing else.
//
// A SERVER COMPONENT, UNLIKE THE STRIP ABOVE IT. `AwaitingPOStrip` is `"use client"`
// because it carries a form and `useActionState`; this one carries no control at all
// (see AWAITING_SEND_COPY for why), so nothing here needs the client — the same shape
// `app/invoices/AwaitingInvoiceStrip.js` has for the same reason.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING — #176's rule, kept by all four strips. A
// standing all-clear above a list is a thing people learn to skip, and then it is not
// a signal on the day it changes.
//
// TWO STRIPS CAN STAND HERE AT ONCE AND THIS ONE IS SECOND, in the order the document
// chain runs: a request that never became an order comes before an order that never
// reached its vendor. Each disappears on its own count, so a reader meets one, both or
// neither.
//
// NOT A TABLE, AND OUTSIDE THE TABLE'S WIDTH BUDGET. The list below is `table-fixed`
// with a declared `colgroup` summing to exactly 52rem and no slack; a strip is not a
// column, so it re-cuts nothing. What it shares is the page's 832px, which is why each
// row is one line and the wide cell truncates.

export default function AwaitingSendStrip({ rows }) {
    if (!rows || rows.length === 0) return null;

    return (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">{AWAITING_SEND_COPY.heading(rows.length)}</h2>
            <p className="mt-1 text-sm text-zinc-700">{AWAITING_SEND_COPY.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <li key={row.poId} className="flex items-baseline gap-3 text-sm">
                        {/* To the order, where the send lives — the address, the
                            control and the document are all on that page. */}
                        <Link
                            href={`/pos/${encodeURIComponent(row.poId)}`}
                            className="shrink-0 font-medium underline"
                        >
                            {row.poId}
                        </Link>
                        {/* The date is the fact and the count is the reading of it —
                            see daysWaiting for the two properties that make the count
                            worth checking against the date. The date is the calendar
                            day of `President Signed At`, whose instant is on the
                            order's own page. */}
                        <span className="shrink-0 tabular-nums text-zinc-600">
                            {row.signedDate || "no date"}
                            {row.daysWaiting != null && ` · ${row.daysWaiting}d`}
                        </span>
                        {/* Job and the vendor, the same values the list's own columns
                            carry, so a reader locating work reads one shape above the
                            table and in it. It carried a Discipline until #314, as the
                            strip above it did and for the same reason. */}
                        <span className="min-w-0 flex-1 truncate text-zinc-700">
                            {row.jobCode || "—"}
                            {" · "}
                            {row.vendorName || "—"}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
