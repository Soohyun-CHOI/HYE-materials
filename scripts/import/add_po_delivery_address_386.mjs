// Creates `Purchase Orders."Delivery Address"`, and checks the select it replaces
// is safe to delete (issue #386).
//
// WHAT THE FIELD IS FOR. A purchase order is a frozen snapshot of what a request
// agreed, and the purchase order PDF prints a ship-to that a vendor is emailed. So
// the order has to KEEP the address the requester picked rather than re-read the
// job's, which is what `lib/poPdf.js` did until this issue. `lib/poGeneration.js`
// copies `Purchase Requests."Delivery Address"` onto it at generation, in the same
// create as `Shipping Fee` and for the same reason.
//
// IT CREATES A FIELD RATHER THAN CONVERTING ONE, AND THAT IS THE ISSUE'S MAIN
// DECISION. `Purchase Orders."Delivery Address Used"` is a singleSelect holding
// Primary/Alternate, and the obvious reading of this issue is to retype it in the
// UI — the Metadata API refuses a type change (422) — with the code taking both
// shapes across the window, which is the order #356 used for
// `Materials."Item Name"`. That ordering does not transfer. What made #356's
// window zero is that its committed code STOPPED WRITING the retyped field; this
// issue's code has to START. Whichever half lands first, the other is writing the
// wrong shape into `createPO`: an address record id into a select, or `"Primary"`
// into a link, and both come back
// `Insufficient permissions to create new select option` — so the create fails,
// the rollback runs, and PO generation is down for the length of one hand edit.
//
// A new field is additive, so the window really is zero: old code ignores it and
// new code writes it. The select is left inert and deleted by hand afterwards,
// which is #363's shape — nothing in the repository reads it from that commit on.
//
// NO BACKFILL, AND THE REASON IS THE ONE THE FIELD EXISTS FOR. `Primary` means
// "the job's default address", and all 34 orders on this base are on `26-DEMO-01`,
// which now has one — so a backfill is available and was rejected. Those orders
// were created 2026-09-11; `26-DEMO-01` was given its default on 2026-09-15 by
// `add_pr_delivery_address_385.mjs`, and the `Addresses` row it points at was
// created that same day. Writing it onto them would not restore what was true at
// the time, it would apply today's value to past documents — which is exactly what
// a frozen copy exists to prevent. Their attached PDFs print the em dash, so an
// empty link is also the state the documents already say.
//
// WHAT THIS SCRIPT DOES INSTEAD IS EARN THE DELETION. It asserts that every
// `Purchase Orders` row holds `Delivery Address Used: Primary` and nothing else,
// which is what makes dropping the field lossless: one value, one meaning, and no
// row carrying something the new link would have to represent. A row holding a
// THIRD thing is a hard failure rather than a note, because it would mean the
// field had acquired a second meaning nobody wrote code for.
//
// AN EMPTY CELL PASSES, AND THE FIRST VERSION OF THIS CHECK GOT THAT WRONG. It
// required all 34 rows to hold `Primary`, which was true when it was written and
// false twenty minutes later: `createPO` stops writing the select in this same
// commit, so every order generated from then on leaves it blank, and a re-run
// failed on the two orders this issue's own browser walk had just created
// correctly. The claim that matters is about what is CARRIED, not about how many
// rows carry it — so a blank is counted and reported rather than admitted as an
// exception, and the figure the deletion rests on is "no row holds a third value".
//
// A NOTE ON REVERSING THIS. Deleting a link field leaves the inverse standing on
// the far table with its name and without its type — #335 measured it for a table
// deletion, #384 for a single field. So this refuses to report a clean base while a
// `singleLineText` named like its own inverse is present. **The field being RETIRED
// here is not a link**, so it leaves nothing behind when it is deleted; that is
// stated so nobody goes looking for an orphan that cannot exist.
//
// IT TALKS TO THE REST API DIRECTLY rather than through `lib/airtable/client.js`,
// for `create_material_categories_354.mjs`'s reason: the schema half has no SDK.
// So `lib/airtableOps.js` cannot see these calls (`docs/notes/airtable-access.md`
// records raw `fetch` as one of the two things invisible to the counter) and the
// run prints its own count.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_po_delivery_address_386.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_po_delivery_address_386.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write, data.records:read.
// It makes no record write at all, which is the whole of the no-backfill decision
// expressed as a scope.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or a
// hand step is still outstanding).

const API = "https://api.airtable.com/v0";
const KEY = process.env.AIRTABLE_API_KEY;
const BASE = process.env.AIRTABLE_BASE_ID;

const DRY_RUN = process.argv.includes("--dry-run");

const ORDERS = "Purchase Orders";
const ADDRESSES = "Addresses";
const NEW_FIELD = "Delivery Address";
const EXPECTED_INVERSE = "Purchase Orders";

/** The select this replaces, and the one value every row is expected to hold. */
const RETIRED_FIELD = "Delivery Address Used";
const RETIRED_VALUE = "Primary";

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
    const orders = tables.find((t) => t.name === ORDERS);
    const addresses = tables.find((t) => t.name === ADDRESSES);
    for (const [name, table] of [[ORDERS, orders], [ADDRESSES, addresses]]) {
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
    const existing = orders.fields.find((f) => f.name === NEW_FIELD);
    if (existing) {
        if (existing.type !== "multipleRecordLinks") {
            fail(`${ORDERS}."${NEW_FIELD}" exists and is a ${existing.type}, not a link — resolve by hand`);
        }
        if (existing.options?.linkedTableId !== addresses.id) {
            fail(`${ORDERS}."${NEW_FIELD}" links ${existing.options?.linkedTableId}, not ${ADDRESSES}`);
        }
        console.log(`[SKIP]   ${ORDERS}."${NEW_FIELD}" already exists (${existing.id}) and links ${ADDRESSES}.`);
    } else if (DRY_RUN) {
        console.log(
            `[WOULD]  POST /meta/bases/${BASE}/tables/${orders.id}/fields\n` +
                `           { name: "${NEW_FIELD}", type: "multipleRecordLinks", ` +
                `options: { linkedTableId: "${addresses.id}" } }\n` +
                `         and Airtable auto-creates the inverse on ${ADDRESSES}, expected "${EXPECTED_INVERSE}".`
        );
    } else {
        const res = await api(`/meta/bases/${BASE}/tables/${orders.id}/fields`, {
            method: "POST",
            body: JSON.stringify({
                name: NEW_FIELD,
                description:
                    "Where this order's material goes (#386). A frozen copy of Purchase Requests.\"Delivery " +
                    "Address\" taken at PO generation and never rewritten, so a later edit to the job or the " +
                    "request does not move what the purchase order PDF told the vendor. App-enforced " +
                    "single-record. Empty on an order generated from a request raised before #385 required " +
                    "one. Replaces the Delivery Address Used select, which named which of a job's two " +
                    "addresses was used and could name nothing once #384 left a job with one.",
                type: "multipleRecordLinks",
                options: { linkedTableId: addresses.id },
            }),
        });
        if (!res.ok) fail(`could not create ${ORDERS}."${NEW_FIELD}": ${res.status} ${res.raw}`);
        console.log(`[CREATE] ${ORDERS}."${NEW_FIELD}" (${res.body.id}) -> ${ADDRESSES}`);
    }

    // ── 2: the inverse Airtable made, verified and renamed if needed ────────
    let toggleOutstanding = false;
    if (!DRY_RUN || existing) {
        const after = await api(`/meta/bases/${BASE}/tables`);
        if (!after.ok) fail(`could not re-read the schema: ${after.status} ${after.raw}`);
        const ordersAfter = after.body.tables.find((t) => t.name === ORDERS);
        const addressesAfter = after.body.tables.find((t) => t.name === ADDRESSES);
        const ours = ordersAfter.fields.find((f) => f.name === NEW_FIELD);
        const inverse = addressesAfter.fields.find((f) => f.id === ours?.options?.inverseLinkFieldId);

        if (!inverse) {
            fail(`${ORDERS}."${NEW_FIELD}" has no inverse on ${ADDRESSES}`);
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

    // ── 3: the select is safe to delete, asserted rather than assumed ───────
    //
    // THIS IS A READ AND IT RUNS EVEN ON A DRY RUN, because it is the half that
    // decides whether a hand step is safe rather than the half that writes. The
    // claim it earns is narrow and exact: every row holds one value, so nothing
    // is carried by this field that the new link would have to represent.
    const retired = orders.fields.find((f) => f.name === RETIRED_FIELD);
    if (!retired) {
        console.log(
            `[OK]     ${ORDERS}."${RETIRED_FIELD}" is already gone — the hand step has been done.`
        );
    } else {
        const rows = await allRecords(orders.id, ["PO ID", RETIRED_FIELD]);
        const held = rows.filter((r) => r.fields[RETIRED_FIELD] === RETIRED_VALUE);
        const blank = rows.filter((r) => r.fields[RETIRED_FIELD] === undefined);
        const odd = rows.filter(
            (r) => r.fields[RETIRED_FIELD] !== undefined && r.fields[RETIRED_FIELD] !== RETIRED_VALUE
        );
        if (odd.length > 0) {
            fail(
                `${odd.length} of ${rows.length} ${ORDERS} rows hold a third value in ` +
                    `"${RETIRED_FIELD}" — ` +
                    odd
                        .slice(0, 5)
                        .map((r) => `${r.fields["PO ID"]} = ${JSON.stringify(r.fields[RETIRED_FIELD])}`)
                        .join(", ") +
                    `${odd.length > 5 ? ", …" : ""}. The field has a second meaning and deleting it would ` +
                    `lose something — resolve before the hand step.`
            );
        }
        console.log(
            `[OK]     ${ORDERS}."${RETIRED_FIELD}" (${retired.id}, ${retired.type}) carries one value and ` +
                `no other: ${held.length} rows "${RETIRED_VALUE}", ${blank.length} blank, 0 anything else ` +
                `— nothing lost by deleting it.`
        );
        if (blank.length > 0) {
            console.log(
                `         The blanks are orders generated since this issue's commit, which stopped ` +
                    `writing the select. Expected, not a gap.`
            );
        }
        console.log(
            `         NOT BACKFILLED ONTO "${NEW_FIELD}", deliberately: the "${RETIRED_VALUE}" rows ` +
                `predate the job default that value would resolve to. See this file's header.`
        );
    }

    console.log(`\n${calls} Airtable API call${calls === 1 ? "" : "s"}.`);

    if (DRY_RUN) {
        console.log("\nDry run — nothing was written.");
        process.exit(2);
    }

    const handSteps = [];
    if (toggleOutstanding) {
        handSteps.push(
            `set ${ORDERS}."${NEW_FIELD}" to a SINGLE record.\n` +
                `    prefersSingleRecordLink is refused on create and on update alike (422, measured in\n` +
                `    #334), so the app enforces it until this is done.`
        );
    }
    if (retired) {
        handSteps.push(
            `delete ${ORDERS}."${RETIRED_FIELD}" (${retired.id}).\n` +
                `    The Metadata API offers CREATE and UPDATE for a field and no DELETE (404, re-measured\n` +
                `    in #363). Nothing in the repository reads it from this issue's commit on, so it is\n` +
                `    inert until then. It is a ${retired.type} and not a link, so unlike #384's removal it\n` +
                `    leaves no named-but-typeless field behind on any other table.`
        );
    }
    if (handSteps.length > 0) {
        console.log(`\nHAND STEP${handSteps.length === 1 ? "" : "S"} OUTSTANDING (Airtable UI):`);
        handSteps.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
        process.exit(2);
    }

    console.log("\nDone.");
    process.exit(0);
}

await main();
