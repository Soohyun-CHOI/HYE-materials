"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { base, TABLES, getLinkedRecords } from "@/lib/airtable/client";
import {
    getInvoiceById,
    getInvoiceByRecordId,
    updateInvoice,
} from "@/lib/airtable/invoices";
import { getItemsByInvoice, updateInvoiceItem } from "@/lib/airtable/invoiceItems";
import { getPOItemByRecordId, getInvoicedQtyForPOItem } from "@/lib/airtable/poItems";
import { checkHeaderVariance, checkUnitPriceVariance } from "@/lib/variance";

// Server Actions are directly callable regardless of what the page
// rendered, so the Admin check happens here too — same principle as
// createInvoiceAction (issue #16 keeps payment tracking Admin-only,
// matching who already creates/reconciles invoices; viewing this page is
// President-or-Admin, but marking Paid is not).
async function requireAdminOrThrow() {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        throw new Error("Only an Admin can update payment status.");
    }
}

/**
 * Toggles Invoices.Paid(+Date). Checking Paid requires a Date (this is a
 * record of a payment that already happened elsewhere — a paid invoice
 * with no date is a weak record); unchecking always clears Paid Date too,
 * so a stale date never lingers if it's checked again later.
 */
export async function updatePaidAction(prevState, formData) {
    await requireAdminOrThrow();

    const invoiceId = formData.get("invoiceId");
    const paid = formData.get("paid") === "on";
    const paidDate = formData.get("paidDate") || null;

    if (paid && !paidDate) {
        return { error: "Paid Date is required when marking as Paid." };
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) throw new Error("Invoice not found");

    try {
        await updateInvoice(invoice.id, {
            paid,
            paidDate: paid ? paidDate : null,
        });
    } catch (err) {
        console.error("updatePaidAction failed", err);
        return { error: "Something went wrong updating payment status. Please try again." };
    }

    redirect(`/invoices/${invoiceId}?done=paid-updated`);
}

// Issue #117 — edit an invoice's own header fields and its existing line-item
// values (Tier 1: no adding/removing lines and no PO/PO Item relink, so the
// Invoice-PO Link join set never changes). Admin-only, re-checked here since
// Server Actions are directly callable. Amount Due is an editable human entry
// (a mistyped vendor total is correctable) — "never overwritten" means the
// backend never auto-derives it, and any money change here recomputes the
// Variance Flag below.
export async function updateInvoiceAction(prevState, formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) return { error: "Not authorized." };

    const invoiceId = formData.get("invoiceId");
    const vendorId = formData.get("vendorId");
    const vendorInvoiceCode = formData.get("vendorInvoiceCode") || "";
    const issueDate = formData.get("issueDate");
    const dueDate = formData.get("dueDate") || null;
    const amountDue = formData.get("amountDue");
    const shippingFee = formData.get("shippingFee") || 0;
    const tariff = formData.get("tariff");
    const items = JSON.parse(formData.get("itemsJson") || "[]");

    if (!vendorId) return { error: "Select a Vendor." };
    if (!issueDate) return { error: "Issue Date is required." };
    if (!amountDue) return { error: "Amount Due is required." };
    for (const item of items) {
        if (!item.itemName || !item.qty || !item.unitPrice) {
            return { error: "Every item needs a name, quantity, and unit price." };
        }
    }

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return { error: "Invoice not found." };

    try {
        await updateInvoice(invoice.id, {
            vendorId,
            vendorInvoiceCode,
            issueDate,
            dueDate,
            amountDue: parseFloat(amountDue),
            shippingFee: parseFloat(shippingFee) || 0,
            tariff: tariff ? parseFloat(tariff) : null,
        });

        // Apply line-value edits, but only to items that actually belong to
        // this invoice — a submitted id for some other invoice's item (or a
        // forged one) is ignored, never blindly written.
        const existing = await getItemsByInvoice(invoice.id);
        const ownIds = new Set(existing.map((i) => i.id));
        for (const item of items) {
            if (!ownIds.has(item.id)) continue;
            await updateInvoiceItem(item.id, {
                itemName: item.itemName,
                qty: parseFloat(item.qty),
                unitPrice: parseFloat(item.unitPrice),
                remark: item.remark || "",
            });
        }

        // Recompute variance AFTER the edits land (set AND clear, unlike
        // creation which only sets): a correction can remove a variance, so a
        // stale flag must be cleared. Per-line uses the fresh Unit Price and
        // the cumulative invoiced Qty (this invoice's new Qty already
        // included); free-text lines have no PO Item to compare, so clear.
        const itemsAfter = await getItemsByInvoice(invoice.id);
        for (const line of itemsAfter) {
            const poItemRecordId = line.poItem?.[0];
            let flag = false;
            if (poItemRecordId) {
                const poItem = await getPOItemByRecordId(poItemRecordId);
                const unitPriceVariance = checkUnitPriceVariance(line.unitPrice, poItem.unitPrice);
                const invoicedQty = await getInvoicedQtyForPOItem(poItemRecordId);
                flag = unitPriceVariance || invoicedQty > poItem.qty;
            }
            if (line.varianceFlag !== flag) {
                await updateInvoiceItem(line.id, { varianceFlag: flag });
            }
        }

        // Header check needs Calculated Total's rollup (Items Subtotal +
        // Shipping + Tariff) to have caught up, so re-read fresh.
        const invoiceAfter = await getInvoiceByRecordId(invoice.id);
        const headerFlag = checkHeaderVariance(
            invoiceAfter.amountDue,
            invoiceAfter.calculatedTotal || 0
        );
        if (invoiceAfter.varianceFlag !== headerFlag) {
            await updateInvoice(invoice.id, { varianceFlag: headerFlag });
        }
    } catch (err) {
        // No cross-table transaction: a mid-failure may leave some fields
        // updated and others not, but the invoice stays structurally valid
        // (no orphaned/duplicated children — this only writes existing
        // records) and a re-submit reconciles it. The final variance pass
        // above keeps the flag consistent with whatever landed on success.
        console.error("updateInvoiceAction failed", err);
        return { error: "Something went wrong updating the invoice. Please try again." };
    }

    redirect(`/invoices/${invoiceId}?done=updated`);
}

// Issue #117 — delete an invoice and its children. Admin-only, re-checked
// here. Removes the Invoice Items and the Invoice-PO Link join rows, then the
// Invoice. The linked POs and their PO Items are never touched: deleting an
// Invoice Item / join row only detaches this invoice via reverse-links, so
// partial-invoicing tracking on the PO side stays intact. Children and join
// rows go first so a mid-failure can only leave harmless orphan rows, never a
// corrupted PO. Vercel Blob originals of the attached file are intentionally
// left (separate file-lifecycle work).
export async function deleteInvoiceAction(invoiceId) {
    const { authorized } = await requireAdmin();
    if (!authorized) return { error: "Only an Admin can delete invoices." };

    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) return { error: "That invoice no longer exists." };

    try {
        const [items, links] = await Promise.all([
            getLinkedRecords(TABLES.INVOICES, invoice.id, "Invoice Items", TABLES.INVOICE_ITEMS),
            getLinkedRecords(TABLES.INVOICES, invoice.id, "Invoice-PO Link", TABLES.INVOICE_PO_LINK),
        ]);
        await Promise.allSettled([
            ...items.map((r) => base(TABLES.INVOICE_ITEMS).destroy(r.id)),
            ...links.map((r) => base(TABLES.INVOICE_PO_LINK).destroy(r.id)),
        ]);
        await base(TABLES.INVOICES).destroy(invoice.id);
    } catch (err) {
        console.error("deleteInvoiceAction failed", err);
        return { error: "Couldn't delete the invoice. Please try again." };
    }

    redirect("/invoices");
}
