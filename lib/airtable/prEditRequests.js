import { base, TABLES, findChildRecords, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List all edit requests for a PR.
 *
 * THE TABLE WAS `Correction Requests` UNTIL #333, and the rename is two facts
 * rather than one. The `PR` prefix is the child-table convention every other
 * child on this base already follows (`PR Items`, `PR Signers`, `PO Items`,
 * `Invoice Items`, `Delivery Items`) — a table named for its parent. The word is
 * `edit`, because a correction request asked for an edit, what it produces is a
 * row in the PR Edit Log, and the screen where either happens says `Edit and
 * continue`: one act had two words and this file was half of the evidence.
 *
 * THE SCREEN STILL SAYS `correction` AND THAT IS DELIBERATE (#333). The wording
 * is Design's, so `Return for correction`, the two history lines and the progress
 * bar's tooltip are unchanged, and the identifiers that mirror them by name —
 * `returnForCorrectionAction`, `ReturnForCorrectionForm`,
 * `ROLLBACK_ACT.returnForCorrection`, `RESTORE.correctionCreated` — are unchanged
 * with them. `docs/briefs/design-copy-findings.md` carries the list so the sweep
 * is already enumerated on the day a word is chosen. What moved is every name
 * that points at this TABLE or its ROWS, which is what this issue was for.
 *
 * `rowIds` (#193) — the parent's link array, when the caller already holds the
 * parent record. Supplying it skips the parent find; omitting it keeps the
 * previous behavior exactly. Either way the children come back in link-array
 * order and a link that does not resolve throws, which is what findChildRecords
 * is for.
 */
export async function getEditRequestsByPR(prRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.PR_EDIT_REQUESTS, rowIds)
        : await getLinkedRecords(TABLES.PURCHASE_REQUESTS, prRecordId, "PR Edit Requests", TABLES.PR_EDIT_REQUESTS);

    return records.map(recordToEditRequest);
}

function recordToEditRequest(record) {
    return {
        id: record.id,
        editRequestId: record.get("PR Edit Request ID"),
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
 * the requester, or the initiator themselves. PR Edit Request ID is
 * backend-generated as {PR ID}-{seq}.
 *
 * NO PREFIX OF ITS OWN IS MINTED INTO THAT ID, and #333 checked rather than
 * assumed it: the value is the parent's `PR ID` plus a three-digit sequence
 * (`HYE-PR-260819-02-001`), so no stored value ever carried the retired word and
 * the rename cost no fixture. Adding a `seqPrefix` the way a Quotation carries
 * `Q` was weighed and refused — `PR Items`, `PR Signers` and `PR Edit Log` all
 * mint `{PR ID}-###` and none is aware of the others' numbers, so a letter on one
 * of the four would make them read as three of a kind plus one, for no defect.
 */
export async function createEditRequest({
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
            parentLinkFieldName: "PR Edit Requests",
            childTableName: TABLES.PR_EDIT_REQUESTS,
            prefix: prId,
        },
        (editRequestId) =>
            base(TABLES.PR_EDIT_REQUESTS).create({
                "PR Edit Request ID": editRequestId,
                PR: [prRecordId],
                "Initiated By": initiatedById ? [initiatedById] : [],
                "Sent To": sentToId ? [sentToId] : [],
                Notes: notes || "",
                "Requested At": new Date().toISOString(),
                Status: "Pending",
            })
    );

    return recordToEditRequest(record);
}

/**
 * Mark an edit request resolved once the target signer has made the fix.
 */
export async function resolveEditRequest(recordId, { resolvedAt } = {}) {
    const record = await base(TABLES.PR_EDIT_REQUESTS).update(recordId, {
        Status: "Resolved",
        "Resolved At": resolvedAt || new Date().toISOString(),
    });

    return recordToEditRequest(record);
}
