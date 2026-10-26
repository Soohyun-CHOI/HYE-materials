// Empties every table on the base but the ones it keeps — Users, the material and asset
// catalogs, the jobs and their disciplines, and the assets and their log (`KEPT`,
// `KEPT_FOR_THEIR_LINKS`, in `_wipe_tables.mjs` with the order it empties the rest in, since
// #575 had `reset_demo.mjs` read them too). This said every table but Users, which stopped
// being true when #358 began keeping more.
//
// SINCE #531 IT REFUSES TO RUN IF ITS ORDER EVER REACHES `Assets` OR `Asset Log`, or a table
// they link to: the two hold the site's records, which no script writes, and emptying a table
// they link to would empty their links (`scripts/protectedTables.mjs`).
//
// WHY IT EXISTS. The base carries dummy data raised one issue at a time since Phase 0
// — four demo seeds, a handful of hand-entered rows, and somebody's TESTQA fixtures —
// and none of it was built to be read side by side. A demo has to be legible, and the
// two waiting-list strips measured 20 and 27 rows against the 7 and 4 the demo's own
// data produces. So this clears the base and `seed_full_demo.mjs` builds it back.
//
// USERS ARE THE ONE EXCEPTION, AND THEY ARE NOT RECOVERABLE. A `Users` row appears as
// a side effect of a first magic-link sign-in and in NO other way — there is no
// user-creation screen and no import — so a deleted account can only come back by
// that person signing in again, and the two permanent fixture accounts
// (`authz-fixture@`, `scoped-fixture@`) would take the authorization checks and the
// demo's permission contrast with them. Everything else on this base either has a
// script that rebuilds it or is dummy data nobody will miss.
//
// WHAT REBUILDS WHAT, so the decision to delete a table is checkable rather than
// remembered:
//   Jobs           scripts/import/import_jobs.py --folder ./data restores the 36 real
//                  company jobs from the six Excel files in the repo. It writes Job
//                  Code, Job Name and Business Unit ONLY — no PIC, no manager, no
//                  address, no Disciplines — and it skips any code off the `##-USA-@@`
//                  pattern, which is why it can never make the demo Job.
//   Jobs/Disciplines/  scripts/demo/seed_demo_fixtures.mjs makes the demo Job, its
//                  Discipline,
//   Vendors/       "Lone Star Pipe & Supply" and both. seed_full_demo.mjs calls it,
//   Addresses      so seeding on an empty base is one command.
//   everything     scripts/demo/seed_full_demo.mjs, plus the three older per-issue
//   else           seeds if their scenarios are wanted back.
//
// CHILDREN FIRST. Airtable does not need it for referential integrity — deleting a
// linked record simply drops it out of the other side's array — but the order is what
// makes it safe to delete without going through the app's own delete actions. Those
// exist to keep the REST of the base consistent (`deleteDeliveryAction` recomputes
// over-delivery on the orders a delivery touched); here there is no rest to keep
// consistent, and every parent is already childless by the time it is reached, so
// there is nothing left to recompute. Going through the actions would also cost
// roughly four times the operations and could not touch orders, ordered items,
// quotations, signers or the item axis at all.
//
// DRY RUN BY DEFAULT. Nothing is deleted without `--confirm`.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/demo/wipe_base.mjs
//   … --confirm      actually delete
//
// Exit codes: 0 all clear, 1 something survived that should not have.

import { base, TABLES } from "../../lib/airtable/client.js";
import { refusesProtectedWrite } from "../protectedTables.mjs";
import { refusesLiveBase } from "./_testBaseOnly.mjs";
import { KEPT, KEPT_FOR_THEIR_LINKS, ORDER } from "./_wipe_tables.mjs";

if (refusesLiveBase({ script: "wipe_base" })) process.exit(1);

const CONFIRM = process.argv.includes("--confirm");

// A table this script has never heard of is a failure rather than a silent pass —
// #162 added two tables at once, and a wipe that quietly skipped them would leave
// exactly the rows it was run to remove. Compared against the production constants
// rather than against a hand-typed list.
const known = new Set([...ORDER, ...KEPT, ...KEPT_FOR_THEIR_LINKS]);
const missing = Object.values(TABLES).filter((t) => !known.has(t));
if (missing.length) {
    console.error(`These tables are in TABLES but not in this script's order: ${missing.join(", ")}`);
    console.error("Add each to ORDER at the right depth, or to KEPT with a reason, in _wipe_tables.mjs.");
    process.exit(1);
}

// Every table in ORDER is emptied, so ORDER is what is asked (#531): it holds none of them today,
// and the day it does this stops before the first read on the live base. The base is the client's
// own, read off the SDK (#534).
if (refusesProtectedWrite({ script: "wipe_base", baseId: base.getId(), wipes: ORDER, log: console.error })) process.exit(1);

console.log("=".repeat(72));
console.log(`wipe_base — ${CONFIRM ? "DELETING" : "dry run, nothing will be deleted"}`);
console.log("=".repeat(72));

let totalRows = 0;
let totalOps = 0;
const counts = [];

for (const table of ORDER) {
    const records = await base(table).select({ fields: [] }).all();
    totalOps += Math.max(1, Math.ceil(records.length / 100));
    const batches = Math.ceil(records.length / 10);
    counts.push([table, records.length, batches]);
    totalRows += records.length;
    totalOps += batches;

    if (CONFIRM) {
        for (let i = 0; i < records.length; i += 10) {
            await base(table).destroy(records.slice(i, i + 10).map((r) => r.id));
        }
    }
}

console.log("");
console.log("  rows   ops  table");
console.log("  ----  ----  " + "-".repeat(24));
for (const [table, rows, batches] of counts) {
    console.log(`  ${String(rows).padStart(4)}  ${String(batches).padStart(4)}  ${table}`);
}
console.log("  ----  ----  " + "-".repeat(24));
console.log(`  ${String(totalRows).padStart(4)}        ${ORDER.length} tables`);

console.log("");
for (const table of [...KEPT, ...KEPT_FOR_THEIR_LINKS]) {
    const kept = await base(table).select({ fields: [] }).all();
    console.log(`  ${String(kept.length).padStart(4)}        ${table}  — KEPT`);
}

console.log("");
console.log(`  ~${totalOps} operations (${totalRows} deletes batched at 10, plus one list per table)`);

if (!CONFIRM) {
    console.log("");
    console.log("Dry run. Re-run with --confirm to delete.");
    console.log("Afterwards: scripts/demo/seed_full_demo.mjs rebuilds the demo set from empty,");
    console.log("and scripts/import/import_jobs.py --folder ./data restores the real job list.");
    process.exit(0);
}

// A LEAK IS 1, NOT 2 — verification.md's rule. A run that left rows behind needs a
// hand, and reporting that as "clean but incomplete" would file it as nobody's.
console.log("");
let leaked = false;
for (const table of ORDER) {
    const left = await base(table).select({ fields: [] }).all();
    if (left.length > 0) {
        console.error(`  LEAK  ${left.length} row(s) still in ${table}`);
        leaked = true;
    }
}
if (leaked) {
    console.error("\nSomething survived. Re-run, or delete the rest by hand.");
    process.exit(1);
}

console.log(`Done — ${totalRows} records deleted, ${[...KEPT, ...KEPT_FOR_THEIR_LINKS].join(", ")} untouched.`);
console.log("");
console.log("Next: scripts/demo/seed_full_demo.mjs   (it bootstraps its own Job, Discipline and vendors)");
