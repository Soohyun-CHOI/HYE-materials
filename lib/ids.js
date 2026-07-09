// All auto-generated ID logic lives here, in one place, since every later
// phase depends on it. Two shapes:
//   1. PR ID / PO ID / Invoice ID — date-based, resets daily
//   2. Child IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item,
//      Quotation, Invoice Item) — parent-prefixed, resets per parent record

import { base, TABLES, withKeyLock } from "./airtable/client";

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
            filterByFormula: `IS_SAME({Created Date}, TODAY(), 'day')`,
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
 * Top-level daily-reset counter, same shape as PR ID/PO ID — NOT a child ID
 * under a single PO, since Invoice<->PO is many-to-many (see Invoice-PO Link).
 */
export async function generateNextInvoiceId() {
    const dateStr = todayYYMMDD();

    const records = await base(TABLES.INVOICES)
        .select({
            filterByFormula: `IS_SAME({Issue Date}, TODAY(), 'day')`,
            fields: ["Invoice ID"],
        })
        .all();

    const nextSeq = records.length + 1;
    return `HYE-INV-${dateStr}-${pad(nextSeq, 2)}`;
}

/**
 * Generates the next child ID for a parent (counting via the parent's own
 * reverse-link field, e.g. "{PREFIX}-{seqPrefix}{padded count+1}"), then
 * calls `createFn(childId)` to actually create the record — and returns
 * whatever `createFn` returns.
 *
 * Example: generateChildId({
 *   parentTableName: TABLES.PURCHASE_REQUESTS,
 *   parentRecordId: prRecordId,
 *   parentLinkFieldName: "PR Items",
 *   prefix: prId,          // e.g. "HYE-PR-260710-07"
 *   padLength: 3,
 * }, (prItemId) => base(TABLES.PR_ITEMS).create({ "PR Item ID": prItemId, ... }))
 * → the created record, with ID "HYE-PR-260710-07-001"
 *
 * `seqPrefix` inserts a short marker directly before the padded number, for
 * child tables whose ID needs to read as a labeled sub-sequence rather than
 * a plain number — e.g. Quotations use seqPrefix: "Q" to produce
 * "HYE-PR-260710-07-Q01" instead of "HYE-PR-260710-07-01".
 *
 * IMPORTANT: this deliberately does NOT count via the child table's
 * "{Parent} Record ID" lookup field (filterByFormula on a lookup). That
 * lookup is computed asynchronously by Airtable after a record is created,
 * so counting that way can undercount — and produce duplicate IDs — when
 * siblings are created immediately after the parent itself (reproduced
 * consistently for PO Items). A parent's own reverse-link field (e.g.
 * Purchase Orders."PO Items") is core link data, not a computed field —
 * Airtable keeps both sides of a link in sync as part of the same write,
 * so reading it back immediately after creating a linked child is reliable.
 *
 * WHY `createFn` LIVES INSIDE THIS FUNCTION: counting and creating both
 * have to happen inside the same per-parent lock (see withKeyLock in
 * lib/airtable/client.js) for the lock to actually prevent duplicate IDs.
 * If the count and the create were two separate locked/unlocked steps, a
 * third caller could still read a stale count in the gap between the
 * second caller's count finishing and its create() actually landing.
 * Wrapping caller-provided create logic in a callback is what lets the
 * lock span the whole "read count -> create with that ID" sequence.
 */
export async function generateChildId(
    { parentTableName, parentRecordId, parentLinkFieldName, prefix, padLength = 3, seqPrefix = "" },
    createFn
) {
    const lockKey = `${parentTableName}:${parentRecordId}:${parentLinkFieldName}`;

    return withKeyLock(lockKey, async () => {
        const parentRecord = await base(parentTableName).find(parentRecordId);
        const children = parentRecord.get(parentLinkFieldName);
        const nextSeq = (Array.isArray(children) ? children.length : 0) + 1;
        const childId = `${prefix}-${seqPrefix}${pad(nextSeq, padLength)}`;
        return createFn(childId);
    });
}
