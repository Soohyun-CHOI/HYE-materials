// Gives every delivery on the TEST base that records no address its job's default address (#675).
//
// WHY. Inventory counts a job's material at the address its delivery was recorded at (#675), and
// the screens count every delivery as having one: `createDelivery` refuses a delivery with none
// since #675, and `/deliveries/new` has required one since #387. The deliveries recorded before
// #387 hold none — twelve on the test base, all on `26-DEMO-01`, read 2026-11-19 — and the live
// base holds no delivery at all (0 rows, read the same day), so the gap is the test base's alone.
// Soo chose the job's default address for them (#675); it is a guess about where a demo pallet
// went, which is why the live base is refused rather than handled.
//
// WHAT IT WRITES. `Deliveries."Delivery Address"`, on a row whose cell is empty, to the one record
// its job's `Jobs."Delivery Address"` names. A job with no default stops the run before any write,
// naming the job, rather than leaving some rows filled. Nothing else is written, and a row that
// holds an address is not touched.
//
// A LEDGER BEFORE THE WRITES: `--apply` writes `scripts/import/ledgers/fill_delivery_addresses_675-test-<at>.jsonl`,
// a line per row with the address it takes, before the first request. Each row's cell was empty,
// so the ledger is also the revert: empty the cells it names.
//
// Usage (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/fill_delivery_addresses_675.mjs           (dry run)
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/fill_delivery_addresses_675.mjs --apply
//
// Exit codes, per docs/notes/verification.md: 0 every delivery holds an address, 1 something
// failed or the run was refused, 2 a dry run with rows still to fill.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

const SCRIPT = "fill_delivery_addresses_675";
const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

function log(line = "") {
    console.log(line);
}

async function main() {
    const apply = process.argv.includes("--apply");
    let airtable;
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    log(`${SCRIPT} — ${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    if (airtable.live) {
        log("  REFUSED: the live base holds no delivery to fill (read 2026-11-19), and the default is a guess this run makes for demo rows alone.");
        return 1;
    }

    // Imported after the base is resolved: the client throws at load without its key.
    const { base, TABLES } = await import("../../../lib/airtable/client.js");

    const deliveries = await base(TABLES.DELIVERIES).select({ fields: ["Delivery ID", "Job", "Delivery Address"] }).all();
    const jobs = await base(TABLES.JOBS).select({ fields: ["Job Code", "Delivery Address"] }).all();
    const jobById = new Map(jobs.map((job) => [job.id, job]));

    const empty = deliveries.filter((row) => (row.get("Delivery Address") ?? []).length === 0);
    log(`  ${deliveries.length} deliveries, ${empty.length} with no address`);

    const plan = [];
    const stops = [];
    for (const row of empty) {
        const job = jobById.get((row.get("Job") ?? [])[0]);
        const address = (job?.get("Delivery Address") ?? [])[0];
        if (!job) stops.push(`${row.get("Delivery ID")} names no job`);
        else if (!address) stops.push(`${row.get("Delivery ID")}'s job ${job.get("Job Code")} has no default address`);
        else plan.push({ id: row.id, deliveryId: row.get("Delivery ID"), job: job.get("Job Code"), address });
    }
    if (stops.length > 0) {
        for (const stop of stops) log(`  STOPPED: ${stop}`);
        log("  Nothing was written.");
        return 1;
    }
    for (const p of plan) log(`  ${p.deliveryId}  ${p.job}  -> ${p.address}`);
    if (plan.length === 0) {
        log("  every delivery holds an address");
        return 0;
    }
    if (!apply) {
        log(`DRY RUN — ${plan.length} row(s) would be filled and none was.`);
        return 2;
    }

    mkdirSync(LEDGER_DIR, { recursive: true });
    const at = new Date().toISOString();
    const ledger = join(LEDGER_DIR, `${SCRIPT}-test-${at.replace(/[:.]/g, "-")}.jsonl`);
    writeFileSync(ledger, plan.map((p) => JSON.stringify({ base: "test", at, record: p.id, deliveryId: p.deliveryId, job: p.job, before: [], after: [p.address] })).join("\n") + "\n");
    log(`  ledger: ${ledger}`);

    for (let i = 0; i < plan.length; i += 10) {
        const batch = plan.slice(i, i + 10);
        await base(TABLES.DELIVERIES).update(batch.map((p) => ({ id: p.id, fields: { "Delivery Address": [p.address] } })));
        log(`  wrote ${Math.min(i + 10, plan.length)} of ${plan.length}`);
    }

    const after = await base(TABLES.DELIVERIES).select({ fields: ["Delivery ID", "Delivery Address"] }).all();
    const still = after.filter((row) => (row.get("Delivery Address") ?? []).length === 0);
    const wrong = plan.filter((p) => {
        const row = after.find((r) => r.id === p.id);
        const held = row?.get("Delivery Address") ?? [];
        return held.length !== 1 || held[0] !== p.address;
    });
    log(`  re-read: ${still.length} with no address, ${wrong.length} not as written`);
    return still.length === 0 && wrong.length === 0 ? 0 : 1;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
