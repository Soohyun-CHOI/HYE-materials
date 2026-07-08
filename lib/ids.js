// All auto-generated ID logic lives here, in one place, since every later
// phase depends on it. Two shapes:
//   1. PR ID / PO ID — date-based, resets daily
//   2. Child IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item)
//      — parent-prefixed, resets per parent record

import { base, TABLES } from "./airtable/client";

function todayYYMMDD() {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function pad(n, length) {
    return String(n).padStart(length, "0");
}

/**
 * Generates the next PR ID: HYE-PR-YYMMDD-##, resetting each new day.
 * Counts existing PRs created today, then increments.
 */
export async function generateNextPRId() {
    const dateStr = todayYYMMDD();

    const records = await base(TABLES.PURCHASE_REQUESTS)
        .select({
            filterByFormula: `IS_SAME({Date Created}, TODAY(), 'day')`,
            fields: ["PR ID"],
        })
        .all();

    const nextSeq = records.length + 1;
    return `HYE-PR-${dateStr}-${pad(nextSeq, 2)}`;
}

/**
 * Generates the next PO ID: HYE-PO-YYMMDD-##, resetting each new day.
 */
export async function generateNextPOId() {
    const dateStr = todayYYMMDD();

    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `IS_SAME({Created Date}, TODAY(), 'day')`,
            fields: ["PO ID"],
        })
        .all();

    const nextSeq = records.length + 1;
    return `HYE-PO-${dateStr}-${pad(nextSeq, 2)}`;
}

/**
 * Generates the next Invoice ID: HYE-INV-YYMMDD-##, resetting each new day.
 */
export async function generateNextInvoiceId() {
    const dateStr = todayYYMMDD();

    const records = await base(TABLES.PURCHASE_ORDERS)
        .select({
            filterByFormula: `IS_SAME({Created Date}, TODAY(), 'day')`,
            fields: ["Invoice ID"],
        })
        .all();

    const nextSeq = records.length + 1;
    return `HYE-INV-${dateStr}-${pad(nextSeq, 2)}`;
}

/**
 * Generic child-ID generator: counts existing child records linked to a
 * given parent, then returns "{PREFIX}-{padded count+1}".
 *
 * Example: generateChildId({
 *   tableName: TABLES.PR_ITEMS,
 *   parentFieldName: "PR",
 *   parentRecordId: prRecordId,
 *   prefix: prId,          // e.g. "HYE-PR-260710-07"
 *   padLength: 3,
 * })
 * → "HYE-PR-260710-07-001"
 */
export async function generateChildId({
                                          tableName,
                                          parentFieldName,
                                          parentRecordId,
                                          prefix,
                                          padLength = 3,
                                      }) {
    // Note: linked-record fields don't filter reliably via filterByFormula
    // (Airtable formulas see a link field as its linked records' display
    // text, not their record IDs) — so we fetch all rows and filter in JS
    // by checking the raw linked-record-ID array instead. Fine at this
    // project's volume; if a table ever gets huge, this is the first place
    // to optimize (e.g. maintaining a running counter instead).
    const allRecords = await base(tableName)
        .select({ fields: [parentFieldName] })
        .all();

    const matching = allRecords.filter((record) => {
        const linked = record.get(parentFieldName); // array of linked record IDs
        return Array.isArray(linked) && linked.includes(parentRecordId);
    });

    const nextSeq = matching.length + 1;
    return `${prefix}-${pad(nextSeq, padLength)}`;
}