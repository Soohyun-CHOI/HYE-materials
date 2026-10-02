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

import { readFileSync } from "node:fs";
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
    RESENT_FOR_MS,
    SIGN_IN_COPY,
    TOKEN_STATES,
    TOKEN_TTL_MINUTES,
} from "../../../lib/authTokenState.js";
import { SIGN_IN_TITLE, WORDMARK } from "../../../lib/productName.js";

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
    // THE DESIGN'S WORDS SINCE #473 (1b, 1f), typed out here rather than read back, so a
    // rewording is a change to this file too. Every state is a heading and one action;
    // a state whose row names an address leads into it with a sentence.
    log("");
    log("the confirmation's words — a heading and one way on per state:");
    const states = Object.values(TOKEN_STATES);
    check("and there are no extra entries", Object.keys(CONFIRM_COPY).length, states.length);
    const confirmWords = (s) => [CONFIRM_COPY[s].heading, CONFIRM_COPY[s].sentence ?? "-", CONFIRM_COPY[s].action].join(" / ");
    check("a good link", confirmWords(TOKEN_STATES.VALID), "Sign in / You're signing in as / Sign in");
    check("a used one", confirmWords(TOKEN_STATES.USED), "This link no longer works / Get a new link sent to / Send new email");
    check("an expired one", confirmWords(TOKEN_STATES.EXPIRED), "This link has expired / Get a new link sent to / Send new email");
    check("one naming no row", confirmWords(TOKEN_STATES.INVALID), "This link isn't valid / - / Go to sign in");
    // A MISSING TOKEN AND AN UNKNOWN ONE SAY ONE THING: telling them apart would tell
    // whoever holds the link something about what the app knows.
    check("  and one with no token says the same", confirmWords(TOKEN_STATES.MISSING), confirmWords(TOKEN_STATES.INVALID));
    // Only a state with a row has an address to lead into, which is what the page draws
    // under the sentence; a state with none has no sentence to hang it from.
    check(
        "a sentence leads into an address exactly where the row names one",
        states.filter((s) => CONFIRM_COPY[s].sentence).sort().join(","),
        [TOKEN_STATES.EXPIRED, TOKEN_STATES.USED, TOKEN_STATES.VALID].sort().join(",")
    );

    log("");
    log("the lifetime is one number, and the mail is where it is said:");
    check("TOKEN_TTL_MINUTES", TOKEN_TTL_MINUTES, 15);

    // A verdict is never a scolding, and never says what the reader did wrong.
    assert(
        "no message blames the reader",
        states.every((s) => !/you (?:waited|failed|should)/i.test(confirmWords(s)))
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
    // THE DESIGN'S WORDS SINCE #473 (1a, 1e), typed out. A refusal that leaves something
    // to try is one sentence under the field; any other is the heading the step takes
    // when the field goes, so `canTryAgain` decides which kind each entry is.
    log("");
    log("the code step's words — one per refusal, and none for success:");
    const refusals = Object.values(CODE_STATES).filter((s) => s !== CODE_STATES.VALID);
    const sentence = (s) => (typeof CODE_COPY[s] === "function" ? CODE_COPY[s](2) : CODE_COPY[s]);
    check("every refusal has words", refusals.filter((s) => !sentence(s)).join(), "");
    check("  and success has none — it says so by arriving (#321)", CODE_COPY[CODE_STATES.VALID], undefined);
    check("  and there are no extra entries", Object.keys(CODE_COPY).length, refusals.length);
    check("one try left is singular", CODE_COPY[CODE_STATES.WRONG](1), "Wrong code. 1 try left.");
    check("  two are plural", CODE_COPY[CODE_STATES.WRONG](2), "Wrong code. 2 tries left.");
    check("  and four, as the design draws it", CODE_COPY[CODE_STATES.WRONG](4), "Wrong code. 4 tries left.");
    check("a short code, which the design does not draw, keeps #471's sentence", CODE_COPY[CODE_STATES.MALFORMED], "Enter the 6-digit code from the email.");
    // Read off the source, since a figure spelled out renders the same until the length moves.
    const stateSource = readFileSync(new URL("../../../lib/authTokenState.js", import.meta.url), "utf8");
    assert("  its figure interpolated rather than spelled", /\[CODE_STATES\.MALFORMED\]:\s*`[^`]*\$\{CODE_LENGTH\}[^`]*`/.test(stateSource));
    check("five wrong ones end the code", CODE_COPY[CODE_STATES.LOCKED], "Too many tries");
    check("  and so do fifteen minutes", CODE_COPY[CODE_STATES.EXPIRED], "This code has expired");
    // THE THREE STATES THE DESIGN DID NOT DRAW SHARE ONE HEADING, the link's `used` in the
    // code's word: a row spent somewhere else, a browser no longer waiting, a row gone.
    check("a code spent somewhere else no longer works", CODE_COPY[CODE_STATES.USED], "This code no longer works");
    check(
        "  and neither does one this browser stopped waiting for, nor one whose row is gone",
        [CODE_COPY[CODE_STATES.MISSING], CODE_COPY[CODE_STATES.INVALID]].join(" | "),
        "This code no longer works | This code no longer works"
    );
    // NONE OF THEM SAYS ANYTHING ABOUT AN ADDRESS: each describes the row this browser
    // asked for, so no refusal names an account, a person or a sign-in that happened.
    assert(
        "no refusal names an account or says somebody signed in",
        refusals.every((s) => !/account|signed in|registered|exists/i.test(sentence(s)))
    );
    // THE INSTRUCTION LIVES IN THE CONTROL: an ended code's one action sends a new email,
    // and no refusal says so itself.
    assert(
        "no refusal repeats what the action under it says",
        refusals.every((s) => !/new email|send a new|request a new/i.test(sentence(s)))
    );
    check("  and the action is where it is said", SIGN_IN_COPY.code.endedAction, "Send new email");
    check("  the same words the expired link's action says", SIGN_IN_COPY.code.endedAction, CONFIRM_COPY[TOKEN_STATES.EXPIRED].action);
    assert(
        "no code sentence blames the reader",
        refusals.every((s) => !/you (?:waited|failed|should|typed|entered)/i.test(sentence(s)))
    );
    check(
        "the step's own words",
        [
            SIGN_IN_COPY.code.heading,
            SIGN_IN_COPY.code.sentence,
            SIGN_IN_COPY.code.action,
            SIGN_IN_COPY.code.working,
            SIGN_IN_COPY.code.resendLead,
            SIGN_IN_COPY.code.resend,
            SIGN_IN_COPY.code.resent,
            SIGN_IN_COPY.code.endedSentence,
        ].join(" / "),
        "Check your email / Enter the code we sent to / Sign in / Signing in… / Didn't get it? / Resend email / Email sent / Get a new code sent to"
    );
    check("  and `Email sent` stands for the design's 3 s", RESENT_FOR_MS, 3000);
    check(
        "the email step's words",
        [SIGN_IN_COPY.request.heading, SIGN_IN_COPY.request.sentence, SIGN_IN_COPY.request.placeholder, SIGN_IN_COPY.request.action, SIGN_IN_COPY.request.working].join(" / "),
        "Sign in / Enter your work email. / name / Continue / Sending…"
    );
    check("a request that did not happen says one sentence wherever it was asked", SIGN_IN_COPY.failed, "Something went wrong. Try again.");
    check("  and a new email on its way one word wherever it was asked", [SIGN_IN_COPY.request.working, SIGN_IN_COPY.sending].join(" "), "Sending… Sending…");

    // ── the email ───────────────────────────────────────────────────────────
    // THE DESIGN'S OWN MAIL SINCE #473 (1h, 0a Email): one builder for the HTML and the
    // plain text, every value it puts into markup escaped, and every fact it needs refused
    // rather than mailed as `undefined`.
    log("");
    log("the email carries the address, the link and the code, in the design's words:");
    check("its subject is the sign-in line (#201)", SIGN_IN_COPY.mail.subject, SIGN_IN_TITLE);
    check("its hidden first line", SIGN_IN_COPY.mail.preheader, "Use the link or the code to sign in. Both expire in 15 minutes.");
    assert("  carrying the lifetime from the constant", SIGN_IN_COPY.mail.preheader.includes(`${TOKEN_TTL_MINUTES} minutes`));
    const facts = {
        email: "soo+code471@hanyang.example",
        confirmUrl: "https://portal.example.com/login/confirm?token=abc&destination=%2Ftool-items%2FX",
        code: "012345",
    };
    const html = SIGN_IN_COPY.mail.html(facts);
    assert("it carries the code, leading zero and all", html.includes(">012345<"));
    check("it carries one link", [...html.matchAll(/href="/g)].length, 1);
    assert("  with its separator escaped", html.includes("token=abc&amp;destination="));
    assert("it names the address it signs in", html.includes(">soo+code471@hanyang.example<"));
    const confirmAction = CONFIRM_COPY[TOKEN_STATES.VALID].action;
    assert(`its button is ${confirmAction}, the confirmation's own action`, html.includes(`>${confirmAction}</a>`));
    assert("it states the lifetime from the constant", html.includes(`expire in ${TOKEN_TTL_MINUTES} minutes`));
    assert("its title is the sign-in line", html.includes(`>${SIGN_IN_TITLE}</td>`) && html.includes(`<title>${SIGN_IN_TITLE}</title>`));
    assert("its head is the wordmark, split where the product's name splits", html.includes(`>${WORDMARK.lead}</span> <span`) && html.includes(`>${WORDMARK.rest.trim()}</span>`));
    // NO CODE WHERE A LOCK SCREEN SHOWS IT: the subject and the hidden first line.
    assert("the code is in neither the subject nor the hidden first line", !SIGN_IN_COPY.mail.subject.includes("012345") && !/>Use the link[^<]*012345/.test(html));
    // A LONG ADDRESS BREAKS RATHER THAN RUNNING PAST A NARROW PHONE'S EDGE, which the
    // design's own mail held to one line.
    const addressSpan = html.match(/<span class="ink"[^>]*>soo\+code471@hanyang\.example<\/span>/)?.[0] ?? "";
    assert("the address is no longer held to one line", addressSpan.length > 0 && !addressSpan.includes("nowrap") && addressSpan.includes("overflow-wrap: anywhere"));
    // EVERY VALUE IN THE MARKUP IS ESCAPED (#473), the address and the link as well as the
    // link's `&`, so a value cannot become markup.
    const hostile = SIGN_IN_COPY.mail.html({
        email: 'a"b<c>&d@hanyang.example',
        confirmUrl: 'https://x.test/login/confirm?token=a"><script>',
        code: "012345",
    });
    assert("an address's markup characters are escaped", hostile.includes("a&quot;b&lt;c&gt;&amp;d@hanyang.example") && !hostile.includes("<c>"));
    assert("  and a link's", hostile.includes('href="https://x.test/login/confirm?token=a&quot;&gt;&lt;script&gt;"') && !hostile.includes("<script>"));
    // THE PLAIN-TEXT PART IS THE SAME WORDS IN THE SAME ORDER, the button a sentence and
    // its URL — read whole, so a sentence dropped from one part fails here.
    check(
        "the plain-text part",
        SIGN_IN_COPY.mail.text(facts),
        [
            SIGN_IN_TITLE,
            "",
            "Use this link to sign in as soo+code471@hanyang.example:",
            "https://portal.example.com/login/confirm?token=abc&destination=%2Ftool-items%2FX",
            "",
            "Or enter this code on the sign-in page: 012345",
            "",
            "This link and code work once and expire in 15 minutes.",
            "",
            "If you didn't try to sign in, you can safely ignore this email.",
            "",
        ].join("\n")
    );
    for (const words of ["Or enter this code on the sign-in page:", "This link and code work once and expire in 15 minutes.", "If you didn&#39;t try to sign in, you can safely ignore this email."]) {
        assert(`  and the HTML says it too: ${words.slice(0, 40)}`, html.includes(words));
    }
    // THE MUTANT #290 WAS ABOUT, one mail over: a caller that forgets a value.
    for (const [label, args] of [
        ["no code at all", { email: facts.email, confirmUrl: facts.confirmUrl }],
        ["a code that is not six digits", { ...facts, code: "12345" }],
        ["a code as a number", { ...facts, code: 12345 }],
        ["no link", { email: facts.email, code: "012345" }],
        ["no address", { confirmUrl: facts.confirmUrl, code: "012345" }],
    ]) {
        for (const part of ["html", "text"]) {
            let threw = false;
            try {
                SIGN_IN_COPY.mail[part](args);
            } catch {
                threw = true;
            }
            assert(`the ${part} builder refuses ${label} rather than mailing it`, threw);
        }
    }
}

if (isMain(import.meta.url)) standalone(title, run);
