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
        // #167 — the corrective PR raised for this row's excess, if any. Read as
        // the single value it is in practice (the field is multi in Airtable, like
        // Invoice Items."PO Item": the Metadata API refuses
        // prefersSingleRecordLink on create, measured 422, so single-record is
        // app-enforced). Whether a correction is PENDING is never stored — it is
        // read from this PR's Status, so withdrawing one reopens the row.
        overagePRRecordId: (record.get("Overage PR") || [])[0] ?? null,
        // #167 — the ordered item this row was allocated against BEFORE it was
        // re-attached, written in the same update as the re-attachment. Empty until
        // then, when `poItem` still IS the original — which is why every reader
        // takes `Original PO Item ?? PO Item` (lib/overage.js:resolveOriginalPOItem).
        originalPOItemRecordId: (record.get("Original PO Item") || [])[0] ?? null,
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

/**
 * Link this row's excess to the corrective PR that covers it (#167).
 *
 * A NARROW SECOND WRITER, in setPOItemMaterial's shape and for the same reason:
 * #162 fixed a row's item, quantity, PO Item and Material at creation because
 * changing them changes what the arrival was allocated against, and there is no
 * allocation-editing UI. This writes one field that is not any of those.
 */
export async function setDeliveryItemOveragePR(deliveryItemRecordId, prRecordId) {
    const record = await base(TABLES.DELIVERY_ITEMS).update(deliveryItemRecordId, {
        "Overage PR": prRecordId ? [prRecordId] : [],
    });
    return recordToDeliveryItem(record);
}

/**
 * Settle one over-delivery: move the row onto the overage PO's own ordered item
 * and clear the flag (#167).
 *
 * THE ONLY PATH THAT CHANGES A ROW'S ALLOCATION, and the exception is deliberate.
 * #162's rule — a row's `PO Item` is fixed — exists because a recorder must not be
 * able to re-point an arrival by hand. This is not that: it is the settlement of a
 * corrective purchase order that was approved and signed, so the allocation is
 * being corrected BY A DOCUMENT rather than by an edit.
 *
 * ALL THREE FIELDS IN ONE `update()`, which is what makes `Over Delivery` a
 * trustworthy signal for "did the excess move": Airtable applies one record write
 * atomically, so a row can never be re-attached while still flagged, nor flagged
 * while attached to the overage order, nor moved without recording where it came
 * from. lib/overage.js:isOverageApplied rests on exactly that.
 *
 * `Original PO Item` is the provenance the re-attachment would otherwise destroy:
 * afterwards `PO Item` names the OVERAGE order, and every banner needs the original.
 * Named for what it holds rather than for the overage, because a later re-attachment
 * for some other reason would belong in the same field — the REASON is already next
 * to it on `Overage PR`.
 */
export async function reattachDeliveryItemToPOItem(deliveryItemRecordId, {
    poItemRecordId,
    originalPOItemRecordId,
}) {
    const record = await base(TABLES.DELIVERY_ITEMS).update(deliveryItemRecordId, {
        "PO Item": poItemRecordId ? [poItemRecordId] : [],
        "Original PO Item": originalPOItemRecordId ? [originalPOItemRecordId] : [],
        "Over Delivery": false,
    });
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
