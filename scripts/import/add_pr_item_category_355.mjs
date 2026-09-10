// Adds `PR Items."Category"`, the link a request item picks instead of a typed
// name (issue #355).
//
// WHY A SCRIPT FOR ONE FIELD. A schema edit leaves no diff of its own, so the
// only record that it happened is here — `docs/notes/verification.md` puts a
// one-time run against the live base in this directory for exactly that reason,
// and `create_material_categories_354.mjs` is the neighbour doing the same job
// for the table this field points at. It is idempotent: a second run finds the
// field and creates nothing.
//
// WHAT IT CANNOT DO, AND THE RUN PRINTS IT RATHER THAN LEAVING IT IMPLIED.
// `prefersSingleRecordLink` is refused on field CREATE (422
// INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE) and on UPDATE (422
// INVALID_REQUEST_UNKNOWN), measured and recorded in
// `docs/notes/airtable-access.md`. So the field arrives allowing several
// categories and a hand toggle in the Airtable UI is what makes it single. The
// app enforces one either way — `parseFormState` sends one record id — but an
// unenforced invariant drifts, which is why the toggle is printed at the end
// where it cannot be lost between this script and the browser.
//
// THE INVERSE IS FREE. Airtable names a symmetric field after the SOURCE table,
// so this produces `Material Categories."PR Items"` — the name we would have
// chosen, so nothing is PATCHed. The run verifies that rather than assuming it:
// a wrong inverse name is the quiet failure `docs/notes/airtable-access.md`
// records, where `record.get()` returns undefined, the mappers' `|| []` makes it
// an empty array, and a whole child level disappears at HTTP 200.
//
// Usage (from the repo root):
//   node --env-file=.env.local scripts/import/add_pr_item_category_355.mjs --dry-run
//   node --env-file=.env.local scripts/import/add_pr_item_category_355.mjs
//
// Airtable PAT scopes: schema.bases:read, schema.bases:write.
//
// Exit codes, per docs/notes/verification.md: 0 the base matches the spec, 1
// something failed, 2 nothing failed but something is incomplete (a dry run, or
// the hand toggle is still outstanding).

const META_ROOT = "https://api.airtable.com/v0/meta";

const PARENT_TABLE = "PR Items";
const TARGET_TABLE = "Material Categories";
const FIELD = "Category";
const EXPECTED_INVERSE = "PR Items";

const FIELD_DESCRIPTION =
    "The catalog path this item is, picked on the request form instead of a name " +
    "being typed (#355). SINGLE record — enforced by this app rather than by the " +
    "schema, since prefersSingleRecordLink is refused on both CREATE and UPDATE. " +
    "Item Name is written from this category's Category Label at save time and is " +
    "the frozen copy every item table already keeps; the two are not allowed to " +
    "disagree, which is why no screen offers Item Name as free text.";

let calls = 0;

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
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

function log(m = "") {
    console.log(m);
}

async function main() {
    const dryRun = process.argv.includes("--dry-run");
    if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
        log("AIRTABLE_API_KEY and AIRTABLE_BASE_ID must be set — run with --env-file=.env.local");
        return 1;
    }
    const baseId = process.env.AIRTABLE_BASE_ID;

    log(`${PARENT_TABLE}."${FIELD}" -> ${TARGET_TABLE}`);
    log(dryRun ? "DRY RUN: nothing will be written.\n" : "");

    const tables = (await api("GET", `/bases/${baseId}/tables`)).tables;
    const parent = tables.find((t) => t.name === PARENT_TABLE);
    const target = tables.find((t) => t.name === TARGET_TABLE);

    if (!parent) { log(`  ${PARENT_TABLE} not found in this base.`); return 1; }
    if (!target) {
        log(`  ${TARGET_TABLE} not found. Run create_material_categories_354.mjs first.`);
        return 1;
    }

    const existing = parent.fields.find((f) => f.name === FIELD);
    if (existing) {
        log(`  ${PARENT_TABLE}."${FIELD}" already exists (${existing.id}, ${existing.type}).`);
        if (existing.type !== "multipleRecordLinks") {
            log(`  ...but it is \`${existing.type}\`, not a link. A field's type cannot be PATCHed.`);
            return 1;
        }
    } else if (dryRun) {
        log(`  would create ${PARENT_TABLE}."${FIELD}" (multipleRecordLinks -> ${TARGET_TABLE})`);
    } else {
        const created = await api("POST", `/bases/${baseId}/tables/${parent.id}/fields`, {
            name: FIELD,
            type: "multipleRecordLinks",
            description: FIELD_DESCRIPTION,
            options: { linkedTableId: target.id },
        });
        log(`  created ${PARENT_TABLE}."${FIELD}" (${created.id})`);
    }

    // Verification is part of the run: what was asked for and what exists can
    // differ, and the inverse's NAME is the one difference nothing would report.
    log("");
    log("verifying against the live schema:");
    const after = (await api("GET", `/bases/${baseId}/tables`)).tables;
    const field = after.find((t) => t.name === PARENT_TABLE)?.fields.find((f) => f.name === FIELD);
    const inverse = after
        .find((t) => t.name === TARGET_TABLE)
        ?.fields.find((f) => f.id === field?.options?.inverseLinkFieldId);

    if (dryRun && !field) {
        log(`  ${FIELD} not present, as expected on a dry run`);
        return finish(2, "dry run — nothing was written");
    }

    let ok = true;
    const check = (label, actual, expected) => {
        const good = actual === expected;
        if (!good) ok = false;
        log(`  ${good ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    };

    check("field type", field?.type ?? "(missing)", "multipleRecordLinks");
    check("linked table", field?.options?.linkedTableId ?? "(missing)", target.id);
    check("inverse field name", inverse?.name ?? "(missing)", EXPECTED_INVERSE);
    if (!ok) return finish(1, "the base does not match the spec");

    const single = field?.options?.prefersSingleRecordLink === true;
    log(`  single-record: ${single ? "on" : "OFF"}`);
    if (single) return finish(0, "the base matches the spec");

    log("");
    log("=".repeat(72));
    log("HAND STEP — in the Airtable UI:");
    log("");
    log(`  Open ${PARENT_TABLE}, edit the "${FIELD}" field, and turn OFF`);
    log(`  "Allow linking to multiple records".`);
    log("");
    log("  Why by hand: prefersSingleRecordLink is refused on field CREATE (422");
    log("  INVALID_FIELD_TYPE_OPTIONS_FOR_CREATE) and on UPDATE (422");
    log("  INVALID_REQUEST_UNKNOWN), measured on this base. The app sends one");
    log("  record id either way; the toggle is what stops a hand edit adding a");
    log("  second category to a row nothing would then be able to name.");
    log("=".repeat(72));
    return finish(2, "waiting on the hand toggle above");
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
