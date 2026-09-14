// Splits `Users."User Name"` into `First Name` + `Last Name` (issue #381).
//
// WHY A RENAME AND NOT A DELETE-AND-REPLACE. `User Name` is the PRIMARY field,
// and the Metadata API has no DELETE for a field at all — `DELETE /meta/bases/
// {baseId}/tables/{tableId}/fields/{fieldId}` answers 404 on a real field id and
// the field is still there afterwards (measured in #363, recorded in
// docs/notes/airtable-access.md). Airtable's own UI refuses to delete a primary
// on top of that. So renaming in place is the only shape available, and it is
// also the one that keeps every value and every link: Airtable resolves a field
// by id, and a link chip renders the primary's VALUE, so the 14 link fields on
// this base that point at a `Users` row go on working untouched.
//
// THE FORMULA-PRIMARY ALTERNATIVE WAS REFUSED ON A MEASURED LIMIT, not on taste.
// Joining two names into a formula primary would be a TYPE change, and a field's
// type cannot be PATCHed (422, "Changing a field's type or number precision is
// not currently supported"); it is a hand conversion in the UI that drops every
// stored value. It would also make the base carry three name fields where two
// say everything.
//
// WHAT IT DOES NOT DO: the values. Every row's `First Name` still holds the
// email's local part when this finishes, which is exactly what it held as
// `User Name` and exactly what the app has always printed. Emptying those is
// `clear_user_first_names_381.mjs`, which is a record backfill rather than a
// schema edit and is approved separately.
//
// IDEMPOTENT. A second run finds the primary already called `First Name` and
// `Last Name` already present, changes nothing, and still re-reads the live
// schema to compare it against the spec — because a table cannot be deleted
// through any API, so a run that prints a green summary has to have looked.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/rename_user_name_381.mjs --dry-run
//   node --env-file=.env.local scripts/import/rename_user_name_381.mjs
//
// No loader flag: this file imports only built-ins.
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec,
// 1 something failed, 2 nothing failed but something is incomplete (a dry run,
// or a hand step is still outstanding).

const META_ROOT = "https://api.airtable.com/v0/meta";

const TABLE_NAME = "Users";

/**
 * The primary field, addressed by ID rather than by name.
 *
 * A rename is precisely the operation that makes a name a bad address, and this
 * script is the rename — so a re-run must find the same field whichever name it
 * is wearing. The id is what makes the script idempotent rather than
 * order-dependent.
 */
const PRIMARY_FIELD_ID = "fldKQq2jevbCeUExo";

const OLD_PRIMARY_NAME = "User Name";
const FIRST_NAME = "First Name";
const LAST_NAME = "Last Name";

const FIRST_NAME_DESCRIPTION =
    "The person's first name, typed by them at their first sign-in (#381). " +
    "This is the primary field, so it is what every link to a person renders. " +
    "Blank until its owner has signed in since that step existed; while it is " +
    "blank the app prints the local part of their email address.";

const LAST_NAME_DESCRIPTION =
    "The person's last name, typed with the first at their first sign-in " +
    "(#381). Joined to First Name for the places a person is CHOSEN (the " +
    "signer pickers) and the places a vendor reads (the purchase order PDF and " +
    "the order email). Screens that merely name a person print the first name.";

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function api(method, path, body) {
    calls++;
    const res = await fetch(`${META_ROOT}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
            "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, json: text === "" ? null : JSON.parse(text) };
}

async function must(method, path, body) {
    const res = await api(method, path, body);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.text}`);
    return res.json;
}

async function readUsersTable(baseId) {
    const schema = await must("GET", `/bases/${baseId}/tables`);
    const table = schema.tables.find((t) => t.name === TABLE_NAME);
    if (!table) throw new Error(`no table called ${JSON.stringify(TABLE_NAME)} on this base`);
    return table;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    log("=".repeat(72));
    log(`Users."${OLD_PRIMARY_NAME}" -> "${FIRST_NAME}", plus a new "${LAST_NAME}" (#381)`);
    log(`base ${baseId}${dryRun ? "   [DRY RUN — nothing is written]" : ""}`);
    log("=".repeat(72));

    const table = await readUsersTable(baseId);
    const primary = table.fields.find((f) => f.id === table.primaryFieldId);
    log("");
    log(`table ${table.id} "${table.name}", ${table.fields.length} fields`);
    log(`primary ${primary.id} "${primary.name}" (${primary.type})`);

    // The id the rest of this script addresses has to BE the primary. If the base
    // ever gains a different primary, renaming this field would leave the table
    // with two name fields and no primary among them.
    if (primary.id !== PRIMARY_FIELD_ID) {
        log("");
        log(`the primary is ${primary.id}, not the ${PRIMARY_FIELD_ID} this script was written for`);
        return 1;
    }
    if (primary.type !== "singleLineText") {
        log("");
        log(`the primary is ${primary.type}; this script only renames a singleLineText primary`);
        return 1;
    }

    const planned = [];
    const skipped = [];

    if (primary.name === OLD_PRIMARY_NAME) {
        planned.push({
            what: `PATCH  ${primary.id}  name "${OLD_PRIMARY_NAME}" -> "${FIRST_NAME}"`,
            run: () =>
                must("PATCH", `/bases/${baseId}/tables/${table.id}/fields/${primary.id}`, {
                    name: FIRST_NAME,
                    description: FIRST_NAME_DESCRIPTION,
                }),
        });
    } else if (primary.name === FIRST_NAME) {
        skipped.push(`the primary is already "${FIRST_NAME}"`);
        if (primary.description !== FIRST_NAME_DESCRIPTION) {
            planned.push({
                what: `PATCH  ${primary.id}  description of "${FIRST_NAME}"`,
                run: () =>
                    must("PATCH", `/bases/${baseId}/tables/${table.id}/fields/${primary.id}`, {
                        description: FIRST_NAME_DESCRIPTION,
                    }),
            });
        }
    } else {
        log("");
        log(`the primary is called "${primary.name}", which is neither the old name nor the new one`);
        return 1;
    }

    const existingLast = table.fields.find((f) => f.name === LAST_NAME);
    if (!existingLast) {
        planned.push({
            what: `POST   create "${LAST_NAME}" (singleLineText)`,
            run: () =>
                must("POST", `/bases/${baseId}/tables/${table.id}/fields`, {
                    name: LAST_NAME,
                    type: "singleLineText",
                    description: LAST_NAME_DESCRIPTION,
                }),
        });
    } else {
        skipped.push(`"${LAST_NAME}" already exists (${existingLast.id}, ${existingLast.type})`);
        if (existingLast.type !== "singleLineText") {
            log("");
            log(`"${LAST_NAME}" is ${existingLast.type}, not singleLineText — a type cannot be PATCHed`);
            return 1;
        }
        if (existingLast.description !== LAST_NAME_DESCRIPTION) {
            planned.push({
                what: `PATCH  ${existingLast.id}  description of "${LAST_NAME}"`,
                run: () =>
                    must("PATCH", `/bases/${baseId}/tables/${table.id}/fields/${existingLast.id}`, {
                        description: LAST_NAME_DESCRIPTION,
                    }),
            });
        }
    }

    log("");
    for (const s of skipped) log(`  already done: ${s}`);
    if (planned.length === 0) log("  nothing to do");
    for (const p of planned) log(`  ${p.what}`);

    if (dryRun) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${planned.length} write(s) would be made and none were.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    // Aborts on the first non-200 and leaves everything already applied in place,
    // the posture #333's own rename script took: a half-reverted schema matches no
    // revision of this repository, and re-running is what repairs it.
    for (const p of planned) {
        await p.run();
        log(`  done: ${p.what}`);
    }

    // The base cannot be asked to undo any of this, so the run has to have looked.
    const after = await readUsersTable(baseId);
    const afterPrimary = after.fields.find((f) => f.id === after.primaryFieldId);
    const afterLast = after.fields.find((f) => f.name === LAST_NAME);
    const problems = [];
    if (afterPrimary?.id !== PRIMARY_FIELD_ID) problems.push("the primary field id moved");
    if (afterPrimary?.name !== FIRST_NAME) problems.push(`the primary is "${afterPrimary?.name}"`);
    if (!afterLast) problems.push(`"${LAST_NAME}" is not on the table`);
    if (afterLast && afterLast.type !== "singleLineText") problems.push(`"${LAST_NAME}" is ${afterLast.type}`);
    if (after.fields.some((f) => f.name === OLD_PRIMARY_NAME)) {
        problems.push(`a field is still called "${OLD_PRIMARY_NAME}"`);
    }

    log("");
    log("re-read from the base:");
    log(`  primary  ${afterPrimary?.id} "${afterPrimary?.name}" (${afterPrimary?.type})`);
    log(`  ${LAST_NAME.padEnd(8)} ${afterLast?.id} "${afterLast?.name}" (${afterLast?.type})`);

    if (problems.length > 0) {
        log("");
        for (const p of problems) log(`  WRONG: ${p}`);
        return finish(1, `${problems.length} problem(s)`);
    }

    log("");
    log("=".repeat(72));
    log("ONE HAND STEP, AND IT IS COSMETIC.");
    log(`  A field created through the API is appended at the END of the field`);
    log(`  list, so "${LAST_NAME}" sits after the last link field rather than`);
    log(`  beside "${FIRST_NAME}". Drag it into place in the Airtable UI. Nothing`);
    log(`  in this repository reads field order, so the base is correct either way.`);
    log("=".repeat(72));
    log("");
    log(`NEXT: the values are untouched — every row's "${FIRST_NAME}" still holds`);
    log(`the local part of its email. clear_user_first_names_381.mjs is what empties`);
    log(`them so their owners are asked, and it is approved separately.`);

    return finish(2, "schema done; one cosmetic hand step outstanding");
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
