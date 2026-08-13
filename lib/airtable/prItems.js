import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";
import { normalizeItemText } from "../itemNaming";

/**
 * List all PR items for a PR.
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
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"), // live formula (Qty x Unit Price) — never set by backend
        remark: record.get("Remark"),
        // Issue #67 — which of the PR's (possibly several) Quotations this
        // item is actually based on. Single-record in practice, same
        // gotcha as every other link field: raw array of record IDs.
        quotation: record.get("Quotation"),
    };
}

/**
 * Create a PR item. PR Item ID is backend-generated as {PR ID}-{seq}.
 * Amount is a live Airtable formula — Airtable computes it, we never write it.
 * quotationRecordId is optional — empty when the PR has zero Quotations.
 *
 * Qty / Unit Price are omitted (left blank) when passed as undefined, so a
 * Draft can persist a partially-filled item row (issue #72) without writing
 * NaN into Airtable's number fields. On a real submission the caller always
 * passes numbers, so this is a no-op there.
 *
 * Issue #18 — Item Name and Size go through normalizeItemText (trim, collapse
 * internal whitespace runs, case untouched). Here in the service layer rather
 * than in the form action, so the PR form and Edit and continue cannot drift
 * apart on it. This is the origin of the whole chain: PO Items copy these
 * values, Invoice Items copy those, and Materials is keyed on them — so
 * normalizing once at the point of entry covers every table downstream, while
 * leaving the vendor-facing spelling exactly as it was typed.
 */
export async function createItem({
                                      prRecordId,
                                      prId,
                                      itemName,
                                      size,
                                      unit,
                                      qty,
                                      unitPrice,
                                      remark,
                                      quotationRecordId,
                                  }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "PR Items",
            childTableName: TABLES.PR_ITEMS,
            prefix: prId,
        },
        (prItemId) =>
            base(TABLES.PR_ITEMS).create({
                "PR Item ID": prItemId,
                PR: [prRecordId],
                "Item Name": normalizeItemText(itemName),
                Size: normalizeItemText(size),
                // Unit is a single-select; sending "" makes Airtable try to
                // create an empty option (rejected without typecast — #111),
                // so omit it when unselected. Unit is optional, no default.
                ...(unit ? { Unit: unit } : {}),
                ...(qty !== undefined ? { Qty: qty } : {}),
                ...(unitPrice !== undefined ? { "Unit Price": unitPrice } : {}),
                Remark: remark || "",
                Quotation: quotationRecordId ? [quotationRecordId] : [],
            })
    );

    return recordToItem(record);
}

/**
 * Partial update of a PR item — this table is meant to stay editable
 * pre-PO. Amount is never accepted here since it's a live formula.
 *
 * Issue #18 — Item Name and Size are normalized on the same terms as
 * createItem, so an Edit-and-continue correction cannot reintroduce the
 * whitespace variance the create path removed.
 */
export async function updateItem(
    recordId,
    { itemName, size, unit, qty, unitPrice, remark, quotationRecordId }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = normalizeItemText(itemName);
    if (size !== undefined) fields["Size"] = normalizeItemText(size);
    // Unit is a single-select: "" would make Airtable try to create an empty
    // option (rejected — #111). null clears it instead, so an intentional
    // "Unit -> unselected" edit is honored; undefined still leaves it as-is.
    if (unit !== undefined) fields["Unit"] = unit || null;
    if (qty !== undefined) fields["Qty"] = qty;
    if (unitPrice !== undefined) fields["Unit Price"] = unitPrice;
    if (remark !== undefined) fields["Remark"] = remark;
    if (quotationRecordId !== undefined) fields["Quotation"] = quotationRecordId ? [quotationRecordId] : [];

    const record = await base(TABLES.PR_ITEMS).update(recordId, fields);
    return recordToItem(record);
}
