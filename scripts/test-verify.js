// ============================================================================
// TEMPORARY VERIFICATION SCRIPT — NOT for commit. Delete after use, along
// with scripts/esm-ext-loader.mjs and scripts/package.json if nothing else
// needs them.
//
// Three pre-PR checks against the REAL "Material Purchases" base:
//   1. materials.js:upsertMaterial race risk when called back-to-back /
//      concurrently for the SAME natural key.
//   2. getLinkedRecords() return order vs. parent reverse-link / creation
//      order.
//   3. generateChildId() under TRUE concurrent (Promise.all) child creation,
//      as opposed to the already-verified sequential-rapid case.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/test-verify.js
// ============================================================================

import { base, TABLES, getLinkedRecords } from "../lib/airtable/client.js";
import { createVendor } from "../lib/airtable/vendors.js";
import { createJob } from "../lib/airtable/jobs.js";
import { createPR } from "../lib/airtable/purchaseRequests.js";
import { createItem } from "../lib/airtable/prItems.js";
import { getMaterialByKey, upsertMaterial } from "../lib/airtable/materials.js";

const results = [];
function check(label, pass, detail) {
    results.push({ label, pass: !!pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

const created = [];
function track(table, id, label) {
    created.push({ table, id, label });
    return id;
}

const stamp = Date.now();

async function main() {
    try {
        const vendor = await createVendor({ vendorName: `TEST-VERIFY-VENDOR-${stamp}` });
        track(TABLES.VENDORS, vendor.id, "Vendor");

        const job = await createJob({
            jobCode: `TEST-VERIFY-JOB-${stamp}`,
            jobName: "Verify Job",
            businessUnit: "EPC",
        });
        track(TABLES.JOBS, job.id, "Job");

        // ====================================================================
        // CHECK 1: materials.js upsertMaterial race risk, same natural key
        // ====================================================================

        // 1a. Back-to-back sequential, NO intervening call (worst case for the
        // "second call's read doesn't see the first call's fresh write yet"
        // race — this is stricter than the original Phase 0 test, which had
        // an extra query between the two upserts).
        const key1 = {
            itemName: `Verify Material Sequential ${stamp}`,
            size: "STD",
            unit: "EA",
            vendorRecordId: vendor.id,
        };
        const seqFirst = await upsertMaterial({ ...key1, unitPrice: 10 });
        track(TABLES.MATERIALS, seqFirst.id, "Material (sequential upsert 1)");
        const seqSecond = await upsertMaterial({ ...key1, unitPrice: 20 });
        if (seqSecond.id !== seqFirst.id) {
            track(TABLES.MATERIALS, seqSecond.id, "Material (sequential upsert 2 — DUPLICATE)");
        }
        check(
            "Materials: back-to-back sequential upsert (same key, no intervening call) — no duplicate",
            seqSecond.id === seqFirst.id,
            `first=${seqFirst.id} second=${seqSecond.id}`
        );

        // 1b. Genuinely concurrent Promise.all — simulates multiple PR items
        // resolving to the SAME material+vendor key upserting around the same
        // moment (the scenario asked about).
        const key2 = {
            itemName: `Verify Material Concurrent ${stamp}`,
            size: "STD",
            unit: "EA",
            vendorRecordId: vendor.id,
        };
        const concurrentUpserts = await Promise.all([
            upsertMaterial({ ...key2, unitPrice: 1 }),
            upsertMaterial({ ...key2, unitPrice: 2 }),
            upsertMaterial({ ...key2, unitPrice: 3 }),
        ]);
        concurrentUpserts.forEach((r, i) =>
            track(TABLES.MATERIALS, r.id, `Material (concurrent upsert ${i + 1})`)
        );
        const uniqueMaterialIds = new Set(concurrentUpserts.map((r) => r.id));
        check(
            "Materials: TRUE concurrent upsert (same key, Promise.all x3) — no duplicates",
            uniqueMaterialIds.size === 1,
            `ids=[${concurrentUpserts.map((r) => r.id).join(", ")}]`
        );

        // ====================================================================
        // CHECK 2: getLinkedRecords() order vs. creation order
        // ====================================================================
        const pr = await createPR({ jobId: job.id, vendorId: vendor.id, notes: "verify: order check" });
        track(TABLES.PURCHASE_REQUESTS, pr.id, "PR (order check)");

        const itemNames = ["First Item", "Second Item", "Third Item", "Fourth Item", "Fifth Item"];
        for (const name of itemNames) {
            const item = await createItem({
                prRecordId: pr.id,
                prId: pr.prId,
                itemName: name,
                qty: 1,
                rate: 1,
            });
            track(TABLES.PR_ITEMS, item.id, `PR Item (${name})`);
        }

        const linkedRecords = await getLinkedRecords(
            TABLES.PURCHASE_REQUESTS,
            pr.id,
            "PR Items",
            TABLES.PR_ITEMS
        );
        const fetchedOrder = linkedRecords.map((r) => r.get("Item Name"));
        check(
            "getLinkedRecords() order matches creation order (= parent reverse-link order)",
            JSON.stringify(fetchedOrder) === JSON.stringify(itemNames),
            `expected=[${itemNames.join(", ")}] got=[${fetchedOrder.join(", ")}]`
        );

        // ====================================================================
        // CHECK 3: generateChildId() under TRUE concurrent creation
        // ====================================================================
        const pr2 = await createPR({ jobId: job.id, vendorId: vendor.id, notes: "verify: concurrency race" });
        track(TABLES.PURCHASE_REQUESTS, pr2.id, "PR (concurrency race)");

        const concurrentItems = await Promise.all([
            createItem({ prRecordId: pr2.id, prId: pr2.prId, itemName: "Race A", qty: 1, rate: 1 }),
            createItem({ prRecordId: pr2.id, prId: pr2.prId, itemName: "Race B", qty: 1, rate: 1 }),
            createItem({ prRecordId: pr2.id, prId: pr2.prId, itemName: "Race C", qty: 1, rate: 1 }),
            createItem({ prRecordId: pr2.id, prId: pr2.prId, itemName: "Race D", qty: 1, rate: 1 }),
            createItem({ prRecordId: pr2.id, prId: pr2.prId, itemName: "Race E", qty: 1, rate: 1 }),
        ]);
        concurrentItems.forEach((item) =>
            track(TABLES.PR_ITEMS, item.id, `PR Item (${item.itemName})`)
        );
        const raceIds = concurrentItems.map((i) => i.prItemId);
        const uniqueRaceIds = new Set(raceIds);
        check(
            "generateChildId(): TRUE concurrent creation (Promise.all x5, same parent) — no duplicate seq",
            uniqueRaceIds.size === raceIds.length,
            `ids=[${raceIds.join(", ")}]`
        );
    } catch (err) {
        console.error("\n!!! Uncaught error during verification run:", err);
        check("Verification run completed without throwing", false, err.message);
    } finally {
        await cleanup();
    }

    const passed = results.filter((r) => r.pass).length;
    const failed = results.filter((r) => !r.pass);

    console.log("\n" + "=".repeat(70));
    console.log(`SUMMARY: ${passed}/${results.length} checks passed`);
    console.log("=".repeat(70));

    if (failed.length > 0) {
        console.log("\nFAILED CHECKS:");
        for (const f of failed) {
            console.log(`  - ${f.label}`);
            console.log(`    detail: ${f.detail}`);
        }
    }

    process.exitCode = failed.length > 0 ? 1 : 0;
}

async function cleanup() {
    console.log(`\nCleaning up ${created.length} test record(s), reverse order...`);
    const deletionFailures = [];

    for (const entry of [...created].reverse()) {
        try {
            await base(entry.table).destroy(entry.id);
            console.log(`  deleted ${entry.label} (${entry.id})`);
        } catch (err) {
            console.log(`  FAILED to delete ${entry.label} (${entry.id}): ${err.message}`);
            deletionFailures.push({ ...entry, error: err.message });
        }
    }

    if (deletionFailures.length > 0) {
        console.log("\n" + "!".repeat(70));
        console.log(`CLEANUP INCOMPLETE — ${deletionFailures.length} record(s) NOT deleted:`);
        for (const f of deletionFailures) {
            console.log(`  - [${f.table}] ${f.label}: ${f.id} (error: ${f.error})`);
        }
        console.log("!".repeat(70));
    } else {
        console.log("Cleanup complete — base restored to original state.");
    }
}

main();
