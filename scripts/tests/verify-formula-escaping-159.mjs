// Formula-escaping — credentialed, READ-ONLY (#159).
//
// This is an AUTHORIZATION check, not a tidiness check. Before #159 every value
// interpolated into a filterByFormula was formula code, not data. The worst case
// is the magic-link lookup: `token` reaches it raw from an UNAUTHENTICATED
// caller — /api/auth/verify then, the /login/confirm page and that route's POST
// since #203 — and a crafted value made the predicate a tautology, so the lookup
// returned an arbitrary Auth Tokens row instead of none.
//
// What only a credentialed run can settle, and why the offline tier is not
// enough on its own:
//   A — that backslash + double quote is the COMPLETE escape set. That is a
//       property of Airtable's parser, not of this repo. The offline check pins
//       what formulaString outputs; only this can show the output is inert.
//   B — that the real production lookups now refuse a crafted value. Called
//       through the exported functions, never through a re-typed copy of their
//       formulas: a hand-copy is the mirror test #147 deleted, because it passes
//       with the fix removed.
//
// SAFETY. Every query here is a .select(). Nothing is created, updated or
// deleted; no token is consumed (consumeAuthToken is never called, only the
// read-only getAuthTokenRecord); no session is minted. The one raw, unescaped
// formula in Part B is a control — it demonstrates the fixture value really is
// hostile, which is what makes "returns null" mean anything. It is a select too.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-formula-escaping-159.mjs
//
// Exit codes: 0 all clear, 1 something failed, 2 clean but incomplete.

import { formulaString } from "../../lib/airtableFormula.js";
import { base, TABLES } from "../../lib/airtable/client.js";
import { getAuthTokenRecord } from "../../lib/airtable/authTokens.js";
import { getVendorByName, getAllVendors } from "../../lib/airtable/vendors.js";
import { getJobByCode } from "../../lib/airtable/jobs.js";
import { getPRById } from "../../lib/airtable/purchaseRequests.js";
import { getPOById, searchPOs } from "../../lib/airtable/purchaseOrders.js";
import { getInvoiceById } from "../../lib/airtable/invoices.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { getMaterialByKey } from "../../lib/airtable/materials.js";

let pass = true;
let incomplete = null;

function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    return ok;
}
function assert(label, ok) {
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}`);
    return Boolean(ok);
}

/**
 * The hostile battery. Kept local rather than shared with
 * scripts/tests/offline/formula-escaping.mjs on purpose: that file asserts what
 * formulaString OUTPUTS, this one asserts what Airtable DOES with the output.
 * Different claims, and a shared list would make one file's failure look like
 * the other's.
 *
 * TAUTOLOGY is the one that matters — the rest are the surrounding surface.
 */
const HOSTILE = [
    ["the tautology", '" & {Vendor Name} & "'],
    ["formula code", 'IF(1, "x", "y")'],
    ["a bare quote", '2"'],
    ["a backslash", "a\\b"],
    ["backslash then quote", 'a\\"b'],
    ["a trailing backslash", "a\\"],
    ["a doubled backslash", "a\\\\b"],
    ["a field reference", "{Vendor Name}"],
    ["single quotes", "'q'"],
    ["mixed punctuation", "a'b\"c\\d,e(f)g&h"],
    ["a real newline", "a\nb"],
    ["a real tab", "a\tb"],
    ["a caret and percent", "a^b%c"],
    ["curly braces reversed", "}{"],
    ["unicode and emoji", "Ünïcödé 🔧"],
    ["an empty string", ""],
    ["a lone ampersand", "&"],
];

// ---------------------------------------------------------------------------
console.log("\nPart A — is backslash + double quote the COMPLETE escape set?");
console.log("Each value is escaped and compared against {Vendor Name}. No vendor");
console.log("carries any of these names, so each must be ACCEPTED and match NOTHING;");
console.log("a match means the value escaped its literal and made the predicate true.\n");

const vendorRows = (await base(TABLES.VENDORS).select().all()).length;
console.log(`  (Vendors holds ${vendorRows} rows — enough for a tautology to show up)`);
if (vendorRows === 0) incomplete = "Vendors is empty, so a tautology could not be distinguished from a miss";

for (const [label, value] of HOSTILE) {
    let outcome;
    try {
        const recs = await base(TABLES.VENDORS)
            .select({ filterByFormula: `{Vendor Name} = "${formulaString(value)}"` })
            .all();
        // An empty string is the one value a real vendor could plausibly not
        // have but which matches a blank name; treat >0 as a leak regardless and
        // let the label explain it.
        outcome = recs.length === 0 ? "inert" : `MATCHED ${recs.length}`;
    } catch (err) {
        outcome = `REJECTED: ${err.error || err.message}`;
    }
    check(`escaped, ${label}`, outcome, "inert");
}

// ---------------------------------------------------------------------------
console.log("\nPart B — the auth path, through the real production lookup:");
console.log("getAuthTokenRecord is read-only; consumeAuthToken is never called.\n");

const tokenRows = await base(TABLES.AUTH_TOKENS).select().all();
console.log(`  (Auth Tokens holds ${tokenRows.length} rows; first id = ${tokenRows[0]?.id ?? "none"})`);
if (tokenRows.length === 0) {
    incomplete = "Auth Tokens is empty, so the tautology had nothing to select";
}

// Control: the formula as it stood BEFORE #159, run raw. Not a check of
// production code — it exists so that the PASSes below mean "the escape stopped
// a live attack" rather than "the value was harmless all along".
let controlRows = null;
try {
    const recs = await base(TABLES.AUTH_TOKENS)
        .select({ filterByFormula: `{Token} = "${'" & {Token} & "'}"`, maxRecords: 1 })
        .firstPage();
    controlRows = recs.length;
    console.log(
        `  CONTROL (pre-#159 formula, unescaped): ${recs.length} record(s)` +
        (recs[0] ? `, id=${recs[0].id}${recs[0].id === tokenRows[0]?.id ? " — the table's first row" : ""}` : "")
    );
} catch (err) {
    console.log(`  CONTROL: rejected (${err.error || err.message})`);
}
assert(
    "the control confirms the value IS hostile (unescaped, it selects a row)",
    controlRows === 1
);

const AUTH_ATTACKS = [
    ["the tautology", '" & {Token} & "'],
    ["formula code evaluating to a tautology", '" & IF(1, {Token}, "x") & "'],
    ["a bare quote (the benign 422 case)", 'bad"quote'],
    ["a tautology using a different field", '" & {Email} & {Email} & "'],
    ["an always-true comparison", '" & IF(1=1, {Token}, "") & "'],
];

for (const [label, token] of AUTH_ATTACKS) {
    let outcome;
    try {
        outcome = (await getAuthTokenRecord(token)) === null ? "null" : "A RECORD";
    } catch (err) {
        outcome = `threw: ${err.error || err.message}`;
    }
    check(`getAuthTokenRecord refuses ${label}`, outcome, "null");
}

// A real token still resolves — the escape must not have broken the happy path.
// Read-only: found, not consumed.
const liveToken = tokenRows.find((r) => r.get("Token"));
if (liveToken) {
    const found = await getAuthTokenRecord(liveToken.get("Token"));
    check("and a genuine token still resolves to its own row", found?.id, liveToken.id);
} else {
    incomplete = "no Auth Tokens row carried a Token value, so the happy path was not exercised";
    console.log("  SKIP  no token value available for the happy-path check");
}

// ---------------------------------------------------------------------------
console.log("\nPart C — every other lookup that interpolates, through its real function:");
console.log("(each fed the tautology shaped for its own field)\n");

const vendors = await getAllVendors();
const realVendor = vendors[0];

const LOOKUPS = [
    ["getVendorByName", () => getVendorByName('" & {Vendor Name} & "')],
    ["getJobByCode", () => getJobByCode('" & {Job Code} & "')],
    ["getPRById", () => getPRById('" & {PR ID} & "')],
    ["getPOById", () => getPOById('" & {PO ID} & "')],
    ["getInvoiceById", () => getInvoiceById('" & {Invoice ID} & "')],
    ["getUserByEmail", () => getUserByEmail('" & {Email} & "')],
    ["getMaterialByKey", () => getMaterialByKey({ itemName: '" & {Item Name} & "', size: "", unit: "EA" })],
];

for (const [name, call] of LOOKUPS) {
    let outcome;
    try {
        outcome = (await call()) === null ? "null" : "A RECORD";
    } catch (err) {
        outcome = `threw: ${err.error || err.message}`;
    }
    check(`${name} refuses the tautology`, outcome, "null");
}

// searchPOs is the odd one: SEARCH() over a substring, so "matches nothing" is
// the claim rather than "returns null". Its escape predates #159 (added in #18);
// included so the whole surface is covered by one run.
const searched = await searchPOs('" & {PO ID} & "');
check("searchPOs matches nothing for the tautology", searched.length, 0);
const searchedReal = await searchPOs("HYE-PO-");
assert(
    `searchPOs still works on a real prefix (${searchedReal.length} PO(s) matched)`,
    searchedReal.length > 0
);

// And the happy path on a normal lookup, so Part C cannot pass by everything
// being broken.
if (realVendor) {
    const byName = await getVendorByName(realVendor.vendorName);
    check("a real vendor name still resolves", byName?.id, realVendor.id);
} else {
    incomplete = "no vendors in the base, so the lookup happy path was not exercised";
}

// ---------------------------------------------------------------------------
console.log("\n" + "=".repeat(60));
if (!pass) console.log("SOME CHECKS FAILED");
else if (incomplete) console.log(`INCOMPLETE — no failures, but: ${incomplete}`);
else console.log("ALL CHECKS PASS — nothing was written, no token consumed");
process.exit(!pass ? 1 : incomplete ? 2 : 0);
