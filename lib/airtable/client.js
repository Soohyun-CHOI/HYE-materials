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