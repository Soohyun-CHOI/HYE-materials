// Delivered against invoiced against ordered — credentialed (#166).
//
// The offline tier pins the judgment itself (scripts/tests/offline/
// delivery-status.mjs: the two comparisons, the four verdicts, the chips, the
// freight exclusion, the copy branches, the filters and the worklist order).
// What only real records can answer is here:
//
//   A — the two reverse-links the join walks (`PO Items."Delivery Items"` and
//       `PO Items."Invoice Items"`) are readable and populated, and the
//       `Invoiced Qty` rollup reflects an invoice line on the FIRST read after it
//       is created. The join has no stored link, so these three are the whole of
//       what it rests on, and none is visible to a file-only check.
//   B — the invoice axis on real records: an invoice whose material arrived, one
//       whose material has not, and a free-text line that is excluded rather than
//       counted as short.
//   C — the delivery axis: an arrival with no invoice behind it, which is the
//       worklist this feature exists to replace the month-end email with.
//   D — ATTRIBUTION. Two bills on one ordered line with an arrival that covers
//       only one of them: the oldest is treated as settled, the newer reads as not
//       arrived, and both are marked as estimates. This is the shape the
//       determined/estimated boundary exists for, and the case that makes summing
//       the invoice in hand wrong — `Invoiced Qty` is the LINE's total.
//   E — THE QUERY BUDGET. One invoice against several, and one delivery against
//       several, measured with the same _selectRecords/_findRecordById instrument
//       verify-material-price-19.mjs Part E uses: if anything were per-row the
//       larger set would cost more operations.
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-delivery-status-166.mjs
//
// Fixtures: creates PRs + PR Items and POs + PO Items through the real
// approve-and-generate flow (which is what gives each line its `Material` link,
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
import { createInvoice, getInvoiceByRecordId } from "../../lib/airtable/invoices.js";
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
    showsThisBillShare,
} from "../../lib/deliveryStatus.js";
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

        /** One PR + item -> approve -> PO. Returns the PO's single line. */
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
                // A free-text line: no PO Item, so no ordered quantity and no
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
        console.log("\nPart A — the three things the join rests on, and none is in the repo:");
        const arrived = await makeOrder({ itemName: `${TAG} Arrived`, qty: 10 });
        await deliver({ poLine: arrived.poLine, qty: 10, receivedDate: "2026-07-15" });
        const arrivedInvoice = await bill({ po: arrived.po, poLine: arrived.poLine, qty: 10, freight: true });

        // The rollup on the FIRST read after the invoice line was created. The
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

        // -------------------------------------------------------------------
        console.log("\nPart B — the invoice axis on real records:");
        const arrivedFull = await getInvoiceByRecordId(arrivedInvoice.id);
        const statusMap = await getInvoiceDeliveryStatus([arrivedFull]);
        const s = statusMap.get(arrivedFull.id);
        check("everything billed is delivered", s.key, "delivered");
        check("one ordered item judged", s.judged, 1);
        // The freight line is excluded rather than counted as short — without this
        // every invoice carrying one would read as not arrived.
        check("and the free-text line was excluded, not judged", s.excludedCount, 1);
        check("the chip says so", describeInvoiceColumn(s).text, "Delivered");

        const notArrived = await makeOrder({ itemName: `${TAG} Pending`, qty: 6 });
        const pendingInvoice = await bill({ po: notArrived.po, poLine: notArrived.poLine, qty: 6 });
        const pendingFull = await getInvoiceByRecordId(pendingInvoice.id);
        const pendingStatus = (await getInvoiceDeliveryStatus([pendingFull])).get(pendingFull.id);
        check("billed with nothing delivered", pendingStatus.key, "awaiting-delivery");
        check(
            "and the chip is a fact, not a verdict",
            describeInvoiceColumn(pendingStatus).text,
            "Awaiting delivery"
        );

        // The detail section's per-item figures and the deliveries themselves.
        const recon = await getInvoiceReconciliation(await getItemsByInvoice(arrivedFull.id));
        // ONE ROW PER INVOICE LINE, judged or not: the free-text line gets a box of
        // its own saying why it was not compared, rather than a footnote about a
        // line the reader cannot see.
        check("a row for every invoice line", recon.rows.length, 2);
        const judgedRow = recon.rows.find((r) => r.status);
        const notComparedRow = recon.rows.find((r) => !r.status);
        check("one of them is judged", Boolean(judgedRow), true);
        check("the freight line is counted as excluded", recon.excludedCount, 1);
        check(
            "and its own row says so where it is",
            describeInvoiceLine(notComparedRow.status, notComparedRow.unit).verdict.key,
            "not-compared"
        );
        // Two scopes, deliberately distinct: `status` is THIS invoice's share,
        // `line` is the ordered item's own totals — which is what the box's
        // Ordered / Billed / Delivered figures show.
        check("this invoice's billed share", judgedRow.status.invoiced, 10);
        check("and what was allocated to it", judgedRow.status.delivered, 10);
        check("so nothing billed-not-delivered", judgedRow.status.billedNotArrived, 0);
        check("determined, not inferred — one bill on the ordered item", judgedRow.status.determinate, true);
        check("the ordered figure lives on the ordered item", judgedRow.line.ordered, 10);
        check("one bill shares the ordered item", judgedRow.billCount, 1);
        // THE DELIVERIES ARE ON THE ROW, not in a section of their own: a row is
        // scoped to one ordered item, so listing them there is exactly the claim
        // the data supports and needs no heading to qualify it.
        assert("the delivery is listed under the ordered item it touched", judgedRow.deliveries.length === 1);
        check("with the received date", judgedRow.deliveries[0].receivedDate, "2026-07-15");
        check("and a not-compared row claims none", notComparedRow.deliveries.length, 0);
        // The share line and the marker are one condition, and this is the shape
        // where neither should appear.
        check("no share line is needed here", showsThisBillShare(judgedRow.status), false);

        // -------------------------------------------------------------------
        console.log("\nPart C — the delivery axis: an arrival with no invoice behind it:");
        const unbilled = await makeOrder({ itemName: `${TAG} Unbilled`, qty: 4 });
        const unbilledDelivery = await deliver({
            poLine: unbilled.poLine,
            qty: 4,
            receivedDate: "2026-07-01",
        });
        const invoicingMap = await getDeliveryInvoicing([unbilledDelivery]);
        const di = invoicingMap.get(unbilledDelivery.id);
        check("no invoice on the ordered item it filled", di.key, "awaiting-invoice");
        check("the worklist chip", describeDeliveryColumn(di).text, "Awaiting invoice");

        const billedDelivery = (await getDeliveriesByRecordIds([fixtures.ids("deliveries")[0]]))[0];
        const billedDeliveryStatus = (await getDeliveryInvoicing([billedDelivery])).get(billedDelivery.id);
        check("the delivery whose ordered item IS billed reads invoiced", billedDeliveryStatus.key, "invoiced");
        check("its chip", describeDeliveryColumn(billedDeliveryStatus).text, "Invoiced");

        // -------------------------------------------------------------------
        console.log("\nPart D — Invoiced Qty is the LINE's total, not one invoice's lines:");
        // A second invoice on the SAME ordered line. Summing the invoice in hand
        // would report 6 billed against 10 delivered and call it covered; the line
        // total is 12, which is more billed than has arrived.
        const second = await bill({ po: arrived.po, poLine: arrived.poLine, qty: 6 });
        track("invoices", second.id);
        const lineTotal = await waitFor(
            async () => (await getPOItemsForReconciliation([arrived.poLine.id]))[0]?.invoicedQty,
            (v) => v === 16
        );
        check(`the line's Invoiced Qty is both invoices (${settleNote(lineTotal)})`, lineTotal.value, 16);

        // 10 arrived against 16 billed across two bills: covers one of them but not
        // both, which is the ONE shape that needs the oldest-first estimate.
        const bothStatus = (await getInvoiceDeliveryStatus([await getInvoiceByRecordId(second.id)])).get(second.id);
        check("the newer bill reads as not delivered", bothStatus.key, "awaiting-delivery");
        check("and is MARKED as inferred", bothStatus.estimated, true);

        // The older bill on the same line keeps its determined answer: the arrival
        // covers it exactly, so oldest-first hands it the whole 10.
        const olderStatus = (await getInvoiceDeliveryStatus([await getInvoiceByRecordId(arrivedFull.id)])).get(arrivedFull.id);
        check("the older bill is treated as settled", olderStatus.key, "delivered");
        check("and it is inferred too, since the same ordered item decided both", olderStatus.estimated, true);

        const secondRecon = await getInvoiceReconciliation(await getItemsByInvoice(second.id));
        // The one shape where the share line appears — and it appears on exactly
        // the condition the inferred marker does.
        assert(
            "the share line fires exactly when the answer was inferred",
            showsThisBillShare(secondRecon.rows[0].status) ===
                (describeInvoiceLine(secondRecon.rows[0].status, "EA").inferred !== null)
        );
        check("and here it does fire", showsThisBillShare(secondRecon.rows[0].status), true);
        check("billed on THIS invoice", secondRecon.rows[0].status.invoiced, 6);
        check("allocated to THIS invoice", secondRecon.rows[0].status.delivered, 0);
        check("so all 6 read as billed but not delivered", secondRecon.rows[0].status.billedNotArrived, 6);
        check("the LINE's own billed total is still available for context", secondRecon.rows[0].line.invoiced, 16);
        check("and the ordered item's delivered total", secondRecon.rows[0].line.delivered, 10);
        check("two bills share the ordered item", secondRecon.rows[0].billCount, 2);
        assert(
            "the share is attributed, not prorated — 0 of 6, never 3.75",
            secondRecon.rows[0].status.delivered === 0
        );
        assert(
            "and the detail says the answer was inferred",
            describeInvoiceLine(secondRecon.rows[0].status, "EA").inferred !== null
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
        // NEVER MORE, and it can be fewer: passing every invoice means the sibling
        // level is already in hand, so that step's id list is empty and
        // findByRecordIds returns without a query. The property is "does not grow
        // with rows", not "is a constant" — the same asymmetry the delivery axis
        // shows below, and the reason both comparisons have to be read that way.
        assert(
            `${invoiceMany.length} invoices cost no more than 1 (${many.total} vs ${one.total})`,
            many.total <= one.total
        );
        check("and the ceiling is the five levels the module documents", one.total, 5);

        const deliveryMany = await getDeliveriesByRecordIds(fixtures.ids("deliveries"));
        // COMPARE LIKE WITH LIKE: the billed delivery, whose ordered line carries
        // invoice lines, so all three levels are non-empty in both measurements.
        // Starting from the UNBILLED one would compare 2 ops against 3 and read as
        // per-row growth when it is the empty-level saving below.
        const dOne = await countOps(() => getDeliveryInvoicing([billedDelivery]));
        const dMany = await countOps(() => getDeliveryInvoicing(deliveryMany));
        console.log(`  delivery axis: 1 delivery -> ${dOne.total} ops, ${deliveryMany.length} -> ${dMany.total} ops`);
        check(`${deliveryMany.length} deliveries cost the same as 1`, dMany.total, dOne.total);
        check("and it is the three levels the module documents", dOne.total, 3);
        assert(
            "the invoice axis costs more than the delivery axis, because attribution " +
                "needs every OTHER bill on the line",
            one.total > dOne.total
        );

        // An EMPTY level costs no query at all — findByRecordIds returns early on
        // an empty id list. Asserted rather than left as noise in the numbers,
        // because it is why the two measurements above had to be shape-matched.
        const dUnbilled = await countOps(() => getDeliveryInvoicing([unbilledDelivery]));
        console.log(`  delivery axis: an arrival whose line has no invoice -> ${dUnbilled.total} ops`);
        check("a delivery with no invoice level to fetch costs one op less", dUnbilled.total, 2);
        assert("so the budget is a CEILING of three, not a fixed three", dUnbilled.total < dOne.total);

        // The withholding is worth a number rather than a claim: not walking the
        // invoice levels for a non-privileged viewer is exactly these operations
        // not being spent, which is why the page decides rather than the JSX.
        console.log(
            `  a non-privileged viewer of /deliveries skips all ${dOne.total} of those operations`
        );
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
