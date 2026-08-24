import { DIRECT_PURCHASE_COPY } from "@/lib/directPurchase";
import DirectPurchaseButton from "./DirectPurchaseButton";

// Direct purchases waiting for a request, above the list of requests (#272). One
// of the strips built to the shape #176 set; the selection rule, the ordering and
// every word are lib/directPurchase.js's and lib/directPurchaseClaim.js's, so this
// file is the rendering and nothing else.
//
// IT STANDS BESIDE THE OVER-DELIVERY STRIP RATHER THAN MERGING WITH IT, and the
// three reasons are all the same shape: the rows come from different tables under
// different gates, the actions take different records, and the refusals are
// different closed sets. One strip carrying both would need a row that is two row
// types and an action that is two actions, which is the duplication a merge is
// supposed to remove, moved inside. What they do share is the pattern, the wait
// rule (lib/prWait.js) and the ordering (#256), and those are shared as code.
//
// IT IS SECOND, WHICH IS DELIBERATE AND WEAK. Neither list is more urgent than the
// other — both are material the company has with no request behind it — so the
// existing strip keeps the position its readers already know, and the new one goes
// under it. A design with a real answer about precedence should feel free to
// reverse them.
//
// EVERY ROW CARRIES THE DOCUMENT. This is the one strip in the app whose rows were
// put there by another person rather than derived, and the reader is being asked
// to take responsibility for material somebody else recorded — so the vendor's own
// invoice is one click away, and the note the office left is on the row rather
// than behind anything.
//
// IT RENDERS NOTHING WHEN THERE IS NOTHING, #176's rule and the second thing every
// strip shares.
export default function DirectPurchaseStrip({ rows }) {
    if (!rows || rows.length === 0) return null;

    return (
        <section className="mt-4 rounded border border-amber-300 bg-amber-50 p-4">
            <h2 className="text-sm font-semibold">
                {DIRECT_PURCHASE_COPY.strip.heading(rows.length)}
            </h2>
            <p className="mt-1 text-sm text-zinc-700">{DIRECT_PURCHASE_COPY.strip.explain}</p>

            <ul className="mt-3 space-y-1">
                {rows.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 text-sm">
                        <span className="shrink-0 font-medium">{row.vendorName}</span>
                        {row.jobCode && <span className="shrink-0 text-zinc-500">{row.jobCode}</span>}
                        <span className="shrink-0 text-zinc-500">
                            {row.vendorInvoiceCode || DIRECT_PURCHASE_COPY.strip.noCode}
                        </span>
                        {row.notes && <span className="truncate text-zinc-600">{row.notes}</span>}
                        {row.fileUrl && (
                            <a
                                href={row.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 underline"
                            >
                                {DIRECT_PURCHASE_COPY.strip.file}
                            </a>
                        )}
                        <span className="ml-auto shrink-0">
                            {row.offerable ? (
                                <DirectPurchaseButton
                                    directPurchaseId={row.id}
                                    vendorName={row.vendorName}
                                    vendorInvoiceCode={row.vendorInvoiceCode}
                                />
                            ) : (
                                /* The chip that names the person holding the draft, which is
                                   lib/prWait.js's and is the same words the over-delivery strip
                                   uses for the same state. */
                                <span className="rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700">
                                    {row.heldBy}
                                </span>
                            )}
                        </span>
                    </li>
                ))}
            </ul>
        </section>
    );
}
