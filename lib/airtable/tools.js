import { base, TABLES, findByRecordIds, withKeyLock } from "./client";
import { formulaString } from "../airtableFormula";
import { normalizeItemText } from "../itemNaming";
import { toolNameKey } from "../toolRegistration";

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
 * constraint — so `upsertTool` below enforces it, find-or-create under a lock,
 * exactly as `upsertMaterial` enforces the `Materials` natural key (#338). The
 * minted ID lives one level down, where it is printed onto a sticker.
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
 * #338's duplicate gate, and it is `getMaterialByKey`'s comparison rather than a
 * second one: `LOWER(TRIM(…))` on both sides, over a value `normalizeItemText`
 * has already collapsed the internal whitespace of. `Impact Driver` and
 * `impact driver` are one tool, and letting both exist would split that tool's
 * count in two.
 *
 * THIS FUNCTION SAID AIRTABLE'S `=` WAS CASE-INSENSITIVE AND IT IS NOT.
 * Measured read-only against this base in #338: `{Vendor Name} = "brazos metals"`
 * returned 0 rows against a stored `Brazos Metals`, and so did the uppercased
 * form, while the `LOWER(TRIM(…))` pair returned 1 for both. So the gate as
 * written would have admitted a second tool under a differently cased name — the
 * exact split the paragraph above says it prevents — and the claim was carried in
 * docs/notes/tools.md as well, corrected there in the same commit. The
 * comparison a formula still cannot make is collapsing an internal run
 * (`Brazos  Metals` matched 0 rows either way), which is what the write side's
 * normalization is for.
 */
export async function getToolByName(toolName) {
    const records = await base(TABLES.TOOLS)
        .select({
            filterByFormula: `LOWER(TRIM({Tool Name})) = LOWER(TRIM("${formulaString(
                normalizeItemText(toolName)
            )}"))`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToTool(records[0]);
}

/**
 * Find-or-create the one `Tools` row for a typed name (#338).
 *
 * `upsertMaterial`'S SHAPE, DOWN TO THE LOCK KEY, and following it is the point
 * rather than a convenience: both tables carry a human-typed natural key that
 * Airtable cannot make unique, and two implementations of "is this the same
 * name" would diverge the first time one of them learned something.
 *
 * THE NAME IS NOT UPDATED ON A MATCH — the first spelling recorded wins, as it
 * does for a material. Rewriting it on every registration would let one person's
 * capitalization quietly overwrite another's, and the row's primary value would
 * change under everything already linked to it. The consequence to know about is
 * that the stored spelling may not match the newest registration's, which is why
 * the lookup is case-insensitive rather than relying on the two agreeing.
 *
 * NORMALIZED HERE RATHER THAN AT THE CALL SITE, so no caller can create an
 * unnormalized row — the same reason `upsertMaterial` normalizes inside itself.
 *
 * THE LOCK KEY IS `toolNameKey`'S OUTPUT, which is the comparison
 * `getToolByName` makes: names Airtable would call equal have to serialize
 * against each other here, or two submissions each read "nothing exists yet" and
 * each create a row. `withKeyLock` serializes within one process or invocation
 * only, so two concurrent Vercel invocations remain the residual every family on
 * this base lives with — the frontend's disable-on-click guard is the other half.
 * What differs here is that the repair is cheap: `Tools` mints no id, so a
 * duplicate row can be merged by hand without a printed label going wrong.
 */
export async function upsertTool({ toolName }) {
    const cleanName = normalizeItemText(toolName);
    if (!cleanName) throw new Error("upsertTool: a Tool Name is required");

    return withKeyLock(`tool::${toolNameKey(cleanName)}`, async () => {
        const existing = await getToolByName(cleanName);
        if (existing) return { tool: existing, created: false };

        const record = await base(TABLES.TOOLS).create({ "Tool Name": cleanName });
        return { tool: recordToTool(record), created: true };
    });
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
