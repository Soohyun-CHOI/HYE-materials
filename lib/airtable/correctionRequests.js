import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all correction requests for a PR.
 */
export async function getCorrectionRequestsByPR(prRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_REQUESTS,
        prRecordId,
        "Correction Requests",
        TABLES.CORRECTION_REQUESTS
    );

    return records.map(recordToCorrectionRequest);
}

function recordToCorrectionRequest(record) {
    return {
        id: record.id,
        correctionRequestId: record.get("Correction Request ID"),
        pr: record.get("PR"),
        initiatedBy: record.get("Initiated By"),
        sentTo: record.get("Sent To"),
        notes: record.get("Notes"),
        requestedAt: record.get("Requested At"),
        resolvedAt: record.get("Resolved At"),
        status: record.get("Status"),
    };
}

/**
 * Log a "return for correction" action. Sent To can be any earlier signer,
 * the requester, or the initiator themselves. Correction Request ID is
 * backend-generated as {PR ID}-{seq}.
 */
export async function createCorrectionRequest({
                                                   prRecordId,
                                                   prId,
                                                   initiatedById,
                                                   sentToId,
                                                   notes,
                                               }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "Correction Requests",
            prefix: prId,
            padLength: 3,
        },
        (correctionRequestId) =>
            base(TABLES.CORRECTION_REQUESTS).create({
                "Correction Request ID": correctionRequestId,
                PR: [prRecordId],
                "Initiated By": initiatedById ? [initiatedById] : [],
                "Sent To": sentToId ? [sentToId] : [],
                Notes: notes || "",
                "Requested At": new Date().toISOString(),
                Status: "Pending",
            })
    );

    return recordToCorrectionRequest(record);
}

/**
 * Mark a correction request resolved once the target signer has made the fix.
 */
export async function resolveCorrectionRequest(recordId, { resolvedAt } = {}) {
    const record = await base(TABLES.CORRECTION_REQUESTS).update(recordId, {
        Status: "Resolved",
        "Resolved At": resolvedAt || new Date().toISOString(),
    });

    return recordToCorrectionRequest(record);
}
