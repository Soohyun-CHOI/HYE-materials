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

// PO ID only — the company's real historically-issued PO numbers all use a
// 4-digit year (confirmed from real invoice samples), so PO IDs generated
// by this system are kept consistent with that format. PR ID and Invoice
// ID deliberately keep the 2-digit todayYYMMDD() above; this is a PO-only
// change.
function todayYYYYMMDD() {
    const now = new Date();
    const y = String(now.getFullYear());
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}${m}${d}`;
}

function pad(n, length) {
    return String(n).padStart(length, "0");
}

/**
 * Generates the next PR ID: HYE-PR-YYMMDD-##, resetting each new day, then
 * calls `createFn(prId)` to create the record and returns its result — same
 * callback shape as generateChildId, and for the same reason: counting
 * today's PRs and creating the new one must happen inside one lock, or two
 * requests landing close together (e.g. two employees submitting new PRs at
 * the same moment) can both count the same total and mint the same ID.
 */
export async function generateNextPRId(createFn) {
    const dateStr = todayYYMMDD();
    const lockKey = `${TABLES.PURCHASE_REQUESTS}:${dateStr}`;

    return withKeyLock(lockKey, async () => {
        const records = await base(TABLES.PURCHASE_REQUESTS)
            .select({
                // Issue #105 — "Created Date" is now the timestamped "Created
                // At". IS_SAME(..., TODAY(), 'day') still compares in GMT on
                // the stored UTC instant, so daily-reset counting is
                // unchanged. (The PO filter below keeps its own date-only
                // "Created Date" — that field was not migrated.)
                filterByFormula: `IS_SAME({Created At}, TODAY(), 'day')`,
                fields: ["PR ID"],
            })
            .all();

        const nextSeq = records.length + 1;
        const prId = `HYE-PR-${dateStr}-${pad(nextSeq, 2)}`;
        return createFn(prId);
    });
}

/**
 * Generates the next PO ID: HYE-PO-YYYYMMDD-## (4-digit year — see
 * todayYYYYMMDD() above; PR ID and Invoice ID stay 2-digit), resetting each
 * new day. Same lock-then-count-then-create shape as generateNextPRId, for
 * the same race reason.
 */
export async function generateNextPOId(createFn) {
    const dateStr = todayYYYYMMDD();
    const lockKey = `${TABLES.PURCHASE_ORDERS}:${dateStr}`;

    return withKeyLock(lockKey, async () => {
        const records = await base(TABLES.PURCHASE_ORDERS)
            .select({
                filterByFormula: `IS_SAME({Created Date}, TODAY(), 'day')`,
                fields: ["PO ID"],
            })
            .all();

        const nextSeq = records.length + 1;
        const poId = `HYE-PO-${dateStr}-${pad(nextSeq, 2)}`;
        return createFn(poId);
    });
}

/**
 * Generates the next Invoice ID: HYE-INV-YYMMDD-##, resetting each new day.
 * Top-level daily-reset counter, same shape as PR ID/PO ID — NOT a child ID
 * under a single PO, since Invoice<->PO is many-to-many (see Invoice-PO Link).
 * Same lock-then-count-then-create shape as generateNextPRId, for the same
 * race reason.
 */
export async function generateNextInvoiceId(createFn) {
    const dateStr = todayYYMMDD();
    const lockKey = `${TABLES.INVOICES}:${dateStr}`;

    return withKeyLock(lockKey, async () => {
        const records = await base(TABLES.INVOICES)
            .select({
                filterByFormula: `IS_SAME({Issue Date}, TODAY(), 'day')`,
                fields: ["Invoice ID"],
            })
            .all();

        const nextSeq = records.length + 1;
        const invoiceId = `HYE-INV-${dateStr}-${pad(nextSeq, 2)}`;
        return createFn(invoiceId);
    });
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
