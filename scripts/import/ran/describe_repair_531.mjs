// Rewrites the six descriptions on `Assets` and `Asset Log` that #531 made false, and nothing else.
//
// WHAT WENT FALSE. #531 added `In repair` and the two repair events, and the base's own words
// still said three statuses and four events, that a retirement is the only event taking its job
// from the asset, and that `Checked Out To` is blank on three events: the `Assets` table's
// description, `Assets."Status"`, `Assets."Job"`, `Asset Log."Event"`, `Asset Log."Job"` and
// `Asset Log."Checked Out To"`. Each new passage is the one reported to Soo with #531, word for
// word, and every other sentence of the six stays as the base holds it.
//
// THE DESCRIPTIONS ALONE, BECAUSE THE TWO TABLES ARE THE SITE'S RECORDS (#531). A description
// says what a column holds and touches no row, which is why `scripts/protectedTables.mjs` lets one
// through and nothing else: every request this script sends asks `refusesBeyondDescriptions`
// first, so a body carrying a name, a type or options, or any request to a row, is refused before
// it leaves. It sends one GET of the base's schema before and one after, and six PATCHes.
//
// IT STOPS ON A DESCRIPTION THAT IS NOT THE ONE IT WAS WRITTEN AGAINST. Each target carries the
// SHA-256 of its description as read on 2026-10-16 and of the description it writes; a current
// one matching neither is somebody else's edit, and nothing is written. Matching the second is a
// target already written, so a second run writes nothing and still re-reads.
//
// A LEDGER BEFORE THE FIRST PATCH. `--apply` writes every target's current and new description
// to `scripts/import/ledgers/describe_repair_531-<instant>.jsonl` first, the shape the other
// ledgers there take, so what the base said is kept in this repository.
//
// AND IT LOOKS AFTERWARDS. The re-read compares both tables whole against the read before: every
// field's id, name, type and options, the table's name and primary field, and every description
// but the six, which must read as written.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/ran/describe_repair_531.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/describe_repair_531.mjs --apply
//
// No loader flag: this file imports only built-ins and the guard's module.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the six as written, 1 something
// failed or a description was not the one read, 2 a dry run.

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusesBeyondDescriptions } from "../../protectedTables.mjs";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "describe_repair_531";

const META_ROOT = "https://api.airtable.com/v0/meta";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/**
 * The six, each by id, with the passages it replaces. `field` is null for the table's own
 * description. Each `[from, to]` names a passage occurring once in the description as read.
 */
const TARGETS = [
    {
        table: "Assets",
        tableId: "tblXtmDonSyOyOvV3",
        field: null,
        fieldId: null,
        beforeSha256: "d354d72bfc4d5ed00a1bb5e2506a4cd28ca317abdaab1380c55f7b67df45d2e3",
        afterSha256: "f886636c2a211bac89d3999e2fd9f73121a2256bb71408eddd04e652ba472e1c",
        edits: [
            [
                "lib/assetStatus.js:STATUS_AFTER_EVENT holds the first mapping -- four events against three statuses, so it is a mapping rather than a copy -- and the job is carried straight across.",
                "lib/assetStatus.js:STATUS_AFTER_EVENT holds the first mapping -- six events against four statuses, so it is a mapping rather than a copy -- and the job is carried straight across.",
            ],
        ],
    },
    {
        table: "Assets",
        tableId: "tblXtmDonSyOyOvV3",
        field: "Status",
        fieldId: "fldMpl1xR9Sdwvehg",
        beforeSha256: "d1bb6597e87f8749484666f5bc5f2a07c6c7d9e8bc02b440207a740dad7d3d5a",
        afterSha256: "f1fd56d2ac798b429205ac209686f2b4e16248d4e10001bb77f2b207b2bd0f6f",
        edits: [
            [
                "Issue #334, narrowed in #335, renamed in #463 -- where this asset is now. In stock and Out are the pair a scan moves between; Retired is designated from a screen and is the only end.",
                "Issue #334, narrowed in #335, renamed in #463, widened in #531 -- where this asset is now. In stock and Out are the pair a scan moves between; In repair is an item sent to its maker, from In stock and back to it; Retired is designated from a screen and is the only end.",
            ],
            [
                "THREE VALUES, AND THE ONES THAT ARE NOT HERE WERE REMOVED ON PURPOSE. In Repair and Lost are absent because those things do not happen here: a broken tool is thrown away and replaced rather than repaired, and nobody reports an individual asset missing. A status nobody would ever designate is a permanent blank in the per-status count and a dead option in the filter.",
                "FOUR VALUES, AND THE ONES THAT ARE NOT HERE WERE REMOVED ON PURPOSE. Lost is absent because nobody reports an individual asset missing: a status nobody would ever designate is a permanent blank in the per-status count and a dead option in the filter. In Repair was removed by #335 on the same ground, when a broken tool was thrown away; #531 brought it back as In repair when the sites began sending broken items back to their maker, added by hand since an option cannot be written through the API.",
            ],
            [
                "Where a status really needs changing, the act is the event: Retired comes from the Retired event.",
                "Where a status really needs changing, the act is the event: Retired comes from the Retired event, In repair from Sent for repair.",
            ],
        ],
    },
    {
        table: "Assets",
        tableId: "tblXtmDonSyOyOvV3",
        field: "Job",
        fieldId: "fld4eMgKoBTUJF1v2",
        beforeSha256: "71299c9f19ae53c0ee28c06a5993888cd0e5cbee8efa13fc774bc7d7390bbbeb",
        afterSha256: "e357453a66aa4b8c59a98021594169f621266b0ae76de89d151a5a871a1c69aa",
        edits: [
            [
                "A RETIREMENT takes it from THIS FIELD: retiring moves nothing, so the Asset Log row inherits where the asset already was and this cache is written back unchanged.",
                "A RETIREMENT, A SENDING FOR REPAIR AND A RETURN take it from THIS FIELD (#363, #531): none of them moves the asset, so the Asset Log row inherits where the asset already was and this cache is written back unchanged. lib/assetStatus.js:JOB_SOURCE_OF_EVENT says which event takes which.",
            ],
            [
                "SO THIS FIELD FEEDS A WRITE AS WELL AS ANSWERING A READ, which is the one thing worth knowing before changing it: lib/assetTransition.js:readRetirement hands it to createAssetLogEntry, so a wrong value here becomes a wrong value on a row that cannot be corrected by a later event -- Retired is terminal.",
                "SO THIS FIELD FEEDS A WRITE AS WELL AS ANSWERING A READ, which is the one thing worth knowing before changing it: lib/assetTransition.js:readRetirement and readSubmission hand it to createAssetLogEntry, so a wrong value here becomes a wrong value on a row that cannot be corrected by a later event -- Retired is terminal, and the log is append-only.",
            ],
        ],
    },
    {
        table: "Asset Log",
        tableId: "tblrox7y4akPKdbpF",
        field: "Event",
        fieldId: "fldI7mM1DFKw6W41B",
        beforeSha256: "7ab5d59f476d8428a8614597a4e89d4390fe217575d19363ad1e02613f5a3617",
        afterSha256: "86ca51a52f7dce1dc329c5e9ab6a7f4c100cd5d7a2eb943deab0b7824ffb4018",
        edits: [
            [
                "Issue #334, narrowed in #335, renamed in #455 and #463 -- what happened. Four values against Status's three, which is why Assets.Status is a mapping of this rather than a copy of it.",
                "Issue #334, narrowed in #335, renamed in #455 and #463, widened in #531 -- what happened. Six values against Status's four, which is why Assets.Status is a mapping of this rather than a copy of it.",
            ],
            [
                "TWO NAMING SHAPES. A transition a person designates on a screen is named for the state it leaves the tool in, so the event and the status are the same string: Retired, the only one of that kind left. A transition that happens by SCANNING carries an action name, because the person is performing an act rather than declaring a state: Checked out, Checked in. Created is a third case -- an act with no status of its own name.",
                "TWO NAMING SHAPES. A transition that ends the asset is named for the state it leaves, so the event and the status are the same string: Retired, the only one of that kind. Every other transition carries an action name, because the person is performing an act rather than declaring a state: Checked out and Checked in by scanning, Sent for repair and Returned from repair from the asset's page (#531). Created is a third case -- an act with no status of its own name.",
            ],
            [
                "WHAT #335 REMOVED: Sent to Repair, Returned from Repair, Lost and Found, because a broken tool here is thrown away rather than repaired and nobody reports one missing; and Job Changed, because a tool moving site is already two rows, a check-out on one job and the next check-in on another, so a separate event added no fact.",
                "WHAT #335 REMOVED: Sent to Repair, Returned from Repair, Lost and Found, because a broken tool was thrown away rather than repaired and nobody reports one missing; and Job Changed, because a tool moving site is already two rows, a check-out on one job and the next check-in on another, so a separate event added no fact. #531 brought the repair pair back as Sent for repair and Returned from repair, in the design's sentence case, when the sites began sending broken items to their maker; Lost, Found and Job Changed stay gone.",
            ],
            [
                "Written with NO typecast, so a value outside this list fails the write rather than minting a fifth choice off the palette,",
                "Written with NO typecast, so a value outside this list fails the write rather than minting a seventh choice off the palette,",
            ],
        ],
    },
    {
        table: "Asset Log",
        tableId: "tblrox7y4akPKdbpF",
        field: "Job",
        fieldId: "fldAE0bSiYOTuE9M0",
        beforeSha256: "54d6fe3ece24e9ec8ca27c30db354372b3cff0372a7827893d25b6e76b8df3cc",
        afterSha256: "6bcde385b81fb03aa14beea28ec81dacd5cf077acc0dac94de68cc18fa632d27",
        edits: [
            [
                "THE DESIGNATED EVENT TAKES IT FROM THE ASSET. Retiring moves nothing and the person designating need not be near the tool, so a Retired row inherits Assets.\"Job\" -- where it was.",
                "THE OTHER EVENTS TAKE IT FROM THE ASSET. Retiring, sending for repair and returning move nothing, and the person recording need not be near the asset, so a Retired, Sent for repair or Returned from repair row inherits Assets.\"Job\" -- where it was (lib/assetStatus.js:JOB_SOURCE_OF_EVENT, #531).",
            ],
            [
                "The retirement reads the cache once, at write time",
                "Those events read the cache once, at write time",
            ],
            [
                "A retirement always agrees with the row above it",
                "A retirement, a sending and a return always agree with the row above them",
            ],
        ],
    },
    {
        table: "Asset Log",
        tableId: "tblrox7y4akPKdbpF",
        field: "Checked Out To",
        fieldId: "fldF7WbZsbgkpgvSG",
        beforeSha256: "f86cdd9d4fadc1b1f56ec81ada4aabf6c42720652e8613b0921b644a84a38613",
        afterSha256: "f85d6ab79e8a1e1c4dc4ab71df183db267a032bd5ecd52b181d3ee06cd32d9ce",
        edits: [
            [
                "The person this asset was handed to. Written on Checked out rows only and blank on Created, Checked in and Retired; app-enforced in both directions, since the people who receive tools have no account here. Trimmed with runs of spaces collapsed and case kept, matched without case.",
                "The person this asset was handed to. Written on Checked out rows only and blank on every other event -- Created, Checked in, Retired, Sent for repair and Returned from repair; app-enforced in both directions, since the people who receive tools have no account here. Trimmed with runs of spaces collapsed and case kept, matched without case.",
            ],
        ],
    },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");

/** The one way this script reaches Airtable: asked of the guard before it is sent. */
async function request(method, path, body) {
    const url = `${META_ROOT}${path}`;
    if (refusesBeyondDescriptions({ script: SCRIPT, method, url, body, log })) {
        throw new Error("refused before sending");
    }
    calls++;
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${airtable.apiKey}`,
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

/** The two tables, by id, as the base holds them now. */
async function readTables(baseId) {
    const { tables } = await request("GET", `/bases/${baseId}/tables`);
    const ids = [...new Set(TARGETS.map((t) => t.tableId))];
    return Object.fromEntries(
        ids.map((id) => {
            const table = tables.find((t) => t.id === id);
            if (!table) throw new Error(`no table ${id} on this base`);
            return [id, table];
        })
    );
}

/** What a target describes, read off its table: the table itself or one field of it. */
function described(tables, target) {
    const table = tables[target.tableId];
    if (target.fieldId === null) return { name: table.name, description: table.description ?? "" };
    const field = table.fields.find((f) => f.id === target.fieldId);
    if (!field) throw new Error(`no field ${target.fieldId} on ${table.name}`);
    return { name: field.name, description: field.description ?? "" };
}

const label = (target) => (target.field === null ? `${target.table} (the table)` : `${target.table}."${target.field}"`);

function applyEdits(text, edits) {
    let out = text;
    for (const [from, to] of edits) {
        if (out.split(from).length !== 2) throw new Error(`a passage does not occur once: ${JSON.stringify(from.slice(0, 60))}`);
        out = out.replace(from, () => to);
    }
    return out;
}

/** Every fact of a table but the descriptions this script writes, for the before-and-after. */
function shape(table) {
    const written = new Set(TARGETS.filter((t) => t.tableId === table.id).map((t) => t.fieldId));
    return JSON.stringify({
        id: table.id,
        name: table.name,
        primaryFieldId: table.primaryFieldId,
        description: written.has(null) ? null : table.description ?? "",
        fields: table.fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            options: f.options ?? null,
            description: written.has(f.id) ? null : f.description ?? "",
        })),
    });
}

async function main() {
    const apply = process.argv.includes("--apply");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    const baseId = airtable.baseId;

    log("=".repeat(72));
    log("Six descriptions on Assets and Asset Log, after #531 — descriptions alone");
    log(`base ${baseId}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTables(baseId);
    const planned = [];
    const stopped = [];
    for (const target of TARGETS) {
        const now = described(before, target);
        const expectedName = target.field ?? target.table;
        if (now.name !== expectedName) {
            stopped.push(`${label(target)} is called "${now.name}" now`);
            continue;
        }
        const hash = sha256(now.description);
        if (hash === target.afterSha256) {
            log(`  already written: ${label(target)}`);
            continue;
        }
        if (hash !== target.beforeSha256) {
            stopped.push(`${label(target)} is not the description read on 2026-10-16`);
            continue;
        }
        const after = applyEdits(now.description, target.edits);
        if (sha256(after) !== target.afterSha256) throw new Error(`${label(target)}: the edits do not give the description this script writes`);
        planned.push({ target, before: now.description, after });
    }

    for (const p of planned) {
        log("");
        log("-".repeat(72));
        log(`${label(p.target)}  ${p.target.tableId}${p.target.fieldId ? `/${p.target.fieldId}` : ""}`);
        log("-".repeat(72));
        log("BEFORE:");
        log(p.before);
        log("");
        log("AFTER:");
        log(p.after);
    }

    if (stopped.length > 0) {
        log("");
        for (const s of stopped) log(`  STOPPED: ${s}`);
        log("  Nothing was written.");
        return finish(1, `${stopped.length} description(s) not as read`);
    }
    if (planned.length === 0) log("\n  nothing to write");

    if (!apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${planned.length} description(s) would be written and none were.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    if (planned.length > 0) {
        mkdirSync(LEDGER_DIR, { recursive: true });
        const at = new Date().toISOString();
        const ledger = join(LEDGER_DIR, `${SCRIPT}-${at.replace(/[:.]/g, "-")}.jsonl`);
        writeFileSync(
            ledger,
            planned
                .map((p) => JSON.stringify({ kind: "description", table: p.target.tableId, field: p.target.fieldId, at, before: p.before, after: p.after }))
                .join("\n") + "\n"
        );
        log("");
        log(`ledger: ${ledger}`);
    }

    // Aborts on the first non-200 and leaves what was written in place: a re-run finds those
    // already written and writes the rest.
    for (const p of planned) {
        const path =
            p.target.fieldId === null
                ? `/bases/${baseId}/tables/${p.target.tableId}`
                : `/bases/${baseId}/tables/${p.target.tableId}/fields/${p.target.fieldId}`;
        await request("PATCH", path, { description: p.after });
        log(`  written: ${label(p.target)}`);
    }

    const after = await readTables(baseId);
    const problems = [];
    for (const id of Object.keys(before)) {
        if (shape(after[id]) !== shape(before[id])) problems.push(`${before[id].name} changed beyond the six descriptions`);
    }
    log("");
    log("re-read from the base:");
    for (const target of TARGETS) {
        const now = described(after, target);
        const nameKept = now.name === (target.field ?? target.table);
        const written = sha256(now.description) === target.afterSha256;
        log(`  ${label(target)}: name ${nameKept ? "kept" : `now "${now.name}"`}, description ${written ? "as written" : "NOT as written"}`);
        if (!nameKept) problems.push(`${label(target)} was renamed`);
        if (!written) problems.push(`${label(target)} does not read as written`);
    }
    if (problems.length > 0) {
        log("");
        for (const p of problems) log(`  WRONG: ${p}`);
        return finish(1, `${problems.length} problem(s)`);
    }
    log("  every other field of both tables: id, name, type, options and description unchanged");
    return finish(0, "the six read as written");
}

function finish(code, verdict) {
    log("");
    log(`${calls} Airtable API call(s). ${verdict}.`);
    return code;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    },
);
