// Single shared Airtable connection. Every table-specific file (users.js,
// purchaseRequests.js, etc.) imports `base` from here rather than each
// creating its own connection.
//
// IMPORTANT: this file must only ever be imported from server-side code
// (API routes, or Server Components) — never from a Client Component —
// since it reads the API key from environment variables that must stay
// off the browser bundle.

import Airtable from "airtable";

if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("Missing AIRTABLE_API_KEY in environment variables");
}
if (!process.env.AIRTABLE_BASE_ID) {
    throw new Error("Missing AIRTABLE_BASE_ID in environment variables");
}

Airtable.configure({
    apiKey: process.env.AIRTABLE_API_KEY,
});

export const base = Airtable.base(process.env.AIRTABLE_BASE_ID);

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
 * Escape a value for use inside a double-quoted Airtable formula string.
 *
 * Lives here for the reason sumQty did: it belongs to no single table, and
 * every filterByFormula that interpolates a value needs the same rule. #18
 * found two copies — this one, and an inline `query.replace(...).replace(...)`
 * in purchaseOrders.js:searchPOs — and there was no measurable reason to keep
 * two, only the scope of the change that introduced the second.
 *
 * Not defensive boilerplate. This company writes pipe sizes as 2" / 4", and an
 * unescaped double quote closes the formula's string early: Airtable answers
 * 422 INVALID_FILTER_BY_FORMULA, and worse, a crafted value is parsed as
 * formula CODE rather than data (see CLAUDE.md's note on the unescaped
 * interpolations that remain elsewhere). The backslash is escaped first,
 * otherwise it would re-escape the ones added after it.
 */
export function formulaString(value) {
    return String(value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

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