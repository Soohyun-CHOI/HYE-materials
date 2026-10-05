// Creates `Auth Tokens."Mailbox"` and `Auth Tokens."IP Hash"` (issue #148).
//
// WHAT THE FIELDS ARE FOR. A sign-in email could be asked for without limit, for any
// company address and from anywhere. #148 holds every request to ceilings counted over
// the rows the requests already make — one per email — so it needs two things on each
// row that the row did not carry: which mailbox the email went to, and which IP asked
// for it. `lib/signInLimit.js` owns the ceilings and the judgment; `lib/airtable/
// authTokens.js` writes both fields when it makes a row and reads them back in the one
// query a request makes before it makes another.
//
// `Mailbox` IS THE ADDRESS LOWERCASED, ITS `+` TAG CUT, because an address in another
// case signs in as the same person and a tagged one lands in the same inbox — counted
// by `Email` as typed, either would give one inbox a fresh allowance per spelling. It is
// stored rather than computed in Airtable: a formula field cannot be created through the
// API, a computed field can be briefly invisible to a filter right after its row is
// written, and the rule would be implemented twice, once here and once in the formula.
//
// `IP Hash` IS A KEYED HASH, never the address itself, so the base holds no IP and
// nobody who can read it can recover one by trying every IPv4 address. It is BLANK on a
// row a script made: no request asked for that row and no email went out, so the
// query leaves it out of every count.
//
// IT IS A PLAIN ADDITIVE CREATE, #471's shape: code that does not know a field ignores
// it and code that does writes it, so the one ordering hazard is an EXISTING field of
// the wrong type, which the Metadata API refuses to retype — this refuses to go on when
// it finds one. There is no backfill: every row on the table predates the fields and
// is older than the longest window any ceiling looks back over.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`, for
// `create_material_categories_354.mjs`'s reason: the schema half has no SDK. So
// `lib/airtableOps.js` cannot see these calls and the run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_sign_in_limit_148.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_sign_in_limit_148.mjs
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
        name: "Mailbox",
        type: "singleLineText",
        description:
            "The address this row's email went to, lowercased and with any + tag cut — the inbox it lands in " +
            "(#148). A request for a sign-in email is held to ceilings per mailbox, so another case or another tag " +
            "of one address is not a fresh allowance. Written by the app when the row is made; the ceilings are " +
            "lib/signInLimit.js's.",
    },
    {
        name: "IP Hash",
        type: "singleLineText",
        description:
            "A keyed hash of the IP the sign-in email was asked for from (#148), an IPv6 address cut to its first " +
            "64 bits, so the base holds no IP. A request is held to a ceiling per IP as well as per mailbox. Blank " +
            "on a row a script made, which no request asked for and no ceiling counts.",
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
            if (existing.type !== spec.type) {
                fail(
                    `${AUTH_TOKENS}."${spec.name}" exists as a ${existing.type}, not the ${spec.type} this needs. ` +
                        `A field's type cannot be changed through the API; resolve it by hand.`
                );
            }
            console.log(`[SKIP]   ${AUTH_TOKENS}."${spec.name}" already exists (${existing.id}) as a ${existing.type}.`);
            continue;
        }
        if (DRY_RUN) {
            console.log(
                `[WOULD]  POST /meta/bases/${BASE}/tables/${table.id}/fields\n` +
                    `           { name: "${spec.name}", type: "${spec.type}" }`
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
            if (field.type !== spec.type) fail(`${AUTH_TOKENS}."${spec.name}" came back as ${field.type}`);
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
