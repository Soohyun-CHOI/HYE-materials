// Verification for issue #143 — PR detail is row-scoped, and the gate does not
// cut the signing chain.
//
// Two things need real records rather than the offline tier's hand-built
// objects:
//
//   1. The design claim. canViewPR answers "is this user a signer on this PR"
//      by intersecting `Users."PR Signers"` with `Purchase Requests."PR
//      Signers"`, which is only free of queries if BOTH sides really carry the
//      same child row ids, and only correct if the reverse side is populated
//      immediately rather than after a propagation delay. Part A measures that
//      on a record it just created.
//   2. The widening. The clauses that GRANT access are the ones worth
//      exercising against production data — a signer who is not on the PR's Job
//      could not open it before, and if that stays broken the chain stalls with
//      no error to explain it.
//
// Uses `authz-fixture@hanyangengusa.com`, the permanent non-Admin Employee
// fixture (see CLAUDE.md). Its Assigned Jobs is read and asserted empty-of-this
// -Job, so "off the Job" is a fact here rather than an assumption.
//
// Fixtures: one throwaway PR plus one signer row and one correction request,
// all deleted at the end.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-pr-visibility-143.mjs
//
// Part E additionally needs `npm run dev`; override its target with
// PR_VIS_BASE_URL. Exit codes: 0 all clear, 1 something failed, 2 clean but a
// part could not run.

import { canViewPR } from "../../lib/prVisibility.js";
import { createPR, getPRByRecordId, getPRById, updatePR } from "../../lib/airtable/purchaseRequests.js";
import { createSigner } from "../../lib/airtable/prSigners.js";
import { createCorrectionRequest, resolveCorrectionRequest } from "../../lib/airtable/correctionRequests.js";
import { getUserByEmail, getUserByRecordId, getActiveUsers } from "../../lib/airtable/users.js";
import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getAllLines } from "../../lib/airtable/lines.js";
import { base, TABLES } from "../../lib/airtable/client.js";

let pass = true;
let incomplete = false;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}

const FIXTURE_EMAIL = "authz-fixture@hanyangengusa.com";
const BASE_URL = process.env.PR_VIS_BASE_URL || "http://localhost:3000";

let prRecordId = null;
let signerRowId = null;
let correctionRowId = null;

try {
    const fixture = await getUserByEmail(FIXTURE_EMAIL);
    if (!fixture) throw new Error(`${FIXTURE_EMAIL} not found — it is a permanent fixture, see CLAUDE.md`);
    const owner = (await getActiveUsers()).find((u) => u.id !== fixture.id);
    if (!owner) throw new Error("Need a second active user to own the fixture PR.");
    const line = (await getAllLines())[0];

    console.log(`Fixture user: ${fixture.userName} [${fixture.id}] role=${fixture.role} isAdmin=${fixture.isAdmin}`);
    console.log(`PR owner:     ${owner.userName} [${owner.id}]`);

    // The whole point of clauses 5 and 6 is a participant with no claim on the
    // Job, so assert that rather than assume it.
    check("fixture user is a non-Admin Employee", fixture.role === "Employee" && !fixture.isAdmin, true);

    const created = await createPR({ requesterId: owner.id, lineId: line.id, notes: "#143 verification — safe to delete" });
    prRecordId = created.id;
    await updatePR(created.id, { status: "In Review" });
    let pr = await getPRByRecordId(created.id);
    check("fixture PR is not on any Job the fixture user is assigned to",
        (fixture.assignedJobs || []).includes(pr.job?.[0]), false);
    check("fixture PR was not raised by the fixture user", pr.requester?.[0] === fixture.id, false);

    console.log("\nBaseline — with no chain role, the fixture user is refused:");
    check("canViewPR refuses", canViewPR(fixture, pr), false);

    console.log("\nPart A — both sides of the link carry the same row ids, immediately:");
    const signer = await createSigner({
        prRecordId: pr.id,
        prId: pr.prId,
        signerUserId: fixture.id,
        sequenceOrder: 1,
        confirmationType: "Approval",
    });
    signerRowId = signer.id;
    // Re-read both records with the production mappers — no polling, so a
    // populated reverse side here means the link is immediate.
    pr = await getPRByRecordId(pr.id);
    let fixtureFresh = await getUserByRecordId(fixture.id);
    check("PR record lists the new signer row", (pr.signerRowIds || []).includes(signer.id), true);
    check("User record lists the same signer row (reverse side, no wait)",
        (fixtureFresh.signerRowIds || []).includes(signer.id), true);

    console.log("\nPart B — clause 5: a signer off the PR's Job can open it:");
    check("canViewPR now admits the signer", canViewPR(fixtureFresh, pr), true);
    // And it is the intersection doing the work, not something incidental.
    check("still refused if the user's signer rows are emptied",
        canViewPR({ ...fixtureFresh, signerRowIds: [] }, pr), false);
    check("still refused if the PR's signer rows are emptied",
        canViewPR(fixtureFresh, { ...pr, signerRowIds: [] }), false);

    console.log("\nPart C — clause 6: the recipient of a correction request can open it:");
    // Remove the signer claim so clause 6 is what is being measured.
    await base(TABLES.PR_SIGNERS).destroy(signer.id);
    signerRowId = null;
    pr = await getPRByRecordId(pr.id);
    fixtureFresh = await getUserByRecordId(fixture.id);
    check("signer claim is gone, so the user is refused again", canViewPR(fixtureFresh, pr), false);

    const correction = await createCorrectionRequest({
        prRecordId: pr.id,
        prId: pr.prId,
        initiatedById: owner.id,
        sentToId: fixture.id,
        notes: "#143 verification",
    });
    correctionRowId = correction.id;
    pr = await getPRByRecordId(pr.id);
    fixtureFresh = await getUserByRecordId(fixture.id);
    check("PR record lists the correction row", (pr.correctionRowIds || []).includes(correction.id), true);
    check("User record lists it as sent to them", (fixtureFresh.correctionRowIds || []).includes(correction.id), true);
    check("canViewPR admits the recipient", canViewPR(fixtureFresh, pr), true);

    console.log("\n  and it survives resolution (status-agnostic by design):");
    await resolveCorrectionRequest(correction.id);
    pr = await getPRByRecordId(pr.id);
    fixtureFresh = await getUserByRecordId(fixture.id);
    const resolved = (await base(TABLES.CORRECTION_REQUESTS).find(correction.id)).get("Status");
    check("the correction really is Resolved", resolved, "Resolved");
    check("the recipient can still open the PR", canViewPR(fixtureFresh, pr), true);

    console.log("\nPart D — a Draft is the author's alone, on a real record:");
    await updatePR(pr.id, { status: "Draft" });
    pr = await getPRByRecordId(pr.id);
    check("PR is now a Draft", pr.status, "Draft");
    check("its Requester can open it", canViewPR(await getUserByRecordId(owner.id), pr), true);
    check("the correction recipient can NOT (Draft beats chain membership)", canViewPR(fixtureFresh, pr), false);
    // Deliberately an Admin who is neither the author nor the fixture, so the
    // clause-1-beats-role case is actually exercised rather than skipped.
    const otherAdmin = (await getActiveUsers()).find(
        (u) => u.isAdmin === true && u.id !== owner.id && u.id !== fixture.id
    );
    if (otherAdmin) {
        console.log(`  (using Admin ${otherAdmin.userName} [${otherAdmin.id}], not the author)`);
        check("an Admin who is not its author can NOT open it", canViewPR(otherAdmin, pr), false);
    } else {
        incomplete = true;
        console.log("  NOT RUN  no Admin available who is neither the author nor the fixture.");
    }
    // Put it back for Part E.
    await updatePR(pr.id, { status: "In Review" });
    pr = await getPRByRecordId(pr.id);

    console.log("\nPart E — over HTTP: the page itself refuses, and admits:");
    let serverUp = false;
    try {
        await fetch(`${BASE_URL}/login`, { redirect: "manual" });
        serverUp = true;
    } catch {
        serverUp = false;
    }

    if (!serverUp) {
        incomplete = true;
        console.log(`  NOT RUN  no server reachable at ${BASE_URL} — start \`npm run dev\` and re-run.`);
        console.log("           Part E is the only part that exercises the page's own gate (exit 2).");
    } else {
        async function cookieFor(email) {
            const { token } = await createAuthToken(email);
            const res = await fetch(`${BASE_URL}/api/auth/verify?token=${token}`, { redirect: "manual" });
            const jar = (res.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).join("; ");
            if (!jar) throw new Error(`no session cookie for ${email} (status ${res.status})`);
            return jar;
        }
        async function pageSays(cookie) {
            const html = await (await fetch(`${BASE_URL}/prs/${pr.prId}`, { headers: { cookie } })).text();
            return { notFound: html.includes("PR not found."), showsPr: html.includes(pr.prId) };
        }

        const fixtureCookie = await cookieFor(FIXTURE_EMAIL);

        // Correction claim still stands from Part C, so the fixture user should
        // be admitted. Drop it first to see the refusal.
        await base(TABLES.CORRECTION_REQUESTS).destroy(correction.id);
        correctionRowId = null;
        const refused = await pageSays(fixtureCookie);
        check("with no chain role, the page answers not-found", refused.notFound, true);

        // Re-grant via the signer clause and confirm the page opens.
        const signer2 = await createSigner({
            prRecordId: pr.id,
            prId: pr.prId,
            signerUserId: fixture.id,
            sequenceOrder: 1,
            confirmationType: "Approval",
        });
        signerRowId = signer2.id;
        const admitted = await pageSays(fixtureCookie);
        check("as a signer, the page renders the PR", admitted.showsPr && !admitted.notFound, true);
    }
} catch (err) {
    pass = false;
    console.error("\n  UNEXPECTED ERROR:", err);
} finally {
    for (const [table, id] of [
        [TABLES.PR_SIGNERS, signerRowId],
        [TABLES.CORRECTION_REQUESTS, correctionRowId],
    ]) {
        if (id) await base(table).destroy(id).catch((e) => console.error(`cleanup: ${id} — remove manually:`, e.message));
    }
    if (prRecordId) {
        await base(TABLES.PURCHASE_REQUESTS)
            .destroy(prRecordId)
            .catch((e) => console.error(`cleanup: PR ${prRecordId} — remove manually:`, e.message));
    }
    console.log("\n  (fixtures cleaned up)");
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
