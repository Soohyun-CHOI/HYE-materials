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
    AUTH_TOKENS: "Auth Tokens",
};

/**
 * Fetches all children of a parent record by reading the parent's own
 * reverse-link field (e.g. Purchase Orders."PO Items") for the exact list
 * of child record IDs, then fetching each child directly by ID in parallel.
 *
 * Deliberately does NOT filter the child table by its "{Parent} Record ID"
 * lookup field — that lookup is computed asynchronously by Airtable after a
 * record is created, so a record created moments ago can be temporarily
 * invisible to a filterByFormula query on it. A parent's reverse-link array
 * and a record's own directly-written fields (fetched via .find()) don't
 * have that lag — only computed fields (lookups/formulas/rollups) do.
 *
 * Trade-off: this is 1 + N API calls (1 for the parent, N in parallel for
 * the children) instead of 1 batched query — fine at this project's volume,
 * but worth revisiting (e.g. batching/throttling) if a parent ever has
 * dozens+ of children, both for latency and Airtable's rate limit.
 */
export async function getLinkedRecords(
    parentTableName,
    parentRecordId,
    parentLinkFieldName,
    childTableName
) {
    const parentRecord = await base(parentTableName).find(parentRecordId);
    const childIds = parentRecord.get(parentLinkFieldName);

    if (!Array.isArray(childIds) || childIds.length === 0) return [];

    return Promise.all(childIds.map((id) => base(childTableName).find(id)));
}

// sumQty() was here (#15): SUM(Qty) over already-fetched Invoice Item records,
// shared by isPoOpen(), getInvoicingStatusByPO() and getInvoicedQtyForPOItem().
// Removed in #18 — all three now read PO Items."Invoiced Qty", an Airtable
// rollup of exactly that sum, so the JS reduce had no caller left. Keeping it
// would have left a helper whose doc named three callers that no longer exist.
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
// duplicated plumbing — a Promise.all and a flat, no judgement in either — buys a
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