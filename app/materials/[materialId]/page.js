import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMaterialPurchaseHistory } from "@/lib/materialHistory";
import { statusTag } from "@/lib/materialPriceView";
import { countsAsOrdered } from "@/lib/poItemQty";
import { formatUSD } from "@/lib/format";

// Static, unlike the four record-detail pages (#201), and the record-id keying
// described just below is why. The param names nothing a reader would recognize,
// so a tab that named the item would have to resolve it — and that is a SECOND
// read of the same record, not a free one: generateMetadata runs separately from
// the page render, and the airtable SDK has no fetch deduplication for the
// page's own query to be reused by. The other four detail routes carry the
// human ID in the URL already, so they name their record for zero operations.
export const metadata = { title: "Material" };

// A page, not a modal (#19): this repo's modals are confirmation dialogs
// (app/components/modalStyles.js), and every reading surface — /prs/[prId],
// /pos/[poId] — is its own route so it can be linked and reloaded.
//
// Keyed on the Airtable record id, which is the first route in the app to do
// that: Materials has no human identifier, its primary field is the
// `Material Label` formula, and a formula value is neither stable nor URL-safe.
// One consequence is worth noting — this route interpolates nothing into a
// formula, it is a `.find()`, so unlike the search page it has no injection
// surface at all.
export const dynamic = "force-dynamic";

export default async function MaterialHistoryPage({ params }) {
    const user = await requireUser();
    const { materialId } = await params;

    const history = await getMaterialPurchaseHistory({ user, materialRecordId: materialId });

    // Same wording an unknown PR/PO/invoice gets: never confirm that a record
    // exists when we are not showing it.
    if (!history) {
        return (
            <div className="mx-auto w-full max-w-4xl p-8">
                <p>Material not found.</p>
                <Link href="/materials" className="mt-4 inline-block text-sm underline">
                    ← Material prices
                </Link>
            </div>
        );
    }

    const { material, rows } = history;
    const subtitle = [material.size, material.unit].filter(Boolean).join(" · ");

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <h1 className="text-2xl font-semibold">{material.itemName}</h1>
            {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}

            <h2 className="mt-6 text-lg font-medium">Purchase history</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Every purchase order line recorded for this item, newest first.
            </p>

            {rows.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    No purchase orders recorded for this item yet.
                </p>
            ) : (
                <div className="mt-4 overflow-x-auto">
                    {/* Declared widths for the same reason as the search page: a
                        status tag or a long vendor name must not decide how wide
                        the figures column is. Only one table here, so there is no
                        cross-table drift to fix — this keeps the two screens
                        reading alike. */}
                    <table className="w-full min-w-[52rem] table-fixed text-sm">
                        {/* Widths measured against real content rather than guessed
                            (px needed vs allotted, at this table's 832px): Date 80,
                            Qty 40, Unit price 68 — its HEADER is wider than its
                            figures — Amount 79, Order 228 for a PO ID plus a Job code.
                            The numeric columns are deliberately trimmed close to what
                            they need so Vendor gets 272px: it carries the status tag,
                            and `PO withdrawn` beside a realistically long supplier
                            name needs 249px. Vendor stays the flexible column because
                            if anything has to wrap it should be a name rather than a
                            figure, and under a fixed layout a wrapped name cannot drag
                            the numbers out of line. */}
                        <colgroup>
                            <col className="w-24" />
                            <col />
                            <col className="w-12" />
                            <col className="w-20" />
                            <col className="w-24" />
                            <col className="w-60" />
                        </colgroup>
                        <thead>
                            <tr className="text-left text-zinc-500">
                                <th className="pr-2">Date</th>
                                <th className="pr-2">Vendor</th>
                                <th className="pr-2 text-right">Qty</th>
                                <th className="pr-2 text-right">Unit price</th>
                                <th className="pr-2 text-right">Amount</th>
                                <th className="pr-2">Order</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => {
                                // #18's Committed Qty holds this judgment; the
                                // status chip beside it is the label. Two fields,
                                // each read from where the fact actually lives.
                                const counted = countsAsOrdered(row);
                                return (
                                    <tr
                                        key={row.id}
                                        className={
                                            "border-t border-zinc-200 dark:border-zinc-800" +
                                            (counted ? "" : " opacity-60")
                                        }
                                    >
                                        <td className="py-1 pr-2 whitespace-nowrap">
                                            {row.date || "—"}
                                        </td>
                                        {/* Status tag rides with the vendor, not with
                                            the PO ID: the Order column has to hold a
                                            PO ID and a Job code, while this one has
                                            the slack. Same placement as the search
                                            page, so the two screens read alike. */}
                                        <td className="py-1 pr-2">
                                            {row.vendorName}
                                            {statusTag(row.poStatus) && (
                                                <span className="ml-2 rounded bg-zinc-100 px-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {statusTag(row.poStatus)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-1 pr-2 text-right">
                                            {Number.isFinite(row.qty) ? row.qty : "—"}
                                        </td>
                                        <td className="py-1 pr-2 text-right whitespace-nowrap">
                                            {formatUSD(row.unitPrice)}
                                        </td>
                                        <td className="py-1 pr-2 text-right whitespace-nowrap">
                                            {formatUSD(row.amount)}
                                        </td>
                                        <td className="py-1 pr-2">
                                            {row.identifiers?.poId ? (
                                                <Link
                                                    href={`/pos/${row.identifiers.poId}`}
                                                    className="underline"
                                                >
                                                    {row.identifiers.poId}
                                                </Link>
                                            ) : (
                                                <span
                                                    className="text-zinc-400"
                                                    title="You do not have access to this order"
                                                >
                                                    —
                                                </span>
                                            )}
                                            {row.identifiers?.jobCode && (
                                                <span className="ml-2 text-xs text-zinc-500">
                                                    {row.identifiers.jobCode}
                                                </span>
                                            )}
                                            {/* No status and no "not counted" phrase
                                                here. The tag is beside the vendor, and
                                                the consequence is stated once in the
                                                footnote below rather than repeated on
                                                every affected row — which is what let
                                                this column stop wrapping. */}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Said once, and only when such a row exists. Per-row it was
                "Withdrawn — not counted as ordered" in the Order cell, which is
                what pushed that column past its width. The rows themselves are
                already dimmed, so this names what the dimming means. */}
            {rows.some((row) => !countsAsOrdered(row)) && (
                <p className="mt-2 text-xs text-zinc-500">
                    Dimmed rows come from orders that were withdrawn, so their quantities are
                    not counted as ordered.
                </p>
            )}

            <Link href="/materials" className="mt-6 inline-block text-sm underline">
                ← Material prices
            </Link>
        </div>
    );
}
