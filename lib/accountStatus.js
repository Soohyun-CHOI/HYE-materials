// Whether a `Users` row may hold a session (#491), and how a page that finds one that may not
// hands the ending of its session to a route.
//
// AN ACCOUNT THAT IS OFF IS TOLD SO ON THE SIGN-IN SCREEN, AND ONLY ONCE ITS ADDRESS IS PROVEN.
// The office turns an account off by setting `Status` to `Inactive` by hand, as it promotes and
// assigns by hand. Until #491 such a person finished signing in and was sent back to the
// sign-in screen with nothing said, and one turned off while signed in was sent there the same
// way from the next page. Now both land on the screen's deactivated step (Sign in 1m) — but
// only a browser that has shown the address is its own reaches it: one that spent the email's
// link or typed its code, or one holding the session the address signed in. Asking for an email
// still reads no `Users` row and answers every company address alike (`lib/auth.js`), so
// nothing on the screen says, before that, whether an address has an account or whether it is
// off.
//
// THIS IS THE ONE JUDGMENT. `lib/authz.js` asks it of the session's row on every gate, and
// `lib/auth.js` of the row a sign-in finds, so the gate that refuses a session and the sign-in
// that refuses to make one cannot disagree. `Active` and nothing else admits: a blank `Status`
// held no session before this either, and it is told what an `Inactive` one is told, since the
// office is who can change it. Two Airtable formulas in `lib/airtable/users.js` filter on the
// same word to list the people a request may name, which a formula has to spell for itself.
//
// A PAGE CANNOT END A SESSION, SO IT HANDS THE ENDING TO A ROUTE, SEALED. A gate runs inside a
// Server Component's render, and Next refuses a cookie write there. So the page redirects to
// `GET /api/auth/deactivated` carrying a seal of what it found — this user's row is off — and
// the route ends the session and writes the screen's notice only when the browser's own session
// is that user's. Nothing is read from the base again: the seal is the page's finding, made
// with the session's secret, and good for a minute. A forged or altered one does not open, an
// old one has expired, and one opened in another browser names a session that browser does not
// hold — so the address cannot be used to put the sentence in front of anybody else.
//
// PURE AND OFFLINE-SAFE: it imports iron-session alone, which runs under plain `node`, and
// takes the secret as an argument, so `offline/deactivated-account.mjs` can seal and open.

import { sealData, unsealData } from "iron-session";

const ACTIVE = "Active";

/**
 * Whether this person's row may hold a session. `Active` and nothing else admits, so a
 * missing user, a blank `Status` and any other value read as no.
 */
export function isActiveAccount(user) {
    return user?.status === ACTIVE;
}

/** The route a page hands a deactivated session's ending to, and the parameter the seal rides in. */
export const DEACTIVATED_PATH = "/api/auth/deactivated";
export const HANDOFF_PARAM = "handoff";

/**
 * How long a page's finding is good for, in seconds. The route is the next request the
 * browser makes, so a minute is ample; iron allows a further minute of clock skew.
 */
export const HANDOFF_SECONDS = 60;

/**
 * The seal's one key. A session cookie seals `{ userId }` with the same secret, so the key is
 * what keeps a session's own seal — which its holder can copy out of the browser — from
 * opening as a finding that the account is off.
 */
const HANDOFF_KEY = "deactivatedUserId";

/** Seal the finding that this user's row is off, for the route to act on. */
export async function sealDeactivatedHandoff(userId, password) {
    return sealData({ [HANDOFF_KEY]: userId }, { password, ttl: HANDOFF_SECONDS });
}

/**
 * The user a seal says is off, or null — for anything that is not a seal this module made
 * within the last minute.
 */
export async function openDeactivatedHandoff(value, password) {
    if (typeof value !== "string" || value.length === 0) return null;
    try {
        const opened = await unsealData(value, { password, ttl: HANDOFF_SECONDS });
        const userId = opened?.[HANDOFF_KEY];
        return typeof userId === "string" && userId.length > 0 ? userId : null;
    } catch {
        return null;
    }
}

/** The route's address, carrying the seal. */
export function deactivatedPath(handoff) {
    return `${DEACTIVATED_PATH}?${HANDOFF_PARAM}=${encodeURIComponent(handoff)}`;
}
