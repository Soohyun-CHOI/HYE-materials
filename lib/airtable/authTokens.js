/**
 * `Auth Tokens` — one row per sign-in email, spent by its link or by its code.
 *
 * TWO WAYS INTO ONE ROW SINCE #471, AND THEY END IT TOGETHER. The email carries a
 * link, which signs in whichever browser opens it (#203's confirmation, then
 * `POST /api/auth/verify`), and a six-digit code, which signs in only the browser
 * that asked for the email: `lib/session.js` seals that row's record id into the
 * asking browser, and `consumeAuthCode` reaches the row through nothing else. So
 * the two consume functions below take ONE lock key per row and end the row with
 * ONE write, and whichever arrives second finds `Used` already set. Where the
 * judgment of a row's life lives is `lib/authTokenState.js`.
 *
 * WHAT THE CODE'S FIVE TRIES DO NOT BOUND, AND WHAT DOES. Every request for an email
 * makes a fresh row with a fresh code and five fresh tries, so the guesses at one
 * address are five times the emails sent to it — each a 1-in-200,000 chance, with the
 * address's owner receiving every one. #471 built no request limit of its own; #148's
 * ceilings are what bound the emails, counted over these rows by the `Mailbox` and
 * `IP Hash` every request writes (`lib/signInLimit.js`).
 *
 * THE FIVE ARE EXACT WITHIN ONE PROCESS AND BEST-EFFORT ACROSS TWO. `withKeyLock`
 * serializes attempts on one row inside one process, and each re-reads the count
 * under the lock. Airtable has no atomic increment, so two attempts landing on two
 * instances at once can read the same count and each get a comparison — the
 * cross-invocation window `docs/notes/airtable-access.md` records for every lock in
 * this app. The ceiling on that is the base's own rate, about five requests a
 * second shared by everything, against three operations an attempt: at worst about
 * 1,500 comparisons over a row's fifteen minutes, roughly 0.15%, while every other
 * screen waits. No distributed lock is built for it, and the order of the write is
 * what keeps the window from widening further — see `consumeAuthCode`.
 *
 * THE CODE IS STORED AS IT IS, BESIDE A TOKEN STORED AS IT IS, AND THAT PAIRING IS
 * THE CONDITION. Anyone who can read this table can already sign in with the
 * token, which works from any browser, so hashing the code alone would protect
 * nothing; and an unkeyed hash of six digits is reversed by trying a million
 * values. **The day the token is stored hashed, the code must be too — and with a
 * key, not a bare hash.** `docs/notes/authorization.md` has the comparison.
 */

import crypto from "crypto";
import { base, findByRecordIds, TABLES, withKeyLock } from "./client";
import { formulaString } from "../airtableFormula";
import {
    afterAttempt,
    CODE_LENGTH,
    CODE_STATES,
    describeCode,
    isCodeShaped,
    isUsableToken,
    normalizeCode,
    precheckCode,
    TOKEN_TTL_MINUTES,
} from "../authTokenState";
import { mailboxOf, SIGN_IN_READ_PAGE } from "../signInLimit";

if (!process.env.SESSION_SECRET) {
    throw new Error("Missing SESSION_SECRET in environment variables");
}

/**
 * The key `IP Hash` is made with (#148): derived from the session secret under a label
 * of its own, so it is not the key that seals a cookie and no new variable has to be
 * set wherever the app runs. A keyed hash rather than a bare one, because there are only
 * four billion IPv4 addresses and anybody who can read the table could try them all.
 * Rotating the secret starts every per-IP count again, which costs nothing a day does
 * not.
 */
const IP_HASH_KEY = Buffer.from(crypto.hkdfSync("sha256", process.env.SESSION_SECRET, "", "Auth Tokens IP Hash", 32));

/** What a row stores for the IP a request came from: never the address itself. */
function ipHashOf(ipKey) {
    return crypto.createHmac("sha256", IP_HASH_KEY).update(ipKey).digest("hex").slice(0, 32);
}

/**
 * Issues a new sign-in row for an email: the token its link carries and the code
 * beside it. Doesn't invalidate any previously issued, still-unused rows for the
 * same email — each is independently single-use and expires on its own.
 *
 * #471 KEPT THAT, AND THE REASON IS WHAT RETIRING WOULD HAND OUT. Anyone can ask
 * for an email to any company address, so a request that ended the earlier rows
 * would let a stranger end somebody's sign-in in progress by asking for one more.
 * An earlier row's CODE stops working anyway, in the browser that asked again:
 * that browser's binding now names the newest row, and a code is checked against
 * that row alone, so a second live code never shares a guess with the first. Its
 * LINK goes on working until it expires, as it always did.
 *
 * THE CODE is six digits from `crypto.randomInt`, which rejects rather than folds
 * the values past a whole multiple of the range, so every code is equally likely;
 * it is drawn on its own rather than derived from the token or the clock.
 *
 * `Code Attempts` IS WRITTEN AS 0 RATHER THAN LEFT BLANK, so a field renamed or
 * deleted in the Airtable UI fails every request here, loudly, instead of reading
 * as an attempt count of nothing.
 *
 * AND THE ROW CARRIES WHAT #148's CEILINGS COUNT IT BY: its `Mailbox`, always, and the
 * hash of the IP that asked when `ipKey` names one. Only `lib/auth.js` names one, for a
 * row a request is about to email; a row a script mints for a session carries none,
 * sends no email, and so is left out of every count `getRecentSignInRows` makes.
 */
export async function createAuthToken(email, { ipKey } = {}) {
    const token = crypto.randomBytes(32).toString("hex");
    const code = String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

    const record = await base(TABLES.AUTH_TOKENS).create({
        Token: token,
        Code: code,
        "Code Attempts": 0,
        Email: email,
        Mailbox: mailboxOf(email),
        ...(ipKey ? { "IP Hash": ipHashOf(ipKey) } : {}),
        "Expires At": expiresAt.toISOString(),
        Used: false,
        "Created At": now.toISOString(),
    });

    return { token, code, recordId: record.id, email, expiresAt: expiresAt.toISOString() };
}

/**
 * The rows made since `since` that share a request's mailbox or its IP (#148) — the one
 * read a request for an email costs before it makes a row. Each comes back as
 * `{ createdAt, mailbox, ip }`, the flags saying which of the two it shares, so the
 * judgment in `lib/signInLimit.js` counts them without ever holding a hash.
 *
 * ONLY ROWS THAT CARRY AN `IP Hash`, which is every row a request made and none a script
 * minted (see `createAuthToken`). Older rows carry neither field and fall outside every
 * window anyway.
 *
 * ONE PAGE, NEWEST FIRST. `SIGN_IN_READ_PAGE` is set so that a full page already holds a
 * ceiling's worth, so the request costs one read however many rows match.
 *
 * WHY A ROW MADE A MOMENT EARLIER IS SEEN, which the count rests on: every field this
 * filters on is written in the call that creates the row, and none is computed by
 * Airtable. A lookup or a formula can be briefly invisible to a filter right after its
 * row is written (`client.js:getLinkedRecords`); a written field is not, which is the
 * same thing `lib/ids.js:mintDailyIds` relies on to see the day's last id. Were one
 * missed, the cost is one email past a ceiling, never a refusal that should not be.
 */
export async function getRecentSignInRows({ email, ipKey, since }) {
    const mailbox = mailboxOf(email);
    const ipHash = ipHashOf(ipKey);
    const records = await base(TABLES.AUTH_TOKENS)
        .select({
            filterByFormula: `AND(IS_AFTER({Created At}, "${formulaString(since)}"), {IP Hash} != "", OR({Mailbox} = "${formulaString(mailbox)}", {IP Hash} = "${formulaString(ipHash)}"))`,
            fields: ["Mailbox", "IP Hash", "Created At"],
            sort: [{ field: "Created At", direction: "desc" }],
            pageSize: SIGN_IN_READ_PAGE,
        })
        .firstPage();

    return records.map((record) => ({
        createdAt: record.get("Created At"),
        mailbox: record.get("Mailbox") === mailbox,
        ip: record.get("IP Hash") === ipHash,
    }));
}

/**
 * Look a token up by its value. THE most exposed formula interpolation in the
 * app and the reason #159 exists: `token` arrives raw from an unauthenticated
 * caller — since #203 as a query param on the public /login/confirm page and as
 * a form field on the public POST /api/auth/verify, both by design, with no
 * session and no role in front of either. Splitting the flow in two did not
 * narrow this surface; it widened it by one entry point, and the GET half is
 * now the one a mail security scanner reaches unprompted. Without the escape,
 * `" & {Token} & "` turns this
 * predicate into `{Token} = {Token}`, true for every row, and `maxRecords: 1`
 * then returns an ARBITRARY token record instead of none. Measured read-only on
 * the live base (#159): it returned the table's first row, out of 46.
 *
 * consumeAuthToken below is why that matters. It takes whatever row came back,
 * and if that row happens to be unused and unexpired it returns its `Email` —
 * a session as whoever the row belongs to, for a caller who supplied no valid
 * token at all. The row is not attacker-chosen, so this is not a reliable
 * takeover; it is an unauthenticated lottery over a table of live tokens, and
 * that is not a distinction worth relying on.
 *
 * WHY THIS IS EXPORTED, since it was module-private until #159 and the next
 * reader will reasonably ask. `scripts/tests/verify-formula-escaping-159.mjs`
 * has to exercise THIS lookup, not a copy of it: re-typing the formula in the
 * check is the mirror test #147 deleted, which passes with the fix removed. So
 * the export exists to make the check honest.
 *
 * What the export does and does not widen:
 *   - It is a `.select()` and nothing else. No create, no update, no destroy, so
 *     it adds no write path. `spendAuthToken` below remains the ONLY thing that
 *     writes `Used: true`, and the two consume functions that call it are the only
 *     things that return an `Email` for a session to be built from.
 *   - It cannot mint a session. It returns an Airtable record; turning one into
 *     a session needs a consume function plus lib/session.js.
 *   - Reach is server-side only, like every other lib/airtable export:
 *     AIRTABLE_API_KEY is server-side and this module is never in the client
 *     bundle. So the new capability is "other server code in this repo can ask
 *     whether a token row exists, without consuming it".
 *   - Callers: consumeAuthToken below; `app/login/confirm/page.js`, which reads a
 *     row to say whether its link is still good and must never consume it (#203,
 *     held by `offline/source-shape.mjs`); and two credentialed checks,
 *     `verify-formula-escaping-159.mjs` and `verify-token-and-lock-174.mjs`. This
 *     list said the callers were exactly two and that no page imported it, which
 *     stopped being true when #203 put the confirmation page on it.
 *
 * Note that `scripts/tests/offline/authz-structure.mjs` does NOT cover this.
 * It scans app/ and lib/, but only enumerates the exports of route.js files under
 * app/api/ and of files carrying a top-level "use server" — this module is neither,
 * so a new export here is not an endpoint in that inventory and nothing there
 * has to be updated. That is correct rather than a gap: the export is not
 * directly callable by a client. If this module ever gains a "use server"
 * directive, every export in it becomes an endpoint and that check will start
 * demanding a wrapper or an exemption for each.
 */
export async function getAuthTokenRecord(token) {
    const records = await base(TABLES.AUTH_TOKENS)
        .select({
            filterByFormula: `{Token} = "${formulaString(token)}"`,
            maxRecords: 1,
        })
        .firstPage();

    return records.length === 0 ? null : records[0];
}

/**
 * A row by its record id, and only a row of THIS table (#471). The id comes from
 * the binding `lib/session.js` sealed, so nobody outside the server can choose it;
 * it is read through `findByRecordIds` anyway, whose `RECORD_ID()` select answers
 * nothing for another table's id, where `find()` would hand that row back (#440).
 */
async function getAuthTokenRecordById(recordId) {
    if (typeof recordId !== "string" || recordId.length === 0) return null;
    const [record] = await findByRecordIds(TABLES.AUTH_TOKENS, [recordId]);
    return record ?? null;
}

/**
 * The one lock both ways into a row take (#471). Keyed on the row's TOKEN because
 * that is what the link carries; the code path reads the row first to learn it.
 * Two keys for one row would let a link and a code that arrive together each see
 * the row unused, and each start a session from it.
 */
const rowLockKey = (token) => `auth-token:${token}`;

/**
 * The write that ends a row, whichever way reached it (#471). The code's attempt
 * count rides in the same write, so a spent code has counted its own attempt too.
 */
async function spendAuthToken(record, alongside = {}) {
    await base(TABLES.AUTH_TOKENS).update([{ id: record.id, fields: { ...alongside, Used: true } }]);
    return { email: record.get("Email") };
}

/**
 * Validates and consumes a token in one step: returns null if the token
 * doesn't exist, was already used, or has expired; otherwise marks it used
 * and returns the email it was issued for.
 *
 * Wrapped in a per-row lock (withKeyLock) so the same row can't be spent twice
 * by two near-simultaneous requests — same read-then-write race as
 * generateChildId/upsertMaterial, same fix. Since #471 the code path takes the
 * same key, so a link and a code racing for one row cannot both win either.
 *
 * THE VALIDITY RULE IS NOT HERE ANY MORE (#203). It is `isUsableToken` in
 * `lib/authTokenState.js`, because the confirmation page has to reach the same
 * verdict without consuming anything, and a second copy of three `if`s is a
 * second implementation of one judgment. This function still owns everything
 * that judgment is not: the lock, the read, the write, and the collapse of four
 * distinct refusals into one `null` — a caller consuming a token has no use for
 * WHICH way it was unusable, while the page that renders a message does.
 */
export async function consumeAuthToken(token) {
    return withKeyLock(rowLockKey(token), async () => {
        const record = await getAuthTokenRecord(token);
        const usable = isUsableToken({
            token,
            exists: Boolean(record),
            used: record?.get("Used") === true,
            expiresAt: record?.get("Expires At"),
        });
        if (!usable) return null;

        return spendAuthToken(record);
    });
}

/**
 * Constant-time, and only between two values shaped like a code, which is what
 * makes the lengths agree — `timingSafeEqual` throws on a length mismatch rather
 * than answering it.
 */
function codesMatch(given, stored) {
    if (!isCodeShaped(given) || !isCodeShaped(stored)) return false;
    return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(stored));
}

/**
 * Tries a typed code against the row this browser is waiting on (#471), and ends
 * the row when it matches. Returns `{ state }`, with `remaining` after a wrong one
 * and `email` after the right one; the states are `lib/authTokenState.js`'s.
 *
 * `recordId` IS THE BINDING'S, NEVER THE CALLER'S TO NAME. `lib/auth.js` reads it
 * out of the sealed cookie the request step wrote, so a code is checked against
 * the one row this browser asked for and no other — which is what makes a code
 * seen by somebody else worthless anywhere else, and a guess at one address
 * impossible to aim at a row its guesser did not request.
 *
 * THE CODE NEVER REACHES A FORMULA. The row is found by its id, so the base never
 * compares a code and nothing about a guess is interpolated anywhere; the one
 * comparison is `codesMatch`, in constant time.
 *
 * THE ATTEMPT IS WRITTEN BEFORE IT IS ANSWERED, IN THE SAME WRITE AS ITS OUTCOME.
 * A wrong code writes the count; the right one writes the count and `Used` through
 * `spendAuthToken`. Nothing is returned until that write has succeeded, so a count
 * that cannot be written — a field renamed or deleted in the Airtable UI — fails
 * the right code and the wrong one alike, rather than answering which it was while
 * counting nothing. That is why every attempt is counted and not only the wrong
 * ones: a right one that skipped the write would be the one answer given without
 * one.
 *
 * WHAT IS NOT AN ATTEMPT writes nothing: a value that cannot be a code, a browser
 * waiting for none, and a row that is gone, used, expired or locked — none of
 * those answers depends on what was typed.
 *
 * READ, LOCK, READ AGAIN. The first read is only for the row's token, which is the
 * lock key the link path takes; the judgment is made on the second read, inside
 * the lock, so it sees whatever an attempt or a link that held the lock before it
 * wrote.
 */
export async function consumeAuthCode(recordId, typed) {
    const given = normalizeCode(typed);
    const bound = typeof recordId === "string" && recordId.length > 0;
    const early = precheckCode({ given, bound });
    if (early) return { state: early };

    const found = await getAuthTokenRecordById(recordId);
    if (!found) return { state: describeCode({ given, bound, exists: false }) };

    return withKeyLock(rowLockKey(found.get("Token")), async () => {
        const record = await getAuthTokenRecordById(recordId);
        const stored = record?.get("Code");
        const attempts = Number(record?.get("Code Attempts") ?? 0);
        const state = describeCode({
            given,
            bound,
            exists: Boolean(record),
            stored,
            used: record?.get("Used") === true,
            expiresAt: record?.get("Expires At"),
            attempts,
            matches: codesMatch(given, stored),
        });
        if (state !== CODE_STATES.VALID && state !== CODE_STATES.WRONG) return { state };

        const outcome = afterAttempt({ attempts, matches: state === CODE_STATES.VALID });
        if (outcome.state === CODE_STATES.VALID) {
            return { ...outcome, ...(await spendAuthToken(record, { "Code Attempts": outcome.attempts })) };
        }
        await base(TABLES.AUTH_TOKENS).update([{ id: record.id, fields: { "Code Attempts": outcome.attempts } }]);
        return outcome;
    });
}
