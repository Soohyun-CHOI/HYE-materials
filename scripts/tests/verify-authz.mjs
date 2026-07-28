// Authorization verification — issue #134, reworked by #147.
//
// Named without an issue number on purpose: unlike verify-po-withdraw-138.mjs
// or verify-blob-lifecycle-140.mjs, which are evidence for one issue and end
// with it, Part A here is a standing check meant to be re-run whenever an
// endpoint is added. An issue number in the filename reads as issue residue.
// Provenance: #134 built the original (Admin gate wiring, the detect-po SSRF
// guard, PO-generation idempotency); #147 replaced Part A's substring search
// with a structural check, deleted two hand-copies of production logic, and
// added Parts D and E.
//
// What #147 changed and why: Part A used to search the source for
// `requireAdminApi(` over four hard-coded paths. A comment satisfied it, a real
// call whose refusal Response was then discarded satisfied it, and a route
// added later was not a subject of it at all. It reported green regardless of
// the state of the code.
//
// Parts:
//   A — structure, delegated to verify-authz-structure.mjs, which also runs
//       standalone with no env/Airtable/server. That file carries the
//       exemption list and the exact statement of what a wrapped vs an exempt
//       PASS proves (ordering is structural for one, unchecked for the other).
//   B — the Blob host predicate the detect-po SSRF guard uses. Imports the real
//       isOurBlobUrl; #147 deleted the hand-copy that used to live here.
//   C — PO generation against a real throwaway PR+PO: fixture, then
//       idempotency. #147 deleted this part's copy of generatePOAction's Admin
//       guard (Parts A and D cover that now).
//   D — the guard wrappers' own control flow: the production factories with a
//       refusing gate injected, asserting the handler body never runs.
//   E — HTTP: the three wrapped Admin routes answer 401 / 403 / not-refused.
//
// Run the whole thing with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-authz.mjs
//
// Part E additionally needs `npm run dev` up; override its target with
// AUTHZ_VERIFY_BASE_URL. Exit codes: 0 all clear, 1 something failed, 2 clean
// but incomplete (a part could not run).

import { readFileSync } from "fs";
import { runStructureCheck } from "./verify-authz-structure.mjs";
import { isOurBlobUrl } from "../../lib/blobIngest.js";
import {
    createResponseGuard,
    createFlagGuard,
    createThrowingGuard,
} from "../../lib/authzWrap.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
let incomplete = false;
const log = (m) => console.log(m);
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}

// ---------------------------------------------------------------------------
console.log("Part A — endpoint inventory: every export wrapped, or exempt with a reason");
console.log("  (see verify-authz-structure.mjs for what wrapped vs exempt actually proves)");
if (!runStructureCheck({ check, log })) pass = false;

// ---------------------------------------------------------------------------
console.log("\nPart B — isOurBlobUrl, the host predicate the detect-po SSRF guard uses:");
// #147: this used to be a local copy named blobUrlAllowed. It is the real
// function now, and the route calls the same one, so there is nothing left to
// drift. The six cases are unchanged so the before/after is comparable.
check("our Blob host allowed", isOurBlobUrl("https://abc123.public.blob.vercel-storage.com/inv.pdf"), true);
check("http (non-https) Blob rejected", isOurBlobUrl("http://abc123.public.blob.vercel-storage.com/x.pdf"), false);
check("cloud metadata IP rejected", isOurBlobUrl("https://169.254.169.254/latest/meta-data/"), false);
check("arbitrary host rejected", isOurBlobUrl("https://evil.example.com/x.pdf"), false);
check("look-alike host rejected", isOurBlobUrl("https://public.blob.vercel-storage.com.evil.com/x"), false);
check("malformed URL rejected", isOurBlobUrl("not a url"), false);
check(
    "wiring — detect-po imports the shared predicate rather than restating it",
    readFileSync(new URL("../../app/api/invoices/detect-po/route.js", import.meta.url), "utf8").includes("isOurBlobUrl"),
    true
);

// ---------------------------------------------------------------------------
console.log("\nPart D — guard wrappers: a refused gate must not run the handler:");
// The production factories, with a refusing gate injected. This is the one
// property the structural check cannot see: that a refusal stops the body.
{
    let bodyRan = false;
    const handler = async () => {
        bodyRan = true;
        return { ok: true };
    };

    const refusingResponse = new Response(JSON.stringify({ error: "Not authorized" }), { status: 403 });
    const apiGuarded = createResponseGuard(async () => refusingResponse)(handler);
    const apiResult = await apiGuarded(new Request("https://example.test/"));
    check("withAdminApi shape — handler did not run", bodyRan, false);
    check("withAdminApi shape — refusal is the gate's own Response", apiResult === refusingResponse, true);
    check("withAdminApi shape — status preserved", apiResult.status, 403);

    bodyRan = false;
    const flagGuarded = createFlagGuard(async () => ({ authorized: false }))(
        () => ({ error: "Not authorized." }),
        handler
    );
    const flagResult = await flagGuarded(null, new FormData());
    check("withAdminAction shape — handler did not run", bodyRan, false);
    check("withAdminAction shape — refusal is the call site's { error }", flagResult?.error, "Not authorized.");

    bodyRan = false;
    const flagThrowing = createFlagGuard(async () => ({ authorized: false }))(() => {
        throw new Error("Not authorized");
    }, handler);
    let threw = null;
    await flagThrowing(null, new FormData()).catch((err) => {
        threw = err.message;
    });
    check("withAdminAction shape — a throwing refusal still throws", threw, "Not authorized");
    check("withAdminAction shape — handler did not run (throwing refusal)", bodyRan, false);

    bodyRan = false;
    const presidentGuarded = createThrowingGuard(async () => {
        throw new Error("Only the President can sign a PO.");
    })(handler);
    let presidentThrew = null;
    await presidentGuarded(null, new FormData()).catch((err) => {
        presidentThrew = err.message;
    });
    check("withPresidentAction shape — gate's throw propagates", presidentThrew, "Only the President can sign a PO.");
    check("withPresidentAction shape — handler did not run", bodyRan, false);

    // And the authorized direction, so the wrappers aren't passing by refusing
    // everything.
    bodyRan = false;
    const allowed = createFlagGuard(async () => ({ authorized: true }))(() => ({ error: "no" }), handler);
    const allowedResult = await allowed(null, new FormData());
    check("withAdminAction shape — authorized runs the handler", bodyRan, true);
    check("withAdminAction shape — authorized returns the handler's value", allowedResult?.ok, true);
}

// ---------------------------------------------------------------------------
let createdPrId = null;
let createdPoId = null;
try {
    console.log("\nPart C — generatePOForApprovedPR against a real throwaway PR+PO (fixture + idempotency):");
    // #147 removed this part's generatePOAuthorized copy and the three checks
    // built on it: it restated generatePOAction's Admin guard, so once that
    // guard moved into a wrapper the copy would have kept passing while
    // describing a shape that no longer existed — the same way Part A went
    // stale. Part A now proves the wrapper is applied and Part D proves it
    // stops the body; what is left here always exercised production code.
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    const created = await createPR({ requesterId: users[0].id });
    createdPrId = created.id;
    await updatePR(created.id, { status: "Approved" });
    let pr = await getPRByRecordId(created.id);
    check("fixture PR starts with no PO", (pr.purchaseOrders || []).length, 0);

    const gen1 = await generatePOForApprovedPR(pr);
    createdPoId = gen1.poRecordId;
    check("generation creates a PO", gen1.alreadyExisted, false);
    pr = await getPRByRecordId(created.id);
    check("PR now has exactly one PO", (pr.purchaseOrders || []).length, 1);

    // Idempotency: second call is a no-op — same record, no new PO, no counter
    // burn (poGeneration.js returns before mint).
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

// ---------------------------------------------------------------------------
console.log("\nPart E — wrapped Admin routes over HTTP: 401 no session / 403 non-Admin / Admin not refused:");

// The permanent non-Admin fixture (see CLAUDE.md's kept-records note).
// createUser() sets Role: Employee, Is Admin: false, Status: Active, so
// verifying a magic link for an address with no Users record yields a non-Admin
// Active Employee by definition — no one's Is Admin has to be flipped.
const NON_ADMIN_FIXTURE_EMAIL = "authz-fixture@hanyangengusa.com";
const BASE_URL = process.env.AUTHZ_VERIFY_BASE_URL || "http://localhost:3000";
const ADMIN_ROUTES = [
    "/api/pos/search?q=HYE",
    "/api/pos/00000000-does-not-matter/items",
    "/api/invoices/detect-po",
];

// A real session for `email`, obtained the way the app issues one: mint a token
// in Auth Tokens with the production helper, then let the production
// /api/auth/verify route consume it and set the cookie. The email step is
// skipped because Resend is still in sandbox mode and cannot deliver to these
// addresses; no route is added to the app to do this.
async function sessionCookieFor(email) {
    const { token } = await createAuthToken(email);
    const res = await fetch(`${BASE_URL}/api/auth/verify?token=${token}`, { redirect: "manual" });
    const session = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
    if (!session) throw new Error(`no session cookie from /api/auth/verify for ${email} (status ${res.status})`);
    return session;
}

async function statusFor(path, cookie) {
    const method = path === "/api/invoices/detect-po" ? "POST" : "GET";
    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        redirect: "manual",
        headers: {
            ...(cookie ? { cookie } : {}),
            ...(method === "POST" ? { "content-type": "application/json" } : {}),
        },
        ...(method === "POST"
            ? { body: JSON.stringify({ blobUrl: "https://x.public.blob.vercel-storage.com/a.pdf" }) }
            : {}),
    });
    return res.status;
}

let serverUp = false;
try {
    await fetch(`${BASE_URL}/api/pos/search?q=x`, { redirect: "manual" });
    serverUp = true;
} catch {
    serverUp = false;
}

if (!serverUp) {
    incomplete = true;
    console.log(`  NOT RUN  no server reachable at ${BASE_URL} — start \`npm run dev\` and re-run.`);
    console.log("           Part E is the only part that proves the gates actually refuse, so this");
    console.log("           run is INCOMPLETE (exit 2), not a pass.");
} else {
    for (const path of ADMIN_ROUTES) {
        check(`${path} — no session`, await statusFor(path, null), 401);
    }

    const nonAdminCookie = await sessionCookieFor(NON_ADMIN_FIXTURE_EMAIL);
    for (const path of ADMIN_ROUTES) {
        check(`${path} — active non-Admin session`, await statusFor(path, nonAdminCookie), 403);
    }

    const admin = (await getActiveUsers()).find((u) => u.isAdmin === true);
    if (!admin) {
        incomplete = true;
        console.log("  NOT RUN  no active Admin user to obtain an authorized response with.");
    } else {
        const adminCookie = await sessionCookieFor(admin.email);
        for (const path of ADMIN_ROUTES) {
            const status = await statusFor(path, adminCookie);
            // The items route is given a nonexistent PO record id on purpose:
            // reaching Airtable at all is the point, so anything other than
            // 401/403 proves the gate let it through.
            check(`${path} — Admin session is not refused`, status === 401 || status === 403, false);
        }
    }
}

console.log("\n" + "=".repeat(56));
if (!pass) {
    console.log("SOME CHECKS FAILED");
    process.exit(1);
} else if (incomplete) {
    console.log("NO FAILURES, BUT THE RUN WAS INCOMPLETE — see NOT RUN above");
    process.exit(2);
} else {
    console.log("ALL CHECKS PASS");
    process.exit(0);
}
