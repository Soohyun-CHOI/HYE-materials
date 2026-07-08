import { base, TABLES } from "./client";
import { generateChildId } from "../ids";

/**
 * List all line items for a PR.
 */
export async function getItemsByPR(prRecordId) {
    // No filterByFormula on the PR link field: Airtable formulas see a link
    // field as its linked record's display text, not its record ID, so a
    // formula comparing {PR} to a record ID never matches. Fetch all and
    // filter in JS instead (same pattern as lib/ids.js's generateChildId).
    const records = await base(TABLES.PR_ITEMS).select().all();

    return records
        .filter((record) => {
            const linked = record.get("PR");
            return Array.isArray(linked) && linked.includes(prRecordId);
        })
        .map(recordToItem);
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
    };
}

/**
 * Create a PR line item. PR Item ID is backend-generated as {PR ID}-{seq}.
 * Amount is a live Airtable formula — Airtable computes it, we never write it.
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
                                  }) {
    const prItemId = await generateChildId({
        tableName: TABLES.PR_ITEMS,
        parentFieldName: "PR",
        parentRecordId: prRecordId,
        prefix: prId,
        padLength: 3,
    });

    const record = await base(TABLES.PR_ITEMS).create({
        "PR Item ID": prItemId,
        PR: [prRecordId],
        "Item Name": itemName,
        Size: size || "",
        Unit: unit || "",
        Qty: qty,
        Rate: rate,
        Remark: remark || "",
    });

    return recordToItem(record);
}

/**
 * Partial update of a PR item — this table is meant to stay editable
 * pre-PO. Amount is never accepted here since it's a live formula.
 */
export async function updateItem(
    recordId,
    { itemName, size, unit, qty, rate, remark }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (size !== undefined) fields["Size"] = size;
    if (unit !== undefined) fields["Unit"] = unit;
    if (qty !== undefined) fields["Qty"] = qty;
    if (rate !== undefined) fields["Rate"] = rate;
    if (remark !== undefined) fields["Remark"] = remark;

    const record = await base(TABLES.PR_ITEMS).update(recordId, fields);
    return recordToItem(record);
}
