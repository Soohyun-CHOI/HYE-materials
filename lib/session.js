import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getUserByRecordId } from "./airtable/users";
import { PENDING_SIGN_IN_COOKIE, SESSION_COOKIE } from "./cookieLifetime";

if (!process.env.SESSION_SECRET) {
    throw new Error("Missing SESSION_SECRET in environment variables");
}

/**
 * A cookie's options as iron-session takes them: its lifetimes from
 * `lib/cookieLifetime.js`, and the two things that depend on where the app runs.
 *
 * NO LIFETIME IS SET IN THIS FILE, AND THAT IS THE FIX RATHER THAN A STYLE. The
 * session's lived here as a `maxAge` of thirty days with a comment saying so, while
 * iron-session went on sealing it for its default fourteen — a cookie that outlived
 * the session inside it by sixteen days (`docs/notes/authorization.md`). The seal's
 * `ttl` and the cookie's `maxAge` now come from one number each in that module, and
 * `offline/cookie-lifetime.mjs` fails a lifetime written here.
 */
function ironOptions(cookie) {
    return {
        ...cookie,
        password: process.env.SESSION_SECRET,
        cookieOptions: { ...cookie.cookieOptions, secure: process.env.NODE_ENV === "production" },
    };
}

const sessionOptions = ironOptions(SESSION_COOKIE);

/**
 * Reads the current session — for Server Components, Route Handlers, and
 * Server Actions. `.destroy()` signs out.
 *
 * IT IS SAVED IN ONE PLACE, `createSession`, AT SIGN-IN, AND NEVER ON A READ. Saving
 * seals it afresh, which would restart its thirty days: a session lasts thirty days
 * from the sign-in that made it, because a phone handed around a site must not stay
 * signed in as one person for as long as anybody keeps using it.
 *
 * Payload is deliberately minimal: just { userId } (the Airtable record
 * ID). Role / Is Admin / Status are never cached in the session — both
 * promotion to Admin/President and deactivation are manual Airtable edits
 * (per CLAUDE.md) and must take effect immediately, not whenever a
 * long-lived session cookie happens to expire. Route-protection logic
 * re-fetches those fields fresh from Airtable per request instead.
 */
async function getSession() {
    return getIronSession(await cookies(), sessionOptions);
}

export async function createSession(userId) {
    const session = await getSession();
    session.userId = userId;
    await session.save();
    return session;
}

export async function destroySession() {
    const session = await getSession();
    session.destroy();
}

/**
 * Which sign-in email this browser is waiting on — the row a code typed here is
 * checked against (#471).
 *
 * A SECOND SEALED COOKIE RATHER THAN A FIELD IN THE SESSION, because the session's
 * payload is deliberately `{ userId }` and nothing else (above), and because the
 * browser that asks for an email is usually signed out: a session cookie holding a
 * half-finished sign-in would be a session cookie with no session in it.
 *
 * IT HOLDS THE ROW'S RECORD ID AND THE ADDRESS, AND NEVER THE TOKEN OR THE CODE.
 * The token in the asking browser would sign that browser in without anybody
 * opening the email, which is the one thing the email exists to prove; the code
 * here would be the same mistake. The address is only what the screen says the
 * email went to.
 *
 * WHY A COOKIE, WHEN #373 REFUSED ONE FOR THE DESTINATION. That refusal was about
 * the LINK: a scan opens the phone's browser and the email's link opens in the
 * mail client's own view, which often do not share cookies, so a value set at the
 * request would be missing where the link lands. A code is typed into the browser
 * that asked, so it never crosses to another cookie jar — which is also the whole
 * of its value: someone who sees the code, anywhere else, holds nothing.
 *
 * ITS LIFETIME IS THE ROW'S, the seal's and the cookie's both, from
 * `lib/cookieLifetime.js` like the session's.
 */
const pendingSignInOptions = ironOptions(PENDING_SIGN_IN_COOKIE);

async function getPendingSignIn() {
    return getIronSession(await cookies(), pendingSignInOptions);
}

/** Bind this browser to the row it just asked for, replacing any earlier binding. */
export async function writePendingSignIn({ authTokenRecordId, email }) {
    const pending = await getPendingSignIn();
    pending.authTokenRecordId = authTokenRecordId;
    pending.email = email;
    await pending.save();
}

/** The row this browser is waiting on, or null — an expired or forged seal reads as none. */
export async function readPendingSignIn() {
    const pending = await getPendingSignIn();
    if (typeof pending.authTokenRecordId !== "string" || typeof pending.email !== "string") return null;
    return { authTokenRecordId: pending.authTokenRecordId, email: pending.email };
}

/** Forget it: the code step's `Use a different email`, and a code that signed in. */
export async function clearPendingSignIn() {
    const pending = await getPendingSignIn();
    pending.destroy();
}

/**
 * Resolves the current session into the actual User record — or null if
 * not logged in, INCLUDING if the session references a userId that no
 * longer resolves (e.g. the Users record was deleted, or manually edited
 * away, after the session was issued). Airtable's .find() rejects rather
 * than returning null for a missing record, so that failure is caught
 * here and treated the same as "not logged in," not left to crash
 * whatever page called this. Prefer this over calling getSession() +
 * getUserByRecordId() directly.
 *
 * IMPORTANT: only a missing-record error is treated as "not logged in."
 * Confirmed empirically that Airtable reports a nonexistent record ID as
 * { error: "NOT_AUTHORIZED", statusCode: 403 } — not a distinguishable
 * 404 — so that specific code is what's checked for, not a blanket
 * catch. Any other failure (bad API key, rate limiting, a real Airtable
 * outage, network errors) is a genuine infrastructure problem, not an
 * absent user, and must not be silently swallowed as "logged out" —
 * it's logged and re-thrown instead.
 */
export async function getCurrentUser() {
    const session = await getSession();
    if (!session.userId) return null;

    try {
        return await getUserByRecordId(session.userId);
    } catch (err) {
        if (err?.error === "NOT_AUTHORIZED") {
            return null;
        }

        console.error("getCurrentUser: unexpected error resolving session user", err);
        throw err;
    }
}
