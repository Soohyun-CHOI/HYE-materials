"use client";

import { useEffect, useRef, useState } from "react";

// Issue #119 (follow-up) — the Job filter dropdown. Controlled: selection
// lives in the parent (PRListClient) so toggling instantly re-filters the
// list; this component owns only the open/close and the client-side search.
// Search filters the already-provided accessible jobs by name — no server
// call, no new jobs — so a search can never surface a job outside the user's
// access. Non-matching rows are hidden with display:none (not unmounted), so
// they leave the tab order but their checked state is untouched; search only
// changes what's visible, never the selection.
export default function JobFilterDropdown({ jobs, selected, onToggle, onClearJobs }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        function onKey(e) {
            if (e.key === "Escape") setOpen(false);
        }
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const summary = selected.size === 0 ? "All jobs" : `${selected.size} selected`;
    const q = query.trim().toLowerCase();
    const matches = (j) => !q || `${j.jobCode} ${j.jobName}`.toLowerCase().includes(q);
    const anyMatch = jobs.some(matches);

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-700"
            >
                Jobs: {summary} ▾
            </button>
            <div
                className={`${
                    open ? "block" : "hidden"
                } absolute z-10 mt-1 w-96 rounded border border-zinc-300 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-black`}
            >
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search jobs…"
                        className="w-full rounded border border-zinc-300 px-2 py-1 dark:border-zinc-700 dark:bg-black"
                    />
                    {selected.size > 0 && (
                        <button
                            type="button"
                            onClick={onClearJobs}
                            className="whitespace-nowrap text-xs underline"
                        >
                            Clear jobs
                        </button>
                    )}
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto">
                    {jobs.map((j) => (
                        <label
                            key={j.id}
                            className={`${
                                matches(j) ? "flex" : "hidden"
                            } items-start gap-2 whitespace-normal p-1`}
                        >
                            <input
                                type="checkbox"
                                checked={selected.has(j.id)}
                                onChange={() => onToggle(j.id)}
                                className="mt-0.5"
                            />
                            <span>
                                {j.jobCode} — {j.jobName}
                            </span>
                        </label>
                    ))}
                    {!anyMatch && <p className="p-1 text-zinc-500">No matching jobs.</p>}
                </div>
            </div>
        </div>
    );
}
