// Empties the login handle sitting in `Users."First Name"`, so its owner is
// asked for a real one at their next sign-in (issue #381).
//
// WHAT IS IN THERE NOW. Until this issue a `Users` row was created by
// `verifyMagicLink` with `userName: email.split("@")[0]`, so every row on this
// base carries the local part of its own email address as its name — `bsws9803`,
// `chkim`, `hkahn`. The rename (`rename_user_name_381.mjs`) moves that string
// into a field called `First Name`, where it reads as a claim about the person
// rather than as the handle it is.
//
// WHY EMPTYING IS THE ANSWER AND NOT A HAND EDIT. The signal that fires the name
// step is an empty `First Name`, so a row that keeps its handle is a row nobody
// is ever asked about. The alternative — filling nine rows by hand in Airtable —
// puts the naming of nine people in one person's hands and is the kind of task
// that half happens. The person is the authority on their own name.
//
// WHY IT COSTS NOTHING ON SCREEN. `lib/userName.js` falls back to the local part
// of the email while no first name is stored, which is the same string this
// deletes and the same string every screen prints today. So clearing changes no
// rendered character anywhere; each person's screens improve when that person
// signs in and types their name.
//
// THE GUARD, AND IT IS THE WHOLE SAFETY OF THIS SCRIPT. A row is cleared only
// when its `First Name` is EXACTLY the local part of its own `Email`, compared
// case-insensitively after trimming. A value somebody typed by hand is left
// alone and reported, so running this after a real name has been entered cannot
// destroy it. Nothing here deletes a record — CLAUDE.md's rule that nothing in
// this base is removed as tidying-up is untouched.
//
// THE PERMANENT FIXTURE ACCOUNTS ARE NAMED RATHER THAN CLEARED, and that is a
// requirement rather than a courtesy. `scripts/tests/verify-authz.mjs` mints a
// session for one of them and then requests pages; a fixture with no first name
// would be redirected to the name step and every assertion after it would be
// measuring the wrong screen. docs/notes/verification.md registers the three.
//
// IDEMPOTENT. A second run finds every row already in its intended state and
// writes nothing. It re-reads the rows afterwards and compares, because the
// verdict of a backfill is what the base holds and not what the request said.
//
// ORDERING. This runs AFTER `rename_user_name_381.mjs`, because it needs
// `Last Name` to exist for the fixture rows. It addresses the first-name field
// by ID and takes its CURRENT name off the live schema, so a --dry-run is
// readable before the rename has happened as well as after.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/clear_user_first_names_381.mjs --dry-run
//   node --env-file=.env.local scripts/import/clear_user_first_names_381.mjs
//
// Airtable PAT scopes: schema.bases:read, data.records:read, data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 every row is as intended,
// 1 something failed, 2 nothing failed but something is incomplete (a dry run,
// or `Last Name` is not on the table yet).

const META_ROOT = "https://api.airtable.com/v0/meta";
const DATA_ROOT = "https://api.airtable.com/v0";

const TABLE_NAME = "Users";
const EMAIL_FIELD_ID = "fldCWmUN3otYDHqqw";
const PRIMARY_FIELD_ID = "fldKQq2jevbCeUExo";
const LAST_NAME = "Last Name";

/** Airtable's own ceiling on one record-write request. */
const RECORDS_PER_REQUEST = 10;

/**
 * The permanent fixture accounts, and the names they are given instead of being
 * cleared. Keyed by email because that is the only thing about them that cannot
 * change — docs/notes/verification.md carries what each one proves.
 */
const FIXTURE_NAMES = {
    "authz-fixture@hanyangengusa.com": { first: "Authz", last: "Fixture" },
    "scoped-fixture@hanyangengusa.com": { first: "Scoped", last: "Fixture" },
    "name-fixture@hanyangengusa.com": { first: "Name", last: "Fixture" },
};

let calls = 0;

function log(line = "") {
    console.log(line);
}

async function api(root, method, path, body) {
    calls++;
    const res = await fetch(`${root}${path}`, {
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

async function must(root, method, path, body) {
    const res = await api(root, method, path, body);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${res.text}`);
    return res.json;
}

/** The local part of an address, lower-cased. The string this is undoing. */
function localPart(email) {
    return String(email ?? "").toLowerCase().split("@")[0];
}

async function readRows(baseId, tableId, fieldIds) {
    const out = [];
    let offset;
    do {
        const params = new URLSearchParams();
        for (const f of fieldIds) params.append("fields[]", f);
        params.set("returnFieldsByFieldId", "true");
        params.set("pageSize", "100");
        if (offset) params.set("offset", offset);
        const page = await must(DATA_ROOT, "GET", `/${baseId}/${tableId}?${params}`);
        out.push(...page.records);
        offset = page.offset;
    } while (offset);
    return out;
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    const schema = await must(META_ROOT, "GET", `/bases/${baseId}/tables`);
    const table = schema.tables.find((t) => t.name === TABLE_NAME);
    if (!table) {
        log(`no table called ${JSON.stringify(TABLE_NAME)} on this base`);
        return 1;
    }
    const firstField = table.fields.find((f) => f.id === PRIMARY_FIELD_ID);
    const lastField = table.fields.find((f) => f.name === LAST_NAME);
    if (!firstField) {
        log(`the primary field ${PRIMARY_FIELD_ID} is not on ${TABLE_NAME}`);
        return 1;
    }

    log("=".repeat(72));
    log(`Users."${firstField.name}": empty the login handle so its owner is asked (#381)`);
    log(`base ${baseId}${dryRun ? "   [DRY RUN — nothing is written]" : ""}`);
    log("=".repeat(72));
    log("");
    log(`first-name field  ${firstField.id} "${firstField.name}"`);
    log(`last-name field   ${lastField ? `${lastField.id} "${lastField.name}"` : "NOT ON THE TABLE YET"}`);

    const rows = await readRows(baseId, table.id, [PRIMARY_FIELD_ID, EMAIL_FIELD_ID, lastField?.id].filter(Boolean));

    const plan = [];
    for (const row of rows) {
        const email = row.cellValuesByFieldId?.[EMAIL_FIELD_ID] ?? row.fields?.[EMAIL_FIELD_ID] ?? "";
        const first = (row.cellValuesByFieldId?.[PRIMARY_FIELD_ID] ?? row.fields?.[PRIMARY_FIELD_ID] ?? "").trim();
        const last = lastField
            ? (row.cellValuesByFieldId?.[lastField.id] ?? row.fields?.[lastField.id] ?? "").trim()
            : "";
        const fixture = FIXTURE_NAMES[String(email).toLowerCase()];

        if (fixture) {
            const already = first === fixture.first && last === fixture.last;
            plan.push({
                id: row.id,
                email,
                first,
                action: already ? "keep" : "name",
                why: already ? "already named" : "permanent fixture account",
                write: { first: fixture.first, last: fixture.last },
            });
        } else if (first === "") {
            plan.push({ id: row.id, email, first, action: "keep", why: "already empty" });
        } else if (first.toLowerCase() === localPart(email)) {
            plan.push({ id: row.id, email, first, action: "clear", why: "is the email's local part" });
        } else {
            plan.push({ id: row.id, email, first, action: "keep", why: "a typed name — the guard protects it" });
        }
    }

    const width = Math.max(...plan.map((p) => String(p.email).length));
    log("");
    log("every row, and what happens to it:");
    for (const p of plan.sort((a, b) => a.action.localeCompare(b.action) || a.email.localeCompare(b.email))) {
        const verb =
            p.action === "clear"
                ? "CLEAR"
                : p.action === "name"
                  ? `NAME  "${p.write.first}" "${p.write.last}"`
                  : "keep ";
        log(`  ${String(p.email).padEnd(width)}  ${JSON.stringify(p.first).padEnd(18)}  ${verb}  — ${p.why}`);
    }

    const toClear = plan.filter((p) => p.action === "clear");
    const toName = plan.filter((p) => p.action === "name");
    log("");
    log(`  ${plan.length} rows: ${toClear.length} to clear, ${toName.length} to name, ` +
        `${plan.length - toClear.length - toName.length} untouched`);

    if (toName.length > 0 && !lastField) {
        log("");
        log(`  "${LAST_NAME}" is not on the table, so a fixture cannot be named yet.`);
        log(`  Run rename_user_name_381.mjs first.`);
        return finish(2, `"${LAST_NAME}" is missing`);
    }

    if (dryRun) {
        log("");
        log("=".repeat(72));
        log(`DRY RUN — ${toClear.length + toName.length} record write(s) would be made and none were.`);
        log("=".repeat(72));
        return finish(2, "dry run");
    }

    const writes = [
        ...toClear.map((p) => ({ id: p.id, fields: { [firstField.name]: "" } })),
        ...toName.map((p) => ({
            id: p.id,
            fields: { [firstField.name]: p.write.first, [lastField.name]: p.write.last },
        })),
    ];
    for (let i = 0; i < writes.length; i += RECORDS_PER_REQUEST) {
        const chunk = writes.slice(i, i + RECORDS_PER_REQUEST);
        await must(DATA_ROOT, "PATCH", `/${baseId}/${table.id}`, { records: chunk });
        log(`  wrote ${chunk.length} record(s)`);
    }

    // The verdict is what the base holds, so it is read back rather than inferred
    // from the requests having returned 200.
    const after = await readRows(baseId, table.id, [PRIMARY_FIELD_ID, EMAIL_FIELD_ID, lastField.id]);
    const problems = [];
    for (const row of after) {
        const email = String(row.cellValuesByFieldId?.[EMAIL_FIELD_ID] ?? row.fields?.[EMAIL_FIELD_ID] ?? "");
        const first = (row.cellValuesByFieldId?.[PRIMARY_FIELD_ID] ?? row.fields?.[PRIMARY_FIELD_ID] ?? "").trim();
        const fixture = FIXTURE_NAMES[email.toLowerCase()];
        if (fixture) {
            if (first !== fixture.first) problems.push(`${email} is ${JSON.stringify(first)}`);
        } else if (first.toLowerCase() === localPart(email)) {
            problems.push(`${email} still holds its own local part`);
        }
    }

    log("");
    if (problems.length > 0) {
        for (const p of problems) log(`  WRONG: ${p}`);
        return finish(1, `${problems.length} row(s) are not as intended`);
    }
    log(`re-read ${after.length} rows: no row holds its own local part, every fixture is named`);
    return finish(0, "every row is as intended");
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
