// Creates `Auth Tokens."Code"` and `Auth Tokens."Code Attempts"` (issue #471).
//
// WHAT THE FIELDS ARE FOR. A sign-in email carried one credential, its link, and
// the link signs in whichever browser opens it — the wrong one for somebody who
// asked on a phone and opened the email on a computer. The email now carries a
// six-digit code beside the link, and the screen that asked takes it. `Code` is
// that code, and `Code Attempts` is how many times one has been tried against the
// row: `lib/airtable/authTokens.js` writes it with every attempt's outcome and
// refuses the code at five. The link reads neither.
//
// `Code` IS TEXT, because a code is six digits and a leading zero is one of them —
// `012345` stored as a number is `12345`, which no one could type back. `Code
// Attempts` is an integer, written as 0 when the row is made, so a field renamed
// or deleted in the Airtable UI fails every sign-in request loudly instead of
// reading as a count of nothing.
//
// IT IS A PLAIN ADDITIVE CREATE, #387's shape: code that does not know a field
// ignores it and code that does writes it, so the one ordering hazard is an
// EXISTING field of the wrong type, which the Metadata API refuses to retype —
// this refuses to go on when it finds one. There is no backfill: every row on the
// table predates the fields, carries no code and has long expired, and a row with
// no code is one the code path refuses and the link path never asks about.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half has no SDK.
// So `lib/airtableOps.js` cannot see these calls and the run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_sign_in_code_471.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_sign_in_code_471.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write. It makes no record
// read or write at all.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run).

const API = "https://api.airtable.com/v0";
const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;

const DRY_RUN = process.argv.includes("--dry-run");

const AUTH_TOKENS = "Auth Tokens";

/** The two fields, as the base should hold them once this has run. */
const SPEC = [
    {
        name: "Code",
        type: "singleLineText",
        description:
            "Six random digits the sign-in email carries beside its link (#471). They sign in only the browser " +
            "that asked for the email, which the app binds to this row with a sealed cookie; the link signs in " +
            "whichever browser opens it. Spending either ends both, through Used. Text, so a leading zero stays. " +
            "Stored as is, like Token beside it: anyone who can read this row can already use the token.",
    },
    {
        name: "Code Attempts",
        type: "number",
        options: { precision: 0 },
        description:
            "How many codes have been tried against this row (#471), the right one included. Written in the same " +
            "write as each attempt's outcome, before the attempt is answered; at 5 the code stops working and the " +
            "link does not. Written as 0 when the row is made. Exact within one server process; two attempts in " +
            "two at once can read the same count.",
    },
];

let calls = 0;

async function api(path, init) {
    calls += 1;
    const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${KEY}`,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
    const body = await res.text();
    let parsed = null;
    try {
        parsed = body ? JSON.parse(body) : null;
    } catch {
        parsed = null;
    }
    return { ok: res.ok, status: res.status, body: parsed, raw: body };
}

function fail(message) {
    console.error(`FAILED: ${message}`);
    console.error(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);
    process.exit(1);
}

/** Does a live field match its spec, as far as this run cares? */
function matchesSpec(field, spec) {
    if (field.type !== spec.type) return false;
    if (spec.options?.precision !== undefined && field.options?.precision !== spec.options.precision) return false;
    return true;
}

async function readTable() {
    const schema = await api(`/meta/bases/${BASE}/tables`);
    if (!schema.ok) fail(`could not read the schema: ${schema.status} ${schema.raw}`);
    const table = schema.body.tables.find((t) => t.name === AUTH_TOKENS);
    if (!table) fail(`no table named ${AUTH_TOKENS}`);
    return table;
}

async function main() {
    if (!KEY || !BASE) fail("AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required — run with --env-file=.env.local");

    console.log(`Base ${BASE}${DRY_RUN ? "  (DRY RUN — nothing is written)" : ""}\n`);

    const table = await readTable();

    for (const spec of SPEC) {
        const existing = table.fields.find((f) => f.name === spec.name);
        if (existing) {
            if (!matchesSpec(existing, spec)) {
                fail(
                    `${AUTH_TOKENS}."${spec.name}" exists as a ${existing.type} ` +
                        `(${JSON.stringify(existing.options ?? {})}), not the ${spec.type} this needs. ` +
                        `A field's type cannot be changed through the API; resolve it by hand.`
                );
            }
            console.log(`[SKIP]   ${AUTH_TOKENS}."${spec.name}" already exists (${existing.id}) as a ${existing.type}.`);
            continue;
        }
        if (DRY_RUN) {
            console.log(
                `[WOULD]  POST /meta/bases/${BASE}/tables/${table.id}/fields\n` +
                    `           { name: "${spec.name}", type: "${spec.type}"` +
                    `${spec.options ? `, options: ${JSON.stringify(spec.options)}` : ""} }`
            );
            continue;
        }
        const res = await api(`/meta/bases/${BASE}/tables/${table.id}/fields`, {
            method: "POST",
            body: JSON.stringify(spec),
        });
        if (!res.ok) fail(`could not create ${AUTH_TOKENS}."${spec.name}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${AUTH_TOKENS}."${spec.name}" (${res.body.id}) as a ${spec.type}`);
    }

    // ── the base, read again rather than trusted ────────────────────────────
    if (!DRY_RUN) {
        const after = await readTable();
        for (const spec of SPEC) {
            const field = after.fields.find((f) => f.name === spec.name);
            if (!field) fail(`${AUTH_TOKENS}."${spec.name}" is not on the table after the run`);
            if (!matchesSpec(field, spec)) fail(`${AUTH_TOKENS}."${spec.name}" came back as ${field.type}`);
            if ((field.description ?? "") !== spec.description) {
                console.log(`[NOTE]   ${AUTH_TOKENS}."${spec.name}" carries a description other than this spec's.`);
            }
            console.log(`[OK]     ${AUTH_TOKENS}."${spec.name}" (${field.id}) is a ${field.type}.`);
        }
    }

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }
    console.log("\nDone.");
    process.exit(0);
}

await main();
