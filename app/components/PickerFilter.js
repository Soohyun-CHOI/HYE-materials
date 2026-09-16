"use client";

import { useEffect, useRef, useState } from "react";

// A searchable multi-select over records, for the shared filter bar (#324).
//
// THIS IS `app/prs/JobFilterDropdown.js`, MOVED AND GENERALIZED. It was written for
// #119's job picker and `/pos` then imported it across from `app/prs/` — a component
// living under one screen and read by another, which is the shape this issue is
// about. It serves two axes on four lists now, so it takes its words and its options
// instead of naming jobs.
//
// CONTROLLED: the selection lives in the bar, so toggling instantly re-filters the
// list; this component owns only the open/close and the client-side search. Search
// filters the options it was ALREADY GIVEN, so it can never surface a record outside
// the reader's scope — the server computed that set. Non-matching rows are hidden
// with `display:none` rather than unmounted, so they leave the tab order while their
// checked state is untouched: search changes what is visible, never the selection.
//
// IT HANDS FOCUS BACK TO ITS OPENER ON `Escape`, which the original did not. CLAUDE.md
// requires it of anything that opens over the page, and a component four screens read
// is the wrong place to carry the omission forward.
export default function PickerFilter({ options, selected, onToggle, onClear, words }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const ref = useRef(null);
    const opener = useRef(null);

    useEffect(() => {
        if (!open) return;
        function onPointerDown(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        function onKey(e) {
            if (e.key !== "Escape") return;
            setOpen(false);
            opener.current?.focus();
        }
        document.addEventListener("mousedown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const summary = selected.length === 0 ? words.all : words.selected(selected.length);
    const q = query.trim().toLowerCase();
    const matches = (option) => !q || option.label.toLowerCase().includes(q);
    const anyMatch = options.some(matches);

    return (
        <div ref={ref} className="relative inline-block">
            <button
                ref={opener}
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="rounded border border-zinc-300 px-3 py-1"
            >
                {words.label}: {summary} ▾
            </button>
            <div
                className={`${
                    open ? "block" : "hidden"
                } absolute z-10 mt-1 w-96 rounded border border-zinc-300 bg-white p-2 shadow-lg`}
            >
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={words.search}
                        className="w-full rounded border border-zinc-300 px-2 py-1"
                    />
                    {selected.length > 0 && (
                        <button
                            type="button"
                            onClick={onClear}
                            className="whitespace-nowrap text-xs underline"
                        >
                            {words.clear}
                        </button>
                    )}
                </div>
                <div className="mt-2 max-h-64 overflow-y-auto">
                    {options.map((option) => (
                        <label
                            key={option.id}
                            className={`${
                                matches(option) ? "flex" : "hidden"
                            } items-start gap-2 whitespace-normal p-1`}
                        >
                            <input
                                type="checkbox"
                                checked={selected.includes(option.id)}
                                onChange={() => onToggle(option.id)}
                                className="mt-0.5"
                            />
                            <span>{option.label}</span>
                        </label>
                    ))}
                    {!anyMatch && <p className="p-1 text-zinc-500">{words.empty}</p>}
                </div>
            </div>
        </div>
    );
}
