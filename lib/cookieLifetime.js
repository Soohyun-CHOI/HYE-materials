/**
 * How long each sealed cookie this app sets lives, and the options that make the
 * seal and the cookie end at the same moment — the session, and the sign-in a code
 * is bound to (#471).
 *
 * A SEALED COOKIE HAS TWO LIFETIMES, AND THE SESSION'S HAD COME APART. iron-session
 * seals a payload with its own `ttl`, checked whenever the seal is opened, and hands
 * the browser a cookie whose `maxAge` decides when the browser drops it. Given a
 * `maxAge`, it derives nothing from it: the `ttl` stays its default, fourteen days.
 * `lib/session.js` set the session cookie's `maxAge` to thirty days, beside a comment
 * saying thirty days, and set no `ttl` — so the cookie lasted thirty days and the
 * seal inside it expired at fourteen, and a reader was signed out on day fourteen
 * holding a cookie that claimed sixteen more. Read off iron-session 8.0.4's
 * `getSessionConfig`, and iron-webcrypto's `unseal`, which refuses a seal past its
 * expiration; `docs/notes/authorization.md` has the rest.
 *
 * SO EACH COOKIE IS ONE NUMBER HERE, AND BOTH OF ITS LIFETIMES ARE THAT NUMBER.
 * `lib/session.js` adds the secret and whether the cookie is `secure` — the two
 * things that depend on where the app runs — and sets no lifetime of its own.
 *
 * THIRTY DAYS FROM SIGN-IN, AND NEVER EXTENDED. A session's seal is written once, by
 * `createSession`, at sign-in. Writing it again on a later request would seal it
 * afresh and restart the thirty days, and a phone passed between people on a site
 * would then stay signed in as whoever last signed in on it for as long as anybody
 * kept using it. The link and the code both end in `lib/auth.js:startSession`, so
 * both sign-ins take this lifetime and no other.
 *
 * Pure, so `offline/cookie-lifetime.mjs` hands exactly these options to iron-session
 * and reads back what it would set.
 */

import { TOKEN_TTL_MINUTES } from "./authTokenState.js";

const DAY_SECONDS = 24 * 60 * 60;

/** How long a session lasts from the moment its owner signs in. */
export const SESSION_DAYS = 30;

/** One cookie, one lifetime: the seal's `ttl` and the cookie's `maxAge` are the same seconds. */
function sealedCookie(cookieName, seconds) {
    return Object.freeze({
        cookieName,
        ttl: seconds,
        cookieOptions: Object.freeze({ httpOnly: true, sameSite: "lax", path: "/", maxAge: seconds }),
    });
}

/** Who a browser is signed in as, for `SESSION_DAYS` from sign-in. */
export const SESSION_COOKIE = sealedCookie("hye_session", SESSION_DAYS * DAY_SECONDS);

/** Which sign-in email a browser is waiting on, for as long as that email's row lives. */
export const PENDING_SIGN_IN_COOKIE = sealedCookie("hye_sign_in", TOKEN_TTL_MINUTES * 60);
