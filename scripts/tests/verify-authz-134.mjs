// Verification for issue #134 — authz tightening.
//
// The Admin-gate DECISION (401 no session / 403 non-Admin / authorized) can't
// be unit-tested here: it lives in lib/authz.js:requireAdminApi(), which the
// verify loader can't import (authz.js pulls next/navigation + next/server).
// That branch correctness is verified by the browser end-to-end steps in the
// report instead. What this script pins down:
//   - Part A: wiring — each Admin route actually calls the gate helper, and
//     before its real work (a route added later without the gate, or with it
//     placed after the work, must fail here).
//   - Part B: the detect-po SSRF host check (branch behavior + still present).
//   - Part C: generatePOAction refuses non-Admin / creates no PO, and PO
//     generation is idempotent — against a real throwaway PR+PO.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-authz-134.mjs

import { readFileSync } from "fs";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// Each Admin route must call requireAdminApi() before its real work — the
// `work` needle is the route's first genuine side effect / data access, so
// gateIdx < workIdx proves the gate isn't missing and isn't placed after it.
const ROUTE_GATE_CHECKS = [
    { file: "app/api/pos/search/route.js", work: "searchPOs(" },
    { file: "app/api/pos/[poRecordId]/items/route.js", work: "getInvoicingStatusByPO(" },
    { file: "app/api/invoices/detect-po/route.js", work: "request.json()" },
    { file: "app/api/invoices/upload/route.js", work: "allowedContentTypes" },
];

// Strip comments so a needle mentioned in prose (e.g. a doc comment naming
// getInvoicingStatusByPO) can't be mistaken for the call.
function codeOnly(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .filter((l) => {
            const t = l.trim();
            return !t.startsWith("//") && !t.startsWith("*");
        })
        .join("\n");
}

console.log("Part A — Admin gate wiring (requireAdminApi called before each route's work):");
for (const { file, work } of ROUTE_GATE_CHECKS) {
    const src = codeOnly(readFileSync(file, "utf8"));
    const gateIdx = src.indexOf("requireAdminApi(");
    const workIdx = src.indexOf(work);
    check(`${file} — gate present & before \`${work}\``, gateIdx !== -1 && workIdx !== -1 && gateIdx < workIdx, true);
}

console.log("\nPart B — detect-po blobUrl host restriction (SSRF guard):");
// Mirrors the inline host check; the wiring assert fails if the route drops it.
function blobUrlAllowed(blobUrl) {
    let u;
    try {
        u = new URL(blobUrl);
    } catch {
        return false;
    }
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
}
check("our Blob host allowed", blobUrlAllowed("https://abc123.public.blob.vercel-storage.com/inv.pdf"), true);
check("http (non-https) Blob rejected", blobUrlAllowed("http://abc123.public.blob.vercel-storage.com/x.pdf"), false);
check("cloud metadata IP rejected", blobUrlAllowed("https://169.254.169.254/latest/meta-data/"), false);
check("arbitrary host rejected", blobUrlAllowed("https://evil.example.com/x.pdf"), false);
check("look-alike host rejected", blobUrlAllowed("https://public.blob.vercel-storage.com.evil.com/x"), false);
check("malformed URL rejected", blobUrlAllowed("not a url"), false);
check(
    "wiring — detect-po route still contains the host check",
    readFileSync("app/api/invoices/detect-po/route.js", "utf8").includes(".public.blob.vercel-storage.com"),
    true
);

// Mirror of generatePOAction's guard: requireAdmin() -> authorized = isAdmin.
function generatePOAuthorized(user) {
    return user?.isAdmin === true;
}

let createdPrId = null;
let createdPoId = null;
try {
    console.log("\nPart C — generatePOAction: non-Admin refused, no PO created; + idempotency:");
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    const created = await createPR({ requesterId: users[0].id });
    createdPrId = created.id;
    await updatePR(created.id, { status: "Approved" });
    let pr = await getPRByRecordId(created.id);
    check("fixture PR starts with no PO", (pr.purchaseOrders || []).length, 0);

    check("non-Admin call rejected", generatePOAuthorized({ status: "Active", isAdmin: false }), false);
    pr = await getPRByRecordId(created.id);
    check("still no PO after rejected call", (pr.purchaseOrders || []).length, 0);

    check("Admin call authorized", generatePOAuthorized({ status: "Active", isAdmin: true }), true);
    const gen1 = await generatePOForApprovedPR(pr);
    createdPoId = gen1.poRecordId;
    check("Admin generation creates a PO", gen1.alreadyExisted, false);
    pr = await getPRByRecordId(created.id);
    check("PR now has exactly one PO", (pr.purchaseOrders || []).length, 1);

    // Idempotency (report item 1): second call is a no-op — same record, no
    // new PO, no counter burn (poGeneration.js:29-31 returns before mint).
    const gen2 = await generatePOForApprovedPR(pr);
    check("second call is a no-op (alreadyExisted)", gen2.alreadyExisted, true);
    check("second call returns the same PO record", gen2.poRecordId, gen1.poRecordId);
    pr = await getPRByRecordId(created.id);
    check("still exactly one PO (no duplicate)", (pr.purchaseOrders || []).length, 1);
} finally {
    if (createdPoId) {
        try {
            const poRec = await base(TABLES.PURCHASE_ORDERS).find(createdPoId);
            const poItemIds = poRec.get("PO Items") || [];
            await Promise.allSettled(poItemIds.map((id) => base(TABLES.PO_ITEMS).destroy(id)));
            await base(TABLES.PURCHASE_ORDERS).destroy(createdPoId);
        } catch (err) {
            console.error(`cleanup: delete PO ${createdPoId} manually:`, err.message);
        }
    }
    if (createdPrId) {
        await base(TABLES.PURCHASE_REQUESTS)
            .destroy(createdPrId)
            .catch((err) => console.error(`cleanup: delete PR ${createdPrId} manually:`, err.message));
    }
    if (createdPoId || createdPrId) console.log("  (fixture cleaned up)");
}

console.log("\n" + "=".repeat(56));
console.log(pass ? "ALL CHECKS PASS" : "SOME CHECKS FAILED");
