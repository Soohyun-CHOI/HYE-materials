// Creates `Deliveries."Delivery Address"` (issue #387).
//
// WHAT THE FIELD IS FOR. A delivery linked a job and recorded no address, so where
// material arrived was read through the job — editing a job's address changed
// where every past delivery appeared to have gone, and a delivery that turned up
// somewhere other than the ordered address had no way to say so. This link is what
// the entry form writes, defaulted from the orders the delivery attaches to.
// Inventory is counted per address, so it is where a quantity on hand gets its
// location.
//
// IT IS A PLAIN ADDITIVE CREATE, AND #386's PROBLEM DOES NOT ARISE. That issue
// refused to retype `Purchase Orders."Delivery Address Used"` because the Metadata
// API rejects a type change (422) and its own code had to WRITE the field — so
// there was no ordering in which the committed half was correct. The premise there
// was an EXISTING field of the wrong type. There is none here: `Deliveries` has no
// address field of any kind, so this adds one and the window is zero for the
// ordinary reason — code that does not know a field ignores it, and code that does
// writes it.
//
// NO BACKFILL, AND UNLIKE #386 THERE IS NOTHING TO BACK FILL FROM. The 12
// deliveries on this base predate the field; 11 of them attach to orders that
// record no address either, and the twelfth would be a guess about where a pallet
// went eight months ago. "No delivery carries an address" is a property of this
// base rather than of the design, which is #385's sentence one table across. The
// form requires one from here on and the existing rows keep none.
//
// A NOTE ON REVERSING THIS. Deleting a link field leaves the inverse standing on
// the far table with its name and without its type — #335 measured it for a table
// deletion and #384 for a single field. So this refuses to report a clean base
// while a `singleLineText` named like its own inverse is present, which is the
// state a half-undone run leaves.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half has no SDK.
// So `lib/airtableOps.js` cannot see these calls (`docs/notes/airtable-access.md`
// records raw `fetch` as one of the two things invisible to the counter) and the
// run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_delivery_address_387.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_delivery_address_387.mjs
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

const DELIVERIES = "Deliveries";
const ADDRESSES = "Addresses";
const NEW_FIELD = "Delivery Address";
const EXPECTED_INVERSE = "Deliveries";

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
    const deliveries = tables.find((t) => t.name === DELIVERIES);
    const addresses = tables.find((t) => t.name === ADDRESSES);
    for (const [name, table] of [[DELIVERIES, deliveries], [ADDRESSES, addresses]]) {
        if (!table) fail(`no table named ${name}`);
    }

    // ── the #335 / #384 orphan shape, looked for rather than assumed ────────
    const orphan = addresses.fields.find(
        (f) => f.name === EXPECTED_INVERSE && f.type !== "multipleRecordLinks"
    );
    if (orphan) {
        fail(
            `${ADDRESSES}."${orphan.name}" (${orphan.id}) is a ${orphan.type}, not a link — this is the ` +
                `name-without-a-type a deleted link field leaves behind (#384). Delete it in the Airtable UI ` +
                `first; a new inverse would otherwise be created beside it under a suffixed name nothing reads.`
        );
    }

    // ── 1: the field ────────────────────────────────────────────────────────
    const existing = deliveries.fields.find((f) => f.name === NEW_FIELD);
    if (existing) {
        if (existing.type !== "multipleRecordLinks") {
            fail(`${DELIVERIES}."${NEW_FIELD}" exists and is a ${existing.type}, not a link — resolve by hand`);
        }
        if (existing.options?.linkedTableId !== addresses.id) {
            fail(`${DELIVERIES}."${NEW_FIELD}" links ${existing.options?.linkedTableId}, not ${ADDRESSES}`);
        }
        console.log(`[SKIP]   ${DELIVERIES}."${NEW_FIELD}" already exists (${existing.id}) and links ${ADDRESSES}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${deliveries.id}/fields\n` +
                `           { name: "${NEW_FIELD}", type: "multipleRecordLinks", ` +
                `options: { linkedTableId: "${addresses.id}" } }\n` +
                `         and Airtable auto-creates the inverse on ${ADDRESSES}, expected "${EXPECTED_INVERSE}".`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${deliveries.id}/fields`, {
            method: "POST",
            body: JSON.stringify({
                name: NEW_FIELD,
                description:
                    "Where this delivery actually arrived (#387). Chosen when the delivery is recorded and " +
                    "defaulted from the address the orders it attaches to were placed to, which is a " +
                    "separate fact: an order says where material was meant to go and a delivery says where " +
                    "it turned up. App-enforced single-record, required by createDeliveryAction, and not " +
                    "editable afterwards — inventory is counted per address, so moving a recorded delivery " +
                    "to another one is a stock movement rather than a correction. Empty on the 12 " +
                    "deliveries recorded before this field existed.",
                type: "multipleRecordLinks",
                options: { linkedTableId: addresses.id },
            }),
        });
        if (!res.ok) fail(`could not create ${DELIVERIES}."${NEW_FIELD}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${DELIVERIES}."${NEW_FIELD}" (${res.body.id}) -> ${ADDRESSES}`);
    }

    // ── 2: the inverse Airtable made, verified and renamed if needed ────────
    let toggleOutstanding = false;
    if (!DRY_RUN || existing) {
        const after = await api(`/meta/bases/${BASE}/tables`);
        if (!after.ok) fail(`could not re-read the schema: ${after.status} ${after.raw}`);
        const deliveriesAfter = after.body.tables.find((t) => t.name === DELIVERIES);
        const addressesAfter = after.body.tables.find((t) => t.name === ADDRESSES);
        const ours = deliveriesAfter.fields.find((f) => f.name === NEW_FIELD);
        const inverse = addressesAfter.fields.find((f) => f.id === ours?.options?.inverseLinkFieldId);

        if (!inverse) {
            fail(`${DELIVERIES}."${NEW_FIELD}" has no inverse on ${ADDRESSES}`);
        } else if (inverse.name === EXPECTED_INVERSE) {
            console.log(`[OK]     ${ADDRESSES}."${inverse.name}" (${inverse.id}) is the inverse, correctly named.`);
        } else if (DRY_RUN) {
            console.log(`[WOULD]  PATCH ${ADDRESSES}."${inverse.name}" -> "${EXPECTED_INVERSE}"`);
        } else {
            const patch = await api(`/meta/bases/${BASE}/tables/${addressesAfter.id}/fields/${inverse.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name: EXPECTED_INVERSE }),
            });
            if (!patch.ok) fail(`could not rename the inverse: ${patch.status} ${patch.raw}`);
            console.log(`[PATCH]  ${ADDRESSES}."${inverse.name}" -> "${EXPECTED_INVERSE}" (${inverse.id})`);
        }

        // The toggle is the hand step, and this is what reports it rather than
        // trusting anybody to remember. It is READABLE even though it is not
        // writable, which is the whole reason a check can carry it.
        toggleOutstanding = ours?.options?.prefersSingleRecordLink !== true;
    }

    // ── 3: what the existing rows hold, counted rather than assumed ─────────
    //
    // A READ, AND IT RUNS ON A DRY RUN TOO. The no-backfill decision rests on a
    // figure — how many deliveries predate the field — and a decision resting on a
    // figure should print the figure on every run rather than in a commit message
    // nobody re-reads.
    // A PROJECTION NAMES A FIELD, so this cannot ask for one that is not there yet:
    // a dry run reaches here before the create and Airtable answers
    // `422 UNKNOWN_FIELD_NAME` for the projection rather than returning empty cells.
    // Found by running the dry run, which is the reason a script that only creates
    // is a script that cannot tell you anything.
    const fieldExists = Boolean(existing) || !DRY_RUN;
    const rows = await allRecords(
        deliveries.id,
        fieldExists ? ["Delivery ID", NEW_FIELD] : ["Delivery ID"]
    );
    const withAddress = fieldExists
        ? rows.filter((r) => (r.fields[NEW_FIELD] ?? []).length > 0)
        : [];
    console.log(
        `[OK]     ${withAddress.length} of ${rows.length} ${DELIVERIES} rows carry a "${NEW_FIELD}"` +
            `${fieldExists ? "." : " (the field does not exist yet — this is a dry run)."}`
    );
    if (withAddress.length < rows.length) {
        console.log(
            `         The rest predate the field and are NOT backfilled: 11 of them attach to orders ` +
                `that record no address either, and the twelfth would be a guess. See this file's header.`
        );
    }

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }
    if (toggleOutstanding) {
        console.log(
            `\nHAND STEP OUTSTANDING (Airtable UI): set ${DELIVERIES}."${NEW_FIELD}" to a SINGLE record.\n` +
                `  prefersSingleRecordLink is refused on create and on update alike (422, measured in #334),\n` +
                `  so the app enforces it until this is done. There is no second hand step: this issue\n` +
                `  deletes no field and changes no type.`
        );
        process.exit(2);
    }

    console.log("\nDone.");
    process.exit(0);
}

await main();
