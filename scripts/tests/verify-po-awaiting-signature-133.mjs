// Verification for issue #133 — PO status `Draft` renamed to
// `Awaiting Signature`. Behavior must be unchanged. Run AFTER the Airtable
// option rename.
//
// The one silent-failure risk is a leftover `!= "Draft"` filter string: it
// wouldn't error, it would quietly let unsigned POs through as invoiceable.
// Step 2 is the only place that catches it — a freshly generated (unsigned)
// PO must be absent from all three PO-list functions. Step 3 is the control
// (a signed PO still shows), Step 4 confirms the rename didn't touch PR
// `Draft`. Fixtures are deleted afterward.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-po-awaiting-signature-133.mjs

import {
    createPR,
    updatePR,
    getPRByRecordId,
    getDraftsByRequester,
} from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import {
    getAllPOs,
    getOpenPOs,
    searchPOs,
    getPOByRecordId,
    updatePO,
} from "../../lib/airtable/purchaseOrders.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

const prIds = [];
const prItemIds = [];
const poIds = [];

try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute fixtures to.");
    const userId = users[0].id;

    console.log("Step 1 — a freshly generated PO carries the renamed status:");
    const a = await createPR({ requesterId: userId });
    prIds.push(a.id);
    await updatePR(a.id, { status: "Approved" });
    const genA = await generatePOForApprovedPR(await getPRByRecordId(a.id));
    poIds.push(genA.poRecordId);
    const poA = await getPOByRecordId(genA.poRecordId);
    check("unsigned PO status", poA.status, "Awaiting Signature");

    // Control fixture: a Signed, still-open PO (one PO Item, no invoices).
    const b = await createPR({ requesterId: userId });
    prIds.push(b.id);
    const itemB = await createItem({
        prRecordId: b.id,
        prId: b.prId,
        itemName: "__verify-133",
        qty: 1,
        unitPrice: 1,
    });
    prItemIds.push(itemB.id);
    await updatePR(b.id, { status: "Approved" });
    const genB = await generatePOForApprovedPR(await getPRByRecordId(b.id));
    poIds.push(genB.poRecordId);
    await updatePO(genB.poRecordId, { status: "Signed" });
    const poB = await getPOByRecordId(genB.poRecordId);
    check("control PO status", poB.status, "Signed");

    console.log("\nStep 2 — the unsigned PO is absent from all three PO lists (silent-failure guard):");
    const [allPOs, openPOs, searchA] = await Promise.all([getAllPOs(), getOpenPOs(), searchPOs(poA.poId)]);
    check("getAllPOs excludes the unsigned PO", allPOs.some((p) => p.id === poA.id), false);
    check("getOpenPOs excludes the unsigned PO", openPOs.some((p) => p.id === poA.id), false);
    check("searchPOs excludes the unsigned PO", searchA.some((p) => p.id === poA.id), false);

    console.log("\nStep 3 — control: the signed PO still appears (filters didn't block everything):");
    const searchB = await searchPOs(poB.poId);
    check("getAllPOs includes the signed PO", allPOs.some((p) => p.id === poB.id), true);
    check("getOpenPOs includes the signed PO", openPOs.some((p) => p.id === poB.id), true);
    check("searchPOs includes the signed PO", searchB.some((p) => p.id === poB.id), true);

    console.log("\nStep 4 — PR `Draft` is untouched (rename didn't bleed into PRs):");
    const c = await createPR({ requesterId: userId });
    prIds.push(c.id);
    const prC = await getPRByRecordId(c.id);
    check("a new PR still lands in Draft", prC.status, "Draft");
    const drafts = await getDraftsByRequester(userId);
    check("getDraftsByRequester still returns the draft", drafts.some((d) => d.id === c.id), true);
} finally {
    console.log("\nCleanup:");
    for (const poId of poIds) {
        try {
            const poRec = await base(TABLES.PURCHASE_ORDERS).find(poId);
            const poItemIds = poRec.get("PO Items") || [];
            await Promise.allSettled(poItemIds.map((id) => base(TABLES.PO_ITEMS).destroy(id)));
            await base(TABLES.PURCHASE_ORDERS).destroy(poId);
        } catch (err) {
            console.error(`  delete PO ${poId} manually:`, err.message);
        }
    }
    await Promise.allSettled(prItemIds.map((id) => base(TABLES.PR_ITEMS).destroy(id)));
    for (const prId of prIds) {
        await base(TABLES.PURCHASE_REQUESTS)
            .destroy(prId)
            .catch((err) => console.error(`  delete PR ${prId} manually:`, err.message));
    }
    console.log("  (fixtures cleaned up)");
}

console.log("\n" + "=".repeat(56));
// Exit code added by #152: printing the verdict and returning 0 either way made
// a failure indistinguishable from a pass to anything but a reader.
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
