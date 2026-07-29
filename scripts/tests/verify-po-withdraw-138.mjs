// Verification for issue #138 — the PO's terminal `Withdrawn` status.
//
// The point of this script is that it calls the PRODUCTION guard, not a copy
// of it: Part B imports lib/poWithdraw.js's real getPOWithdrawEligibility()
// and withdrawPOAsRequester() and invokes them against real Airtable
// fixtures. That is why the whole decision-and-write sequence lives in that
// plain module instead of inside the Server Action — the action is
// unimportable under plain node (it pulls lib/authz.js -> next/navigation +
// next/server, resolves the caller from an iron-session cookie, and finishes
// with redirect(), which throws NEXT_REDIRECT outside the render pipeline;
// the loader also only patches extensionless relative specifiers, not the
// "@/" alias). The only value injected here is `actingUserId`, i.e. exactly
// what requireUser().id supplies.
//
// What therefore cannot be exercised by direct call, and is covered by
// source-shape assertions plus browser checks instead:
//   - requireUser() (the session gate) and redirect()
//   - createInvoiceAction (a Server Action behind requireAdmin())
//   - the /api/invoices/detect-po route body (next/server)
//
// #152 moved those assertions — the old Part A — to
// scripts/tests/offline/guard-placement.mjs, together with the equivalent ones
// from verify-blob-lifecycle-140.mjs, because they are the same kind of claim
// about production call sites and they kept decaying in the same way. They were
// text matching on `export async function NAME`; #147 wrapped two of these
// exports and they silently reported false for weeks while the guards were
// intact. They are AST-based now and run on every push via `npm test`.
//
// Part C exercises the real searchPOs()/getAllPOs() to prove a withdrawn PO
// drops out of the invoice-side candidate set, before and after withdrawal.
//
// Fixtures: 6 throwaway PRs + POs and 1 invoice, all deleted afterward
// (scripts/tests convention).
//
// Prerequisites for Parts B2/C, both added by hand in Airtable outside the
// repo: the `Withdrawn` option on Purchase Orders.Status, and the `Withdrawn
// At` dateTime field. Without them those parts report BLOCKED (distinct from
// a failure) — Parts A and B need no schema and always run.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-po-withdraw-138.mjs

import { PDFDocument, StandardFonts } from "pdf-lib";
import { put, del } from "@vercel/blob";
import {
    getPOWithdrawEligibility,
    isPOWithdrawn,
    withdrawPOAsRequester,
    PO_WITHDRAWABLE_STATUSES,
} from "../../lib/poWithdraw.js";
import {
    getAllPOs,
    getOpenPOs,
    getPOByRecordId,
    searchPOs,
    updatePO,
    PO_WITHDRAWN_STATUS,
} from "../../lib/airtable/purchaseOrders.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { createItem } from "../../lib/airtable/prItems.js";
import { createInvoice, linkInvoiceToPO } from "../../lib/airtable/invoices.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
// Set when the Airtable schema prerequisites aren't in place yet: the
// DB-backed parts couldn't run at all, which is not the same thing as a
// guard failing, and must never read as a pass either.
let blocked = null;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

console.log("\nPart B — the production predicate's decisions (pure, no DB):");
check("withdrawable statuses are exactly the two in scope", PO_WITHDRAWABLE_STATUSES.join(","), "Awaiting Signature,Signed");
check(
    "Awaiting Signature + no invoice is eligible",
    getPOWithdrawEligibility({ status: "Awaiting Signature", invoicePoLinks: [], invoiceItems: [] }).eligible,
    true
);
check(
    "Signed + no invoice is eligible",
    getPOWithdrawEligibility({ status: "Signed" }).eligible,
    true
);
// The subject here is "a value outside the eligible list", so the sentinel is
// deliberately not a status Airtable has ever offered (#144 removed the last
// one that was). That also states the property the allowlist gives us: an
// option added to the field later, without a matching code change, lands here
// and is refused rather than let through.
check(
    "a status outside the eligible list reports wrong-status",
    getPOWithdrawEligibility({ status: "Not A Real Status" }).reason,
    "wrong-status"
);
check(
    "linked invoice reports invoice-linked",
    getPOWithdrawEligibility({ status: "Signed", invoicePoLinks: ["recLink"] }).reason,
    "invoice-linked"
);
check(
    "a stranded Invoice Item alone also blocks",
    getPOWithdrawEligibility({ status: "Signed", invoiceItems: ["recItem"] }).reason,
    "invoice-linked"
);
// Precedence matters: a PO that fails the status test and also has invoices
// must not be told to go ask an Admin to unlink, because unlinking wouldn't
// help.
check(
    "wrong-status wins over invoice-linked",
    getPOWithdrawEligibility({ status: "Not A Real Status", invoicePoLinks: ["recLink"] }).reason,
    "wrong-status"
);
check("isPOWithdrawn recognizes the status", isPOWithdrawn({ status: PO_WITHDRAWN_STATUS }), true);
check("isPOWithdrawn ignores an unknown status", isPOWithdrawn({ status: "Not A Real Status" }), false);

const createdPRs = [];
const createdPOs = [];
const createdInvoices = [];
const createdLinks = [];
const createdBlobUrls = [];

// A real (if minimal) PDF for the attachment-preservation case. The app's own
// generator can't be used here — lib/poPdf.js is JSX, unimportable by plain
// node — and it isn't needed: the invariant under test is that withdrawal
// leaves the stored attachment reference untouched, which is about the field,
// not the bytes.
async function buildFixturePdf(poId) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(`VERIFICATION FIXTURE — ${poId}`, { x: 56, y: 720, size: 14, font });
    page.drawText("Not a real purchase order. Created and deleted by", { x: 56, y: 690, size: 10, font });
    page.drawText("scripts/tests/verify-po-withdraw-138.mjs (issue #138).", { x: 56, y: 674, size: 10, font });
    return Buffer.from(await doc.save());
}

// Airtable ingests attachments asynchronously, so id/filename/size land a
// moment after the write. Poll before snapshotting, otherwise "unchanged
// across the withdrawal" could compare undefined to undefined and prove
// nothing.
async function waitForAttachment(poRecordId, tries = 10) {
    for (let i = 0; i < tries; i++) {
        const po = await getPOByRecordId(poRecordId);
        const file = po.poPdfFile?.[0];
        if (file?.id && file?.size) return po;
        await new Promise((r) => setTimeout(r, 1000));
    }
    return getPOByRecordId(poRecordId);
}

// Fixture: one PR (Approved) + its generated PO, moved to `status`. The PR
// gets a real item so the PO snapshot has a PO Item with nothing invoiced
// against it — which is what makes the getOpenPOs check below meaningful: an
// item-less PO would be excluded from getOpenPOs for having no remaining qty,
// so it could never show that the *status* exclusion is doing the work.
async function makePO(requesterId, status) {
    const pr = await createPR({ requesterId });
    createdPRs.push(pr.id);
    await createItem({
        prRecordId: pr.id,
        prId: pr.prId,
        itemName: "Verification fixture item",
        size: '2"',
        unit: "EA",
        qty: 4,
        unitPrice: 50,
        remark: "",
    });
    await updatePR(pr.id, { status: "Approved" });
    const gen = await generatePOForApprovedPR(await getPRByRecordId(pr.id));
    createdPOs.push(gen.poRecordId);

    if (status !== "Awaiting Signature") {
        const fields = { status };
        // Mirror what signPOAction records, so a "Signed" fixture is a
        // realistic one (the copy/banner branch reads President Signed).
        if (status === "Signed") {
            fields.presidentSigned = true;
            fields.presidentSignedAt = new Date().toISOString();
        }
        if (status === PO_WITHDRAWN_STATUS) fields.withdrawnAt = new Date().toISOString();
        await updatePO(gen.poRecordId, fields);
    }
    return getPOByRecordId(gen.poRecordId);
}

async function statusOf(poRecordId) {
    const rec = await base(TABLES.PURCHASE_ORDERS).find(poRecordId);
    return rec.get("Status");
}

try {
    const users = await getActiveUsers();
    if (users.length < 2) {
        throw new Error(`Need at least 2 active users to test the requester guard; found ${users.length}.`);
    }
    const owner = users[0]; // the fixtures' requester
    const other = users[1]; // a different signed-in user
    console.log(`\nOwner (requester):  ${owner.userName} [${owner.id}]`);
    console.log(`Other (impostor):   ${other.userName} [${other.id}]`);

    console.log("\nPart B2 — direct calls to the production write path:");

    // Case 1 — caller is not the requester.
    const po1 = await makePO(owner.id, "Awaiting Signature");
    const r1 = await withdrawPOAsRequester({ poId: po1.poId, actingUserId: other.id });
    check("case 1 non-requester rejected", "error" in r1, true);
    check("case 1 PO status unchanged", await statusOf(po1.id), "Awaiting Signature");

    // Case 2 is gone (#144): it withdrew from a status the Status field no
    // longer offers, so its fixture can't be built. The rule it covered — a
    // status outside the eligible list is refused — is still checked in Part
    // B above, against a sentinel rather than a real option. The gap in the
    // numbering is deliberate; the remaining cases keep the numbers they had.

    // Case 4 — a real linked invoice via the join table. Ordered before case
    // 3 on purpose: cases 1 and 4 need no new Airtable schema, so they still
    // run (and still have to pass) while the `Withdrawn` option is pending.
    const po4 = await makePO(owner.id, "Signed");
    const invoice = await createInvoice({
        vendorInvoiceCode: "VERIFY-138",
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: null,
        amountDue: 0,
        shippingFee: 0,
        file: [], // fixture only — the app requires a file, Airtable doesn't
    });
    createdInvoices.push(invoice.id);
    const link = await linkInvoiceToPO(invoice.id, po4.id);
    createdLinks.push(link.id);
    const po4Fresh = await getPOByRecordId(po4.id);
    check("case 4 fixture PO reads its join row with no lag", po4Fresh.invoicePoLinks.length, 1);
    const r4 = await withdrawPOAsRequester({ poId: po4.poId, actingUserId: owner.id });
    check("case 4 linked-invoice rejected", r4.reason, "invoice-linked");
    check("case 4 PO status unchanged", await statusOf(po4.id), "Signed");

    // Case 3 — already withdrawn (terminal, no revive). From here on every
    // step needs the `Withdrawn` option and the `Withdrawn At` field.
    const po3 = await makePO(owner.id, PO_WITHDRAWN_STATUS);
    const r3 = await withdrawPOAsRequester({ poId: po3.poId, actingUserId: owner.id });
    check("case 3 already-Withdrawn rejected", r3.reason, "wrong-status");
    check("case 3 PO status unchanged", await statusOf(po3.id), PO_WITHDRAWN_STATUS);

    // Control A — Awaiting Signature, no invoice, requester: allowed.
    const po5 = await makePO(owner.id, "Awaiting Signature");
    const r5 = await withdrawPOAsRequester({ poId: po5.poId, actingUserId: owner.id });
    check("control A allowed", r5.ok, true);
    check("control A PO is Withdrawn", await statusOf(po5.id), PO_WITHDRAWN_STATUS);
    const po5After = await getPOByRecordId(po5.id);
    check("control A stamped Withdrawn At in the same write", Boolean(po5After.withdrawnAt), true);

    // Control B — Signed, no invoice: allowed, and the signature survives.
    const po6 = await makePO(owner.id, "Signed");
    check("control B fixture is in searchPOs before withdrawal", (await searchPOs(po6.poId)).length, 1);
    const r6 = await withdrawPOAsRequester({ poId: po6.poId, actingUserId: owner.id });
    check("control B allowed", r6.ok, true);
    const po6After = await getPOByRecordId(po6.id);
    check("control B PO is Withdrawn", po6After.status, PO_WITHDRAWN_STATUS);
    check("control B keeps President Signed", po6After.presidentSigned, true);

    // Control C — an already-generated PO PDF survives withdrawal. The PO PDF
    // is the document that went to the vendor; withdrawal refuses NEW
    // documents (regeneratePDFAction) but must not drop the existing one,
    // which is audit trail. Asserted on the stored attachment reference
    // itself, before and after the write.
    console.log("\nPart B3 — an already-generated PDF survives withdrawal:");
    const po7 = await makePO(owner.id, "Signed");
    const blob = await put(`verify-138/${po7.poId}-fixture.pdf`, await buildFixturePdf(po7.poId), {
        access: "public",
        addRandomSuffix: true,
        contentType: "application/pdf",
    });
    createdBlobUrls.push(blob.url);
    await updatePO(po7.id, { poPdfFile: [{ url: blob.url, filename: `${po7.poId}.pdf` }] });

    const pdfBefore = (await waitForAttachment(po7.id)).poPdfFile?.[0];
    check("fixture PO has an ingested PDF before withdrawal", Boolean(pdfBefore?.id && pdfBefore?.size), true);

    const r7 = await withdrawPOAsRequester({ poId: po7.poId, actingUserId: owner.id });
    check("control C allowed", r7.ok, true);

    const po7After = await getPOByRecordId(po7.id);
    const pdfAfter = po7After.poPdfFile?.[0];
    check("PO is Withdrawn", po7After.status, PO_WITHDRAWN_STATUS);
    check("attachment id unchanged", pdfAfter?.id, pdfBefore?.id);
    check("attachment filename unchanged", pdfAfter?.filename, pdfBefore?.filename);
    check("attachment size unchanged", pdfAfter?.size, pdfBefore?.size);
    check("attachment count still 1", po7After.poPdfFile?.length, 1);
    check("President Signed survives too", po7After.presidentSigned, true);

    console.log("\nPart C — invoice-side candidate queries exclude it:");
    check("searchPOs drops the withdrawn PO", (await searchPOs(po6.poId)).length, 0);
    const allPos = await getAllPOs();
    check("getAllPOs drops the withdrawn PO", allPos.some((po) => po.id === po6.id), false);
    check("getAllPOs returns no withdrawn PO at all", allPos.some(isPOWithdrawn), false);
    // getOpenPOs needs no change of its own — it filters getAllPOs()'s result
    // by remaining un-invoiced qty — but "inherits the exclusion" is only
    // worth stating if it's checked. po7 has an item with nothing invoiced
    // against it, so openness can't be what keeps it out; only the status
    // exclusion can.
    const openPos = await getOpenPOs();
    check("getOpenPOs drops the withdrawn PO", openPos.some((po) => po.id === po7.id), false);
    check("getOpenPOs returns no withdrawn PO at all", openPos.some(isPOWithdrawn), false);
} catch (err) {
    // A missing select option / missing field is a prerequisite problem, not
    // a verdict on the code. Anything else is a real failure.
    const schemaGap =
        /INVALID_MULTIPLE_CHOICE_OPTIONS|UNKNOWN_FIELD_NAME|Insufficient permissions to create new select option/i.test(
            err.message
        );
    if (schemaGap) {
        blocked = err.message;
    } else {
        pass = false;
        console.error("\n  UNEXPECTED ERROR — not a schema gap:", err);
    }
} finally {
    // Teardown, reverse creation order. Best-effort per record so one
    // failure doesn't strand the rest.
    for (const id of createdLinks) {
        await base(TABLES.INVOICE_PO_LINK).destroy(id).catch((err) =>
            console.error(`cleanup: Invoice-PO Link ${id} — remove manually:`, err.message)
        );
    }
    for (const id of createdInvoices) {
        await base(TABLES.INVOICES).destroy(id).catch((err) =>
            console.error(`cleanup: Invoice ${id} — remove manually:`, err.message)
        );
    }
    for (const id of createdPOs) {
        try {
            const poRec = await base(TABLES.PURCHASE_ORDERS).find(id);
            const poItemIds = poRec.get("PO Items") || [];
            await Promise.allSettled(poItemIds.map((itemId) => base(TABLES.PO_ITEMS).destroy(itemId)));
            await base(TABLES.PURCHASE_ORDERS).destroy(id);
        } catch (err) {
            console.error(`cleanup: PO ${id} — remove manually:`, err.message);
        }
    }
    for (const id of createdPRs) {
        try {
            const prRec = await base(TABLES.PURCHASE_REQUESTS).find(id);
            const itemIds = prRec.get("PR Items") || [];
            await Promise.allSettled(itemIds.map((i) => base(TABLES.PR_ITEMS).destroy(i)));
            await base(TABLES.PURCHASE_REQUESTS).destroy(id);
        } catch (err) {
            console.error(`cleanup: PR ${id} — remove manually:`, err.message);
        }
    }
    // The Blob original behind the attachment fixture. Airtable keeps its own
    // copy, so deleting this doesn't disturb the assertions above — it just
    // avoids leaving a file in the store (contrast the app's own orphaned-Blob
    // gap, tracked separately in CLAUDE.md).
    for (const url of createdBlobUrls) {
        await del(url).catch((err) => console.error(`cleanup: blob ${url} — remove manually:`, err.message));
    }
    console.log("  (fixtures cleaned up)");
}

console.log("\n" + "=".repeat(56));
if (blocked) {
    console.log("PARTS A+B PASS; PARTS B2/C BLOCKED — Airtable schema not ready.");
    console.log(`  Add Purchase Orders.Status option "${PO_WITHDRAWN_STATUS}" and the`);
    console.log('  "Withdrawn At" dateTime field, then re-run. Airtable said:');
    console.log(`  ${blocked}`);
    console.log(pass ? "  (no check that did run failed)" : "  (and some checks that DID run failed)");
} else {
    console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
}
// Exit codes added by #152. `blocked` is the schema-prerequisite case this
// script already distinguished in its output but not in its status: parts of it
// could not run, which is exactly the state #147 gave exit 2 to.
process.exit(!pass ? 1 : blocked ? 2 : 0);
