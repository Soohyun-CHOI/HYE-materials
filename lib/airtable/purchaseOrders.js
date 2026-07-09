import { base, TABLES } from "./client";
import { generateNextPOId } from "../ids";

/**
 * Find a PO by its backend-generated PO ID.
 * Returns null if not found.
 */
export async function getPOById(poId) {
    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `{PO ID} = "${poId}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToPO(records[0]);
}

/**
 * Find a PO by its Airtable record ID.
 * Returns null if not found.
 */
export async function getPOByRecordId(recordId) {
    const record = await base(TABLES.PURCHASE_ORDERS).find(recordId);
    if (!record) return null;
    return recordToPO(record);
}

function recordToPO(record) {
    return {
        id: record.id,
        poId: record.get("PO ID"),
        pr: record.get("PR"),
        vendor: record.get("Vendor"), // Lookup via PR — read-only
        quotationFile: record.get("Quotation File"), // Lookup — read-only
        ourPic: record.get("Our PIC"),
        ourManager: record.get("Our Manager"),
        createdDate: record.get("Created Date"),
        presidentSigned: record.get("President Signed") || false,
        presidentSignedAt: record.get("President Signed At"),
        status: record.get("Status"),
        poPdfFile: record.get("PO PDF File"),
        totalAmount: record.get("Total Amount"), // rollup — read-only
        deliveryAddressUsed: record.get("Delivery Address Used"),
    };
}

/**
 * Create a PO from a signed PR. PO ID is backend-generated. Vendor,
 * Quotation File, and Total Amount are Lookups/rollup — never set directly.
 */
export async function createPO({
                                    prRecordId,
                                    ourPicId,
                                    ourManagerId,
                                    deliveryAddressUsed,
                                }) {
    const poId = await generateNextPOId();

    const record = await base(TABLES.PURCHASE_ORDERS).create({
        "PO ID": poId,
        PR: [prRecordId],
        "Our PIC": ourPicId ? [ourPicId] : [],
        "Our Manager": ourManagerId ? [ourManagerId] : [],
        "Created Date": new Date().toISOString().slice(0, 10),
        Status: "Draft",
        "Delivery Address Used": deliveryAddressUsed,
    });

    return recordToPO(record);
}

/**
 * Partial update of a PO — e.g. president signing, status transitions,
 * attaching the generated PDF.
 */
export async function updatePO(
    recordId,
    { presidentSigned, presidentSignedAt, status, poPdfFile }
) {
    const fields = {};
    if (presidentSigned !== undefined)
        fields["President Signed"] = presidentSigned;
    if (presidentSignedAt !== undefined)
        fields["President Signed At"] = presidentSignedAt;
    if (status !== undefined) fields["Status"] = status;
    if (poPdfFile !== undefined) fields["PO PDF File"] = poPdfFile;

    const record = await base(TABLES.PURCHASE_ORDERS).update(recordId, fields);
    return recordToPO(record);
}
