// ============================================================================
// TEMPORARY SMOKE TEST — NOT for commit. Delete after use, along with
// scripts/esm-ext-loader.mjs and scripts/package.json if nothing else needs
// them.
//
// Exercises every update-style function across lib/airtable/*.js against
// the REAL "Material Purchases" base:
//   updatePR, updateItem, updateSigner, resolveCorrectionRequest, updatePO,
//   updateInvoice, updateInvoiceItem
// (editLog.js, poItems.js, quotations.js, jobs.js, vendors.js, users.js,
// materials.js have no separate update function by design — see CLAUDE.md.)
//
// Builds the full chain (Job -> Vendor -> Users -> PR -> PR Items ->
// PR Signers -> Correction Request -> PO -> PO Items -> Quotation ->
// Invoice -> Invoice Items), calls each update function once with a single
// changed field, re-fetches via the corresponding getX function to confirm
// the change actually persisted (not just trusting the update() response),
// then deletes every record created.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/test-updates.js
// ============================================================================

import { base, TABLES } from "../../lib/airtable/client.js";
import { createUser } from "../../lib/airtable/users.js";
import { createJob } from "../../lib/airtable/jobs.js";
import { createVendor } from "../../lib/airtable/vendors.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem, updateItem, getItemsByPR } from "../../lib/airtable/prItems.js";
import { createSigner, updateSigner, getSignersByPR } from "../../lib/airtable/prSigners.js";
import {
    createCorrectionRequest,
    resolveCorrectionRequest,
    getCorrectionRequestsByPR,
} from "../../lib/airtable/correctionRequests.js";
import { createPO, updatePO, getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { createPOItem } from "../../lib/airtable/poItems.js";
import { createQuotation } from "../../lib/airtable/quotations.js";
import { createInvoice, updateInvoice, getInvoiceById, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import {
    createInvoiceItem,
    updateInvoiceItem,
    getItemsByInvoice,
} from "../../lib/airtable/invoiceItems.js";

const results = [];
function check(label, pass, detail, source) {
    results.push({ label, pass: !!pass, detail, source });
    console.log(`${pass ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

const created = [];
function track(table, id, label) {
    created.push({ table, id, label });
    return id;
}

const stamp = Date.now();
const todayISO = new Date().toISOString().slice(0, 10);

async function main() {
    try {
        // ---- Build the chain --------------------------------------------------
        const job = await createJob({
            jobCode: `TEST-UPD-JOB-${stamp}`,
            jobName: "Update Smoke Test Job",
            businessUnit: "EPC",
        });
        track(TABLES.JOBS, job.id, "Job");

        const vendor = await createVendor({ vendorName: `TEST-UPD-VENDOR-${stamp}` });
        track(TABLES.VENDORS, vendor.id, "Vendor");

        const users = [];
        for (let i = 1; i <= 3; i++) {
            const u = await createUser({
                userName: `Update Test User ${i}`,
                email: `updatetest.user${i}.${stamp}@example.com`,
            });
            track(TABLES.USERS, u.id, `User ${i}`);
            users.push(u);
        }
        const [requester, signer1, signer2] = users;

        const pr = await createPR({ requesterId: requester.id, jobId: job.id, vendorId: vendor.id, notes: "original notes" });
        track(TABLES.PURCHASE_REQUESTS, pr.id, "PR");

        const prItem = await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: "Update Test Bolt",
            size: "M8",
            unit: "EA",
            qty: 10,
            rate: 2.5,
            remark: "original remark",
        });
        track(TABLES.PR_ITEMS, prItem.id, "PR Item");

        const signer = await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: signer1.id,
            sequenceOrder: 1,
            notes: "original signer notes",
        });
        track(TABLES.PR_SIGNERS, signer.id, "PR Signer");

        const correctionRequest = await createCorrectionRequest({
            prRecordId: pr.id,
            prId: pr.prId,
            initiatedById: signer1.id,
            sentToId: requester.id,
            notes: "original correction notes",
        });
        track(TABLES.CORRECTION_REQUESTS, correctionRequest.id, "Correction Request");

        const po = await createPO({
            prRecordId: pr.id,
            ourPicId: signer1.id,
            ourManagerId: signer2.id,
            deliveryAddressUsed: "Primary",
        });
        track(TABLES.PURCHASE_ORDERS, po.id, "PO");

        const poItem = await createPOItem({
            poRecordId: po.id,
            poId: po.poId,
            itemName: "Update Test Bolt",
            size: "M8",
            unit: "EA",
            qty: 10,
            rate: 2.5,
        });
        track(TABLES.PO_ITEMS, poItem.id, "PO Item");

        const quotation = await createQuotation({
            prRecordId: pr.id,
            prId: pr.prId,
            vendorId: vendor.id,
            vendorQuotationCode: `VQC-${stamp}`,
        });
        track(TABLES.QUOTATIONS, quotation.id, "Quotation");

        const invoice = await createInvoice({
            vendorId: vendor.id,
            vendorInvoiceCode: `VIC-${stamp}`,
            issueDate: todayISO,
            dueDate: todayISO,
            amountDue: 25,
            shippingFee: 0,
        });
        track(TABLES.INVOICES, invoice.id, "Invoice");

        const invoiceItem = await createInvoiceItem({
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            poRecordId: po.id,
            itemName: "Update Test Bolt",
            qty: 10,
            unitPrice: 2.5,
            varianceFlag: false,
        });
        track(TABLES.INVOICE_ITEMS, invoiceItem.id, "Invoice Item");

        const link = await linkInvoiceToPO(invoice.id, po.id);
        track(TABLES.INVOICE_PO_LINK, link.id, "Invoice-PO Link");

        console.log("\nChain built. Exercising update functions...\n");

        // ---- updatePR -----------------------------------------------------------
        await updatePR(pr.id, { notes: "UPDATED notes via smoke test" });
        const prAfter = await getPRByRecordId(pr.id);
        check(
            "updatePR: Notes field persisted",
            prAfter?.notes === "UPDATED notes via smoke test",
            `got "${prAfter?.notes}"`,
            "lib/airtable/purchaseRequests.js:updatePR"
        );

        // ---- updateItem (PR Item) ------------------------------------------------
        await updateItem(prItem.id, { remark: "UPDATED remark via smoke test" });
        const prItemsAfter = await getItemsByPR(pr.id);
        const prItemAfter = prItemsAfter.find((i) => i.id === prItem.id);
        check(
            "updateItem: Remark field persisted",
            prItemAfter?.remark === "UPDATED remark via smoke test",
            `got "${prItemAfter?.remark}"`,
            "lib/airtable/prItems.js:updateItem"
        );

        // ---- updateSigner ---------------------------------------------------------
        await updateSigner(signer.id, { notes: "UPDATED signer notes via smoke test" });
        const signersAfter = await getSignersByPR(pr.id);
        const signerAfter = signersAfter.find((s) => s.id === signer.id);
        check(
            "updateSigner: Notes field persisted",
            signerAfter?.notes === "UPDATED signer notes via smoke test",
            `got "${signerAfter?.notes}"`,
            "lib/airtable/prSigners.js:updateSigner"
        );

        // ---- resolveCorrectionRequest (the "update" for this table) -------------
        await resolveCorrectionRequest(correctionRequest.id);
        const correctionsAfter = await getCorrectionRequestsByPR(pr.id);
        const correctionAfter = correctionsAfter.find((c) => c.id === correctionRequest.id);
        check(
            "resolveCorrectionRequest: Status -> Resolved persisted",
            correctionAfter?.status === "Resolved" && !!correctionAfter?.resolvedAt,
            `status="${correctionAfter?.status}" resolvedAt="${correctionAfter?.resolvedAt}"`,
            "lib/airtable/correctionRequests.js:resolveCorrectionRequest"
        );

        // ---- updatePO ---------------------------------------------------------
        await updatePO(po.id, { status: "Signed" });
        const poAfter = await getPOByRecordId(po.id);
        check(
            "updatePO: Status field persisted",
            poAfter?.status === "Signed",
            `got "${poAfter?.status}"`,
            "lib/airtable/purchaseOrders.js:updatePO"
        );

        // ---- updateInvoice ---------------------------------------------------------
        await updateInvoice(invoice.id, { paid: true });
        const invoiceAfter = await getInvoiceById(invoice.invoiceId);
        check(
            "updateInvoice: Paid field persisted",
            invoiceAfter?.paid === true,
            `got ${invoiceAfter?.paid}`,
            "lib/airtable/invoices.js:updateInvoice"
        );

        // ---- updateInvoiceItem ---------------------------------------------------
        await updateInvoiceItem(invoiceItem.id, { varianceFlag: true });
        const invoiceItemsAfter = await getItemsByInvoice(invoice.id);
        const invoiceItemAfter = invoiceItemsAfter.find((i) => i.id === invoiceItem.id);
        check(
            "updateInvoiceItem: Variance Flag field persisted",
            invoiceItemAfter?.varianceFlag === true,
            `got ${invoiceItemAfter?.varianceFlag}`,
            "lib/airtable/invoiceItems.js:updateInvoiceItem"
        );

        console.log(
            "\nNo update function exists for: editLog.js (append-only by design), " +
                "poItems.js (frozen snapshot by design), quotations.js, jobs.js, " +
                "vendors.js, users.js, materials.js (upsertMaterial handles both " +
                "create and update internally) — none exercised here since they " +
                "have nothing to call."
        );
    } catch (err) {
        console.error("\n!!! Uncaught error during test run:", err);
        check("Test run completed without throwing", false, err.message, "test-updates.js");
    } finally {
        await cleanup();
    }

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);

    console.log("\n" + "=".repeat(70));
    console.log(`SUMMARY: ${passed}/${results.length} checks passed`);
    console.log("=".repeat(70));

    if (failed.length > 0) {
        console.log("\nFAILED CHECKS:");
        for (const f of failed) {
            console.log(`  - ${f.label}`);
            console.log(`    detail: ${f.detail}`);
            console.log(`    source: ${f.source}`);
        }
    }

    process.exitCode = failed.length > 0 ? 1 : 0;
}

async function cleanup() {
    console.log(`\nCleaning up ${created.length} test record(s), reverse order...`);
    const deletionFailures = [];

    for (const entry of [...created].reverse()) {
        try {
            await base(entry.table).destroy(entry.id);
            console.log(`  deleted ${entry.label} (${entry.id})`);
        } catch (err) {
            console.log(`  FAILED to delete ${entry.label} (${entry.id}): ${err.message}`);
            deletionFailures.push({ ...entry, error: err.message });
        }
    }

    if (deletionFailures.length > 0) {
        console.log("\n" + "!".repeat(70));
        console.log(`CLEANUP INCOMPLETE — ${deletionFailures.length} record(s) NOT deleted:`);
        for (const f of deletionFailures) {
            console.log(`  - [${f.table}] ${f.label}: ${f.id} (error: ${f.error})`);
        }
        console.log("!".repeat(70));
    } else {
        console.log("Cleanup complete — base restored to original state.");
    }
}

main();
