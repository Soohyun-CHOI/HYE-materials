// A job's material stock (#675): what was ordered, delivered and issued, and what is left at
// each of the job's addresses — the judgment and every word the Inventory screens say.
//
// STOCK IS COMPUTED, NEVER STORED. A job's stock of a material at an address is what the
// deliveries recorded there hold (`Delivery Items."Qty"`) plus the sum of its `Material Log`
// rows there, each row's `Qty` being the CHANGE it made — an `Issued` row is negative. A delivery
// is not a row of the log: its quantity is read off the delivery itself, so deleting one, and
// #680's correction of its address, move the stock with no second write to keep in step. The
// derivation is in `docs/notes/materials.md`'s #675 section.
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
// PURE AND OFFLINE-SAFE: the extensions are spelled out, and nothing here reaches the base.

import { recordsOn } from "./assetJob.js";
import { itemLabel } from "./materialIdentity.js";
import { countsAsOrdered } from "./poItemQty.js";

/** `Material Log."Event"`'s choices, the screen's words. #675 writes the first alone. */
export const MATERIAL_LOG_EVENTS = Object.freeze({
    ISSUED: "Issued",
    SENT: "Sent",
    RECEIVED: "Received",
    COUNT_EDITED: "Count edited",
    SEND_CANCELED: "Send canceled",
    WRITTEN_OFF: "Written off",
});

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
            issued: "Issued",
            inStock: "In stock",
            address: "Address",
        }),
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
        nothingInStock: "None of this material is in stock on this job, so none can be issued.",
    },
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

const zero = () => ({ delivered: 0, issued: 0, inStock: 0 });

/**
 * One job's stock, folded from its deliveries, their items and its log rows, with what was
 * ordered beside it: `Map(materialRecordId → { ordered, delivered, issued, inStock,
 * byAddress: Map(addressRecordId → { delivered, issued, inStock }) })`.
 *
 * `ordered` is the job's alone: an order's address is where the vendor was told to send it, and
 * stock is counted where a delivery recorded it, so the two are not split the same way (#675).
 * An ordered item counts while `countsAsOrdered` says so — withdrawn orders out, unsigned ones in,
 * the rule delivery allocation reads.
 */
export function foldJobInventory({ deliveries = [], deliveryItems = [], logEntries = [], orderedItems = [] }) {
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
        const qty = Number(entry.qty) || 0;
        const material = of(materialRecordId);
        const at = bucket(material.byAddress, addressRecordId, zero);
        material.inStock += qty;
        at.inStock += qty;
        if (entry.event === MATERIAL_LOG_EVENTS.ISSUED) {
            material.issued -= qty;
            at.issued -= qty;
        }
    }
    return materials;
}

/** The stock of one material at one address, out of a fold; 0 where nothing was recorded. */
export function stockAt(inventory, materialRecordId, addressRecordId) {
    return inventory.get(materialRecordId)?.byAddress.get(addressRecordId)?.inStock ?? 0;
}

/**
 * The addresses a job holds material at — any material's stock there not zero — in the order
 * given. The list offers a view by address only when there are two or more (#675).
 */
function addressesHeld(inventory) {
    const held = new Set();
    for (const material of inventory.values()) {
        for (const [addressRecordId, at] of material.byAddress) if (at.inStock !== 0) held.add(addressRecordId);
    }
    return [...held];
}

/** Whether the list offers a view by address: a job holding material at two addresses or more. */
export function offersAddressView(inventory) {
    return addressesHeld(inventory).length >= 2;
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
 * What deleting a delivery would take below zero (#675): for each material on it, the stock at
 * its address less what the delivery holds, where that is negative — `[{ materialRecordId,
 * addressRecordId, after }]`, empty when the delete leaves every count at zero or above. Deleting
 * is how a delivery's allocation is corrected, so the refusal tells its reader to record the
 * right delivery first; that delivery's quantity is what keeps this one's deletion above zero.
 */
export function deleteShortfall({ inventory, delivery, items }) {
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
 * One material's activity on a job, newest first: each delivery of it as one row and each log
 * row as one — `{ key, date, kind, qty, addressRecordId, recordedBy, recordedAt, deliveryId }`.
 * `qty` is how much moved, never signed: the word says which way. Same-day rows fall back to
 * the instant each was recorded.
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
        });
    }
    for (const entry of logEntries) {
        if ((entry.material ?? [])[0] !== materialRecordId) continue;
        rows.push({
            key: entry.id,
            date: entry.eventDate ?? "",
            kind: entry.event,
            qty: Math.abs(Number(entry.qty) || 0),
            addressRecordId: (entry.address ?? [])[0] ?? null,
            recordedBy: (entry.recordedBy ?? [])[0] ?? null,
            recordedAt: entry.recordedAt ?? "",
            deliveryId: null,
        });
    }
    return rows.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.recordedAt < b.recordedAt ? 1 : a.recordedAt > b.recordedAt ? -1 : 0));
}

/** What one activity row says: `Delivered 10 EA`, `Issued 5 EA`. */
export function activityWords(row, unit) {
    if (row.kind === "delivered") return INVENTORY_COPY.material.delivered(row.qty, unit);
    if (row.kind === MATERIAL_LOG_EVENTS.ISSUED) return INVENTORY_COPY.material.issued(row.qty, unit);
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
        issued: m.issued,
        inStock: m.inStock,
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
