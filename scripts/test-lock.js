// ============================================================================
// TEMPORARY VERIFICATION SCRIPT — NOT for commit. Delete after use, along
// with scripts/esm-ext-loader.mjs and scripts/package.json if nothing else
// needs them.
//
// Two pre-PR checks on withKeyLock (lib/airtable/client.js):
//   1. If a locked call's fn() rejects, does the lock release and the next
//      queued call still run (and see the correct state, unaffected by the
//      failure)?
//   2. Does keyQueues clean up its entry once a key's chain drains, so warm
//      instances don't accumulate entries forever?
//
// Part A is a pure withKeyLock unit test (no Airtable calls, deterministic
// via setTimeout). Part B re-checks the same thing in the real usage
// context: generateChildId with a deliberately failing createFn, wedged
// between two real PR Item creates on the same PR (same lock key).
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/test-lock.js
// ============================================================================

import { base, TABLES, withKeyLock, _debugLockKeys } from "../lib/airtable/client.js";
import { generateChildId } from "../lib/ids.js";
import { createVendor } from "../lib/airtable/vendors.js";
import { createJob } from "../lib/airtable/jobs.js";
import { createPR } from "../lib/airtable/purchaseRequests.js";

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

async function partA_pureLockTest() {
    console.log("\n--- Part A: pure withKeyLock unit test (no Airtable) ---");

    const key = `test-lock-${stamp}`;
    const log = [];

    const [r1, r2, r3] = await Promise.allSettled([
        withKeyLock(key, async () => {
            log.push("A-start");
            await new Promise((resolve) => setTimeout(resolve, 50));
            log.push("A-end");
            return "A-result";
        }),
        withKeyLock(key, async () => {
            log.push("B-start");
            throw new Error("deliberate test failure");
        }),
        withKeyLock(key, async () => {
            log.push("C-start");
            await new Promise((resolve) => setTimeout(resolve, 20));
            log.push("C-end");
            return "C-result";
        }),
    ]);

    check(
        "Execution strictly sequential: A fully finishes before B starts, B before C",
        JSON.stringify(log) === JSON.stringify(["A-start", "A-end", "B-start", "C-start", "C-end"]),
        `log=${JSON.stringify(log)}`
    );
    check(
        "Call A (success) fulfilled with correct value",
        r1.status === "fulfilled" && r1.value === "A-result",
        JSON.stringify(r1)
    );
    check(
        "Call B (deliberate failure) rejected, error propagated to its own caller",
        r2.status === "rejected" && r2.reason?.message === "deliberate test failure",
        `status=${r2.status} message=${r2.reason?.message}`
    );
    check(
        "Call C ran after B despite B's rejection — lock released, queue continued",
        r3.status === "fulfilled" && r3.value === "C-result",
        JSON.stringify(r3)
    );

    const keysAfter = _debugLockKeys();
    check(
        "keyQueues entry cleaned up after the whole chain drains",
        !keysAfter.includes(key),
        `remaining keys=${JSON.stringify(keysAfter)}`
    );
}

async function partB_realUsageTest() {
    console.log("\n--- Part B: generateChildId with a failing createFn, real PR ---");

    const vendor = await createVendor({ vendorName: `TEST-LOCK-VENDOR-${stamp}` });
    track(TABLES.VENDORS, vendor.id, "Vendor");

    const job = await createJob({
        jobCode: `TEST-LOCK-JOB-${stamp}`,
        jobName: "Lock Test Job",
        businessUnit: "EPC",
    });
    track(TABLES.JOBS, job.id, "Job");

    const pr = await createPR({ jobId: job.id, vendorId: vendor.id, notes: "verify: lock rejection handling" });
    track(TABLES.PURCHASE_REQUESTS, pr.id, "PR");

    const genArgs = {
        parentTableName: TABLES.PURCHASE_REQUESTS,
        parentRecordId: pr.id,
        parentLinkFieldName: "PR Items",
        prefix: pr.prId,
        padLength: 3,
    };
    const log = [];

    const [r1, r2, r3] = await Promise.allSettled([
        generateChildId(genArgs, (id) => {
            log.push("real-1-start");
            return base(TABLES.PR_ITEMS)
                .create({ "PR Item ID": id, PR: [pr.id], "Item Name": "Lock Test Item 1", Qty: 1, Rate: 1 })
                .then((record) => {
                    log.push("real-1-end");
                    return record;
                });
        }),
        generateChildId(genArgs, () => {
            log.push("real-2-start (about to throw)");
            throw new Error("deliberate createFn failure");
        }),
        generateChildId(genArgs, (id) => {
            log.push("real-3-start");
            return base(TABLES.PR_ITEMS)
                .create({ "PR Item ID": id, PR: [pr.id], "Item Name": "Lock Test Item 3", Qty: 1, Rate: 1 })
                .then((record) => {
                    log.push("real-3-end");
                    return record;
                });
        }),
    ]);

    if (r1.status === "fulfilled") track(TABLES.PR_ITEMS, r1.value.id, "PR Item (real 1)");
    if (r3.status === "fulfilled") track(TABLES.PR_ITEMS, r3.value.id, "PR Item (real 3)");

    check(
        "Execution order: 1 fully finishes before 2 starts, 2 before 3",
        JSON.stringify(log) ===
            JSON.stringify(["real-1-start", "real-1-end", "real-2-start (about to throw)", "real-3-start", "real-3-end"]),
        `log=${JSON.stringify(log)}`
    );
    check(
        "Real create #1 succeeded with seq 001",
        r1.status === "fulfilled" && r1.value.get("PR Item ID") === `${pr.prId}-001`,
        r1.status === "fulfilled" ? r1.value.get("PR Item ID") : JSON.stringify(r1.reason?.message)
    );
    check(
        "Deliberate failure #2 rejected, error propagated (no record created)",
        r2.status === "rejected" && r2.reason?.message === "deliberate createFn failure",
        `status=${r2.status} message=${r2.reason?.message}`
    );
    check(
        "Real create #3 succeeded with seq 002 — NOT skipped to 003, proving #2's failure didn't consume a sequence number",
        r3.status === "fulfilled" && r3.value.get("PR Item ID") === `${pr.prId}-002`,
        r3.status === "fulfilled" ? r3.value.get("PR Item ID") : JSON.stringify(r3.reason?.message)
    );

    const lockKey = `${TABLES.PURCHASE_REQUESTS}:${pr.id}:PR Items`;
    const keysAfter = _debugLockKeys();
    check(
        "keyQueues entry cleaned up after this chain drains too",
        !keysAfter.includes(lockKey),
        `remaining keys=${JSON.stringify(keysAfter)}`
    );
}

async function main() {
    try {
        await partA_pureLockTest();
        await partB_realUsageTest();
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
