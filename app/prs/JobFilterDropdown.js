"use client";

import { useEffect, useRef, useState } from "react";

// Issue #119 (follow-up) — the Job filter as an always-dropdown (no
// count-based branching). This client component owns ONLY the open/close and
// the live selection summary; the checkboxes are real <input name="job"> that
// stay mounted (the panel is hidden via display:none when closed, so they
// drop out of tab order but are still submitted by the parent GET form). The
// form submission and server-side filtering/scoping are unchanged from #119 —
// options are already limited to accessible jobs by the page, and the server
// still intersects the submitted ids with the accessible set.
export default function JobFilterDropdown({ jobs, selectedJobs }) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(() => new Set(selectedJobs));
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

    function toggle(id) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const summary = selected.size === 0 ? "All jobs" : `${selected.size} selected`;

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
                } absolute z-10 mt-1 max-h-64 w-72 overflow-y-auto rounded border border-zinc-300 bg-white p-2 shadow-lg dark:border-zinc-700 dark:bg-black`}
            >
                {jobs.map((j) => (
                    <label key={j.id} className="flex items-start gap-2 whitespace-normal p-1">
                        <input
                            type="checkbox"
                            name="job"
                            value={j.id}
                            checked={selected.has(j.id)}
                            onChange={() => toggle(j.id)}
                            className="mt-0.5"
                        />
                        <span>
                            {j.jobCode} — {j.jobName}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
