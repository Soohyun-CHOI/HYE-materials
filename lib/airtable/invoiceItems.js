import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * Many invoice items by record id, batched (#166, exported in #167).
 *
 * The ids come from a `PO Items."Invoice Items"` reverse-link, so a whole level of
 * invoices is fetched in one query per 50 rather than one per invoice item — the
 * per-row round trip #143 ruled out. #166's join walked this level with a private
 * copy of this reader; #167 needs the same level for the overage affordance, so it
 * moved here rather than becoming a second one that could drift.
 */
export async function getInvoiceItemsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.INVOICE_ITEMS, recordIds)).map(recordToInvoiceItem);
}

/**
 * List all invoice items for an invoice.
 */
export async function getItemsByInvoice(invoiceRecordId) {
    const records = await getLinkedRecords(
        TABLES.INVOICES,
        invoiceRecordId,
        "Invoice Items",
        TABLES.INVOICE_ITEMS
    );

    return records.map(recordToInvoiceItem);
}

/**
 * List every Invoice Item linked to a single PO Item — the actual line-
 * level breakdown behind getInvoicingStatusByPO()'s aggregate, used by the
 * PO detail page (#15) to show each reconciling invoice item and its
 * Variance Flag, not just the summed invoiced/uninvoiced Qty.
 */
export async function getItemsByPOItem(poItemRecordId) {
    const records = await getLinkedRecords(
        TABLES.PO_ITEMS,
        poItemRecordId,
        "Invoice Items",
        TABLES.INVOICE_ITEMS
    );

    return records.map(recordToInvoiceItem);
}

function recordToInvoiceItem(record) {
    return {
        id: record.id,
        invoiceItemId: record.get("Invoice Item ID"),
        invoice: record.get("Invoice"),
        po: record.get("PO"),
        poItem: record.get("PO Item"), // empty = doesn't correspond to a PO Item (e.g. Freight), Item Name is free text
        itemName: record.get("Item Name"),
        // Issue #84 — frozen copies from the linked PO Item at creation
        // time, same as Item Name/Unit Price (never a live Lookup). No
        // edit path: a Size/Unit that needs to differ means the wrong PO
        // Item was picked, not a value to correct in place.
        size: record.get("Size"),
        unit: record.get("Unit"),
        qty: record.get("Qty"),
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"), // live formula (Qty x Unit Price) — never set by backend
        remark: record.get("Remark"), // issue #57 — why Unit Price/Qty diverges from the linked PO Item
        varianceFlag: record.get("Variance Flag") || false,
    };
}

/**
 * Create an invoice item. Invoice Item ID is backend-generated as
 * {Invoice ID}-{seq}. PO is a required single link — each invoice item reconciles
 * against exactly one PO, which is what makes item-level matching on a
 * multi-PO invoice possible. PO Item (issue #51) is optional — an invoice item
 * either points at the exact PO Item it's billing for, or is left unlinked
 * for invoice items with no PO Item counterpart (Freight, repair charges). Amount
 * is a live formula, never set here. Variance Flag is exposed as a plain
 * pass-through field — the reconciliation logic that decides its value is
 * Phase 3 work, blocked on the still-open variance tolerance decision, so
 * it's not computed here.
 */
export async function createInvoiceItem({
                                             invoiceRecordId,
                                             invoiceId,
                                             poRecordId,
                                             poItemRecordId,
                                             itemName,
                                             size,
                                             unit,
                                             qty,
                                             unitPrice,
                                             remark,
                                             varianceFlag,
                                         }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.INVOICES,
            parentRecordId: invoiceRecordId,
            parentLinkFieldName: "Invoice Items",
            childTableName: TABLES.INVOICE_ITEMS,
            prefix: invoiceId,
        },
        (invoiceItemId) =>
            base(TABLES.INVOICE_ITEMS).create({
                "Invoice Item ID": invoiceItemId,
                Invoice: [invoiceRecordId],
                PO: poRecordId ? [poRecordId] : [],
                "PO Item": poItemRecordId ? [poItemRecordId] : [],
                "Item Name": itemName,
                Size: size || "",
                // Unit is a single select (issue #83) — an empty string
                // isn't a valid choice, so it's only included when a PO
                // Item actually supplied one (a free-text "Other" invoice item has
                // nothing to copy from and just leaves this blank).
                ...(unit ? { Unit: unit } : {}),
                Qty: qty,
                "Unit Price": unitPrice,
                Remark: remark || "",
                "Variance Flag": varianceFlag || false,
            })
    );

    return recordToInvoiceItem(record);
}

/**
 * Partial update of an invoice item — e.g. setting Variance Flag once
 * Phase 3 reconciliation logic exists. Amount is never accepted here.
 */
export async function updateInvoiceItem(
    recordId,
    { itemName, qty, unitPrice, poRecordId, poItemRecordId, remark, varianceFlag }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (qty !== undefined) fields["Qty"] = qty;
    if (unitPrice !== undefined) fields["Unit Price"] = unitPrice;
    // Issue #167 — the PO an invoice item reconciles against can move exactly
    // once: when an overage correction takes over an invoice whose WHOLE invoice item
    // was the excess, the invoice item is re-pointed rather than split, so it must
    // follow the ordered item to the new order. Both links move together or the
    // invoice item would name a PO Item belonging to a different PO.
    if (poRecordId !== undefined) fields["PO"] = poRecordId ? [poRecordId] : [];
    if (poItemRecordId !== undefined) fields["PO Item"] = poItemRecordId ? [poItemRecordId] : [];
    if (remark !== undefined) fields["Remark"] = remark;
    if (varianceFlag !== undefined) fields["Variance Flag"] = varianceFlag;

    const record = await base(TABLES.INVOICE_ITEMS).update(recordId, fields);
    return recordToInvoiceItem(record);
}
