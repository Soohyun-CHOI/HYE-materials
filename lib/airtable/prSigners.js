import { base, TABLES, findByRecordIds, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * Many signer rows by record id, batched (#217).
 *
 * FOR READING SEVERAL CHAINS AT ONCE, which `getSignersByPR` cannot do without one
 * round trip per request: it walks the parent's reverse-link, so N requests cost N
 * `.find()` calls plus their children. A caller that already holds the requests —
 * `recordToPR` carries `signerRowIds` — has the child ids in hand and can take the
 * whole level in one query.
 *
 * DELIBERATELY UNSORTED, unlike that function. Order within one chain is
 * `Sequence Order` and belongs to whoever groups these rows back into chains, which
 * is `lib/overage.js:selectCopyableSigners`; sorting a mixed-parent batch here would
 * interleave two chains and read as one.
 */
export async function getSignersByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.PR_SIGNERS, recordIds)).map(recordToSigner);
}

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
        // Issue #66 — procedural tag (Approval/Agreement), not a workflow
        // branch: the confirm-and-advance action is identical either way,
        // this only changes what the history log and signing UI call it.
        confirmationType: record.get("Confirmation Type"),
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
                                        confirmationType,
                                        notes,
                                    }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "PR Signers",
            childTableName: TABLES.PR_SIGNERS,
            prefix: prId,
        },
        (prSignerId) =>
            base(TABLES.PR_SIGNERS).create({
                "PR Signer ID": prSignerId,
                PR: [prRecordId],
                Signer: signerUserId ? [signerUserId] : [],
                "Sequence Order": sequenceOrder,
                Status: "Pending",
                "Confirmation Type": confirmationType,
                Notes: notes || "",
            })
    );

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
