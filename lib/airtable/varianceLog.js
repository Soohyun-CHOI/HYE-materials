import { base, TABLES, findChildRecords } from "./client";
import { generateChildId } from "../idSequence.server";
import { VARIANCE_EVENT_VALUES, VARIANCE_KIND_VALUES } from "../variance";

/**
 * What has happened to an invoice's variances (#648). Append-only, one row per event, and the
 * record the three `... Accepted` checkboxes are a cache of — `Invoice Items."Price Variance
 * Accepted"` and `"Quantity Variance Accepted"`, `Invoices."Totals Differ Accepted"`.
 *
 * WHY A LOG AND NOT FIELDS ON THE ROW. An acceptance is a decision somebody answers for, and an
 * audit asks who made it, when and why, and when it stopped standing. Fields on the item would
 * hold the latest acceptance and lose the one before it the moment an edit reopened it and an
 * Admin accepted again. So each event is a row — `Accepted` with its reason, `Reopened` or
 * `Cleared` when an edit ends it — and each carries the two figures the variance compared at
 * that moment, so the row says WHAT was accepted and what it was changed to. The cache is what
 * keeps the lists from reading this table: `/invoices` and `/pos/[poId]` read the checkbox on
 * records they already hold. `docs/notes/deliveries-and-invoices.md` has the alternatives.
 *
 * NO UPDATE FUNCTION, `lib/airtable/prEditLog.js`'s shape and `Asset Log`'s: a row records what
 * was true at a moment, and a moment does not change. `lib/variance.server.js` is the one writer.
 */

/**
 * The rows an invoice's `Variance Log` reverse link names, in that array's order — the order
 * they were written, since a row is linked to its invoice as it is created. The caller holds the
 * invoice record, so the parent is not read again (#193's shape); an empty array costs nothing.
 */
export async function getVarianceLogEntries(rowIds) {
    return (await findChildRecords(TABLES.VARIANCE_LOG, rowIds)).map(recordToVarianceLogEntry);
}

function recordToVarianceLogEntry(record) {
    return {
        id: record.id,
        varianceLogId: record.get("Variance Log ID"),
        invoice: record.get("Invoice") || [],
        // Empty on a `Totals differ` row, which is the invoice's own.
        invoiceItem: record.get("Invoice Item") || [],
        variance: record.get("Variance") ?? null,
        event: record.get("Event") ?? null,
        reason: record.get("Reason") || "",
        vendorFigure: record.get("Vendor Figure") ?? null,
        ourFigure: record.get("Our Figure") ?? null,
        recordedBy: record.get("Recorded By") || [],
        eventAt: record.get("Event At") ?? null,
    };
}

/**
 * Append one event. `Variance Log ID` is `{Invoice ID}-{seq}`, minted under the invoice's lock
 * (`Invoices::Variance Log` in `lib/idSequence.js`).
 *
 * THE TWO CLOSED SETS ARE REFUSED HERE RATHER THAN BY THE BASE ALONE. No `typecast`, so a value
 * outside a select's choices is refused by Airtable as well (`docs/notes/airtable-access.md`), but
 * that refusal arrives after the lock and the sibling read; a caller passing a word the module
 * does not hold has a defect, and saying so before the round trip names it.
 */
export async function createVarianceLogEntry({
    invoiceRecordId,
    invoiceId,
    invoiceItemRecordId,
    variance,
    event,
    reason,
    vendorFigure,
    ourFigure,
    recordedByUserId,
}) {
    if (!VARIANCE_KIND_VALUES.includes(variance)) {
        throw new Error(`createVarianceLogEntry: "${variance}" is not one of ${VARIANCE_KIND_VALUES.join(", ")}`);
    }
    if (!VARIANCE_EVENT_VALUES.includes(event)) {
        throw new Error(`createVarianceLogEntry: "${event}" is not one of ${VARIANCE_EVENT_VALUES.join(", ")}`);
    }

    const record = await generateChildId(
        {
            parentTableName: TABLES.INVOICES,
            parentRecordId: invoiceRecordId,
            parentLinkFieldName: "Variance Log",
            childTableName: TABLES.VARIANCE_LOG,
            prefix: invoiceId,
        },
        (varianceLogId) =>
            base(TABLES.VARIANCE_LOG).create({
                "Variance Log ID": varianceLogId,
                Invoice: [invoiceRecordId],
                "Invoice Item": invoiceItemRecordId ? [invoiceItemRecordId] : [],
                Variance: variance,
                Event: event,
                Reason: reason || "",
                ...(vendorFigure != null ? { "Vendor Figure": vendorFigure } : {}),
                ...(ourFigure != null ? { "Our Figure": ourFigure } : {}),
                "Recorded By": recordedByUserId ? [recordedByUserId] : [],
                "Event At": new Date().toISOString(),
            })
    );

    return recordToVarianceLogEntry(record);
}

/**
 * Remove the rows of an invoice being deleted (#648), with its items. An invoice's log is its
 * child as its items are, and `deleteInvoiceAction` takes the children first, so a row is never
 * left naming an invoice that is gone. The batch form, which refuses an id from another table
 * (#444).
 */
export async function destroyVarianceLogEntries(rowIds) {
    const ids = Array.from(new Set((rowIds || []).filter(Boolean)));
    for (let i = 0; i < ids.length; i += 10) {
        await base(TABLES.VARIANCE_LOG).destroy([...ids.slice(i, i + 10)]);
    }
}
