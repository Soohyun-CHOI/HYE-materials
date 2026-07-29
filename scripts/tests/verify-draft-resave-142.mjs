// Verification for issue #142 — re-saving a Draft must not lose its quotation
// file.
//
// The failure: persistPRFromForm rebuilds a Draft's children from form state,
// so a re-save handed Airtable the url the form was carrying. For an entry
// hydrated from a re-opened Draft that is Airtable's OWN signed url (~2h), and
// past that window the attachment write returns success and silently leaves the
// field empty.
//
// Reproducing "expired" without waiting two hours: an expired Airtable url is
// simply one Airtable can no longer fetch, and that is the operative condition
// — the ~2h lifetime is not itself what breaks the write. Part A therefore
// takes a REAL, freshly-ingested Airtable attachment url, invalidates its
// signature, and re-submits it to the same field, which is exactly the shape of
// the bug: "re-submit this record's own attachment url, which is no longer
// good". What that cannot claim is that the tampered url and a naturally
// expired one fail through the same code inside Airtable; it claims they are
// both unfetchable and that re-submitting an unfetchable url empties the field.
//
// Part C is the fix's own property, and it needs no expiry at all: an unchanged
// entry keeps its Quotation RECORD, so the record id and the attachment id
// survive a re-save. Before #142 a re-save necessarily produced a new record
// (destroy-and-recreate), so "same record id afterwards" is decisive on its own.
// persistPRFromForm is a module-private function inside a "use server" file and
// cannot be called from node, so the end-to-end re-save through the real form
// is a browser step, recorded in the issue rather than here; Part C proves the
// production decision (loadPRDraft + shouldReuseQuotation) against a real
// stored Draft.
//
// Fixtures: one throwaway PR + Quotation and one Blob object, all removed at
// the end.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-draft-resave-142.mjs

import { put, del } from "@vercel/blob";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createPR } from "../../lib/airtable/purchaseRequests.js";
import { createQuotation, getQuotationsByPR } from "../../lib/airtable/quotations.js";
import { loadPRDraft } from "../../lib/prDraft.js";
import { shouldReuseQuotation } from "../../lib/quotationReuse.js";
import { isOurBlobUrl } from "../../lib/blobIngest.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}

async function tinyPdf(label) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(label, { x: 20, y: 160, size: 10, font });
    return Buffer.from(await doc.save());
}

// Airtable ingests asynchronously; id/size land a moment after the write.
async function waitForAttachment(recordId, tries = 15) {
    for (let i = 0; i < tries; i++) {
        const rec = await base(TABLES.QUOTATIONS).find(recordId);
        const f = (rec.get("File") || [])[0];
        if (f?.id && f?.size) return f;
        await new Promise((r) => setTimeout(r, 700));
    }
    return (await base(TABLES.QUOTATIONS).find(recordId)).get("File")?.[0];
}

async function attachmentOf(recordId) {
    const rec = await base(TABLES.QUOTATIONS).find(recordId);
    return (rec.get("File") || [])[0];
}

// Invalidate an Airtable attachment url without changing its shape: same host,
// same path structure, a signature that no longer verifies. The closest
// available stand-in for expiry.
function invalidate(url) {
    const u = new URL(url);
    const parts = u.pathname.split("/");
    const last = parts[parts.length - 1];
    parts[parts.length - 1] = last.replace(/[A-Za-z0-9]/, (c) => (c === "z" ? "y" : "z"));
    u.pathname = parts.join("/");
    return u.toString();
}

let prRecordId = null;
let quotationRecordId = null;
let blobUrl = null;

try {
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    const pr = await createPR({ requesterId: users[0].id, notes: "#142 verification — safe to delete" });
    prRecordId = pr.id;

    const blob = await put("verify-142/quotation.pdf", await tinyPdf("#142 fixture"), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
    });
    blobUrl = blob.url;

    const quotation = await createQuotation({
        prRecordId: pr.id,
        prId: pr.prId,
        vendorId: null,
        vendorQuotationCode: "VERIFY-142",
        file: [{ url: blob.url, filename: "quotation.pdf" }],
    });
    quotationRecordId = quotation.id;

    console.log(`Fixture: PR ${pr.prId} / Quotation ${quotation.quotationId} [${quotation.id}]`);

    const ingested = await waitForAttachment(quotation.id);
    check("fixture attachment is ingested (has id and size)", Boolean(ingested?.id && ingested?.size), true);
    const airtableUrl = ingested?.url;
    check("ingested url is Airtable's own, not ours", isOurBlobUrl(airtableUrl), false);

    console.log("\nPart A — re-submitting an unfetchable Airtable url empties the field:");
    // The bug's mechanism. This is what a >2h re-save did.
    const badUrl = invalidate(airtableUrl);
    check("the tampered url differs from the real one", badUrl !== airtableUrl, true);
    let writeThrew = false;
    try {
        await base(TABLES.QUOTATIONS).update(quotation.id, {
            File: [{ url: badUrl, filename: "quotation.pdf" }],
        });
    } catch {
        writeThrew = true;
    }
    check("Airtable ACCEPTS the write (no error)", writeThrew, false);
    // Give it the same window a real ingest would have had.
    await new Promise((r) => setTimeout(r, 8000));
    const afterBad = await attachmentOf(quotation.id);
    check("the field is now EMPTY — the file is gone, silently", afterBad === undefined, true);
    console.log("    ^ this is the data loss #142 fixes: success reported, file destroyed.");

    console.log("\nPart B — loadPRDraft carries the record identity (#142):");
    const draft = await loadPRDraft(pr.prId);
    check("draft loads", Boolean(draft), true);
    check("one quotation entry", draft?.quotations.length, 1);
    check("entry carries its Quotation recordId", draft?.quotations[0]?.recordId, quotation.id);
    check("entry still carries the code", draft?.quotations[0]?.vendorQuotationCode, "VERIFY-142");

    console.log("\nPart C — the production decision for that stored entry:");
    // Exactly what persistPRFromForm computes, from the same two sources.
    const live = new Set((await getQuotationsByPR(pr.id)).map((q) => q.id));
    const entry = draft.quotations[0];
    check("the entry's record is live", live.has(entry.recordId), true);
    check("the entry's url is not a fresh upload of ours", isOurBlobUrl(entry.url), false);
    check(
        "=> reuse the record, do not rewrite the attachment",
        shouldReuseQuotation({
            recordId: entry.recordId,
            isLiveRecord: live.has(entry.recordId),
            isFreshUpload: isOurBlobUrl(entry.url),
        }),
        true
    );
    // And the replacement direction, so the fix cannot be passing by refusing
    // to write anything ever.
    check(
        "=> a re-uploaded file on the same entry is NOT reused",
        shouldReuseQuotation({
            recordId: entry.recordId,
            isLiveRecord: true,
            isFreshUpload: true,
        }),
        false
    );
} catch (err) {
    pass = false;
    console.error("\n  UNEXPECTED ERROR:", err);
} finally {
    if (quotationRecordId) {
        await base(TABLES.QUOTATIONS)
            .destroy(quotationRecordId)
            .catch((e) => console.error(`cleanup: Quotation ${quotationRecordId} — remove manually:`, e.message));
    }
    if (prRecordId) {
        await base(TABLES.PURCHASE_REQUESTS)
            .destroy(prRecordId)
            .catch((e) => console.error(`cleanup: PR ${prRecordId} — remove manually:`, e.message));
    }
    if (blobUrl) {
        await del(blobUrl).catch(() => {});
    }
    console.log("\n  (fixtures cleaned up)");
}

console.log("\n" + "=".repeat(56));
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
process.exit(pass ? 0 : 1);
