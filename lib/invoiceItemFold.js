// Folding an invoice's split invoice items back into one (#167).
//
// The overage flow SPLITS an invoice item: the quantity that exceeded the order
// moves onto the overage PO's own ordered item, so one invoice item the vendor printed
// becomes two rows here. The items table has to fold them back, or it stops
// reading line-for-line against the PDF sitting next to it — which is the one
// thing that table is for.
//
// THE KEY IS `Material` + UNIT PRICE, and both halves are load-bearing:
//   - `Material` (#18's item identity, reached through the row's `PO Item`) is
//     what makes two rows the same item without matching `Item Name` text, the
//     approach this repo refuses everywhere else.
//   - UNIT PRICE is what keeps a vendor's two genuinely different prices for one
//     material apart. A split cannot change the price — both halves carry the
//     invoice item's own — so the two products of a split always share it, while
//     two invoice items invoiced at different prices are two facts and must stay
//     two rows.
//
// A ROW WITH NO `Material` IS NEVER FOLDED. It is its own group, keyed on its own
// id. That is not a fallback to name matching: a split can only ever produce rows
// that carry the link, since the overage PO Item gets its `Material` from #18's
// cache during the same PO generation that creates it. So a row without one cannot
// be half of a split, and folding it on anything else could merge two invoice
// items that were never one. If the cache failed, the two halves simply render as
// two rows — which is honest rather than wrong.
//
// FOLDING ACROSS TWO ORDERS IS THE POINT, NOT A SIDE EFFECT. It is also why the
// items table has no PO column any more: a folded row spans two orders, so there
// is no single value to put in that cell. The order lives on the delivery
// section's boxes instead, which are scoped to one ordered item each and therefore
// always have exactly one.
//
// The invoice counterpart of lib/deliveryAllocation.js:groupRowsByItem. Pure and
// dependency-free so scripts/tests/offline/invoice-item-fold.mjs can pin it.

/**
 * Fold an invoice's item rows.
 *
 * `rows` are the invoice's own Invoice Items in the order the table shows them,
 * each `{ id, materialRecordId, itemName, size, unit, qty, unitPrice, amount,
 * varianceFlag, remark }`. Returns one entry per folded group, in FIRST
 * APPEARANCE order — which is `Invoice Item ID` order, which is the order the
 * invoice items were entered, so a fold never moves an invoice item the reader
 * was looking for.
 *
 * `qty` and `amount` sum. `unitPrice` is part of the key, so it is shared by
 * construction. `varianceFlag` is true when ANY member carries it: the question a
 * reader asks of a folded row is "is there something wrong with this item", not
 * "which half of it".
 */
export function foldInvoiceItems(rows) {
    const byKey = new Map();

    for (const row of rows || []) {
        if (!row) continue;
        const key = foldKey(row);
        const existing = byKey.get(key);

        if (existing) {
            existing.qty += row.qty || 0;
            existing.amount += row.amount || 0;
            existing.varianceFlag = existing.varianceFlag || Boolean(row.varianceFlag);
            existing.rowIds.push(row.id);
            // Remarks are per row and need not agree — a split copies nothing, so
            // one half can carry a discrepancy note the other does not. Distinct
            // non-empty ones are kept rather than one winning, since dropping a
            // remark loses a human's own words.
            const remark = (row.remark || "").trim();
            if (remark && !existing.remarks.includes(remark)) existing.remarks.push(remark);
        } else {
            const remark = (row.remark || "").trim();
            byKey.set(key, {
                key,
                materialRecordId: row.materialRecordId ?? null,
                itemName: row.itemName || "",
                size: row.size || "",
                unit: row.unit || "",
                unitPrice: row.unitPrice ?? null,
                qty: row.qty || 0,
                amount: row.amount || 0,
                varianceFlag: Boolean(row.varianceFlag),
                rowIds: [row.id],
                remarks: remark ? [remark] : [],
            });
        }
    }

    return [...byKey.values()].map((group) => ({
        ...group,
        remark: group.remarks.join("; "),
        // How many rows this cell stands for. 1 means nothing was folded, which is
        // every row on an invoice no overage has touched.
        rowCount: group.rowIds.length,
    }));
}

/**
 * The fold key for one row. Exported so a check can pin it directly rather than
 * inferring it from what did or did not merge.
 *
 * A row with no `Material` keys on its own record id, which cannot collide — so
 * it is a group of one by construction rather than by a length test somewhere
 * else. Since #278 that is a hand-emptied link rather than a free-text charge:
 * every charge names an ordered item and takes its `Material` from it, so the
 * fallback is what keeps two such rows from merging under one blank key.
 */
export function foldKey(row) {
    if (!row?.materialRecordId) return `row::${row?.id ?? ""}`;
    // The price is part of the identity, so it is normalized the way a number
    // must be: `null` and `0` are different prices and a missing one is neither.
    return `mat::${row.materialRecordId}::${row.unitPrice ?? ""}`;
}
