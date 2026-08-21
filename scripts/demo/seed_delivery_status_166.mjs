// Demo data for looking at #166 in a browser.
//
// #166 compares delivered against invoiced against ordered on three surfaces, and
// NONE of its interesting states exists on this base: measured before seeding, 0 PO
// ordered items carried both an invoice item and a delivery slice, so every invoice
// read "nothing delivered" and every delivery read "no invoice yet". This seeds one
// scenario per state.
//
// EACH SCENARIO GETS ITS OWN MATERIAL, and that is load-bearing rather than tidy:
// allocation matches candidates on the `Material` link (#18), so two scenarios
// sharing a material would make each other's ordered items candidates and scramble the
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
// Reuses (never modifies) the 26-DEMO-01 job, its Unit 2 Piping, and the
// "Lone Star Pipe & Supply" vendor from seed_demo_fixtures.mjs — a different vendor from
// #165's seed, so the two demos do not appear in each other's dropdowns. Creates
// PRs + PR Items and POs + PO Items through the real approve-and-generate flow
// (which is what gives each ordered item the `Material` link allocation needs), plus
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
const VENDOR_NAME = "Lone Star Pipe & Supply";
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

/** One PR + item -> approve -> PO. Returns the PO and its single ordered item. */
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
    const orderedItem = (await getItemsByPO(gen.poRecordId))[0];
    return { po, orderedItem };
}

/**
 * One delivery covering one or more materials, allocated by the PRODUCTION
 * planner. `wants` is [{ itemName, qty }]; the planner decides which ordered item each
 * quantity lands on and whether any of it is beyond the order.
 *
 * `packingListPO` is optional and is the PO record the packing list itself
 * names, i.e. `Deliveries."Packing List PO"`. IT GOES TO BOTH the header and the
 * planner, because that is what createDeliveryAction does with a typed PO
 * number: the header records what the document said, and the same id
 * hard-narrows allocation to that order's ordered items. Passing it to only one of the
 * two would seed a record the app cannot produce.
 *
 * #181 ADDED IT, and the reason is a verification gap rather than realism. No
 * stored record carried that field, so the only thing exercising its read path
 * — the `PO on packing list` row on the delivery detail — was a throwaway
 * record created and deleted by hand, which covered it once and never again. A
 * seeded delivery covers it on every run. Scenario A carries it because its
 * material has exactly one order, so narrowing to that PO selects the same
 * single candidate ordered item and the seeded rows are unchanged by it.
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
            orderedItems: candidates.orderedItems,
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
                poItemRecordId: row.orderedItem.id,
                materialRecordId: material.id,
                itemName: row.orderedItem.itemName,
                size: row.orderedItem.size,
                unit: row.orderedItem.unit,
                qty: row.qty,
                overDelivered: row.over,
            });
            written.push(`${row.qty}${row.over ? " OVER" : ""} -> ${row.orderedItem.poId}`);
        }
    }
    return { delivery, written };
}

/** One invoice with one or more invoice items, optionally plus a free-text one. */
async function invoice({ items: invoiceItems, issueDate, freeText = false, note }) {
    const total = invoiceItems.reduce((s, l) => s + l.qty * 10, 0);
    const inv = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `166-DEMO ${note}`,
        issueDate,
        dueDate: "2026-09-01",
        amountDue: total,
        shippingFee: 0,
        file: [],
    });
    for (const bl of invoiceItems) {
        await createInvoiceItem({
            invoiceRecordId: inv.id,
            invoiceId: inv.invoiceId,
            poRecordId: bl.po.id,
            poItemRecordId: bl.orderedItem.id,
            itemName: bl.orderedItem.itemName,
            size: bl.orderedItem.size,
            unit: bl.orderedItem.unit,
            qty: bl.qty,
            unitPrice: 10,
            remark: "",
        });
    }
    if (freeText) {
        // An invoice item with no PO Item. The app does not create these
        // (SHOW_OTHER_ITEM_OPTION = false, #96) but the backend path is intact, and
        // it is what makes the "not compared" count visible on the detail page.
        await createInvoiceItem({
            invoiceRecordId: inv.id,
            invoiceId: inv.invoiceId,
            poRecordId: invoiceItems[0].po.id,
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

// --- A: everything invoiced arrived --------------------------------------------
const a = await makeOrder({ itemName: FIRST_ITEM, qty: 20 });
// The one delivery here whose packing list quotes a PO number (#181) — see
// deliver() on why it is this scenario and why the rows are unaffected.
const aDel = await deliver({
    wants: [{ itemName: FIRST_ITEM, qty: 20 }],
    receivedDate: "2026-07-18",
    notes: "A, full delivery, packing list quotes the PO",
    packingListPO: a.po,
});
ids.aDelivery = aDel.delivery.deliveryId;
ids.aPO = a.po.poId;
ids.a = (await invoice({ items: [{ ...a, qty: 20 }], issueDate: "2026-07-19", note: "A arrived" })).invoiceId;
console.log(`  A  ${ids.a}  Delivered   (${ids.aDelivery} quotes ${ids.aPO} on its packing list)`);

// --- B: invoiced, nothing delivered, plus an invoice item with no ordered item ---
const b = await makeOrder({ itemName: "166-DEMO Gasket", qty: 15 });
ids.b = (await invoice({
    items: [{ ...b, qty: 15 }],
    issueDate: "2026-07-20",
    freeText: true,
    note: "B not delivered",
})).invoiceId;
console.log(`  B  ${ids.b}  Awaiting delivery (+ 1 item not compared)`);

// --- C: one invoice over two ordered items, one arrived ----------------------
const c1 = await makeOrder({ itemName: "166-DEMO Elbow", qty: 5 });
const c2 = await makeOrder({ itemName: "166-DEMO Tee", qty: 7 });
await deliver({ wants: [{ itemName: "166-DEMO Elbow", qty: 5 }], receivedDate: "2026-07-21", notes: "C, one of two" });
ids.c = (await invoice({
    items: [{ ...c1, qty: 5 }, { ...c2, qty: 7 }],
    issueDate: "2026-07-22",
    note: "C partly arrived",
})).invoiceId;
console.log(`  C  ${ids.c}  Partly delivered (1 of 2 ordered items)`);

// --- D: TWO invoices on one ordered item, delivery covers one -> ESTIMATED -------
const d = await makeOrder({ itemName: "166-DEMO Coupling", qty: 30 });
await deliver({ wants: [{ itemName: "166-DEMO Coupling", qty: 15 }], receivedDate: "2026-07-23", notes: "D, half" });
ids.dOld = (await invoice({ items: [{ ...d, qty: 15 }], issueDate: "2026-07-05", note: "D older invoice" })).invoiceId;
ids.dNew = (await invoice({ items: [{ ...d, qty: 15 }], issueDate: "2026-07-25", note: "D newer invoice" })).invoiceId;
console.log(`  D  ${ids.dOld} (older) + ${ids.dNew} (newer)  both INFERRED`);

// --- E: delivered beyond the order --------------------------------------------
const e = await makeOrder({ itemName: "166-DEMO Nipple", qty: 10 });
const eDel = await deliver({
    wants: [{ itemName: "166-DEMO Nipple", qty: 12 }],
    receivedDate: "2026-07-24",
    notes: "E, 2 beyond the order",
});
ids.e = (await invoice({ items: [{ ...e, qty: 10 }], issueDate: "2026-07-26", note: "E over-delivered" })).invoiceId;
console.log(`  E  ${ids.e}  Delivered, and 2 beyond the order  [${eDel.written.join(", ")}]`);

// --- F: invoiced beyond the order --------------------------------------------
const f = await makeOrder({ itemName: "166-DEMO Union", qty: 10 });
await deliver({ wants: [{ itemName: "166-DEMO Union", qty: 10 }], receivedDate: "2026-07-25", notes: "F, exact" });
ids.f = (await invoice({ items: [{ ...f, qty: 13 }], issueDate: "2026-07-27", note: "F over-billed" })).invoiceId;
console.log(`  F  ${ids.f}  Partly delivered — 3 more invoiced than delivered`);

// --- G: arrived with no invoice at all — the vendor-chasing worklist --------
await makeOrder({ itemName: "166-DEMO Bushing", qty: 8 });
const g = await deliver({
    wants: [{ itemName: "166-DEMO Bushing", qty: 8 }],
    // Deliberately the OLDEST received date here, so it tops the oldest-first
    // filter rather than merely appearing in it.
    receivedDate: "2026-06-30",
    notes: "G, never invoiced — tops the worklist",
});
ids.g = g.delivery.deliveryId;
console.log(`  G  ${ids.g}  Awaiting invoice (oldest received date)`);

// --- I: one delivery over two ordered items, only one of them invoiced -------
const i1 = await makeOrder({ itemName: "166-DEMO Cap", qty: 4 });
await makeOrder({ itemName: "166-DEMO Plug", qty: 6 });
const iDel = await deliver({
    wants: [{ itemName: "166-DEMO Cap", qty: 4 }, { itemName: "166-DEMO Plug", qty: 6 }],
    receivedDate: "2026-07-26",
    notes: "I, two materials, one invoiced",
});
ids.i = iDel.delivery.deliveryId;
ids.iInvoice = (await invoice({ items: [{ ...i1, qty: 4 }], issueDate: "2026-07-28", note: "I one item only" })).invoiceId;
console.log(`  I  ${ids.i}  Partly invoiced  (its invoice is ${ids.iInvoice})`);

printGuide();

function printGuide() {
    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("=".repeat(72));
    console.log(`
Start the dev server and sign in as an Admin (both real accounts are Admin).

READ SECTIONS 1 AND 3 AS #166's RECORD, NOT AS THESE SCREENS TODAY. They
describe the invoice list and the deliveries list as this seed was written
against them, and two later issues moved both without sweeping this guide:
#210 took the invoice axis from three chip values to two — the chip reads
whether Invoices."Delivery" is set, so every invoice this seed creates
now shows [Awaiting delivery] and none carries a marker, since nothing here
is paired — and #216 moved the ?unbilled=1 filter off /deliveries to a
strip above /invoices. Noted rather than rewritten by #232, which redrew
section 2 and verified only that screen; correcting the other two means
re-deriving them against those issues, which is that work's own job.

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
  invoiced-beyond-order is already on F's own page as the ⚠ Variance badge
  in the items table; E's over-delivery is a fact about the ORDERED ITEM,
  and inside a column headed Delivery it would read as "more arrived than
  this invoice covers". Both facts are on the detail, under the ordered item.

  D IS THE HEADLINE. One ordered item of 30 carries two invoices of 15, and
  15 was delivered. That covers exactly one of them, and nothing records
  which — so the OLDER invoice (issued 07-05) is treated as settled and the
  newer (07-25) as not delivered, and BOTH carry the (!) marker. Hover it,
  or tab to it with a screen reader, for why. Every other row above is
  computed outright, not inferred.

------------------------------------------------------------------
2. /invoices/<id>  —  the "Delivery" section  (rewritten for #232)
------------------------------------------------------------------
The section heading carries the SAME CHIP the list showed, from the same
function, so the row you clicked and the page you land on cannot
disagree. Since #232 that set has THREE values: Delivered, Mismatch and
Awaiting delivery. A (!) marker stood beside the chip and is retired —
the discrepancy is a word now, so a reader meets it without hovering.

Under the chip, ONE line naming the delivery this invoice matches:
Invoices."Delivery" is single, so per-entry would print one document
once per item. THIS SEED WRITES NO SUCH LINK — invoice() predates the field
and sets nothing — so every invoice it creates reads:

         "No delivery has been matched to this invoice yet."

  ...and nothing else. That is the whole section for an unmatched
  invoice: no item list at all, because this section compares an invoice
  against ONE delivery and with none matched there is no second term.
  Every invoice in this seed looks like that.

  The sentence is the state itself, not a stand-in for one. #210 made
  "no delivery matched" and "nothing delivered" different facts; every
  entry below used to say "Nothing delivered yet" under an empty list,
  which asserted the second when only the first was known.

  THE INVOICE LEVEL SAYS WHAT THE STATE IS; AN ENTRY POINTS AT AN
  EXCEPTION. What an invoice charges arrives on the one delivery it
  matches or not at all, so "everything invoiced was delivered" is one
  fact about one document and the chip states it. So the density
  follows the state:

    no delivery matched   one sentence, no items
    matched and covered   the delivery, then item names, each silent
    matched and short     Mismatch in red, the delivery, an amber box
                          saying what to do, then item names with the
                          short ones carrying their figures

  An entry carries no border and no PO link. The border framed five
  lines before #232 emptied it; the link was #167's answer to the items
  table dropping its PO column, and #237 took that question, under
  Purchase Orders above.

  ${ids.b ?? "B"}   nothing under the sentence, though it has two items
       — one judged, one free text. "Not compared — no ordered item"
       used to appear for the second; it says why an item was left out
       of a comparison, and with nothing matched there is no comparison
       to be left out of. Its backend path is still intact behind #96's
       flag, which is how this seed made such an item at all.

  ${ids.dNew ?? "D-new"}   likewise nothing, and it is the case worth
       knowing about: two invoices of 15 on one ordered item of 30.
       "This bill: 15 of 30 EA" stood here to caption a "Invoiced" figure
       that was the ordered item's total across every invoice; #232
       scoped that figure to this invoice and then dropped the figures line
       entirely, and #233 put "which invoices charge this order" on the
       order's own page.

  ${ids.f ?? "F"}   nothing here either, and this one changed twice.
       13 invoiced against an ordered item of 10, so it briefly showed
       "Against the ordered item: 3 EA more invoiced" even while unmatched,
       kept on the belief that the figure was visible nowhere else.
       #233 had already made that false: /pos/[poId] carries an Invoiced
       column with a red (over) mark, so HYE-PO-20260804-11 reads
       Qty 10 and Invoiced 13 (over). Look for a invoicing excess there.

  ${ids.e ?? "E"}   the delivery-side excess, 12 arrived against an
       ordered item of 10. Match a delivery to this invoice and its
       entry reads "Against the ordered item: 2 EA more delivered",
       uncolored, with an amber verdict above it if the invoice also fell
       short. Only the verdict is colored — with both lines amber, as
       the first version had them, the color distinguished nothing.

  TO SEE THIS SECTION SPEAK you need a MATCHED invoice, which this seed
  cannot make: it writes no link. HYE-INV-260804-03 on the shared base
  is the short case, by a hand-set link the app's own pairing would
  refuse, and HYE-INV-260804-05 is the covered one.

------------------------------------------------------------------
3. /deliveries — the "Invoiced" column, and /invoices — the strip
------------------------------------------------------------------
  ${ids.g ?? "G"}   [Awaiting invoice]   (received 2026-06-30, the oldest)
  ${ids.i ?? "I"}   [Partly invoiced]    (one delivery, two materials, one invoiced)
  others           [Invoiced]

  The "Not fully invoiced · oldest first" filter this guide used to send
  you to is GONE (#216) — chasing a vendor is a strip above /invoices
  now, where recording the invoice happens. BOTH ${ids.g ?? "G"} and ${ids.i ?? "I"} are on
  it, and that pair is the whole point of the rule being both incomplete
  states rather than the empty one: ${ids.i ?? "I"} is one delivery carrying two
  materials with only one invoiced, material that is here with no invoice
  for it, which filtering on the empty state alone would have dropped.
  ${ids.g ?? "G"} is at the top, on received-date ascending.

  Tick "Over-delivered" on /deliveries and only the scenario-E delivery
  remains. It lands in the URL (?over=1), so refresh and the back button
  keep it.

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
  a delivery may see whether it has been invoiced — so there is one column
  set and one filter set, and scoped-fixture@hanyangengusa.com (non-Admin,
  assigned to 26-DEMO-01) renders them like anyone else.

------------------------------------------------------------------
4. /deliveries/<id>  —  "PO on packing list"  (#181)
------------------------------------------------------------------
  ${ids.aDelivery ?? "A's delivery"}   PO on packing list: ${ids.aPO ?? "A's PO"}
  every other delivery here            PO on packing list: none

  THE ONLY SEEDED RECORD THAT CARRIES Deliveries."Packing List PO", and it
  is here because nothing else covered that field's read path. #181 renamed
  the field off a bare "PO" — which read as the order the delivery was
  recorded AGAINST, a different thing living on Delivery Items."PO Item" —
  and verified the new name by creating a delivery by hand and deleting it,
  which covers a read path exactly once. This covers it on every run.

  The same id goes to the header AND to planDelivery, because that is what
  createDeliveryAction does with a typed PO number: one records what the
  document said, the other hard-narrows allocation to that order. Scenario
  A's material has one order, so the narrowing selects the same ordered item and
  the rows are what they would have been anyway.

  Contrast the "Recorded against" table on the same page: that names a PO
  per allocated slice, reached through the Material link rather than from
  this number. Two levels of attribution, which is why the screen spells
  the header one out instead of labeling it "PO".
`);
}
