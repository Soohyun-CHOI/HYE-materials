"use client";

import Link from "next/link";

// Issue #166 — the filter, over rows the server already computed.
//
// SAME SHAPE AS THE OTHER THREE LISTS (#119, shared in #324): instant client-side
// narrowing, no Apply button, and the active filters mirrored into the URL — no
// history entry and no remount. The server reads those params back on a real load, so
// refresh, a shared link and the back button all restore the view. The mirror itself
// is `useListFilters`, which is the one place that writes one.
//
// **THIS SAID "no navigation, no server round trip" UNTIL #325 AND IT WAS FALSE.** The
// mirror is a soft navigation and it fetches the page's payload again — measured, one
// request per write. It is debounced now; see `URL_MIRROR_DELAY_MS` in
// `app/components/ListFilterBar.js`, which is where that measurement lives.
//
// EVERY IMPORT HERE MUST BE CLIENT-SAFE. lib/deliveryStatus.js and lib/listFilters.js
// are pure; lib/deliveryReconciliation.js reaches lib/airtable/ and must never be
// imported here — an import executes the module and it throws
// `Missing AIRTABLE_API_KEY` in the browser (#162).
import {
    emptyStateKind,
    emptyStateText,
    showsFilterBar,
} from "@/lib/listFilters";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import { LIST_TABLE_CLASS } from "@/app/components/listTableWidth";
import ListFilterBar, { ListPageFoot, useListFilters } from "@/app/components/ListFilterBar";

// A `showInvoicing` prop and the `resolveDeliveryFilters` call that consumed it
// were both here until #211. The column was withheld from a viewer who may not see
// invoice data, so the filter had to be treated as absent for them; #211 released
// that, because this list is Job-scoped and every row on it is on a job whose
// invoices the viewer may now read. There is one column set again.
//
// `Not fully invoiced · oldest first` WAS THE SECOND FILTER AND IS GONE (#216).
// It was the vendor-chasing worklist wearing a checkbox on a page whose other job
// is a chronological log, and the two pull opposite ways: a log is newest-first
// and its empty state means nothing delivered, a chasing list is oldest-first and
// its empty state means there is nothing left to do. It is a strip above
// /invoices now, where the outcome — an invoice being recorded — actually
// happens. `isNotFullyInvoiced` and `sortLongestWaitingFirst` did not move with
// it: they stay in lib/deliveryStatus.js and the strip calls them, so the rule
// has one implementation and this file simply stopped being one of its callers.
//
// **#324 IS WHAT GENERALIZED THAT REASONING AND THIS LIST GAINED THREE AXES BY IT.**
// `Over-delivered` survives because it is a state rather than a wait — a stored
// checkbox on the delivery's OWN item rows (#181), which does not end and whose
// absence is not "done"; the wait it creates is #217's strip on `/prs`. The job
// picker, the vendor picker and `Recorded by me` are the subject axes every document
// list carries, and this one had none of them.
const ROUTE = "/deliveries";

export default function DeliveriesListClient({ rows, options, initialFilters, initialPage, totalCount }) {
    // #326 — the narrowing and the slice both come back from the hook now. The cut is
    // here rather than on the server because the bar narrows in the browser, so nothing
    // upstream knows how many rows survive; and the read stays whole because a page of
    // records is not a page of rows a reader sees.
    const filters = useListFilters({ route: ROUTE, initial: initialFilters, initialPage, rows });
    const shown = filters.shown;
    const empty = shown.length
        ? null
        : emptyStateKind({ totalCount, visibleCount: rows.length, filtersActive: filters.active });

    return (
        <>
            {/* The rows BEFORE any filter, never the rows after — see
                `showsFilterBar` for what keying it off `shown` would cost. */}
            {showsFilterBar({ visibleCount: rows.length }) && (
                <ListFilterBar
                    filters={filters}
                    options={options}
                    shown={shown.length}
                    total={rows.length}
                />
            )}

            {empty ? (
                <p className="mt-6 text-sm text-zinc-600">{emptyStateText(ROUTE, empty, filters.state)}</p>
            ) : (
                <div className="mt-4 overflow-x-auto">
                    {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE PAGE
                        HAS — see `app/components/listTableWidth.js` for where that
                        figure comes from. #19's tables and the invoice list are held to
                        the same one.

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
                    <table className={LIST_TABLE_CLASS}>
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
                            {filters.page.rows.map((row) => (
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
                                                    about the invoice. */}
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
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {/* #326 — below the table and outside the empty branch: there is nothing to
                count and no page to be on when the list is empty. */}
            {!empty && <ListPageFoot filters={filters} />}
        </>
    );
}
