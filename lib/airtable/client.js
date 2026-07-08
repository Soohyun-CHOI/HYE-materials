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