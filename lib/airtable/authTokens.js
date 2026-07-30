import crypto from "crypto";
import { base, TABLES, withKeyLock } from "./client";
import { formulaString } from "../airtableFormula";

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

/**
 * Look a token up by its value. THE most exposed formula interpolation in the
 * app and the reason #159 exists: `token` arrives as a raw query param on
 * /api/auth/verify, which is public by design — no session, no role, no origin
 * check stands in front of it. Without the escape, `" & {Token} & "` turns this
 * predicate into `{Token} = {Token}`, true for every row, and `maxRecords: 1`
 * then returns an ARBITRARY token record instead of none. Measured read-only on
 * the live base (#159): it returned the table's first row, out of 46.
 *
 * consumeAuthToken below is why that matters. It takes whatever row came back,
 * and if that row happens to be unused and unexpired it returns its `Email` —
 * a session as whoever the row belongs to, for a caller who supplied no valid
 * token at all. The row is not attacker-chosen, so this is not a reliable
 * takeover; it is an unauthenticated lottery over a table of live tokens, and
 * that is not a distinction worth relying on.
 *
 * WHY THIS IS EXPORTED, since it was module-private until #159 and the next
 * reader will reasonably ask. `scripts/tests/verify-formula-escaping-159.mjs`
 * has to exercise THIS lookup, not a copy of it: re-typing the formula in the
 * check is the mirror test #147 deleted, which passes with the fix removed. So
 * the export exists to make the check honest.
 *
 * What the export does and does not widen:
 *   - It is a `.select()` and nothing else. No create, no update, no destroy, so
 *     it adds no write path. `consumeAuthToken` below remains the ONLY thing
 *     that writes `Used: true`, and the only thing that returns an `Email` for a
 *     session to be built from — it is not exported any more widely than before.
 *   - It cannot mint a session. It returns an Airtable record; turning one into
 *     a session needs consumeAuthToken plus lib/session.js.
 *   - Reach is server-side only, like every other lib/airtable export:
 *     AIRTABLE_API_KEY is server-side and this module is never in the client
 *     bundle. So the new capability is "other server code in this repo can ask
 *     whether a token row exists, without consuming it".
 *   - Callers today are exactly two: consumeAuthToken below, and that check.
 *     No route, no Server Action, no page imports it.
 *
 * Note that `scripts/tests/offline/authz-structure.mjs` does NOT cover this.
 * It scans app/ and lib/, but only enumerates the exports of route.js files under
 * app/api/ and of files carrying a top-level "use server" — this module is neither,
 * so a new export here is not an endpoint in that inventory and nothing there
 * has to be updated. That is correct rather than a gap: the export is not
 * directly callable by a client. If this module ever gains a "use server"
 * directive, every export in it becomes an endpoint and that check will start
 * demanding a wrapper or an exemption for each.
 */
export async function getAuthTokenRecord(token) {
    const records = await base(TABLES.AUTH_TOKENS)
        .select({
            filterByFormula: `{Token} = "${formulaString(token)}"`,
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
