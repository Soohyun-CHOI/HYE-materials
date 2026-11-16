// An item as the vendor wrote it, spread over the ordered items it charges (#660).
//
// A VENDOR WRITES ONE ITEM FOR A MATERIAL, AND THE OFFICE ORDERED IT TWICE. An invoice charging two
// orders is usually the same material bought again, so the vendor's `Elbow 7 EA` stands for five on
// the older order and two on the newer one. An invoice item names one ordered item (#278), so the
// office used to split that item by hand, and an item entered whole ran past what its ordered item
// had left and read as a quantity variance with nothing wrong. Now the item is entered as the vendor
// wrote it, choosing a material from the invoice's orders, and this module spreads it.
//
// WHAT IS ONE CHOICE: A MATERIAL AT ONE ORDERED PRICE. The invoice's orders' ordered items are grouped
// on #18's `Material` link — never `Item Name` text, the rule `lib/invoiceItemFold.js` states — and on
// the ordered item's `Unit Price`. A material ordered at one price on two orders is one choice and is
// spread over both; ordered at two prices it is two choices, one per price, and the office enters an
// item for each — a spread cannot put a $10 item on a $12 order without making a price variance the
// vendor never caused. An ordered item with no `Material` is a choice of its own.
//
// THE SPREAD IS `lib/deliveryAllocation.js:fillOrderedItems`, the pour a delivery is recorded with
// (#162): oldest order first, each ordered item up to what is left uninvoiced on it, and what no
// ordered item has left on the last one filled — where it reads as a quantity variance, the rule
// #623 already applies. Items are spread in the order the vendor wrote them, each taking only what
// the ones above it left, so a vendor writing one material twice on purpose is two items spread one
// after the other and never one item. Within one item an ordered item takes one share, so a saved
// invoice item still names one ordered item, as every invoice item has since #278.
//
// WHAT IS SAVED IS `Invoice Items."Position"`: every invoice item one written item was spread into
// holds that item's place on the invoice, 1 for the first. `invoicePositions` reads them back as one
// item with a share per order, which is what the invoice's page draws; a row with no number — made by
// hand — is an item of its own.
//
// PURE, AND IMPORTED BY THE ENTRY FORM, so the sentence an over-quantity item carries before saving
// and what `createInvoiceAction` writes are one function. The explicit `.js` on each import is the
// offline tier's, which runs under plain `node`.

import { fillOrderedItems, sortCandidates } from "./deliveryAllocation.js";
import { itemLabel } from "./materialIdentity.js";
import { uninvoicedQty } from "./poItemQty.js";
import { formatUSD } from "./format.js";
import { varianceState } from "./variance.js";

/**
 * The choice an ordered item belongs to: its material at its ordered price, or itself where it has
 * no material. Exported so a check can pin it rather than infer it from what grouped.
 */
export function spreadKey(orderedItem) {
    if (!orderedItem?.materialRecordId) return `item::${orderedItem?.id ?? ""}`;
    return `mat::${orderedItem.materialRecordId}::${orderedItem.unitPrice ?? ""}`;
}

/** What is left to invoice on an ordered item: never below nothing, since a negative is no room. */
function leftOn(orderedItem) {
    return Math.max(0, uninvoicedQty({ qty: orderedItem?.qty, invoicedQty: orderedItem?.invoicedQty }));
}

/**
 * The choices an item can be entered as, from the invoice's orders' ordered items — each
 * `{ id, poItemId, poRecordId, poId, poCreatedDate, materialRecordId, itemName, size, maker, unit,
 * qty, unitPrice, invoicedQty }`. One per `spreadKey`, its ordered items in fill order, carrying
 * what is uninvoiced on all of them and the orders they are on. Those with something uninvoiced
 * come first, then the rest — #57's order for the list this replaces — each in fill order.
 */
export function spreadChoices(orderedItems) {
    const byKey = new Map();
    for (const orderedItem of sortCandidates(orderedItems || [])) {
        const key = spreadKey(orderedItem);
        if (!byKey.has(key)) {
            byKey.set(key, {
                key,
                materialRecordId: orderedItem.materialRecordId ?? null,
                itemName: orderedItem.itemName || "",
                size: orderedItem.size || "",
                maker: orderedItem.maker || "",
                unit: orderedItem.unit || "",
                unitPrice: orderedItem.unitPrice ?? null,
                orderedItems: [],
                poIds: [],
                uninvoiced: 0,
            });
        }
        const choice = byKey.get(key);
        choice.orderedItems.push(orderedItem);
        if (orderedItem.poId && !choice.poIds.includes(orderedItem.poId)) choice.poIds.push(orderedItem.poId);
        choice.uninvoiced += leftOn(orderedItem);
    }
    const choices = [...byKey.values()];
    // Whether a material stands as two or more choices, which is when a choice has to say which.
    const perMaterial = new Map();
    for (const c of choices) if (c.materialRecordId) perMaterial.set(c.materialRecordId, (perMaterial.get(c.materialRecordId) || 0) + 1);
    for (const c of choices) c.sharesMaterial = (perMaterial.get(c.materialRecordId) || 0) > 1;
    return [...choices.filter((c) => c.uninvoiced > 0), ...choices.filter((c) => c.uninvoiced <= 0)];
}

/**
 * Spread the items as the vendor wrote them, in that order (#660). `entries` are
 * `[{ key, qty }]`, `key` a choice's; `orderedItems` the invoice's orders' ordered items, as
 * `spreadChoices` takes them. Each entry gets `{ key, qty, shares: [{ orderedItem, qty }], left,
 * over, unknown }`:
 *
 *   - `shares` — one per ordered item it reaches, in fill order, the excess merged into the last
 *     one's, so a saved item names one ordered item.
 *   - `left` — what was uninvoiced on its choice once the items above it had taken theirs.
 *   - `over` — what ran past `left`, which reads as a quantity variance on the last share.
 *   - `unknown` — its key names no choice of these orders: the form's choice from an order since
 *     withdrawn, or a request that never came from the form. Nothing is spread.
 */
export function spreadInvoiceItems({ entries, orderedItems }) {
    const byKey = new Map();
    for (const orderedItem of orderedItems || []) {
        const key = spreadKey(orderedItem);
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(orderedItem);
    }
    // What the items above have already put on each ordered item.
    const taken = new Map();
    const remainingOf = (orderedItem) => Math.max(0, leftOn(orderedItem) - (taken.get(orderedItem.id) || 0));

    return (entries || []).map((entry) => {
        const narrowed = byKey.get(entry?.key) || [];
        const qty = Number(entry?.qty);
        if (narrowed.length === 0) return { key: entry?.key, qty, shares: [], left: 0, over: 0, unknown: true };
        const fill = fillOrderedItems({ narrowed, remainingOf, qty });
        const shares = [];
        for (const row of fill.rows) {
            const same = shares.find((s) => s.orderedItem.id === row.orderedItem.id);
            if (same) same.qty += row.qty;
            else shares.push({ orderedItem: row.orderedItem, qty: row.qty });
        }
        for (const share of shares) taken.set(share.orderedItem.id, (taken.get(share.orderedItem.id) || 0) + share.qty);
        return { key: entry.key, qty, shares, left: fill.totalRemaining, over: fill.over, unknown: false };
    });
}

/** The fill order's comparison, for two shares or two orders: the same chain `sortCandidates` uses. */
function byFillOrder(a, b) {
    const sorted = sortCandidates([a, b]);
    return sorted[0] === a ? -1 : 1;
}

/**
 * An invoice's items read back as the vendor wrote them (#660). `items` are its `Invoice Items`
 * rows; `orderedItemById` the ordered items they name, as a `Map` of `{ id, poItemId, poRecordId,
 * poId, poCreatedDate, materialRecordId, qty, unitPrice, invoicedQty }`. One entry per `Position`, in
 * that order — a row with no number is one of its own, after the numbered ones in `Invoice Item ID`
 * order — each with its total quantity and amount and a share per invoice item in fill order:
 * `{ id, invoiceItemId, poRecordId, poId, orderedItem, qty, amount, priceVariance, quantityVariance,
 * hasPriceVariance, hasQuantityVariance, remark }`. `split` is whether it has more than one.
 */
export function invoicePositions({ items, orderedItemById }) {
    const rows = [...(items || [])].filter(Boolean).sort((a, b) =>
        String(a.invoiceItemId || "").localeCompare(String(b.invoiceItemId || ""), "en", { numeric: true })
    );
    const byKey = new Map();
    for (const row of rows) {
        const key = row.position != null ? `pos::${row.position}` : `row::${row.id}`;
        if (!byKey.has(key)) byKey.set(key, { key, position: row.position ?? null, rows: [] });
        byKey.get(key).rows.push(row);
    }
    const groups = [...byKey.values()].sort((a, b) => {
        if (a.position == null || b.position == null) return a.position == null ? (b.position == null ? 0 : 1) : -1;
        return a.position - b.position;
    });

    return groups.map((group) => {
        const shares = group.rows
            .map((row) => {
                const orderedItem = orderedItemById?.get(row.poItem?.[0]) ?? null;
                return {
                    id: row.id,
                    invoiceItemId: row.invoiceItemId,
                    poRecordId: row.po?.[0] ?? orderedItem?.poRecordId ?? null,
                    poId: orderedItem?.poId ?? null,
                    orderedItem,
                    qty: row.qty || 0,
                    amount: row.amount || 0,
                    unitPrice: row.unitPrice ?? null,
                    hasPriceVariance: Boolean(row.hasPriceVariance),
                    hasQuantityVariance: Boolean(row.hasQuantityVariance),
                    priceVariance: varianceState(row, "price"),
                    quantityVariance: varianceState(row, "quantity"),
                    remark: (row.remark || "").trim(),
                    // The fill order's three keys, so shares sort the way they were poured.
                    poCreatedDate: orderedItem?.poCreatedDate ?? null,
                    poItemId: orderedItem?.poItemId ?? row.invoiceItemId ?? "",
                };
            })
            .sort(byFillOrder);
        const first = group.rows[0];
        const remarks = [...new Set(shares.map((s) => s.remark).filter(Boolean))];
        return {
            key: group.key,
            position: group.position,
            itemName: first.itemName || "",
            size: first.size || "",
            maker: first.maker || "",
            unit: first.unit || "",
            unitPrice: first.unitPrice ?? null,
            qty: shares.reduce((sum, s) => sum + s.qty, 0),
            amount: shares.reduce((sum, s) => sum + s.amount, 0),
            remark: remarks.join("; "),
            shares,
            split: shares.length > 1,
        };
    });
}

/**
 * Where an item names its order (#660), from the invoice's orders, oldest first by the fill's chain:
 *
 *   - `none` — the invoice charges one order, so every item is on it and naming it says nothing.
 *   - `split` — every item has a share on the oldest order: the newer ones only bought more of what
 *     it had. An item spread over two orders names each on its shares, and nothing else names one.
 *   - `every` — some item has no share on the oldest order, so which order an item is on is not
 *     the same answer for every item: every item names its order, on its shares where it has two.
 *
 * `orders` are `{ id, poId, createdDate }`; `positions` are `invoicePositions`'.
 */
export function orderNaming({ positions, orders }) {
    const distinct = [...new Map((orders || []).filter(Boolean).map((o) => [o.id, o])).values()];
    if (distinct.length <= 1) return "none";
    const oldest = sortCandidates(distinct.map((o) => ({ id: o.id, poCreatedDate: o.createdDate, poId: o.poId })))[0];
    const everyOnOldest = (positions || []).every((p) => p.shares.some((s) => s.poRecordId === oldest.id));
    return everyOnOldest ? "split" : "every";
}

/** Whether one share names its order, under `orderNaming`'s answer. */
export function namesOrder(mode, position) {
    if (mode === "none") return false;
    if (mode === "every") return true;
    return Boolean(position?.split);
}

/**
 * The edit screen's quantity per order for one item (#660): every ordered item of the invoice's
 * orders on the item's choice, each with the quantity this invoice charges it on this item now
 * (0 where it charges none), and what is uninvoiced on it apart from this invoice. An item takes a
 * quantity per order where this is two or more; with one it keeps its one quantity.
 *
 * `position` is `invoicePositions`'; `orderedItems` the invoice's orders' ordered items;
 * `thisInvoiceOn` a `Map` of what the invoice charges each ordered item, on all its items.
 */
export function editableShares({ position, orderedItems, thisInvoiceOn }) {
    const own = position.shares.map((s) => s.orderedItem).filter(Boolean);
    const keys = new Set(own.map(spreadKey));
    const candidates = sortCandidates(
        (orderedItems || []).filter((o) => keys.has(spreadKey(o)) || own.some((x) => x.id === o.id))
    );
    return candidates.map((orderedItem) => {
        const share = position.shares.find((s) => s.orderedItem?.id === orderedItem.id) ?? null;
        const elsewhere = (orderedItem.invoicedQty || 0) - (thisInvoiceOn?.get(orderedItem.id) || 0);
        return {
            orderedItem,
            invoiceItemRecordId: share?.id ?? null,
            qty: share?.qty ?? 0,
            uninvoiced: Math.max(0, (orderedItem.qty || 0) - elsewhere),
        };
    });
}

/**
 * What a save of one item's quantities per order writes (#660): the invoice items to change, to
 * make and to remove. `existing` are the item's own invoice items `{ id, orderedItemId, qty }`;
 * `candidates` the ordered items it may take a new share on, by id; `submitted`
 * `[{ invoiceItemId, orderedItemId, qty }]` — a share the item has by its invoice item, a new one
 * by its ordered item. A new share on an ordered item that is not a candidate, or that the item
 * already has a share on, is ignored, as the edit action ignores a row of another invoice; an
 * existing share sent no quantity keeps its own. A quantity that is not a positive number is
 * nothing. `total` is what the item adds up to, which a save refuses at zero.
 */
export function planShareEdits({ existing, candidates, submitted }) {
    const allowed = new Set(candidates || []);
    const own = new Set((existing || []).map((row) => row.orderedItemId).filter(Boolean));
    const byRow = new Map();
    const byOrdered = new Map();
    for (const s of submitted || []) {
        const n = Number(s?.qty);
        const qty = Number.isFinite(n) && n > 0 ? n : 0;
        if (s?.invoiceItemId) byRow.set(s.invoiceItemId, qty);
        else if (allowed.has(s?.orderedItemId) && !own.has(s.orderedItemId)) byOrdered.set(s.orderedItemId, qty);
    }
    const updates = [];
    const removes = [];
    const creates = [];
    let total = 0;
    for (const row of existing || []) {
        const qty = byRow.has(row.id) ? byRow.get(row.id) : row.qty || 0;
        if (qty > 0) {
            updates.push({ id: row.id, qty });
            total += qty;
        } else {
            removes.push(row.id);
        }
    }
    for (const [orderedItemId, qty] of byOrdered) {
        if (qty <= 0) continue;
        creates.push({ orderedItemId, qty });
        total += qty;
    }
    return { updates, creates, removes, total };
}

export const INVOICE_SPREAD_COPY = {
    /** The choice list's prompt, before an item is chosen. */
    placeholder: "Select an item",
    /**
     * One choice: the item and what is uninvoiced on it, `(Uninvoiced: N)` as the list this replaced
     * said it. Where the material stands as two or more choices — two ordered prices — each says
     * which orders it is on and at what price, the only case the office enters an item per order.
     */
    choice: (choice) =>
        `${itemLabel(choice) || "That item"}` +
        `${choice?.sharesMaterial ? ` · ${(choice.poIds || []).join(", ")} · ${formatUSD(choice.unitPrice)}` : ""}` +
        ` (Uninvoiced: ${choice?.uninvoiced ?? 0})`,
    /**
     * Under an item whose quantity runs past what its orders have uninvoiced — the one sentence the
     * entry screen says about the spread, which it otherwise does not show.
     */
    over: ({ over, left, unit }) => {
        const u = unit ? ` ${unit}` : "";
        return left > 0
            ? `${over}${u} more than the ${left}${u} uninvoiced on these orders — it will show as a Quantity variance.`
            : `Nothing on these orders is left uninvoiced — all ${over}${u} will show as a Quantity variance.`;
    },
    /** A choice the orders no longer hold, refused on save. */
    choiceGone: "An item is no longer on the selected POs. Reload the form and try again.",
    /** The edit screen's sentence above its items. */
    editIntro:
        "Edit item values. An item on more than one PO takes a quantity per PO. Size, Maker and Unit are " +
        "fixed — to add or remove items, delete and recreate the invoice.",
    /** Under one order's quantity on the edit screen: what is uninvoiced on it apart from this invoice. */
    uninvoiced: (n, unit) => `${n}${unit ? ` ${unit}` : ""} uninvoiced`,
    /** An item's total on the edit screen, where it takes a quantity per order. */
    total: (n, unit) => `Total ${n}${unit ? ` ${unit}` : ""}`,
};
