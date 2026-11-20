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
//
// A SEND IS AN ISSUE TO ANOTHER ADDRESS AS FAR AS THE ADDRESS IT LEAVES IS CONCERNED (#677): it
// takes this lock and reads the stock again after its write, so an issue and a send from one
// address are held apart exactly as two issues are (`lib/materialTransit.server.js`).
//
// A COUNT EDIT IS HELD TO THE COUNT IT SETS (#678), under the same lock. Its change is the count
// less the stock read just before the write, so it is right only if nothing else moved that stock in
// between: the press carries the figure its page drew, a stock that is not that figure under the lock
// is refused, and the read after the write must find the address at the count — anything else means
// another write landed beside it, and the row is taken back. Two edits of one address cannot both
// stand, and an issue or a send landing in the same moment turns the edit back rather than leaving a
// count nobody counted. A write landing just after it does too, which refuses an edit that was right;
// the reader is told and the page drawn again. NOT HELD, none of it seen: a read that misses a row
// written a moment before; a take-back that fails, logged; and a write the read after counted, taken
// back by its own writer once the edit stood — an issue that found its address overdrawn, a receipt
// whose send was gone — which leaves the address off the count by what that write moved. A count
// off by it is corrected by another edit.
//
// WHAT IS IN TRANSIT COSTS AT MOST ONE QUERY MORE (#677). The Sent rows coming to a job are read
// with its own rows, off the ids its row carries in `Material Log (as Destination)`; a Sent row
// hands over every row settling it, and only those standing on another job — a receipt of what
// this job sent, a cancel of what it was sent — are not already in hand, one query per 50.

import { withKeyLock } from "./airtable/client";
import { getAllAddresses } from "./airtable/addresses";
import { getDeliveriesByRecordIds } from "./airtable/deliveries";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { getJobByRecordId } from "./airtable/jobs";
import { createMaterialLogEntry, getMaterialLogEntriesByRecordIds, takeBackMaterialLogEntry } from "./airtable/materialLog";
import { getMaterialsByRecordIds } from "./airtable/materials";
import { getDeliveryCandidates } from "./deliveryAllocation.server";
import { MATERIAL_LOG_EVENTS, belowZeroAt, countEditRefusal, foldJobInventory, issueRefusal, shortfallWithout, stockAt } from "./materialStock";
import { forgetGone, jobSends, sendsOf, unreadSettlingIds } from "./materialTransit";

/**
 * A job's deliveries, their items and its log rows, read off the ids the job's own row carries
 * (`getAllJobs` and `getJobByRecordId` both hand them over). `alsoRead` are more log rows read in
 * the same query — the Sent rows coming to the job (#677) — handed back apart from its own.
 */
async function readJobStock(job, alsoRead = []) {
    const own = new Set(job.materialLog ?? []);
    const [deliveries, read] = await Promise.all([
        getDeliveriesByRecordIds(job.deliveries ?? []),
        getMaterialLogEntriesByRecordIds([...own, ...alsoRead.filter((id) => !own.has(id))]),
    ]);
    const deliveryItems = await getDeliveryItemsByRecordIds(deliveries.flatMap((d) => d.deliveryItems ?? []));
    return { deliveries, deliveryItems, logEntries: read.filter((entry) => own.has(entry.id)), alsoEntries: read.filter((entry) => !own.has(entry.id)) };
}

/** The lock one material's stock at one address on one job is read and written under: an issue's and a send's (#677). */
export function stockLockKey(jobRecordId, addressRecordId, materialRecordId) {
    return `material-stock::${jobRecordId}::${addressRecordId}::${materialRecordId}`;
}

/** One material's stock at one address on a job, read fresh off the job's row. */
export async function readStockAt(jobRecordId, materialRecordId, addressRecordId) {
    const job = await getJobByRecordId(jobRecordId);
    return stockAt(foldJobInventory(await readJobStock(job)), materialRecordId, addressRecordId);
}

/**
 * Everything a job's inventory screens show: its stock, what was ordered on it, what is in transit
 * from it and to it (#677), the materials they name and every address.
 */
export async function readJobInventory(job) {
    const [stock, ordered, addresses] = await Promise.all([
        readJobStock(job, job.materialLogAsDestination ?? []),
        getDeliveryCandidates([job]),
        getAllAddresses(),
    ]);
    const held = [...stock.logEntries, ...stock.alsoEntries];
    const asked = unreadSettlingIds(held, held.map((entry) => entry.id));
    const elsewhere = await getMaterialLogEntriesByRecordIds(asked);
    const read = [...held, ...elsewhere];
    const answered = new Set(read.map((entry) => entry.id));
    const sends = sendsOf(forgetGone(read, asked.filter((id) => !answered.has(id))));
    const { outgoing, incoming } = jobSends(sends, job.id);
    const inventory = foldJobInventory({ ...stock, orderedItems: ordered.orderedItems, outgoing, incoming });
    const materials = await getMaterialsByRecordIds([...inventory.keys()]);
    return {
        ...stock,
        inventory,
        outgoing,
        incoming,
        sendById: new Map(sends.map((send) => [send.id, send])),
        addresses,
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

    return withKeyLock(stockLockKey(jobRecordId, addressRecordId, materialRecordId), async () => {
        const stockNow = () => readStockAt(jobRecordId, materialRecordId, addressRecordId);

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
 * Edit a material's count at an address (#678): `{ ok: true, entry }`, or `{ refusal, inStock }`
 * where `refusal` is a key of `INVENTORY_COPY.countEdit.refusals` and `inStock` the stock read, or
 * null when no figure read is true now. The caller has decided who may; this decides whether the
 * stock is still the figure the page drew (`shownQty`), before the write, and whether the address
 * stands at the count after it — the module header has why both.
 */
export async function recordCountEdit({ jobRecordId, materialRecordId, addressRecordId, countedQty, shownQty, reason, notes, eventDate, recordedByUserId }) {
    const early = countEditRefusal({ addressRecordId, countedQty, reason, shownQty });
    if (early) return { refusal: early, inStock: null };

    return withKeyLock(stockLockKey(jobRecordId, addressRecordId, materialRecordId), async () => {
        const stockNow = () => readStockAt(jobRecordId, materialRecordId, addressRecordId);

        const before = await stockNow();
        const refusal = countEditRefusal({ addressRecordId, countedQty, reason, shownQty, inStock: before });
        if (refusal) return { refusal, inStock: before };

        const entry = await createMaterialLogEntry({
            jobRecordId,
            addressRecordId,
            materialRecordId,
            event: MATERIAL_LOG_EVENTS.COUNT_EDITED,
            qty: countedQty - before,
            countedQty,
            reason,
            notes,
            eventDate,
            recordedByUserId,
        });

        const after = await stockNow();
        if (after === countedQty) return { ok: true, entry };

        try {
            await takeBackMaterialLogEntry(entry.id);
        } catch (error) {
            console.error(`recordCountEdit: ${entry.materialLogId} left its address at ${after}, not ${countedQty}, and could not be taken back`, error);
            return { ok: true, entry };
        }
        // Another write landed beside this one and may be standing down too, so no figure read
        // now is what the address holds: the page is drawn again instead (#677's `raced`).
        return { refusal: "raced", inStock: null };
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
