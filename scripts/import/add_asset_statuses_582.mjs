// `Asset Categories."Asset Statuses"` (#582): the statuses of the assets filed under each catalog
// row, joined, kept by Airtable as a rollup — made here on the test base, by hand on the live base,
// and described here on both.
//
// WHY THE FIELD. #582 deletes an item by giving it the status `Deleted`, and a deleted item is
// counted nowhere. The catalog's page (1l, #527) says how many items stand under each row, and
// whether a row may be taken out, off the row's `Assets` link alone — it reads no asset — so a
// deleted item would go on counting there. Reading the items' statuses on that page would be reads
// it does not make. A rollup puts them on the row, which the page reads whole already, so it reads
// nothing more: `lib/assetCategory.js:itemCountOf` counts the link less the statuses the app does not
// show (`lib/assetStatus.js:shownIn`). Airtable joins the values and judges nothing — which statuses
// count is the app's.
//
// MADE HERE ON THE TEST BASE AND BY HAND ON THE LIVE ONE, as `add_last_event_at_540.mjs` made its
// rollup: every request asks `scripts/protectedTables.mjs:refusesBeyondDescriptions` first, which
// lets anything through on the test base and on the live base a read of the schema and a
// description alone. So on the test base `--apply` creates the field, described; on the live base
// the create is refused before it leaves, the run prints the hand step and stops, and once Soo has
// made the field it checks the field's shape and writes its description.
//
// WHAT IT CHECKS. A rollup through `Assets` of `Assets."Status"` whose result is text. The
// aggregation is not in what the Metadata API returns for a rollup (#540's measurement), so
// `ARRAYJOIN(values, ",")` is the hand step's to set and a record's value is where it shows.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_asset_statuses_582.mjs            (dry run)
//   node --env-file=.env.local scripts/import/add_asset_statuses_582.mjs --apply
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

const SCRIPT = "add_asset_statuses_582";

const META_ROOT = "https://api.airtable.com/v0/meta";

// The ids are the same on both bases: the test base was made by duplicating the live one (#534).
const ASSET_CATEGORIES_TABLE_ID = "tblry47UEqLx86yaU";
const ASSETS_TABLE_ID = "tblXtmDonSyOyOvV3";
const LINK_NAME = "Assets";
const SOURCE_NAME = "Status";

/** The field, as the create sends it once the two ids are read off the base. */
const FIELD_NAME = "Asset Statuses";
const AGGREGATION = 'ARRAYJOIN(values, ",")';
const DESCRIPTION =
    "Issue #582 -- the Status of every asset filed under this catalog row, joined with commas: a rollup of Assets.\"Status\" through " +
    "Assets, ARRAYJOIN(values, \",\"), kept by Airtable as each status is written. The catalog's page counts a row's items as its Assets " +
    "link less the statuses the app does not show, Deleted among them (lib/assetCategory.js:itemCountOf, lib/assetStatus.js:shownIn), " +
    "and takes a row out only when that count is 0; a kind's page reads it for whether any item stands under the kind at all. Airtable " +
    "judges nothing here: which statuses count is the app's. Made by scripts/import/add_asset_statuses_582.mjs on the test base and by " +
    "hand on the live base.";

/** The result types a joined text comes back as. */
const TEXT_RESULTS = ["singleLineText", "multilineText"];

/** What Soo does on the live base, word for word, when the create is refused there. */
const HAND_STEP =
    `In Asset Categories, add a field named "${FIELD_NAME}": type Rollup; linked records "${LINK_NAME}"; field to roll up "${SOURCE_NAME}"; ` +
    `aggregation formula ${AGGREGATION}; no condition. Leave the description empty: this script writes it.`;

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
    const categories = json.tables.find((t) => t.id === ASSET_CATEGORIES_TABLE_ID);
    const assets = json.tables.find((t) => t.id === ASSETS_TABLE_ID);
    if (!categories || !assets) throw new Error("the base holds no Asset Categories or Assets by the ids this script was written against");
    return { categories, assets };
}

/** Whether `field` is the rollup this script specifies, or why not. */
function rollupFault(field, { link, source }) {
    if (!field) return "missing";
    if (field.type !== "rollup") return `a ${field.type}, not a rollup`;
    if (field.options?.recordLinkFieldId !== link?.id) return `rolled up through ${field.options?.recordLinkFieldId ?? "nothing"}, not ${LINK_NAME}`;
    if (field.options?.fieldIdInLinkedTable !== source?.id) return `rolling up ${field.options?.fieldIdInLinkedTable ?? "nothing"}, not ${SOURCE_NAME}`;
    if (!TEXT_RESULTS.includes(field.options?.result?.type)) return `a ${field.options?.result?.type ?? "result of no type"}, not text — is the aggregation ${AGGREGATION}?`;
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
    log(`Asset Categories."${FIELD_NAME}" — the statuses of a row's items (#582)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const { categories, assets } = await readTables(baseId);
    const link = categories.fields.find((f) => f.name === LINK_NAME && f.type === "multipleRecordLinks");
    const source = assets.fields.find((f) => f.name === SOURCE_NAME);
    if (!link || !source) return finish(1, `no ${LINK_NAME} link on Asset Categories or no ${SOURCE_NAME} on Assets`);

    let field = categories.fields.find((f) => f.name === FIELD_NAME);
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
        const sent = await request("POST", `/bases/${baseId}/tables/${ASSET_CATEGORIES_TABLE_ID}/fields`, body);
        if (sent.refused) {
            log("");
            log("  HAND STEP, on this base:");
            log(`  ${HAND_STEP}`);
            log("  Then run this again with --apply to check the field and write its description.");
            return finish(2, "the field is the hand step's on this base");
        }
        log(`  created ${FIELD_NAME} (${sent.json.id})`);
        field = (await readTables(baseId)).categories.fields.find((f) => f.name === FIELD_NAME);
    }

    const fault = rollupFault(field, { link, source });
    if (fault) return finish(1, `${FIELD_NAME} is ${fault}`);
    log(`  ${FIELD_NAME} (${field.id}) is a rollup of ${SOURCE_NAME} through ${LINK_NAME}, ${field.options.result.type}`);

    if ((field.description ?? "") !== DESCRIPTION) {
        if (!apply) {
            log("  would write its description");
            return finish(2, "dry run");
        }
        const sent = await request("PATCH", `/bases/${baseId}/tables/${ASSET_CATEGORIES_TABLE_ID}/fields/${field.id}`, { description: DESCRIPTION });
        if (sent.refused) return finish(1, "the description was refused");
        const after = (await readTables(baseId)).categories.fields.find((f) => f.id === field.id);
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
