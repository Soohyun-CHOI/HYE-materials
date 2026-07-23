"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { formatUSD } from "@/lib/format";
import JobFilterDropdown from "./JobFilterDropdown";

// Issue #119 (follow-up) — instant, client-side narrow-filtering over the
// already-visibility-filtered rows the server sent. No Apply button: changing
// a filter re-renders the list in place. The active filters are mirrored into
// the URL via history.replaceState (no navigation, no history entry, no server
// round-trip), so refresh / shared link / back-button restore them — the
// server reads those params back into the initial* props (and re-keys this
// component) on a real load.
export default function PRListClient({
    rows,
    jobOptions,
    statuses,
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
        // Skip the initial mount: the URL already reflects the initial filters
        // (the server seeded them from it), so there's nothing to sync.
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const p = new URLSearchParams();
        [...selectedJobs].forEach((id) => p.append("job", id));
        if (status) p.set("status", status);
        if (mine) p.set("mine", "1");
        const qs = p.toString();
        // router.replace (not raw window.history.replaceState) so Next's own
        // router state stays in sync — otherwise the filtered URL isn't
        // restored when navigating back from a detail page. It's a replace (no
        // new history entry) with scroll:false; the list already updated
        // instantly from client state, so this URL sync is a non-blocking
        // background re-render (server state/props are ignored once mounted).
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [selectedJobs, status, mine, router, pathname]);

    const filtered = rows.filter((r) => {
        if (selectedJobs.size && !selectedJobs.has(r.jobId)) return false;
        if (status && r.status !== status) return false;
        if (mine && !r.isMine) return false;
        return true;
    });

    const filtersActive = selectedJobs.size > 0 || Boolean(status) || mine;

    function toggleJob(id) {
        setSelectedJobs((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }
    function clearJobs() {
        setSelectedJobs(new Set());
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
                        onClearJobs={clearJobs}
                    />
                )}
                <label className="flex items-center gap-1">
                    <input
                        type="checkbox"
                        checked={mine}
                        onChange={(e) => setMine(e.target.checked)}
                    />
                    Raised by me
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

            {filtered.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    {filtersActive ? "No PRs match these filters." : "No purchase requests to show."}
                </p>
            ) : (
                <table className="mt-6 w-full text-sm">
                    <thead>
                        <tr className="text-left text-zinc-500">
                            <th className="pr-2">PR ID</th>
                            <th className="pr-2">Requester</th>
                            <th className="pr-2">Vendor</th>
                            <th className="pr-2">Job / Line</th>
                            <th className="pr-2 text-right">Total</th>
                            <th className="pr-2">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r) => (
                            <tr key={r.id} className="border-t border-zinc-200 dark:border-zinc-800">
                                <td className="py-1 pr-2">
                                    <Link href={`/prs/${r.prId}`} className="underline">
                                        {r.prId}
                                    </Link>
                                </td>
                                <td className="py-1 pr-2">{r.requesterName}</td>
                                <td className="py-1 pr-2">{r.vendorName}</td>
                                <td className="py-1 pr-2">
                                    {r.jobCode || "—"}
                                    {r.lineName ? ` · ${r.lineName}` : ""}
                                </td>
                                <td className="py-1 pr-2 text-right">{formatUSD(r.total)}</td>
                                <td className="py-1 pr-2">{r.status}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </>
    );
}
