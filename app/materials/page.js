import Link from "next/link";
import { requireUser } from "@/lib/authz";
import { countMaterials } from "@/lib/airtable/materials";
import { searchMaterialPrices } from "@/lib/materialHistory";
import { lowestPriceRowIds, qtyDiffersAcross } from "@/lib/materialPriceView";
import { formatUSD } from "@/lib/format";
import MaterialSearchForm from "./MaterialSearchForm";

// Every active user, no Job scoping (#19): what a material costs is not a
// per-Job secret, and site staff pricing a job need it as much as the office.
// Document identifiers are the exception and are gated per row inside
// lib/materialHistory.js, on the same canViewPR rule app/pos/[poId] uses.
export const dynamic = "force-dynamic";

/**
 * A cached price is written at PO-GENERATION time, so the newest price for a
 * vendor can come from an order that was later withdrawn, or that nobody has
 * signed yet. Those prices are shown rather than filtered — but the reader needs
 * to know, and per-row copy for it was redundant: a row already carries the
 * status, so "Withdrawn — this order was withdrawn" said the same thing twice.
 * This says the consequence once, per group, and only when it applies.
 */
const SETTLED_STATUS = "Signed";

function hasUnsettledPrice(rows) {
    return rows.some((r) => r.poStatus && r.poStatus !== SETTLED_STATUS);
}

export default async function MaterialPricesPage({ searchParams }) {
    const user = await requireUser();
    const { q = "" } = await searchParams;

    const [{ tokens, materials, truncated }, indexedCount] = await Promise.all([
        searchMaterialPrices({ user, query: q }),
        countMaterials(),
    ]);

    const searched = tokens.length > 0;

    return (
        <div className="mx-auto w-full max-w-4xl p-8">
            <h1 className="text-2xl font-semibold">Material prices</h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                What we last paid for an item, by vendor.
            </p>

            <MaterialSearchForm initialQuery={q} />

            {/* Three different answers, and they must not read alike: nothing
                typed yet, nothing matched, and nothing indexed at all. */}
            {!searched && (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    Enter an item name to see what each vendor last charged.
                </p>
            )}

            {searched && materials.length === 0 && (
                <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
                    No items match “{q}”.
                </p>
            )}

            {/* Shown only while the index is genuinely empty, so it disappears
                on its own rather than becoming a permanent caveat. It matters
                because an empty result here does NOT mean the item was never
                bought — it means no purchase order has put it on this list yet. */}
            {indexedCount === 0 && (
                <div className="mt-4 rounded border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                        No items are indexed yet.
                    </p>
                    <p className="mt-1">
                        This list is built as new purchase orders are generated. Purchase orders
                        created before this view existed are not on it, and their prices are still
                        recorded on the orders themselves.
                    </p>
                </div>
            )}

            {truncated && (
                <p className="mt-4 text-sm text-amber-700 dark:text-amber-500">
                    Showing the first {materials.length} matches. Add another word to narrow the
                    search.
                </p>
            )}

            {materials.map(({ material, rows }) => {
                const lowest = lowestPriceRowIds(rows);
                const qtyVaries = qtyDiffersAcross(rows);

                return (
                    <section key={material.id} className="mt-8">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <div>
                                <h2 className="text-lg font-medium">
                                    <Link href={`/materials/${material.id}`} className="underline">
                                        {material.itemName}
                                    </Link>
                                </h2>
                                <p className="text-xs text-zinc-500">
                                    {[material.size, material.unit].filter(Boolean).join(" · ") ||
                                        "No size or unit recorded"}
                                </p>
                            </div>
                            <Link
                                href={`/materials/${material.id}`}
                                className="text-sm text-zinc-600 underline dark:text-zinc-400"
                            >
                                Purchase history →
                            </Link>
                        </div>

                        {rows.length === 0 ? (
                            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                                No vendor prices recorded for this item yet.
                            </p>
                        ) : (
                            <div className="mt-2 overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-zinc-500">
                                            <th className="pr-2">Vendor</th>
                                            <th className="pr-2 text-right">Unit price</th>
                                            <th className="pr-2">Date</th>
                                            <th className="pr-2 text-right">Qty</th>
                                            <th className="pr-2">Order</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => {
                                            return (
                                                <tr
                                                    key={row.id}
                                                    className="border-t border-zinc-200 dark:border-zinc-800"
                                                >
                                                    <td className="py-1 pr-2">{row.vendorName}</td>
                                                    <td className="py-1 pr-2 text-right whitespace-nowrap">
                                                        {formatUSD(row.unitPrice)}
                                                        {lowest.has(row.id) && (
                                                            <span className="ml-2 rounded bg-zinc-100 px-1 text-xs font-normal text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                                Lowest
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-1 pr-2 whitespace-nowrap">
                                                        {row.latestDate || "—"}
                                                    </td>
                                                    <td className="py-1 pr-2 text-right">
                                                        {Number.isFinite(row.qty) ? row.qty : "—"}
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
                                                        {row.poStatus && (
                                                            <span className="ml-2 text-xs text-zinc-500">
                                                                {row.poStatus}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Stated as a limit on the comparison, not as advice.
                            Only when the quantities actually differ. */}
                        {qtyVaries && (
                            <p className="mt-2 text-xs text-zinc-500">
                                These prices were quoted at different quantities, so the unit prices
                                are not directly comparable.
                            </p>
                        )}

                        {hasUnsettledPrice(rows) && (
                            <p className="mt-1 text-xs text-zinc-500">
                                A price above comes from an order that was withdrawn or is not yet
                                signed. It is still the most recent price recorded for that vendor.
                            </p>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
