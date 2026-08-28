// Deleting a recorded delivery (#162) — the whole concern in one module: who
// may, what the three voices of the confirmation say, and the guarded write.
// Same arrangement as lib/poWithdraw.js, and for the same reason: "where does
// the delete rule live" has exactly one answer, so the UI and the server cannot
// drift apart on it.
//
// A REAL DELETE, WITH NO TOMBSTONE, and that follows invoices rather than PRs and
// POs. A withdrawn PR or PO stays on record because an approval chain happened
// and a signature happened — there is history to preserve. A delivery is a claim
// that material was delivered; if the claim was wrong there is no history in it, only a
// mistake, and this is the ONLY way to correct one, since item, quantity, vendor
// and PO are not editable and there is no allocation-editing UI.
//
// Credentialed tier: imports lib/airtable/*. Its copy therefore cannot be pinned
// offline — the same trade CLAUDE.md already records for lib/poWithdraw.js, and
// the same answer: this module exists specifically to hold the predicate, the
// copy and the write together, so prying the pure half out to make it importable
// would re-create the split the module was built to prevent. #159's split of
// formulaString was the opposite case (a self-contained rule with no table of its
// own), which is why it is not a precedent here.

import { base, TABLES } from "./airtable/client";
import { getDeliveryByRecordId } from "./airtable/deliveries";
import {
    getDeliveryItemsByRecordIds,
    getItemsByDelivery,
    createDeliveryItem,
    setDeliveryItemAllocation,
} from "./airtable/deliveryItems";
import { getPOItemsForReconciliation } from "./airtable/poItems";
import { recomputeOverDelivery } from "./deliveryAllocation";
import { getInvoicedQtyForPOItem } from "./airtable/poItems";
import { getItemsByPOItem } from "./airtable/invoiceItems";
import { getInvoiceByRecordId } from "./airtable/invoices";

/**
 * May this user delete this delivery? The author, or any Admin.
 *
 * Pure — the caller passes an already-loaded user and delivery, the same contract
 * as canViewPR (lib/prVisibility.js) and getPOWithdrawEligibility
 * (lib/poWithdraw.js), which is what lets the page and the write path apply one
 * rule without either doing a query for it.
 *
 * The author because a mistake is theirs to take back; Admin because correcting
 * the record is office work, and the office is who reconciles what was delivered
 * against what was invoiced. Deliberately NOT "anyone on the Job", even though
 * anyone on the Job may CREATE one: entry is a claim about what you received,
 * whereas deletion destroys someone else's claim and the only copy of its photo.
 */
export function canDeleteDelivery(user, delivery) {
    if (!user || !delivery) return false;
    if (user.isAdmin === true) return true;
    return delivery.recordedBy?.[0] === user.id;
}

/**
 * The three voices, side by side on purpose (the arrangement of #138's
 * WITHDRAW_COPY). All second person — a confirmation dialog addresses whoever is
 * about to act — and all branch on the SAME two facts, so a later change to one
 * cannot quietly leave the others describing different behavior.
 *
 * They exist because deletion here is NOT an unusual act to be discouraged: it is
 * the only correction mechanism there is, so a recorder fixing a typo on a paid
 * ordered item is doing the expected thing. What the copy owes them is not a
 * warning but an accurate account of what becomes inconsistent in the meantime.
 *
 * Take the delivery id and the affected ordered item count, because a confirmation must
 * name what it is acting on. Resolve on the server and pass plain strings to the
 * client component — functions cannot cross that boundary.
 */
export const DELETE_COPY = {
    plain: {
        title: "Delete this delivery?",
        body: (deliveryId, orderedItemCount) =>
            `${deliveryId} and its packing list photo are removed for good, and the ${orderedItemCount} ordered ` +
            `${orderedItemCount === 1 ? "item" : "items"} it was recorded against ${orderedItemCount === 1 ? "goes" : "go"} ` +
            `back to showing nothing delivered. Enter it again if you are correcting it. This cannot be undone.`,
    },
    invoiced: {
        title: "Delete this delivery?",
        body: (deliveryId, orderedItemCount) =>
            `${deliveryId} and its packing list photo are removed for good. The invoice against ` +
            `${orderedItemCount === 1 ? "this ordered item" : "these ordered items"} is not changed — deleting this only removes the ` +
            `record that the material was delivered, so until you enter it again ${orderedItemCount === 1 ? "that ordered item" : "those ordered items"} ` +
            `will read as invoiced with nothing delivered. This cannot be undone.`,
    },
    paid: {
        title: "Delete this delivery?",
        body: (deliveryId, orderedItemCount) =>
            `${deliveryId} and its packing list photo are removed for good. ${orderedItemCount === 1 ? "This ordered item is" : "These ordered items are"} ` +
            `on an invoice that has already been paid; deleting the delivery record changes neither the invoice nor the ` +
            `payment, it removes the evidence the material came in. If you are correcting a mistake, enter the ` +
            `delivery again straight away. This cannot be undone.`,
    },
};

/**
 * Which voice, and why it is worth two extra reads.
 *
 * `paid` beats `invoiced` beats `plain`, checked in that order because the
 * strongest true statement is the one to make. Payment is checked through the
 * INVOICE rather than the ordered item, because `Paid` lives on `Invoices` —
 * an ordered item is never "paid" by itself.
 *
 * `seesPayment` STOOD HERE AND IS GONE (#309), WHICH IS THE ONE PLACE THIS CHANGE
 * COSTS SOMETHING. #211 made payment President-or-Admin and this modal was where
 * that line leaked: deletion is author-or-Admin on a Job-scoped record, so a site
 * recorder deleting their own delivery was being told, in a modal, that the vendor
 * had already been paid. The line is reversed — payment is readable by anyone who
 * reaches the invoice — and the reader here does reach it: the page's own header
 * records that anyone who passes `canAccessJobDeliveries` passes `canViewPR` for
 * every request behind every row, which is the clause `getVisibleInvoiceIds` reaches
 * for an invoice. So the third voice is offered to whoever may delete, and the flag
 * would now be a gate on payment of payment's own, which is what #309 removes.
 *
 * Escalates lazily: the invoiced check is one `Invoiced Qty` read per affected
 * ordered item, and the invoices behind those ordered items are only fetched
 * once an ordered item turns out to be invoiced. So an ordinary delivery pays
 * for the cheap question alone, and the extra cost lands exactly where the
 * warning actually differs.
 *
 * WHAT THAT COSTS, NAMED RATHER THAN DISCOVERED. The flag stopped the escalation one
 * READ earlier as well as one voice earlier, so a non-office reader now pays what
 * the office always paid: one `Invoice Items` read per invoiced ordered item plus one
 * `Invoices` read per distinct invoice. It lands only where all three hold — the
 * reader is not the office, they recorded the delivery themselves (or `mayDelete`
 * is false and this function is never called), and an ordered item is invoiced.
 *
 * A read failure resolves to `plain` rather than throwing. The alternative is
 * refusing to show a confirmation at all, which would block the only correction
 * path over a warning — and the write itself does not depend on this answer.
 * An unattributable over-delivery row contributes no PO Item, so it cannot make
 * a delivery look invoiced, which is correct: it is against no order.
 */
export async function resolveDeleteCopy(delivery, items) {
    const poItemIds = [...new Set((items || []).map((i) => i.poItem?.[0]).filter(Boolean))];
    const orderedItemCount = poItemIds.length;

    let voice = "plain";
    try {
        const invoicedQtys = await Promise.all(poItemIds.map((id) => getInvoicedQtyForPOItem(id)));
        const invoicedPoItemIds = poItemIds.filter((_, i) => (invoicedQtys[i] || 0) > 0);

        if (invoicedPoItemIds.length > 0) {
            voice = "invoiced";
            // #309 — no longer asked of anybody. The escalation is still lazy, so an
            // uninvoiced delivery reaches none of these reads.
            const invoiceItems = (
                await Promise.all(invoicedPoItemIds.map((id) => getItemsByPOItem(id)))
            ).flat();
            const invoiceIds = [...new Set(invoiceItems.flatMap((item) => item.invoice || []))];
            const invoices = await Promise.all(
                invoiceIds.map((id) => getInvoiceByRecordId(id).catch(() => null))
            );
            if (invoices.some((inv) => inv?.paid)) voice = "paid";
        }
    } catch (err) {
        console.error("resolveDeleteCopy could not resolve invoice state, falling back to plain", err);
    }

    const copy = DELETE_COPY[voice];
    return { voice, orderedItemCount, title: copy.title, body: copy.body(delivery.deliveryId, orderedItemCount) };
}

/**
 * Server-side refusal messages, keyed the way poWithdraw.js keys its own, so the
 * page and the write path cannot disagree about what a refusal means.
 */
export const DELETE_REFUSAL = {
    "not-found": "That delivery no longer exists.",
    "not-allowed": "Only the person who recorded this delivery, or an Admin, can delete it.",
};

/**
 * Delete a delivery and its items.
 *
 * `actingUser` is the already-loaded Users record — the one thing the Server
 * Action derives from the session. Keeping the decision and the write in this
 * plain module, with identity as a parameter, is what lets a verification script
 * exercise the real guard instead of a copy of it: the action itself is
 * unimportable outside Next (iron-session cookies, redirect()), so nothing
 * decision-shaped may live there. Same reasoning as withdrawPOAsRequester.
 *
 * Children go first so a mid-failure can only leave a delivery with fewer items,
 * never an item orphaned from its parent — and every `PO Items."Delivered Qty"`
 * rollup a deleted item fed simply recomputes, with nothing to write. NOTHING on
 * any Invoice record is touched: an invoice and a delivery are independent
 * records of the same delivery, so what was invoiced and whether it was paid are
 * unchanged by this.
 *
 * The photo goes with the record, and that is the irreversible part. Airtable's
 * copy is the copy of record and #140 deletes the Blob object once Airtable has
 * ingested it, so there is no second copy to fall back on — which is why all
 * three voices of DELETE_COPY say so.
 */
export async function deleteDeliveryAsUser({ deliveryRecordId, actingUser }) {
    const delivery = await getDeliveryByRecordId(deliveryRecordId).catch(() => null);
    if (!delivery) return { error: DELETE_REFUSAL["not-found"], reason: "not-found" };

    if (!canDeleteDelivery(actingUser, delivery)) {
        return { error: DELETE_REFUSAL["not-allowed"], reason: "not-allowed" };
    }

    let touchedPOItemIds = [];
    try {
        const items = await getItemsByDelivery(delivery.id);
        // The ordered items this delivery had rows on — captured BEFORE the
        // destroys, because afterwards there is nothing left to read them from.
        touchedPOItemIds = [...new Set(items.map((it) => (it.poItem || [])[0]).filter(Boolean))];

        // SEQUENTIAL, AND THE SETTLED RESULTS ARE NO LONGER DISCARDED (#206).
        // This was `Promise.allSettled(...)` with its results thrown away, which
        // is the exact defect offline/fixture-cleanup.mjs bans in verification
        // scripts — a row that failed to delete was silently absent, and the
        // parent went anyway. #206 makes that a correctness precondition rather
        // than untidiness: a surviving row missing from the recomputation's input
        // would have the flags recomputed against an ordered item that is not what is
        // stored. A failed child delete now throws before the parent goes, so a
        // recoverable pair is left instead of an orphan.
        for (const item of items) {
            await base(TABLES.DELIVERY_ITEMS).destroy(item.id);
        }
        await base(TABLES.DELIVERIES).destroy(delivery.id);
    } catch (err) {
        console.error("deleteDeliveryAsUser failed", err);
        return { error: "Something went wrong deleting this delivery. Please try again." };
    }

    await recomputeFlagsForOrderedItems(touchedPOItemIds);

    return { ok: true, deliveryId: delivery.deliveryId, jobRecordId: delivery.job?.[0] ?? null };
}

/**
 * Redraw the within/over boundary on every ordered item the deleted delivery touched
 * (#206).
 *
 * UNCONDITIONAL, AND IT LOOKS AT NO CORRECTION STATE. It could not, before:
 * `isOverageApplied` read the same flag, so recomputing would have forged
 * `applied` on a correction whose excess never moved. #206 moved that judgment
 * onto `Former PO Item`, which is beyond a recomputation's reach, and that is
 * what lets this run without a branch.
 *
 * THE `Overage PR` LINK IS NEVER CLEARED, and never moved either. Delete-then-
 * reenter is the correction path, so a link destroyed mid-edit could not be
 * restored when the excess reappears seconds later. A split leaves the link on
 * the record it was already on — see recomputeOverDelivery for why the resized
 * record is the within piece — and `lib/overage.js:isNoLongerOverDelivered` is
 * what reports the resulting mismatch.
 *
 * DELETING A DELIVERY CAN NOW CREATE ROWS, which it never did before, and the
 * write budget follows from that. Two batched reads, each chunked at 50 ids;
 * then one `update()` per row whose quantity or flag actually changes, and one
 * `create()` per straddling ordered item — at most one per ordered item, since
 * a strictly increasing total crosses the ordered quantity once. An ordinary
 * one-line delete pays two reads and no writes at all. NOTHING IS EVER DELETED
 * here: no row is removed and no row is merged into another, so the only
 * records this touches are the ones it resizes and the ones it adds.
 *
 * RESIZE BEFORE CREATE, and the order is the failure mode rather than style. If
 * the create fails after the resize, the ordered item has lost the excess from its
 * recorded total: material that was delivered reads as undelivered, and the next
 * recomputation finds no straddle and changes nothing further. The other order
 * fails the other way — a created excess with the straddler still at full size
 * leaves the ordered item reading as MORE delivered than delivered, which #169 records as
 * the worse direction, since nobody goes looking for material the record already
 * claims. Both are bounded and neither compounds; this is the one that does not
 * fabricate delivery.
 *
 * AFTER THE DESTROYS, so the `Delivery Items` reverse-link no longer lists the
 * rows that just went.
 *
 * BEST-EFFORT, in lib/materialsCache.js's shape: the delivery is already gone
 * and the user's action succeeded, so a failure here must not report failure for
 * work that was carried out. It is logged instead, and the next delete touching
 * the same ordered item redraws the boundary again.
 */
async function recomputeFlagsForOrderedItems(poItemRecordIds) {
    if (poItemRecordIds.length === 0) return;

    try {
        const orderedItems = await getPOItemsForReconciliation(poItemRecordIds);
        const rowIds = [...new Set(orderedItems.flatMap((orderedItem) => orderedItem.deliveryItems || []))];
        const stored = await getDeliveryItemsByRecordIds(rowIds);
        const rowById = new Map(stored.map((row) => [row.id, row]));

        for (const orderedItem of orderedItems) {
            const deliveryItemRows = (orderedItem.deliveryItems || [])
                .map((id) => rowById.get(id))
                .filter(Boolean);

            const plan = recomputeOverDelivery({ orderedQty: orderedItem.qty, rows: deliveryItemRows });

            for (const want of plan.rows) {
                const row = rowById.get(want.id);
                if (!row) continue;
                if (row.qty === want.qty && row.overDelivered === want.overDelivered) continue;
                await setDeliveryItemAllocation(want.id, {
                    qty: want.qty,
                    overDelivered: want.overDelivered,
                });
            }

            for (const split of plan.splits) {
                const from = rowById.get(split.fromRowId);
                if (!from) continue;
                // Every other field is copied, so the two pieces stay one item to
                // groupRowsByItem and the new row lands in the same group.
                await createDeliveryItem({
                    deliveryRecordId: from.delivery?.[0] ?? null,
                    deliveryId: from.deliveryItemId.slice(0, from.deliveryItemId.lastIndexOf("-")),
                    poItemRecordId: (from.poItem || [])[0] ?? null,
                    materialRecordId: (from.material || [])[0] ?? null,
                    itemName: from.itemName,
                    size: from.size,
                    unit: from.unit,
                    qty: split.qty,
                    overDelivered: true,
                });
            }
        }
    } catch (err) {
        console.error("recomputeFlagsForLines failed (delivery already deleted)", err);
    }
}
