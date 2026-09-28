// The batch form refuses a foreign-table id, measured against the live base (#444).
//
// WHY THIS EXISTS. #444's guarantee — that a write by a caller-supplied record id
// cannot land on another table's row — rests on ONE Airtable behavior: the batch forms
// of `update` and `destroy` validate each id against the table addressed and refuse one
// that is not a row of it, where the single-record forms do not (a single `destroy`
// crosses unconditionally). The app was converted to the batch form everywhere and
// `offline/write-by-id-table.mjs` holds that no single-record form comes back — but that
// offline check proves the SHAPE, not the behavior it depends on. If Airtable ever made
// the batch forms cross the way the single-record forms do, every offline check would
// stay green and the guarantee would vanish with nothing saying so. This script is what
// fails when that behavior changes.
//
//   R  — the control the design also leans on: a `RECORD_ID()` select (findByRecordIds)
//        addressed to Users, handed an Auth Tokens id, returns no row. This is how the
//        app's own callers prove an id belongs before they write; if it started
//        crossing, a foreign id would resolve and the proof would be worthless.
//   P3 — a BATCH update addressed to Users with an Auth Tokens id must be REFUSED
//        (measured `ROW_DOES_NOT_EXIST`). If it succeeds, it crossed — the guarantee is
//        gone and this fails.
//   P5 — a BATCH destroy addressed to Users with an Auth Tokens id must be REFUSED
//        (measured `NOT_FOUND`). If it succeeds, it deleted a row of another table.
//   U  — a batch update on the fixture's OWN table writes the field and returns the
//        record, so the conversion did not break the ordinary write.
//   D  — a batch destroy on the fixture's own table removes the row and returns it.
//
// After P3/P5 the control fixture is re-read and must be unchanged and present: a
// refusal that nonetheless wrote or deleted would be the worst outcome, so it is
// checked directly rather than inferred from the thrown error.
//
// FIXTURES, HARMLESS AND ALL CLEANED BY scripts/tests/_fixtures.mjs: three Auth Tokens
// rows, Token `<tag>-<probe>-<rand>`, an Email no Users row carries, Expires At in the
// past and Used true — unusable for a sign-in, no mail and no Blob. One (D) is deleted
// by the test itself through the batch form and untracked; the helper removes the rest.
// Nothing is created on Users: P3/P5 are refusals, and R is a read.
//
// Auth Tokens is the fixture table for the same reason #440 and the #444 measurement
// used it: it shares the `Email` field with Users, so it is the pair a cross-table write
// would actually corrupt, and a token that is expired-and-used is inert.
//
// NEEDS `.env.local` and the loader; no dev server. Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-write-by-id-table-444.mjs
//
// Exit codes: 0 all clear, 1 a check failed or a fixture leaked (a hand is needed).

import crypto from "node:crypto";
import { base, TABLES, findByRecordIds } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-write-by-id-table-444 — the batch form refuses a foreign-table id" });

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return ok;
}

const fixtures = createFixtures({
    tag: "V444",
    buckets: [{ name: "tokens", table: TABLES.AUTH_TOKENS, label: "auth token", tagField: "Token" }],
});
const TAG = fixtures.TAG;
const PAST = "2026-01-01T00:00:00.000Z";

/** One Auth Tokens fixture, tagged so the census sees it, tracked for cleanup. */
async function makeFixture(probe) {
    const email = `v444-${probe}-${crypto.randomBytes(4).toString("hex")}@hanyangengusa.com`;
    const [record] = await base(TABLES.AUTH_TOKENS).create([
        {
            fields: {
                Token: `${TAG}-${probe}-${crypto.randomBytes(4).toString("hex")}`,
                Email: email,
                "Expires At": PAST,
                Used: true,
            },
        },
    ]);
    fixtures.track("tokens", record.id);
    return { id: record.id, email };
}

let complete = false;
try {
    const ctl = await makeFixture("ctl");
    const upd = await makeFixture("upd");
    const del = await makeFixture("del");

    // ── R — a RECORD_ID select addressed to Users does not cross ──────────────────
    console.log("\nR — a RECORD_ID() select addressed to Users, handed an Auth Tokens id:");
    const onUsers = await findByRecordIds(TABLES.USERS, [ctl.id]);
    check("  Users select for an Auth Tokens id returns no row (crossing would return one)", onUsers.length, 0);
    const onOwn = await findByRecordIds(TABLES.AUTH_TOKENS, [ctl.id]);
    check("  and the control: the same select on Auth Tokens finds the row", onOwn.length, 1);

    // ── P3 — batch update addressed to Users with an Auth Tokens id is refused ────
    console.log("\nP3 — a BATCH update addressed to Users with an Auth Tokens id:");
    let p3 = { crossed: false, status: null, error: null };
    try {
        await base(TABLES.USERS).update([{ id: ctl.id, fields: { Email: "v444-p3@hanyangengusa.com" } }]);
        p3 = { crossed: true, status: 200, error: null };
    } catch (err) {
        p3 = { crossed: false, status: err?.statusCode ?? null, error: err?.error ?? null };
    }
    assert("  it is REFUSED — if it succeeded, batch update now crosses tables and the #444 guarantee is gone", p3.crossed === false);
    check("    refused as ROW_DOES_NOT_EXIST", p3.error, "ROW_DOES_NOT_EXIST");
    const afterP3 = await base(TABLES.AUTH_TOKENS).find(ctl.id);
    check("    and the Auth Tokens row's Email is untouched", afterP3.get("Email"), ctl.email);

    // ── P5 — batch destroy addressed to Users with an Auth Tokens id is refused ───
    console.log("\nP5 — a BATCH destroy addressed to Users with an Auth Tokens id:");
    let p5 = { crossed: false, status: null, error: null };
    try {
        await base(TABLES.USERS).destroy([ctl.id]);
        p5 = { crossed: true, status: 200, error: null };
    } catch (err) {
        p5 = { crossed: false, status: err?.statusCode ?? null, error: err?.error ?? null };
    }
    assert("  it is REFUSED — if it succeeded, batch destroy deleted a row of another table", p5.crossed === false);
    check("    refused as NOT_FOUND", p5.error, "NOT_FOUND");
    let ctlPresent = false;
    try {
        await base(TABLES.AUTH_TOKENS).find(ctl.id);
        ctlPresent = true;
    } catch {
        ctlPresent = false;
    }
    assert("    and the Auth Tokens row is still there", ctlPresent);

    // ── U — a batch update on the fixture's own table writes and returns ──────────
    console.log("\nU — a batch update on the row's own table (the conversion still works):");
    const newEmail = "v444-upd-changed@hanyangengusa.com";
    const updReturn = await base(TABLES.AUTH_TOKENS).update([{ id: upd.id, fields: { Email: newEmail } }]);
    assert("  it returns an array of one record", Array.isArray(updReturn) && updReturn.length === 1);
    check("    whose Email is the value written", updReturn[0]?.get("Email"), newEmail);
    const updBack = await base(TABLES.AUTH_TOKENS).find(upd.id);
    check("    and the re-read confirms it landed", updBack.get("Email"), newEmail);

    // ── D — a batch destroy on the fixture's own table removes and returns ────────
    console.log("\nD — a batch destroy on the row's own table:");
    const delReturn = await base(TABLES.AUTH_TOKENS).destroy([del.id]);
    assert("  it returns an array of one record", Array.isArray(delReturn) && delReturn.length === 1);
    // Deleted on purpose as part of the test, so it is no longer a fixture to clean up.
    fixtures.untrack("tokens", del.id);
    let delGone = false;
    try {
        await base(TABLES.AUTH_TOKENS).find(del.id);
        delGone = false;
    } catch {
        delGone = true;
    }
    assert("    and the row is gone", delGone);

    complete = true;
} catch (err) {
    pass = false;
    console.error("\nverify-write-by-id-table-444 failed to run to the end:", err);
}

const teardown = await fixtures.teardown({ complete });
console.log("\n" + fixtures.describe(teardown));
console.log(pass && teardown.leaked.length === 0 ? "\nALL CHECKS PASSED" : "\nSOME CHECKS FAILED");
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
