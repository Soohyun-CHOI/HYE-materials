// The read an invoice item's spread makes (#660): the ordered items of an invoice's orders, as
// `lib/invoiceSpread.js` takes them. The judgment and its words are that module's; this is the half
// that reaches Airtable, which is why it is a pair (#184).

import { getPOItemsForReconciliation } from "./airtable/poItems";

/**
 * The ordered items of `orders` — order records as `lib/airtable/purchaseOrders.js` maps them, each
 * carrying its `PO Items` link array — read in one query per fifty, with the order each is on. Fresh
 * by construction: `Invoiced Qty` is a rollup another invoice may have moved, and the spread is
 * what is written. `getPOItemsForReconciliation` because it carries `Material`, `Unit Price`, `Qty`
 * and `Invoiced Qty` together and asks for no fields, so they cost nothing more.
 */
export async function getSpreadOrderedItems(orders) {
    const poById = new Map((orders || []).map((po) => [po.id, po]));
    const rows = await getPOItemsForReconciliation([...poById.values()].flatMap((po) => po.poItems || []));
    return rows.map((p) => {
        const po = poById.get(p.po?.[0]);
        return {
            id: p.id,
            poItemId: p.poItemId,
            poRecordId: po?.id ?? p.po?.[0] ?? null,
            poId: po?.poId ?? null,
            poCreatedDate: po?.createdDate ?? null,
            materialRecordId: p.material?.[0] ?? null,
            itemName: p.itemName,
            size: p.size,
            maker: p.maker,
            unit: p.unit,
            qty: p.qty,
            unitPrice: p.unitPrice,
            invoicedQty: p.invoicedQty,
        };
    });
}
