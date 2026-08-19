// The full demo set — every screen state a data shape can produce, on one Job.
//
// WHAT THIS IS FOR. The demo walks the whole chain from writing a purchase request
// to reconciling an invoice, in front of people who have not seen it before, and it
// has to show every case the app implements. `docs/briefs/` lists 141 conditional
// states across the 21 screens; 62 of them are produced by a DATA SHAPE and the rest
// by acting in the app while people watch. This seeds the 62, plus the starting
// points the live segments need. The other three demo seeds (#165, #166, #167) each
// cover one issue's states; this one covers the set, and deliberately overlaps none
// of them — see MATERIALS ARE THE SCENARIO BOUNDARY below.
//
// MATERIALS ARE THE SCENARIO BOUNDARY, AND IT IS LOAD-BEARING RATHER THAN TIDY.
// Allocation matches delivery candidates on the `Material` link (#18), so two
// scenarios sharing a material make each other's ordered items candidates and
// scramble the allocation each one is trying to show. Every scenario below therefore
// gets its own item name.
//
// THE NAMES CARRY NO MARKER, AND THE CLEANUP FOLLOWS LINKS INSTEAD. An earlier version
// prefixed every item `DEMO26 ` so the cleanup could find its `Materials` rows by
// string — which put the marker on every screen that names a material, on a base whose
// whole point is to be read by people who do not work here. The cleanup walks
// `PO Items."Material"` now, and deletes a material only when EVERY ordered item
// pointing at it is going too, so a row shared with another seed survives.
//
// THE ONE MARKER LEFT IS THE TAG IN `Notes`, which is a small gray line on two detail
// screens and is what the skip check and the cleanup match on. It trails a sentence a
// requester would have written rather than standing alone.
//
// EVERYTHING GOES THROUGH THE PRODUCTION FUNCTIONS, and the reason is `Material`
// again: `lib/materialsCache.js` writes that link at PO-GENERATION time, so a
// hand-made `PO Items` row is invisible to allocation, to both material screens, and
// to the overage apply step. So orders are made by approving a real PR and calling
// `generatePOForApprovedPR`, and invoice variance is computed by the same three
// checks `createInvoiceAction` runs rather than being set by hand.
//
// FOUR THINGS ARE WRITTEN BY HAND BECAUSE THE APP CANNOT WRITE THEM. Each is marked
// at its own call site with the reason, so nobody later reads one as a bug:
//   1. a free-text invoice item (no `PO Item`)      — see FREETEXT
//   2. an over-delivery row with no `PO Item`        — see UNATTRIB
//   3. an Approved PR with no purchase order         — see PO_WAIT
//   4. a PR Signers chain frozen mid-return          — see CHAIN
//
// NOTHING IS BACKDATED, and that is a decision rather than an omission. `lib/ids.js`
// numbers a purchase order by counting the orders whose `Created Date` is today, so
// backdating one mid-run hides it from the next generation — the trap
// seed_material_prices.mjs works around by generating everything first and backdating
// afterwards. Nothing here needs it: the two waiting-list strips count days from
// `Issue Date` and `Received Date`, which are ordinary creation parameters, and the
// awaiting-order strip sorts by `PR ID`, which already encodes the date.
//
// RE-RUNNABLE, PER SCENARIO. Each block checks for its own tag in the Notes of the
// PRs already on the demo Line and skips if it is there, so a run that died halfway
// finishes on the next attempt instead of duplicating what succeeded. One read
// serves every check.
//
// CLEANUP. `--cleanup` deletes what this seed made and nothing else, walking down
// from the tagged PRs. It is the counterpart to the skip checks and uses the same
// tags, so the two cannot disagree about what belongs to this seed.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/demo/seed_full_demo.mjs
//   … --cleanup            delete everything this seed made
//   … --only=OVER,CHAIN    run named scenarios only
//
// SELF-SUFFICIENT ON AN EMPTY BASE, WHICH IS THE ONLY THING THAT PROVES IT. It used
// to name seed_demo_fixtures.mjs as a prerequisite in this header, which held exactly
// as long as somebody read the header. It now CALLS that file's `ensureDemoFixtures()`
// — one implementation of the bootstrap, not two — so the Job, its Line, the vendor,
// both addresses and the scoped fixture account are created if they are not there.
// The one thing it cannot create is a Users row: those appear as a side effect of a
// first magic-link sign-in and in no other way, so a wipe deliberately spares them
// and this throws with a name if the account it needs is gone.
//
// JOB ASSIGNMENTS ARE RESTORED HERE, BECAUSE A WIPE BREAKS THEM AND ONE SCREEN CARES.
// `Users."Assigned Jobs"` is a link, so deleting every Job empties it on every row.
// Nothing about visibility depends on that for the office — `canAccessJobDeliveries`
// and `canViewPR` both short-circuit for President/Admin — but `/prs` hides its Job
// PICKER ENTIRELY from a reader assigned to nothing, so the President would lose the
// filter bar and the brief's "assigned to no jobs" case would stop being a contrast
// with anything. `authz-fixture@` is excluded on purpose and by name: its whole value
// is failing every gate, and CLAUDE.md forbids giving it Jobs.

import { put } from "@vercel/blob";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { base, TABLES } from "../../lib/airtable/client.js";
import { orByRecordId } from "../../lib/airtableFormula.js";
import { createPR, updatePR, getPRByRecordId, getPRsByLine } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { createCorrectionRequest } from "../../lib/airtable/correctionRequests.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId, updatePO } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO, getPOItemByRecordId } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem, getItemsByDelivery } from "../../lib/airtable/deliveryItems.js";
import {
    createInvoice,
    getInvoiceByRecordId,
    updateInvoice,
    linkInvoiceToPO,
    setInvoiceDelivery,
} from "../../lib/airtable/invoices.js";
import {
    createInvoiceItem,
    updateInvoiceItem,
    getItemsByInvoice,
} from "../../lib/airtable/invoiceItems.js";
import { getInvoicedQtyForPOItem } from "../../lib/airtable/poItems.js";
import { checkUnitPriceVariance, checkHeaderVariance } from "../../lib/variance.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getAllVendors, createVendor } from "../../lib/airtable/vendors.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { mergeIdenticalItems } from "../../lib/prItemMerge.js";
import { ensureDemoFixtures } from "./seed_demo_fixtures.mjs";
import { addAssignedJob } from "../../lib/airtable/users.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Lone Star Pipe & Supply";
const UNIT = "EA";

/** The tag that marks a PR as this seed's, and the prefix every item name carries. */
const TAG = "DEMO26";
const tagOf = (scenario) => `[${TAG}:${scenario}]`;

/**
 * A note a person would have written, with the tag trailing it.
 *
 * THE TAG IS ON SCREEN, WHICH IS WHY THE SENTENCE COMES FIRST. `Notes` renders on the
 * delivery detail and in the request's identity block, so a record whose whole note is
 * `[DEMO26:OVER]` shows the room a bare marker where a person's sentence should be.
 * The tag still has to be there — it is what the skip check and the cleanup match on,
 * and both need to be exact — so it sits after the sentence rather than instead of it.
 */
const noteFor = (scenario, sentence) => `${sentence} ${tagOf(scenario)}`.trim();

const args = process.argv.slice(2);
const CLEANUP = args.includes("--cleanup");
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);

// ---------------------------------------------------------------------------
// Fixtures

console.log("=".repeat(72));
console.log(`seed_full_demo — ${CLEANUP ? "CLEANUP" : "the full demo set"}`);
console.log("=".repeat(72));

// THE BOOTSTRAP RUNS FIRST, AND IT RUNS ON A CLEANUP TOO. `--cleanup` reads the
// demo Line to find this seed's requests, so a base with no Line at all would make
// the cleanup silently find nothing rather than report that there was nothing to
// find. Import-not-sync, so on a base that already has them this costs three reads.
await ensureDemoFixtures();

const [lines, vendors, users] = await Promise.all([getAllLines(), getAllVendors(), getActiveUsers()]);

const line = lines.find((l) => (l.lineLabel || "").startsWith(JOB_CODE));
if (!line) throw new Error(`no Line on ${JOB_CODE} — ensureDemoFixtures() should have made one`);
const vendor = vendors.find((v) => v.vendorName === VENDOR_NAME);
if (!vendor) throw new Error(`no vendor "${VENDOR_NAME}" — ensureDemoFixtures() should have made one`);

// The President is the one account that can sign an order, so the seed needs it to
// produce a signed one.
const president = users.find((u) => u.role === "President");

// THE TWO FIXTURE ACCOUNTS ARE EXCLUDED FROM THE SIGNING CHAINS, and that is not
// tidiness. `canViewPR` admits a signer on the chain, ahead of any Job scope — so
// making `scoped-fixture@` a signer here would hand it visibility of requests it is
// not assigned to, and the permission contrast the demo's last act rests on would
// quietly stop being true. Their whole value is that their scope is exactly one
// thing; a seed that widens it has broken them for every later check as well.
const FIXTURE_ACCOUNTS = ["authz-fixture@", "scoped-fixture@"];
const isFixture = (u) => FIXTURE_ACCOUNTS.some((p) => (u.email || "").startsWith(p));

const requester = users.find((u) => (u.email || "").startsWith("soohyun.c@")) ?? users.find((u) => !isFixture(u));
if (!requester) throw new Error("no active non-fixture user to raise the PRs as");
const chainable = users.filter((u) => !isFixture(u) && u.id !== requester.id);
const signerA = chainable[0] ?? requester;
const signerB = chainable[1] ?? signerA;
if (chainable.length < 2) {
    console.warn("  WARN  fewer than two non-fixture signers — the chains will repeat a person");
}

// The three accounts the demo actually signs in as. `scoped-fixture@` is already
// assigned by `ensureDemoFixtures`; these two are not, and both need the Job picker.
for (const account of [requester, president].filter(Boolean)) {
    await addAssignedJob(account.id, line.jobId);
}

console.log(`job        ${JOB_CODE}`);
console.log(`line       ${line.lineLabel}`);
console.log(`vendor     ${vendor.vendorName}`);
console.log(`requester  ${requester.userName} <${requester.email}>`);
console.log(`signers    ${signerA.userName}, ${signerB.userName}`);
console.log(`president  ${president ? president.userName : "(none — signed orders will be skipped)"}`);

/** Every PR already on the demo Line, read once and reused by every skip check. */
const existingPRs = await getPRsByLine(line.id);
const seeded = new Set(
    existingPRs.flatMap((pr) => [...String(pr.notes || "").matchAll(/\[DEMO26:([A-Z_]+)\]/g)].map((m) => m[1]))
);

const ids = {};

// ---------------------------------------------------------------------------
// Helpers

/**
 * One scenario, skipped if its tag is already on the base.
 *
 * KEYED ON THE PR's NOTES RATHER THAN ON A MATERIALS ROW, which is what the other
 * demo seeds check. A Materials row is written at PO generation, so a scenario that
 * deliberately has no order — PO_WAIT is the whole point of one — would have nothing
 * to check and would be recreated on every run. Every scenario here starts from a PR,
 * so the tag is on all of them.
 */
async function scenario(name, describe, body) {
    if (ONLY.length && !ONLY.includes(name)) return;
    if (seeded.has(name)) {
        console.log(`  [SKIP]   ${name.padEnd(14)} already on the base`);
        return;
    }
    try {
        await body();
        console.log(`  [CREATE] ${name.padEnd(14)} ${describe}`);
    } catch (err) {
        console.error(`  [FAIL]   ${name.padEnd(14)} ${err.message}`);
        throw err;
    }
}

/**
 * A one-page PDF standing in for a vendor's document.
 *
 * BUILT WITH `pdf-lib` RATHER THAN BY HAND, and the reason is measured. A hand-rolled
 * PDF wrote its own cross-reference table and content-stream `/Length`, and the length
 * was one byte short of what the parser wanted: `pdf-parse` extracted
 * `HYE-PO-20260819-2` from a file whose text ended `…-27`, so the two-order detection
 * case silently found one order instead of two. `pdf-lib` is already a dependency —
 * `make-invoice-pdf.mjs` builds the live demo's invoice with it — so this costs
 * nothing and the bytes are somebody else's problem.
 *
 * `drawText` PER LINE, because the detection regex reads whatever the extractor
 * returns and a single run holding two order numbers is the case that broke.
 */
async function pdfBytes(lines) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([420, 120]);
    (Array.isArray(lines) ? lines : [lines]).forEach((line, i) => {
        page.drawText(String(line), { x: 24, y: 90 - i * 18, size: 11, font });
    });
    return Buffer.from(await doc.save());
}

/**
 * Raise a PR, approve it, and generate its order.
 *
 * `items` is a list of `{ itemName, size, qty, unitPrice, remark }`. The PR is left at
 * `Approved` and the order at `Awaiting Signature` unless `sign` is passed.
 */
async function makeOrder({ scenarioName, subTag = null, items, shippingFee = null, notes = "", signers = 1, sign = false }) {
    // A SECOND TAG WHERE A SCENARIO RAISES SEVERAL ORDERS, and it is what keeps the
    // guide honest. The first version looked its ids up by position in a sorted list,
    // which is a guess about creation order — and it was wrong for two of the four
    // detection orders the moment anything was re-seeded. Both tags go in the Notes:
    // the scenario's own so the skip check still finds it, and the sub-tag so the
    // guide can ask for `DETECT_WITHDRAWN` by name.
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: `${notes} ${tagOf(scenarioName)}${subTag ? tagOf(subTag) : ""}`.trim(),
    });
    for (const it of items) {
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            itemName: it.itemName,
            size: it.size || "",
            // `??`, NOT `||`: NO_SIZE passes an EMPTY unit on purpose, and `||` read
            // that as "unset" and substituted the default, so the material still had
            // a unit and the subtitle still rendered. `createItem` omits an empty
            // Unit rather than sending "", which a single select refuses.
            unit: it.unit ?? UNIT,
            qty: it.qty,
            unitPrice: it.unitPrice,
            remark: it.remark || "",
        });
    }
    for (let i = 0; i < signers; i++) {
        await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: (i === 0 ? signerA : signerB).id,
            sequenceOrder: i + 1,
            confirmationType: i === 0 ? "Approval" : "Agreement",
        });
    }
    if (shippingFee !== null) await updatePR(pr.id, { shippingFee });
    await updatePR(pr.id, { status: "Approved" });

    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    let po = await getPOByRecordId(gen.poRecordId);
    if (sign && president) {
        await updatePO(po.id, {
            presidentSigned: true,
            presidentSignedAt: new Date().toISOString(),
            status: "Signed",
        });
        await updatePR(pr.id, { status: "PO Signed" });
        po = await getPOByRecordId(po.id);
    }
    return { pr, po, poItems: await getItemsByPO(gen.poRecordId) };
}

/** Record an arrival. `rows` is `{ poItem, qty, over }` per allocated slice. */
async function deliver({ scenarioName, rows, receivedDate, packingListPO = null, notes = "" }) {
    const delivery = await createDelivery({
        jobRecordId: line.jobId,
        vendorRecordId: vendor.id,
        packingListPORecordId: packingListPO,
        receivedDate,
        recordedByUserId: requester.id,
        notes: noteFor(scenarioName, notes),
        // No packing-list photo, on purpose: it gives the delivery detail's
        // "reload in a moment if it was just uploaded" state for free, and every
        // arrival recorded live during the demo will have one to contrast with.
        file: [],
    });
    for (const r of rows) {
        await createDeliveryItem({
            deliveryRecordId: delivery.id,
            deliveryId: delivery.deliveryId,
            poItemRecordId: r.poItem.id,
            materialRecordId: r.poItem.material?.[0] ?? null,
            itemName: r.poItem.itemName,
            size: r.poItem.size,
            unit: r.poItem.unit,
            qty: r.qty,
            overDelivered: Boolean(r.over),
        });
    }
    return (await getDeliveriesByRecordIds([delivery.id]))[0];
}

/** Wait for Airtable to fetch its own copy of an attachment we just handed it. */
async function waitForIngest(invoiceRecordId, submittedUrl) {
    for (let i = 0; i < 40; i++) {
        const fresh = await getInvoiceByRecordId(invoiceRecordId);
        const url = fresh.file?.[0]?.url;
        if (url && url !== submittedUrl) return fresh;
        await new Promise((r) => setTimeout(r, 300));
    }
    return await getInvoiceByRecordId(invoiceRecordId);
}

/**
 * Enter a bill.
 *
 * VARIANCE IS COMPUTED, NEVER SET, and it runs the same three checks in the same
 * order `createInvoiceAction` does — unit price against the order, cumulative
 * invoiced quantity against the ordered quantity, then the header total against the
 * calculated one, read back fresh so the rollup has caught up. A hand-set flag would
 * be this seed asserting what the app decides.
 */
async function bill({
    scenarioName,
    rows,
    issueDate,
    dueDate = "2026-09-30",
    amountDue = null,
    shippingFee = 0,
    tariff = null,
    paid = false,
    withFile = true,
    vendorInvoiceCode = null,
}) {
    // THE VENDOR'S OWN NUMBER, WHICH IS ON TWO SCREENS. `Vendor Invoice #` renders on
    // the invoice detail and in grey on the order's invoice list, so `DEMO26-VAR_TOTAL`
    // was a marker sitting where a supplier's document number belongs. This reads like
    // one and still carries the scenario, which is what the guide and the cleanup
    // match on — there is no free-text field on `Invoices` to hide a tag in.
    const code =
        vendorInvoiceCode ?? `LSP-${scenarioName.replace(/_/g, "")}-${(issueDate || "").slice(5).replace("-", "")}`;
    let submittedUrl = null;
    let file = [];
    if (withFile) {
        const blob = await put(`${code}.pdf`, await pdfBytes([`INVOICE ${code}`]), {
            access: "public",
            contentType: "application/pdf",
            addRandomSuffix: true,
        });
        submittedUrl = blob.url;
        file = [{ url: blob.url, filename: `${code}.pdf` }];
    }

    const computed = rows.reduce((t, r) => t + r.qty * r.unitPrice, 0) + shippingFee + (tariff || 0);
    const invoice = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: code,
        issueDate,
        dueDate,
        amountDue: amountDue ?? computed,
        shippingFee,
        ...(tariff !== null ? { tariff } : {}),
        file,
    });

    const poRecordIds = new Set();
    for (const r of rows) {
        await createInvoiceItem({
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            poRecordId: r.poItem ? r.po.id : null,
            poItemRecordId: r.poItem ? r.poItem.id : null,
            itemName: r.poItem ? r.poItem.itemName : r.itemName,
            size: r.poItem ? r.poItem.size : "",
            unit: r.poItem ? r.poItem.unit : "",
            qty: r.qty,
            unitPrice: r.unitPrice,
            remark: r.remark || "",
        });
        if (r.poItem) poRecordIds.add(r.po.id);
    }
    for (const poRecordId of poRecordIds) await linkInvoiceToPO(invoice.id, poRecordId);

    // The action's own variance pass, in its own order.
    for (const created of await getItemsByInvoice(invoice.id)) {
        const poItemRecordId = created.poItem?.[0];
        if (!poItemRecordId) continue;
        const poItem = await getPOItemByRecordId(poItemRecordId);
        const priceOff = checkUnitPriceVariance(created.unitPrice, poItem.unitPrice);
        const qtyOff = (await getInvoicedQtyForPOItem(poItemRecordId)) > poItem.qty;
        if (priceOff || qtyOff) await updateInvoiceItem(created.id, { varianceFlag: true });
    }
    const afterItems = await getInvoiceByRecordId(invoice.id);
    if (checkHeaderVariance(afterItems.amountDue, afterItems.calculatedTotal || 0)) {
        await updateInvoice(invoice.id, { varianceFlag: true });
    }
    if (paid) await updateInvoice(invoice.id, { paid: true, paidDate: "2026-08-14" });

    return withFile ? await waitForIngest(invoice.id, submittedUrl) : await getInvoiceByRecordId(invoice.id);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

if (CLEANUP) {
    // `--only` NARROWS THE CLEANUP THE SAME WAY IT NARROWS THE SEED, so a scenario
    // whose shape turned out wrong can be dropped and rebuilt without touching the
    // other 29 — which is what a seed this size needs, since a full redo is 600 ops.
    const mine = existingPRs.filter((pr) => {
        const notes = String(pr.notes || "");
        if (!notes.includes(`[${TAG}:`)) return false;
        if (!ONLY.length) return true;
        return ONLY.some((name) => notes.includes(tagOf(name)));
    });
    if (mine.length === 0) {
        console.log("\nNothing tagged by this seed is on the base.");
        process.exit(0);
    }

    // Walk down from the PRs. Deliveries and invoices are reached through the orders
    // rather than through their own tags, because an invoice this seed created can
    // have been attached to a delivery by hand during a rehearsal — the link is the
    // truth about what belongs to the set, not a string somebody could have edited.
    const poRecordIds = mine.flatMap((pr) => pr.purchaseOrders || []);
    const poItemRecordIds = [];
    for (const poRecordId of poRecordIds) {
        for (const it of await getItemsByPO(poRecordId)) poItemRecordIds.push(it.id);
    }

    const allDeliveryItems = await base(TABLES.DELIVERY_ITEMS).select().all();
    const allInvoiceItems = await base(TABLES.INVOICE_ITEMS).select().all();
    const poItemSet = new Set(poItemRecordIds);

    const deliveryItemIds = allDeliveryItems
        .filter((r) => (r.get("PO Item") || []).some((id) => poItemSet.has(id)))
        .map((r) => r.id);
    const deliveryIds = [
        ...new Set(
            allDeliveryItems
                .filter((r) => deliveryItemIds.includes(r.id))
                .flatMap((r) => r.get("Delivery") || [])
        ),
    ];
    const invoiceItemIds = allInvoiceItems
        .filter((r) => (r.get("PO Item") || []).some((id) => poItemSet.has(id)))
        .map((r) => r.id);
    const invoiceIds = [
        ...new Set(
            allInvoiceItems
                .filter((r) => invoiceItemIds.includes(r.id))
                .flatMap((r) => r.get("Invoice") || [])
        ),
    ];
    // A tagged invoice's OTHER rows — the free-text one, which names no PO Item and so
    // is not reachable by the walk above.
    const orphanItemIds = allInvoiceItems
        .filter((r) => (r.get("Invoice") || []).some((id) => invoiceIds.includes(id)))
        .map((r) => r.id);

    const links = await base(TABLES.INVOICE_PO_LINK).select().all();
    const linkIds = links
        .filter((r) => (r.get("PO") || []).some((id) => poRecordIds.includes(id)))
        .map((r) => r.id);

    // Every child level is already on the PR record as a reverse-link array (#193),
    // so none of these costs a read.
    const plan = [
        ["Invoice Items", TABLES.INVOICE_ITEMS, [...new Set([...invoiceItemIds, ...orphanItemIds])]],
        ["Invoice-PO Link", TABLES.INVOICE_PO_LINK, linkIds],
        ["Invoices", TABLES.INVOICES, invoiceIds],
        ["Delivery Items", TABLES.DELIVERY_ITEMS, deliveryItemIds],
        ["Deliveries", TABLES.DELIVERIES, deliveryIds],
        ["PO Items", TABLES.PO_ITEMS, poItemRecordIds],
        ["Purchase Orders", TABLES.PURCHASE_ORDERS, poRecordIds],
        ["Edit Log", TABLES.EDIT_LOG, mine.flatMap((pr) => pr.editLogRowIds || [])],
        ["Correction Requests", TABLES.CORRECTION_REQUESTS, mine.flatMap((pr) => pr.correctionRowIds || [])],
        ["Quotations", TABLES.QUOTATIONS, mine.flatMap((pr) => pr.quotationRowIds || [])],
        ["PR Signers", TABLES.PR_SIGNERS, mine.flatMap((pr) => pr.signerRowIds || [])],
        ["PR Items", TABLES.PR_ITEMS, mine.flatMap((pr) => pr.itemRowIds || [])],
        ["Purchase Requests", TABLES.PURCHASE_REQUESTS, mine.map((pr) => pr.id)],
    ];

    console.log("\nDeleting, children first:");
    let total = 0;
    for (const [label, table, recordIds] of plan) {
        const unique = [...new Set(recordIds)].filter(Boolean);
        for (let i = 0; i < unique.length; i += 10) {
            await base(table).destroy(unique.slice(i, i + 10));
        }
        console.log(`  ${String(unique.length).padStart(4)}  ${label}`);
        total += unique.length;
    }
    // THE ITEM AXIS IS SWEPT ONLY ON A FULL CLEANUP, AND THE NARROW CASE IS WHY.
    // A `Materials` row is keyed on Item Name + Size + Unit and knows nothing about
    // which scenario raised it, so there is no way to narrow this sweep to `--only`'s
    // scope — a first version tried the prefix alone and a `--cleanup --only=PRICES`
    // took all 31 of this seed's materials with it, leaving every OTHER scenario's
    // ordered items with a dangling `Material` link. That is not cosmetic: allocation
    // matches candidates on that link (#18), so the delivery form stops offering the
    // items and both material screens go blank. Narrow cleanups therefore leave the
    // axis alone and a stale price row behind, which the next full run clears.
    if (ONLY.length) {
        console.log("");
        console.log("  Item axis left alone — `--only` cannot scope a Materials row.");
        console.log("  A stale price row may remain; a full --cleanup sweeps it.");
        console.log("");
        console.log(`${total} records deleted.`);
        process.exit(0);
    }

    // THE ITEM AXIS GOES TOO, AND LEAVING IT BEHIND WAS A REAL DEFECT. `Material
    // Prices` is a latest-value CACHE keyed on material x vendor, so a run that
    // deleted the orders and spared the cache left a price row pointing at an order
    // that no longer exists — measured, it rendered on /materials with an em dash for
    // both Qty and Order, which reads as a broken row rather than as a stale cache.
    //
    // FOUND BY LINK, AND A SHARED ROW SURVIVES. A `Materials` row is an item's
    // identity, not one seed's record, so it is deleted only when EVERY ordered item
    // pointing at it is in the set going. That is what lets the item names carry no
    // marker: the previous version matched a name prefix, which put that prefix on
    // every screen in the app that names a material.
    const goingPoItems = new Set(poItemRecordIds);
    const materials = (await base(TABLES.MATERIALS).select({ fields: ["PO Items"] }).all()).filter((r) => {
        const pointing = r.get("PO Items") || [];
        return pointing.length > 0 && pointing.every((id) => goingPoItems.has(id));
    });
    const materialIds = materials.map((r) => r.id);
    const materialIdSet = new Set(materialIds);
    const prices = (await base(TABLES.MATERIAL_PRICES).select({ fields: ["Material"] }).all()).filter((r) =>
        (r.get("Material") || []).some((id) => materialIdSet.has(id))
    );
    for (const [label, table, recordIds] of [
        ["Material Prices", TABLES.MATERIAL_PRICES, prices.map((r) => r.id)],
        ["Materials", TABLES.MATERIALS, materialIds],
    ]) {
        for (let i = 0; i < recordIds.length; i += 10) {
            await base(table).destroy(recordIds.slice(i, i + 10));
        }
        console.log(`  ${String(recordIds.length).padStart(4)}  ${label}`);
        total += recordIds.length;
    }

    console.log("");
    console.log(`${total} records deleted.`);
    process.exit(0);
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

console.log("\nSeeding:");

// --- DUP — the prior request the live duplicate warning fires against -------
//
// THE KEY IS THE POST-MERGE SHAPE, WHICH IS THE ONE THING THAT MAKES THIS WORK.
// `parseFormState` runs `mergeIdenticalItems` BEFORE `findDuplicatePR`, so typing two
// rows of 5 on stage produces a single key of 10 — and a prior PR carrying two rows
// of 5 would not match it. The assertion below is not decoration: it is the whole
// scenario, and it is checked here rather than discovered in front of the room.
await scenario("DUP", "the request the live duplicate warning names", async () => {
    const LIVE_ROWS = [
        { itemName: "Gate Valve", size: '4"', unit: UNIT, qty: 5, unitPrice: 45 },
        { itemName: "Gate Valve", size: '4"', unit: UNIT, qty: 5, unitPrice: 45 },
    ];
    const merged = mergeIdenticalItems(LIVE_ROWS);
    const key = (its) =>
        its
            .map((i) => `${i.itemName.trim().toLowerCase()}|${parseFloat(i.qty)}|${parseFloat(i.unitPrice)}`)
            .sort()
            .join(",");

    const SEEDED_ROWS = [{ itemName: "Gate Valve", size: '4"', unit: UNIT, qty: 10, unitPrice: 45 }];
    if (key(merged) !== key(SEEDED_ROWS)) {
        throw new Error(
            `the duplicate key would not match: typing two rows of 5 merges to "${key(merged)}" ` +
                `but this seed stores "${key(SEEDED_ROWS)}". Fix the seeded quantities, not the check.`
        );
    }

    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: noteFor("DUP", "Gate valves for the pump house."),
    });
    for (const it of SEEDED_ROWS) {
        await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", ...it });
    }
    await createSigner({
        prRecordId: pr.id,
        prId: pr.prId,
        signerUserId: signerA.id,
        sequenceOrder: 1,
        confirmationType: "Approval",
    });
    await updatePR(pr.id, { status: "In Review", currentSignerStep: 1 });
    ids.dup = pr.prId;
});

// --- CHAIN — all four signing-chain step states at once ---------------------
await scenario("CHAIN", "four step states: done, current, paused, not reached", async () => {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: noteFor("CHAIN", "Anchor bolts for the equipment pads."),
    });
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: "Anchor Bolt",
        size: 'M16 x 200',
        unit: UNIT,
        qty: 60,
        unitPrice: 3.4,
        remark: "",
    });
    const created = [];
    for (let i = 0; i < 3; i++) {
        created.push(
            await createSigner({
                prRecordId: pr.id,
                prId: pr.prId,
                signerUserId: [signerA, signerB, president ?? signerA][i].id,
                sequenceOrder: i + 1,
                confirmationType: i === 1 ? "Agreement" : "Approval",
            })
        );
    }
    // HAND-WRITTEN, AND THE APP CANNOT LEAVE A CHAIN HERE IN ONE STEP. Reaching this
    // state through the app means approving as signer 1, then returning as signer 2 —
    // two sessions as two people. `lib/prSigning.js` derives the four categories from
    // (PR status, currentSignerStep, each signer's Status), so writing those three is
    // writing exactly what the two actions would have left behind: signer 2 Returned
    // is `paused`, signer 1 back at Pending while the step points at it is `current`,
    // and signer 3 untouched is `not-reached`.
    await base(TABLES.PR_SIGNERS).update(created[1].id, { Status: "Returned" });
    await createCorrectionRequest({
        prRecordId: pr.id,
        prId: pr.prId,
        initiatedById: signerB.id,
        sentToId: signerA.id,
        notes: "The size on the anchor bolt does not match the drawing — please confirm before I agree.",
    });
    await updatePR(pr.id, { status: "In Review", currentSignerStep: 1 });
    ids.chain = pr.prId;
});

// --- WITHDRAWN_PR — a frozen chain and a dimmed row ------------------------
await scenario("WITHDRAWN_PR", "withdrawn request, chain frozen where it got to", async () => {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: noteFor("WITHDRAWN_PR", "Scaffold planks — site is hiring these instead."),
    });
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: "Scaffold Plank",
        size: '3m',
        unit: UNIT,
        qty: 24,
        unitPrice: 28,
        remark: "",
    });
    await createSigner({
        prRecordId: pr.id,
        prId: pr.prId,
        signerUserId: signerA.id,
        sequenceOrder: 1,
        confirmationType: "Approval",
    });
    await updatePR(pr.id, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });
    ids.withdrawnPr = pr.prId;
});

// --- PO_WAIT — approved requests with no order -----------------------------
//
// HAND-WRITTEN, BECAUSE ONLY A FAILURE PRODUCES IT. Generation runs inside the
// approving action and is never retried on its own, so the app reaches this state
// only when `generatePOForApprovedPR` threw. That is exactly what the strip's copy
// says, and why it refuses the word `yet`. Approving without generating is the state
// itself rather than a shortcut to it.
await scenario("PO_WAIT", "2 approved requests whose order generation failed", async () => {
    for (const [n, item] of [
        [1, { itemName: "Weld Rod", size: "3.2mm", qty: 40, unitPrice: 6.5 }],
        [2, { itemName: "Grinding Disc", size: '7"', qty: 80, unitPrice: 2.75 }],
    ]) {
        const pr = await createPR({
            requesterId: requester.id,
            lineId: line.id,
            vendorId: vendor.id,
            notes: noteFor("PO_WAIT", n === 1 ? "Welding rod for the pipe crew." : "Grinding discs, monthly restock."),
        });
        await createItem({ prRecordId: pr.id, prId: pr.prId, unit: UNIT, remark: "", ...item });
        await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: signerA.id,
            sequenceOrder: 1,
            confirmationType: "Approval",
        });
        await updatePR(pr.id, { status: "Approved" });
        ids[`poWait${n}`] = pr.prId;
    }
});

// --- CHIP_SET — all four invoicing values, and the dash ---------------------
await scenario("CHIP_SET", "Invoiced, Partly invoiced, Awaiting invoice, and the dash", async () => {
    // Invoiced — billed in full.
    const full = await makeOrder({
        scenarioName: "CHIP_SET",
        subTag: "CHIP_INVOICED",
        notes: "Butterfly valves for the pump skid.",
        items: [{ itemName: "Butterfly Valve", size: '6"', qty: 8, unitPrice: 120 }],
        sign: true,
    });
    await bill({
        scenarioName: "CHIP_SET_FULL",
        rows: [{ po: full.po, poItem: full.poItems[0], qty: 8, unitPrice: 120 }],
        issueDate: "2026-08-10",
    });
    ids.chipInvoiced = full.po.poId;

    // Partly invoiced — half billed.
    const part = await makeOrder({
        scenarioName: "CHIP_SET",
        subTag: "CHIP_PARTLY",
        notes: "Check valves — vendor is shipping these in two batches.",
        items: [{ itemName: "Check Valve", size: '3"', qty: 10, unitPrice: 88 }],
        sign: true,
    });
    await bill({
        scenarioName: "CHIP_SET_PART",
        rows: [{ po: part.po, poItem: part.poItems[0], qty: 4, unitPrice: 88 }],
        issueDate: "2026-08-11",
    });
    ids.chipPartly = part.po.poId;

    // Awaiting invoice — nothing billed.
    const none = await makeOrder({
        scenarioName: "CHIP_SET",
        subTag: "CHIP_AWAITING",
        notes: "Ball valves for the header run.",
        items: [{ itemName: "Ball Valve", size: '2"', qty: 12, unitPrice: 54 }],
        sign: true,
    });
    ids.chipAwaiting = none.po.poId;

    // The dash — a withdrawn order, whose every ordered item has Committed Qty 0.
    const gone = await makeOrder({
        scenarioName: "CHIP_SET",
        subTag: "CHIP_DASH",
        notes: "Globe valves — design changed, we no longer need these.",
        items: [{ itemName: "Globe Valve", size: '4"', qty: 6, unitPrice: 96 }],
    });
    await updatePO(gone.po.id, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });
    ids.chipDash = gone.po.poId;
});

// --- DL_WAIT — an arrival nobody has billed --------------------------------
//
// The starting point for the live invoice entry: entering a bill against this order
// pairs it with this arrival while the room watches.
await scenario("DL_WAIT", "an arrival waiting for a bill — strip 1's row", async () => {
    // TWO MATERIALS ON ONE ARRIVAL, WHICH IS THE ONLY PLACE THIS SEED SHOWS THE `+N`
    // CHIP. The deliveries list folds an arrival into its first item plus a count, and
    // the count renders only above one material — every other scenario here brings a
    // single item, so without this the chip has no producer once the older demo data
    // is deleted. It rides on this scenario rather than getting its own because the
    // awaiting-invoice strip reads the same summary function, so one arrival with two
    // items proves the fold in both places at once.
    const order = await makeOrder({
        scenarioName: "DL_WAIT",
        notes: "Pipe supports and clamps for level 2.",
        items: [
            { itemName: "Pipe Support", size: '4"', qty: 30, unitPrice: 22 },
            { itemName: "Support Shim", size: '3mm', qty: 90, unitPrice: 1.4 },
        ],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "DL_WAIT",
        rows: [
            { poItem: order.poItems[0], qty: 30 },
            { poItem: order.poItems[1], qty: 90 },
        ],
        receivedDate: "2026-08-10",
        packingListPO: order.po.id,
        notes: "Pallet matched the packing list, PO number was printed on it.",
    });
    ids.dlWait = arrival.deliveryId;
    ids.dlWaitPo = order.po.poId;
});

// --- INV_WAIT_A — a bill and nothing delivered -----------------------------
await scenario("INV_WAIT_A", "a bill with nothing delivered — strip 2, first word", async () => {
    const order = await makeOrder({
        scenarioName: "INV_WAIT_A",
        notes: "Flange gaskets, full set for the tie-in.",
        items: [{ itemName: "Flange Gasket", size: '8"', qty: 50, unitPrice: 9 }],
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "INV_WAIT_A",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 50, unitPrice: 9 }],
        issueDate: "2026-08-07",
    });
    ids.invWaitA = invoice.invoiceId;
    ids.invWaitAPo = order.po.poId;
});

// --- INV_WAIT_B — delivered, and nothing paired them -----------------------
await scenario("INV_WAIT_B", "delivered but unmatched — strip 2, second word", async () => {
    const order = await makeOrder({
        scenarioName: "INV_WAIT_B",
        notes: "U-bolts for the rack.",
        items: [{ itemName: "U-Bolt", size: 'M12', qty: 100, unitPrice: 1.8 }],
        sign: true,
    });
    await deliver({
        scenarioName: "INV_WAIT_B",
        rows: [{ poItem: order.poItems[0], qty: 100 }],
        receivedDate: "2026-08-12",
    });
    const invoice = await bill({
        scenarioName: "INV_WAIT_B",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 100, unitPrice: 1.8 }],
        issueDate: "2026-08-13",
    });
    ids.invWaitB = invoice.invoiceId;
});

// --- MISMATCH_START — a bill of 10 against an order nothing has filled ------
//
// The live segment records an arrival of 3 against this. The set of ordered items
// matches, so `fitRefusal` admits it and `roomOnOrderedItem` is 3 — positive — so the
// pairing is computed and the invoice turns `Mismatch`. Quantity is deliberately not
// part of the containment test (lib/deliveryInvoiceMatch.js), which is the whole
// reason the marker can ever appear.
await scenario("MISMATCH_START", "a bill of 10 waiting for the live arrival of 3", async () => {
    const order = await makeOrder({
        scenarioName: "MISMATCH_START",
        notes: "Steel pipe for the main run.",
        items: [{ itemName: "Steel Pipe", size: '2" SCH40', qty: 10, unitPrice: 210 }],
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "MISMATCH_START",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 10, unitPrice: 210 }],
        issueDate: "2026-08-15",
    });
    ids.mismatchInvoice = invoice.invoiceId;
    ids.mismatchPo = order.po.poId;
});

// --- HAND_ATTACH — the pairing the computed rule refuses -------------------
//
// An arrival that brought one thing, and a bill from the same vendor charging
// SOMETHING ELSE. `fitRefusal` returns `not-contained`, so nothing is computed onto
// it — but `invoiceLinkRefusal` (the delivery's own Edit page) tests only existence,
// visibility, vendor and whether the bill is already taken, and has NO containment
// check. So the pairing is made by hand on stage in four clicks, which is #210's
// premise exactly: the pairing is a fact somebody knows and the app was guessing at.
await scenario("HAND_ATTACH", "an arrival and a bill the computed rule will not pair", async () => {
    const brought = await makeOrder({
        scenarioName: "HAND_ATTACH",
        notes: "Elbows for the riser.",
        items: [{ itemName: "Elbow 90", size: '3"', qty: 20, unitPrice: 17 }],
        sign: true,
    });
    const charged = await makeOrder({
        scenarioName: "HAND_ATTACH",
        notes: "Reducing tees — still waiting on these.",
        items: [{ itemName: "Reducing Tee", size: '3x2"', qty: 7, unitPrice: 41 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "HAND_ATTACH",
        rows: [{ poItem: brought.poItems[0], qty: 20 }],
        receivedDate: "2026-08-14",
    });
    const invoice = await bill({
        scenarioName: "HAND_ATTACH",
        rows: [{ po: charged.po, poItem: charged.poItems[0], qty: 7, unitPrice: 41 }],
        issueDate: "2026-08-14",
    });
    ids.handAttachDelivery = arrival.deliveryId;
    ids.handAttachInvoice = invoice.invoiceId;
});

// --- VAR_PRICE — a charge the order did not agree --------------------------
await scenario("VAR_PRICE", "a charge at a price the order did not agree", async () => {
    const order = await makeOrder({
        scenarioName: "VAR_PRICE",
        notes: "Pressure gauges for the test package.",
        items: [{ itemName: "Pressure Gauge", size: '0-300 PSI', qty: 6, unitPrice: 75 }],
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "VAR_PRICE",
        rows: [
            {
                po: order.po,
                poItem: order.poItems[0],
                qty: 6,
                unitPrice: 92,
                remark: "Vendor says the price moved after the quotation.",
            },
        ],
        issueDate: "2026-08-12",
    });
    ids.varPrice = invoice.invoiceId;
    ids.varPricePo = order.po.poId;
});

// --- VAR_TOTAL — the stated total disagrees with its own arithmetic, and paid
//
// BOTH FACTS ON ONE ROW ON PURPOSE. The invoice list stacks the red badge UNDER the
// payment word rather than beside it, and that stacking is only visible on an invoice
// that is both paid and flagged.
await scenario("VAR_TOTAL", "stated total ≠ computed total, and already paid", async () => {
    const order = await makeOrder({
        scenarioName: "VAR_TOTAL",
        notes: "Cable tray for the east wall.",
        items: [{ itemName: "Cable Tray", size: '300mm', qty: 40, unitPrice: 33 }],
        shippingFee: 150,
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "VAR_TOTAL",
        // BOTH VARIANCE KINDS ON ONE BILL, WHICH IS WHAT MAKES THE ORDER'S OWN PAGE
        // DEMONSTRABLE. `/pos/[poId]` is the one screen in the app that can show the
        // pair at once — `⚠ Check the total` on the invoice's line and `⚠ Order
        // variance` on the charge beneath it — and it is the whole reason #179 made
        // them two different words. A first pass gave this bill only the header
        // variance, so no order anywhere carried both and the distinction had nothing
        // to stand on. 39 against the 33 the order agreed is the item-level half.
        rows: [
            {
                po: order.po,
                poItem: order.poItems[0],
                qty: 40,
                unitPrice: 39,
                remark: "Vendor invoiced at their list price, not the quoted one.",
            },
        ],
        shippingFee: 150,
        // 40 x 39 + 150 = 1710. The vendor's document says 1620, so the header
        // disagrees as well — two different facts with two different remedies.
        amountDue: 1620,
        issueDate: "2026-08-09",
        paid: true,
    });
    ids.varTotal = invoice.invoiceId;
});

// --- TARIFF — the fourth row in the totals footer --------------------------
await scenario("TARIFF", "an invoice carrying a tariff", async () => {
    const order = await makeOrder({
        scenarioName: "TARIFF",
        notes: "Stainless sheet, imported — expect duty on the invoice.",
        items: [{ itemName: "Stainless Sheet", size: '1.2mm', qty: 15, unitPrice: 190 }],
        shippingFee: 220,
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "TARIFF",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 15, unitPrice: 190 }],
        shippingFee: 220,
        tariff: 385,
        issueDate: "2026-08-08",
    });
    ids.tariff = invoice.invoiceId;
});

// --- MULTI_ORDER — one bill across two orders ------------------------------
await scenario("MULTI_ORDER", "one bill charging two orders, item sets differing", async () => {
    const first = await makeOrder({
        scenarioName: "MULTI_ORDER",
        notes: "Conduit and clips for the lighting circuit.",
        items: [
            { itemName: "Conduit", size: '25mm', qty: 60, unitPrice: 11 },
            { itemName: "Conduit Clip", size: '25mm', qty: 120, unitPrice: 0.9 },
        ],
        sign: true,
    });
    const second = await makeOrder({
        scenarioName: "MULTI_ORDER",
        notes: "Junction boxes, same lighting circuit.",
        items: [{ itemName: "Junction Box", size: '4x4"', qty: 25, unitPrice: 14 }],
        sign: true,
    });
    const invoice = await bill({
        scenarioName: "MULTI_ORDER",
        rows: [
            { po: first.po, poItem: first.poItems[0], qty: 60, unitPrice: 11 },
            { po: first.po, poItem: first.poItems[1], qty: 120, unitPrice: 0.9 },
            { po: second.po, poItem: second.poItems[0], qty: 25, unitPrice: 14 },
        ],
        issueDate: "2026-08-11",
    });
    ids.multiOrder = invoice.invoiceId;
    ids.multiOrderPo = first.po.poId;
});

// --- FREETEXT — an invoice item with no ordered item behind it -------------
//
// HAND-WRITTEN, BECAUSE THE FORM CANNOT OFFER IT. `SHOW_OTHER_ITEM_OPTION = false` in
// app/invoices/new/InvoiceForm.js hides the free-text option (#96); the backend path
// is untouched, so this is what flipping that flag would produce.
//
// IT NEEDS A MATCHED DELIVERY, WHICH THE FIRST VERSION OF THIS SEED MISSED. The
// invoice detail's per-item list renders only "when a delivery is matched AND
// something disagrees" — with nothing matched there is no second term to compare
// against and the whole list is absent, so the free-text row alone showed nothing.
// The delivery is what makes `Not compared — no ordered item` and the `unjudged`
// tone appear beside an `exception`, which is the distinction the screen exists to
// make: grey says nothing was measured, amber says something is wrong.
await scenario("FREETEXT", "a charge no ordered item stands behind, beside one that disagrees", async () => {
    const order = await makeOrder({
        scenarioName: "FREETEXT",
        notes: "One ordinary charge, one free-text charge, and a delivery to judge them against.",
        items: [{ itemName: "Hex Nut", size: 'M20', qty: 200, unitPrice: 0.6 }],
        sign: true,
    });
    // Short against what the bill charges, so the ordinary row carries `exception`
    // and the free-text row carries `unjudged` on the same screen.
    const arrival = await deliver({
        scenarioName: "FREETEXT",
        rows: [{ poItem: order.poItems[0], qty: 150 }],
        receivedDate: "2026-08-06",
        notes: "Part shipment — 150 of the 200 nuts.",
    });
    const invoice = await bill({
        scenarioName: "FREETEXT",
        rows: [
            { po: order.po, poItem: order.poItems[0], qty: 200, unitPrice: 0.6 },
            // No `po` and no `poItem`: `createInvoiceItem` leaves both links empty and
            // omits Unit entirely, since an empty string is not a valid select choice.
            { poItem: null, itemName: "Crating and export packing", qty: 1, unitPrice: 240 },
        ],
        issueDate: "2026-08-06",
    });
    await setInvoiceDelivery(invoice.id, arrival.id);
    ids.freetext = invoice.invoiceId;
});

// --- FREETEXT_ONLY — a bill that charges no ordered item at all ------------
//
// The other half, and a different screen state: with EVERY row free-text the invoice
// links no order, so the detail reads `None linked.` where the order list would be.
// It is also why the awaiting-delivery strip's row count and the chip count can
// differ — this bill wears `Awaiting delivery` and can never appear in the strip,
// because a bill charging no ordered item can never be paired with an arrival.
await scenario("FREETEXT_ONLY", "a bill charging no ordered item at all", async () => {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: noteFor("FREETEXT_ONLY", "The vendor billed for site services against no order."),
    });
    // A PR with no items and no order — it exists only to carry the tag, so the skip
    // check and the cleanup can both find this invoice. It is left as a Draft, which
    // is visible to its requester alone and so adds nothing to anybody else's screens.
    const invoice = await bill({
        scenarioName: "FREETEXT_ONLY",
        rows: [
            { poItem: null, itemName: "Crane hire, half day", qty: 1, unitPrice: 850 },
            { poItem: null, itemName: "Site cleanup", qty: 2, unitPrice: 175 },
        ],
        issueDate: "2026-08-04",
    });
    ids.freetextOnly = invoice.invoiceId;
    ids.freetextOnlyPr = pr.prId;
});

// --- OVER — the correction the demo raises live ----------------------------
await scenario("OVER", "12 delivered against 10 ordered, billed 12, invoice has a file", async () => {
    const order = await makeOrder({
        scenarioName: "OVER",
        notes: "Couplings for the branch lines.",
        items: [{ itemName: "Coupling", size: '2"', qty: 10, unitPrice: 26 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "OVER",
        // Two slices, which is what planDelivery writes for an over-delivery: the
        // within-order piece and the excess, the second flagged.
        rows: [
            { poItem: order.poItems[0], qty: 10 },
            { poItem: order.poItems[0], qty: 2, over: true },
        ],
        receivedDate: "2026-08-11",
    });
    const invoice = await bill({
        scenarioName: "OVER",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 12, unitPrice: 26 }],
        issueDate: "2026-08-12",
    });
    await setInvoiceDelivery(invoice.id, arrival.id);
    ids.over = arrival.deliveryId;
    ids.overInvoice = invoice.invoiceId;
    ids.overPo = order.po.poId;
});

// --- OVER_BLOCKED — three corrections that cannot be raised, three reasons --
await scenario("OVER_BLOCKED", "3 over-deliveries blocked for 3 different reasons", async () => {
    // (a) no invoice bills this ordered item yet
    const a = await makeOrder({
        scenarioName: "OVER_BLOCKED",
        notes: "Four extra clamps, and no bill for them yet.",
        items: [{ itemName: "Pipe Clamp", size: '3"', qty: 15, unitPrice: 8 }],
        sign: true,
    });
    ids.blockedNoInvoice = (
        await deliver({
            scenarioName: "OVER_BLOCKED",
            rows: [
                { poItem: a.poItems[0], qty: 15 },
                { poItem: a.poItems[0], qty: 4, over: true },
            ],
            receivedDate: "2026-08-09",
        })
    ).deliveryId;

    // (b) the excess spans two of this arrival's own bills
    //
    // BOTH BILLS NAME THIS ARRIVAL, AND NEITHER COVERS THE EXCESS ON ITS OWN — which
    // is what `spansInvoices` actually tests. `candidateBills` takes the bills naming
    // this delivery as its first tier, so with two of them there are two candidates;
    // `selectOverageBill` then refuses because the first candidate's quantity is less
    // than the excess. A first attempt at this seeded two bills that each DID cover
    // the excess and got an eligible button instead: two candidates alone is not the
    // condition. The refusal is about the QUOTATION rather than the arithmetic — two
    // invoices means two files and a purchase request takes one.
    const b = await makeOrder({
        scenarioName: "OVER_BLOCKED",
        notes: "Two bills on this arrival, and the excess is bigger than either.",
        items: [{ itemName: "Threaded Rod", size: 'M16 x 1m', qty: 10, unitPrice: 12 }],
        sign: true,
    });
    const bArrival = await deliver({
        scenarioName: "OVER_BLOCKED",
        rows: [
            { poItem: b.poItems[0], qty: 10 },
            { poItem: b.poItems[0], qty: 20, over: true },
        ],
        receivedDate: "2026-08-08",
        notes: "Twenty over — two part-shipments arrived together.",
    });
    for (const [n, qty] of [[1, 15], [2, 15]]) {
        const inv = await bill({
            scenarioName: `OVER_BLOCKED_${n}`,
            rows: [{ po: b.po, poItem: b.poItems[0], qty, unitPrice: 12 }],
            issueDate: `2026-08-0${8 + n}`,
        });
        // BOTH, not just the first: one bill naming the arrival is a single candidate
        // and refuses under `excessExceedsBill` instead, which is a different sentence.
        await setInvoiceDelivery(inv.id, bArrival.id);
    }
    ids.blockedSpans = bArrival.deliveryId;

    // (c) the invoice has no file
    const c = await makeOrder({
        scenarioName: "OVER_BLOCKED",
        notes: "Three extra hangers. The vendor emailed the invoice with no attachment.",
        items: [{ itemName: "Spring Hanger", size: '2"', qty: 12, unitPrice: 34 }],
        sign: true,
    });
    const cArrival = await deliver({
        scenarioName: "OVER_BLOCKED",
        rows: [
            { poItem: c.poItems[0], qty: 12 },
            { poItem: c.poItems[0], qty: 3, over: true },
        ],
        receivedDate: "2026-08-07",
    });
    const cInvoice = await bill({
        scenarioName: "OVER_BLOCKED_3",
        rows: [{ po: c.po, poItem: c.poItems[0], qty: 15, unitPrice: 34 }],
        issueDate: "2026-08-08",
        withFile: false,
    });
    await setInvoiceDelivery(cInvoice.id, cArrival.id);
    ids.blockedNoFile = cArrival.deliveryId;
});

// --- OVER_INFER — eligible, on a bill nobody paired ------------------------
//
// EXACTLY ONE UNPAIRED BILL, WHICH IS WHAT MAKES IT AN INFERENCE RATHER THAN A
// REFUSAL. `candidateBills` tiers on the stored pairing: with no bill naming this
// arrival it falls to the unpaired tier, and there ONE candidate is eligible but
// carries `OVERAGE_INFERRED.noPairing` — the app saying it picked the bill that
// happens to be the one nobody paired. Two unpaired bills is a different answer
// entirely and has its own scenario below.
await scenario("OVER_INFER", "eligible, with the app labelling its guess", async () => {
    const order = await makeOrder({
        scenarioName: "OVER_INFER",
        notes: "One bill, and nobody paired it — so which bill carries the excess is inferred.",
        items: [{ itemName: "Blind Flange", size: '6"', qty: 10, unitPrice: 68 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "OVER_INFER",
        rows: [
            { poItem: order.poItems[0], qty: 10 },
            { poItem: order.poItems[0], qty: 3, over: true },
        ],
        receivedDate: "2026-08-06",
        notes: "Three extra flanges on the skid.",
    });
    await bill({
        scenarioName: "OVER_INFER",
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 13, unitPrice: 68 }],
        issueDate: "2026-08-06",
    });
    ids.overInfer = arrival.deliveryId;
});

// --- OVER_UNPAIRED — two bills, neither paired -----------------------------
//
// The tier above's other outcome, and a refusal rather than a guess: two bills bill
// this ordered item, neither names this arrival, so nothing records which one bills
// what came in here. `severalUnpairedBills`.
await scenario("OVER_UNPAIRED", "blocked: two bills and neither names this delivery", async () => {
    const order = await makeOrder({
        scenarioName: "OVER_UNPAIRED",
        notes: "Two bills, neither attached, so nothing records which one covers this arrival.",
        items: [{ itemName: "Weld Neck Flange", size: '4"', qty: 10, unitPrice: 72 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "OVER_UNPAIRED",
        rows: [
            { poItem: order.poItems[0], qty: 10 },
            { poItem: order.poItems[0], qty: 3, over: true },
        ],
        receivedDate: "2026-08-04",
        notes: "Three over on the flanges.",
    });
    for (const [n, issueDate] of [[1, "2026-08-04"], [2, "2026-08-09"]]) {
        await bill({
            scenarioName: `OVER_UNPAIRED_${n}`,
            rows: [{ po: order.po, poItem: order.poItems[0], qty: 13, unitPrice: 72 }],
            issueDate,
        });
    }
    ids.overUnpaired = arrival.deliveryId;
});

// --- OVER_EXCEEDS — one bill for this arrival, and it does not cover the excess
//
// `excessExceedsBill`, which #219 split out of `spansInvoices` because one message
// covering both was false for half of them: with a single candidate nothing is
// spanned — the one bill for this arrival simply does not bill all of the excess.
await scenario("OVER_EXCEEDS", "blocked: the one bill does not cover the excess", async () => {
    const order = await makeOrder({
        scenarioName: "OVER_EXCEEDS",
        notes: "The bill attached to this arrival covers less than the excess.",
        items: [{ itemName: "Slip-on Flange", size: '5"', qty: 10, unitPrice: 64 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "OVER_EXCEEDS",
        rows: [
            { poItem: order.poItems[0], qty: 10 },
            { poItem: order.poItems[0], qty: 9, over: true },
        ],
        receivedDate: "2026-08-03",
        notes: "Nine over — the vendor shipped a full box.",
    });
    const only = await bill({
        scenarioName: "OVER_EXCEEDS",
        // 4 billed against an excess of 9: this bill cannot carry it.
        rows: [{ po: order.po, poItem: order.poItems[0], qty: 4, unitPrice: 64 }],
        issueDate: "2026-08-04",
    });
    await setInvoiceDelivery(only.id, arrival.id);
    ids.overExceeds = arrival.deliveryId;
});

// --- UNATTRIB — an over-delivery attributed to no order --------------------
//
// HAND-WRITTEN, BECAUSE planDelivery ALWAYS NAMES AN ORDERED ITEM. Its own comment
// says so at lib/deliveryAllocation.js:387 — "`narrowed` is non-empty here, so the
// fallback always resolves and the row always names an ordered item". So the excess
// is allocated first by the production rule and the link is cleared afterwards: the
// row is what the app writes, minus the one field it can never omit. This is the only
// producer of `ALLOCATION_COPY.detail.overUnattached`, which otherwise has none —
// and `groupRowsByItem` already anticipates it, keying on the frozen name when there
// is no material link.
await scenario("UNATTRIB", "an excess the app could not attribute to one order", async () => {
    const order = await makeOrder({
        scenarioName: "UNATTRIB",
        notes: "Insulation for the steam line.",
        items: [{ itemName: "Insulation Roll", size: '50mm', qty: 8, unitPrice: 145 }],
        sign: true,
    });
    const arrival = await deliver({
        scenarioName: "UNATTRIB",
        rows: [
            { poItem: order.poItems[0], qty: 8 },
            { poItem: order.poItems[0], qty: 2, over: true },
        ],
        receivedDate: "2026-08-05",
    });
    const excess = (await getItemsByDelivery(arrival.id)).find((r) => r.overDelivered);
    await base(TABLES.DELIVERY_ITEMS).update(excess.id, { "PO Item": [] });
    ids.unattrib = arrival.deliveryId;
});

// --- DETECT — the PDFs the live invoice entry reads order numbers off -------
//
// Written to scripts/demo/output/ rather than to Blob: the invoice form takes a file
// from the reader's disk, so these have to BE files. One per detection voice.
await scenario("DETECT", "5 PDFs, one per detection voice", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const open = await makeOrder({
        scenarioName: "DETECT",
        subTag: "DETECT_OPEN",
        notes: "Structural angle for the platform.",
        items: [{ itemName: "Structural Angle", size: '75x75x6', qty: 30, unitPrice: 42 }],
        sign: true,
    });
    const withdrawn = await makeOrder({
        scenarioName: "DETECT",
        subTag: "DETECT_WITHDRAWN",
        notes: "Base plates — cancelled, the fabricator is supplying these.",
        items: [{ itemName: "Base Plate", size: '200x200', qty: 10, unitPrice: 58 }],
        sign: true,
    });
    await updatePO(withdrawn.po.id, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });
    const unsigned = await makeOrder({
        scenarioName: "DETECT",
        subTag: "DETECT_UNSIGNED",
        notes: "Shear studs for the deck.",
        items: [{ itemName: "Shear Stud", size: '19mm', qty: 200, unitPrice: 1.1 }],
    });
    const closed = await makeOrder({
        scenarioName: "DETECT",
        subTag: "DETECT_CLOSED",
        notes: "Grout for the base plates.",
        items: [{ itemName: "Grout Bag", size: '25kg', qty: 20, unitPrice: 19 }],
        sign: true,
    });
    await bill({
        scenarioName: "DETECT_CLOSED",
        rows: [{ po: closed.po, poItem: closed.poItems[0], qty: 20, unitPrice: 19 }],
        issueDate: "2026-08-05",
    });

    const dir = "scripts/demo/output";
    mkdirSync(dir, { recursive: true });
    const files = [
        ["demo26-open.pdf", ["INVOICE", `re ${open.po.poId}`]],
        ["demo26-withdrawn.pdf", ["INVOICE", `re ${withdrawn.po.poId}`]],
        ["demo26-unsigned.pdf", ["INVOICE", `re ${unsigned.po.poId}`]],
        ["demo26-closed.pdf", ["INVOICE", `re ${closed.po.poId}`]],
        ["demo26-two-pos.pdf", ["INVOICE", `re ${open.po.poId}`, `re ${unsigned.po.poId}`]],
        ["demo26-none.pdf", ["INVOICE", "No order number printed on this document."]],
    ];
    for (const [name, text] of files) writeFileSync(`${dir}/${name}`, await pdfBytes(text));
    ids.detect = files.map(([n]) => n).join(", ");
    ids.detectOpenPo = open.po.poId;
    ids.detectWithdrawnPo = withdrawn.po.poId;
    ids.detectUnsignedPo = unsigned.po.poId;
    ids.detectClosedPo = closed.po.poId;
});

// --- PRICES — three vendors, one material, and the caveats ------------------
//
// Vendor is deliberately NOT part of a material's identity (#18), which is what makes
// /materials a price comparison rather than a vendor catalog. Three orders for one
// material at three prices and three QUANTITIES: the differing quantities are what
// puts the caveat under the table, and the caveat is what makes `Lowest` honest.
await scenario("PRICES", "one material, three vendors, Lowest and both caveats", async () => {
    const ITEM = { itemName: "Copper Tube", size: '15mm', unit: UNIT };
    // DEMO-NAMED VENDORS ONLY, AND A THIRD IS CREATED IF THERE IS NOT ONE. A first
    // pass took the first two vendors that were not the primary, which on this base
    // put `TESTQA Vendor A` on the price-comparison screen — somebody's test row,
    // reading as debris in front of the room. The screen's whole point is that vendor
    // is NOT part of a material's identity (#18), so the comparison needs three names
    // that look like suppliers.
    let others = vendors.filter(
        (v) => v.vendorName !== VENDOR_NAME && v.vendorName.startsWith("Demo ")
    );
    for (const name of ["Gulf Coast Valve & Fitting", "Brazos Metals"]) {
        if (others.length >= 2) break;
        if (others.some((v) => v.vendorName === name)) continue;
        const existing = vendors.find((v) => v.vendorName === name);
        others.push(existing ?? (await createVendor({ vendorName: name, picName: "", picPhone: "", picEmail: "" })));
    }
    others = others.slice(0, 2);

    // Lone Star Pipe & Supply — the highest price, at the smallest quantity.
    const a = await makeOrder({
        scenarioName: "PRICES",
        notes: "Copper tube for the instrument air line.",
        items: [{ ...ITEM, qty: 20, unitPrice: 14.5 }],
        sign: true,
    });
    ids.pricesPo = a.po.poId;

    for (const [i, v] of others.entries()) {
        const pr = await createPR({
            requesterId: requester.id,
            lineId: line.id,
            vendorId: v.id,
            notes: noteFor("PRICES", "Copper tube — quoting the same item from a second supplier."),
        });
        await createItem({
            prRecordId: pr.id,
            prId: pr.prId,
            ...ITEM,
            // Different quantities on purpose — this is what the caveat reports.
            qty: [200, 60][i],
            unitPrice: [11.2, 13.4][i],
            remark: "",
        });
        await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: signerA.id,
            sequenceOrder: 1,
            confirmationType: "Approval",
        });
        await updatePR(pr.id, { status: "Approved" });
        const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
        // Vendor 2's order is withdrawn and vendor 3's is left unsigned, so the price
        // list carries both qualifying notes and the history screen carries both tags.
        if (i === 0) {
            await updatePO(gen.poRecordId, { status: "Withdrawn", withdrawnAt: new Date().toISOString() });
        }
    }
});

// --- NO_SIZE — a material with neither size nor unit -----------------------
await scenario("NO_SIZE", "a material with no size (a unit-less one cannot exist)", async () => {
    const order = await makeOrder({
        scenarioName: "NO_SIZE",
        notes: "General site consumables for the month.",
        // SIZE ONLY, AND THE UNIT STAYS — the brief's `No size or unit recorded` needs
        // BOTH blank, and that row cannot exist. `lib/materialsCache.js` skips a
        // unit-less ordered item outright (#18): "a unit price without a unit cannot
        // be compared to anything", so the item axis never gets one. Seeding it would
        // mean hand-writing a Materials row AND a price row to surface a sentence the
        // app argues should not exist — recorded as unreachable instead, beside
        // `PO: {status}` and `priceUnknown`. What is reachable, and what this seeds,
        // is a material with no SIZE: the subtitle renders the unit alone.
        items: [{ itemName: "Site Consumables", size: "", qty: 1, unitPrice: 480 }],
        sign: true,
    });
    ids.noSize = order.po.poId;
});

// ---------------------------------------------------------------------------

await printGuide();

/**
 * WHERE TO LOOK — resolved from the base every time, never from what this run made.
 *
 * The other demo seeds print a guide out of the ids they happen to be holding, which
 * means the guide is complete only on a first run and falls back to placeholders on
 * every later one — exactly the runs where somebody actually needs it, since a
 * finished seed creates nothing. This reads the tags back instead, so `--only=NONE`
 * prints the same guide a full run does and demo day does not depend on having a
 * terminal still open from three days ago.
 *
 * THREE TAGS, ONE PER RECORD KIND, and each is on the record itself rather than
 * inferred through links: a PR and a delivery carry `[DEMO26:SCENARIO]` in Notes, an
 * invoice carries `DEMO26-SCENARIO` as its `Vendor Invoice Code` — which is a real
 * field a vendor would fill, so it costs the demo nothing to read.
 */
async function printGuide() {
    const [prRecords, deliveryRecords, invoiceRecords] = await Promise.all([
        base(TABLES.PURCHASE_REQUESTS).select({ fields: ["PR ID", "Notes", "Purchase Orders"] }).all(),
        base(TABLES.DELIVERIES).select({ fields: ["Delivery ID", "Notes"] }).all(),
        base(TABLES.INVOICES).select({ fields: ["Invoice ID", "Vendor Invoice Code"] }).all(),
    ]);

    // KEYS ARE NORMALIZED WITHOUT UNDERSCORES, because the two places a scenario name
    // is stored cannot both keep them. The tag in `Notes` is free text and carries
    // `OVER_BLOCKED` as written; a `Vendor Invoice Code` has to read like a supplier's
    // own number, so it carries `LSP-OVERBLOCKED-0808`. Normalizing both sides is what
    // lets one lookup serve both — and it is checked, since a guide that silently
    // found nothing would print the same placeholder as a scenario that failed to seed.
    const byScenario = new Map();
    const norm = (name) => String(name).replace(/_/g, "");
    const put_ = (name, kind, value) => {
        const key = norm(name);
        if (!byScenario.has(key)) byScenario.set(key, { pr: [], po: [], delivery: [], invoice: [] });
        byScenario.get(key)[kind].push(value);
    };
    const tagIn = (text) => [...String(text || "").matchAll(/\[DEMO26:([A-Z_]+)\]/g)].map((m) => m[1]);

    const poRecordIds = [];
    for (const r of prRecords) {
        for (const name of tagIn(r.get("Notes"))) {
            put_(name, "pr", r.get("PR ID"));
            for (const id of r.get("Purchase Orders") || []) poRecordIds.push([name, id]);
        }
    }
    for (const r of deliveryRecords) {
        for (const name of tagIn(r.get("Notes"))) put_(name, "delivery", r.get("Delivery ID"));
    }
    for (const r of invoiceRecords) {
        const m = String(r.get("Vendor Invoice Code") || "").match(/^LSP-([A-Z0-9]+)-\d{4}$/);
        if (m) put_(m[1], "invoice", r.get("Invoice ID"));
    }
    // One batched read for the orders, keyed back to the scenario that raised them.
    const poById = new Map();
    const uniquePoIds = [...new Set(poRecordIds.map(([, id]) => id))];
    for (let i = 0; i < uniquePoIds.length; i += 50) {
        for (const po of await base(TABLES.PURCHASE_ORDERS)
            .select({ fields: ["PO ID"], filterByFormula: orByRecordId(uniquePoIds.slice(i, i + 50)) })
            .all()) {
            poById.set(po.id, po.get("PO ID"));
        }
    }
    for (const [name, recordId] of poRecordIds) {
        if (poById.has(recordId)) put_(name, "po", poById.get(recordId));
    }

    const get = (name, kind, n = 0) => byScenario.get(norm(name))?.[kind]?.sort()[n];
    const MISSING = "NOT ON THE BASE — re-run this seed";
    const row = (label, ...parts) =>
        console.log(
            `  ${label.padEnd(31)}` +
                (parts.every((p) => p !== undefined && p !== null) ? parts.join("") : MISSING)
        );

    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK — every id read back from the base");
    console.log("=".repeat(72));

    console.log("\nACT I — the request                                          (live)");
    row("duplicate fires against", get("DUP", "pr"));
    row("  type two rows of", 'Gate Valve 4" — 5 EA @ 45, twice');
    row("four signing step states", get("CHAIN", "pr"));
    row("withdrawn request", get("WITHDRAWN_PR", "pr"));

    console.log("\nACT II — billing, delivery, matching                         (live)");
    row("detection PDFs", "scripts/demo/output/demo26-*.pdf");
    row("  demo26-open.pdf applies", get("DETECT_OPEN", "po"));
    row("  demo26-withdrawn.pdf warns", get("DETECT_WITHDRAWN", "po"));
    row("  demo26-unsigned.pdf warns", get("DETECT_UNSIGNED", "po"));
    row("  demo26-closed.pdf: nothing left", get("DETECT_CLOSED", "po"));
    row("  demo26-none.pdf: no PO found", "(no order number printed on it)");
    row("bill this → pairs on screen", get("DL_WAIT", "po"), "  attaches ", get("DL_WAIT", "delivery"));
    row("deliver this → pairs on screen", get("INV_WAIT_A", "invoice"), " is waiting for its material");
    row("tariff in the totals footer", get("TARIFF", "invoice"));

    console.log("\nACT III — the three waiting lists                       (pre-made)");
    row("/invoices strip 1", get("DL_WAIT", "delivery"), " — arrival nobody has billed");
    row("/invoices strip 2, word 1", get("INV_WAIT_A", "invoice"), " — nothing delivered yet");
    row("/invoices strip 2, word 2", get("INV_WAIT_B", "invoice"), " — delivered, not matched");
    row("/pos strip", get("PO_WAIT", "pr", 0), " and ", get("PO_WAIT", "pr", 1));
    row("/prs strip, with a button", get("OVER", "delivery"));
    row("/prs strip, blocked rows", "6 — see Act IV for which reason is which");

    console.log("\nACT IV — when they disagree                              (mixed)");
    row("live: record 3 against", get("MISMATCH_START", "po"), " → ", get("MISMATCH_START", "invoice"), " goes Mismatch");
    row("live: hand-attach on Edit", get("HAND_ATTACH", "delivery"), " ← ", get("HAND_ATTACH", "invoice"));
    row("Order variance", get("VAR_PRICE", "invoice"), " on ", get("VAR_PRICE", "po"));
    row("Check the total, and paid", get("VAR_TOTAL", "invoice"));
    row("unjudged beside exception", get("FREETEXT", "invoice"));
    row("None linked.", get("FREETEXT_ONLY", "invoice"));
    row("per-order breakdown", get("MULTI_ORDER", "invoice"));
    row("correction: raise it here", get("OVER", "delivery"), " (bill ", get("OVER", "invoice"), ")");
    row("correction: Inferred:", get("OVER_INFER", "delivery"));
    row("blocked: no invoice yet", get("OVER_BLOCKED", "delivery", 0));
    row("blocked: spans two invoices", get("OVER_BLOCKED", "delivery", 1));
    row("blocked: invoice has no file", get("OVER_BLOCKED", "delivery", 2));
    row("blocked: two unpaired bills", get("OVER_UNPAIRED", "delivery"));
    row("blocked: bill under the excess", get("OVER_EXCEEDS", "delivery"));
    row("excess against no order", get("UNATTRIB", "delivery"));

    console.log("\nACT V — at a glance                                    (pre-made)");
    row("Invoiced", get("CHIP_INVOICED", "po"));
    row("Partly invoiced", get("CHIP_PARTLY", "po"));
    row("Awaiting invoice", get("CHIP_AWAITING", "po"));
    row("the dash, and the dimmed row", get("CHIP_DASH", "po"));
    row("Lowest + both caveats", "/materials → Copper Tube");
    row("no size (unit only)", "/materials → Site Consumables");
    row("PO unsigned / PO withdrawn", "/materials/… → Copper Tube");

    console.log("\nACT VI — who sees what                                 (pre-made)");
    row("row-scoped, one job", "scoped-fixture@hanyangengusa.com");
    row("assigned to nothing", "authz-fixture@hanyangengusa.com");

    const missing = [...byScenario.keys()].length;
    console.log(`\n${missing} scenarios on the base. To undo exactly what this seed made:`);
    console.log("  node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \\");
    console.log("    scripts/demo/seed_full_demo.mjs --cleanup");
}
