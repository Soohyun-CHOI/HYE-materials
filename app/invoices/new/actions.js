"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createInvoice, linkInvoiceToPO, getInvoiceByRecordId, updateInvoice } from "@/lib/airtable/invoices";
import { createInvoiceItem, updateInvoiceItem } from "@/lib/airtable/invoiceItems";
import { getPOItemByRecordId, getInvoicedQtyForPOItem } from "@/lib/airtable/poItems";
import { checkHeaderVariance, checkUnitPriceVariance } from "@/lib/variance";

// Server Actions are directly callable regardless of what the page
// rendered, so the Admin check happens here too, not just in the page
// component — same principle as every other admin form in this project.
export async function createInvoiceAction(prevState, formData) {
    const { authorized } = await requireAdmin();
    if (!authorized) {
        return { error: "Not authorized." };
    }

    const vendorId = formData.get("vendorId");
    const vendorInvoiceCode = formData.get("vendorInvoiceCode") || "";
    const issueDate = formData.get("issueDate");
    const dueDate = formData.get("dueDate") || null;
    const amountDue = formData.get("amountDue");
    const shippingFee = formData.get("shippingFee") || 0;
    const tariff = formData.get("tariff"); // issue #57 — optional, only present once the header's "+ Add Tariff" was used
    const items = JSON.parse(formData.get("itemsJson") || "[]");
    const invoiceFileUrl = formData.get("invoiceFileUrl");
    const invoiceFileFilename = formData.get("invoiceFileFilename");

    if (!vendorId) return { error: "Select a Vendor." };
    if (!issueDate) return { error: "Issue Date is required." };
    if (!amountDue) return { error: "Amount Due is required." };
    // Required, unlike Quotations (#34) — every received vendor invoice
    // must be kept on file. The submit button is already disabled client-
    // side until the upload finishes, but Server Actions are callable
    // directly regardless of what the page rendered, so this is re-checked
    // here too.
    if (!invoiceFileUrl) return { error: "Attach the invoice file." };
    if (items.length === 0) return { error: "Add at least one item." };
    for (const item of items) {
        if (!item.itemName || !item.qty || !item.unitPrice) {
            return { error: "Every item needs a name, quantity, and unit price." };
        }
        if (!item.poRecordId) {
            return { error: "Every item needs a PO — pick one at the top or per-line." };
        }
    }

    let invoice;
    const createdItemIds = [];
    const createdLinkIds = [];

    try {
        // The file is written as part of this same create() call, not a
        // separate record the way Quotations are (#34's Quotation record
        // is its own table row) — so there's no intermediate state where
        // the Invoice exists but the file doesn't; either this single
        // write succeeds with both, or it fails and nothing was created at
        // all (the catch block below has nothing to roll back in that case).
        invoice = await createInvoice({
            vendorId,
            vendorInvoiceCode,
            issueDate,
            dueDate,
            amountDue: parseFloat(amountDue),
            shippingFee: parseFloat(shippingFee) || 0,
            tariff: tariff ? parseFloat(tariff) : null,
            file: [{ url: invoiceFileUrl, filename: invoiceFileFilename || undefined }],
        });

        const createdItems = [];
        for (const item of items) {
            const created = await createInvoiceItem({
                invoiceRecordId: invoice.id,
                invoiceId: invoice.invoiceId,
                poRecordId: item.poRecordId,
                poItemRecordId: item.poItemRecordId || null,
                itemName: item.itemName,
                size: item.size,
                unit: item.unit,
                qty: parseFloat(item.qty),
                unitPrice: parseFloat(item.unitPrice),
                remark: item.remark || "",
            });
            createdItemIds.push(created.id);
            createdItems.push(created);
        }

        // One Invoice-PO Link row per distinct PO actually used across the
        // items, not one per item — a PO referenced by three lines still
        // only needs a single join row (see CLAUDE.md's Invoice-PO Link
        // entry: it's a plain relationship table, no per-line semantics).
        const distinctPoIds = [...new Set(items.map((item) => item.poRecordId))];
        for (const poId of distinctPoIds) {
            const link = await linkInvoiceToPO(invoice.id, poId);
            createdLinkIds.push(link.id);
        }

        // Variance checking (#15), per the tolerance rules decided in #17.
        // Line-level checks only apply to items linked to a real PO Item —
        // free-text "Other" lines have nothing to compare against. Qty is a
        // creation-time snapshot: it reads the cumulative invoiced Qty
        // (already including this line, since it's linked by now) and is
        // never retroactively recomputed for sibling Invoice Items created
        // earlier against the same PO Item.
        for (const created of createdItems) {
            const poItemRecordId = created.poItem?.[0];
            if (!poItemRecordId) continue;

            const poItem = await getPOItemByRecordId(poItemRecordId);
            const unitPriceVariance = checkUnitPriceVariance(created.unitPrice, poItem.unitPrice);
            const invoicedQty = await getInvoicedQtyForPOItem(poItemRecordId);
            const qtyVariance = invoicedQty > poItem.qty;

            if (unitPriceVariance || qtyVariance) {
                await updateInvoiceItem(created.id, { varianceFlag: true });
            }
        }

        // Header-level check needs Calculated Total's rollup (Items
        // Subtotal -> Calculated Total) to have caught up, so it's read
        // back fresh rather than trusted from the pre-Items `invoice`.
        const invoiceAfterItems = await getInvoiceByRecordId(invoice.id);
        if (checkHeaderVariance(invoiceAfterItems.amountDue, invoiceAfterItems.calculatedTotal || 0)) {
            await updateInvoice(invoice.id, { varianceFlag: true });
        }
    } catch (err) {
        // Same create-then-delete rollback pattern as #5/#10: Airtable has
        // no cross-table transactions, so a failure partway through would
        // otherwise leave a half-built Invoice behind. Reverse creation
        // order — Links, then Items, then the Invoice itself.
        if (invoice) {
            await Promise.allSettled([
                ...createdLinkIds.map((id) => base(TABLES.INVOICE_PO_LINK).destroy(id)),
                ...createdItemIds.map((id) => base(TABLES.INVOICE_ITEMS).destroy(id)),
            ]);
            await base(TABLES.INVOICES).destroy(invoice.id).catch(() => {});
        }

        console.error("createInvoiceAction failed, rolled back", err);
        return { error: "Something went wrong creating the invoice. Please try again." };
    }

    // Issue #115 — land on the new invoice's detail page (was the
    // new-invoice page, a known follow-up), so the full record is shown
    // straight after creation.
    redirect(`/invoices/${encodeURIComponent(invoice.invoiceId)}?done=created`);
}
