"use client";

import Link from "next/link";
import { formatUSD } from "@/lib/format";
// Issue #272 — pure and import-free, so this component may hold the words while the
// judgment stays on the server: `kind` arrives as a key, exactly as `unsigned`
// arrives as a boolean on the invoice form (#198).
import { PR_KIND_COPY } from "@/lib/prKind";
import { emptyStateKind, emptyStateText, showsFilterBar } from "@/lib/listFilters";
import ListFilterBar, { ListPageFoot, useListFilters } from "@/app/components/ListFilterBar";

// Issue #119 (follow-up) — instant, client-side narrow-filtering over the
// already-visibility-filtered rows the server sent.
//
// THE BAR IS SHARED SINCE #324 and the mechanism is unchanged: no Apply button, and
// the active filters mirrored into the URL so refresh, a shared link and the back
// button restore them. What moved out is the state, the URL sync, the predicate and
// every word — this list carries five axes now (a job picker, a vendor picker, the
// reader's own, a status and a kind) and declares none of them here.
const ROUTE = "/prs";

export default function PRListClient({ rows, options, initialFilters, initialPage, totalCount }) {
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
            {/* THE ROWS BEFORE ANY FILTER, NEVER THE ROWS AFTER. Keying this off
                `shown` takes the bar away exactly when a filter has emptied the list,
                which is the one moment `Clear all filters` is what the reader needs. */}
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
                <table className="mt-6 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">PR ID</th>
                            <th className="pr-2">Requester</th>
                            <th className="pr-2">Vendor</th>
                            {/* #314 — `Job / Discipline` until that issue, and one
                                cell from two fields. Every document list in the app
                                heads this column `Job` and carries only a job; the
                                discipline is on the request's own screen, which is
                                the document that holds one. */}
                            <th className="pr-2">Job</th>
                            <th className="pr-2 text-right">Total</th>
                            <th className="pr-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filters.page.rows.map((r) => {
                            // Issue #122 — a Withdrawn PR is a terminal, ended
                            // request. It stays in the list (that's the point
                            // of withdraw being a state transition, not a
                            // delete), but it shouldn't compete visually with
                            // live PRs — so the whole row is dimmed, the same
                            // "dimmed = ended" language the signer progress bar
                            // uses for a withdrawn PR. The PR ID link inherits
                            // the muted color and stays clickable.
                            const isWithdrawn = r.status === "Withdrawn";
                            return (
                                <tr
                                    key={r.id}
                                    className={
                                        "border-t border-zinc-200" +
                                        (isWithdrawn ? " text-zinc-400" : "")
                                    }
                                >
                                    {/* Issue #272 — the kind sits in the IDENTITY cell
                                        rather than in a seventh column, because it is
                                        absent on almost every row and a column of blanks
                                        buys nothing; and not in the Status cell, which is
                                        this list's one verdict and would then be carrying
                                        two different kinds of fact. The judgment ran on
                                        the server (page.js); this reads a key. */}
                                    <td className="py-1 pr-2">
                                        <Link href={`/prs/${r.prId}`} className="underline">
                                            {r.prId}
                                        </Link>
                                        {PR_KIND_COPY.chip[r.kind] && (
                                            <span className="ml-2 rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-700">
                                                {PR_KIND_COPY.chip[r.kind]}
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-1 pr-2">{r.requesterName}</td>
                                    <td className="py-1 pr-2">{r.vendorName}</td>
                                    <td className="py-1 pr-2">{r.jobCode || "—"}</td>
                                    <td className="py-1 pr-2 text-right">{formatUSD(r.total)}</td>
                                    <td className="py-1 pr-2">{r.status}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
            {/* #326 — below the table and outside the empty branch: there is nothing to
                count and no page to be on when the list is empty. */}
            {!empty && <ListPageFoot filters={filters} />}
        </>
    );
}
