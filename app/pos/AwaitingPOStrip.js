"use client";

import Link from "next/link";
import { useActionState } from "react";
import { generatePOAction } from "@/app/prs/[prId]/actions";
import { awaitingPOCopy } from "@/lib/poListView";

// Approved purchase requests whose PO generation failed, above the list of POs
// (#176). The rule and both voices are lib/poListView.js's; this file is the
// rendering and nothing else, the same split app/components/DeliveryStatusMarks.js
// makes against lib/deliveryStatus.js.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING, and the empty state being invisible
// IS how this screen says the state is normal. A standing "all clear" line above
// every list is a thing people learn to skip, and then it is not a signal on the
// day it changes. #19's `statusTag` is the precedent already in this repo: it
// reports exceptions and stays silent otherwise, which is the reason
// purchase-orders.md gives for not reusing it in a column headed Status.
//
// NOT A TABLE, AND OUTSIDE THE TABLE'S WIDTH BUDGET. The list below is
// `table-fixed` with a declared `colgroup` summing to exactly 52rem and no slack
// (#166's rule, measured for these six columns) — but a strip is not a column, so
// it re-cuts nothing. What it does share is the page's 832px, so every row here
// is one line at that width and was measured in a browser rather than counted in
// characters, which is how #168 put 38 of 40 PO IDs on two lines.
//
// A SECOND TABLE WAS THE OTHER OPTION AND IS WORSE: two stacked tables read as
// one dataset split in half, and it would double the column-budget problem for a
// row that carries three facts. #216 and #217 show different facts on the same
// shape, and a line of text transfers where a colgroup does not.

export default function AwaitingPOStrip({ rows, isAdmin }) {
    if (!rows || rows.length === 0) return null;

    const copy = awaitingPOCopy({ count: rows.length, isAdmin });

    return (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">{copy.heading}</h2>
            <p className="mt-1 text-sm text-zinc-700">{copy.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <AwaitingPORow key={row.id} row={row} isAdmin={isAdmin} />
                ))}
            </ul>
        </section>
    );
}

function AwaitingPORow({ row, isAdmin }) {
    return (
        <li className="flex items-center gap-3 text-sm">
            <Link href={`/prs/${row.prId}`} className="shrink-0 font-medium underline">
                {row.prId}
            </Link>
            {/* Job / Line as one cell with the same separator the list's first
                column uses, so a reader locating work reads the same pair in the
                same shape whether it is above the table or in it. */}
            <span className="min-w-0 flex-1 truncate text-zinc-700">
                {row.jobCode || "—"}
                {row.lineName ? ` / ${row.lineName}` : ""}
                {" · "}
                {row.vendorName || "—"}
            </span>
            {isAdmin && <GeneratePOButton prId={row.prId} />}
        </li>
    );
}

// The retry is generatePOAction unchanged — the same Admin-wrapped Server Action
// the PR detail page has always called, not a second one for this screen. It is
// a no-op when a PO already exists, so two people pressing it costs nothing.
//
// IT REDIRECTS TO THE PR, WHICH MEANS PRESSING IT HERE LEAVES THIS PAGE. That is
// left alone on purpose: the redirect is correct for the caller that already
// existed, and changing a shared action's behavior on the evidence of one new
// screen is the kind of decision worth having all three strips in hand for. The
// result is at least visible where it lands.
function GeneratePOButton({ prId }) {
    const [state, formAction, pending] = useActionState(generatePOAction, null);

    return (
        <form action={formAction} className="shrink-0">
            <input type="hidden" name="prId" value={prId} />
            <button
                type="submit"
                disabled={pending}
                className="rounded border border-amber-400 bg-white px-2 py-1 text-xs disabled:opacity-50"
            >
                {pending ? "Generating..." : "Generate PO"}
            </button>
            {state?.error && <p className="mt-1 text-xs text-red-700">{state.error}</p>}
        </form>
    );
}
