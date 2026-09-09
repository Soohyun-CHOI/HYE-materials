import { base, TABLES, findByRecordIds, findChildRecords, getLinkedRecords } from "./client";
import { formulaString } from "../airtableFormula";
import { normalizeItemText } from "../itemNaming";
import { generateNextToolItemIds } from "../ids";
import { TOOL_STATUS } from "../toolStatus";

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
 * `Status` AND `Job` ARE BOTH CACHES OF THE LAST `Tool Log` ROW, written by this
 * app in the same operation as that row and never by an Airtable formula. They
 * are the same kind of value and they come from the same row: the status that
 * event left behind, and the job it happened on. lib/toolStatus.js holds the
 * first mapping — four events against three statuses, so it is a mapping rather
 * than a copy — and the job is carried straight across.
 *
 * `Job` SAYS WHERE THE TOOL WAS LAST SCANNED, NOT WHICH JOB OWNS IT, and #335
 * corrected that: a manager scans out their own job's tools, a worker may carry
 * one to another site, and whoever manages the site it reaches scans it back in.
 * A tool moving between jobs is therefore already two log rows — a check-out on
 * one job and the next check-in on another — which is why there is no
 * `Job Changed` event and no separate reassignment.
 *
 * IT IS REQUIRED, AND BY THIS APP RATHER THAN BY THE SCHEMA — Airtable cannot
 * make a link field required, the same limit `Invoice Items."PO Item"` lives with
 * (#278). Never empty, because every event carries a job and registration is an
 * event. Where the job COMES FROM is the actor: the `Users."Assigned Jobs"` of
 * whoever performs the scan, stored at that moment and never looked up later.
 * docs/notes/tools.md has why that snapshot matters.
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
 * THE READER A SCANNED LABEL ARRIVES AT, and #340 settled the address it serves:
 * `/tools/[toolItemId]`, flat, one segment under `/tools`. A QR code carries a
 * URL carrying this id, so the lookup is by the printed value and not by a
 * record id — nothing on the sticker knows Airtable's own identifier.
 *
 * CASE-INSENSITIVE, AND THE SECOND WAY TO THIS PAGE IS WHY (#340). The label
 * prints the id in characters a person can read alongside the QR code, which is
 * the arrangement for a symbol that has been scratched or painted over — so the
 * fallback path is somebody typing the id by hand, on a site, in gloves. This
 * lookup was a bare `=`, which #338 measured to be CASE-SENSITIVE on a text
 * field, so `hye-tl-260909-001` was a miss and the fallback amounted to asking
 * for exact capitals. `LOWER(TRIM(…))` is `getMaterialByKey`'s and
 * `getToolByName`'s comparison, and `normalizeItemText` collapses the internal
 * whitespace a formula cannot.
 *
 * IT DOES NOT MAKE TWO ADDRESSES FOR ONE TOOL ITEM: the page redirects a
 * non-canonical segment to the stored id, so the address a sticker carries stays
 * the only one that answers directly. That matters more here than anywhere else
 * on this base, because the address is printed and a moved one means reprinting
 * every label already on a tool.
 */
export async function getToolItemByToolItemId(toolItemId) {
    const records = await base(TABLES.TOOL_ITEMS)
        .select({
            filterByFormula: `LOWER(TRIM({Tool Item ID})) = LOWER(TRIM("${formulaString(
                normalizeItemText(toolItemId)
            )}"))`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToToolItem(records[0]);
}

/**
 * Many tool items by record id, batched — one query per 50 (#193).
 *
 * `/tools` IS THE CALLER, AND IT IS THE ONE THIS READER WAS WRITTEN FOR (#339).
 * That list needs a count per status, and `docs/notes/tools.md` settled where it
 * comes from: the `Tool Items` link array `getAllTools` already returns for free.
 * Flattening those arrays across every tool and reading them here is
 * `1 + ceil(total/50)` operations, against one call per tool otherwise — so this
 * is the function that makes the no-rollup decision affordable. It sat with no
 * caller from #334 until then, which #340 recorded rather than deleting it the
 * way it deleted `getToolItemByRecordId` beside it.
 */
export async function getToolItemsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.TOOL_ITEMS, recordIds)).map(recordToToolItem);
}

/**
 * The tool items of one tool, via the parent's reverse-link (#339).
 *
 * `rowIds` — the parent's link array, when the caller already holds the `Tools`
 * record. `getToolsByRecordIds` exposes it precisely so the tool's page can pass
 * it and skip the parent find; omitting it costs one extra operation and behaves
 * identically.
 *
 * A SLICE OF THAT ARRAY IS A LEGITIMATE ARGUMENT AND IS WHAT PAGING PASSES.
 * `/tools/tool/[toolRecordId]` chooses its page from the link array before
 * anything is fetched and hands over only the ids on it, so the read is one
 * batched query whatever the tool's size. `findChildRecords` keeps the array's
 * order and throws on an id that does not resolve, and both hold for a slice.
 */
export async function getToolItemsByTool(toolRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.TOOL_ITEMS, rowIds)
        : await getLinkedRecords(TABLES.TOOLS, toolRecordId, "Tool Items", TABLES.TOOL_ITEMS);
    return records.map(recordToToolItem);
}

/**
 * Register `count` physical tools of one kind (#335).
 *
 * THE MINT AND THE CREATE ARE ONE FUNCTION, which is structural rather than a
 * choice. `generateNextToolItemIds` calls its callback INSIDE the per-prefix
 * lock, because reading the highest sequence and writing the rows that claim it
 * have to be one critical section — a helper that returned ids for the caller to
 * use would hand them out with the lock already released. So there is no "issue
 * an id" function to be had, here or anywhere else in lib/ids.js.
 *
 * ONE QUERY FOR THE WHOLE BATCH, and the ids are contiguous. That is what the
 * plural generator buys: minting one at a time would re-read the day's rows per
 * tool item, and two people registering at once would interleave their numbers.
 *
 * SEQUENTIAL WRITES, ONE ROW PER REQUEST. Airtable allows five requests a second
 * and up to ten records per create, so a large registration could be an order of
 * magnitude cheaper — nothing in this repository batches a create yet, and #338
 * owns the bulk path and the figure that would justify it. What is here is the
 * shape that is obviously correct: the rows land in id order, and a failure stops
 * the rest rather than firing three hundred requests at a rate limit.
 *
 * NOTHING ROLLS BACK, AND THE RETURN SHAPE SAYS SO. A create that fails leaves
 * the rows before it standing, because undoing them would delete ids the daily
 * counter has already spent and a later registration would then re-issue them
 * — `nextSequence` is MAX + 1, so the gap a failure leaves costs nothing while a
 * reused number costs two labels on two tools. The caller gets what was created
 * and what was not, and #338 decides what to say about it.
 *
 * `Status` COMES FROM lib/toolStatus.js AND NEVER FROM A LITERAL: registration is
 * the `Registered` event, and `statusAfterEvent` says that leaves the tool item
 * `In Stock`. The first `Tool Log` row is #338's to write, in the same action.
 */
export async function createToolItems({ toolRecordId, jobRecordId, count }) {
    if (!toolRecordId) throw new Error("createToolItems: a Tool is required");
    // App-enforced, since Airtable cannot make a link field required. Refused here
    // rather than at the form alone: a tool item with no job reaches no screen.
    if (!jobRecordId) throw new Error("createToolItems: a Job is required");

    return generateNextToolItemIds(count, async (toolItemIds) => {
        const created = [];
        const failed = [];
        for (const toolItemId of toolItemIds) {
            try {
                const record = await base(TABLES.TOOL_ITEMS).create({
                    "Tool Item ID": toolItemId,
                    Tool: [toolRecordId],
                    Status: TOOL_STATUS.IN_STOCK,
                    Job: [jobRecordId],
                });
                created.push(recordToToolItem(record));
            } catch (error) {
                failed.push({ toolItemId, error });
                break;
            }
        }
        return { created, failed };
    });
}
