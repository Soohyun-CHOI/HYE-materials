// Creates `Addresses."Jobs"` (issue #384).
//
// WHAT THE FIELD IS FOR. `Jobs` held `Delivery Address` and `Alternate Delivery
// Address`, so a job could name exactly two places to ship to and a third meant
// adding a field. This link carries as many as a job uses, from the address's
// side, and `Jobs."Delivery Address"` is left naming the default among them.
//
// ONE CALL DOES THE WORK AND AIRTABLE MAKES THE FAR SIDE ITSELF. A
// `multipleRecordLinks` field CREATES cleanly (200) and the symmetric field it
// auto-creates on the far table takes the SOURCE table's name — measured 5 of 5
// in #334, including a link whose far table the same script had just made. So
// `Jobs."Addresses"` appears without being asked for, and this script re-reads
// and PATCHes its name only if Airtable named it something else. That repair
// path is kept even though #334's did not fire, for the failure mode rather than
// the odds: the inverse is the name `getLinkedRecords` addresses, and a wrong one
// is the quiet symptom `docs/notes/airtable-access.md` describes, where
// `record.get()` returns `undefined`, the mappers' `|| []` makes it an empty
// array, and a whole level disappears at HTTP 200.
//
// IT DOES NOT DELETE `Jobs."Alternate Delivery Address"` AND CANNOT. The Metadata
// API offers CREATE and UPDATE for a field and no DELETE — re-measured in #363
// against a real field id, `404 NOT_FOUND` with the field still there afterwards
// — so that removal is a hand step in the Airtable UI. What this script does
// instead is REPORT: it says whether the field is still present, and it names the
// reverse link on `Addresses` that has to go with it. Nothing in the repository
// reads either from #384's commit onward, so the field sits inert until the hand
// step happens, which is exactly how #363 made its own removal safe to defer.
//
// AND IT WATCHES FOR THE ORPHAN-INVERSE TRAP (#335). Deleting a TABLE leaves the
// inverse fields it created on other tables behind, keeping their names and
// losing their type — converted to `singleLineText`, with no `linkedTableId`, so
// a base-wide dangling-link scan reports 0 while they sit there. Whether deleting
// a FIELD does the same is not measured on this base, so this script looks: after
// the hand step, `Addresses."Jobs (Alternate Delivery Address)"` must be GONE, and
// a `singleLineText` of that name is the trap rather than a leftover to ignore.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half of the work
// has no SDK. The consequence is that `lib/airtableOps.js` cannot see these calls
// (`docs/notes/airtable-access.md` records raw `fetch` as one of the two things
// invisible to the counter), so the run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_address_jobs_384.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_address_jobs_384.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// the hand step is still outstanding).

const API = "https://api.airtable.com/v0";
const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;

const DRY_RUN = process.argv.includes("--dry-run");

/** What this run is about, by name. Nothing here is addressed by id from source. */
const ADDRESSES = "Addresses";
const JOBS = "Jobs";
const NEW_FIELD = "Jobs";
const EXPECTED_INVERSE = "Addresses";
const RETIRED_FIELD = "Alternate Delivery Address";
const RETIRED_INVERSE = "Jobs (Alternate Delivery Address)";

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
    const addresses = tables.find((t) => t.name === ADDRESSES);
    const jobs = tables.find((t) => t.name === JOBS);
    if (!addresses) fail(`no table named ${ADDRESSES}`);
    if (!jobs) fail(`no table named ${JOBS}`);

    // ── what the hand step still owes, reported rather than done ────────────
    const retired = jobs.fields.find((f) => f.name === RETIRED_FIELD);
    const retiredInverse = addresses.fields.find((f) => f.name === RETIRED_INVERSE);
    const handSteps = [];
    if (retired) {
        handSteps.push(
            `DELETE ${JOBS}."${RETIRED_FIELD}" (${retired.id}, ${retired.type}) in the Airtable UI — ` +
                `the Metadata API has no field DELETE (404, measured in #363)`
        );
    }
    if (retiredInverse) {
        const trap = retiredInverse.type !== "multipleRecordLinks";
        handSteps.push(
            `DELETE ${ADDRESSES}."${RETIRED_INVERSE}" (${retiredInverse.id}, ${retiredInverse.type})` +
                (trap
                    ? ` — THIS IS #335's ORPHAN INVERSE: it lost its link type and a dangling-link scan will not find it`
                    : ` — it should go with the field above; check it did`)
        );
    }

    // ── the field this script owns ──────────────────────────────────────────
    const existing = addresses.fields.find((f) => f.name === NEW_FIELD);
    let created = false;

    if (existing) {
        if (existing.type !== "multipleRecordLinks") {
            fail(`${ADDRESSES}."${NEW_FIELD}" exists and is a ${existing.type}, not a link — resolve by hand`);
        }
        if (existing.options?.linkedTableId !== jobs.id) {
            fail(`${ADDRESSES}."${NEW_FIELD}" links ${existing.options?.linkedTableId}, not ${JOBS} (${jobs.id})`);
        }
        console.log(`[SKIP]   ${ADDRESSES}."${NEW_FIELD}" already exists (${existing.id}) and links ${JOBS}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${addresses.id}/fields\n` +
                `           { name: "${NEW_FIELD}", type: "multipleRecordLinks", ` +
                `options: { linkedTableId: "${jobs.id}" } }\n` +
                `         and Airtable auto-creates the inverse on ${JOBS}, expected to be named "${EXPECTED_INVERSE}".`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${addresses.id}/fields`, {
            method: "POST",
            body: JSON.stringify({
                name: NEW_FIELD,
                description:
                    "Every job that uses this address (#384). Jobs.\"Delivery Address\" names the one that is " +
                    "the default; neither is a subset of the other and nothing keeps them in step — " +
                    "lib/addressCreation.js:addressesOnJob takes the union.",
                type: "multipleRecordLinks",
                options: { linkedTableId: jobs.id },
            }),
        });
        if (!res.ok) fail(`could not create ${ADDRESSES}."${NEW_FIELD}": ${res.status} ${res.raw}`);
        created = true;
        console.log(`[CREATE] ${ADDRESSES}."${NEW_FIELD}" (${res.body.id}) -> ${JOBS}`);
    }

    // ── the inverse Airtable made, verified rather than assumed ─────────────
    let inverseNote = null;
    if (!DRY_RUN || existing) {
        const after = await api(`/meta/bases/${BASE}/tables`);
        if (!after.ok) fail(`could not re-read the schema: ${after.status} ${after.raw}`);
        const jobsAfter = after.body.tables.find((t) => t.name === JOBS);
        const addressesAfter = after.body.tables.find((t) => t.name === ADDRESSES);
        const ours = addressesAfter.fields.find((f) => f.name === NEW_FIELD);
        const inverseId = ours?.options?.inverseLinkFieldId;
        const inverse = jobsAfter.fields.find((f) => f.id === inverseId);

        if (!inverse) {
            fail(`${ADDRESSES}."${NEW_FIELD}" has no inverse on ${JOBS} — the thing #334 kept a repair path for`);
        } else if (inverse.name === EXPECTED_INVERSE) {
            console.log(`[OK]     ${JOBS}."${inverse.name}" (${inverse.id}) is the inverse, correctly named.`);
        } else if (DRY_RUN) {
            inverseNote = `would PATCH ${JOBS}."${inverse.name}" -> "${EXPECTED_INVERSE}"`;
        } else {
            const patch = await api(`/meta/bases/${BASE}/tables/${jobsAfter.id}/fields/${inverse.id}`, {
                method: "PATCH",
                body: JSON.stringify({ name: EXPECTED_INVERSE }),
            });
            if (!patch.ok) fail(`could not rename the inverse: ${patch.status} ${patch.raw}`);
            console.log(`[PATCH]  ${JOBS}."${inverse.name}" -> "${EXPECTED_INVERSE}" (${inverse.id})`);
        }

        // The single-record toggle every other link on this base needs is NOT
        // wanted here and is stated so nobody reaches for it: an address is used
        // by as many jobs as use it, and a job by as many addresses.
        if (ours?.options?.prefersSingleRecordLink === true) {
            fail(`${ADDRESSES}."${NEW_FIELD}" is set to a single record — this link is deliberately many`);
        }
    }

    // ── what is left ────────────────────────────────────────────────────────
    console.log("");
    if (handSteps.length) {
        console.log("HAND STEPS STILL OUTSTANDING (Airtable UI):");
        handSteps.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
    } else {
        console.log(`No hand step outstanding: ${JOBS}."${RETIRED_FIELD}" and its reverse link are both gone.`);
    }
    if (inverseNote) console.log(`\nAlso, on a real run: ${inverseNote}`);

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }
    if (handSteps.length) {
        console.log("\nIncomplete — the hand steps above have not been done.");
        process.exit(2);
    }
    console.log(created ? "\nDone." : "\nDone — nothing to create.");
    process.exit(0);
}

await main();
