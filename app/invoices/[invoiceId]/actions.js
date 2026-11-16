"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, withAdminAction } from "@/lib/authz";
import { base, TABLES, getLinkedRecords } from "@/lib/airtable/client";
import { getInvoiceById, updateInvoice } from "@/lib/airtable/invoices";
import { createInvoiceItem, getItemsByInvoice, updateInvoiceItem } from "@/lib/airtable/invoiceItems";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { editableShares, invoicePositions, planShareEdits } from "@/lib/invoiceSpread";
import { getSpreadOrderedItems } from "@/lib/invoiceSpread.server";
import { destroyInvoiceVarianceLogEntries } from "@/lib/airtable/invoiceVarianceLog";
import {
    ACCEPTANCE_COPY,
    ITEM_PRECISION_COPY,
    headerPrecisionRefusal,
    isVarianceKind,
    isWholeCentPrice,
    isWholeQty,
} from "@/lib/variance";
import { acceptVariance, judgeInvoiceAgain, recordInvoiceItemsRemoved } from "@/lib/variance.server";
import { ITEMS_MISSING_COPY, invoiceItemsMissing } from "@/lib/invoiceItemsMissing";
import { withOpsLabel } from "@/lib/airtableOps";

// Server Actions are directly callable regardless of what the page
// rendered, so the Admin check happens here too — same principle as
// createInvoiceAction (issue #16 keeps payment tracking Admin-only,
// matching who already creates/reconciles invoices; viewing this page is
// President-or-Admin, but marking Paid is not).
//
// Issue #147 — this file had already grown its own local requireAdminOrThrow
// wrapper for exactly the reason #147 generalises: the flag was too easy to
// drop. That local one is gone in favor of the shared withAdminAction, which
// keeps its wording and its throw.

/**
 * Toggles Invoices.Paid(+Date). Checking Paid requires a Date (this is a
 * record of a payment that already happened elsewhere — a paid invoice
 * with no date is a weak record); unchecking always clears Paid Date too,
 * so a stale date never lingers if it's checked again later.
 */
// Issue #185 — RETURNED, for the reason the two below already were:
// `PaymentSection.js` binds this through `useActionState`, so the refusal reaches
// `state.error` and the section's own red box shows it. The box is not new and not
// theoretical — it was where `Paid Date is required when marking as Paid.` landed,
// which was one of the two refusals on this screen a reader could produce. **#318
// renamed that file with its shape, moved the box inside the control, and removed that
// refusal with the checkbox that made it possible**: the form renders only once an
// Admin has opened it, so the box arrives where the reader who submitted is looking,
// and what can now arrive in it is the authorization refusal or an Airtable failure.
export const updatePaidAction = withAdminAction(
    () => ({ error: "Only an Admin can update payment status." }),
    updatePaidHandler
);

async function updatePaidHandler(prevState, formData) {
    return withOpsLabel("updatePaidAction", async () => {
        const invoiceId = formData.get("invoiceId");
        // #318 — ONE FIELD ARRIVES AND THERE IS NOTHING LEFT TO REFUSE. The form sent
        // `paid` and `paidDate`, and this refused the one combination it could see —
        // ticked with no date — while the reverse, a date on an invoice the box called
        // unpaid, was written without complaint. `Invoices."Paid"` is gone: a date IS
        // the payment, so an empty one is a value rather than a gap and records that
        // the invoice is not paid. `Paid Date is required when marking as Paid.` went
        // with the state it described.
        const paidDate = formData.get("paidDate") || null;

        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) throw new Error("Invoice not found");

        try {
            await updateInvoice(invoice.id, { paidDate });
        } catch (err) {
            console.error("updatePaidAction failed", err);
            return { error: "Something went wrong updating payment status. Please try again." };
        }

        redirect(`/invoices/${invoiceId}`);
    });
}

// Issue #117 — edit an invoice's own header fields and its existing invoice-item
// values (Tier 1: no adding/removing invoice items and no PO/PO Item relink, so the
// orders an invoice charges never change). Admin-only, re-checked here since
// Server Actions are directly callable. Invoice Total is an editable human entry
// (a mistyped vendor total is correctable) — "never overwritten" means the
// backend never auto-derives it, and any money change here recomputes the
// two variance flags below.
export const updateInvoiceAction = withAdminAction(
    () => ({ error: "Not authorized." }),
    updateInvoiceHandler
);

async function updateInvoiceHandler(prevState, formData) {
    return withOpsLabel("updateInvoiceAction", async () => {
        const invoiceId = formData.get("invoiceId");
        const vendorId = formData.get("vendorId");
        const vendorInvoiceCode = formData.get("vendorInvoiceCode") || "";
        const issueDate = formData.get("issueDate");
        const dueDate = formData.get("dueDate") || null;
        const invoiceTotal = formData.get("invoiceTotal");
        const shippingFee = formData.get("shippingFee") || 0;
        const tariff = formData.get("tariff");
        const salesTax = formData.get("salesTax");
        const items = JSON.parse(formData.get("itemsJson") || "[]");

        if (!vendorId) return { error: "Select a Vendor." };
        if (!issueDate) return { error: "Issue Date is required." };
        if (!invoiceTotal) return { error: "Invoice Total is required." };
        // Issue #405 — the same four figures as `createInvoiceAction`'s, and this
        // screen is the one that can refuse over a box nobody touched: every save
        // from here sends all four, so an invoice carrying an off-cent `Tariff` is
        // refused on an edit that only changed the vendor. That is deliberate and it
        // is why the sentence names the figure — the control holding the bad value is
        // on this screen, filled in, a few rows above the button. The controls' own
        // `step="0.01"` does NOT do this job and on this record it does the opposite:
        // with no `min` the browser's step base is the value the record loaded with,
        // so an invoice storing `1.005` has a control that accepts `1.005` and rejects
        // every whole-cent repair of it (measured; this screen's brief carries it).
        // The alternative, checking only what changed, would need a before-and-after
        // this action does not have and would let a save write the header while
        // leaving a term of the total off the cent.
        const headerRefusal = headerPrecisionRefusal({
            shippingFee: parseFloat(shippingFee),
            tariff: tariff ? parseFloat(tariff) : null,
            salesTax: salesTax ? parseFloat(salesTax) : null,
            invoiceTotal: parseFloat(invoiceTotal),
        });
        if (headerRefusal) return { error: headerRefusal };
        // #660 — AN ITEM IS THE VENDOR'S, WITH A QUANTITY PER ORDER WHERE IT TAKES ONE. A share's
        // quantity left blank is nothing, which removes it; what an item adds up to is checked
        // below, once what it stands on is read.
        for (const item of items) {
            if (!item.itemName || !item.unitPrice) {
                return { error: "Every item needs a name, quantity, and unit price." };
            }
            // Issue #254 — the same refusal as `createInvoiceAction`'s, and this
            // screen needs it more: both figures are freely editable here, where the
            // create form at least freezes the price to the ordered item.
            for (const share of item.shares || []) {
                const qty = share.qty === "" || share.qty == null ? 0 : parseFloat(share.qty);
                if (!isWholeQty(qty)) return { error: ITEM_PRECISION_COPY.qty };
            }
            if (!isWholeCentPrice(parseFloat(item.unitPrice))) {
                return { error: ITEM_PRECISION_COPY.unitPrice };
            }
        }

        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) return { error: "Invoice not found." };
        // #330 — THE ROWS THIS SAVE IS ABOUT TO WRITE AGAINST, COUNTED BEFORE ANY
        // WRITE. `updateInvoice` below is the first one and it lands on the header,
        // so a refusal read any later would already have changed the record it was
        // refusing to touch. The count costs NOTHING: `recordToInvoice` carries the
        // `Invoice Items` reverse-link, so it is on the record the line above just
        // loaded — the `getItemsByInvoice` call further down is for the item edits'
        // plan, not for this.
        //
        // A DIFFERENT FACT FROM `createInvoiceAction`'s, AND THEREFORE A DIFFERENT
        // SENTENCE. That one refuses a SUBMISSION with no rows and says
        // `Add at least one item.`, which is true on a form that can add one; this
        // refuses a RECORD with none, on a screen where adding is out of scope
        // (#117) and the answer is to delete and re-enter. Its words are the
        // detail screen's, because those two say the same thing.
        if (invoiceItemsMissing(invoice)) return { error: ITEMS_MISSING_COPY.absent };
        // #648 — whose edit this is, for the `Invoice Variance Log` row an edit writes when it moves
        // a figure an acceptance stands on. The gate above is the wrapper's; this reads the
        // person, as `createInvoiceAction` reads the recorder.
        const user = await requireUser();

        // #660 — WHAT EACH ITEM STANDS ON, READ BEFORE ANY WRITE, and the writes planned from
        // it: the invoice's items off the ids it carries, its orders, and their ordered items,
        // so a quantity per order can only land on an ordered item of the item's own material
        // at its own ordered price on one of this invoice's orders (`editableShares`). An item
        // the form sent that is not one of this invoice's is ignored, never written — the rule
        // this action always had for a row. An item left adding up to nothing is refused here,
        // before the header is touched.
        const existing = await getItemsByInvoice(invoice.id, { rowIds: invoice.invoiceItems || [] });
        const poRecordIds = [...new Set(existing.map((it) => it.po?.[0]).filter(Boolean))];
        const orders = await Promise.all(poRecordIds.map((id) => getPOByRecordId(id)));
        const orderedItems = await getSpreadOrderedItems(orders);
        const orderedItemById = new Map(orderedItems.map((o) => [o.id, o]));
        const thisInvoiceOn = new Map();
        for (const it of existing) {
            const id = it.poItem?.[0];
            if (id) thisInvoiceOn.set(id, (thisInvoiceOn.get(id) || 0) + (it.qty || 0));
        }
        const positions = new Map(invoicePositions({ items: existing, orderedItemById }).map((p) => [p.key, p]));
        const nextPosition =
            Math.max(0, ...existing.map((it) => (typeof it.position === "number" ? it.position : 0))) + 1;
        const plans = [];
        for (const item of items) {
            const position = positions.get(item.key);
            if (!position) continue;
            const candidates = editableShares({ position, orderedItems, thisInvoiceOn }).map((e) => e.orderedItem.id);
            const plan = planShareEdits({
                existing: position.shares.map((s) => ({ id: s.id, orderedItemId: s.orderedItem?.id ?? null, qty: s.qty })),
                candidates,
                submitted: item.shares,
            });
            if (plan.total <= 0) return { error: "Every item needs a name, quantity, and unit price." };
            // A row made by hand holds no `Position`; a share added beside it takes a number,
            // and so does the row, or the two would read back as two items.
            const number = position.position ?? (plan.creates.length > 0 ? nextPosition + plans.length : null);
            plans.push({ item, position, plan, number });
        }

        try {
            await updateInvoice(invoice.id, {
                vendorId,
                vendorInvoiceCode,
                issueDate,
                dueDate,
                invoiceTotal: parseFloat(invoiceTotal),
                shippingFee: parseFloat(shippingFee) || 0,
                tariff: tariff ? parseFloat(tariff) : null,
                // Issue #283 — Tariff's coercion; see createInvoiceHandler for why
                // it is copied rather than improved on one of the two terms.
                salesTax: salesTax ? parseFloat(salesTax) : null,
            });

            // Apply each item's edits to its own invoice items: every share it keeps takes the
            // item's name, unit price and remark with its own quantity; a share it gains is made
            // on that ordered item with the ordered item's frozen size, maker and unit (#84); a
            // share it loses goes, its variances' record ended first and kept.
            for (const { item, position, plan, number } of plans) {
                const unitPrice = parseFloat(item.unitPrice);
                const remark = item.remark || "";
                for (const update of plan.updates) {
                    await updateInvoiceItem(update.id, {
                        itemName: item.itemName,
                        qty: update.qty,
                        unitPrice,
                        remark,
                        ...(position.position == null && number != null ? { position: number } : {}),
                    });
                }
                for (const create of plan.creates) {
                    const orderedItem = orderedItemById.get(create.orderedItemId);
                    await createInvoiceItem({
                        invoiceRecordId: invoice.id,
                        invoiceId: invoice.invoiceId,
                        poRecordId: orderedItem.poRecordId,
                        poItemRecordId: orderedItem.id,
                        itemName: item.itemName,
                        size: orderedItem.size,
                        maker: orderedItem.maker,
                        unit: orderedItem.unit,
                        qty: create.qty,
                        unitPrice,
                        remark,
                        position: number,
                    });
                }
                if (plan.removes.length > 0) {
                    // #660 — THE INVOICE STANDS, SO WHAT WAS DECIDED ABOUT THE ITEM STANDS: each
                    // variance the log follows on it ends in a `Cleared` row before it goes, and
                    // its rows stay, their `Invoice Item` link emptied by the destroy.
                    await recordInvoiceItemsRemoved({
                        invoice,
                        items: existing.filter((it) => plan.removes.includes(it.id)),
                        orderedItemById,
                        recordedByUserId: user.id,
                    });
                    for (const id of plan.removes) await base(TABLES.INVOICE_ITEMS).destroy([id]);
                }
            }

            // Judge every variance again AFTER the edits land (set AND clear, unlike
            // creation which only sets): a correction can remove a variance, so a
            // stale flag must be cleared — each item's against the fresh Unit Price and
            // the cumulative invoiced Qty (this invoice's new Qty already included),
            // then the totals against a fresh Calculated Total, whose rollup the edits
            // have just moved. An item whose ordered-item link a hand edit emptied has
            // nothing to be compared against, and its flags clear. #648 — and an
            // acceptance whose two figures this edit moved ends in the same pass:
            // `Reopened` while its variance still stands, `Cleared` once it does not,
            // with this Admin as the one whose edit it was. One function, shared with an
            // overage correction's split, since both writes can move a figure an
            // acceptance stands on (lib/variance.server.js).
            await judgeInvoiceAgain({ invoiceRecordId: invoice.id, recordedByUserId: user.id });
        } catch (err) {
            // No cross-table transaction: a mid-failure may leave some fields
            // updated and others not. Since #660 a save also makes and removes
            // invoice items, so a failure can leave an item with a share made and
            // another not yet moved; every row it leaves names an ordered item of
            // the item's own choice, so the invoice reads as one quantity per order
            // the office can see and correct, and a re-submit of the same form
            // plans against what landed. The final variance pass above keeps the
            // flags consistent with whatever landed on success.
            console.error("updateInvoiceAction failed", err);
            return { error: "Something went wrong updating the invoice. Please try again." };
        }

        redirect(`/invoices/${invoiceId}`);
    });
}

// Issue #117 — delete an invoice and its children. Admin-only, re-checked
// here. Removes the Invoice Items and, since #648, its `Invoice Variance Log` rows, then the
// Invoice. The linked POs and their
// PO Items are never touched: deleting an Invoice Item only detaches this
// invoice via reverse-links, so partial-invoicing tracking on the PO side stays
// intact. Children go first so a mid-failure can only leave harmless orphan
// rows, never a corrupted PO. There is no Vercel Blob original of the attached
// file to delete: `createInvoiceAction` removes it once Airtable has ingested
// the file (#140).
export const deleteInvoiceAction = withAdminAction(
    () => ({ error: "Only an Admin can delete invoices." }),
    deleteInvoiceHandler
);

async function deleteInvoiceHandler(invoiceId) {
    return withOpsLabel("deleteInvoiceAction", async () => {
        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) return { error: "That invoice no longer exists." };

        try {
            const items = await getLinkedRecords(
                TABLES.INVOICES,
                invoice.id,
                "Invoice Items",
                TABLES.INVOICE_ITEMS
            );
            await Promise.allSettled(items.map((r) => base(TABLES.INVOICE_ITEMS).destroy([r.id])));
            // #648 — the log is the invoice's child as its items are, so it goes with them
            // rather than staying behind naming an invoice that is gone.
            await destroyInvoiceVarianceLogEntries(invoice.invoiceVarianceLog);
            await base(TABLES.INVOICES).destroy([invoice.id]);
        } catch (err) {
            console.error("deleteInvoiceAction failed", err);
            return { error: "Couldn't delete the invoice. Please try again." };
        }

        redirect("/invoices");
    });
}

// Issue #648 — accept one kind of variance on an invoice, with a reason. Admin-only,
// re-checked here since Server Actions are directly callable: accepting is invoicing,
// which is the office's (CLAUDE.md's role convention), and the control renders only
// where `user.isAdmin` is — #185's pair, held by `offline/variance-acceptance.mjs`.
//
// RETURNED, NOT THROWN (#185): `VarianceAcceptance.js` binds this through
// `useActionState`, so a refusal reaches the form it came from, beside the badge.
//
// A REFUSAL ABOUT THE PAGE BEING OUT OF DATE REFRESHES AS IT REFUSES (#378). Nothing open
// of that kind to accept means the page was drawn before an edit or another press moved
// it, and the sentence alone would stand beside a badge that is no longer true; the
// refresh redraws the page with it. A typed reason is lost by that redraw only when
// there is nothing left for it to be about.
export const acceptVarianceAction = withAdminAction(
    () => ({ error: "Only an Admin can accept a variance." }),
    acceptVarianceHandler
);

async function acceptVarianceHandler(prevState, formData) {
    return withOpsLabel("acceptVarianceAction", async () => {
        const invoiceId = formData.get("invoiceId");
        const kind = formData.get("kind");
        const itemRecordIds = formData.getAll("invoiceItemId").filter(Boolean);
        const reason = String(formData.get("reason") || "").trim();

        if (!isVarianceKind(kind)) return { error: ACCEPTANCE_COPY.refusals.failed };
        if (!reason) return { error: ACCEPTANCE_COPY.refusals.reason };

        const user = await requireUser();
        let result;
        try {
            result = await acceptVariance({ invoiceId, kind, itemRecordIds, reason, recordedByUserId: user.id });
        } catch (err) {
            console.error("acceptVarianceAction failed", err);
            return { error: ACCEPTANCE_COPY.refusals.failed };
        }
        if (result.stale) {
            refresh();
            return { error: ACCEPTANCE_COPY.refusals.stale };
        }

        redirect(`/invoices/${invoiceId}`);
    });
}
