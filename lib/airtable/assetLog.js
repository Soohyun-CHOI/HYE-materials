import { base, TABLES, createRecords, findChildRecords, getLinkedRecords } from "./client";
import { formulaString, orByField } from "../airtableFormula";
import { ASSET_EVENT, ASSET_EVENT_VALUES } from "../assetStatus";
import { generateChildId, generateFirstChildIds } from "../ids";

/**
 * What has happened to one asset (#334). Append-only, one row per event, and
 * the record `Assets."Status"` is a cache of.
 *
 * WHY A LOG AND NOT JUST A STATUS. A status field answers where an asset is now and
 * nothing at all about the project that just ended — and the question a site asks
 * when a job closes is which assets went out on it, which is a question about the
 * past. The status cannot answer it after the asset has moved on, so the events are
 * kept.
 *
 * NO UPDATE FUNCTION AND THERE MUST NOT BE ONE, the same shape as
 * lib/airtable/prEditLog.js: a row records what was true at a moment, and a moment
 * does not change. Correcting a mistaken scan is another row, not an edit.
 *
 * SIX FIELDS SINCE #376, WHICH ADDED `Checked Out To` — the person an asset was
 * handed to, text rather than a link because the people who receive assets have no
 * account here, and on `Checked out` rows alone. **It is not the field #363 removed
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
 * removal costs is the ability to say whether a retired asset was thrown away or
 * found missing at a stock check, and docs/notes/tools.md records that as a
 * decision rather than an omission.
 *
 * `Job` IS ON EVERY ROW AND IS NEVER BLANK, holding the job the asset was on
 * at that event. That is the INVARIANT; where each event learns it is a separate
 * question with two answers (#363).
 *
 * A SCANNED EVENT TAKES IT FROM THE ACTOR — registration, check-out and check-in
 * read the `Users."Assigned Jobs"` of whoever performs the scan, and that is
 * sound because in all three the actor has the asset in their hands.
 *
 * THE DESIGNATED EVENT TAKES IT FROM THE ASSET. Retiring does not move an
 * asset and the person designating need not be near it, so the row inherits
 * `Assets."Job"` — where it was. Taking the actor's would write a site the
 * asset had never been on, which is not hypothetical: `HYE-TL-260909-004`,
 * `HYE-AST-260909-004` since #513, was checked in on one job and retired on
 * another before #363 merged, and the question this table exists for lost it.
 *
 * EITHER WAY IT IS STORED AT THAT MOMENT AND LOOKED UP NEVER: a log that read
 * the assignment later would make an old check-out describe today's, which is
 * the exact thing this copy exists to prevent. Inheriting copies an immutable
 * stored value at WRITE time and does not touch that rule.
 *
 * `Assets."Job"` IS A CACHE OF THIS COLUMN ON THE LATEST ROW, so a lookup
 * through it would make every row of the history say where the asset is now.
 *
 * AND BECAUSE THERE ARE NO BLANKS, THE PREVIOUS ROW'S `Job` IS THE PREVIOUS JOB.
 * A check-in on a different job than the check-out before it IS the record of an
 * asset changing site — which is why #335 removed the `Job Changed` event, and why
 * nothing here stores a `Former Job`. That was the rejected alternative (see
 * docs/notes/tools.md): one fact in two places, derivable from an ordering the
 * log already has. #340 renders the whole history at once and so holds both rows.
 */
function recordToAssetLogEntry(record) {
    return {
        id: record.id,
        assetLogId: record.get("Asset Log ID"),
        asset: record.get("Asset") || [],
        event: record.get("Event"),
        job: record.get("Job") || [],
        recordedBy: record.get("Recorded By") || [],
        eventAt: record.get("Event At"),
        // #376 — on `Checked out` rows and blank on the other three. Left as
        // `undefined` rather than coerced, so a reader can tell a row that was
        // never given one from a row given an empty string; nothing writes the
        // second, because `createAssetLogEntry` refuses it.
        checkedOutTo: record.get("Checked Out To"),
    };
}

/**
 * The full history of one asset, oldest first (#340).
 *
 * `rowIds` (#193) — the parent's link array, when the caller already holds the
 * asset record. `recordToAsset` exposes `assetLog` for exactly that, so the
 * detail page pays `ceil(N/50)` instead of `1 + ceil(N/50)`. Either way the rows
 * come back in link-array order — creation order, which for an append-only table
 * is chronological — and a link that does not resolve throws, which is what
 * findChildRecords is for.
 */
export async function getAssetLogByAsset(assetRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.ASSET_LOG, rowIds)
        : await getLinkedRecords(TABLES.ASSETS, assetRecordId, "Asset Log", TABLES.ASSET_LOG);
    return records.map(recordToAssetLogEntry);
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
 * a line in CLAUDE.md's data model; the walk through `Jobs."Asset Log"` would have
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
 * returns four; `recordToAssetLogEntry`'s shape would have claimed an `Asset Log ID`
 * and a `Recorded By` this query never asked for.
 */
export async function getRecentCheckOuts({ jobCodes }) {
    const codes = (jobCodes || []).filter(Boolean);
    if (codes.length === 0) return [];

    const records = await base(TABLES.ASSET_LOG)
        .select({
            filterByFormula: `AND(
                ${orByField("Job", codes)},
                {Event} = "${formulaString(ASSET_EVENT.CHECKED_OUT)}",
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
 * Append one event. `Asset Log ID` is backend-generated as {Asset ID}-{seq},
 * the same child-ID shape as PR/PO/Invoice/Delivery Items.
 *
 * THIS FUNCTION IS WHY `"Assets::Asset Log"` CAN BE REGISTERED IN `CHILD_KINDS`
 * BEFORE ANY SCREEN WRITES A ROW. `offline/id-sequence.mjs` requires every
 * registered relation to have a `generateChildId` call site under `lib/` and does
 * not ask whether anything calls that site in turn — so the shape can live in one
 * place, in code, from the commit that creates the table. The alternative was
 * stating `{Asset ID}-{seq}` in the Airtable field description and having #338
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
 * `event` COMES FROM lib/assetStatus.js AND NEVER FROM A LITERAL, the rule
 * `createEditLogEntry` already has for `Field`. `Event` is a singleSelect written
 * with no `typecast`, so a value outside the option list fails the write rather
 * than silently minting a ninth choice off the color palette — the `DRUM` failure
 * (`docs/notes/data-model.md`) and the two miscolored `Edit Log` options (#181)
 * are what that posture is for. The Metadata API cannot repair an option list
 * afterwards (422, measured), so failing loudly is the only recovery that exists.
 *
 * AND A MISSING EVENT IS REFUSED HERE, BECAUSE AIRTABLE CANNOT REFUSE WHAT IS NEVER
 * SENT (#455). The posture above covers a string outside the list. It does not cover
 * `undefined`, which is what a call site reads when a key in `ASSET_EVENT` is renamed
 * and that site is left behind: the key drops out of the request body, nothing is
 * outside the option list, and the row is created with no `Event` at all — a history
 * entry with no event, which the four facts `logRowFacts` renders on every row say
 * cannot exist. #455 renamed `REGISTERED` and is where that became one missed edit
 * away, so the guard stands beside the job's and the recorder's.
 *
 * THE CALLER WRITES `Assets."Status"` SEPARATELY, and this function does not
 * do it for them. Airtable has no cross-table transaction, so the log row and the
 * cached status are two writes whichever way they are arranged; putting the status
 * write here would hide that fact behind a function that looks atomic. #338 and
 * #362 own the ordering — `updateAssetCache` is the other half — and
 * `statusAfterEvent` owns which value. **This said #338 and #341 until #362**, and
 * #341 is closed: #335 removed the `Job Changed` event that issue was to write, so
 * it owns no ordering and never did.
 *
 * EVERY EVENT BUT AN ASSET'S FIRST, SINCE #470. A registration writes its
 * `Created` rows through `createFirstAssetLogEntries` below, which has no history to
 * read; this writes the events that follow, which do. What a row says is
 * `entryFields`', so the two writers refuse the same blanks in the same words.
 */
export async function createAssetLogEntry({
    assetRecordId,
    assetId,
    event,
    jobRecordId,
    recordedByUserId,
    checkedOutTo,
}) {
    // Refused before the lock and the reads, which a row that cannot be written
    // should not cost.
    const fields = entryFields({ assetRecordId, event, jobRecordId, recordedByUserId, checkedOutTo });

    const record = await generateChildId(
        {
            parentTableName: TABLES.ASSETS,
            parentRecordId: assetRecordId,
            parentLinkFieldName: "Asset Log",
            childTableName: TABLES.ASSET_LOG,
            prefix: assetId,
        },
        (assetLogId) =>
            base(TABLES.ASSET_LOG).create({
                "Asset Log ID": assetLogId,
                ...fields,
                // When it happened, UTC instant, *At convention. The event and the
                // recording are one moment here by construction — a scan records
                // what it is doing as it does it — so there is no second date to
                // tell this one apart from, unlike `Deliveries."Received Date"`.
                "Event At": new Date().toISOString(),
            })
    );

    return recordToAssetLogEntry(record);
}

/**
 * Append the first event of each of `assets` — the `Created` row a registration
 * writes for every asset it made — ten to a request, reading nothing (#470).
 *
 * NOTHING IS READ BECAUSE THERE IS NOTHING TO READ. `createAssetLogEntry` finds the
 * parent and reads its siblings under the parent's lock before it mints, two
 * requests and a lock for every row; an asset created a moment ago in this same
 * invocation has no history, and `lib/ids.js:generateFirstChildIds` mints its first
 * row's id from that fact — `nextChildId` over no siblings, the composition
 * `generateChildId` uses — after refusing any asset whose link array, as its
 * create answered, is not empty. **So `assets` is `createAssets`' own
 * answer and nothing older**, and the lock-free mint is that function's argument to
 * make, which its header does.
 *
 * THE ROWS GO THROUGH `createRecords`, so a failed request stops the pass and is
 * read back by its ids before it is counted (`lib/airtableBatch.js`). The answer is
 * `{ unlogged }`: the printed ids of the assets whose `Created` row is not on the
 * base, in id order — what a failed request did not land and everything after it.
 * Nothing writes a late row for them; `ASSET_REGISTRATION_COPY.unlogged` says why, and
 * the landing names them instead.
 *
 * ONE INSTANT FOR THE PASS. Every row carries the moment the pass begins, just after
 * the last of the registration's assets was created — the event is their
 * creation, and this is when it is recorded. Until #470 each row carried its own
 * write's moment, every one of them after the last asset had been created too,
 * so none stood nearer its event than this.
 */
export async function createFirstAssetLogEntries({ assets, jobRecordId, recordedByUserId }) {
    // The vocabulary's own event, and every row's fields built — and refused — before
    // anything is minted or sent, as `createAssetLogEntry` refuses.
    const entries = assets.map((asset) => ({
        asset,
        fields: entryFields({ assetRecordId: asset.id, event: ASSET_EVENT.CREATED, jobRecordId, recordedByUserId }),
    }));
    const eventAt = new Date().toISOString();

    return generateFirstChildIds(
        {
            parentTableName: TABLES.ASSETS,
            parentLinkFieldName: "Asset Log",
            parents: assets.map((asset) => ({ prefix: asset.assetId, childRecordIds: asset.assetLog })),
        },
        async (assetLogIds) => {
            const { unwritten } = await createRecords(
                TABLES.ASSET_LOG,
                "Asset Log ID",
                entries.map((entry, i) => ({ ...entry, assetLogId: assetLogIds[i] })),
                ({ fields, assetLogId }) => ({ "Asset Log ID": assetLogId, ...fields, "Event At": eventAt })
            );
            return { unlogged: unwritten.map(({ asset }) => asset.assetId) };
        }
    );
}

/**
 * What one `Asset Log` row says beside its id and its moment, or the throw that
 * refuses it — for both writers above, so a row written ten to a request and a row
 * written alone cannot come to say different things (#470). The refusals were
 * `createAssetLogEntry`'s own until then, and say this module's name now, since either
 * writer can reach them.
 */
function entryFields({ assetRecordId, event, jobRecordId, recordedByUserId, checkedOutTo }) {
    // APP-ENFORCED, SINCE AIRTABLE CANNOT MAKE A LINK FIELD REQUIRED — the same
    // limit `Invoice Items."PO Item"` lives with (#278) and the same guard
    // `createAssets` opens with. Both of these are never-blank invariants that
    // the whole history rests on: the job is what makes the previous row's job
    // the previous job, and `logRowFacts` renders both on every row on the
    // strength of it.
    //
    // IT WROTE `[]` FOR A MISSING VALUE UNTIL #363, WHICH IS A HOLE NOTHING
    // COULD REACH AND NOW SOMETHING COULD. Every caller resolved a job out of
    // the actor's own assignments, so none could pass nothing; that issue made a
    // retirement inherit `Assets."Job"` instead, and the schema permits that
    // field to be empty even though the app does not. A silent blank would break
    // the invariant at the one place nothing checks it, so it throws.
    if (!jobRecordId) throw new Error("assetLog: a Job is required");
    if (!recordedByUserId) throw new Error("assetLog: a Recorded By is required");
    // An event outside the vocabulary, `undefined` above all: see `createAssetLogEntry`'s
    // docstring for why the no-typecast refusal cannot be the guard for this one.
    if (!ASSET_EVENT_VALUES.includes(event)) {
        throw new Error(`assetLog: ${JSON.stringify(event)} is not an Asset Log event`);
    }

    // #376 — `Checked Out To` IS A FUNCTION OF THE EVENT, AND BOTH DIRECTIONS ARE
    // HELD HERE. A check-out with no recipient loses the fact the field exists for;
    // any other event WITH one records a handover that did not happen, and both are
    // silent on every screen — `logRowFacts` renders the fifth fact on `Checked out`
    // rows alone, so a name on a `Retired` row would sit in the base readable by
    // nothing. The form asks and `readSubmission` judges, and this is the third
    // place because a writer is where a never-blank invariant is actually kept:
    // `Job` is two lines up for the same reason, and #363 is what taught it — that
    // guard was unreachable until one caller stopped resolving the value itself.
    const isCheckOut = event === ASSET_EVENT.CHECKED_OUT;
    if (isCheckOut && !checkedOutTo) {
        throw new Error("assetLog: a Checked Out To is required on a check-out");
    }
    if (!isCheckOut && checkedOutTo) {
        throw new Error(`assetLog: a Checked Out To cannot be written on ${event}`);
    }

    return {
        "Asset": [assetRecordId],
        Event: event,
        Job: [jobRecordId],
        "Recorded By": [recordedByUserId],
        // Omitted rather than written empty on the three events that carry no
        // recipient, so a blank cell means the field was never given one — the
        // distinction `recordToAssetLogEntry` preserves.
        ...(isCheckOut ? { "Checked Out To": checkedOutTo } : {}),
    };
}
