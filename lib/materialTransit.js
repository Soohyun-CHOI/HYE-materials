// Material sent from one of a job's addresses to an address of an open job, and received there
// (#677) — what is in transit, who records each act on it, why one is refused, and every word the
// sending and the receiving say. The reads and writes are `lib/materialTransit.server.js`'s.
//
// A SEND IS A `Sent` ROW, AND WHAT IS IN TRANSIT IS COMPUTED FROM THE ROWS SETTLING IT. A Sent row
// stands at the address the material left, its `Qty` negative, and names `Destination Job` and
// `Destination Address`. Every `Received` row (at the destination), `Send canceled` row (back at the
// address it left) and `Written off` row names the Sent row it settles in `Send`, and the Sent row's
// reverse link hands all of them over, on whichever job. What is still in transit is what was sent
// less what those rows took — stored nowhere, so no second write has to keep it in step. The
// derivation is in `docs/notes/materials.md`'s #677 section.
//
// THE STOCK FOLLOWS FROM THE SAME ROWS AND NOTHING ELSE: a Sent row is the address it left giving
// it up, a Received row the destination taking it in, a Send canceled row the address it left
// taking it back. A WRITTEN OFF ROW MOVES NO ADDRESS'S STOCK — what it writes off left its address
// with the Sent row and never reached another — so `lib/materialStock.js`'s fold leaves it out and
// only this module counts it.
//
// WHO. Sending and canceling are the sending job's — `canAccessJobInventory` on the job the Sent row
// stands on — receiving the destination job's, and writing off the office's alone. A closed job may
// send and cancel, as it may issue (#675), and a destination closed after the send may still
// receive: the material is on its way whatever the job's books say, and refusing it would leave a
// false write-off or a false cancel as the only ways out. Only a NEW destination is an open job's
// (`lib/closedJob.js`), which leaves a closed job unable to send to its own other address.
//
// PURE AND OFFLINE-SAFE, so the forms can import the words and `offline/material-transit.mjs` can
// call every rule here.

import { addressesOnJob } from "./jobAddresses.js";
import { CLOSED_JOB_COPY, isClosed, offeredJobs } from "./closedJob.js";
import { dayOf, knownTimeZone } from "./format.js";
import { MATERIAL_LOG_EVENTS, canAccessJobInventory, isoDay, qtyText, settlesASend } from "./materialStock.js";

/** Which of a send's figures each settling row's quantity counts in. */
const FIGURE_OF_EVENT = Object.freeze({
    [MATERIAL_LOG_EVENTS.RECEIVED]: "received",
    [MATERIAL_LOG_EVENTS.SEND_CANCELED]: "canceled",
    [MATERIAL_LOG_EVENTS.WRITTEN_OFF]: "writtenOff",
});

const first = (link) => (link ?? [])[0] ?? null;

/**
 * Every send among the rows held, with what settled it: `[{ id, materialLogId, materialRecordId,
 * fromJobRecordId, fromAddressRecordId, toJobRecordId, toAddressRecordId, qty, sentDate, sentBy,
 * sentAt, received, canceled, writtenOff, remaining }]`. `qty` is what was sent, and each of the
 * three what the rows of that kind took out of transit, all positive; `remaining` is what is still
 * in transit.
 *
 * A SETTLING ROW THE CALLER DID NOT HAND OVER THROWS, as a delivery with no address does in the
 * fold: a remainder computed without it would be a figure that is wrong with nothing on screen to
 * say so. So does a settling row naming another Sent row than the one whose reverse link lists it.
 */
export function sendsOf(entries) {
    const byId = new Map((entries ?? []).map((entry) => [entry.id, entry]));
    const sends = [];
    for (const entry of byId.values()) {
        if (entry.event !== MATERIAL_LOG_EVENTS.SENT) continue;
        const send = {
            id: entry.id,
            materialLogId: entry.materialLogId,
            materialRecordId: first(entry.material),
            fromJobRecordId: first(entry.job),
            fromAddressRecordId: first(entry.address),
            toJobRecordId: first(entry.destinationJob),
            toAddressRecordId: first(entry.destinationAddress),
            qty: Math.abs(Number(entry.qty) || 0),
            sentDate: entry.eventDate ?? "",
            sentBy: first(entry.recordedBy),
            sentAt: entry.recordedAt ?? "",
            received: 0,
            canceled: 0,
            writtenOff: 0,
            remaining: 0,
        };
        for (const settlingId of entry.settledBy ?? []) {
            const settling = byId.get(settlingId);
            if (!settling) throw new Error(`send ${entry.materialLogId ?? entry.id}'s settling row ${settlingId} was not read`);
            if (first(settling.send) !== entry.id || !settlesASend(settling.event)) {
                throw new Error(`row ${settling.materialLogId ?? settlingId} does not settle send ${entry.materialLogId ?? entry.id}`);
            }
            send[FIGURE_OF_EVENT[settling.event]] += Math.abs(Number(settling.qty) || 0);
        }
        send.remaining = send.qty - send.received - send.canceled - send.writtenOff;
        sends.push(send);
    }
    return sends;
}

/**
 * The sends a job's inventory shows: those leaving it and those coming to it, each oldest first by
 * the day they were sent. One send between two of its own addresses is both.
 */
export function jobSends(sends, jobRecordId) {
    const bySent = (a, b) => (a.sentDate !== b.sentDate ? (a.sentDate < b.sentDate ? -1 : 1) : a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0);
    return {
        outgoing: sends.filter((send) => send.fromJobRecordId === jobRecordId).sort(bySent),
        incoming: sends.filter((send) => send.toJobRecordId === jobRecordId).sort(bySent),
    };
}

/**
 * The rows read, with every Sent row's settling ids that were ASKED FOR AND NOT RETURNED dropped —
 * `gone`, the ids a read asked for that no row answered. Such a row was taken back between the read
 * that listed it and the read that asked for it (`lib/materialTransit.server.js`), so it settled
 * nothing; counting it would need a row that no longer exists. Measured on the test base: two
 * receipts in two processes, one taking its row back while the other read the send, made the reader
 * throw on a row the Sent row still listed. An id never asked for still throws in `sendsOf`.
 */
export function forgetGone(entries, gone) {
    const goneIds = new Set(gone);
    if (goneIds.size === 0) return entries;
    return (entries ?? []).map((entry) =>
        entry.event === MATERIAL_LOG_EVENTS.SENT ? { ...entry, settledBy: (entry.settledBy ?? []).filter((id) => !goneIds.has(id)) } : entry
    );
}

/** The ids of the rows settling these Sent rows that are not among `heldIds` — what is left to read. */
export function unreadSettlingIds(entries, heldIds) {
    const held = new Set(heldIds);
    const missing = new Set();
    for (const entry of entries ?? []) {
        if (entry.event !== MATERIAL_LOG_EVENTS.SENT) continue;
        for (const id of entry.settledBy ?? []) if (!held.has(id)) missing.add(id);
    }
    return [...missing];
}

/** Who may send from a job, and cancel what it sent: who may record on it. */
export function canSendFrom(user, jobRecordId) {
    return canAccessJobInventory(user, jobRecordId);
}

/** Who may receive a send: who may record on the job it was sent to. */
export function canReceive(user, send) {
    return canAccessJobInventory(user, send?.toJobRecordId ?? null);
}

/** Who may cancel what is left of a send: who may record on the job it left. */
export function canCancel(user, send) {
    return canAccessJobInventory(user, send?.fromJobRecordId ?? null);
}

/** Who may write off what never arrived: the office alone. `true` and nothing else admits. */
export function canWriteOff(user) {
    return user?.isAdmin === true;
}

/**
 * Where a job may send to, by job: every open job with an address, the sending job first and the
 * rest by code — `[{ jobRecordId, jobCode, addresses: [{ addressRecordId, label }] }]`. A job's
 * addresses are `addressesOnJob`'s, the ones a delivery may stand at (#680), since a receipt adds to
 * the stock the same way a delivery does.
 */
export function destinationChoices({ jobs, addresses, fromJobRecordId }) {
    return offeredJobs(jobs)
        .map((job) => ({
            jobRecordId: job.id,
            jobCode: job.jobCode ?? "",
            addresses: addressesOnJob(job, addresses).map((address) => ({ addressRecordId: address.id, label: address.addressLabel ?? address.id })),
        }))
        .filter((choice) => choice.addresses.length > 0)
        .sort((a, b) => (a.jobRecordId === fromJobRecordId ? -1 : b.jobRecordId === fromJobRecordId ? 1 : a.jobCode.localeCompare(b.jobCode)));
}

/** The reader's today as `YYYY-MM-DD`, in the zone their press sent (`knownTimeZone`). */
export function todayIn(timeZone, now = new Date()) {
    const zone = knownTimeZone(timeZone);
    return isoDay(dayOf(now, zone));
}

const isDay = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""));
const isWhole = (qty) => Number.isInteger(qty) && qty > 0;

/**
 * Why a send is refused, as a key of `TRANSIT_COPY.refusals.send`, or null: no address it leaves, no
 * address it goes to, the same address on the same job, a quantity that is not a whole number above
 * zero, no date or one later than the reader's today, or more than the address it leaves holds.
 */
export function sendRefusal({ fromJobRecordId, fromAddressRecordId, toJobRecordId, toAddressRecordId, qty, sentDate, today, inStock }) {
    if (!fromAddressRecordId) return "no-address";
    if (!toJobRecordId || !toAddressRecordId) return "no-destination";
    if (toJobRecordId === fromJobRecordId && toAddressRecordId === fromAddressRecordId) return "same-address";
    if (!isWhole(qty)) return "not-a-quantity";
    if (!isDay(sentDate)) return "no-date";
    if (isDay(today) && sentDate > today) return "future-date";
    if (qty > inStock) return "more-than-stock";
    return null;
}

/**
 * Why the place a send goes is refused, or null: the job is not on the base, it is closed, or the
 * address is not one of its. Asked of the job read at the write, since the page may be older.
 */
export function destinationRefusal({ toJob, addresses, toAddressRecordId }) {
    if (!toJob) return "destination-gone";
    if (isClosed(toJob)) return "destination-closed";
    if (!addressesOnJob(toJob, addresses).some((address) => address.id === toAddressRecordId)) return "destination-not-on-job";
    return null;
}

/**
 * Why a receipt is refused, as a key of `TRANSIT_COPY.refusals.receive`, or null: a quantity that is
 * not a whole number above zero, no date, a day later than the reader's today or before the send's
 * own, or more than is still in transit.
 */
export function receiveRefusal({ qty, receivedDate, sentDate, today, remaining }) {
    if (!isWhole(qty)) return "not-a-quantity";
    if (!isDay(receivedDate)) return "no-date";
    if (isDay(today) && receivedDate > today) return "future-date";
    if (isDay(sentDate) && receivedDate < sentDate) return "before-sent";
    if (qty > remaining) return "more-than-in-transit";
    return null;
}

/** Why a cancel is refused, as a key of `TRANSIT_COPY.refusals.cancel`, or null. */
export function cancelRefusal({ qty, remaining }) {
    if (!isWhole(qty)) return "not-a-quantity";
    if (qty > remaining) return "more-than-in-transit";
    return null;
}

/**
 * Why a write-off is refused, or null: nothing is left in transit, or not the quantity the reader
 * was asked to confirm — `qty`, what their page said was left — since some of it was received or
 * taken back after their page was drawn. A write-off takes all that is left, and the row has to say
 * what the person writing it off saw.
 */
export function writeOffRefusal({ remaining, qty }) {
    if (!(remaining > 0)) return "nothing-in-transit";
    if (qty !== remaining) return "changed";
    return null;
}

const at = (address, jobCode) => `${address} · ${jobCode}`;

/** A write-off refused to a reader who is not the office: the action's wrapper and the writer say it alike. */
const WRITE_OFF_NO_ACCESS = "Only an Admin can write off materials. Nothing was written off.";

/** Every word the sending and the receiving say. */
export const TRANSIT_COPY = Object.freeze({
    heading: "In transit",
    outgoing: (address, jobCode) => `To ${at(address, jobCode)}`,
    incoming: (address, jobCode) => `From ${at(address, jobCode)}`,
    sent: (date, name) => `Sent ${date}${name ? ` by ${name}` : ""}`,
    left: (remaining, qty, unit) => `${qtyText(remaining, unit)} of ${qty} not yet received`,
    days: (days) => (typeof days !== "number" ? "" : days <= 0 ? "Sent today" : days === 1 ? "1 day on the way" : `${days} days on the way`),
    send: Object.freeze({
        heading: "Send materials",
        from: "From",
        fromPlaceholder: "Pick an address",
        to: "To",
        toPlaceholder: "Pick an address",
        qty: "Quantity",
        date: "Date sent",
        submit: "Send materials",
        busy: "Sending…",
        nowhere: "No open job has an address to send to.",
    }),
    receive: Object.freeze({
        qty: "Quantity received",
        date: "Date received",
        submit: "Receive materials",
        busy: "Receiving…",
    }),
    cancel: Object.freeze({
        qty: "Quantity to take back",
        submit: "Cancel send",
        busy: "Canceling…",
    }),
    writeOff: Object.freeze({
        open: "Write off",
        confirm: (remaining, unit) => `Write off ${qtyText(remaining, unit)} that was never received? Nothing more of this send can be received after.`,
        submit: (remaining, unit) => `Write off ${qtyText(remaining, unit)}`,
        keep: "Keep it in transit",
        busy: "Writing off…",
        noAccess: WRITE_OFF_NO_ACCESS,
    }),
    activity: Object.freeze({
        sent: (qty, unit, address, jobCode) => `Sent ${qtyText(qty, unit)} to ${at(address, jobCode)}`,
        received: (qty, unit, address, jobCode, sentDate) => `Received ${qtyText(qty, unit)} from ${at(address, jobCode)}, sent ${sentDate}`,
        canceled: (qty, unit, address, jobCode, sentDate) => `Send canceled ${qtyText(qty, unit)}, sent ${sentDate} to ${at(address, jobCode)}`,
        writtenOff: (qty, unit, address, jobCode, sentDate) => `Written off ${qtyText(qty, unit)}, sent ${sentDate} to ${at(address, jobCode)}`,
    }),
    refusals: Object.freeze({
        send: Object.freeze({
            "no-address": "Pick the address the materials are sent from.",
            "no-destination": "Pick the address the materials are sent to.",
            "same-address": "The materials are already at that address. Pick another one to send them to.",
            "not-a-quantity": "Enter how many to send, as a whole number above 0.",
            "no-date": "Enter the date the materials were sent.",
            "future-date": "The date sent can't be later than today.",
            "more-than-stock": (inStock, unit, address) => `Only ${qtyText(inStock, unit)} is in stock at ${address}. Nothing was sent.`,
            "destination-gone": "That job is no longer on record. Nothing was sent.",
            "destination-closed": (jobCode) => `${CLOSED_JOB_COPY.refusal(jobCode)} Nothing was sent.`,
            "destination-not-on-job": (address, jobCode) => `${address} is not one of ${jobCode}'s addresses. Nothing was sent.`,
            "not-allowed": "You can't send materials from this job. Nothing was sent.",
            failed: "Something went wrong sending these materials. Nothing was sent — please try again.",
        }),
        receive: Object.freeze({
            "not-a-quantity": "Enter how many were received, as a whole number above 0.",
            "no-date": "Enter the date the materials were received.",
            "future-date": "The date received can't be later than today.",
            "before-sent": (sentDate) => `They were sent on ${sentDate}, so they can't have been received before that.`,
            "more-than-in-transit": (remaining, unit) => `Only ${qtyText(remaining, unit)} of this send is still in transit. Nothing was received.`,
            "send-gone": "This send is no longer on record. Nothing was received.",
            raced: "Some of this send was received or taken back at the same moment. Nothing was received — what is left is shown above.",
            "not-allowed": "You can't receive materials on this job. Nothing was received.",
            failed: "Something went wrong receiving these materials. Nothing was received — please try again.",
        }),
        cancel: Object.freeze({
            "not-a-quantity": "Enter how many to take back, as a whole number above 0.",
            "more-than-in-transit": (remaining, unit) => `Only ${qtyText(remaining, unit)} of this send is still in transit. Nothing was taken back.`,
            "send-gone": "This send is no longer on record. Nothing was taken back.",
            raced: "Some of this send was received or taken back at the same moment. Nothing was taken back — what is left is shown above.",
            "not-allowed": "You can't cancel a send from this job. Nothing was taken back.",
            failed: "Something went wrong canceling this send. Nothing was taken back — please try again.",
        }),
        writeOff: Object.freeze({
            "nothing-in-transit": "Nothing of this send is still in transit. Nothing was written off.",
            changed: (remaining, unit) =>
                `Some of this send was received or taken back since this page was drawn — ${qtyText(remaining, unit)} is still in transit. Nothing was written off.`,
            "send-gone": "This send is no longer on record. Nothing was written off.",
            raced: "Some of this send was received or taken back at the same moment. Nothing was written off — what is left is shown above.",
            "not-allowed": WRITE_OFF_NO_ACCESS,
            failed: "Something went wrong writing these materials off. Nothing was written off — please try again.",
        }),
    }),
});

/**
 * What one activity row says, for every kind the activity holds: a transit row names where its
 * send went or came from and the day it was sent, so a receipt shows both days apart — its own in
 * the Date column and the send's here. `sendById` holds every send the page read, `addressLabel`
 * and `jobCode` name a record id. Any other row is `activityWords`', passed in as `plain`.
 */
export function transitActivityWords(row, unit, { sendById, addressLabel, jobCode, plain }) {
    const words = TRANSIT_COPY.activity;
    if (row.kind === MATERIAL_LOG_EVENTS.SENT) {
        return words.sent(row.qty, unit, addressLabel(row.destinationAddressRecordId), jobCode(row.destinationJobRecordId));
    }
    const send = settlesASend(row.kind) ? sendById.get(row.sendRecordId) : null;
    if (!send) return plain(row, unit);
    if (row.kind === MATERIAL_LOG_EVENTS.RECEIVED) {
        return words.received(row.qty, unit, addressLabel(send.fromAddressRecordId), jobCode(send.fromJobRecordId), send.sentDate);
    }
    const say = row.kind === MATERIAL_LOG_EVENTS.SEND_CANCELED ? words.canceled : words.writtenOff;
    return say(row.qty, unit, addressLabel(send.toAddressRecordId), jobCode(send.toJobRecordId), send.sentDate);
}
