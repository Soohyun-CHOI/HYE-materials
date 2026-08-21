// Recording deliveries from packing lists — credentialed (#162).
//
// The offline tier already pins the allocation rule itself
// (scripts/tests/offline/delivery-allocation.mjs, 103 checks) and the access rule
// (delivery-access.mjs). What only real records can answer is here:
//
//   A — the schema exists and is wired as the code assumes, including the fifth
//       Unit option list, which no file-only check can see.
//   B — `PO Items."Delivered Qty"` on the FIRST READ after a Delivery Item is
//       created. Allocation subtracts this from Qty to decide what an ordered item can
//       still absorb, so a lagging value would over-allocate the NEXT delivery to
//       an ordered item that is already full. Measured the way
//       verify-materials-cache-18.mjs measures `Invoiced Qty`, and for the same
//       reason: the caller reads it immediately after the write that feeds it.
//       This is also the only place the rollup's AGGREGATION FUNCTION is proved —
//       Airtable's Metadata API does not expose it, so SUM vs COUNT is
//       indistinguishable from the schema alone and only distinguishable from a
//       value (12 + 8 = 20, not 2).
//   C — one entered quantity spanning two POs becomes two rows that roll up
//       correctly to two different ordered items, which is the whole reason the
//       split is structural rather than cosmetic.
//   D — over-delivery: flagged, its own row, and ATTACHED (#165) — to the last
//       ordered item the delivery filled, even with two orders in play, where
//       #162 left it unlinked and therefore invisible on the invoice axis. Also
//       that the attached ordered item's `Delivered Qty` then EXCEEDS its
//       ordered `Qty`, which is the intended shape rather than a defect.
//   E — a withdrawn PO's ordered item is not a candidate, read through Committed
//       Qty; and with nothing left to attach to, the plan is BLOCKED rather
//       than writing an unlinked row (#165), which is the action finally
//       refusing the same set the item dropdown already refused.
//   F — deletion returns Delivered Qty to where it was, and touches no invoice.
//   G — one delivery holding several items: planned per material, read back and
//       collapsed to items again, with the over-delivered one flagged.
//   H — the real guards refuse: canDeleteDelivery, canAccessJobDeliveries, and
//       replaceDeliveryPhoto's rejection of a non-Blob url.
//
// Everything calls production functions; nothing reimplements a rule.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-deliveries-162.mjs
//
// Fixtures: creates PRs + PR Items, POs + PO Items (through the real approve-and-
// generate flow), the Materials + Material Prices rows that flow writes as a side
// effect, and Deliveries + Delivery Items. Deletes ALL of them in this same run —
// including the item-axis rows, which are TAG-prefixed and referenced by nothing
// outside the run, so leaving them would put fixture items on the /materials
// screen for good. Creates nothing in Vercel Blob. Reuses (never modifies, never
// deletes) one active User, two Vendors and one Line.
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { execSync } from "child_process";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { updatePO, PO_WITHDRAWN_STATUS } from "../../lib/airtable/purchaseOrders.js";
import { getPOItemsByRecordIds, getDeliveredQtyForPOItem } from "../../lib/airtable/poItems.js";
import { createDelivery, getDeliveryById, replaceDeliveryPhoto, updateDelivery } from "../../lib/airtable/deliveries.js";
import { createDeliveryItem, getItemsByDelivery } from "../../lib/airtable/deliveryItems.js";
import { getDeliveryCandidates } from "../../lib/deliveryCandidates.js";
import {
    BLOCKED,
    buildItemOptions,
    describeDelivery,
    groupRowsByItem,
    planDelivery,
    summarizeDelivery,
} from "../../lib/deliveryAllocation.js";
import { canAccessJobDeliveries } from "../../lib/deliveryAccess.js";
import { canDeleteDelivery, deleteDeliveryAsUser, resolveDeleteCopy } from "../../lib/deliveryDelete.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { CANONICAL_UNITS } from "../../lib/units.js";
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
 * Poll until a computed field settles, reporting READS as well as elapsed ms.
 * ms alone is ambiguous — it includes the reads themselves — so only reads === 1
 * says the field was already correct before anything looked at it. Same helper,
 * and same reasoning, as verify-materials-cache-18.mjs.
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

// ---------------------------------------------------------------------------
// Header. A past run is only evidence if it can be tied to a tree, so the commit
// and whether it was dirty are printed before anything else runs. A dirty tree
// does not fail the run — it is normal to verify work in progress — but it means
// the commit alone does not identify what was tested.
function gitContext() {
    try {
        const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        const dirtyFiles = status.split("\n").filter((l) => l.trim().length > 0);
        return { head, dirty: dirtyFiles.length > 0, dirtyCount: dirtyFiles.length };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}

const git = gitContext();
console.log("=".repeat(72));
console.log("verify-deliveries-162 — recording deliveries from packing lists");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty
          ? `tree      DIRTY — ${git.dirty && git.dirtyCount} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order, children before parents throughout.
const fixtures = createFixtures({
    tag: "V162",
    buckets: [
        // Frozen `Item Name` copied from the tagged ordered item, so the tag reaches
        // every row.
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
        // TAGGED, and it is the counterpart to the bucket above rather than the
        // same case: `makeOrder` creates these PRs, so nothing stops the tag from
        // reaching them and the helper's rule says to make it reach rather than to
        // decline (its second clause, added in this commit). They were untagged in
        // the previous commit on the ground that `makeOrder` passed no `notes` —
        // true, but a fact about this script, which is the half it can change.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
        // The item-axis rows PO generation writes as a side effect (#18), which
        // this script used to track by looking each one up right after generating
        // the PO — `getMaterialByKey(...).catch(() => null)` guarded by
        // `if (material)`, so a lookup that came back empty left the row created
        // and untracked, i.e. leaked silently. Finding them by tag does not depend
        // on that lookup working. Prices hang off the Material's own link field
        // rather than a text match on `Price Label`, as decided for 166, and
        // children-before-parents then gives the prices-before-materials order
        // this script's old comment had to ask for by hand.
        {
            name: "materials",
            table: TABLES.MATERIALS,
            label: "Material",
            tagField: "Item Name",
            discoverByTag: true,
            // A completed run always writes at least one of these, so 0 means the
            // tag stopped reaching them rather than that none were created (#171).
            expectAtLeast: 1,
            children: [{ link: "Material Prices", table: TABLES.MATERIAL_PRICES, label: "Material Price" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

/**
 * Create one PR + one item, approve it, generate its PO.
 *
 * Generating a PO also refreshes the item axis (#18), so this creates a Materials
 * identity row and a Material Prices row as a SIDE EFFECT. They are this script's
 * fixtures like any other — a TAG-prefixed material nothing else points at would
 * otherwise sit on the /materials screen for good — and they are found at cleanup
 * by the tag rather than tracked here (#171).
 *
 * WHAT THAT REPLACED, because the difference is the point: this used to look each
 * one up right after generating the PO, `getMaterialByKey(...).catch(() => null)`
 * guarded by `if (material)`, and track whatever came back. A lookup that returned
 * nothing therefore left the row created and untracked — leaked, with nothing
 * saying so. Finding them by tag does not depend on that lookup working, and the
 * census then reports how many it found either way.
 */
async function makeOrder({ requester, vendor, line, itemName, size, unit, qty, unitPrice }) {
    const pr = await createPR({
        requesterId: requester.id,
        lineId: line.id,
        vendorId: vendor.id,
        notes: `${TAG} fixture`,
    });
    track("prs", pr.id);
    await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", itemName, size, unit, qty, unitPrice });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", gen.poRecordId);

    return gen.poRecordId;
}

// ---------------------------------------------------------------------------
console.log("\nPart A — the schema is there and wired as the code assumes:");
{
    let schemaOk = true;
    for (const table of [TABLES.DELIVERIES, TABLES.DELIVERY_ITEMS]) {
        try {
            await base(table).select({ maxRecords: 1 }).firstPage();
            assert(`table "${table}" exists and is readable`, true);
        } catch (err) {
            assert(`table "${table}" exists and is readable — ${err.message}`, false);
            schemaOk = false;
        }
    }
    if (!schemaOk) {
        incomplete = "the Deliveries / Delivery Items tables are missing — apply the schema first";
        console.log(`\n  SKIP  ${incomplete}`);
    }

    // The Unit option list. Nothing file-only can see this, and a missing option
    // fails the write outright rather than mislabeling a row, since
    // createDeliveryItem does not use typecast.
    try {
        const meta = await fetch(
            `https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`,
            { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
        ).then((r) => r.json());
        const field = meta.tables
            ?.find((t) => t.name === TABLES.DELIVERY_ITEMS)
            ?.fields?.find((f) => f.name === "Unit");
        const names = (field?.options?.choices || []).map((c) => c.name);
        check("Delivery Items.Unit is a singleSelect", field?.type, "singleSelect");
        check("carrying all 19 canonical options, in order", names.join(","), CANONICAL_UNITS.join(","));
        // The rollup's aggregation function is NOT exposed by the Metadata API,
        // so its correctness is proved by value in Part B, not here.
        const rollup = meta.tables
            ?.find((t) => t.name === TABLES.PO_ITEMS)
            ?.fields?.find((f) => f.name === "Delivered Qty");
        check("PO Items.Delivered Qty exists as a rollup", rollup?.type, "rollup");
        check("and Airtable considers it valid", rollup?.options?.isValid, true);
    } catch (err) {
        console.log(`  SKIP  could not read the live schema: ${err.message}`);
        if (!incomplete) incomplete = "the live schema could not be read";
    }
}

// ---------------------------------------------------------------------------
const [users, vendors, lines] = await Promise.all([getActiveUsers(), getAllVendors(), getAllLines()]);
const requester = users[0];
const [vendorA, vendorB] = vendors;
const line = lines.find((l) => l.jobId);

let complete = false;
if (incomplete && incomplete.startsWith("the Deliveries")) {
    // Nothing below can run without the tables.
} else if (!requester || !vendorA || !vendorB || !line) {
    incomplete = "need one active User, TWO Vendors and one Line attached to a Job in the base";
    console.log(`\n  SKIP  ${incomplete}`);
} else {
  // EVERY FIXTURE THIS RUN CREATES IS DELETED BELOW, so an unexpected throw in
  // here must not skip that. It did: #165 changed planDelivery's shape, a stale
  // assertion dereferenced a row that no longer exists, and four aborted runs
  // left 100 records on the shared base to be removed by hand. A failing CHECK
  // was always survivable — check()/assert() only set `pass` — but a THROW was
  // not, and the cleanup sits outside this block precisely so it always runs.
  try {
    const job = await getJobByRecordId(line.jobId);
    console.log(
        `\nFixture context: job "${job.jobCode}", vendors "${vendorA.vendorName}" / "${vendorB.vendorName}", line "${line.lineLabel}" (all reused, not modified)`
    );

    const itemName = `${TAG} Pipe`;
    const po1 = await makeOrder({
        requester, vendor: vendorA, line,
        itemName, size: '2"', unit: "EA", qty: 10, unitPrice: 30,
    });
    const po2 = await makeOrder({
        requester, vendor: vendorA, line,
        itemName, size: '2"', unit: "EA", qty: 10, unitPrice: 32,
    });

    const candidates = await getDeliveryCandidates([job]);
    const ourItems = candidates.orderedItems.filter((l) => l.itemName === itemName);
    assert("every candidate ordered item is attributed to a Job", candidates.orderedItems.every((l) => l.jobRecordId));
    assert("and to this one", candidates.orderedItems.every((l) => l.jobRecordId === job.id));

    // The production shape is the MULTI-job read — the entry form is one page with
    // a job dropdown, so it asks for every accessible job at once. Batched across
    // jobs, so the query count does not grow with the number of them.
    const allJobs = await getAllJobs();
    const many = await getDeliveryCandidates(allJobs);
    assert(
        `reading all ${allJobs.length} jobs at once still attributes every ordered item`,
        many.orderedItems.every((l) => l.jobRecordId)
    );
    assert(
        "and includes this job's ordered items",
        many.orderedItems.filter((l) => l.itemName === itemName).length === ourItems.length
    );
    check(
        "an empty job list yields nothing rather than throwing",
        (await getDeliveryCandidates([])).orderedItems.length,
        0
    );
    check("both new ordered items are candidates on this job", ourItems.length, 2);
    assert("each carries a Material link (#18 wrote it at PO generation)", ourItems.every((l) => l.materialRecordId));
    const materialRecordId = ourItems[0].materialRecordId;
    assert("both ordered items share one material identity", ourItems.every((l) => l.materialRecordId === materialRecordId));
    assert("each carries its PO's vendor", ourItems.every((l) => l.vendorRecordId === vendorA.id));
    check("nothing is delivered yet", ourItems.reduce((s, l) => s + (l.deliveredQty || 0), 0), 0);

    // -----------------------------------------------------------------------
    console.log("\nPart B — Delivered Qty on the FIRST read after a Delivery Item is created:");
    const targetOrderedItem = ourItems.find((l) => l.poRecordId === po1);
    const delivery1 = await createDelivery({
        jobRecordId: job.id,
        vendorRecordId: vendorA.id,
        packingListPORecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id,
        notes: `${TAG} first delivery`,
        // No file: this script creates nothing in Blob, and the attachment is not
        // what any check here is about.
        file: [],
    });
    track("deliveries", delivery1.id);
    assert(`Delivery ID follows HYE-DL-YYMMDD-## (${delivery1.deliveryId})`, /^HYE-DL-\d{6}-\d{2}$/.test(delivery1.deliveryId));
    // #164 moved the ID counter off this field onto the ID prefix, so the stamp is
    // no longer load-bearing for the ID — it is still asserted because Created At
    // remains the list's tie-break and the only timestamp nobody typed.
    assert("Created At was stamped", Boolean(delivery1.createdAt));

    const di1 = await createDeliveryItem({
        deliveryRecordId: delivery1.id,
        deliveryId: delivery1.deliveryId,
        poItemRecordId: targetOrderedItem.id,
        materialRecordId,
        itemName: targetOrderedItem.itemName,
        size: targetOrderedItem.size,
        unit: targetOrderedItem.unit,
        qty: 4,
        overDelivered: false,
    });
    track("deliveryItems", di1.id);
    assert(`Delivery Item ID is {Delivery ID}-{seq} (${di1.deliveryItemId})`, di1.deliveryItemId === `${delivery1.deliveryId}-001`);

    // THE measurement. Read immediately, exactly as allocation does.
    const firstRead = await getDeliveredQtyForPOItem(targetOrderedItem.id);
    check("the rollup is correct on the FIRST read after create() returned", firstRead, 4);
    const settled = await waitFor(() => getDeliveredQtyForPOItem(targetOrderedItem.id), (v) => v === 4);
    console.log(`        (${settleNote(settled)})`);
    assert("reads === 1, i.e. no lag below one API round trip", settled.reads === 1);

    // And it is a SUM, not a COUNT — the one thing the schema cannot tell us.
    const di1b = await createDeliveryItem({
        deliveryRecordId: delivery1.id, deliveryId: delivery1.deliveryId,
        poItemRecordId: targetOrderedItem.id, materialRecordId,
        itemName: targetOrderedItem.itemName, size: targetOrderedItem.size, unit: targetOrderedItem.unit,
        qty: 5, overDelivered: false,
    });
    track("deliveryItems", di1b.id);
    const summed = await getDeliveredQtyForPOItem(targetOrderedItem.id);
    check("two rows of 4 and 5 sum to 9 (SUM, not COUNT of 2)", summed, 9);

    // -----------------------------------------------------------------------
    console.log("\nPart C — one quantity spanning two POs becomes two rows:");
    const fresh = await getDeliveryCandidates([job]);
    const freshItems = fresh.orderedItems.filter((l) => l.itemName === itemName);
    const plan = planDelivery({
        orderedItems: freshItems,
        vendorRecordId: vendorA.id,
        materialRecordId,
        qty: 6,
    });
    check("the plan splits across two orders", plan.rows.length, 2);
    check("the older order takes its remainder first", plan.rows[0].qty, 1);
    check("the newer order takes the balance", plan.rows[1].qty, 5);
    assert("two different ordered items", plan.rows[0].orderedItem.id !== plan.rows[1].orderedItem.id);
    check("nothing flagged", plan.rows.some((r) => r.over), false);

    const delivery2 = await createDelivery({
        jobRecordId: job.id, vendorRecordId: vendorA.id, packingListPORecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id, notes: `${TAG} split delivery`, file: [],
    });
    track("deliveries", delivery2.id);
    for (const row of plan.rows) {
        const di = await createDeliveryItem({
            deliveryRecordId: delivery2.id, deliveryId: delivery2.deliveryId,
            poItemRecordId: row.orderedItem.id, materialRecordId,
            itemName: row.orderedItem.itemName, size: row.orderedItem.size, unit: row.orderedItem.unit,
            qty: row.qty, overDelivered: row.over,
        });
        track("deliveryItems", di.id);
    }
    // The correctness point: two rows roll up to two DIFFERENT ordered items. A
    // single row linking both would have contributed its full Qty to each.
    check("the first order is now fully delivered", await getDeliveredQtyForPOItem(plan.rows[0].orderedItem.id), 10);
    check("the second holds only its own share", await getDeliveredQtyForPOItem(plan.rows[1].orderedItem.id), 5);

    // -----------------------------------------------------------------------
    console.log("\nPart D — over-delivery: flagged, its own row, and ATTACHED (#165):");
    const afterSplit = await getDeliveryCandidates([job]);
    const overPlan = planDelivery({
        orderedItems: afterSplit.orderedItems.filter((l) => l.itemName === itemName),
        vendorRecordId: vendorA.id,
        materialRecordId,
        qty: 12,
    });
    check("5 undelivered absorbed, 7 over", overPlan.over, 7);
    check("the excess is its own row", overPlan.rows.length, 2);
    check("and the flagged row's qty IS the excess", overPlan.rows[1].qty, overPlan.over);
    // THE #165 SCENARIO, on real records: two candidate ordered items, an
    // over-delivery, and the flagged row attaches to the LAST ONE FILLED rather
    // than to nothing. #162 left it unattached here, which put the quantity in no
    // ordered item's rollup and made a delivery that arrived in full read as less
    // arrived than was invoiced.
    check("two ordered items were narrowed to", overPlan.narrowed.length, 2);
    assert("and the flagged row names one of them", overPlan.rows[1].orderedItem !== null);
    check(
        "the LAST ordered item filled, which is the newer order (fill order is oldest-first)",
        overPlan.rows[1].orderedItem.id,
        overPlan.rows[0].orderedItem.id
    );

    const delivery3 = await createDelivery({
        jobRecordId: job.id, vendorRecordId: vendorA.id, packingListPORecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id, notes: `${TAG} over delivery`, file: [],
    });
    track("deliveries", delivery3.id);
    for (const row of overPlan.rows) {
        const di = await createDeliveryItem({
            deliveryRecordId: delivery3.id, deliveryId: delivery3.deliveryId,
            poItemRecordId: row.orderedItem.id, materialRecordId,
            itemName, size: '2"', unit: "EA",
            qty: row.qty, overDelivered: row.over,
        });
        track("deliveryItems", di.id);
    }
    const d3Items = await getItemsByDelivery(delivery3.id);
    const overRow = d3Items.find((i) => i.overDelivered);
    assert("the flagged row was stored WITH a PO Item (#165)", overRow && overRow.poItem.length === 1);
    check("the one the plan named", overRow.poItem[0], overPlan.rows[1].orderedItem.id);
    assert("and still carries its Material, so it stays on the item axis", overRow.material.length === 1);
    check("Over Delivered persisted as true", overRow.overDelivered, true);
    assert(
        "no row of this delivery lacks a PO Item — the #165 invariant, on real records",
        d3Items.every((i) => i.poItem.length === 1)
    );

    // THE POINT OF ATTACHING: the quantity now reaches an ordered item's rollup, so the
    // delivery is visible on the invoice axis. Delivered Qty deliberately EXCEEDS
    // the ordered Qty — that is the shape #162 already asserts and #165 keeps.
    const attachedOrderedItem = overPlan.rows[1].orderedItem;
    // Measured as a DELTA, not an absolute: this ordered item already carried 5
    // from the split in Part C, so the property is that both of this delivery's
    // slices reached it — the fill and the excess — not that the rollup equals
    // 12.
    const rolledBefore = attachedOrderedItem.deliveredQty || 0;
    const expected = rolledBefore + 12;
    const rolled = await waitFor(
        async () => await getDeliveredQtyForPOItem(attachedOrderedItem.id),
        (v) => v === expected
    );
    check(
        `the attached ordered item's Delivered Qty grew by both slices, ${rolledBefore} -> ${expected} (${settleNote(rolled)})`,
        rolled.value,
        expected
    );
    const attachedAfter = (await getPOItemsByRecordIds([attachedOrderedItem.id]))[0];
    assert(
        `Delivered Qty (${rolled.value}) EXCEEDS the ordered Qty (${attachedAfter.qty}) — intended, not a defect`,
        rolled.value > attachedAfter.qty
    );
    // And the whole entered quantity is now reachable by summing the ordered
    // items, which is what an unlinked row broke.
    const d3Total = d3Items.reduce((sum, i) => sum + (i.qty || 0), 0);
    check("every unit entered reached an ordered item", d3Total, 12);

    // -----------------------------------------------------------------------
    console.log("\nPart E — a withdrawn PO's ordered item stops being a candidate:");
    const po3 = await makeOrder({
        requester, vendor: vendorB, line,
        itemName: `${TAG} Valve`, size: "", unit: "PCS", qty: 8, unitPrice: 12,
    });
    const beforeWithdraw = await getDeliveryCandidates([job]);
    const valveBefore = beforeWithdraw.orderedItems.filter((l) => l.itemName === `${TAG} Valve`);
    check("the new order's ordered item is a candidate while live", valveBefore.length, 1);

    await updatePO(po3, { status: PO_WITHDRAWN_STATUS, withdrawnAt: new Date().toISOString() });
    const committed = await waitFor(
        async () => (await getPOItemsByRecordIds([valveBefore[0].id]))[0]?.committedQty,
        (v) => v === 0
    );
    check(`Committed Qty drops to 0 on withdrawal (${settleNote(committed)})`, committed.value, 0);

    const afterWithdraw = await getDeliveryCandidates([job]);
    const valvePlan = planDelivery({
        orderedItems: afterWithdraw.orderedItems.filter((l) => l.itemName === `${TAG} Valve`),
        vendorRecordId: vendorB.id,
        materialRecordId: valveBefore[0].materialRecordId,
        qty: 3,
    });
    check("it is no longer narrowed to", valvePlan.narrowed.length, 0);
    // #165 — with nothing narrowed there is no ordered item to attach to, and no
    // row may be written without one, so the plan is BLOCKED rather than recorded
    // as an unattributable over-delivery. That is a behavior change from #162,
    // and it makes the action agree with the form for the first time: the item
    // was already absent from the dropdown (asserted below), so #162's unattached
    // row was only ever reachable by calling the Server Action directly.
    check("nothing is planned", valvePlan.rows.length, 0);
    check("and the plan says why", valvePlan.blocked, BLOCKED.notOrdered);
    check("no over-delivery is claimed either, since nothing is recorded", valvePlan.over, 0);
    // And it drops out of the item dropdown for that vendor — the same judgment,
    // reached independently, which is why the two now refuse the same set.
    const valveOptions = buildItemOptions(afterWithdraw.orderedItems, vendorB.id).filter(
        (o) => o.itemName === `${TAG} Valve`
    );
    check("and out of the item dropdown", valveOptions.length, 0);

    // -----------------------------------------------------------------------
    console.log("\nPart F — deletion returns the figures, and touches no invoice:");
    const beforeDelete = await getDeliveredQtyForPOItem(targetOrderedItem.id);
    // `seesPayment` explicitly (#211), even though this delivery is uninvoiced and
    // so never reaches the branch that consults it: the flag defaults to FALSE, so
    // a script that omitted it could never reach the `paid` voice at all, and a
    // later assertion about that voice would fail for a reason nobody would look
    // for. Asking as the office asks keeps the whole ladder reachable here.
    const copy = await resolveDeleteCopy(delivery1, await getItemsByDelivery(delivery1.id), {
        seesPayment: true,
    });
    check("an uninvoiced delivery gets the plain voice", copy.voice, "plain");
    assert("and its body names the delivery", copy.body.includes(delivery1.deliveryId));

    const del = await deleteDeliveryAsUser({ deliveryRecordId: delivery1.id, actingUser: requester });
    check("the author may delete", del.ok, true);
    const afterDelete = await waitFor(
        () => getDeliveredQtyForPOItem(targetOrderedItem.id),
        (v) => v === beforeDelete - 9
    );
    check(`Delivered Qty drops by exactly what was deleted (${settleNote(afterDelete)})`, afterDelete.value, beforeDelete - 9);
    assert("the delivery is gone", (await getDeliveryById(delivery1.deliveryId)) === null);
    // Its items went with it, so nothing is left pointing at a missing parent.
    const orphan = await base(TABLES.DELIVERY_ITEMS).find(di1.id).catch(() => null);
    assert("its Delivery Items went with it", orphan === null);
    // The test just deleted these through the production path, so untrack them or
    // the residue check reports a leak for rows it was the point of Part F to
    // remove (#171). This was three lines of hand-filtering `created` before.
    fixtures.untrack("deliveries", delivery1.id);
    fixtures.untrack("deliveryItems", di1.id);
    fixtures.untrack("deliveryItems", di1b.id);

    // -----------------------------------------------------------------------
    console.log("\nPart G — one delivery, several items:");
    // The production shape since the form grew repeating item rows: two materials
    // on one packing list, planned independently because they never compete for
    // the same ordered item, then read back and collapsed to items again.
    const multiItemName = `${TAG} Bolt`;
    const po4 = await makeOrder({
        requester, vendor: vendorA, line,
        itemName: multiItemName, size: "M12", unit: "EA", qty: 50, unitPrice: 1.2,
    });
    const forMulti = await getDeliveryCandidates([job]);
    const pipeItems = forMulti.orderedItems.filter((l) => l.itemName === itemName);
    const boltItems = forMulti.orderedItems.filter((l) => l.itemName === multiItemName);
    check("the second material has its own candidate ordered item", boltItems.length, 1);

    const pipeMaterialId = pipeItems[0].materialRecordId;
    const boltMaterialId = boltItems[0].materialRecordId;
    assert("the two materials are distinct identities", pipeMaterialId !== boltMaterialId);

    const multiDelivery = await createDelivery({
        jobRecordId: job.id, vendorRecordId: vendorA.id, packingListPORecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id, notes: `${TAG} two items`, file: [],
    });
    track("deliveries", multiDelivery.id);

    for (const [materialId, qty] of [[pipeMaterialId, 2], [boltMaterialId, 60]]) {
        const p = planDelivery({
            orderedItems: forMulti.orderedItems, vendorRecordId: vendorA.id,
            materialRecordId: materialId, qty,
        });
        for (const row of p.rows) {
            const src = row.orderedItem || p.narrowed[0];
            const di = await createDeliveryItem({
                deliveryRecordId: multiDelivery.id, deliveryId: multiDelivery.deliveryId,
                poItemRecordId: row.orderedItem.id, materialRecordId: materialId,
                itemName: src?.itemName ?? "", size: src?.size ?? "", unit: src?.unit ?? "",
                qty: row.qty, overDelivered: row.over,
            });
            track("deliveryItems", di.id);
        }
    }

    const multiRows = (await getItemsByDelivery(multiDelivery.id))
        .sort((a, b) => a.deliveryItemId.localeCompare(b.deliveryItemId))
        .map((i) => ({
            materialRecordId: i.material?.[0] ?? null,
            itemName: i.itemName, size: i.size, unit: i.unit,
            qty: i.qty, over: i.overDelivered,
        }));
    const grouped = groupRowsByItem(multiRows);
    check("the rows collapse back to two items", grouped.length, 2);
    check("in the order they were recorded", grouped[0].itemName, itemName);
    const summary = summarizeDelivery(multiRows);
    check("the list summary leads with the first item", summary.first.label.startsWith(itemName), true);
    check("and counts one more beyond it", summary.extraCount, 1);
    // 60 arrived against 50 ordered, so the bolt is over-delivered.
    check("the over-delivered item is flagged in the summary", summary.hasOverDelivery, true);
    const boltGroup = grouped.find((g) => g.itemName === multiItemName);
    check("the bolt's quantity is the full 60 across its slices", boltGroup.qty, 60);
    check("  and it is flagged", boltGroup.over, true);
    // 60 arrived against 50 ordered and the narrowed set held exactly ONE ordered
    // item, so the over-delivery row attaches to it — which means the ordered
    // item's rollup reads 60, EXCEEDING its Qty of 50. That is the intended shape,
    // not a leak: an attached over-delivery is how the PO axis shows more arrived
    // than was ordered, and it is what makes the ordered item stop being a
    // candidate (undelivered goes negative, so hasUndeliveredQty is false).
    const boltDelivered = await getDeliveredQtyForPOItem(boltItems[0].id);
    check("the attached over-delivery pushes the ordered item's rollup past its Qty", boltDelivered, 60);
    assert("delivered now exceeds ordered on that ordered item", boltDelivered > boltItems[0].qty);
    const boltAfter = await getDeliveryCandidates([job]);
    assert(
        "so the ordered item is no longer a candidate for the next delivery",
        !planDelivery({
            orderedItems: boltAfter.orderedItems,
            vendorRecordId: vendorA.id,
            materialRecordId: boltMaterialId,
            qty: 1,
        }).candidates.some((l) => l.id === boltItems[0].id)
    );
    assert(
        "the banner names the item now that there are several",
        describeDelivery(multiRows).some((m) => m.text.includes(multiItemName))
    );

    console.log("\nPart H — the real guards refuse:");
    const stranger = { id: "recNotARealUser", role: "Employee", isAdmin: false, assignedJobs: [] };
    check("a stranger cannot delete", canDeleteDelivery(stranger, delivery2), false);
    check("the author can", canDeleteDelivery(requester, delivery2), true);
    check("an Admin can, without being the author", canDeleteDelivery({ ...stranger, isAdmin: true }, delivery2), true);
    const refused = await deleteDeliveryAsUser({ deliveryRecordId: delivery2.id, actingUser: stranger });
    assert("and the write path refuses, not just the page", Boolean(refused.error));
    assert("with the shared refusal wording", refused.reason === "not-allowed");
    assert("the delivery survives the refusal", Boolean(await getDeliveryById(delivery2.deliveryId)));

    check("a stranger cannot reach this job's deliveries", canAccessJobDeliveries(stranger, job.id), false);
    check("someone assigned to it can", canAccessJobDeliveries({ ...stranger, assignedJobs: [job.id] }, job.id), true);

    // #142's structural guarantee, exercised rather than read off the source.
    let photoThrew = false;
    try {
        await replaceDeliveryPhoto(delivery2.id, {
            url: "https://v5.airtableusercontent.com/v3/u/expired/signed-attachment.jpg",
            filename: "not-ours.jpg",
        });
    } catch {
        photoThrew = true;
    }
    assert("replaceDeliveryPhoto refuses an Airtable attachment url (#142)", photoThrew);

    // The in-place edit path leaves the attachment field alone entirely.
    const edited = await updateDelivery(delivery2.id, {
        receivedDate: "2026-01-15",
        notes: `${TAG} edited`,
    });
    check("received date is editable in place", edited.receivedDate, "2026-01-15");
    check("so is the note", edited.notes, `${TAG} edited`);
    complete = true;
  } catch (err) {
    // Not `incomplete`: an unexpected throw is a failure (exit 1), not a part
    // that could not run. The cleanup below still runs either way.
    pass = false;
    console.error(`
  ABORTED — ${err.message}`);
    console.error(err.stack);
  }
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(72));
console.log(`commit ${git.head}${git.dirty ? " (DIRTY TREE)" : ""}`);
// TWO VERDICTS, TWO SENTENCES (#171). `pass` is about recording deliveries; a
// leak is about this run's effect on a shared base. Before this the cleanup
// reported per record but reached no verdict at all, so the aborted runs that
// left 100 records behind would still have printed ALL CHECKS PASS had they got
// this far.
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
