// The per-key lock's rejection path, and the auth token's single-use and expiry
// rules — credentialed (#174).
//
// WHY THIS FILE EXISTS. #174 retired five `test-*.js` scripts whose headers all
// said "TEMPORARY — NOT for commit" and which had been committed for a year. The
// issue's justification was that "what they check is covered by the offline tier
// or by a verify-*.mjs". MEASURED, THAT WAS FALSE for two things, so they moved
// here rather than being deleted with the rest:
//
//   1. `withKeyLock`'s REJECTION path — when a guarded call throws, does the lock
//      release and does the next queued call still run? `client.js`'s own comment
//      claims it ("each key's queue entry is built to always settle"), and
//      nothing verified it. `verify-materials-cache-18.mjs` exercises the lock
//      and `_debugLockKeys`, but only along the SUCCESS path.
//   2. `consumeAuthToken`'s refusals — a second consume of the same token, an
//      unknown token, and an expired token. `consumeAuthToken` is imported by no
//      other verification script at all; `verify-authz.mjs` mints a token and
//      lets `/api/auth/verify` consume it ONCE, and
//      `verify-formula-escaping-159.mjs` says in its own header that it never
//      calls it. So the happy path was covered end to end and every refusal was
//      covered nowhere.
//
// The two are one subject rather than two: `consumeAuthToken` IS a `withKeyLock`
// call (`auth-token:<token>`), so Part A checks the mechanism and Part B checks
// the rule that rests on it.
//
// PART A IS PURE — no Airtable, deterministic through setTimeout — and would be
// better off in the offline tier. It is here because `withKeyLock` lives in
// `lib/airtable/client.js`, which throws at module load without credentials. A
// credentialed script has credentials, so it can import it today; offline is the
// ideal home, not the only one. CLAUDE.md records the client.js split as a
// standing follow-up and this does not wait on it.
//
// WHAT THIS DELIBERATELY DOES NOT COVER, so the "covered elsewhere" claim is not
// repeated in the other direction. The retired scripts also exercised the Phase 0
// create chain, every update function, `getLinkedRecords` ordering and
// `generateChildId` under `Promise.all`. Three of the five were failing on schema
// drift, so that coverage was already zero; the rest is named in #174's commit
// message rather than silently implied to be here.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-token-and-lock-174.mjs
//
// Fixtures: two Auth Tokens rows, deleted in this same run through
// scripts/tests/_fixtures.mjs (#171). Creates nothing in Vercel Blob and mints no
// session — a consumed token is not a session, and both rows are destroyed.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base,
// 2 clean but incomplete.

import { execSync } from "child_process";
import { base, TABLES, withKeyLock, _debugLockKeys } from "../../lib/airtable/client.js";
import { createAuthToken, consumeAuthToken, getAuthTokenRecord } from "../../lib/airtable/authTokens.js";
import { createFixtures } from "./_fixtures.mjs";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}

// Same block as verify-edit-log-fields-181.mjs and verify-invoice-ids-164.mjs
// (#172): a past run is only evidence if it can be tied to a tree.
function gitContext() {
    try {
        const head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
        const status = execSync("git status --porcelain", { encoding: "utf8" });
        const dirtyFiles = status.split("\n").filter((l) => l.trim().length > 0);
        return { head, dirty: dirtyFiles.length > 0, dirtyCount: dirtyFiles.length };
    } catch (err) {
        return { head: "unknown", dirty: null, error: String(err?.message ?? err) };
    }
}

const git = gitContext();
console.log("=".repeat(72));
console.log("verify-token-and-lock-174 — withKeyLock's rejection path, and token refusals");
console.log(`commit    ${git.head}`);
console.log(
    git.dirty === null
        ? `tree      unknown (${git.error})`
        : git.dirty
          ? `tree      DIRTY — ${git.dirtyCount} uncommitted file(s); the commit above does not identify what ran`
          : "tree      clean — the commit above identifies exactly what ran"
);
console.log(`ran at    ${new Date().toISOString()}`);
console.log("=".repeat(72));

const fixtures = createFixtures({
    tag: "V174",
    buckets: [{ name: "tokens", table: TABLES.AUTH_TOKENS, label: "Auth Token", tagField: "Email" }],
});
const TAG = fixtures.TAG;

let complete = false;
try {
    // -----------------------------------------------------------------------
    console.log("\nPart A — withKeyLock releases the lock when a guarded call throws (no Airtable)");
    // Three calls on ONE key, fired concurrently, the middle one rejecting. The
    // claim under test is client.js's own: a rejection must not wedge the queue.
    const key = `verify-174-${Date.now()}`;
    const order = [];

    // Outcomes captured by hand rather than with `Promise.allSettled`, which
    // offline/fixture-cleanup.mjs bans outright. That ban targets #171's real
    // defect — a cleanup loop whose settled results were discarded — and is
    // written as a blanket ban on the identifier, so a legitimate use like this
    // one trips it. Spelling the capture out is equivalent, keeps that check
    // undiluted, and says plainly that all three outcomes are inspected.
    const outcome = (promise) =>
        promise.then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason })
        );

    const [first, failing, third] = await Promise.all([
        outcome(withKeyLock(key, async () => {
            order.push("A-start");
            await new Promise((resolve) => setTimeout(resolve, 50));
            order.push("A-end");
            return "A-result";
        })),
        outcome(withKeyLock(key, async () => {
            order.push("B-start");
            throw new Error("deliberate test failure");
        })),
        outcome(withKeyLock(key, async () => {
            order.push("C-start");
            await new Promise((resolve) => setTimeout(resolve, 20));
            order.push("C-end");
            return "C-result";
        })),
    ]);

    check(
        "strictly sequential — A finishes before B starts, B before C",
        JSON.stringify(order),
        JSON.stringify(["A-start", "A-end", "B-start", "C-start", "C-end"])
    );
    assert("the successful call is fulfilled with its own value", first.status === "fulfilled" && first.value === "A-result");
    assert(
        "the failing call rejects, and its error reaches ITS OWN caller rather than a neighbor",
        failing.status === "rejected" && failing.reason?.message === "deliberate test failure"
    );
    // THE POINT OF PART A. Without this, a thrown error would leave the key's
    // promise chain permanently pending and every later call on that key would
    // hang — silently, since nothing times out.
    assert(
        "the call queued AFTER the rejection still runs — the lock was released",
        third.status === "fulfilled" && third.value === "C-result"
    );
    // Key-specific on purpose: CLAUDE.md notes that `_debugLockKeys()` is a
    // PROCESS-GLOBAL count, so asserting its length would be a claim about
    // everything else running concurrently. Asking whether THIS key is gone is
    // local and stays true regardless.
    assert("and the key's queue entry is gone once the chain drains", !_debugLockKeys().includes(key));

    // -----------------------------------------------------------------------
    console.log("\nPart B — a token is single-use, and an expired one is refused");
    const goodEmail = `${TAG}-first@hyeusa.com`;
    const { token } = await createAuthToken(goodEmail);
    assert("createAuthToken returns a token string", typeof token === "string" && token.length > 0);

    // Through the production reader rather than a hand-built filterByFormula: the
    // retired script interpolated `{Token} = "${token}"` raw, which is the exact
    // shape #159 exists to prevent. getAuthTokenRecord escapes.
    const goodRecord = await getAuthTokenRecord(token);
    assert("the row is findable by its token", goodRecord !== null);
    if (goodRecord) fixtures.track("tokens", goodRecord.id);

    const firstConsume = await consumeAuthToken(token);
    check("the first consume succeeds and returns the email it was issued for", firstConsume?.email, goodEmail);

    // THE REFUSAL NOTHING ELSE CHECKED. A magic link that works twice is a magic
    // link that can be replayed out of a mail archive.
    check("a SECOND consume of the same token is refused", await consumeAuthToken(token), null);
    check("an unknown token is refused", await consumeAuthToken("this-token-does-not-exist"), null);

    // Expiry, on a token that was never used — so this cannot pass by way of the
    // Used flag the check above just set.
    const expiredEmail = `${TAG}-expired@hyeusa.com`;
    const { token: expiredToken } = await createAuthToken(expiredEmail);
    const expiredRecord = await getAuthTokenRecord(expiredToken);
    assert("the second row is findable too", expiredRecord !== null);
    if (!expiredRecord) {
        incomplete = "the back-dated token row could not be read, so expiry was not exercised";
        console.log(`  SKIP  ${incomplete}`);
    } else {
        fixtures.track("tokens", expiredRecord.id);
        await base(TABLES.AUTH_TOKENS).update(expiredRecord.id, {
            "Expires At": new Date(Date.now() - 60 * 1000).toISOString(),
        });
        check("still unused before the attempt", (await getAuthTokenRecord(expiredToken)).get("Used") === true, false);
        check("an expired token is refused even though it was never used", await consumeAuthToken(expiredToken), null);
    }

    complete = true;
} catch (err) {
    // `pass`, not `incomplete`: an abort is a check that did not run, which is not
    // the same as one that ran and passed. Cleanup below runs either way.
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(60));
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
