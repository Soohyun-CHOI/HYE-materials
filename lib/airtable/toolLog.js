import { base, TABLES, findChildRecords, getLinkedRecords } from "./client";
import { generateChildId } from "../ids";

/**
 * What has happened to one tool item (#334). Append-only, one row per event, and
 * the record `Tool Items."Status"` is a cache of.
 *
 * WHY A LOG AND NOT JUST A STATUS. A status field answers where a tool is now and
 * nothing at all about the project that just ended — and the question a site asks
 * when a job closes is which tools went out on it, which is a question about the
 * past. The status cannot answer it after the tool has moved on, so the events are
 * kept.
 *
 * NO UPDATE FUNCTION AND THERE MUST NOT BE ONE, the same shape as
 * lib/airtable/prEditLog.js: a row records what was true at a moment, and a moment
 * does not change. Correcting a mistaken scan is another row, not an edit.
 *
 * `Job` IS ON EVERY ROW AND IS NEVER BLANK, holding the job the event happened on
 * — which is where the tool item is immediately after it. It comes from the
 * `Users."Assigned Jobs"` of whoever performs the scan and is STORED AT THAT
 * MOMENT: a log that looked the assignment up later would make an old check-out
 * describe today's, which is the exact thing this copy exists to prevent.
 *
 * `Tool Items."Job"` IS A CACHE OF THIS COLUMN ON THE LATEST ROW, so a lookup
 * through it would make every row of the history say where the tool is now.
 *
 * AND BECAUSE THERE ARE NO BLANKS, THE PREVIOUS ROW'S `Job` IS THE PREVIOUS JOB.
 * A check-in on a different job than the check-out before it IS the record of a
 * tool changing site — which is why #335 removed the `Job Changed` event, and why
 * nothing here stores a `Former Job`. That was the rejected alternative (see
 * docs/notes/tools.md): one fact in two places, derivable from an ordering the
 * log already has. #340 renders the whole history at once and so holds both rows.
 */
function recordToToolLogEntry(record) {
    return {
        id: record.id,
        toolLogId: record.get("Tool Log ID"),
        toolItem: record.get("Tool Item") || [],
        event: record.get("Event"),
        job: record.get("Job") || [],
        recordedBy: record.get("Recorded By") || [],
        eventAt: record.get("Event At"),
        notes: record.get("Notes") || "",
    };
}

/**
 * The full history of one tool item, oldest first (#340).
 *
 * `rowIds` (#193) — the parent's link array, when the caller already holds the
 * tool item record. `recordToToolItem` exposes `toolLog` for exactly that, so the
 * detail page pays `ceil(N/50)` instead of `1 + ceil(N/50)`. Either way the rows
 * come back in link-array order — creation order, which for an append-only table
 * is chronological — and a link that does not resolve throws, which is what
 * findChildRecords is for.
 */
export async function getToolLogByToolItem(toolItemRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.TOOL_LOG, rowIds)
        : await getLinkedRecords(TABLES.TOOL_ITEMS, toolItemRecordId, "Tool Log", TABLES.TOOL_LOG);
    return records.map(recordToToolLogEntry);
}

/**
 * Append one event. `Tool Log ID` is backend-generated as {Tool Item ID}-{seq},
 * the same child-ID shape as PR/PO/Invoice/Delivery Items.
 *
 * THIS FUNCTION IS WHY `"Tool Items::Tool Log"` CAN BE REGISTERED IN `CHILD_KINDS`
 * BEFORE ANY SCREEN WRITES A ROW. `offline/id-sequence.mjs` requires every
 * registered relation to have a `generateChildId` call site under `lib/` and does
 * not ask whether anything calls that site in turn — so the shape can live in one
 * place, in code, from the commit that creates the table. The alternative was
 * stating `{Tool Item ID}-{seq}` in the Airtable field description and having #338
 * implement it from there, which is the same rule written twice with no way for
 * either copy to check the other.
 *
 * IT ALSO CANNOT BE NARROWER THAN A WRITER, which is worth saying because "an
 * issuance helper" sounds like it could be. `generateChildId` calls `createFn`
 * INSIDE the per-parent lock, and that is the whole mechanism preventing two
 * concurrent scans from minting one id — a helper that returned an id for the
 * caller to use would hand it out with the lock already released. So minting and
 * creating are one function by construction.
 *
 * `event` COMES FROM lib/toolStatus.js AND NEVER FROM A LITERAL, the rule
 * `createEditLogEntry` already has for `Field`. `Event` is a singleSelect written
 * with no `typecast`, so a value outside the option list fails the write rather
 * than silently minting a ninth choice off the color palette — the `DRUM` failure
 * (CLAUDE.md) and the two miscolored `Edit Log` options (#181) are what that
 * posture is for. The Metadata API cannot repair an option list afterwards (422,
 * measured), so failing loudly is the only recovery that exists.
 *
 * THE CALLER WRITES `Tool Items."Status"` SEPARATELY, and this function does not
 * do it for them. Airtable has no cross-table transaction, so the log row and the
 * cached status are two writes whichever way they are arranged; putting the status
 * write here would hide that fact behind a function that looks atomic. #338 and
 * #362 own the ordering — `updateToolItemCache` is the other half — and
 * `statusAfterEvent` owns which value. **This said #338 and #341 until #362**, and
 * #341 is closed: #335 removed the `Job Changed` event that issue was to write, so
 * it owns no ordering and never did.
 */
export async function createToolLogEntry({
    toolItemRecordId,
    toolItemId,
    event,
    jobRecordId,
    recordedByUserId,
    notes,
}) {
    const record = await generateChildId(
        {
            parentTableName: TABLES.TOOL_ITEMS,
            parentRecordId: toolItemRecordId,
            parentLinkFieldName: "Tool Log",
            childTableName: TABLES.TOOL_LOG,
            prefix: toolItemId,
        },
        (toolLogId) =>
            base(TABLES.TOOL_LOG).create({
                "Tool Log ID": toolLogId,
                "Tool Item": [toolItemRecordId],
                Event: event,
                Job: jobRecordId ? [jobRecordId] : [],
                "Recorded By": recordedByUserId ? [recordedByUserId] : [],
                // When it happened, UTC instant, *At convention. The event and the
                // recording are one moment here by construction — a scan records
                // what it is doing as it does it — so there is no second date to
                // tell this one apart from, unlike `Deliveries."Received Date"`.
                "Event At": new Date().toISOString(),
                Notes: notes || "",
            })
    );

    return recordToToolLogEntry(record);
}
