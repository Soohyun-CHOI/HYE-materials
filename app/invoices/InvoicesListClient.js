"use client";

import Link from "next/link";
import { formatUSD } from "@/lib/format";
import {
    LIST_EMPTY_COPY,
    applyFilters,
    emptyStateKind,
    showsFilterBar,
} from "@/lib/listFilters";
import { StatusChip } from "@/app/components/DeliveryStatusMarks";
import { LIST_TABLE_CLASS } from "@/app/components/listTableWidth";
import ListFilterBar, { useListFilters } from "@/app/components/ListFilterBar";

// The invoice list's table, and the first filter bar it has ever carried (#324).
//
// THIS LIST HAD NO CLIENT COMPONENT AT ALL. The table was rendered inside
// `app/invoices/page.js`, which is what made it the one document list with no
// filters — there was nowhere for a narrowing to live. The rows are pre-shaped on the
// server exactly as `/pos`'s are, so every judgment on this screen still runs there:
// the chip, the payment word and the overdue badge all arrive resolved and this file
// never sees a quantity, a date comparison or `today`. That is #316's rule kept
// rather than re-argued — no screen showing an invoice compares `Due Date` to today,
// because `invoicePayment` hands back the verdict and its day count from one
// expression.
//
// EVERY IMPORT HERE IS PURE. `lib/deliveryStatus.js` is not imported at all now: the
// server calls it. `lib/listFilters.js` imports nothing.
const ROUTE = "/invoices";

export default function InvoicesListClient({ rows, options, initialFilters, totalCount }) {
    const filters = useListFilters({ route: ROUTE, initial: initialFilters });
    const shown = applyFilters(ROUTE, filters.state, rows);
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
                <p className="mt-6 text-sm text-zinc-600">{LIST_EMPTY_COPY[ROUTE][empty]}</p>
            ) : (
                <div className="mt-6 overflow-x-auto">
                    {/* THE DECLARED COLUMNS SUM TO EXACTLY 52rem, WHICH IS WHAT THE
                        PAGE HAS — see `app/components/listTableWidth.js` for where
                        that figure comes from. #19's tables and the deliveries list
                        are held to the same one.

                        #166 gave this table a colgroup it did not have. An auto-layout
                        table sizes its columns from its own rows, so the Delivery
                        column was as wide as the longest phrase in it and every other
                        column moved when one invoice's status changed. With chips the
                        content is a closed set, so the widths can be declared from the
                        widest chip rather than discovered per page load.

                        MEASURED, NOT GUESSED, and this table has almost no slack:
                        eight columns need 832px against the 832px the page has. Seven of
                        the eight are bounded by construction and cannot grow — an
                        Invoice ID is a fixed format (128px), a date is 10 characters
                        (72px), the Delivery column is a closed set of TWO chips plus a
                        marker since #210 and its widest is `Awaiting delivery` (102px,
                        unchanged: the state that left was not the widest one), Amount
                        Due is bound by its own header (84px), a Job is a house format
                        of about ten characters (#314 added the column and it is bounded
                        exactly as the Invoice ID is), and Status by the payment word
                        above its badge (106px, and the reason the last column drops its
                        right padding).
                        So VENDOR IS WHERE THE SLACK ISN'T: 8rem is 33px short of the
                        longest name on this base, and it is
                        also the one column where wrapping is least harmful.

                        THREE OF THOSE FIGURES WERE STALE AND #314 RE-MEASURED THEM
                        (#181). The date was 80px and is 72; `Awaiting delivery` was 120px
                        and is 102; Amount Due's own header was 78px and is 84. And the
                        Vendor sentence said 8rem held the longest name "at 16 characters
                        with nothing to spare" — see the re-measured table below for what
                        it actually holds and what has been wrapping since. The paragraph
                        is corrected rather than deleted because its ARGUMENT is unchanged
                        and is the one this table is still budgeted by.

                        A FOURTH WAS STALE AND IS THE COUNT ITSELF (#183). #314 added the
                        Job column, so the paragraph above said seven where the colgroup
                        declares eight, and it named Status at its pre-#314 176px where
                        the re-cut left it at 106. The budget did not move: this table
                        re-cuts rather than appending, so the eight still sum to exactly
                        52rem. The heading below is #309's own and keeps its seven.

                        SEVEN COLUMNS FOR EVERY READER AGAIN, AND ONE BUDGET (#309). #179
                        gave this table a second budget by taking the last column away
                        from an employee: it held payment, which was President-or-Admin,
                        and the HEADER variance badge, which #211 had kept for every
                        viewer on the mistaken ground that it was the
                        invoiced-against-ordered kind. Payment is now readable by anyone
                        who reaches the row, so the column comes back — and the badge
                        comes back with it, because the fact it marks is already ungated
                        one click away, stated with both figures in the red box on the
                        invoice's own page. #179 relied on that box being outside the
                        payment gate when it narrowed the amber prompt; a mark on the row
                        a reader clicks and no mark on the page they land on was the
                        inconsistency, not the fix.

                        SO THE 11rem COMES BACK OFF VENDOR, which returns to 8rem — the
                        width every measurement in this comment was taken against, and
                        the width the office row has always had. The 19rem an employee
                        read was #211's redistribution of a column that no longer leaves.
                        One row, summing to exactly 52rem; a column is never appended and
                        the budget is re-cut (#166).

                        THE 176px WAS SIZED FOR A DATE THIS COLUMN NO LONGER PRINTS.
                        #309 took the date off the badge — `Paid 2026-08-14` is `Paid` —
                        so the widest thing in the cell is now `⚠ Check the total` at
                        102px rather than the 104px payment word it used to stack under.
                        It was not re-cut there, on the ground that a width is the design
                        work's to decide and a visibility change is not the place to spend
                        slack it happens to create — so the 74px was recorded and left.

                        EIGHT COLUMNS SINCE #314, AND THE 74px IS WHAT PAYS FOR MOST OF THE
                        NEW ONE. `Job` is 5.75rem, which is the width `/deliveries` already
                        declares for a job code — one fact, one way, down to the column it
                        sits in. The budget is RE-CUT rather than appended to, which is this
                        table's own standing rule (#166) and the point on which it diverges
                        from `/pos`: that list let its seventh and eighth columns push it
                        past the page and scroll, because its widths are a pixel judgment
                        the design pass will redo. This table sums to the page and has done
                        since #166, and a table that both scrolls and declares to the page
                        width states two intentions.

                        **#324 ADDED NO COLUMN AND TOOK NONE**, so every figure above still
                        holds. What it added is the bar over the table, which has a width
                        of its own and takes none from here.

                        RE-MEASURED IN A BROWSER, AND EVERY FIGURE ABOVE THIS LINE IS A
                        CONTENT WIDTH THAT DOES NOT COUNT THE 8px `pr-2`. That is what made
                        the first cut of this column wrong: an Invoice ID needs 128px and
                        the column was declared at 8.5rem, so it had not 8px spare but ZERO,
                        and taking 4px wrapped 23 rows. What a column needs is
                        `max(content, its own header) + 8`, and the last column's `+ 0`.
                        Measured at 14px/20px Arial on this base, requirement against what
                        was declared before #314:

                          Invoice ID    136  = 128 + 8      declared 136   flush
                          Vendor        161  = 153 + 8      declared 128   short by 33
                          Job            91  =  83 + 8      declared   —
                          Issue Date     80  =  72 + 8      declared 88     8 spare
                          Due Date       80  =  72 + 8      declared 88     8 spare
                          Amount Due     92  =  84 + 8      declared 88    short by 4
                          Delivery      110  = 102 + 8      declared 128   18 spare
                          Status        102  = 102 + 0      declared 176   74 spare

                        TWO OF THOSE ROWS ARE PRE-EXISTING AND WERE CORRECTED THERE RATHER
                        THAN INHERITED (#181). This comment said 8rem holds Vendor's longest
                        name "at 16 characters with nothing to spare" — the base's longest
                        is `Lone Star Pipe & Supply` at 23, which needs 161px, so that
                        column has been wrapping to two lines on every row since the vendor
                        was seeded and the figure was stale rather than tight. And Amount
                        Due is bound by its own HEADER at 84px, not the 78px recorded, so
                        its 88rem was 4px short of the word above the figures. Neither is
                        made worse here and neither is fixed here: Vendor keeps 8rem, which
                        is what every other measurement was taken against, and giving it the
                        161px it wants is a re-cut this page cannot afford and the design
                        pass can.

                        SO THE 92px COMES FROM THE TWO COLUMNS THAT REALLY HAD IT, and each
                        keeps 4px on top of its requirement — #169's rule for a chip, which
                        is what both of these hold: Status −70 (176 to 106, against 102),
                        Delivery −14 (128 to 114, against 110). The last 8px come from the
                        two dates, −4 each (88 to 84, against 80), which had 8 apiece. Job
                        lands at 5.75rem, the width `/deliveries` already declares for the
                        same value, and clears its 91px by 1.

                        THE CONTENT FIGURES ARE THIS BASE'S SEEDED ROWS, and `/pos`'s own
                        comment records what that is worth: a two-or-three-character margin
                        on a human-entered column is a fact about seed strings. `Job` is not
                        human-entered free text — a job code is `26-DEMO-01`, ten characters
                        of a house format — so it is the one new column whose width is
                        bounded by construction, and its 1px is a real margin where Vendor's
                        would not have been. Vendor is still where to give width back
                        first. */}
                    <table className={LIST_TABLE_CLASS}>
                        <colgroup>
                            <col style={{ width: "8.5rem" }} />
                            <col style={{ width: "8rem" }} />
                            {/* #314 — the same 5.75rem `/deliveries` declares. */}
                            <col style={{ width: "5.75rem" }} />
                            <col style={{ width: "5.25rem" }} />
                            <col style={{ width: "5.25rem" }} />
                            <col style={{ width: "5.5rem" }} />
                            <col style={{ width: "7.125rem" }} />
                            <col style={{ width: "6.625rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="text-left text-zinc-500">
                                <th className="pr-2">Invoice ID</th>
                                <th className="pr-2">Vendor</th>
                                {/* #314 — THE FOURTH DOCUMENT LIST TO CARRY IT, and the
                                    first to have had nothing. `/prs` and `/pos` headed a
                                    column `Job / Discipline`, `/deliveries` headed `Job`,
                                    and this list headed neither — so the office, which
                                    #211 gave every invoice on the base, read it with no
                                    way to tell which site the material was for. One word
                                    on all four now, and a discipline is on the request
                                    that holds one.

                                    AFTER `Vendor`, which is where the other two put it.
                                    The position is the design pass's to move like every
                                    other placement; what that issue settled is that the
                                    column is here and what it says. */}
                                <th className="pr-2">Job</th>
                                <th className="pr-2">Issue Date</th>
                                <th className="pr-2">Due Date</th>
                                <th className="pr-2 text-right">Amount Due</th>
                                <th className="pr-2">Delivery</th>
                                {/* UNGATED SINCE #309, and `Status` heads its own subject
                                    again: the payment word, which every reader of the row
                                    now gets. #179 took the heading away with the column
                                    because a `Status` over a variance badge alone heads a
                                    column whose subject is missing — that reasoning was
                                    right about the state it described and the state is
                                    gone.

                                    #324 FILTERS THIS COLUMN AND NAMES ITS CONTROL AFTER
                                    IT. The bar's select reads `Status` because that is
                                    what this column is called; what it offers is the two
                                    payment words, which are the column's own verdict. */}
                                <th className="pr-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((row) => (
                                <tr key={row.id} className="border-t border-zinc-200">
                                    <td className="py-1 pr-2">
                                        <Link href={`/invoices/${row.invoiceId}`} className="underline">
                                            {row.invoiceId}
                                        </Link>
                                    </td>
                                    <td className="py-1 pr-2">{row.vendorName}</td>
                                    {/* #314 — the SERVER resolved which job, through the
                                        walk that gated this row; the cell renders a code.
                                        The em dash is the same one the other three lists
                                        render for a row with no job, and here it also
                                        covers the judgment declining to name one — see
                                        lib/invoiceJob.js, which never picks. */}
                                    <td className="py-1 pr-2">{row.jobCode || "—"}</td>
                                    <td className="py-1 pr-2">{row.issueDate || "—"}</td>
                                    <td className="py-1 pr-2">{row.dueDate || "—"}</td>
                                    <td className="py-1 pr-2 text-right">{formatUSD(row.amountDue)}</td>
                                    {/* Issue #166 — a FACT, never a verdict: "more invoiced
                                        than delivered" and not "over-billed", because at
                                        any one moment the two are the same measurement.

                                        TWO CHIPS AND A MISMATCH MARKER SINCE #210. The
                                        chip is the link's own two states — the delivery
                                        is named or it is not — and a quantity shortfall
                                        is the marker beside it, which is #166's
                                        marker-vs-chip shape inherited rather than
                                        re-argued. `Partly delivered` left this column
                                        with the inference that produced it: the old fill
                                        put an invoice whose own delivery had not delivered
                                        into that state routinely.

                                        STILL NO EXCEPTION TAGS. The two beyond-the-order
                                        tags this column used to carry both left it, for
                                        different reasons. `beyond order` (invoiced >
                                        ordered) is one of the two things
                                        `Invoice Items.Variance Flag` is set for, and the
                                        invoice detail marks it per item —
                                        `⚠ Order variance` since #179 — so a tag here
                                        would be one fact on two screens. `over-delivery`
                                        (delivered > ordered) is not a fact about THIS
                                        invoice at all but about the ordered item, and
                                        inside a column headed `Delivery` it reads as
                                        "more delivered than this invoice covers", which is a
                                        different and wrong claim. Both facts are on the
                                        invoice detail, under the ordered item they
                                        belong to.

                                        THE CHIP ALONE SINCE #232 — a `!` marker stood
                                        beside it and is retired. The discrepancy is a
                                        third chip value now, so the cell says `Mismatch`
                                        in words; the marker would have qualified a word
                                        the reader had already read, with a sentence only
                                        a hover could reach. Still one function, shared
                                        with the detail, so this cell and that page cannot
                                        describe one invoice differently — and the server
                                        is what calls it (#324), so this file holds no
                                        judgment of its own. */}
                                    <td className="py-1 pr-2">
                                        {row.deliveryChip ? (
                                            <StatusChip chip={row.deliveryChip} />
                                        ) : (
                                            <span className="text-zinc-500">—</span>
                                        )}
                                    </td>
                                    {/* NO RIGHT PADDING ON THE LAST COLUMN — there is
                                        nothing to its right to separate it from, and this
                                        table's budget is tight enough that those 8px used
                                        to be the difference between the payment word and
                                        its badge fitting on one line and wrapping. They
                                        stack since #179 (see below), so the 8px buys
                                        room the column no longer needs — kept because the
                                        reason it was dropped is unchanged: there is still
                                        nothing to its right.

                                        NEITHER HALF OF THIS CELL IS GATED (#309). Payment
                                        was President-or-Admin (#211) and #179 sent the
                                        HEADER variance badge behind the same flag, on the
                                        ground that an arithmetic check on one document is
                                        the office's to make and the office's to fix. Both
                                        are open now, and the badge's reason went with
                                        payment's for a reason of its own: the fact it
                                        marks is stated ungated on the invoice's own page,
                                        in the red box under the totals, with both figures
                                        — which is what #179 itself relied on when it
                                        narrowed the amber prompt. A mark on the row a
                                        reader clicks and no mark on the page they land on
                                        is the state that hid a figure on one screen and
                                        showed it on another.

                                        THE ITEM KIND STILL HAS NO MARK IN THIS LIST, and
                                        that is #179's and unchanged: an item differing
                                        from what its order agreed is on the invoice's own
                                        page, per item, where the order it disagrees with
                                        is one click away.

                                        THE BADGE STACKS UNDER THE PAYMENT WORD rather than
                                        sitting beside it. That was measured when the word
                                        was `Paid 2026-07-27` at 104px against a 176px
                                        column, with `⚠ Check the total` at 102px, so the
                                        pair needed 210px on one line. #309 took the date
                                        off, so `Paid` is far narrower and the pair would
                                        now fit — the stack is KEPT because the column's
                                        width is the design work's to re-cut and a
                                        visibility change is not the place to spend slack
                                        it happens to create.

                                        THREE THINGS SINCE #316, AND THE COLUMN STILL FITS
                                        WITHOUT A RE-CUT. Measured in a browser at 832px:
                                        the column is 106px with no right padding,
                                        `⚠ Overdue · 10d` is 98px and `· 1d` is 92px,
                                        against `⚠ Check the total` at 102px — so the new
                                        badge is NARROWER than the widest thing the cell
                                        already held and nothing was taken from another
                                        column. The bound is the digit count: each one is
                                        about 7px, so a three-digit count lands at ~105px
                                        and a four-digit one would not fit. That is an
                                        invoice 2.7 years past its due date, which is a
                                        bound worth writing down rather than a risk worth
                                        spending width on.

                                        AND IT COSTS NO ROW HEIGHT TODAY, which is a fact
                                        about a defect rather than about this badge: every
                                        row is already two lines because Vendor at 8rem is
                                        33px short of this base's longest name (#314's
                                        measurement, unfixed on purpose). A row carrying
                                        the badge measured 48.5px, the same as a plain one.
                                        Give Vendor its width back and this cell becomes
                                        the tallest thing in the row.

                                        #318 — ONE CALL ANSWERS BOTH HALVES OF THIS CELL,
                                        and the row stopped reading payment twice. The word
                                        read `inv.paid` off the mapper while the badge below
                                        it went through `invoicePayment`; the flag is gone
                                        from the base, so the word reads the judgment's own
                                        `paid`.

                                        #324 MOVED THAT CALL TO THE SERVER, WHICH IS WHERE
                                        THE OTHER THREE LISTS ALREADY RESOLVE THEIR
                                        VERDICTS. `paymentWord` is also the value the
                                        `Status` filter matches on, so the word a reader
                                        picks in the bar and the word in this cell are one
                                        string rather than two that agree. */}
                                    <td className="py-1">
                                        <span
                                            className={
                                                row.paid ? "text-green-700" : "text-zinc-500"
                                            }
                                        >
                                            {/* THE DATE IS GONE (#309). A badge says the
                                                vendor was paid; WHEN is the `Paid on`
                                                sentence's on the invoice's own page, which
                                                is the one place that fact is stated rather
                                                than marked. The negation never carried one.

                                                `Not paid` SINCE #311, AND IT WAS `Unpaid`.
                                                The app had two words for one fact — this
                                                cell and `/pos/[poId]`'s badge — and that
                                                issue put a third surface on the same axis,
                                                so it converged them instead of adding one.
                                                Both words come out of
                                                `INVOICE_PAYMENT_WORDS` since #324, so the
                                                convergence is held by construction rather
                                                than by two files agreeing. */}
                                            {row.paymentWord}
                                        </span>
                                        {/* #316 — THE BADGE QUALIFIES THE WORD ABOVE IT,
                                            so it sits directly under it and above the
                                            variance badge, which qualifies the invoice
                                            rather than its payment. `/pos` stacks the same
                                            badge under the same axis's chip; this row is
                                            one invoice rather than a set, so it carries
                                            how many days as well — the reason that badge
                                            omits a figure is a rule about which of two
                                            late invoices to print, and a row with one
                                            candidate has no such choice to make.

                                            THE JUDGMENT IS `invoicePayment`'s AND THE
                                            FIGURE COMES OUT OF THE SAME CALL, on the
                                            server. Nothing here compares `Due Date` to
                                            anything: a comparison written into this cell
                                            would be a second rule beside the one the order
                                            screens fold, agreeing on every row until the
                                            boundary — which is #311's own mutant one scope
                                            down. `today` is the page's, taken once so
                                            every row is judged against one day. */}
                                        {row.overdueBadge && (
                                            <span className="mt-0.5 block w-fit rounded bg-red-100 px-1 text-xs text-red-700">
                                                {row.overdueBadge}
                                            </span>
                                        )}
                                        {/* THE VARIANCE BADGE IS NOT A FILTER, AND #324
                                            DECIDED THAT DELIBERATELY RATHER THAN BY
                                            OMISSION. `Invoices."Variance Flag"` is a state
                                            this invoice holds, so that issue's rule
                                            produces the axis — what it has no name for is
                                            the fact on THIS list: the design pass merges
                                            the marks of this family into one textless
                                            symbol and moves the kind distinction to the
                                            detail, and a separate issue groups them as
                                            tabs. A filter label would then be the only
                                            word this screen has for the fact, which is
                                            code naming a symbol before design has said
                                            what it asserts. `docs/notes/backlog.md` and
                                            `deliveries-and-invoices.md` carry it. */}
                                        {row.varianceBadge && (
                                            <span className="mt-0.5 block w-fit rounded bg-red-100 px-1 text-xs text-red-700">
                                                {row.varianceBadge}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
