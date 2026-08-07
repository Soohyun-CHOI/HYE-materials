import { withKeyLock } from "./airtable/client";
import { createAuthToken, consumeAuthToken } from "./airtable/authTokens";
import { getUserByEmail, createUser } from "./airtable/users";
import { sendMagicLinkEmail } from "./email";
import { createSession } from "./session";

if (!process.env.ALLOWED_EMAIL_DOMAIN) {
    throw new Error("Missing ALLOWED_EMAIL_DOMAIN in environment variables");
}

const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN.toLowerCase();

export function isCompanyEmail(email) {
    return typeof email === "string" && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

/**
 * Step 1 of the magic-link flow: validates the domain, issues a token,
 * emails the link. Deliberately does NOT touch the Users table yet — a
 * Users record only gets created once the token is actually verified (see
 * verifyMagicLink below), so an unconfirmed signup attempt never creates
 * an orphaned Employee row for an email nobody has proven they control.
 */
export async function requestMagicLink(email, { baseUrl }) {
    if (!isCompanyEmail(email)) {
        throw new Error("Email must be a company address");
    }

    // Points at the confirmation PAGE, not at the consuming endpoint (#203).
    // Opening this URL reads the token and spends nothing, so a mail security
    // scanner following the link ahead of the recipient leaves it usable.
    const { token } = await createAuthToken(email);
    const confirmUrl = `${baseUrl}/login/confirm?token=${token}`;
    await sendMagicLinkEmail({ to: email, confirmUrl });
}

/**
 * Step 3 since #203, and unchanged by it: consumes the token, finds or creates
 * the User, starts a session. Throws if the token is invalid/expired/already
 * used. What moved is only what reaches this — a form POST from
 * /login/confirm rather than the recipient's own click on a GET.
 *
 * The find-or-create is wrapped in withKeyLock keyed by the normalized
 * email — without it, two valid tokens for the same brand-new email
 * consumed close together (e.g. the user clicked "resend" and then opened
 * both links) could each see "no existing user" and each call createUser,
 * creating two duplicate Employee records for one person. Same
 * read-then-write race as generateChildId/upsertMaterial, same fix.
 */
export async function verifyMagicLink(token) {
    const result = await consumeAuthToken(token);
    if (!result) {
        throw new Error("This link is invalid or has expired");
    }

    const email = result.email;
    const userId = await withKeyLock(`user-email:${email.toLowerCase()}`, async () => {
        const existing = await getUserByEmail(email);
        if (existing) return existing.id;

        const created = await createUser({
            userName: email.split("@")[0],
            email,
        });
        return created.id;
    });

    await createSession(userId);
    return { userId, email };
}
