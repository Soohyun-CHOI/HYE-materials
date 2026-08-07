/**
 * Whether a magic-link token can still be used, and what to say when it cannot
 * (#203).
 *
 * WHY THIS IS A MODULE RATHER THAN AN `if` CHAIN IN TWO PLACES. Until #203 the
 * rule lived inside `consumeAuthToken`, which was fine while consuming was the
 * only thing anyone did with a token. The confirmation page now has to reach the
 * same judgment WITHOUT consuming — that is the whole issue — so the rule would
 * otherwise have had a second implementation, and the two would decide the same
 * question in two places. Same reasoning as `lib/quotationReuse.js`.
 *
 * Pure and dependency-free, so `offline/auth-token-state.mjs` can pin every
 * clause and `app/login/page.js` (a Client Component) can read the TTL from it.
 */

/**
 * The token's lifetime, and the ONE place the number lives.
 *
 * It was a module-private constant in `lib/airtable/authTokens.js` while three
 * separate copy strings also said "15 minutes" in prose. That module is
 * credentialed — it reaches `lib/airtable/client.js`, which throws at module
 * load without `AIRTABLE_API_KEY` — so no page and no offline check could read
 * it, which is exactly why the prose had to repeat it. Here every reader can.
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
 * Classify a token from plain values — never an Airtable record, which is what
 * keeps this module offline-safe. Callers project the record; both do it the
 * same way.
 *
 * PRECEDENCE IS `missing` -> `invalid` -> `used` -> `expired` -> `valid`, and
 * only one pair is a real choice: a token that is BOTH used and expired reports
 * `used`. That is the more informative of the two — it says the link worked
 * once, which tells the reader their earlier click succeeded, where "expired"
 * would suggest they were simply too slow.
 *
 * AN UNPARSEABLE OR ABSENT `expiresAt` IS TREATED AS EXPIRED, which is a
 * deliberate tightening of what `consumeAuthToken` did before #203. The old
 * comparison was `new Date(expiresAt).getTime() < Date.now()`, and `NaN < n` is
 * false, so a row whose `Expires At` was blank or malformed would never expire —
 * a token good forever, from a field nobody in the app writes by hand but which
 * the Airtable UI can empty in one click. Failing closed costs a legitimate user
 * one "request a new link"; failing open costs an unbounded credential.
 *
 * The boundary itself is unchanged: expiry is `expiresAt < now`, so a token
 * examined at exactly its expiry instant is still valid.
 */
export function describeToken({ token, exists, used, expiresAt } = {}, now = Date.now()) {
    if (typeof token !== "string" || token.length === 0) return TOKEN_STATES.MISSING;
    if (!exists) return TOKEN_STATES.INVALID;
    if (used === true) return TOKEN_STATES.USED;

    const expiryMs = new Date(expiresAt).getTime();
    if (!Number.isFinite(expiryMs) || expiryMs < now) return TOKEN_STATES.EXPIRED;

    return TOKEN_STATES.VALID;
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
