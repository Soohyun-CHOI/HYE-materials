import { base, TABLES, findByRecordIds } from "./client";
import { formulaString } from "../airtableFormula";

/**
 * Find a user by email (used at login).
 * Returns null if not found — callers decide what that means (e.g. "not signed up yet").
 */
export async function getUserByEmail(email) {
    const records = await base(TABLES.USERS)
        .select({
            filterByFormula: `LOWER({Email}) = LOWER("${formulaString(email)}")`,
            maxRecords: 1,
        })
        .firstPage();

    if (records.length === 0) return null;

    return recordToUser(records[0]);
}

/**
 * Find a user by their Airtable record ID — used to resolve a session's
 * userId into the actual user (role, status, etc.) on each request.
 * Returns null if not found (e.g. the record was deleted after the
 * session was issued).
 */
export async function getUserByRecordId(recordId) {
    const record = await base(TABLES.USERS).find(recordId);
    if (!record) return null;
    return recordToUser(record);
}

/**
 * Many users by record id, batched (#193) — for a screen that has to name the
 * people on rows it already holds.
 *
 * A DIFFERENT SHAPE FROM THE CHILD FAN-OUT, and worth saying so because the
 * remedy is the same batching. `findChildRecords` reads the children a parent's
 * link array names; this reads an arbitrary SET of ids gathered from rows already
 * in hand — `/prs` collects one per distinct requester, `/prs/[prId]` one per
 * distinct requester, signer, correction participant and edit-log author. There
 * is no parent to walk and no order to preserve, since every caller turns the
 * result into a lookup map keyed by id.
 *
 * IT IS ALSO THE ONE BATCHED PATH #193's FRESHNESS QUESTION DOES NOT REACH. A
 * Users record appears as a side effect of a first magic-link sign-in and in no
 * other way, so it is never seconds old at render time — unlike a PR Item, which
 * a Draft re-save creates moments before it is read back.
 *
 * A missing id yields no row rather than a null placeholder, matching
 * findByRecordIds; callers already filter, because getUserByRecordId could
 * return null for a deleted record too.
 */
export async function getUsersByRecordIds(recordIds) {
    const records = await findByRecordIds(TABLES.USERS, recordIds);
    return records.map(recordToUser);
}

function recordToUser(record) {
    return {
        id: record.id,
        userName: record.get("User Name"),
        email: record.get("Email"),
        phone: record.get("Phone"),
        role: record.get("Role"),
        isAdmin: record.get("Is Admin") || false,
        status: record.get("Status"),
        assignedJobs: record.get("Assigned Jobs") || [],
        // Issue #143 — the child rows that name this user, carried so
        // canViewPR can intersect them with the same two arrays on a PR
        // record. `PR Signers` is every signer row where this user is the
        // Signer; `Correction Requests (Sent To)` is every correction sent to
        // them. Both are plain link arrays on the Users record, so the whole
        // chain-participation test costs no extra read on any page.
        signerRowIds: record.get("PR Signers") || [],
        correctionRowIds: record.get("Correction Requests (Sent To)") || [],
    };
}

/**
 * Finds the (expected-single) active President — needed for the PO PDF's
 * signature block (issue #13), since President Signed/At on a PO is just
 * a checkbox + timestamp with no link field recording *which* User signed.
 * Assumes exactly one active President exists in practice; returns the
 * first match if that assumption is ever violated, null if none.
 */
export async function getPresidentUser() {
    const records = await base(TABLES.USERS)
        .select({
            filterByFormula: `AND({Role} = "President", {Status} = "Active")`,
            maxRecords: 1,
        })
        .firstPage();

    return records.length === 0 ? null : recordToUser(records[0]);
}

/**
 * List all active Users — used to populate the signer picker on the PR
 * creation form. Both Employee and President can be assigned as signers
 * (the signing chain is an arbitrary ordered list of people, not a fixed
 * panel by Role — see CLAUDE.md's PR Signers entry), so this doesn't
 * filter by Role, only Status.
 */
export async function getActiveUsers() {
    const records = await base(TABLES.USERS)
        .select({
            filterByFormula: `{Status} = "Active"`,
        })
        .all();

    return records.map(recordToUser);
}

/**
 * Create a new user record — called after successful email-domain signup.
 * Always creates as plain Employee, never Admin/President — that promotion
 * happens manually in Airtable, per the auth design decision.
 */
export async function createUser({ userName, email, phone }) {
    const record = await base(TABLES.USERS).create({
        "User Name": userName,
        Email: email,
        Phone: phone || "",
        Role: "Employee",
        "Is Admin": false,
        Status: "Active",
    });

    return { id: record.id, email: record.get("Email") };
}

/**
 * Put a Job on a user's `Assigned Jobs`, additively (#205).
 *
 * ITS ONE CALLER IS `scripts/demo/seed_demo_fixtures.mjs`, AND THAT IS THE
 * INTENDED END STATE rather than a consumer that has not arrived yet. Nothing
 * in `app/` calls it and nothing should: assigning a Job to a real user is an
 * organizational decision this base makes by hand, alongside promotion to Admin
 * and deactivation. What needed a programmatic path was the fixture account,
 * because a fixture that needs a manual step after every seed is missing
 * exactly when somebody reaches for it. Written down because #182 audits `lib/`
 * exports with no caller, and treats a countable claim in a comment — "the only
 * writer", any figure — as the same class of thing to keep true.
 *
 * THE ONLY WRITER OF THAT FIELD, AND IT DID NOT EXIST BEFORE. `createUser`
 * above never sets it, there is no `updateUser`, and no route or Server Action
 * touches it — assignment has always been a hand edit in Airtable.
 *
 * ADDITIVE AND IDEMPOTENT, NEVER A REPLACEMENT. It reads the current list and
 * writes only if the Job is absent, so re-running the seed cannot drop an
 * assignment somebody made by hand — the same import-not-sync posture
 * `seed_demo_fixtures.mjs` takes for every other record it touches. A `set`
 * that overwrote the array would make the seed destructive on a base whose
 * assignments nobody else records.
 *
 * Deliberately narrow rather than a general `updateUser`: this base promotes to
 * Admin and deactivates by hand on purpose (see lib/session.js), so a
 * general-purpose user mutator would be a write path for decisions that are
 * meant to stay off the app's own surface.
 */
export async function addAssignedJob(userRecordId, jobRecordId) {
    const record = await base(TABLES.USERS).find(userRecordId);
    const current = record.get("Assigned Jobs") || [];
    if (current.includes(jobRecordId)) return { id: record.id, changed: false };

    const updated = await base(TABLES.USERS).update(userRecordId, {
        "Assigned Jobs": [...current, jobRecordId],
    });
    return { id: updated.id, changed: true };
}
