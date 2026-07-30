import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { getMaterialPurchaseHistory } from "@/lib/materialHistory";
import { countsAsOrdered } from "@/lib/materialPriceView";
import { formatUSD } from "@/lib/format";

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
                    <table className="w-full text-sm">
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
                                // #18's Committed Qty holds this judgement; the
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
                                        <td className="py-1 pr-2">{row.vendorName}</td>
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
                                            <span className="ml-2 text-xs text-zinc-500">
                                                {row.poStatus}
                                                {counted ? "" : " — not counted as ordered"}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Link href="/materials" className="mt-6 inline-block text-sm underline">
                ← Material prices
            </Link>
        </div>
    );
}
