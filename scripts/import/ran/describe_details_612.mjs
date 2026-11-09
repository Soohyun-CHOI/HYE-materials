// Reads `Assets."Note"` and `Assets."Serial Number"` on the base this run reaches, and rewrites the
// description of each — nothing else.
//
// THE TWO DESCRIPTIONS SAY WHO WRITES THE FIELD, AND #612 MADE THAT FALSE. Both said a site manager
// on the asset's Job writes it while the asset is In stock or Out, after
// `lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS`; since #612 the same site manager writes either in
// any status the app shows — In stock, Out, In repair or Retired — and that map is gone
// (`mayWriteDetailsIn`, a reading of the shown map). So this changes the one clause in each, and every
// other word stands as `scripts/import/ran/add_serial_number_601.mjs` wrote it.
//
// THE DESCRIPTIONS ALONE, BECAUSE `Assets` HOLDS THE SITE'S RECORDS (#531). A description says what a
// column holds and touches no row, which is why `scripts/protectedTables.mjs` lets one through on the
// live base and nothing else: every request this sends asks `refusesBeyondDescriptions` first, so a
// body carrying a name, a type or options, or any request to a row, is refused before it leaves. It
// sends one GET of the schema before and one after, and one PATCH per field it rewrites.
//
// IT STOPS ON A DESCRIPTION IT DID NOT EXPECT. Each field may hold #601's description, which this
// rewrites, or this one, which is a target written and rewritten by nobody; anything else is somebody
// else's edit, and nothing is written to either field.
//
// ONE PATH IN THE SERIAL NUMBER'S HAS MOVED SINCE ITS RUN. This wrote that the field was made by
// `scripts/import/add_serial_number_601.mjs`, which #602 had already moved into `ran/`, and its
// ledgers keep that sentence. `describe_serial_path_612.mjs` put the `ran/` path in its place on both
// bases, every other character as this wrote it, and `now` here is the corrected sentence.
//
// A LEDGER BEFORE THE PATCHES. `--apply` writes the base — `live` or `test`, as the run named it —
// each field and its description before and after to
// `scripts/import/ledgers/describe_details_612-<base>-<instant>.jsonl` first, the shape the other
// ledgers there take.
//
// AND IT LOOKS AFTERWARDS. The re-read compares `Assets` whole against the read before: every field's
// id, name, type, options and description but these two's, the table's name, primary field and
// description — and these two must read as written.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/ran/describe_details_612.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/ran/describe_details_612.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/describe_details_612.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins, the guard's module and the base's.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 both fields read as written, 1 something failed or a
// field is not the one this expects, 2 a dry run.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusesBeyondDescriptions } from "../../protectedTables.mjs";
import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "describe_details_612";

const META_ROOT = "https://api.airtable.com/v0/meta";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "ledgers");

/** `Assets`, by the id both bases share (the test base was made by duplicating the live one, #534). */
const TABLE = { name: "Assets", id: "tblXtmDonSyOyOvV3" };

/**
 * The two fields, by name — their ids differ from base to base — each with the description #601 left
 * on it (`was`) and the one this writes (`now`). Only the clause on who writes it moves.
 */
const FIELDS = [
    {
        name: "Note",
        type: "singleLineText",
        was:
            "Issue #533 -- one line a site manager keeps on this asset: what sets it apart from the others of its kind, or where it is kept. At most 50 " +
            "characters, trimmed with runs of spaces collapsed and case kept, and blank where it has none -- the app writes null to clear it. Written, " +
            "changed and cleared on the asset's page by a site manager on the asset's Job (#597) while the asset is In stock or Out " +
            "(lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS); read by everyone else, and while it is In repair or Retired. NOT AN EVENT: changing it " +
            "appends no Asset Log row and moves neither Status nor Job, so nothing records who wrote it or when, and a category's list does not count it " +
            "as a change. Not printed on the label. lib/assetNote.js holds the rule. A serial number has a field of its own since #601, Serial Number.",
        now:
            "Issue #533 -- one line a site manager keeps on this asset: what sets it apart from the others of its kind, or where it is kept. At most 50 " +
            "characters, trimmed with runs of spaces collapsed and case kept, and blank where it has none -- the app writes null to clear it. Written, " +
            "changed and cleared on the asset's page by a site manager on the asset's Job (#597) in any status the app shows -- In stock, Out, In repair " +
            "or Retired (#612, lib/assetStatus.js:mayWriteDetailsIn); read by everyone else. NOT AN EVENT: changing it " +
            "appends no Asset Log row and moves neither Status nor Job, so nothing records who wrote it or when, and a category's list does not count it " +
            "as a change. Not printed on the label. lib/assetNote.js holds the rule. A serial number has a field of its own since #601, Serial Number.",
    },
    {
        name: "Serial Number",
        type: "singleLineText",
        was:
            "Issue #601 -- the serial number this asset's maker gave it, one line. Kept trimmed with runs of spaces collapsed and its case as typed, and " +
            "blank where it has none -- the app writes null to clear it. At most 50 characters, app-enforced. Two assets of one Category cannot hold one " +
            "serial number, compared without regard to case or surrounding spaces; a Deleted asset does not count and a Retired one does. The app reads " +
            "the base again as it saves and refuses, naming the asset that holds it (lib/assetSerial.js). Written, changed and cleared on the asset's page " +
            "by a site manager on the asset's Job while it is In stock or Out, as Note is (lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS); read by everyone " +
            "else. NOT AN EVENT: changing it appends no Asset Log row and moves neither Status nor Job. The Equipment & Tools list's search finds an asset " +
            "by it at any job, and its export carries it. Made by scripts/import/add_serial_number_601.mjs on both bases.",
        now:
            "Issue #601 -- the serial number this asset's maker gave it, one line. Kept trimmed with runs of spaces collapsed and its case as typed, and " +
            "blank where it has none -- the app writes null to clear it. At most 50 characters, app-enforced. Two assets of one Category cannot hold one " +
            "serial number, compared without regard to case or surrounding spaces; a Deleted asset does not count and a Retired one does. The app reads " +
            "the base again as it saves and refuses, naming the asset that holds it (lib/assetSerial.js). Written, changed and cleared on the asset's page " +
            "by a site manager on the asset's Job in any status the app shows, as Note is (#612, lib/assetStatus.js:mayWriteDetailsIn); read by everyone " +
            "else. NOT AN EVENT: changing it appends no Asset Log row and moves neither Status nor Job. The Equipment & Tools list's search finds an asset " +
            "by it at any job, and its export carries it. Made by scripts/import/ran/add_serial_number_601.mjs on both bases.",
    },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

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

/** `Assets` as the base holds it now. */
async function readTable(baseId) {
    const { tables } = await request("GET", `/bases/${baseId}/tables`);
    const table = tables.find((t) => t.id === TABLE.id);
    if (!table) throw new Error(`no table ${TABLE.id} on this base`);
    return table;
}

/** What is wrong with one field as read, or null when it is the one this expects. */
function fieldProblem(table, spec) {
    const named = table.fields.filter((f) => f.name === spec.name);
    if (named.length === 0) return `${TABLE.name} holds no field named ${spec.name}`;
    if (named.length > 1) return `${TABLE.name} holds ${named.length} fields named ${spec.name}`;
    const [field] = named;
    if (field.type !== spec.type) return `${TABLE.name}."${spec.name}" is a ${field.type}, not a ${spec.type}`;
    if (field.options && Object.keys(field.options).length > 0) return `${TABLE.name}."${spec.name}" carries options ${JSON.stringify(field.options)}`;
    const said = field.description ?? "";
    if (said !== spec.was && said !== spec.now) return `${TABLE.name}."${spec.name}"'s description is neither #601's nor this one — somebody else's edit:\n${said}`;
    return null;
}

/** Every fact of the table but these fields' descriptions, for the before-and-after. */
function shape(table, fieldIds) {
    return JSON.stringify({
        id: table.id,
        name: table.name,
        primaryFieldId: table.primaryFieldId,
        description: table.description ?? "",
        fields: table.fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            options: f.options ?? null,
            description: fieldIds.includes(f.id) ? null : f.description ?? "",
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
    log(`${TABLE.name}."Note" and ."Serial Number" — read, and described (#612)`);
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTable(baseId);
    if (before.name !== TABLE.name) {
        log(`  STOPPED: ${TABLE.id} is called "${before.name}", not ${TABLE.name}. Nothing was written.`);
        return finish(1, "the table is not the one this expects");
    }
    const problems = FIELDS.map((spec) => fieldProblem(before, spec)).filter(Boolean);
    if (problems.length > 0) {
        for (const problem of problems) log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "a field is not the one this expects");
    }
    const fields = FIELDS.map((spec) => ({ spec, field: before.fields.find((f) => f.name === spec.name) }));
    const pending = fields.filter(({ spec, field }) => (field.description ?? "") !== spec.now);
    for (const { spec, field } of fields) {
        log(`  ${TABLE.name}."${spec.name}" is ${field.id}: ${pending.some((p) => p.field.id === field.id) ? "#601's description, to rewrite" : "already this one"}`);
    }
    if (pending.length === 0) return finish(0, "both fields read as written");

    for (const { spec } of pending) {
        log("");
        log(`${spec.name} AFTER:`);
        log(spec.now);
    }

    if (!apply) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${pending.length} description(s) would be written and none was.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    mkdirSync(LEDGER_DIR, { recursive: true });
    const at = new Date().toISOString();
    const ledger = join(LEDGER_DIR, `${SCRIPT}-${airtable.live ? "live" : "test"}-${at.replace(/[:.]/g, "-")}.jsonl`);
    // The base is named as the run named it, `live` or `test` — the live base's id is written in
    // `lib/airtableBase.js` and nowhere else (`offline/airtable-base.mjs`), the #544 ledgers' shape.
    writeFileSync(
        ledger,
        pending
            .map(({ spec, field }) =>
                JSON.stringify({ kind: "description", base: airtable.live ? "live" : "test", table: TABLE.id, field: field.id, at, before: field.description ?? "", after: spec.now })
            )
            .join("\n") + "\n"
    );
    log("");
    log(`ledger: ${ledger}`);

    for (const { spec, field } of pending) {
        await request("PATCH", `/bases/${baseId}/tables/${TABLE.id}/fields/${field.id}`, { description: spec.now });
        log(`  written: ${TABLE.name}."${spec.name}"`);
    }

    const after = await readTable(baseId);
    const ids = fields.map(({ field }) => field.id);
    const wrong = [];
    if (shape(after, ids) !== shape(before, ids)) wrong.push(`${TABLE.name} changed beyond these fields' descriptions`);
    for (const { spec, field } of fields) {
        const written = after.fields.find((f) => f.id === field.id);
        if (!written || written.name !== spec.name) wrong.push(`${field.id} is no longer ${spec.name}`);
        if ((written?.description ?? "") !== spec.now) wrong.push(`${TABLE.name}."${spec.name}" does not read as written`);
    }
    log("");
    log("re-read from the base:");
    if (wrong.length > 0) {
        for (const p of wrong) log(`  WRONG: ${p}`);
        return finish(1, `${wrong.length} problem(s)`);
    }
    log(`  ${TABLE.name}."Note" and ."Serial Number": names kept, descriptions as written`);
    log("  every other field of the table, and the table itself: id, name, type, options and description unchanged");
    return finish(0, "both fields read as written");
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
