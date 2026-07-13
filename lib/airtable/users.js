import { base, TABLES } from "./client";

/**
 * Find a user by email (used at login).
 * Returns null if not found — callers decide what that means (e.g. "not signed up yet").
 */
export async function getUserByEmail(email) {
    const records = await base(TABLES.USERS)
        .select({
            filterByFormula: `LOWER({Email}) = LOWER("${email}")`,
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