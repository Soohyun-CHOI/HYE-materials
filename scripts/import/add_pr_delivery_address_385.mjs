// Creates `Purchase Requests."Delivery Address"`, and gives one demo job a
// default address to be seen against (issue #385).
//
// WHAT THE FIELD IS FOR. A request had no address of its own, so where its
// material goes was read off the job whenever anybody needed it — which means a
// request that should ship somewhere other than the job's usual place could not
// say so, and the requester is the only person who knows. This link is what the
// form writes, and #386 freezes it onto the order at generation.
//
// TWO WRITES, AND THE SECOND ONE IS THE PART WORTH READING. The field is a
// schema edit; setting `Jobs."Delivery Address"` on `26-DEMO-01` is a RECORD
// edit, and it is here because the app has no SCREEN that writes a job's default
// address — which is not the same thing as the value being unscriptable. It is
// `scripts/import/`'s own category: a one-time backfill against the live base
// with no diff of its own, the shape #356 used to give every `Materials` row a
// category and #381 used to clear nine `First Name` cells. Without it, the
// "this job has a default" half of the form is unreachable on this base and no
// browser walk can show it.
//
// THE DEMO VALUE IS NOT THE FEATURE, AND THE SCRIPT SAYS SO ON EVERY RUN. The
// default belongs to whoever owns a job, and no screen in this app sets one yet;
// #385 deliberately does not build that screen (see docs/notes/addresses.md).
// What this write buys is a base on which both halves of the form can be looked
// at — which is why it targets ONE of the two jobs and leaves the other empty.
//
// IT NEVER OVERWRITES. A job that already has a default is reported and left
// alone, `create_material_categories_354.mjs`'s posture for reference data a
// re-run must not silently edit. So a second run is a no-op and says so.
//
// THE ONE HAND STEP IS `prefersSingleRecordLink`, which is refused on field
// CREATE (422 `INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE`) and on field UPDATE (422
// `INVALID_REQUEST_UNKNOWN`) alike — measured, and re-measured on five fresh
// link fields in #334. It is READABLE, so this script asserts it at the end and
// exits 2 until the toggle is done. The app enforces single-record itself in the
// meantime, which is the invariant-on-the-DATA shape this base already lives
// with.
//
// A NOTE ON REVERSING THIS. Deleting a link field leaves the inverse standing on
// the far table with its name and without its type — #335 measured that for a
// table deletion and #384 measured the same for a single field. So this script
// also refuses to report a clean base while a `singleLineText` named like one of
// its own inverses is present, which is the state a half-undone run leaves.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half has no SDK.
// So `lib/airtableOps.js` cannot see these calls (`docs/notes/airtable-access.md`
// records raw `fetch` as one of the two things invisible to the counter) and the
// run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_pr_delivery_address_385.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_pr_delivery_address_385.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read,
// data.records:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// the toggle is still outstanding).

const API = "https://api.airtable.com/v0";
const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;

const DRY_RUN = process.argv.includes("--dry-run");

const REQUESTS = "Purchase Requests";
const ADDRESSES = "Addresses";
const JOBS = "Jobs";
const NEW_FIELD = "Delivery Address";
const EXPECTED_INVERSE = "Purchase Requests";

/**
 * The demo default. ONE job, by design — the other stays empty so the form's
 * no-default branch is on the same base as its default branch.
 */
const DEMO_JOB_CODE = "26-DEMO-01";
const DEMO_ADDRESS_LABEL = "Round Rock Compressor Station - Site";

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

async function main() {
    if (!KEY || !BASE) fail("AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required — run with --env-file=.env.local");

    console.log(`Base ${BASE}${DRY_RUN ? "  (DRY RUN — nothing is written)" : ""}\n`);

    const schema = await api(`/meta/bases/${BASE}/tables`);
    if (!schema.ok) fail(`could not read the schema: ${schema.status} ${schema.raw}`);

    const tables = schema.body.tables;
    const requests = tables.find((t) => t.name === REQUESTS);
    const addresses = tables.find((t) => t.name === ADDRESSES);
    const jobs = tables.find((t) => t.name === JOBS);
    for (const [name, table] of [[REQUESTS, requests], [ADDRESSES, addresses], [JOBS, jobs]]) {
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
    const existing = requests.fields.find((f) => f.name === NEW_FIELD);
    if (existing) {
        if (existing.type !== "multipleRecordLinks") {
            fail(`${REQUESTS}."${NEW_FIELD}" exists and is a ${existing.type}, not a link — resolve by hand`);
        }
        if (existing.options?.linkedTableId !== addresses.id) {
            fail(`${REQUESTS}."${NEW_FIELD}" links ${existing.options?.linkedTableId}, not ${ADDRESSES}`);
        }
        console.log(`[SKIP]   ${REQUESTS}."${NEW_FIELD}" already exists (${existing.id}) and links ${ADDRESSES}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${requests.id}/fields\n` +
                `           { name: "${NEW_FIELD}", type: "multipleRecordLinks", ` +
                `options: { linkedTableId: "${addresses.id}" } }\n` +
                `         and Airtable auto-creates the inverse on ${ADDRESSES}, expected "${EXPECTED_INVERSE}".`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${requests.id}/fields`, {
            method: "POST",
            body: JSON.stringify({
                name: NEW_FIELD,
                description:
                    "Where this request's material goes (#385). Picked by the requester on /prs/new — the " +
                    "job's default address or a different one — and app-enforced single-record. #386 copies " +
                    "it onto the purchase order at generation, so later edits to the job do not move it.",
                type: "multipleRecordLinks",
                options: { linkedTableId: addresses.id },
            }),
        });
        if (!res.ok) fail(`could not create ${REQUESTS}."${NEW_FIELD}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${REQUESTS}."${NEW_FIELD}" (${res.body.id}) -> ${ADDRESSES}`);
    }

    // ── 2: the inverse Airtable made, verified and renamed if needed ────────
    let toggleOutstanding = false;
    if (!DRY_RUN || existing) {
        const after = await api(`/meta/bases/${BASE}/tables`);
        if (!after.ok) fail(`could not re-read the schema: ${after.status} ${after.raw}`);
        const requestsAfter = after.body.tables.find((t) => t.name === REQUESTS);
        const addressesAfter = after.body.tables.find((t) => t.name === ADDRESSES);
        const ours = requestsAfter.fields.find((f) => f.name === NEW_FIELD);
        const inverse = addressesAfter.fields.find((f) => f.id === ours?.options?.inverseLinkFieldId);

        if (!inverse) {
            fail(`${REQUESTS}."${NEW_FIELD}" has no inverse on ${ADDRESSES}`);
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

    // ── 3: the demo default, a record write ─────────────────────────────────
    const jobRows = await api(
        `/${BASE}/${jobs.id}?fields%5B%5D=Job%20Code&fields%5B%5D=Delivery%20Address`
    );
    if (!jobRows.ok) fail(`could not read ${JOBS}: ${jobRows.status} ${jobRows.raw}`);
    const job = jobRows.body.records.find((r) => r.fields["Job Code"] === DEMO_JOB_CODE);
    if (!job) fail(`no ${JOBS} row with Job Code ${DEMO_JOB_CODE}`);

    const addressRows = await api(`/${BASE}/${addresses.id}?fields%5B%5D=Address%20Label`);
    if (!addressRows.ok) fail(`could not read ${ADDRESSES}: ${addressRows.status} ${addressRows.raw}`);
    const address = addressRows.body.records.find(
        (r) => r.fields["Address Label"] === DEMO_ADDRESS_LABEL
    );
    if (!address) fail(`no ${ADDRESSES} row labeled "${DEMO_ADDRESS_LABEL}"`);

    const currently = job.fields["Delivery Address"] ?? [];
    if (currently.length > 0) {
        console.log(
            `[SKIP]   ${JOBS} ${DEMO_JOB_CODE} (${job.id}) already has a "${NEW_FIELD}" ` +
                `(${currently.join(", ")}) — never overwritten.`
        );
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  PATCH /${BASE}/${jobs.id}/${job.id}\n` +
                `           { "Delivery Address": ["${address.id}"] }\n` +
                `         ${JOBS} ${DEMO_JOB_CODE}: "Delivery Address" [] -> ["${DEMO_ADDRESS_LABEL}"]`
        );
    } else {
        const patch = await api(`/${BASE}/${jobs.id}/${job.id}`, {
            method: "PATCH",
            body: JSON.stringify({ fields: { "Delivery Address": [address.id] } }),
        });
        if (!patch.ok) fail(`could not set the demo default: ${patch.status} ${patch.raw}`);
        console.log(
            `[UPDATE] ${JOBS} ${DEMO_JOB_CODE} "Delivery Address" -> "${DEMO_ADDRESS_LABEL}" (${address.id})`
        );
    }

    // The other job is named rather than left implicit: a reader who finds one
    // job with a default and one without should meet that as a decision.
    const others = jobRows.body.records
        .filter((r) => r.id !== job.id)
        .map((r) => `${r.fields["Job Code"]} (${(r.fields["Delivery Address"] ?? []).length ? "has one" : "none"})`);
    if (others.length) {
        console.log(`         Left alone, so both branches of the form can be seen: ${others.join(", ")}.`);
    }

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }
    if (toggleOutstanding) {
        console.log(
            `\nHAND STEP OUTSTANDING (Airtable UI): set ${REQUESTS}."${NEW_FIELD}" to a SINGLE record.\n` +
                `  prefersSingleRecordLink is refused on create and on update alike (422, measured in #334),\n` +
                `  so the app enforces it until this is done.`
        );
        process.exit(2);
    }
    console.log("\nDone.");
    process.exit(0);
}

await main();
