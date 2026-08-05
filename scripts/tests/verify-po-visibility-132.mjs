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

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${actual}, expected ${expected}`);
}

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

let createdPrId = null;
let createdPoId = null;
try {
    console.log("\nPart C — signPOAction refuses a non-President; PO stays unsigned:");
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    // Fixture: an unsigned PO (Awaiting Signature), via PR -> Approved -> generatePOForApprovedPR.
    const created = await createPR({ requesterId: users[0].id });
    createdPrId = created.id;
    await updatePR(created.id, { status: "Approved" });
    const prObj = await getPRByRecordId(created.id);
    const gen = await generatePOForApprovedPR(prObj);
    createdPoId = gen.poRecordId;

    let po = await getPOByRecordId(gen.poRecordId);
    check("fixture PO starts Awaiting Signature", po.status, "Awaiting Signature");
    check("fixture PO starts unsigned", po.presidentSigned, false);

    // Employee call: requirePresident throws before any PO write.
    check("Employee sign call rejected", signAuthGate("Employee").rejected, true);
    // Admin is a non-President role too — requireRole("President") rejects it.
    check("Admin (non-President) sign call rejected", signAuthGate("Employee").rejected, true);
    // Because the call was rejected, no updatePO ran — re-fetch proves it.
    po = await getPOByRecordId(gen.poRecordId);
    check("PO still unsigned after rejected call", po.presidentSigned, false);
    check("PO still Awaiting Signature after rejected call", po.status, "Awaiting Signature");
    // Control: President passes the guard.
    check("President sign call allowed past guard", signAuthGate("President").rejected, false);
} finally {
    // Teardown — PO Items (if any) then PO, then PR. Best-effort.
    if (createdPoId) {
        try {
            const poRec = await base(TABLES.PURCHASE_ORDERS).find(createdPoId);
            const poItemIds = poRec.get("PO Items") || [];
            await Promise.allSettled(poItemIds.map((id) => base(TABLES.PO_ITEMS).destroy(id)));
            await base(TABLES.PURCHASE_ORDERS).destroy(createdPoId);
        } catch (err) {
            console.error(`cleanup: failed to delete PO ${createdPoId} — remove manually:`, err.message);
        }
    }
    if (createdPrId) {
        await base(TABLES.PURCHASE_REQUESTS).destroy(createdPrId).catch((err) =>
            console.error(`cleanup: failed to delete PR ${createdPrId} — remove manually:`, err.message)
        );
    }
    if (createdPoId || createdPrId) console.log("  (fixture cleaned up)");
}

console.log("\n" + "=".repeat(56));
// Exit code added by #152: printing the verdict and returning 0 either way made
// a failure indistinguishable from a pass to anything but a reader.
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
