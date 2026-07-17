import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all line items for a PR.
 */
export async function getItemsByPR(prRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_REQUESTS,
        prRecordId,
        "PR Items",
        TABLES.PR_ITEMS
    );

    return records.map(recordToItem);
}

function recordToItem(record) {
    return {
        id: record.id,
        prItemId: record.get("PR Item ID"),
        pr: record.get("PR"),
        itemName: record.get("Item Name"),
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        rate: record.get("Rate"),
        amount: record.get("Amount"), // live formula (Qty x Rate) — never set by backend
        remark: record.get("Remark"),
        // Issue #67 — which of the PR's (possibly several) Quotations this
        // item is actually based on. Single-record in practice, same
        // gotcha as every other link field: raw array of record IDs.
        quotation: record.get("Quotation"),
    };
}

/**
 * Create a PR line item. PR Item ID is backend-generated as {PR ID}-{seq}.
 * Amount is a live Airtable formula — Airtable computes it, we never write it.
 * quotationRecordId is optional — empty when the PR has zero Quotations.
 */
export async function createItem({
                                      prRecordId,
                                      prId,
                                      itemName,
                                      size,
                                      unit,
                                      qty,
                                      rate,
                                      remark,
                                      quotationRecordId,
                                  }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "PR Items",
            prefix: prId,
            padLength: 3,
        },
        (prItemId) =>
            base(TABLES.PR_ITEMS).create({
                "PR Item ID": prItemId,
                PR: [prRecordId],
                "Item Name": itemName,
                Size: size || "",
                Unit: unit || "",
                Qty: qty,
                Rate: rate,
                Remark: remark || "",
                Quotation: quotationRecordId ? [quotationRecordId] : [],
            })
    );

    return recordToItem(record);
}

/**
 * Partial update of a PR item — this table is meant to stay editable
 * pre-PO. Amount is never accepted here since it's a live formula.
 */
export async function updateItem(
    recordId,
    { itemName, size, unit, qty, rate, remark, quotationRecordId }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (size !== undefined) fields["Size"] = size;
    if (unit !== undefined) fields["Unit"] = unit;
    if (qty !== undefined) fields["Qty"] = qty;
    if (rate !== undefined) fields["Rate"] = rate;
    if (remark !== undefined) fields["Remark"] = remark;
    if (quotationRecordId !== undefined) fields["Quotation"] = quotationRecordId ? [quotationRecordId] : [];

    const record = await base(TABLES.PR_ITEMS).update(recordId, fields);
    return recordToItem(record);
}
