// All auto-generated ID logic lives here, in one place, since every later
// phase depends on it. Two shapes:
//   1. PR ID / PO ID / Invoice ID / Delivery ID — date-based, resets daily
//   2. Child IDs (PR Item, PR Signer, Correction Request, Edit Log, PO Item,
//      Quotation, Invoice Item, Delivery Item) — parent-prefixed, resets per
//      parent record
//
// THE FOUR DAILY COUNTERS SHARE ONE RULE (#164): the sequence is counted over
// the rows whose ID CARRIES THE SAME DAILY PREFIX, never over a date field.
// See mintDailyId below for why, and lib/idSequence.js for the pure part.

import { base, TABLES, withKeyLock } from "./airtable/client";
import { prefixMatch } from "./airtableFormula";
import { ID_KINDS, dailyIdPrefix, formatSequentialId, nextSequence } from "./idSequence";

// Child IDs only. The daily families pad through formatSequentialId, which fixes
// the width at 2; a child ID's width is the caller's (3 by default), so it keeps
// its own padding here rather than widening that function's contract.
function pad(n, length) {
    return String(n).padStart(length, "0");
}

/**
 * Mint the next `{TOKEN}-{date}-{seq}` ID for one family and hand it to
 * `createFn`, which creates the record. The four generators below are this
 * function with a different table.
 *
 * WHY THE POPULATION IS THE ID PREFIX AND NOT A DATE FIELD (#164). Counting
 * `IS_SAME({some date}, TODAY(), 'day')` makes the counted rows and the ID's
 * namespace the same set only as long as that field always holds the moment of
 * creation. Invoice ID counted `{Issue Date}` — the vendor's own date off their
 * document, human-entered and almost never today — so the count was almost always
 * 0 and every invoice entered on one day got `-01`. Measured read-only on
 * 2026-08-03: that filter matched 0 of 5 invoices.
 *
 * The other three were correct, and correct CONDITIONALLY: on nobody ever writing
 * their date field with something other than now. That condition has already been
 * broken by a committed script — scripts/demo/seed_material_prices.mjs backdated
 * `Purchase Orders."Created Date"` inside its creation loop and produced FIVE POs
 * sharing one PO ID. The ID prefix needs no such condition: it is the population
 * the sequence must be unique within by definition, nobody can backdate it, and
 * it is the same rule for all four families instead of three different date
 * fields with a note explaining which are safe.
 *
 * It also settles the two-clock question. The stamp comes from the JS clock while
 * `TODAY()` evaluates in GMT — they agree on Vercel, where the process clock is
 * UTC, and need not agree anywhere else. Airtable is no longer asked what day it
 * is.
 *
 * `createFn` LIVES INSIDE THE LOCK for the same reason it does in
 * generateChildId: reading the count and creating the record with it have to be
 * one critical section, or two requests landing together both read the same
 * highest sequence and mint the same ID.
 */
async function mintDailyId(tableName, kind, createFn) {
    const prefix = dailyIdPrefix(kind, new Date());
    const lockKey = `${tableName}:${prefix}`;

    return withKeyLock(lockKey, async () => {
        const records = await base(tableName)
            .select({
                filterByFormula: prefixMatch(kind.idField, prefix),
                fields: [kind.idField],
            })
            .all();

        const seq = nextSequence(
            records.map((record) => record.get(kind.idField)),
            prefix
        );
        return createFn(formatSequentialId(prefix, seq));
    });
}

/** HYE-PR-YYMMDD-## */
export async function generateNextPRId(createFn) {
    return mintDailyId(TABLES.PURCHASE_REQUESTS, ID_KINDS.PR, createFn);
}

/**
 * HYE-PO-YYYYMMDD-## — the 4-digit year is PO only (the company's real
 * historically-issued PO numbers use one, confirmed from real invoice samples).
 * The width lives with the family in lib/idSequence.js.
 */
export async function generateNextPOId(createFn) {
    return mintDailyId(TABLES.PURCHASE_ORDERS, ID_KINDS.PO, createFn);
}

/**
 * HYE-INV-YYMMDD-## — top-level, NOT a child ID under a single PO, since
 * Invoice<->PO is many-to-many (see Invoice-PO Link).
 *
 * This is the generator #164 was filed against; the population it counts is now
 * the same one the other three count.
 */
export async function generateNextInvoiceId(createFn) {
    return mintDailyId(TABLES.INVOICES, ID_KINDS.INVOICE, createFn);
}

/**
 * HYE-DL-YYMMDD-##.
 *
 * `Deliveries."Created At"` is no longer read here (#164) — the prefix rule needs
 * no date field at all. The field keeps its other two readers, the deliveries
 * list's tie-break and being the only timestamp on the record nobody typed, so
 * #162's reason for adding it stands; what changed is that its correctness is no
 * longer load-bearing for the ID. `{Received Date}` was never counted and now
 * cannot be: there is nothing here to point at the wrong field.
 */
export async function generateNextDeliveryId(createFn) {
    return mintDailyId(TABLES.DELIVERIES, ID_KINDS.DELIVERY, createFn);
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
