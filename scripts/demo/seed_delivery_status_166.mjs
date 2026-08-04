// Demo data for looking at #166 in a browser.
//
// #166 compares delivered against invoiced against ordered on three surfaces, and
// NONE of its interesting states exists on this base: measured before seeding, 0 PO
// lines carried both an invoice line and a delivery slice, so every invoice read
// "nothing arrived" and every arrival read "no invoice yet". This seeds one
// scenario per state.
//
// EACH SCENARIO GETS ITS OWN MATERIAL, and that is load-bearing rather than tidy:
// allocation matches candidates on the `Material` link (#18), so two scenarios
// sharing a material would make each other's PO lines candidates and scramble the
// allocation the scenario is trying to show.
//
// EVERY DELIVERY GOES THROUGH THE PRODUCTION planDelivery, so the rows are what the
// app would have written — including the over-delivery split in scenario E, which
// falls out of asking for more than the order has outstanding rather than being
// hand-flagged.
//
// KEPT, NOT DELETED, like the rest of scripts/demo/. Re-running is safe: it checks
// for its own first Materials row and skips if present.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_delivery_status_166.mjs
//
// Reuses (never modifies) the 26-DEMO-01 job, its Demo Line A, and the
// "Demo Vendor Co." vendor from seed_demo_fixtures.mjs — a different vendor from
// #165's seed, so the two demos do not appear in each other's dropdowns. Creates
// PRs + PR Items and POs + PO Items through the real approve-and-generate flow
// (which is what gives each line the `Material` link allocation needs), plus
// Deliveries, Delivery Items, Invoices and Invoice Items. Nothing is uploaded to
// Vercel Blob, so the seeded deliveries have no packing-list photo — every delivery
// you enter yourself will.

import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem } from "../../lib/airtable/deliveryItems.js";
import { createInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem } from "../../lib/airtable/invoiceItems.js";
import { getDeliveryCandidates } from "../../lib/deliveryCandidates.js";
import { planDelivery } from "../../lib/deliveryAllocation.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getActiveUsers } from "../../lib/airtable/users.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Demo Vendor Co.";
const SIZE = '3"';
const UNIT = "EA";
const FIRST_ITEM = "166-DEMO Flange";

console.log("=".repeat(72));
console.log("seed_delivery_status_166 — browsable states for #166");
console.log("=".repeat(72));

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

console.log(`job      ${job.jobCode}`);
console.log(`line     ${line.lineLabel}`);
console.log(`vendor   ${vendor.vendorName}`);
console.log(`as       ${requester.userName} <${requester.email}>`);

const already = await getMaterialByKey({ itemName: FIRST_ITEM, size: SIZE, unit: UNIT }).catch(() => null);
if (already) {
    console.log(`\nAlready seeded — "${FIRST_ITEM}" exists on the item axis. Nothing created.`);
    console.log("Delete the 166-DEMO Materials rows by hand if you want a clean re-seed.");
    printGuide();
    process.exit(0);
}

/** One PR + item -> approve -> PO. Returns the PO and its single line. */
async function makeOrder({ itemName, qty, unitPrice = 10 }) {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: "166-DEMO fixture — delivery status states",
    });
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName,
        size: SIZE,
        unit: UNIT,
        qty,
        unitPrice,
        remark: "",
    });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    const po = await getPOByRecordId(gen.poRecordId);
    const poLine = (await getItemsByPO(gen.poRecordId))[0];
    return { po, poLine };
}

/**
 * One delivery covering one or more materials, allocated by the PRODUCTION
 * planner. `wants` is [{ itemName, qty }]; the planner decides which line each
 * quantity lands on and whether any of it is beyond the order.
 */
async function deliver({ wants, receivedDate, notes }) {
    const candidates = await getDeliveryCandidates([await getJobByRecordId(job.id)]);
    const delivery = await createDelivery({
        jobRecordId: job.id,
        vendorRecordId: vendor.id,
        poRecordId: null,
        receivedDate,
        recordedByUserId: requester.id,
        notes: `166-DEMO — ${notes}`,
        file: [],
    });

    const written = [];
    for (const want of wants) {
        const material = await getMaterialByKey({ itemName: want.itemName, size: SIZE, unit: UNIT });
        const plan = planDelivery({
            lines: candidates.lines,
            vendorRecordId: vendor.id,
            materialRecordId: material.id,
            qty: want.qty,
        });
        if (plan.blocked) throw new Error(`could not plan ${want.itemName}: ${plan.blocked}`);
        for (const row of plan.rows) {
            await createDeliveryItem({
                deliveryRecordId: delivery.id,
                deliveryId: delivery.deliveryId,
                poItemRecordId: row.line.id,
                materialRecordId: material.id,
                itemName: row.line.itemName,
                size: row.line.size,
                unit: row.line.unit,
                qty: row.qty,
                overDelivery: row.over,
            });
            written.push(`${row.qty}${row.over ? " OVER" : ""} -> ${row.line.poId}`);
        }
    }
    return { delivery, written };
}

/** One invoice with one or more item lines, optionally plus a free-text line. */
async function bill({ lines: billLines, issueDate, freeText = false, note }) {
    const total = billLines.reduce((s, l) => s + l.qty * 10, 0);
    const inv = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `166-DEMO ${note}`,
        issueDate,
        dueDate: "2026-09-01",
        amountDue: total,
        shippingFee: 0,
        file: [],
    });
    for (const bl of billLines) {
        await createInvoiceItem({
            invoiceRecordId: inv.id,
            invoiceId: inv.invoiceId,
            poRecordId: bl.po.id,
            poItemRecordId: bl.poLine.id,
            itemName: bl.poLine.itemName,
            size: bl.poLine.size,
            unit: bl.poLine.unit,
            qty: bl.qty,
            unitPrice: 10,
            remark: "",
        });
    }
    if (freeText) {
        // A line with no PO Item. The app does not create these
        // (SHOW_OTHER_ITEM_OPTION = false, #96) but the backend path is intact, and
        // it is what makes the "not compared" count visible on the detail page.
        await createInvoiceItem({
            invoiceRecordId: inv.id,
            invoiceId: inv.invoiceId,
            poRecordId: billLines[0].po.id,
            poItemRecordId: null,
            itemName: "166-DEMO Miscellaneous charge",
            qty: 1,
            unitPrice: 40,
            remark: "",
        });
    }
    return inv;
}

const ids = {};
console.log("\nSeeding one scenario per state:");

// --- A: everything billed arrived --------------------------------------------
const a = await makeOrder({ itemName: FIRST_ITEM, qty: 20 });
await deliver({ wants: [{ itemName: FIRST_ITEM, qty: 20 }], receivedDate: "2026-07-18", notes: "A, full arrival" });
ids.a = (await bill({ lines: [{ ...a, qty: 20 }], issueDate: "2026-07-19", note: "A arrived" })).invoiceId;
console.log(`  A  ${ids.a}  Arrived`);

// --- B: billed, nothing arrived, plus a line with no ordered line ------------
const b = await makeOrder({ itemName: "166-DEMO Gasket", qty: 15 });
ids.b = (await bill({
    lines: [{ ...b, qty: 15 }],
    issueDate: "2026-07-20",
    freeText: true,
    note: "B not arrived",
})).invoiceId;
console.log(`  B  ${ids.b}  Nothing recorded as arrived yet (+ 1 line not compared)`);

// --- C: one invoice over two ordered lines, one arrived ----------------------
const c1 = await makeOrder({ itemName: "166-DEMO Elbow", qty: 5 });
const c2 = await makeOrder({ itemName: "166-DEMO Tee", qty: 7 });
await deliver({ wants: [{ itemName: "166-DEMO Elbow", qty: 5 }], receivedDate: "2026-07-21", notes: "C, one of two" });
ids.c = (await bill({
    lines: [{ ...c1, qty: 5 }, { ...c2, qty: 7 }],
    issueDate: "2026-07-22",
    note: "C partly arrived",
})).invoiceId;
console.log(`  C  ${ids.c}  1 of 2 lines arrived`);

// --- D: TWO bills on one line, arrival covers one -> ESTIMATED ---------------
const d = await makeOrder({ itemName: "166-DEMO Coupling", qty: 30 });
await deliver({ wants: [{ itemName: "166-DEMO Coupling", qty: 15 }], receivedDate: "2026-07-23", notes: "D, half" });
ids.dOld = (await bill({ lines: [{ ...d, qty: 15 }], issueDate: "2026-07-05", note: "D older bill" })).invoiceId;
ids.dNew = (await bill({ lines: [{ ...d, qty: 15 }], issueDate: "2026-07-25", note: "D newer bill" })).invoiceId;
console.log(`  D  ${ids.dOld} (older) + ${ids.dNew} (newer)  both ESTIMATED`);

// --- E: arrived beyond the order --------------------------------------------
const e = await makeOrder({ itemName: "166-DEMO Nipple", qty: 10 });
const eDel = await deliver({
    wants: [{ itemName: "166-DEMO Nipple", qty: 12 }],
    receivedDate: "2026-07-24",
    notes: "E, 2 beyond the order",
});
ids.e = (await bill({ lines: [{ ...e, qty: 10 }], issueDate: "2026-07-26", note: "E over-delivered" })).invoiceId;
console.log(`  E  ${ids.e}  arrived beyond this bill + over-delivery tag  [${eDel.written.join(", ")}]`);

// --- F: billed beyond the order --------------------------------------------
const f = await makeOrder({ itemName: "166-DEMO Union", qty: 10 });
await deliver({ wants: [{ itemName: "166-DEMO Union", qty: 10 }], receivedDate: "2026-07-25", notes: "F, exact" });
ids.f = (await bill({ lines: [{ ...f, qty: 13 }], issueDate: "2026-07-27", note: "F over-billed" })).invoiceId;
console.log(`  F  ${ids.f}  3 more billed than recorded as arrived + beyond order tag`);

// --- G: arrived with no invoice at all — the vendor-chasing worklist --------
await makeOrder({ itemName: "166-DEMO Bushing", qty: 8 });
const g = await deliver({
    wants: [{ itemName: "166-DEMO Bushing", qty: 8 }],
    // Deliberately the OLDEST received date here, so it tops the oldest-first
    // filter rather than merely appearing in it.
    receivedDate: "2026-06-30",
    notes: "G, never billed — tops the worklist",
});
ids.g = g.delivery.deliveryId;
console.log(`  G  ${ids.g}  No invoice yet (oldest received date)`);

// --- I: one delivery over two lines, only one of them billed ---------------
const i1 = await makeOrder({ itemName: "166-DEMO Cap", qty: 4 });
await makeOrder({ itemName: "166-DEMO Plug", qty: 6 });
const iDel = await deliver({
    wants: [{ itemName: "166-DEMO Cap", qty: 4 }, { itemName: "166-DEMO Plug", qty: 6 }],
    receivedDate: "2026-07-26",
    notes: "I, two materials, one billed",
});
ids.i = iDel.delivery.deliveryId;
ids.iInvoice = (await bill({ lines: [{ ...i1, qty: 4 }], issueDate: "2026-07-28", note: "I one line only" })).invoiceId;
console.log(`  I  ${ids.i}  1 of 2 invoiced  (its bill is ${ids.iInvoice})`);

printGuide();

function printGuide() {
    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("=".repeat(72));
    console.log(`
Start the dev server and sign in as an Admin (both real accounts are Admin).

------------------------------------------------------------------
1. /invoices  —  the new "Delivery" column
------------------------------------------------------------------
Vendor "${VENDOR_NAME}", vendor invoice codes starting "166-DEMO".

  ${ids.a ?? "A"}   Arrived
  ${ids.b ?? "B"}   Nothing recorded as arrived yet   (nothing at all arrived)
  ${ids.c ?? "C"}   1 of 2 lines arrived
  ${ids.dOld ?? "D-old"}   Arrived            + [estimated]
  ${ids.dNew ?? "D-new"}   Nothing recorded as arrived yet  + [estimated]
  ${ids.e ?? "E"}   Arrived            + [over-delivery]
  ${ids.f ?? "F"}   0 of 1 lines arrived             + [beyond order]

  The wording is the point: never "over-billed" or "short-shipped", because
  at any one moment those are the same measurement as "the rest has not
  arrived yet". Hover the [estimated] tag for why that pair is a guess.

  D IS THE HEADLINE. One order line of 30 carries two bills of 15, and 15
  arrived. That covers exactly one of them, and nothing records which — so
  the OLDER bill (issued 07-05) is treated as settled and the newer
  (07-25) as not arrived, and BOTH are tagged estimated. Every other row
  above is computed outright, not guessed.

------------------------------------------------------------------
2. /invoices/<id>  —  the new "Delivery" section
------------------------------------------------------------------
  ${ids.b ?? "B"}   "Nothing recorded as arrived yet against the 15 EA billed."
       plus "(1 line with no ordered line is not compared)" — the
       free-text line. The app cannot create one of those; this seed used
       the backend path directly, which is still intact behind #96's flag.

  ${ids.dNew ?? "D-new"}   the state sentence, then the estimate sentence right after
       it: "This order line carries more than one bill and the arrivals
       cannot be told apart, so the oldest bill is treated as settled
       first." Above it, "This invoice bills 15 EA of 30 EA billed on this
       order line across 2 bills."

  ${ids.e ?? "E"}   "All 10 EA billed recorded as arrived." then "2 EA arrived
       beyond the order" — two comparisons, two sentences. The bill is
       covered AND the order was exceeded; neither masks the other.

  ${ids.f ?? "F"}   "3 EA more billed than recorded as arrived — 13 EA billed,
       10 EA recorded." and "3 EA more billed than ordered." Note the
       column says "0 of 1 lines arrived", NOT "nothing recorded as
       arrived yet": 10 of 13 did arrive, so the line is merely
       incomplete. The two claims are different and the copy keeps them
       apart — reading this seeded row is what caught the first version
       saying the false one.

  Every one of them ends with "Deliveries recorded against the same order
  lines" — NOT "the deliveries for this invoice". The quantity is
  attributed to a bill; which arrival brought it is not. The packing-list
  link is absent because this seed uploads nothing to Blob.

------------------------------------------------------------------
3. /deliveries  —  the new "Invoiced" column and two filters
------------------------------------------------------------------
  ${ids.g ?? "G"}   No invoice yet      (received 2026-06-30, the oldest)
  ${ids.i ?? "I"}   1 of 2 invoiced     (one delivery, two materials, one billed)
  others           Invoiced

  Tick "No invoice yet, longest waiting first": the list narrows and
  re-orders oldest-received first, so ${ids.g ?? "G"} goes to the top. That is the
  worklist replacing the month-end email. Tick "Over-delivery only" and
  only the scenario-E arrival remains. Both filters land in the URL
  (?uninvoiced=1&over=1), so refresh and the back button keep them.

  Check the six-column layout here: the colgroup was re-budgeted to
  8.5+10+6+13.5+7.5+6.5 = 52rem rather than appending a column, so
  nothing should wrap and there should be no horizontal scrollbar above
  ~832px.

  NOT DEMONSTRABLE with these accounts: the column and the "No invoice
  yet" filter are withheld from a non-Admin, and the data is not fetched
  for them at all. Both real accounts are Admin, and authz-fixture is
  non-Admin but assigned to no job, so it sees no deliveries either way —
  and its flags are a permanent fixture that must not be changed. Reading
  app/deliveries/page.js's showInvoicing branch is the honest check.
`);
}
