import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all line items for a PO.
 */
export async function getItemsByPO(poRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_ORDERS,
        poRecordId,
        "PO Items",
        TABLES.PO_ITEMS
    );

    return records.map(recordToPOItem);
}

function recordToPOItem(record) {
    return {
        id: record.id,
        poItemId: record.get("PO Item ID"),
        po: record.get("PO"),
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        rate: record.get("Rate"),
        amount: record.get("Amount"),
        remark: record.get("Remark"),
    };
}

/**
 * Create a PO line item — a frozen snapshot copied from a PR Item at the
 * moment the PO is generated. Unlike PR Items, Amount here is a STATIC
 * currency value: it is NOT a formula in Airtable, so the backend must
 * compute and write it explicitly. This is intentional — PO Items must
 * never silently change after a PO has been issued to a vendor.
 * PO Item ID is backend-generated as {PO ID}-{seq}.
 */
export async function createPOItem({
                                        poRecordId,
                                        poId,
                                        itemName,
                                        size,
                                        unit,
                                        qty,
                                        rate,
                                        remark,
                                    }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_ORDERS,
            parentRecordId: poRecordId,
            parentLinkFieldName: "PO Items",
            prefix: poId,
            padLength: 3,
        },
        (poItemId) =>
            base(TABLES.PO_ITEMS).create({
                "PO Item ID": poItemId,
                PO: [poRecordId],
                "Item Name": itemName,
                Size: size || "",
                Unit: unit || "",
                Qty: qty,
                Rate: rate,
                Amount: qty * rate,
                Remark: remark || "",
            })
    );

    return recordToPOItem(record);
}
