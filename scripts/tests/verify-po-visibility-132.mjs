// Verification for issue #132 — PO detail row-visibility gate.
//
// The PO detail page is a Server Component; its gate is the pure function
// canViewPR (lib/prVisibility.js), called server-side, and a false result is
// rendered as "PO not found" (never a hidden link).
//
// #152 moved canViewPR's decision table (the old Part A) to
// scripts/tests/offline/pr-visibility.mjs, where it runs with plain `node` on
// every push. It was always a pure-function check; it only needed credentials
// because it shared a file with the Airtable parts below. Run it with
// `npm test`.
//
// What is left here needs the base: Part B shows that the employee data path
// (getItemsByPO) carries none of the invoice-derived fields the privileged path
// (getInvoicingStatusByPO) adds — i.e. the hidden data is omitted server-side,
// not hidden in the client — and Part C creates one throwaway PR+PO to prove
// the sign action refuses a non-President and leaves the PO unsigned, then
// deletes the fixture.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-po-visibility-132.mjs

import { getItemsByPO, getInvoicingStatusByPO } from "../../lib/airtable/poItems.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { getPOByRecordId } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order; POs before PRs, since a PO links its PR.
//
// No Materials bucket, measured rather than assumed: the PO comes from
// generatePOForApprovedPR, which writes the item axis as a side effect (#18), but
// this PR carries no Vendor, so refreshMaterialsCacheForPO returns
// `skippedAll: "no Vendor on the PR"` before writing anything — and the PR has no
// items at all, so there would be nothing to key a material on either.
const fixtures = createFixtures({
    tag: "V132",
    buckets: [
        // No tagField: written by generatePOForApprovedPR, and this script sets no
        // text field on it. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // Tagged, under the rule's second clause (#171): this script calls
        // createPR, so the tag is one argument away.
        {
            name: "prs",
            table: TABLES.PURCHASE_REQUESTS,
            label: "PR",
            tagField: "Notes",
            children: [{ link: "PR Items", table: TABLES.PR_ITEMS, label: "PR Item" }],
        },
    ],
});
const TAG = fixtures.TAG;
const track = fixtures.track;

console.log("Part B — invoice-derived fields omitted from the employee path:");
const poRecords = await base(TABLES.PURCHASE_ORDERS).select({ maxRecords: 1 }).all();
if (poRecords.length === 0) {
    console.log("  (skipped — no PO records in the base to sample)");
} else {
    const poId = poRecords[0].id;
    const [plain, withInvoicing] = await Promise.all([
        getItemsByPO(poId),
        getInvoicingStatusByPO(poId),
    ]);
    const plainKeys = new Set(plain[0] ? Object.keys(plain[0]) : []);
    const invKeys = new Set(withInvoicing[0] ? Object.keys(withInvoicing[0]) : []);
    if (plain.length === 0) {
        console.log("  (sampled PO has no items — field-shape check inconclusive, but paths differ by construction)");
    } else {
        check("getItemsByPO omits invoicedQty (employee path)", plainKeys.has("invoicedQty"), false);
        check("getItemsByPO omits uninvoicedQty (employee path)", plainKeys.has("uninvoicedQty"), false);
        check("getInvoicingStatusByPO includes invoicedQty (privileged path)", invKeys.has("invoicedQty"), true);
        check("getInvoicingStatusByPO includes uninvoicedQty (privileged path)", invKeys.has("uninvoicedQty"), true);
    }
}

// Mirror of signPOAction's first-line guard requirePresident() ->
// requireRole("President"), which checks the role only (isAdmin is
// irrelevant). The real Server Action can't be invoked from a script (it
// reads the iron-session cookie), so this reproduces its gate verbatim and
// asserts real DB state around it.
function signAuthGate(userRole) {
    const authorized = ["President"].includes(userRole);
    return authorized ? { rejected: false } : { rejected: true, error: "Only the President can sign a PO." };
}

let complete = false;
try {
    console.log("\nPart C — signPOAction refuses a non-President; PO stays unsigned:");
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    // Fixture: an unsigned PO (Awaiting Signature), via PR -> Approved -> generatePOForApprovedPR.
    const created = await createPR({ requesterId: users[0].id, notes: `${TAG} fixture` });
    track("prs", created.id);
    await updatePR(created.id, { status: "Approved" });
    const prObj = await getPRByRecordId(created.id);
    const gen = await generatePOForApprovedPR(prObj);
    track("pos", gen.poRecordId);

    let po = await getPOByRecordId(gen.poRecordId);
    check("fixture PO starts Awaiting Signature", po.status, "Awaiting Signature");
    check("fixture PO starts unsigned", po.presidentSigned, false);

    // Employee call: requirePresident throws before any PO write.
    check("Employee sign call rejected", signAuthGate("Employee").rejected, true);
    // Admin is a non-President role too — requireRole("President") rejects it.
    // The argument was "Employee" until #171: a copy of the line above, so the
    // Admin branch had never run while this reported PASS. It passes either way,
    // because the gate is an allowlist of one, which is exactly why nothing
    // noticed — a mirror of a production guard can only be as good as its inputs.
    check("Admin (non-President) sign call rejected", signAuthGate("Admin").rejected, true);
    // Because the call was rejected, no updatePO ran — re-fetch proves it.
    po = await getPOByRecordId(gen.poRecordId);
    check("PO still unsigned after rejected call", po.presidentSigned, false);
    check("PO still Awaiting Signature after rejected call", po.status, "Awaiting Signature");
    // Control: President passes the guard.
    check("President sign call allowed past guard", signAuthGate("President").rejected, false);
    complete = true;
} catch (err) {
    // A `catch` where a bare `finally` used to be: with cleanup in a `finally` and
    // nothing catching, a throw resumed propagating as soon as cleanup finished,
    // so the run deleted its rows and then died before the verdict, before
    // `describe()` and before `process.exit`. Demonstrated on
    // verify-po-awaiting-signature-133.mjs, the smallest of the three that were
    // shaped this way; this file and verify-blob-lifecycle-140.mjs were identical.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleanup:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(56));
// Exit code added by #152: printing the verdict and returning 0 either way made
// a failure indistinguishable from a pass to anything but a reader.
// TWO VERDICTS, TWO SENTENCES (#171): `pass` is about the visibility gate, a leak
// is about this run's effect on a shared base.
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
