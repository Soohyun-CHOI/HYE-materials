// Every file url handed to Airtable is on this app's own Blob store — credentialed (#438).
//
// WHY THIS EXISTS. `offline/file-source.mjs` holds the rule by SHAPE: each action's
// refusal sits ahead of its first write and outside its try, and each writer asks
// before it writes. Shape is not execution (`offline/_ast.mjs`), and the claim this
// issue makes is about execution twice over — that a refused call writes NOTHING,
// and that the narrowed predicate still passes every file this app really uploads.
// Both need the running app, real sessions and the base, so they are here.
//
//   A — the targets, read and checked rather than trusted.
//   B — two sessions, and a probe that the server is running THIS tree: detect-po
//       answers 400 for another customer's store only once the predicate is ours.
//       Everything after it would write with the old predicate, so it goes first.
//   C — the writers' backstop, by direct call: each of the six throws on a url that
//       is not ours before it reads or writes anything. Every id handed to them is
//       one that cannot exist, so a missing assertion fails at Airtable instead of
//       writing a row.
//   D — the refusal matrix on the fresh paths: five actions, four urls that are not
//       ours each. Every case must come back in the action's own words and leave no
//       row carrying its tag.
//   E — a Draft saved with a file of ours (F1), then four refusals against it that
//       must leave it exactly as it was, then the #142 re-save that keeps its
//       quotation by record id — the one url that is not ours and still belongs.
//   F — an invoice entered with a file of ours (C2).
//   G — a delivery recorded with a photo of ours (C3), the photo-replacement
//       refusals against it, and every demo invoice's pairing left as it was.
//   H — Edit and continue refused against a request already In Review, which is
//       read and left alone: the refusal comes before the turn is even loaded.
//
// FIXTURES, ALL DELETED IN THIS RUN BY scripts/tests/_fixtures.mjs: one Draft and
// its PR Items, PR Signers and one Quotations row (E); one Invoice with its Invoice
// Items and Invoice-PO Link rows (F); one Delivery with its Delivery Items (G). Three
// Vercel Blob objects, which each action's own after() deletes once Airtable has
// taken the file; the helper judges what is left. TWO Auth Tokens rows are spent and
// left, one per session, as every script in this tier does. No mail is sent: nothing
// here submits a request or moves a signing turn. Reuses without writing: #382's
// order `HYE-PO-260911-34` and its one ordered item, which nothing has invoiced and
// no delivery has touched, so the only pairing this run can write is between its
// own invoice and its own delivery.
//
// NEEDS A DEV SERVER on http://localhost:3000 serving this tree (override with
// BASE_URL). Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-file-source-438.mjs
//
// Exit codes: 0 all clear, 1 something failed or leaked, 2 clean but incomplete.

import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";
import { TABLES, base } from "../../lib/airtable/client.js";
import { prefixMatch } from "../../lib/airtableFormula.js";
import { createQuotation } from "../../lib/airtable/quotations.js";
import { createInvoice } from "../../lib/airtable/invoices.js";
import { createDelivery, replaceDeliveryPhoto } from "../../lib/airtable/deliveries.js";
import { createDirectPurchase } from "../../lib/airtable/directPurchases.js";
import { getPOByRecordId, updatePO } from "../../lib/airtable/purchaseOrders.js";
import { getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { isOurBlobUrl } from "../../lib/fileSource.js";
import { QUOTATION_REUSE_COPY } from "../../lib/quotationReuse.js";
import { DIRECT_PURCHASE_COPY } from "../../lib/directPurchase.js";
import { VERIFY_CATEGORY_CODES } from "./_categories.mjs";
import { createFixtures } from "./_fixtures.mjs";
import { DEFAULT_BASE_URL, callServerAction, serverActionId, sessionCookieFor } from "./_liveApp.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-file-source-438 — every attachment url is on our own Blob store" });

const BASE = DEFAULT_BASE_URL;
const ADMIN_EMAIL = "soo@hanyangengusa.com";
const SITE_EMAIL = "scoped-fixture@hanyangengusa.com";

// #382's target, re-checked in part A: a signed order whose one ordered item nothing
// has invoiced and no delivery has touched.
const PO_RECORD_ID = "recFhuh7Rmic2VxXI"; // HYE-PO-260911-34
const PO_ITEM_RECORD_ID = "recNWQmMybRWcCVKY"; // HYE-PO-260911-34-001

/** Ids that cannot resolve, for part C: a missing assertion then fails at Airtable. */
const NO_RECORD = "recNOTAREALROW438";

const REFUSED = {
    missingQuotation: "Every quotation needs a file attached.",
    changedElsewhere: QUOTATION_REUSE_COPY.changedElsewhere,
    invoiceFile: "Attach the invoice file.",
    directPurchaseFile: DIRECT_PURCHASE_COPY.blocked["no-file"],
    packingList: "Attach a photo of the packing list.",
    replacementPhoto: "Upload a photo first.",
};

let pass = true;
let incomplete = false;
let complete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};
const skip = (label) => {
    incomplete = true;
    console.log(`  SKIP  ${label}`);
};

const fixtures = createFixtures({
    tag: "V438",
    buckets: [
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable — an autoNumber primary and no text field at all.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        {
            name: "deliveries",
            table: TABLES.DELIVERIES,
            label: "Delivery",
            tagField: "Notes",
            children: [{ link: "Delivery Items", table: TABLES.DELIVERY_ITEMS, label: "Delivery Item" }],
        },
        {
            name: "requests",
            table: TABLES.PURCHASE_REQUESTS,
            label: "Purchase Request",
            tagField: "Notes",
            children: [
                { link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" },
                { link: "PR Signers", table: TABLES.PR_SIGNERS, label: "PR Signer" },
                { link: "Quotations", table: TABLES.QUOTATIONS, label: "Quotation" },
            ],
        },
        {
            // THE NET FOR A REFUSAL THAT FAILS, and nothing else: part D's direct
            // purchase cases must create no row, so a run that works finds 0 here.
            name: "directPurchases",
            table: TABLES.DIRECT_PURCHASES,
            label: "Direct Purchase",
            tagField: "Vendor Invoice Code",
            discoverByTag: true,
        },
    ],
});
const TAG = fixtures.TAG;

/** The smallest thing Airtable will accept as a PDF attachment (#382's). */
const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
        "trailer<</Root 1 0 R>>\n%%EOF\n",
    "utf8"
);

async function uploadPdf(label) {
    const blob = await put(`${TAG}-${label}.pdf`, MINIMAL_PDF, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
    });
    fixtures.trackBlob(blob.url);
    return blob;
}

/** Rows whose tag field starts with `prefix` — the evidence a refused call wrote none. */
async function rowsTagged(table, field, prefix) {
    const records = await base(table)
        .select({ filterByFormula: prefixMatch(field, prefix), fields: [field] })
        .all();
    return records.map((r) => r.id);
}

/**
 * A refused call's footprint on one table: nothing. Anything found is a failure, and
 * is TRACKED so the teardown deletes it rather than leaving it on the base.
 */
async function assertNothingCreated(table, field, prefix, bucket, label) {
    const found = await rowsTagged(table, field, prefix);
    for (const id of found) fixtures.track(bucket, id);
    ok(label, found.length === 0, found.length ? `${found.length} row(s) created: ${found.join(", ")}` : "");
}

/** The attachment once Airtable has taken it: one file whose url is no longer ours. */
async function ingested(table, recordId, field, blobUrl, timeoutMs = 15000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        const files = (await base(table).find(recordId)).get(field) || [];
        if (files.length === 1 && files[0].url !== blobUrl) return files[0];
        await new Promise((resolve) => setTimeout(resolve, 750));
    }
    return null;
}

/**
 * An action's id: from the page's own chunks when a component on it imports the
 * action, and otherwise from the dev server's action manifest, which registers every
 * action of a page once that page has been compiled — the request above is what
 * compiled it. Both answers come from the server this script is talking to.
 */
async function actionIdFor({ pageUrl, exportName, filename, cookie }) {
    const fromPage = await serverActionId(pageUrl, exportName, { cookie });
    if (fromPage) return fromPage;
    try {
        const manifest = JSON.parse(readFileSync(".next/dev/server/server-reference-manifest.json", "utf8"));
        for (const [id, entry] of Object.entries(manifest.node || {})) {
            if (entry.exportedName === exportName && entry.filename === filename) return id;
        }
    } catch (err) {
        console.log(`  WARN  the dev server's action manifest could not be read — ${err.message}`);
    }
    return null;
}

function formOf(fields) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.set(key, value);
    return body;
}

async function post({ pageUrl, actionId, fields, cookie }) {
    return callServerAction({ pageUrl, actionId, args: [null, formOf(fields)], cookie });
}

/** Everything a refused re-save could have moved on a Draft, as one comparable string. */
async function draftState(recordId) {
    const record = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    const quotationIds = record.get("Quotations") || [];
    const quotations = [];
    for (const id of quotationIds) quotations.push(await base(TABLES.QUOTATIONS).find(id));
    return JSON.stringify({
        status: record.get("Status") ?? null,
        notes: record.get("Notes") ?? "",
        vendor: record.get("Vendor") || [],
        discipline: record.get("Discipline") || [],
        address: record.get("Delivery Address") || [],
        shippingFee: record.get("Shipping Fee") ?? null,
        items: record.get("PR Items") || [],
        signers: record.get("PR Signers") || [],
        quotations: quotations.map((q) => ({
            id: q.id,
            code: q.get("Vendor Quotation Code") ?? "",
            files: (q.get("File") || []).map((f) => f.id),
        })),
    });
}

/** The same for a request in review, including where its signing turn stands. */
async function requestState(recordId) {
    const record = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    const signers = [];
    for (const id of record.get("PR Signers") || []) {
        const signer = await base(TABLES.PR_SIGNERS).find(id);
        signers.push(`${id}:${signer.get("Status") ?? ""}`);
    }
    return JSON.stringify({
        status: record.get("Status") ?? null,
        step: record.get("Current Signer Step") ?? null,
        items: record.get("PR Items") || [],
        quotations: record.get("Quotations") || [],
        editLog: record.get("PR Edit Log") || [],
        signers,
    });
}

async function invoicePairings(vendorRecordId) {
    const records = await base(TABLES.INVOICES).select({ fields: ["Vendor", "Delivery"] }).all();
    return new Map(
        records
            .filter((r) => (r.get("Vendor") || []).includes(vendorRecordId))
            .map((r) => [r.id, JSON.stringify(r.get("Delivery") || [])])
    );
}

async function threwOurRefusal(writer, call) {
    try {
        await call();
        return "it did not throw";
    } catch (err) {
        return String(err.message).startsWith(`${writer}: refusing an attachment`) ? null : `it threw something else: ${err.message}`;
    }
}

let blobUrlF1 = null;
let blobUrlC2 = null;
let blobUrlC3 = null;

try {
    // --- A -----------------------------------------------------------------
    console.log("\nA — the targets, read rather than trusted");
    const admin = await getUserByEmail(ADMIN_EMAIL);
    const site = await getUserByEmail(SITE_EMAIL);
    const po = await getPOByRecordId(PO_RECORD_ID);
    const orderedItem = await getPOItemByRecordId(PO_ITEM_RECORD_ID);
    const pr = po?.pr?.[0] ? await getPRByRecordId(po.pr[0]) : null;
    const jobRecordId = pr?.job?.[0] ?? null;
    const vendorRecordId = po?.vendor?.[0] ?? null;
    const job = jobRecordId ? await base(TABLES.JOBS).find(jobRecordId) : null;
    const addressId = job?.get("Delivery Address")?.[0] ?? pr?.deliveryAddress?.[0] ?? null;
    const inReview = (
        await base(TABLES.PURCHASE_REQUESTS)
            .select({ filterByFormula: '{Status} = "In Review"', fields: ["PR ID"], maxRecords: 1 })
            .firstPage()
    )[0];
    const otherQuotation = (
        await base(TABLES.QUOTATIONS)
            .select({ filterByFormula: "LEN({File} & \"\") > 0", fields: ["Quotation ID", "File"], maxRecords: 1 })
            .firstPage()
    )[0];

    ok("both accounts exist", Boolean(admin && site));
    ok("  and the site account is assigned to the order's job", Boolean(site?.assignedJobs?.includes(jobRecordId)));
    ok("the order is signed", ["Signed", "Sent to Vendor"].includes(po?.status), po?.status ?? "not found");
    ok("  its ordered item carries a material", Boolean(orderedItem?.material?.[0]));
    ok("  nothing has invoiced it", !orderedItem?.invoicedQty, String(orderedItem?.invoicedQty ?? 0));
    ok("  and no delivery has touched it", !orderedItem?.deliveredQty, String(orderedItem?.deliveredQty ?? 0));
    ok("the job has a delivery address to record against", Boolean(addressId));
    const unitPrice = orderedItem?.unitPrice;
    ok("  and the ordered item has a price to invoice it at", Number.isFinite(unitPrice) && unitPrice > 0, String(unitPrice));
    const targetsHold = pass && Boolean(pr?.discipline?.[0] && vendorRecordId);

    // --- B -----------------------------------------------------------------
    console.log("\nB — two sessions, and that the server is running this tree");
    const adminCookie = await sessionCookieFor(ADMIN_EMAIL);
    const siteCookie = await sessionCookieFor(SITE_EMAIL);
    ok("an Admin session and a site session", Boolean(adminCookie && siteCookie));
    const probe = await fetch(`${BASE}/api/invoices/detect-po`, {
        method: "POST",
        headers: { cookie: adminCookie, "content-type": "application/json" },
        body: JSON.stringify({ blobUrl: "https://someoneelse42.public.blob.vercel-storage.com/invoice.pdf" }),
    });
    const probeBody = await probe.json().catch(() => ({}));
    const liveTree = ok(
        "detect-po refuses another customer's store — the narrowed predicate is what is running",
        probe.status === 400 && probeBody.error === "Invalid file URL",
        `${probe.status} ${JSON.stringify(probeBody).slice(0, 80)}`
    );
    if (!liveTree || !targetsHold) {
        throw new Error("the server is not running this tree, or a target moved — nothing below may run");
    }

    // One upload of ours now, so the matrix can ask about http on our own host.
    const f1Blob = await uploadPdf("draft-quotation");
    blobUrlF1 = f1Blob.url;
    ok("an upload of ours is ours to the predicate here too", isOurBlobUrl(blobUrlF1));
    const FOREIGN = {
        "another customer's store": "https://someoneelse42.public.blob.vercel-storage.com/q-Xy12.pdf",
        "an Airtable attachment url": "https://v5.airtableusercontent.com/v3/u/57/57/1788372000000/AbCd/q.pdf",
        "http on our own host": blobUrlF1.replace(/^https:/, "http:"),
        "an arbitrary host": "https://example.com/q.pdf",
    };

    // --- C -----------------------------------------------------------------
    console.log("\nC — the writers' backstop, by direct call, before any read or write");
    const foreignFile = [{ url: FOREIGN["another customer's store"], filename: "x.pdf" }];
    const backstops = {
        createQuotation: () => createQuotation({ prRecordId: NO_RECORD, prId: `${TAG}-NONE`, vendorId: NO_RECORD, file: foreignFile }),
        createInvoice: () =>
            createInvoice({ vendorId: NO_RECORD, vendorInvoiceCode: `${TAG}-C`, issueDate: "2026-09-24", amountDue: 1, shippingFee: 0, file: foreignFile }),
        createDelivery: () =>
            createDelivery({ jobRecordId: NO_RECORD, vendorRecordId: NO_RECORD, receivedDate: "2026-09-24", notes: `${TAG}-C`, file: foreignFile }),
        replaceDeliveryPhoto: () => replaceDeliveryPhoto(NO_RECORD, foreignFile[0]),
        createDirectPurchase: () =>
            createDirectPurchase({ vendorRecordId: NO_RECORD, jobRecordId: NO_RECORD, vendorInvoiceCode: `${TAG}-C`, file: foreignFile }),
        updatePO: () => updatePO(NO_RECORD, { poPdfFile: foreignFile }),
    };
    for (const [writer, call] of Object.entries(backstops)) {
        const reason = await threwOurRefusal(writer, call);
        ok(`${writer} refuses a url that is not ours`, reason === null, reason ?? "");
    }

    // --- D -----------------------------------------------------------------
    console.log("\nD — the refusal matrix on the fresh paths");
    const invoicePage = `${BASE}/invoices/new`;
    const deliveryPage = `${BASE}/deliveries/new`;
    const requestPage = `${BASE}/prs/new`;
    const ids = {
        createInvoiceAction: await actionIdFor({ pageUrl: invoicePage, exportName: "createInvoiceAction", filename: "app/invoices/new/actions.js", cookie: adminCookie }),
        createDirectPurchaseAction: await actionIdFor({ pageUrl: invoicePage, exportName: "createDirectPurchaseAction", filename: "app/invoices/new/actions.js", cookie: adminCookie }),
        createDeliveryAction: await actionIdFor({ pageUrl: deliveryPage, exportName: "createDeliveryAction", filename: "app/deliveries/new/actions.js", cookie: siteCookie }),
        saveDraftAction: await actionIdFor({ pageUrl: requestPage, exportName: "saveDraftAction", filename: "app/prs/new/actions.js", cookie: siteCookie }),
        createPRAction: await actionIdFor({ pageUrl: requestPage, exportName: "createPRAction", filename: "app/prs/new/actions.js", cookie: siteCookie }),
    };
    for (const [name, id] of Object.entries(ids)) ok(`${name}'s id is found`, Boolean(id));

    const leafCode = VERIFY_CATEGORY_CODES[0];
    const itemsFor = (size) =>
        JSON.stringify([
            { categoryCodes: ["", "", "", leafCode], size, unit: "EA", qty: "1", unitPrice: "1", remark: "", quotationIndex: 0 },
        ]);
    const requestFields = (overrides) => ({
        disciplineId: pr.discipline[0],
        vendorId: vendorRecordId,
        notes: `${TAG}-R`,
        shippingFee: "",
        deliveryAddressId: addressId,
        itemsJson: itemsFor(""),
        signersJson: JSON.stringify([{ userId: site.id, confirmationType: "Approval" }]),
        quotationsJson: "[]",
        existingDraftRecordId: "",
        confirmed: "true",
        ...overrides,
    });

    let caseNo = 0;
    for (const [kind, url] of Object.entries(FOREIGN)) {
        caseNo += 1;
        const code = `${TAG}-R${caseNo}`;
        console.log(`  ${kind}:`);

        const invoice = await post({
            pageUrl: invoicePage,
            actionId: ids.createInvoiceAction,
            cookie: adminCookie,
            fields: {
                vendorId: vendorRecordId,
                vendorInvoiceCode: code,
                issueDate: "2026-09-24",
                amountDue: String(unitPrice),
                shippingFee: "0",
                itemsJson: "[]",
                invoiceFileUrl: url,
                invoiceFileFilename: "invoice.pdf",
            },
        });
        ok("    createInvoiceAction refuses it in the file's own words", invoice.refusal === REFUSED.invoiceFile, invoice.refusal ?? "no refusal");
        await assertNothingCreated(TABLES.INVOICES, "Vendor Invoice Code", code, "invoices", "      and writes no invoice");

        const direct = await post({
            pageUrl: invoicePage,
            actionId: ids.createDirectPurchaseAction,
            cookie: adminCookie,
            fields: {
                vendorId: vendorRecordId,
                jobId: jobRecordId,
                jobCode: job.get("Job Code") || "",
                invoiceFileUrl: url,
                invoiceFileFilename: "invoice.pdf",
                vendorInvoiceCode: code,
                notes: code,
            },
        });
        ok("    createDirectPurchaseAction refuses it", direct.refusal === REFUSED.directPurchaseFile, direct.refusal ?? "no refusal");
        await assertNothingCreated(TABLES.DIRECT_PURCHASES, "Vendor Invoice Code", code, "directPurchases", "      and writes no direct purchase");

        const delivery = await post({
            pageUrl: deliveryPage,
            actionId: ids.createDeliveryAction,
            cookie: siteCookie,
            fields: {
                jobRecordId,
                vendorRecordId,
                itemsJson: JSON.stringify([{ materialRecordId: orderedItem.material[0], qty: "1" }]),
                receivedDate: "2026-09-24",
                notes: code,
                poId: po.poId,
                deliveryAddressId: addressId,
                packingListUrl: url,
                packingListFilename: "packing.pdf",
            },
        });
        ok("    createDeliveryAction refuses it", delivery.refusal === REFUSED.packingList, delivery.refusal ?? "no refusal");
        await assertNothingCreated(TABLES.DELIVERIES, "Notes", code, "deliveries", "      and writes no delivery");

        const draft = await post({
            pageUrl: requestPage,
            actionId: ids.saveDraftAction,
            cookie: siteCookie,
            fields: requestFields({
                notes: code,
                quotationsJson: JSON.stringify([{ recordId: "", url, filename: "q.pdf", vendorQuotationCode: "" }]),
            }),
        });
        ok("    saveDraftAction refuses it", draft.refusal === REFUSED.missingQuotation, draft.refusal ?? "no refusal");
        await assertNothingCreated(TABLES.PURCHASE_REQUESTS, "Notes", code, "requests", "      and writes no request");

        const submit = await post({
            pageUrl: requestPage,
            actionId: ids.createPRAction,
            cookie: siteCookie,
            fields: requestFields({
                notes: `${code}S`,
                signersJson: JSON.stringify([{ userId: NO_RECORD, confirmationType: "Approval" }]),
                quotationsJson: JSON.stringify([{ recordId: "", url, filename: "q.pdf", vendorQuotationCode: "" }]),
            }),
        });
        ok("    createPRAction refuses it", submit.refusal === REFUSED.missingQuotation, submit.refusal ?? "no refusal");
        await assertNothingCreated(TABLES.PURCHASE_REQUESTS, "Notes", `${code}S`, "requests", "      and writes no request");
    }

    // --- E -----------------------------------------------------------------
    console.log("\nE — a Draft with a file of ours, four refusals against it, and the #142 re-save");
    const draftFields = (overrides) =>
        requestFields({
            notes: TAG,
            confirmed: "",
            itemsJson: itemsFor(TAG),
            ...overrides,
        });
    const saved = await post({
        pageUrl: requestPage,
        actionId: ids.saveDraftAction,
        cookie: siteCookie,
        fields: draftFields({
            quotationsJson: JSON.stringify([
                { recordId: "", url: blobUrlF1, filename: "draft-quotation.pdf", vendorQuotationCode: `${TAG}-Q1` },
            ]),
        }),
    });
    ok("the Draft saves with a file of ours", saved.refusal === null && saved.flight.includes("savedDraft"), saved.refusal ?? "");
    const draftIds = await rowsTagged(TABLES.PURCHASE_REQUESTS, "Notes", TAG);
    const draftRecordId = draftIds.find(Boolean) ?? null;
    for (const id of draftIds) fixtures.track("requests", id);
    ok("  exactly one request carries the run's tag", draftIds.length === 1, String(draftIds.length));
    const draftRecord = draftRecordId ? await base(TABLES.PURCHASE_REQUESTS).find(draftRecordId) : null;
    const q1Id = draftRecord?.get("Quotations")?.[0] ?? null;
    const q1File = q1Id ? await ingested(TABLES.QUOTATIONS, q1Id, "File", blobUrlF1) : null;
    ok("  and Airtable took the quotation file", Boolean(q1File), q1File ? "" : "not ingested within 15s");

    if (draftRecordId && q1Id && q1File) {
        const reSave = (quotation, extra = {}) =>
            post({
                pageUrl: requestPage,
                actionId: extra.submit ? ids.createPRAction : ids.saveDraftAction,
                cookie: siteCookie,
                fields: draftFields({
                    // A different note, so a refusal that did not hold shows on the record.
                    notes: `${TAG}-moved`,
                    existingDraftRecordId: draftRecordId,
                    confirmed: extra.submit ? "true" : "",
                    signersJson: extra.submit
                        ? JSON.stringify([{ userId: NO_RECORD, confirmationType: "Approval" }])
                        : JSON.stringify([{ userId: site.id, confirmationType: "Approval" }]),
                    quotationsJson: JSON.stringify([quotation]),
                }),
            });

        const cases = [
            {
                label: "a url that is not ours and names no record",
                quotation: { recordId: "", url: FOREIGN["another customer's store"], filename: "q.pdf", vendorQuotationCode: "" },
                expect: REFUSED.missingQuotation,
            },
            {
                label: "its own file's Airtable url under a record id it does not have",
                quotation: { recordId: NO_RECORD, url: q1File.url, filename: "q.pdf", vendorQuotationCode: "" },
                expect: REFUSED.changedElsewhere,
            },
            {
                label: "another request's quotation, by its record id and Airtable url",
                quotation: otherQuotation
                    ? { recordId: otherQuotation.id, url: otherQuotation.get("File")[0].url, filename: "q.pdf", vendorQuotationCode: "" }
                    : null,
                expect: REFUSED.changedElsewhere,
            },
            {
                label: "a url that is not ours, on submit",
                quotation: { recordId: "", url: FOREIGN["an Airtable attachment url"], filename: "q.pdf", vendorQuotationCode: "" },
                expect: REFUSED.missingQuotation,
                submit: true,
            },
        ];
        for (const c of cases) {
            if (!c.quotation) {
                skip(`${c.label} — the base holds no other quotation with a file`);
                continue;
            }
            const before = await draftState(draftRecordId);
            const otherBefore = otherQuotation ? JSON.stringify((await base(TABLES.QUOTATIONS).find(otherQuotation.id)).get("File").map((f) => f.id)) : null;
            const reply = await reSave(c.quotation, { submit: c.submit });
            const after = await draftState(draftRecordId);
            ok(`${c.label} is refused`, reply.refusal === c.expect, reply.refusal ?? "no refusal");
            ok("  and the Draft is exactly as it was", before === after, before === after ? "" : `${before} -> ${after}`);
            if (otherQuotation) {
                const otherAfter = JSON.stringify((await base(TABLES.QUOTATIONS).find(otherQuotation.id)).get("File").map((f) => f.id));
                ok("  and the other request's quotation is untouched", otherBefore === otherAfter);
            }
        }

        // THE ONE URL THAT IS NOT OURS AND STILL BELONGS: kept by record id, never written.
        const kept = await post({
            pageUrl: requestPage,
            actionId: ids.saveDraftAction,
            cookie: siteCookie,
            fields: draftFields({
                existingDraftRecordId: draftRecordId,
                quotationsJson: JSON.stringify([
                    { recordId: q1Id, url: q1File.url, filename: "draft-quotation.pdf", vendorQuotationCode: `${TAG}-Q2` },
                ]),
            }),
        });
        const afterKeep = await base(TABLES.PURCHASE_REQUESTS).find(draftRecordId);
        const keptQuotation = await base(TABLES.QUOTATIONS).find(q1Id);
        ok("the Draft re-saved with its own quotation is not refused", kept.refusal === null && kept.flight.includes("savedDraft"), kept.refusal ?? "");
        ok("  it still holds that one quotation, by the same record id", JSON.stringify(afterKeep.get("Quotations") || []) === JSON.stringify([q1Id]));
        ok("  whose file was not rewritten", (keptQuotation.get("File") || [])[0]?.id === q1File.id);
        ok("  and whose code took the edit", keptQuotation.get("Vendor Quotation Code") === `${TAG}-Q2`);
    } else {
        skip("the refusals against a saved Draft — the Draft or its file is not there to refuse against");
    }

    // --- F -----------------------------------------------------------------
    console.log("\nF — an invoice entered with a file of ours");
    const c2Blob = await uploadPdf("invoice");
    blobUrlC2 = c2Blob.url;
    const invoiceCode = `${TAG}-INV`;
    const entered = await post({
        pageUrl: invoicePage,
        actionId: ids.createInvoiceAction,
        cookie: adminCookie,
        fields: {
            vendorId: vendorRecordId,
            vendorInvoiceCode: invoiceCode,
            issueDate: "2026-09-24",
            amountDue: String(unitPrice),
            shippingFee: "0",
            itemsJson: JSON.stringify([
                {
                    itemName: orderedItem.itemName,
                    size: orderedItem.size || "",
                    unit: orderedItem.unit || "",
                    qty: "1",
                    unitPrice: String(unitPrice),
                    poRecordId: PO_RECORD_ID,
                    poItemRecordId: PO_ITEM_RECORD_ID,
                    remark: "",
                },
            ]),
            invoiceFileUrl: blobUrlC2,
            invoiceFileFilename: "invoice.pdf",
        },
    });
    const invoiceIds = await rowsTagged(TABLES.INVOICES, "Vendor Invoice Code", invoiceCode);
    for (const id of invoiceIds) fixtures.track("invoices", id);
    ok("the invoice is entered", entered.refusal === null && String(entered.redirect ?? "").includes("/invoices/HYE-INV-"), entered.refusal ?? entered.redirect ?? "");
    ok("  as exactly one invoice", invoiceIds.length === 1, String(invoiceIds.length));
    const invoiceFile = invoiceIds[0] ? await ingested(TABLES.INVOICES, invoiceIds[0], "File", blobUrlC2) : null;
    ok("  and Airtable took its file", Boolean(invoiceFile), invoiceFile ? "" : "not ingested within 15s");

    // --- G -----------------------------------------------------------------
    console.log("\nG — a delivery recorded with a photo of ours, and the photo refusals against it");
    const pairingsBefore = await invoicePairings(vendorRecordId);
    const c3Blob = await uploadPdf("packing-list");
    blobUrlC3 = c3Blob.url;
    const deliveryNote = `${TAG} delivery`;
    const recorded = await post({
        pageUrl: deliveryPage,
        actionId: ids.createDeliveryAction,
        cookie: siteCookie,
        fields: {
            jobRecordId,
            vendorRecordId,
            itemsJson: JSON.stringify([{ materialRecordId: orderedItem.material[0], qty: "1" }]),
            receivedDate: "2026-09-24",
            notes: deliveryNote,
            // Narrows allocation to this order, so the delivery can only attach to the
            // ordered item part A checked — and pairing can only reach an invoice
            // charging that one, which is this run's own.
            poId: po.poId,
            deliveryAddressId: addressId,
            packingListUrl: blobUrlC3,
            packingListFilename: "packing.pdf",
        },
    });
    const deliveryIds = await rowsTagged(TABLES.DELIVERIES, "Notes", deliveryNote);
    for (const id of deliveryIds) fixtures.track("deliveries", id);
    ok("the delivery is recorded", recorded.refusal === null && String(recorded.redirect ?? "").includes("/deliveries/HYE-DL-"), recorded.refusal ?? recorded.redirect ?? "");
    ok("  as exactly one delivery", deliveryIds.length === 1, String(deliveryIds.length));
    const photo = deliveryIds[0] ? await ingested(TABLES.DELIVERIES, deliveryIds[0], "Packing List File", blobUrlC3) : null;
    ok("  and Airtable took its photo", Boolean(photo), photo ? "" : "not ingested within 15s");

    const pairingsAfter = await invoicePairings(vendorRecordId);
    const moved = [...pairingsBefore.keys()].filter(
        (id) => !invoiceIds.includes(id) && pairingsAfter.get(id) !== pairingsBefore.get(id)
    );
    ok(`no other invoice of this vendor was paired or unpaired (${pairingsBefore.size} read)`, moved.length === 0, moved.join(", "));

    if (deliveryIds[0] && photo) {
        const deliveryId = (await base(TABLES.DELIVERIES).find(deliveryIds[0])).get("Delivery ID");
        const editPage = `${BASE}/deliveries/${encodeURIComponent(deliveryId)}/edit`;
        const replaceId = await actionIdFor({
            pageUrl: editPage,
            exportName: "replaceDeliveryPhotoAction",
            filename: "app/deliveries/[deliveryId]/actions.js",
            cookie: siteCookie,
        });
        ok("replaceDeliveryPhotoAction's id is found", Boolean(replaceId));
        for (const [kind, url] of Object.entries(FOREIGN)) {
            const reply = await post({
                pageUrl: editPage,
                actionId: replaceId,
                cookie: siteCookie,
                fields: { deliveryId, packingListUrl: url, packingListFilename: "packing.pdf" },
            });
            const now = ((await base(TABLES.DELIVERIES).find(deliveryIds[0])).get("Packing List File") || []).map((f) => f.id);
            ok(`  ${kind} is refused in the missing photo's words`, reply.refusal === REFUSED.replacementPhoto, reply.refusal ?? "no refusal");
            ok("    and the photo is the one it was", JSON.stringify(now) === JSON.stringify([photo.id]));
        }
    } else {
        skip("the photo-replacement refusals — the delivery or its photo is not there");
    }

    // --- H -----------------------------------------------------------------
    console.log("\nH — Edit and continue, refused before the turn is loaded");
    if (!inReview) {
        skip("the base holds no request in review to post against");
    } else {
        const prPage = `${BASE}/prs/${encodeURIComponent(inReview.get("PR ID"))}`;
        const editId = await actionIdFor({
            pageUrl: prPage,
            exportName: "editAndContinueAction",
            filename: "app/prs/[prId]/actions.js",
            cookie: adminCookie,
        });
        ok("editAndContinueAction's id is found", Boolean(editId));
        for (const [kind, url] of Object.entries(FOREIGN)) {
            const before = await requestState(inReview.id);
            const reply = await post({
                pageUrl: prPage,
                actionId: editId,
                cookie: adminCookie,
                fields: {
                    prId: inReview.get("PR ID"),
                    notes: "",
                    itemsJson: "[]",
                    shippingFee: "",
                    newQuotationsJson: JSON.stringify([{ url, filename: "q.pdf", vendorQuotationCode: "" }]),
                },
            });
            const after = await requestState(inReview.id);
            ok(`  ${kind} is refused`, reply.refusal === REFUSED.missingQuotation, reply.refusal ?? "no refusal");
            ok("    and the request is exactly as it was", before === after, before === after ? "" : `${before} -> ${after}`);
        }
    }

    complete = true;
} catch (err) {
    // Not `incomplete`: an unexpected throw is a failure (exit 1), not a part that
    // could not run. The cleanup below still runs either way.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    if (!String(err.message).includes("nothing below may run")) console.error(err.stack);
} finally {
    console.log("\nCleanup");
    for (const url of [blobUrlF1, blobUrlC2, blobUrlC3]) if (url) fixtures.trackBlob(url);
    const teardown = await fixtures.teardown({ complete: complete && !incomplete });
    console.log(`  ${fixtures.describe(teardown)}`);
    if (teardown.leaked.length > 0) {
        pass = false;
        console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
    }
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);
