// Delivered against invoiced against ordered — credentialed (#166, #210).
//
// The offline tier pins the judgment itself (scripts/tests/offline/
// delivery-status.mjs: the two comparisons, the four verdicts, the chips, the
// freight exclusion, the copy branches, the filters and the worklist order; and
// offline/delivery-invoice-link.mjs the pairing rule and its refusals).
// What only real records can answer is here:
//
//   A — the THREE links the two walks travel — `PO Items."Delivery Items"`,
//       `PO Items."Invoice Items"` and, since #210, `Invoices."Delivery"` with its
//       symmetric `Deliveries."Invoices"` — are readable and populated, and the
//       `Invoiced Qty` rollup reflects an invoice item on the FIRST read after it
//       is created. None is visible to a file-only check, and a link field renamed
//       in the UI makes `record.get()` return undefined, which every screen would
//       render as nothing at all.
//   B — the invoice axis on real records: an invoice paired with the shipment that
//       answered it, one with nothing paired, and a free-text invoice item that
//       is excluded rather than counted as short.
//   C — the delivery axis: an arrival with no invoice naming it, which is the
//       worklist this feature exists to replace the month-end email with, and one
//       whose bill covers only part of what it brought.
//   D — THE PAIRING, WHICH IS WHAT #210 REPLACED AN ESTIMATE WITH. Two bills on one
//       ordered item, each paired with its own shipment: each reads its own
//       shipment's quantity, and neither answer depends on the order they are taken
//       in. This part used to assert the opposite — that the oldest was treated as
//       settled and both were MARKED as estimates — and it is the same records
//       producing a different, looked-up answer that shows the estimate is gone
//       rather than merely renamed.
//   E — THE QUERY BUDGET. One invoice against several, and one delivery against
//       several, measured with the same _selectRecords/_findRecordById instrument
//       verify-material-price-19.mjs Part E uses: if anything were per-row the
//       larger set would cost more operations. The ceilings FELL in #210, because
//       the two levels that existed only to order the other bills on an ordered
//       item are nobody's business once the pairing is stored.
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-delivery-status-166.mjs
//
// Fixtures: creates PRs + PR Items and POs + PO Items through the real
// approve-and-generate flow (which is what gives each ordered item its `Material` link,
// the thing allocation matches on), plus Deliveries + Delivery Items and Invoices
// + Invoice Items. DELETES ALL OF THEM in this same run, children before parents,
// and the whole body sits in a try/catch so a mid-run throw cannot skip that —
// #165 learned that the hard way when four aborted runs left 100 records on the
// shared base. Creates nothing in Vercel Blob. Reuses (never modifies, never
// deletes) one active User, one Vendor and one Line.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { execSync } from "child_process";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { getItemsByPO, getPOItemsForReconciliation } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveriesByRecordIds } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem } from "../../lib/airtable/deliveryItems.js";
import {
    createInvoice,
    getInvoiceByRecordId,
    setInvoiceDelivery,
} from "../../lib/airtable/invoices.js";
import { createInvoiceItem, getItemsByInvoice } from "../../lib/airtable/invoiceItems.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import {
    getDeliveryInvoicing,
    getInvoiceDeliveryStatus,
    getInvoiceReconciliation,
} from "../../lib/deliveryReconciliation.js";
import {
    describeDeliveryColumn,
    describeInvoiceColumn,
    describeInvoiceLine,
    isNotFullyInvoiced,
} from "../../lib/deliveryStatus.js";
import { linkedDelivery } from "../../lib/deliveryInvoiceLink.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}

/**
 * Poll until a computed field settles, reporting READS as well as elapsed ms. ms
 * alone is ambiguous — it includes the reads themselves — so only reads === 1 says
 * the field was already correct before anything looked at it. Same helper, and
 * same reasoning, as verify-deliveries-162.mjs.
 */
async function waitFor(read, predicate, { ceilingMs = 15000, pollMs = 200 } = {}) {
    const t0 = Date.now();
    let reads = 1;
    let value = await read();
    while (!predicate(value) && Date.now() - t0 < ceilingMs) {
        await new Promise((r) => setTimeout(r, pollMs));
        value = await read();
        reads++;
    }
    return { value, ms: Date.now() - t0, reads, settled: predicate(value) };
}
const settleNote = (w) =>
    `${w.reads === 1 ? "already settled on the FIRST read" : `settled after ${w.reads} reads`}, ${w.ms}ms`;

/**
 * Count Airtable operations around one call. Monkey-patches the same two Table
 * prototype methods verify-material-price-19.mjs instruments, and throws if they
 * are gone rather than silently reporting 0 — a budget check that cannot see
 * anything would pass forever.
 *
 * One `_selectRecords` is one HTTP request per PAGE. These fixtures are far under
 * Airtable's 100-record page, so operations and requests coincide here.
 */
function instrumentedOps() {
    const tableProto = Object.getPrototypeOf(base(TABLES.INVOICES));
    const original = { select: tableProto._selectRecords, find: tableProto._findRecordById };
    if (typeof original.select !== "function" || typeof original.find !== "function") {
        throw new Error(
            "verify-delivery-status-166: airtable's Table prototype no longer exposes " +
                "_selectRecords/_findRecordById — the query-budget instrument needs updating"
        );
    }
    const counts = { select: 0, find: 0 };
    tableProto._selectRecords = function (...args) {
        counts.select++;
        return original.select.apply(this, args);
    };
    tableProto._findRecordById = function (...args) {
        counts.find++;
        return original.find.apply(this, args);
    };
    return {
        counts,
        restore() {
            tableProto._selectRecords = original.select;
            tableProto._findRecordById = original.find;
        },
    };
}

async function countOps(fn) {
    const probe = instrumentedOps();
    try {
        const result = await fn();
        return { result, total: probe.counts.select + probe.counts.find, ...probe.counts };
    } finally {
        probe.restore();
    }
}

// ---------------------------------------------------------------------------
// Header. A past run is only evidence if it can be tied to a tree, so the commit
// and whether it was dirty are printed before anything else runs. A dirty tree
// does not fail the run — it is normal to verify work in progress — but it means
// the commit alone does not identify what was tested.
function gitContext() {
    try {
        const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        return { head, dirty: status.split("\n").filter((l) => l.trim()).length };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}

const git = gitContext();
console.log("=".repeat(72));
console.log("verify-delivery-status-166 — delivered vs invoiced vs ordered");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty > 0
          ? `tree      DIRTY — ${git.dirty} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order: children before parents throughout, and the item-axis rows last because
// a Material Price links its Material.
const fixtures = createFixtures({
    tag: "V166",
    buckets: [
        { name: "invoiceItems", table: TABLES.INVOICE_ITEMS, label: "Invoice Item", tagField: "Item Name" },
        {
            name: "invoices",
            table: TABLES.INVOICES,
            label: "Invoice",
            tagField: "Vendor Invoice Code",
            children: [
                { link: "Invoice Items", table: TABLES.INVOICE_ITEMS, label: "Invoice Item" },
                // Untaggable: an Invoice-PO Link row's primary field is an
                // autoNumber and it carries no text at all, so it is reachable
                // only as a discovered child.
                { link: "Invoice-PO Link", table: TABLES.INVOICE_PO_LINK, label: "Invoice-PO Link" },
            ],
        },
        { name: "deliveryItems", table: TABLES.DELIVERY_ITEMS, label: "Delivery Item", tagField: "Item Name" },
        {
            name: "deliveries",
            table: TABLES.DELIVERIES,
            label: "Delivery",
            tagField: "Notes",
            children: [{ link: "Delivery Items", table: TABLES.DELIVERY_ITEMS, label: "Delivery Item" }],
        },
        // No tagField: written by generatePOForApprovedPR, and this script sets no
        // text field on it. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // The item-axis rows PO generation writes as a side effect (#18). This
        // script never holds their ids, so they are found by tag — and the prices
        // hang off the Material's own link field rather than a text match on
        // `Price Label`, which is a formula over two links and need not begin with
        // the tag. Prices before materials falls out of children-before-parents.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Item Name",
            discoverByTag: true,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

let complete = false;
try {
    const [users, vendors, lines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllLines()]);
    const requester = users[0];
    const vendor = vendors[0];
    const line = lines.find((l) => l.jobId);
    if (!requester || !vendor || !line) {
        incomplete = "need one active User, one Vendor and one Line attached to a Job";
        console.log(`\n  SKIP  ${incomplete}`);
    } else {
        console.log(
            `\nFixture context: vendor "${vendor.vendorName}", line "${line.lineLabel}" (both reused, not modified)`
        );

        /** One PR + item -> approve -> PO. Returns the PO's single ordered item. */
        async function makeOrder({ itemName, qty, unitPrice = 10 }) {
            const pr = await createPR({
                requesterId: requester.id,
                lineId: line.id,
                vendorId: vendor.id,
                notes: `${TAG} fixture`,
            });
            track("prs", pr.id);
            await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                itemName,
                size: '2"',
                unit: "EA",
                qty,
                unitPrice,
                remark: "",
            });
            await updatePR(pr.id, { status: "Approved" });
            const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
            track("pos", gen.poRecordId);
            const po = await getPOByRecordId(gen.poRecordId);
            const poLine = (await getItemsByPO(gen.poRecordId))[0];
            return { po, poLine };
        }

        async function deliver({ poLine, qty, over = false, receivedDate }) {
            const d = await createDelivery({
                jobRecordId: line.jobId,
                vendorRecordId: vendor.id,
                packingListPORecordId: null,
                receivedDate,
                recordedByUserId: requester.id,
                notes: `${TAG} arrival`,
                file: [],
            });
            track("deliveries", d.id);
            const di = await createDeliveryItem({
                deliveryRecordId: d.id,
                deliveryId: d.deliveryId,
                poItemRecordId: poLine.id,
                materialRecordId: poLine.material?.[0] ?? null,
                itemName: poLine.itemName,
                size: poLine.size,
                unit: poLine.unit,
                qty,
                overDelivered: over,
            });
            track("deliveryItems", di.id);
            // RE-READ, because `d` was captured before its line existed and so
            // carries an empty `deliveryItems` array. The pages read deliveries
            // from a Job's own link, which is always current, so re-reading here is
            // what makes the fixture match the real input rather than a stale one.
            return (await getDeliveriesByRecordIds([d.id]))[0];
        }

        async function bill({ po, poLine, qty, freight = false }) {
            const inv = await createInvoice({
                vendorId: vendor.id,
                vendorInvoiceCode: `${TAG}-${Math.random().toString(36).slice(2, 7)}`,
                issueDate: "2026-08-01",
                dueDate: "2026-09-01",
                amountDue: qty * 10,
                shippingFee: 0,
                file: [],
            });
            track("invoices", inv.id);
            const item = await createInvoiceItem({
                invoiceRecordId: inv.id,
                invoiceId: inv.invoiceId,
                poRecordId: po.id,
                poItemRecordId: poLine.id,
                itemName: poLine.itemName,
                size: poLine.size,
                unit: poLine.unit,
                qty,
                unitPrice: 10,
                remark: "",
            });
            track("invoiceItems", item.id);
            if (freight) {
                // A free-text invoice item: no PO Item, so no ordered quantity and no
                // delivery could ever correspond to it.
                const fr = await createInvoiceItem({
                    invoiceRecordId: inv.id,
                    invoiceId: inv.invoiceId,
                    poRecordId: po.id,
                    poItemRecordId: null,
                    itemName: `${TAG} Freight`,
                    qty: 1,
                    unitPrice: 25,
                    remark: "",
                });
                track("invoiceItems", fr.id);
            }
            return inv;
        }

        // -------------------------------------------------------------------
        console.log("\nPart A — the things the two walks rest on, and none is in the repo:");
        const arrived = await makeOrder({ itemName: `${TAG} Arrived`, qty: 10 });
        const arrivedDelivery = await deliver({
            poLine: arrived.poLine,
            qty: 10,
            receivedDate: "2026-07-15",
        });
        const arrivedInvoice = await bill({ po: arrived.po, poLine: arrived.poLine, qty: 10, freight: true });
        // #210 — the pairing, written the way both production paths write it.
        await setInvoiceDelivery(arrivedInvoice.id, arrivedDelivery.id);

        // The rollup on the FIRST read after the invoice item was created. The
        // reader subtracts it from delivered to decide what a screen claims, so a
        // lagging value would report material as unbilled the moment it was billed.
        const rolled = await waitFor(
            async () => (await getPOItemsForReconciliation([arrived.poLine.id]))[0]?.invoicedQty,
            (v) => v === 10
        );
        check(`Invoiced Qty reflects the new invoice line (${settleNote(rolled)})`, rolled.value, 10);

        const [reconLine] = await getPOItemsForReconciliation([arrived.poLine.id]);
        assert("the PO line carries its Delivery Items reverse-link", reconLine.deliveryItems.length === 1);
        assert("and its Invoice Items reverse-link", reconLine.invoiceItems.length === 1);
        check("ordered qty is there for the third comparison", reconLine.qty, 10);

        // #210 — THE STORED PAIRING, BOTH HALVES. A renamed link field returns
        // undefined from record.get(), which the chip would render as `Awaiting
        // delivery` on an invoice whose material is in the warehouse — a wrong answer
        // that looks like an ordinary one, which is why this is measured rather than
        // assumed. The mapper is what is being tested, not Airtable.
        const pairedInvoice = await getInvoiceByRecordId(arrivedInvoice.id);
        check(
            "Invoices.\"Delivery\" reads back as the shipment it was pointed at",
            linkedDelivery(pairedInvoice),
            arrivedDelivery.id
        );
        const [pairedDelivery] = await getDeliveriesByRecordIds([arrivedDelivery.id]);
        assert(
            "and the symmetric Deliveries.\"Invoices\" carries the bill, unwritten by anything",
            (pairedDelivery.invoices || []).includes(arrivedInvoice.id)
        );
        // The anti-vacuity for both — an unpaired invoice reading as unpaired — is in
        // Part B, which already creates one. Doing it here would need a second bill on
        // this ordered item, and that would move the `Invoiced Qty` total Part D
        // measures.

        // -------------------------------------------------------------------
        console.log("\nPart B — the invoice axis on real records:");
        const arrivedFull = pairedInvoice;
        const statusMap = await getInvoiceDeliveryStatus([arrivedFull]);
        const s = statusMap.get(arrivedFull.id);
        check("a shipment is named, so the chip is Delivered", s.key, "delivered");
        check("and the quantities match, so no marker", s.mismatch, false);
        check("one ordered item judged", s.judged, 1);
        // The freight invoice item is excluded rather than counted as short —
        // without this every invoice carrying one would read as not arrived.
        check("and the free-text line was excluded, not judged", s.excludedCount, 1);
        check("the chip says so", describeInvoiceColumn(s).text, "Delivered");

        const notArrived = await makeOrder({ itemName: `${TAG} Pending`, qty: 6 });
        const pendingInvoice = await bill({ po: notArrived.po, poLine: notArrived.poLine, qty: 6 });
        const pendingFull = await getInvoiceByRecordId(pendingInvoice.id);
        // ANTI-VACUITY for Part A's two link assertions: an invoice nobody paired must
        // read as unpaired, or those would pass against a mapper returning a constant.
        check("an invoice nobody paired reads as null, not as something", linkedDelivery(pendingFull), null);
        const pendingStatus = (await getInvoiceDeliveryStatus([pendingFull])).get(pendingFull.id);
        check("nothing paired, so the chip is Awaiting delivery", pendingStatus.key, "awaiting-delivery");
        check(
            "and the chip is a fact, not a verdict",
            describeInvoiceColumn(pendingStatus).text,
            "Awaiting delivery"
        );
        // NO MARKER WITHOUT A LINK, on real records. Every invoice item of this
        // invoice is trivially short — nothing has arrived — and marking it would
        // put a discrepancy on every bill the vendor emails ahead of the material.
        check("and no mismatch marker, because there is nothing to compare", pendingStatus.mismatch, false);

        // A PAIRED SHIPMENT THAT BROUGHT LESS THAN THE BILL: the chip stays Delivered
        // and the discrepancy is the marker. This is the state `Partly delivered` used
        // to occupy, and the difference is that this one is a real shortfall rather
        // than an artifact of filling bills oldest-first.
        const shortOrder = await makeOrder({ itemName: `${TAG} Short`, qty: 13 });
        const shortDelivery = await deliver({
            poLine: shortOrder.poLine,
            qty: 10,
            receivedDate: "2026-07-20",
        });
        const shortBill = await bill({ po: shortOrder.po, poLine: shortOrder.poLine, qty: 13 });
        await setInvoiceDelivery(shortBill.id, shortDelivery.id);
        const shortStatus = (await getInvoiceDeliveryStatus([await getInvoiceByRecordId(shortBill.id)])).get(
            shortBill.id
        );
        check("the shipment is named, so the chip is still Delivered", shortStatus.key, "delivered");
        check("and the shortfall is the MARKER", shortStatus.mismatch, true);
        check("with no line counted as covered", shortStatus.covered, 0);

        // The detail section's per-item figures and the deliveries themselves.
        const recon = await getInvoiceReconciliation(await getItemsByInvoice(arrivedFull.id), {
            linkedDeliveryRecordId: linkedDelivery(arrivedFull),
        });
        // ONE ROW PER INVOICE ITEM, judged or not: the free-text invoice item gets
        // a box of its own saying why it was not compared, rather than a footnote
        // about a invoice item the reader cannot see.
        check("a row for every invoice line", recon.rows.length, 2);
        const judgedRow = recon.rows.find((r) => r.status);
        const notComparedRow = recon.rows.find((r) => !r.status);
        check("one of them is judged", Boolean(judgedRow), true);
        check("the freight line is counted as excluded", recon.excludedCount, 1);
        check(
            "and its own row says so where it is",
            describeInvoiceLine(notComparedRow.status, notComparedRow.unit, { hasDelivery: true })
                .verdict.key,
            "not-compared"
        );
        // ONE SCOPE PER ROW SINCE #232, and the row's `line` field is gone with the
        // second one. Every figure here is this invoice's: what it billed, and what
        // the delivery it MATCHES brought of that ordered item.
        check("this invoice's billed share", judgedRow.status.invoiced, 10);
        check("and what the delivery it MATCHES brought on that ordered item", judgedRow.status.delivered, 10);
        check("so nothing billed-not-delivered", judgedRow.status.billedNotArrived, 0);
        assert("the ordered item's own totals no longer ride along", !("line" in judgedRow));
        assert("nor does the ordered quantity", !("ordered" in judgedRow.status));
        // AND THIS BOX SAYS NOTHING, because everything it billed was delivered. The
        // whole invoice's answer is the chip; a box repeating it would state one fact
        // once per invoice item. Both slots null on a fixture where every figure
        // agrees is the shape #232's second pass is for.
        const settledBox = describeInvoiceLine(judgedRow.status, judgedRow.unit, {
            hasDelivery: true,
        });
        check("a box with nothing to report has no verdict", settledBox.verdict, null);
        check("  nor an order-scoped line", settledBox.againstOrder, null);
        // #232 — THE DELIVERY IS RETURNED ONCE, NOT PER ROW. `Invoices."Delivery"` is
        // single, so a per-row list printed one document once per invoice item; the
        // marker went with the move, a list of one under this invoice's own heading
        // having nothing to distinguish.
        check("the matched delivery is named at the top level", recon.delivery?.id, arrivedDelivery.id);
        check("with the received date", recon.delivery.receivedDate, "2026-07-15");
        assert("and no row carries a delivery list of its own", recon.rows.every((r) => !("deliveries" in r)));

        // -------------------------------------------------------------------
        console.log("\nPart C — the delivery axis: an arrival with no invoice naming it:");
        const unbilled = await makeOrder({ itemName: `${TAG} Unbilled`, qty: 4 });
        const unbilledDelivery = await deliver({
            poLine: unbilled.poLine,
            qty: 4,
            receivedDate: "2026-07-01",
        });
        const { byDelivery: invoicingMap } = await getDeliveryInvoicing([unbilledDelivery]);
        const di = invoicingMap.get(unbilledDelivery.id);
        check("no invoice names it", di.key, "awaiting-invoice");
        check("the worklist chip", describeDeliveryColumn(di).text, "Awaiting invoice");

        const billedDelivery = (await getDeliveriesByRecordIds([arrivedDelivery.id]))[0];
        const billedDeliveryStatus = (await getDeliveryInvoicing([billedDelivery])).byDelivery.get(billedDelivery.id);
        check("the delivery its own bill names reads invoiced", billedDeliveryStatus.key, "invoiced");
        check("its chip", describeDeliveryColumn(billedDeliveryStatus).text, "Invoiced");

        // #210 — THE CASE THE OLD EXISTENCE TEST GOT WRONG, AND THE REASON THIS AXIS
        // COMPARES QUANTITIES RATHER THAN BEING A BARE LOOKUP. The shipment above
        // brought 10 and its bill charges 13, so from the delivery's side there is
        // nothing left to chase; but a shipment whose bill covers only PART of what
        // arrived is still owed an invoice, and "does this delivery have one" would
        // read `Invoiced`. Before #210 the answer was worse still: the test asked
        // whether the ORDERED ITEM carried any invoice item at all, so an arrival with
        // nothing billed dropped out of the worklist as soon as some earlier bill had
        // touched the same order.
        const partOrder = await makeOrder({ itemName: `${TAG} PartBilled`, qty: 20 });
        const partDelivery = await deliver({
            poLine: partOrder.poLine,
            qty: 20,
            receivedDate: "2026-07-05",
        });
        const partBill = await bill({ po: partOrder.po, poLine: partOrder.poLine, qty: 8 });
        await setInvoiceDelivery(partBill.id, partDelivery.id);
        const partStatus = (
            await getDeliveryInvoicing([(await getDeliveriesByRecordIds([partDelivery.id]))[0]])
        ).byDelivery.get(partDelivery.id);
        check("20 delivered against a bill for 8 is PARTLY invoiced", partStatus.key, "partly-invoiced");
        check("  and the chip says so", describeDeliveryColumn(partStatus).text, "Partly invoiced");
        assert("  so it stays on the vendor-chasing worklist", isNotFullyInvoiced(partStatus.key));
        // A bill for MORE than arrived leaves nothing to chase from this side — the
        // discrepancy is the invoice axis's, which Part B measured as its marker.
        const shortDeliveryStatus = (
            await getDeliveryInvoicing([(await getDeliveriesByRecordIds([shortDelivery.id]))[0]])
        ).byDelivery.get(shortDelivery.id);
        check("10 delivered against a bill for 13 reads invoiced here", shortDeliveryStatus.key, "invoiced");

        // -------------------------------------------------------------------
        console.log("\nPart D — TWO BILLS ON ONE ORDERED ITEM: the pairing decides, not an ordering:");
        // A second invoice on the SAME ordered item, paired with a SECOND shipment.
        // This is the shape #166's estimate existed for and got wrong: with 16 billed
        // across two bills and 10 arrived, it filled oldest-first, handed the older
        // bill all 10, left the newer at 0, and marked BOTH as estimates. Each bill
        // now reads its own shipment, and nothing depends on which is taken first.
        const secondDelivery = await deliver({
            poLine: arrived.poLine,
            qty: 6,
            receivedDate: "2026-07-25",
        });
        const second = await bill({ po: arrived.po, poLine: arrived.poLine, qty: 6 });
        await setInvoiceDelivery(second.id, secondDelivery.id);
        const lineTotal = await waitFor(
            async () => (await getPOItemsForReconciliation([arrived.poLine.id]))[0]?.invoicedQty,
            (v) => v === 16
        );
        // Still the fact this part was named for: `Invoiced Qty` is the ORDERED ITEM's
        // total. Summing the invoice in hand would report 6 billed against 16 arrived
        // and hide that the order is billed twice over.
        check(`the ordered item's Invoiced Qty is both bills (${settleNote(lineTotal)})`, lineTotal.value, 16);

        const bothStatus = (await getInvoiceDeliveryStatus([await getInvoiceByRecordId(second.id)])).get(second.id);
        check("the newer bill reads Delivered, from its OWN shipment", bothStatus.key, "delivered");
        check("  and its quantities match, so no marker", bothStatus.mismatch, false);

        const olderStatus = (await getInvoiceDeliveryStatus([await getInvoiceByRecordId(arrivedFull.id)])).get(
            arrivedFull.id
        );
        check("and the older bill is unaffected by it", olderStatus.key, "delivered");
        check("  likewise unmarked", olderStatus.mismatch, false);
        // THE POINT OF THE WHOLE PART: under the old fill these two answers were
        // 'awaiting-delivery' and 'delivered', and both carried the inferred marker.
        // The same records now give each bill its own shipment's quantity.
        assert(
            "neither answer depends on which bill is taken first",
            bothStatus.key === olderStatus.key && !bothStatus.mismatch && !olderStatus.mismatch
        );

        const secondFull = await getInvoiceByRecordId(second.id);
        const secondRecon = await getInvoiceReconciliation(await getItemsByInvoice(second.id), {
            linkedDeliveryRecordId: linkedDelivery(secondFull),
        });
        check("billed on THIS invoice", secondRecon.rows[0].status.invoiced, 6);
        check("delivered by the delivery THIS invoice matches", secondRecon.rows[0].status.delivered, 6);
        check("so nothing is billed-not-delivered", secondRecon.rows[0].status.billedNotArrived, 0);
        // THE ORDERED ITEM'S TOTALS ARE THE FIXTURE THIS PART EXISTS FOR — 16 billed
        // across two invoices, 16 delivered across two arrivals — and #232 took them
        // off the row precisely because a reader took them for this invoice's. What
        // reaches the screen from that level now is the two exception figures alone.
        assert("neither rollup reaches the row any more", !("line" in secondRecon.rows[0]));
        assert("nor the ordered quantity", !("ordered" in secondRecon.rows[0].status));
        // 16 billed against an ordered item of 10, so the order-scoped line fires —
        // and its figure is the ORDERED ITEM's, which no per-invoice arithmetic could
        // produce: neither bill exceeds 10 on its own. THIS IS THE CASE THAT KEEPS
        // THE LINE, and the reason it does not depend on anything being matched.
        check(
            "the ordered item's billing excess is stated, and only that",
            describeInvoiceLine(secondRecon.rows[0].status, "EA", { hasDelivery: true }).againstOrder
                ?.text,
            "Against the ordered item: 6 EA more billed"
        );
        check(
            "  while the verdict stays silent, this bill having been delivered in full",
            describeInvoiceLine(secondRecon.rows[0].status, "EA", { hasDelivery: true }).verdict,
            null
        );
        assert(
            "and the box has no inferred slot left to fill",
            !("inferred" in describeInvoiceLine(secondRecon.rows[0].status, "EA", { hasDelivery: true }))
        );
        // TWO ARRIVALS TOUCHED THIS ORDERED ITEM AND THE BOX NAMES NEITHER. The one
        // this invoice matches is named once, at the top; the other is another bill's
        // business and #233 put "which deliveries filled this ordered item" on the
        // order's own page, which is the frame that owns the question.
        check("the matched delivery is named once", secondRecon.delivery?.id, secondDelivery.id);
        assert(
            "and no row lists the arrivals of the ordered item",
            secondRecon.rows.every((r) => !("deliveries" in r))
        );

        // -------------------------------------------------------------------
        console.log("\nPart E — the query budget does not grow with the rows:");
        const invoiceOne = [await getInvoiceByRecordId(arrivedFull.id)];
        const invoiceMany = await Promise.all(
            fixtures.ids("invoices").map((id) => getInvoiceByRecordId(id))
        );
        const one = await countOps(() => getInvoiceDeliveryStatus(invoiceOne));
        const many = await countOps(() => getInvoiceDeliveryStatus(invoiceMany));
        console.log(`  invoice axis: 1 invoice -> ${one.total} ops (${one.select} select, ${one.find} find)`);
        console.log(`  invoice axis: ${invoiceMany.length} invoices -> ${many.total} ops (${many.select} select, ${many.find} find)`);
        assert("the instrument saw something at all (else this check is inert)", one.total > 0);
        // NEVER MORE, AND IT CAN BE FEWER, so the property to assert is "does not grow
        // with rows" rather than "is a constant" — an empty level costs no query at
        // all, since findByRecordIds returns early on an empty id list. Both
        // comparisons here have to be read that way.
        assert(
            `${invoiceMany.length} invoices cost no more than 1 (${many.total} vs ${one.total})`,
            many.total <= one.total
        );
        // THE CEILING FELL FROM FIVE TO THREE IN #210, and the two that went are the
        // two the estimate needed: every OTHER bill on the ordered item, and those
        // bills' parents for their `Issue Date`. Neither is anybody's business once the
        // pairing is stored, and the list no longer reads `PO Items` at all — what was
        // ORDERED is a third document's figure and only the detail shows it.
        check("and the ceiling is the three levels the module documents", one.total, 3);

        // THE DETAIL, which reads a different three (PO Items, Delivery Items,
        // Deliveries). The invoice items are fetched OUTSIDE the probe: the detail
        // page holds them anyway for the items table, which is why this walk adds no
        // query for them.
        const detailLines = await getItemsByInvoice(arrivedFull.id);
        const detailOps = await countOps(() =>
            getInvoiceReconciliation(detailLines, {
                linkedDeliveryRecordId: linkedDelivery(arrivedFull),
            })
        );
        console.log(`  invoice detail: 1 invoice -> ${detailOps.total} ops`);
        check("the detail is three levels too", detailOps.total, 3);

        // #232 NARROWED LEVEL 3 AND NOT LEVEL 2, AND THIS MEASURES BOTH HALVES OF
        // THAT. Level 3 used to read every delivery that had touched the ordered
        // items, to list them all; it reads the one the invoice matches, so a bill
        // matching none drops it and measures 2. Level 2 still reads every slice on
        // the ordered items, because `arrivedBeyondOrder` stays order-scoped and only
        // the rows carry `Over Delivered` — so a bill matching none does NOT fall to
        // 1, and the assertion says which figure it is rather than only that it fell.
        // THE SAME INVOICE ITEMS WITH THE PAIRING SUPPRESSED, which is the production
        // call shape for an unmatched bill — `linkedDelivery` returns null and the
        // page passes it. Same ordered items and same slices as the measurement above,
        // so the ONE variable is the link, and the ordered items here do carry
        // arrivals: that is `HYE-INV-260804-04`'s shape on the real base, a bill
        // matching nothing whose ordered item other bills' deliveries have touched.
        const unpairedDetail = await countOps(() =>
            getInvoiceReconciliation(detailLines, { linkedDeliveryRecordId: null })
        );
        console.log(`  invoice detail: a bill matching no delivery -> ${unpairedDetail.total} ops`);
        assert("matching no delivery costs less than matching one", unpairedDetail.total < detailOps.total);
        check("  and what remains is PO Items plus the slice level", unpairedDetail.total, 2);

        const deliveryMany = await getDeliveriesByRecordIds(fixtures.ids("deliveries"));
        // COMPARE LIKE WITH LIKE: the delivery its own bill names, so all three levels
        // are non-empty in both measurements. Starting from the UNBILLED one would
        // compare 1 op against 3 and read as per-row growth when it is the empty-level
        // saving below.
        const dOne = await countOps(() => getDeliveryInvoicing([billedDelivery]));
        const dMany = await countOps(() => getDeliveryInvoicing(deliveryMany));
        console.log(`  delivery axis: 1 delivery -> ${dOne.total} ops, ${deliveryMany.length} -> ${dMany.total} ops`);
        assert(
            `${deliveryMany.length} deliveries cost no more than 1 (${dMany.total} vs ${dOne.total})`,
            dMany.total <= dOne.total
        );
        check("and it is the three levels the module documents", dOne.total, 3);
        // The two axes now cost the SAME, which they did not before: the invoice axis
        // was 5 against 3 because attribution needed the sibling bills. That difference
        // is what #210 removed, so an assertion that one exceeds the other would now be
        // asserting the defect.
        check("both axes cost the same three levels now", one.total, dOne.total);

        // An EMPTY level costs no query at all. Asserted rather than left as noise in
        // the numbers, because it is why the two measurements above had to be
        // shape-matched — and it got CHEAPER in #210: the walk no longer visits
        // `PO Items` to ask whether any bill exists, so an arrival nobody has billed
        // costs one read and stops.
        const dUnbilled = await countOps(() => getDeliveryInvoicing([unbilledDelivery]));
        console.log(`  delivery axis: an arrival no invoice names -> ${dUnbilled.total} ops`);
        check("an arrival nobody has billed costs one read", dUnbilled.total, 1);
        assert("so the budget is a CEILING of three, not a fixed three", dUnbilled.total < dOne.total);
        // And the same on the other axis, for the same reason.
        const iUnpaired = await countOps(() => getInvoiceDeliveryStatus([pendingFull]));
        console.log(`  invoice axis: a bill naming no shipment -> ${iUnpaired.total} ops`);
        assert("a bill naming no shipment costs less than one that does", iUnpaired.total < one.total);
    }
    complete = true;
} catch (err) {
    // Not `incomplete`: an unexpected throw is a failure (exit 1), not a part that
    // could not run. The cleanup below still runs either way — #165's lesson.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(72));
console.log(`commit ${git.head}${git.dirty ? " (DIRTY TREE)" : ""}`);
// TWO VERDICTS, TWO SENTENCES (#171). `pass` is about delivery status; a leak is
// about this run's effect on a shared base. Until #171 a failed delete lowered
// `pass`, so a leak printed `SOME CHECKS FAILED` — the right exit code attached to
// a sentence that sends the reader to look at the wrong thing.
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
