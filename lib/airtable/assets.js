import {
    base,
    TABLES,
    createRecords,
    findByFieldValues,
    findByRecordIds,
    findChildRecords,
    getLinkedRecords,
} from "./client";
import { changedSince, formulaString } from "../airtableFormula";
import { normalizeItemText } from "../itemNaming";
import { generateNextAssetIds } from "../ids";
import { ASSET_STATUS } from "../assetStatus";
import { NOTE_MAX, keptNote } from "../assetNote";
import { createAssetStatusMemory } from "../assetStatusMemory";

/**
 * One physical asset — the thing a QR label is stuck to (#334).
 *
 * `Asset ID` IS THE PRINTED IDENTITY, which is what makes this table's
 * primary field different in kind from every other minted ID on this base. A PR
 * ID is read on a screen and a PO ID is read on a document; this one is
 * encoded into a sticker, glued to a drill, and carried onto a site. Two rows
 * sharing it means two assets wearing the same label, and the repair is reprinting
 * both. #335 mints it, and gives it a wider daily sequence than the document
 * families because one registration can create many units at once.
 *
 * `Status` AND `Job` ARE BOTH CACHES OF THE LAST `Asset Log` ROW, written by this
 * app in the same operation as that row and never by an Airtable formula. They
 * are the same kind of value and they come from the same row: the status that
 * event left behind, and the job it happened on. lib/assetStatus.js holds the
 * first mapping — six events against four statuses since #531, so it is a mapping
 * rather than a copy — and the job is carried straight across.
 *
 * `Job` SAYS WHERE THE ASSET WAS LAST SCANNED, NOT WHICH JOB OWNS IT, and #335
 * corrected that: a manager scans out their own job's assets, a worker may carry
 * one to another site, and whoever manages the site it reaches scans it back in.
 * An asset moving between jobs is therefore already two log rows — a check-out on
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
function recordToAsset(record) {
    return {
        id: record.id,
        assetId: record.get("Asset ID"),
        // Single-record in practice, app-enforced: the Metadata API refuses
        // `prefersSingleRecordLink` on both CREATE and UPDATE (422), the same limit
        // `Invoices."Delivery"` and `Invoice Items."PO Item"` live with. Readers
        // take `[0]`.
        category: record.get("Category") || [],
        status: record.get("Status"),
        job: record.get("Job") || [],
        // The item's one line (#533), and the empty string where it has none: a text field
        // nobody filled is absent from the record. No reader names `fields`, so it arrives
        // with every asset read and costs none of them an operation.
        note: record.get("Note") ?? "",
        // Reverse-link, and the reason this record can be handed straight to
        // getAssetLogByAsset without a second parent find (#193).
        assetLog: record.get("Asset Log") || [],
    };
}

/**
 * One asset by its printed `Asset ID`, or null.
 *
 * THE READER A SCANNED LABEL ARRIVES AT, through `/l/[labelCode]`, which is
 * what a QR code carries and what redirects to `/assets/[assetId]` (#348),
 * putting back the `HYE-AST-` token the label drops (#411). Either way the URL
 * carries the minted id and not a record id, so the lookup is by that value —
 * nothing on the sticker knows Airtable's own identifier.
 *
 * CASE-INSENSITIVE, AND THE SECOND WAY TO THIS PAGE IS WHY (#340). The label
 * prints the id in characters a person can read alongside the QR code, which is
 * the arrangement for a symbol that has been scratched or painted over — so the
 * fallback path is somebody typing the id by hand, on a site, in gloves. This
 * lookup was a bare `=`, which #338 measured to be CASE-SENSITIVE on a text
 * field, so `hye-tl-260909-001` was a miss and the fallback amounted to asking
 * for exact capitals. `LOWER(TRIM(…))` is `getMaterialByKey`'s comparison, and
 * `getToolByName`'s was until #507, and `normalizeItemText` collapses the internal
 * whitespace a formula cannot.
 *
 * IT DOES NOT MAKE TWO ADDRESSES FOR ONE ASSET: the page redirects a
 * non-canonical segment to the stored id, so one asset keeps one address.
 * **`/l/` canonicalizes before it hands the id over (#348)**, so traffic from a
 * label never reaches that redirect and a scan costs one hop rather than two;
 * what still reaches it is somebody typing this address directly.
 */
export async function getAssetByAssetId(assetId) {
    const records = await base(TABLES.ASSETS)
        .select({
            filterByFormula: `LOWER(TRIM({Asset ID})) = LOWER(TRIM("${formulaString(
                normalizeItemText(assetId)
            )}"))`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;
    return recordToAsset(records[0]);
}

/**
 * Each asset's `Status`, by record id, as this server keeps them between views (#560).
 *
 * `/asset-categories` IS THE CALLER: it counts each kind by status, and the ids are the assets
 * its scope stands on, off link arrays it has already read. `lib/assetStatusMemory.js` is the
 * whole judgment — what is kept, the question about changes every call asks, the overlap, the
 * bound, a read shared — and its header says why; this is the base it is handed.
 *
 * ONE MEMORY FOR THE PROCESS, MADE WHEN THIS MODULE LOADS, which is what makes it a memory: one
 * made per call would meet every asset for the first time on every view, and the list would
 * read every status every time, as it did. It lives as long as the server instance does —
 * between requests on a Vercel instance, gone with a deployment.
 *
 * TWO READS, EACH OF THE `Status` FIELD ALONE. An asset the memory has not met, or holds past
 * its bound, is read a hundred to a query — Airtable's page, one request each — and the
 * question about changes is one query, `changedSince` on `Status`. Neither names the other
 * fields: the list takes each asset's job and kind off the link arrays, so the `Asset Log`
 * array that grows with every event no longer rides along.
 *
 * `getAssetsByRecordIds` was this list's reader from #339 until this issue: every asset in
 * scope, every field, fifty to a query on every view.
 */
export async function getAssetStatuses(recordIds) {
    return statusMemory(recordIds);
}

const STATUS_FIELD = "Status";

function recordToStatus(record) {
    return { id: record.id, status: record.get(STATUS_FIELD) };
}

// The process's one memory (see `getAssetStatuses`), handed the base.
const statusMemory = createAssetStatusMemory({
    readByIds: async (recordIds) =>
        (await findByRecordIds(TABLES.ASSETS, recordIds, { fields: [STATUS_FIELD], perQuery: 100 })).map(recordToStatus),
    readChangedSince: async (moment) =>
        (
            await base(TABLES.ASSETS)
                .select({ filterByFormula: changedSince(STATUS_FIELD, moment), fields: [STATUS_FIELD] })
                .all()
        ).map(recordToStatus),
});

/**
 * Many assets by PRINTED id, batched — one query per 50 (#353).
 *
 * THE LABELS' READ IS THE CALLER (#457), `/tool-items/labels` UNTIL THEN, AND THE
 * PRINTED ID IS WHAT IT HAS. A label run is named by the ids a registration minted or
 * a person read off a sticker, so the reader beside this one —
 * `getAssetByAssetId` — would be one query per label, which is exactly the
 * per-record shape #193 forbids. There is no parent
 * whose reverse-link would serve instead, since a printed id names no parent, so
 * this is `findByFieldValues`' second call site on the same reasoning CLAUDE.md
 * records for `getMaterialPrice`.
 *
 * **IT DOES NOT PRESERVE THE ARGUMENT'S ORDER AND IT DOES NOT THROW ON A MISS**,
 * which is where it parts from `findChildRecords`. A `filterByFormula` `OR` returns
 * rows in the table's own order, and a printed id that resolves to nothing is a
 * reachable state rather than a bug: somebody typed one, or a link was edited. The
 * caller matches the rows back onto its own list and says which ids it could not
 * find — the labels' dialog names them rather than printing a short run in silence.
 */
export async function getAssetsByAssetIds(assetIds) {
    const records = await findByFieldValues(TABLES.ASSETS, "Asset ID", assetIds);
    return records.map(recordToAsset);
}

/**
 * The assets of one category, via the parent's reverse-link (#339).
 *
 * `rowIds` — the parent's link array, when the caller already holds the `Asset Categories`
 * record. `getAssetCategoriesByRecordIds` exposes it precisely so the category's page can pass
 * it and skip the parent find; omitting it costs one extra operation and behaves
 * identically.
 *
 * A SLICE OF THAT ARRAY IS A LEGITIMATE ARGUMENT AND IS WHAT PAGING PASSES.
 * `/asset-categories/[categoryRecordId]` chooses its page from the link array before
 * anything is fetched and hands over only the ids on it, so the read is one
 * batched query whatever the category's size. `findChildRecords` keeps the array's
 * order and throws on an id that does not resolve, and both hold for a slice.
 */
export async function getAssetsByCategory(categoryRecordId, { rowIds } = {}) {
    const records = rowIds
        ? await findChildRecords(TABLES.ASSETS, rowIds)
        : await getLinkedRecords(TABLES.ASSET_CATEGORIES, categoryRecordId, "Assets", TABLES.ASSETS);
    return records.map(recordToAsset);
}

/**
 * Register `count` physical assets of one kind (#335).
 *
 * THE MINT AND THE CREATE ARE ONE FUNCTION, which is structural rather than a
 * choice. `generateNextAssetIds` calls its callback INSIDE the per-prefix
 * lock, because reading the highest sequence and writing the rows that claim it
 * have to be one critical section — a helper that returned ids for the caller to
 * use would hand them out with the lock already released. So there is no "issue
 * an id" function to be had, here or anywhere else in lib/ids.js.
 *
 * ONE QUERY FOR THE WHOLE BATCH, and the ids are contiguous. That is what the
 * plural generator buys: minting one at a time would re-read the day's rows per
 * asset, and two people registering at once would interleave their numbers.
 *
 * TEN TO A REQUEST, ONE REQUEST AT A TIME, AND ALL OF IT INSIDE THE LOCK (#470).
 * `createRecords` writes the rows in Airtable's batches and returns only once
 * nothing it sent is still in flight, a failed request's read-back included — so
 * the day-prefix lock is held until every row this registration will ever write has
 * landed or been counted out, and a second registration in this process reads the
 * day's ids after them. **It was one row per request until #470**, when the shape
 * that was obviously correct was also the one that cost a registration of ten
 * thirty-four requests; `lib/airtableBatch.js` keeps what made it correct — the
 * rows in id order, a failure stopping the rest — and says why the batches cannot
 * be sent together.
 *
 * NOTHING ROLLS BACK, AND THE RETURN SHAPE SAYS SO. A request that fails leaves
 * the rows before it standing, because undoing them would delete ids the daily
 * counter has already spent and a later registration would then re-issue them
 * — `nextSequence` is MAX + 1, so the gap a failure leaves costs nothing while a
 * reused number costs two labels on two assets. **A failed request is read back by
 * its minted ids before it is counted**, so `created` is every asset the base
 * holds, a lost answer's included, in id order; `failure` is what stopped it, or
 * null. #338 decides what to say about the rest, which is the count less these.
 *
 * `Status` COMES FROM lib/assetStatus.js AND NEVER FROM A LITERAL: registration is
 * the `Created` event, and `statusAfterEvent` says that leaves the asset
 * `In stock`. The first `Asset Log` row is #338's to write, in the same action —
 * `lib/airtable/assetLog.js:createFirstAssetLogEntries` since #470.
 */
export async function createAssets({ categoryRecordId, jobRecordId, count }) {
    if (!categoryRecordId) throw new Error("createAssets: a Category is required");
    // App-enforced, since Airtable cannot make a link field required. Refused here
    // rather than at the form alone: an asset with no job reaches no screen.
    if (!jobRecordId) throw new Error("createAssets: a Job is required");

    return generateNextAssetIds(count, async (assetIds) => {
        const { written, failure } = await createRecords(
            TABLES.ASSETS,
            "Asset ID",
            assetIds,
            (assetId) => ({
                "Asset ID": assetId,
                Category: [categoryRecordId],
                Status: ASSET_STATUS.IN_STOCK,
                Job: [jobRecordId],
            })
        );
        return { created: written.map(({ record }) => recordToAsset(record)), failure };
    });
}

/**
 * Move the two cached fields onto the `Asset Log` row that was just written (#362).
 *
 * ONE CACHE OF ONE ROW, WHICH IS WHY THIS IS ONE FUNCTION AND NOT TWO. `Status`
 * and `Job` are both the last log row's — the status that event left behind and
 * the job it happened on — so writing one without the other is an asset
 * describing two different moments. They go in one update, which is also one
 * operation.
 *
 * IT DOES NOT WRITE THE LOG ROW AND MUST NOT. `createAssetLogEntry`'s own header
 * carries the argument from the other side: Airtable has no cross-table
 * transaction, so the row and the cache are two writes whichever way they are
 * arranged, and hiding one inside the other would make a pair that can half-fail
 * look atomic. The caller owns the ordering, and #338 and #362 are the two
 * callers that have one.
 *
 * THE STATUS COMES FROM `statusAfterEvent` AND NEVER FROM A LITERAL, the rule
 * `createAssetLogEntry` already has for `Event` and `createEditLogEntry` for
 * `Field`. `Status` is a singleSelect written with no `typecast`, so a value
 * outside the option list fails the write rather than minting another choice
 * off the color palette — and the Metadata API cannot repair an option list
 * afterwards (422, measured), so failing loudly is the only recovery there is.
 *
 * IT TAKES A JOB RECORD ID RATHER THAN DEFAULTING, because `Job` is required and
 * app-enforced: every event carries one, so an update with none is a caller bug
 * and not a blank to write.
 */
export async function updateAssetCache({ assetRecordId, status, jobRecordId }) {
    if (!assetRecordId) throw new Error("updateAssetCache: an Asset is required");
    if (!status) throw new Error("updateAssetCache: a Status is required");
    if (!jobRecordId) throw new Error("updateAssetCache: a Job is required");

    const [record] = await base(TABLES.ASSETS).update([
        {
            id: assetRecordId,
            fields: {
                Status: status,
                Job: [jobRecordId],
            },
        },
    ]);
    return recordToAsset(record);
}

/**
 * Write an asset's note (#533), or clear it with the empty string.
 *
 * THE ONE FIELD OF `Assets` NO EVENT WRITES. It is not a cache of the log — a note is no
 * event, so no `Asset Log` row comes with it and `Status` and `Job` are left as they are —
 * which is why this is a writer of its own rather than a third field in `updateAssetCache`.
 *
 * IT REFUSES A NOTE THE ACTION SHOULD NOT HAVE HANDED IT: one longer than `NOTE_MAX` or not
 * tidied the way `keptNote` keeps one. The dialog asks first and the action asks again, and
 * this is where a value that reaches the base is held, `createAssetLogEntry`'s posture toward a
 * blank job (#363).
 *
 * A CLEARED NOTE IS WRITTEN AS NULL, which empties the field; the empty string is what the
 * mapper reads back for it.
 */
export async function updateAssetNote({ assetRecordId, note }) {
    if (!assetRecordId) throw new Error("updateAssetNote: an Asset is required");
    if (typeof note !== "string" || note !== keptNote(note) || note.length > NOTE_MAX) {
        throw new Error(`updateAssetNote: ${JSON.stringify(note)} is not a note this app keeps — see lib/assetNote.js`);
    }

    const [record] = await base(TABLES.ASSETS).update([
        {
            id: assetRecordId,
            fields: { Note: note === "" ? null : note },
        },
    ]);
    return recordToAsset(record);
}
