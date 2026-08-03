// Deleting a recorded delivery (#162) — the whole concern in one module: who
// may, what the three voices of the confirmation say, and the guarded write.
// Same arrangement as lib/poWithdraw.js, and for the same reason: "where does
// the delete rule live" has exactly one answer, so the UI and the server cannot
// drift apart on it.
//
// A REAL DELETE, WITH NO TOMBSTONE, and that follows invoices rather than PRs and
// POs. A withdrawn PR or PO stays on record because an approval chain happened
// and a signature happened — there is history to preserve. A delivery is a claim
// that material arrived; if the claim was wrong there is no history in it, only a
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
import { getItemsByDelivery } from "./airtable/deliveryItems";
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
 * the record is office work, and the office is who reconciles what arrived
 * against what was billed. Deliberately NOT "anyone on the Job", even though
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
 * cannot quietly leave the others describing different behaviour.
 *
 * They exist because deletion here is NOT an unusual act to be discouraged: it is
 * the only correction mechanism there is, so a recorder fixing a typo on a paid
 * line is doing the expected thing. What the copy owes them is not a warning but
 * an accurate account of what becomes inconsistent in the meantime.
 *
 * Take the delivery id and the affected line count, because a confirmation must
 * name what it is acting on. Resolve on the server and pass plain strings to the
 * client component — functions cannot cross that boundary.
 */
export const DELETE_COPY = {
    plain: {
        title: "Delete this delivery?",
        body: (deliveryId, lineCount) =>
            `${deliveryId} and its packing list photo are removed for good, and the ${lineCount} purchase order ` +
            `${lineCount === 1 ? "line" : "lines"} it was recorded against ${lineCount === 1 ? "goes" : "go"} ` +
            `back to showing nothing delivered. Enter it again if you are correcting it. This cannot be undone.`,
    },
    invoiced: {
        title: "Delete this delivery?",
        body: (deliveryId, lineCount) =>
            `${deliveryId} and its packing list photo are removed for good. The invoice against ` +
            `${lineCount === 1 ? "this line" : "these lines"} is not changed — deleting this only removes the ` +
            `record that the material arrived, so until you enter it again ${lineCount === 1 ? "that line" : "those lines"} ` +
            `will read as invoiced with nothing delivered. This cannot be undone.`,
    },
    paid: {
        title: "Delete this delivery?",
        body: (deliveryId, lineCount) =>
            `${deliveryId} and its packing list photo are removed for good. ${lineCount === 1 ? "This line is" : "These lines are"} ` +
            `on an invoice that has already been paid; deleting the arrival record changes neither the invoice nor the ` +
            `payment, it removes the evidence the material came in. If you are correcting a mistake, enter the ` +
            `delivery again straight away. This cannot be undone.`,
    },
};

/**
 * Which voice, and why it is worth two extra reads.
 *
 * `paid` beats `invoiced` beats `plain`, checked in that order because the
 * strongest true statement is the one to make. Payment is checked through the
 * INVOICE rather than the line, because `Paid` lives on `Invoices` — a line is
 * never "paid" by itself.
 *
 * Escalates lazily: the invoiced check is one `Invoiced Qty` read per affected
 * line, and the invoices behind those lines are only fetched once a line turns
 * out to be invoiced. So an ordinary delivery pays for the cheap question alone,
 * and the extra cost lands exactly where the warning actually differs.
 *
 * A read failure resolves to `plain` rather than throwing. The alternative is
 * refusing to show a confirmation at all, which would block the only correction
 * path over a warning — and the write itself does not depend on this answer.
 * An unattributable over-delivery row contributes no PO Item, so it cannot make
 * a delivery look invoiced, which is correct: it is against no order.
 */
export async function resolveDeleteCopy(delivery, items) {
    const poItemIds = [...new Set((items || []).map((i) => i.poItem?.[0]).filter(Boolean))];
    const lineCount = poItemIds.length;

    let voice = "plain";
    try {
        const invoicedQtys = await Promise.all(poItemIds.map((id) => getInvoicedQtyForPOItem(id)));
        const invoicedPoItemIds = poItemIds.filter((_, i) => (invoicedQtys[i] || 0) > 0);

        if (invoicedPoItemIds.length > 0) {
            voice = "invoiced";
            const invoiceLines = (
                await Promise.all(invoicedPoItemIds.map((id) => getItemsByPOItem(id)))
            ).flat();
            const invoiceIds = [...new Set(invoiceLines.flatMap((line) => line.invoice || []))];
            const invoices = await Promise.all(
                invoiceIds.map((id) => getInvoiceByRecordId(id).catch(() => null))
            );
            if (invoices.some((inv) => inv?.paid)) voice = "paid";
        }
    } catch (err) {
        console.error("resolveDeleteCopy could not resolve invoice state, falling back to plain", err);
    }

    const copy = DELETE_COPY[voice];
    return { voice, lineCount, title: copy.title, body: copy.body(delivery.deliveryId, lineCount) };
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
 * records of the same shipment, so what was billed and whether it was paid are
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

    try {
        const items = await getItemsByDelivery(delivery.id);
        await Promise.allSettled(
            items.map((item) => base(TABLES.DELIVERY_ITEMS).destroy(item.id))
        );
        await base(TABLES.DELIVERIES).destroy(delivery.id);
    } catch (err) {
        console.error("deleteDeliveryAsUser failed", err);
        return { error: "Something went wrong deleting this delivery. Please try again." };
    }

    return { ok: true, deliveryId: delivery.deliveryId, jobRecordId: delivery.job?.[0] ?? null };
}
