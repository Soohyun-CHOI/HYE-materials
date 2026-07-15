// ============================================================================
// TEMPORARY TEST SCRIPT — NOT for commit. Delete this file, plus
// scripts/esm-ext-loader.mjs and scripts/package.json, once done testing.
//
// Exercises the full Phase 0 Airtable service layer against the REAL
// "Material Purchases" base end to end:
//   Job -> Vendor -> Users (3) -> PR -> PR Items (2) -> PR Signers (2) ->
//   Correction Request -> PO -> PO Items -> Quotation -> Invoice ->
//   Invoice Items -> Invoice-PO Link -> Materials upsert
// then deletes every record it created, in reverse order. Also re-validates
// the Record-ID-lookup filterByFormula fix in generateChildId, prSigners.js,
// correctionRequests.js, quotations.js, and materials.js.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/test-phase0.js
//
// Why the extra flags: lib/**/*.js import siblings without file extensions
// (fine under Next.js's bundler, not resolvable by plain Node ESM) — see
// scripts/esm-ext-loader.mjs. scripts/package.json scopes "type": "module"
// to this folder only, so the rest of the repo is untouched.
// ============================================================================

import { base, TABLES } from "../../lib/airtable/client.js";
import { createUser } from "../../lib/airtable/users.js";
import { createJob } from "../../lib/airtable/jobs.js";
import { createVendor } from "../../lib/airtable/vendors.js";
import { createPR } from "../../lib/airtable/purchaseRequests.js";
import { createItem, getItemsByPR, updateItem } from "../../lib/airtable/prItems.js";
import { createSigner, getSignersByPR } from "../../lib/airtable/prSigners.js";
import {
    createCorrectionRequest,
    getCorrectionRequestsByPR,
    resolveCorrectionRequest,
} from "../../lib/airtable/correctionRequests.js";
import { createPO } from "../../lib/airtable/purchaseOrders.js";
import { createPOItem, getItemsByPO } from "../../lib/airtable/poItems.js";
import { createQuotation, getQuotationsByPR } from "../../lib/airtable/quotations.js";
import { createInvoice, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import {
    createInvoiceItem,
    getItemsByInvoice,
} from "../../lib/airtable/invoiceItems.js";
import { getMaterialByKey, upsertMaterial } from "../../lib/airtable/materials.js";

// ---- tiny test harness -----------------------------------------------------

const results = [];
function check(label, pass, detail, source) {
    results.push({ label, pass: !!pass, detail, source });
    console.log(`${pass ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkUnique(label, ids, source) {
    const unique = new Set(ids);
    check(
        `${label}: all generated IDs unique`,
        unique.size === ids.length,
        `ids=[${ids.join(", ")}]`,
        source
    );
}

// Record creation is tracked in a single flat list, in creation order.
// Cleanup just walks it in reverse (LIFO) — safe because we never create a
// parent after its child anywhere below.
const created = []; // { table, id, label }
function track(table, id, label) {
    created.push({ table, id, label });
    return id;
}

const stamp = Date.now();
const todayISO = new Date().toISOString().slice(0, 10);
const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

// ---- ID format regexes, per CLAUDE.md "ID generation rules" ---------------

const TOP_LEVEL_PR_ID = /^HYE-PR-\d{6}-\d{2}$/;
const TOP_LEVEL_PO_ID = /^HYE-PO-\d{8}-\d{2}$/; // 4-digit year — PO ID only, see CLAUDE.md
const TOP_LEVEL_INVOICE_ID = /^HYE-INV-\d{6}-\d{2}$/;
const childOf = (parentId, opts = {}) =>
    new RegExp(`^${escapeRegex(parentId)}-${opts.seqPrefix || ""}\\d{${opts.digits || 3}}$`);

async function main() {
    let pr, po, invoice, job, vendor, users;

    try {
        // ---- Job -----------------------------------------------------------
        job = await createJob({
            jobCode: `TEST-JOB-${stamp}`,
            jobName: "Phase0 Test Job",
            businessUnit: "EPC",
            line: "Test Line",
        });
        track(TABLES.JOBS, job.id, "Job");
        console.log(`Created Job ${job.jobCode} (${job.id})`);

        // ---- Vendor ----------------------------------------------------------
        vendor = await createVendor({
            vendorName: `TEST-VENDOR-${stamp}`,
            picName: "Test Vendor PIC",
            picPhone: "555-0100",
            picEmail: "vendor.pic@example.com",
        });
        track(TABLES.VENDORS, vendor.id, "Vendor");
        console.log(`Created Vendor ${vendor.vendorName} (${vendor.id})`);

        // ---- Users (3) -------------------------------------------------------
        users = [];
        for (let i = 1; i <= 3; i++) {
            const u = await createUser({
                userName: `Phase0 Test User ${i}`,
                email: `phase0test.user${i}.${stamp}@example.com`,
                phone: "555-010" + i,
            });
            track(TABLES.USERS, u.id, `User ${i}`);
            users.push(u);
        }
        console.log(`Created ${users.length} Users`);
        const [requester, signer1, signer2] = users;

        // ---- PR ----------------------------------------------------------------
        pr = await createPR({
            requesterId: requester.id,
            jobId: job.id,
            vendorId: vendor.id,
            notes: "Phase 0 test PR — safe to delete",
        });
        track(TABLES.PURCHASE_REQUESTS, pr.id, "PR");
        console.log(`Created PR ${pr.prId} (${pr.id})`);

        check(
            "PR ID matches HYE-PR-YYMMDD-##",
            TOP_LEVEL_PR_ID.test(pr.prId),
            pr.prId,
            "lib/airtable/purchaseRequests.js:createPR (via lib/ids.js:generateNextPRId)"
        );

        // ---- PR Items (2) --------------------------------------------------
        const prItemSpecs = [
            { itemName: "Test Bolt", size: "M8", unit: "EA", qty: 10, rate: 2.5 },
            { itemName: "Test Nut", size: "M8", unit: "EA", qty: 20, rate: 1.25 },
        ];
        const prItems = [];
        for (const spec of prItemSpecs) {
            const item = await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                ...spec,
            });
            track(TABLES.PR_ITEMS, item.id, `PR Item (${spec.itemName})`);
            prItems.push(item);

            check(
                `PR Item ID matches {PR ID}-{seq}: ${item.prItemId}`,
                childOf(pr.prId).test(item.prItemId),
                item.prItemId,
                "lib/airtable/prItems.js:createItem"
            );
        }

        // Assertion 2: PR Items.Amount is Airtable-computed even though we
        // never wrote it — re-fetch (exercises getItemsByPR, which we just
        // fixed) rather than trust the create() response alone.
        const fetchedPRItems = await getItemsByPR(pr.id);
        check(
            "getItemsByPR returns the 2 created items",
            fetchedPRItems.length === 2,
            `found ${fetchedPRItems.length}`,
            "lib/airtable/prItems.js:getItemsByPR"
        );
        for (const spec of prItemSpecs) {
            const match = fetchedPRItems.find((i) => i.itemName === spec.itemName);
            const expected = spec.qty * spec.rate;
            check(
                `PR Item "${spec.itemName}".Amount auto-computed by Airtable (expected ${expected})`,
                !!match && match.amount === expected,
                `got ${match?.amount}`,
                "Airtable formula field, PR Items.Amount"
            );
        }
        checkUnique(
            "PR Item IDs",
            prItems.map((i) => i.prItemId),
            "lib/ids.js:generateChildId (via lib/airtable/prItems.js:createItem)"
        );

        // ---- PR Signers (2) --------------------------------------------------
        const signerSpecs = [
            { signerUserId: signer1.id, sequenceOrder: 1 },
            { signerUserId: signer2.id, sequenceOrder: 2 },
        ];
        const createdSigners = [];
        for (const spec of signerSpecs) {
            const signer = await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                ...spec,
            });
            track(TABLES.PR_SIGNERS, signer.id, `PR Signer (seq ${spec.sequenceOrder})`);
            createdSigners.push(signer);

            check(
                `PR Signer ID matches {PR ID}-{seq}: ${signer.prSignerId}`,
                childOf(pr.prId).test(signer.prSignerId),
                signer.prSignerId,
                "lib/airtable/prSigners.js:createSigner"
            );
        }
        checkUnique(
            "PR Signer IDs",
            createdSigners.map((s) => s.prSignerId),
            "lib/ids.js:generateChildId (via lib/airtable/prSigners.js:createSigner)"
        );

        // Exercises the "PR Record ID" lookup-based filter fix.
        const fetchedSigners = await getSignersByPR(pr.id);
        check(
            "getSignersByPR returns the 2 created signers, in sequence order",
            fetchedSigners.length === 2 &&
                fetchedSigners[0].sequenceOrder === 1 &&
                fetchedSigners[1].sequenceOrder === 2,
            `found ${fetchedSigners.length}, order=${fetchedSigners.map((s) => s.sequenceOrder)}`,
            "lib/airtable/prSigners.js:getSignersByPR"
        );

        // ---- Correction Request (return-for-correction) -----------------------
        const correctionRequest = await createCorrectionRequest({
            prRecordId: pr.id,
            prId: pr.prId,
            initiatedById: signer1.id,
            sentToId: requester.id,
            notes: "Phase 0 test correction request — safe to delete",
        });
        track(
            TABLES.CORRECTION_REQUESTS,
            correctionRequest.id,
            "Correction Request"
        );

        check(
            `Correction Request ID matches {PR ID}-{seq}: ${correctionRequest.correctionRequestId}`,
            childOf(pr.prId).test(correctionRequest.correctionRequestId),
            correctionRequest.correctionRequestId,
            "lib/airtable/correctionRequests.js:createCorrectionRequest"
        );

        const fetchedCorrections = await getCorrectionRequestsByPR(pr.id);
        check(
            "getCorrectionRequestsByPR returns the created correction request",
            fetchedCorrections.length === 1 &&
                fetchedCorrections[0].id === correctionRequest.id,
            `found ${fetchedCorrections.length}`,
            "lib/airtable/correctionRequests.js:getCorrectionRequestsByPR"
        );

        const resolvedCorrection = await resolveCorrectionRequest(
            correctionRequest.id
        );
        check(
            "resolveCorrectionRequest marks it Resolved",
            resolvedCorrection.status === "Resolved",
            resolvedCorrection.status,
            "lib/airtable/correctionRequests.js:resolveCorrectionRequest"
        );

        // ---- PO --------------------------------------------------------------
        po = await createPO({
            prRecordId: pr.id,
            ourPicId: signer1.id,
            ourManagerId: signer2.id,
            deliveryAddressUsed: "Primary",
        });
        track(TABLES.PURCHASE_ORDERS, po.id, "PO");
        console.log(`Created PO ${po.poId} (${po.id})`);

        check(
            "PO ID matches HYE-PO-YYYYMMDD-##",
            TOP_LEVEL_PO_ID.test(po.poId),
            po.poId,
            "lib/airtable/purchaseOrders.js:createPO (via lib/ids.js:generateNextPOId)"
        );

        // ---- PO Items (mirroring PR Items' current values) -------------------
        // Deliberately 3 items, created sequentially with no delay right
        // after the PO itself — this exact shape (parent freshly created,
        // then 3+ children in immediate succession) is what reproduced the
        // generateChildId race condition consistently before the fix.
        const poItemSpecs = [
            ...prItemSpecs,
            { itemName: "Test Washer", size: "M8", unit: "EA", qty: 5, rate: 0.5 },
        ];
        const poItems = [];
        for (const spec of poItemSpecs) {
            const poItem = await createPOItem({
                poRecordId: po.id,
                poId: po.poId,
                itemName: spec.itemName,
                size: spec.size,
                unit: spec.unit,
                qty: spec.qty,
                rate: spec.rate,
            });
            track(TABLES.PO_ITEMS, poItem.id, `PO Item (${spec.itemName})`);
            poItems.push(poItem);

            check(
                `PO Item ID matches {PO ID}-{seq}: ${poItem.poItemId}`,
                childOf(po.poId).test(poItem.poItemId),
                poItem.poItemId,
                "lib/airtable/poItems.js:createPOItem"
            );

            const expected = spec.qty * spec.rate;
            check(
                `PO Item "${spec.itemName}".Amount written by backend, static (expected ${expected})`,
                poItem.amount === expected,
                `got ${poItem.amount}`,
                "lib/airtable/poItems.js:createPOItem"
            );
        }
        checkUnique(
            "PO Item IDs (3 created in immediate succession after PO — the race-condition repro case)",
            poItems.map((i) => i.poItemId),
            "lib/ids.js:generateChildId (via lib/airtable/poItems.js:createPOItem)"
        );

        // Assertion 3: frozen snapshot — mutate the ORIGINAL PR Item, then
        // confirm the PO Item is untouched on re-fetch.
        const targetPRItem = prItems[0]; // "Test Bolt", qty 10, rate 2.5
        const mutatedQty = 999;
        const mutatedRate = 888;
        await updateItem(targetPRItem.id, { qty: mutatedQty, rate: mutatedRate });

        const prItemsAfterEdit = await getItemsByPR(pr.id);
        const editedPRItem = prItemsAfterEdit.find((i) => i.id === targetPRItem.id);
        check(
            "Source PR Item actually changed (sanity check before snapshot check)",
            editedPRItem?.qty === mutatedQty &&
                editedPRItem?.rate === mutatedRate &&
                editedPRItem?.amount === mutatedQty * mutatedRate,
            `qty=${editedPRItem?.qty} rate=${editedPRItem?.rate} amount=${editedPRItem?.amount}`,
            "lib/airtable/prItems.js:updateItem"
        );

        const poItemsAfterEdit = await getItemsByPO(po.id);
        const untouchedPOItem = poItemsAfterEdit.find(
            (i) => i.itemName === "Test Bolt"
        );
        const originalSpec = prItemSpecs[0];
        check(
            "PO Item frozen snapshot unaffected by later PR Item edit",
            untouchedPOItem?.qty === originalSpec.qty &&
                untouchedPOItem?.rate === originalSpec.rate &&
                untouchedPOItem?.amount === originalSpec.qty * originalSpec.rate,
            `qty=${untouchedPOItem?.qty} rate=${untouchedPOItem?.rate} amount=${untouchedPOItem?.amount} (expected qty=${originalSpec.qty} rate=${originalSpec.rate} amount=${originalSpec.qty * originalSpec.rate})`,
            "lib/airtable/poItems.js — PO Items must never change after PO issuance"
        );

        // ---- Quotation ---------------------------------------------------------
        const quotation = await createQuotation({
            prRecordId: pr.id,
            prId: pr.prId,
            vendorId: vendor.id,
            vendorQuotationCode: `VQC-${stamp}`,
        });
        track(TABLES.QUOTATIONS, quotation.id, "Quotation");
        console.log(`Created Quotation ${quotation.quotationId} (${quotation.id})`);

        check(
            `Quotation ID matches {PR ID}-Q{seq}: ${quotation.quotationId}`,
            childOf(pr.prId, { seqPrefix: "Q", digits: 2 }).test(quotation.quotationId),
            quotation.quotationId,
            "lib/airtable/quotations.js:createQuotation"
        );
        check(
            "Vendor Quotation Code stored as human-entered pass-through",
            quotation.vendorQuotationCode === `VQC-${stamp}`,
            quotation.vendorQuotationCode,
            "lib/airtable/quotations.js:createQuotation"
        );

        const fetchedQuotations = await getQuotationsByPR(pr.id);
        check(
            "getQuotationsByPR returns the created quotation",
            fetchedQuotations.length === 1 && fetchedQuotations[0].id === quotation.id,
            `found ${fetchedQuotations.length}`,
            "lib/airtable/quotations.js:getQuotationsByPR"
        );

        // ---- Invoice -----------------------------------------------------------
        const invoiceItemSpecs = [
            { itemName: "Test Bolt", qty: 10, unitPrice: 2.5, varianceFlag: false },
            { itemName: "Test Nut", qty: 20, unitPrice: 1.3, varianceFlag: true },
        ];
        const amountDue = invoiceItemSpecs.reduce(
            (sum, s) => sum + s.qty * s.unitPrice,
            0
        );

        invoice = await createInvoice({
            vendorId: vendor.id,
            vendorInvoiceCode: `VIC-${stamp}`,
            issueDate: todayISO,
            dueDate: in30days,
            amountDue,
            shippingFee: 0,
        });
        track(TABLES.INVOICES, invoice.id, "Invoice");
        console.log(`Created Invoice ${invoice.invoiceId} (${invoice.id})`);

        check(
            "Invoice ID matches HYE-INV-YYMMDD-## (top-level, not a PO child)",
            TOP_LEVEL_INVOICE_ID.test(invoice.invoiceId),
            invoice.invoiceId,
            "lib/airtable/invoices.js:createInvoice (via lib/ids.js:generateNextInvoiceId)"
        );
        check(
            "Vendor Invoice Code stored as human-entered pass-through",
            invoice.vendorInvoiceCode === `VIC-${stamp}`,
            invoice.vendorInvoiceCode,
            "lib/airtable/invoices.js:createInvoice"
        );

        // ---- Invoice Items (PO-linked) ------------------------------------------
        const createdInvoiceItems = [];
        for (const spec of invoiceItemSpecs) {
            const invoiceItem = await createInvoiceItem({
                invoiceRecordId: invoice.id,
                invoiceId: invoice.invoiceId,
                poRecordId: po.id,
                itemName: spec.itemName,
                qty: spec.qty,
                unitPrice: spec.unitPrice,
                varianceFlag: spec.varianceFlag,
            });
            track(TABLES.INVOICE_ITEMS, invoiceItem.id, `Invoice Item (${spec.itemName})`);
            createdInvoiceItems.push(invoiceItem);

            check(
                `Invoice Item ID matches {Invoice ID}-{seq}: ${invoiceItem.invoiceItemId}`,
                childOf(invoice.invoiceId).test(invoiceItem.invoiceItemId),
                invoiceItem.invoiceItemId,
                "lib/airtable/invoiceItems.js:createInvoiceItem"
            );
        }
        checkUnique(
            "Invoice Item IDs",
            createdInvoiceItems.map((i) => i.invoiceItemId),
            "lib/ids.js:generateChildId (via lib/airtable/invoiceItems.js:createInvoiceItem)"
        );

        // Assertion 4: Amount is Airtable-computed formula; Variance Flag is
        // exact pass-through. Re-fetch to exercise getItemsByInvoice.
        const fetchedInvoiceItems = await getItemsByInvoice(invoice.id);
        check(
            "getItemsByInvoice returns the 2 created items",
            fetchedInvoiceItems.length === 2,
            `found ${fetchedInvoiceItems.length}`,
            "lib/airtable/invoiceItems.js:getItemsByInvoice"
        );
        for (const spec of invoiceItemSpecs) {
            const match = fetchedInvoiceItems.find((i) => i.itemName === spec.itemName);
            const expectedAmount = spec.qty * spec.unitPrice;
            check(
                `Invoice Item "${spec.itemName}".Amount auto-computed by Airtable (expected ${expectedAmount})`,
                !!match && match.amount === expectedAmount,
                `got ${match?.amount}`,
                "Airtable formula field, Invoice Items.Amount"
            );
            check(
                `Invoice Item "${spec.itemName}".Variance Flag pass-through (expected ${spec.varianceFlag})`,
                !!match && match.varianceFlag === spec.varianceFlag,
                `got ${match?.varianceFlag}`,
                "lib/airtable/invoiceItems.js:createInvoiceItem"
            );
        }

        // ---- Invoice-PO Link ------------------------------------------------
        const link = await linkInvoiceToPO(invoice.id, po.id);
        track(TABLES.INVOICE_PO_LINK, link.id, "Invoice-PO Link");
        console.log(`Created Invoice-PO Link (${link.id})`);
        check(
            "linkInvoiceToPO created a join row",
            !!link.id,
            link.id,
            "lib/airtable/invoices.js:linkInvoiceToPO"
        );

        // ---- Materials upsert idempotency (assertion 5) -----------------------
        const materialKey = {
            itemName: `Test Material ${stamp}`,
            size: "STD",
            unit: "EA",
            vendorRecordId: vendor.id,
        };

        const countMatching = async () => {
            const records = await base(TABLES.MATERIALS)
                .select({
                    filterByFormula: `AND({Item Name} = "${materialKey.itemName}", {Size} = "${materialKey.size}", {Unit} = "${materialKey.unit}")`,
                })
                .all();
            return records.filter((r) => {
                const linked = r.get("Vendor");
                return Array.isArray(linked) && linked.includes(vendor.id);
            });
        };

        const firstUpsert = await upsertMaterial({
            ...materialKey,
            unitPrice: 100,
            latestJobId: job.id,
            latestDate: todayISO,
            latestPORecordId: po.id,
        });
        track(TABLES.MATERIALS, firstUpsert.id, "Material");

        let matching = await countMatching();
        check(
            "Materials upsert #1 created exactly 1 record",
            matching.length === 1,
            `found ${matching.length}`,
            "lib/airtable/materials.js:upsertMaterial"
        );

        const secondUpsert = await upsertMaterial({
            ...materialKey,
            unitPrice: 150,
            latestJobId: job.id,
            latestDate: in30days,
            latestPORecordId: po.id,
        });

        matching = await countMatching();
        check(
            "Materials upsert #2 (same key) did NOT create a duplicate — still 1 record",
            matching.length === 1,
            `found ${matching.length}`,
            "lib/airtable/materials.js:upsertMaterial"
        );
        check(
            "Materials upsert #2 updated the existing record's id, not a new one",
            secondUpsert.id === firstUpsert.id,
            `first=${firstUpsert.id} second=${secondUpsert.id}`,
            "lib/airtable/materials.js:upsertMaterial"
        );
        check(
            "Materials upsert #2 updated Unit Price to the latest call's value (150)",
            matching[0]?.get("Unit Price") === 150,
            `got ${matching[0]?.get("Unit Price")}`,
            "lib/airtable/materials.js:upsertMaterial"
        );

        const viaGetter = await getMaterialByKey(materialKey);
        check(
            "getMaterialByKey finds the upserted record",
            viaGetter?.id === firstUpsert.id && viaGetter?.unitPrice === 150,
            `id=${viaGetter?.id} unitPrice=${viaGetter?.unitPrice}`,
            "lib/airtable/materials.js:getMaterialByKey"
        );
    } catch (err) {
        console.error("\n!!! Uncaught error during test run:", err);
        check("Test run completed without throwing", false, err.message, "test-phase0.js");
    } finally {
        await cleanup();
    }

    // ---- summary --------------------------------------------------------------
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
            console.log(`    likely source: ${f.source}`);
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
