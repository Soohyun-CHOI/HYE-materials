// The read side of #166's two axes, rewritten for #640's three-way match.
//
// Invoices and deliveries meet only through the ordered items they both name, so every
// walk here goes to `PO Items` and compares cumulative totals there: `Delivered Qty`
// against the invoice items an ordered item carries, `Invoiced Qty` against its delivery
// items. Which document a total reaches is `lib/deliveryStatus.js:fillOldestFirst`,
// oldest first in entry order. Until #640 an invoice named one delivery in
// `Invoices."Delivery"` and was compared with that delivery's own rows; nothing here
// reads a link between the two documents now, because there is none.
//
// TWO WALKS, NOT ONE, unchanged in shape: the two screens start from opposite ends and
// neither result derives from the other. The invoice axis asks "has what we were invoiced
// for been delivered"; the delivery axis asks "has what was delivered been invoiced".
//
// WHAT EACH COSTS, and why none of it grew at #640:
//
//   invoice axis (list)                 invoice axis (detail)
//   0  Invoice Items (the CALLER's)     1  PO Items       (by record id)
//   1  PO Items      (by record id)     2  Delivery Items (PO Items' reverse link,
//   +  Invoice Items the fill needs        for the deliveries the section names)
//      and the caller does not hold     +  Invoice Items the fill needs and the
//   +  Delivery Items the search needs     caller does not hold
//      and the caller does not hold
//      (#649, `getInvoiceDeliveryIds`)
//   delivery axis
//   1  Delivery Items (by record id)
//   2  PO Items       (by record id)
//   +  Delivery Items the fill needs and the caller does not hold
//
// THE `+` LEVEL IS USUALLY EMPTY, AND THAT IS WHAT `fillNeedsOrder` IS FOR. The fill
// needs an ordered item's other rows only when its total covers some and not all of
// them — with nothing on the other side, or at least everything, every row's answer is
// known from the rollup alone. And the lists already hold every row the fill could ask
// for: `/invoices` reads every invoice's items for its row gate, and a delivery fills only
// ordered items on its own job, all of whose deliveries `/invoices` and `/deliveries`
// read for the jobs they show. So the extra read is the detail's, in one shape — an
// ordered item partly delivered and charged by another invoice too — and the detail
// paid for it by no longer finding its invoice twice (`app/invoices/[invoiceId]/page.js`).
//
// Down from main's 2 / 3 / 3 plus the strip's `PO Items`, because the two levels that
// joined an invoice to its named delivery (`Deliveries`, then that delivery's rows) and
// the two that joined a delivery to its naming invoices (`Invoices`, then their items)
// are gone with the link. THESE ARE CEILINGS, NOT FIXED NUMBERS: `findByRecordIds`
// returns early on an empty id list, plus one per 50 ids inside a batched step.
//
// #166 WITHHELD THE DELIVERY AXIS FROM SITE STAFF AND #211 RELEASED IT, so no caller
// here takes a privileged flag. Payment is not read by any function here.
//
// Credentialed tier: imports lib/airtable/*, so neither the offline tier nor any Client
// Component may import this. The pure half is lib/deliveryStatus.js.

import { TABLES } from "./airtable/client";
import { getInvoiceItemsByRecordIds } from "./airtable/invoiceItems";
import { getPOItemsForReconciliation } from "./airtable/poItems";
import { getDeliveryItemsByRecordIds } from "./airtable/deliveryItems";
import { childKind, parentIdOf } from "./idSequence";
import {
    byEntryOrder,
    fillNeedsOrder,
    fillOldestFirst,
    summarizeDeliveryInvoicing,
    summarizeInvoiceStatus,
} from "./deliveryStatus";

/** The ordered item a row names, flattened to the single value it is in practice. */
const orderedItemOf = (row) => (row?.poItem || [])[0] ?? null;

/**
 * Fill one side's rows on each ordered item, reading only the rows the fill needs and
 * the caller does not already hold (#640).
 *
 * `side` says which side: the invoice side pours `Delivered Qty` over an ordered item's
 * `Invoice Items`, the delivery side pours `Invoiced Qty` over its `Delivery Items`.
 * Each ordered item is filled over the rows in hand among its own link array, which is
 * exact whenever `fillNeedsOrder` is false (every row gets all or nothing, from any
 * subset) and complete when it is true, because those are the ordered items whose
 * missing rows were read first.
 *
 * Returns `{ filled, rows }`: entry id to the quantity that answered it, and every row
 * it filled over (held and read), keyed by record id.
 */
async function fillSide(orderedItems, held, side) {
    const rows = new Map((held || []).filter(Boolean).map((row) => [row.id, row]));
    const missing = new Set();
    for (const p of orderedItems) {
        if (!fillNeedsOrder(side.capacityOf(p), side.totalOf(p))) continue;
        for (const id of side.idsOf(p)) if (!rows.has(id)) missing.add(id);
    }
    if (missing.size > 0) {
        for (const row of await side.read([...missing])) rows.set(row.id, row);
    }

    const filled = new Map();
    for (const p of orderedItems) {
        const entries = side
            .idsOf(p)
            .map((id) => rows.get(id))
            .filter(Boolean)
            .map((row) => ({ id: row.id, entryKey: side.entryKeyOf(row), qty: row.qty }));
        for (const [id, qty] of fillOldestFirst(side.capacityOf(p), entries)) filled.set(id, qty);
    }
    return { filled, rows };
}

const INVOICE_SIDE = {
    capacityOf: (p) => p.deliveredQty || 0,
    totalOf: (p) => p.invoicedQty || 0,
    idsOf: (p) => p.invoiceItems || [],
    entryKeyOf: (row) => row.invoiceItemId || "",
    read: getInvoiceItemsByRecordIds,
};

const DELIVERY_SIDE = {
    capacityOf: (p) => p.invoicedQty || 0,
    totalOf: (p) => p.deliveredQty || 0,
    idsOf: (p) => p.deliveryItems || [],
    entryKeyOf: (row) => row.deliveryItemId || "",
    read: getDeliveryItemsByRecordIds,
};

/**
 * The delivery status of many invoices at once, for the invoice list (#166, #640).
 *
 * `invoices` are the GATED invoices and `invoiceItems` their items, which the list holds
 * already (#314) — the gather rule #169 set: the `PO Items` read below is over these
 * rows' ordered items alone, so a refused invoice's ordered items never reach the wire.
 * `siblings` are every other invoice item the caller holds, handed over so the fill can
 * place the gated items behind or ahead of them WITHOUT reading them again; they choose
 * nothing that is read, and nothing of theirs is returned. `/invoices` passes every
 * invoice's items, which is every row the fill can ask for, so this costs one read.
 *
 * Returns `{ byInvoice, orderedItems }`: invoice record id to `summarizeInvoiceStatus`'s
 * summary, and the `PO Items` rows it read. An invoice with no item gets a summary too,
 * so a caller never distinguishes "no entry" from "nothing to compare". An item whose
 * ordered item does not resolve — a link emptied or a row deleted by hand — is left out
 * of the summary, as the detail leaves it out of its table, so the row and the page
 * cannot disagree about it (#278's survive-and-skip).
 *
 * `orderedItems` IS HANDED BACK FOR #649, whose search names the deliveries on these same
 * ordered items: their `Delivery Items` arrays are on these rows, and a function that
 * reads something and keeps it forces the next caller to read it twice (#216).
 */
export async function getInvoiceDeliveryStatus(invoices, invoiceItems, { siblings = [] } = {}) {
    const byInvoice = new Map();
    const list = invoices || [];
    if (list.length === 0) return { byInvoice, orderedItems: [] };

    const charged = (invoiceItems || []).filter((item) => item.invoice?.[0] && orderedItemOf(item));
    const orderedItems = await getPOItemsForReconciliation([...new Set(charged.map(orderedItemOf))]);
    const resolved = new Set(orderedItems.map((p) => p.id));
    const { filled } = await fillSide(orderedItems, [...siblings, ...charged], INVOICE_SIDE);

    const itemsByInvoice = new Map();
    for (const item of charged) {
        if (!resolved.has(orderedItemOf(item))) continue;
        const parent = item.invoice[0];
        if (!itemsByInvoice.has(parent)) itemsByInvoice.set(parent, []);
        itemsByInvoice.get(parent).push({ qty: item.qty || 0, filled: filled.get(item.id) || 0 });
    }
    for (const inv of list) {
        byInvoice.set(inv.id, summarizeInvoiceStatus({ items: itemsByInvoice.get(inv.id) || [] }));
    }
    return { byInvoice, orderedItems };
}

/**
 * The deliveries a set of `Delivery Items` rows names, oldest entered first, each once
 * (#640): `{ id, deliveryId }`, the delivery's record id and its `Delivery ID`.
 *
 * NAMED FROM THE ROWS, NOT FROM `Deliveries`: a row's `Delivery Item ID` carries its
 * delivery's ID (`parentIdOf`), so no `Deliveries` read is made. A row with no ID, made by
 * hand, names no delivery. The invoice detail's section and the invoice list's search
 * (#649) both name deliveries through this, so the two cannot name different ones.
 */
function namedDeliveries(slices) {
    const deliveryKind = childKind(TABLES.DELIVERIES, "Delivery Items");
    const deliveries = new Map();
    for (const slice of [...slices].sort((a, b) =>
        byEntryOrder({ entryKey: a.deliveryItemId, id: a.id }, { entryKey: b.deliveryItemId, id: b.id })
    )) {
        const recordId = slice.delivery?.[0];
        const deliveryId = parentIdOf(deliveryKind, slice.deliveryItemId);
        if (!recordId || !deliveryId || deliveries.has(recordId)) continue;
        deliveries.set(recordId, { id: recordId, deliveryId });
    }
    return [...deliveries.values()];
}

/**
 * The `Delivery ID`s each invoice's items reach, for the invoice list's search (#649).
 *
 * THE SAME DELIVERIES THE INVOICE'S OWN PAGE NAMES: every delivery with a row on an ordered
 * item one of its items charges — invoices and deliveries meet only there (#640) — so a
 * delivery belongs to no one invoice, and an ID that finds this invoice may find another
 * charging the same ordered item. `invoiceItems` are the gated invoices' items and
 * `orderedItems` the `PO Items` rows `getInvoiceDeliveryStatus` read for them, whose
 * `Delivery Items` arrays say which rows name the deliveries.
 *
 * `held` ARE THE `Delivery Items` ROWS THE CALLER ALREADY READ, and only the rest are read.
 * `/invoices` holds the rows of every delivery on the jobs the reader may see deliveries on
 * (`getDeliveryInvoicing`, for the strip) — every delivery on the base for the office and the
 * President, so for them the read here is empty and costs nothing. A reader who sees an
 * invoice their delivery scope does not cover, a signer off the job, meets the one read:
 * one query per fifty rows missing. That is the price of the search being one rule for every
 * reader rather than finding an invoice by a delivery for one reader and not another.
 *
 * Returns a Map of invoice record id to its `Delivery ID`s, oldest delivery first; an
 * invoice whose items reach no delivery is absent.
 */
export async function getInvoiceDeliveryIds(invoiceItems, orderedItems, held) {
    const byInvoice = new Map();
    const orderedItemById = new Map((orderedItems || []).map((p) => [p.id, p]));
    const rows = new Map((held || []).filter(Boolean).map((row) => [row.id, row]));
    const missing = new Set();
    for (const p of orderedItemById.values()) {
        for (const id of p.deliveryItems || []) if (!rows.has(id)) missing.add(id);
    }
    if (missing.size > 0) {
        for (const row of await getDeliveryItemsByRecordIds([...missing])) rows.set(row.id, row);
    }

    const orderedItemsByInvoice = new Map();
    for (const item of invoiceItems || []) {
        const parent = item.invoice?.[0];
        const p = orderedItemById.get(orderedItemOf(item));
        if (!parent || !p) continue;
        if (!orderedItemsByInvoice.has(parent)) orderedItemsByInvoice.set(parent, new Set());
        orderedItemsByInvoice.get(parent).add(p);
    }
    for (const [invoice, reached] of orderedItemsByInvoice) {
        const slices = [...reached].flatMap((p) => (p.deliveryItems || []).map((id) => rows.get(id)));
        const named = namedDeliveries(slices.filter(Boolean)).map((d) => d.deliveryId);
        if (named.length > 0) byInvoice.set(invoice, named);
    }
    return byInvoice;
}

/**
 * One invoice's delivery section (#640): one row per invoice item, the deliveries that
 * brought its ordered items, and the summary the chip comes from.
 *
 * EACH ROW CARRIES TWO SCOPES AND NAMES BOTH. `qty` and `filled` are THIS invoice's: what
 * the item charges and how much of it the oldest-first fill answered. `ordered`,
 * `delivered` and `invoiced` are the ORDERED ITEM's — its `Qty`, `Delivered Qty` and
 * `Invoiced Qty`, every delivery and every invoice on it — and the screen heads them
 * `to date` so neither is read for the other. #232 removed the ordered item's totals
 * from this row because they sat under headings that read as the invoice's own; with
 * the comparison cumulative they are the comparison itself, so they are back, labeled.
 *
 * `deliveries` ARE THE ORDERED ITEMS', NOT THIS INVOICE'S: every delivery with a row on
 * one of them, oldest entered first. Named from the `Delivery Items` rows this reads
 * anyway — a row's `Delivery Item ID` carries its delivery's ID (`parentIdOf`) — so no
 * `Deliveries` read is made, which is part of how the page's operations did not rise. A
 * row with no ID, made by hand, names no delivery here.
 *
 * `invoiceItems` are the invoice's own already-loaded items, which the page holds, so
 * they are never read again and are handed to the fill as rows it already has.
 *
 * `orderedQtyByOrderedItem` IS A LEVEL THIS ALREADY READ (#408): `PO Items` is read here,
 * `Qty` is on it, and `chargesByOrder` needs it, so it is handed back rather than read a
 * second time by the page.
 */
export async function getInvoiceReconciliation(invoiceItems) {
    const items = (invoiceItems || []).map((l) => ({ ...l, poItemRecordId: orderedItemOf(l) }));
    const orderedItems = await getPOItemsForReconciliation([
        ...new Set(items.map((l) => l.poItemRecordId).filter(Boolean)),
    ]);
    const orderedItemById = new Map(orderedItems.map((p) => [p.id, p]));

    const [{ filled }, slices] = await Promise.all([
        fillSide(orderedItems, items, INVOICE_SIDE),
        getDeliveryItemsByRecordIds(orderedItems.flatMap((p) => p.deliveryItems || [])),
    ]);

    // IN THE INVOICE'S OWN ITEM ORDER, so the table reads down the page in the order of
    // the items table above it. A row whose ordered item does not resolve is dropped
    // rather than described (#278) — a crash guard on a base anybody can edit.
    const rows = items.flatMap((l) => {
        const p = l.poItemRecordId ? orderedItemById.get(l.poItemRecordId) : null;
        if (!p) return [];
        return {
            // The invoice item's record id, which is the language the fold speaks
            // (#241): `foldInvoiceItems` states its groups as `rowIds`, and
            // lib/invoiceDeliveryEntries.js joins this row back on it.
            id: l.id,
            invoiceItemId: l.invoiceItemId,
            // The label comes from the ORDERED item, the document the comparison is
            // against. A folded entry takes the invoice item's frozen copy instead
            // (#241), since a fold can span two ordered items.
            itemName: p.itemName,
            size: p.size,
            maker: p.maker,
            unit: p.unit || l.unit || "",
            poItemId: p.poItemId,
            poItemRecordId: p.id,
            // #167 — #18's item identity, the key the items table folds a split invoice
            // item back together on. Never `Item Name` text.
            materialRecordId: p.material?.[0] ?? null,
            qty: l.qty || 0,
            filled: filled.get(l.id) || 0,
            ordered: p.qty || 0,
            delivered: p.deliveredQty || 0,
            invoiced: p.invoicedQty || 0,
        };
    });

    return {
        rows,
        summary: summarizeInvoiceStatus({ items: rows.map((r) => ({ qty: r.qty, filled: r.filled })) }),
        deliveries: namedDeliveries(slices),
        // #408 — what each of those ordered items was ordered for, keyed the way the
        // charge rows name one: an ordered item's record id.
        orderedQtyByOrderedItem: new Map(orderedItems.map((p) => [p.id, p.qty])),
    };
}

/**
 * The invoicing status of many deliveries at once, for the deliveries list and the
 * strip above `/invoices` (#166, #640).
 *
 * CALLED FOR EVERY VIEWER SINCE #211. `deliveries` are already-loaded delivery objects
 * carrying their `deliveryItems` link arrays, which both callers read for every job they
 * show — so every other delivery on an ordered item one of them fills is in hand too,
 * and the fill's own read is empty unless the base holds a delivery on an ordered item
 * of another job.
 *
 * Returns `{ byDelivery, slices }` — a Map of delivery record id to summary, and THE
 * DELIVERY ITEM ROWS IT READ TO BUILD IT. It returned the map alone until #216, and its
 * callers read the same level again; a function that reads something and does not hand
 * it back forces the next caller to read it twice.
 */
export async function getDeliveryInvoicing(deliveries) {
    const byDelivery = new Map();
    const list = deliveries || [];
    if (list.length === 0) return { byDelivery, slices: [] };

    const slices = await getDeliveryItemsByRecordIds(list.flatMap((d) => d.deliveryItems || []));
    const attached = slices.filter((slice) => slice.delivery?.[0] && orderedItemOf(slice));
    const orderedItems = await getPOItemsForReconciliation([...new Set(attached.map(orderedItemOf))]);
    const { filled } = await fillSide(orderedItems, attached, DELIVERY_SIDE);

    const orderedItemsByDelivery = new Map();
    for (const slice of attached) {
        const parent = slice.delivery[0];
        const orderedItemId = orderedItemOf(slice);
        if (!orderedItemsByDelivery.has(parent)) orderedItemsByDelivery.set(parent, new Map());
        const forDelivery = orderedItemsByDelivery.get(parent);
        // ONE ENTRY PER DISTINCT ORDERED ITEM, with the delivery's slices summed into it:
        // a delivery can hold two slices of one ordered item — the within-order one and
        // the excess — and counting them as two would make "1 of 2 invoiced" out of a
        // single ordered item.
        const entry = forDelivery.get(orderedItemId) || {
            poItemRecordId: orderedItemId,
            delivered: 0,
            invoiced: 0,
        };
        entry.delivered += slice.qty || 0;
        entry.invoiced += filled.get(slice.id) || 0;
        forDelivery.set(orderedItemId, entry);
    }

    for (const d of list) {
        byDelivery.set(
            d.id,
            summarizeDeliveryInvoicing([...(orderedItemsByDelivery.get(d.id)?.values() || [])])
        );
    }
    return { byDelivery, slices };
}
