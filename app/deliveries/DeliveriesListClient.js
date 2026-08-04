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
// nothing, which is why the sort rule can live there and be called from both
// sides; lib/deliveryReconciliation.js reaches lib/airtable/ and must never be
// imported here — an import executes the module and it throws
// `Missing AIRTABLE_API_KEY` in the browser (#162).
import { sortLongestWaitingFirst } from "@/lib/deliveryStatus";

export default function DeliveriesListClient({
    rows,
    showInvoicing,
    initialUninvoiced,
    initialOver,
}) {
    const router = useRouter();
    const pathname = usePathname();
    // `showInvoicing` is false for a viewer who may not see invoice data, and the
    // server did not even fetch it for them — so the uninvoiced filter has no
    // state to hold rather than a state that is ignored.
    const [uninvoiced, setUninvoiced] = useState(showInvoicing ? initialUninvoiced : false);
    const [over, setOver] = useState(initialOver);
    const firstRun = useRef(true);

    useEffect(() => {
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const p = new URLSearchParams();
        if (uninvoiced) p.set("uninvoiced", "1");
        if (over) p.set("over", "1");
        const qs = p.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [uninvoiced, over, router, pathname]);

    const visible = useMemo(() => {
        let out = rows;
        if (over) out = out.filter((r) => r.hasOverDelivery);
        if (uninvoiced && showInvoicing) {
            out = out.filter((r) => r.invoicingKey === "none-invoiced");
            // THE ORDER IS PART OF THIS FILTER, not a separate control. It is the
            // vendor-chasing worklist, so the longest-waiting arrival belongs at
            // the top; the default list stays newest-first. The rule is in
            // lib/deliveryStatus.js so the offline tier can pin it.
            out = sortLongestWaitingFirst(out);
        }
        return out;
    }, [rows, over, uninvoiced, showInvoicing]);

    const cols = showInvoicing ? 6 : 5;

    return (
        <>
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                {showInvoicing && (
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={uninvoiced}
                            onChange={(e) => setUninvoiced(e.target.checked)}
                        />
                        No invoice yet, longest waiting first
                    </label>
                )}
                <label className="flex items-center gap-2">
                    <input type="checkbox" checked={over} onChange={(e) => setOver(e.target.checked)} />
                    Over-delivery only
                </label>
                {(uninvoiced || over) && (
                    <span className="text-zinc-500">
                        {visible.length} of {rows.length}
                    </span>
                )}
            </div>

            <div className="mt-4 overflow-x-auto">
                {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE PAGE
                    HAS: `max-w-4xl` is 56rem and `p-8` takes 4rem, leaving 832px.
                    #19's tables are 52rem for the same reason.

                    #166 RE-BUDGETED rather than appended. The five-column shape
                    keeps its measured widths exactly; the six-column one takes the
                    new column's 7.5rem out of Delivery, Vendor, Received and What
                    arrived, all of which had slack. 7.5rem holds "No invoice yet"
                    and "1 of 2 invoiced" on one line, which is what the column copy
                    was shortened for — see lib/deliveryStatus.js on the density
                    pairing. Appending a sixth column would have overflowed by
                    7.5rem and put a scrollbar on every desktop render, which is the
                    mistake #162's own note records making. */}
                <table className="w-full min-w-[52rem] table-fixed text-sm">
                    <colgroup>
                        {showInvoicing ? (
                            <>
                                <col style={{ width: "8.5rem" }} />
                                <col style={{ width: "10rem" }} />
                                <col style={{ width: "6rem" }} />
                                <col style={{ width: "13.5rem" }} />
                                <col style={{ width: "7.5rem" }} />
                                <col style={{ width: "6.5rem" }} />
                            </>
                        ) : (
                            <>
                                <col style={{ width: "9rem" }} />
                                <col style={{ width: "11rem" }} />
                                <col style={{ width: "6.5rem" }} />
                                <col style={{ width: "19rem" }} />
                                <col style={{ width: "6.5rem" }} />
                            </>
                        )}
                    </colgroup>
                    <thead>
                        <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                            <th className="py-2 font-medium">Delivery</th>
                            <th className="py-2 font-medium">Vendor</th>
                            <th className="py-2 font-medium">Received</th>
                            <th className="py-2 font-medium">What arrived</th>
                            {showInvoicing && <th className="py-2 font-medium">Invoiced</th>}
                            <th className="py-2 font-medium">Job</th>
                        </tr>
                    </thead>
                    <tbody>
                        {visible.length === 0 ? (
                            <tr>
                                <td colSpan={cols} className="py-4 text-zinc-600 dark:text-zinc-400">
                                    No delivery matches these filters.
                                </td>
                            </tr>
                        ) : (
                            visible.map((row) => (
                                <tr
                                    key={row.deliveryId}
                                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
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
                                                        className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium tabular-nums text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                                                    >
                                                        +{row.summary.extraCount}
                                                    </span>
                                                )}
                                                {row.summary.hasOverDelivery && (
                                                    <span className="whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                        over-delivery
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-500">—</span>
                                        )}
                                    </td>
                                    {showInvoicing && (
                                        <td className="py-2">
                                            <span
                                                className={
                                                    row.invoicingKey === "none-invoiced"
                                                        ? "text-amber-700 dark:text-amber-500"
                                                        : "text-zinc-600 dark:text-zinc-400"
                                                }
                                            >
                                                {row.invoicingText}
                                            </span>
                                        </td>
                                    )}
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
