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
// falls out of asking for more than the order has undelivered rather than being
// hand-flagged.
//
// ONE THING HERE IS NOT #166's (#181): scenario A's delivery carries
// Deliveries."Packing List PO". No stored record did, so the only thing covering
// that field's read path was a delivery created and deleted by hand while #181
// verified the rename — which covers it once. This seed is where such a record
// belongs, since it already builds the deliveries a reader opens. See deliver().
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

// DECLARED BEFORE THE SKIP CHECK, because the skip path prints the guide too and
// the guide reads it. `printGuide` is a hoisted function declaration but `ids` is
// a `const`, so a re-run — the only way to reach that path — died in the temporal
// dead zone before printing anything. The guide then falls back to its `?? "A"`
// placeholders, which is what those exist for: a re-run has the scenarios on the
// base but not their ids in hand.
const ids = {};

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
 *
 * `packingListPO` is optional and is the PO record the packing list itself
 * names, i.e. `Deliveries."Packing List PO"`. IT GOES TO BOTH the header and the
 * planner, because that is what createDeliveryAction does with a typed PO
 * number: the header records what the document said, and the same id
 * hard-narrows allocation to that order's lines. Passing it to only one of the
 * two would seed a record the app cannot produce.
 *
 * #181 ADDED IT, and the reason is a verification gap rather than realism. No
 * stored record carried that field, so the only thing exercising its read path
 * — the `PO on packing list` row on the delivery detail — was a throwaway
 * record created and deleted by hand, which covered it once and never again. A
 * seeded delivery covers it on every run. Scenario A carries it because its
 * material has exactly one order, so narrowing to that PO selects the same
 * single candidate line and the seeded rows are unchanged by it.
 */
async function deliver({ wants, receivedDate, notes, packingListPO = null }) {
    const candidates = await getDeliveryCandidates([await getJobByRecordId(job.id)]);
    const delivery = await createDelivery({
        jobRecordId: job.id,
        vendorRecordId: vendor.id,
        packingListPORecordId: packingListPO?.id ?? null,
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
            // Still `poRecordId` here, and deliberately: the planner's parameter
            // means "narrow the candidates to this order", not the header field
            // the same value lands in (#181).
            poRecordId: packingListPO?.id ?? null,
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
                overDelivered: row.over,
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

console.log("\nSeeding one scenario per state:");

// --- A: everything billed arrived --------------------------------------------
const a = await makeOrder({ itemName: FIRST_ITEM, qty: 20 });
// The one delivery here whose packing list quotes a PO number (#181) — see
// deliver() on why it is this scenario and why the rows are unaffected.
const aDel = await deliver({
    wants: [{ itemName: FIRST_ITEM, qty: 20 }],
    receivedDate: "2026-07-18",
    notes: "A, full arrival, packing list quotes the PO",
    packingListPO: a.po,
});
ids.aDelivery = aDel.delivery.deliveryId;
ids.aPO = a.po.poId;
ids.a = (await bill({ lines: [{ ...a, qty: 20 }], issueDate: "2026-07-19", note: "A arrived" })).invoiceId;
console.log(`  A  ${ids.a}  Delivered   (${ids.aDelivery} quotes ${ids.aPO} on its packing list)`);

// --- B: billed, nothing arrived, plus a line with no ordered line ------------
const b = await makeOrder({ itemName: "166-DEMO Gasket", qty: 15 });
ids.b = (await bill({
    lines: [{ ...b, qty: 15 }],
    issueDate: "2026-07-20",
    freeText: true,
    note: "B not arrived",
})).invoiceId;
console.log(`  B  ${ids.b}  Awaiting delivery (+ 1 line not compared)`);

// --- C: one invoice over two ordered lines, one arrived ----------------------
const c1 = await makeOrder({ itemName: "166-DEMO Elbow", qty: 5 });
const c2 = await makeOrder({ itemName: "166-DEMO Tee", qty: 7 });
await deliver({ wants: [{ itemName: "166-DEMO Elbow", qty: 5 }], receivedDate: "2026-07-21", notes: "C, one of two" });
ids.c = (await bill({
    lines: [{ ...c1, qty: 5 }, { ...c2, qty: 7 }],
    issueDate: "2026-07-22",
    note: "C partly arrived",
})).invoiceId;
console.log(`  C  ${ids.c}  Partly delivered (1 of 2 ordered items)`);

// --- D: TWO bills on one line, arrival covers one -> ESTIMATED ---------------
const d = await makeOrder({ itemName: "166-DEMO Coupling", qty: 30 });
await deliver({ wants: [{ itemName: "166-DEMO Coupling", qty: 15 }], receivedDate: "2026-07-23", notes: "D, half" });
ids.dOld = (await bill({ lines: [{ ...d, qty: 15 }], issueDate: "2026-07-05", note: "D older bill" })).invoiceId;
ids.dNew = (await bill({ lines: [{ ...d, qty: 15 }], issueDate: "2026-07-25", note: "D newer bill" })).invoiceId;
console.log(`  D  ${ids.dOld} (older) + ${ids.dNew} (newer)  both INFERRED`);

// --- E: arrived beyond the order --------------------------------------------
const e = await makeOrder({ itemName: "166-DEMO Nipple", qty: 10 });
const eDel = await deliver({
    wants: [{ itemName: "166-DEMO Nipple", qty: 12 }],
    receivedDate: "2026-07-24",
    notes: "E, 2 beyond the order",
});
ids.e = (await bill({ lines: [{ ...e, qty: 10 }], issueDate: "2026-07-26", note: "E over-delivered" })).invoiceId;
console.log(`  E  ${ids.e}  Delivered, and 2 beyond the order  [${eDel.written.join(", ")}]`);

// --- F: billed beyond the order --------------------------------------------
const f = await makeOrder({ itemName: "166-DEMO Union", qty: 10 });
await deliver({ wants: [{ itemName: "166-DEMO Union", qty: 10 }], receivedDate: "2026-07-25", notes: "F, exact" });
ids.f = (await bill({ lines: [{ ...f, qty: 13 }], issueDate: "2026-07-27", note: "F over-billed" })).invoiceId;
console.log(`  F  ${ids.f}  Partly delivered — 3 more billed than delivered`);

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
console.log(`  G  ${ids.g}  Awaiting invoice (oldest received date)`);

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
console.log(`  I  ${ids.i}  Partly invoiced  (its bill is ${ids.iInvoice})`);

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

  ${ids.a ?? "A"}   [Delivered]
  ${ids.b ?? "B"}   [Awaiting delivery]      (nothing at all delivered)
  ${ids.c ?? "C"}   [Partly delivered]
  ${ids.dOld ?? "D-old"}   [Delivered]         + (!)
  ${ids.dNew ?? "D-new"}   [Awaiting delivery] + (!)
  ${ids.e ?? "E"}   [Delivered]
  ${ids.f ?? "F"}   [Partly delivered]

  THREE CHIP VALUES AND NOTHING ELSE, the way an Airtable single select
  reads. No fractions: "1 of 2" changes per row, so the set would stop
  being closed, and saying what it counts needs words a one-line cell does
  not have. The figures are on the detail.

  The wording is the point: never "over-billed" or "short-shipped",
  because at any one moment those are the same measurement as "the rest
  has not been delivered yet".

  E AND F CARRY NO EXCEPTION TAG HERE, and that is deliberate. F's
  billed-beyond-order is already on F's own page as the ⚠ Variance badge
  in the items table; E's over-delivery is a fact about the ORDERED ITEM,
  and inside a column headed Delivery it would read as "more arrived than
  this bill covers". Both facts are on the detail, under the ordered item.

  D IS THE HEADLINE. One ordered item of 30 carries two bills of 15, and
  15 was delivered. That covers exactly one of them, and nothing records
  which — so the OLDER bill (issued 07-05) is treated as settled and the
  newer (07-25) as not delivered, and BOTH carry the (!) marker. Hover it,
  or tab to it with a screen reader, for why. Every other row above is
  computed outright, not inferred.

------------------------------------------------------------------
2. /invoices/<id>  —  the "Delivery" section, one box per line
------------------------------------------------------------------
The section heading carries the SAME CHIP the list showed, from the same
function, so the row you clicked and the page you land on cannot disagree.

  ${ids.b ?? "B"}   two boxes. The judged one reads
         "Ordered 15 EA · Billed 15 EA · Delivered 0 EA"
         "Nothing delivered yet"
       and the free-text one is a box of its own reading
         "Not compared — no ordered item"
       rather than a footnote about a line you cannot see. The app cannot
       create such a line; this seed used the backend path directly, which
       is still intact behind #96's flag.

  ${ids.dNew ?? "D-new"}   the one shape where a share line appears:
         "Ordered 30 EA · Billed 30 EA · Delivered 15 EA"
         "This bill: 15 of 30 EA"
         "15 EA more billed than delivered"
         "Inferred — this ordered item carries more than one bill..."
       The share line and the (!) marker fire on EXACTLY one condition, so
       the reason the answer was inferred is explained where it is made.
       All three figures are the ordered item's totals, which is what makes
       them add up against the deliveries listed under them.

  ${ids.e ?? "E"}   "All billed material delivered" in green, then
         "Against the order: 2 EA more delivered"
       uncolored underneath. Two comparisons; the verdict is the invoice's
       and the aside is the order's, and only the verdict is colored — with
       all three lines amber, as the first version had them, the color
       distinguished nothing.

  ${ids.f ?? "F"}   "3 EA more billed than delivered", then
         "Against the order: 3 EA more billed"
       Note the chip says [Partly delivered], NOT [Awaiting delivery]:
       10 of 13 did arrive, so the ordered item is merely incomplete. The
       two claims are different and the copy keeps them apart — reading
       this seeded row is what caught the first version saying the false
       one.

  The delivery links sit INSIDE the box, labelled just "Deliveries ·",
  because the box is already scoped to one ordered item — which is the
  claim the data supports. The old foot-of-page section needed the heading
  "recorded against the same order lines" to avoid over-claiming; inside
  the box that qualification is structural.

------------------------------------------------------------------
3. /deliveries  —  the "Invoiced" column and two filters
------------------------------------------------------------------
  ${ids.g ?? "G"}   [Awaiting invoice]   (received 2026-06-30, the oldest)
  ${ids.i ?? "I"}   [Partly invoiced]    (one delivery, two materials, one billed)
  others           [Invoiced]

  Tick "Not fully invoiced · oldest first": BOTH ${ids.g ?? "G"} and ${ids.i ?? "I"} remain, and
  that pair is the whole point of widening the filter. ${ids.i ?? "I"} is one
  delivery carrying two materials with only one billed — material that is
  here with no invoice for it, which is exactly what this worklist
  replaces the month-end email with, and which filtering on the empty
  state alone would have dropped. ${ids.g ?? "G"} goes to the top on
  received-date ascending.

  Tick "Over-delivered" and only the scenario-E arrival remains. Both
  filters land in the URL (?unbilled=1&over=1), so refresh and the back
  button keep them.

  Check the six-column layout here: the colgroup was RE-BUDGETED to
  8.5+8+5.5+17.5+6.75+5.75 = 52rem rather than appending a column, so
  nothing should wrap and there should be no horizontal scrollbar above
  ~832px. The chip is narrower than the sentence it replaced, so Invoiced
  gave room back to Delivered — which needed it, since that column carries
  an item label, a +N count and an Over-delivered tag on one line.

  DEMONSTRABLE WITH ANY ACCOUNT SINCE #211. This used to read "not
  demonstrable": the column and the "Not fully invoiced" filter were
  withheld from a non-Admin and the data was not fetched for them at all,
  so reading app/deliveries/page.js's showInvoicing branch was the only
  honest check. #211 released that withholding — every viewer who may see
  a delivery may see whether it has been billed — so there is one column
  set and one filter set, and scoped-fixture@hanyangengusa.com (non-Admin,
  assigned to 26-DEMO-01) renders them like anyone else.

------------------------------------------------------------------
4. /deliveries/<id>  —  "PO on packing list"  (#181)
------------------------------------------------------------------
  ${ids.aDelivery ?? "A's delivery"}   PO on packing list: ${ids.aPO ?? "A's PO"}
  every other delivery here            PO on packing list: none

  THE ONLY SEEDED RECORD THAT CARRIES Deliveries."Packing List PO", and it
  is here because nothing else covered that field's read path. #181 renamed
  the field off a bare "PO" — which read as the order the arrival was
  recorded AGAINST, a different thing living on Delivery Items."PO Item" —
  and verified the new name by creating a delivery by hand and deleting it,
  which covers a read path exactly once. This covers it on every run.

  The same id goes to the header AND to planDelivery, because that is what
  createDeliveryAction does with a typed PO number: one records what the
  document said, the other hard-narrows allocation to that order. Scenario
  A's material has one order, so the narrowing selects the same line and
  the rows are what they would have been anyway.

  Contrast the "Recorded against" table on the same page: that names a PO
  per allocated slice, reached through the Material link rather than from
  this number. Two levels of attribution, which is why the screen spells
  the header one out instead of labelling it "PO".
`);
}
