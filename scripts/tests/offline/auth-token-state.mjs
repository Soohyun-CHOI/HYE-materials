// Whether a sign-in row can still be used — by its link (#203) or by its code
// (#471) — every clause of lib/authTokenState.js, plus the one property each issue
// rests on.
//
// THE STATE FUNCTION IS PINNED HERE AND THE PAGE IS PINNED IN source-shape.mjs,
// and the two prove different things. This file proves the verdict is right; that
// one proves the confirmation page never CONSUMES while reaching it. Neither
// implies the other, and the second is the one a well-meaning simplification
// would undo. `sign-in-code.mjs` is the same split for the code: this file pins
// what a code attempt is judged to be, that one how the credentialed modules and
// the routes are shaped around the judgment.
//
// WHAT THIS CANNOT SEE: that Airtable's stored `Used`, `Expires At`, `Code` and
// `Code Attempts` are what the caller projects into these plain values, that a GET
// really leaves the row alone, and that a link and a code racing for one row end
// it once. All of those are run-time facts and live in the credentialed check,
// `verify-token-and-lock-174.mjs`.

import { isMain, standalone } from "./_harness.mjs";
import {
    afterAttempt,
    canTryAgain,
    CODE_COPY,
    CODE_LENGTH,
    CODE_STATES,
    CONFIRM_COPY,
    describeCode,
    describeToken,
    isCodeShaped,
    isUsableToken,
    MAX_CODE_ATTEMPTS,
    normalizeCode,
    precheckCode,
    REQUEST_NEW_LINK,
    SIGN_IN_COPY,
    TOKEN_STATES,
    TOKEN_TTL_MINUTES,
} from "../../../lib/authTokenState.js";
import { SIGN_IN_TITLE } from "../../../lib/productName.js";

export const title = "Sign-in state — the link's verdicts, the code's, and their copy (#203, #471)";

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

    runCode({ check, assert, log });
}

// ---------------------------------------------------------------------------
// The code (#471)
// ---------------------------------------------------------------------------

/** A code attempt that would succeed; every case below changes one fact of it. */
const goodAttempt = {
    given: "012345",
    bound: true,
    exists: true,
    stored: "012345",
    used: false,
    expiresAt: future,
    attempts: 0,
    matches: true,
};

function runCode({ check, assert, log }) {
    // ── the figures, as literals ────────────────────────────────────────────
    // Typed out rather than derived, so changing either is a change to this file
    // too: a check written in terms of the constant passes for any value it takes
    // (verification.md's #351 incident).
    log("");
    log("the code's figures, as literals:");
    check("CODE_LENGTH", CODE_LENGTH, 6);
    check("MAX_CODE_ATTEMPTS", MAX_CODE_ATTEMPTS, 5);

    // ── what a code is ──────────────────────────────────────────────────────
    log("");
    log("what counts as a code, after spaces are taken out:");
    check("a pasted `123 456` is one code", normalizeCode("123 456"), "123456");
    check("a trailing newline from a mail client goes too", normalizeCode(" 012345\n"), "012345");
    check("a non-string is nothing", normalizeCode(123456), "");
    for (const [label, value, want] of [
        ["six digits, a leading zero kept", "012345", true],
        ["five digits", "12345", false],
        ["seven digits", "1234567", false],
        ["a letter among digits", "12a456", false],
        ["full-width digits", "１２３４５６", false],
        ["a number rather than a string", 123456, false],
        ["empty", "", false],
        ["null", null, false],
    ]) {
        check(`  ${label}`, isCodeShaped(value), want);
    }

    // ── precedence ──────────────────────────────────────────────────────────
    log("");
    log("the code's verdicts, one fact changed at a time:");
    check("the right code on a live row is valid", describeCode(goodAttempt, NOW), CODE_STATES.VALID);
    check("a different code is wrong", describeCode({ ...goodAttempt, matches: false }, NOW), CODE_STATES.WRONG);
    check("a value that is not a code is malformed", describeCode({ ...goodAttempt, given: "12345" }, NOW), CODE_STATES.MALFORMED);
    check("a browser waiting for nothing is missing", describeCode({ ...goodAttempt, bound: false }, NOW), CODE_STATES.MISSING);
    check("a row that is gone is invalid", describeCode({ ...goodAttempt, exists: false }, NOW), CODE_STATES.INVALID);
    check("a row with no code is invalid", describeCode({ ...goodAttempt, stored: undefined }, NOW), CODE_STATES.INVALID);
    check("a spent row is used", describeCode({ ...goodAttempt, used: true }, NOW), CODE_STATES.USED);
    check("a row past its expiry is expired", describeCode({ ...goodAttempt, expiresAt: past }, NOW), CODE_STATES.EXPIRED);
    check("four attempts in, the fifth is still judged", describeCode({ ...goodAttempt, attempts: 4 }, NOW), CODE_STATES.VALID);
    check("five attempts in, the code is locked", describeCode({ ...goodAttempt, attempts: 5 }, NOW), CODE_STATES.LOCKED);
    // A COUNT NOBODY CAN READ IS NOT PERMISSION TO GUESS: the comparison is
    // `!(attempts < 5)`, which a NaN fails closed.
    check("an unreadable count is locked", describeCode({ ...goodAttempt, attempts: Number.NaN }, NOW), CODE_STATES.LOCKED);
    check("  and so is a missing one", describeCode({ ...goodAttempt, attempts: undefined }, NOW), CODE_STATES.LOCKED);

    log("");
    log("and the order between them:");
    check(
        "a malformed value is refused before anything about the browser",
        describeCode({ ...goodAttempt, given: "x", bound: false }, NOW),
        CODE_STATES.MALFORMED
    );
    check(
        "a browser waiting for nothing learns nothing about any row",
        describeCode({ ...goodAttempt, bound: false, used: true }, NOW),
        CODE_STATES.MISSING
    );
    // EITHER ONE FINISHES THE SAME REQUEST: a row the link has spent says `used`
    // whatever is typed, including the right code.
    check("a row the link spent refuses the right code as used", describeCode({ ...goodAttempt, used: true }, NOW), CODE_STATES.USED);
    check(
        "  and a locked code's row, once used, says used",
        describeCode({ ...goodAttempt, used: true, attempts: 5 }, NOW),
        CODE_STATES.USED
    );
    check(
        "an expired row says expired rather than locked",
        describeCode({ ...goodAttempt, expiresAt: past, attempts: 5 }, NOW),
        CODE_STATES.EXPIRED
    );
    check(
        "used AND expired reports used, as the link does",
        describeCode({ ...goodAttempt, used: true, expiresAt: past }, NOW),
        CODE_STATES.USED
    );
    check("a locked code refuses even the right one", describeCode({ ...goodAttempt, attempts: 5, matches: true }, NOW), CODE_STATES.LOCKED);
    check(
        "exactly at expiry the code still works",
        describeCode({ ...goodAttempt, expiresAt: new Date(NOW).toISOString() }, NOW),
        CODE_STATES.VALID
    );
    check(
        "  one millisecond past it does not",
        describeCode({ ...goodAttempt, expiresAt: new Date(NOW - 1).toISOString() }, NOW),
        CODE_STATES.EXPIRED
    );
    check("an expiry that cannot be read is expired", describeCode({ ...goodAttempt, expiresAt: "" }, NOW), CODE_STATES.EXPIRED);

    // ── one judgment of the row's life, read two ways ───────────────────────
    // The link and the code spend ONE row, so on every combination of the two
    // facts that decide its life they must agree — a second implementation of
    // `used before expired` would pass every case above while disagreeing here.
    log("");
    log("the link and the code judge the row's life the same way:");
    let agreements = 0;
    for (const used of [false, true]) {
        for (const expiresAt of [future, past, new Date(NOW).toISOString(), "", undefined, "whenever"]) {
            const link = describeToken({ token: "abc", exists: true, used, expiresAt }, NOW);
            const code = describeCode({ ...goodAttempt, used, expiresAt }, NOW);
            if (link === code) agreements += 1;
            else assert(`  used=${used}, expiresAt=${JSON.stringify(expiresAt)}: link ${link}, code ${code}`, false);
        }
    }
    check("every combination agrees", agreements, 12);
    assert(
        "the row's three verdicts are the token's own values, not look-alikes",
        CODE_STATES.VALID === TOKEN_STATES.VALID &&
            CODE_STATES.USED === TOKEN_STATES.USED &&
            CODE_STATES.EXPIRED === TOKEN_STATES.EXPIRED
    );

    // ── what is decided before the row is read ──────────────────────────────
    log("");
    log("what is refused before any read, and only that:");
    check("a non-code first", precheckCode({ given: "12", bound: false }), CODE_STATES.MALFORMED);
    check("  then a browser waiting for nothing", precheckCode({ given: "012345", bound: false }), CODE_STATES.MISSING);
    check("  and otherwise nothing yet", precheckCode({ given: "012345", bound: true }), null);

    // ── an attempt's outcome ────────────────────────────────────────────────
    // The count is every attempt, the right one included, and it is written with
    // the outcome — `lib/airtable/authTokens.js` says why.
    log("");
    log("five tries, and the fifth wrong one ends the code:");
    const walked = [];
    let attempts = 0;
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
        const outcome = afterAttempt({ attempts, matches: false });
        walked.push(`${outcome.state}:${outcome.remaining}`);
        attempts = outcome.attempts;
    }
    check("five wrong codes in a row", walked.join(" "), "wrong:4 wrong:3 wrong:2 wrong:1 locked:0");
    check("  leave a count of five", attempts, 5);
    check("  after which the row reads as locked", describeCode({ ...goodAttempt, attempts }, NOW), CODE_STATES.LOCKED);
    const right = afterAttempt({ attempts: 4, matches: true });
    check("the right code on the fifth try works", right.state, CODE_STATES.VALID);
    check("  and counts itself", right.attempts, 5);

    log("");
    log("which refusals leave something to try:");
    for (const state of Object.values(CODE_STATES)) {
        const want = state === CODE_STATES.MALFORMED || state === CODE_STATES.WRONG;
        check(`  ${state}`, canTryAgain(state), want);
    }

    // ── the code step's words ───────────────────────────────────────────────
    log("");
    log("the code step's words — one per refusal, and none for success:");
    const refusals = Object.values(CODE_STATES).filter((s) => s !== CODE_STATES.VALID);
    const sentence = (s) => (typeof CODE_COPY[s] === "function" ? CODE_COPY[s](2) : CODE_COPY[s]);
    check("every refusal has a sentence", refusals.filter((s) => !sentence(s)).join(), "");
    check("  and success has none — it says so by arriving (#321)", CODE_COPY[CODE_STATES.VALID], undefined);
    check("  and there are no extra entries", Object.keys(CODE_COPY).length, refusals.length);
    check("a missing browser and a missing row say one thing", CODE_COPY[CODE_STATES.MISSING], CODE_COPY[CODE_STATES.INVALID]);
    check("one try left is singular", CODE_COPY[CODE_STATES.WRONG](1), "That code does not match. 1 try left.");
    check("  two are plural", CODE_COPY[CODE_STATES.WRONG](2), "That code does not match. 2 tries left.");
    // THE INSTRUCTION LIVES IN THE CONTROL, as the confirmation's does: every
    // refused sentence stands over `Send a new email`, so none of them says it.
    assert(
        "no refused sentence repeats what the control under it says",
        refusals.every((s) => !/new email|send a new|request a new/i.test(sentence(s)))
    );
    assert("  and the control is where it is said", /send a new email/i.test(SIGN_IN_COPY.code.resend));
    assert(
        "the figures in the sentences are interpolated, not spelled",
        CODE_COPY[CODE_STATES.MALFORMED].includes(String(CODE_LENGTH)) &&
            CODE_COPY[CODE_STATES.LOCKED].includes(String(MAX_CODE_ATTEMPTS)) &&
            CODE_COPY[CODE_STATES.EXPIRED].includes(String(TOKEN_TTL_MINUTES))
    );
    assert(
        "no code sentence blames the reader",
        refusals.every((s) => !/you (?:waited|failed|should|typed|entered)/i.test(sentence(s)))
    );
    // `used` has to name both, because the row does not say which one spent it.
    assert("a spent row's sentence names the link as well as the code", /code/i.test(sentence(CODE_STATES.USED)) && /link/i.test(sentence(CODE_STATES.USED)));
    // The step's instruction names the confirmation's button by its constant.
    const confirmAction = CONFIRM_COPY[TOKEN_STATES.VALID].action;
    assert(`the code step names ${confirmAction} for the link`, SIGN_IN_COPY.code.how.includes(confirmAction));
    assert("  and the lifetime by its constant", SIGN_IN_COPY.code.how.includes(`${TOKEN_TTL_MINUTES} minutes`));
    check("the step names the address it sent to", SIGN_IN_COPY.code.sent("soo@example.com"), "We sent a sign-in link and a code to soo@example.com.");

    // ── the email ───────────────────────────────────────────────────────────
    log("");
    log("the email carries the code, the link and the words the screens use:");
    check("its subject is the sign-in line (#201)", SIGN_IN_COPY.mail.subject, SIGN_IN_TITLE);
    const html = SIGN_IN_COPY.mail.html({
        confirmUrl: "https://portal.example.com/login/confirm?token=abc&destination=%2Ftool-items%2FX",
        code: "012345",
    });
    assert("it carries the code, leading zero and all", html.includes(">012345<"));
    check("it carries one link", [...html.matchAll(/href="/g)].length, 1);
    assert("  with its separator escaped", html.includes("token=abc&amp;destination="));
    assert(`it names ${confirmAction}, from the confirmation's own constant`, html.includes(confirmAction));
    assert("it states the lifetime from the constant", html.includes(`${TOKEN_TTL_MINUTES} minutes`));
    // THE MUTANT #290 WAS ABOUT, one mail over: a caller that forgets a value.
    for (const [label, args] of [
        ["no code at all", { confirmUrl: "https://x.test/login/confirm?token=a" }],
        ["a code that is not six digits", { confirmUrl: "https://x.test/login/confirm?token=a", code: "12345" }],
        ["a code as a number", { confirmUrl: "https://x.test/login/confirm?token=a", code: 12345 }],
        ["no link", { code: "012345" }],
    ]) {
        let threw = false;
        try {
            SIGN_IN_COPY.mail.html(args);
        } catch {
            threw = true;
        }
        assert(`the builder refuses ${label} rather than mailing it`, threw);
    }
}

if (isMain(import.meta.url)) standalone(title, run);
