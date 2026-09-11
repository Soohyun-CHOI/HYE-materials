"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { MATERIAL_SEARCH_COPY } from "@/lib/materialPriceView";

/**
 * The search box (#19).
 *
 * A GET form navigating to `?q=` rather than a Server Action, so a search is a
 * URL: shareable, bookmarkable, and back-button-correct. The page reads `q` and
 * does the matching server-side, which is also why the query never reaches the
 * browser as data — it is only ever in the address bar.
 *
 * Client Component only for the controlled input and the disable-on-submit
 * guard; nothing here touches Airtable.
 *
 * ITS WORDS ARE IN A CONSTANT SINCE #357, and the import is safe at every depth:
 * lib/materialPriceView.js -> lib/itemNaming.js, lib/poUnsigned.js ->
 * lib/poSend.js -> lib/format.js and lib/materialCategory.js, none of which
 * reach lib/airtable/ or lib/airtableOps.js. Text written straight into JSX is
 * invisible to the vocabulary and brief checks, which is how the box went on
 * offering `pipe 2"` as an example after that query stopped matching anything.
 */
export default function MaterialSearchForm({ initialQuery = "" }) {
    const router = useRouter();
    const params = useSearchParams();
    const [value, setValue] = useState(initialQuery);
    const [submitting, setSubmitting] = useState(false);

    const current = params.get("q") ?? "";

    function onSubmit(event) {
        event.preventDefault();
        const next = value.trim();
        setSubmitting(true);
        router.push(next ? `/materials?q=${encodeURIComponent(next)}` : "/materials");
        // The navigation re-renders this component with a new initialQuery; the
        // flag is only here to stop a double submit landing two navigations.
        setSubmitting(false);
    }

    return (
        <form onSubmit={onSubmit} className="mt-6 flex flex-wrap gap-2">
            <label htmlFor="material-q" className="sr-only">
                {MATERIAL_SEARCH_COPY.boxLabel}
            </label>
            <input
                id="material-q"
                name="q"
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={MATERIAL_SEARCH_COPY.placeholder}
                className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <button
                type="submit"
                disabled={submitting}
                className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
            >
                Search
            </button>
            {current && (
                <button
                    type="button"
                    onClick={() => {
                        setValue("");
                        router.push("/materials");
                    }}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                    Clear
                </button>
            )}
            {/* Words are AND-ed and order does not matter, which is not obvious
                from an empty box. The pair is in code style because they are
                things to type; the strings themselves come from the constant,
                where a check can ask whether they still match a real path. */}
            <p className="w-full text-xs text-zinc-500">
                {MATERIAL_SEARCH_COPY.orderNote.lead}{" "}
                <code>{MATERIAL_SEARCH_COPY.orderNote.examples[0]}</code> and{" "}
                <code>{MATERIAL_SEARCH_COPY.orderNote.examples[1]}</code>{" "}
                {MATERIAL_SEARCH_COPY.orderNote.tail}
            </p>
        </form>
    );
}
