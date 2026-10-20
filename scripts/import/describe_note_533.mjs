// Reads `Assets."Note"` on the base this run reaches, and writes its description — nothing else.
//
// THE FIELD IS SOO'S, MADE BY HAND (#533). An item's note is a single line of text on `Assets`,
// and Soo added it in the Airtable UI on the test base and on the live base, with no description.
// So this makes no field: it reads the base's schema and stops unless `Assets` holds a field named
// `Note` that is a single line of text with no options, and then gives it the description below —
// what the column holds, who writes it, and that it is no event.
//
// THE DESCRIPTION ALONE, BECAUSE `Assets` HOLDS THE SITE'S RECORDS (#531). A description says
// what a column holds and touches no row, which is why `scripts/protectedTables.mjs` lets one
// through on the live base and nothing else: every request this sends asks
// `refusesBeyondDescriptions` first, so a body carrying a name, a type or options, or any request
// to a row, is refused before it leaves. It sends one GET of the schema before and one after, and
// one PATCH.
//
// IT STOPS ON A DESCRIPTION IT DID NOT EXPECT. The field was made with none, so the one it may
// write over is the empty one; a description that is already this one is a target written, and
// a second run writes nothing and still re-reads; anything else is somebody else's edit, and
// nothing is written.
//
// A LEDGER BEFORE THE PATCH. `--apply` writes the base — `live` or `test`, as the run named it —
// the field and its description before and after to
// `scripts/import/ledgers/describe_note_533-<base>-<instant>.jsonl` first, the shape the other
// ledgers there take.
//
// AND IT LOOKS AFTERWARDS. The re-read compares `Assets` whole against the read before: every
// field's id, name, type, options and description but this one's, the table's name, primary field
// and description — and this one's must read as written.
//
// Usage (from the repo root) — the test base unless the run names the live one (#534):
//   node --env-file=.env.local scripts/import/describe_note_533.mjs                      (dry run)
//   node --env-file=.env.local scripts/import/describe_note_533.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/describe_note_533.mjs   (dry run, live)
//
// No loader flag: this file imports only built-ins, the guard's module and the base's.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the field reads as written, 1 something failed or
// the field is not the one this expects, 2 a dry run.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { refusesBeyondDescriptions } from "../protectedTables.mjs";
import { describeAirtableBase, resolveAirtableBase } from "../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(): the test base unless the run names the live one. */
let airtable = null;

const SCRIPT = "describe_note_533";

const META_ROOT = "https://api.airtable.com/v0/meta";

const LEDGER_DIR = join(dirname(fileURLToPath(import.meta.url)), "ledgers");

/** `Assets`, by the id both bases share (the test base was made by duplicating the live one, #534). */
const TABLE = { name: "Assets", id: "tblXtmDonSyOyOvV3" };

/** The field, by the name Soo gave it on both bases: its id differs from base to base. */
const FIELD = { name: "Note", type: "singleLineText" };

/** What the field says it holds, once this has run. */
const DESCRIPTION =
    "Issue #533 -- one line a site manager keeps on this asset: what sets it apart from the others of its kind, " +
    "or where it is kept. At most 50 characters, trimmed with runs of spaces collapsed and case kept, and blank " +
    "where it has none -- the app writes null to clear it. Written, changed and cleared on the asset's page by a " +
    "site manager on a job while the asset is In stock or Out (lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS); read " +
    "by everyone else, and while it is In repair or Retired. NOT AN EVENT: changing it appends no Asset Log row and " +
    "moves neither Status nor Job, so nothing records who wrote it or when, and a category's list does not count it " +
    "as a change. Not printed on the label. lib/assetNote.js holds the rule.";

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

/** What is wrong with the field as read, or null when it is the one this expects. */
function fieldProblem(table) {
    if (table.name !== TABLE.name) return `${TABLE.id} is called "${table.name}", not ${TABLE.name}`;
    const named = table.fields.filter((f) => f.name === FIELD.name);
    if (named.length === 0) return `${TABLE.name} holds no field named ${FIELD.name} — make it by hand first`;
    if (named.length > 1) return `${TABLE.name} holds ${named.length} fields named ${FIELD.name}`;
    const [field] = named;
    if (field.type !== FIELD.type) return `${TABLE.name}."${FIELD.name}" is a ${field.type}, not a ${FIELD.type}`;
    if (field.options && Object.keys(field.options).length > 0) return `${TABLE.name}."${FIELD.name}" carries options ${JSON.stringify(field.options)}`;
    return null;
}

/** Every fact of the table but this field's description, for the before-and-after. */
function shape(table, fieldId) {
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
            description: f.id === fieldId ? null : f.description ?? "",
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
    log(`${TABLE.name}."${FIELD.name}" — read, and described (#533)`);
    log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readTable(baseId);
    const problem = fieldProblem(before);
    if (problem) {
        log(`  STOPPED: ${problem}`);
        log("  Nothing was written.");
        return finish(1, "the field is not the one this expects");
    }
    const field = before.fields.find((f) => f.name === FIELD.name);
    log(`  ${TABLE.name}."${FIELD.name}" is ${field.id}, a ${field.type} with no options`);

    const now = field.description ?? "";
    if (now === DESCRIPTION) {
        log("  its description is already the one this writes");
        return finish(0, "the field reads as written");
    }
    if (now !== "") {
        log("  STOPPED: its description is neither empty nor the one this writes — somebody else's edit:");
        log(now);
        log("  Nothing was written.");
        return finish(1, "a description this did not expect");
    }

    log("");
    log("BEFORE: (no description)");
    log("");
    log("AFTER:");
    log(DESCRIPTION);

    if (!apply) {
        log("");
        log("=".repeat(72));
        log("DRY RUN — 1 description would be written and none was.");
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
        JSON.stringify({ kind: "description", base: airtable.live ? "live" : "test", table: TABLE.id, field: field.id, at, before: now, after: DESCRIPTION }) + "\n"
    );
    log("");
    log(`ledger: ${ledger}`);

    await request("PATCH", `/bases/${baseId}/tables/${TABLE.id}/fields/${field.id}`, { description: DESCRIPTION });
    log(`  written: ${TABLE.name}."${FIELD.name}"`);

    const after = await readTable(baseId);
    const problems = [];
    if (shape(after, field.id) !== shape(before, field.id)) problems.push(`${TABLE.name} changed beyond this field's description`);
    const written = after.fields.find((f) => f.id === field.id);
    if (!written || written.name !== FIELD.name) problems.push(`${field.id} is no longer ${FIELD.name}`);
    if ((written?.description ?? "") !== DESCRIPTION) problems.push(`${TABLE.name}."${FIELD.name}" does not read as written`);
    log("");
    log("re-read from the base:");
    if (problems.length > 0) {
        for (const p of problems) log(`  WRONG: ${p}`);
        return finish(1, `${problems.length} problem(s)`);
    }
    log(`  ${TABLE.name}."${FIELD.name}": name kept, description as written`);
    log("  every other field of the table, and the table itself: id, name, type, options and description unchanged");
    return finish(0, "the field reads as written");
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
