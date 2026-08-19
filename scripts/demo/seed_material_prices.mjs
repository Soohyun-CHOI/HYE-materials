// Dummy purchase history for the #19 material price screens, from PR all the
// way through to Materials / Material Prices.
//
// WHY THIS EXISTS. `PO Items.Material` — the link that puts an ordered item on
// the item axis — is written by lib/materialsCache.js at PO-GENERATION time, and
// that code arrived in #18. Every PO Item created before then therefore has no
// link, which is not a failure and not something to repair: those ordered items
// simply predate the writer. So /materials starts out empty on this base even
// though PO Items is not, and the only way to see the screens with data is to
// put a PR through the real flow. That is what this does.
//
// Import-not-sync, same convention as seed_demo_fixtures.mjs: keyed on the item
// names below, so re-running skips what already exists rather than piling up
// duplicates. Kept in the repo and NOT deleted from Airtable — these are demo
// fixtures, like everything else in scripts/demo/.
//
// Everything goes through production functions (createPR -> createItem ->
// updatePR -> generatePOForApprovedPR), so Materials, Material Prices and the
// per-item Material links are written by the real cache, not by this script.
// Two exceptions, both deliberate and both marked below: the PO statuses, and
// the backdating.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_material_prices.mjs
//
// Why the extra flags: lib/**/*.js import siblings without file extensions
// (fine under Next.js's bundler, not resolvable by plain Node ESM) — see
// scripts/esm-ext-loader.mjs.

import { base, TABLES } from "../../lib/airtable/client.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { updatePO } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { getAllVendors, createVendor, getVendorByName } from "../../lib/airtable/vendors.js";
import { getAllLines } from "../../lib/airtable/lines.js";

// A third vendor, so the comparison screen has something to compare. Named
// "Demo ..." on purpose: a realistic supplier name sitting in Vendors could
// later be mistaken for a real one.
const EXTRA_VENDOR = "Gulf Coast Valve & Fitting";

// The three items are chosen to make each of the screen's behaviors visible.
const PIPE = { itemName: "SCH 40 PVC Pipe", size: '4"', unit: "FT" };
const VALVE = { itemName: "Ball Valve", size: '2"', unit: "EA" };
const HANGER = { itemName: "Pipe Hanger", size: "", unit: "EA" };

/**
 * One PR -> approved -> PO per entry, then the status it should end in.
 *
 * `daysAgo` backdates the finished PO. Production cannot do this — createPO
 * hardcodes today and updatePO does not accept the field — so it is a direct
 * field write, done here only so the newest-first ordering and the date column
 * are visible rather than every row reading the same day. `Material Prices`.
 * `Latest Date` is moved with it, because upsertMaterialPrice copies the PO's
 * Created Date into that field and the two must not be left disagreeing.
 */
const ORDERS = [
    {
        label: "pipe, oldest, cheapest — the Lowest mark should land here",
        vendor: "Lone Star Pipe & Supply",
        daysAgo: 240,
        status: "Signed",
        items: [{ ...PIPE, qty: 2000, unitPrice: 2.85 }],
    },
    {
        label: "pipe, mid, dearer at a much smaller quantity — triggers the qty caveat",
        vendor: EXTRA_VENDOR,
        daysAgo: 96,
        status: "Signed",
        items: [
            { ...PIPE, qty: 120, unitPrice: 4.4 },
            { ...HANGER, qty: 60, unitPrice: 1.95 },
        ],
    },
    {
        label: "pipe, newest but not cheapest — proves rows sort by date, not price",
        vendor: "TESTQA Vendor A",
        daysAgo: 12,
        status: "Awaiting Signature",
        items: [{ ...PIPE, qty: 500, unitPrice: 3.6 }],
    },
    {
        label: "valve, older, signed",
        vendor: "Lone Star Pipe & Supply",
        daysAgo: 150,
        status: "Signed",
        items: [{ ...VALVE, qty: 40, unitPrice: 18.5 }],
    },
    {
        label: "valve, newest price comes from a WITHDRAWN order — shown, with its status",
        vendor: "TESTQA Vendor A",
        daysAgo: 20,
        status: "Withdrawn",
        items: [{ ...VALVE, qty: 25, unitPrice: 22.75 }],
    },
];

const isoDate = (daysAgo) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
};

async function main() {
    // --- preconditions -----------------------------------------------------
    const [users, lines] = await Promise.all([getActiveUsers(), getAllLines()]);
    const requester = users.find((u) => u.isAdmin) || users[0];
    const line = lines.find((l) => (l.lineLabel || "").includes("DEMO")) || lines[0];

    if (!requester || !line) {
        console.error("Need at least one active User and one Line. Run seed_demo_fixtures.mjs first.");
        process.exitCode = 1;
        return;
    }
    console.log(`Requester: ${requester.email}`);
    console.log(`Line:      ${line.lineLabel}\n`);

    // --- the third vendor, skip-if-exists ----------------------------------
    const existingExtra = await getVendorByName(EXTRA_VENDOR);
    if (existingExtra) {
        console.log(`[SKIP] Vendor "${EXTRA_VENDOR}" already exists (${existingExtra.id}).`);
    } else {
        const v = await createVendor({
            vendorName: EXTRA_VENDOR,
            picName: "Dana Whitfield",
            picPhone: "512-555-0148",
            picEmail: "orders@demo-pipe-supply.invalid",
        });
        console.log(`[NEW]  Vendor "${EXTRA_VENDOR}" (${v.id}).`);
    }

    const vendors = await getAllVendors();
    const vendorByName = new Map(vendors.map((v) => [v.vendorName, v]));

    // --- skip check: keyed on the items, not on the POs --------------------
    // If the pipe already has an identity row, this has been run before. The PRs
    // and POs it creates are not idempotent (each run mints new IDs), so the
    // guard has to be the thing they produce, not the thing they are.
    const already = await getMaterialByKey(PIPE);
    if (already) {
        console.log(`\n[SKIP] "${PIPE.itemName}" is already indexed (${already.id}).`);
        console.log("       Nothing created. Delete the Materials rows first if you want a fresh set.");
        console.log(`\n  /materials?q=pipe`);
        console.log(`  /materials/${already.id}`);
        return;
    }

    // --- pass 1: the real flow, once per order -----------------------------
    // ALL POs are generated before ANY of them is backdated, and that order
    // matters. lib/ids.js numbers a PO by counting the POs whose Created Date is
    // today, so backdating one inside this loop would hide it from the next
    // call's count and every PO would come out as -01. Which is exactly what the
    // first version of this script produced: five POs sharing one PO ID.
    console.log("");
    const generated = [];
    for (const order of ORDERS) {
        const vendor = vendorByName.get(order.vendor);
        if (!vendor) {
            console.error(`[FAIL] no vendor named "${order.vendor}" — skipping: ${order.label}`);
            continue;
        }

        const pr = await createPR({ requesterId: requester.id, lineId: line.id, vendorId: vendor.id });
        for (const item of order.items) {
            await createItem({ prRecordId: pr.id, prId: pr.prId, remark: "", ...item });
        }
        // Approving by hand rather than walking a signer chain: the chain is
        // Phase 1's concern and PO generation only reads the status.
        await updatePR(pr.id, { status: "Approved" });
        const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
        generated.push({ order, gen });
    }

    // The guard that would have caught the bug above. A duplicate PO ID makes
    // /pos/[poId] ambiguous, so this must fail rather than seed bad data.
    const poIds = generated.map((g) => g.gen.poId);
    if (new Set(poIds).size !== poIds.length) {
        console.error(`\n[FAIL] PO IDs are not unique: ${poIds.join(", ")}`);
        console.error("       Delete the PRs/POs this run created before trying again.");
        process.exitCode = 1;
        return;
    }

    // --- pass 2: status, then backdate -------------------------------------
    for (const { order, gen } of generated) {
        const date = isoDate(order.daysAgo);

        // Awaiting Signature is what generation leaves behind, so only the other
        // two need a write.
        if (order.status === "Signed") {
            await updatePO(gen.poRecordId, {
                status: "Signed",
                presidentSigned: true,
                presidentSignedAt: new Date(date).toISOString(),
            });
        } else if (order.status === "Withdrawn") {
            await updatePO(gen.poRecordId, {
                status: "Withdrawn",
                withdrawnAt: new Date(date).toISOString(),
            });
        }

        // Backdating — the one direct field write. See the ORDERS comment.
        await base(TABLES.PURCHASE_ORDERS).update(gen.poRecordId, { "Created Date": date });

        console.log(`[NEW]  ${gen.poId}  ${date}  ${order.status.padEnd(19)} ${order.vendor}`);
        console.log(`       ${order.label}`);
    }

    // --- move Latest Date with the PO it came from -------------------------
    // upsertMaterialPrice wrote today's date because that is when generation
    // ran. Re-point each price row at its own Latest PO's (now backdated)
    // Created Date, so the comparison screen and the history screen agree —
    // which is the invariant production keeps by construction.
    console.log("\nAligning Material Prices.Latest Date with each row's Latest PO:");
    const prices = await base(TABLES.MATERIAL_PRICES).select().all();
    for (const price of prices) {
        const poId = (price.get("Latest PO") || [])[0];
        if (!poId) continue;
        const po = await base(TABLES.PURCHASE_ORDERS).find(poId).catch(() => null);
        const date = po?.get("Created Date");
        if (!date || date === price.get("Latest Date")) continue;
        await base(TABLES.MATERIAL_PRICES).update(price.id, { "Latest Date": date });
        console.log(`  ${price.get("Price Label")} -> ${date}`);
    }

    // --- where to look ----------------------------------------------------
    console.log("\nSeeded. Open these:");
    console.log("  /materials?q=pipe          3 vendors, Lowest mark, qty caveat");
    console.log("  /materials?q=valve         newest price is from a withdrawn order");
    console.log("  /materials?q=hanger        one vendor only, so no Lowest mark, blank size");
    for (const key of [PIPE, VALVE, HANGER]) {
        const m = await getMaterialByKey(key);
        if (m) console.log(`  /materials/${m.id}   ${m.materialLabel}`);
    }
}

main().catch((err) => {
    console.error("\nSeed failed:", err);
    process.exitCode = 1;
});
