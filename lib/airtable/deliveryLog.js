import { base, TABLES, findChildRecords } from "./client";
import { generateChildId } from "../idSequence.server";
import { DELIVERY_LOG_EVENTS } from "../deliveryLog";

/**
 * What has happened to a recorded delivery since it was recorded (#680): append-only, one row per
 * event, and the delivery's activity. #680 writes `Address corrected`, which names the address
 * the delivery left and the one it was corrected to; #277's `Order attached` is a choice of the
 * select already and has no writer yet.
 *
 * NOT THE INVENTORY'S LEDGER. A job's stock at an address is read off the delivery itself
 * (`lib/materialStock.js`), so a correction moves it with the one write to `Delivery Address`, and
 * this row is the record of who made it. `Material Log` is the ledger of what happened to the
 * stock; this is what happened to the delivery.
 *
 * NO UPDATE FUNCTION, `lib/airtable/invoiceVarianceLog.js`'s shape: a row records what was true at a
 * moment. `lib/deliveryAddress.server.js` is the one writer, and a delivery's delete takes its rows
 * with it (`lib/deliveryDelete.js`), as an invoice's does.
 */

function recordToDeliveryLogEntry(record) {
    return {
        id: record.id,
        deliveryLogId: record.get("Delivery Log ID"),
        delivery: record.get("Delivery") || [],
        event: record.get("Event") ?? null,
        address: record.get("Address") || [],
        formerAddress: record.get("Former Address") || [],
        recordedBy: record.get("Recorded By") || [],
        eventAt: record.get("Event At") ?? null,
    };
}

/**
 * The rows a delivery's `Delivery Log` reverse link names, in that array's order. The caller holds
 * the delivery, so it is not read again (#193's shape); an empty array costs nothing.
 */
export async function getDeliveryLogEntries(rowIds) {
    return (await findChildRecords(TABLES.DELIVERY_LOG, rowIds)).map(recordToDeliveryLogEntry);
}

/**
 * Append one event. `Delivery Log ID` is `{Delivery ID}-{seq}`, minted under the delivery's lock
 * (`Deliveries::Delivery Log` in `lib/idSequence.js`). The event is a `DELIVERY_LOG_EVENTS` value
 * and nothing else — no `typecast`, so Airtable refuses another word too, but after the lock and
 * the sibling read.
 */
export async function createDeliveryLogEntry({ deliveryRecordId, deliveryId, event, addressRecordId, formerAddressRecordId, recordedByUserId }) {
    if (!Object.values(DELIVERY_LOG_EVENTS).includes(event)) throw new Error(`createDeliveryLogEntry: no event ${JSON.stringify(event)}`);
    for (const [what, id] of Object.entries({ deliveryRecordId, deliveryId, recordedByUserId })) {
        if (!id) throw new Error(`createDeliveryLogEntry: no ${what}`);
    }

    const record = await generateChildId(
        {
            parentTableName: TABLES.DELIVERIES,
            parentRecordId: deliveryRecordId,
            parentLinkFieldName: "Delivery Log",
            childTableName: TABLES.DELIVERY_LOG,
            prefix: deliveryId,
        },
        (deliveryLogId) =>
            base(TABLES.DELIVERY_LOG).create({
                "Delivery Log ID": deliveryLogId,
                Delivery: [deliveryRecordId],
                Event: event,
                Address: addressRecordId ? [addressRecordId] : [],
                "Former Address": formerAddressRecordId ? [formerAddressRecordId] : [],
                "Recorded By": [recordedByUserId],
                "Event At": new Date().toISOString(),
            })
    );
    return recordToDeliveryLogEntry(record);
}

/**
 * Remove the rows of a delivery being deleted, with its items — a delivery's log is its child as
 * its items are, so a row is never left naming a delivery that is gone. The batch form, which
 * refuses an id from another table (#444).
 */
export async function destroyDeliveryLogEntries(rowIds) {
    const ids = Array.from(new Set((rowIds || []).filter(Boolean)));
    for (let i = 0; i < ids.length; i += 10) {
        await base(TABLES.DELIVERY_LOG).destroy([...ids.slice(i, i + 10)]);
    }
}
