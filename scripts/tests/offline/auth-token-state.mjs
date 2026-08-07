// Whether a magic-link token can still be used (#203) — every clause of
// lib/authTokenState.js, plus the one property the whole issue rests on.
//
// THE STATE FUNCTION IS PINNED HERE AND THE PAGE IS PINNED IN source-shape.mjs,
// and the two prove different things. This file proves the verdict is right; that
// one proves the confirmation page never CONSUMES while reaching it. Neither
// implies the other, and the second is the one a well-meaning simplification
// would undo.
//
// WHAT THIS CANNOT SEE: that Airtable's stored `Used` and `Expires At` are what
// the caller projects into these plain values, and that a GET really leaves the
// row alone. Both are run-time facts and live in the credentialed check.

import { isMain, standalone } from "./_harness.mjs";
import {
    CONFIRM_COPY,
    describeToken,
    isUsableToken,
    REQUEST_NEW_LINK,
    TOKEN_STATES,
    TOKEN_TTL_MINUTES,
} from "../../../lib/authTokenState.js";

export const title = "Magic-link token state — the five verdicts and their copy (#203)";

const NOW = Date.UTC(2026, 7, 7, 12, 0, 0);
const future = new Date(NOW + 5 * 60 * 1000).toISOString();
const past = new Date(NOW - 5 * 60 * 1000).toISOString();

const usable = { token: "abc", exists: true, used: false, expiresAt: future };

export function run({ check, assert, log }) {
    log("the five verdicts:");
    check("a fresh, unused, unexpired token is valid", describeToken(usable, NOW), TOKEN_STATES.VALID);
    check("no token at all is missing", describeToken({ ...usable, token: undefined }, NOW), TOKEN_STATES.MISSING);
    check("an empty token is missing", describeToken({ ...usable, token: "" }, NOW), TOKEN_STATES.MISSING);
    check("a non-string token is missing", describeToken({ ...usable, token: 42 }, NOW), TOKEN_STATES.MISSING);
    check("a token with no row is invalid", describeToken({ ...usable, exists: false }, NOW), TOKEN_STATES.INVALID);
    check("an already-used token is used", describeToken({ ...usable, used: true }, NOW), TOKEN_STATES.USED);
    check("a past expiry is expired", describeToken({ ...usable, expiresAt: past }, NOW), TOKEN_STATES.EXPIRED);
    // Called with no `now`, so it reads the clock — the shape every caller uses.
    check("the default clock still classifies", describeToken({ ...usable, expiresAt: past }), TOKEN_STATES.EXPIRED);

    // ── precedence ──────────────────────────────────────────────────────────
    // Only one pair is a real choice, and `used` wins: it says the link worked
    // once, where "expired" would suggest the reader was merely too slow.
    log("");
    log("precedence — used before expired, and absence before everything:");
    check(
        "used AND expired reports used",
        describeToken({ ...usable, used: true, expiresAt: past }, NOW),
        TOKEN_STATES.USED
    );
    check(
        "no token wins over a row that would have been used",
        describeToken({ token: "", exists: true, used: true, expiresAt: past }, NOW),
        TOKEN_STATES.MISSING
    );
    check(
        "a missing row wins over expiry",
        describeToken({ ...usable, exists: false, expiresAt: past }, NOW),
        TOKEN_STATES.INVALID
    );

    // ── the expiry boundary ─────────────────────────────────────────────────
    // Unchanged from what consumeAuthToken did before #203: expiry is
    // `expiresAt < now`, so the exact instant is still usable. Both sides of the
    // boundary are asserted, since a one-off here is invisible in normal use.
    log("");
    log("the boundary is exclusive, and both sides are checked:");
    check(
        "exactly at expiry is still valid",
        describeToken({ ...usable, expiresAt: new Date(NOW).toISOString() }, NOW),
        TOKEN_STATES.VALID
    );
    check(
        "one millisecond past expiry is expired",
        describeToken({ ...usable, expiresAt: new Date(NOW - 1).toISOString() }, NOW),
        TOKEN_STATES.EXPIRED
    );

    // ── failing closed on an unusable expiry ────────────────────────────────
    // A DELIBERATE TIGHTENING (#203). The old comparison was
    // `new Date(x).getTime() < Date.now()`, and `NaN < n` is false, so a row with
    // a blank or malformed `Expires At` never expired — a credential good
    // forever, from a field the Airtable UI can empty in one click.
    log("");
    log("an expiry that cannot be read is expired, not eternal:");
    for (const [label, value] of [
        ["blank", ""],
        ["absent", undefined],
        ["null", null],
        ["not a date", "whenever"],
    ]) {
        check(`${label} expiry is expired`, describeToken({ ...usable, expiresAt: value }, NOW), TOKEN_STATES.EXPIRED);
    }

    // ── isUsableToken agrees with describeToken, by construction ────────────
    log("");
    log("isUsableToken is exactly `state === valid`:");
    for (const [label, facts] of [
        ["valid", usable],
        ["missing", { ...usable, token: "" }],
        ["invalid", { ...usable, exists: false }],
        ["used", { ...usable, used: true }],
        ["expired", { ...usable, expiresAt: past }],
    ]) {
        check(
            `${label}`,
            isUsableToken(facts, NOW),
            describeToken(facts, NOW) === TOKEN_STATES.VALID
        );
    }
    // An unknown `used` value must not read as used — Airtable omits a false
    // checkbox, so `undefined` is the ordinary shape of "not used yet".
    check("an omitted `used` field reads as not used", describeToken({ ...usable, used: undefined }, NOW), TOKEN_STATES.VALID);

    // ── copy ────────────────────────────────────────────────────────────────
    log("");
    log("copy — one entry per state, and a control only where there is one:");
    const states = Object.values(TOKEN_STATES);
    check("every state has copy", states.every((s) => Boolean(CONFIRM_COPY[s]?.body)), true);
    check("and there are no extra entries", Object.keys(CONFIRM_COPY).length, states.length);
    check("only `valid` offers an action", Object.entries(CONFIRM_COPY).filter(([, c]) => c.action).map(([s]) => s).join(), TOKEN_STATES.VALID);
    // THE INSTRUCTION LIVES IN THE LINK, NOT IN THE BODIES. Asserted as an
    // absence, which is the direction that stays true as states are added: a body
    // repeating what the link under it already says is the duplication this
    // separation exists to make unrepeatable, and it is what the first version of
    // this copy did in three of four states while omitting it in the fourth.
    assert(
        "no refused body repeats the instruction the link carries",
        states
            .filter((s) => s !== TOKEN_STATES.VALID)
            .every((s) => !/request a new/i.test(CONFIRM_COPY[s].body))
    );
    assert("and the link is where it is said", /request a new sign-in link/i.test(REQUEST_NEW_LINK));
    // Each refused body still has to say something about the link's own state,
    // or it would be an empty box with a link under it.
    assert(
        "every refused body names the sign-in link's state",
        states.filter((s) => s !== TOKEN_STATES.VALID).every((s) => /sign-in link/i.test(CONFIRM_COPY[s].body))
    );

    // THE TTL IS NOT SPELLED IN PROSE. It was 15 in four places — the constant
    // plus three copy strings — so the expiry sentence now interpolates it and
    // changing the lifetime cannot leave a screen claiming the old one.
    log("");
    log("the lifetime is one number, interpolated rather than spelled:");
    check("TOKEN_TTL_MINUTES", TOKEN_TTL_MINUTES, 15);
    assert(
        "the expired message carries that number",
        CONFIRM_COPY[TOKEN_STATES.EXPIRED].body.includes(String(TOKEN_TTL_MINUTES))
    );

    // A verdict is never a scolding, and never says what the reader did wrong.
    assert(
        "no message blames the reader",
        states.every((s) => !/you (?:waited|failed|should)/i.test(CONFIRM_COPY[s].body))
    );
}

if (isMain(import.meta.url)) standalone(title, run);
