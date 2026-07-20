// Ad hoc verification for issue #15 (variance checking) — exercises the
// same service-layer calls createInvoiceAction makes, against a real,
// currently-un-invoiced PO Item (recffjh8PlB8SQfXk, "heyy", Qty 12, Unit
// Price 132 on PO HYE-PO-20260716-07 / Demo Vendor Co.), deliberately with
// values chosen to trip every variance check at once. Cleans up every
// record it creates.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-variance-15.mjs

import { base, TABLES } from "../../lib/airtable/client.js";
import { createInvoice, linkInvoiceToPO, getInvoiceByRecordId, updateInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, updateInvoiceItem, getItemsByPOItem } from "../../lib/airtable/invoiceItems.js";
import { getPOItemByRecordId, getInvoicedQtyForPOItem } from "../../lib/airtable/poItems.js";
import { checkHeaderVariance, checkUnitPriceVariance } from "../../lib/variance.js";

const VENDOR_RECORD_ID = "rec5jSDWMNlyIbZDK"; // Demo Vendor Co.
const PO_RECORD_ID = "rec5X300LEYkNrqe9"; // HYE-PO-20260716-07
const PO_ITEM_RECORD_ID = "recffjh8PlB8SQfXk"; // "heyy", Qty 12, Unit Price 132, currently un-invoiced

let invoice;
let createdItemId;
let createdLinkId;

try {
    invoice = await createInvoice({
        vendorId: VENDOR_RECORD_ID,
        vendorInvoiceCode: "VARIANCE-TEST-15",
        issueDate: "2026-07-20",
        dueDate: null,
        amountDue: 5000, // deliberately far off the ~2250 calculated total
        shippingFee: 0,
        tariff: null,
        file: [{ url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", filename: "test.pdf" }],
    });
    console.log("Created invoice", invoice.invoiceId, invoice.id);

    const created = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: PO_RECORD_ID,
        poItemRecordId: PO_ITEM_RECORD_ID,
        itemName: "heyy",
        size: "",
        unit: "",
        qty: 15, // > PO Item's Qty of 12
        unitPrice: 150, // vs PO Item's 132
        remark: "variance test",
    });
    createdItemId = created.id;
    console.log("Created invoice item", created.invoiceItemId);

    const link = await linkInvoiceToPO(invoice.id, PO_RECORD_ID);
    createdLinkId = link.id;

    // Same sequence as createInvoiceAction.
    const poItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
    const unitPriceVariance = checkUnitPriceVariance(created.unitPrice, poItem.unitPrice);
    const invoicedQty = await getInvoicedQtyForPOItem(PO_ITEM_RECORD_ID);
    const qtyVariance = invoicedQty > poItem.qty;
    console.log({ poItemUnitPrice: poItem.unitPrice, poItemQty: poItem.qty, invoicedQty, unitPriceVariance, qtyVariance });

    if (unitPriceVariance || qtyVariance) {
        await updateInvoiceItem(created.id, { varianceFlag: true });
    }

    const invoiceAfterItems = await getInvoiceByRecordId(invoice.id);
    console.log({ amountDue: invoiceAfterItems.amountDue, calculatedTotal: invoiceAfterItems.calculatedTotal });
    const headerVariance = checkHeaderVariance(invoiceAfterItems.amountDue, invoiceAfterItems.calculatedTotal || 0);
    if (headerVariance) {
        await updateInvoice(invoice.id, { varianceFlag: true });
    }

    // Verify what actually got persisted.
    const finalInvoice = await getInvoiceByRecordId(invoice.id);
    const finalItems = await getItemsByPOItem(PO_ITEM_RECORD_ID);
    const finalItem = finalItems.find((i) => i.id === createdItemId);

    console.log("Invoice Variance Flag:", finalInvoice.varianceFlag, "(expected true)");
    console.log("Invoice Item Variance Flag:", finalItem.varianceFlag, "(expected true)");

    if (finalInvoice.varianceFlag !== true || finalItem.varianceFlag !== true) {
        throw new Error("Variance flags did not persist as expected");
    }
    console.log("PASS");
} finally {
    if (process.env.SKIP_CLEANUP) {
        console.log("SKIP_CLEANUP set — leaving records in place:", { invoiceId: invoice?.id, createdItemId, createdLinkId });
    } else {
        if (createdLinkId) await base(TABLES.INVOICE_PO_LINK).destroy(createdLinkId).catch(() => {});
        if (createdItemId) await base(TABLES.INVOICE_ITEMS).destroy(createdItemId).catch(() => {});
        if (invoice) await base(TABLES.INVOICES).destroy(invoice.id).catch(() => {});
        console.log("Cleaned up test records");
    }
}
