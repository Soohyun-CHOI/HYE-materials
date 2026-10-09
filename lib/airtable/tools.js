import { base, TABLES, findByRecordIds } from "./client";
import { TOOL_CATALOG_FIELDS } from "../toolCatalog";

/**
 * The KIND a tool is bought as (#334) — "DeWalt 20V drill", not the drill on the shelf —
 * and since #507 a row of the catalog a registration picks from. The object itself is
 * `Tool Items`, one row per physical unit.
 *
 * WHY THE KIND AND THE OBJECT ARE TWO TABLES. A company buys six of the same drill and then
 * tracks them one at a time: six labels, six locations, six histories, under one kind.
 * Folding them into one table means either six rows repeating the kind — which is how two
 * spellings of one kind appear — or one row that cannot say where any individual drill is.
 *
 * THE OFFICE FILLS THE CATALOG AND THE APP NEVER WRITES A ROW OF IT (#507). A kind is named
 * by its path — `Level 1` the category, `Level 2` the tool, `Size` the size — and carries a
 * `Class`; `Tool Name` is a formula over two of those, `{Level 2} {Size}`, and is what every
 * screen calls the kind. Until #507 a kind was a name typed on the registration form, found
 * or created under a lock (`upsertTool`, #338); a registration picks a row now, so this
 * module only reads. `lib/toolCatalog.js` says which rows a registration may pick, and why
 * the rest are set aside.
 *
 * NO MINTED ID, THE WAY `Vendors` AND `Materials` HAVE NONE. Nothing prints a kind and nobody
 * quotes one; its path is its identity, and one path is one kind by the catalog's own rule,
 * which Airtable cannot enforce — `readCatalog` offers the first row of a path and the
 * creation script reports the second. The minted ID lives one level down, where it is printed
 * onto a sticker.
 */
function recordToTool(record) {
    return {
        id: record.id,
        // A formula since #507, so the name a screen says is the base's, and the same in the
        // Airtable UI's links as on every page.
        toolName: record.get("Tool Name") || "",
        // Reverse-link, core link data with no propagation lag (see
        // client.js:getLinkedRecords), so exposing it costs no extra fetch. It is
        // how many of this kind the company owns, and it is also the id list the
        // tool items are read by.
        toolItems: record.get("Tool Items") || [],
        // The catalog's path and class (#507), under the names lib/toolCatalog.js reads them by.
        level1: record.get(TOOL_CATALOG_FIELDS.level1) || "",
        level2: record.get(TOOL_CATALOG_FIELDS.level2) || "",
        size: record.get(TOOL_CATALOG_FIELDS.size) || "",
        toolClass: record.get(TOOL_CATALOG_FIELDS.toolClass) || "",
    };
}

/**
 * Every tool, for the list at `/tools` (#339) and since #507 for the catalog a registration
 * picks from and the action that checks its pick.
 *
 * The whole table in one query, `Vendors`-shaped: a company's tool catalog is
 * bounded by what it buys rather than by activity, so this is tens of rows
 * and not thousands — one query per 100. Each row arrives carrying its `Tool Items` link
 * array, so finding a tool's units costs no query of its own — the same saving
 * `getAllJobs` takes for `Disciplines` and `Deliveries`.
 *
 * NO PER-STATUS ROLLUP ON `Tools`, DELIBERATELY, and the condition for adding one
 * is measurable rather than a matter of taste. #339's list gets its count per
 * status by reading the tool items this array names, one batch of 50 at a time,
 * so the page is `3 + ceil(tool items in scope / 50)` operations — the job list is
 * the third since #509 — which passes ten at 351 in the office's scope, the widest;
 * this said 2 and 401, true until the job list joined. At that point the count moves into a rollup and
 * `hasUninvoicedItems` is the worked example of the move (#244). Five rollups
 * nothing reads today would be five fields to keep in step for nothing.
 */
export async function getAllTools() {
    const records = await base(TABLES.TOOLS).select().all();
    return records.map(recordToTool);
}

/** Many kinds by record id, batched — one query per 50 (#193). */
export async function getToolsByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.TOOLS, recordIds)).map(recordToTool);
}
