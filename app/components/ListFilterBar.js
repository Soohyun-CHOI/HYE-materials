"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    CONTROL,
    FILTER_BAR_COPY,
    axesFor,
    choiceLabel,
    choiceValue,
    emptyFilters,
    filterQuery,
    filtersActive,
} from "@/lib/listFilters";
import PickerFilter from "./PickerFilter";

// The one filter bar the four document lists share (#324).
//
// FOUR COPIES OF ONE MECHANISM IS WHAT THIS REPLACES, and the mechanism itself is
// #119's and carries over unchanged: instant client-side narrowing over rows the
// server has already gated, no Apply button, and the active filters mirrored into the
// URL with `router.replace` — no navigation, no history entry, no server round trip —
// so refresh, a shared link and the back button restore the view. The security
// boundary is the server's gate; nothing here can widen it.
//
// IT TAKES A DECLARATION RATHER THAN BRANCHING PER SCREEN. The axes a list carries
// are `lib/listFilters.js:LIST_AXES`, and there are exactly three control kinds, so
// this renders a list rather than choosing between four layouts. That is the property
// that keeps a shared component from becoming the branch pile it would be if each
// list's bar were assembled here.
//
// EVERY WORD IT SAYS COMES FROM THAT MODULE. A label written into this JSX would be a
// string no check can see — `offline/list-filters.mjs` holds the bar's vocabulary by
// value and fails on any of it appearing as a literal outside its own module.

/**
 * The filter state, the URL mirror, and the four ways a bar changes.
 *
 * SEEDED FROM THE SERVER'S PARSE, which has already dropped anything the reader's
 * options do not allow. A fresh load or a back navigation remounts this and re-seeds
 * from those props; the `router.replace` updates during use do not remount it, so an
 * open dropdown, a search and the scroll position survive a filter change.
 */
export function useListFilters({ route, initial }) {
    const router = useRouter();
    const pathname = usePathname();
    const [state, setState] = useState(() => initial ?? emptyFilters(route));
    const firstRun = useRef(true);

    useEffect(() => {
        // The URL already reflects the initial filters — the server seeded them from
        // it — so the first mount has nothing to sync.
        if (firstRun.current) {
            firstRun.current = false;
            return;
        }
        const qs = filterQuery(route, state);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [route, state, router, pathname]);

    return {
        route,
        state,
        active: filtersActive(route, state),
        toggleValue: (param, value) =>
            setState((prev) => ({
                ...prev,
                [param]: prev[param].includes(value)
                    ? prev[param].filter((v) => v !== value)
                    : [...prev[param], value],
            })),
        setValue: (param, value) => setState((prev) => ({ ...prev, [param]: value })),
        clearParam: (param) => setState((prev) => ({ ...prev, [param]: emptyFilters(route)[param] })),
        clearAll: () => setState(emptyFilters(route)),
    };
}

/**
 * The bar itself.
 *
 * `options` is keyed by parameter: `[{ id, label }]` for a picker and a list of
 * strings for a select. A picker with no options at all is absent rather than empty,
 * which is what `/prs` already did for a reader assigned to no job.
 *
 * `shown` and `total` are the rows after and before the filters. The count renders
 * only while something is active, beside the control that undoes it — before this,
 * only `/deliveries` said it, so a reader on the other three could not tell a filter
 * that removed two rows from one that removed two hundred.
 *
 * WHETHER THIS RENDERS AT ALL IS THE CALLER'S, and it asks `showsFilterBar` with the
 * rows BEFORE any filter. See that function for why it must not be `shown`.
 */
export default function ListFilterBar({ filters, options, shown, total }) {
    const { route, state, active } = filters;
    return (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded border border-zinc-200 p-4 text-sm">
            {axesFor(route).map((axis) => {
                const choices = options?.[axis.param] ?? [];
                if (axis.control === CONTROL.picker) {
                    if (choices.length === 0) return null;
                    return (
                        <PickerFilter
                            key={axis.param}
                            options={choices}
                            selected={state[axis.param]}
                            words={axis.words}
                            onToggle={(id) => filters.toggleValue(axis.param, id)}
                            onClear={() => filters.clearParam(axis.param)}
                        />
                    );
                }
                if (axis.control === CONTROL.select) {
                    if (choices.length === 0) return null;
                    return (
                        <label key={axis.param} className="flex items-center gap-1">
                            {axis.label}:
                            <select
                                value={state[axis.param]}
                                onChange={(e) => filters.setValue(axis.param, e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1"
                            >
                                <option value="">{FILTER_BAR_COPY.allOption}</option>
                                {choices.map((choice) => (
                                    <option key={choiceValue(choice)} value={choiceValue(choice)}>
                                        {choiceLabel(choice)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    );
                }
                return (
                    <label key={axis.param} className="flex items-center gap-1">
                        <input
                            type="checkbox"
                            checked={state[axis.param]}
                            onChange={(e) => filters.setValue(axis.param, e.target.checked)}
                        />
                        {axis.label}
                    </label>
                );
            })}
            {active && (
                <>
                    <span className="text-zinc-500">{FILTER_BAR_COPY.count(shown, total)}</span>
                    <button type="button" onClick={filters.clearAll} className="underline">
                        {FILTER_BAR_COPY.clearAll}
                    </button>
                </>
            )}
        </div>
    );
}
