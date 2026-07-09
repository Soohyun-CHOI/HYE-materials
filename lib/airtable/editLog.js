import { base, TABLES, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * List the full field-level edit history for a PR.
 */
export async function getEditLogByPR(prRecordId) {
    const records = await getLinkedRecords(
        TABLES.PURCHASE_REQUESTS,
        prRecordId,
        "Edit Log",
        TABLES.EDIT_LOG
    );

    return records.map(recordToEditLogEntry);
}

function recordToEditLogEntry(record) {
    return {
        id: record.id,
        editLogId: record.get("Edit Log ID"),
        pr: record.get("PR"),
        changedBy: record.get("Changed By"),
        fieldName: record.get("Field Name"),
        oldValue: record.get("Old Value"),
        newValue: record.get("New Value"),
        changedAt: record.get("Changed At"),
    };
}

/**
 * Append a single field-change entry. This is the evidence trail — it does
 * NOT invalidate earlier signer approvals, by design. Append-only, no
 * update function: entries are never edited once written.
 * Edit Log ID is backend-generated as {PR ID}-{seq}.
 */
export async function createEditLogEntry({
                                              prRecordId,
                                              prId,
                                              changedById,
                                              fieldName,
                                              oldValue,
                                              newValue,
                                          }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "Edit Log",
            prefix: prId,
            padLength: 3,
        },
        (editLogId) =>
            base(TABLES.EDIT_LOG).create({
                "Edit Log ID": editLogId,
                PR: [prRecordId],
                "Changed By": changedById ? [changedById] : [],
                "Field Name": fieldName,
                "Old Value": oldValue !== undefined && oldValue !== null ? String(oldValue) : "",
                "New Value": newValue !== undefined && newValue !== null ? String(newValue) : "",
                "Changed At": new Date().toISOString(),
            })
    );

    return recordToEditLogEntry(record);
}
