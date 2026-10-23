// `Asset Categories."Edited At"` (#540): when a catalog row was last edited, kept on the row by
// Airtable as a Last modified time watching the row's own fields — made and described here, on the
// test base and then on the live one.
//
// WHY THE FIELD. The office's catalog page (1l) sorts its rows by name or by when each was last
// edited. The base kept no such moment: the catalog's read had nothing to sort by, and asking the
// base which rows changed is a question per view where the field rides the catalog's own list
// request, so the page reads three times as it did. `docs/notes/tools.md` has the reads.
//
// WHAT IT WATCHES IS WHAT AN EDIT IS: the six fields the catalog page writes — `Level 3` (the name),
// `Size`, `Maker`, `Part Number`, `Category Group` and `Discontinued` — so a row added, renamed,
// resized, given a maker or a part number, moved to another category, discontinued or restored
// moves it, and nothing else does. Not `Assets`, the reverse link an item's registration writes
// from the other side, so registering an item under a row leaves the row where it was; not
// `Item Name`, a formula over four of the six; and not `Level 1` and `Level 2`, lookups through
// `Category Group`, so a category renamed in `Asset Category Groups` moves none of the rows filed
// under it — #540 counts the row's own edits alone.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_edited_at_540.mjs            (dry run)
//   node --env-file=.env.local scripts/import/add_edited_at_540.mjs --apply
//   AIRTABLE_BASE=live ... --apply   (once Soo has approved the live half)
//
// No loader flag: this file imports only built-ins and `lib/airtableBase.js`.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base holds the field as specified and described,
// 1 something failed or the field is not the one specified, 2 a dry run.

import { resolveAirtableBase } from "../../lib/airtableBase.js";

/** The base this run reaches (#534), resolved at the top of main(). */
let airtable = null;

const META_ROOT = "https://api.airtable.com/v0/meta";

// The id is the same on both bases: the test base was made by duplicating the live one (#534).
const CATALOG_TABLE_ID = "tblry47UEqLx86yaU";

const FIELD_NAME = "Edited At";
// The six fields the catalog page writes, by name, read off the base for their ids.
const WATCHED = ["Level 3", "Size", "Maker", "Part Number", "Category Group", "Discontinued"];
const DESCRIPTION =
    "Issue #540 -- when this catalog row was last edited, kept by Airtable: a Last modified time watching Level 3, Size, Maker, " +
    "Part Number, Category Group and Discontinued, the fields the Catalog page writes, and nothing else. So adding a row, renaming it, " +
    "changing its size, maker or part number, moving it to another category and discontinuing or restoring it move it; an item " +
    "registered under it does not, since the reverse link is not watched, and neither does its category renamed in Asset Category " +
    "Groups, since Level 1 and Level 2 are lookups. The Catalog page sorts by it (Recently updated). Made by " +
    "scripts/import/add_edited_at_540.mjs.";

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function request(method, path, body) {
    calls++;
    const res = await fetch(`${META_ROOT}${path}`, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

async function readCatalog(baseId) {
    const { tables } = await request("GET", `/bases/${baseId}/tables`);
    const table = tables.find((t) => t.id === CATALOG_TABLE_ID);
    if (!table) throw new Error("the base holds no Asset Categories by the id this script was written against");
    return table;
}

/** Whether `field` is the Last modified time this script specifies over `watched`, or why not. */
function fieldFault(field, watched) {
    if (!field) return "missing";
    if (field.type !== "lastModifiedTime") return `a ${field.type}, not a Last modified time`;
    const held = [...(field.options?.referencedFieldIds ?? [])].sort().join(",");
    const wanted = watched.map((f) => f.id).sort().join(",");
    if (held !== wanted) return `watching ${held || "every editable field"}, not ${WATCHED.join(", ")}`;
    if (field.options?.result?.type !== "dateTime") return `a ${field.options?.result?.type ?? "result of no type"}, not a moment`;
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
    log(`Asset Categories."${FIELD_NAME}" — when a catalog row was last edited (#540)`);
    log(`base ${baseId}${airtable.live ? " (live)" : " (test)"}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    log("=".repeat(72));

    const table = await readCatalog(baseId);
    const watched = WATCHED.map((name) => table.fields.find((f) => f.name === name));
    const absent = WATCHED.filter((_, i) => !watched[i]);
    if (absent.length > 0) return finish(1, `Asset Categories holds no ${absent.join(", ")}`);

    let field = table.fields.find((f) => f.name === FIELD_NAME);
    if (!field) {
        if (!apply) {
            log(`  would create ${FIELD_NAME}: a Last modified time watching ${watched.map((f) => `${f.name} (${f.id})`).join(", ")}`);
            return finish(2, "dry run");
        }
        const created = await request("POST", `/bases/${baseId}/tables/${CATALOG_TABLE_ID}/fields`, {
            name: FIELD_NAME,
            type: "lastModifiedTime",
            description: DESCRIPTION,
            options: { referencedFieldIds: watched.map((f) => f.id) },
        });
        log(`  created ${FIELD_NAME} (${created.id})`);
        field = (await readCatalog(baseId)).fields.find((f) => f.name === FIELD_NAME);
    }

    const fault = fieldFault(field, watched);
    if (fault) return finish(1, `${FIELD_NAME} is ${fault}`);
    log(`  ${FIELD_NAME} (${field.id}) watches ${WATCHED.join(", ")}, a moment`);

    if ((field.description ?? "") !== DESCRIPTION) {
        if (!apply) {
            log("  would write its description");
            return finish(2, "dry run");
        }
        await request("PATCH", `/bases/${baseId}/tables/${CATALOG_TABLE_ID}/fields/${field.id}`, { description: DESCRIPTION });
        const after = (await readCatalog(baseId)).fields.find((f) => f.id === field.id);
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
