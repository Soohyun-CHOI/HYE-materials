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
        // #181 — the column was `Field Name` and this key was `fieldName`. `Name`
        // on this base means a human-entered display name (`Item Name`,
        // `Vendor Name`, `PIC Name`); this is categorical, and that family takes
        // no `Name` (`Status`, `Role`, `Unit`). `field` also stops colliding with
        // this repo's other use of `fieldName` — an Airtable field's name in the
        // schema sense (lib/airtableFormula.js, client.js:findByFieldValues).
        field: record.get("Field"),
        oldValue: record.get("Old Value"),
        newValue: record.get("New Value"),
        changedAt: record.get("Changed At"),
        // Issue #69 — optional reason for the change; existing entries
        // (item-field edits, pre-#69) simply have this blank.
        notes: record.get("Notes"),
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
                                              field,
                                              oldValue,
                                              newValue,
                                              notes,
                                          }) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.PURCHASE_REQUESTS,
            parentRecordId: prRecordId,
            parentLinkFieldName: "Edit Log",
            childTableName: TABLES.EDIT_LOG,
            prefix: prId,
        },
        (editLogId) =>
            base(TABLES.EDIT_LOG).create(
                {
                    "Edit Log ID": editLogId,
                    PR: [prRecordId],
                    "Changed By": changedById ? [changedById] : [],
                    Field: field,
                    "Old Value": oldValue !== undefined && oldValue !== null ? String(oldValue) : "",
                    "New Value": newValue !== undefined && newValue !== null ? String(newValue) : "",
                    "Changed At": new Date().toISOString(),
                    "Notes": notes || "",
                }
                // NO `typecast` (#181), and the comment that used to be here is
                // why. It said auto-adding a missing choice "can't produce
                // garbage choices" because `field` is always one of a fixed set
                // of constants. That is true of the NAMES and false about the
                // consequence: typecast gives every option it creates the same
                // default color and nothing can recolor it afterwards, so the
                // two options this path minted — `Unit Price` when #78 renamed
                // the PR Item field, `Shipping Fee` when #69 added it — sit off
                // the palette the other six walk, permanently. Measured on this
                // field: the Metadata API refuses `options.choices` outright
                // (422), so no code here can clean up after itself.
                //
                // All seven labels this can write now exist as choices, so the
                // write needs no help. A label that does NOT exist should fail
                // loudly rather than silently mint an eighth — the same posture
                // `createDeliveryItem` takes on `Unit`, and the reason `DRUM`
                // could sit unnoticed on PR Items.
                //
                // Both halves measured on the live base (#181): a registered
                // label still writes with no typecast, and `"Quotation"` is
                // refused with `INVALID_MULTIPLE_CHOICE_OPTIONS: Insufficient
                // permissions to create new select option ""Quotation""` —
                // the same refusal Materials gives for `Unit: ""` — with the
                // option list byte-identical before and after.
                //
                // KNOW THE BLAST RADIUS BEFORE ADDING A LABEL: this throw does
                // not cost a log line, it costs the whole turn. Both call sites
                // are inside editAndContinueAction's try, whose catch reverts
                // every touched item, the Shipping Fee, the Quotations created
                // this turn and the signer's own status, then returns "Something
                // went wrong saving your changes. Please try again." — advice
                // that is wrong forever for this cause, since no retry can
                // succeed until the choice exists in the Airtable UI.
                //
                // NOT made best-effort outside that rollback, which is the shape
                // lib/materialsCache.js uses to stop a derived artifact undoing
                // what produced it. That artifact is re-derivable and this one is
                // not: a cache rebuilds from PO Items and a PO PDF regenerates
                // from its PO, but this row records the OLD value, which stops
                // existing the moment updateItem lands. Best-effort would apply a
                // price change and lose the only record of what it changed — a
                // hole in the evidence trail this table exists to be. Failing the
                // turn is the right trade; the label set not drifting is the fix,
                // and scripts/tests/offline/edit-log-fields.mjs is the pin.
            )
    );

    return recordToEditLogEntry(record);
}
