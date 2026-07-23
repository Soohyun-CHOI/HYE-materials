import { base, TABLES } from "./client";
import { generateNextInvoiceId } from "../ids";

/**
 * Find an invoice by its backend-generated Invoice ID.
 * Returns null if not found.
 */
export async function getInvoiceById(invoiceId) {
    const records = await base(TABLES.INVOICES)
        .select({
            filterByFormula: `{Invoice ID} = "${invoiceId}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToInvoice(records[0]);
}

/**
 * List every invoice, most-recent Issue Date first (issue #115's list page).
 * Access is gated at the page (President-or-Admin), not here — there is no
 * per-requester scoping: an invoice is a received vendor document, not a
 * user-owned record. Full fetch with no pagination is fine at this project's
 * volume (same call shape as getAllVendors/getAllJobs); revisit if invoice
 * counts ever grow large.
 */
export async function getAllInvoices() {
    const records = await base(TABLES.INVOICES)
        .select({ sort: [{ field: "Issue Date", direction: "desc" }] })
        .all();

    return records.map(recordToInvoice);
}

function recordToInvoice(record) {
    return {
        id: record.id,
        invoiceId: record.get("Invoice ID"),
        vendorInvoiceCode: record.get("Vendor Invoice Code"),
        vendor: record.get("Vendor"),
        issueDate: record.get("Issue Date"),
        dueDate: record.get("Due Date"),
        amountDue: record.get("Amount Due"),
        shippingFee: record.get("Shipping Fee"),
        tariff: record.get("Tariff"), // issue #57 — optional, only set when the vendor's invoice itemizes one
        // Issue #78 — Items Subtotal (rollup of Invoice Items.Amount) and
        // Calculated Total (+ Shipping Fee + Tariff) are read-only, given
        // the existing submit-time comparison against Amount Due a stored
        // value to reference. Comparison/warning logic itself is unchanged.
        itemsSubtotal: record.get("Items Subtotal"),
        calculatedTotal: record.get("Calculated Total"),
        varianceFlag: record.get("Variance Flag") || false,
        paid: record.get("Paid") || false,
        paidDate: record.get("Paid Date"),
        file: record.get("File"),
    };
}

/**
 * Fetch an invoice by its Airtable record ID rather than its Invoice ID —
 * used after Invoice Items have been created, to re-read Calculated Total
 * once its rollup has caught up (issue #15).
 */
export async function getInvoiceByRecordId(recordId) {
    const record = await base(TABLES.INVOICES).find(recordId);
    return recordToInvoice(record);
}

/**
 * Create an invoice. Invoice ID is backend-generated (top-level daily-reset
 * counter — Invoice<->PO is many-to-many, so it is not a child of one PO).
 * Vendor Invoice Code is the vendor's own printed number: human-entered,
 * purely informational, never guaranteed unique on its own — always scope
 * lookups by Vendor too.
 */
export async function createInvoice({
                                         vendorId,
                                         vendorInvoiceCode,
                                         issueDate,
                                         dueDate,
                                         amountDue,
                                         shippingFee,
                                         tariff,
                                         file,
                                     }) {
    const record = await generateNextInvoiceId((invoiceId) =>
        base(TABLES.INVOICES).create({
            "Invoice ID": invoiceId,
            "Vendor Invoice Code": vendorInvoiceCode || "",
            Vendor: vendorId ? [vendorId] : [],
            "Issue Date": issueDate,
            "Due Date": dueDate,
            "Amount Due": amountDue,
            "Shipping Fee": shippingFee,
            ...(tariff !== undefined && tariff !== null ? { Tariff: tariff } : {}),
            File: file || [],
        })
    );

    return recordToInvoice(record);
}

/**
 * Partial update of an invoice — e.g. marking it paid, or setting the
 * header-level Variance Flag (#15) once Calculated Total is current.
 */
export async function updateInvoice(recordId, { paid, paidDate, varianceFlag }) {
    const fields = {};
    if (paid !== undefined) fields["Paid"] = paid;
    if (paidDate !== undefined) fields["Paid Date"] = paidDate;
    if (varianceFlag !== undefined) fields["Variance Flag"] = varianceFlag;

    const record = await base(TABLES.INVOICES).update(recordId, fields);
    return recordToInvoice(record);
}

/**
 * Link an invoice to a PO via the Invoice-PO Link join table — this is how
 * the many-to-many relationship is expressed (one join row per pair), since
 * one PO commonly has several invoices (partial shipments) and one invoice
 * can span several POs.
 */
export async function linkInvoiceToPO(invoiceRecordId, poRecordId) {
    const record = await base(TABLES.INVOICE_PO_LINK).create({
        Invoice: [invoiceRecordId],
        PO: [poRecordId],
    });

    return { id: record.id };
}
