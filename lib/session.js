import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { getUserByRecordId } from "./airtable/users";

if (!process.env.SESSION_SECRET) {
    throw new Error("Missing SESSION_SECRET in environment variables");
}

export const sessionOptions = {
    cookieName: "hye_session",
    password: process.env.SESSION_SECRET,
    cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
    },
};

/**
 * Reads the current session — for Server Components, Route Handlers, and
 * Server Actions. Call .save() after mutating it, .destroy() to log out.
 *
 * Payload is deliberately minimal: just { userId } (the Airtable record
 * ID). Role / Is Admin / Status are never cached in the session — both
 * promotion to Admin/President and deactivation are manual Airtable edits
 * (per CLAUDE.md) and must take effect immediately, not whenever a
 * long-lived session cookie happens to expire. Route-protection logic
 * re-fetches those fields fresh from Airtable per request instead.
 */
export async function getSession() {
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
 * Confirmed empirically (scripts/inspect-airtable-errors.js, not
 * committed) that Airtable reports a nonexistent record ID as
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
