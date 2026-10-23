// `Assets."Last Event At"` (#540): when each asset's latest `Asset Log` event happened, kept on the
// asset by Airtable as a rollup — made here on the test base, by hand on the live base, and
// described here on both.
//
// WHY THE FIELD. #540 sorts the Tools & Equipment list's kinds and a kind's items by their most
// recent change, which is the latest `Asset Log` row's `Event At`. Read off the log, that is a row
// per asset on every view — a whole job's on the list. A rollup puts the moment on the asset, so the
// list's status memory takes it with `Status` and `Asset ID` in the requests it already sends
// (`lib/assetStatusMemory.js`), and a kind's page has it on every asset it reads: neither screen
// reads more than it did. `docs/notes/tools.md` has the reads.
//
// MADE HERE ON THE TEST BASE AND BY HAND ON THE LIVE ONE, BECAUSE `Assets` IS THE SITE'S THERE
// (#531). Every request this script sends asks `scripts/protectedTables.mjs:refusesBeyondDescriptions`
// first, which lets anything through on the test base and, on the live base, a read of the schema
// and a description alone. So on the test base `--apply` creates the field, described; on the live
// base the create is refused before it leaves, the run prints the hand step and stops, and once Soo
// has made the field it checks the field's shape and writes its description.
//
// A ROLLUP THE API MAKES IS A DAY, SO ITS TIME IS A HAND STEP ON BOTH BASES. Created over `Event At`,
// a moment, the field came back on the test base with a `date` result, `M/D/YYYY`, and the records
// read `2026-10-14` — a day, which orders nothing within one. A rollup's options are not the API's to
// change afterwards: `options.result` was refused 422 `INVALID_REQUEST_UNKNOWN`, alone and beside the
// aggregation, and `options.formula` 422 with "The formula property can only be updated on formula
// fields". So once the field exists, a run that reads a day prints the step that turns its time on
// and stops; the field keeps its id through it.
//
// WHAT IT CHECKS. A rollup through `Asset Log` of `Asset Log."Event At"` whose result is a moment.
// The aggregation itself is not in what the Metadata API returns for a rollup — measured on the base's
// nine rollups, whose options carry the link, the field and the result type and no formula — so
// `MAX(values)` is the hand step's to set and the credentialed walk's to see (`tools.md`), and is
// named here only where the create asks for it.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_last_event_at_540.mjs            (dry run)
//   node --env-file=.env.local scripts/import/add_last_event_at_540.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (after the hand step: checks the field and writes its description)
//
// No loader flag: this file imports only built-ins, the guard's module and `lib/airtableBase.js`.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field as specified and described,
// 1 something failed or the field is not the one specified, 2 a dry run or a hand step outstanding.

import { refusesBeyondDescriptions } from "../protectedTables.mjs";
import { resolveAirtableBase } from "../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(). */
let airtable = null;

const SCRIPT = "add_last_event_at_540";

const META_ROOT = "https://api.airtable.com/v0/meta";

// The ids are the same on both bases: the test base was made by duplicating the live one (#534).
const ASSETS_TABLE_ID = "tblXtmDonSyOyOvV3";
const ASSET_LOG_TABLE_ID = "tblrox7y4akPKdbpF";
const LINK_NAME = "Asset Log";
const SOURCE_NAME = "Event At";

/** The field, as the create sends it once the two ids are read off the base. */
const FIELD_NAME = "Last Event At";
const AGGREGATION = "MAX(values)";
const DESCRIPTION =
    "Issue #540 -- when this asset's latest Asset Log event happened: a rollup of Asset Log.\"Event At\" through Asset Log, MAX(values), " +
    "kept by Airtable as each event is written. The Tools & Equipment list sorts its kinds by the latest of their items' (Recently updated) " +
    "and a kind's page sorts its items by it and draws each one's Updated day from it. The list's status memory reads it with Status and " +
    "Asset ID (lib/assetStatusMemory.js), and asks for an asset whose moment is past its last question, so the sort reads nothing more " +
    "than the counts did. Empty only for an asset whose registration wrote no first log row (#449), which the lists order as the newest. " +
    "Made by scripts/import/add_last_event_at_540.mjs on the test base and by hand on the live base, where no script reshapes this table (#531); " +
    "its time is turned on by hand on both, since the API makes a rollup of a moment a day and cannot change its format.";

// The format `Event At` itself has, which the rollup takes so the two read alike in the grid.
const FORMAT = "date format Local, Include time on, time format 12 hour, time zone GMT/UTC";

/** What Soo does on the live base, word for word, when the create is refused there. */
const HAND_STEP =
    `In Assets, add a field named "${FIELD_NAME}": type Rollup; linked records "${LINK_NAME}"; field to roll up "${SOURCE_NAME}"; ` +
    `aggregation formula ${AGGREGATION}; formatting ${FORMAT}. Leave the description empty: this script writes it.`;

/** What a field the API made needs before it reads a moment. */
const TIME_STEP = `In Assets, open "${FIELD_NAME}"'s settings and set its formatting: ${FORMAT}.`;

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

/** The two tables by id, as the base holds them now. */
async function readTables(baseId) {
    const { json } = await request("GET", `/bases/${baseId}/tables`);
    const assets = json.tables.find((t) => t.id === ASSETS_TABLE_ID);
    const assetLog = json.tables.find((t) => t.id === ASSET_LOG_TABLE_ID);
    if (!assets || !assetLog) throw new Error("the base holds no Assets or Asset Log by the ids this script was written against");
    return { assets, assetLog };
}

/**
 * Whether `field` is the rollup this script specifies, or why not: a rollup through `link` of
 * `source` whose result is a moment.
 */
function rollupFault(field, { link, source }) {
    if (!field) return "missing";
    if (field.type !== "rollup") return `a ${field.type}, not a rollup`;
    if (field.options?.recordLinkFieldId !== link?.id) return `rolled up through ${field.options?.recordLinkFieldId ?? "nothing"}, not ${LINK_NAME}`;
    if (field.options?.fieldIdInLinkedTable !== source?.id) return `rolling up ${field.options?.fieldIdInLinkedTable ?? "nothing"}, not ${SOURCE_NAME}`;
    if (field.options?.result?.type !== "dateTime") return `a ${field.options?.result?.type ?? "result of no type"}, not a moment — is the aggregation ${AGGREGATION}?`;
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
    log(`Assets."${FIELD_NAME}" — the latest Asset Log event's moment (#540)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const { assets, assetLog } = await readTables(baseId);
    const link = assets.fields.find((f) => f.name === LINK_NAME && f.type === "multipleRecordLinks");
    const source = assetLog.fields.find((f) => f.name === SOURCE_NAME);
    if (!link || !source) return finish(1, `no ${LINK_NAME} link on Assets or no ${SOURCE_NAME} on Asset Log`);

    let field = assets.fields.find((f) => f.name === FIELD_NAME);
    if (!field) {
        const body = {
            name: FIELD_NAME,
            type: "rollup",
            description: DESCRIPTION,
            options: { recordLinkFieldId: link.id, fieldIdInLinkedTable: source.id, formula: AGGREGATION },
        };
        if (!apply) {
            log(`  would create ${FIELD_NAME}: a rollup of ${source.id} through ${link.id}, ${AGGREGATION}`);
            return finish(2, "dry run");
        }
        const sent = await request("POST", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields`, body);
        if (sent.refused) {
            log("");
            log("  HAND STEP, on this base:");
            log(`  ${HAND_STEP}`);
            log("  Then run this again with --apply to check the field and write its description.");
            return finish(2, "the field is the hand step's on this base");
        }
        log(`  created ${FIELD_NAME} (${sent.json.id})`);
        field = (await readTables(baseId)).assets.fields.find((f) => f.name === FIELD_NAME);
    }

    if (field?.type === "rollup" && field.options?.result?.type === "date") {
        log("");
        log("  HAND STEP, on this base — the field reads a day:");
        log(`  ${TIME_STEP}`);
        log("  Then run this again with --apply.");
        return finish(2, "the field's time is the hand step's");
    }
    const fault = rollupFault(field, { link, source });
    if (fault) return finish(1, `${FIELD_NAME} is ${fault}`);
    log(`  ${FIELD_NAME} (${field.id}) is a rollup of ${SOURCE_NAME} through ${LINK_NAME}, a moment`);

    if ((field.description ?? "") !== DESCRIPTION) {
        if (!apply) {
            log("  would write its description");
            return finish(2, "dry run");
        }
        const sent = await request("PATCH", `/bases/${baseId}/tables/${ASSETS_TABLE_ID}/fields/${field.id}`, { description: DESCRIPTION });
        if (sent.refused) return finish(1, "the description was refused");
        const after = (await readTables(baseId)).assets.fields.find((f) => f.id === field.id);
        if ((after?.description ?? "") !== DESCRIPTION) return finish(1, "the description did not read back as written");
        log("  wrote its description, read back");
    } else log("  its description is the one this script writes");

    return finish(0, "the base holds the field as specified");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
