// Browsable states for the overage correction (#167).
//
// NONE of them existed on this base beforehand: #166's seed deliberately attaches
// no file to its invoices, so every over-delivery there is blocked on
// `no-invoice-file` and the ELIGIBLE path — the one with a button, a preview and a
// draft — had nothing to show.
//
// Two scenarios, one order each on 26-DEMO-01:
//   A  ordered 10, delivered 12, billed 12 on an invoice WITH a file → eligible.
//   B  the same shape but PAID before the correction, which is the common case
//      rather than an edge one and the one whose safety rests on the invoice
//      header not moving.
//
// The orders go through the REAL approve-and-generate flow, not hand-created PO
// Items, for the same reason seed_over_delivery_165.mjs does: PO generation is what
// writes each ordered item's `Material` link (#18), and both allocation and the overage
// apply step match on that link and never on `Item Name` text. A hand-made PO Item
// would be invisible to the whole feature.
//
// The invoice file is a real Vercel Blob upload that Airtable then ingests, because
// the correction re-uploads Airtable's own copy — the path #142 exists to protect.
// Kept, not deleted: skip-if-exists on its own Materials row.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_overage_167.mjs

import { put } from "@vercel/blob";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem, getItemsByDelivery } from "../../lib/airtable/deliveryItems.js";
import { createInvoice, getInvoiceByRecordId, updateInvoice } from "../../lib/airtable/invoices.js";
import { createInvoiceItem } from "../../lib/airtable/invoiceItems.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Lone Star Pipe & Supply";
const SIZE = '2"';
const UNIT = "EA";
const FIRST_ITEM = "167-DEMO Flange";

// Declared before the skip check because the guide reads it, and the skip path is
// the only way to reach that check — the same temporal-dead-zone trap
// seed_delivery_status_166.mjs had to fix.
const ids = {};

console.log("=".repeat(72));
console.log("seed_overage_167 — browsable states for the overage correction");
console.log("=".repeat(72));

const [users, vendors, lines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllLines()]);
const line = lines.find((l) => (l.lineLabel || "").startsWith(JOB_CODE));
if (!line) throw new Error(`no Line on ${JOB_CODE} — run seed_demo_fixtures.mjs first`);
const vendor = vendors.find((v) => v.vendorName === VENDOR_NAME);
if (!vendor) throw new Error(`no vendor "${VENDOR_NAME}" — run seed_demo_fixtures.mjs first`);
const requester = users[0];
const signer = users[1] ?? users[0];
if (!requester) throw new Error("no active user to raise the PRs as");

console.log(`job      ${JOB_CODE}`);
console.log(`line     ${line.lineLabel}`);
console.log(`vendor   ${vendor.vendorName}`);
console.log(`as       ${requester.userName} <${requester.email}>`);

const already = await getMaterialByKey({ itemName: FIRST_ITEM, size: SIZE, unit: UNIT }).catch(() => null);
if (already) {
    console.log(`\nAlready seeded — "${FIRST_ITEM}" exists on the item axis. Nothing created.`);
    console.log("Delete the 167-DEMO Materials rows by hand if you want a clean re-seed.");
    printGuide();
    process.exit(0);
}

/** A one-page PDF standing in for the vendor's invoice scan. */
function invoicePdfBytes(label) {
    const body =
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 80]>>endobj\n";
    return Buffer.from(`%PDF-1.4\n% ${label}\n${body}trailer<</Root 1 0 R>>\n%%EOF\n`, "utf8");
}

async function makeOrder({ itemName, qty, unitPrice = 15 }) {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: "167-DEMO order",
    });
    await createItem({ prRecordId: pr.id, prId: pr.prId, itemName, size: SIZE, unit: UNIT, qty, unitPrice, remark: "" });
    await createSigner({
        prRecordId: pr.id,
        prId: pr.prId,
        signerUserId: signer.id,
        sequenceOrder: 1,
        confirmationType: "Approval",
    });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    const po = await getPOByRecordId(gen.poRecordId);
    return { po, poLine: (await getItemsByPO(gen.poRecordId))[0] };
}

async function deliver({ poLine, within, over, receivedDate }) {
    const delivery = await createDelivery({
        jobRecordId: line.jobId,
        vendorRecordId: vendor.id,
        packingListPORecordId: null,
        receivedDate,
        recordedByUserId: requester.id,
        notes: "167-DEMO delivery",
        file: [],
    });
    for (const [qty, isOver] of [[within, false], [over, true]]) {
        await createDeliveryItem({
            deliveryRecordId: delivery.id,
            deliveryId: delivery.deliveryId,
            poItemRecordId: poLine.id,
            materialRecordId: poLine.material?.[0] ?? null,
            itemName: poLine.itemName,
            size: poLine.size,
            unit: poLine.unit,
            qty,
            overDelivered: isOver,
        });
    }
    return (await getDeliveriesByRecordIds([delivery.id]))[0];
}

async function bill({ po, poLine, qty, issueDate, paid }) {
    const blob = await put(`167-DEMO-${poLine.poItemId}.pdf`, invoicePdfBytes("167-DEMO invoice"), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
    });
    const invoice = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: `167-DEMO-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        issueDate,
        dueDate: "2026-09-30",
        amountDue: qty * 15,
        shippingFee: 0,
        file: [{ url: blob.url, filename: "167-DEMO-invoice.pdf" }],
    });
    await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: po.id,
        poItemRecordId: poLine.id,
        itemName: poLine.itemName,
        size: poLine.size,
        unit: poLine.unit,
        qty,
        unitPrice: 15,
        remark: "",
    });
    if (paid) await updateInvoice(invoice.id, { paid: true, paidDate: "2026-08-05" });
    // Wait for Airtable to take the file: the correction reads ITS copy, and an
    // unattached invoice is exactly the state that blocks the button.
    for (let i = 0; i < 40; i++) {
        const fresh = await getInvoiceByRecordId(invoice.id);
        if (fresh.file?.[0]?.url && fresh.file[0].url !== blob.url) return fresh;
        await new Promise((r) => setTimeout(r, 300));
    }
    return await getInvoiceByRecordId(invoice.id);
}

console.log("\nSeeding two scenarios:");

// --- A: eligible, unpaid ----------------------------------------------------
const a = await makeOrder({ itemName: FIRST_ITEM, qty: 10 });
const aDelivery = await deliver({ poLine: a.poLine, within: 10, over: 2, receivedDate: "2026-08-01" });
const aInvoice = await bill({ po: a.po, poLine: a.poLine, qty: 12, issueDate: "2026-08-02", paid: false });
ids.aDelivery = aDelivery.deliveryId;
ids.aInvoice = aInvoice.invoiceId;
ids.aPo = a.po.poId;
console.log(`  A  ${ids.aDelivery}  2 EA over on ${ids.aPo}, billed by ${ids.aInvoice} — button ELIGIBLE`);

// --- B: eligible, and the invoice is already paid ---------------------------
const b = await makeOrder({ itemName: "167-DEMO Coupling", qty: 8 });
const bDelivery = await deliver({ poLine: b.poLine, within: 8, over: 3, receivedDate: "2026-08-02" });
const bInvoice = await bill({ po: b.po, poLine: b.poLine, qty: 11, issueDate: "2026-08-03", paid: true });
ids.bDelivery = bDelivery.deliveryId;
ids.bInvoice = bInvoice.invoiceId;
ids.bPo = b.po.poId;
console.log(`  B  ${ids.bDelivery}  3 EA over on ${ids.bPo}, billed by PAID ${ids.bInvoice} — button ELIGIBLE`);

const aOver = (await getItemsByDelivery(aDelivery.id)).find((r) => r.overDelivered);
ids.aRow = aOver?.deliveryItemId;

printGuide();

function printGuide() {
    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("=".repeat(72));
    console.log(`
Start the dev server and sign in (both real accounts are Admin, but this feature
is JOB-SCOPED — any user on ${JOB_CODE} sees the same thing).

------------------------------------------------------------------
1. /deliveries/${ids.aDelivery ?? "<A>"}  —  the button
------------------------------------------------------------------
Under the amber "Over-delivered" banner there is now a Correction box:

  Correction — 167-DEMO Flange 2"
  This will raise a purchase request for 2 EA ... at $15.00 each — the excess
  delivered beyond what ${ids.aPo ?? "<A-PO>"} ordered. ${ids.aInvoice ?? "<A-INV>"} is billing for it
  already, so its file becomes the quotation and its code the vendor
  quotation code.
  It opens as a draft, so quantity, price and signers can all be changed
  before it is submitted.
  [ Raise a correction ]

  Click it: the modal repeats the preview, and confirming lands you on
  /prs/new?draft=<new PR> with the item, the quotation and the copied signer
  chain already filled in. NOTHING is committed until you submit the draft
  there — but the delivery row is linked from that moment, so re-opening the
  delivery shows "... already covers this excess" instead of the button.

  WITHDRAW that PR from In Review and the button comes BACK. That is the whole
  reason no boolean is stored: the state is read from the PR's Status.

------------------------------------------------------------------
2. Approve the draft, and the excess MOVES
------------------------------------------------------------------
Submit it, sign it through, and PO generation settles it:

  - the delivery's over-delivery row loses its flag and re-attaches to the new
    order's own ordered item (so /deliveries stops showing "Over-delivered")
  - ${ids.aInvoice ?? "<A-INV>"}'s single line of 12 splits into 10 on ${ids.aPo ?? "<A-PO>"} and 2 on the
    new order — while Amount Due, Calculated Total and Paid do not move
  - the invoice's items table FOLDS those two back into one row of 12, so it
    still reads line-for-line against the vendor's PDF, and its PO column is
    gone because a folded row spans two orders
  - the Delivery section's boxes each name their own order instead

------------------------------------------------------------------
3. The banner, on three documents
------------------------------------------------------------------
/prs/<the correction>, /pos/<the new order> and /pos/${ids.aPo ?? "<A-PO>"} all carry it, all
derived from links — no stored flag anywhere. Each says what it is a
correction of, and then the accounting caveat: ${ids.aInvoice ?? "<A-INV>"} bills BOTH orders,
so a payment against it matches neither order's total on its own. That is the
sentence the office needs and the reason the banner outlives signature.

------------------------------------------------------------------
4. Scenario B is the same, on an ALREADY PAID invoice
------------------------------------------------------------------
/deliveries/${ids.bDelivery ?? "<B>"} — 3 EA over, billed by ${ids.bInvoice ?? "<B-INV>"}, which is Paid.
Splitting it is allowed BY DESIGN, because nothing on the header moves: the
bill usually arrives and is settled before anyone corrects the record, so
refusing here would refuse the common case.

------------------------------------------------------------------
Also worth seeing: the REFUSALS
------------------------------------------------------------------
#166's own seed has over-deliveries whose invoices carry no file, so
/deliveries/HYE-DL-260804-07 shows the Correction box with
"${"${invoiceId}"} has no file attached, so there is nothing to quote from."
An ineligible row still says WHY — a missing button is not an answer.
`);
}
