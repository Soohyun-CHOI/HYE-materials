// Removes the demo data from a base (issue #537), and puts it back from its ledger.
//
// WHAT GOES. The demo's jobs, vendors and accounts, and everything filed under them — the documents
// of the materials flow, their rows, the materials and prices they made, the addresses only they
// use and the demo mailboxes' sign-in rows. Which rows those are is `remove_demo_data_537_plan.mjs`'s
// judgment, read off the base the run reaches; its header has the rules and why each holds. The
// live base keeps only the site's records once it has run there, and the test base keeps the demo
// for checking changes, so a run there is a rehearsal its own revert undoes.
//
// THIS IS THE ISSUE'S REMOVAL, NOT TIDYING-UP. Records are not removed as tidying-up (CLAUDE.md);
// these go because #537 says the live base holds real records alone, and Soo approved the list a
// dry run prints before any run removed a row.
//
// IT REFUSES BEFORE IT WRITES, the dry run included, when the base has a table or a link pair the
// plan has not classified, and when a kept row's own link names a row the run would remove — a real
// user assigned to a demo job, a real document on a demo vendor. Each is named; Soo settles it by
// hand and the run goes again. A kept row a removal only empties of a mirror is printed and is no
// reason to stop.
//
// IT WRITES NEITHER TABLE THE SITE'S RECORDS ARE IN (#531). `Assets` and `Asset Log`, and the
// catalogs, are read for what links into the demo and never written: `refusesProtectedWrite` is
// asked of every table a removal or a revert would write, and the one funnel every request leaves
// through refuses a write to a table the run did not plan, before it is sent.
//
// THE LEDGER IS WRITTEN WHOLE BEFORE THE FIRST DELETE, AND IS COMMITTED (docs/notes/verification.md):
// every row about to go, each field as the API returned it, and each attached file's bytes —
// Airtable's own attachment addresses die at a wall-clock instant, so the ledger keeps a file's
// name, size and type and its contents, and no address (CLAUDE.md, File uploads). Then the rows go
// in `REMOVE_ORDER`, ten to a batch delete, which refuses an id of another table. A run that stops
// part way leaves rows a second run finds and removes, with a ledger of its own.
//
// `--revert <ledger>` MAKES THE ROWS AGAIN, parents first, under new record ids: every value a
// person or the app wrote, each owned link through the ids the revert minted or to the kept row it
// named, the links to rows made later written once all are back, and each file uploaded to its row
// through Airtable's own upload endpoint, so nothing passes through the Blob store. It refuses
// before writing when a ledger row's name is on the base already or an owned link names a row on
// neither. It keeps a ledger of its own — each row's old id and new — and then reads every row
// back and compares it with its ledger line, formulas, rollups and mirrors included. What Airtable
// stamps — `Users."Created At"` — takes the revert's time, and the run says so.
//
// IT TALKS TO THE REST API DIRECTLY, as the catalog's scripts do, and paces its requests a quarter
// of a second apart; lib/airtableOps.js cannot see them, so it counts its own.
//
// Usage (from the repo root). Dry run is the DEFAULT, for a removal and for a revert:
//   node --env-file=.env.local scripts/import/ran/remove_demo_data_537.mjs
//   node --env-file=.env.local scripts/import/ran/remove_demo_data_537.mjs --apply
//   node --env-file=.env.local scripts/import/ran/remove_demo_data_537.mjs --revert <ledger.jsonl> [--apply]
// The live base is named per command, after Soo has approved its dry run (#534):
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/remove_demo_data_537.mjs
//
// No loader flag: this file and its plan import only built-ins and files whose extension they spell.
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 nothing of the demo is on the base (reverting,
// every row is back and reads as its ledger line); 1 something failed or was refused; 2 nothing
// failed but something is still to do — what a dry run would write.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { refusesProtectedWrite } from "../../protectedTables.mjs";
import {
    REMOVE_ORDER,
    SCRIPT,
    attachmentFields,
    inChunks,
    nameOf,
    planRemoval,
    planRevert,
    readLedger,
    remapIds,
    rowDifferences,
    schemaProblems,
    stampedFields,
    withoutFileAddresses,
} from "../remove_demo_data_537_plan.mjs";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;
const CONTENT_ROOT = "https://content.airtable.com/v0";
const LEDGERS = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** The gap held between the starts of two requests: four a second, under Airtable's five. */
const REQUEST_GAP_MS = 250;

const RECORD_WRITE = /^https:\/\/api\.airtable\.com\/v0\/(app[A-Za-z0-9]+)\/(tbl[A-Za-z0-9]+)(?:\?|$)/;
const FILE_WRITE = /^https:\/\/content\.airtable\.com\/v0\/(app[A-Za-z0-9]+)\/(rec[A-Za-z0-9]+)\/(fld[A-Za-z0-9]+)\/uploadAttachment$/;

class Airtable {
    constructor(token, baseId) {
        this.baseId = baseId;
        this.token = token;
        this.calls = 0;
        this.next = 0;
        /** The tables a write may reach, and the rows a file may be uploaded to — none until a run plans them. */
        this.writable = new Set();
        this.uploadable = new Set();
    }

    /** The one funnel: paced, counted, and a write it was not told of refused before it leaves. */
    async request(method, url, body) {
        if (method !== "GET") {
            const row = url.match(RECORD_WRITE);
            const file = url.match(FILE_WRITE);
            const planned = (row && row[1] === this.baseId && this.writable.has(row[2])) || (file && file[1] === this.baseId && this.uploadable.has(file[2]));
            if (!planned) throw new Error(`refused before sending: ${method} ${url.replace(this.baseId, "{base}")} is no write this run planned`);
        }
        const wait = this.next - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        this.next = Date.now() + REQUEST_GAP_MS;
        this.calls++;
        const response = await fetch(url, {
            method,
            headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        return text === "" ? null : JSON.parse(text);
    }

    async tables() {
        const { tables } = await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`);
        return tables;
    }

    /** Every row of a table, every field. */
    async listRecords(tableId) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100" });
            if (offset) params.set("offset", offset);
            const page = await this.request("GET", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
            out.push(...page.records);
            offset = page.offset;
        } while (offset);
        return out;
    }

    /** The batch form, which refuses an id that is not this table's. */
    async deleteRecords(tableId, ids) {
        const params = new URLSearchParams();
        for (const id of ids) params.append("records[]", id);
        const { records } = await this.request("DELETE", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
        const gone = records.filter((record) => record.deleted).map((record) => record.id);
        if (gone.length !== ids.length) throw new Error(`asked to delete ${ids.join(", ")} and ${gone.join(", ") || "none"} went`);
    }

    /** No `typecast`: a value a select does not hold is refused rather than coined. */
    async createRecords(tableId, records) {
        const { records: made } = await this.request("POST", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
        return made;
    }

    updateRecords(tableId, records) {
        return this.request("PATCH", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }

    /** One file, by its bytes, appended to a row's attachment field. */
    uploadAttachment(recordId, fieldId, { filename, type, base64 }) {
        return this.request("POST", `${CONTENT_ROOT}/${this.baseId}/${recordId}/${fieldId}/uploadAttachment`, { contentType: type, file: base64, filename });
    }

    /** An attached file's bytes, off the address the read handed back; not a request to the API. */
    async download(url) {
        this.calls++;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`a file read -> ${response.status}`);
        return Buffer.from(await response.arrayBuffer());
    }
}

function log(message = "") {
    console.log(message);
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} request(s). ${verdict}.`);
    return code;
}

/** A ledger, opened with its first line: each later line is appended as it happens. */
function openLedger(name, first) {
    const path = join(LEDGERS, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    const write = (line) => appendFileSync(path, `${JSON.stringify({ ...line, at: new Date().toISOString() })}\n`, "utf8");
    write(first);
    return { path, write };
}

/** Every table's rows, by table name, and the tables by name. */
async function readBase(air) {
    const tables = await air.tables();
    const rows = {};
    for (const table of tables) rows[table.name] = await air.listRecords(table.id);
    return { tables, byName: new Map(tables.map((t) => [t.name, t])), rows };
}

/** Names as a reader checks them: sorted, a name standing for several rows counted once. */
function names(table, records) {
    const counts = new Map();
    for (const record of records) counts.set(nameOf(table, record), (counts.get(nameOf(table, record)) ?? 0) + 1);
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => (n > 1 ? `${name} (${n})` : name)).join(", ");
}

/** The removal as a reader checks it: per table, what goes and why, then what points at it. */
function printPlan(base, plan) {
    log("table                     rows  remove  keep");
    for (const table of base.tables) {
        const all = base.rows[table.name].length;
        const gone = plan.remove.get(table.name)?.length ?? 0;
        log(`  ${table.name.padEnd(24)}${String(all).padStart(5)}${String(gone).padStart(8)}${String(all - gone).padStart(6)}`);
    }
    for (const name of REMOVE_ORDER) {
        const records = plan.remove.get(name);
        if (!records || records.length === 0) continue;
        const table = base.byName.get(name);
        const reasons = [...new Set(records.map((r) => plan.why.get(r.id)))];
        log(`\n${name} — ${records.length}, ${reasons.join("; ")}:`);
        log(`  ${names(table, records)}`);
    }
    if (plan.mirrored.size > 0) {
        log("\nkept rows a removal empties of a mirror only — nothing of their own is lost:");
        for (const [field, { rows, links }] of plan.mirrored) log(`  ${field}: ${rows} row(s), ${links} link(s)`);
    }
}

function printBlocking(base, plan) {
    log(`\nREFUSED: ${plan.blocking.length} kept row(s) name a row this would remove in a link of their own — settle each first:`);
    for (const { table, id, field, ids } of plan.blocking) {
        const name = (otherId) => {
            for (const t of base.tables) {
                const r = base.rows[t.name].find((x) => x.id === otherId);
                if (r) return `${t.name} ${nameOf(t, r)}`;
            }
            return otherId;
        };
        const self = base.rows[table].find((r) => r.id === id);
        log(`  ${table} ${nameOf(base.byName.get(table), self)} — ${field} → ${ids.map(name).join(", ")}`);
    }
}

/** A row as the ledger keeps it: no attachment address, and each file's bytes beside it. */
async function ledgerLine(air, table, record, why) {
    const fields = Object.fromEntries(Object.entries(record.fields).map(([name, value]) => [name, withoutFileAddresses(value)]));
    const files = {};
    for (const f of attachmentFields(table)) {
        const attached = record.fields[f.name];
        if (!attached) continue;
        files[f.name] = [];
        for (const file of attached) {
            const bytes = await air.download(file.url);
            if (bytes.length !== file.size) throw new Error(`${table.name} ${record.id}: ${file.filename} read ${bytes.length} bytes, the row says ${file.size}`);
            files[f.name].push({ filename: file.filename, type: file.type, size: file.size, base64: bytes.toString("base64") });
        }
    }
    return { type: "row", table: table.name, id: record.id, createdTime: record.createdTime, why, fields, ...(Object.keys(files).length ? { files } : {}) };
}

async function remove(air, apply, baseLabel) {
    const base = await readBase(air);
    const problems = schemaProblems(base.tables);
    if (problems.length > 0) {
        for (const problem of problems) log(`  ${problem}`);
        return finish(air, 1, "refused: the base is not one this has classified");
    }
    const plan = planRemoval(base.rows);
    printPlan(base, plan);
    if (plan.blocking.length > 0) {
        printBlocking(base, plan);
        return finish(air, 1, "refused before writing anything");
    }
    const tablesHit = REMOVE_ORDER.filter((name) => plan.remove.get(name).length > 0);
    const total = tablesHit.reduce((n, name) => n + plan.remove.get(name).length, 0);
    if (total === 0) return finish(air, 0, "nothing of the demo is on the base");
    if (refusesProtectedWrite({ script: SCRIPT, baseId: air.baseId, writes: tablesHit, log })) return finish(air, 1, "refused before writing anything");
    if (!apply) return finish(air, 2, `dry run — ${total} row(s) would go, nothing was removed`);

    log("\nreading the attached files and writing the ledger:");
    const lines = [];
    for (const name of REMOVE_ORDER) for (const record of plan.remove.get(name)) lines.push(await ledgerLine(air, base.byName.get(name), record, plan.why.get(record.id)));
    const ledger = openLedger(`${SCRIPT}-${baseLabel}`, { type: "run", script: SCRIPT, base: baseLabel });
    for (const line of lines) ledger.write(line);
    const files = lines.reduce((n, line) => n + Object.values(line.files ?? {}).flat().length, 0);
    log(`  ledger: ${relative(process.cwd(), ledger.path)}  (${lines.length} rows, ${files} file(s); commit it)`);

    for (const name of tablesHit) air.writable.add(base.byName.get(name).id);
    log("\nremoving, children first:");
    for (const name of tablesHit) {
        const ids = plan.remove.get(name).map((record) => record.id);
        for (const chunk of inChunks(ids)) await air.deleteRecords(base.byName.get(name).id, chunk);
        log(`  ${name}: ${ids.length}`);
    }

    log("\nreading the base back:");
    const after = await readBase(air);
    const left = planRemoval(after.rows);
    const removed = new Set(lines.map((line) => line.id));
    const keptBefore = base.tables.flatMap((t) => base.rows[t.name].filter((r) => !removed.has(r.id)).map((r) => r.id));
    const present = new Set(after.tables.flatMap((t) => after.rows[t.name].map((r) => r.id)));
    const still = [...removed].filter((id) => present.has(id));
    const demoLeft = REMOVE_ORDER.reduce((n, name) => n + left.remove.get(name).length, 0);
    const keptGone = keptBefore.filter((id) => !present.has(id));
    log(`  ${still.length} of the ledger's rows still there, ${demoLeft} demo row(s) found, ${keptGone.length} kept row(s) missing`);
    if (still.length + demoLeft + keptGone.length > 0) return finish(air, 1, "the base is not what the removal leaves — look above, and keep the ledger");
    return finish(air, 0, `nothing of the demo is on the base; ${removed.size} row(s) removed, ${keptBefore.length} kept`);
}

async function revert(air, apply, ledgerPath, baseLabel) {
    const lines = readLedger(readFileSync(ledgerPath, "utf8"));
    const rows = lines.filter((line) => line.type === "row");
    const run = lines[0];
    if (run?.type !== "run" || run.script !== SCRIPT) return finish(air, 1, `refused: ${ledgerPath} is not a ledger of ${SCRIPT}`);
    if (run.base !== baseLabel) return finish(air, 1, `refused: the ledger is the ${run.base} base's and this run reaches the ${baseLabel} base`);
    log(`${relative(process.cwd(), ledgerPath)}: ${rows.length} row(s) of ${new Set(rows.map((r) => r.table)).size} table(s)\n`);

    const base = await readBase(air);
    const problems = schemaProblems(base.tables);
    if (problems.length > 0) {
        for (const problem of problems) log(`  ${problem}`);
        return finish(air, 1, "refused: the base is not one this has classified");
    }
    const { creates, refusals } = planRevert(lines, base.tables, base.rows);
    if (refusals.length > 0) {
        for (const refusal of refusals) log(`  ${refusal}`);
        return finish(air, 1, "refused before writing anything");
    }
    const tablesHit = [...REMOVE_ORDER].reverse().filter((name) => rows.some((line) => line.table === name));
    if (refusesProtectedWrite({ script: `${SCRIPT} --revert`, baseId: air.baseId, writes: tablesHit, log })) return finish(air, 1, "refused before writing anything");
    const deferred = creates.filter((c) => Object.keys(c.deferred).length > 0);
    const files = rows.reduce((n, line) => n + Object.values(line.files ?? {}).flat().length, 0);
    for (const name of tablesHit) log(`  ${name}: ${rows.filter((line) => line.table === name).length}`);
    log(`  ${deferred.length} row(s) take a link once every row is back; ${files} file(s) to upload`);
    const stamped = tablesHit.flatMap((name) => stampedFields(base.byName.get(name)).map((field) => `${name}."${field}"`));
    if (stamped.length > 0) log(`  stamped by Airtable, so the revert's own time: ${stamped.join(", ")}`);
    if (!apply) return finish(air, 2, `dry run — ${rows.length} row(s) would be made again, nothing was written`);

    const ledger = openLedger(`${SCRIPT}-revert-${baseLabel}`, { type: "run", script: SCRIPT, base: baseLabel, revert: relative(process.cwd(), ledgerPath).replace(/\\/g, "/") });
    log(`\nledger: ${relative(process.cwd(), ledger.path)}  (commit it)`);
    for (const name of tablesHit) air.writable.add(base.byName.get(name).id);
    const minted = new Map();
    try {
        for (const name of tablesHit) {
            const tableId = base.byName.get(name).id;
            for (const chunk of inChunks(creates.filter((c) => c.line.table === name))) {
                const made = await air.createRecords(
                    tableId,
                    chunk.map((c) => ({ fields: remapIds(c.fields, minted) }))
                );
                made.forEach((record, i) => {
                    minted.set(chunk[i].line.id, record.id);
                    ledger.write({ type: "made", table: name, was: chunk[i].line.id, now: record.id });
                });
            }
            log(`  made ${name}`);
        }
        for (const name of tablesHit) {
            const tableId = base.byName.get(name).id;
            for (const chunk of inChunks(deferred.filter((c) => c.line.table === name))) {
                const records = chunk.map((c) => ({ id: minted.get(c.line.id), fields: remapIds(c.deferred, minted) }));
                for (const record of records) ledger.write({ type: "linked", table: name, id: record.id, fields: record.fields });
                await air.updateRecords(tableId, records);
            }
        }
        log(`  linked ${deferred.length} row(s) to rows made after them`);
        for (const line of rows.filter((l) => l.files)) {
            const table = base.byName.get(line.table);
            const now = minted.get(line.id);
            air.uploadable.add(now);
            for (const [fieldName, list] of Object.entries(line.files)) {
                const fieldId = table.fields.find((f) => f.name === fieldName).id;
                for (const file of list) {
                    ledger.write({ type: "upload", table: line.table, id: now, field: fieldName, filename: file.filename, size: file.size });
                    await air.uploadAttachment(now, fieldId, file);
                }
            }
        }
        log(`  uploaded ${files} file(s)`);
    } catch (error) {
        log(`  stopped: ${error.message}`);
        log(`  made before it stopped (ledger id -> new id) are in ${relative(process.cwd(), ledger.path)}`);
        return finish(air, 1, "the revert stopped part way");
    }

    log("\nreading the base back and comparing each row with its ledger line:");
    const after = await readBase(air);
    const byId = new Map(after.tables.flatMap((t) => after.rows[t.name].map((r) => [r.id, r])));
    const differ = [];
    for (const line of rows) {
        const record = byId.get(minted.get(line.id));
        if (!record) differ.push(`${line.table} ${line.id}: not on the base`);
        else {
            const fields = rowDifferences(after.byName.get(line.table), line, record, minted);
            if (fields.length > 0) differ.push(`${line.table} ${nameOf(after.byName.get(line.table), record)}: ${fields.join(", ")}`);
        }
    }
    for (const name of tablesHit) log(`  ${name}: ${rows.filter((l) => l.table === name).length} back`);
    if (differ.length > 0) {
        for (const d of differ) log(`  DIFFERS  ${d}`);
        return finish(air, 1, `${differ.length} row(s) read otherwise than the ledger`);
    }
    return finish(air, 0, `every row of the ledger is back and reads as it did, ${rows.length} in all, under new record ids`);
}

async function main() {
    const apply = process.argv.includes("--apply");
    const at = process.argv.indexOf("--revert");
    const ledgerPath = at === -1 ? null : process.argv[at + 1];
    let airtable;
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const air = new Airtable(airtable.apiKey, airtable.baseId);
    const baseLabel = airtable.live ? "live" : "test";
    log(`${SCRIPT}${ledgerPath ? "  (REVERT)" : ""} — reaching the ${describeAirtableBase(airtable)}${apply ? "" : "  (DRY RUN — nothing is written; --apply writes)"}\n`);
    if (at !== -1 && !ledgerPath) {
        log("--revert takes the ledger's path");
        return 1;
    }
    return ledgerPath ? revert(air, apply, ledgerPath, baseLabel) : remove(air, apply, baseLabel);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
