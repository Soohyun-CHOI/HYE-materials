import { base, TABLES, getLinkedRecords } from "./client";
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
            prefix: deliveryId,
            padLength: 3,
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
