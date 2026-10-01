/**
 * Whether a sign-in row can still be used — by its link (#203) or by its code
 * (#471) — and every word the sign-in says about it, the email's included.
 *
 * WHY THIS IS A MODULE RATHER THAN AN `if` CHAIN IN TWO PLACES. Until #203 the
 * rule lived inside `consumeAuthToken`, which was fine while consuming was the
 * only thing anyone did with a token. The confirmation page now has to reach the
 * same judgment WITHOUT consuming — that is the whole issue — so the rule would
 * otherwise have had a second implementation, and the two would decide the same
 * question in two places. Same reasoning as `lib/quotationReuse.js`.
 *
 * AND #471 GAVE THE SAME ROW A SECOND WAY IN. The email carries a six-digit code
 * beside the link, and the screen that asked for the email takes it. Both are ways
 * of spending ONE `Auth Tokens` row, so whether that row is still alive — used
 * before expired, an unreadable expiry counted as expired — is `rowLife` below and
 * nothing else, and the link's five verdicts and the code's are two readings of
 * it. What the code adds is its own: a value that cannot be a code, a browser that
 * is not waiting for one, and the attempt count that ends it.
 *
 * Pure, and its one import is `./productName.js`, which imports nothing — so
 * `offline/auth-token-state.mjs` can pin every clause and `app/login/LoginForm.js`
 * (a Client Component) can read the TTL and the words from it. That is also why
 * the code is neither made nor compared here: both need `node:crypto`, which a
 * browser bundle cannot load, so `lib/airtable/authTokens.js` makes it and hands
 * this module the comparison's result as a fact.
 */

import { SIGN_IN_TITLE } from "./productName.js";

/**
 * The token's lifetime, and the ONE place the number lives.
 *
 * It was a module-private constant in `lib/airtable/authTokens.js` while three
 * separate copy strings also said "15 minutes" in prose. That module is
 * credentialed — it reaches `lib/airtable/client.js`, which throws at module
 * load without `AIRTABLE_API_KEY` — so no page and no offline check could read
 * it, which is exactly why the prose had to repeat it. Here every reader can.
 *
 * The code lives exactly as long, because it is the same row (#471).
 */
export const TOKEN_TTL_MINUTES = 15;

/**
 * The five answers, as a closed set. `missing` and `invalid` are deliberately
 * separate states that share their copy: they are different facts (no token was
 * supplied at all, versus one was and no such row exists) and telling them apart
 * costs nothing, while merging them would make the state set describe less than
 * the code knows.
 */
export const TOKEN_STATES = {
    VALID: "valid",
    MISSING: "missing",
    INVALID: "invalid",
    USED: "used",
    EXPIRED: "expired",
};

/**
 * Whether the row itself is still alive, whichever way it is being spent (#471).
 *
 * PRECEDENCE IS `used` -> `expired` -> `valid`, and it is the one real choice this
 * module makes about a row: a row that is BOTH used and expired reports `used`.
 * That is the more informative of the two — it says the sign-in worked once, which
 * tells the reader their earlier click succeeded, where "expired" would suggest
 * they were simply too slow.
 *
 * AN UNPARSEABLE OR ABSENT `expiresAt` IS TREATED AS EXPIRED, which is a
 * deliberate tightening of what `consumeAuthToken` did before #203. The old
 * comparison was `new Date(expiresAt).getTime() < Date.now()`, and `NaN < n` is
 * false, so a row whose `Expires At` was blank or malformed would never expire —
 * a token good forever, from a field nobody in the app writes by hand but which
 * the Airtable UI can empty in one click. Failing closed costs a legitimate user
 * one "request a new link"; failing open costs an unbounded credential.
 *
 * The boundary itself is unchanged: expiry is `expiresAt < now`, so a row
 * examined at exactly its expiry instant is still valid.
 */
function rowLife({ used, expiresAt }, now) {
    if (used === true) return TOKEN_STATES.USED;

    const expiryMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiryMs) || expiryMs < now) return TOKEN_STATES.EXPIRED;

    return TOKEN_STATES.VALID;
}

/**
 * Classify a token from plain values — never an Airtable record, which is what
 * keeps this module offline-safe. Callers project the record; both do it the
 * same way.
 *
 * PRECEDENCE IS `missing` -> `invalid` -> then the row's own life: `used` ->
 * `expired` -> `valid` (`rowLife` above, which the code shares).
 */
export function describeToken({ token, exists, used, expiresAt } = {}, now = Date.now()) {
    if (typeof token !== "string" || token.length === 0) return TOKEN_STATES.MISSING;
    if (!exists) return TOKEN_STATES.INVALID;
    return rowLife({ used, expiresAt }, now);
}

/** Can this token still be turned into a session? */
export function isUsableToken(facts, now = Date.now()) {
    return describeToken(facts, now) === TOKEN_STATES.VALID;
}

/**
 * What the confirmation page says, per state. Copy sits with the judgment that
 * selects it, the arrangement `WITHDRAW_COPY` and `STATUS_COPY` already use.
 *
 * `action` exists on `valid` alone, because it is the only state that offers a
 * control — a refused state has nothing to press, and giving every entry an
 * `action` would imply otherwise.
 *
 * A REFUSED BODY STATES THE FACT AND NOTHING ELSE; `REQUEST_NEW_LINK` below is
 * what tells the reader where to go. The first version had three of the four
 * bodies end with "Request a new one to sign in." while the link directly under
 * them said the same thing again, and the fourth said neither — an inconsistency
 * the offline check found. Splitting it this way makes the instruction
 * unrepeatable rather than merely consistent today: there is exactly one place
 * the reader is told what to do, and it is the thing they can click.
 *
 * SECOND PERSON, addressed to the one person who can act. The expiry sentence
 * takes its number from `TOKEN_TTL_MINUTES` rather than spelling it, so changing
 * the lifetime cannot leave the page claiming the old one.
 */
export const CONFIRM_COPY = {
    [TOKEN_STATES.VALID]: {
        body: "Press the button to finish signing in on this device.",
        action: "Confirm sign-in",
    },
    [TOKEN_STATES.MISSING]: {
        body: "This sign-in link is not valid.",
    },
    [TOKEN_STATES.INVALID]: {
        body: "This sign-in link is not valid.",
    },
    [TOKEN_STATES.USED]: {
        body: "This sign-in link has already been used.",
    },
    [TOKEN_STATES.EXPIRED]: {
        body: `This sign-in link has expired. Sign-in links last ${TOKEN_TTL_MINUTES} minutes.`,
    },
};

/** The link back, shared by every refused state so they cannot word it differently. */
export const REQUEST_NEW_LINK = "Request a new sign-in link";

// ---------------------------------------------------------------------------
// The code (#471)
// ---------------------------------------------------------------------------

/** How many digits a code has. The screen, the mail and the judgment read this. */
export const CODE_LENGTH = 6;

/**
 * How many tries one code gets. Every attempt counts, the right one included, so
 * the fifth wrong one is the last: the count is written in the same write as the
 * attempt's outcome, which is what keeps it from being skipped (see
 * `lib/airtable/authTokens.js`).
 */
export const MAX_CODE_ATTEMPTS = 5;

/**
 * The code's answers. The row's own three are `TOKEN_STATES`' values rather than
 * look-alikes, because they ARE the same judgment (`rowLife`); `missing` and
 * `invalid` keep the token pair's shape one step over — this browser is waiting
 * for no sign-in at all, versus it is and the row is gone or holds no code — and
 * share their copy for the same reason.
 */
export const CODE_STATES = {
    ...TOKEN_STATES,
    MALFORMED: "malformed",
    LOCKED: "locked",
    WRONG: "wrong",
};

/**
 * What a person typed, with every space taken out. A code is shown as six digits,
 * but a pasted `123 456` or a trailing space from a mail client is the same code.
 */
export function normalizeCode(value) {
    return typeof value === "string" ? value.replace(/\s+/g, "") : "";
}

const CODE_SHAPE = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** Is this something a code could be? Six ASCII digits and nothing else. */
export function isCodeShaped(value) {
    return typeof value === "string" && CODE_SHAPE.test(value);
}

/**
 * The two clauses decided before the row is read, and the only place they are
 * decided — `describeCode` opens with them, and the credentialed caller asks them
 * first so that neither costs an Airtable read.
 *
 * A VALUE THAT CANNOT BE A CODE IS NOT AN ATTEMPT. It cannot match, so refusing it
 * uncounted gives a guesser nothing, and it keeps a typo from spending one of the
 * reader's five.
 */
export function precheckCode({ given, bound } = {}) {
    if (!isCodeShaped(given)) return CODE_STATES.MALFORMED;
    if (!bound) return CODE_STATES.MISSING;
    return null;
}

/**
 * Classify a code attempt from plain values.
 *
 * PRECEDENCE IS `malformed` -> `missing` -> `invalid` -> the row's own life
 * (`used` -> `expired`) -> `locked` -> `wrong` -> `valid`. A row the link has
 * already spent says `used` whatever was typed, which is the "either one finishes
 * the same request" half of the issue; `locked` comes after the row's life because
 * a used or expired row says something truer than a count does.
 *
 * `matches` IS A FACT THE CALLER HANDS IN. The comparison is constant-time and
 * needs `node:crypto`, which this module cannot import (see the header).
 *
 * AN ATTEMPT COUNT THAT IS NOT A NUMBER BELOW THE CEILING IS `locked` — a value
 * nobody can read is not permission to keep guessing.
 */
export function describeCode(
    { given, bound, exists, stored, used, expiresAt, attempts, matches } = {},
    now = Date.now()
) {
    const early = precheckCode({ given, bound });
    if (early) return early;
    if (!exists || !isCodeShaped(stored)) return CODE_STATES.INVALID;

    const life = rowLife({ used, expiresAt }, now);
    if (life !== CODE_STATES.VALID) return life;

    if (!(attempts < MAX_CODE_ATTEMPTS)) return CODE_STATES.LOCKED;
    return matches === true ? CODE_STATES.VALID : CODE_STATES.WRONG;
}

/**
 * What an attempt that reached the comparison leaves behind: the count to write
 * and what to tell the reader. The fifth wrong one answers `locked` rather than
 * `wrong` with nothing left, since there is nothing left to try.
 */
export function afterAttempt({ attempts, matches }) {
    const counted = attempts + 1;
    if (matches === true) return { attempts: counted, state: CODE_STATES.VALID };
    if (counted >= MAX_CODE_ATTEMPTS) return { attempts: counted, state: CODE_STATES.LOCKED, remaining: 0 };
    return { attempts: counted, state: CODE_STATES.WRONG, remaining: MAX_CODE_ATTEMPTS - counted };
}

/**
 * Can typing another code still work? Only after a malformed one or a wrong one;
 * every other refusal is about the row, and the screen then offers a new email
 * instead of the field — the confirmation page's rule that a refused state has
 * nothing to press.
 */
export function canTryAgain(state) {
    return state === CODE_STATES.MALFORMED || state === CODE_STATES.WRONG;
}

/**
 * What the code step says, per refusal. `valid` has no entry: a code that works
 * says so by arriving, which is #321's rule, so there is no success sentence to
 * write.
 *
 * A REFUSED SENTENCE STATES THE FACT AND NOTHING ELSE, `CONFIRM_COPY`'s rule one
 * screen over: `Send a new email` stands under every one of them and is the only
 * place the reader is told what to do.
 *
 * `used` NAMES BOTH, because the row does not record which one spent it and either
 * could have — the case #471 is about is somebody whose link was opened on the
 * computer while the phone waits for the code.
 */
export const CODE_COPY = {
    [CODE_STATES.MALFORMED]: `Enter the ${CODE_LENGTH}-digit code from the email.`,
    [CODE_STATES.MISSING]: "No sign-in code is waiting on this screen.",
    [CODE_STATES.INVALID]: "No sign-in code is waiting on this screen.",
    [CODE_STATES.USED]: "The code or the link in this email has already been used.",
    [CODE_STATES.EXPIRED]: `This code has expired. Codes last ${TOKEN_TTL_MINUTES} minutes.`,
    [CODE_STATES.LOCKED]: `This code was entered wrong ${MAX_CODE_ATTEMPTS} times, so it no longer works.`,
    [CODE_STATES.WRONG]: (remaining) =>
        `That code does not match. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`,
};

/**
 * An `&` inside an `href` is an entity start, and the mail below is hand-written
 * HTML.
 *
 * IT STOPPED BEING THEORETICAL IN #373, which gave the sign-in link a second
 * parameter. `?token=…&destination=…` in an unescaped attribute is a parse error,
 * and where the text after `&` happens to name an entity a strict parser rewrites
 * it — so the correctness of a sign-in link would depend on what a parameter is
 * called. Escaping the separator is one line and removes that dependency. It moved
 * here from `lib/email.js` with the mail's words (#471), since this is now the only
 * place a URL is put into markup.
 */
const htmlAttr = (url) => String(url).replace(/&/g, "&amp;");

/** The confirmation's one control, which the code step and the mail both name. */
const CONFIRM_ACTION = CONFIRM_COPY[TOKEN_STATES.VALID].action;

/**
 * Every word the sign-in screen and its email say, beyond the per-state sentences.
 *
 * THE WORDS LEFT JSX IN #471 so `scripts/screen-strings.mjs` and the vocabulary
 * checks can read them — `NameForm.js`'s arrangement one step on.
 *
 * THE MAIL IS A PURE BUILDER FOR #290's REASON. `lib/email.js` throws at module
 * load without `RESEND_API_KEY`, so a body assembled there can be read and never
 * called, and a caller that forgot the code would send a mail reading `undefined`
 * with every check green. Here the builder refuses a value that is not a code, and
 * the check calls it.
 *
 * THE MAIL NAMES THE BUTTON FROM `CONFIRM_COPY`, so renaming `Confirm sign-in`
 * cannot leave the mail and the code step telling the reader to press a word the
 * confirmation no longer shows — the drift `docs/briefs/login.md` warns about.
 */
export const SIGN_IN_COPY = {
    request: {
        evidence: "Use your company email address.",
        placeholder: "you@company.com",
        action: "Send sign-in link",
        sending: "Sending...",
        failed: "Something went wrong",
    },
    code: {
        heading: "Check your email",
        sent: (email) => `We sent a sign-in link and a code to ${email}.`,
        how:
            `Enter the code here to sign in on this device, or open the link and press ${CONFIRM_ACTION}. ` +
            `Both expire in ${TOKEN_TTL_MINUTES} minutes, and using one ends the other.`,
        label: "Code",
        action: "Sign in",
        checking: "Signing in...",
        resend: "Send a new email",
        resending: "Sending...",
        resent: "We sent a new email. Use the code in the newest one.",
        changeEmail: "Use a different email",
    },
    mail: {
        subject: SIGN_IN_TITLE,
        html: ({ confirmUrl, code }) => {
            if (!isCodeShaped(code)) throw new Error("A sign-in email needs a six-digit code");
            if (typeof confirmUrl !== "string" || confirmUrl.length === 0) {
                throw new Error("A sign-in email needs its link");
            }
            return `
            <p>Your sign-in code:</p>
            <p style="font-size: 24px; font-weight: 600; letter-spacing: 4px;">${code}</p>
            <p>Enter it on the screen where you asked to sign in. Or open the link below and press ${CONFIRM_ACTION} on the page that opens, which signs in whichever device opened it.</p>
            <p><a href="${htmlAttr(confirmUrl)}">${SIGN_IN_TITLE}</a></p>
            <p>The code and the link expire in ${TOKEN_TTL_MINUTES} minutes, and using one ends the other. Opening the link does not sign you in on its own, and the code works only on the screen that asked for it, so if you didn't request this you can ignore this email. Do not share the code with anyone.</p>
        `;
        },
    },
};
