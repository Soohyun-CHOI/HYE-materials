"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

// Issue #30 (follow-up) — searchable Job picker for the Line creation form.
// Office staff create Lines but have no assigned Jobs to group/shorten the
// list by (unlike PRForm's picker), so the whole Job list needs type-to-
// narrow search. Deliberately local to this form: NOT shared with PRForm
// (different requirements) and NOT built on the PR-list JobFilterDropdown
// (that's a multi-select filter); it only follows that file's client-filter
// + outside-click/Escape structure.
//
// Controlled on the selected id: the parent owns `value` (so it can disable
// submit until a Job is chosen), and this renders the hidden
// <input name="jobId"> that actually submits — so the form contract is
// unchanged (still a Job record id, still re-verified server-side in
// createLineAction). The visible text box carries no name and never submits.
//
// Native <select> gave keyboard access, focus handling, and form submission
// for free; this reimplements them as an ARIA combobox: role=combobox input
// driving a role=listbox, virtual focus via aria-activedescendant (focus
// stays in the input), Arrow/Enter/Escape handling, and outside-click close.

const inputClass =
    "mt-1 w-full rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-black";

export default function JobCombobox({ jobs, value, onChange }) {
    const listId = useId();
    const optionId = (i) => `${listId}-opt-${i}`;
    const containerRef = useRef(null);

    const labelOf = (job) => `${job.jobCode} — ${job.jobName}`;
    const selectedJob = jobs.find((j) => j.id === value) || null;

    // `query` is the text in the box. On a fresh selection it's set to that
    // Job's label; editing it clears the selection (see handleInputChange) so
    // the submitted id can never drift from what's shown.
    const [query, setQuery] = useState(selectedJob ? labelOf(selectedJob) : "");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        // No query, or the box still shows the committed selection's label
        // (just reopened, not yet edited) → show the whole list. Otherwise
        // match against Job Code + Name, case-insensitive substring.
        if (!q || (selectedJob && query === labelOf(selectedJob))) return jobs;
        return jobs.filter((j) => `${j.jobCode} ${j.jobName}`.toLowerCase().includes(q));
    }, [jobs, query, selectedJob]);

    // Highlighted option, clamped to the current results at render time
    // (rather than correcting activeIndex from an effect): a stale index left
    // by a shrinking result set simply reads as "nothing highlighted".
    const highlighted = activeIndex >= 0 && activeIndex < filtered.length ? activeIndex : -1;

    // Close on click/focus outside the widget, reverting the box to the
    // committed selection so its text never lies about what's selected.
    useEffect(() => {
        if (!open) return;
        function onPointerDown(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                closeAndSync();
            }
        }
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    });

    function closeAndSync() {
        setOpen(false);
        setActiveIndex(-1);
        setQuery(selectedJob ? labelOf(selectedJob) : "");
    }

    function selectJob(job) {
        onChange(job.id);
        setQuery(labelOf(job));
        setOpen(false);
        setActiveIndex(-1);
    }

    function handleInputChange(e) {
        setQuery(e.target.value);
        setOpen(true);
        setActiveIndex(0);
        // Editing invalidates any prior pick — clear it so submit re-disables
        // and a stale id can't be submitted behind changed text.
        if (value) onChange("");
    }

    function handleKeyDown(e) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                setActiveIndex(0);
                return;
            }
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) return;
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            // While the list is open, Enter belongs to the combobox: pick the
            // highlighted option (if any) and never let it submit the form
            // mid-browse. With the list closed, Enter falls through to normal
            // form submission.
            if (open) {
                e.preventDefault();
                if (highlighted >= 0 && filtered[highlighted]) {
                    selectJob(filtered[highlighted]);
                }
            }
        } else if (e.key === "Escape") {
            if (open) {
                e.preventDefault();
                closeAndSync();
            }
        }
    }

    return (
        <div ref={containerRef} className="relative">
            {/* The only field that submits — always the chosen Job's record id. */}
            <input type="hidden" name="jobId" value={value} />
            <input
                id="jobId"
                type="text"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={open && highlighted >= 0 ? optionId(highlighted) : undefined}
                autoComplete="off"
                placeholder="Search Jobs by code or name…"
                value={query}
                onChange={handleInputChange}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                className={inputClass}
            />
            {open && (
                <ul
                    id={listId}
                    role="listbox"
                    className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded border border-zinc-300 bg-white text-sm shadow-lg dark:border-zinc-700 dark:bg-black"
                >
                    {filtered.length === 0 ? (
                        <li className="px-3 py-1.5 text-zinc-500">No matching Jobs.</li>
                    ) : (
                        filtered.map((j, i) => (
                            <li
                                key={j.id}
                                id={optionId(i)}
                                role="option"
                                aria-selected={j.id === value}
                                onMouseEnter={() => setActiveIndex(i)}
                                onClick={() => selectJob(j)}
                                className={`cursor-pointer px-3 py-1.5 ${
                                    i === highlighted ? "bg-zinc-100 dark:bg-zinc-900" : ""
                                }`}
                            >
                                {labelOf(j)}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
