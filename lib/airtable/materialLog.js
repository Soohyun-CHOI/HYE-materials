import { base, TABLES, findByRecordIds } from "./client";
import { generateNextMaterialLogId } from "../idSequence.server";
import { MATERIAL_LOG_EVENTS } from "../materialStock";

/**
 * `Material Log` (#675): what has happened to a job's material at one of its addresses,
 * append-only — the inventory's ledger. One row is one movement of one material's stock at one
 * address on one job, and `Qty` is the CHANGE it made: an `Issued` row is negative. Deliveries
 * are not rows here; `lib/materialStock.js` adds them to these to count the stock.
 *
 * THE FOUR LINKS ARE SINGLE BY THE APP AND BY THE HAND TOGGLE — the Metadata API refuses
 * `prefersSingleRecordLink` (`scripts/import/ran/add_material_log_675.mjs`) — so each is read as the
 * raw array of record ids every link here is, and written as a one-element one.
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
    };
}

/** A job's rows, from the ids its `Material Log` reverse link carries: one query per 50 ids. */
export async function getMaterialLogEntriesByRecordIds(recordIds) {
    return (await findByRecordIds(TABLES.MATERIAL_LOG, recordIds)).map(recordToMaterialLogEntry);
}

/**
 * Record one movement. `event` is a `MATERIAL_LOG_EVENTS` value and nothing else — a word the
 * select does not hold would be refused by Airtable, or, under `typecast`, become a new choice,
 * so it is refused here first. `qty` is the signed change, a whole number that is not zero.
 */
export async function createMaterialLogEntry({ jobRecordId, addressRecordId, materialRecordId, event, qty, eventDate, recordedByUserId }) {
    if (!Object.values(MATERIAL_LOG_EVENTS).includes(event)) throw new Error(`createMaterialLogEntry: no event ${JSON.stringify(event)}`);
    if (!Number.isInteger(qty) || qty === 0) throw new Error(`createMaterialLogEntry: qty ${JSON.stringify(qty)} is not a whole change`);
    for (const [what, id] of Object.entries({ jobRecordId, addressRecordId, materialRecordId, recordedByUserId })) {
        if (!id) throw new Error(`createMaterialLogEntry: no ${what}`);
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
        })
    );
    return recordToMaterialLogEntry(record);
}

/**
 * Take back a row its own request wrote moments before, when the read after the write found it
 * left its address below zero (`lib/materialStock.server.js`). The one delete on this table: a
 * row that stood is never removed, and a correction is a row of its own (#678).
 */
export async function takeBackMaterialLogEntry(recordId) {
    await base(TABLES.MATERIAL_LOG).destroy([recordId]);
}
