// Verification for issue #133 — PO status `Draft` renamed to
// `Awaiting Signature`. Behavior must be unchanged. Run AFTER the Airtable
// option rename.
//
// STEP 2 WAS INVERTED BY #168, AND THE GUARD IT USED TO BE HAS NO SUBJECT LEFT.
// As written for #133, the silent-failure risk was a leftover `!= "Draft"` filter
// string: it would not error, it would quietly let unsigned POs through as
// invoiceable, and Step 2 caught that by requiring a freshly generated (unsigned)
// PO to be ABSENT from all three PO-list functions.
//
// #168 removed the signature-status condition from those filters altogether, on
// the measured ground that an Awaiting Signature PO can legitimately carry an
// invoice (`HYE-PO-20260805-02` does). So there is no `"Awaiting Signature"`
// string left to go stale, and nothing for the original guard to guard. Step 2
// now asserts the new behavior instead — the unsigned PO is PRESENT in all three —
// which is a real regression guard for #168's change rather than a leftover.
//
// What #133 itself established is untouched: the option rename, and that PR
// `Draft` is a different field that the rename did not reach (Step 4). Step 3
// remains the control (a signed PO still shows). Fixtures are deleted in this same
// run through scripts/tests/_fixtures.mjs (#171).
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base.
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
    getPOsExceptWithdrawn,
    getOpenPOs,
    searchPOs,
    getPOByRecordId,
    updatePO,
} from "../../lib/airtable/purchaseOrders.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { TABLES } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order. POs before PRs: a PO links its PR, so the other order leaves a dangling
// link for as long as the loop takes.
//
// No Materials bucket, and that is measured rather than assumed. Both POs here
// come from generatePOForApprovedPR, which does write the item axis as a side
// effect (#18) — but these PRs carry NO Vendor, so refreshMaterialsCacheForPO
// returns `skippedAll: "no Vendor on the PR"` before writing an identity row, a
// price row or an ordered item's `Material` link. Both PRs' items also pass no `unit`,
// which the cache's unit-less rule would skip anyway. Measured on the base: 0
// Materials named "__verify-133".
const fixtures = createFixtures({
    tag: "V133",
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
        // createPR, so the tag is one argument away. PR Items are discovered
        // through the PR's own link rather than tracked — the script held one id
        // and the link reaches every one of them, including any it did not.
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

let complete = false;
try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute fixtures to.");
    const userId = users[0].id;

    console.log("Step 1 — a freshly generated PO carries the renamed status:");
    const a = await createPR({ requesterId: userId, notes: `${TAG} unsigned` });
    track("prs", a.id);
    // THIS ITEM IS LOAD-BEARING — do not remove it as unused. Without it the PO
    // generated below has no ordered items, so isPoOpen returns false and getOpenPOs
    // excludes it for having nothing to invoice rather than for being unsigned.
    // Step 2's assertion would then pass with the signature-status filter
    // restored, which is exactly what it must fail on. Same reasoning
    // verify-po-withdraw-138.mjs Part C states for its own po7.
    await createItem({
        prRecordId: a.id,
        prId: a.prId,
        itemName: "__verify-133",
        qty: 1,
        unitPrice: 1,
    });
    await updatePR(a.id, { status: "Approved" });
    const genA = await generatePOForApprovedPR(await getPRByRecordId(a.id));
    track("pos", genA.poRecordId);
    const poA = await getPOByRecordId(genA.poRecordId);
    check("unsigned PO status", poA.status, "Awaiting Signature");

    // Control fixture: a Signed, still-open PO (one PO Item, no invoices).
    const b = await createPR({ requesterId: userId, notes: `${TAG} signed control` });
    track("prs", b.id);
    await createItem({
        prRecordId: b.id,
        prId: b.prId,
        itemName: "__verify-133",
        qty: 1,
        unitPrice: 1,
    });
    await updatePR(b.id, { status: "Approved" });
    const genB = await generatePOForApprovedPR(await getPRByRecordId(b.id));
    track("pos", genB.poRecordId);
    await updatePO(genB.poRecordId, { status: "Signed" });
    const poB = await getPOByRecordId(genB.poRecordId);
    check("control PO status", poB.status, "Signed");

    console.log("\nStep 2 — the unsigned PO is PRESENT in all three PO lists (#168 inverted this):");
    const [allPOs, openPOs, searchA] = await Promise.all([
        getPOsExceptWithdrawn(),
        getOpenPOs(),
        searchPOs(poA.poId),
    ]);
    check("getPOsExceptWithdrawn includes the unsigned PO", allPOs.some((p) => p.id === poA.id), true);
    check("getOpenPOs includes the unsigned PO", openPOs.some((p) => p.id === poA.id), true);
    check("searchPOs includes the unsigned PO", searchA.some((p) => p.id === poA.id), true);

    console.log("\nStep 3 — control: the signed PO still appears (filters didn't block everything):");
    const searchB = await searchPOs(poB.poId);
    check("getPOsExceptWithdrawn includes the signed PO", allPOs.some((p) => p.id === poB.id), true);
    check("getOpenPOs includes the signed PO", openPOs.some((p) => p.id === poB.id), true);
    check("searchPOs includes the signed PO", searchB.some((p) => p.id === poB.id), true);

    console.log("\nStep 4 — PR `Draft` is untouched (rename didn't bleed into PRs):");
    const c = await createPR({ requesterId: userId, notes: `${TAG} draft` });
    track("prs", c.id);
    const prC = await getPRByRecordId(c.id);
    check("a new PR still lands in Draft", prC.status, "Draft");
    const drafts = await getDraftsByRequester(userId);
    check("getDraftsByRequester still returns the draft", drafts.some((d) => d.id === c.id), true);
    complete = true;
} catch (err) {
    // A `catch` RATHER THAN THE `finally` THIS REPLACED, and the difference is
    // measured: with cleanup in a `finally` and nothing catching, the throw
    // resumed propagating the moment cleanup finished, so the run printed its
    // census, its deletes and `residue: pos 0, prs 0` — and then crashed before
    // `ALL CHECKS PASS`, before `describe()` and before `process.exit`. Cleanup
    // that runs but cannot report is half an adoption: the fixture contract's
    // whole point is a verdict about this run's effect on the base, and the exit
    // code came from Node rather than from anything this script decided.
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
// TWO VERDICTS, TWO SENTENCES (#171): `pass` is about the status rename, a leak
// is about this run's effect on a shared base.
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
