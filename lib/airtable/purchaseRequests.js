import { base, TABLES } from "./client";
import { generateNextPRId } from "../ids";

/**
 * Find a PR by its backend-generated PR ID (e.g. "HYE-PR-260710-07").
 * Returns null if not found.
 */
export async function getPRById(prId) {
    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `{PR ID} = "${prId}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;

    return recordToPR(records[0]);
}

/**
 * Find a PR by its Airtable record ID.
 * Returns null if not found.
 */
export async function getPRByRecordId(recordId) {
    const record = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    if (!record) return null;
    return recordToPR(record);
}

function recordToPR(record) {
    return {
        id: record.id,
        prId: record.get("PR ID"),
        requester: record.get("Requester"),
        line: record.get("Line"),
        job: record.get("Job"), // Lookup via Line — read-only, auto-follows the picked Line
        vendor: record.get("Vendor"),
        createdDate: record.get("Created Date"),
        status: record.get("Status"),
        currentSignerStep: record.get("Current Signer Step"),
        totalAmount: record.get("Total Amount"),
        notes: record.get("Notes"),
    };
}

/**
 * Create a new PR. PR ID is backend-generated via lib/ids.js — never
 * passed in by the caller. Total Amount is a rollup (read-only). The
 * Requester picks a Line, not a Job directly — Job is a Lookup through
 * Line and can't be written here (see CLAUDE.md's Purchase Requests entry).
 */
export async function createPR({ requesterId, lineId, vendorId, notes }) {
    const record = await generateNextPRId((prId) =>
        base(TABLES.PURCHASE_REQUESTS).create({
            "PR ID": prId,
            Requester: requesterId ? [requesterId] : [],
            Line: lineId ? [lineId] : [],
            Vendor: vendorId ? [vendorId] : [],
            "Created Date": new Date().toISOString().slice(0, 10),
            Status: "Draft",
            Notes: notes || "",
        })
    );

    return { id: record.id, prId: record.get("PR ID") };
}

/**
 * Partial update of a PR — e.g. Status transitions, Current Signer Step
 * advances. Only the fields passed in are written.
 */
export async function updatePR(recordId, { status, currentSignerStep, notes }) {
    const fields = {};
    if (status !== undefined) fields["Status"] = status;
    if (currentSignerStep !== undefined)
        fields["Current Signer Step"] = currentSignerStep;
    if (notes !== undefined) fields["Notes"] = notes;

    const record = await base(TABLES.PURCHASE_REQUESTS).update(recordId, fields);
    return recordToPR(record);
}
