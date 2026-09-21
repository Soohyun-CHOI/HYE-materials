// withdrawAction's server-side re-validation, against the real action (#122, #250).
//
// WHAT CHANGED IN #250, AND WHY THE FILE EXISTED IN ITS OLD SHAPE AT ALL. Until
// now this script ran `simulateWithdraw`, a hand copy of the action's guard
// sequence, so its five cases answered the same way whether or not the action
// still agreed with the copy. #196 deleted the two other scripts of that family
// and left this one standing for a reason: its subject is the per-record
// `requireUser` axis, which `offline/authz-structure.mjs` carries as an
// EXEMPTION — and what an exemption proves is only that the named helper is
// called somewhere inside the export. Order is not checked and the deciding
// comparison is not looked at, so deleting this would leave nothing standing
// where that half is. The copy is gone now and the five cases post to the real
// `withdrawAction`.
//
// HOW IT REACHES IT: THE RPC, BECAUSE THERE IS NO FORM TO POST. #231 and #382's
// create path read `$ACTION_REF_n` and three siblings out of a server-rendered
// `<form action>`. `WithdrawPRForm` has a form and it is inside `{open && …}` —
// client state — so the served HTML carries a `type="button"` and nothing else,
// and there are no fields to read. What reaches the action is the `Next-Action`
// RPC #382 measured, and this is its second use; `scripts/tests/_liveApp.mjs`
// owns all three pieces now and 382 imports them from there too.
//
//   AND THE BODY IS A SHAPE THAT TIER HAD NOT SENT. `deleteInvoiceAction` takes
//   one string, so 382's whole body was `["HYE-INV-…"]` as JSON.
//   `withdrawAction(prevState, formData)` is the `useActionState` signature, and
//   a FormData cannot ride in a JSON array — React encodes it as `$K1` in the
//   model with the entries under `_1_`, multipart. `_liveApp.mjs`'s header has
//   the encoder it was read off and the server branch that takes it.
//
// THE EVIDENCE IS THE BASE, NOT THE REPLY, and the two halves are different
// facts. That the harness reaches the HANDLER is a probe: a `prId` that cannot
// exist comes back as the action's own `PR not found.`, which no other code in
// this app produces and which is the branch before every write. That the action
// RAN is case 5, where `Withdrawn At` is stamped — this script never writes that
// field on case 5's fixture, so a value in it afterwards was written by
// `withdrawAction` and by nothing else. The four rejections then rest on the
// action's own refusal strings plus a base that did not move.
//
//   AND CASE 1 IS RUN TWICE, WHICH IS WHAT A PER-RECORD GUARD DESERVES. A
//   refusal on its own is also what a harness that never reached the guard would
//   produce; case 5 answers that with a different record, and the second call
//   answers it with the SAME one — same request, same page, same body, only the
//   cookie different, and the opposite outcome. One request, two callers, two
//   answers is the whole claim this axis makes.
//
//   CASE 4 IS WHY `Withdrawn At` IS READ AND NOT JUST `Status`. Re-withdrawing an
//   already-withdrawn request leaves `Status` reading `Withdrawn` whether the
//   guard refused or the write went through, so Status alone cannot tell the two
//   apart. The stamp can: the fixture's own value must come back unchanged.
//
// THE FIXTURES ARE PLANTED RATHER THAN RAISED THROUGH THE APP, which is the
// opposite of #368's call and for a reason that inverts cleanly. There the thing
// under test was a WRITE, so the row had to be the shape the app writes. Here it
// is a read-then-refuse, so the fixture is INPUT: the guard reads `Requester` and
// `Status` and nothing else, and items, signers and a quotation would add nothing
// it can see. Three of the five states are ones the app cannot produce in this
// shape anyway — its path to Approved generates a purchase order and PO Signed
// needs a President's signature — so raising them would mean five signing chains
// and five orders on a shared base to exercise one comparison. The one thing the
// app path would have bought, that the detail page renders, is bought instead by
// fetching the page and asserting it.
//
// THE TWO ACCOUNTS, CHOSEN RATHER THAN TAKEN OFF A LIST. This used to use
// `getActiveUsers()[0]` and `[1]`, which is whatever Airtable returns first.
// Since #381 a nameless account lands on `/login/name` instead of anywhere it was
// going, and seven of this base's twelve Active users are nameless — so the
// account is now named here. `scoped-fixture@` is the requester: non-Admin
// Employee, named, and `canViewPR` admits it to its own request. `authz-fixture@`
// is the caller who is not, which is the account's documented job — a refusal and
// nothing else. **An Admin is deliberately not a sixth case**: `withdrawAction`
// has no role branch at all, so one non-requester is the whole of that claim, and
// a case for `soo@` would exercise `canViewPR` rather than this guard.
//
// WHAT THE OFFLINE TIER COULD TAKE OVER FROM THIS: nothing on this axis, which is
// the answer #250 went looking for. `authz-structure.mjs` reaches "requireUser is
// named somewhere inside" and `source-shape.mjs` reaches "the gate call appears
// earlier in the file"; whether the comparison is against the right field, whether
// identity is asked before status, and whether a refused call writes are all
// execution, and that tier never executes. The one thing it could newly hold is
// that the three refusal strings typed below still match the literals in
// `app/prs/[prId]/actions.js` — which would catch this script going stale and
// would say nothing about the guard, so it is not a substitute. Moving those
// strings into a `lib/` constant both sides import is the change that WOULD put
// them in reach, and it is a change to the action rather than to its script.
//
// NEEDS A DEV SERVER on http://localhost:3000 (override with BASE_URL). Run from
// the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/tests/verify-withdraw-revalidation-122.mjs
//
// Fixtures: five bare `Purchase Requests` rows, no children, deleted in the same
// run by scripts/tests/_fixtures.mjs. Two `Auth Tokens` rows are spent to mint the
// sessions. Nothing else on the base is created, modified or read for writing —
// the one record this run changes is case 5's own fixture, changed by the action
// under test.
//
// ABOUT 85 OPERATIONS, IN TWO PROCESSES, and the second is the part a reader of
// the footer will not see. `lib/airtableOps.js` counts per process, so the total
// this script prints — 45 — is its own Airtable traffic and not the run's: the
// dev server it drives paid about 40 more, as two `POST /api/auth/verify`, four
// `/prs/[prId]` renders and seven `withdrawAction` scopes. Both halves are real
// cost against the same base, and only the server's console has the second one.
//
// Exit codes, per docs/notes/verification.md: 0 all clear, 1 something failed OR
// fixtures leaked, 2 clean but a part could not run.

import { createPR, updatePR } from "../../lib/airtable/purchaseRequests.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { needsName, userName } from "../../lib/userName.js";
import { createFixtures } from "./_fixtures.mjs";
import { DEFAULT_BASE_URL, callServerAction, serverActionId, sessionCookieFor } from "./_liveApp.mjs";

const BASE = DEFAULT_BASE_URL;

/** The requester of all five fixtures, and the only caller entitled to withdraw one. */
const OWNER_EMAIL = "scoped-fixture@hanyangengusa.com";
/** A signed-in someone else. See the header for why it is this account. */
const IMPOSTOR_EMAIL = "authz-fixture@hanyangengusa.com";

// withdrawAction's three refusals, by value. They are literals in
// app/prs/[prId]/actions.js rather than a constant either side can import, so a
// reworded refusal fails this run — loudly, which is the tier's whole answer to
// an assertion going stale.
const NOT_FOUND = "PR not found.";
const NOT_YOURS = "You can only withdraw your own PR.";
const NOT_IN_REVIEW = "Only a PR that's still in review can be withdrawn.";

/** A PR ID no record can hold — the same probe shape #382 used on the invoice delete. */
const IMPOSSIBLE_PR_ID = "HYE-PR-000000-99";

let pass = true;
let incomplete = false;
const ok = (label, condition, detail = "") => {
    if (!condition) pass = false;
    console.log(`  ${condition ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
    return condition;
};
const show = (label, value) => console.log(`        ${label}: ${JSON.stringify(value)}`);

const fixtures = createFixtures({
    tag: "V122",
    buckets: [
        // Tagged, under the rule's second clause (#171): makePR calls createPR, so
        // the tag is one argument away. One bucket, no children — these requests
        // are created bare.
        { name: "prs", table: TABLES.PURCHASE_REQUESTS, label: "PR", tagField: "Notes" },
    ],
});
const TAG = fixtures.TAG;

console.log(`withdrawAction against the real action (#122, #250) — run ${TAG}\n`);

/**
 * One fixture request, planted in the state its case needs.
 *
 * `createPR` always lands as Draft, so the target status is a second write —
 * `updatePR` is the sole Status writer. Case 5's fixture deliberately never gets
 * a `Withdrawn At`: that field being filled afterwards is this run's evidence
 * that the action wrote.
 */
async function makePR(requesterId, targetStatus, { stampWithdrawnAt = false } = {}) {
    const { id, prId } = await createPR({ requesterId, notes: `${TAG} ${targetStatus}` });
    fixtures.track("prs", id);
    const fields = {};
    if (targetStatus !== "Draft") fields.status = targetStatus;
    if (stampWithdrawnAt) fields.withdrawnAt = new Date().toISOString();
    if (Object.keys(fields).length > 0) await updatePR(id, fields);
    return { id, prId };
}

/** One request's two judged fields, read off the record rather than off a mapper. */
async function stateOf(recordId) {
    const rec = await base(TABLES.PURCHASE_REQUESTS).find(recordId);
    return { status: rec.get("Status") ?? null, withdrawnAt: rec.get("Withdrawn At") ?? null };
}

const pageFor = (prId) => `${BASE}/prs/${encodeURIComponent(prId)}`;

let complete = false;

try {
    // -----------------------------------------------------------------------
    // Part A — the two people, and a server to reach.
    // -----------------------------------------------------------------------
    console.log("Part A — the two accounts, and the server:");
    const [owner, impostor] = await Promise.all([
        getUserByEmail(OWNER_EMAIL),
        getUserByEmail(IMPOSTOR_EMAIL),
    ]);

    ok(`the requester account exists (${OWNER_EMAIL})`, Boolean(owner?.id), owner?.id || "not found");
    ok(`the other account exists (${IMPOSTOR_EMAIL})`, Boolean(impostor?.id), impostor?.id || "not found");
    // BOTH, because a nameless one is diverted to /login/name and every assertion
    // after that would be measuring the name step (#381).
    ok("the requester is named, so requireUser does not divert it", owner ? !needsName(owner) : false, userName(owner));
    ok("the other is named too", impostor ? !needsName(impostor) : false, userName(impostor));
    ok("and they are two different people", Boolean(owner?.id) && owner?.id !== impostor?.id);

    let reachable = false;
    try {
        const res = await fetch(`${BASE}/login`, { redirect: "manual" });
        reachable = res.status < 500;
    } catch {
        reachable = false;
    }

    if (!owner || !impostor || !reachable) {
        // CHECKED BEFORE ANYTHING IS CREATED. A run that cannot reach the action
        // has no reason to put five requests on a shared base first.
        const why = reachable ? "one of the two accounts is missing" : `no server at ${BASE}`;
        console.log(`  SKIP  nothing was created — ${why}`);
        incomplete = true;
    } else {
        const [ownerCookie, impostorCookie] = await Promise.all([
            sessionCookieFor(OWNER_EMAIL),
            sessionCookieFor(IMPOSTOR_EMAIL),
        ]);
        ok("a session for each", Boolean(ownerCookie) && Boolean(impostorCookie));

        // -------------------------------------------------------------------
        // Part B — the five requests, planted.
        // -------------------------------------------------------------------
        console.log("");
        console.log("Part B — the five requests this run withdraws against:");
        const prCase1 = await makePR(owner.id, "In Review"); // valid status; only identity should block
        const prCase2 = await makePR(owner.id, "Approved");
        const prCase3 = await makePR(owner.id, "PO Signed");
        const prCase4 = await makePR(owner.id, "Withdrawn", { stampWithdrawnAt: true });
        const prCase5 = await makePR(owner.id, "In Review"); // the control: this one must go through

        const planted = [prCase1, prCase2, prCase3, prCase4, prCase5];
        for (const pr of planted) show("created", pr.prId);
        const case4Before = await stateOf(prCase4.id);
        ok("the already-withdrawn fixture carries a stamp to compare against", Boolean(case4Before.withdrawnAt));
        const case5Before = await stateOf(prCase5.id);
        ok(
            "and the control carries none, so a stamp on it afterwards is the action's",
            case5Before.withdrawnAt === null,
            JSON.stringify(case5Before)
        );

        // -------------------------------------------------------------------
        // Part C — the harness: the page, the action's id, and a call that
        // reaches the handler and writes nothing.
        // -------------------------------------------------------------------
        console.log("");
        console.log("Part C — the harness, proved before any case is read as evidence:");

        // The detail page only HIDES the control, which is the premise the whole
        // script rests on — so both sides of the hiding are read off the live
        // server rather than assumed.
        const ownerHtml = await (await fetch(pageFor(prCase5.prId), { headers: { cookie: ownerCookie } })).text();
        ok("the requester's own In Review request renders the control", ownerHtml.includes(">Withdraw this PR<"));
        const impostorHtml = await (
            await fetch(pageFor(prCase1.prId), { headers: { cookie: impostorCookie } })
        ).text();
        ok("and the other account's view of one is the ordinary not-found text", impostorHtml.includes(">PR not found.<"));
        ok("  with no control on it", !impostorHtml.includes(">Withdraw this PR<"));

        const actionId = await serverActionId(pageFor(prCase5.prId), "withdrawAction", { cookie: ownerCookie });
        ok("withdrawAction's id is in the served chunks", Boolean(actionId), actionId || "not found");

        if (!actionId) {
            // A production build may not carry the marker. Reported rather than
            // worked around: a run that skipped the cases would read as a pass.
            console.log("  SKIP  the cases need that id — nothing below ran");
            incomplete = true;
        } else {
            // THE PROBE. `PR not found.` is withdrawAction's first branch and no
            // other code in this app produces the string, so getting it back is
            // evidence the POST reached the handler — and it is the branch before
            // every write, so it costs the base nothing. The page posted to is a
            // real one; only the argument is impossible, which keeps "the URL
            // works" and "the argument was read" separate.
            const probeBody = new FormData();
            probeBody.set("prId", IMPOSSIBLE_PR_ID);
            const probe = await callServerAction({
                pageUrl: pageFor(prCase1.prId),
                actionId,
                args: [null, probeBody],
                cookie: ownerCookie,
            });
            show("the probe's reply", { status: probe.status, refusal: probe.refusal });
            ok(
                `a request id that cannot exist comes back as the action's own refusal`,
                probe.refusal === NOT_FOUND,
                probe.refusal ?? "no refusal in the reply"
            );

            // ---------------------------------------------------------------
            // Part D — the five cases, each posted to the page its control lives on.
            // ---------------------------------------------------------------
            console.log("");
            console.log("Part D — the five cases:");

            const cases = [
                {
                    n: 1,
                    desc: "someone else's request, In Review — the caller is not the requester",
                    pr: prCase1,
                    cookie: impostorCookie,
                    expectRefusal: NOT_YOURS,
                    expectStatus: "In Review",
                    expectStamp: null,
                },
                {
                    n: 2,
                    desc: "own request, Approved",
                    pr: prCase2,
                    cookie: ownerCookie,
                    expectRefusal: NOT_IN_REVIEW,
                    expectStatus: "Approved",
                    expectStamp: null,
                },
                {
                    n: 3,
                    desc: "own request, PO Signed",
                    pr: prCase3,
                    cookie: ownerCookie,
                    expectRefusal: NOT_IN_REVIEW,
                    expectStatus: "PO Signed",
                    expectStamp: null,
                },
                {
                    n: 4,
                    desc: "own request, already Withdrawn — a re-withdraw",
                    pr: prCase4,
                    cookie: ownerCookie,
                    expectRefusal: NOT_IN_REVIEW,
                    expectStatus: "Withdrawn",
                    // The fixture's own stamp, which a write would replace.
                    expectStamp: case4Before.withdrawnAt,
                },
                {
                    n: 5,
                    desc: "CONTROL: own request, In Review — this one must go through",
                    pr: prCase5,
                    cookie: ownerCookie,
                    expectRefusal: null,
                    expectStatus: "Withdrawn",
                    expectStamp: "a stamp the action wrote",
                },
            ];

            for (const c of cases) {
                const before = await stateOf(c.pr.id);
                const body = new FormData();
                body.set("prId", c.pr.prId);
                const result = await callServerAction({
                    pageUrl: pageFor(c.pr.prId),
                    actionId,
                    args: [null, body],
                    cookie: c.cookie,
                });
                const after = await stateOf(c.pr.id);

                console.log(`  Case ${c.n}: ${c.desc}`);
                show("request", c.pr.prId);
                show("before", before);
                show("reply", { status: result.status, refusal: result.refusal, redirect: result.redirect });
                show("after", after);

                if (c.expectRefusal === null) {
                    ok("    the action refused nothing", result.refusal === null, result.refusal ?? "");
                    ok(
                        "    and redirected back to the request",
                        String(result.redirect ?? "").includes(`/prs/${c.pr.prId}`),
                        result.redirect ?? "no redirect"
                    );
                } else {
                    ok("    the action refused, in its own words", result.refusal === c.expectRefusal, result.refusal ?? "none");
                }

                ok(`    the base reads ${c.expectStatus}`, after.status === c.expectStatus, String(after.status));

                // THE STAMP, WHICH IS WHERE THE WRITE SHOWS. On the four
                // rejections it must be exactly what it was; on the control it
                // must have appeared, and this run wrote it nowhere.
                if (c.n === 5) {
                    ok(
                        "    and Withdrawn At was stamped by the action, not by this run",
                        before.withdrawnAt === null && typeof after.withdrawnAt === "string",
                        `${JSON.stringify(before.withdrawnAt)} -> ${JSON.stringify(after.withdrawnAt)}`
                    );
                } else {
                    ok(
                        "    and Withdrawn At is untouched",
                        after.withdrawnAt === c.expectStamp && after.withdrawnAt === before.withdrawnAt,
                        `${JSON.stringify(before.withdrawnAt)} -> ${JSON.stringify(after.withdrawnAt)}`
                    );
                }
            }

            // CASE 1'S OTHER HALF: THE SAME REQUEST, THE SAME PAGE, THE SAME
            // BODY, AND ONLY THE COOKIE DIFFERENT. A refusal on its own is also
            // what a harness that never reached the guard would produce, and
            // case 5 answers that with a different record. This answers it with
            // the SAME one, which is the sharpest thing a per-record guard can be
            // asked: one request, two callers, opposite answers. It costs one
            // call and no fixture — case 1's request is this run's own and is
            // deleted below either way.
            console.log("");
            console.log("  Case 1 again, as its requester — only the session differs:");
            const rematchBody = new FormData();
            rematchBody.set("prId", prCase1.prId);
            const rematch = await callServerAction({
                pageUrl: pageFor(prCase1.prId),
                actionId,
                args: [null, rematchBody],
                cookie: ownerCookie,
            });
            const rematchAfter = await stateOf(prCase1.id);
            show("reply", { status: rematch.status, refusal: rematch.refusal, redirect: rematch.redirect });
            show("after", rematchAfter);
            ok("    the identical call from the requester is not refused", rematch.refusal === null, rematch.refusal ?? "");
            ok(
                "    and the request the other account could not move is Withdrawn",
                rematchAfter.status === "Withdrawn" && typeof rematchAfter.withdrawnAt === "string",
                JSON.stringify(rematchAfter)
            );

            // The four rejections are only worth something if the control could
            // have failed the same way — so the run says out loud that one call
            // through this same harness did write.
            const controlAfter = await stateOf(prCase5.id);
            ok(
                "one of the five calls moved the base, so the other four not moving it means something",
                controlAfter.status === "Withdrawn" && typeof controlAfter.withdrawnAt === "string"
            );

            // The LAST statement of the branch that ran everything, per
            // _fixtures.mjs: an aborted run and a skipped one must both leave it
            // false, and setting it below the `else` would make the skip path
            // claim a full run.
            complete = true;
        }
    }
} catch (err) {
    pass = false;
    console.log(`  FAIL  the run threw: ${err.message}`);
    console.log(err.stack);
}

// ---------------------------------------------------------------------------
// Cleanup — the five requests leave the base inside this run.
// ---------------------------------------------------------------------------
console.log("");
console.log("Cleanup:");
const trackedIds = fixtures.ids("prs");
const teardown = await fixtures.teardown({ complete });
console.log(`  ${fixtures.describe(teardown)}`);
if (teardown.leaked.length > 0) {
    pass = false;
    console.log("  FAIL  fixtures were left on the base — a leak is 1, not 2");
}

// The evidence that they are gone is a read of each id, not the census: "found 0"
// is also what a query against the wrong field returns.
for (const id of trackedIds) {
    let gone = false;
    try {
        await base(TABLES.PURCHASE_REQUESTS).find(id);
    } catch {
        gone = true;
    }
    ok(`${id} is no longer on the base`, gone);
}

const code = !pass ? 1 : incomplete ? 2 : 0;
console.log(`\n${code === 0 ? "OK" : code === 2 ? "INCOMPLETE" : "FAILED"} — exit ${code}`);
process.exit(code);
