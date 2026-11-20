// The reads and the write behind a job's inventory (#675); the judgment is `lib/materialStock.js`.
//
// WHAT A JOB'S STOCK COSTS TO READ. The job's own row carries its `Deliveries` and its
// `Material Log` links, so its stock is the deliveries by id, their items by id and its log rows
// by id — one query per 50 ids each, whatever the job holds of however many materials. The list
// adds what was ordered, through the walk delivery entry already makes
// (`lib/deliveryAllocation.server.js:getDeliveryCandidates`, five queries), the materials it
// names by id and the address table. Nothing here reads per job or per material; what grows is a
// job's history, at one query per 50 of its rows.
//
// TWO ISSUES OF ONE MATERIAL AT ONE ADDRESS, AND HOW FAR THEY ARE HELD APART. Airtable has no
// transaction, so a read of the stock and the write that depends on it can be passed by another.
//   1. A second press of one button: the form is busy while its submission is in flight.
//   2. Two requests in one server process: `withKeyLock` on the job, address and material
//      serializes the read and the write, as every read-then-write on this base does.
//   3. Two requests in two processes, which the lock cannot see: the writer reads the job's stock
//      again AFTER its write, and a row that leaves its address below zero is taken back and the
//      issue refused. The later of two writes is read after the earlier one is written, so it
//      always sees it; the two cannot both stand. Both may be taken back — each seeing the other —
//      which issues nothing and overdraws nothing.
//   NO ORDER BETWEEN THE TWO IS RELIED ON. Judging each row against only the rows created before
//   it would let exactly one of the two stand, but the base's creation time is to the second, and
//   two writes within one second would be ordered by record id — which can name the later write
//   as the earlier one, the one case the check exists for.
//   WHAT IS LEFT: a read that does not yet return a row written a moment before — not seen on this
//   base, where a row read by id comes back on the first read (`docs/notes/airtable-access.md`) —
//   a take-back that itself fails, which is logged, and a delivery deleted while an issue is in
//   flight, since a delete cannot be taken back. A count below zero is shown as it is, never as 0,
//   and #678's count edit is what corrects one.
//
// A DELIVERY'S ADDRESS CORRECTED WHILE AN ISSUE IS IN FLIGHT IS HELD THE SAME WAY (#680). The
// correction is a write that can be taken back, so it reads the stock again after its write as an
// issue does (`belowZeroAt`, `lib/deliveryAddress.server.js`), and of the two writes the later one
// sees the earlier. Its lock is the delivery's rather than one of these: a correction moves every
// material on the delivery at once, and two locks are never nested.

import { withKeyLock } from "./airtable/client";
import { getAllAddresses } from "./airtable/addresses";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getJobByRecordId } from "./airtable/jobs";
import { createMaterialLogEntry, getMaterialLogEntriesByRecordIds, takeBackMaterialLogEntry } from "./airtable/materialLog";
import { getMaterialsByRecordIds } from "./airtable/materials";
import { getDeliveryCandidates } from "./deliveryAllocation.server";
import { MATERIAL_LOG_EVENTS, belowZeroAt, foldJobInventory, issueRefusal, shortfallWithout, stockAt } from "./materialStock";

/**
 * A job's deliveries, their items and its log rows, read off the ids the job's own row carries
 * (`getAllJobs` and `getJobByRecordId` both hand them over).
 */
async function readJobStock(job) {
    const [deliveries, logEntries] = await Promise.all([
        getDeliveriesByRecordIds(job.deliveries ?? []),
        getMaterialLogEntriesByRecordIds(job.materialLog ?? []),
    ]);
    const deliveryItems = await getDeliveryItemsByRecordIds(deliveries.flatMap((d) => d.deliveryItems ?? []));
    return { deliveries, deliveryItems, logEntries };
}

/**
 * Everything a job's inventory screens show: its stock, what was ordered on it, the materials
 * they name and every address's label.
 */
export async function readJobInventory(job) {
    const [stock, ordered, addresses] = await Promise.all([readJobStock(job), getDeliveryCandidates([job]), getAllAddresses()]);
    const inventory = foldJobInventory({ ...stock, orderedItems: ordered.orderedItems });
    const materials = await getMaterialsByRecordIds([...inventory.keys()]);
    return {
        ...stock,
        inventory,
        materialById: new Map(materials.map((m) => [m.id, m])),
        addressLabelById: new Map(addresses.map((a) => [a.id, a.addressLabel])),
    };
}

/**
 * Record materials issued from an address (#675): `{ ok: true, entry }`, or `{ refusal, inStock }`
 * where `refusal` is a key of `INVENTORY_COPY.refusals`. The caller has decided who may; this
 * decides whether the address holds it, before and after the write — the module header has why
 * both.
 */
export async function recordIssue({ jobRecordId, materialRecordId, addressRecordId, qty, eventDate, recordedByUserId }) {
    const early = issueRefusal({ addressRecordId, qty, eventDate, inStock: Number.POSITIVE_INFINITY });
    if (early) return { refusal: early, inStock: null };

    return withKeyLock(`material-stock::${jobRecordId}::${addressRecordId}::${materialRecordId}`, async () => {
        const stockNow = async () => {
            const job = await getJobByRecordId(jobRecordId);
            return stockAt(foldJobInventory(await readJobStock(job)), materialRecordId, addressRecordId);
        };

        const before = await stockNow();
        const refusal = issueRefusal({ addressRecordId, qty, eventDate, inStock: before });
        if (refusal) return { refusal, inStock: before };

        const entry = await createMaterialLogEntry({
            jobRecordId,
            addressRecordId,
            materialRecordId,
            event: MATERIAL_LOG_EVENTS.ISSUED,
            qty: -qty,
            eventDate,
            recordedByUserId,
        });

        const after = await stockNow();
        if (after >= 0) return { ok: true, entry };

        try {
            await takeBackMaterialLogEntry(entry.id);
        } catch (error) {
            console.error(`recordIssue: ${entry.materialLogId} left its address at ${after} and could not be taken back`, error);
            return { ok: true, entry };
        }
        return { refusal: "more-than-stock", inStock: after + qty };
    });
}

/**
 * What taking this delivery off its address — deleting it (#675) or correcting its address
 * (#680) — would leave below zero, read fresh off its job: the judgment is
 * `lib/materialStock.js:shortfallWithout`. A caller already holding the job's row read fresh
 * hands it over and the job is not read again.
 */
export async function readShortfallWithout(delivery, items, heldJob = null) {
    const jobRecordId = (delivery.job ?? [])[0];
    if (!jobRecordId) return [];
    const job = heldJob?.id === jobRecordId ? heldJob : await getJobByRecordId(jobRecordId);
    // A job with no log row holds only what its deliveries hold, and removing one of them
    // leaves the rest at zero or above — so the one read is the job's own.
    if ((job.materialLog ?? []).length === 0) return [];
    const inventory = foldJobInventory(await readJobStock(job));
    return shortfallWithout({ inventory, delivery, items });
}

/**
 * Which of these materials stand below zero at this address on the job now, read fresh after a
 * write (#680): the judgment is `lib/materialStock.js:belowZeroAt`. One read on a job with no log
 * row, for `readShortfallWithout`'s reason — deliveries alone leave no address below zero.
 */
export async function readBelowZeroAt(jobRecordId, materialRecordIds, addressRecordId) {
    const job = await getJobByRecordId(jobRecordId);
    if ((job.materialLog ?? []).length === 0) return [];
    const inventory = foldJobInventory(await readJobStock(job));
    return belowZeroAt({ inventory, materialRecordIds, addressRecordId });
}
