// The reads and writes behind sending material between addresses and receiving it (#677); the
// judgment and the words are `lib/materialTransit.js`.
//
// A SEND IS HELD TO THE ADDRESS IT LEAVES AS AN ISSUE IS (#675). It takes the issue's lock —
// `stockLockKey` on the job, the address and the material — so an issue and a send from one
// address in one process run one after the other, and across processes it reads the stock again
// after its write and takes its own row back when the address is left below zero: of two writes the
// later is read after the earlier lands, so the two cannot both stand. The same holds against a
// delivery's address corrected away from the address (#680), whose own read after its write sees
// the send. What it does not hold is #675's list: a read that misses a row written a moment before
// (not seen on this base), a take-back that fails (logged), and a delivery at the address deleted
// in the same moment, since a delete cannot be taken back.
//
// A RECEIPT, A CANCEL AND A WRITE-OFF ARE HELD TO WHAT IS LEFT IN TRANSIT THE SAME WAY. Each takes
// a lock on the send — `material-send::` and the Sent row's id — reads the send under it, writes its
// row, and reads the send again: a row that leaves it settled past what was sent is taken back, so
// two of them in two processes cannot both stand, and both may be turned back, which settles
// nothing twice. A receipt or a cancel ALSO takes its row back when the Sent row is gone, read
// again after the write: the send it settles was itself taken back (its address was overdrawn), so
// the material never left. The fold counts such a row for nothing in the moment between
// (`lib/materialStock.js`). Two locks are never nested: none of these takes the stock lock, since a
// receipt and a cancel only add to an address and a write-off moves no address's stock.
//
// WHAT IS NOT HELD HERE, none of it seen: a receipt or a cancel taken back after an issue or a
// send drew on the stock it added in the same moment, which leaves that address below zero — the
// third write #680 records for a correction; and a take-back that fails, logged as above.

import { withKeyLock } from "./airtable/client";
import { getAllAddresses } from "./airtable/addresses";
import { getAllJobs } from "./airtable/jobs";
import {
    createMaterialLogEntry,
    getMaterialLogEntriesByRecordIds,
    getMaterialLogEntryByRecordId,
    takeBackMaterialLogEntry,
} from "./airtable/materialLog";
import { MATERIAL_LOG_EVENTS } from "./materialStock";
import { readStockAt, stockLockKey } from "./materialStock.server";
import {
    canCancel,
    canReceive,
    canSendFrom,
    canWriteOff,
    cancelRefusal,
    destinationRefusal,
    forgetGone,
    receiveRefusal,
    sendRefusal,
    sendsOf,
    writeOffRefusal,
} from "./materialTransit";

/**
 * One send as it stands now, read fresh — the Sent row and every row settling it — or null once it
 * is gone. A settling row the Sent row lists and the second read does not return was taken back in
 * between, and counts for nothing (`forgetGone`).
 */
async function readSend(sentRecordId) {
    const sent = await getMaterialLogEntryByRecordId(sentRecordId);
    if (!sent || sent.event !== MATERIAL_LOG_EVENTS.SENT) return null;
    const settling = await getMaterialLogEntriesByRecordIds(sent.settledBy);
    const answered = new Set(settling.map((entry) => entry.id));
    return sendsOf(forgetGone([sent, ...settling], sent.settledBy.filter((id) => !answered.has(id))))[0];
}

/** Take back a row its own request wrote, logging rather than throwing when that fails: `true` once it is gone. */
async function takeBack(entry, why) {
    try {
        await takeBackMaterialLogEntry(entry.id);
        return true;
    } catch (error) {
        console.error(`${entry.materialLogId} ${why} and could not be taken back`, error);
        return false;
    }
}

/**
 * Send material from one of a job's addresses to an address of an open job: `{ ok: true, entry }`,
 * or `{ refusal, … }` where `refusal` is a key of `TRANSIT_COPY.refusals.send`. Who may is the
 * caller's (`canSendFrom`), asked again here so a script reaches the same guard.
 */
export async function recordSend({ user, fromJobRecordId, fromAddressRecordId, toJobRecordId, toAddressRecordId, materialRecordId, qty, sentDate, today }) {
    if (!canSendFrom(user, fromJobRecordId)) return { refusal: "not-allowed" };
    const asked = { fromJobRecordId, fromAddressRecordId, toJobRecordId, toAddressRecordId, qty, sentDate, today };
    const early = sendRefusal({ ...asked, inStock: Number.POSITIVE_INFINITY });
    if (early) return { refusal: early };

    // Where it goes, judged on the job as it stands now: the page's list may be older.
    const [jobs, addresses] = await Promise.all([getAllJobs(), getAllAddresses()]);
    const toJob = jobs.find((job) => job.id === toJobRecordId) ?? null;
    const toAddress = addresses.find((address) => address.id === toAddressRecordId) ?? null;
    const there = destinationRefusal({ toJob, addresses, toAddressRecordId });
    if (there) return { refusal: there, toJob, toAddress };

    return withKeyLock(stockLockKey(fromJobRecordId, fromAddressRecordId, materialRecordId), async () => {
        const stockNow = () => readStockAt(fromJobRecordId, materialRecordId, fromAddressRecordId);
        const before = await stockNow();
        const refusal = sendRefusal({ ...asked, inStock: before });
        if (refusal) return { refusal, inStock: before };

        const entry = await createMaterialLogEntry({
            jobRecordId: fromJobRecordId,
            addressRecordId: fromAddressRecordId,
            materialRecordId,
            event: MATERIAL_LOG_EVENTS.SENT,
            qty: -qty,
            eventDate: sentDate,
            recordedByUserId: user.id,
            destinationJobRecordId: toJobRecordId,
            destinationAddressRecordId: toAddressRecordId,
        });

        const after = await stockNow();
        if (after >= 0) return { ok: true, entry };
        if (!(await takeBack(entry, `left its address at ${after}`))) return { ok: true, entry };
        return { refusal: "more-than-stock", inStock: after + qty };
    });
}

/**
 * Read the send again after a settling row was written, and take the row back when the send is gone
 * or settled past what was sent: `{ ok: true, entry, send }`, or `{ refusal, send }`.
 *
 * A SEND SETTLED PAST WHAT WAS SENT IS `raced`, AND SAYS NO FIGURE: another settling row landed in
 * the same moment, and it may be taking itself back as this one is — measured on the test base, a
 * receipt and a cancel of the last unit each saw the other and both stood down — so no figure read
 * here is what is left once both are done. The page drawn again with the refusal shows that.
 */
async function standOrTakeBack(entry, sentRecordId) {
    const after = await readSend(sentRecordId);
    if (after && after.remaining >= 0) return { ok: true, entry, send: after };
    const why = after ? `settled its send past what was sent (${after.remaining})` : "settles a send that is gone";
    if (!(await takeBack(entry, why))) return { ok: true, entry, send: after };
    return { refusal: after ? "raced" : "send-gone", send: after };
}

const sendLockKey = (sentRecordId) => `material-send::${sentRecordId}`;

/**
 * Record what arrived of a send, at the address it was sent to: `{ ok: true, entry, send }`, or
 * `{ refusal, send }` where `refusal` is a key of `TRANSIT_COPY.refusals.receive`.
 */
export async function recordReceipt({ user, sentRecordId, qty, receivedDate, today }) {
    return withKeyLock(sendLockKey(sentRecordId), async () => {
        const send = await readSend(sentRecordId);
        if (!send) return { refusal: "send-gone", send: null };
        if (!canReceive(user, send)) return { refusal: "not-allowed", send };
        const refusal = receiveRefusal({ qty, receivedDate, sentDate: send.sentDate, today, remaining: send.remaining });
        if (refusal) return { refusal, send };

        const entry = await createMaterialLogEntry({
            jobRecordId: send.toJobRecordId,
            addressRecordId: send.toAddressRecordId,
            materialRecordId: send.materialRecordId,
            event: MATERIAL_LOG_EVENTS.RECEIVED,
            qty,
            eventDate: receivedDate,
            recordedByUserId: user.id,
            sendRecordId: send.id,
        });
        return standOrTakeBack(entry, send.id);
    });
}

/**
 * Take back what has not arrived of a send, to the address it left: `{ ok: true, entry, send }`, or
 * `{ refusal, send }` where `refusal` is a key of `TRANSIT_COPY.refusals.cancel`. Its day is the
 * reader's today.
 */
export async function recordSendCancel({ user, sentRecordId, qty, today }) {
    return withKeyLock(sendLockKey(sentRecordId), async () => {
        const send = await readSend(sentRecordId);
        if (!send) return { refusal: "send-gone", send: null };
        if (!canCancel(user, send)) return { refusal: "not-allowed", send };
        const refusal = cancelRefusal({ qty, remaining: send.remaining });
        if (refusal) return { refusal, send };

        const entry = await createMaterialLogEntry({
            jobRecordId: send.fromJobRecordId,
            addressRecordId: send.fromAddressRecordId,
            materialRecordId: send.materialRecordId,
            event: MATERIAL_LOG_EVENTS.SEND_CANCELED,
            qty,
            eventDate: today,
            recordedByUserId: user.id,
            sendRecordId: send.id,
        });
        return standOrTakeBack(entry, send.id);
    });
}

/**
 * Write off all that never arrived of a send — `qty`, what the reader confirmed — at the address it
 * left, moving no stock: `{ ok: true, entry, send }`, or `{ refusal, send }` where `refusal` is a key
 * of `TRANSIT_COPY.refusals.writeOff`. The office's alone.
 */
export async function recordWriteOff({ user, sentRecordId, qty, today }) {
    if (!canWriteOff(user)) return { refusal: "not-allowed", send: null };
    return withKeyLock(sendLockKey(sentRecordId), async () => {
        const send = await readSend(sentRecordId);
        if (!send) return { refusal: "send-gone", send: null };
        const refusal = writeOffRefusal({ remaining: send.remaining, qty });
        if (refusal) return { refusal, send };

        const entry = await createMaterialLogEntry({
            jobRecordId: send.fromJobRecordId,
            addressRecordId: send.fromAddressRecordId,
            materialRecordId: send.materialRecordId,
            event: MATERIAL_LOG_EVENTS.WRITTEN_OFF,
            qty: -send.remaining,
            eventDate: today,
            recordedByUserId: user.id,
            sendRecordId: send.id,
        });
        return standOrTakeBack(entry, send.id);
    });
}
