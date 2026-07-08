import { base, TABLES } from "./client";
import { generateChildId } from "../ids";

/**
 * List all line items for an invoice.
 */
export async function getItemsByInvoice(invoiceRecordId) {
    // No filterByFormula on the Invoice link field — see prItems.js's
    // getItemsByPR for why; fetch all and filter in JS instead.
    const records = await base(TABLES.INVOICE_ITEMS).select().all();

    return records
        .filter((record) => {
            const linked = record.get("Invoice");
            return Array.isArray(linked) && linked.includes(invoiceRecordId);
        })
        .map(recordToInvoiceItem);
}

function recordToInvoiceItem(record) {
    return {
        id: record.id,
        invoiceItemId: record.get("Invoice Item ID"),
        invoice: record.get("Invoice"),
        po: record.get("PO"),
        itemName: record.get("Item Name"),
        qty: record.get("Qty"),
        unitPrice: record.get("Unit Price"),
        amount: record.get("Amount"), // live formula (Qty x Unit Price) — never set by backend
        varianceFlag: record.get("Variance Flag") || false,
    };
}

/**
 * Create an invoice line item. Invoice Item ID is backend-generated as
 * {Invoice ID}-{seq}. PO is a required single link — each line reconciles
 * against exactly one PO, which is what makes line-level matching on a
 * multi-PO invoice possible. Amount is a live formula, never set here.
 * Variance Flag is exposed as a plain pass-through field — the reconciliation
 * logic that decides its value is Phase 3 work, blocked on the still-open
 * variance tolerance decision, so it's not computed here.
 */
export async function createInvoiceItem({
                                             invoiceRecordId,
                                             invoiceId,
                                             poRecordId,
                                             itemName,
                                             qty,
                                             unitPrice,
                                             varianceFlag,
                                         }) {
    const invoiceItemId = await generateChildId({
        tableName: TABLES.INVOICE_ITEMS,
        parentFieldName: "Invoice",
        parentRecordId: invoiceRecordId,
        prefix: invoiceId,
        padLength: 3,
    });

    const record = await base(TABLES.INVOICE_ITEMS).create({
        "Invoice Item ID": invoiceItemId,
        Invoice: [invoiceRecordId],
        PO: poRecordId ? [poRecordId] : [],
        "Item Name": itemName,
        Qty: qty,
        "Unit Price": unitPrice,
        "Variance Flag": varianceFlag || false,
    });

    return recordToInvoiceItem(record);
}

/**
 * Partial update of an invoice item — e.g. setting Variance Flag once
 * Phase 3 reconciliation logic exists. Amount is never accepted here.
 */
export async function updateInvoiceItem(
    recordId,
    { itemName, qty, unitPrice, varianceFlag }
) {
    const fields = {};
    if (itemName !== undefined) fields["Item Name"] = itemName;
    if (qty !== undefined) fields["Qty"] = qty;
    if (unitPrice !== undefined) fields["Unit Price"] = unitPrice;
    if (varianceFlag !== undefined) fields["Variance Flag"] = varianceFlag;

    const record = await base(TABLES.INVOICE_ITEMS).update(recordId, fields);
    return recordToInvoiceItem(record);
}
