import { base, TABLES, findByRecordIds } from "./client";
import { generateNextMaterialLogId } from "../idSequence.server";
import { MATERIAL_LOG_EVENTS, settlesASend } from "../materialStock";

/**
 * `Material Log` (#675): what has happened to a job's material at one of its addresses,
 * append-only — the inventory's ledger. One row is one movement of one material's stock at one
 * address on one job, and `Qty` is the CHANGE it made: an `Issued` or a `Sent` row is negative.
 * Deliveries are not rows here; `lib/materialStock.js` adds them to these to count the stock.
 *
 * A WRITTEN OFF ROW IS THE ONE THAT MOVES NO STOCK (#677): what it writes off left its address
 * with the `Sent` row and never reached another, so its `Qty` is what it took out of transit and
 * the stock leaves it out. Material sent between addresses is a `Sent` row naming its
 * `Destination Job` and `Destination Address`, and every `Received`, `Send canceled` and
 * `Written off` row names the `Sent` row it settles in `Send`; the reverse of that link,
 * `Material Log (as Send)`, is what hands a `Sent` row every row settling it, on whichever job
 * (`lib/materialTransit.js`).
 *
 * THE LINKS ARE SINGLE BY THE APP AND BY THE HAND TOGGLE — the Metadata API refuses
 * `prefersSingleRecordLink` (`scripts/import/ran/add_material_log_675.mjs`,
 * `scripts/import/ran/add_material_transit_677.mjs`) — so each is read as the raw array of record
 * ids every link here is, and written as a one-element one.
 */
function recordToMaterialLogEntry(record) {
    return {
        id: record.id,
        materialLogId: record.get("Material Log ID"),
        job: record.get("Job") || [],
        address: record.get("Address") || [],
        material: record.get("Material") || [],
        event: record.get("Event") ?? null,
        qty: record.get("Qty") ?? 0,
        eventDate: record.get("Event Date") ?? "",
        reason: record.get("Reason") ?? null,
        recordedBy: record.get("Recorded By") || [],
        recordedAt: record.get("Recorded At") ?? "",
        // #677 — where a Sent row's material went, and the Sent row a settling row settles.
        destinationJob: record.get("Destination Job") || [],
        destinationAddress: record.get("Destination Address") || [],
        send: record.get("Send") || [],
        // The reverse of `Send`: on a Sent row, every row settling it.
        settledBy: record.get("Material Log (as Send)") || [],
    };
}

/** A job's rows, from the ids its `Material Log` reverse link carries: one query per 50 ids. */
export async function getMaterialLogEntriesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.MATERIAL_LOG, recordIds)).map(recordToMaterialLogEntry);
}

/** A row's own read, by id: the row, or null once it is gone — a Sent row taken back (#677). */
export async function getMaterialLogEntryByRecordId(recordId) {
    if (!recordId) return null;
    const [entry] = await getMaterialLogEntriesByRecordIds([recordId]);
    return entry ?? null;
}

/** Which way each event moves its `Qty`: `-1` negative, `1` positive. `Count edited` (#678) is either. */
const SIGN_OF_EVENT = Object.freeze({
    [MATERIAL_LOG_EVENTS.ISSUED]: -1,
    [MATERIAL_LOG_EVENTS.SENT]: -1,
    [MATERIAL_LOG_EVENTS.RECEIVED]: 1,
    [MATERIAL_LOG_EVENTS.SEND_CANCELED]: 1,
    [MATERIAL_LOG_EVENTS.WRITTEN_OFF]: -1,
});

/**
 * Record one movement. `event` is a `MATERIAL_LOG_EVENTS` value and nothing else — a word the
 * select does not hold would be refused by Airtable, or, under `typecast`, become a new choice,
 * so it is refused here first. `qty` is the signed change, a whole number that is not zero, in the
 * direction its event moves it.
 *
 * A `Sent` row names where it went, both the job and the address, and a settling row names the
 * Sent row it settles (#677); any other row names neither. The callers decide which; this refuses
 * a row that does not fit, before the base is asked.
 */
export async function createMaterialLogEntry({
    jobRecordId,
    addressRecordId,
    materialRecordId,
    event,
    qty,
    eventDate,
    recordedByUserId,
    destinationJobRecordId = null,
    destinationAddressRecordId = null,
    sendRecordId = null,
}) {
    if (!Object.values(MATERIAL_LOG_EVENTS).includes(event)) throw new Error(`createMaterialLogEntry: no event ${JSON.stringify(event)}`);
    if (!Number.isInteger(qty) || qty === 0) throw new Error(`createMaterialLogEntry: qty ${JSON.stringify(qty)} is not a whole change`);
    if (SIGN_OF_EVENT[event] && Math.sign(qty) !== SIGN_OF_EVENT[event]) throw new Error(`createMaterialLogEntry: a ${event} row's qty is not ${qty}`);
    for (const [what, id] of Object.entries({ jobRecordId, addressRecordId, materialRecordId, recordedByUserId })) {
        if (!id) throw new Error(`createMaterialLogEntry: no ${what}`);
    }
    const sent = event === MATERIAL_LOG_EVENTS.SENT;
    if (sent !== Boolean(destinationJobRecordId) || sent !== Boolean(destinationAddressRecordId)) {
        throw new Error(`createMaterialLogEntry: a ${event} row ${sent ? "names" : "names no"} destination job and address`);
    }
    if (settlesASend(event) !== Boolean(sendRecordId)) {
        throw new Error(`createMaterialLogEntry: a ${event} row ${settlesASend(event) ? "names" : "names no"} Sent row`);
    }
    const record = await generateNextMaterialLogId((materialLogId) =>
        base(TABLES.MATERIAL_LOG).create({
            "Material Log ID": materialLogId,
            Job: [jobRecordId],
            Address: [addressRecordId],
            Material: [materialRecordId],
            Event: event,
            Qty: qty,
            "Event Date": eventDate,
            "Recorded By": [recordedByUserId],
            "Recorded At": new Date().toISOString(),
            ...(sent ? { "Destination Job": [destinationJobRecordId], "Destination Address": [destinationAddressRecordId] } : {}),
            ...(sendRecordId ? { Send: [sendRecordId] } : {}),
        })
    );
    return recordToMaterialLogEntry(record);
}

/**
 * Take back a row its own request wrote moments before, when the read after the write found it
 * left its address below zero (`lib/materialStock.server.js`, an issue or a send), or its Sent row
 * settled past what was sent or gone (`lib/materialTransit.server.js`, #677). The one delete on
 * this table: a row that stood is never removed, and a correction is a row of its own (#678).
 */
export async function takeBackMaterialLogEntry(recordId) {
    await base(TABLES.MATERIAL_LOG).destroy([recordId]);
}
