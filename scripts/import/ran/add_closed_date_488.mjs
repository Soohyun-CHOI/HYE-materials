// `Jobs."Closed Date"` (#488): the day a job's work ended, made by this script on both bases. It
// writes no row on either: a job is open until the office types a day into it.
//
// WHY ONE DATE AND NO CHECKBOX. A day's presence is the closing, as `Invoices."Paid Date"`'s is the
// payment since #318 took the `Paid` box away: a box beside a date makes four states of which two
// mean something, and a date alone also says when, which the job's page (#487) is to show. Which day
// it holds is never read, so a day typed ahead closes the job at once, and an empty cell reopens it.
// Read by `lib/airtable/jobs.js` with every other field of the row, so no screen spends a read on it;
// what it does to a choice is `lib/closedJob.js`'s.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/ran/add_closed_date_488.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/add_closed_date_488.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (the live base, once Soo has approved it)
//
// A LEDGER BEFORE THE WRITE: the field it makes, or the description it rewrites with what it held, to
// `scripts/import/ledgers/add_closed_date_488-<base>-<instant>.jsonl`.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field as specified, 1 something
// failed or is not as specified, 2 a dry run with something to do.

import fs from "node:fs";
import path from "node:path";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";

const API_ROOT = "https://api.airtable.com/v0";
const TABLE = "Jobs";
// Every date field on both bases takes this format, `Paid Date`'s and `Received Date`'s, read on the
// test base for #488.
const FIELD = { name: "Closed Date", type: "date", options: { dateFormat: { name: "local", format: "l" } } };

const DESCRIPTION =
    "Issue #488 -- the day this job's work ended. A day here closes the job, whichever day it is, and an empty cell is an open " +
    "job: clear it to reopen one. A closed job is offered nowhere a job is newly chosen -- a purchase request, a delivery, a " +
    "direct purchase, an asset's registration, lending and change of job, a user's jobs at sign-in, a new address, a new " +
    "discipline -- and a write naming it there is refused, while every record already naming it keeps it, the Equipment & " +
    "Tools list still offers it and its assets are still recorded. Typed here by the office until the job's page (#487) " +
    "closes and reopens a job. Judged by lib/closedJob.js alone. Made by scripts/import/ran/add_closed_date_488.mjs.";

let airtable = null;
let calls = 0;
let ledgerPath = null;

const log = (line = "") => console.log(line);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(method, url, body) {
    calls++;
    await sleep(220); // five a second at most (#553)
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${url} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

function ledger(entry) {
    fs.appendFileSync(ledgerPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`);
}

async function readTable() {
    const json = await request("GET", `${API_ROOT}/meta/bases/${airtable.baseId}/tables`);
    const table = json.tables.find((t) => t.name === TABLE);
    if (!table) throw new Error(`the base holds no ${TABLE}`);
    return table;
}

function fieldFault(field) {
    if (!field) return "missing";
    if (field.type !== FIELD.type) return `a ${field.type}, not a date`;
    const format = field.options?.dateFormat ?? {};
    if (format.name !== FIELD.options.dateFormat.name || format.format !== FIELD.options.dateFormat.format) {
        return `formatted ${JSON.stringify(format)}, not ${JSON.stringify(FIELD.options.dateFormat)}`;
    }
    return null;
}

function finish(code, why) {
    log("");
    log(`${calls} Airtable call(s). Exit ${code}${why ? ` — ${why}` : ""}.`);
    return code;
}

async function main() {
    const apply = process.argv.includes("--apply");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const which = airtable.live ? "live" : "test";
    log("=".repeat(72));
    log(`${TABLE}."${FIELD.name}" (#488)`);
    log(`base ${airtable.baseId} (${which})${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const table = await readTable();
    const field = table.fields.find((f) => f.name === FIELD.name);
    log(`  ${TABLE}: ${table.fields.length} field(s), ${FIELD.name} ${field ? `stands (${field.id})` : "absent"}`);

    if (apply) {
        const dir = path.join("scripts", "import", "ledgers");
        fs.mkdirSync(dir, { recursive: true });
        ledgerPath = path.join(dir, `add_closed_date_488-${which}-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    }

    if (!field) {
        if (!apply) {
            log(`  would create ${FIELD.name}: a date, ${FIELD.options.dateFormat.name} format, no time, described`);
            return finish(2, "a dry run");
        }
        ledger({ act: "create-field", table: table.id, name: FIELD.name });
        const made = await request("POST", `${API_ROOT}/meta/bases/${airtable.baseId}/tables/${table.id}/fields`, {
            ...FIELD,
            description: DESCRIPTION,
        });
        ledger({ act: "created-field", table: table.id, field: made.id });
        log(`  created ${FIELD.name} (${made.id})`);
    } else {
        const fault = fieldFault(field);
        if (fault) return finish(1, `${FIELD.name} stands and is ${fault}`);
        if (field.description === DESCRIPTION) {
            log(`  ${FIELD.name} stands as specified`);
        } else if (!apply) {
            log(`  would rewrite ${FIELD.name}'s description`);
            return finish(2, "a dry run");
        } else {
            ledger({ act: "describe-field", field: field.id, before: field.description ?? null });
            await request("PATCH", `${API_ROOT}/meta/bases/${airtable.baseId}/tables/${table.id}/fields/${field.id}`, {
                description: DESCRIPTION,
            });
            log(`  rewrote ${FIELD.name}'s description`);
        }
    }

    if (!apply) return finish(0, "nothing to do");

    // ── the re-read ──────────────────────────────────────────────────────────
    const after = (await readTable()).fields.find((f) => f.name === FIELD.name);
    const fault = fieldFault(after);
    if (fault) return finish(1, `${FIELD.name} reads back ${fault}`);
    if (after.description !== DESCRIPTION) return finish(1, `${FIELD.name}'s description reads back otherwise`);
    log(`  re-read: ${FIELD.name} (${after.id}) as specified`);
    if (ledgerPath) log(`  ledger: ${ledgerPath}`);
    return finish(0);
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
