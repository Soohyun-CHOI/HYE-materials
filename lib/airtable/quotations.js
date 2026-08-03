import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all quotations attached to a PR.
 */
export async function getQuotationsByPR(prRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_REQUESTS,
        prRecordId,
        "Quotations",
        TABLES.QUOTATIONS
    );

    return records.map(recordToQuotation);
}

function recordToQuotation(record) {
    return {
        id: record.id,
        quotationId: record.get("Quotation ID"),
        vendorQuotationCode: record.get("Vendor Quotation Code"),
        vendor: record.get("Vendor"),
        pr: record.get("PR"),
        file: record.get("File"),
    };
}

/**
 * Attach a quotation to a PR. Quotation ID is backend-generated as a child
 * ID of the PR ({PR ID}-Q{seq}) — guaranteed unique, internal only.
 * Vendor Quotation Code is the vendor's own printed number: human-entered,
 * purely informational, and never guaranteed unique on its own — always
 * scope lookups by Vendor too.
 */
export async function createQuotation({
                                           prRecordId,
                                           prId,
                                           vendorId,
                                           vendorQuotationCode,
                                           file,
                                       }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "Quotations",
            childTableName: TABLES.QUOTATIONS,
            prefix: prId,
        },
        (quotationId) =>
            base(TABLES.QUOTATIONS).create({
                "Quotation ID": quotationId,
                "Vendor Quotation Code": vendorQuotationCode || "",
                Vendor: vendorId ? [vendorId] : [],
                PR: [prRecordId],
                File: file || [],
            })
    );

    return recordToQuotation(record);
}

/**
 * Update a Quotation's human-entered code (issue #142).
 *
 * Deliberately has no `file` parameter, and must not grow one. `File` is
 * written in exactly one place — createQuotation above — because a rewrite is
 * how #142 lost files: re-submitting an attachment URL that Airtable had
 * handed us hours earlier returns success and leaves the field empty. The save
 * path either keeps a Quotation record untouched or builds a new one from a
 * freshly uploaded Blob URL; there is no third case that needs to overwrite an
 * attachment in place.
 */
export async function updateQuotation(recordId, { vendorQuotationCode }) {
    const record = await base(TABLES.QUOTATIONS).update(recordId, {
        "Vendor Quotation Code": vendorQuotationCode || "",
    });
    return recordToQuotation(record);
}
