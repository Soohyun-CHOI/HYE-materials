// Ad hoc verification for issue #122 — proves that withdrawAction's
// SERVER-SIDE re-validation (requester + status) actually blocks
// forged/bypassed calls, independent of the client UI (the detail page
// only *hides* the control; this checks the server rejects regardless).
//
// The real withdrawAction is a Next.js Server Action: it resolves the
// caller via requireUser() (iron-session, needs a live request/cookie
// context) and finishes with redirect() (throws NEXT_REDIRECT outside the
// render pipeline) — neither is drivable from a plain node script. So this
// mirrors the action's guard sequence VERBATIM (see the quoted source
// below) and calls the SAME data-layer functions (getPRById / updatePR),
// injecting the caller's user id — i.e. the exact value requireUser().id
// would supply. That isolates and exercises the withdraw-specific
// re-validation + the real Airtable write/no-write, which is the security
// question here. (requireUser itself — the session gate — is a separate
// concern, already used by every other action.)
//
// From app/prs/[prId]/actions.js withdrawAction, mirrored 1:1:
//     const user = await requireUser();          // -> caller id
//     const pr = await getPRById(prId);
//     if (!pr) return { error: "PR not found." };
//     if (pr.requester?.[0] !== user.id)
//         return { error: "You can only withdraw your own PR." };
//     if (pr.status !== "In Review")
//         return { error: "Only a PR that's still in review can be withdrawn." };
//     await updatePR(pr.id, { status: "Withdrawn", withdrawnAt: <now> });
//     redirect(`/prs/${pr.prId}?done=withdrawn`);
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-withdraw-revalidation-122.mjs
//
// Creates 5 throwaway PRs and deletes them all afterward (scripts/tests
// convention). Does not touch the Users records it borrows as identities.

import { createPR, updatePR, getPRById } from "../../lib/airtable/purchaseRequests.js";
import { getActiveUsers } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";

// Verbatim mirror of withdrawAction's guard + write sequence. callerUserId
// stands in for requireUser().id — the only input the real action derives
// from the session. Returns the same shape the action produces: { error }
// on a rejected call, or { redirect } on the success path (where the real
// action would redirect after the write).
async function simulateWithdraw(callerUserId, prId) {
    const pr = await getPRById(prId);
    if (!pr) return { error: "PR not found." };
    if (pr.requester?.[0] !== callerUserId) {
        return { error: "You can only withdraw your own PR." };
    }
    if (pr.status !== "In Review") {
        return { error: "Only a PR that's still in review can be withdrawn." };
    }
    await updatePR(pr.id, {
        status: "Withdrawn",
        withdrawnAt: new Date().toISOString(),
    });
    return { redirect: `/prs/${pr.prId}?done=withdrawn` };
}

async function statusOf(recordId) {
    const rec = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    return rec.get("Status");
}

async function makePR(requesterId, targetStatus) {
    // createPR always lands as Draft; move it to the target status the same
    // way the real workflow would (updatePR is the sole Status writer).
    const { id, prId } = await createPR({ requesterId });
    if (targetStatus !== "Draft") {
        const fields = { status: targetStatus };
        if (targetStatus === "Withdrawn") fields.withdrawnAt = new Date().toISOString();
        await updatePR(id, fields);
    }
    return { id, prId };
}

const created = [];

async function run() {
    const users = await getActiveUsers();
    if (users.length < 2) {
        throw new Error(`Need at least 2 active users to test the requester guard; found ${users.length}.`);
    }
    const owner = users[0]; // the PRs' requester
    const other = users[1]; // a different signed-in user (case 1)
    console.log(`Owner (requester):  ${owner.userName} [${owner.id}]`);
    console.log(`Other (impostor):   ${other.userName} [${other.id}]`);
    console.log("");

    // Fixtures — one PR per case, all owned by `owner`.
    const prCase1 = await makePR(owner.id, "In Review"); // valid status; only the requester guard should block
    const prCase2 = await makePR(owner.id, "Approved");
    const prCase3 = await makePR(owner.id, "PO Signed");
    const prCase4 = await makePR(owner.id, "Withdrawn");
    const prCase5 = await makePR(owner.id, "In Review"); // control: should succeed
    created.push(prCase1, prCase2, prCase3, prCase4, prCase5);

    const cases = [
        {
            n: 1,
            desc: "Someone else's PR (In Review) — caller is NOT the requester",
            caller: other.id,
            pr: prCase1,
            expect: "reject",
            expectStatusAfter: "In Review",
        },
        {
            n: 2,
            desc: "Own PR, status Approved",
            caller: owner.id,
            pr: prCase2,
            expect: "reject",
            expectStatusAfter: "Approved",
        },
        {
            n: 3,
            desc: "Own PR, status PO Signed",
            caller: owner.id,
            pr: prCase3,
            expect: "reject",
            expectStatusAfter: "PO Signed",
        },
        {
            n: 4,
            desc: "Own PR, already Withdrawn (re-withdraw)",
            caller: owner.id,
            pr: prCase4,
            expect: "reject",
            expectStatusAfter: "Withdrawn",
        },
        {
            n: 5,
            desc: "CONTROL: own PR, In Review — should succeed",
            caller: owner.id,
            pr: prCase5,
            expect: "allow",
            expectStatusAfter: "Withdrawn",
        },
    ];

    let allPass = true;
    for (const c of cases) {
        const statusBefore = await statusOf(c.pr.id);
        const result = await simulateWithdraw(c.caller, c.pr.prId);
        const statusAfter = await statusOf(c.pr.id);

        const rejected = "error" in result;
        const outcome = rejected ? `REJECTED — { error: "${result.error}" }` : `ALLOWED — { redirect: "${result.redirect}" }`;

        const gateOk = c.expect === "reject" ? rejected : !rejected;
        const statusOk = statusAfter === c.expectStatusAfter;
        const pass = gateOk && statusOk;
        if (!pass) allPass = false;

        console.log(`Case ${c.n}: ${c.desc}`);
        console.log(`   caller:        ${c.caller}`);
        console.log(`   PR:            ${c.pr.prId}`);
        console.log(`   status before: ${statusBefore}`);
        console.log(`   result:        ${outcome}`);
        console.log(`   status after:  ${statusAfter}  (expected ${c.expectStatusAfter})`);
        console.log(`   => ${pass ? "PASS" : "FAIL"}  [gate ${gateOk ? "ok" : "WRONG"}, status ${statusOk ? "ok" : "WRONG"}]`);
        console.log("");
    }

    console.log("=".repeat(56));
    // Exit code added by #152: printing the verdict and returning 0 either way
    // made a failure indistinguishable from a pass to anything but a reader.
    // Set rather than exited on, so the cleanup in the finally below still runs.
    console.log(allPass ? "ALL CASES PASS" : "SOME CASES FAILED");
    process.exitCode = allPass ? 0 : 1;
}

try {
    await run();
} finally {
    // Teardown — these PRs were created with no children, so a direct
    // destroy is sufficient. Best-effort per record so one failure doesn't
    // strand the rest.
    for (const pr of created) {
        try {
            await base(TABLES.PURCHASE_REQUESTS).destroy(pr.id);
            console.log(`cleaned up ${pr.prId} (${pr.id})`);
        } catch (err) {
            console.error(`FAILED to clean up ${pr.prId} (${pr.id}) — delete it manually:`, err.message);
        }
    }
}
