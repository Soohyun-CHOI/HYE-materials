import Link from "next/link";
import { OVERAGE_COPY } from "@/lib/overage";
import OverageButton from "@/app/deliveries/[deliveryId]/OverageButton";

// Over-deliveries nobody has raised a correction for, above the list of requests
// (#217). The third of three strips built to the shape #176 set; the selection rule,
// the ordering and every word are lib/overage.js's and lib/overagePR.js's, so this
// file is the rendering and nothing else.
//
// IT IS ON `/prs`, AND WHO CAN ACT IS WHY — the mirror of #176's argument for
// putting its own strip on `/pos`. A correction IS a purchase request, and the person
// who raises it is the site staff who records deliveries; `createOverageDraftAction`
// is `requireUser` plus the delivery's own job scope, not an Admin gate. So this
// strip belongs where its readers work, and #176's belongs where the office works.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING, #176's rule and the second thing all
// three strips share. A standing all-clear above every list is a thing people learn
// to skip, and then it is not a signal on the day it changes.
//
// NOT A TABLE, AND OUTSIDE THE TABLE'S WIDTH BUDGET. The request list below is a
// `table-fixed` with its own declared widths; a strip is not a column, so it re-cuts
// nothing. What it shares is the page's 832px, and every row here is one line at that
// width — measured in a browser, not counted in characters, which is how #168 put 38
// of 40 PO IDs on two lines.
//
// THE ACTION IS ON THE ROW, AND THE ROW IS WHAT THE ACTION TAKES.
// `createOverageDraftAction` takes one `Delivery Items` record, and one purchase
// order can carry several ordered items each with its own excess, so the row rather
// than the order or the delivery is the unit that can raise anything. That is the
// same reasoning that put #176's retry on its row (`generatePOAction` takes one PR)
// and left #216 with no action at all (nothing there takes a delivery).
//
// AND IT IS `OverageButton`, THE DELIVERY DETAIL'S OWN COMPONENT, UNCHANGED. Both
// screens offer one action, so they show one preview: the modal names the invoice,
// the unit price and the file the quotation comes from, and a bare button here would
// let someone create a request without ever seeing them. A second implementation
// would also be a second place for the marker to explain itself differently, which
// is exactly what #166 needed an assertion to prevent.
//
// A BLOCKED ROW GETS A CHIP, NOT ITS SENTENCE. The shortest refusal runs to 130
// characters, which is not a row at 832px — see OVERAGE_COPY.strip for the density
// argument, which is STATUS_COPY.column's applied a second time. The sentences are
// still on the delivery detail, where there is room for them.

export default function UncorrectedOverageStrip({ rows }) {
    if (!rows || rows.length === 0) return null;

    return (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">{OVERAGE_COPY.strip.heading(rows.length)}</h2>
            <p className="mt-1 text-sm text-zinc-700">{OVERAGE_COPY.strip.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 text-sm">
                        <Link
                            href={`/deliveries/${encodeURIComponent(row.deliveryId)}`}
                            className="shrink-0 font-medium underline"
                        >
                            {row.deliveryId}
                        </Link>
                        {/* The date the ordering is by, so a reader can see the
                            sequence is what the heading claims. No day count beside
                            it, unlike #216: that strip's whole question was how long,
                            and this row already carries four facts against its
                            three. */}
                        <span className="shrink-0 tabular-nums text-zinc-600">
                            {row.receivedDate || "no date"}
                        </span>
                        {/* The excess, the item, and the order it went beyond — the
                            three things that say what would be corrected. Truncates
                            rather than wrapping, so a long material name costs the end
                            of a label and never a second line. */}
                        <span className="min-w-0 flex-1 truncate text-zinc-700">
                            {row.excess}
                            {row.unit ? ` ${row.unit}` : ""}{" "}
                            {[row.itemName, row.size].filter(Boolean).join(" ")}
                            {row.originalPoId ? ` · beyond ${row.originalPoId}` : ""}
                        </span>
                        {row.eligible ? (
                            <span className="shrink-0">
                                <OverageButton
                                    deliveryItemId={row.id}
                                    messages={row.messages}
                                    inferredLabel={row.inferredLabel}
                                />
                            </span>
                        ) : (
                            <span className="shrink-0 text-zinc-500">{row.reason}</span>
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
