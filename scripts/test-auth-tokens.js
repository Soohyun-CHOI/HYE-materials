// TEMPORARY — NOT for commit. Delete after use.
// Sanity-checks lib/airtable/authTokens.js against the real base:
// create -> consume once (succeeds) -> consume again (rejected) -> expired
// token is rejected. Cleans up after itself.

import { base, TABLES } from "../lib/airtable/client.js";
import { createAuthToken, consumeAuthToken } from "../lib/airtable/authTokens.js";

const results = [];
function check(label, pass, detail) {
    results.push({ label, pass: !!pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
}

async function main() {
    const testEmail = `test.token.${Date.now()}@hyeusa.com`;
    const created = [];

    try {
        // ---- normal lifecycle: create -> consume once -> consume again fails ----
        const { token } = await createAuthToken(testEmail);
        check("createAuthToken returns a token string", typeof token === "string" && token.length > 0, token.slice(0, 8) + "...");

        const record = await base(TABLES.AUTH_TOKENS)
            .select({ filterByFormula: `{Token} = "${token}"`, maxRecords: 1 })
            .firstPage();
        if (record.length) created.push(record[0].id);

        const first = await consumeAuthToken(token);
        check("First consume succeeds, returns the correct email", first?.email === testEmail, JSON.stringify(first));

        const second = await consumeAuthToken(token);
        check("Second consume of the SAME token is rejected (returns null)", second === null, JSON.stringify(second));

        // ---- unknown token ----
        const unknown = await consumeAuthToken("this-token-does-not-exist");
        check("Consuming an unknown token returns null", unknown === null, JSON.stringify(unknown));

        // ---- expired token ----
        const { token: expiredToken } = await createAuthToken(`test.expired.${Date.now()}@hyeusa.com`);
        const expiredRecords = await base(TABLES.AUTH_TOKENS)
            .select({ filterByFormula: `{Token} = "${expiredToken}"`, maxRecords: 1 })
            .firstPage();
        const expiredRecordId = expiredRecords[0].id;
        created.push(expiredRecordId);
        // Manually back-date its expiry to the past.
        await base(TABLES.AUTH_TOKENS).update(expiredRecordId, {
            "Expires At": new Date(Date.now() - 60 * 1000).toISOString(),
        });

        const expiredResult = await consumeAuthToken(expiredToken);
        check("Expired token is rejected even though never used", expiredResult === null, JSON.stringify(expiredResult));
    } finally {
        console.log(`\nCleaning up ${created.length} test record(s)...`);
        for (const id of created) {
            try {
                await base(TABLES.AUTH_TOKENS).destroy(id);
                console.log(`  deleted ${id}`);
            } catch (err) {
                console.log(`  FAILED to delete ${id}: ${err.message}`);
            }
        }
    }

    const passed = results.filter((r) => r.pass).length;
    console.log(`\nSUMMARY: ${passed}/${results.length} checks passed`);
    process.exitCode = passed === results.length ? 0 : 1;
}

main();
