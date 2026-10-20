// Brings the test base's asset catalog, its category groups and the import's three jobs to what
// the live base holds (#544), so `import_site_assets_544.mjs` can run on the test base first.
//
// WHY. The test base is the live base as it stood on 2026-10-16 (#534). Since then the office has
// renamed five categories on the live base — `Power Tool` is `Power Tools`, `Machining Tools` under
// equipment is `Machining Equipment` — moved rows between them, corrected part numbers (RYOBI's
// `DP103L`), added two groups and removed four, and created 25-USA-13 and 26-USA-12. The import's
// list was reviewed against the live base, so on the test base as it is every row it names under a
// renamed category is refused. Nothing else of the test base is touched: no asset, no log row, no
// other job.
//
// TWO RUNS, AND ONLY THE SECOND WRITES. `--snapshot` reads the live base — it refuses to run on the
// test one — and writes what it holds to `ledgers/sync_test_catalog_544-snapshot-{time}.json`: every
// catalog row, every group, and each job the list names with its recorder's assignment. The sync
// itself reads that file and the test base and refuses to run on the live one, so the process that
// writes never holds the live base's key. The two bases share their record ids up to the copy, so a
// row is matched to its live self by id, and a row made on either base since is matched by what it
// is: a group by its pair (`categoryGroupKey`), a catalog row by its path (`catalogPathKey`), a job
// by its code.
//
// WHAT IT WRITES, THROUGH THE APP'S WRITERS WHERE THE APP HAS ONE. A catalog row whose levels, class
// or mark differ takes the live row's — `updateAssetCategory` and `setAssetCategoryDiscontinued`,
// the catalog page's; a live row the test base lacks is `createAssetCategory`'s. A group renamed on
// the live base is renamed here, and one the live base removed is removed here, neither of which the
// app does (#527), so those two are this script's, ten to a request; a group the live base added is
// `createAssetCategoryGroup`'s. A job the test base lacks is `createJob`'s, with the live job's name
// and business unit — and its people and address where the test base holds those rows — and the
// recorder's assignment is `addAssignedJob`'s, additive. A test row the live base lacks, a group that
// would go while a row stands in it, and a path the test base holds on another row are refusals: a
// row nobody can account for is somebody's test (verification.md), and this matches the live base, it
// does not tidy the test one.
//
// A LEDGER, COMMITTED, BEFORE THE FIRST WRITE: every update's before and after and every group about
// to go, each field as read; each create as it is made. A second run finds nothing to do.
//
// Usage (from the repo root). Dry run is the DEFAULT for the sync:
//   AIRTABLE_BASE=live node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/sync_test_catalog_544.mjs --snapshot
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/sync_test_catalog_544.mjs --from <snapshot.json> [--apply]
//
// Exit codes, per docs/notes/verification.md: 0 the test base holds what the snapshot does (or the
// snapshot was written); 1 something failed or was refused; 2 nothing failed and writes are due.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLES, base } from "../../lib/airtable/client.js";
import {
    createAssetCategory,
    getAllAssetCategories,
    setAssetCategoryDiscontinued,
    updateAssetCategory,
} from "../../lib/airtable/assetCategories.js";
import { createAssetCategoryGroup, getAllAssetCategoryGroups } from "../../lib/airtable/assetCategoryGroups.js";
import { createJob, getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { addAssignedJob, getUserByEmail, getUsersByRecordIds } from "../../lib/airtable/users.js";
import { getAllAddresses } from "../../lib/airtable/addresses.js";
import { ASSET_CATEGORY_FIELDS, ASSET_GROUP_LEVELS, ASSET_PATH_LEVELS, catalogPathKey, categoryGroupKey, pathOf } from "../../lib/assetCategory.js";
import { LIVE_BASE_ID, describeAirtableBase, resolveAirtableBase } from "../../lib/airtableBase.js";
import { snapshot as opsSnapshot } from "../../lib/airtableOps.js";
import { RECORDER_EMAIL, inChunks, readList } from "./import_site_assets_544_plan.mjs";

const SCRIPT = "sync_test_catalog_544";
const LEDGERS = join(dirname(fileURLToPath(import.meta.url)), "ledgers");

/** What a catalog row is, field by field: its six levels, its class and its mark. */
const ROW_FIELDS = [...ASSET_PATH_LEVELS, "assetClass", "discontinued"];
const rowOf = (category) => Object.fromEntries(ROW_FIELDS.map((field) => [field, field === "discontinued" ? category.discontinued === true : (category[field] ?? "")]));
const sameRow = (a, b) => ROW_FIELDS.every((field) => rowOf(a)[field] === rowOf(b)[field]);
const groupOf = (group) => Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [level, group[level] ?? ""]));
const pair = (group) => `${group.level1} > ${group.level2}`;

function log(message = "") {
    console.log(message);
}

function finish(code, verdict) {
    log("");
    log(`${opsSnapshot().total} Airtable operation(s). ${verdict}.`);
    return code;
}

/** The live base as the sync needs it, written to a file: run on the live base, reading only. */
async function takeSnapshot() {
    if (base.getId() !== LIVE_BASE_ID) {
        log("--snapshot reads the live base: run it with AIRTABLE_BASE=live");
        return finish(1, "refused before reading anything");
    }
    const codes = [...new Set(readList().rows.map((row) => row.job))];
    const [catalog, groups, jobs, recorder] = await Promise.all([getAllAssetCategories(), getAllAssetCategoryGroups(), getAllJobs(), getUserByEmail(RECORDER_EMAIL)]);
    const named = [];
    for (const code of codes) {
        const job = jobs.find((each) => each.jobCode === code);
        if (!job) {
            log(`job ${code} is not on the live base`);
            return finish(1, "no snapshot was written");
        }
        const full = await getJobByRecordId(job.id);
        named.push({ ...full, recorderAssigned: recorder.assignedJobs.includes(job.id) });
    }
    const taken = {
        takenAt: new Date().toISOString(),
        catalog: catalog.map((category) => ({ id: category.id, itemName: category.itemName, ...rowOf(category), items: category.assets.length })),
        groups: groups.map((group) => ({ id: group.id, ...groupOf(group) })),
        jobs: named.map(({ id, jobCode, jobName, businessUnit, pic, manager, deliveryAddress, recorderAssigned }) => ({ id, jobCode, jobName, businessUnit: businessUnit ?? null, pic: pic ?? [], manager: manager ?? [], deliveryAddress: deliveryAddress ?? [], recorderAssigned })),
    };
    const path = join(LEDGERS, `${SCRIPT}-snapshot-${taken.takenAt.replace(/[:.]/g, "-")}.json`);
    writeFileSync(path, `${JSON.stringify(taken, null, 2)}\n`, "utf8");
    log(`${taken.catalog.length} catalog row(s), ${taken.groups.length} group(s) and ${taken.jobs.map((job) => job.jobCode).join(", ")} read off the live base.`);
    log(`snapshot: ${relative(process.cwd(), path)}  (commit it)`);
    return finish(0, "the snapshot was written");
}

/** The test base against the snapshot: every write due, and every refusal. */
function planSync(live, test) {
    const problems = [];
    const testById = new Map(test.catalog.map((category) => [category.id, category]));
    const liveIds = new Set(live.catalog.map((category) => category.id));
    const rowUpdates = [];
    const rowCreates = [];
    for (const row of live.catalog) {
        const mine = testById.get(row.id) ?? test.catalog.find((category) => !liveIds.has(category.id) && catalogPathKey(category) === catalogPathKey(row));
        if (!mine) rowCreates.push(row);
        else if (!sameRow(mine, row)) rowUpdates.push({ id: mine.id, before: rowOf(mine), after: rowOf(row), itemName: row.itemName, items: mine.assets.length });
    }
    for (const category of test.catalog) {
        const matched = liveIds.has(category.id) || live.catalog.some((row) => catalogPathKey(row) === catalogPathKey(category));
        if (!matched) problems.push(`${category.id} ${JSON.stringify(category.itemName)} is on the test base and not the live one (${category.assets.length} item(s)) — nobody's to remove here`);
    }

    // The catalog as the sync leaves it, which the groups are judged against.
    const after = [...test.catalog.map((category) => rowUpdates.find((update) => update.id === category.id)?.after ?? rowOf(category)), ...rowCreates.map(rowOf)];
    const byKey = new Map();
    for (const row of after) byKey.set(catalogPathKey(row), (byKey.get(catalogPathKey(row)) ?? 0) + 1);
    for (const [key, n] of byKey) if (n > 1) problems.push(`the sync would leave ${n} rows on ${pathOf(Object.fromEntries(ASSET_PATH_LEVELS.map((level, i) => [level, key.split("\n")[i]])))}`);

    const testGroupById = new Map(test.groups.map((group) => [group.id, group]));
    const liveGroupIds = new Set(live.groups.map((group) => group.id));
    const groupRenames = [];
    const groupCreates = [];
    for (const group of live.groups) {
        const mine = testGroupById.get(group.id);
        if (mine) {
            if (pair(mine) !== pair(group)) groupRenames.push({ id: mine.id, before: groupOf(mine), after: groupOf(group) });
        } else if (!test.groups.some((each) => !liveGroupIds.has(each.id) && categoryGroupKey(each) === categoryGroupKey(group))) groupCreates.push(groupOf(group));
    }
    const groupRemovals = test.groups.filter((group) => !liveGroupIds.has(group.id) && !live.groups.some((each) => categoryGroupKey(each) === categoryGroupKey(group)));
    for (const group of groupRemovals) {
        const standing = after.filter((row) => categoryGroupKey(row) === categoryGroupKey(group));
        if (standing.length > 0) problems.push(`${group.id} ${pair(group)} would go with ${standing.length} catalog row(s) standing in it`);
    }

    const jobCreates = [];
    const assignments = [];
    for (const job of live.jobs) {
        const mine = test.jobs.find((each) => each.jobCode === job.jobCode);
        if (!mine) jobCreates.push(job);
        else if (job.recorderAssigned && !test.recorder.assignedJobs.includes(mine.id)) assignments.push({ jobCode: job.jobCode, id: mine.id });
    }
    return { problems, rowUpdates, rowCreates, groupRenames, groupCreates, groupRemovals, jobCreates, assignments };
}

async function readTest() {
    const [catalog, groups, jobs, recorder] = await Promise.all([getAllAssetCategories(), getAllAssetCategoryGroups(), getAllJobs(), getUserByEmail(RECORDER_EMAIL)]);
    return { catalog, groups, jobs, recorder };
}

async function sync(apply, snapshotPath) {
    if (base.getId() === LIVE_BASE_ID) {
        log("the sync writes the test base and never the live one: run it without AIRTABLE_BASE");
        return finish(1, "refused before reading anything");
    }
    const live = JSON.parse(readFileSync(snapshotPath, "utf8"));
    log(`${relative(process.cwd(), snapshotPath)}: taken ${live.takenAt}, ${live.catalog.length} catalog row(s), ${live.groups.length} group(s), ${live.jobs.length} job(s)\n`);
    const test = await readTest();
    log(`the test base: ${test.catalog.length} catalog row(s), ${test.groups.length} group(s), ${test.jobs.length} job(s)\n`);
    const p = planSync(live, test);

    log(`catalog rows to update: ${p.rowUpdates.length}`);
    for (const { id, before, after, items } of p.rowUpdates) {
        const moved = ROW_FIELDS.filter((field) => before[field] !== after[field]).map((field) => `${field} ${JSON.stringify(before[field])} → ${JSON.stringify(after[field])}`);
        log(`  [ROW]    ${id}  ${moved.join(", ")}  (${items} item(s))`);
    }
    log(`catalog rows to create: ${p.rowCreates.length}`);
    for (const row of p.rowCreates) log(`  [CREATE] ${pathOf(row)}, class ${row.assetClass}`);
    log(`groups to rename: ${p.groupRenames.length}`);
    for (const { id, before, after } of p.groupRenames) log(`  [RENAME] ${id}  ${pair(before)} → ${pair(after)}`);
    log(`groups to create: ${p.groupCreates.length}`);
    for (const group of p.groupCreates) log(`  [GROUP]  ${pair(group)}`);
    log(`groups to remove: ${p.groupRemovals.length}`);
    for (const group of p.groupRemovals) log(`  [REMOVE] ${group.id}  ${pair(group)}`);
    log(`jobs to create: ${p.jobCreates.length}`);
    for (const job of p.jobCreates) log(`  [JOB]    ${job.jobCode}  ${JSON.stringify(job.jobName)}  ${job.businessUnit ?? "no business unit"}`);
    log(`assignments of ${RECORDER_EMAIL} to add: ${p.assignments.length + p.jobCreates.filter((job) => job.recorderAssigned).length}`);
    if (p.problems.length > 0) {
        log("");
        log(`refused — ${p.problems.length} problem(s):`);
        for (const line of p.problems) log(`  ${line}`);
        return finish(1, "refused before writing anything");
    }
    const due = p.rowUpdates.length + p.rowCreates.length + p.groupRenames.length + p.groupCreates.length + p.groupRemovals.length + p.jobCreates.length + p.assignments.length;
    if (due === 0) return verify(live);
    if (!apply) return finish(2, `dry run — ${due} write(s) due, nothing was written`);

    const ledgerPath = join(LEDGERS, `${SCRIPT}-test-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const write = (line) => appendFileSync(ledgerPath, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write({ type: "run", script: SCRIPT, base: "test", snapshot: relative(process.cwd(), snapshotPath) });
    for (const update of p.rowUpdates) write({ type: "row", table: TABLES.ASSET_CATEGORIES, ...update });
    for (const rename of p.groupRenames) write({ type: "rename", table: TABLES.ASSET_CATEGORY_GROUPS, ...rename });
    for (const group of p.groupRemovals) write({ type: "removed", table: TABLES.ASSET_CATEGORY_GROUPS, id: group.id, ...groupOf(group) });
    log(`\nledger: ${relative(process.cwd(), ledgerPath)}  (commit it)`);

    // Groups first, so every row the updates move stands in a group as it lands.
    for (const group of p.groupCreates) {
        const made = await createAssetCategoryGroup(group);
        write({ type: "group", id: made.created?.id ?? made.exists.id, ...group, created: Boolean(made.created) });
    }
    for (const chunk of inChunks(p.groupRenames)) {
        await base(TABLES.ASSET_CATEGORY_GROUPS).update([...chunk.map(({ id, after }) => ({ id, fields: Object.fromEntries(ASSET_GROUP_LEVELS.map((level) => [ASSET_CATEGORY_FIELDS[level], after[level]])) }))]);
    }
    for (const { id, after } of p.rowUpdates) {
        const { discontinued, ...entry } = after;
        const before = test.catalog.find((category) => category.id === id);
        if (ROW_FIELDS.some((field) => field !== "discontinued" && rowOf(before)[field] !== after[field])) {
            const put = await updateAssetCategory(id, entry);
            if (!put.updated) return finish(1, `${id} was not updated — ${put.gone ? "the row is gone" : `${put.exists.id} holds its path`}`);
        }
        if ((before.discontinued === true) !== discontinued) await setAssetCategoryDiscontinued(id, discontinued);
    }
    for (const row of p.rowCreates) {
        const { discontinued, ...entry } = rowOf(row);
        const made = await createAssetCategory(entry);
        if (!made.created) return finish(1, `${pathOf(row)} was on the test base by the time it was written`);
        if (discontinued) await setAssetCategoryDiscontinued(made.created.id, true);
        write({ type: "catalog", id: made.created.id, ...rowOf(row) });
    }
    for (const chunk of inChunks(p.groupRemovals.map((group) => group.id))) await base(TABLES.ASSET_CATEGORY_GROUPS).destroy([...chunk]);

    if (p.jobCreates.length > 0) {
        const people = new Set((await getUsersByRecordIds(p.jobCreates.flatMap((job) => [...job.pic, ...job.manager]))).map((user) => user.id));
        const addresses = new Set((await getAllAddresses()).map((address) => address.id));
        for (const job of p.jobCreates) {
            const made = await createJob({
                jobCode: job.jobCode,
                jobName: job.jobName,
                businessUnit: job.businessUnit ?? undefined,
                picUserId: people.has(job.pic[0]) ? job.pic[0] : null,
                managerUserId: people.has(job.manager[0]) ? job.manager[0] : null,
                deliveryAddressId: addresses.has(job.deliveryAddress[0]) ? job.deliveryAddress[0] : null,
            });
            write({ type: "job", id: made.id, jobCode: job.jobCode, from: job.id });
            if (job.recorderAssigned) p.assignments.push({ jobCode: job.jobCode, id: made.id });
        }
    }
    for (const { jobCode, id } of p.assignments) {
        const added = await addAssignedJob(test.recorder.id, id);
        write({ type: "assigned", user: test.recorder.id, jobCode, job: id, changed: added.changed });
    }
    log("\nreading the test base back:");
    return verify(live);
}

/** Whether the test base holds what the snapshot does: each row by id or path, each group by pair, each job and its assignment. */
async function verify(live) {
    const test = await readTest();
    const failures = [];
    for (const row of live.catalog) {
        const mine = test.catalog.find((category) => category.id === row.id) ?? test.catalog.find((category) => catalogPathKey(category) === catalogPathKey(row));
        if (!mine) failures.push(`${row.id} ${pathOf(row)} is not on the test base`);
        else if (!sameRow(mine, row)) failures.push(`${mine.id} reads ${pathOf(mine)}, the live base ${pathOf(row)}`);
        else if (mine.itemName !== row.itemName) failures.push(`${mine.id} is named ${JSON.stringify(mine.itemName)}, the live base ${JSON.stringify(row.itemName)}`);
    }
    if (test.catalog.length !== live.catalog.length) failures.push(`${test.catalog.length} catalog row(s) on the test base, ${live.catalog.length} on the live one`);
    const pairs = (groups) => groups.map((group) => categoryGroupKey(group)).sort().join("|");
    if (pairs(test.groups) !== pairs(live.groups)) failures.push(`the groups differ: test ${test.groups.map(pair).sort().join(", ")}`);
    for (const job of live.jobs) {
        const mine = test.jobs.find((each) => each.jobCode === job.jobCode);
        if (!mine) failures.push(`${job.jobCode} is not on the test base`);
        else if (mine.jobName !== job.jobName) failures.push(`${job.jobCode} is named ${JSON.stringify(mine.jobName)}`);
        else if (job.recorderAssigned && !test.recorder.assignedJobs.includes(mine.id)) failures.push(`${RECORDER_EMAIL} is not on ${job.jobCode}`);
    }
    log(`  ${test.catalog.length} catalog row(s), ${test.groups.length} group(s); ${live.jobs.map((job) => job.jobCode).join(", ")} on the test base.`);
    if (failures.length > 0) {
        for (const line of failures) log(`  ${line}`);
        return finish(1, "the test base does not hold what the snapshot does");
    }
    return finish(0, "the test base's catalog, groups and the list's jobs are the live base's as the snapshot read them");
}

async function main() {
    log(`${SCRIPT}${process.argv.includes("--snapshot") ? "  (SNAPSHOT)" : process.argv.includes("--apply") ? "" : "  (DRY RUN — nothing is written; --apply writes)"}`);
    log(`reaching the ${describeAirtableBase(resolveAirtableBase())}\n`);
    if (process.argv.includes("--snapshot")) return takeSnapshot();
    const at = process.argv.indexOf("--from");
    if (at === -1 || !process.argv[at + 1]) {
        log("the sync takes --from <snapshot.json>, written by --snapshot on the live base");
        return 1;
    }
    return sync(process.argv.includes("--apply"), process.argv[at + 1]);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.stack ?? error.message}`);
        process.exit(1);
    }
);
