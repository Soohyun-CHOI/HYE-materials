import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * One allocated slice of an arrival (#162).
 *
 * `PO Item` is the link the `PO Items."Delivered Qty"` rollup travels, and it is
 * the PO ITEM rather than an Invoice Item deliberately: material often arrives
 * with no invoice behind it yet, so the ordered line is the only thing always
 * there to compare an arrival against.
 *
 * It is also the one link here that may be EMPTY, and only in one case: an
 * over-delivery the allocation could not attribute to a single order (see
 * lib/deliveryAllocation.js:planDelivery). Such a row still carries `Material`,
 * so it stays visible on the item axis even though it contributes to no line's
 * rollup.
 */
function recordToDeliveryItem(record) {
    return {
        id: record.id,
        deliveryItemId: record.get("Delivery Item ID"),
        delivery: record.get("Delivery") || [],
        poItem: record.get("PO Item") || [],
        material: record.get("Material") || [],
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        overDelivery: record.get("Over Delivery") || false,
    };
}

/**
 * Create one allocated line. `Delivery Item ID` is backend-generated as
 * {Delivery ID}-{seq}, the same child-ID shape as PR/PO/Invoice Items.
 *
 * `itemName`/`size`/`unit` are frozen reference copies the caller resolves from
 * the linked PO Item, or from the Material when there is no PO Item — which is
 * why, unlike Invoice Items, they are never blank here: a Material is always
 * linked and carries all three as its natural key.
 *
 * `Unit` is omitted rather than sent as "" when absent, exactly as prItems.js and
 * poItems.js do (#111): "" on a single select is not "no value" but a request to
 * create an empty option, which Airtable refuses. `typecast` is deliberately not
 * used, so a unit outside the canonical list fails the write instead of silently
 * inventing a 20th option.
 */
export async function createDeliveryItem({
    deliveryRecordId,
    deliveryId,
    poItemRecordId,
    materialRecordId,
    itemName,
    size,
    unit,
    qty,
    overDelivery = false,
}) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.DELIVERIES,
            parentRecordId: deliveryRecordId,
            parentLinkFieldName: "Delivery Items",
            childTableName: TABLES.DELIVERY_ITEMS,
            prefix: deliveryId,
        },
        (deliveryItemId) =>
            base(TABLES.DELIVERY_ITEMS).create({
                "Delivery Item ID": deliveryItemId,
                Delivery: [deliveryRecordId],
                // Empty only on an unattributable over-delivery row.
                "PO Item": poItemRecordId ? [poItemRecordId] : [],
                Material: materialRecordId ? [materialRecordId] : [],
                "Item Name": itemName || "",
                Size: size || "",
                ...(unit ? { Unit: unit } : {}),
                Qty: qty,
                "Over Delivery": Boolean(overDelivery),
            })
    );

    return recordToDeliveryItem(record);
}

/**
 * Many delivery lines by record id, batched — the deliveries LIST needs every
 * listed delivery's items to summarize each row as "first item + N more", and
 * one read per delivery would be the per-row round trip #143 ruled out. The ids
 * come from the `Delivery Items` reverse-link the delivery records already
 * carry, so this adds one query (per 50 ids) for the whole page.
 */
export async function getDeliveryItemsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.DELIVERY_ITEMS, recordIds)).map(recordToDeliveryItem);
}

/** The lines of one delivery, via the parent's reverse-link. */
export async function getItemsByDelivery(deliveryRecordId) {
    const records = await getLinkedRecords(
        TABLES.DELIVERIES,
        deliveryRecordId,
        "Delivery Items",
        TABLES.DELIVERY_ITEMS
    );
    return records.map(recordToDeliveryItem);
}
