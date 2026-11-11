// `Assets."Owner Job"` for the assets that stood before #598: each takes the job it stands on now,
// since nothing had lent one, and a ledger says what was written so a revert can take it back — on
// the test base. ON THE LIVE BASE IT CAN NO LONGER BE TAKEN BACK (#621): its run there is a record.
//
// WHY. From #598 an asset belongs to the job it was registered on, `Owner Job`, and stands on
// `Job`, which a loan moves; the registration writes both. An asset registered before then has no
// owner job, so it could not be lent, its list could not count it as its own once lent, and a
// retirement would have no owner to take it back to. Every such asset is on the job it was
// registered on or one a check-out or a check-in moved it to before #597 — and either way the site
// holding it now is the one that owns it, which is Soo's answer.
//
// READ FIRST, AND ONLY READ WITHOUT `--apply`. A dry run reads every row of `Assets` — its printed
// id, status, `Job` and `Owner Job`, a hundred to a request — and prints what a fill would write by
// job and status, every row it would write, and every row it leaves with why: one already naming
// an owner job, one on no job or on several (`fill_owner_job_598_plan.mjs:planFill`). On a base
// where `Owner Job` is not made yet (`add_owner_job_598.mjs`), it reads the rest and counts every
// row as one to fill, and `--apply` stops.
//
// A LEDGER, COMMITTED. `--apply` opens `ledgers/fill_owner_job_598-{base}-{time}.jsonl` and writes
// each row's line — its record id, printed id, `[]` before and the job after — before the request
// carrying it leaves, ten rows to a request, four requests a second. A re-run writes only rows still
// empty, so a run stopped part way is finished by running it again.
//
// `--revert <ledger>` TAKES BACK WHAT ONE LEDGER WROTE, AND NOTHING ELSE: each row it filled that
// still holds the one job it wrote is given `[]`; a row since given another owner job, or gone, is
// left and named. A revert writes its own ledger the same way. On the test base alone since #621.
//
// FENCED AT THE FUNNEL, AND REFUSED THERE ON THE LIVE BASE SINCE #621. `Assets` is the site's there
// (#531): every request the SDK sends is asked of `scripts/protectedTables.mjs:refusesBeyondLedger` as
// it leaves. Until #621 that let this script read `Assets` and update `Owner Job` alone — on the rows
// this run read with none, to the job it read each on, or in a revert to `[]` on the rows its ledger
// filled — which is how the live run of 2026-11-03 went. Once the site had used the owner jobs, Soo
// settled that the fill would not be taken back and #621 ended the exception: on the live base the
// fence now refuses every request this script sends, a read, the fill and a revert alike, so its live
// ledger is a record of what was written and no longer a way back. On the test base it runs as before.
//
// Usage (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/fill_owner_job_598.mjs            (dry run)
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/fill_owner_job_598.mjs --apply
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/fill_owner_job_598.mjs --revert <ledger.jsonl> [--apply]
//   AIRTABLE_BASE=live ...   (refused before its first request to Assets since #621)
//
// Airtable PAT scopes: data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 nothing left to write — every row filled, or in a
// revert nothing the ledger wrote left to clear; 1 something failed or was refused; 2 nothing failed
// and writes are due (a dry run), or the field is not on the base yet.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLES, base } from "../../../lib/airtable/client.js";
import { getAllJobs } from "../../../lib/airtable/jobs.js";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { snapshot } from "../../../lib/airtableOps.js";
import { OWNER_JOB_FIELD, refusesBeyondLedger } from "../../protectedTables.mjs";
import { SCRIPT, fillLine, fillsByJob, inBatches, planFill, planRevert } from "../fill_owner_job_598_plan.mjs";

const LEDGERS = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** The gap held between the starts of two requests: four a second, under Airtable's five. */
const REQUEST_GAP_MS = 250;

/** The fields a row is read by. */
const READ_FIELDS = ["Asset ID", "Status", "Job", OWNER_JOB_FIELD.name];

function log(message = "") {
    console.log(message);
}

/**
 * What `refusesBeyondLedger` let this run update on the live base until #621: `fills`, the rows the
 * plan fills and the job each takes, and in a revert `clears`, the rows it clears, empty until a step
 * filled it. The guard reads none of it since, refusing every request of this script's there.
 */
const ledgerFence = { fills: new Map(), clears: new Set() };

/**
 * The SDK's one funnel — the `runAction` `lib/airtableOps.js` counts on — fenced and paced, as
 * `import_site_assets_544.mjs` fences it: each request is asked of `refusesBeyondLedger` as it
 * leaves, one it refuses is answered with an error and never sent, and each starts `gapMs` after
 * the one before.
 */
function fenceRequests(baseFunctor, gapMs) {
    const instance = baseFunctor._base;
    const inner = instance.runAction;
    let next = 0;
    const fenced = function (method, path, queryParams, body, callback) {
        const request = { method, path, queryParams, body };
        if (refusesBeyondLedger({ script: SCRIPT, baseId: baseFunctor.getId(), request, allowed: ledgerFence, log })) {
            setTimeout(() => callback(new Error(`refused before sending: ${String(method).toUpperCase()} ${path}`)), 0);
            return;
        }
        const now = Date.now();
        const at = Math.max(now, next);
        next = at + gapMs;
        setTimeout(() => inner.call(instance, method, path, queryParams, body, callback), at - now);
    };
    instance.runAction = fenced;
    baseFunctor.runAction = fenced;
}

function finish(code, verdict) {
    log("");
    log(`${snapshot().total} Airtable operation(s). ${verdict}.`);
    return code;
}

/** A ledger that writes as the run goes, each line on disk before the request it describes. */
function openLedger(kind, first) {
    const path = join(LEDGERS, `${SCRIPT}-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const write = (line) => appendFileSync(path, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write(first);
    return { path, write };
}

/** Every row of `Assets`, `{ id, assetId, status, job, ownerJob }`, and whether `Owner Job` is on the base. */
async function readAssets() {
    const toRow = (record, owned) => ({
        id: record.id,
        assetId: record.get("Asset ID") ?? "",
        status: record.get("Status") ?? null,
        job: record.get("Job") ?? [],
        ownerJob: owned ? (record.get(OWNER_JOB_FIELD.name) ?? []) : [],
    });
    try {
        const records = await base(TABLES.ASSETS).select({ fields: READ_FIELDS }).all();
        return { fieldMade: true, rows: records.map((record) => toRow(record, true)) };
    } catch (error) {
        if (!String(error?.error ?? error?.message ?? "").includes("UNKNOWN_FIELD_NAME") && error?.statusCode !== 422) throw error;
        const records = await base(TABLES.ASSETS).select({ fields: READ_FIELDS.filter((field) => field !== OWNER_JOB_FIELD.name) }).all();
        return { fieldMade: false, rows: records.map((record) => toRow(record, false)) };
    }
}

/** Write `updates`, each `{ id, value, line }`, ten to a request, each batch's lines on disk first. */
async function writeOwnerJobs(updates, ledger) {
    let written = 0;
    for (const batch of inBatches(updates)) {
        for (const update of batch) ledger.write(update.line);
        await base(TABLES.ASSETS).update(batch.map((update) => ({ id: update.id, fields: { [OWNER_JOB_FIELD.name]: update.value } })));
        written += batch.length;
        log(`  wrote ${written} of ${updates.length}`);
    }
    return written;
}

async function fill({ apply, baseName, codeOf }) {
    const read = await readAssets();
    const { fills, held } = planFill(read.rows);
    log(`${read.rows.length} asset row(s) read${read.fieldMade ? "" : ` — ${OWNER_JOB_FIELD.name} is not on this base yet, so every row reads as having none`}.`);
    log("");
    log(`to fill: ${fills.length}`);
    for (const { jobId, count } of fillsByJob(fills)) {
        const statuses = new Map();
        for (const each of fills.filter((f) => f.jobId === jobId)) statuses.set(each.status ?? "(no status)", (statuses.get(each.status ?? "(no status)") ?? 0) + 1);
        log(`  ${codeOf(jobId).padEnd(12)} ${String(count).padStart(4)}   ${[...statuses].map(([status, n]) => `${status} ${n}`).join(", ")}`);
    }
    log("");
    log(`left as they are: ${held.length}`);
    const whys = new Map();
    for (const each of held) whys.set(each.why, (whys.get(each.why) ?? 0) + 1);
    for (const [why, n] of whys) log(`  ${why}: ${n}`);
    for (const each of held.filter((h) => h.why !== "owned")) log(`  [LEFT] ${each.assetId || each.id} — ${each.why}`);
    log("");
    log("every row to fill:");
    for (const each of fills) log(`  [FILL] ${each.assetId.padEnd(20)} ${each.id}  ${String(each.status ?? "").padEnd(10)} → ${codeOf(each.jobId)} (${each.jobId})`);

    if (fills.length === 0) return finish(0, "nothing to fill");
    if (!apply) return finish(2, `dry run — ${fills.length} row(s) to fill`);
    if (!read.fieldMade) return finish(2, `${OWNER_JOB_FIELD.name} is not on this base yet: run scripts/import/ran/add_owner_job_598.mjs first`);

    for (const each of fills) ledgerFence.fills.set(each.id, each.jobId);
    const ledger = openLedger(baseName, { type: "run", script: SCRIPT, base: baseName, rows: fills.length });
    log("");
    log(`ledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);
    await writeOwnerJobs(
        fills.map((each) => ({ id: each.id, value: [each.jobId], line: fillLine(each) })),
        ledger
    );

    const after = planFill((await readAssets()).rows);
    const wrong = fills.filter((each) => !after.held.some((h) => h.id === each.id && h.why === "owned" && h.ownerJob?.[0] === each.jobId));
    if (wrong.length > 0) return finish(1, `${wrong.length} row(s) did not read back with the job written`);
    return finish(0, `${fills.length} row(s) filled and read back; ${after.fills.length} left to fill`);
}

async function revert({ apply, baseName, ledgerPath }) {
    const lines = readFileSync(ledgerPath, "utf8").split("\n").filter((text) => text.trim() !== "").map((text) => JSON.parse(text));
    if (lines[0]?.script !== SCRIPT || lines[0]?.base !== baseName) return finish(1, `${ledgerPath} is not a ledger of ${SCRIPT} on this base`);
    const read = await readAssets();
    const { clears, held } = planRevert(lines, read.rows);
    log(`the ledger filled ${lines.filter((l) => l.type === "fill").length} row(s); ${clears.length} to clear, ${held.length} left.`);
    for (const each of held) log(`  [LEFT] ${each.assetId || each.id} — ${each.why}`);
    for (const each of clears) log(`  [CLEAR] ${each.assetId} ${each.id}`);
    if (clears.length === 0) return finish(0, "nothing to clear");
    if (!apply) return finish(2, `dry run — ${clears.length} row(s) to clear`);

    for (const each of clears) ledgerFence.clears.add(each.id);
    const ledger = openLedger(`revert-${baseName}`, { type: "revert", script: SCRIPT, base: baseName, of: relative(process.cwd(), ledgerPath) });
    log(`ledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);
    const byId = new Map(lines.filter((l) => l.type === "fill").map((l) => [l.id, l]));
    await writeOwnerJobs(
        clears.map((each) => ({ id: each.id, value: [], line: { type: "clear", id: each.id, assetId: each.assetId, before: byId.get(each.id).after, after: [] } })),
        ledger
    );
    const left = planRevert(lines, (await readAssets()).rows);
    if (left.clears.length > 0) return finish(1, `${left.clears.length} row(s) still hold what the ledger wrote`);
    return finish(0, `${clears.length} row(s) cleared and read back`);
}

async function main() {
    const args = process.argv.slice(2);
    const apply = args.includes("--apply");
    const at = args.indexOf("--revert");
    const ledgerPath = at === -1 ? null : args[at + 1];
    if (at !== -1 && !ledgerPath) {
        log("--revert takes a ledger's path");
        return 1;
    }
    const airtable = resolveAirtableBase();
    const baseName = airtable.live ? "live" : "test";
    log("=".repeat(72));
    log(`Assets."${OWNER_JOB_FIELD.name}" for the assets standing before #598 — ${ledgerPath ? "revert" : "fill"}`);
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    fenceRequests(base, REQUEST_GAP_MS);
    if (ledgerPath) return revert({ apply, baseName, ledgerPath });
    const jobs = await getAllJobs();
    const codeOf = (id) => jobs.find((job) => job.id === id)?.jobCode ?? "(unknown job)";
    return fill({ apply, baseName, codeOf });
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
