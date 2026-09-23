"use client";

import Link from "next/link";
import { formatUSD } from "@/lib/format";
import {
    emptyStateKind,
    emptyStateText,
    showsFilterBar,
} from "@/lib/listFilters";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import { LIST_TABLE_CLASS } from "@/app/components/listTableWidth";
import ListFilterBar, { ListPageFoot, useListFilters } from "@/app/components/ListFilterBar";

// Instant client-side narrowing over the already-gated rows the server sent, in
// the shape #119 set for the PR list: no Apply button, and the active filters
// mirrored into the URL — no history entry and no remount — so refresh, a shared
// link and the back button restore the view. The mirror itself is `useListFilters`,
// which is the only place in the app that writes one.
//
// **THIS SAID "no navigation, no server round trip" UNTIL #325 AND IT WAS FALSE.** The
// mirror is a soft navigation and it fetches the page's payload again — measured, one
// request per write. It is debounced now; see `URL_MIRROR_DELAY_MS` in
// `app/components/ListFilterBar.js`, which is where that measurement lives.
//
// THE BAR IS SHARED SINCE #324. The dropdown used to be imported across from
// `app/prs/` — a component living under one screen and read by another — and the
// state, the URL sync, the predicate and every word were a copy of that list's. This
// list gained a vendor picker with the move and its three empty states moved out of
// `lib/poListView.js`, which had been the only list obeying that rule.
//
// These filters can only narrow within the visible set. The security boundary is
// the server's canViewPR pass; nothing here can widen it.
const ROUTE = "/pos";

export default function POListClient({ rows, options, initialFilters, initialPage, totalCount }) {
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
                <div className="mt-6 overflow-x-auto">
                    {/* WIDTHS ARE DECLARED, WHICH IS THE RULE #166 ESTABLISHED — an
                        auto-layout table sizes its columns from its own rows, so
                        every column shifts when one row's content changes. Only the
                        rule transfers: the invoice table's numbers came from its own
                        seven columns and mean nothing here.

                        MEASURED IN THE BROWSER, NOT COUNTED IN CHARACTERS, and the
                        first attempt is why. PO ID was sized at 9rem by counting 18
                        characters against the invoice list's 17-character ID — but a
                        PO ID carried a FOUR-DIGIT year then (the one exception to this
                        base's 2-digit convention), and `HYE-PO-20260805-02` rendered
                        at 141px, so 38 of 40 rows wrapped to two lines. Content
                        widths at 14px/20px Arial, plus the 8px `pr-2` every column
                        but the last carries: Job / Discipline 184, PO ID 149, Vendor 124,
                        Status 117, Total 79 — 653px of the 832px this page has
                        (`app/components/listTableWidth.js`).

                        THREE COLUMNS ARE BOUNDED BY CONSTRUCTION and take only what
                        they need plus a little: a PO ID is a fixed format, Status is
                        a closed set of three whose widest is `Awaiting Signature`,
                        and Total is a currency figure (104px still clears
                        `$999,999.00`).

                        THE SLACK USED TO GO TO THE TWO NOBODY CONTROLS — Vendor and
                        the Job / Discipline cell, both human-entered, the larger share
                        going to the one carrying two values and a separator. **#314
                        TOOK THE SECOND OF THOSE OUT OF THAT CLASS.** The column heads
                        `Job` and carries a job code, which is a house format of about
                        ten characters and bounded by construction like the PO ID
                        beside it — so it drops from 12.75rem to the 5.75rem
                        `/deliveries` already declares for the same value, and Vendor
                        is now the only column here whose content nobody controls.

                        NOTHING IS REDISTRIBUTED, WHICH IS THE SAME CALL #235 AND #311
                        MADE IN THE OTHER DIRECTION. Those two appended a column each
                        and left the budget alone; this one narrows a column and leaves
                        it alone again, because handing 7rem to a neighbor is the pixel
                        judgment those issues declined to make twice. The row is 58.25rem
                        against the page's 52 — it still scrolls inside its own
                        container, 7rem less far.

                        #169 RE-CUT THE BUDGET FOR A SIXTH COLUMN rather than
                        appending one, which is the other half of #166's rule. The
                        Delivery chip is a closed set whose widest value is
                        `Awaiting delivery`, measured at 102px at 12px/500 with the
                        chip's own 6px side padding; it sits LAST so it needs no
                        `pr-2`. The width came from Vendor (-44), Job / Discipline (-44),
                        Total (-14) and PO ID (-4), leaving every column clear of
                        its measured content: PO ID 7px spare, Vendor 24, Job /
                        Discipline 20, Total 11, Status 3, Delivery 4. Delivery was cut
                        to exactly its content first and given 4px back — a chip
                        flush with its column would overflow on any machine whose
                        font metrics differ by a pixel from the ones measured here.

                        THOSE CONTENT WIDTHS ARE DUMMY DATA, AND THE WHOLE RE-CUT
                        RESTS ON THEM. Vendor's 124px is `TESTQA Vendor A` and the Job /
                        Discipline cell's 184px was `26-DEMO-01 · Demo Line A`, both
                        from the 40
                        seeded rows on a base with no real orders on it. So the
                        spare listed above is two or three characters of a string
                        nobody has typed yet, not a margin measured against real
                        supplier names — and re-measuring is impossible until there
                        are some. If a real vendor list wraps these cells, Vendor is
                        where to give width back first. */}
                    <table className={LIST_TABLE_CLASS}>
                        <colgroup>
                            <col style={{ width: "9.75rem" }} />
                            <col style={{ width: "9.25rem" }} />
                            {/* #314 — the same 5.75rem `/deliveries` and `/invoices`
                                declare for a job code. */}
                            <col style={{ width: "5.75rem" }} />
                            <col style={{ width: "5.625rem" }} />
                            <col style={{ width: "8rem" }} />
                            <col style={{ width: "6.625rem" }} />
                            {/* #235 — A SEVENTH COLUMN, AND THE BUDGET IS NOT RE-CUT
                                TO MAKE ROOM. The six above summed to exactly 52rem,
                                the width this page has, so declaring the invoicing
                                chip its own column takes the row past that and a
                                narrow window wraps or scrolls. **THEY SUM TO 45rem
                                NOW AND THE CONCLUSION IS UNCHANGED:** #314 narrowed
                                the third column from 12.75rem to 5.75rem when it
                                became a job code, and left the 7rem where it fell
                                rather than handing it to a neighbor — so the six are
                                under the budget and the eight declared here are over
                                it, which is the state the paragraphs above and below
                                describe. That is left standing on
                                purpose: this table's hand-declared rem widths are
                                what the design pass will take out, and re-cutting
                                them now — or stacking two chips in one cell to avoid
                                it, which is what #179 did on `/invoices` — would be
                                a pixel judgment made twice, once here and again
                                after the design. What belongs on the screen is this
                                issue's decision; how wide it sits is that work's
                                input. Nothing is truncated: a cell that does not fit
                                wraps. */}
                            <col style={{ width: "6.625rem" }} />
                            {/* #311 — AN EIGHTH, AND THE BUDGET IS NOT RE-CUT FOR IT
                                EITHER, which is #235's call above applied a second
                                time rather than re-argued. The seven already summed
                                past the 52rem this page has; the table sits in an
                                `overflow-x-auto`, so what widens is the scroll inside
                                that container and nothing is truncated. **#314's
                                7rem TOOK THE SEVEN BACK UNDER IT** — 51.625rem — and
                                the eight are 58.25rem, so this column is what puts
                                the row past the page rather than the one before it.
                                The call is the same either way: what belongs on the
                                screen is the issue's decision and how wide it sits is
                                the design pass's. Same width as
                                its two siblings: the badge STACKS under the chip
                                rather than sitting beside it, so the cell needs the
                                wider of the two rather than their sum — `/invoices`'
                                shape for a badge under a payment word, and there for
                                a measured reason where here it is simply what keeps
                                the three chip columns one width. */}
                            <col style={{ width: "6.625rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="text-left text-zinc-500">
                                <th className="pr-2">PO ID</th>
                                <th className="pr-2">Vendor</th>
                                {/* #314 — `Job / Discipline` until this issue, one
                                    cell from two fields, both reached through the
                                    parent request. Every document list in the app
                                    heads `Job` and carries only a job now; an order's
                                    discipline is on the request behind it, one page
                                    along from this row. */}
                                <th className="pr-2">Job</th>
                                <th className="pr-2 text-right">Total</th>
                                <th className="pr-2">Status</th>
                                {/* Same header as /invoices carries for the same
                                    chip set — one word, two subjects, and the row
                                    supplies which. */}
                                <th className="pr-2">Delivery</th>
                                {/* #235 — the order's other axis, and a NOUN because
                                    `Delivery` beside it is one. The column shows a
                                    state rather than a document on both sides, so
                                    matching the part of speech is what makes the pair
                                    read as one row; `Invoicing` was a gerund next to a
                                    noun and said nothing extra for it.

                                    NOT `Invoiced`, WHICH IS THE DETAIL PAGE'S HEAD FOR
                                    A DIFFERENT THING. There it sits over a quantity,
                                    the ordered item's `Invoiced Qty`; here the column
                                    names the axis whose chip is in the cells. Two
                                    heads, two subjects — the pair `Delivery` here and
                                    `Delivered` there already draws. */}
                                <th className="pr-2">Invoice</th>
                                {/* #311 — a noun, like the two before it, and the
                                    third step of the chain the row already reads
                                    left to right: what was delivered, what was
                                    invoiced, what has been paid.

                                    `Payment` RATHER THAN `Paid`, because the head
                                    names the axis and the cell carries the state —
                                    the distinction `Invoice` / `Invoiced` already
                                    draws between this table and the order's own
                                    page. */}
                                <th>Payment</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filters.page.rows.map((row) => {
                                // A withdrawn order is terminal and stays on record
                                // (#138), so THE WHOLE ROW is dimmed rather than
                                // hidden — the same "dimmed = ended" language #122
                                // gives a withdrawn PR in its own list, and the same
                                // classes, so the two lists read alike. The PO ID
                                // link inherits the muted color and stays clickable.
                                //
                                // Awaiting Signature gets NO treatment at all: an
                                // unsigned purchase order is an ordinary state of
                                // one, not a problem to flag.
                                const isWithdrawn = row.status === "Withdrawn";
                                return (
                                    <tr
                                        key={row.id}
                                        className={
                                            "border-t border-zinc-200" +
                                            (isWithdrawn ? " text-zinc-400" : "")
                                        }
                                    >
                                        <td className="py-1 pr-2">
                                            <Link href={`/pos/${row.poId}`} className="underline">
                                                {row.poId}
                                            </Link>
                                        </td>
                                        <td className="py-1 pr-2">{row.vendorName}</td>
                                        <td className="py-1 pr-2">{row.jobCode || "—"}</td>
                                        <td className="py-1 pr-2 text-right">{formatUSD(row.total)}</td>
                                        <td className="py-1 pr-2">{row.statusText}</td>
                                        {/* The server resolved the chip (#169) —
                                            this component never sees a quantity,
                                            and the copy stays in one module. */}
                                        <td className="py-1 pr-2">
                                            <StatusChip chip={row.deliveryChip} />
                                        </td>
                                        <td className="py-1 pr-2">
                                            <StatusChip chip={row.invoicingChip} />
                                        </td>
                                        {/* #311 — BOTH SLOTS THE DESCRIBER RETURNED,
                                            and the badge is null on a chip it cannot
                                            compose with, so this renders what it was
                                            given rather than deciding when lateness
                                            applies. The red span is the one
                                            `⚠ Check the total` already wears at its
                                            three sites; it is not a chip and must not
                                            look like one, since a chip is a value
                                            from a closed set and this composes with
                                            any of them. */}
                                        <td className="py-1">
                                            <StatusChip chip={row.payment.chip} />
                                            {row.payment.overdue && (
                                                <span className="mt-0.5 block w-fit rounded bg-red-100 px-1 text-xs text-red-700">
                                                    {row.payment.overdue.text}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
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
