// Authorization verification, credentialed tier — #134, reworked by #147 and
// split by #152.
//
// Provenance: #134 built the original (Admin gate wiring, the detect-po SSRF
// guard, PO-generation idempotency); #147 replaced a substring search with a
// structural check and deleted two hand-copies of production logic; #152 moved
// everything that runs without credentials into scripts/tests/offline/.
//
// This file keeps no issue number because it is not one issue's evidence, but
// it is no longer a standing check either — that role moved to the offline tier,
// which runs on every push. Run this one by hand when you have reason to.
//
// #152 moved this script's two offline parts out. What used to be Part A (the
// endpoint inventory) is scripts/tests/offline/authz-structure.mjs and what
// used to be Part D (the wrappers' control flow) is
// scripts/tests/offline/authz-wrappers.mjs. Both run with plain `node` on every
// push now, which is the point: they were the parts that decay silently, and
// they were unreachable without credentials while they lived here. Run them
// with `npm test`; this file no longer repeats them.
//
// What is left here is everything that genuinely needs credentials or a server:
//   B — the Blob host predicate the detect-po SSRF guard uses. Imports the real
//       isOurBlobUrl; #147 deleted the hand-copy that used to live here. Stays
//       credentialed because lib/blobIngest.js imports the Airtable client,
//       which throws at module load without AIRTABLE_API_KEY.
//   C — PO generation against a real throwaway PR+PO: fixture, then
//       idempotency. #147 deleted this part's copy of generatePOAction's Admin
//       guard; offline/authz-structure.mjs and offline/authz-wrappers.mjs cover
//       what that copy claimed to.
//   E — HTTP: the three wrapped Admin routes answer 401 / 403 / not-refused.
//
// Run the whole thing with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-authz.mjs
//
// Part E additionally needs `npm run dev` up; override its target with
// AUTHZ_VERIFY_BASE_URL. Exit codes: 0 all clear, 1 something failed, 2 clean
// but incomplete (a part could not run).

import { readFileSync } from "fs";
import { isOurBlobUrl } from "../../lib/blobIngest.js";
import { createPR, updatePR, getPRByRecordId } from "../../lib/airtable/purchaseRequests.js";
import { generatePOForApprovedPR } from "../../lib/poGeneration.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { createFixtures } from "./_fixtures.mjs";

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
console.log("Part B — isOurBlobUrl, the host predicate the detect-po SSRF guard uses:");
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
// Fixtures (#171) — see scripts/tests/_fixtures.mjs. Bucket order IS deletion
// order; POs before PRs, since a PO links its PR.
//
// THE FIFTH H1, and commit 1's inventory counted it as one: Part C's cleanup ran
// `Promise.allSettled(poItemIds.map(destroy))`, discarded the results, and then
// destroyed the PO regardless — a failed child delete left an orphan with nothing
// saying so. That is the mechanism behind the two parentless PO Items #162 found
// by hand, and commit 5 took the other four (140, 133, 138, 132) without this one.
//
// No Materials bucket, measured rather than assumed: the PO comes from
// generatePOForApprovedPR, which writes the item axis as a side effect (#18), but
// this PR carries no Vendor, so refreshMaterialsCacheForPO returns
// `skippedAll: "no Vendor on the PR"` before writing anything — and the PR has no
// items either, so there would be nothing to key a material on.
const fixtures = createFixtures({
    tag: "V-AUTHZ",
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

let complete = false;
try {
    console.log("\nPart C — generatePOForApprovedPR against a real throwaway PR+PO (fixture + idempotency):");
    // #147 removed this part's generatePOAuthorized copy and the three checks
    // built on it: it restated generatePOAction's Admin guard, so once that
    // guard moved into a wrapper the copy would have kept passing while
    // describing a shape that no longer existed — the same way the old
    // substring check went stale. offline/authz-structure.mjs now proves the
    // wrapper is applied and offline/authz-wrappers.mjs proves it stops the
    // body; what is left here always exercised production code.
    const users = await getActiveUsers();
    if (users.length === 0) throw new Error("No active users to attribute the fixture PR to.");

    const created = await createPR({ requesterId: users[0].id, notes: `${TAG} fixture` });
    fixtures.track("prs", created.id);
    await updatePR(created.id, { status: "Approved" });
    let pr = await getPRByRecordId(created.id);
    check("fixture PR starts with no PO", (pr.purchaseOrders || []).length, 0);

    const gen1 = await generatePOForApprovedPR(pr);
    fixtures.track("pos", gen1.poRecordId);
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
    complete = true;
} catch (err) {
    // A `catch` where a bare `finally` used to be, so the verdict at the bottom is
    // reachable — measured on verify-po-awaiting-signature-133.mjs in commit 5.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
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
// skipped because nothing here can read a delivered inbox; no route is added to
// the app to do this.
//
// A POST SINCE #203, not a GET. The route stopped consuming on GET because mail
// security scanners open links before the recipient does, so the token was spent
// before the click. This posts the form the /login/confirm page posts, which is
// also what keeps this helper honest: it exercises the production path rather
// than a shortcut around it. No `Origin` header is sent, which the route's
// cross-origin guard treats as absent and allows — so this helper passes
// whether or not that guard exists, and is NOT evidence about it. The
// mismatched-Origin case was measured once in #203 against a throwaway script
// and is recorded in that commit; nothing standing re-measures it.
async function sessionCookieFor(email) {
    const { token } = await createAuthToken(email);
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: "POST",
        redirect: "manual",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
    });
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

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(56));
// TWO VERDICTS, TWO SENTENCES (#171): `pass` is about authorization, a leak is
// about this run's effect on a shared base. A leak is exit 1 rather than 2 — 2
// means a part could not run, which needs no hand cleanup.
console.log(fixtures.describe(teardown));
if (!pass || teardown.leaked.length > 0) {
    console.log("SOME CHECKS FAILED");
    process.exit(1);
} else if (incomplete) {
    console.log("NO FAILURES, BUT THE RUN WAS INCOMPLETE — see NOT RUN above");
    process.exit(2);
} else {
    console.log("ALL CHECKS PASS");
    process.exit(0);
}
