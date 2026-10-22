// What the Tools & Equipment list keeps between views, against the base this run reaches (#560)
// — the test base unless the run names the live one (`lib/airtableBase.js`, #534).
//
// WHY THIS TIER. `offline/asset-status-memory.mjs` drives the memory over a fake base, and
// that is everything a file can say about it. What it cannot say is whether THIS base answers
// what the memory and the list rest on: that the link arrays the list counts by are current on
// the first read after a write, that `changedSince` lists a status written a moment earlier,
// and what a view of the list's statuses costs. Those are Airtable's properties, and
// `docs/notes/verification.md` is explicit that a rule resting on that side needs a credentialed
// check that reads the live values.
//
// THREE PARTS.
//
//   A  THE ARRAYS THE LIST COUNTS BY. Fixture assets created on an empty demo job under a
//      fixture kind, each read back at once off `Jobs."Assets"` and `Asset Categories."Assets"`;
//      then each moved to a second job and read back at once off both jobs. The list takes an
//      asset's job and kind off these arrays on every view, so a write they did not show would be
//      a count on the wrong row.
//   B  WHAT A VIEW COSTS. Every asset in every job's array, read cold and then warm through the
//      list's own reader, and the fixtures alone warm: the cold read is one operation per hundred
//      assets, and a warm one is one operation whatever it holds, the same for 3 and for over
//      600 — which no shape that reads per asset can match.
//   C  THE QUESTION ABOUT CHANGES. With the memory holding the fixtures, each one's `Status`
//      written straight to the base — as a person would in Airtable's grid, or another server
//      instance would, neither of which this process's memory hears of — and the list's own
//      reader asked at once: it must answer the new status, for one operation.
//
// Fixtures are deleted within the run through scripts/tests/_fixtures.mjs. **On the live base the
// run is refused before its first write** (#531): `Assets` holds the site's records there, which
// no script writes (`scripts/protectedTables.mjs`), so a run that names the live base ends on 2
// having run nothing. About 40 operations on the test base.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-asset-status-memory-560.mjs
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed or a row was left
// on the base, 2 no failures but a part could not run.

import { TABLES, base } from "../../lib/airtable/client.js";
import { getAllJobs, getJobByCode } from "../../lib/airtable/jobs.js";
import { getAssetStatuses } from "../../lib/airtable/assets.js";
import { getAssetCategoriesByRecordIds } from "../../lib/airtable/assetCategories.js";
import { ASSET_STATUS } from "../../lib/assetStatus.js";
import { ASSET_CATEGORY_FIELDS } from "../../lib/assetCategory.js";
import { resetOps, snapshot } from "../../lib/airtableOps.js";
import { createFixtures } from "./_fixtures.mjs";
import { printProvenance } from "./_provenance.mjs";
import { refusesProtectedWrite } from "../protectedTables.mjs";

printProvenance({ title: "verify-asset-status-memory-560 — what the list keeps between views, against the base this run reaches" });

let pass = true;
let incomplete = false;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return ok;
}
const log = (text = "") => console.log(text);

// THE ASSET ID CARRIES THE TAG HERE, where #335's minted it: nothing in this run is about the
// minted id, so each fixture's primary is written with the run's tag and the census finds every
// one. They stand on two demo jobs with nothing on them and under a fixture kind, so no list of a
// real job counts them, and a kind's `Assets` array is a child of its bucket.
const fixtures = createFixtures({
    tag: "V560",
    buckets: [
        { name: "assets", table: TABLES.ASSETS, label: "Asset", tagField: "Asset ID" },
        {
            name: "kinds",
            table: TABLES.ASSET_CATEGORIES,
            label: "Asset Category",
            tagField: ASSET_CATEGORY_FIELDS.level3,
            children: [{ link: "Assets", table: TABLES.ASSETS, label: "Asset" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;
const TRIALS = 3;

console.log(`run tag: ${TAG} — every fixture below is prefixed with it`);
log();

let complete = false;

try {
    // REFUSED ON THE LIVE BASE (#531): Parts A and C write `Assets`, the site's records there.
    // The base is the client's own, read off the SDK, so the guard judges where the writes
    // below would land (#534).
    const refused = refusesProtectedWrite({
        script: "verify-asset-status-memory-560",
        baseId: base.getId(),
        writes: [TABLES.ASSET_CATEGORIES, TABLES.ASSETS],
    });
    const [first, second] = refused ? [null, null] : await Promise.all([getJobByCode("26-DEMO-01"), getJobByCode("26-DEMO-03")]);
    if (refused) {
        log("SKIPPED — every part writes into Assets, the site's records on the live base since #531.");
        incomplete = true;
    } else if (!first || !second) {
        log("SKIPPED — needs Jobs 26-DEMO-01 and 26-DEMO-03.");
        incomplete = true;
    } else {
        const kind = await base(TABLES.ASSET_CATEGORIES).create({ [ASSET_CATEGORY_FIELDS.level3]: `${TAG} probe grinder` });
        track("kinds", kind.id);

        log("Part A — the arrays the list counts by, read at once after each write:");
        const made = [];
        const seen = { created: 0, kindHolds: 0, moved: 0, leftOld: 0 };
        for (let i = 1; i <= TRIALS; i += 1) {
            const [asset] = await base(TABLES.ASSETS).create([
                { fields: { "Asset ID": `${TAG}-${i}`, Category: [kind.id], Status: ASSET_STATUS.IN_STOCK, Job: [first.id] } },
            ]);
            track("assets", asset.id);
            made.push(asset.id);
            const [jobs, [kindRow]] = await Promise.all([getAllJobs(), getAssetCategoriesByRecordIds([kind.id])]);
            if (jobs.find((job) => job.id === first.id)?.assets.includes(asset.id)) seen.created += 1;
            if (kindRow?.assets.includes(asset.id)) seen.kindHolds += 1;
        }
        check("a new asset is on its job's array at once", seen.created, TRIALS);
        check("  and on its kind's", seen.kindHolds, TRIALS);
        for (const id of made) {
            await base(TABLES.ASSETS).update([{ id, fields: { Job: [second.id] } }]);
            const jobs = await getAllJobs();
            if (jobs.find((job) => job.id === second.id)?.assets.includes(id)) seen.moved += 1;
            if (!jobs.find((job) => job.id === first.id)?.assets.includes(id)) seen.leftOld += 1;
        }
        check("a moved asset is on its new job's array at once", seen.moved, TRIALS);
        check("  and off its old job's", seen.leftOld, TRIALS);

        log();
        log("Part B — what a view of the statuses costs, cold and warm:");
        const everyId = (await getAllJobs()).flatMap((job) => job.assets);
        assert(`the base holds more than one query's page of assets (${everyId.length})`, everyId.length > 100);
        resetOps();
        const cold = await getAssetStatuses(everyId);
        const coldOps = snapshot().total;
        check("a cold read costs one operation per hundred assets", coldOps, Math.ceil(everyId.length / 100));
        check("  and answers every one", cold.size, everyId.length);
        resetOps();
        const warm = await getAssetStatuses(everyId);
        const warmOps = snapshot().total;
        check("a warm read of all of them costs one operation", warmOps, 1);
        check("  and answers every one", warm.size, everyId.length);
        resetOps();
        await getAssetStatuses(made);
        check(`a warm read of ${made.length} costs the same as one of ${everyId.length}`, snapshot().total, warmOps);

        log();
        log("Part C — a status written straight to the base, read at once through the list's reader:");
        const answered = { changed: 0, oneOp: 0, othersKept: 0 };
        for (const [index, id] of made.entries()) {
            await base(TABLES.ASSETS).update([{ id, fields: { Status: ASSET_STATUS.OUT } }]);
            resetOps();
            const now = await getAssetStatuses(made);
            if (now.get(id) === ASSET_STATUS.OUT) answered.changed += 1;
            if (snapshot().total === 1) answered.oneOp += 1;
            if (made.slice(index + 1).every((other) => now.get(other) === ASSET_STATUS.IN_STOCK)) answered.othersKept += 1;
        }
        check("the new status is answered on the very next read", answered.changed, TRIALS);
        check("  for one operation each time", answered.oneOp, TRIALS);
        check("  and the statuses not yet written still read as they were", answered.othersKept, TRIALS);
    }

    complete = true;
} catch (err) {
    pass = false;
    log();
    log(`UNCAUGHT: ${err?.stack || err}`);
}

log();
const teardown = await fixtures.teardown({ complete });
log(fixtures.describe(teardown));

log();
log("=".repeat(60));
const leaked = teardown.leaked.length > 0;
if (!pass || leaked) {
    log(leaked ? "FAILED — and rows were left on the base, see above" : "FAILED");
    process.exit(1);
}
if (incomplete) {
    log("NO FAILURES, but a part could not run — see SKIPPED above");
    process.exit(2);
}
log("OK — the arrays and the question are current at once, and a warm view costs one operation");
process.exit(0);
