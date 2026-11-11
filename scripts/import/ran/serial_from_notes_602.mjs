// The serial numbers site managers wrote into items' notes, moved into `Assets."Serial Number"` (#602):
// each item's note gives its number, keeps what is left, and a ledger says what was written so a
// revert can take it back — on the test base. ON THE LIVE BASE IT CAN NO LONGER BE TAKEN BACK (#621):
// its run there is a record.
//
// WHY. Until #601 an item had nowhere to keep its serial number but its note, so the numbers recorded
// so far stand there, each in the form its site manager chose. `Serial Number` is where the app reads,
// searches and exports one since #601, and where it keeps one item's within its kind.
//
// ONE RULE, NO LIST (`../serial_from_notes_602_plan.mjs`). Every item not deleted whose note holds a
// number takes it, a retired one included, and a note named by `--skip-note`, whole, is left as it
// is — the values to skip are this run's arguments and are written nowhere in this repository. An item
// already holding another number is left, and so is a number two items of one kind would hold.
//
// A PREVIEW FIRST, AND ONLY READ WITHOUT `--apply`. A preview reads every row of `Assets` — its printed
// id, status, kind, note and serial number — and the part numbers of `Asset Categories`, and prints
// counts alone: the rows to write, those whose note is cleared and those whose note keeps something,
// those left and why, those marked as numbers to look at again, those skipped and the notes holding no
// number; then the printed ids of the rows left, skipped or marked, and no note and no number. Every
// row, with its note and number before and after, goes to a preview file in `private/`.
// `--apply <preview>` reads the base again and writes nothing unless its plan is the preview's, row
// for row (`planDigest`).
//
// A LEDGER, KEPT OFF THE REPOSITORY. The notes and the numbers are the site's, and this repository is
// public, so the preview and the ledger go to `scripts/import/private/serial_from_notes_602/`, which
// `.gitignore` keeps out, and Soo keeps a copy of each off this machine; what the notes record is each
// file's name and SHA-256, which the run prints. `--apply` writes each row's line — its record id,
// printed id, the fields as read and as written — before the request carrying it leaves, ten rows to
// a request, four requests a second, then reads every row back.
//
// `--revert <ledger>` TAKES BACK WHAT ONE LEDGER WROTE, AND NOTHING ELSE: each row whose every field
// the ledger wrote still holds what it wrote is given back what it held before; a row changed since,
// or gone, is left and named. A revert writes its own ledger the same way, and reads every row back.
// On the test base alone since #621.
//
// FENCED AT THE FUNNEL, AND REFUSED THERE ON THE LIVE BASE SINCE #621. `Assets` is the site's there
// (#531): every request the SDK sends is asked of `scripts/protectedTables.mjs:refusesBeyondLedger` as
// it leaves. Until #621 that let this script read `Assets` and update `Serial Number` and `Note` alone,
// on the rows this run's own reads answered with — gathered at the funnel as each answer arrives
// (`collectingReads`) — to exactly the values the plan or the ledger put in the fence, which is how the
// live run of 2026-11-04 went. Once the site had used the numbers, Soo settled that the move would not
// be taken back and #621 ended the exception: on the live base the fence now refuses every request this
// script sends, a read, the move and a revert alike, so its live ledger is a record of what was written
// and no longer a way back. On the test base it runs as before.
//
// Usage (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/serial_from_notes_602.mjs --skip-note <note> ...            (preview)
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/serial_from_notes_602.mjs --skip-note <note> ... --apply <preview.json>
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/import/ran/serial_from_notes_602.mjs --revert <ledger.jsonl> [--apply]
//   AIRTABLE_BASE=live ...   (refused before its first request to Assets since #621)
//
// Airtable PAT scopes: data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 nothing left to write — every row written and read
// back, or in a revert nothing the ledger wrote left to restore; 1 something failed or was refused;
// 2 nothing failed and writes are due (a preview).

import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { TABLES, base } from "../../../lib/airtable/client.js";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { snapshot } from "../../../lib/airtableOps.js";
import { refusesBeyondLedger } from "../../protectedTables.mjs";
import { FIELDS, SCRIPT, collectingReads, inBatches, moveLine, notAsWritten, planCounts, planDigest, planMove, planRevert } from "../serial_from_notes_602_plan.mjs";

const PRIVATE = join(dirname(fileURLToPath(import.meta.url)), "..", "private", SCRIPT);

/** The gap held between the starts of two requests: four a second, under Airtable's five. */
const REQUEST_GAP_MS = 250;

/** The fields a row is read by. */
const READ_FIELDS = ["Asset ID", "Status", "Category", FIELDS.note, FIELDS.serialNumber];

function log(message = "") {
    console.log(message);
}

/**
 * What `refusesBeyondLedger` let this run update on the live base until #621: `read`, the rows its
 * reads of `Assets` answered with, gathered at the funnel; `writes`, each row's fields as the plan or
 * the ledger has them, both empty until a read and a step filled them. The guard reads neither since,
 * refusing every request of this script's there.
 */
const ledgerFence = { read: new Set(), writes: new Map() };

/**
 * The SDK's one funnel — the `runAction` `lib/airtableOps.js` counts on — fenced and paced, as
 * `fill_owner_job_598.mjs` fences it: each request is asked of `refusesBeyondLedger` as it leaves, one
 * it refuses is answered with an error and never sent, and each starts `gapMs` after the one before.
 * The answer to a read of `Assets` adds its rows to the fence's `read` before the caller sees it.
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
        const answered = collectingReads(request, callback, { table: TABLES.ASSETS, into: ledgerFence.read });
        const now = Date.now();
        const at = Math.max(now, next);
        next = at + gapMs;
        setTimeout(() => inner.call(instance, method, path, queryParams, body, answered), at - now);
    };
    instance.runAction = fenced;
    baseFunctor.runAction = fenced;
}

function finish(code, verdict) {
    log("");
    log(`${snapshot().total} Airtable operation(s). ${verdict}.`);
    return code;
}

/** A file's SHA-256, so the copy kept off this machine can be told to be the one written. */
function digestOf(path) {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** A file in `private/`, named for the run, its kind and the moment. */
function privatePath(kind, extension) {
    mkdirSync(PRIVATE, { recursive: true });
    return join(PRIVATE, `${SCRIPT}-${kind}-${new Date().toISOString().replace(/[:.]/g, "-")}.${extension}`);
}

/** A ledger that writes as the run goes, each line on disk before the request it describes. */
function openLedger(kind, first) {
    const path = privatePath(kind, "jsonl");
    const write = (line) => appendFileSync(path, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write(first);
    return { path, write };
}

/** Every row of `Assets`, `{ id, assetId, status, category, note, serialNumber }`. */
async function readAssets() {
    const records = await base(TABLES.ASSETS).select({ fields: READ_FIELDS }).all();
    return records.map((record) => ({
        id: record.id,
        assetId: record.get("Asset ID") ?? "",
        status: record.get("Status") ?? null,
        category: record.get("Category") ?? [],
        note: record.get(FIELDS.note) ?? null,
        serialNumber: record.get(FIELDS.serialNumber) ?? null,
    }));
}

/** Each kind's part numbers, by its record id. */
async function readPartNumbers() {
    const records = await base(TABLES.ASSET_CATEGORIES).select({ fields: ["Part Number"] }).all();
    const byKind = new Map(records.map((record) => [record.id, [record.get("Part Number") ?? ""].filter((part) => part !== "")]));
    return (kind) => byKind.get(kind) ?? [];
}

/** Write `updates`, each `{ id, fields, line }`, ten to a request, each batch's lines on disk first. */
async function writeRows(updates, ledger) {
    let written = 0;
    for (const batch of inBatches(updates)) {
        for (const update of batch) ledger.write(update.line);
        await base(TABLES.ASSETS).update(batch.map((update) => ({ id: update.id, fields: update.fields })));
        written += batch.length;
        log(`  wrote ${written} of ${updates.length}`);
    }
    return written;
}

/** The counts, and the printed ids of the rows left, skipped or marked — no note and no number. */
function printPlan(plan, rowsRead) {
    const counts = planCounts(plan);
    const tally = (counted) => Object.entries(counted).map(([key, n]) => `${key} ${n}`).join(", ") || "none";
    log(`${rowsRead} asset row(s) read.`);
    log("");
    log(`rows to write:                 ${counts.writes}   (a serial number on ${counts.serialWritten}, the note alone on ${counts.writes - counts.serialWritten})`);
    log(`  whose note is cleared:       ${counts.noteCleared}`);
    log(`  whose note keeps something:  ${counts.noteKept}`);
    log(`rows not written:              ${counts.held}   (${tally(counts.heldWhy)})`);
    log(`rows written and marked:       ${counts.marked}   (${tally(counts.marks)})`);
    log(`notes skipped by argument:     ${counts.skipped}`);
    log(`notes holding no number:       ${counts.unfound}`);
    for (const each of plan.held) log(`  [LEFT] ${each.assetId} — ${each.why}${each.holder ? `, held by ${each.holder}` : ""}`);
    for (const each of plan.moves.filter((move) => move.marks.length > 0)) log(`  [MARKED] ${each.assetId} — ${each.marks.join(", ")}`);
    for (const each of plan.skipped) log(`  [SKIPPED] ${each.assetId}`);
    for (const each of plan.unfound) log(`  [NO NUMBER] ${each.assetId}`);
    for (const note of plan.unmatched) log(`  [UNMATCHED] a --skip-note no note holds (${note.length} character(s))`);
    return counts;
}

async function move({ apply, previewPath, baseName, skipNotes }) {
    const partNumbersOf = await readPartNumbers();
    const rows = await readAssets();
    const plan = planMove(rows, { skipNotes, partNumbersOf });
    const counts = printPlan(plan, rows.length);

    if (!apply) {
        const path = privatePath(`preview-${baseName}`, "json");
        writeFileSync(path, `${JSON.stringify({ script: SCRIPT, base: baseName, at: new Date().toISOString(), skipNotes, counts, digest: planDigest(plan), ...plan }, null, 1)}\n`, "utf8");
        log("");
        log(`preview: ${relative(process.cwd(), path)}`);
        log(`  sha256 ${digestOf(path)}`);
        if (plan.unmatched.length > 0) return finish(1, "a --skip-note matches no note");
        if (plan.moves.length === 0) return finish(0, "nothing to write");
        return finish(2, `preview — ${plan.moves.length} row(s) to write`);
    }

    const preview = JSON.parse(readFileSync(previewPath, "utf8"));
    if (preview.script !== SCRIPT || preview.base !== baseName) return finish(1, `${previewPath} is not a preview of ${SCRIPT} on this base`);
    if (plan.unmatched.length > 0) return finish(1, "a --skip-note matches no note");
    if (preview.digest !== planDigest(plan)) return finish(1, "the base no longer reads as the preview did, so nothing was written; preview again");
    if (plan.moves.length === 0) return finish(0, "nothing to write");

    for (const each of plan.moves) ledgerFence.writes.set(each.id, each.fields);
    const ledger = openLedger(baseName, { type: "run", script: SCRIPT, base: baseName, preview: relative(process.cwd(), previewPath), rows: plan.moves.length });
    log("");
    log(`ledger: ${relative(process.cwd(), ledger.path)}`);
    await writeRows(
        plan.moves.map((each) => ({ id: each.id, fields: each.fields, line: moveLine(each) })),
        ledger
    );

    const lines = readLedgerLines(ledger.path);
    const after = await readAssets();
    const wrong = notAsWritten(lines, after);
    log(`  sha256 ${digestOf(ledger.path)}`);
    if (wrong.length > 0) return finish(1, `${wrong.length} row(s) did not read back as written: ${wrong.join(", ")}`);
    const left = planMove(after, { skipNotes, partNumbersOf });
    return finish(0, `${plan.moves.length} row(s) written and read back; ${left.moves.length} left to write, ${left.held.length} left as they are`);
}

function readLedgerLines(path) {
    return readFileSync(path, "utf8")
        .split("\n")
        .filter((text) => text.trim() !== "")
        .map((text) => JSON.parse(text));
}

async function revert({ apply, baseName, ledgerPath }) {
    const lines = readLedgerLines(ledgerPath);
    if (lines[0]?.script !== SCRIPT || lines[0]?.base !== baseName || lines[0]?.type !== "run") return finish(1, `${ledgerPath} is not a ledger of ${SCRIPT}'s on this base`);
    const rows = await readAssets();
    const { restores, held } = planRevert(lines, rows);
    log(`the ledger wrote ${lines.filter((line) => line.type === "move").length} row(s); ${restores.length} to restore, ${held.length} left.`);
    for (const each of held) log(`  [LEFT] ${each.assetId || each.id} — ${each.why}`);
    if (restores.length === 0) return finish(0, "nothing to restore");
    if (!apply) return finish(2, `dry run — ${restores.length} row(s) to restore`);

    for (const each of restores) ledgerFence.writes.set(each.id, each.fields);
    const ledger = openLedger(`revert-${baseName}`, { type: "revert", script: SCRIPT, base: baseName, of: relative(process.cwd(), ledgerPath), rows: restores.length });
    log(`ledger: ${relative(process.cwd(), ledger.path)}`);
    await writeRows(
        restores.map((each) => ({ id: each.id, fields: each.fields, line: each.line })),
        ledger
    );
    const wrong = notAsWritten(readLedgerLines(ledger.path), await readAssets());
    log(`  sha256 ${digestOf(ledger.path)}`);
    if (wrong.length > 0) return finish(1, `${wrong.length} row(s) did not read back as restored: ${wrong.join(", ")}`);
    return finish(0, `${restores.length} row(s) restored and read back`);
}

/** The values following each `flag` in `args`, and whether one was missing. */
function valuesOf(args, flag) {
    const values = [];
    for (let at = args.indexOf(flag); at !== -1; at = args.indexOf(flag, at + 1)) values.push(args[at + 1]);
    return values;
}

async function main() {
    const args = process.argv.slice(2);
    const skipNotes = valuesOf(args, "--skip-note");
    const [ledgerPath] = valuesOf(args, "--revert");
    const at = args.indexOf("--apply");
    const apply = at !== -1;
    const previewPath = apply && !args[at + 1]?.startsWith("--") ? args[at + 1] : undefined;
    if (skipNotes.some((note) => !note || note.startsWith("--") || note.trim() === "")) {
        log("--skip-note takes a note");
        return 1;
    }
    if (args.includes("--revert") && !ledgerPath) {
        log("--revert takes a ledger's path");
        return 1;
    }
    if (apply && !ledgerPath && !previewPath) {
        log("--apply takes the preview it writes");
        return 1;
    }
    const airtable = resolveAirtableBase();
    const baseName = airtable.live ? "live" : "test";
    log("=".repeat(72));
    log(`Serial numbers out of assets' notes (#602) — ${ledgerPath ? "revert" : "move"}`);
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [PREVIEW — nothing is written]"}`);
    log("=".repeat(72));

    fenceRequests(base, REQUEST_GAP_MS);
    if (ledgerPath) return revert({ apply, baseName, ledgerPath });
    return move({ apply, previewPath, baseName, skipNotes });
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
