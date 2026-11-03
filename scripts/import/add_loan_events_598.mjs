// `Asset Log."Event"`'s two loan options (#598): `Lent` and `Returned to owner`, made on the test
// base by one row written with `typecast` and taken off the base at once, and by hand on the live
// base.
//
// WHY A ROW. An existing select's options cannot be PATCHed (`docs/notes/airtable-access.md`), so an
// option is made by hand in the UI or by a record write that names it with `typecast`, which mints
// it at the list's end. Soo allowed the second on the test base alone: one row, `Event` `Lent`, then
// `Returned to owner` on the same row, so the two land in that order after `Deleted`, and the row is
// deleted in the same run. The row carries no `Asset`, no job and no id, so no screen could have met
// it; the run reports its id and whether the delete landed.
//
// NEVER ON THE LIVE BASE. `Asset Log` is the site's there (#531), and the first row request asks
// `scripts/protectedTables.mjs:refusesProtectedWrite`, which refuses it: the run prints the hand
// step — the two options, in this order, in the colors the test base gave them — and stops. What
// Airtable picked on the test base is in `COLORS` below, read back after the run there, so the two
// bases hold the same options for `verify-base-parity-534.mjs`.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_loan_events_598.mjs            (dry run)
//   node --env-file=.env.local scripts/import/add_loan_events_598.mjs --apply
//
// No loader flag: this file imports only built-ins, the guard's module and two pure lib modules.
//
// Airtable PAT scopes: schema.bases:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base offers both options last, in order, 1
// something failed, 2 a dry run or the live base's hand step outstanding.

import { refusesProtectedWrite } from "../protectedTables.mjs";
import { resolveAirtableBase } from "../../lib/airtableBase.js";
import { ASSET_EVENT, ASSET_EVENT_VALUES } from "../../lib/assetStatus.js";

const SCRIPT = "add_loan_events_598";

// The table and the field by id, the same on both bases (#534).
const ASSET_LOG_TABLE_ID = "tblrox7y4akPKdbpF";
const EVENT_FIELD_ID = "fldI7mM1DFKw6W41B";

/** The two options this issue adds, in the order the list must end on. */
const ADDED = [ASSET_EVENT.LENT, ASSET_EVENT.RETURNED_TO_OWNER];

/** The colors Airtable gave the two on the test base, which the live base's hand step uses. */
const COLORS = { [ASSET_EVENT.LENT]: "blueLight2", [ASSET_EVENT.RETURNED_TO_OWNER]: "blueLight2" };

/** What Soo does on the live base, word for word. */
const HAND_STEP =
    `In Asset Log, open the Event field and add two options at the end of its list, after "${ASSET_EVENT.DELETED}", in this order: ` +
    ADDED.map((name) => `"${name}" in ${COLORS[name]}`).join(", then ") +
    ". Edit nothing else in the list.";

let airtable = null;
let calls = 0;

function log(line = "") {
    console.log(line);
}

/** One request to Airtable's API, its answer read as JSON. */
async function send(method, path, body) {
    calls++;
    const res = await fetch(`https://api.airtable.com/v0${path}`, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

/** A write to `Asset Log`'s rows, which `main` sends only once the guard has let it. */
function rowRequest(method, path, body) {
    return send(method, `/${airtable.baseId}/${ASSET_LOG_TABLE_ID}${path}`, body);
}

/** `Event`'s options as the base holds them now: `{ name, color }` in the list's order. */
async function readChoices() {
    const { tables } = await send("GET", `/meta/bases/${airtable.baseId}/tables`);
    const field = tables.find((t) => t.id === ASSET_LOG_TABLE_ID)?.fields.find((f) => f.id === EVENT_FIELD_ID);
    if (!field) throw new Error("the base holds no Asset Log.Event by the ids this script was written against");
    return field.options.choices.map(({ name, color }) => ({ name, color }));
}

/** Whether the list is the vocabulary's, in its order, and why not. */
function listFault(choices) {
    const names = choices.map((c) => c.name);
    if (names.join("\n") !== ASSET_EVENT_VALUES.join("\n")) return `the options read ${names.join(", ")}, not ${ASSET_EVENT_VALUES.join(", ")}`;
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
    log("=".repeat(72));
    log(`Asset Log."Event" — ${ADDED.join(" and ")} (#598)`);
    log(`base ${airtable.baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const before = await readChoices();
    log(`  the options: ${before.map((c) => `${c.name} (${c.color})`).join(", ")}`);
    const missing = ADDED.filter((name) => !before.some((c) => c.name === name));
    if (missing.length === 0) {
        const fault = listFault(before);
        if (fault) return finish(1, fault);
        log("  both options stand last, in order");
        return finish(0, "the base offers both options");
    }
    if (!apply) {
        log(`  would write one row naming ${missing.join(", then ")} with typecast, and delete it`);
        return finish(2, "dry run");
    }

    // The row writes, asked first: refused on the live base, where the options are a hand step.
    if (refusesProtectedWrite({ script: SCRIPT, baseId: airtable.baseId, writes: ["Asset Log"], log })) {
        log("");
        log("  HAND STEP, on this base:");
        log(`  ${HAND_STEP}`);
        log("  Then run this again to check the list.");
        return finish(2, "the options are the hand step's on this base");
    }

    let rowId = null;
    try {
        for (const name of missing) {
            if (rowId === null) {
                const made = await rowRequest("POST", "", { records: [{ fields: { Event: name } }], typecast: true });
                rowId = made.records[0].id;
                log(`  wrote ${rowId} with Event ${name}`);
            } else {
                await rowRequest("PATCH", "", { records: [{ id: rowId, fields: { Event: name } }], typecast: true });
                log(`  set ${rowId}'s Event to ${name}`);
            }
        }
    } finally {
        if (rowId !== null) {
            await rowRequest("DELETE", `?records[]=${rowId}`);
            log(`  deleted ${rowId}`);
        }
    }

    const after = await readChoices();
    log(`  the options now: ${after.map((c) => `${c.name} (${c.color})`).join(", ")}`);
    const fault = listFault(after);
    if (fault) return finish(1, fault);
    for (const name of ADDED) {
        const color = after.find((c) => c.name === name)?.color;
        if (color !== COLORS[name]) log(`  NOTE: ${name} came back ${color}, where COLORS says ${COLORS[name]} — set COLORS to what the base gave`);
    }
    return finish(0, "the base offers both options");
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(`\nfailed: ${error.message}`);
        process.exit(1);
    }
);
