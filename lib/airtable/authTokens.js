import crypto from "crypto";
import { base, TABLES, withKeyLock } from "./client";

const TOKEN_TTL_MINUTES = 15;

/**
 * Issues a new magic-link token for an email. Doesn't invalidate any
 * previously issued, still-unused tokens for the same email — each token
 * is independently single-use and expires on its own, so a few outstanding
 * valid links (e.g. from clicking "resend") is harmless.
 */
export async function createAuthToken(email) {
    const token = crypto.randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000);

    await base(TABLES.AUTH_TOKENS).create({
        Token: token,
        Email: email,
        "Expires At": expiresAt.toISOString(),
        Used: false,
        "Created At": now.toISOString(),
    });

    return { token, email, expiresAt: expiresAt.toISOString() };
}

async function getAuthTokenRecord(token) {
    const records = await base(TABLES.AUTH_TOKENS)
        .select({
            filterByFormula: `{Token} = "${token}"`,
            maxRecords: 1,
        })
        .firstPage();

    return records.length === 0 ? null : records[0];
}

/**
 * Validates and consumes a token in one step: returns null if the token
 * doesn't exist, was already used, or has expired; otherwise marks it used
 * and returns the email it was issued for.
 *
 * Wrapped in a per-token lock (withKeyLock) so the same token can't be
 * consumed twice by two near-simultaneous requests — same
 * read-then-write race as generateChildId/upsertMaterial, same fix.
 */
export async function consumeAuthToken(token) {
    return withKeyLock(`auth-token:${token}`, async () => {
        const record = await getAuthTokenRecord(token);
        if (!record) return null;
        if (record.get("Used")) return null;
        if (new Date(record.get("Expires At")).getTime() < Date.now()) return null;

        await base(TABLES.AUTH_TOKENS).update(record.id, { Used: true });
        return { email: record.get("Email") };
    });
}
