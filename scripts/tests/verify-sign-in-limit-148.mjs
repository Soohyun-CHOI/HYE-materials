// How often a sign-in email may be asked for (#148) — what only the live base and
// the running app can answer.
//
// WHY THIS FILE EXISTS. `offline/sign-in-limit.mjs` calls the judgment and reads the
// wiring, and neither reaches Airtable: a formula is outside the offline tier
// entirely, and the count is only as good as the read behind it. Three things rest
// on the base and on the route, and this measures them:
//
//   1. THE READ RETURNS THE ROWS IT SHOULD (Part B). The rows of the last day that
//      share the request's mailbox or its IP — another case and another `+` tag of
//      one address among them — and not a row a script minted, which carries no
//      `IP Hash`, nor one older than the window. Newest first, with what each shares.
//   2. A ROW IS SEEN BY THE NEXT REQUEST'S READ (Part C). A request counts the rows
//      earlier requests made, so a row made a moment ago has to be in the next read.
//      Every field the read filters on is written in the create, which is why it
//      should be; this is where that is measured rather than argued.
//   3. THE ROUTE COUNTS THE IP VERCEL SENDS AND REFUSES WITH WHEN TO TRY AGAIN
//      (Parts D and E). A POST over the mailbox's ten-minute ceiling, and one over the
//      IP's day, each answered 429 with the time the rows say, a `Retry-After`, and no
//      row made — which is also why no email went. Part E is the one place the header
//      is shown to reach the hash: its rows share only the IP the POST names in
//      `x-forwarded-for`, so a route that read nothing, or read it differently, would
//      not refuse it.
//
// THE HEADER IS THE SCRIPT'S TO CHOOSE HERE AND NOWHERE DEPLOYED. `next dev` keeps an
// `x-forwarded-for` the client sent and fills it from the socket only when absent;
// Vercel overwrites it with the address that connected. So Parts D and E name IPs of
// their own — a /64 under the IPv6 documentation prefix, new every run, so a leaked
// row from an earlier run cannot be counted by this one.
//
// SEEDED ROWS. A ceiling is reached by rows that are already there, so Parts D and E
// make the rows a ceiling counts and then ask once. The first of each set goes through
// `createAuthToken`, which is what gives it its `IP Hash`; the rest copy that hash and
// are created ten to a request, which is what keeps the run near forty operations.
// Nothing is mailed: a refused request makes no row and sends nothing, and a route that
// failed to refuse would send to an address on the company's domain that no inbox
// holds — at most one email per part, which is the run's worst case.
//
// Run from the repo root, with the branch's dev server on BASE_URL (default
// http://localhost:3000):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-sign-in-limit-148.mjs
//
// Fixtures: about seventy `Auth Tokens` rows, tagged in `Email` and deleted in this
// same run through scripts/tests/_fixtures.mjs (#171). Mints no session.
//
// Exit codes: 0 all clear, 1 something failed OR this run left rows on the base,
// 2 clean but incomplete.

import { base, TABLES } from "../../lib/airtable/client.js";
import { createAuthToken, getRecentSignInRows } from "../../lib/airtable/authTokens.js";
import { prefixMatch } from "../../lib/airtableFormula.js";
import { snapshot } from "../../lib/airtableOps.js";
import { ipKeyOf, mailboxOf, SIGN_IN_LOOKBACK_MS } from "../../lib/signInLimit.js";
import { createFixtures } from "./_fixtures.mjs";
import { DEFAULT_BASE_URL } from "./_liveApp.mjs";
import { printProvenance } from "./_provenance.mjs";

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

printProvenance({ title: "verify-sign-in-limit-148 — the read behind #148's ceilings, and the route that holds a request to them" });

const DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;
const fixtures = createFixtures({
    tag: "V148",
    buckets: [{ name: "tokens", table: TABLES.AUTH_TOKENS, label: "Auth Token", tagField: "Email" }],
});
const TAG = fixtures.TAG;

/** An address on the company's domain that starts with this run's tag. */
const address = (suffix) => `${TAG}-${suffix}@${DOMAIN}`;

/** An IPv6 address in a /64 of this run's own, one /64 per `n`. */
const RUN = Date.now();
const ipOf = (n) => `2001:db8:${((RUN >>> 16) & 0xffff).toString(16)}:${((RUN & 0xfff0) + n).toString(16)}::7`;

const since = () => new Date(Date.now() - SIGN_IN_LOOKBACK_MS).toISOString();
const flags = (rows) => JSON.stringify(rows.map((r) => [r.mailbox, r.ip]));

/**
 * `count` rows a ceiling will count: the first made by `createAuthToken`, the rest
 * copying its `IP Hash` and created ten to a request. Returns the rows' Created At,
 * oldest first.
 */
async function seedRows(count, { emailOf, ipKey }) {
    const first = await createAuthToken(emailOf(0), { ipKey });
    fixtures.track("tokens", first.recordId);
    const firstRow = await base(TABLES.AUTH_TOKENS).find(first.recordId);
    const times = [firstRow.get("Created At")];
    const ipHash = firstRow.get("IP Hash");
    const rows = [];
    for (let i = 1; i < count; i++) {
        const now = new Date();
        rows.push({
            fields: {
                Token: `${TAG}-seed-${i}-${now.getTime()}`,
                Email: emailOf(i),
                Mailbox: mailboxOf(emailOf(i)),
                "IP Hash": ipHash,
                "Code Attempts": 0,
                Used: false,
                "Created At": now.toISOString(),
                "Expires At": new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
            },
        });
    }
    for (let i = 0; i < rows.length; i += 10) {
        const made = await base(TABLES.AUTH_TOKENS).create(rows.slice(i, i + 10));
        for (const record of made) {
            fixtures.track("tokens", record.id);
            times.push(record.get("Created At"));
        }
    }
    return times.sort();
}

/** Ask the running app for an email, from `ip`. */
async function askForEmail(email, ip) {
    const res = await fetch(`${DEFAULT_BASE_URL}/api/auth/request`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email }),
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, retryAfter: res.headers.get("retry-after"), body };
}

/** Rows whose Email starts with `prefix` — the census that says no row was made. */
async function rowsStartingWith(prefix) {
    return base(TABLES.AUTH_TOKENS).select({ filterByFormula: prefixMatch("Email", prefix) }).all();
}

let complete = false;
try {
    if (!DOMAIN) throw new Error("ALLOWED_EMAIL_DOMAIN is required — run with --env-file=.env.local");

    // -----------------------------------------------------------------------
    console.log("\nPart A — the two fields exist as the code writes them");
    const schemaRes = await fetch(`https://api.airtable.com/v0/meta/bases/${process.env.AIRTABLE_BASE_ID}/tables`, {
        headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` },
    });
    const schema = await schemaRes.json();
    const table = schema.tables?.find((t) => t.name === TABLES.AUTH_TOKENS);
    for (const name of ["Mailbox", "IP Hash"]) {
        check(`Auth Tokens."${name}" is a singleLineText`, table?.fields.find((f) => f.name === name)?.type, "singleLineText");
    }

    // -----------------------------------------------------------------------
    console.log("\nPart B — the read returns the rows of the last day that share the mailbox or the IP");
    const ipA = ipKeyOf(ipOf(1));
    const ipB = ipKeyOf(ipOf(2));
    const shareBoth = await createAuthToken(address("b"), { ipKey: ipA });
    fixtures.track("tokens", shareBoth.recordId);
    const otherCase = await createAuthToken(`${TAG}-B+tag@${DOMAIN.toUpperCase()}`, { ipKey: ipB });
    fixtures.track("tokens", otherCase.recordId);
    const shareIp = await createAuthToken(address("c"), { ipKey: ipA });
    fixtures.track("tokens", shareIp.recordId);
    const minted = await createAuthToken(address("b"));
    fixtures.track("tokens", minted.recordId);
    const old = await createAuthToken(address("b"), { ipKey: ipA });
    fixtures.track("tokens", old.recordId);
    await base(TABLES.AUTH_TOKENS).update([
        { id: old.recordId, fields: { "Created At": new Date(Date.now() - SIGN_IN_LOOKBACK_MS - 60 * 60 * 1000).toISOString() } },
    ]);

    const opsBeforeRead = snapshot().total;
    const rows = await getRecentSignInRows({ email: address("b"), ipKey: ipA, since: since() });
    check("one read is one operation", snapshot().total - opsBeforeRead, 1);
    check("three rows: the minted one and the day-old one are left out", rows.length, 3);
    check(
        "newest first, each saying what it shares — the IP, then the other case and tag, then both",
        flags(rows),
        JSON.stringify([
            [false, true],
            [true, false],
            [true, true],
        ])
    );
    assert(
        "  and their times run newest first",
        rows.every((row, i) => i === 0 || Date.parse(rows[i - 1].createdAt) >= Date.parse(row.createdAt))
    );
    const bothRow = await base(TABLES.AUTH_TOKENS).find(shareBoth.recordId);
    check("a row stores its mailbox lowercased", bothRow.get("Mailbox"), mailboxOf(address("b")));
    assert("  and a hash of 32 hex digits, not the IP", /^[0-9a-f]{32}$/.test(bothRow.get("IP Hash") ?? ""));
    const mintedRow = await base(TABLES.AUTH_TOKENS).find(minted.recordId);
    check("a minted row carries no IP Hash", mintedRow.get("IP Hash") ?? "", "");

    // -----------------------------------------------------------------------
    console.log("\nPart C — a row made a moment ago is in the next read");
    const ipF = ipKeyOf(ipOf(3));
    const firstReads = [];
    for (let i = 1; i <= 5; i++) {
        const made = await createAuthToken(address("f"), { ipKey: ipF });
        fixtures.track("tokens", made.recordId);
        const seen = await getRecentSignInRows({ email: address("f"), ipKey: ipF, since: since() });
        firstReads.push(seen.length);
    }
    check("five creates, each read back at once", firstReads.join(","), "1,2,3,4,5");

    // -----------------------------------------------------------------------
    console.log("\nPart D — the route refuses a mailbox at its ten-minute ceiling");
    const reachable = await fetch(`${DEFAULT_BASE_URL}/login`).then(
        (res) => res.ok,
        () => false
    );
    if (!reachable) {
        incomplete = `the dev server did not answer at ${DEFAULT_BASE_URL}, so Parts D and E did not run`;
        console.log(`  SKIP  ${incomplete}`);
    } else {
        const dTimes = await seedRows(11, { emailOf: () => address("d"), ipKey: ipKeyOf(ipOf(4)) });
        const asked = await askForEmail(`${TAG}-D+walk@${DOMAIN.toUpperCase()}`, ipOf(5));
        check("another case and tag of the mailbox, from another IP: 429", asked.status, 429);
        check("  saying it is limited", asked.body?.limited, true);
        check(
            "  until the oldest of the eleven is ten minutes old",
            asked.body?.retryAt,
            new Date(Date.parse(dTimes[0]) + 10 * 60 * 1000).toISOString()
        );
        check("  and nothing else", Object.keys(asked.body ?? {}).sort().join(","), "limited,retryAt");
        const dAfter = Number(asked.retryAfter);
        assert("  with a Retry-After of at most ten minutes", Number.isInteger(dAfter) && dAfter >= 1 && dAfter <= 600);
        check("  and no row made for it", (await rowsStartingWith(`${TAG}-D+walk`)).length, 0);

        // -------------------------------------------------------------------
        console.log("\nPart E — the route counts the IP it is sent, and refuses it at its day's ceiling");
        const ipE = ipOf(6);
        const eTimes = await seedRows(50, { emailOf: (i) => address(`e${i}`), ipKey: ipKeyOf(ipE) });
        const fresh = await askForEmail(address("e-fresh"), ipE);
        check("a mailbox nobody has asked for, from that IP: 429", fresh.status, 429);
        check(
            "  until the oldest of the fifty is a day old",
            fresh.body?.retryAt,
            new Date(Date.parse(eTimes[0]) + SIGN_IN_LOOKBACK_MS).toISOString()
        );
        check("  and no row made for it", (await rowsStartingWith(address("e-fresh"))).length, 0);
    }

    complete = true;
} catch (err) {
    pass = false;
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
}

// ---------------------------------------------------------------------------
console.log(`\n  This run's own reads and writes before cleanup: ${snapshot().total} Airtable operations.`);
console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });

console.log("\n" + "=".repeat(60));
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS");
console.log(fixtures.describe(teardown));
process.exit(!pass || teardown.leaked.length > 0 ? 1 : incomplete ? 2 : 0);
