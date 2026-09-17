// Creates `Invoices."Recorded By"` (issue #382).
//
// WHAT THE FIELD IS FOR. `Deliveries` and `Direct Purchases` each name the person
// who entered them and `Invoices` named nobody, so an invoice was the one document
// whose reader had no way to ask about a figure that looks wrong — and `/invoices`
// was the one document list with no way to narrow to the reader's own. This link is
// what `createInvoiceAction` writes from the session, and `updateInvoice` has no
// parameter for it: who typed the invoice in is not who last touched it.
//
// IT IS A PLAIN ADDITIVE CREATE, THE SHAPE #387 ESTABLISHED. That issue records why
// the window is zero for one: code that does not know a field ignores it and code
// that does writes it, so the only ordering hazard is the one #386 had — an EXISTING
// field of the wrong type, which the Metadata API refuses to retype. There is none
// here. `Invoices` has no link to `Users` of any kind.
//
// NO BACKFILL, AND UNLIKE #386 THERE IS NOTHING TO BACK FILL FROM. Every invoice on
// this base predates the field, and the base records no fact that would say who
// entered one: an invoice carries no `Created At`, and its `Invoice ID` dates the
// record without naming a person. Guessing from who signed the order it charges
// would be a different claim wearing this field's name. The form writes one from
// here on and the existing rows keep none — #387's sentence one table over.
//
// A NOTE ON REVERSING THIS. Deleting a link field leaves the inverse standing on the
// far table with its name and without its type — #335 measured it for a table
// deletion and #384 for a single field. So this refuses to report a clean base while
// a `singleLineText` named like its own inverse is present, which is the state a
// half-undone run leaves. `Users` is the far table here and it carries eight link
// fields already, three of them named after the table that points at them, so a
// ninth arriving under a suffixed name would be easy to miss.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half has no SDK.
// So `lib/airtableOps.js` cannot see these calls (`docs/notes/airtable-access.md`
// records raw `fetch` as one of the two things invisible to the counter) and the
// run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_invoice_recorded_by_382.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_invoice_recorded_by_382.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read.
// It makes no record write at all, which is the no-backfill decision expressed as
// a scope rather than only as a sentence.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// the single-record toggle is still outstanding).

const API = "https://api.airtable.com/v0";
const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;

const DRY_RUN = process.argv.includes("--dry-run");

const INVOICES = "Invoices";
const USERS = "Users";
const NEW_FIELD = "Recorded By";
const EXPECTED_INVERSE = "Invoices";

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

/** Every record of one table, following Airtable's 100-row pages. */
async function allRecords(tableId, fields) {
    const query = fields.map((f) => `fields%5B%5D=${encodeURIComponent(f)}`).join("&");
    const out = [];
    let offset = "";
    for (;;) {
        const res = await api(`/${BASE}/${tableId}?${query}${offset}`);
        if (!res.ok) fail(`could not read ${tableId}: ${res.status} ${res.raw}`);
        out.push(...res.body.records);
        if (!res.body.offset) return out;
        offset = `&offset=${encodeURIComponent(res.body.offset)}`;
    }
}

async function main() {
    if (!KEY || !BASE) fail("AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required — run with --env-file=.env.local");

    console.log(`Base ${BASE}${DRY_RUN ? "  (DRY RUN — nothing is written)" : ""}\n`);

    const schema = await api(`/meta/bases/${BASE}/tables`);
    if (!schema.ok) fail(`could not read the schema: ${schema.status} ${schema.raw}`);

    const tables = schema.body.tables;
    const invoices = tables.find((t) => t.name === INVOICES);
    const users = tables.find((t) => t.name === USERS);
    for (const [name, table] of [[INVOICES, invoices], [USERS, users]]) {
        if (!table) fail(`no table named ${name}`);
    }

    // ── the #335 / #384 orphan shape, looked for rather than assumed ────────
    const orphan = users.fields.find(
        (f) => f.name === EXPECTED_INVERSE && f.type !== "multipleRecordLinks"
    );
    if (orphan) {
        fail(
            `${USERS}."${orphan.name}" (${orphan.id}) is a ${orphan.type}, not a link — this is the ` +
                `name-without-a-type a deleted link field leaves behind (#384). Delete it in the Airtable UI ` +
                `first; a new inverse would otherwise be created beside it under a suffixed name nothing reads.`
        );
    }

    // ── 1: the field ────────────────────────────────────────────────────────
    const existing = invoices.fields.find((f) => f.name === NEW_FIELD);
    if (existing) {
        if (existing.type !== "multipleRecordLinks") {
            fail(`${INVOICES}."${NEW_FIELD}" exists and is a ${existing.type}, not a link — resolve by hand`);
        }
        if (existing.options?.linkedTableId !== users.id) {
            fail(`${INVOICES}."${NEW_FIELD}" links ${existing.options?.linkedTableId}, not ${USERS}`);
        }
        console.log(`[SKIP]   ${INVOICES}."${NEW_FIELD}" already exists (${existing.id}) and links ${USERS}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${invoices.id}/fields\n` +
                `           { name: "${NEW_FIELD}", type: "multipleRecordLinks", ` +
                `options: { linkedTableId: "${users.id}" } }\n` +
                `         and Airtable auto-creates the inverse on ${USERS}, expected "${EXPECTED_INVERSE}".`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${invoices.id}/fields`, {
            method: "POST",
            body: JSON.stringify({
                name: NEW_FIELD,
                description:
                    "Who entered this invoice (#382). Written from the session by createInvoiceAction and by " +
                    "nothing else — updateInvoice has no parameter for it, because an edit does not change who " +
                    "typed the record in. App-enforced single-record. Audit only, like Direct Purchases' own " +
                    "Recorded By and unlike Deliveries', which also decides who may delete. Empty on every " +
                    "invoice entered before this field existed: nothing backfills them, since the base records " +
                    "no fact that would say who.",
                type: "multipleRecordLinks",
                options: { linkedTableId: users.id },
            }),
        });
        if (!res.ok) fail(`could not create ${INVOICES}."${NEW_FIELD}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${INVOICES}."${NEW_FIELD}" (${res.body.id}) -> ${USERS}`);
    }

    // ── 2: the inverse Airtable made, verified and renamed if needed ────────
    //
    // `Users` NAMES ITS INVERSES AFTER THE TABLE THAT POINTS AT IT — `Deliveries`,
    // `Direct Purchases`, `Tool Log` — and takes a parenthesized qualifier only where
    // one table links to it twice (`Purchase Orders (as PIC)`). `Invoices` links here
    // once, so the plain name is both what Airtable generates and what this base's
    // convention asks for; the rename path below has never fired on this base and is
    // kept for the failure mode rather than the odds (#334).
    let toggleOutstanding = false;
    if (!DRY_RUN || existing) {
        const after = await api(`/meta/bases/${BASE}/tables`);
        if (!after.ok) fail(`could not re-read the schema: ${after.status} ${after.raw}`);
        const invoicesAfter = after.body.tables.find((t) => t.name === INVOICES);
        const usersAfter = after.body.tables.find((t) => t.name === USERS);
        const ours = invoicesAfter.fields.find((f) => f.name === NEW_FIELD);
        const inverse = usersAfter.fields.find((f) => f.id === ours?.options?.inverseLinkFieldId);

        if (!inverse) {
            fail(`${INVOICES}."${NEW_FIELD}" has no inverse on ${USERS}`);
        } else if (inverse.name === EXPECTED_INVERSE) {
            console.log(`[OK]     ${USERS}."${inverse.name}" (${inverse.id}) is the inverse, correctly named.`);
        } else if (DRY_RUN) {
            console.log(`[WOULD]  PATCH ${USERS}."${inverse.name}" -> "${EXPECTED_INVERSE}"`);
        } else {
            const patch = await api(`/meta/bases/${BASE}/tables/${usersAfter.id}/fields/${inverse.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name: EXPECTED_INVERSE }),
            });
            if (!patch.ok) fail(`could not rename the inverse: ${patch.status} ${patch.raw}`);
            console.log(`[PATCH]  ${USERS}."${inverse.name}" -> "${EXPECTED_INVERSE}" (${inverse.id})`);
        }

        // The toggle is the hand step, and this is what reports it rather than
        // trusting anybody to remember. It is READABLE even though it is not
        // writable, which is the whole reason a check can carry it.
        toggleOutstanding = ours?.options?.prefersSingleRecordLink !== true;
    }

    // ── 3: what the existing rows hold, counted rather than assumed ─────────
    //
    // A READ, AND IT RUNS ON A DRY RUN TOO, for #387's reason: the no-backfill
    // decision rests on a figure, and a decision resting on a figure should print the
    // figure on every run rather than in a commit message nobody re-reads. Here it is
    // also what a browser check reads back — an invoice entered through the form
    // after this run is the only row that can carry a value.
    // A PROJECTION NAMES A FIELD, so this cannot ask for one that is not there yet:
    // a dry run reaches here before the create and Airtable answers
    // `422 UNKNOWN_FIELD_NAME` for the projection rather than returning empty cells.
    const fieldExists = Boolean(existing) || !DRY_RUN;
    const rows = await allRecords(
        invoices.id,
        fieldExists ? ["Invoice ID", NEW_FIELD] : ["Invoice ID"]
    );
    const withRecorder = fieldExists
        ? rows.filter((r) => (r.fields[NEW_FIELD] ?? []).length > 0)
        : [];
    console.log(
        `[OK]     ${withRecorder.length} of ${rows.length} ${INVOICES} rows carry a "${NEW_FIELD}"` +
            `${fieldExists ? "." : " (the field does not exist yet — this is a dry run)."}`
    );
    if (withRecorder.length < rows.length) {
        console.log(
            `         The rest predate the field and are NOT backfilled — the base records no fact ` +
                `that would say who entered them. See this file's header.`
        );
    }

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }
    if (toggleOutstanding) {
        console.log(
            `\nHAND STEP OUTSTANDING (Airtable UI): set ${INVOICES}."${NEW_FIELD}" to a SINGLE record.\n` +
                `  prefersSingleRecordLink is refused on create and on update alike (422, measured in #334),\n` +
                `  so the app enforces it until this is done. There is no second hand step: this issue\n` +
                `  deletes no field, changes no type and writes no record.`
        );
        process.exit(2);
    }

    console.log("\nDone.");
    process.exit(0);
}

await main();
