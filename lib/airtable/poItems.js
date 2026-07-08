import { base, TABLES } from "./client";
import { generateChildId } from "../ids";

/**
 * List all line items for a PO.
 */
export async function getItemsByPO(poRecordId) {
    // No filterByFormula on the PO link field — see prItems.js's
    // getItemsByPR for why; fetch all and filter in JS instead.
    const records = await base(TABLES.PO_ITEMS).select().all();

    return records
        .filter((record) => {
            const linked = record.get("PO");
            return Array.isArray(linked) && linked.includes(poRecordId);
        })
        .map(recordToPOItem);
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
    const poItemId = await generateChildId({
        tableName: TABLES.PO_ITEMS,
        parentFieldName: "PO",
        parentRecordId: poRecordId,
        prefix: poId,
        padLength: 3,
    });

    const record = await base(TABLES.PO_ITEMS).create({
        "PO Item ID": poItemId,
        PO: [poRecordId],
        "Item Name": itemName,
        Size: size || "",
        Unit: unit || "",
        Qty: qty,
        Rate: rate,
        Amount: qty * rate,
        Remark: remark || "",
    });

    return recordToPOItem(record);
}
