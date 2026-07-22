import { formatUSD } from "@/lib/format";

// Standard invoice-style summary rows for an items table's <tfoot>, shared
// by the PR and PO detail pages so the two stay visually identical. The
// tables differ in column count (PR has 7-8, PO has 9), so the caller tells
// us how many columns sit to the left of the Amount column (labelColSpan)
// and how many to its right (trailingColSpan); the value always lands in
// the Amount column, right-aligned, matching where per-line amounts render.
//
// Shipping Fee ALWAYS renders (as $0.00 when blank) — formatUSD maps
// null/undefined to 0 — so the footer is a consistent three rows on both
// pages regardless of whether a shipping fee was set.
export default function ItemsSummaryRows({
    itemsSubtotal,
    shippingFee,
    totalAmount,
    labelColSpan,
    trailingColSpan = 0,
}) {
    const rows = [
        { label: "Items Subtotal", value: itemsSubtotal, strong: false },
        { label: "Shipping Fee", value: shippingFee, strong: false },
        // Total Amount is a formula (Items Subtotal + Shipping Fee) that
        // comes back blank at 0; fall back to the subtotal, then 0, matching
        // the pages' prior inline handling.
        { label: "Total Amount", value: totalAmount ?? itemsSubtotal, strong: true },
    ];

    return (
        <tfoot>
            {rows.map((row, i) => (
                <tr
                    key={row.label}
                    className={
                        i === 0
                            ? "border-t-2 border-zinc-300 dark:border-zinc-700"
                            : undefined
                    }
                >
                    <td
                        colSpan={labelColSpan}
                        className={
                            row.strong
                                ? "py-1 pr-2 text-right font-semibold"
                                : "py-1 pr-2 text-right text-zinc-500"
                        }
                    >
                        {row.label}
                    </td>
                    <td
                        className={
                            row.strong
                                ? "py-1 pr-2 text-right font-semibold"
                                : "py-1 pr-2 text-right"
                        }
                    >
                        {formatUSD(row.value)}
                    </td>
                    {trailingColSpan > 0 && <td colSpan={trailingColSpan} />}
                </tr>
            ))}
        </tfoot>
    );
}
