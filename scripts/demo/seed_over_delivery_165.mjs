// Demo orders for looking at #165 in a browser.
//
// #165 changed what happens to the quantity that arrives BEYOND what was ordered:
// it now attaches to an ordered item instead of hanging off nothing. Three states are
// worth seeing, and none of them can be produced without orders already in place —
// which is what this seeds.
//
//   A. Over-delivery ACROSS TWO ORDERS. Two POs for one material, both open. This
//      is the case #162 left unattached and therefore invisible on the invoice
//      axis; the preview now names the order the excess lands on.
//   B. Over-delivery with NOTHING OUTSTANDING. Two POs for a second material, both
//      already fully delivered. The excess attaches to the MOST RECENT of them,
//      which is the second branch of the rule.
//   C. BLOCKED, which the form CANNOT reach and this seed therefore cannot set up
//      as a click-through. With a PO number in use the form offers only that PO's
//      own items, and typing in the PO field resets the item rows, so "a PO that
//      does not carry the picked item" is a combination the UI never offers. The
//      refusal lives in createDeliveryAction, reachable at submit when a PO is
//      withdrawn while the form sits open — see the guide at the bottom for the
//      two-tab way to produce it.
//
// KEPT, NOT DELETED, like the rest of scripts/demo/ — this is browsable fixture
// data, not a test's own fixtures. Re-running is safe: it checks for its own
// Materials rows first and skips if they are there.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_over_delivery_165.mjs
//
// Reuses (never modifies) the 26-DEMO-01 job, its Unit 2 Piping, and the
// "Gulf Coast Valve & Fitting" vendor from seed_demo_fixtures.mjs. Creates PRs + PR Items,
// POs + PO Items through the REAL approve-and-generate flow — which is what gives
// each ordered item its `Material` link (#18), the thing allocation matches on — plus
// one Delivery for scenario B. Nothing is uploaded to Vercel Blob, so the seeded
// delivery has no packing-list photo; every delivery you enter yourself will.

import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { createDelivery } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem } from "../../lib/airtable/deliveryItems.js";
import { getDeliveryCandidates } from "../../lib/deliveryCandidates.js";
import { planDelivery } from "../../lib/deliveryAllocation.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Gulf Coast Valve & Fitting";

const PIPE = { itemName: "165-DEMO Pipe", size: '2"', unit: "EA" };
const ELBOW = { itemName: "165-DEMO Elbow", size: '3"', unit: "PCS" };

console.log("=".repeat(72));
console.log("seed_over_delivery_165 — browsable orders for #165");
console.log("=".repeat(72));

// --- context, all reused -----------------------------------------------------
const [jobs, lines, vendors, users] = await Promise.all([
    getAllJobs(),
    getAllLines(),
    getAllVendors(),
    getActiveUsers(),
]);

const job = jobs.find((j) => j.jobCode === JOB_CODE);
if (!job) throw new Error(`no job ${JOB_CODE} — run scripts/demo/seed_demo_fixtures.mjs first`);
const line = lines.find((l) => l.jobId === job.id);
if (!line) throw new Error(`job ${JOB_CODE} has no Line — run seed_demo_fixtures.mjs first`);
const vendor = vendors.find((v) => v.vendorName === VENDOR_NAME);
if (!vendor) throw new Error(`no vendor "${VENDOR_NAME}" — run seed_demo_fixtures.mjs first`);
const requester = users[0];
if (!requester) throw new Error("no active user to raise the PRs as");

console.log(`job      ${job.jobCode} (${job.jobName ?? ""})`);
console.log(`line     ${line.lineLabel}`);
console.log(`vendor   ${vendor.vendorName}`);
console.log(`as       ${requester.userName} <${requester.email}>`);

// --- skip if already seeded --------------------------------------------------
const already = await getMaterialByKey(PIPE).catch(() => null);
if (already) {
    console.log(`\nAlready seeded — "${PIPE.itemName}" exists on the item axis. Nothing created.`);
    console.log("Delete those Materials rows by hand if you want a clean re-seed.");
    printGuide(await describeSeeded());
    process.exit(0);
}

/** One PR -> approve -> PO, through the real flow. Returns the PO record id. */
async function makeOrder({ item, qty, unitPrice, remark }) {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: "165-DEMO fixture — orders for looking at over-delivery attachment",
    });
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: item.itemName,
        size: item.size,
        unit: item.unit,
        qty,
        unitPrice,
        remark: remark || "",
    });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    return gen.poRecordId;
}

console.log("\nCreating orders through the real approve-and-generate flow:");

// EVERY PO IS GENERATED BEFORE ANY IS BACKDATED, the order seed_material_prices.mjs
// established. #164 moved the daily counter off `Created Date` onto the ID prefix,
// so backdating can no longer collide two PO IDs — but the order costs nothing and
// is what a regression would trip over.
const poA1 = await makeOrder({ item: PIPE, qty: 10, unitPrice: 12.5, remark: "scenario A, older" });
const poA2 = await makeOrder({ item: PIPE, qty: 10, unitPrice: 12.75, remark: "scenario A, newer" });
const poB1 = await makeOrder({ item: ELBOW, qty: 4, unitPrice: 8, remark: "scenario B, older" });
const poB2 = await makeOrder({ item: ELBOW, qty: 6, unitPrice: 8.25, remark: "scenario B, newer" });

// Backdated so "oldest first" and "most recent" are visible rather than decided by
// a same-day PO ID tie-break. Direct field writes, which is why this lives in a
// demo script and not in lib/.
const dates = [
    [poA1, "2026-07-10"],
    [poA2, "2026-07-20"],
    [poB1, "2026-07-12"],
    [poB2, "2026-07-22"],
];
for (const [id, date] of dates) await base(TABLES.PURCHASE_ORDERS).update(id, { "Created Date": date });

const ids = {};
for (const [key, id] of [["poA1", poA1], ["poA2", poA2], ["poB1", poB1], ["poB2", poB2]]) {
    ids[key] = (await getPOByRecordId(id)).poId;
    console.log(`  ${key}  ${ids[key]}`);
}

// --- scenario B needs its orders already satisfied ---------------------------
// Through the production allocation, so the fixture is what the app would have
// written rather than something hand-shaped.
console.log("\nDelivering scenario B in full, so nothing is left undelivered:");
const elbowMaterial = await getMaterialByKey(ELBOW);
const candidates = await getDeliveryCandidates([await getJobByRecordId(job.id)]);
const fillPlan = planDelivery({
    orderedItems: candidates.orderedItems,
    vendorRecordId: vendor.id,
    materialRecordId: elbowMaterial.id,
    qty: 10,
});
if (fillPlan.blocked) throw new Error(`could not plan the scenario B fill: ${fillPlan.blocked}`);
if (fillPlan.over > 0) throw new Error("scenario B fill went over — the orders are not what this expects");

const delivery = await createDelivery({
    jobRecordId: job.id,
    vendorRecordId: vendor.id,
    packingListPORecordId: null,
    receivedDate: "2026-07-25",
    recordedByUserId: requester.id,
    notes: "165-DEMO fixture — fills both Elbow orders so scenario B is fully delivered",
    file: [],
});
for (const row of fillPlan.rows) {
    await createDeliveryItem({
        deliveryRecordId: delivery.id,
        deliveryId: delivery.deliveryId,
        poItemRecordId: row.orderedItem.id,
        materialRecordId: elbowMaterial.id,
        itemName: row.orderedItem.itemName,
        size: row.orderedItem.size,
        unit: row.orderedItem.unit,
        qty: row.qty,
        overDelivered: row.over,
    });
    console.log(`  ${row.qty} ${row.orderedItem.unit} against ${row.orderedItem.poId}`);
}
console.log(`  delivery ${delivery.deliveryId}`);

printGuide({ ...ids, deliveryId: delivery.deliveryId });

/** Re-read the seeded PO IDs on a skipped run, so the guide is still printable. */
async function describeSeeded() {
    const out = {};
    const rows = await base(TABLES.PURCHASE_ORDERS)
        .select({ fields: ["PO ID", "Created Date"] })
        .all();
    const byDate = (d) => rows.find((r) => r.get("Created Date") === d)?.get("PO ID") ?? "(?)";
    out.poA1 = byDate("2026-07-10");
    out.poA2 = byDate("2026-07-20");
    out.poB1 = byDate("2026-07-12");
    out.poB2 = byDate("2026-07-22");
    out.deliveryId = "(see /deliveries)";
    return out;
}

function printGuide(o) {
    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("=".repeat(72));
    console.log(`
Start the dev server (npm run dev) and open  /deliveries/new

Pick job "${JOB_CODE}" and vendor "${VENDOR_NAME}" for all three.

A. OVER-DELIVERY ACROSS TWO ORDERS — the case #165 is about
   Item "165-DEMO Pipe 2" (EA)", quantity 25. Leave the PO number blank.
   Two orders of 10 are open (${o.poA1}, ${o.poA2}), so 20 is absorbed and
   5 is excess. Expect two messages:
     - spans 2 purchase orders, recorded as 2 rows
     - 5 EA more than the 20 still undelivered on ${o.poA2}, recorded
       against it and flagged as over-delivery
   Under #162 the second one said the excess could NOT be attributed to
   any one order. It names ${o.poA2} now — the last order filled.
   Submit it: the detail page banner says "delivered beyond what ${o.poA2}
   ordered", and ${o.poA2}'s ordered item shows Delivered 15 against Qty 10.
   Exceeding the ordered quantity is the intended shape, not a defect.

B. NOTHING OUTSTANDING — the second branch of the rule
   Item "165-DEMO Elbow 3" (PCS)", quantity 3. PO number blank.
   Both Elbow orders (${o.poB1}, ${o.poB2}) are already fully delivered,
   so nothing can absorb it. Expect:
     - everything ordered is already recorded as delivered, so all 3 PCS
       will be flagged as over-delivery and recorded against ${o.poB2}
   ${o.poB2} is the MOST RECENT of the two, which is what "the end of the
   fill order" means when the delivery filled nothing.

C. BLOCKED — reachable at SUBMIT only, and it takes two tabs
   The form cannot offer this: tick the PO box and it drops the vendor
   picker and narrows the item list to that PO's own items, and typing in
   the PO field resets the item rows. So there is no way to sit there
   holding an item the typed PO does not carry.

   What IS reachable is the withdrawal race the action exists for:
     1. Tab 1 — /deliveries/new. Tick the PO box, type ${o.poA2}, pick
        "165-DEMO Pipe 2" (EA)", quantity 5, attach a photo. Do not submit.
     2. Tab 2 — /pos/${o.poA2}. Withdraw it. (You are the requester on
        its PR, which is who may withdraw.)
     3. Back in tab 1, submit. The action re-reads, the withdrawn PO's
        ordered item stops counting as ordered, and nothing is left to attach to.
        Expect a form-level error, not a row preview:
          - Nothing on this job orders 165-DEMO Pipe 2" (EA) from this
            vendor, so there is no order to record it against.
   Before #165 that submit wrote a row with no PO Item link and blank
   item name — invisible on the invoice axis, which is the whole issue.
   Withdrawing ${o.poA2} spends scenario A, so do A first.

Also worth a look:
   /deliveries                     the seeded fill, plus anything you enter
   /deliveries/${o.deliveryId}${" ".repeat(Math.max(0, 20 - String(o.deliveryId).length))}the fill from scenario B (no photo:
                                   the seed uploads nothing to Blob)
   /pos/${o.poA2}          Delivered vs Qty on the ordered item the excess landed on
`);
}
