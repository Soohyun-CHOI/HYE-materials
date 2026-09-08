import { base, TABLES, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";

/**
 * The KIND a tool is bought as (#334) — "DeWalt 20V drill", not the drill on the
 * shelf. The object itself is `Tool Items`, one row per physical unit.
 *
 * WHY THE KIND AND THE OBJECT ARE TWO TABLES. A company buys six of the same
 * drill and then tracks them one at a time: six labels, six locations, six
 * histories, one name that a person typed once. Folding them into one table means
 * either six rows repeating the name — which is how two spellings of one kind
 * appear — or one row that cannot say where any individual drill is.
 *
 * NO MINTED ID, THE WAY `Vendors` AND `Materials` ARE. Nothing prints a kind and
 * nobody quotes one, so the name a person types is the identity. What that costs
 * is a uniqueness rule the schema cannot hold — Airtable has no unique
 * constraint — so #338 refuses a second kind with the same name through
 * `getToolByName` below. The minted ID lives one level down, where it is printed
 * onto a sticker.
 */
function recordToTool(record) {
    return {
        id: record.id,
        toolName: record.get("Tool Name") || "",
        // Reverse-link, core link data with no propagation lag (see
        // client.js:getLinkedRecords), so exposing it costs no extra fetch. It is
        // how many of this kind the company owns, and it is also the id list the
        // tool items are read by.
        toolItems: record.get("Tool Items") || [],
    };
}

/**
 * One kind by the name a person typed, or null.
 *
 * #338's duplicate gate. Airtable's `=` on a text field is case-insensitive, which
 * is the behavior wanted here — `Impact Driver` and `impact driver` are one kind,
 * and letting both exist would split a company's count in two.
 */
export async function getToolByName(toolName) {
    const records = await base(TABLES.TOOLS)
        .select({
            filterByFormula: `{Tool Name} = "${formulaString(toolName)}"`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToTool(records[0]);
}

/**
 * Every kind, for the list at `/tools` (#339).
 *
 * The whole table in one query, `Vendors`-shaped: a company's tool catalog is
 * bounded by what it has bought rather than by activity, so this is tens of rows
 * and not thousands. Each row arrives carrying its `Tool Items` link array, so
 * finding a kind's units costs no query of its own — the same saving
 * `getAllJobs` takes for `Disciplines` and `Deliveries`.
 *
 * NO PER-STATUS ROLLUP ON `Tools`, DELIBERATELY, and the condition for adding one
 * is measurable rather than a matter of taste: #339 needs a count per status, and
 * it can have it by reading the tool items this array names. If that walk measures
 * above roughly ten operations for the whole page, the count moves into a rollup
 * and `hasUninvoicedItems` is the worked example of the move (#244). Five rollups
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
