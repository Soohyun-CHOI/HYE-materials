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

    const record = records[0];
    return {
        id: record.id,
        userName: record.get("User Name"),
        email: record.get("Email"),
        role: record.get("Role"),
        isAdmin: record.get("Is Admin") || false,
        status: record.get("Status"),
    };
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