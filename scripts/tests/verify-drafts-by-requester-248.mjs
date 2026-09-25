// Verification for issue #248 — a requester's Drafts, asked of the base.
//
// WHAT IT PROVES: for every user on the base, getDraftsByRequester returns exactly
// the Drafts the walk it replaced returned, in the same order. The walk is kept
// here as the reference — `Users -> "Purchase Requests"`, every request the user
// ever filed, kept to Draft in JS — because it reaches "this user's requests" by a
// road the new read does not share: the user's reverse link, against a status
// filter over the whole table and each row's own `Requester`.
//
// SINCE #440 THE TWO ROADS AGREE ONLY WHILE NO REQUEST NAMES TWO REQUESTERS. The
// reverse link lists a request under every user it names, and the read now takes
// the first one (`lib/prRequester.js`), so a request carrying a second would sit in
// that user's walk and not in their answer. No write path links two.
//
// WHY THIS TIER. The status filter is a formula, and the offline tier never
// executes one (docs/notes/verification.md), so whether the base answers the way
// the code assumes is a question only live rows can settle.
//
// IT CREATES NOTHING, AND ON A BASE WITHOUT DRAFTS IT PROVES NOTHING. Two empty
// lists are equal, so a run needs Drafts on the base — made through the app and
// deleted through it afterwards — and it exits 2 rather than 0 when the base cannot
// make the comparison mean something: no Draft at all, no requester holding two
// (so no order was compared), no requester with a filed request the status filter
// had to leave out, or no requester whose list had to leave out someone else's
// Draft.
//
// WHAT IT MEASURES beside the answer: the operations each call costs, per user.
// The walk is `1 + ceil(N/50)` for a user who filed N requests and reads all N; the
// base's answer is `ceil(D/100)` for D Drafts in the whole base, whoever is reading.
//
// Exit codes: 0 all clear, 1 a list differed or the read cost what it should not,
// 2 the base could not make the comparison mean anything.
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-drafts-by-requester-248.mjs

import { base, TABLES, getLinkedRecords } from "../../lib/airtable/client.js";
import { getDraftsByRequester } from "../../lib/airtable/purchaseRequests.js";
import { resetOps, snapshot } from "../../lib/airtableOps.js";
import { printProvenance } from "./_provenance.mjs";

printProvenance({ title: "verify-drafts-by-requester-248 — a requester's Drafts, asked of the base" });

let pass = true;
function check(label, actual, expected) {
    const ok = actual === expected;
    if (!ok) pass = false;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

/** The walk getDraftsByRequester made until #248, with its own filter and sort. */
async function draftsByWalk(userRecordId) {
    const records = await getLinkedRecords(
        TABLES.USERS,
        userRecordId,
        "Purchase Requests",
        TABLES.PURCHASE_REQUESTS
    );
    const drafts = records
        .filter((record) => record.get("Status") === "Draft")
        .map((record) => ({ prId: record.get("PR ID"), createdAt: record.get("Created At") }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return { filed: records.length, drafts };
}

const users = await base(TABLES.USERS).select({ fields: ["Email"] }).all();

const rows = [];
for (const user of users) {
    resetOps();
    const walk = await draftsByWalk(user.id);
    const walkOps = snapshot().total;

    resetOps();
    const asked = await getDraftsByRequester(user.id);
    const askedOps = snapshot().total;

    rows.push({
        email: user.get("Email") || user.id,
        filed: walk.filed,
        walk: walk.drafts.map((d) => d.prId),
        asked: asked.map((d) => d.prId),
        walkOps,
        askedOps,
    });
}

// Every Draft the app writes names one requester, so the walks together have seen
// each Draft once — which is also every row the base's answer reads, whoever asks.
const draftsInBase = rows.reduce((n, row) => n + row.walk.length, 0);

console.log(`\n${users.length} users, ${draftsInBase} Draft(s) on the base\n`);
console.log("  user                                   filed  drafts  walk ops  asked ops");
for (const row of rows) {
    console.log(
        `  ${row.email.padEnd(38)} ${String(row.filed).padStart(5)} ${String(row.walk.length).padStart(7)} ` +
            `${String(row.walkOps).padStart(9)} ${String(row.askedOps).padStart(10)}`
    );
}

console.log("\nthe same Drafts, in the same order, for every user:");
for (const row of rows) {
    check(`${row.email}`, row.asked.join(", "), row.walk.join(", "));
}

// THE CLAIM THE ISSUE IS ABOUT: the read costs the same for everyone, and it is set
// by the Drafts on the base rather than by what the reader has filed.
const expectedOps = Math.max(1, Math.ceil(draftsInBase / 100));
console.log(`\none query per 100 Drafts on the base, whatever the reader has filed (${expectedOps} expected):`);
for (const row of rows) {
    check(`${row.email} (filed ${row.filed})`, row.askedOps, expectedOps);
}

// ANTI-VACUITY. Each clause names a way the comparison above could pass while
// testing nothing, and a base that allows any of them is reported rather than
// passed.
console.log("\nthe base gave the comparison something to find:");
const conditions = [
    ["at least one Draft on the base", draftsInBase > 0],
    ["a requester holding two or more, so order was compared", rows.some((r) => r.walk.length >= 2)],
    ["a requester whose filed requests include ones that are not Drafts", rows.some((r) => r.filed > r.walk.length)],
    ["a requester whose list had to leave out someone else's Draft", rows.some((r) => r.walk.length < draftsInBase)],
];
for (const [label, ok] of conditions) console.log(`  ${ok ? "yes" : "NO "}  ${label}`);
const meaningful = conditions.every(([, ok]) => ok);

console.log("\n" + "=".repeat(56));
if (!pass) {
    console.log("SOME CHECKS FAILED");
    process.exit(1);
}
if (!meaningful) {
    console.log("NOTHING FAILED, AND THE BASE COULD NOT MAKE THE COMPARISON MEAN ANYTHING");
    process.exit(2);
}
console.log("ALL CHECKS PASS");
process.exit(0);
