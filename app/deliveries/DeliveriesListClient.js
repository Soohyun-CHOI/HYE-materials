"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

// Issue #166 — the two filters, over rows the server already computed.
//
// SAME SHAPE AS PRListClient (#119): instant client-side narrowing, no Apply
// button, and the active filters mirrored into the URL with router.replace — no
// navigation, no history entry, no server round trip. The server reads those
// params back into the initial* props on a real load, so refresh, a shared link
// and the back button all restore the view.
//
// EVERY IMPORT HERE MUST BE CLIENT-SAFE. lib/deliveryStatus.js is pure and imports
// nothing, which is why the filter and sort rules can live there and be called
// from both sides; lib/deliveryReconciliation.js reaches lib/airtable/ and must
// never be imported here — an import executes the module and it throws
// `Missing AIRTABLE_API_KEY` in the browser (#162).
import { isNotFullyInvoiced, sortLongestWaitingFirst } from "@/lib/deliveryStatus";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";

// A `showInvoicing` prop and the `resolveDeliveryFilters` call that consumed it
// were both here until #211. The column was withheld from a viewer who may not see
// invoice data, so the filter had to be treated as absent for them; #211 released
// that, because this list is Job-scoped and every row on it is on a job whose
// invoices the viewer may now read. There is one column set again.
export default function DeliveriesListClient({ rows, initialUnbilled, initialOver }) {
    const router = useRouter();
    const pathname = usePathname();
    const [unbilled, setUnbilled] = useState(Boolean(initialUnbilled));
    const [over, setOver] = useState(Boolean(initialOver));
    const firstRun = useRef(true);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const p = new URLSearchParams();
        if (unbilled) p.set("unbilled", "1");
        if (over) p.set("over", "1");
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [unbilled, over, router, pathname]);

    const visible = useMemo(() => {
        let out = rows;
        if (over) out = out.filter((r) => r.hasOverDelivery);
        if (unbilled) {
            // BOTH INCOMPLETE STATES, not just the empty one — a delivery carrying
            // two materials with only one billed is exactly the case this worklist
            // is for. The rule is in lib/deliveryStatus.js so the offline tier can
            // pin it.
            out = out.filter((r) => isNotFullyInvoiced(r.invoicingKey));
            // THE ORDER IS PART OF THIS FILTER, not a separate control. It is the
            // vendor-chasing worklist, so the longest-waiting delivery belongs at
            // the top; the default list stays newest-first.
            out = sortLongestWaitingFirst(out);
        }
        return out;
    }, [rows, over, unbilled]);

    const cols = 6;

    return (
        <>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={unbilled}
                        onChange={(e) => setUnbilled(e.target.checked)}
                    />
                    Not fully invoiced · oldest first
                </label>
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} />
                    Over-delivered
                </label>
                {(unbilled || over) && (
                    <span className="text-zinc-500">
                        {visible.length} of {rows.length}
                    </span>
                )}
            </div>

            <div className="mt-4 overflow-x-auto">
                {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE PAGE
                    HAS: `max-w-4xl` is 56rem and `p-8` takes 4rem, leaving 832px.
                    #19's tables and the invoice list are 52rem for the same reason.

                    RE-BUDGETED AGAIN when the column became a chip. A chip is much
                    narrower than the sentence it replaced, so Invoiced gives room
                    back to Delivered — which is the column that needed it, since it
                    carries an item label, a `+N` count and an `Over-delivered` tag
                    on one line, and it was the only column wrapping at the previous
                    budget. Adding width rather than moving it is what #162's own
                    note records getting wrong: the sum is fixed at what the page
                    has, so every change is a re-budget.

                    Measured against this base's widest real cells — a 16-character
                    vendor, `165-DEMO Elbow 3" 3 PCS` beside an `Over-delivered`
                    tag (270px), `Awaiting invoice` (98px) — with an 8px gutter on
                    top of each, since this table has no cell padding of its own.

                    ONE BUDGET SINCE #211. There were two, because the Invoiced
                    column was withheld from site staff; releasing that leaves the
                    six-column row for everyone, which is the one every measurement
                    in this comment was taken against. */}
                <table className="w-full min-w-[52rem] table-fixed text-sm">
                    <colgroup>
                        <col style={{ width: "8.5rem" }} />
                        <col style={{ width: "8rem" }} />
                        <col style={{ width: "5.5rem" }} />
                        <col style={{ width: "17.5rem" }} />
                        <col style={{ width: "6.75rem" }} />
                        <col style={{ width: "5.75rem" }} />
                    </colgroup>
                    <thead>
                        <tr className="border-b border-zinc-200 text-left">
                            <th className="py-2 font-medium">Delivery</th>
                            <th className="py-2 font-medium">Vendor</th>
                            <th className="py-2 font-medium">Received</th>
                            <th className="py-2 font-medium">Delivered</th>
                            <th className="py-2 font-medium">Invoiced</th>
                            <th className="py-2 font-medium">Job</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.length === 0 ? (
                            <tr>
                                <td colSpan={cols} className="py-4 text-zinc-600">
                                    No delivery matches these filters.
                                </td>
                            </tr>
                        ) : (
                            visible.map((row) => (
                                <tr
                                    key={row.deliveryId}
                                    className="border-b border-zinc-100 last:border-0"
                                >
                                    <td className="py-2">
                                        <Link
                                            href={`/deliveries/${encodeURIComponent(row.deliveryId)}`}
                                            className="underline"
                                        >
                                            {row.deliveryId}
                                        </Link>
                                    </td>
                                    <td className="py-2">{row.vendorName}</td>
                                    <td className="py-2">{row.receivedDate || "—"}</td>
                                    <td className="py-2">
                                        {row.summary ? (
                                            <span className="flex flex-wrap items-center gap-1.5">
                                                <span>
                                                    {row.summary.first.label}{" "}
                                                    <span className="tabular-nums">
                                                        {row.summary.first.qty}
                                                    </span>
                                                    {row.summary.first.unit
                                                        ? ` ${row.summary.first.unit}`
                                                        : ""}
                                                </span>
                                                {/* A COUNT, not part of the item name — so it
                                                    carries its own chip. Reading "+2" as text
                                                    after the label makes it look like a size or
                                                    a grade on the item itself. */}
                                                {row.summary.extraCount > 0 && (
                                                    <span
                                                        title={`${row.summary.itemCount} items on this delivery`}
                                                        className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium tabular-nums text-zinc-700"
                                                    >
                                                        +{row.summary.extraCount}
                                                    </span>
                                                )}
                                                {/* KEPT HERE, unlike on the invoice list, and
                                                    the difference is whose fact it is. An
                                                    over-delivery is a fact about THIS delivery,
                                                    so it sits on the delivery's own row without
                                                    changing frame. On an invoice row it would be
                                                    a fact about the ordered item read as one
                                                    about the bill. */}
                                                {row.summary.hasOverDelivery && (
                                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                                                        Over-delivered
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500">—</span>
                                        )}
                                    </td>
                                    <td className="py-2">
                                        <StatusChip chip={row.invoicingChip} />
                                    </td>
                                    <td className="py-2">{row.jobCode}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
}
