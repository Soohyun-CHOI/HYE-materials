// ITS EXIT CODE MEANT ONE THING ONLY UNTIL #283, AND THE CHANGE IS BECAUSE THIS
// FILE NOW COMPUTES A VERDICT (#171, amended).
// #171's reasoning: this script computes no verdict about the thing under test —
// it prints the variance figures it produced for a human to compare, and #152
// deliberately left it without a pass/fail variable rather than inventing one. So
// what it returned 1 for was a FACT ABOUT THE RUN, that it left rows on the shared
// base, which is a different claim from "variance is broken" and belongs to whoever
// has to go delete them.
//
// THAT IS NO LONGER ALL IT DOES. #283 added an assertion about the Calculated Total
// formula — a rule that lives on the Airtable side, where nothing in CI can see it
// — and a failure there is not a figure for a reader to weigh, it is a thing that
// needs a hand. The pre-existing `Variance flags did not persist` throw was already
// such a verdict, so the header was only partly true before this. So: **1 now means
// a leak OR a failed assertion**, which is verification.md's own 0/1/2 contract, and
// 0 means the fixtures are gone AND every assertion held. The variance FIGURES are
// still printed rather than judged; only a reader can say those are right.
//
// Ad hoc verification for issue #15 (variance checking) — exercises the
// same service-layer calls createInvoiceAction makes, against a real,
// currently-uninvoiced ordered item that it finds on the base at run time
// (see resolveTarget below — it used to be three hard-coded record ids),
// deliberately with values chosen to trip every variance check at once.
// Cleans up every record it creates.
//
// #283 — IT ALSO CARRIES BOTH OPTIONAL MONEY TERMS NOW, and that is not scope
// creep: this is the one script that already created an invoice, read
// `Calculated Total` back off the base and compared it against `Amount Due`, so
// the sales-tax term needed no second script. It supplies a tariff AND a sales
// tax, in the same spirit as the values above — every term at once.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-variance-15.mjs

import { base, TABLES } from "../../lib/airtable/client.js";
import { createInvoice, linkInvoiceToPO, getInvoiceByRecordId, updateInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem, updateInvoiceItem, getItemsByPOItem } from "../../lib/airtable/invoiceItems.js";
import { getPOItemByRecordId, getInvoicedQtyForPOItem, getItemsByPO } from "../../lib/airtable/poItems.js";
import { getOpenPOs } from "../../lib/airtable/purchaseOrders.js";
import { getVendorByRecordId } from "../../lib/airtable/vendors.js";
import { uninvoicedQty } from "../../lib/poItemQty.js";
import { checkHeaderVariance, checkUnitPriceVariance } from "../../lib/variance.js";
import { createFixtures } from "./_fixtures.mjs";

/**
 * ITS THREE FIXTURE RECORDS WERE HARD-CODED IDS AND ALL THREE WERE DEAD (#283).
 *
 * #15 wrote `rec5jSDWMNlyIbZDK` / `rec5X300LEYkNrqe9` / `recffjh8PlB8SQfXk` —
 * Demo Vendor Co., HYE-PO-20260716-07 and an uninvoiced ordered item on it — and
 * every one of them was wiped by a later `reset_demo.mjs --confirm`. The script
 * aborted on the first read with `Record ID rec5jSDWMNlyIbZDK does not exist`, so
 * it had been unrunnable since whichever reset came first, and nothing said so
 * because it is not in CI and nobody ran it.
 *
 * FRESH IDS WOULD ROT THE SAME WAY, and on a known schedule: `reset_demo.mjs`
 * ends by printing "the ids changed", and the rehearsal cadence is to run it
 * before each one. So the records are RESOLVED at run time instead — the first
 * open order with something still uninvoiced on it, which is exactly the
 * precondition the variance arithmetic below needs and the thing #15's comment
 * was asserting about its hard-coded item. It refuses with a readable message
 * when the base has none, rather than inventing a fixture order: what this script
 * exercises is `createInvoiceAction`'s own sequence against a REAL order, and an
 * order it built itself would not be one.
 */
async function resolveTarget() {
    const openPos = await getOpenPOs();
    if (openPos.length === 0) {
        throw new Error(
            "no open order on this base — seed it (scripts/demo/seed_full_demo.mjs) before running this"
        );
    }
    // Oldest first, so a run picks the same order twice in a row where it can.
    openPos.sort((a, b) => String(a.poId).localeCompare(String(b.poId)));
    for (const po of openPos) {
        const items = await getItemsByPO(po.id);
        const item = items.find((it) => uninvoicedQty(it) > 0);
        if (!item) continue; // `Uninvoiced Items` is a rollup and can lag; skip rather than trust it
        // `Purchase Orders.Vendor` is a Lookup through PR -> Purchase Requests.Vendor,
        // which is a LINK, so it surfaces a raw Vendor RECORD ID rather than a name —
        // the gotcha `lib/airtable/vendors.js:getVendorByRecordId` exists for and
        // documents. The first version of this resolver ran `getVendorByName` on it,
        // which matched nothing on all 12 open orders and reported the base as having
        // no uninvoiced item at all.
        const vendorRecordId = po.vendor?.[0];
        if (!vendorRecordId) continue;
        const vendor = await getVendorByRecordId(vendorRecordId);
        if (!vendor) continue;
        return { vendor, po, item };
    }
    throw new Error("every open order's items are already fully invoiced — nothing to compare against");
}

const target = await resolveTarget();
const VENDOR_RECORD_ID = target.vendor.id;
const PO_RECORD_ID = target.po.id;
const PO_ITEM_RECORD_ID = target.item.id;
// The two figures the variance values below are chosen to exceed. Printed, because
// they are no longer constants a reader of this file can see.
const PO_ITEM_QTY = target.item.qty;
const PO_ITEM_UNIT_PRICE = target.item.unitPrice;
console.log(
    `Target: ${target.vendor.vendorName} / ${target.po.poId} / ` +
        `"${target.item.itemName}" Qty ${PO_ITEM_QTY} @ ${PO_ITEM_UNIT_PRICE}, ` +
        `${uninvoicedQty(target.item)} uninvoiced`
);

// #283 — the two optional header terms. Both non-zero, and DIFFERENT from each
// other, so a formula that added the wrong one or added one twice produces a
// figure that matches neither expectation below. The sales tax carries cents on
// purpose: the field's own display precision is 0 while the API returns the exact
// value, so a rounded read would show up here rather than in production.
const TARIFF = 40;
const SALES_TAX = 185.63;

// The invoice item's own figures, both DERIVED so they still trip #15's two
// per-item checks against whatever order resolveTarget() found: a quantity above
// what was ordered, and a unit price the order did not agree.
const ITEM_QTY = PO_ITEM_QTY + 3;
const ITEM_UNIT_PRICE = Math.round((PO_ITEM_UNIT_PRICE + 18) * 100) / 100;
// Airtable currency is stored to 2 places and JS addition is binary floating
// point, so the comparison needs the same order of tolerance
// `checkUnitPriceVariance` already uses for the same reason. Half a cent.
const CENT = 0.005;

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
        // Deliberately far off whatever the calculated total comes to, so the
        // header check fires whichever order resolveTarget() picked.
        amountDue: ITEM_QTY * ITEM_UNIT_PRICE * 2 + 5000,
        shippingFee: 0,
        tariff: TARIFF,
        salesTax: SALES_TAX,
        file: [{ url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", filename: "test.pdf" }],
    });
    fixtures.track("invoices", invoice.id);
    console.log("Created invoice", invoice.invoiceId, invoice.id);

    const created = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: PO_RECORD_ID,
        poItemRecordId: PO_ITEM_RECORD_ID,
        itemName: target.item.itemName,
        // Frozen reference copies from the ordered item, as createInvoiceAction
        // takes them. Unit is a single select and an empty one is refused, which
        // createInvoiceItem handles by omitting the key.
        size: target.item.size || "",
        unit: target.item.unit || "",
        qty: ITEM_QTY, // > the ordered item's own Qty
        unitPrice: ITEM_UNIT_PRICE, // ≠ the price the order agreed
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

    // -----------------------------------------------------------------------
    // #283 — THE FIRST ASSERTION, AND IT IS THE QUIET MUTANT THIS ISSUE IS
    // SHAPED LIKE.
    //
    // The mutant: the field exists, both forms accept a figure, the invoice
    // detail prints a row for it — and `Calculated Total`'s formula was never
    // given the term. Nothing errors. `npm test` is green, because the formula is
    // not in this repository and leaves no diff. The total simply comes out short
    // by the sales tax, and `checkHeaderVariance` below then reports that gap as
    // the vendor's own arithmetic error, which is precisely the false accusation
    // #283 exists to remove. So this is the one thing that has to be checked
    // against the LIVE base, and it is checked before anything else is claimed.
    const expected =
        (invoiceAfterItems.itemsSubtotal || 0) + 0 + TARIFF + SALES_TAX;
    // ANTI-VACUITY: what the total would be under the PRE-#283 formula. If the two
    // expectations were equal the assertion below could not distinguish them, and
    // it would pass on a base whose formula was never changed.
    const withoutSalesTax = expected - SALES_TAX;
    console.log({ expected, withoutSalesTax, itemsSubtotal: invoiceAfterItems.itemsSubtotal });
    if (!(SALES_TAX > 0) || Math.abs(expected - withoutSalesTax) < CENT) {
        throw new Error("#283 assertion is vacuous — the sales tax term makes no difference to the expected total");
    }
    if (Math.abs((invoiceAfterItems.calculatedTotal || 0) - withoutSalesTax) < CENT) {
        throw new Error(
            `Calculated Total is ${invoiceAfterItems.calculatedTotal}, which is Items + Shipping + Tariff ` +
                `and EXCLUDES the ${SALES_TAX} sales tax — the Airtable formula still reads ` +
                `SUM({Items Subtotal}, {Shipping Fee}, {Tariff}). Add {Sales Tax} to it (#283).`
        );
    }
    if (Math.abs((invoiceAfterItems.calculatedTotal || 0) - expected) >= CENT) {
        throw new Error(
            `Calculated Total is ${invoiceAfterItems.calculatedTotal}, expected ${expected} ` +
                `(Items ${invoiceAfterItems.itemsSubtotal} + Shipping 0 + Tariff ${TARIFF} + Sales Tax ${SALES_TAX})`
        );
    }
    console.log(`Calculated Total includes the sales tax: ${invoiceAfterItems.calculatedTotal} (expected ${expected})`);
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // #283 — THE SECOND MUTANT: the form sends the key and the writer drops it.
    //
    // `updateInvoice` builds its `fields` object one `if` at a time, so a
    // parameter added to the signature and not to the body is accepted, ignored
    // and reported as a successful save. `offline/invoice-money-terms.mjs` asks
    // that question on the AST; this asks it of the record, which is the half
    // source shape cannot reach — and it goes through the same function the edit
    // screen calls rather than writing the field directly.
    //
    // Two writes, because `null` and a number are different branches of that same
    // `if` and only one of them is exercised at creation.
    const RAISED = 200;
    await updateInvoice(invoice.id, { salesTax: RAISED });
    const afterRaise = await getInvoiceByRecordId(invoice.id);
    if (Math.abs((afterRaise.salesTax || 0) - RAISED) >= CENT) {
        throw new Error(`updateInvoice dropped the sales tax: stored ${afterRaise.salesTax}, sent ${RAISED}`);
    }
    const raisedTotal = (afterRaise.itemsSubtotal || 0) + TARIFF + RAISED;
    if (Math.abs((afterRaise.calculatedTotal || 0) - raisedTotal) >= CENT) {
        throw new Error(
            `Calculated Total did not follow the sales tax up: ${afterRaise.calculatedTotal}, expected ${raisedTotal}`
        );
    }
    console.log(`updateInvoice raised the sales tax to ${afterRaise.salesTax}; total ${afterRaise.calculatedTotal}`);

    // And null clears it, which is also the live proof that a blank term counts
    // as 0 in the formula rather than emptying the whole total — the property the
    // field's own description claims and that `SUM` is relied on for.
    await updateInvoice(invoice.id, { salesTax: null });
    const afterClear = await getInvoiceByRecordId(invoice.id);
    if (afterClear.salesTax != null) {
        throw new Error(`updateInvoice did not clear the sales tax: stored ${afterClear.salesTax}`);
    }
    const clearedTotal = (afterClear.itemsSubtotal || 0) + TARIFF;
    if (Math.abs((afterClear.calculatedTotal || 0) - clearedTotal) >= CENT) {
        throw new Error(
            `a blank sales tax did not count as 0: total ${afterClear.calculatedTotal}, expected ${clearedTotal}`
        );
    }
    console.log(`updateInvoice cleared it; blank counts as 0 and the total is ${afterClear.calculatedTotal}`);
    // -----------------------------------------------------------------------

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
    // #283 — `!complete` joins the leak. See the header: this file computes a
    // verdict now, so a failed assertion has to reach the exit code rather than
    // only the ABORTED line above it. `complete` is set on the last line of the
    // try, so anything that threw leaves it false.
    process.exitCode = teardown.leaked.length > 0 || !complete ? 1 : 0;
}
