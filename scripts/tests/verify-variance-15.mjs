// ITS EXIT CODE MEANS ONE THING ONLY, AND IT IS NOT A VERDICT ON VARIANCE (#171).
// This script computes no verdict about the thing under test: it prints the
// variance figures it produced for a human to compare, and #152 deliberately left
// it without a pass/fail variable rather than inventing one. That is unchanged.
// What it now returns 1 for is a FACT ABOUT THE RUN — that it left rows on the
// shared base — which is a different claim from "variance is broken" and belongs
// to whoever has to go delete them. 0 means the fixtures are gone, not that the
// figures below are right; only a reader can say that. An uncaught throw still
// exits non-zero on its own.
//
// Ad hoc verification for issue #15 (variance checking) — exercises the
// same service-layer calls createInvoiceAction makes, against a real,
// currently-uninvoiced PO Item (recffjh8PlB8SQfXk, "heyy", Qty 12, Unit
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
import { createFixtures } from "./_fixtures.mjs";

const VENDOR_RECORD_ID = "rec5jSDWMNlyIbZDK"; // Demo Vendor Co.
const PO_RECORD_ID = "rec5X300LEYkNrqe9"; // HYE-PO-20260716-07
const PO_ITEM_RECORD_ID = "recffjh8PlB8SQfXk"; // "heyy", Qty 12, Unit Price 132, currently uninvoiced

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. One bucket: the Invoice
// Item and the Invoice-PO Link both hang off the Invoice, so both are discovered
// children. The Link cannot be tagged in any case — its primary field is an
// autoNumber and it carries no text.
//
// This file was the worst of the sixteen on one axis: all three of its destroys
// were `.catch(() => {})`, so a failed delete was invisible AND there was no
// verdict for it to reach. It creates no PO and no PR — it reuses three existing
// records by hard-coded id — so there is no Materials question here at all.
const fixtures = createFixtures({
    tag: "V15",
    buckets: [
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
    ],
});
const TAG = fixtures.TAG;

let invoice;
let createdItemId;
let createdLinkId;
let complete = false;

try {
    invoice = await createInvoice({
        vendorId: VENDOR_RECORD_ID,
        vendorInvoiceCode: `${TAG}-INV`,
        issueDate: "2026-07-20",
        dueDate: null,
        amountDue: 5000, // deliberately far off the ~2250 calculated total
        shippingFee: 0,
        tariff: null,
        file: [{ url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", filename: "test.pdf" }],
    });
    fixtures.track("invoices", invoice.id);
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
    complete = true;
} catch (err) {
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
// SKIP_CLEANUP still wins, and it is the one way this script exits 0 with rows on
// the base. That is not the silence #171 is about: it is opt-in per run, the ids
// are printed, and a deliberate choice is not a leak.
// `process.exitCode` rather than `process.exit`, which is this repo's own
// precedent for not stepping over cleanup (verify-withdraw-revalidation-122.mjs
// says so in as many words) — and offline/fixture-cleanup.mjs bans an exit above
// the teardown call for exactly that reason. It caught the first version of these
// very lines, where the SKIP_CLEANUP branch exited before teardown was reached.
if (process.env.SKIP_CLEANUP) {
    console.log("SKIP_CLEANUP set — leaving records in place:", { invoiceId: invoice?.id, createdItemId, createdLinkId });
    process.exitCode = 0;
} else {
    console.log("\nCleaning up fixtures:");
    const teardown = await fixtures.teardown({ complete });
    console.log(fixtures.describe(teardown));
    process.exitCode = teardown.leaked.length > 0 ? 1 : 0;
}
