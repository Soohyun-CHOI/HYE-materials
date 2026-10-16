// Which Airtable base a run reaches (#534): the live base, whose id is written here
// and nowhere else, and the test base every run takes unless it names the live one.
//
// WHY TWO. From 2026-10-15 the base the deployment serves holds the site's real
// records (#531), so nothing that writes can run there to prove itself. The test
// base, `Material Purchases (Test)`, is a copy of it made on 2026-10-16 with every
// record: the same 26 tables and 313 fields, the same table and field ids, and the
// same rows, compared field by field and counted table by table that day. Local
// development, every script and every preview deployment reach it.
//
// A RUN REACHES THE LIVE BASE BY NAMING IT, IN ONE OF TWO WAYS: `AIRTABLE_BASE=live`
// in its environment, or being the production deployment, which Vercel marks with
// `VERCEL_ENV=production` and marks no other way. Nothing else reaches it. Its id is
// a constant below rather than a variable, so no `.env.local` can carry it into a
// run — `AIRTABLE_BASE_ID` held it until #534 and is read nowhere now, and a test
// base id equal to it is refused, which is what an old `.env.local` with its value
// copied across would be. `AIRTABLE_BASE` takes `live` and nothing else: a value it
// does not know is refused rather than read as the test base, so `Live` or `prod`
// cannot stand for a name the run did not give.
//
// EACH BASE HAS ITS OWN KEY. The live base is reached with `AIRTABLE_API_KEY`, the
// test base with `AIRTABLE_TEST_API_KEY` and `AIRTABLE_TEST_BASE_ID`; on 2026-10-16
// each key listed its own base and no other. So a run handed the wrong key is
// refused by Airtable as well as by this module, and an environment holding only
// the test pair — what Vercel's Preview and Development scopes carry since #534 —
// cannot reach the live base at all.
//
// WHAT IT CANNOT SEE. A name given to a shell rather than to one command outlives
// that command: PowerShell's `$env:AIRTABLE_BASE = "live"` holds until the window
// closes, so every run after it in that window reaches the live base too. That has
// not happened; `lib/airtable/client.js` warns on each process that names the live
// base outside the deployment, and `scripts/tests/_provenance.mjs` prints the base
// a run reached, so a run that took the name by accident says so on its first line.
//
// IMPORTS NOTHING, so the client, every script — `scripts/import/`'s and
// `scripts/demo/`'s REST scripts run with no loader — `scripts/protectedTables.mjs`
// and the offline tier all import it, and the Python scripts ask it through `node`
// (`scripts/import/airtable_base.py`).

/** The base the deployment serves, and the one id in this repository's code that reaches it. */
export const LIVE_BASE_ID = "appZphZhJC7kMO83e";

/** The one value `AIRTABLE_BASE` takes. */
const LIVE_NAME = "live";

function read(env, name) {
    const value = env?.[name];
    return typeof value === "string" ? value.trim() : "";
}

/**
 * The base a run reaches, read from its environment: `{ baseId, apiKey,
 * apiKeyVariable, live, namedBy }`. The test base unless the run names the live
 * one — `namedBy` says how, and is null on the test base. Throws, naming the
 * variable, on a missing key or id, on a test base id that is the live base's, and
 * on an `AIRTABLE_BASE` other than `live`.
 */
export function resolveAirtableBase(env = process.env) {
    const named = read(env, "AIRTABLE_BASE");
    if (named !== "" && named !== LIVE_NAME) {
        throw new Error(
            `AIRTABLE_BASE is "${named}", and the one value it takes is "${LIVE_NAME}" — ` +
                "leave it unset to reach the test base"
        );
    }
    const production = read(env, "VERCEL_ENV") === "production";
    if (production || named === LIVE_NAME) {
        const apiKey = read(env, "AIRTABLE_API_KEY");
        if (!apiKey) throw new Error("Missing AIRTABLE_API_KEY in environment variables — the live base's key");
        return {
            baseId: LIVE_BASE_ID,
            apiKey,
            apiKeyVariable: "AIRTABLE_API_KEY",
            live: true,
            namedBy: production ? "VERCEL_ENV=production" : "AIRTABLE_BASE=live",
        };
    }
    const apiKey = read(env, "AIRTABLE_TEST_API_KEY");
    if (!apiKey) throw new Error("Missing AIRTABLE_TEST_API_KEY in environment variables — the test base's key");
    const baseId = read(env, "AIRTABLE_TEST_BASE_ID");
    if (!baseId) throw new Error("Missing AIRTABLE_TEST_BASE_ID in environment variables");
    if (baseId === LIVE_BASE_ID) {
        throw new Error(
            "AIRTABLE_TEST_BASE_ID names the live base — a run reaches it only by naming it, with AIRTABLE_BASE=live"
        );
    }
    return { baseId, apiKey, apiKeyVariable: "AIRTABLE_TEST_API_KEY", live: false, namedBy: null };
}

/** The base a resolved run reaches, in words: `test base appXXX`, or `LIVE base appXXX (named by …)`. */
export function describeAirtableBase({ baseId, live, namedBy }) {
    return live ? `LIVE base ${baseId} (named by ${namedBy})` : `test base ${baseId}`;
}
