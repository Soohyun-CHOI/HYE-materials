// Creates `Users."Is Site Manager"` (issue #506).
//
// WHAT THE FIELD IS FOR. Until #506 anybody assigned to a job could add tools, print
// their labels, check a tool out or in and retire one. Those acts are a site manager's,
// so a person is marked as one by this checkbox, and `lib/siteManager.js` is the one
// reading of it: every tools screen draws those controls for a marked reader alone, and
// `withSiteManagerAction` (lib/authz.js) refuses the four actions behind them to anyone
// else. Everybody reads the same screens.
//
// A CHECKBOX OF ITS OWN AND NOT `Is Admin`. `Is Admin` opens the office's screens —
// invoicing, and what the office gets next — across the whole app, and the tools track
// does not pass through the office (`docs/notes/tools.md`). So the person who records a
// tool's events is marked for that and for nothing else, and an Admin who is not marked
// records nothing.
//
// IT IS SET BY HAND, AS `Is Admin` IS. No screen writes it and `createUser` leaves it
// off, so a first sign-in lands as a reader of the tools screens. The field is created
// with every row unmarked, which is the state #506 asks for until somebody is marked.
//
// IT TAKES `Is Admin`'s OWN LOOK — the check, in blue — read off the base rather than
// chosen, so the two flags on one row read as one kind of thing. A field created through
// the API is appended at the end of the table's list; moving it beside `Is Admin` is a
// hand step in the Airtable UI and changes nothing the app reads.
//
// IT IS A PLAIN ADDITIVE CREATE, `add_sign_in_limit_148.mjs`'s shape: code that does
// not know the field ignores it, and an unmarked row reads as false either way, so the
// one hazard is an EXISTING field of another type, which the Metadata API refuses to
// retype — this refuses to go on when it finds one.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`, for
// `create_material_categories_354.mjs`'s reason: the schema half has no SDK. So
// `lib/airtableOps.js` cannot see these calls and the run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_site_manager_506.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_site_manager_506.mjs
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

const USERS = "Users";

/** The field whose look this one takes, read off the base. */
const LOOK_FROM = "Is Admin";

/** The field, as the base should hold it once this has run. */
const SPEC = {
    name: "Is Site Manager",
    type: "checkbox",
    description:
        "Marks a person who records what happens to a tool — adds tools, prints their labels, checks them out and " +
        "in, and retires them, on the jobs they are assigned to (#506). Everyone else reads the tools screens " +
        "without those controls, and the app refuses those acts from them. Set by hand, as Is Admin is; the app " +
        "never writes it. Not Is Admin, which opens the office's screens across the app. Read by " +
        "lib/siteManager.js alone.",
};

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
    const table = schema.body.tables.find((t) => t.name === USERS);
    if (!table) fail(`no table named ${USERS}`);
    return table;
}

async function main() {
    if (!KEY || !BASE) fail("AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required — run with --env-file=.env.local");

    console.log(`Base ${BASE}${DRY_RUN ? "  (DRY RUN — nothing is written)" : ""}\n`);

    const table = await readTable();

    const look = table.fields.find((f) => f.name === LOOK_FROM);
    if (!look || look.type !== "checkbox") fail(`${USERS}."${LOOK_FROM}" is not a checkbox to take the look from`);
    const field = { ...SPEC, options: { icon: look.options.icon, color: look.options.color } };

    const existing = table.fields.find((f) => f.name === SPEC.name);
    if (existing) {
        if (existing.type !== SPEC.type) {
            fail(
                `${USERS}."${SPEC.name}" exists as a ${existing.type}, not the ${SPEC.type} this needs. ` +
                    `A field's type cannot be changed through the API; resolve it by hand.`
            );
        }
        console.log(`[SKIP]   ${USERS}."${SPEC.name}" already exists (${existing.id}) as a ${existing.type}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${table.id}/fields\n` +
                `           { name: "${field.name}", type: "${field.type}", options: ${JSON.stringify(field.options)} }`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${table.id}/fields`, {
            method: "POST",
            body: JSON.stringify(field),
        });
        if (!res.ok) fail(`could not create ${USERS}."${SPEC.name}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${USERS}."${SPEC.name}" (${res.body.id}) as a ${field.type}`);
    }

    // ── the base, read again rather than trusted ────────────────────────────
    if (!DRY_RUN) {
        const after = await readTable();
        const made = after.fields.find((f) => f.name === SPEC.name);
        if (!made) fail(`${USERS}."${SPEC.name}" is not on the table after the run`);
        if (made.type !== SPEC.type) fail(`${USERS}."${SPEC.name}" came back as ${made.type}`);
        if (made.options?.icon !== field.options.icon || made.options?.color !== field.options.color) {
            fail(`${USERS}."${SPEC.name}" came back looking ${JSON.stringify(made.options)}, not ${JSON.stringify(field.options)}`);
        }
        if ((made.description ?? "") !== SPEC.description) {
            console.log(`[NOTE]   ${USERS}."${SPEC.name}" carries a description other than this spec's.`);
        }
        console.log(`[OK]     ${USERS}."${SPEC.name}" (${made.id}) is a ${made.type}, ${JSON.stringify(made.options)}.`);
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
