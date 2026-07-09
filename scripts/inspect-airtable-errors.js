// TEMPORARY — NOT for commit. Delete after use.
// Dumps the full shape of Airtable client errors for two cases:
//   1. .find() on a valid-format but nonexistent record ID
//   2. .find() with a broken API key (simulates a general API failure)
// so we know exactly what properties to check to distinguish them.

import { base, TABLES } from "../lib/airtable/client.js";

async function main() {
    console.log("=== Case 1: nonexistent record ID ===");
    try {
        await base(TABLES.USERS).find("recDOESNOTEXIST12");
    } catch (err) {
        console.log("error instanceof Error:", err instanceof Error);
        console.log("error.name:", err.name);
        console.log("error.message:", err.message);
        console.log("error.error:", err.error);
        console.log("error.statusCode:", err.statusCode);
        console.log("Object.keys(err):", Object.keys(err));
        console.log("full JSON:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
    }
}

main();
