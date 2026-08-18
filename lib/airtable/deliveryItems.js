import { base, TABLES, findByRecordIds, findChildRecords, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * One allocated slice of an arrival (#162).
 *
 * `PO Item` is the link the `PO Items."Delivered Qty"` rollup travels, and it is
 * the PO ITEM rather than an Invoice Item deliberately: the ordered item is
 * ALWAYS there to compare an arrival against, and an invoice usually is but not
 * always. The reason is availability, not order of arrival — a vendor emails the
 * invoice when it ships and the material turns up afterwards, so the bill is
 * normally on hand first. What it cannot be is guaranteed, and a link that is
 * sometimes empty cannot be the one a rollup travels.
 *
 * It is also the one link here that may be EMPTY, and only in one case: an
 * over-delivery the allocation could not attribute to a single order (see
 * lib/deliveryAllocation.js:planDelivery). Such a row still carries `Material`,
 * so it stays visible on the item axis even though it contributes to no ordered item's
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
        // #181 — the field was `Over Delivery`, a noun for a checkbox, which reads
        // as though the column held an event rather than a yes/no about this row.
        // A condition takes a participle here (`President Signed`, `Paid`, `Used`),
        // hyphen-free per the field convention; the screen tag stays
        // `Over-delivered` and the noun "an over-delivery" stays in prose, where it
        // names the event. lib/deliveryAllocation.js's `over` on a PLANNED row is
        // deliberately not renamed with this: a plan exists before any row does, so
        // that flag is not named after this field.
        overDelivered: record.get("Over Delivered") || false,
        // #167 — the corrective PR raised for this row's excess, if any. Read as
        // the single value it is in practice (the field is multi in Airtable, like
        // Invoice Items."PO Item": the Metadata API refuses
        // prefersSingleRecordLink on create, measured 422, so single-record is
        // app-enforced). Whether a correction is PENDING is never stored — it is
        // read from this PR's Status, so withdrawing one reopens the row.
        overagePRRecordId: (record.get("Overage PR") || [])[0] ?? null,
        // #167 — the ordered item this row was allocated against BEFORE it was
        // re-attached, written in the same update as the re-attachment. ALWAYS A PAST
        // VALUE: empty on a row that never moved, the previous ordered item on one
        // that did, and never a current one. Which is why every reader takes
        // `Former PO Item ?? PO Item` — a fallback that belongs to the EXPRESSION
        // (lib/overage.js:resolveOriginalPOItem), not to this field.
        formerPOItemRecordId: (record.get("Former PO Item") || [])[0] ?? null,
    };
}

/**
 * Create one allocated delivery item. `Delivery Item ID` is backend-generated as
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
    overDelivered = false,
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
                "Over Delivered": Boolean(overDelivered),
            })
    );

    return recordToDeliveryItem(record);
}

/**
 * Many delivery items by record id, batched — the deliveries LIST needs every
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
 * ALL THREE FIELDS IN ONE `update()`, which is what makes `Former PO Item` a
 * trustworthy signal for "did the excess move": Airtable applies one record write
 * atomically, so a row can never be re-attached while still flagged, nor flagged
 * while attached to the overage order, nor moved without recording where it came
 * from. lib/overage.js:isOverageApplied rests on exactly that — on the PROVENANCE
 * half since #206, because `Over Delivered` is recomputed when a delivery is
 * deleted and a recomputed flag would forge a settled correction.
 *
 * `Former PO Item` is the provenance the re-attachment would otherwise destroy:
 * afterwards `PO Item` names the OVERAGE order, and every banner needs the one it
 * left. Named for what it STORES — always a past value — rather than for the
 * overage, because a later re-attachment for some other reason would belong in the
 * same field, and the REASON is already next to it on `Overage PR`.
 */
export async function reattachDeliveryItemToPOItem(deliveryItemRecordId, {
    poItemRecordId,
    formerPOItemRecordId,
}) {
    const record = await base(TABLES.DELIVERY_ITEMS).update(deliveryItemRecordId, {
        "PO Item": poItemRecordId ? [poItemRecordId] : [],
        "Former PO Item": formerPOItemRecordId ? [formerPOItemRecordId] : [],
        "Over Delivered": false,
    });
    return recordToDeliveryItem(record);
}

/**
 * Set one row's allocation — its `Qty` and its `Over Delivered` — in one write
 * (#206), the narrow third writer of that flag.
 *
 * `createDeliveryItem` sets both once at creation and
 * `reattachDeliveryItemToPOItem` clears the flag as part of its three-field
 * move. This is the last, and it is deliberately narrow in a different way: it
 * writes the two fields that state one fact together, so a row can never be
 * seen resized without its flag following. It touches neither the attachment
 * nor the provenance the move above depends on being atomic, and
 * `lib/overage.js:isOverageApplied` reads provenance precisely so that this
 * writer cannot forge an applied correction.
 */
export async function setDeliveryItemAllocation(deliveryItemRecordId, { qty, overDelivered }) {
    const record = await base(TABLES.DELIVERY_ITEMS).update(deliveryItemRecordId, {
        Qty: qty,
        "Over Delivered": Boolean(overDelivered),
    });
    return recordToDeliveryItem(record);
}

/**
 * The delivery items of one delivery, via the parent's reverse-link.
 *
 * `rowIds` (#193) — the parent's link array, when the caller already holds the
 * parent record. Supplying it skips the parent find; omitting it keeps the
 * previous behavior exactly. Either way the children come back in link-array
 * order and a link that does not resolve throws, which is what findChildRecords
 * is for.
 */
export async function getItemsByDelivery(deliveryRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.DELIVERY_ITEMS, rowIds)
        : await getLinkedRecords(TABLES.DELIVERIES, deliveryRecordId, "Delivery Items", TABLES.DELIVERY_ITEMS);
    return records.map(recordToDeliveryItem);
}
