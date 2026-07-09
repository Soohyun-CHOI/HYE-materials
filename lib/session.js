import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

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
