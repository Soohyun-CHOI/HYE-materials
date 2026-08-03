// Recording deliveries from packing lists — credentialed (#162).
//
// The offline tier already pins the allocation rule itself
// (scripts/tests/offline/delivery-allocation.mjs, 103 checks) and the access rule
// (delivery-access.mjs). What only real records can answer is here:
//
//   A — the schema exists and is wired as the code assumes, including the fifth
//       Unit option list, which no file-only check can see.
//   B — `PO Items."Delivered Qty"` on the FIRST READ after a Delivery Item is
//       created. Allocation subtracts this from Qty to decide what a line can
//       still absorb, so a lagging value would over-allocate the NEXT arrival to
//       a line that is already full. Measured the way
//       verify-materials-cache-18.mjs measures `Invoiced Qty`, and for the same
//       reason: the caller reads it immediately after the write that feeds it.
//       This is also the only place the rollup's AGGREGATION FUNCTION is proved —
//       Airtable's Metadata API does not expose it, so SUM vs COUNT is
//       indistinguishable from the schema alone and only distinguishable from a
//       value (12 + 8 = 20, not 2).
//   C — one entered quantity spanning two POs becomes two rows that roll up
//       correctly to two different lines, which is the whole reason the split is
//       structural rather than cosmetic.
//   D — over-delivery: flagged, its own row, and attached to a line only when the
//       narrowed set held exactly one.
//   E — a withdrawn PO's line is not a candidate, read through Committed Qty.
//   F — deletion returns Delivered Qty to where it was, and touches no invoice.
//   G — the real guards refuse: canDeleteDelivery, canAccessJobDeliveries, and
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
import { getDeliveryCandidatesForJob, buildItemOptions } from "../../lib/deliveryCandidates.js";
import { planDelivery } from "../../lib/deliveryAllocation.js";
import { canAccessJobDeliveries } from "../../lib/deliveryAccess.js";
import { canDeleteDelivery, deleteDeliveryAsUser, resolveDeleteCopy } from "../../lib/deliveryDelete.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getMaterialPrice } from "../../lib/airtable/materialPrices.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { getJobByRecordId } from "../../lib/airtable/jobs.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { CANONICAL_UNITS } from "../../lib/units.js";

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

const TAG = `V162-${Date.now().toString(36).toUpperCase()}`;
const created = { prs: [], pos: [], deliveries: [], deliveryItems: [], materials: [], prices: [] };
const track = (bucket, id) => {
    if (id && !created[bucket].includes(id)) created[bucket].push(id);
};

/**
 * Create one PR + one item, approve it, generate its PO.
 *
 * Generating a PO also refreshes the item axis (#18), so this creates a Materials
 * identity row and a Material Prices row as a SIDE EFFECT. They are tracked here
 * so cleanup can remove them: they are this script's fixtures like any other, and
 * a TAG-prefixed material nothing else points at would otherwise sit on the
 * /materials screen for good.
 */
async function makeOrder({ requester, vendor, line, itemName, size, unit, qty, unitPrice }) {
    const pr = await createPR({ requesterId: requester.id, lineId: line.id, vendorId: vendor.id });
    track("prs", pr.id);
    await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", itemName, size, unit, qty, unitPrice });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", gen.poRecordId);

    const material = await getMaterialByKey({ itemName, size, unit }).catch(() => null);
    if (material) {
        track("materials", material.id);
        const price = await getMaterialPrice({
            materialRecordId: material.id,
            vendorRecordId: vendor.id,
        }).catch(() => null);
        if (price) track("prices", price.id);
    }

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
    // fails the write outright rather than mislabelling a row, since
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

if (incomplete && incomplete.startsWith("the Deliveries")) {
    // Nothing below can run without the tables.
} else if (!requester || !vendorA || !vendorB || !line) {
    incomplete = "need one active User, TWO Vendors and one Line attached to a Job in the base";
    console.log(`\n  SKIP  ${incomplete}`);
} else {
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

    const candidates = await getDeliveryCandidatesForJob(job.id);
    const ourLines = candidates.lines.filter((l) => l.itemName === itemName);
    check("both new PO lines are candidates on this job", ourLines.length, 2);
    assert("each carries a Material link (#18 wrote it at PO generation)", ourLines.every((l) => l.materialRecordId));
    const materialRecordId = ourLines[0].materialRecordId;
    assert("both lines share one material identity", ourLines.every((l) => l.materialRecordId === materialRecordId));
    assert("each carries its PO's vendor", ourLines.every((l) => l.vendorRecordId === vendorA.id));
    check("nothing is delivered yet", ourLines.reduce((s, l) => s + (l.deliveredQty || 0), 0), 0);

    // -----------------------------------------------------------------------
    console.log("\nPart B — Delivered Qty on the FIRST read after a Delivery Item is created:");
    const targetLine = ourLines.find((l) => l.poRecordId === po1);
    const delivery1 = await createDelivery({
        jobRecordId: job.id,
        vendorRecordId: vendorA.id,
        poRecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id,
        notes: `${TAG} first arrival`,
        // No file: this script creates nothing in Blob, and the attachment is not
        // what any check here is about.
        file: [],
    });
    track("deliveries", delivery1.id);
    assert(`Delivery ID follows HYE-DL-YYMMDD-## (${delivery1.deliveryId})`, /^HYE-DL-\d{6}-\d{2}$/.test(delivery1.deliveryId));
    assert("Created At was stamped (the ID counter reads it, not Received Date)", Boolean(delivery1.createdAt));

    const di1 = await createDeliveryItem({
        deliveryRecordId: delivery1.id,
        deliveryId: delivery1.deliveryId,
        poItemRecordId: targetLine.id,
        materialRecordId,
        itemName: targetLine.itemName,
        size: targetLine.size,
        unit: targetLine.unit,
        qty: 4,
        overDelivery: false,
    });
    track("deliveryItems", di1.id);
    assert(`Delivery Item ID is {Delivery ID}-{seq} (${di1.deliveryItemId})`, di1.deliveryItemId === `${delivery1.deliveryId}-001`);

    // THE measurement. Read immediately, exactly as allocation does.
    const firstRead = await getDeliveredQtyForPOItem(targetLine.id);
    check("the rollup is correct on the FIRST read after create() returned", firstRead, 4);
    const settled = await waitFor(() => getDeliveredQtyForPOItem(targetLine.id), (v) => v === 4);
    console.log(`        (${settleNote(settled)})`);
    assert("reads === 1, i.e. no lag below one API round trip", settled.reads === 1);

    // And it is a SUM, not a COUNT — the one thing the schema cannot tell us.
    const di1b = await createDeliveryItem({
        deliveryRecordId: delivery1.id, deliveryId: delivery1.deliveryId,
        poItemRecordId: targetLine.id, materialRecordId,
        itemName: targetLine.itemName, size: targetLine.size, unit: targetLine.unit,
        qty: 5, overDelivery: false,
    });
    track("deliveryItems", di1b.id);
    const summed = await getDeliveredQtyForPOItem(targetLine.id);
    check("two rows of 4 and 5 sum to 9 (SUM, not COUNT of 2)", summed, 9);

    // -----------------------------------------------------------------------
    console.log("\nPart C — one quantity spanning two POs becomes two rows:");
    const fresh = await getDeliveryCandidatesForJob(job.id);
    const freshLines = fresh.lines.filter((l) => l.itemName === itemName);
    const plan = planDelivery({
        lines: freshLines,
        vendorRecordId: vendorA.id,
        materialRecordId,
        qty: 6,
    });
    check("the plan splits across two orders", plan.rows.length, 2);
    check("the older order takes its remainder first", plan.rows[0].qty, 1);
    check("the newer order takes the balance", plan.rows[1].qty, 5);
    assert("two different PO lines", plan.rows[0].line.id !== plan.rows[1].line.id);
    check("nothing flagged", plan.rows.some((r) => r.over), false);

    const delivery2 = await createDelivery({
        jobRecordId: job.id, vendorRecordId: vendorA.id, poRecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id, notes: `${TAG} split arrival`, file: [],
    });
    track("deliveries", delivery2.id);
    for (const row of plan.rows) {
        const di = await createDeliveryItem({
            deliveryRecordId: delivery2.id, deliveryId: delivery2.deliveryId,
            poItemRecordId: row.line.id, materialRecordId,
            itemName: row.line.itemName, size: row.line.size, unit: row.line.unit,
            qty: row.qty, overDelivery: row.over,
        });
        track("deliveryItems", di.id);
    }
    // The correctness point: two rows roll up to two DIFFERENT lines. A single row
    // linking both would have contributed its full Qty to each.
    check("the first order is now fully delivered", await getDeliveredQtyForPOItem(plan.rows[0].line.id), 10);
    check("the second holds only its own share", await getDeliveredQtyForPOItem(plan.rows[1].line.id), 5);

    // -----------------------------------------------------------------------
    console.log("\nPart D — over-delivery: flagged, own row, attached only when attributable:");
    const afterSplit = await getDeliveryCandidatesForJob(job.id);
    const overPlan = planDelivery({
        lines: afterSplit.lines.filter((l) => l.itemName === itemName),
        vendorRecordId: vendorA.id,
        materialRecordId,
        qty: 12,
    });
    check("5 outstanding absorbed, 7 over", overPlan.over, 7);
    check("the excess is its own row", overPlan.rows.length, 2);
    check("and the flagged row's qty IS the excess", overPlan.rows[1].qty, overPlan.over);
    assert(
        "unattached, because TWO lines were narrowed to",
        overPlan.narrowed.length === 2 && overPlan.rows[1].line === null
    );

    const delivery3 = await createDelivery({
        jobRecordId: job.id, vendorRecordId: vendorA.id, poRecordId: null,
        receivedDate: new Date().toISOString().slice(0, 10),
        recordedByUserId: requester.id, notes: `${TAG} over arrival`, file: [],
    });
    track("deliveries", delivery3.id);
    for (const row of overPlan.rows) {
        const di = await createDeliveryItem({
            deliveryRecordId: delivery3.id, deliveryId: delivery3.deliveryId,
            poItemRecordId: row.line?.id ?? null, materialRecordId,
            itemName, size: '2"', unit: "EA",
            qty: row.qty, overDelivery: row.over,
        });
        track("deliveryItems", di.id);
    }
    const d3Items = await getItemsByDelivery(delivery3.id);
    const looseRow = d3Items.find((i) => i.overDelivery);
    assert("the flagged row was stored with NO PO Item", looseRow && looseRow.poItem.length === 0);
    assert("but still carries its Material, so it stays on the item axis", looseRow.material.length === 1);
    check("Over Delivery persisted as true", looseRow.overDelivery, true);
    // An unlinked row contributes to no line's rollup — by design, and worth
    // proving rather than assuming, since it is the reason #20 must read
    // Delivery Items directly instead of summing PO Items."Delivered Qty".
    check("the second line's rollup counts only the attributed 10", await getDeliveredQtyForPOItem(overPlan.rows[0].line.id), 10);

    // -----------------------------------------------------------------------
    console.log("\nPart E — a withdrawn PO's line stops being a candidate:");
    const po3 = await makeOrder({
        requester, vendor: vendorB, line,
        itemName: `${TAG} Valve`, size: "", unit: "PCS", qty: 8, unitPrice: 12,
    });
    const beforeWithdraw = await getDeliveryCandidatesForJob(job.id);
    const valveBefore = beforeWithdraw.lines.filter((l) => l.itemName === `${TAG} Valve`);
    check("the new order's line is a candidate while live", valveBefore.length, 1);

    await updatePO(po3, { status: PO_WITHDRAWN_STATUS, withdrawnAt: new Date().toISOString() });
    const committed = await waitFor(
        async () => (await getPOItemsByRecordIds([valveBefore[0].id]))[0]?.committedQty,
        (v) => v === 0
    );
    check(`Committed Qty drops to 0 on withdrawal (${settleNote(committed)})`, committed.value, 0);

    const afterWithdraw = await getDeliveryCandidatesForJob(job.id);
    const valvePlan = planDelivery({
        lines: afterWithdraw.lines.filter((l) => l.itemName === `${TAG} Valve`),
        vendorRecordId: vendorB.id,
        materialRecordId: valveBefore[0].materialRecordId,
        qty: 3,
    });
    check("it is no longer narrowed to", valvePlan.narrowed.length, 0);
    check("so the arrival is all over-delivery", valvePlan.over, 3);
    assert("with no line to attach to", valvePlan.rows[0].line === null);
    // And it drops out of the item dropdown for that vendor.
    const valveOptions = buildItemOptions(afterWithdraw.lines, vendorB.id).filter(
        (o) => o.itemName === `${TAG} Valve`
    );
    check("and out of the item dropdown", valveOptions.length, 0);

    // -----------------------------------------------------------------------
    console.log("\nPart F — deletion returns the figures, and touches no invoice:");
    const beforeDelete = await getDeliveredQtyForPOItem(targetLine.id);
    const copy = await resolveDeleteCopy(delivery1, await getItemsByDelivery(delivery1.id));
    check("an uninvoiced delivery gets the plain voice", copy.voice, "plain");
    assert("and its body names the delivery", copy.body.includes(delivery1.deliveryId));

    const del = await deleteDeliveryAsUser({ deliveryRecordId: delivery1.id, actingUser: requester });
    check("the author may delete", del.ok, true);
    const afterDelete = await waitFor(
        () => getDeliveredQtyForPOItem(targetLine.id),
        (v) => v === beforeDelete - 9
    );
    check(`Delivered Qty drops by exactly what was deleted (${settleNote(afterDelete)})`, afterDelete.value, beforeDelete - 9);
    assert("the delivery is gone", (await getDeliveryById(delivery1.deliveryId)) === null);
    // Its items went with it, so nothing is left pointing at a missing parent.
    const orphan = await base(TABLES.DELIVERY_ITEMS).find(di1.id).catch(() => null);
    assert("its Delivery Items went with it", orphan === null);
    created.deliveries = created.deliveries.filter((id) => id !== delivery1.id);
    created.deliveryItems = created.deliveryItems.filter((id) => id !== di1.id && id !== di1b.id);

    // -----------------------------------------------------------------------
    console.log("\nPart G — the real guards refuse:");
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
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const destroy = async (table, id, label) =>
    base(table)
        .destroy(id)
        .then(() => console.log(`  deleted ${label} ${id}`))
        .catch((e) => console.error(`  cleanup: ${label} ${id} — remove manually:`, e.message));

for (const id of created.deliveryItems) await destroy(TABLES.DELIVERY_ITEMS, id, "Delivery Item");
for (const id of created.deliveries) {
    const rec = await base(TABLES.DELIVERIES).find(id).catch(() => null);
    for (const i of rec?.get("Delivery Items") || []) {
        await base(TABLES.DELIVERY_ITEMS).destroy(i).catch(() => {});
    }
    await destroy(TABLES.DELIVERIES, id, "Delivery + its items");
}
for (const id of created.pos) {
    const rec = await base(TABLES.PURCHASE_ORDERS).find(id).catch(() => null);
    for (const i of rec?.get("PO Items") || []) await base(TABLES.PO_ITEMS).destroy(i).catch(() => {});
    await destroy(TABLES.PURCHASE_ORDERS, id, "PO + its PO Items");
}
for (const id of created.prs) {
    const rec = await base(TABLES.PURCHASE_REQUESTS).find(id).catch(() => null);
    for (const i of rec?.get("PR Items") || []) await base(TABLES.PR_ITEMS).destroy(i).catch(() => {});
    await destroy(TABLES.PURCHASE_REQUESTS, id, "PR + its PR Items");
}
// The item-axis rows PO generation created as a side effect. Prices before
// materials, so a price row's Material link never dangles — the same order
// verify-materials-cache-18.mjs uses. These are fixtures like any other: the
// materials are TAG-prefixed and nothing outside this run points at them, so
// leaving them would put `V162-... Pipe` on the /materials screen permanently.
for (const id of created.prices) await destroy(TABLES.MATERIAL_PRICES, id, "Material Price");
for (const id of created.materials) await destroy(TABLES.MATERIALS, id, "Material");

console.log("\n" + "=".repeat(72));
console.log(`commit ${git.head}${git.dirty ? " (DIRTY TREE)" : ""}`);
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
process.exit(!pass ? 1 : incomplete ? 2 : 0);
