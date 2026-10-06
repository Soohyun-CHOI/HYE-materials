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

import { SIGN_IN_TITLE, WORDMARK } from "./productName.js";

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
 * What sends a new email, wherever a sign-in has ended: a code that can no longer be
 * used and a link that can no longer be used say it in one word, and so does the label
 * it gives way to while the email is on its way (0f Working).
 */
const SEND_NEW_EMAIL = "Send new email";
const SENDING = "Sending…";

/**
 * What the confirmation page says, per state (#473, from the design's 1b and 1f). Copy
 * sits with the judgment that selects it, the arrangement `WITHDRAW_COPY` and
 * `STATUS_COPY` already use.
 *
 * EVERY STATE IS A HEADING AND ONE WAY ON. The heading names the state; a state that
 * knows its row's address leads into it with `sentence`, and the page draws the address under
 * it; and `action` is the one thing to press. `valid` signs in, a used or expired link
 * sends a new email to the same address, and a link that names no row goes back to the
 * sign-in screen, since there is no address to send to. Until #473 a refused state had a
 * sentence and a link back, `Request a new sign-in link`, and nothing to press.
 *
 * `missing` AND `invalid` STILL SHARE THEIR WORDS: a link with no token and one naming no
 * row are one fact from the reader's side, and telling them apart would tell whoever holds
 * the link something about what the app knows.
 *
 * THE EXPIRED HEADING NO LONGER SAYS HOW LONG A LINK LASTS. The email says it, from
 * `TOKEN_TTL_MINUTES`, which is where the reader meets the figure before the link ends.
 */
export const CONFIRM_COPY = {
    [TOKEN_STATES.VALID]: {
        heading: "Sign in",
        sentence: "You're signing in as",
        action: "Sign in",
    },
    [TOKEN_STATES.MISSING]: {
        heading: "This link isn't valid",
        action: "Go to sign in",
    },
    [TOKEN_STATES.INVALID]: {
        heading: "This link isn't valid",
        action: "Go to sign in",
    },
    [TOKEN_STATES.USED]: {
        heading: "This link no longer works",
        sentence: "Get a new link sent to",
        action: SEND_NEW_EMAIL,
    },
    [TOKEN_STATES.EXPIRED]: {
        heading: "This link has expired",
        sentence: "Get a new link sent to",
        action: SEND_NEW_EMAIL,
    },
};

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
 * every other refusal is about the row, and the screen then takes the field away and
 * offers a new email in its place (0o, Ended).
 */
export function canTryAgain(state) {
    return state === CODE_STATES.MALFORMED || state === CODE_STATES.WRONG;
}

/**
 * What the code step says, per refusal (#473, from the design's 1a and 1e). `valid` has
 * no entry: a code that works says so by arriving, which is #321's rule, so there is no
 * success sentence to write.
 *
 * TWO KINDS OF ENTRY, AND `canTryAgain` IS WHAT TELLS THEM APART. A refusal that leaves
 * something to try is one sentence under the field, which stays; any other ends the code,
 * and its entry is the step's heading in place of `Check your email` — the field goes,
 * the sentence under the heading leads into the address, and the one action sends a new
 * email (0o, Ended).
 *
 * THREE STATES THE DESIGN DID NOT DRAW SHARE ONE HEADING. `used` — the link or the code
 * spent the row somewhere else — `missing` — this browser is no longer waiting, since
 * its binding ended with the row or was dropped by `Change` or a sign-in in another tab
 * — and `invalid` all leave a code that no longer works here, and the design words the
 * link's `used` the same way. Every one describes the row this browser asked for, so none
 * of them says anything about an address.
 *
 * `malformed` IS NOT DRAWN EITHER, and keeps #471's sentence: six boxes send themselves
 * at the sixth figure, so only `Sign in` pressed early reaches it.
 */
export const CODE_COPY = {
    [CODE_STATES.MALFORMED]: `Enter the ${CODE_LENGTH}-digit code from the email.`,
    [CODE_STATES.WRONG]: (remaining) => `Wrong code. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`,
    [CODE_STATES.LOCKED]: "Too many tries",
    [CODE_STATES.EXPIRED]: "This code has expired",
    [CODE_STATES.USED]: "This code no longer works",
    [CODE_STATES.MISSING]: "This code no longer works",
    [CODE_STATES.INVALID]: "This code no longer works",
};

/**
 * How long `Resend email` reads `Email sent`, in milliseconds — the design's 3 s (1a, 1e).
 * It takes no press then, nor for the rest of the wait after it, which counts down in its
 * place (#148, 1j): `lib/signInLimit.js:RESEND_COOLDOWN_MS` is how long the wait is.
 */
export const RESENT_FOR_MS = 3000;

/** Whole seconds left as `m:ss`, a part second counting as one — the wait's count (1j). */
function waitClock(msLeft) {
    const seconds = Math.max(0, Math.ceil(msLeft / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Every value the mail puts into markup goes through this: the address, the link and the
 * code, and the sentences beside them.
 *
 * #471 ESCAPED THE LINK'S `&` AND NOTHING ELSE, which was enough while the mail carried
 * no address and a code is six digits. The mail names the address it signs in now, which
 * the request step judged but which is the reader's typing, and a value that reaches
 * hand-written HTML unescaped is one parse away from being markup. The `&` in an `href`
 * stays the case #373 found — `?token=…&destination=…` with the separator raw is a parse
 * error where the text after it names an entity — and the same five characters cover it.
 */
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

/**
 * The three facts a sign-in email carries, refused rather than mailed when one is missing
 * — #290's mutant one mail over: a caller that forgot a value would send a mail reading
 * `undefined` with every check green.
 */
function mailFacts({ email, confirmUrl, code } = {}) {
    if (!isCodeShaped(code)) throw new Error("A sign-in email needs a six-digit code");
    if (typeof confirmUrl !== "string" || confirmUrl.length === 0) throw new Error("A sign-in email needs its link");
    if (typeof email !== "string" || email.length === 0) throw new Error("A sign-in email needs the address it signs in");
    return { email, confirmUrl, code };
}

/**
 * The mail's faces, system ones only (0a Email): no width depends on the face, and Outlook,
 * which takes no web face and falls to Times without one, is given Segoe UI and Consolas in
 * a block only it reads.
 */
const MAIL_TEXT_FACE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MAIL_CODE_FACE = "Menlo, Consolas, 'Courier New', monospace";

/**
 * Every word the sign-in screens and their email say, beyond the per-state ones above
 * (#473, from the design's 1a–1h).
 *
 * THE WORDS LEFT JSX IN #471 so `scripts/screen-strings.mjs` and the vocabulary checks
 * can read them — `NameForm.js`'s arrangement one step on.
 *
 * `SENDING` AND `SEND_NEW_EMAIL` ARE ONE STRING EACH, wherever an email is asked for again
 * — the email step's action at work, the ended code's action and the ended link's — and so
 * is `failed`, the one sentence a request that did not happen says: the email step's, a
 * code the server could not check, and a new email that did not go.
 *
 * AND SO IS `limited` (#148), what every control that asks for an email says when a
 * ceiling holds the email back: `Continue`, `Resend email`, and `Send new email` on an
 * ended code and an ended link. It names no address and no time, so it reads the same
 * whoever the address belongs to — which is what the ceilings themselves do, counting
 * every company address alike.
 *
 * THE MAIL IS A PURE BUILDER FOR #290's REASON. `lib/email.js` throws at module load
 * without `RESEND_API_KEY`, so a body assembled there can be read and never called. It is
 * the design's own mail (1h, and the frame 0a Email draws for every mail the portal sends):
 * tables, every style inline, the `<style>` block holding only what a phone and a dark
 * client override. Its button reads the confirmation's own action, so the mail and the
 * page it opens name one control; the address is no longer held to one line, so a long one
 * breaks rather than pushing the mail past a narrow phone's edge. Plain text goes beside
 * it, in the same words and the same order, the button a sentence and its URL.
 */
export const SIGN_IN_COPY = {
    request: {
        heading: "Sign in",
        sentence: "Enter your work email.",
        /** The field's name for assistive tech: a field alone on its page shows no label (0o). */
        field: "Email",
        placeholder: "name",
        action: "Continue",
        working: SENDING,
    },
    code: {
        heading: "Check your email",
        sentence: "Enter the code we sent to",
        field: "Code",
        change: "Change",
        action: "Sign in",
        working: "Signing in…",
        resendLead: "Didn't get it?",
        resend: "Resend email",
        resent: "Email sent",
        /** The control while the wait runs: what is left of it, and no press (#148, 1j). */
        resendIn: (msLeft) => `Resend in ${waitClock(msLeft)}`,
        endedSentence: "Get a new code sent to",
        endedAction: SEND_NEW_EMAIL,
    },
    /** What a new email says while it is on its way, from any of the three places that ask. */
    sending: SENDING,
    failed: "Something went wrong. Try again.",
    limited: "Too many requests. Try again later.",
    mail: {
        subject: SIGN_IN_TITLE,
        /** The hidden first line an inbox shows after the subject. The code is never in it, nor in the subject. */
        preheader: `Use the link or the code to sign in. Both expire in ${TOKEN_TTL_MINUTES} minutes.`,
        lead: { before: "Use the button or the code below to sign in as ", after: "." },
        linkLead: { before: "Use this link to sign in as ", after: ":" },
        action: CONFIRM_COPY[TOKEN_STATES.VALID].action,
        codeLead: "Or enter this code on the sign-in page:",
        limits: `This link and code work once and expire in ${TOKEN_TTL_MINUTES} minutes.`,
        ignore: "If you didn't try to sign in, you can safely ignore this email.",
        html: (facts) => signInMailHtml(mailFacts(facts)),
        text: (facts) => signInMailText(mailFacts(facts)),
    },
};

function signInMailHtml({ email, confirmUrl, code }) {
    const words = SIGN_IN_COPY.mail;
    const e = escapeHtml;
    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(SIGN_IN_TITLE)}</title>
<!--[if mso]><style>body, table, td, p, a, span { font-family: 'Segoe UI', Arial, sans-serif !important; } .code { font-family: Consolas, 'Courier New', monospace !important; }</style><![endif]-->
<style>
  @media (max-width: 599px) {
    .page { padding: 32px 24px 36px !important; }
    .btn-table { width: 100% !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .bg { background: #17191E !important; }
    .ink { color: #EDEEF1 !important; }
    .ink2 { color: #BBBEC3 !important; }
    .field { background: #25282E !important; }
  }
  [data-ogsc] .ink { color: #EDEEF1 !important; }
  [data-ogsc] .ink2 { color: #BBBEC3 !important; }
  [data-ogsb] .bg { background: #17191E !important; }
  [data-ogsb] .field { background: #25282E !important; }
  a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
</style>
</head>
<body class="bg" style="margin: 0; padding: 0; background: #FFFFFF;">
<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${e(words.preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" class="bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #FFFFFF;">
<tr><td align="center">
  <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
  <tr><td class="page" align="center" style="padding: 48px 40px 48px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 440px;">
    <tr><td align="center" class="ink" style="font-family: ${MAIL_TEXT_FACE}; font-size: 18px; line-height: 24px; mso-line-height-rule: exactly; color: #202329;"><span style="font-weight: 700;">${e(WORDMARK.lead)}</span> <span class="ink2" style="font-weight: 400; color: #464950;">${e(WORDMARK.rest.trim())}</span></td></tr>
    <tr><td align="center" class="ink" style="padding-top: 40px; font-family: ${MAIL_TEXT_FACE}; font-size: 24px; line-height: 32px; mso-line-height-rule: exactly; font-weight: 700; color: #202329;">${e(SIGN_IN_TITLE)}</td></tr>
    <tr><td align="center" class="ink2" style="padding-top: 12px; font-family: ${MAIL_TEXT_FACE}; font-size: 16px; line-height: 24px; mso-line-height-rule: exactly; color: #464950;">${e(words.lead.before)}<span class="ink" style="font-weight: 700; color: #202329; word-break: break-word; overflow-wrap: anywhere;">${e(email)}</span>${e(words.lead.after)}</td></tr>
    <tr><td align="center" style="padding-top: 28px;">
      <table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" bgcolor="#0055D5" style="border-radius: 8px; background: #0055D5;">
        <a href="${e(confirmUrl)}" target="_blank" style="display: block; padding: 12px 28px; font-family: ${MAIL_TEXT_FACE}; font-size: 16px; line-height: 24px; mso-line-height-rule: exactly; font-weight: 700; color: #FFFFFF; text-decoration: none; border-radius: 8px;">${e(words.action)}</a>
      </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" class="ink2" style="padding-top: 32px; font-family: ${MAIL_TEXT_FACE}; font-size: 14px; line-height: 20px; mso-line-height-rule: exactly; color: #464950;">${e(words.codeLead)}</td></tr>
    <tr><td style="padding-top: 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td align="center" class="field code ink" bgcolor="#F3F4F6" style="padding: 20px 16px 20px 24px; border-radius: 8px; background: #F3F4F6; font-family: ${MAIL_CODE_FACE}; font-size: 32px; line-height: 40px; mso-line-height-rule: exactly; font-weight: 700; letter-spacing: 8px; color: #202329;">${e(code)}</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" class="ink2" style="padding-top: 20px; font-family: ${MAIL_TEXT_FACE}; font-size: 14px; line-height: 20px; mso-line-height-rule: exactly; color: #464950;">${e(words.limits)}</td></tr>
    <tr><td align="center" class="ink2" style="padding-top: 12px; font-family: ${MAIL_TEXT_FACE}; font-size: 14px; line-height: 20px; mso-line-height-rule: exactly; color: #464950;">${e(words.ignore)}</td></tr>
    </table>
  </td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}

function signInMailText({ email, confirmUrl, code }) {
    const words = SIGN_IN_COPY.mail;
    return [
        SIGN_IN_TITLE,
        "",
        `${words.linkLead.before}${email}${words.linkLead.after}`,
        confirmUrl,
        "",
        `${words.codeLead} ${code}`,
        "",
        words.limits,
        "",
        words.ignore,
        "",
    ].join("\n");
}
