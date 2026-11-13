// Invoices and deliveries stop pairing (#640): the two link fields are gone, and the two
// field descriptions that named one are corrected.
//
// THE METADATA API DELETES NO FIELD, so the deletion is a hand step in the Airtable UI —
// `docs/notes/airtable-access.md` measured the 404 on a real field id (#363) — and it is
// TWO steps, not one: deleting `Invoices."Delivery"` leaves its reverse,
// `Deliveries."Invoices"`, standing as a text field with its name intact (#384). What this
// script contributes is what a script can: it names both fields BY ID, says which are
// still present on the base the run names, and refuses to report a clean base while
// either is — the shape `add_address_jobs_384.mjs` gave the same two-step deletion.
//
// THEN, WITH BOTH GONE, ONE WRITE: two descriptions. `Assets."Category"` and
// `Direct Purchases."Vendor"` each end "the same limit Invoices."Delivery" and Invoice
// Items."PO Item" live with." — false once the first is gone — and `--apply` rewrites that
// clause and nothing else in either. `--apply` refuses while either link field is still
// present, so a description never names a field's absence before the field is absent.
// A description is schema, not a row: no row of `Assets` (a protected table on the live
// base) is read or written, and every request asks `scripts/protectedTables.mjs`'s
// `refusesBeyondDescriptions` first — the guard every script describing that table answers
// to (`offline/protected-tables.mjs` classifies this one `describes`).
//
// RAN ON BOTH BASES (#640), after Soo deleted the two fields by hand on each: the test base
// first, then the live one, each run reporting both fields gone, writing the two descriptions
// and re-run `CLEAN`. It stays runnable as a check — a re-run on a clean base writes nothing.
//
// The test base unless the run names the live one, as every script here (#534):
//   node --env-file=.env.local scripts/import/ran/remove_invoice_delivery_link_640.mjs
//   node --env-file=.env.local scripts/import/ran/remove_invoice_delivery_link_640.mjs --apply
//   AIRTABLE_BASE=live node --env-file=.env.local scripts/import/ran/remove_invoice_delivery_link_640.mjs
//
// Exit codes: 0 when the base is clean (both fields absent, both descriptions corrected),
// 1 when something is left to do or a request failed.

import { describeAirtableBase, resolveAirtableBase } from "../../../lib/airtableBase.js";
import { refusesBeyondDescriptions } from "../../protectedTables.mjs";

const SCRIPT = "remove_invoice_delivery_link_640";
const META_ROOT = "https://api.airtable.com/v0/meta";

/** The two link fields, by id — the same ids on both bases, the test base being the live one's copy. */
const LINK_FIELDS = [
    { table: "Invoices", id: "fldPCoEaVrVlaLHnR", name: "Delivery" },
    { table: "Deliveries", id: "fldiFxLywTfzz9y4t", name: "Invoices" },
];

/** The clause each of the two descriptions carries, and what it says once the link is gone. */
const STALE_CLAUSE = 'the same limit Invoices."Delivery" and Invoice Items."PO Item" live with.';
const CORRECTED_CLAUSE = 'the same limit Invoice Items."PO Item" lives with.';
const DESCRIBED = [
    { table: "Assets", field: "Category" },
    { table: "Direct Purchases", field: "Vendor" },
];

let airtable;

async function request(method, path, body) {
    const url = `${META_ROOT}${path}`;
    if (refusesBeyondDescriptions({ script: SCRIPT, method, url, body })) {
        throw new Error(`${SCRIPT}: the protected-table guard refused ${method} ${path}`);
    }
    const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${airtable.apiKey}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    return text === "" ? null : JSON.parse(text);
}

async function main() {
    const apply = process.argv.includes("--apply");
    try {
        airtable = resolveAirtableBase();
    } catch (error) {
        console.log(`${error.message} — run with --env-file=.env.local`);
        return 1;
    }
    console.log("=".repeat(72));
    console.log("Invoices and deliveries stop pairing — the link fields and two descriptions (#640)");
    console.log(`${describeAirtableBase(airtable)}${apply ? "" : "   [DRY RUN — nothing is written]"}`);
    console.log("=".repeat(72));

    const tables = (await request("GET", `/bases/${airtable.baseId}/tables`)).tables;
    const tableNamed = (name) => tables.find((t) => t.name === name);

    // 1 — the two link fields, by id. A field is PRESENT whatever its type: the reverse
    // survives a deletion of its pair as text, which is the case this exists to catch.
    let present = 0;
    for (const spec of LINK_FIELDS) {
        const field = tableNamed(spec.table)?.fields.find((f) => f.id === spec.id);
        if (field) {
            present++;
            console.log(`  PRESENT  ${spec.table}."${field.name}" (${spec.id}, ${field.type}) — delete it in the Airtable UI`);
        } else {
            console.log(`  gone     ${spec.table}."${spec.name}" (${spec.id})`);
        }
    }
    // ANTI-VACUITY: the two tables were found, so "gone" is about the fields and not about a
    // schema read that came back with nothing.
    for (const name of ["Invoices", "Deliveries"]) {
        if (!tableNamed(name)) {
            console.log(`  the ${name} table was not found — refusing to call anything gone`);
            return 1;
        }
    }

    // 2 — the two descriptions.
    const pending = [];
    for (const spec of DESCRIBED) {
        const field = tableNamed(spec.table)?.fields.find((f) => f.name === spec.field);
        if (!field) {
            console.log(`  ${spec.table}."${spec.field}" was not found — refusing to guess`);
            return 1;
        }
        const description = field.description ?? "";
        if (description.includes(STALE_CLAUSE)) {
            pending.push({ table: tableNamed(spec.table), field, description });
            console.log(`  stale    ${spec.table}."${spec.field}" names Invoices."Delivery"`);
        } else if (description.includes(CORRECTED_CLAUSE)) {
            console.log(`  done     ${spec.table}."${spec.field}"`);
        } else {
            console.log(`  ${spec.table}."${spec.field}" carries neither clause — refusing to edit a description this script does not recognize`);
            return 1;
        }
    }

    if (pending.length > 0 && !apply) {
        console.log(`\n${pending.length} description(s) to correct; --apply writes them once both link fields are gone.`);
    }
    if (pending.length > 0 && apply) {
        if (present > 0) {
            console.log("\nREFUSED: a link field is still present, so a description may not yet say it is gone.");
            return 1;
        }
        for (const { table, field, description } of pending) {
            const next = description.replace(STALE_CLAUSE, CORRECTED_CLAUSE);
            await request("PATCH", `/bases/${airtable.baseId}/tables/${table.id}/fields/${field.id}`, {
                description: next,
            });
            console.log(`  written  ${table.name}."${field.name}" (${field.id})`);
        }
    }

    const clean = present === 0 && (pending.length === 0 || apply);
    console.log(`\n${clean ? "CLEAN" : "NOT CLEAN"} — ${present} link field(s) present, ${apply ? 0 : pending.length} description(s) stale.`);
    return clean ? 0 : 1;
}

main().then(
    (code) => process.exit(code),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
