// Back to the state the seed leaves, in one command. For between rehearsals.
//
// WHY THE WHOLE BASE AND NOT JUST THE LIVE RECORDS. A rehearsal does not only ADD
// records — it MUTATES the seeded ones, so deleting what the rehearsal made would not
// put the base back. The overage correction in Act IV is the clearest case:
// `applyOverageToPO` re-points the over-delivered `Delivery Items` row onto the
// corrective order's ordered item, clears `Over Delivered`, and splits the invoice item
// that invoiced it. The delivery that started the act is now a different row pointing at a
// different order, and no amount of deleting the correction restores it — the original
// order keeps only `Former Delivery Items`, and the delivery drops off its `Delivered`
// column. Act I's signing chain is the same shape: approving advances
// `Current Signer Step` and writes `PR Signers` statuses that nothing rewinds.
//
// So the answer is not a smarter delete. It is to rebuild, which the seed already does
// from empty — and this runs the two scripts that exist rather than reimplementing
// either. `wipe_base.mjs` keeps its own `--confirm` contract and its own exit codes;
// `seed_full_demo.mjs` bootstraps its own Job, Line and vendors. This orders them,
// checks each one's exit code, and then reads the base back.
//
// THE CHILD PROCESSES INHERIT THIS RUN'S NODE FLAGS, which is why the documented
// command works unchanged. `process.execArgv` carries `--env-file` and
// `--experimental-loader` and nothing else for a script invocation, so passing it
// through means the loader path is never spelled twice and never drifts.
//
// DRY RUN BY DEFAULT, and that is not symmetry with `wipe_base.mjs` for its own sake.
// This is the command that gets run repeatedly, under time pressure, from shell
// history — the one place where a flag that defaults to destructive would eventually
// cost a base.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/demo/reset_demo.mjs
//   … --confirm      actually wipe and reseed
//
// Exit codes: 0 all clear, 1 a step failed or the post-reset state is not what the
// seed leaves.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { list, del } from "@vercel/blob";
import { base, TABLES } from "../../lib/airtable/client.js";
import { getItemsByPO } from "../../lib/airtable/poItems.js";
import { getItemsByDelivery } from "../../lib/airtable/deliveryItems.js";
import { resolveDemoRecords, pickRecordId, pick } from "./_demo_ids.mjs";

const CONFIRM = process.argv.includes("--confirm");
const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Blob pathnames a SCRIPT wrote, and therefore ones a reseed recreates.
 *
 * WHAT IS DELIBERATELY NOT HERE IS THE POINT. Every upload in the app is made with
 * `addRandomSuffix: true` over the **original filename**, so a quotation, a packing
 * list photo or an invoice PDF that a presenter dragged in during a rehearsal is named
 * after whatever file was on their disk. There is no pattern to match. Measured on this
 * store: 100 of 156 objects carry one of the prefixes below and 56 do not, and among
 * those 56 is a 48KB real vendor document somebody uploaded by hand months ago.
 * Deleting that as tidying-up is exactly what this repo's convention forbids, so this
 * reports the remainder and leaves it alone — see the manual command it prints.
 */
const SCRIPT_WRITTEN = [
    /^LSP-/, // this seed's invoice PDFs
    /^DEMO26-/, // the same, under the naming this seed used first
    /^HYE-PO-/, // generated purchase order PDFs
    /^1\d\d-DEMO/, // the #165 / #166 / #167 seeds
    /^237-DEMO/, // the #237 seed
];

function step(title) {
    console.log("");
    console.log("=".repeat(72));
    console.log(title);
    console.log("=".repeat(72));
}

/** Run one of the two scripts with this run's own node flags. */
function run(script, args = []) {
    const result = spawnSync(process.execPath, [...process.execArgv, join(HERE, script), ...args], {
        stdio: "inherit",
    });
    if (result.error) throw result.error;
    return result.status ?? 1;
}

async function blobCensus() {
    let cursor;
    const mine = [];
    const others = { count: 0, bytes: 0 };
    do {
        const page = await list({ cursor, limit: 1000 });
        for (const b of page.blobs) {
            if (SCRIPT_WRITTEN.some((re) => re.test(b.pathname))) mine.push(b);
            else {
                others.count += 1;
                others.bytes += b.size || 0;
            }
        }
        cursor = page.cursor;
    } while (cursor);
    return { mine, others };
}

// ---------------------------------------------------------------------------

console.log("=".repeat(72));
console.log(`reset_demo — ${CONFIRM ? "WIPE AND RESEED" : "dry run, nothing will change"}`);
console.log("=".repeat(72));

const before = await resolveDemoRecords();
const liveRows =
    before.untagged.prs.length +
    before.untagged.pos.length +
    before.untagged.deliveries.length +
    before.untagged.invoices.length;

console.log("");
console.log("On the base now:");
console.log(`  ${before.byScenario.size} seeded scenarios`);
console.log(
    `  ${liveRows} record(s) the seed did not make — ` +
        `${before.untagged.prs.length} PR, ${before.untagged.pos.length} PO, ` +
        `${before.untagged.deliveries.length} delivery, ${before.untagged.invoices.length} invoice`
);
for (const kind of ["prs", "pos", "deliveries", "invoices"]) {
    for (const e of before.untagged[kind]) console.log(`      ${e.displayId ?? e.recordId}`);
}

const blobs = await blobCensus();
console.log("");
console.log("Vercel Blob:");
console.log(`  ${blobs.mine.length} object(s) written by a script — a reseed recreates these`);
console.log(
    `  ${blobs.others.count} object(s) with no script pattern (${(blobs.others.bytes / 1024).toFixed(0)}KB) — left alone`
);

if (!CONFIRM) {
    console.log("");
    console.log("Dry run. With --confirm this would:");
    console.log("  1. run wipe_base.mjs --confirm   (every table except Users)");
    console.log(`  2. delete ${blobs.mine.length} script-written Blob object(s)`);
    console.log("  3. run seed_full_demo.mjs        (bootstraps its own Job, Line, vendors)");
    console.log("  4. read the base back and check the states a rehearsal moves");
    console.log("");
    console.log("Re-run with --confirm.");
    process.exit(0);
}

// --- 1. wipe ---------------------------------------------------------------
step("1/4  wipe_base.mjs --confirm");
const wipeStatus = run("wipe_base.mjs", ["--confirm"]);
if (wipeStatus !== 0) {
    console.error(`\nwipe_base.mjs exited ${wipeStatus}. Nothing was reseeded — the base is empty.`);
    process.exit(1);
}

// --- 2. blob ---------------------------------------------------------------
//
// AFTER THE WIPE, NOT BEFORE. Every object here is referenced by an Airtable
// attachment that no longer exists, so the ordering is what makes "orphaned" true
// rather than assumed. Best-effort, like `lib/blobIngest.js`'s own cleanup: a failed
// `del` is a logged line and not a failed reset.
step("2/4  Vercel Blob");
let deleted = 0;
for (let i = 0; i < blobs.mine.length; i += 100) {
    const batch = blobs.mine.slice(i, i + 100);
    try {
        await del(batch.map((b) => b.url));
        deleted += batch.length;
    } catch (err) {
        console.warn(`  could not delete ${batch.length} object(s): ${err.message}`);
    }
}
console.log(`  ${deleted} script-written object(s) deleted.`);
if (blobs.others.count > 0) {
    console.log(`  ${blobs.others.count} left in place — a rehearsal upload is named after`);
    console.log("  whatever file was picked, so there is no pattern to match on. To see them:");
    console.log("    npx vercel blob list");
    console.log("  and delete individually with:");
    console.log("    npx vercel blob del <url>");
}

// --- 3. seed ---------------------------------------------------------------
step("3/4  seed_full_demo.mjs");
const seedStatus = run("seed_full_demo.mjs");
if (seedStatus !== 0) {
    console.error(`\nseed_full_demo.mjs exited ${seedStatus}. Re-run it — it skips what it already made.`);
    process.exit(1);
}

// --- 4. check --------------------------------------------------------------
//
// ONLY WHAT A REHEARSAL MOVES. A full check of all 141 states belongs in a browser and
// is the runbook's job; this answers the narrower question that matters between
// rehearsals — is each thing the six acts change back where the seed puts it.
step("4/4  the states a rehearsal moves");

const after = await resolveDemoRecords();
let pass = true;
// THE DETAIL PRINTS ONLY ON A FAILURE. A passing line that ends "1 flagged row(s),
// expected 1" makes a reader stop and read an argument that already succeeded, which is
// the opposite of what a between-rehearsals check is for.
const check = (label, ok, detail = "") => {
    if (!ok) pass = false;
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${label}${!ok && detail ? ` — ${detail}` : ""}`);
};

// Act IV's correction: the excess is back, and nothing corrects it.
const overDeliveryId = pickRecordId(after.byScenario, "OVER", "deliveries");
if (!overDeliveryId) {
    check("the OVER delivery exists", false, "no delivery carries the OVER tag");
} else {
    const rows = await getItemsByDelivery(overDeliveryId);
    const over = rows.filter((r) => r.overDelivered);
    check(
        `${pick(after.byScenario, "OVER", "deliveries")} is over-delivered again`,
        over.length === 1,
        `${over.length} flagged row(s), expected 1`
    );
    const raised = await base(TABLES.DELIVERY_ITEMS).find(over[0]?.id ?? overDeliveryId);
    check(
        "no correction is raised against it",
        (raised.get("Overage PR") || []).length === 0,
        "`Overage PR` should be empty"
    );
}

// Act II's forward pairing: the invoice is waiting again.
const invWaitAId = pickRecordId(after.byScenario, "INV_WAIT_A", "invoices");
if (!invWaitAId) {
    check("the INV_WAIT_A invoice exists", false, "no invoice carries that code");
} else {
    const inv = await base(TABLES.INVOICES).find(invWaitAId);
    check(
        `${pick(after.byScenario, "INV_WAIT_A", "invoices")} names no delivery`,
        (inv.get("Delivery") || []).length === 0
    );
}

// Act II's reverse pairing: the delivery is waiting again, and its order is uninvoiced.
const dlWaitId = pickRecordId(after.byScenario, "DL_WAIT", "deliveries");
if (!dlWaitId) {
    check("the DL_WAIT delivery exists", false, "no delivery carries that tag");
} else {
    const dl = await base(TABLES.DELIVERIES).find(dlWaitId);
    check(
        `${pick(after.byScenario, "DL_WAIT", "deliveries")} is waiting for an invoice`,
        (dl.get("Invoices") || []).length === 0
    );
}
const dlWaitPoId = pickRecordId(after.byScenario, "DL_WAIT", "pos");
if (!dlWaitPoId) {
    check("the DL_WAIT order exists", false, "no order under that request");
} else {
    const items = await getItemsByPO(dlWaitPoId);
    const invoiced = items.filter((it) => (it.invoicedQty || 0) > 0);
    check(
        `${pick(after.byScenario, "DL_WAIT", "pos")} has nothing invoiced`,
        invoiced.length === 0,
        `${invoiced.length} of ${items.length} ordered item(s) carry an invoiced quantity`
    );
}

// And nothing a rehearsal made survived.
const leftover =
    after.untagged.prs.length +
    after.untagged.pos.length +
    after.untagged.deliveries.length +
    after.untagged.invoices.length;
check(
    "no records outside the seed's own",
    leftover === 0,
    leftover === 0 ? "" : `${leftover} left: ${["prs", "pos", "deliveries", "invoices"]
        .flatMap((k) => after.untagged[k].map((e) => e.displayId ?? e.recordId))
        .join(", ")}`
);

// ---------------------------------------------------------------------------

console.log("");
if (!pass) {
    console.error("Reset ran but the base is not in the state the seed leaves. Look above.");
    process.exit(1);
}

console.log("=".repeat(72));
console.log("Reset complete. Print the presenter's id table — the ids changed:");
console.log("  node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \\");
console.log("    scripts/demo/seed_full_demo.mjs --only=NONE");
console.log("");
console.log("SIGN IN AGAIN. The wipe cleared Auth Tokens and every session with it, so");
console.log("the first screen of the rehearsal will bounce you to /login until you do.");
console.log("=".repeat(72));
