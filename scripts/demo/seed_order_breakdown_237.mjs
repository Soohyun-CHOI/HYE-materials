// Browsable states for the per-order item list on an invoice (#237).
//
// TWO INVOICES, ONE EACH SIDE OF THE RULE, and the silent one is the shape nothing on
// this base held — a case observable only in the data rather than in the copy:
//
//   A  a CORRECTIVE order. One item billed 13, corrected to 10 on the original
//      order and 3 on the correction's, so the invoice names two orders and its one
//      folded item touches BOTH. The sets agree, so the list stays SILENT — which is
//      the case that matters most, a correction being the overwhelmingly common
//      reason a real invoice carries two orders. Before this seed the only
//      two-order invoice on the base was `HYE-INV-260804-03`, where each item
//      touches one order, so only the LISTED half had ever been seen on a screen.
//   B  one item per order. Two items, two orders, the sets differ, so the list is
//      ON and each order carries the quantity billed against it. The base did hold
//      this half already (`HYE-INV-260804-03`), and it is here as the pair to A:
//      one invoice each side of the same rule, on the same job and vendor.
//
// A GOES THROUGH THE REAL CORRECTION FLOW, NOT A HAND-WRITTEN END STATE, and the
// reason is the fold key. `lib/invoiceItemFold.js` keys on `Material` PLUS unit
// price, so two halves at different prices do NOT fold — each would then touch one
// order, the sets would differ, and the seed would produce the exact opposite of the
// case it exists to show. `splitInvoiceLineForOverage` carries `bill.unitPrice` onto
// the half it creates and takes the ordered item's name, size and unit from the
// corrective order, whose `Material` #18's cache wrote during the same PO
// generation. Letting the app do it is what guarantees the shape; writing the end
// state by hand would be asserting it.
//
// So the chain is `createOverageDraft` → Approved → `generatePOForApprovedPR`, which
// calls `applyOverageToPO` itself. The signing UI is shortcut with a direct status
// write, exactly as `seed_overage_167.mjs:makeOrder` does, and for the same reason:
// what is being seeded is the settled state, not the approval path.
//
// WHAT THIS FILE DELIBERATELY DOES NOT SEED, AND WHY THAT IS NOT A GAP: an order
// reached only through an item with no ordered item behind it, which would keep its
// line with nothing under it. It needs a free-text invoice item, and the form cannot
// make one — `SHOW_OTHER_ITEM_OPTION` is false (#96) and the plan no longer calls for
// free-text charges at all, so the exclusion in `lib/invoiceOrderBreakdown.js` is
// defensive rather than a live path. A seed exists to put a state a person can reach
// in front of them; writing one the app cannot produce would say the opposite. The
// rule is held in the offline tier instead, on both halves — such a row stays out of
// the judgment AND lands under no order — each shown to fail under a mutation.
// An earlier revision of this file created that row on the B invoice and it was
// retired in the same commit that added this paragraph; the order it charged
// (`237-DEMO Cap`) is left standing, an order having existed either way.
//
// IT RUNS #231's MATCHER, BECAUSE `createInvoice` DOES NOT. The computed pairing lives
// in `createInvoiceAction` — `getArrivalsForBill`, then `matchArrivalToBill`, then
// `setInvoiceDelivery` on `matched` — and a seed that writes the record directly skips
// all three, so an invoice whose material demonstrably arrived was left with an empty
// `Delivery`. That is worse than a missing fixture: the screen then says
// `Awaiting delivery` and `No delivery has been matched to this invoice yet`, which is
// exactly what a real failed match looks like, so anyone later working on the invoice
// axis would read their own code as broken against data the matcher had never been
// asked about. **Nothing here writes that link by hand** — the three steps run in the
// order the action runs them, right after the charges land and before the correction,
// which is also the order the office works in. Whatever the matcher answers is the
// fixture's state: A matches its arrival, B has no arrival at all and answers `none`,
// and both answers are printed by the run.
//
// THE TWO CASES CANNOT SHARE ONE INVOICE: A must render silent and B must render
// listed, and an invoice is one or the other. Two invoices, therefore, and the ids
// are printed at the end.
//
// ONE CORRECTION IS ONE ORDERED ITEM, so A has ONE folded item touching both orders
// rather than two. `createOverageDraft` takes a single delivery row and raises a
// single-item request, so two split items would mean two corrections and two
// corrective orders — `{A1,A2}` beside `{A1,A3}`, which DIFFER and would turn the
// list on. The all-items-split-across-the-same-two variant is asserted in
// `scripts/tests/offline/invoice-order-breakdown.mjs`, which can hold a shape the
// app cannot reach; nothing here fakes it.
//
// Creates only: nothing existing is updated or deleted, and no schema changes.
// Re-runnable — skips on its own item axis, like seed_overage_167.mjs.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_order_breakdown_237.mjs

import { put } from "@vercel/blob";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import {
    createDeliveryItem,
    getItemsByDelivery,
    getDeliveryItemsByRecordIds,
} from "../../lib/airtable/deliveryItems.js";
import {
    createInvoice,
    getAllInvoices,
    getInvoiceByRecordId,
    setInvoiceDelivery,
} from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { createOverageDraft, getOverageContext } from "../../lib/overagePR.js";
import { getArrivalsForBill } from "../../lib/deliveryInvoiceCandidates.js";
import { PAIRING, matchArrivalToBill } from "../../lib/deliveryInvoiceMatch.js";
import { linkedDelivery } from "../../lib/deliveryInvoiceLink.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";

const JOB_CODE = "26-DEMO-01";
const VENDOR_NAME = "Demo Vendor Co.";
const SIZE = '2"';
const UNIT = "EA";
const PRICE = 12;
const FIRST_ITEM = "237-DEMO Elbow";

// Declared before the skip check because the guide reads it, and the skip path is
// the only way to reach that check — the same temporal-dead-zone trap
// seed_delivery_status_166.mjs had to fix.
const ids = {};
const manifest = [];
const pairings = [];

/** Every record this run created, for telling a fixture from real data later. */
function made(kind, id, note) {
    manifest.push({ kind, id, note });
    return id;
}

console.log("=".repeat(72));
console.log("seed_order_breakdown_237 — the two shapes #237's list turns on");
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
    console.log("Delete the 237-DEMO Materials rows by hand if you want a clean re-seed.");
    // The guide is the point of a re-run, so the skip path RESOLVES the ids rather
    // than printing placeholders: a guide that says `<A>` sends the reader to the
    // Airtable base to find what this file already knows how to look up.
    await resolveSeededIds();
    printGuide();
    process.exit(0);
}

/**
 * Fill `ids` from what is already on the base, for the skip path. Keyed on the
 * vendor invoice codes this file writes, and the orders come off each invoice's own
 * items — the same derivation `/invoices/[invoiceId]` uses, so a re-run reports the
 * orders the screen will actually list.
 */
async function resolveSeededIds() {
    const invoices = await getAllInvoices();
    const byCode = (code) => invoices.find((inv) => inv.vendorInvoiceCode === code);
    const ordersOf = async (invoice) => {
        if (!invoice) return [];
        const items = await getItemsByInvoice(invoice.id);
        const recordIds = [...new Set(items.map((it) => it.po?.[0]).filter(Boolean))];
        const pos = await Promise.all(recordIds.map((id) => getPOByRecordId(id)));
        return pos.map((po) => po.poId);
    };

    const a = byCode("237-DEMO-A");
    const b = byCode("237-DEMO-B");
    ids.aInvoice = a?.invoiceId;
    ids.bInvoice = b?.invoiceId;
    [ids.aPo, ids.aCorrectionPo] = await ordersOf(a);
    [ids.bPo1, ids.bPo2] = await ordersOf(b);
    // The delivery is read off the INVOICE's own link rather than looked up by name,
    // so a re-run reports what the matcher actually left there — including nothing,
    // if it left nothing.
    const pairedRecordId = linkedDelivery(a);
    if (pairedRecordId) {
        const [delivery] = await getDeliveriesByRecordIds([pairedRecordId]);
        ids.aDelivery = delivery?.deliveryId;
    }
}

/** A one-page PDF standing in for the vendor's invoice scan. */
function invoicePdfBytes(label) {
    const body =
        "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
        "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
        "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 80]>>endobj\n";
    return Buffer.from(`%PDF-1.4\n% ${label}\n${body}trailer<</Root 1 0 R>>\n%%EOF\n`, "utf8");
}

/**
 * One order through the approve-and-generate path, not hand-created PO Items — PO
 * generation is what writes each ordered item's `Material` link (#18), and both the
 * fold and the overage apply step match on that link and never on `Item Name` text.
 */
async function makeOrder({ itemName, qty }) {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: "237-DEMO order",
    });
    made("Purchase Request", pr.prId, itemName);
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName,
        size: SIZE,
        unit: UNIT,
        qty,
        unitPrice: PRICE,
        remark: "",
    });
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
    const orderedItem = (await getItemsByPO(gen.poRecordId))[0];
    made("Purchase Order", po.poId, `${itemName} × ${qty}`);
    made("PO Item", orderedItem.poItemId, itemName);
    return { pr, po, orderedItem };
}

/** An arrival that brings more than was ordered, in the app's own two-row shape. */
async function overDeliver({ orderedItem, within, over, receivedDate }) {
    const delivery = await createDelivery({
        jobRecordId: line.jobId,
        vendorRecordId: vendor.id,
        packingListPORecordId: null,
        receivedDate,
        recordedByUserId: requester.id,
        notes: "237-DEMO delivery",
        file: [],
    });
    made("Delivery", delivery.deliveryId, `${within} + ${over} over`);
    for (const [qty, isOver] of [[within, false], [over, true]]) {
        const item = await createDeliveryItem({
            deliveryRecordId: delivery.id,
            deliveryId: delivery.deliveryId,
            poItemRecordId: orderedItem.id,
            materialRecordId: orderedItem.material?.[0] ?? null,
            itemName: orderedItem.itemName,
            size: orderedItem.size,
            unit: orderedItem.unit,
            qty,
            overDelivered: isOver,
        });
        made("Delivery Item", item.deliveryItemId, isOver ? `${qty} over` : `${qty} within order`);
    }
    return (await getDeliveriesByRecordIds([delivery.id]))[0];
}

/**
 * An invoice with a real file, because the correction reads AIRTABLE's copy of it
 * and an unattached invoice is exactly the state that blocks the button (#140/#142).
 */
async function makeInvoice({ code, issueDate, amountDue }) {
    const blob = await put(`237-DEMO-${code}.pdf`, invoicePdfBytes(`237-DEMO ${code}`), {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: true,
    });
    const invoice = await createInvoice({
        vendorId: vendor.id,
        vendorInvoiceCode: code,
        issueDate,
        dueDate: "2026-09-30",
        amountDue,
        shippingFee: 0,
        file: [{ url: blob.url, filename: `237-DEMO-${code}.pdf` }],
    });
    made("Invoice", invoice.invoiceId, code);
    for (let i = 0; i < 40; i++) {
        const fresh = await getInvoiceByRecordId(invoice.id);
        if (fresh.file?.[0]?.url && fresh.file[0].url !== blob.url) return fresh;
        await new Promise((r) => setTimeout(r, 300));
    }
    return await getInvoiceByRecordId(invoice.id);
}

/**
 * One charge against one ordered item. There is no free-text branch on purpose —
 * see the header for why that shape is not seeded.
 */
async function charge({ invoice, po, orderedItem, qty, unitPrice = PRICE }) {
    const item = await createInvoiceItem({
        invoiceRecordId: invoice.id,
        invoiceId: invoice.invoiceId,
        poRecordId: po.id,
        poItemRecordId: orderedItem.id,
        itemName: orderedItem.itemName,
        size: orderedItem.size,
        unit: orderedItem.unit,
        qty,
        unitPrice,
        remark: "",
    });
    made("Invoice Item", item.invoiceItemId, `${qty} on ${po.poId}`);
    return item;
}

/**
 * #231's computed pairing, in `createInvoiceAction`'s own three steps: the candidate
 * walk, the pure matcher, and a write ONLY on `matched`. Called after an invoice's
 * charges exist and never with a delivery chosen here — see the header.
 *
 * The bill is read back off the base rather than assembled from what was just
 * written; the action assembles it from the submitted form rows to save a read, and
 * a seed has no reason to.
 */
async function pairInvoice(invoice) {
    const items = await getItemsByInvoice(invoice.id);
    const orderedItems = items.map((it) => ({
        poItemRecordId: it.poItem?.[0] || null,
        unitPrice: it.unitPrice,
    }));
    const { arrivals, bills, agreedPrices } = await getArrivalsForBill(requester, {
        vendorRecordId: vendor.id,
        orderedItems,
    });
    const outcome = matchArrivalToBill({
        bill: {
            invoiceRecordId: invoice.id,
            invoiceId: invoice.invoiceId,
            orderedItems: orderedItems.filter((o) => o.poItemRecordId),
            pairedDeliveryRecordId: null,
        },
        arrivals,
        bills,
        agreedPrices,
    });
    if (outcome.key === PAIRING.matched) {
        await setInvoiceDelivery(invoice.id, outcome.deliveryRecordId);
    }
    pairings.push({ invoiceId: invoice.invoiceId, outcome, arrivals: arrivals.length });
    console.log(
        `  pairing ${invoice.invoiceId}: ${outcome.key}` +
            `${outcome.deliveryId ? ` -> ${outcome.deliveryId}` : ""}` +
            ` (${arrivals.length} arrival${arrivals.length === 1 ? "" : "s"} to choose from)`
    );
    return outcome;
}

// ---------------------------------------------------------------------------
// A — the corrective order: two orders, one folded item touching both, SILENT
// ---------------------------------------------------------------------------
console.log("\nA — a correction splits one billed item across two orders:");

const a = await makeOrder({ itemName: FIRST_ITEM, qty: 10 });
const aDelivery = await overDeliver({
    orderedItem: a.orderedItem,
    within: 10,
    over: 3,
    receivedDate: "2026-08-10",
});
const aInvoice = await makeInvoice({
    code: "237-DEMO-A",
    issueDate: "2026-08-11",
    amountDue: 13 * PRICE,
});
await charge({ invoice: aInvoice, po: a.po, orderedItem: a.orderedItem, qty: 13 });
console.log(`  ordered 10, delivered 13, billed 13 on ${aInvoice.invoiceId}`);

// BEFORE the correction, which is where the action runs it and the order the office
// works in: the bill arrives, the pairing is computed, and only then does anyone
// notice the excess. The link survives the split — the arrival's rows move to the
// corrective order's ordered item, and the bill still charges every one of them.
await pairInvoice(aInvoice);

// The correction, through the same context the delivery page's button reads.
const overRow = (await getItemsByDelivery(aDelivery.id)).find((r) => r.overDelivered);
const [row] = await getDeliveryItemsByRecordIds([overRow.id]);
const context = (
    await getOverageContext([row], { deliveryIds: new Map([[aDelivery.id, aDelivery.deliveryId]]) })
).get(row.id);
if (!context?.eligibility?.eligible) {
    throw new Error(`the over-delivery is not correctable: ${context?.eligibility?.key ?? "no context"}`);
}
const draft = await createOverageDraft({
    user: requester,
    delivery: aDelivery,
    row,
    orderedItem: context.orderedItem,
    bill: context.bill,
    originalPR: context.originalPR,
});
made("Purchase Request", draft.pr.prId, "overage correction");
console.log(`  correction raised as ${draft.pr.prId} (Draft)`);

// Approved and generated. NOTHING HERE SPLITS THE INVOICE ITEM: `applyOverageToPO`
// runs inside `generatePOForApprovedPR`, so the split is the app's, and calling it
// again from here would only report `already applied` on a settled row — measured on
// the first run of this file, which did exactly that before this comment replaced it.
await updatePR(draft.pr.id, { status: "Approved" });
const correctionPR = await getPRByRecordId(draft.pr.id);
const gen = await generatePOForApprovedPR(correctionPR);
const correctionPO = await getPOByRecordId(gen.poRecordId);
made("Purchase Order", correctionPO.poId, "corrective order");
const correctionItem = (await getItemsByPO(gen.poRecordId))[0];
made("PO Item", correctionItem.poItemId, "the excess");
console.log(`  ${correctionPO.poId} generated, and the apply step ran inside it`);

const aItems = await getItemsByInvoice(aInvoice.id);
for (const it of aItems) {
    if (!manifest.some((m) => m.id === it.invoiceItemId)) {
        made("Invoice Item", it.invoiceItemId, "created by the split");
    }
}
console.log(
    `  ${aInvoice.invoiceId} now bills ` +
        aItems.map((it) => `${it.qty} @ $${it.unitPrice}`).join(" + ") +
        " across two orders"
);

ids.aInvoice = aInvoice.invoiceId;
ids.aPo = a.po.poId;
ids.aCorrectionPo = correctionPO.poId;
ids.aDelivery = aDelivery.deliveryId;

// ---------------------------------------------------------------------------
// B — one item per order: LISTED
// ---------------------------------------------------------------------------
console.log("\nB — two items, one on each of two orders:");

const b1 = await makeOrder({ itemName: "237-DEMO Tee", qty: 5 });
const b2 = await makeOrder({ itemName: "237-DEMO Union", qty: 7 });
const bInvoice = await makeInvoice({
    code: "237-DEMO-B",
    issueDate: "2026-08-12",
    amountDue: 5 * PRICE + 7 * PRICE,
});
await charge({ invoice: bInvoice, po: b1.po, orderedItem: b1.orderedItem, qty: 5 });
await charge({ invoice: bInvoice, po: b2.po, orderedItem: b2.orderedItem, qty: 7 });
// Nothing has been delivered against either order, so this answers `none` and writes
// nothing. Run anyway, and that is the point: `Awaiting delivery` on this invoice is
// then the matcher's ANSWER rather than a question never put to it.
await pairInvoice(bInvoice);

ids.bInvoice = bInvoice.invoiceId;
ids.bPo1 = b1.po.poId;
ids.bPo2 = b2.po.poId;
console.log(`  ${bInvoice.invoiceId}: 5 on ${ids.bPo1}, 7 on ${ids.bPo2}`);

printGuide();

function printGuide() {
    console.log("\n" + "=".repeat(72));
    console.log("WHERE TO LOOK");
    console.log("=".repeat(72));
    console.log(`
------------------------------------------------------------------
1. /invoices/${ids.aInvoice ?? "<A>"}  —  two orders, NO item list
------------------------------------------------------------------
  Purchase Orders
  ${ids.aPo ?? "<A-PO>"} — Awaiting Signature
  ${ids.aCorrectionPo ?? "<A-CORRECTION>"} — Awaiting Signature

Nothing under either line, and that is the answer rather than a gap: the
invoice's ONE folded item touches both orders, so "which order was this
billed against" has the same answer for every item and the list would
repeat it. The items table below shows one row of 13; the two rows behind
it are 10 on the first order and 3 on the second, at one price, which is
what makes them fold.

Its Delivery section reads Delivered, naming ${ids.aDelivery ?? "<A-DL>"} —
#231's matcher put it there, the arrival having brought every ordered item
the bill charges. The two entries under it are one per invoice item, both
silent and both the same name, because the split made two rows of one item.

------------------------------------------------------------------
2. /invoices/${ids.bInvoice ?? "<B>"}  —  listed, one item per order
------------------------------------------------------------------
  Purchase Orders
  ${ids.bPo1 ?? "<B1>"} — Awaiting Signature
      237-DEMO Tee 2" — 5 EA
  ${ids.bPo2 ?? "<B2>"} — Awaiting Signature
      237-DEMO Union 2" — 7 EA

The sets differ — one item names one order, the other names the other — so
the list appears and each order carries the quantity billed against IT.

Its Delivery section reads Awaiting delivery, and THAT IS A RESULT: the
matcher ran and answered \`none\`, nothing having been delivered against
either order. The distinction matters because an empty Delivery looks
identical whether the match failed or was never attempted, and the second
would make a future reader of the invoice axis debug their own code
against data nobody had asked the matcher about.

WHAT IS DELIBERATELY NOT HERE: an order reached only through an item with
no ordered item behind it, which would keep its line with nothing under
it. That needs a free-text invoice item, which the form cannot make
(\`SHOW_OTHER_ITEM_OPTION\` is false, #96) and which the plan no longer
calls for, so it is not a state this app produces. The exclusion still has
to hold defensively, and \`offline/invoice-order-breakdown.mjs\` is what
holds it — asserting both that such a row stays out of the judgment and
that it lands under no order, each shown to fail under a mutation. An
earlier revision of this file seeded that row on ${ids.bInvoice ?? "<B>"};
it was retired, and the order it charged (237-DEMO Cap) is left where it
is, an order having existed either way.

------------------------------------------------------------------
3. The three that must stay silent
------------------------------------------------------------------
HYE-INV-260716-03 (one order, two items), HYE-INV-260804-02 (one order
plus a free-text charge) and HYE-INV-260727-03 (no order at all). Nothing
this seed created touches them.
`);
    if (manifest.length === 0) return;
    console.log("=".repeat(72));
    console.log(`CREATED BY THIS RUN — ${manifest.length} records`);
    console.log("=".repeat(72));
    for (const { kind, id, note } of manifest) {
        console.log(`  ${kind.padEnd(18)} ${String(id).padEnd(26)} ${note}`);
    }
    if (pairings.length > 0) {
        console.log(`\n${"=".repeat(72)}`);
        console.log("#231's PAIRING, PER INVOICE — the matcher's answer, not a choice made here");
        console.log("=".repeat(72));
        for (const { invoiceId, outcome, arrivals } of pairings) {
            console.log(
                `  ${invoiceId.padEnd(20)} ${outcome.key.padEnd(10)}` +
                    ` ${outcome.deliveryId ?? "(no link written)"}` +
                    `   ${arrivals} arrival(s) considered`
            );
        }
    }
    console.log(`
Also written by this run, and by #231's matcher rather than by hand: the
\`Delivery\` link on each invoice the matcher paired. Never set here
directly — an empty link is a real state of a real bill, and a hand-set one
would be indistinguishable from a computed one, which is the confusion this
whole paragraph exists to avoid.

Also created as side effects, by the app rather than by this file: one
Quotation on the correction request (the invoice's own file, re-uploaded),
the corrective order's PO PDF, three Materials rows and their Material
Prices (#18's cache, on PO generation), and the Invoice-PO Link row the
overage split writes for the corrective order. This file writes no join
row itself, so the B invoice has none.
`);
}
