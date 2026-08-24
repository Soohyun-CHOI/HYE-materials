// Single shared Airtable connection. Every table-specific file (users.js,
// purchaseRequests.js, etc.) imports `base` from here rather than each
// creating its own connection.
//
// IMPORTANT: this file must only ever be imported from server-side code
// (API routes, or Server Components) — never from a Client Component —
// since it reads the API key from environment variables that must stay
// off the browser bundle.

import Airtable from "airtable";
import { orByField, orByRecordId } from "../airtableFormula";
import { installOpsCounter } from "../airtableOps";

if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("Missing AIRTABLE_API_KEY in environment variables");
}
if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error("Missing AIRTABLE_BASE_ID in environment variables");
}

Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});

// Every read and write in this app goes through this one object, which is what
// makes it the place to count them (#190). installOpsCounter wraps the request
// funnel and THROWS if it cannot find it — a counter that silently reads 0 is
// indistinguishable from an efficient app, and this file already throws at module
// load for a missing key, so a blind instrument fails the same way. What it counts
// is one LOGICAL request; retries and raw Metadata-API fetches are invisible to
// it, so its numbers are a floor. See lib/airtableOps.js for both limits.
export const base = installOpsCounter(Airtable.base(process.env.AIRTABLE_BASE_ID));

// Table name constants — matches exactly what's in the Airtable base today.
// Centralizing these means a future rename in Airtable only needs a change
// here, not a find-and-replace across the whole codebase.
export const TABLES = {
    USERS: "Users",
    JOBS: "Jobs",
    LINES: "Lines",
    VENDORS: "Vendors",
    PURCHASE_REQUESTS: "Purchase Requests",
    PR_SIGNERS: "PR Signers",
    PR_ITEMS: "PR Items",
    CORRECTION_REQUESTS: "Correction Requests",
    EDIT_LOG: "Edit Log",
    PURCHASE_ORDERS: "Purchase Orders",
    PO_ITEMS: "PO Items",
    QUOTATIONS: "Quotations",
    ADDRESSES: "Addresses",
    INVOICES: "Invoices",
    INVOICE_PO_LINK: "Invoice-PO Link",
    INVOICE_ITEMS: "Invoice Items",
    MATERIALS: "Materials",
    MATERIAL_PRICES: "Material Prices",
    DELIVERIES: "Deliveries",
    DELIVERY_ITEMS: "Delivery Items",
    DIRECT_PURCHASES: "Direct Purchases",
    AUTH_TOKENS: "Auth Tokens",
};

/**
 * The children a link array names, in that array's order, refusing a short
 * result (#193). One query per 50 ids instead of one `find()` per child.
 *
 * THIS IS `getLinkedRecords`' SECOND HALF, EXTRACTED SO THE CALLERS THAT
 * ALREADY HOLD THE LINK ARRAY CAN SKIP THE FIRST. A page that has fetched its
 * parent record has the ids in hand — `recordToPR` and `recordToPO` expose them
 * precisely because core link data costs nothing to expose — and re-finding that
 * parent once per child level is what made `/prs/[prId]` fetch the same request
 * six times over.
 *
 * TWO CONTRACTS ARE RESTORED HERE RATHER THAN LEFT TO THE CALLERS, and they are
 * the whole reason this could replace a per-child `find()` at all. `findByRecordIds`
 * gives up both, which is fine for its own callers and not fine here:
 *
 *   ORDER. The old shape was `Promise.all(childIds.map(find))`, so children came
 *   back in the parent's link-array order — roughly creation order, and what the
 *   PR detail page's items table has always rendered. `findByRecordIds` documents
 *   that order is NOT preserved, and only some readers sort for themselves
 *   (`getSignersByPR` by Sequence Order, `lib/prDraft.js` by child id).
 *   `getItemsByPR` does not, so an unordered result would have quietly reshuffled
 *   a rendered table. Reordering here means no caller can tell the difference.
 *
 *   A MISSING ID IS LOUD. `find()` throws on an id that no longer resolves, so a
 *   stale link array failed visibly. `findByRecordIds` returns fewer rows and says
 *   nothing — the same silence its own doc warns about — which would turn a broken
 *   link into missing table rows nobody notices. So a short result throws, naming
 *   the table and the ids that did not come back.
 *
 * With those two restored, the ONLY behavioral difference left is freshness: a
 * `find()` by id does not go through Airtable's query index and a
 * `filterByFormula` on `RECORD_ID()` does. That is what #193 had to measure
 * before this could ship — see scripts/tests/verify-batched-reads-193.mjs.
 */
export async function findChildRecords(childTableName, childIds) {
    const ids = Array.from(new Set((childIds || []).filter(Boolean)));
    if (ids.length === 0) return [];

    const rows = await findByRecordIds(childTableName, ids);

    const byId = new Map(rows.map((r) => [r.id, r]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length > 0) {
        throw new Error(
            `${childTableName}: ${missing.length} linked record(s) did not resolve (${missing.join(", ")})`
        );
    }
    return ids.map((id) => byId.get(id));
}

/**
 * Fetches all children of a parent record by reading the parent's own
 * reverse-link field (e.g. Purchase Orders."PO Items") for the exact list
 * of child record IDs, then fetching those children in batches.
 *
 * Deliberately does NOT filter the child table by its "{Parent} Record ID"
 * lookup field — that lookup is computed asynchronously by Airtable after a
 * record is created, so a record created moments ago can be temporarily
 * invisible to a filterByFormula query on it. A parent's reverse-link array
 * and a record's own directly-written fields don't have that lag — only
 * computed fields (lookups/formulas/rollups) do. Matching on `RECORD_ID()`,
 * which is what findChildRecords does, is not that case: it compares a row's
 * own id rather than a computed field, and #193 measured it correct on the
 * first read for children created moments earlier.
 *
 * WAS 1 + N UNTIL #193 — one find for the parent and one per child, so a
 * request carrying ten items cost eleven operations. It is 1 + ceil(N/50) now,
 * and a caller that already holds the parent record should call
 * findChildRecords directly and pay ceil(N/50): the parent find is the half
 * this function cannot skip, since being handed only an id is what it is for.
 */
export async function getLinkedRecords(
    parentTableName,
    parentRecordId,
    parentLinkFieldName,
    childTableName
) {
    const parentRecord = await base(parentTableName).find(parentRecordId);
    return findChildRecords(childTableName, parentRecord.get(parentLinkFieldName));
}

// sumQty() was here (#15): SUM(Qty) over already-fetched Invoice Item records,
// shared by isPoOpen(), getInvoicingStatusByPO() and getInvoicedQtyForPOItem().
// Removed in #18 — all three read PO Items."Invoiced Qty" instead, an Airtable
// rollup of exactly that sum, so the JS reduce had no caller left. Keeping it
// would have left a helper whose doc named three callers that no longer exist.
// (Two of those three remain; isPoOpen itself went in #244, which moved the
// question it answered into a rollup over the same field.)
// The remaining shared arithmetic is the subtraction, which is lib/poItemQty.js.

/**
 * Fetch many records of one table by their record ids, in as few queries as
 * possible (#19).
 *
 * getLinkedRecords above is 1 + N: one parent fetch plus one `.find()` per
 * child. That is fine for a handful of children of one parent, but #19's price
 * screen assembles rows across five tables at once, and a `.find()` per row is
 * exactly the per-row round trip #143 established should not happen. This is
 * O(ids/CHUNK) queries instead.
 *
 * `RECORD_ID()` rather than a `_Record ID` formula field, because not every
 * table has one — PO Items does not, and adding it would be a schema change.
 * Measured to work on this base (#19). Note this is NOT the case CLAUDE.md's
 * parent/child rule forbids: that is about matching a LINK field against a
 * record id, whereas this compares a row's own id, which Airtable does support.
 *
 * Chunked because filterByFormula is a URL-length-bounded string: each clause is
 * ~40 characters, so an unbounded OR list would eventually 422 on a long result
 * set rather than on anything the caller did wrong.
 *
 * Caller beware of two things:
 *   - Order is NOT preserved. Airtable returns rows in its own order; callers
 *     that care sort afterwards (lib/materialPriceView.js does).
 *   - A missing id yields no row rather than an error, so a stale link array
 *     silently returns fewer rows than it named.
 */
const BATCH_CHUNK = 50;

function chunked(values) {
    const unique = Array.from(new Set((values || []).filter(Boolean)));
    const out = [];
    for (let i = 0; i < unique.length; i += BATCH_CHUNK) out.push(unique.slice(i, i + BATCH_CHUNK));
    return out;
}

// The two functions below each build their own formula with a DIRECT call to a
// named builder, rather than sharing a helper that takes the builder as an
// argument. That is deliberate: scripts/tests/offline/formula-escaping.mjs can
// see a direct call and cannot see through `buildFormula(chunk)`, so passing the
// builder in would have to be waved through as an exemption. Six lines of
// duplicated plumbing — a Promise.all and a flat, no judgment in either — buys a
// check that reads the real thing. The chunking, which IS a decision, stays
// shared above.

export async function findByRecordIds(tableName, ids, { fields } = {}) {
    const chunks = chunked(ids);
    if (chunks.length === 0) return [];

    const pages = await Promise.all(
        chunks.map((chunk) =>
            base(tableName)
                .select({ filterByFormula: orByRecordId(chunk), ...(fields ? { fields } : {}) })
                .all()
        )
    );
    return pages.flat();
}

/**
 * The same batching, keyed on a field value rather than a record id — for the
 * one table whose rows are findable only through a lookup (Material Prices, see
 * CLAUDE.md's parent/child exception).
 */
export async function findByFieldValues(tableName, fieldName, values, { fields } = {}) {
    const chunks = chunked(values);
    if (chunks.length === 0) return [];

    const pages = await Promise.all(
        chunks.map((chunk) =>
            base(tableName)
                .select({
                    filterByFormula: orByField(fieldName, chunk),
                    ...(fields ? { fields } : {}),
                })
                .all()
        )
    );
    return pages.flat();
}

// formulaString() was here (#18) and moved to lib/airtableFormula.js in #159.
// Not re-exported on purpose: two import paths for one rule is the same
// duplication in another form. It left because this file throws
// `Missing AIRTABLE_API_KEY` at module load, which put the escape out of the
// offline tier's reach — and #159's claim is precisely that the escape is
// correct, so it had to become testable without credentials.

/**
 * In-process per-key mutex: calls sharing the same key are queued onto a
 * promise chain so they run strictly one after another, even if the caller
 * fires them concurrently (e.g. via Promise.all). Each key's queue entry is
 * built to always settle (errors are swallowed only for chaining purposes —
 * the actual result/error of `fn()` is still returned to the caller), so one
 * failing call never blocks the next one. Entries are removed from the map
 * once their queue drains, so this doesn't grow unbounded.
 *
 * No external dependency — this is the whole implementation.
 *
 * Scope: only serializes calls within a single process/function invocation.
 * It does NOT coordinate across separate serverless invocations or
 * concurrent requests — see CLAUDE.md's "Link-field filtering rule" section
 * for why that's an accepted, lower-probability residual risk here.
 */
const keyQueues = new Map();

export function withKeyLock(key, fn) {
    const previous = keyQueues.get(key) || Promise.resolve();
    const run = previous.then(fn, fn);
    const settled = run.then(
        () => {},
        () => {}
    );

    keyQueues.set(key, settled);
    settled.finally(() => {
        if (keyQueues.get(key) === settled) {
            keyQueues.delete(key);
        }
    });

    return run;
}

/**
 * Testing/inspection only — returns the keys that currently have an
 * in-flight or queued withKeyLock chain. Used to verify keyQueues doesn't
 * leak entries after a chain drains; not used by any application code.
 */
export function _debugLockKeys() {
    return Array.from(keyQueues.keys());
}