import { base, TABLES } from "./client";
import { generateChildId } from "../ids";

/**
 * List all signers for a PR, in signing order.
 */
export async function getSignersByPR(prRecordId) {
    // Filters on the "PR Record ID" lookup field rather than the PR link
    // field itself — link fields can't be compared to a record ID in
    // filterByFormula (Airtable formulas see them as display text).
    const records = await base(TABLES.PR_SIGNERS)
        .select({
            filterByFormula: `{PR Record ID} = "${prRecordId}"`,
            sort: [{ field: "Sequence Order", direction: "asc" }],
        })
        .all();

    return records.map(recordToSigner);
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
        tableName: TABLES.PR_SIGNERS,
        parentFieldName: "PR",
        parentRecordId: prRecordId,
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
