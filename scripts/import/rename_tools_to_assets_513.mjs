// Renames the tools axis's three tables to `Asset Categories`, `Assets` and `Asset Log`
// (#513), with every field and reverse link that named them, rewrites the descriptions
// that named them, and moves the printed ID family's token from `HYE-TL` to `HYE-AST` on
// every row that carries it.
//
// WHAT CHANGES. The axis holds equipment as well as tools, and the office calls each
// labeled thing an asset. `Tools` → `Asset Categories` and its primary `Tool Name` →
// `Item Name`, the shape `Material Categories` has one axis over; `Tool Items` → `Assets`,
// whose `Tool Item ID` → `Asset ID` and `Tool` → `Category`; `Tool Log` → `Asset Log`,
// whose `Tool Log ID` → `Asset Log ID` and `Tool Item` → `Asset`; and the reverse links
// those made on `Asset Categories`, `Assets`, `Jobs` and `Users` take the new table names.
// Thirteen renames, every one a Metadata PATCH. `Level 1`, `Level 2`, `Size`, `Class`,
// `Status`, `Job`, `Event`, `Recorded By`, `Event At` and `Checked Out To` keep their
// names: #514 decides the catalog's levels, and the rest name nothing that moved.
//
// BY ID, NEVER BY NAME, so a second run reads the base as the first one left it. A rename
// whose target name is already there is done; one whose source name is there is due;
// anything else is a base this script does not recognize, and it stops before writing.
// That is #333's procedure (`docs/notes/airtable-access.md`): eleven PATCHes by id, and
// the order irrelevant because no step looks a name up.
//
// THE CATALOG'S DESCRIPTIONS ARE NOT HERE. `create_tool_catalog_507.mjs` writes them on
// every run and compares them on the next, so it is their one owner; its constants carry
// the new names, and running it after this one writes them and checks the catalog. This
// rewrites the descriptions nothing else keeps: the other two tables', their fields', and
// one sentence on `Users."Last Name"`. Each rewrite is an edit of a sentence the live text
// holds, so a description somebody has changed by hand since is refused rather than
// overwritten.
//
// THE IDS KEEP THEIR DATE AND THEIR SEQUENCE. `HYE-TL-260909-004` becomes
// `HYE-AST-260909-004`, and its log rows `HYE-AST-260909-004-001` and on, so what a label
// prints — the id less its token (#411) — is the same string before and after, the daily
// counter reads the same highest sequence, and the order the ids sort in is unchanged.
// Moving only the token cannot make two rows meet, and the plan checks that anyway.
//
// A BASE-WIDE SCAN COMES FIRST. Every text field on every table is read for `HYE-TL`, and
// a hit outside the two ID fields stops the run: a copy of an id somewhere else would keep
// the old token after this, and the fix for that is a decision rather than a rewrite.
// #313 made the same scan before moving `HYE-PO`.
//
// THE LEDGER IS A TRACKED FILE BESIDE THIS SCRIPT, `rewrite_po_year_313.mjs`'s reason: a
// rollback on one machine is not a rollback. Each change is appended before the write that
// makes it, and `--revert` puts back every recorded change whose value still reads as this
// run left it, newest first.
//
// IT TALKS TO THE REST API DIRECTLY, for `create_tool_catalog_507.mjs`'s reason: the schema
// half has no SDK, and `lib/airtable/client.js` names tables by the names this changes.
// `lib/airtableOps.js` cannot see these calls, so the run counts them.
//
// Usage (from the repo root). Dry run is the DEFAULT:
//   node --env-file=.env.local scripts/import/rename_tools_to_assets_513.mjs
//   ... --apply                  write, recording a ledger first
//   ... --revert <ledger.jsonl>  put every recorded change back
//
// Nobody may record anything on the tools axis while this runs: a registration mid-run
// would mint under whichever token the code it runs on carries.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches, 1 something failed or
// was refused, 2 nothing failed but something is still to do (a dry run).

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ID_KINDS } from "../../lib/idSequence.js";

const API_ROOT = "https://api.airtable.com/v0";
const META_ROOT = `${API_ROOT}/meta`;

/** Beside this script, named for it — `rewrite_po_year_313.mjs` has the reason. */
const HERE = dirname(fileURLToPath(import.meta.url));
const LEDGER_PREFIX = "rename_tools_to_assets_513-";

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/** The five tables this touches, by id. */
const T = {
    CATEGORIES: "tblry47UEqLx86yaU",
    ASSETS: "tblXtmDonSyOyOvV3",
    LOG: "tblrox7y4akPKdbpF",
    JOBS: "tblGwgHuhTX6rwF1M",
    USERS: "tblisLwTKXyKtsTcy",
};

/** Every rename, a table's when `field` is absent. */
const RENAMES = [
    { table: T.CATEGORIES, from: "Tools", to: "Asset Categories" },
    { table: T.ASSETS, from: "Tool Items", to: "Assets" },
    { table: T.LOG, from: "Tool Log", to: "Asset Log" },
    { table: T.CATEGORIES, field: "fldxUK1eMyBtXYUq5", from: "Tool Name", to: "Item Name" },
    { table: T.CATEGORIES, field: "fldVB2nMSOh10EWZb", from: "Tool Items", to: "Assets" },
    { table: T.ASSETS, field: "fld6HZgsNJveHxmGs", from: "Tool Item ID", to: "Asset ID" },
    { table: T.ASSETS, field: "fldRp5DfpulOMXUer", from: "Tool", to: "Category" },
    { table: T.ASSETS, field: "fldGTKisQR07yPX3r", from: "Tool Log", to: "Asset Log" },
    { table: T.LOG, field: "fldyIvDherWjffWhs", from: "Tool Log ID", to: "Asset Log ID" },
    { table: T.LOG, field: "fldcXAGNlG86mIuwe", from: "Tool Item", to: "Asset" },
    { table: T.JOBS, field: "fldopAI3HzaObXgv8", from: "Tool Items", to: "Assets" },
    { table: T.JOBS, field: "fldyCeJ2wGMEq6JAo", from: "Tool Log", to: "Asset Log" },
    { table: T.USERS, field: "fldXwGkArgbMgenol", from: "Tool Log", to: "Asset Log" },
];

/**
 * The descriptions this owns, each as edits of sentences the live text holds: `[before,
 * after]`, every occurrence of `before` becoming `after`. A table's when `field` is
 * absent. The words are the base's own; what changes is a table, field or row named by its
 * retired name, the token, and a past-tense mention of an id the token moved on.
 */
const DESCRIPTIONS = [
    {
        table: T.USERS,
        field: "fldkraMbFJ12JY1PN",
        edits: [
            [
                "where the tools screens name who did something (a tool item's history and a refused scan, #463)",
                "where the asset screens name who did something (an asset's history and a refused scan, #463)",
            ],
        ],
    },
    {
        table: T.ASSETS,
        edits: [
            [
                "Issue #334 -- one physical tool, the thing a QR label is stuck to.",
                "Issue #334, renamed from Tool Items in #513 -- one asset, a tool or a piece of equipment: the thing a QR label is stuck to.",
            ],
            ["CACHES OF THE LAST Tool Log ROW", "CACHES OF THE LAST Asset Log ROW"],
            ["lib/toolStatus.js:STATUS_AFTER_EVENT holds the first mapping", "lib/assetStatus.js:STATUS_AFTER_EVENT holds the first mapping"],
        ],
    },
    {
        table: T.ASSETS,
        field: "fld6HZgsNJveHxmGs",
        edits: [
            [
                "Issue #334 -- format HYE-TL-YYMMDD-###, backend-generated",
                "Issue #334, renamed from Tool Item ID in #513 -- format HYE-AST-YYMMDD-###, backend-generated",
            ],
            [
                "counted over the rows whose Tool Item ID carries the same prefix, never over a date field (#164).",
                "counted over the rows whose Asset ID carries the same prefix, never over a date field (#164). The token was HYE-TL until #513, which moved it on every row and kept each date and sequence, so what a label prints did not change.",
            ],
            [
                "it is encoded into a QR label and glued to a tool. Two rows sharing one means two tools wearing the same label",
                "it is encoded into a QR label and glued to an asset. Two rows sharing one means two assets wearing the same label",
            ],
        ],
    },
    {
        table: T.ASSETS,
        field: "fldRp5DfpulOMXUer",
        edits: [
            [
                "Issue #334 -- the kind this unit is one of.",
                "Issue #334, renamed from Tool in #513 -- the Asset Categories row this asset is one of.",
            ],
        ],
    },
    {
        table: T.ASSETS,
        field: "fldMpl1xR9Sdwvehg",
        edits: [
            ["-- where this tool is now.", "-- where this asset is now."],
            ["nobody reports an individual tool item missing", "nobody reports an individual asset missing"],
            [
                "#363 weighed that and deleted the Tool Log.Notes field it would have lived in.",
                "#363 weighed that and deleted the log's Notes field, where it would have lived.",
            ],
            ["A DERIVED CACHE OF Tool Log, WRITTEN BY THE APP", "A DERIVED CACHE OF Asset Log, WRITTEN BY THE APP"],
            ["in the same operation as the Tool Log row that moved it", "in the same operation as the Asset Log row that moved it"],
            ["lib/toolStatus.js:STATUS_AFTER_EVENT holds the mapping;", "lib/assetStatus.js:STATUS_AFTER_EVENT holds the mapping;"],
        ],
    },
    {
        table: T.ASSETS,
        field: "fld4eMgKoBTUJF1v2",
        edits: [
            [
                "-- WHERE THIS TOOL WAS LAST SCANNED, cached from the last Tool Log row.",
                "-- WHERE THIS ASSET WAS LAST SCANNED, cached from the last Asset Log row.",
            ],
            ["saying which job owns the tool,", "saying which job owns the asset,"],
            [
                "so the Tool Log row inherits where the tool item already was",
                "so the Asset Log row inherits where the asset already was",
            ],
            ["lib/toolTransition.js:readRetirement hands it to createToolLogEntry", "lib/assetTransition.js:readRetirement hands it to createAssetLogEntry"],
        ],
    },
    {
        table: T.LOG,
        edits: [
            [
                "Issue #334 -- what has happened to one tool item.",
                "Issue #334, renamed from Tool Log in #513 -- what has happened to one asset.",
            ],
            ["Tool Items.Status is a cache of the last row here.", "Assets.Status is a cache of the last row here."],
        ],
    },
    {
        table: T.LOG,
        field: "fldyIvDherWjffWhs",
        edits: [
            [
                "Issue #334 -- format {Tool Item ID}-{seq}, resetting per tool item.",
                "Issue #334, renamed from Tool Log ID in #513 -- format {Asset ID}-{seq}, resetting per asset.",
            ],
            ['registered as "Tool Items::Tool Log" in', 'registered as "Assets::Asset Log" in'],
            ["WHICH IS THE CHILD WIDTH AND NOT Tool Item ID's.", "WHICH IS THE CHILD WIDTH AND NOT Asset ID's."],
            ["Tool Item ID is the other kind of sequence", "Asset ID is the other kind of sequence"],
            ["minted by lib/airtable/toolLog.js:createToolLogEntry.", "minted by lib/airtable/assetLog.js:createAssetLogEntry."],
        ],
    },
    {
        table: T.LOG,
        field: "fldcXAGNlG86mIuwe",
        edits: [
            [
                "Issue #334 -- the tool item this happened to.",
                "Issue #334, renamed from Tool Item in #513 -- the asset this happened to.",
            ],
            ['Its inverse, Tool Items."Tool Log", is what', 'Its inverse, Assets."Asset Log", is what'],
            ["is what getToolLogByToolItem walks", "is what getAssetLogByAsset walks"],
        ],
    },
    {
        table: T.LOG,
        field: "fldI7mM1DFKw6W41B",
        edits: [
            ["which is why Tool Items.Status is a mapping", "which is why Assets.Status is a mapping"],
            [
                "Created IS THE FIRST ROW OF EVERY TOOL ITEM'S HISTORY, and it exists because Tool Items carries no Created At.",
                "Created IS THE FIRST ROW OF EVERY ASSET'S HISTORY, and it exists because Assets carries no Created At.",
            ],
            ["answering when a tool item came into existence", "answering when an asset came into existence"],
            ["and lib/airtable/toolLog.js:createToolLogEntry refuses a missing one", "and lib/airtable/assetLog.js:createAssetLogEntry refuses a missing one"],
            ["lib/toolStatus.js:TOOL_EVENT is the source of truth", "lib/assetStatus.js:ASSET_EVENT is the source of truth"],
        ],
    },
    {
        table: T.LOG,
        field: "fldAE0bSiYOTuE9M0",
        edits: [
            ["-- the job the tool item was on at that event.", "-- the job the asset was on at that event."],
            ["THE DESIGNATED EVENT TAKES IT FROM THE TOOL ITEM.", "THE DESIGNATED EVENT TAKES IT FROM THE ASSET."],
            ['so a Retired row inherits Tool Items."Job" -- where it was.', 'so a Retired row inherits Assets."Job" -- where it was.'],
            [
                "HYE-TL-260909-004 was checked in on 26-DEMO-02",
                "HYE-TL-260909-004 -- HYE-AST-260909-004 since #513 -- was checked in on 26-DEMO-02",
            ],
            ['ITS OWN COPY, NOT A LOOKUP THROUGH Tool Items."Job".', 'ITS OWN COPY, NOT A LOOKUP THROUGH Assets."Job".'],
            ["REQUIRED, and by the app: lib/airtable/toolLog.js:createToolLogEntry throws on a missing job rather than writing an empty link, the same guard createToolItems opens with.", "REQUIRED, and by the app: lib/airtable/assetLog.js:createAssetLogEntry throws on a missing job rather than writing an empty link, the same guard createAssets opens with."],
        ],
    },
    {
        table: T.LOG,
        field: "fldqriB8aXyrOVdLG",
        edits: [
            [
                "which is why the tools pages open to every signed-in user (#337)",
                "which is why the asset pages open to every signed-in user (#337)",
            ],
        ],
    },
    {
        table: T.LOG,
        field: "fldF7WbZsbgkpgvSG",
        edits: [["The person this tool item was handed to.", "The person this asset was handed to."]],
    },
];

/** The family's token until #513, which nothing in the code spells any more. */
const OLD_TOKEN = "HYE-TL-";
/** The token `lib/idSequence.js` mints with, read rather than spelled again. */
const NEW_TOKEN = `${ID_KINDS.ASSET.token}-`;

/** The two fields an id is stored in: an asset's own, and a log row's, which opens with its asset's. */
const ID_FIELDS = [
    { table: T.ASSETS, field: "fld6HZgsNJveHxmGs", shape: /^HYE-(TL|AST)-\d{6}-\d{3,}$/ },
    { table: T.LOG, field: "fldyIvDherWjffWhs", shape: /^HYE-(TL|AST)-\d{6}-\d{3,}-\d{3,}$/ },
];

/** The text types a copied id could sit in, for the scan. */
const TEXT_TYPES = new Set(["singleLineText", "multilineText", "richText", "email", "url"]);

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const REVERT_AT = args.indexOf("--revert");
const REVERT_FILE = REVERT_AT === -1 ? null : args[REVERT_AT + 1];

class Airtable {
    constructor(token, baseId) {
        this.baseId = baseId;
        this.headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
        this.calls = 0;
    }

    async request(method, url, body) {
        this.calls++;
        // Five requests a second per base is Airtable's ceiling; this stays under it.
        await new Promise((resolve) => setTimeout(resolve, 220));
        const response = await fetch(url, {
            method,
            headers: this.headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) throw new Error(`${method} ${url.replace(this.baseId, "{base}")} -> ${response.status} ${text}`);
        return text === "" ? null : JSON.parse(text);
    }

    async tables() {
        return (await this.request("GET", `${META_ROOT}/bases/${this.baseId}/tables`)).tables;
    }

    patchTable(tableId, patch) {
        return this.request("PATCH", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}`, patch);
    }

    patchField(tableId, fieldId, patch) {
        return this.request("PATCH", `${META_ROOT}/bases/${this.baseId}/tables/${tableId}/fields/${fieldId}`, patch);
    }

    /** Every row of a table, the given fields by id. */
    async listRecords(tableId, fieldIds) {
        const out = [];
        let offset;
        do {
            const params = new URLSearchParams({ pageSize: "100", returnFieldsByFieldId: "true" });
            for (const f of fieldIds) params.append("fields[]", f);
            if (offset) params.set("offset", offset);
            const page = await this.request("GET", `${API_ROOT}/${this.baseId}/${tableId}?${params}`);
            out.push(...page.records);
            offset = page.offset;
        } while (offset);
        return out;
    }

    /** No `typecast`: every value is a string into a text field. */
    updateRecords(tableId, records) {
        return this.request("PATCH", `${API_ROOT}/${this.baseId}/${tableId}`, { records });
    }
}

function log(message = "") {
    console.log(message);
}

/** A table or field as the schema holds it now, or null. */
function liveOf(tables, { table, field }) {
    const t = tables.find((x) => x.id === table);
    if (!t) return null;
    return field ? t.fields.find((f) => f.id === field) ?? null : t;
}

/** How one target is named in output: `Assets."Asset ID"` by whatever it is called now. */
function nameOf(tables, { table, field }) {
    const t = tables.find((x) => x.id === table);
    const f = field ? t?.fields.find((x) => x.id === field) : null;
    return field ? `${t?.name ?? table}."${f?.name ?? field}"` : `${t?.name ?? table}`;
}

/** What one description becomes, or the reason it cannot. */
function editDescription(text, edits) {
    let next = text;
    for (const [before, after] of edits) {
        if (next.includes(before)) next = next.split(before).join(after);
        else if (!next.includes(after)) return { problem: `holds neither ${JSON.stringify(before.slice(0, 60))} nor its edit` };
    }
    return { next };
}

/** Every change this run would make, and anything that stops it. */
async function plan(air) {
    const tables = await air.tables();
    const problems = [];
    const changes = [];

    // --- the names ---------------------------------------------------------
    for (const r of RENAMES) {
        const live = liveOf(tables, r);
        if (!live) problems.push(`${r.field ? `field ${r.field} on ` : ""}table ${r.table} is not on the base`);
        else if (live.name === r.to) continue;
        else if (live.name !== r.from) problems.push(`${nameOf(tables, r)} is neither ${JSON.stringify(r.from)} nor ${JSON.stringify(r.to)}`);
        else changes.push({ kind: "name", table: r.table, field: r.field ?? null, before: r.from, after: r.to });
    }
    for (const r of RENAMES.filter((x) => x.field)) {
        const t = tables.find((x) => x.id === r.table);
        const taken = t?.fields.find((f) => f.name === r.to && f.id !== r.field);
        if (taken) problems.push(`${t.name} already has a field named ${JSON.stringify(r.to)} (${taken.id})`);
    }

    // --- the descriptions --------------------------------------------------
    for (const d of DESCRIPTIONS) {
        const live = liveOf(tables, d);
        if (!live) {
            problems.push(`${d.field ?? d.table} is not on the base`);
            continue;
        }
        const before = live.description ?? "";
        const { next, problem } = editDescription(before, d.edits);
        if (problem) problems.push(`${nameOf(tables, d)}'s description ${problem}`);
        else if (next !== before) changes.push({ kind: "description", table: d.table, field: d.field ?? null, before, after: next });
    }

    // --- the ids, and the scan for a copy of one anywhere else -------------
    const idFieldIds = new Set(ID_FIELDS.map((f) => f.field));
    let scanned = 0;
    for (const t of tables) {
        const textFields = t.fields.filter((f) => TEXT_TYPES.has(f.type) && !idFieldIds.has(f.id));
        if (textFields.length === 0) continue;
        const rows = await air.listRecords(t.id, textFields.map((f) => f.id));
        scanned += rows.length;
        for (const row of rows) {
            for (const f of textFields) {
                const value = row.fields[f.id];
                if (typeof value === "string" && value.includes("HYE-TL")) {
                    problems.push(`${t.name}."${f.name}" ${row.id} holds ${JSON.stringify(value.slice(0, 80))}`);
                }
            }
        }
    }
    log(`  scanned ${scanned} row(s) on ${tables.length} tables for a copy of an id outside the two id fields`);

    for (const target of ID_FIELDS) {
        const rows = await air.listRecords(target.table, [target.field]);
        const values = new Set(rows.map((r) => r.fields[target.field]));
        let already = 0;
        for (const row of rows) {
            const value = row.fields[target.field] ?? "";
            if (!target.shape.test(value)) {
                problems.push(`${nameOf(tables, target)} ${row.id}: ${JSON.stringify(value)} is not an id of this family`);
            } else if (value.startsWith(NEW_TOKEN)) {
                already++;
            } else {
                const after = `${NEW_TOKEN}${value.slice(OLD_TOKEN.length)}`;
                if (values.has(after)) problems.push(`${nameOf(tables, target)} ${row.id}: ${after} is already on another row`);
                changes.push({ kind: "record", table: target.table, field: target.field, id: row.id, before: value, after });
            }
        }
        const moving = changes.filter((c) => c.kind === "record" && c.field === target.field).length;
        log(`  ${nameOf(tables, target)}: ${rows.length} row(s), ${moving} to move, ${already} already ${NEW_TOKEN}`);
    }

    return { tables, changes, problems };
}

/** Print every change, descriptions as the paragraphs that differ. */
function describe(tables, changes) {
    for (const c of changes.filter((x) => x.kind === "name")) {
        log(`  [NAME]   ${c.field ? `${nameOf(tables, { table: c.table })}.` : "table "}${JSON.stringify(c.before)} -> ${JSON.stringify(c.after)}`);
    }
    for (const c of changes.filter((x) => x.kind === "description")) {
        log(`  [DESC]   ${nameOf(tables, c)}`);
        const was = c.before.split("\n\n");
        const now = c.after.split("\n\n");
        for (let i = 0; i < Math.max(was.length, now.length); i++) {
            if (was[i] === now[i]) continue;
            log(`     - ${was[i] ?? ""}`);
            log(`     + ${now[i] ?? ""}`);
        }
    }
    const records = changes.filter((x) => x.kind === "record");
    if (records.length > 0) {
        log(`  [IDS]    ${records.length} value(s), each ${OLD_TOKEN}… -> ${NEW_TOKEN}…, e.g.`);
        for (const c of records.slice(0, 3)) log(`             ${c.before}  ->  ${c.after}`);
    }
}

/** Write one change, after the ledger holds it. */
async function write(air, change) {
    if (change.kind === "name") {
        if (change.field) await air.patchField(change.table, change.field, { name: change.after });
        else await air.patchTable(change.table, { name: change.after });
    } else if (change.kind === "description") {
        if (change.field) await air.patchField(change.table, change.field, { description: change.after });
        else await air.patchTable(change.table, { description: change.after });
    }
}

async function apply(air, changes) {
    const ledger = join(HERE, `${LEDGER_PREFIX}${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);
    log(`\nledger: ${ledger}  (commit it — rewrite_po_year_313.mjs has the reason)`);
    for (const c of changes.filter((x) => x.kind !== "record")) {
        appendFileSync(ledger, `${JSON.stringify(c)}\n`, "utf8");
        await write(air, c);
        log(`  [${c.kind === "name" ? "NAME" : "DESC"}]   ${c.table}${c.field ? `.${c.field}` : ""} written`);
    }
    for (const target of ID_FIELDS) {
        const mine = changes.filter((c) => c.kind === "record" && c.field === target.field);
        for (let i = 0; i < mine.length; i += RECORDS_PER_REQUEST) {
            const chunk = mine.slice(i, i + RECORDS_PER_REQUEST);
            appendFileSync(ledger, chunk.map((c) => JSON.stringify(c)).join("\n") + "\n", "utf8");
            await air.updateRecords(target.table, chunk.map((c) => ({ id: c.id, fields: { [c.field]: c.after } })));
        }
        if (mine.length > 0) log(`  [IDS]    ${target.table}.${target.field}: ${mine.length} written`);
    }
}

/** Put back every recorded change whose value still reads as the run left it, newest first. */
async function revert(air, file) {
    const entries = readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)).reverse();
    log(`reverting ${entries.length} change(s) from ${file}`);
    const records = entries.filter((e) => e.kind === "record");
    for (const target of ID_FIELDS) {
        const mine = records.filter((e) => e.field === target.field);
        if (mine.length === 0) continue;
        const now = new Map((await air.listRecords(target.table, [target.field])).map((r) => [r.id, r.fields[target.field]]));
        const due = mine.filter((e) => now.get(e.id) === e.after);
        for (let i = 0; i < due.length; i += RECORDS_PER_REQUEST) {
            await air.updateRecords(target.table, due.slice(i, i + RECORDS_PER_REQUEST).map((e) => ({ id: e.id, fields: { [e.field]: e.before } })));
        }
        log(`  ${target.table}.${target.field}: ${due.length} put back, ${mine.length - due.length} no longer as written`);
    }
    for (const e of entries.filter((x) => x.kind !== "record")) {
        const live = liveOf(await air.tables(), e);
        const value = e.kind === "name" ? live?.name : live?.description ?? "";
        if (value !== e.after) {
            log(`  [SKIP]   ${e.kind} of ${e.table}${e.field ? `.${e.field}` : ""}: no longer as written`);
            continue;
        }
        await write(air, { ...e, after: e.before });
        log(`  [BACK]   ${e.kind} of ${e.table}${e.field ? `.${e.field}` : ""}`);
    }
}

function finish(air, code, verdict) {
    log("");
    log(`${air.calls} Airtable API call(s). ${verdict}.`);
    return code;
}

async function main() {
    const token = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    if (!token || !baseId) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const air = new Airtable(token, baseId);

    if (REVERT_FILE) {
        await revert(air, REVERT_FILE);
        return finish(air, 2, "reverted — run with no flags to see what is left");
    }

    log(`rename_tools_to_assets_513 — base ${baseId}${APPLY ? "" : "  (DRY RUN — nothing is written)"}\n`);
    const { tables, changes, problems } = await plan(air);
    if (problems.length > 0) {
        log(`\nREFUSING, before any write:`);
        for (const p of problems) log(`  ${p}`);
        return finish(air, 1, "nothing was written");
    }
    if (changes.length === 0) {
        log(`\nNothing to change: every name, description and id is as #513 leaves it.`);
        return finish(air, 0, "the base matches");
    }

    log(`\n${changes.length} change(s):`);
    describe(tables, changes);
    if (!APPLY) return finish(air, 2, `dry run — re-run with --apply to write these ${changes.length}`);

    await apply(air, changes);

    log(`\nverifying against the live base:`);
    const after = await plan(air);
    if (after.problems.length > 0 || after.changes.length > 0) {
        for (const p of after.problems) log(`  ${p}`);
        for (const c of after.changes) log(`  still to do: ${c.kind} ${c.table}${c.field ? `.${c.field}` : ""}${c.id ? ` ${c.id}` : ""}`);
        return finish(air, 1, "the base does not match after the run");
    }
    log(`  every name, description and id reads as written.`);
    return finish(air, 0, "the base matches");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
