import { base, TABLES } from "./client";
import { generateChildId } from "../ids";

/**
 * List all quotations attached to a PR.
 */
export async function getQuotationsByPR(prRecordId) {
    const records = await base(TABLES.QUOTATIONS)
        .select({ filterByFormula: `{PR} = "${prRecordId}"` })
        .all();

    return records
        .filter((record) => {
            const linked = record.get("PR");
            return Array.isArray(linked) && linked.includes(prRecordId);
        })
        .map(recordToQuotation);
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
    const quotationId = await generateChildId({
        tableName: TABLES.QUOTATIONS,
        parentFieldName: "PR",
        parentRecordId: prRecordId,
        prefix: prId,
        padLength: 2,
        seqPrefix: "Q",
    });

    const record = await base(TABLES.QUOTATIONS).create({
        "Quotation ID": quotationId,
        "Vendor Quotation Code": vendorQuotationCode || "",
        Vendor: vendorId ? [vendorId] : [],
        PR: [prRecordId],
        File: file || [],
    });

    return recordToQuotation(record);
}
