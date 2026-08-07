"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import { EMPTY_COPY, emptyStateKind } from "@/lib/poListView";
import JobFilterDropdown from "@/app/prs/JobFilterDropdown";

// Instant client-side narrowing over the already-gated rows the server sent, in
// the shape #119 set for the PR list: no Apply button, and the active filters
// mirrored into the URL with router.replace — no navigation, no history entry,
// no server round trip — so refresh, a shared link and the back button restore
// the view. The dropdown itself is /prs's component rather than a copy of it.
//
// These filters can only narrow within the visible set. The security boundary is
// the server's canViewPR pass; nothing here can widen it.
export default function POListClient({
    rows,
    jobOptions,
    statuses,
    totalCount,
    initialSelectedJobs,
    initialStatus,
    initialMine,
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [selectedJobs, setSelectedJobs] = useState(() => new Set(initialSelectedJobs));
    const [status, setStatus] = useState(initialStatus);
    const [mine, setMine] = useState(initialMine);
    const firstRun = useRef(true);

    useEffect(() => {
        // The URL already reflects the initial filters — the server seeded them
        // from it — so the first mount has nothing to sync.
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const params = new URLSearchParams();
        [...selectedJobs].forEach((id) => params.append("job", id));
        if (status) params.set("status", status);
        if (mine) params.set("mine", "1");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [selectedJobs, status, mine, router, pathname]);

    const filtered = rows.filter((row) => {
        if (selectedJobs.size && !selectedJobs.has(row.jobId)) return false;
        if (status && row.status !== status) return false;
        if (mine && !row.isMine) return false;
        return true;
    });

    const filtersActive = selectedJobs.size > 0 || Boolean(status) || mine;
    const empty =
        filtered.length === 0
            ? emptyStateKind({ totalCount, visibleCount: rows.length, filtersActive })
            : null;

    function toggleJob(id) {
        setSelectedJobs((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function clearAllFilters() {
        setSelectedJobs(new Set());
        setStatus("");
        setMine(false);
    }

    return (
        <>
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded border border-zinc-200 p-4 text-sm dark:border-zinc-800">
                {jobOptions.length > 0 && (
                    <JobFilterDropdown
                        jobs={jobOptions}
                        selected={selectedJobs}
                        onToggle={toggleJob}
                        onClearJobs={() => setSelectedJobs(new Set())}
                    />
                )}
                <label className="flex items-center gap-1">
                    <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
                    Requested by me
                </label>
                <label className="flex items-center gap-1">
                    Status:
                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black"
                    >
                        <option value="">All</option>
                        {statuses.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>
                {filtersActive && (
                    <button type="button" onClick={clearAllFilters} className="underline">
                        Clear all filters
                    </button>
                )}
            </div>

            {empty ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">{EMPTY_COPY[empty]}</p>
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
                        PO ID carries a FOUR-DIGIT year (the one exception to this
                        base's 2-digit convention), and `HYE-PO-20260805-02` renders
                        at 141px, so 38 of 40 rows wrapped to two lines. Content
                        widths at 14px/20px Arial, plus the 8px `pr-2` every column
                        but the last carries: PO ID 149, Status 142, Vendor 124,
                        Job 91, Created 80, Total 79 — 665px of the 832px a
                        `max-w-4xl` page minus `p-8` has.

                        Five columns are bounded by construction and take only what
                        they need: a PO ID is a fixed format, a date is ten
                        characters, Status is a closed set whose longest rendering is
                        `Withdrawn 2026-07-27`, Total is a currency figure, and a job
                        code is short. So VENDOR TAKES ALL THE SLACK — 192px against
                        the 124px this base's longest supplier needs. It is the only
                        column whose content nobody here controls, and the one where
                        wrapping would be least harmful if a longer name arrives. */}
                    <table className="w-full min-w-[52rem] table-fixed text-sm">
                        <colgroup>
                            <col style={{ width: "10rem" }} />
                            <col style={{ width: "12rem" }} />
                            <col style={{ width: "7rem" }} />
                            <col style={{ width: "6rem" }} />
                            <col style={{ width: "7rem" }} />
                            <col style={{ width: "10rem" }} />
                        </colgroup>
                        <thead>
                            <tr className="text-left text-zinc-500">
                                <th className="pr-2">PO ID</th>
                                <th className="pr-2">Vendor</th>
                                <th className="pr-2">Job</th>
                                <th className="pr-2">Created</th>
                                <th className="pr-2 text-right">Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((row) => (
                                <tr
                                    key={row.id}
                                    className="border-t border-zinc-200 dark:border-zinc-800"
                                >
                                    <td className="py-1 pr-2">
                                        <Link href={`/pos/${row.poId}`} className="underline">
                                            {row.poId}
                                        </Link>
                                    </td>
                                    <td className="py-1 pr-2">{row.vendorName}</td>
                                    <td className="py-1 pr-2">{row.jobCode || "—"}</td>
                                    <td className="py-1 pr-2">{row.createdDate || "—"}</td>
                                    <td className="py-1 pr-2 text-right">{formatUSD(row.total)}</td>
                                    {/* A withdrawn order is terminal and stays on
                                        record (#138), so it is dimmed rather than
                                        hidden — the same treatment #122 gives a
                                        withdrawn PR in its own list. Awaiting
                                        Signature gets NO treatment at all: an
                                        unsigned purchase order is an ordinary state
                                        of one, not a problem to flag. */}
                                    <td
                                        className={
                                            row.status === "Withdrawn"
                                                ? "py-1 text-zinc-500"
                                                : "py-1"
                                        }
                                    >
                                        {row.statusText}
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
