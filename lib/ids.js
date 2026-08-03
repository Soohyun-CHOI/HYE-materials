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

import { base, TABLES, findByRecordIds, withKeyLock } from "./airtable/client";
import { prefixMatch } from "./airtableFormula";
import { ID_KINDS, childKind, dailyIdPrefix, formatSequentialId, nextSequence } from "./idSequence";

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
 * Generates the next child ID for a parent — `{Parent ID}-{seqPrefix}{seq}`,
 * where `seq` is the HIGHEST sequence its siblings already carry plus one — then
 * calls `createFn(childId)` to create the record and returns whatever it returns.
 *
 * Example: generateChildId({
 *   parentTableName: TABLES.PURCHASE_REQUESTS,
 *   parentRecordId: prRecordId,
 *   parentLinkFieldName: "PR Items",
 *   childTableName: TABLES.PR_ITEMS,
 *   prefix: prId,          // e.g. "HYE-PR-260710-07"
 * }, (prItemId) => base(TABLES.PR_ITEMS).create({ "PR Item ID": prItemId, ... }))
 * → the created record, with ID "HYE-PR-260710-07-001"
 *
 * The ID's SHAPE is not a parameter: `padLength` and `seqPrefix` come from
 * `CHILD_KINDS` in lib/idSequence.js, keyed on `Parent Table::Link Field`, so
 * "a Quotation is {PR ID}-Q##" is stated once instead of at one of eight call
 * sites. An unregistered pair throws rather than defaulting. The key is the pair
 * and not the field name alone because 7 of the 8 field names are carried by more
 * than one table on this base — see that registry for the census.
 *
 * MAX, NOT COUNT, AND WHY THAT NEEDED A SECOND QUERY (#164 follow-up). This
 * counted the length of the parent's link array, which is the next free number
 * only while nothing has been deleted — and a child is deleted on an ordinary
 * Draft re-save, not by anyone choosing to. `persistPRFromForm` creates the new
 * generation BEFORE destroying the old one, deliberately, so a failed re-save
 * never loses saved children; the consequence is that each re-save shifts the
 * sequence upward and frees the numbers below it. Measured on the live base:
 * `HYE-PR-260722-09` holds exactly one PR Item, `-002`, and exactly one
 * Quotation, `-Q02`. Under count + 1 the next child of either kind was `-002` /
 * `-Q02` — a duplicate of the row already there — and for the Quotation that was
 * reachable with a mouse, since Edit and continue creates Quotations on an
 * In Review PR.
 *
 * The array holds RECORD IDS, not child IDs, so the highest sequence is not
 * readable from it; the siblings' own ID field has to be fetched. That is the
 * second query, batched through #19's `findByRecordIds` (one request per 50
 * siblings), and it is the whole cost of the fix.
 *
 * WHY THE PARENT'S ARRAY AND NOT A `prefixMatch` ON THE CHILD TABLE, which would
 * be ONE query and measured ~2x faster (112-197ms against 289-709ms). Not
 * because it lagged — it was measured seeing a just-created sibling in 6 of 6
 * rounds. Because of what each option makes ID uniqueness DEPEND on. Reading the
 * array depends on a link being visible on both sides immediately, which this
 * function already depended on before the change, which client.js records as
 * measured, and which `canViewPR` clauses 5-6 also rest on. Filtering the child
 * table would newly make uniqueness depend on the search index being
 * read-your-writes consistent for a plain text field — a guarantee nothing else
 * here relies on, and one that only a negative measurement of a timing window
 * supports. The one thing the filter is genuinely better at, seeing an ORPHANED
 * sibling whose parent link is gone, stopped mattering when #164 made the parent's
 * own ID no longer re-mintable: no future parent carries a dead parent's ID, so a
 * stranded child ID can never collide with a new sibling.
 *
 * Still NOT the child table's "{Parent} Record ID" lookup (filterByFormula on a
 * lookup). That lookup IS computed asynchronously, so counting through it
 * undercounts when siblings are created right after the parent — reproduced
 * consistently for PO Items — which is a different and real failure from the one
 * ruled out above.
 *
 * WHY `createFn` LIVES INSIDE THIS FUNCTION: reading the siblings and creating
 * the record both have to happen inside the same per-parent lock (see withKeyLock
 * in lib/airtable/client.js) for the lock to actually prevent duplicate IDs. If
 * they were two separate locked/unlocked steps, a third caller could still read a
 * stale maximum in the gap between the second caller's read finishing and its
 * create() actually landing. Wrapping caller-provided create logic in a callback
 * is what lets the lock span the whole "read siblings -> create with that ID"
 * sequence.
 */
export async function generateChildId(
    { parentTableName, parentRecordId, parentLinkFieldName, childTableName, prefix },
    createFn
) {
    const kind = childKind(parentTableName, parentLinkFieldName);
    const lockKey = `${parentTableName}:${parentRecordId}:${parentLinkFieldName}`;

    return withKeyLock(lockKey, async () => {
        const parentRecord = await base(parentTableName).find(parentRecordId);
        const childRecordIds = parentRecord.get(parentLinkFieldName);
        const siblingRecordIds = Array.isArray(childRecordIds) ? childRecordIds : [];

        const siblings = await findByRecordIds(childTableName, siblingRecordIds, {
            fields: [kind.idField],
        });
        const siblingIds = siblings.map((record) => record.get(kind.idField));

        // A wrong `idField` reads undefined off every sibling, which would look
        // exactly like a childless parent and mint a duplicate — the defect this
        // function was just fixed for. Every child gets an ID at creation, so a
        // parent with siblings none of which has one is not a real state.
        if (siblings.length > 0 && siblingIds.every((id) => id === undefined)) {
            throw new Error(
                `generateChildId: none of ${siblings.length} sibling(s) in "${childTableName}" ` +
                    `carries a "${kind.idField}" — check CHILD_KINDS in lib/idSequence.js`
            );
        }

        const seq = nextSequence(siblingIds, prefix, { seqPrefix: kind.seqPrefix });
        const childId = formatSequentialId(prefix, seq, {
            padLength: kind.padLength,
            seqPrefix: kind.seqPrefix,
        });
        return createFn(childId);
    });
}
