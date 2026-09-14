import { base, TABLES, findChildRecords, getLinkedRecords } from "./client";
import { formulaString, orByField } from "../airtableFormula";
import { TOOL_EVENT } from "../toolStatus";
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
 * SIX FIELDS SINCE #376, WHICH ADDED `Checked Out To` — the person a tool item was
 * handed to, text rather than a link because the people who receive tools have no
 * account here, and on `Checked Out` rows alone. **It is not the field #363 removed
 * coming back under another name.** `Notes` was optional on every event and no row
 * ever filled it, which is why it had no rule and could go; this one is a function
 * of the event — always present on one, always absent on the other three — so both
 * directions are enforced at the writer and both are checkable.
 *
 * IT WAS FIVE UNTIL THEN, AFTER #363 TOOK `Notes` OFF THIS TABLE. It was carried for
 * one purpose — the reason a `Retired` event was to require — and that rule was
 * weighed and dropped rather than implemented, so the field had no remaining use
 * and no row had ever held a value in it (25 rows, 0 values, and 0 formulas,
 * rollups or lookups anywhere on the base referencing it, all measured first).
 * Nothing here reads or writes it as of this commit; **removing it from Airtable
 * is a hand step in the UI**, because the Metadata API offers CREATE and UPDATE
 * for a field and no DELETE — re-measured for this issue, 404 against the real
 * field id, which is docs/notes/airtable-access.md's own recording. What the
 * removal costs is the ability to say whether a retired tool was thrown away or
 * found missing at a stock check, and docs/notes/tools.md records that as a
 * decision rather than an omission.
 *
 * `Job` IS ON EVERY ROW AND IS NEVER BLANK, holding the job the tool item was on
 * at that event. That is the INVARIANT; where each event learns it is a separate
 * question with two answers (#363).
 *
 * A SCANNED EVENT TAKES IT FROM THE ACTOR — registration, check-out and check-in
 * read the `Users."Assigned Jobs"` of whoever performs the scan, and that is
 * sound because in all three the actor has the tool in their hands.
 *
 * THE DESIGNATED EVENT TAKES IT FROM THE TOOL ITEM. Retiring does not move a
 * tool and the person designating need not be near it, so the row inherits
 * `Tool Items."Job"` — where it was. Taking the actor's would write a site the
 * tool had never been on, which is not hypothetical: `HYE-TL-260909-004` was
 * checked in on one job and retired on another before #363 merged, and the
 * question this table exists for lost it.
 *
 * EITHER WAY IT IS STORED AT THAT MOMENT AND LOOKED UP NEVER: a log that read
 * the assignment later would make an old check-out describe today's, which is
 * the exact thing this copy exists to prevent. Inheriting copies an immutable
 * stored value at WRITE time and does not touch that rule.
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
        // #376 — on `Checked Out` rows and blank on the other three. Left as
        // `undefined` rather than coerced, so a reader can tell a row that was
        // never given one from a row given an empty string; nothing writes the
        // second, because `createToolLogEntry` refuses it.
        checkedOutTo: record.get("Checked Out To"),
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
 * How many rows the recent-names query reads, and why it is exactly one page.
 *
 * `firstPage()` returns at most 100, so capping here is what makes this ONE
 * Airtable operation whatever a job's history grows to — the figure matters
 * because this read sits on the screen a scan lands on. What it costs is stated
 * rather than hidden: a person whose last check-out on this job is older than the
 * hundredth most recent drops off the list. They can still be typed, and typing is
 * what the list is a shortcut for.
 */
const RECENT_CHECK_OUT_ROWS = 100;

/**
 * The most recent check-outs on a set of jobs, for the names they were handed to
 * (#376).
 *
 * FILTERED ON THE LINK'S OWN TEXT, WHICH IS NOT THE THING CLAUDE.md BARS.
 * `filterByFormula` cannot compare a link field to a RECORD ID — that is why
 * `Material Prices` carries two lookups — but a link renders in a formula as its
 * linked records' primary values, and `Jobs`' primary is the `Job Code`. Measured
 * on this base: `{Job} = "26-DEMO-01"` returned 24 of 31 rows and `26-DEMO-02`
 * returned the other 7. **The equality is right because this link holds exactly one
 * record**; a link holding several renders as a joined list and would need
 * `FIND()`. `docs/notes/airtable-access.md` carries the measurement and that
 * caveat, because copying this to a multi-record link would silently match nothing.
 *
 * SO NO LOOKUP FIELD AND NO REVERSE-LINK WALK. The lookup was the shape
 * `Materials."Category Code"` uses and it would have cost a field on this table and
 * a line in CLAUDE.md's data model; the walk through `Jobs."Tool Log"` would have
 * read every event on the job — registrations and check-ins included — at
 * `1 + ceil(N/50)` and grown without bound. This is one operation and stays one.
 *
 * EVERY JOB THE READER IS ASSIGNED TO, IN ONE QUERY. The picker can move between
 * them, and narrowing to the chosen one is `recentNamesFor`'s job in the browser —
 * a query per move is exactly what loading the list up front exists to avoid. An
 * empty list of codes yields `FALSE()` through `orByField` rather than the whole
 * table.
 *
 * A PARTIAL PROJECTION, MAPPED TO WHAT THIS ANSWERS. It reads four fields and
 * returns four; `recordToToolLogEntry`'s shape would have claimed a `Tool Log ID`
 * and a `Recorded By` this query never asked for.
 */
export async function getRecentCheckOuts({ jobCodes }) {
    const codes = (jobCodes || []).filter(Boolean);
    if (codes.length === 0) return [];

    const records = await base(TABLES.TOOL_LOG)
        .select({
            filterByFormula: `AND(
                ${orByField("Job", codes)},
                {Event} = "${formulaString(TOOL_EVENT.CHECKED_OUT)}",
                {Checked Out To} != ""
            )`,
            fields: ["Job", "Event", "Event At", "Checked Out To"],
            sort: [{ field: "Event At", direction: "desc" }],
            maxRecords: RECENT_CHECK_OUT_ROWS,
        })
        .firstPage();

    return records.map((record) => ({
        event: record.get("Event"),
        job: record.get("Job") || [],
        eventAt: record.get("Event At"),
        checkedOutTo: record.get("Checked Out To"),
    }));
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
    checkedOutTo,
}) {
    // APP-ENFORCED, SINCE AIRTABLE CANNOT MAKE A LINK FIELD REQUIRED — the same
    // limit `Invoice Items."PO Item"` lives with (#278) and the same guard
    // `createToolItems` opens with. Both of these are never-blank invariants that
    // the whole history rests on: the job is what makes the previous row's job
    // the previous job, and `logRowFacts` renders both on every row on the
    // strength of it.
    //
    // IT WROTE `[]` FOR A MISSING VALUE UNTIL #363, WHICH IS A HOLE NOTHING
    // COULD REACH AND NOW SOMETHING COULD. Every caller resolved a job out of
    // the actor's own assignments, so none could pass nothing; that issue made a
    // retirement inherit `Tool Items."Job"` instead, and the schema permits that
    // field to be empty even though the app does not. A silent blank would break
    // the invariant at the one place nothing checks it, so it throws.
    if (!jobRecordId) throw new Error("createToolLogEntry: a Job is required");
    if (!recordedByUserId) throw new Error("createToolLogEntry: a Recorded By is required");

    // #376 — `Checked Out To` IS A FUNCTION OF THE EVENT, AND BOTH DIRECTIONS ARE
    // HELD HERE. A check-out with no recipient loses the fact the field exists for;
    // any other event WITH one records a handover that did not happen, and both are
    // silent on every screen — `logRowFacts` renders the fifth fact on `Checked Out`
    // rows alone, so a name on a `Retired` row would sit in the base readable by
    // nothing. The form asks and `readSubmission` judges, and this is the third
    // place because a writer is where a never-blank invariant is actually kept:
    // `Job` is two lines up for the same reason, and #363 is what taught it — that
    // guard was unreachable until one caller stopped resolving the value itself.
    const isCheckOut = event === TOOL_EVENT.CHECKED_OUT;
    if (isCheckOut && !checkedOutTo) {
        throw new Error("createToolLogEntry: a Checked Out To is required on a check-out");
    }
    if (!isCheckOut && checkedOutTo) {
        throw new Error(`createToolLogEntry: a Checked Out To cannot be written on ${event}`);
    }

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
                Job: [jobRecordId],
                "Recorded By": [recordedByUserId],
                // Omitted rather than written empty on the three events that carry
                // no recipient, so a blank cell means the field was never given one
                // — the distinction the mapper above preserves.
                ...(isCheckOut ? { "Checked Out To": checkedOutTo } : {}),
                // When it happened, UTC instant, *At convention. The event and the
                // recording are one moment here by construction — a scan records
                // what it is doing as it does it — so there is no second date to
                // tell this one apart from, unlike `Deliveries."Received Date"`.
                "Event At": new Date().toISOString(),
            })
    );

    return recordToToolLogEntry(record);
}
