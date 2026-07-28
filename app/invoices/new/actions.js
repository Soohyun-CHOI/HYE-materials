"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { base, TABLES } from "@/lib/airtable/client";
import { createInvoice, linkInvoiceToPO, getInvoiceByRecordId, updateInvoice } from "@/lib/airtable/invoices";
import { createInvoiceItem, updateInvoiceItem } from "@/lib/airtable/invoiceItems";
import { getPOItemByRecordId, getInvoicedQtyForPOItem } from "@/lib/airtable/poItems";
import { getPOByRecordId } from "@/lib/airtable/purchaseOrders";
import { confirmIngestThenDelete } from "@/lib/blobIngest";
import { isPOWithdrawn } from "@/lib/poWithdraw";
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

    // Issue #138 — the inverse of the withdraw predicate's no-linked-invoice
    // condition, and the reason that condition can be trusted: a withdrawn
    // PO will never receive an invoice, so linking one is refused here.
    // Deliberately only the status check, NOT getPOWithdrawEligibility() —
    // that predicate would also reject a second invoice against a partly
    // invoiced PO, which is routine. The two rules share the status name, not
    // the rule: being un-withdrawable doesn't make a PO un-invoiceable.
    //
    // Placed before the first write, not inside the try below: a refusal
    // must create nothing at all rather than lean on the rollback path.
    // Withdrawn POs are already absent from the picker and from PO detection
    // (getAllPOs/searchPOs, /api/invoices/detect-po), but a Server Action is
    // directly callable, and a PO can be withdrawn while this form sits open.
    const distinctPoIds = [...new Set(items.map((item) => item.poRecordId))];
    let linkedPos;
    try {
        linkedPos = await Promise.all(distinctPoIds.map((id) => getPOByRecordId(id)));
    } catch (err) {
        // .find() throws on an id that doesn't resolve. Before this guard
        // existed such an id failed later, inside the rollback-protected
        // block; now it's read up front, so it needs its own clean refusal
        // rather than surfacing as an unhandled action error.
        console.error("createInvoiceAction couldn't resolve a submitted PO", err);
        return { error: "One of the selected POs no longer exists. Reload the form and try again." };
    }
    const withdrawnPos = linkedPos.filter((po) => isPOWithdrawn(po));
    if (withdrawnPos.length > 0) {
        const ids = withdrawnPos.map((po) => po.poId).join(", ");
        return {
            error:
                withdrawnPos.length === 1
                    ? `${ids} was withdrawn, so an invoice can't be linked to it.`
                    : `${ids} were withdrawn, so an invoice can't be linked to them.`,
        };
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
        // Same distinctPoIds the withdrawn-PO guard above checked, so every
        // PO about to be joined here was verified invoiceable.
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

    // Issue #140 — every write above succeeded, so the uploaded object has
    // served its purpose: Airtable holds the invoice file now. Deliberately
    // outside the try above — a rollback must leave the object alive, because
    // the Requester's retry re-submits this same URL from the still-open
    // form. /api/invoices/detect-po already read it (at upload time, long
    // before this point), so nothing else needs it either.
    //
    // Scheduled with after() (see app/prs/new/actions.js) so the Admin isn't
    // held for it, and so the cleanup no longer depends on sitting above the
    // redirect() below.
    after(() =>
        confirmIngestThenDelete([
            {
                table: TABLES.INVOICES,
                recordId: invoice.id,
                field: "File",
                blobUrl: invoiceFileUrl,
                attachmentId: invoice.file?.[0]?.id,
                label: `invoice file ${invoice.invoiceId}`,
            },
        ])
    );

    // Issue #115 — land on the new invoice's detail page (was the
    // new-invoice page, a known follow-up), so the full record is shown
    // straight after creation.
    redirect(`/invoices/${encodeURIComponent(invoice.invoiceId)}?done=created`);
}
