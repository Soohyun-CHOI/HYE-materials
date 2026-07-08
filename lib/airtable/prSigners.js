import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all signers for a PR, in signing order.
 */
export async function getSignersByPR(prRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_REQUESTS,
        prRecordId,
        "PR Signers",
        TABLES.PR_SIGNERS
    );

    // getLinkedRecords fetches children individually (no server-side sort),
    // so ordering by Sequence Order happens client-side here.
    return records
        .map(recordToSigner)
        .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
}

function recordToSigner(record) {
    return {
        id: record.id,
        prSignerId: record.get("PR Signer ID"),
        pr: record.get("PR"),
        signer: record.get("Signer"),
        sequenceOrder: record.get("Sequence Order"),
        status: record.get("Status"),
        signedAt: record.get("Signed At"),
        notes: record.get("Notes"),
    };
}

/**
 * Add a signer to a PR's signing chain. PR Signer ID is backend-generated
 * as {PR ID}-{seq}, resetting per PR.
 */
export async function createSigner({
                                        prRecordId,
                                        prId,
                                        signerUserId,
                                        sequenceOrder,
                                        notes,
                                    }) {
    const prSignerId = await generateChildId({
        parentTableName: TABLES.PURCHASE_REQUESTS,
        parentRecordId: prRecordId,
        parentLinkFieldName: "PR Signers",
        prefix: prId,
        padLength: 3,
    });

    const record = await base(TABLES.PR_SIGNERS).create({
        "PR Signer ID": prSignerId,
        PR: [prRecordId],
        Signer: signerUserId ? [signerUserId] : [],
        "Sequence Order": sequenceOrder,
        Status: "Pending",
        Notes: notes || "",
    });

    return recordToSigner(record);
}

/**
 * Partial update of a signer record — e.g. Status change on approve /
 * edit-and-continue / return-for-correction, Signed At timestamp.
 */
export async function updateSigner(recordId, { status, signedAt, notes }) {
    const fields = {};
    if (status !== undefined) fields["Status"] = status;
    if (signedAt !== undefined) fields["Signed At"] = signedAt;
    if (notes !== undefined) fields["Notes"] = notes;

    const record = await base(TABLES.PR_SIGNERS).update(recordId, fields);
    return recordToSigner(record);
}
