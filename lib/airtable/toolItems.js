import { base, TABLES, findByRecordIds, findChildRecords, getLinkedRecords } from "./client";
import { formulaString } from "../airtableFormula";

/**
 * One physical tool — the thing a QR label is stuck to (#334).
 *
 * `Tool Item ID` IS THE PRINTED IDENTITY, which is what makes this table's
 * primary field different in kind from every other minted ID on this base. A PR
 * ID is read on a screen and a PO ID is read on a document; this one is
 * encoded into a sticker, glued to a drill, and carried onto a site. Two rows
 * sharing it means two tools wearing the same label, and the repair is reprinting
 * both. #335 mints it, and gives it a wider daily sequence than the document
 * families because one registration can create many units at once.
 *
 * `Status` IS WRITTEN BY THIS APP AND NEVER BY AN AIRTABLE FORMULA. It caches the
 * last `Tool Log` row, but "cache of the last row" is a mapping rather than a
 * copy — `Job Changed` is a last row that leaves the status alone, and the event
 * vocabulary is eight values against the status's five. lib/toolStatus.js holds
 * that mapping and the argument; docs/notes/tools.md holds the two platform facts
 * underneath it.
 *
 * `Job` IS REQUIRED, AND BY THIS APP RATHER THAN BY THE SCHEMA — Airtable cannot
 * make a link field required, the same limit `Invoice Items."PO Item"` lives with
 * (#278). A tool on this track never passes through the office: a site person buys
 * it, registers it and keeps it, so the row belongs to a job from the moment it
 * exists. `In Stock` is a tool at rest ON its job, not a tool belonging to nobody,
 * and a tool in repair, lost or retired still has the job it last belonged to.
 * There is no state this field would be empty in, so nothing here reads it as
 * optional.
 */
function recordToToolItem(record) {
    return {
        id: record.id,
        toolItemId: record.get("Tool Item ID"),
        // Single-record in practice, app-enforced: the Metadata API refuses
        // `prefersSingleRecordLink` on both CREATE and UPDATE (422), the same limit
        // `Invoices."Delivery"` and `Invoice Items."PO Item"` live with. Readers
        // take `[0]`.
        tool: record.get("Tool") || [],
        status: record.get("Status"),
        job: record.get("Job") || [],
        // Reverse-link, and the reason this record can be handed straight to
        // getToolLogByToolItem without a second parent find (#193).
        toolLog: record.get("Tool Log") || [],
    };
}

/**
 * One tool item by its printed `Tool Item ID`, or null.
 *
 * THE READER A SCANNED LABEL ARRIVES AT. A QR code carries a URL carrying this
 * id, so the lookup is by the printed value and not by a record id — nothing on
 * the sticker knows Airtable's own identifier. #340 settles the URL.
 */
export async function getToolItemByToolItemId(toolItemId) {
    const records = await base(TABLES.TOOL_ITEMS)
        .select({
            filterByFormula: `{Tool Item ID} = "${formulaString(toolItemId)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToToolItem(records[0]);
}

/** One tool item by record id, or null. */
export async function getToolItemByRecordId(recordId) {
    const record = await base(TABLES.TOOL_ITEMS).find(recordId);
    if (!record) return null;
    return recordToToolItem(record);
}

/** Many tool items by record id, batched — one query per 50 (#193). */
export async function getToolItemsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.TOOL_ITEMS, recordIds)).map(recordToToolItem);
}

/**
 * The units of one kind, via the parent's reverse-link (#339).
 *
 * `rowIds` — the parent's link array, when the caller already holds the `Tools`
 * record. `getAllTools` exposes it precisely so the kind list can pass it and skip
 * the parent find; omitting it costs one extra operation and behaves identically.
 */
export async function getToolItemsByTool(toolRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.TOOL_ITEMS, rowIds)
        : await getLinkedRecords(TABLES.TOOLS, toolRecordId, "Tool Items", TABLES.TOOL_ITEMS);
    return records.map(recordToToolItem);
}
