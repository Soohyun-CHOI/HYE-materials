// `Assets."Serial Number"` (#601): the serial number an asset's maker gave it, a single line of text —
// made by this script on both bases, so the two hold their fields in one order — with the descriptions
// the field makes false corrected beside it.
//
// WHY THE FIELD. Site managers wrote each item's serial number into its note (#533), where it was
// mixed with other words, could not be searched for or exported on its own, and nothing stopped one
// number from being given to two items of one kind. The field holds it alone; `lib/assetSerial.js` is
// what a typed one becomes and when a press writing one is refused. The numbers already in notes are
// #602's to move.
//
// ON THE LIVE BASE TOO, BY SOO'S LEAVE, AND NOTHING ELSE THERE. `Assets` is the site's on the live base
// (#531), and every request this script sends asks `scripts/protectedTables.mjs:
// refusesBeyondDescriptions` first, which lets this script alone (`SERIAL_NUMBER_SCHEMA`) make that one
// field, beyond a schema read and descriptions. No row is read or written.
//
// IT MUST STAND ON THE LIVE BASE BEFORE THE CODE READING IT IS DEPLOYED. The Equipment & Tools list's
// memory (`lib/airtable/assets.js`) names the field in the `fields` it reads and in the formula asking
// what changed, and Airtable refuses a read naming a field the table lacks whole (422
// `UNKNOWN_FIELD_NAME`, `docs/notes/airtable-access.md`), so the list would fail on a base without it.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_serial_number_601.mjs            (dry run)
//   node --env-file=.env.local scripts/import/add_serial_number_601.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (the live base, once Soo has approved it)
//
// No loader flag: this file imports only built-ins, the guard's module and `lib/airtableBase.js`.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field and every description as
// specified, 1 something failed or a field is not the one specified, 2 a dry run.

import { SERIAL_NUMBER_FIELD, SERIAL_NUMBER_SCHEMA, refusesBeyondDescriptions } from "../protectedTables.mjs";
import { resolveAirtableBase } from "../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(). */
let airtable = null;

const META_ROOT = "https://api.airtable.com/v0/meta";

// The id is the same on both bases: the test base was made by duplicating the live one (#534).
const ASSETS_TABLE_ID = SERIAL_NUMBER_FIELD.table;

const SERIAL_NUMBER_DESCRIPTION =
    "Issue #601 -- the serial number this asset's maker gave it, one line. Kept trimmed with runs of spaces collapsed and its case as typed, and " +
    "blank where it has none -- the app writes null to clear it. At most 50 characters, app-enforced. Two assets of one Category cannot hold one " +
    "serial number, compared without regard to case or surrounding spaces; a Deleted asset does not count and a Retired one does. The app reads " +
    "the base again as it saves and refuses, naming the asset that holds it (lib/assetSerial.js). Written, changed and cleared on the asset's page " +
    "by a site manager on the asset's Job while it is In stock or Out, as Note is (lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS); read by everyone " +
    "else. NOT AN EVENT: changing it appends no Asset Log row and moves neither Status nor Job. The Equipment & Tools list's search finds an asset " +
    "by it at any job, and its export carries it. Made by scripts/import/add_serial_number_601.mjs on both bases.";

/** The descriptions the field makes false, by field, rewritten whole (`null` is the table's own). */
const CORRECTED = [
    {
        field: null,
        description:
            "Issue #334, renamed from Tool Items in #513 -- one asset, a tool or a piece of equipment: the thing a QR label is stuck to. " +
            "Status and Job are caches of the last Asset Log row, written by the app in the same operation as that row and never by an Airtable formula: " +
            "the status that event left behind, and the job the asset is on after it. lib/assetStatus.js:STATUS_AFTER_EVENT holds the first mapping -- " +
            "nine events against five statuses -- and lib/assetStatus.js:JOB_SOURCE_OF_EVENT where each event's job comes from. Owner Job (#598) is no " +
            "cache: the job the asset belongs to, set at registration. Note (#533) and Serial Number (#601) are the two fields no event writes. A " +
            "deleted asset (#582) keeps its row, so its number stays taken, and the app shows it nowhere.",
    },
    {
        // It said "a site manager on a job", which #597 made false: only the asset's own job's.
        field: "Note",
        description:
            "Issue #533 -- one line a site manager keeps on this asset: what sets it apart from the others of its kind, or where it is kept. At most 50 " +
            "characters, trimmed with runs of spaces collapsed and case kept, and blank where it has none -- the app writes null to clear it. Written, " +
            "changed and cleared on the asset's page by a site manager on the asset's Job (#597) while the asset is In stock or Out " +
            "(lib/assetStatus.js:MAY_WRITE_NOTE_IN_STATUS); read by everyone else, and while it is In repair or Retired. NOT AN EVENT: changing it " +
            "appends no Asset Log row and moves neither Status nor Job, so nothing records who wrote it or when, and a category's list does not count it " +
            "as a change. Not printed on the label. lib/assetNote.js holds the rule. A serial number has a field of its own since #601, Serial Number.",
    },
];

let calls = 0;

function log(line = "") {
    console.log(line);
}

/** The one way this script reaches Airtable: asked of the guard before it is sent. */
async function request(method, path, body) {
    const url = `${META_ROOT}${path}`;
    if (refusesBeyondDescriptions({ script: SERIAL_NUMBER_SCHEMA, method, url, body, log })) return { refused: true };
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

/** `Assets` as the base holds it now. */
async function readAssets(baseId) {
    const { json } = await request("GET", `/bases/${baseId}/tables`);
    const assets = json.tables.find((t) => t.id === ASSETS_TABLE_ID);
    if (!assets) throw new Error("the base holds no Assets by the id this script was written against");
    return assets;
}

/** Whether `field` is the serial number's single line of text, or why not. */
function serialFault(field) {
    if (!field) return "missing";
    if (field.type !== SERIAL_NUMBER_FIELD.type) return `a ${field.type}, not a single line of text`;
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
    const baseId = airtable.baseId;
    log("=".repeat(72));
    log(`Assets."${SERIAL_NUMBER_FIELD.name}" (#601)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    let assets = await readAssets(baseId);
    let serial = assets.fields.find((f) => f.name === SERIAL_NUMBER_FIELD.name);
    let pending = false;

    // ── the field ────────────────────────────────────────────────────────────
    if (!serial) {
        if (!apply) {
            log(`  would create ${SERIAL_NUMBER_FIELD.name}: a single line of text, described`);
            pending = true;
        } else {
            const body = { name: SERIAL_NUMBER_FIELD.name, type: SERIAL_NUMBER_FIELD.type, description: SERIAL_NUMBER_DESCRIPTION };
            const sent = await request("POST", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields`, body);
            if (sent.refused) return finish(1, "the create was refused");
            log(`  created ${SERIAL_NUMBER_FIELD.name} (${sent.json.id})`);
            assets = await readAssets(baseId);
            serial = assets.fields.find((f) => f.name === SERIAL_NUMBER_FIELD.name);
        }
    }
    if (serial) {
        const fault = serialFault(serial);
        if (fault) return finish(1, `${SERIAL_NUMBER_FIELD.name} is ${fault}`);
        log(`  ${SERIAL_NUMBER_FIELD.name} (${serial.id}) is a single line of text`);
        if ((serial.description ?? "") !== SERIAL_NUMBER_DESCRIPTION) {
            if (!apply) {
                log(`  would write ${SERIAL_NUMBER_FIELD.name}'s description`);
                pending = true;
            } else {
                const sent = await request("PATCH", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields/${serial.id}`, { description: SERIAL_NUMBER_DESCRIPTION });
                if (sent.refused) return finish(1, "the description was refused");
                log(`  wrote ${SERIAL_NUMBER_FIELD.name}'s description`);
            }
        }
    }

    // ── the descriptions the field makes false ───────────────────────────────
    for (const entry of CORRECTED) {
        const target = entry.field === null ? assets : assets.fields.find((f) => f.name === entry.field);
        const what = entry.field === null ? "Assets' description" : `Assets."${entry.field}"'s description`;
        if (!target) return finish(1, `Assets holds no ${entry.field}`);
        if ((target.description ?? "") === entry.description) {
            log(`  ${what} is the one this script writes`);
            continue;
        }
        if (!apply) {
            log(`  would write ${what}`);
            pending = true;
            continue;
        }
        const path = entry.field === null ? `/bases/${baseId}/tables/${ASSETS_TABLE_ID}` : `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields/${target.id}`;
        const sent = await request("PATCH", path, { description: entry.description });
        if (sent.refused) return finish(1, `${what} was refused`);
        log(`  wrote ${what}`);
    }

    if (pending) return finish(2, "dry run");

    // ── read back ────────────────────────────────────────────────────────────
    assets = await readAssets(baseId);
    serial = assets.fields.find((f) => f.name === SERIAL_NUMBER_FIELD.name);
    const fault = serialFault(serial);
    if (fault) return finish(1, `${SERIAL_NUMBER_FIELD.name} is ${fault} on reading back`);
    if ((serial.description ?? "") !== SERIAL_NUMBER_DESCRIPTION) return finish(1, `${SERIAL_NUMBER_FIELD.name}'s description did not read back as written`);
    for (const entry of CORRECTED) {
        const target = entry.field === null ? assets : assets.fields.find((f) => f.name === entry.field);
        if ((target?.description ?? "") !== entry.description) return finish(1, `${entry.field ?? "the table"}'s description did not read back as written`);
    }
    log(`  read back: ${SERIAL_NUMBER_FIELD.name} (${serial.id}), a single line of text, and ${CORRECTED.length + 1} descriptions`);
    return finish(0, "the base holds the field as specified");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
