// A job's material stock (#675): what was ordered, delivered and issued, and what is left at
// each of the job's addresses — the judgment and every word the Inventory screens say.
//
// STOCK IS COMPUTED, NEVER STORED. A job's stock of a material at an address is what the
// deliveries recorded there hold (`Delivery Items."Qty"`) plus the sum of its `Material Log`
// rows there, each row's `Qty` being the CHANGE it made — an `Issued` or a `Sent` row is negative.
// A delivery is not a row of the log: its quantity is read off the delivery itself, so deleting
// one, and correcting its address (#680), move the stock with no second write to keep in step. The
// derivation is in `docs/notes/materials.md`'s #675 section.
//
// BUT FOR A `Written off` ROW, WHICH THE COUNT LEAVES OUT (#677). Material sent between addresses
// leaves its address with the `Sent` row and reaches another with a `Received` one; a write-off
// takes what never arrived out of transit, which is no address's stock, so its `Qty` moves none.
// What is in transit is `lib/materialTransit.js`'s, handed to the fold as the sends leaving the job
// and the sends coming to it.
//
// EVERY DELIVERY HAS AN ADDRESS, AND THIS THROWS ON ONE THAT HAS NONE. `/deliveries/new` has
// required one since #387, `createDelivery` refuses one with none since #675, and the twelve the
// test base held from before #387 were given their job's default (#675); the live base held no
// delivery. A delivery with no address is therefore a row emptied by hand, and a count that
// quietly left it out would be a stock figure that is wrong with nothing on screen to say so.
// The same holds for a log row: every one names its address.
//
// WHO: AN ADMIN ON EVERY JOB, A SITE MANAGER ON THEIR OWN — the same answer for reading and
// for recording. The site manager's half is `lib/assetJob.js:recordsOn`, the one reading of "a
// site manager on a job they are assigned to", asked rather than written a second time. The
// delivery rule (`canAccessJobDeliveries`) was the first candidate and cannot be it: it admits
// anyone assigned to the job, and the President on every job, so a President who manages a site
// would read every job's stock — seen on the test base with soo@'s Admin turned off (#675).
//
// TWO ISSUES MAY RACE, AND `lib/materialStock.server.js` HOLDS THE LINE: a lock for two in one
// process, and for two in different ones a read after the write — a writer whose own row leaves
// the address below zero, counted against everything the base then holds, takes its row back.
// The later of two writers always sees the earlier's row, so they cannot both stand; they may
// both be turned back, which overdraws nothing. Why no order between them is relied on is in
// that module's header.
//
// A COUNT EDIT (#678) SETS AN ADDRESS'S STOCK TO WHAT WAS COUNTED, AND ITS ROW IS STILL A CHANGE.
// A person knows how many they counted, not the difference, so they type the count; the row's
// `Qty` is that count less the stock it replaces, either sign, and `Counted Qty` keeps the count, so
// the activity can say what it was before and after without counting the rows before it — which a
// delivery deleted, corrected to another address (#680) or split afterwards would move under an
// edit already made. The figure the page drew travels with the press, and a stock that moved since
// is refused rather than overwritten: the same count is a different change then.
//
// PURE AND OFFLINE-SAFE: the extensions are spelled out, and nothing here reaches the base.

import { recordsOn } from "./assetJob.js";
import { itemLabel } from "./materialIdentity.js";
import { countsAsOrdered } from "./poItemQty.js";

/** `Material Log."Event"`'s choices, the screen's words. #675 writes the first, #677 the next two and the last two, #678 the fourth. */
export const MATERIAL_LOG_EVENTS = Object.freeze({
    ISSUED: "Issued",
    SENT: "Sent",
    RECEIVED: "Received",
    COUNT_EDITED: "Count edited",
    SEND_CANCELED: "Send canceled",
    WRITTEN_OFF: "Written off",
});

/** `Material Log."Reason"`'s choices (#678), the screen's words: why a count was edited, in the select's order. */
export const MATERIAL_LOG_REASONS = Object.freeze(["Recorded wrong", "Damaged or lost", "Returned to the vendor", "Physical count"]);

/** Every word the Inventory screens say. */
export const INVENTORY_COPY = Object.freeze({
    heading: "Inventory",
    jobs: {
        lead: "Pick a job to see its materials.",
        none: "No job's inventory is open to you.",
    },
    notFound: {
        job: "Job not found",
        material: "Material not found",
        back: "← Inventory",
    },
    list: {
        columns: Object.freeze({
            material: "Material",
            ordered: "Ordered",
            delivered: "Delivered",
            received: "Received",
            issued: "Issued",
            sent: "Sent",
            // #678 — what count edits changed, the one column a sign is printed in: an edit moves a
            // count either way, and the net of several can be either.
            countEdited: "Count edited",
            inTransit: "In transit",
            inStock: "In stock",
            address: "Address",
        }),
        // #677 — what is in transit, as the `In transit` cell says it: leaving the row's job or
        // address, and coming to it.
        inTransitOut: (qty, unit) => `${qtyText(qty, unit)} out`,
        inTransitIn: (qty, unit) => `${qtyText(qty, unit)} in`,
        empty: "Nothing has been ordered or delivered on this job yet.",
        views: Object.freeze({ all: "All addresses", byAddress: "By address" }),
        viewLabel: "Show",
    },
    material: {
        back: (jobCode) => `← Inventory on ${jobCode}`,
        stockHeading: "In stock",
        activityHeading: "Activity",
        activityColumns: Object.freeze({
            date: "Date",
            what: "What",
            address: "Address",
            by: "Recorded by",
            at: "Recorded",
        }),
        delivered: (qty, unit) => `Delivered ${qty}${unit ? ` ${unit}` : ""}`,
        issued: (qty, unit) => `Issued ${qty}${unit ? ` ${unit}` : ""}`,
        // #678 — a count edit says what the count was and what it became, and why.
        countEdited: (former, counted, unit, reason) => `Count edited from ${former} to ${qtyText(counted, unit)}${reason ? ` · ${reason}` : ""}`,
        nothingInStock: "None of this material is in stock on this job, so none can be issued or sent.",
    },
    countEdit: Object.freeze({
        heading: "Edit count",
        address: "Address",
        addressPlaceholder: "Pick an address",
        at: (address, inStock, unit) => `${address}: ${qtyText(inStock, unit)} in stock`,
        counted: "New count",
        // What the press will record, said before it is pressed, so a mistyped count is seen first.
        change: (signed) => `Change to record: ${signed}`,
        noChange: "That is the count now. Nothing would change.",
        reason: "Reason",
        reasonPlaceholder: "Pick a reason",
        notes: "Notes",
        optional: "(optional)",
        submit: "Edit count",
        busy: "Saving…",
        refusals: Object.freeze({
            "no-address": "Pick the address whose count you are editing.",
            "not-a-count": "Enter the count, as a whole number of 0 or more.",
            "no-reason": "Pick why the count is being edited.",
            "same-count": (inStock, unit, address) => `The count at ${address} is already ${qtyText(inStock, unit)}. Nothing was changed.`,
            changed: (inStock, unit, address) =>
                `Something was recorded at ${address} since this page was drawn — ${qtyText(inStock, unit)} is in stock there now. Nothing was changed.`,
            raced: (inStock, unit, address) => `Something was recorded at ${address} at the same moment. Nothing was changed — the count there is shown above.`,
            "not-allowed": "You can't edit counts on this job. Nothing was changed.",
            failed: "Something went wrong editing this count. Nothing was changed — please try again.",
        }),
    }),
    issue: {
        heading: "Issue materials",
        address: "From",
        addressPlaceholder: "Pick an address",
        qty: "Quantity",
        date: "Date issued",
        submit: "Issue materials",
        busy: "Issuing…",
    },
    refusals: Object.freeze({
        "no-address": "Pick the address the materials are issued from.",
        "not-a-quantity": "Enter how many to issue, as a whole number above 0.",
        "no-date": "Enter the date the materials were issued.",
        "more-than-stock": (inStock, unit, address) =>
            `Only ${inStock}${unit ? ` ${unit}` : ""} is in stock at ${address}. Nothing was issued.`,
        "not-allowed": "You can't issue materials on this job. Nothing was issued.",
        failed: "Something went wrong issuing these materials. Nothing was issued — please try again.",
    }),
});

/**
 * Whether this reader may see a job's inventory and record against it (#675): an Admin on every
 * job, a site manager on a job they are assigned to (`recordsOn`). `true` and nothing else
 * admits, so a missing user or job reads as no.
 */
export function canAccessJobInventory(user, jobRecordId) {
    if (!user || !jobRecordId) return false;
    if (user.isAdmin === true) return true;
    return recordsOn(user, jobRecordId);
}

/** The jobs whose inventory this reader may reach, out of an already-loaded list, by job code. */
export function inventoryJobs(user, jobs) {
    return (jobs ?? [])
        .filter((job) => canAccessJobInventory(user, job.id))
        .sort((a, b) => String(a.jobCode ?? "").localeCompare(String(b.jobCode ?? "")));
}

function onlyOf(link, what) {
    const id = (link ?? [])[0];
    if (!id) throw new Error(`${what} names none`);
    return id;
}

function bucket(map, key, make) {
    if (!map.has(key)) map.set(key, make());
    return map.get(key);
}

const zero = () => ({ delivered: 0, received: 0, issued: 0, sent: 0, countEdited: 0, inStock: 0, inTransitOut: 0, inTransitIn: 0 });

/**
 * One job's stock, folded from its deliveries, their items and its log rows, with what was
 * ordered beside it: `Map(materialRecordId → { ordered, delivered, received, issued, sent,
 * countEdited, inStock, inTransitOut, inTransitIn, byAddress: Map(addressRecordId → { the same but
 * ordered }) })`.
 *
 * `ordered` is the job's alone: an order's address is where the vendor was told to send it, and
 * stock is counted where a delivery recorded it, so the two are not split the same way (#675).
 * An ordered item counts while `countsAsOrdered` says so — withdrawn orders out, unsigned ones in,
 * the rule delivery allocation reads.
 *
 * `logEntries` are the job's own rows. `received` is what its `Received` rows took in and `sent`
 * what its `Sent` rows gave up less what its `Send canceled` rows took back, and `countEdited` what
 * its `Count edited` rows changed, signed (#678), so `inStock` is
 * `delivered + received - issued - sent + countEdited`. A `Written off` row is left out
 * of every one of them: it moves no address's stock (#677). `outgoing` and `incoming` are the sends
 * leaving the job and coming to it (`lib/materialTransit.js:jobSends`), whose `remaining` is what
 * is in transit from the address each left and to the address each goes; they move no stock.
 */
export function foldJobInventory({ deliveries = [], deliveryItems = [], logEntries = [], orderedItems = [], outgoing = [], incoming = [] }) {
    const materials = new Map();
    const of = (materialRecordId) => bucket(materials, materialRecordId, () => ({ ordered: 0, ...zero(), byAddress: new Map() }));

    for (const item of orderedItems) {
        if (!item.materialRecordId || !countsAsOrdered(item)) continue;
        of(item.materialRecordId).ordered += Number(item.qty) || 0;
    }

    const addressOfDelivery = new Map(
        deliveries.map((delivery) => [delivery.id, onlyOf(delivery.deliveryAddress, `delivery ${delivery.deliveryId ?? delivery.id}'s address`)])
    );
    for (const item of deliveryItems) {
        const materialRecordId = (item.material ?? [])[0];
        if (!materialRecordId) continue;
        const addressRecordId = addressOfDelivery.get((item.delivery ?? [])[0]);
        if (!addressRecordId) continue;
        const qty = Number(item.qty) || 0;
        const material = of(materialRecordId);
        const at = bucket(material.byAddress, addressRecordId, zero);
        material.delivered += qty;
        material.inStock += qty;
        at.delivered += qty;
        at.inStock += qty;
    }

    for (const entry of logEntries) {
        const materialRecordId = onlyOf(entry.material, `material log row ${entry.materialLogId ?? entry.id}'s material`);
        const addressRecordId = onlyOf(entry.address, `material log row ${entry.materialLogId ?? entry.id}'s address`);
        if (entry.event === MATERIAL_LOG_EVENTS.WRITTEN_OFF) continue;
        // A receipt or a cancel whose Sent row is gone counts for nothing: the send never stood,
        // so what it took out of transit was never in it. Its writer takes it back when it sees
        // the Sent row gone (`lib/materialTransit.server.js`); this is the count's own guard for
        // the moment between, and for a take-back that failed.
        if (settlesASend(entry.event) && (entry.send ?? []).length === 0) continue;
        const qty = Number(entry.qty) || 0;
        const material = of(materialRecordId);
        const at = bucket(material.byAddress, addressRecordId, zero);
        material.inStock += qty;
        at.inStock += qty;
        const column = COLUMN_OF_EVENT[entry.event];
        if (column) {
            // Each column counts what it names as a quantity: an issue and a send are negative
            // rows, and a cancel takes back what its send gave up. A count edit's column is the one
            // that stays signed, since an edit moves a count either way (#678).
            const moved = column.sign * qty;
            material[column.key] += moved;
            at[column.key] += moved;
        }
    }

    for (const [sends, key, addressOf] of [
        [outgoing, "inTransitOut", (send) => send.fromAddressRecordId],
        [incoming, "inTransitIn", (send) => send.toAddressRecordId],
    ]) {
        for (const send of sends) {
            if (!(send.remaining > 0)) continue;
            const material = of(onlyOf([send.materialRecordId], `send ${send.materialLogId ?? send.id}'s material`));
            const at = bucket(material.byAddress, onlyOf([addressOf(send)], `send ${send.materialLogId ?? send.id}'s address`), zero);
            material[key] += send.remaining;
            at[key] += send.remaining;
        }
    }
    return materials;
}

const SETTLES_A_SEND = new Set([MATERIAL_LOG_EVENTS.RECEIVED, MATERIAL_LOG_EVENTS.SEND_CANCELED, MATERIAL_LOG_EVENTS.WRITTEN_OFF]);

/**
 * Whether an event's rows settle a Sent row (#677) — a receipt, a cancel or a write-off — and so
 * name it in `Send` and take quantity out of its transit. The one reading: the writer, the fold and
 * `lib/materialTransit.js` ask it.
 */
export function settlesASend(event) {
    return SETTLES_A_SEND.has(event);
}

/** Which column each event's rows count in, and the sign that makes the figure a quantity. */
const COLUMN_OF_EVENT = Object.freeze({
    [MATERIAL_LOG_EVENTS.ISSUED]: { key: "issued", sign: -1 },
    [MATERIAL_LOG_EVENTS.RECEIVED]: { key: "received", sign: 1 },
    [MATERIAL_LOG_EVENTS.SENT]: { key: "sent", sign: -1 },
    [MATERIAL_LOG_EVENTS.SEND_CANCELED]: { key: "sent", sign: -1 },
    [MATERIAL_LOG_EVENTS.COUNT_EDITED]: { key: "countEdited", sign: 1 },
});

/** The stock of one material at one address, out of a fold; 0 where nothing was recorded. */
export function stockAt(inventory, materialRecordId, addressRecordId) {
    return inventory.get(materialRecordId)?.byAddress.get(addressRecordId)?.inStock ?? 0;
}

/**
 * The addresses a job holds material at — any material's stock there not zero, or any of it in
 * transit from there or to there (#677) — in the order given. The list offers a view by address
 * only when there are two or more (#675).
 */
function addressesHeld(inventory) {
    const held = new Set();
    for (const material of inventory.values()) {
        for (const [addressRecordId, at] of material.byAddress) {
            if (at.inStock !== 0 || at.inTransitOut > 0 || at.inTransitIn > 0) held.add(addressRecordId);
        }
    }
    return [...held];
}

/** Whether the list offers a view by address: a job holding material at two addresses or more. */
export function offersAddressView(inventory) {
    return addressesHeld(inventory).length >= 2;
}

/**
 * Whether the list and a material's page draw what moved between addresses — `Received`, `Sent`
 * and `In transit` — which is when any of the job's materials has a figure in one (#677). A job
 * that never sent or received draws the four columns #675 drew, rather than three of zeros.
 */
export function showsTransit(inventory) {
    for (const material of inventory.values()) if (movedBetweenAddresses(material)) return true;
    return false;
}

/** Whether one material's figures — a job's or an address's — hold anything sent, received or in transit. */
export function movedBetweenAddresses(figures) {
    return figures.received !== 0 || figures.sent !== 0 || figures.inTransitOut > 0 || figures.inTransitIn > 0;
}

/**
 * Whether the list and a material's page draw `Count edited` (#678): when any material's count edits
 * changed something, on the job or at one of its addresses — two edits canceling out on the job can
 * still each move an address, and the view by address has to add up too. A job never edited draws
 * none, as a job that never sent draws no transit.
 */
export function showsCountEdits(inventory) {
    for (const material of inventory.values()) if (countWasEdited(material)) return true;
    return false;
}

/** Whether one material's figures, or any of its addresses', hold a count edit's change. */
export function countWasEdited(material) {
    if (material.countEdited !== 0) return true;
    for (const at of material.byAddress?.values() ?? []) if (at.countEdited !== 0) return true;
    return false;
}

/**
 * Why an issue is refused, as a key of `INVENTORY_COPY.refusals`, or null: no address, a
 * quantity that is not a whole number above zero, no date, or more than the address holds.
 */
export function issueRefusal({ addressRecordId, qty, eventDate, inStock }) {
    if (!addressRecordId) return "no-address";
    if (!Number.isInteger(qty) || qty <= 0) return "not-a-quantity";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(eventDate ?? ""))) return "no-date";
    if (qty > inStock) return "more-than-stock";
    return null;
}

/** A typed quantity as the whole number it names, or NaN — `"5"` is 5, `"5.5"`, `""` and `"5x"` are not. */
export function readQty(value) {
    const text = String(value ?? "").trim();
    return /^\d+$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * A figure a page drew, sent back with a press, as the whole number it is — below zero too, since a
 * count below zero is drawn as it is (#675) — or NaN. `readQty` reads what a person typed, which is
 * never below zero.
 */
export function readFigure(value) {
    const text = String(value ?? "").trim();
    return /^-?\d+$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * Why a count edit is refused (#678), as a key of `INVENTORY_COPY.countEdit.refusals`, or null: no
 * address, a count that is not a whole number of 0 or more, no reason the select holds — and, once
 * the stock is read (`inStock` given), a stock that is not the figure the page drew (`shownQty`),
 * or a count that is the stock already. A count may be anything from 0 up whatever the stock was,
 * so an address left below zero is put right by the same press.
 */
export function countEditRefusal({ addressRecordId, countedQty, reason, shownQty, inStock = null }) {
    if (!addressRecordId) return "no-address";
    if (!Number.isInteger(countedQty) || countedQty < 0) return "not-a-count";
    if (!MATERIAL_LOG_REASONS.includes(reason)) return "no-reason";
    if (inStock === null) return null;
    // The same count is a different change once the stock moved, so the page has to be drawn again.
    if (!Number.isInteger(shownQty) || inStock !== shownQty) return "changed";
    if (countedQty === inStock) return "same-count";
    return null;
}

/**
 * The change a count edit will record — the typed count less the stock the form was drawn with —
 * or null while there is nothing to say: no address picked, or no count a press would take. The
 * form says it before the press (#678) and the writer records the same subtraction.
 */
export function countEditChange({ counted, inStock }) {
    if (!Number.isInteger(inStock) || !Number.isInteger(counted) || counted < 0) return null;
    return counted - inStock;
}

/** A change with its sign and unit, as `Count edited` and a count edit's form print it: `+2 EA`, `-3 EA`, `0 EA`. */
export function signedQtyText(qty, unit) {
    return `${qty > 0 ? "+" : ""}${qtyText(qty, unit)}`;
}

/**
 * The addresses a material's count may be edited at, out of one material's fold (#678): every
 * address its stock table draws — in stock, at zero, below zero, or holding only what is on its way
 * — by label, each with the figure drawn. What arrived where nothing was recorded is a delivery or a
 * receipt, which say where it came from, and a count edit in their place would leave the order
 * looking undelivered.
 */
export function countEditAddresses(material, addressLabel) {
    return [...(material?.byAddress ?? new Map())]
        .map(([addressRecordId, at]) => ({ addressRecordId, label: addressLabel(addressRecordId), inStock: at.inStock }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * What taking a delivery off its address would leave below zero: for each material on it, the
 * stock at its address less what the delivery holds, where that is negative — `[{
 * materialRecordId, addressRecordId, after }]`, empty when every count stays at zero or above.
 *
 * TWO ACTS TAKE A DELIVERY OFF ITS ADDRESS, AND THIS IS THE ONE JUDGMENT FOR BOTH. Deleting it
 * (#675), which is how a delivery's allocation is corrected, and correcting its address (#680),
 * which moves all of it to another of the job's addresses. Either leaves the address it stood at
 * holding what it held less this delivery, so an issue made from that stock would be left below
 * zero; each act refuses, in its own sentence.
 */
export function shortfallWithout({ inventory, delivery, items }) {
    const addressRecordId = onlyOf(delivery.deliveryAddress, `delivery ${delivery.deliveryId ?? delivery.id}'s address`);
    const held = new Map();
    for (const item of items) {
        const materialRecordId = (item.material ?? [])[0];
        if (!materialRecordId) continue;
        held.set(materialRecordId, (held.get(materialRecordId) ?? 0) + (Number(item.qty) || 0));
    }
    const short = [];
    for (const [materialRecordId, qty] of held) {
        const after = stockAt(inventory, materialRecordId, addressRecordId) - qty;
        if (after < 0) short.push({ materialRecordId, addressRecordId, after });
    }
    return short;
}

/**
 * The materials whose stock at an address stands below zero, out of a fold read AFTER a write —
 * `[{ materialRecordId, addressRecordId, after }]`. `shortfallWithout` asks before a delivery leaves
 * an address; this asks once it has, when the stock no longer counts it there, so another write
 * that landed in between is counted too (#680, `lib/deliveryAddress.server.js`).
 */
export function belowZeroAt({ inventory, materialRecordIds, addressRecordId }) {
    return [...new Set(materialRecordIds)]
        .map((materialRecordId) => ({ materialRecordId, addressRecordId, after: stockAt(inventory, materialRecordId, addressRecordId) }))
        .filter((s) => s.after < 0);
}

/**
 * One material's activity on a job, newest first: each delivery of it as one row and each log
 * row as one — `{ key, date, kind, qty, addressRecordId, recordedBy, recordedAt, deliveryId,
 * destinationJobRecordId, destinationAddressRecordId, sendRecordId, countedQty, formerQty, reason,
 * notes }`: a Sent row's destination and a settling row's send (#677), and a count edit's count, the
 * count it replaced, its reason and its notes (#678). `qty` is how much moved, never signed: the
 * word says which way, and a count edit's two counts say it for one. Same-day rows fall back to the
 * instant each was recorded.
 */
export function materialActivity({ materialRecordId, deliveries = [], deliveryItems = [], logEntries = [] }) {
    const rows = [];
    const deliveryById = new Map(deliveries.map((d) => [d.id, d]));
    const deliveredQty = new Map();
    for (const item of deliveryItems) {
        if ((item.material ?? [])[0] !== materialRecordId) continue;
        const deliveryRecordId = (item.delivery ?? [])[0];
        if (!deliveryById.has(deliveryRecordId)) continue;
        deliveredQty.set(deliveryRecordId, (deliveredQty.get(deliveryRecordId) ?? 0) + (Number(item.qty) || 0));
    }
    for (const [deliveryRecordId, qty] of deliveredQty) {
        const delivery = deliveryById.get(deliveryRecordId);
        rows.push({
            key: delivery.id,
            date: delivery.receivedDate ?? "",
            kind: "delivered",
            qty,
            addressRecordId: (delivery.deliveryAddress ?? [])[0] ?? null,
            recordedBy: (delivery.recordedBy ?? [])[0] ?? null,
            recordedAt: delivery.createdAt ?? "",
            deliveryId: delivery.deliveryId,
            destinationJobRecordId: null,
            destinationAddressRecordId: null,
            sendRecordId: null,
            countedQty: null,
            formerQty: null,
            reason: null,
            notes: "",
        });
    }
    for (const entry of logEntries) {
        if ((entry.material ?? [])[0] !== materialRecordId) continue;
        const counted = entry.event === MATERIAL_LOG_EVENTS.COUNT_EDITED && Number.isInteger(entry.countedQty) ? entry.countedQty : null;
        rows.push({
            key: entry.id,
            date: entry.eventDate ?? "",
            kind: entry.event,
            qty: Math.abs(Number(entry.qty) || 0),
            addressRecordId: (entry.address ?? [])[0] ?? null,
            recordedBy: (entry.recordedBy ?? [])[0] ?? null,
            recordedAt: entry.recordedAt ?? "",
            deliveryId: null,
            destinationJobRecordId: (entry.destinationJob ?? [])[0] ?? null,
            destinationAddressRecordId: (entry.destinationAddress ?? [])[0] ?? null,
            sendRecordId: (entry.send ?? [])[0] ?? null,
            // A count edit's `Qty` is its count less the stock before it, so the count before is
            // the count less the change — the figure the editor saw, whatever moved since.
            countedQty: counted,
            formerQty: counted === null ? null : counted - (Number(entry.qty) || 0),
            reason: entry.reason ?? null,
            notes: entry.notes ?? "",
        });
    }
    return rows.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0));
}

/** What one activity row says: `Delivered 10 EA`, `Issued 5 EA`, `Count edited from 12 to 9 EA · Damaged or lost`. */
export function activityWords(row, unit) {
    if (row.kind === "delivered") return INVENTORY_COPY.material.delivered(row.qty, unit);
    if (row.kind === MATERIAL_LOG_EVENTS.ISSUED) return INVENTORY_COPY.material.issued(row.qty, unit);
    if (row.kind === MATERIAL_LOG_EVENTS.COUNT_EDITED && row.countedQty !== null) {
        return INVENTORY_COPY.material.countEdited(row.formerQty, row.countedQty, unit, row.reason);
    }
    return `${row.kind} ${row.qty}${unit ? ` ${unit}` : ""}`;
}

/** A quantity with its unit, as a cell prints it: `10 EA`. */
export function qtyText(qty, unit) {
    return `${qty}${unit ? ` ${unit}` : ""}`;
}

/**
 * The list's rows, one per material, by the label each prints, and — for the view by address —
 * one group per address the job holds material at, by its label, each with its own materials.
 */
export function inventoryRows({ inventory, materialById, addressLabelById }) {
    const label = (materialRecordId) => {
        const material = materialById.get(materialRecordId);
        return material ? itemLabel(material) || materialRecordId : materialRecordId;
    };
    const unitOf = (materialRecordId) => materialById.get(materialRecordId)?.unit ?? "";
    const byLabel = (a, b) => a.label.localeCompare(b.label);
    const rows = [...inventory].map(([materialRecordId, m]) => ({
        materialRecordId,
        label: label(materialRecordId),
        unit: unitOf(materialRecordId),
        ordered: m.ordered,
        delivered: m.delivered,
        received: m.received,
        issued: m.issued,
        sent: m.sent,
        countEdited: m.countEdited,
        inStock: m.inStock,
        inTransitOut: m.inTransitOut,
        inTransitIn: m.inTransitIn,
    }));
    rows.sort(byLabel);
    const groups = addressesHeld(inventory)
        .map((addressRecordId) => ({
            addressRecordId,
            label: addressLabelById.get(addressRecordId) ?? addressRecordId,
            rows: [...inventory]
                .filter(([, m]) => m.byAddress.has(addressRecordId))
                .map(([materialRecordId, m]) => ({
                    materialRecordId,
                    label: label(materialRecordId),
                    unit: unitOf(materialRecordId),
                    ...m.byAddress.get(addressRecordId),
                }))
                .sort(byLabel),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return { rows, groups };
}

/** Where a job's inventory is, and one material's on it: `/materials/{jobCode}[/{materialRecordId}]`. */
export function inventoryPath(jobCode, materialRecordId = null) {
    const job = `/materials/${encodeURIComponent(jobCode)}`;
    return materialRecordId ? `${job}/${encodeURIComponent(materialRecordId)}` : job;
}

/** A calendar day's figures as the `YYYY-MM-DD` a date field holds, or "" for none. */
export function isoDay(day) {
    if (!day) return "";
    const pad = (n, width) => String(n).padStart(width, "0");
    return `${pad(day.year, 4)}-${pad(day.month, 2)}-${pad(day.day, 2)}`;
}
