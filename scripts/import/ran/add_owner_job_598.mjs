// `Assets."Owner Job"` (#598): the job an asset belongs to, a link to `Jobs`, and its far side
// `Jobs."Assets (as Owner)"` — made by this script on both bases, so the two hold their fields in one
// order — with the descriptions the loan makes false corrected beside them.
//
// WHY THE FIELD. An asset sits on one job, `Assets."Job"`, the cache of its latest event's. A loan
// moves it to another job for a while and back, so the job it belongs to has to be held apart from
// the one it is on: the registration writes both, a lending moves `Job` alone, and a return puts
// `Job` back to `Owner Job`. The far side is what lets the Equipment & Tools list count an owner's
// items on loan with no read of its own — the job list already carries it beside `Jobs."Assets"`.
// It takes the name this base gives a second relation between two tables, `Jobs (as PIC)` and
// `Purchase Orders (as Manager)` among them.
//
// ON THE LIVE BASE TOO, BY SOO'S LEAVE, AND NOTHING ELSE THERE. `Assets` is the site's on the live
// base (#531), and every request this script sends asks `scripts/protectedTables.mjs:
// refusesBeyondDescriptions` first, which lets this script alone (`OWNER_JOB_SCHEMA`) make that one
// link and rename its far side, beyond a schema read and descriptions. No row is read or written.
// Single-record is the app's to hold, as on every link of this base: the API refuses
// `prefersSingleRecordLink` on create and on update (`docs/notes/airtable-access.md`), so it is not sent.
//
// `Asset Log."Event"`'s description waits for its two loan options, which
// `scripts/import/ran/add_loan_events_598.mjs` makes on the test base and Soo makes by hand on the live
// base: with them missing, the run says so and stops before writing that one.
//
// ITS RUNS ARE DONE, AND ONE DESCRIPTION IS NO LONGER ITS OWN. `add_serial_number_601.mjs` rewrote
// `Assets`' table description after it (#601), so on either base a dry run now says it would write that
// description, and an `--apply` would put the text before #601 back. Its live run is done (#572's `ran/`).
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/ran/add_owner_job_598.mjs            (dry run)
//   node --env-file=.env.local scripts/import/ran/add_owner_job_598.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (the live base, once Soo has approved it)
//
// No loader flag: this file imports only built-ins, the guard's module and `lib/airtableBase.js`.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field, its far side and every
// description as specified, 1 something failed or a field is not the one specified, 2 a dry run or a
// hand step outstanding.

import { OWNER_JOB_FIELD, refusesBeyondDescriptions } from "../../protectedTables.mjs";
import { resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(). */
let airtable = null;

const SCRIPT = "add_owner_job_598";

const META_ROOT = "https://api.airtable.com/v0/meta";

// The ids are the same on both bases: the test base was made by duplicating the live one (#534).
const ASSETS_TABLE_ID = OWNER_JOB_FIELD.table;
const JOBS_TABLE_ID = OWNER_JOB_FIELD.linkedTable;
const ASSET_LOG_TABLE_ID = "tblrox7y4akPKdbpF";

/** `Asset Log."Event"`'s two options this issue adds, last and in this order (`lib/assetStatus.js`). */
const LOAN_EVENTS = ["Lent", "Returned to owner"];

const OWNER_JOB_DESCRIPTION =
    "Issue #598 -- the job this asset belongs to: the job it was registered on. The registration writes it with Job, and nothing changes it after " +
    "but the office's change of job while the asset's history holds its Created entry alone (#583), which puts a registration right and moves both. " +
    "Job is where the asset is now; while the two differ the asset is on loan from this job to that one -- lent by a site manager on this job (Lent), " +
    "returned by a site manager on the job it went to (Returned to owner) -- and a retirement takes this job, so an asset retired on loan goes back " +
    "to its owner as it ends. Single-record, app-enforced: the API refuses prefersSingleRecordLink. Filled from Job for the assets standing before #598 " +
    "by scripts/import/fill_owner_job_598.mjs; made by scripts/import/add_owner_job_598.mjs on both bases.";

const INVERSE_DESCRIPTION =
    "Issue #598 -- the assets this job owns: the reverse link of Assets.\"Owner Job\". Beside Assets, the assets on this job now, it is what the " +
    "Equipment & Tools list counts as On loan -- an asset this job owns that stands on another job -- with no read of its own, since the job list " +
    "carries both arrays (lib/assetListView.js:assetListScope). Named as this base names a second relation between two tables: Jobs (as PIC), " +
    "Purchase Orders (as Manager).";

/** The descriptions the loan makes false, by table and field, rewritten whole (`null` is the table's own). */
const CORRECTED = [
    {
        table: ASSETS_TABLE_ID,
        field: null,
        description:
            "Issue #334, renamed from Tool Items in #513 -- one asset, a tool or a piece of equipment: the thing a QR label is stuck to. " +
            "Status and Job are caches of the last Asset Log row, written by the app in the same operation as that row and never by an Airtable formula: " +
            "the status that event left behind, and the job the asset is on after it. lib/assetStatus.js:STATUS_AFTER_EVENT holds the first mapping -- " +
            "nine events against five statuses -- and lib/assetStatus.js:JOB_SOURCE_OF_EVENT where each event's job comes from. Owner Job (#598) is no " +
            "cache: the job the asset belongs to, set at registration. Note is the one field no event writes (#533). A deleted asset (#582) keeps its row, " +
            "so its number stays taken, and the app shows it nowhere.",
    },
    {
        table: ASSETS_TABLE_ID,
        field: "Status",
        description:
            "Issue #334, narrowed in #335, renamed in #463, widened in #531 and #582 -- where this asset is now. In stock and Out are the pair a check-out " +
            "and a check-in move between; In repair is an item sent to its maker, from In stock and back to it; Retired is the end of an item the company " +
            "held, designated from a screen; Deleted (#582) the end of one registered by mistake, which the office deletes while its history holds its " +
            "Created entry alone and which no screen shows. A loan (#598) leaves an item In stock on the job it goes to, and its return In stock on its " +
            "owner. Retired covers disposal and an item found missing at a stock check, one fact on this axis, and nothing records which (#363).\n\n" +
            "A DERIVED CACHE OF Asset Log, WRITTEN BY THE APP -- DO NOT EDIT IT BY HAND IN THIS UI: a value typed here records no event, names nobody, " +
            "and is contradicted by the next event. NOT AN AIRTABLE FORMULA: a rollup has no argmax, and a formula field cannot be a single select. " +
            "lib/assetStatus.js:STATUS_AFTER_EVENT holds the mapping; docs/notes/tools.md has the argument.",
    },
    {
        table: ASSETS_TABLE_ID,
        field: "Job",
        description:
            "Issue #334, corrected in #335, #363, #597 and #598 -- the job this asset is on now, cached from the last Asset Log row's Job. Owner Job " +
            "(#598) is the job it belongs to, and the two differ while it is on loan.\n\n" +
            "WHERE EACH EVENT'S JOB COMES FROM is lib/assetStatus.js:JOB_SOURCE_OF_EVENT: a registration takes the job the actor chose among their own " +
            "assignments; a check-out, a check-in and a repair leave the asset where it is (#597, #531); a lending takes the job chosen to lend it to; a " +
            "return and a retirement take Owner Job (#598). Only the office's change of job (#583) writes it without an event, with the asset's Created " +
            "entry and Owner Job.\n\n" +
            "SO THIS FIELD FEEDS A WRITE AS WELL AS ANSWERING A READ: the next event's row copies it, and a value typed here becomes a value on a row " +
            "that cannot be corrected. Required, by the app rather than the schema, since Airtable cannot make a link field required (#278). " +
            "Single-record, app-enforced (422 on prefersSingleRecordLink).",
    },
    {
        table: ASSET_LOG_TABLE_ID,
        field: "Job",
        description:
            "Issue #334, corrected in #363, #597 and #598 -- the job the asset is on after this event, filled on every row and never blank; Assets.Job " +
            "is a cache of it on the latest row.\n\n" +
            "WHERE EACH EVENT LEARNS IT is lib/assetStatus.js:JOB_SOURCE_OF_EVENT: a registration from the actor's assignments; a check-out, a check-in " +
            "and a repair from Assets.Job, since each leaves the asset where it is; a lending from the job chosen; a return and a retirement from " +
            "Assets.\"Owner Job\", so an asset retired on loan goes back to its owner as it ends (#598). Who recorded it is Recorded By.\n\n" +
            "STORED AT THAT MOMENT AND NEVER LOOKED UP LATER: a copy, not a lookup through Assets.Job, which would make every row say where the asset " +
            "is now. NO Former Job FIELD: with no blanks the previous row's Job is the previous job, so a row whose job differs from the one above is " +
            "the asset moving -- a lending, a return or a retirement on loan, and before #597 a check-in -- and the history draws a loan's route from " +
            "that pair. Required and single-record, both app-enforced.",
    },
    {
        table: ASSET_LOG_TABLE_ID,
        field: "Event",
        waitsFor: LOAN_EVENTS,
        description:
            "Issue #334, narrowed in #335, renamed in #455 and #463, widened in #531, #582 and #598 -- what happened. Nine values against " +
            "Assets.Status's five, which is why Status is a mapping of this rather than a copy (lib/assetStatus.js:STATUS_AFTER_EVENT). Created is the " +
            "first row of every asset's history, since Assets carries no Created At. Retired and Deleted end an asset and are named for the status " +
            "they leave; every other event names the act: Checked out and Checked in, Sent for repair and Returned from repair (#531), and a loan's two " +
            "(#598), Lent -- to another job -- and Returned to owner.\n\n" +
            "An option renamed in place keeps every row, since a cell holds its choice by id; one deleted empties them. Written with NO typecast, so a " +
            "value outside this list fails the write; lib/assetStatus.js:ASSET_EVENT is the source of truth and no call site passes a literal. #598's " +
            "two were made on the test base by one row written with typecast and deleted at once, in typecast's default color, and by hand on the live base.",
    },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

/** The one way this script reaches Airtable: asked of the guard before it is sent. */
async function request(method, path, body) {
    const url = `${META_ROOT}${path}`;
    if (refusesBeyondDescriptions({ script: SCRIPT, method, url, body, log })) return { refused: true };
    calls++;
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return { refused: false, json: text === "" ? null : JSON.parse(text) };
}

/** The three tables by id, as the base holds them now. */
async function readTables(baseId) {
    const { json } = await request("GET", `/bases/${baseId}/tables`);
    const byId = (id) => json.tables.find((t) => t.id === id);
    const tables = { assets: byId(ASSETS_TABLE_ID), jobs: byId(JOBS_TABLE_ID), assetLog: byId(ASSET_LOG_TABLE_ID) };
    if (!tables.assets || !tables.jobs || !tables.assetLog) throw new Error("the base holds no Assets, Jobs or Asset Log by the ids this script was written against");
    return tables;
}

/** Whether `field` is the owner job's link, or why not. */
function ownerJobFault(field) {
    if (!field) return "missing";
    if (field.type !== "multipleRecordLinks") return `a ${field.type}, not a link`;
    if (field.options?.linkedTableId !== JOBS_TABLE_ID) return `a link to ${field.options?.linkedTableId ?? "nothing"}, not Jobs`;
    if (!field.options?.inverseLinkFieldId) return "a link with no field on Jobs";
    return null;
}

/** Whether `Event` ends on the loan's two, in order, and which are missing. */
function loanEventsMissing(eventField) {
    const names = (eventField?.options?.choices ?? []).map((choice) => choice.name);
    return names.slice(-LOAN_EVENTS.length).join("\n") === LOAN_EVENTS.join("\n") ? [] : LOAN_EVENTS.filter((name) => !names.includes(name));
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
    const baseId = airtable.baseId;
    log("=".repeat(72));
    log(`Assets."${OWNER_JOB_FIELD.name}" and Jobs."${OWNER_JOB_FIELD.inverse}" (#598)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    let tables = await readTables(baseId);
    let owner = tables.assets.fields.find((f) => f.name === OWNER_JOB_FIELD.name);
    let pending = false;

    // ── the link ─────────────────────────────────────────────────────────────
    if (!owner) {
        if (!apply) {
            log(`  would create ${OWNER_JOB_FIELD.name}: a link to Jobs, described`);
            pending = true;
        } else {
            const body = {
                name: OWNER_JOB_FIELD.name,
                type: "multipleRecordLinks",
                description: OWNER_JOB_DESCRIPTION,
                options: { linkedTableId: JOBS_TABLE_ID },
            };
            const sent = await request("POST", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields`, body);
            if (sent.refused) return finish(1, "the create was refused");
            log(`  created ${OWNER_JOB_FIELD.name} (${sent.json.id})`);
            tables = await readTables(baseId);
            owner = tables.assets.fields.find((f) => f.name === OWNER_JOB_FIELD.name);
        }
    }
    if (owner) {
        const fault = ownerJobFault(owner);
        if (fault) return finish(1, `${OWNER_JOB_FIELD.name} is ${fault}`);
        log(`  ${OWNER_JOB_FIELD.name} (${owner.id}) is a link to Jobs`);
        if ((owner.description ?? "") !== OWNER_JOB_DESCRIPTION) {
            if (!apply) {
                log(`  would write ${OWNER_JOB_FIELD.name}'s description`);
                pending = true;
            } else {
                const sent = await request("PATCH", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields/${owner.id}`, { description: OWNER_JOB_DESCRIPTION });
                if (sent.refused) return finish(1, "the description was refused");
                log(`  wrote ${OWNER_JOB_FIELD.name}'s description`);
            }
        }

        // ── its far side ─────────────────────────────────────────────────────
        const inverse = tables.jobs.fields.find((f) => f.id === owner.options.inverseLinkFieldId);
        if (!inverse) return finish(1, "the link's field on Jobs is not on the base");
        const clash = tables.jobs.fields.find((f) => f.name === OWNER_JOB_FIELD.inverse && f.id !== inverse.id);
        if (clash) return finish(1, `Jobs already holds another field named ${OWNER_JOB_FIELD.inverse} (${clash.id})`);
        const change = {
            ...(inverse.name === OWNER_JOB_FIELD.inverse ? {} : { name: OWNER_JOB_FIELD.inverse }),
            ...((inverse.description ?? "") === INVERSE_DESCRIPTION ? {} : { description: INVERSE_DESCRIPTION }),
        };
        if (Object.keys(change).length === 0) log(`  Jobs."${OWNER_JOB_FIELD.inverse}" (${inverse.id}) is named and described`);
        else if (!apply) {
            log(`  would ${change.name ? `rename Jobs."${inverse.name}" to "${OWNER_JOB_FIELD.inverse}"` : `describe Jobs."${inverse.name}"`}`);
            pending = true;
        } else {
            const sent = await request("PATCH", `/bases/${baseId}/tables/${JOBS_TABLE_ID}/fields/${inverse.id}`, change);
            if (sent.refused) return finish(1, "the far side's rename was refused");
            log(`  ${change.name ? `renamed Jobs."${inverse.name}" to "${OWNER_JOB_FIELD.inverse}"` : "described the far side"} (${inverse.id})`);
        }
    }

    // ── the descriptions the loan makes false ────────────────────────────────
    tables = await readTables(baseId);
    const eventField = tables.assetLog.fields.find((f) => f.name === "Event");
    const missing = loanEventsMissing(eventField);
    let waiting = false;
    for (const entry of CORRECTED) {
        const table = entry.table === ASSETS_TABLE_ID ? tables.assets : tables.assetLog;
        const target = entry.field === null ? table : table.fields.find((f) => f.name === entry.field);
        const what = entry.field === null ? `${table.name}'s description` : `${table.name}."${entry.field}"'s description`;
        if (!target) return finish(1, `${table.name} holds no ${entry.field}`);
        if ((target.description ?? "") === entry.description) {
            log(`  ${what} is the one this script writes`);
            continue;
        }
        if (entry.waitsFor && missing.length > 0) {
            log(`  ${what} waits for ${missing.join(" and ")}, which Event does not end on yet`);
            waiting = true;
            continue;
        }
        if (!apply) {
            log(`  would write ${what}`);
            pending = true;
            continue;
        }
        const path = entry.field === null ? `/bases/${baseId}/tables/${table.id}` : `/bases/${baseId}/tables/${table.id}/fields/${target.id}`;
        const sent = await request("PATCH", path, { description: entry.description });
        if (sent.refused) return finish(1, `${what} was refused`);
        log(`  wrote ${what}`);
    }

    if (pending) return finish(2, "dry run");
    if (waiting) {
        log("");
        log(`  HAND STEP, on this base: add ${LOAN_EVENTS.map((name) => `"${name}"`).join(" and ")} to Asset Log."Event" — scripts/import/ran/add_loan_events_598.mjs prints how.`);
        log("  Then run this again with --apply.");
        return finish(2, "Event's options are the hand step's");
    }

    // ── read back ────────────────────────────────────────────────────────────
    tables = await readTables(baseId);
    owner = tables.assets.fields.find((f) => f.name === OWNER_JOB_FIELD.name);
    const fault = ownerJobFault(owner);
    if (fault) return finish(1, `${OWNER_JOB_FIELD.name} is ${fault} on reading back`);
    const inverse = tables.jobs.fields.find((f) => f.id === owner.options.inverseLinkFieldId);
    if (inverse?.name !== OWNER_JOB_FIELD.inverse) return finish(1, `the far side reads ${JSON.stringify(inverse?.name)} on reading back`);
    for (const entry of CORRECTED) {
        const table = entry.table === ASSETS_TABLE_ID ? tables.assets : tables.assetLog;
        const target = entry.field === null ? table : table.fields.find((f) => f.name === entry.field);
        if ((target?.description ?? "") !== entry.description) return finish(1, `${table.name}.${entry.field ?? "(table)"}'s description did not read back as written`);
    }
    log(`  read back: ${OWNER_JOB_FIELD.name} → Jobs, far side "${OWNER_JOB_FIELD.inverse}", ${CORRECTED.length} descriptions`);
    return finish(0, "the base holds the field and its far side as specified");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
