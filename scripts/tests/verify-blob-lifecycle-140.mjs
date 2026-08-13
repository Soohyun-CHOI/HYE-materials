// Verification for issue #140 — no Blob object outlives its ingest and the
// action that ingested it.
//
// Part B calls the PRODUCTION helper (lib/blobIngest.js:confirmIngestThenDelete)
// against real Airtable records and real Blob objects — not a copy of the
// sequence — and checks the object's existence with head() before and after.
//
// The four upload paths run inside Server Actions, which plain node can't
// enter (iron-session cookies, redirect()), so "this call site calls the helper,
// outside its rollback boundary, scheduled with after()" can only be asserted on
// the source.
//
// #152 moved those assertions — the old Part A — to
// scripts/tests/offline/source-shape.mjs, alongside the equivalent ones from
// verify-po-withdraw-138.mjs. Reasons: they need no credentials, so welding them
// to this script's Airtable and Blob fixtures made them cost more than anyone
// would pay; and they were text matching on `export async function NAME`, which
// #147 invalidated by wrapping createInvoiceAction — four of them reported false
// for weeks while the production code was correct. They are AST-based now, they
// assert the actual property rather than a string proxy for it (no enclosing
// try, rather than "positioned after this error message"), and they run on every
// push via `npm test`.
//
// What stays here needs credentials: Parts A2/A3 read lib/blobIngest.js, which
// imports the Airtable client and therefore throws at module load without
// AIRTABLE_API_KEY, and Part B calls the real helper against real records.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-blob-lifecycle-140.mjs

import { head, put } from "@vercel/blob";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
    confirmIngestThenDelete,
    isOurBlobUrl,
    INGEST_POLL_INTERVAL_MS,
    INGEST_CONFIRM_TIMEOUT_MS,
} from "../../lib/blobIngest.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { updatePO } from "../../lib/airtable/purchaseOrders.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Does the Blob object still exist? head() throws once it's gone.
async function blobExists(url) {
    try {
        await head(url);
        return true;
    } catch {
        return false;
    }
}

async function tinyPdf(label) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(label, { x: 20, y: 160, size: 10, font });
    return Buffer.from(await doc.save());
}

console.log("\nPart A2 — helper constants come from the measured latency:");
check("poll interval", INGEST_POLL_INTERVAL_MS, 300);
check("confirm ceiling", INGEST_CONFIRM_TIMEOUT_MS, 10000);

console.log("\nPart A3 — isOurBlobUrl (pure):");
check(
    "our store",
    isOurBlobUrl("https://abc.public.blob.vercel-storage.com/x.pdf"),
    true
);
check(
    "Airtable's own URL is skipped (a re-opened Draft carries these)",
    isOurBlobUrl("https://v5.airtableusercontent.com/v3/u/55/x"),
    false
);
check("empty", isOurBlobUrl(""), false);

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order; POs before PRs, since a PO links its PR. Blob objects go through
// `trackBlob`, which is what retires this file's `catch { /* already gone */ }`:
// that swallow cannot tell an object it deleted from one it failed to reach, and
// the helper decides by `head()` afterwards — only `BlobNotFoundError` reads as
// gone (#171 commit 5a).
//
// No Materials bucket, measured rather than assumed. The PO comes from
// generatePOForApprovedPR, which writes the item axis as a side effect (#18), and
// the item here even carries a Unit — but this PR has NO Vendor, so
// refreshMaterialsCacheForPO returns `skippedAll: "no Vendor on the PR"` before
// writing an identity row, a price row or an ordered item's `Material` link. The run
// log says so on every pass. Measured on the base: 0 Materials named
// "#140 fixture item".
const fixtures = createFixtures({
    tag: "V140",
    buckets: [
        // No tagField: written by generatePOForApprovedPR, and this script sets no
        // text field on it. Tracked, so a tracked-id re-read is the residue check.
        {
            name: "pos",
            table: TABLES.PURCHASE_ORDERS,
            label: "PO",
            children: [{ link: "PO Items", table: TABLES.PO_ITEMS, label: "PO Item" }],
        },
        // Tagged, under the rule's second clause (#171). This one already passed
        // `notes`, but a FIXED string — "#140 verification — safe to delete" — which
        // is the one shape a tag must not have: `discoverByTag` aside, a prefix
        // shared by every run of this script is the base sweep the helper's header
        // warns about. It carries `${TAG}` now, so the prefix is this run's alone.
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
const trackBlob = fixtures.trackBlob;

let complete = false;
try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture to.");
    const owner = users[0];

    // Fixture: PR -> PO, so there's a real attachment field to ingest into.
    const pr = await createPR({ requesterId: owner.id, notes: `${TAG} verification — safe to delete` });
    track("prs", pr.id);
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: "#140 fixture item",
        size: "",
        unit: "EA",
        qty: 1,
        unitPrice: 1,
        remark: "",
    });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    track("pos", gen.poRecordId);

    console.log("\nPart B1 — confirmed ingest: object present before, absent after:");
    const okBlob = await put("verify-140/confirmed.pdf", await tinyPdf("#140 confirmed"), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
    });
    trackBlob(okBlob.url);
    check("object exists before the attachment write", await blobExists(okBlob.url), true);

    const written = await updatePO(gen.poRecordId, {
        poPdfFile: [{ url: okBlob.url, filename: "confirmed.pdf" }],
    });
    const [result] = await confirmIngestThenDelete([
        {
            table: TABLES.PURCHASE_ORDERS,
            recordId: gen.poRecordId,
            field: "PO PDF File",
            blobUrl: okBlob.url,
            attachmentId: written.poPdfFile?.[0]?.id,
            label: "verify-140 confirmed",
        },
    ]);
    console.log(`  (helper reported: ${JSON.stringify(result)})`);
    check("helper confirmed the ingest", result.confirmed, true);
    check("helper deleted the object", result.deleted, true);
    check("object absent after", await blobExists(okBlob.url), false);
    // The file itself survived — Airtable holds the copy of record.
    const poAfter = await base(TABLES.PURCHASE_ORDERS).find(gen.poRecordId);
    const attached = poAfter.get("PO PDF File") || [];
    check("Airtable still holds the file", attached.length, 1);
    check("stored URL is no longer ours", isOurBlobUrl(attached[0]?.url), false);

    console.log("\nPart B2 — unconfirmed ingest: object KEPT (real timeout branch):");
    // The object is uploaded but NO attachment write is issued for it, so the
    // attachment id the helper is told to follow never appears and the helper
    // runs to its ceiling. The branch itself executes for real — object kept,
    // logged, no throw. It is not the production trigger (Airtable answering a
    // write with success and then failing to fetch), and that trigger can't be
    // combined with a surviving object: the only reproducible way to make
    // Airtable drop a file is to point it at an object that no longer exists.
    // Stale-attachment note: this case previously PASSED confirmation, because
    // the field still held B1's ingested file and the old rule only asked
    // whether any attachment carried our URL. The attachment id closed that.
    const keptBlob = await put("verify-140/unconfirmed.pdf", await tinyPdf("#140 unconfirmed"), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
    });
    trackBlob(keptBlob.url);
    check("object exists before", await blobExists(keptBlob.url), true);
    const startedAt = Date.now();
    const [timeoutResult] = await confirmIngestThenDelete([
        {
            table: TABLES.PURCHASE_ORDERS,
            recordId: gen.poRecordId,
            field: "PO PDF File",
            blobUrl: keptBlob.url,
            // A real id shape that is not in this field, because no attachment
            // write was made for this object.
            attachmentId: "attNeverWritten140",
            label: "verify-140 unconfirmed",
        },
    ]);
    const waited = Date.now() - startedAt;
    console.log(`  (helper reported: ${JSON.stringify(timeoutResult)} after ~${waited}ms)`);
    check("helper did not confirm", timeoutResult.confirmed, false);
    check("helper did not delete", timeoutResult.deleted, false);
    check("object still present after the timeout", await blobExists(keptBlob.url), true);
    check("waited at least the ceiling", waited >= INGEST_CONFIRM_TIMEOUT_MS, true);
    check("helper returned instead of throwing", typeof timeoutResult, "object");

    console.log("\nPart B3 — a URL that was never ours is skipped, not deleted:");
    const [skipped] = await confirmIngestThenDelete([
        {
            table: TABLES.PURCHASE_ORDERS,
            recordId: gen.poRecordId,
            field: "PO PDF File",
            blobUrl: "https://v5.airtableusercontent.com/v3/u/55/55/x",
            attachmentId: "attWhatever140",
            label: "verify-140 airtable url",
        },
    ]);
    check("skipped", skipped.skipped, true);
    check("not deleted", skipped.deleted, false);
    const [noId] = await confirmIngestThenDelete([
        {
            table: TABLES.PURCHASE_ORDERS,
            recordId: gen.poRecordId,
            field: "PO PDF File",
            blobUrl: keptBlob.url,
            label: "verify-140 missing attachment id",
        },
    ]);
    check("a target with no attachmentId is skipped, object kept", noId.skipped, true);
    check("that object still exists", await blobExists(keptBlob.url), true);
    complete = true;
} catch (err) {
    // A `catch` where a bare `finally` used to be — see the same note on
    // verify-po-visibility-132.mjs, and the run that measured it on 133.
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
// TWO VERDICTS, TWO SENTENCES (#171): `pass` is about the Blob lifecycle, a leak
// is about this run's effect on a shared store — Airtable's and Vercel's both.
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : 0);
