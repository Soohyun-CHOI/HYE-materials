// A sign-in link for an account with no mailbox.
//
// WHY IT EXISTS. Two of the three accounts the demo needs are synthetic —
// `scoped-fixture@hanyangengusa.com` and `authz-fixture@hanyangengusa.com` — so no
// magic-link email reaches anybody, and the demo's last act is exactly the one that
// needs to be signed in as them. This mints the token the email would have carried
// and prints the URL it would have linked to.
//
// IT DOES NOT SIGN ANYONE IN, AND THAT IS THE POINT RATHER THAN A LIMITATION.
// `/login/confirm?token=…` reads the token's state and offers a button; only
// `POST /api/auth/verify` spends it (#203). So this prints a link a human opens and
// confirms, which is the same two steps a real recipient takes — and it means the
// session lands in whichever browser profile opened it, which is what a
// side-by-side permission comparison needs.
//
// FIFTEEN MINUTES, from `lib/authTokenState.js:TOKEN_TTL_MINUTES`, and single-use.
// Mint it when you are about to use it, not the night before.
//
// Run from the repo root:
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs \
//     scripts/demo/mint_session.mjs scoped-fixture@hanyangengusa.com
//   … --base=http://localhost:3000     where the link should point (default this)

import { createAuthToken } from "../../lib/airtable/authTokens.js";
import { getUserByEmail } from "../../lib/airtable/users.js";
import { TOKEN_TTL_MINUTES } from "../../lib/authTokenState.js";

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--"));
const baseUrl = (args.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);

if (!email) {
    console.error("usage: mint_session.mjs <email> [--base=http://localhost:3000]");
    process.exit(1);
}

// A REAL USERS ROW IS REQUIRED, and a missing one is reported rather than created.
// A Users record appears as a side effect of a first magic-link sign-in and in no
// other way, so inventing one here would put an account on the base by a path the
// app does not have — and the two permanent fixture accounts already exist.
const user = await getUserByEmail(email);
if (!user) {
    console.error(`No Users row for ${email}.`);
    console.error("The fixture accounts are created by scripts/demo/seed_demo_fixtures.mjs;");
    console.error("a real person's account appears when they sign in for the first time.");
    process.exit(1);
}

const { token, expiresAt } = await createAuthToken(email);

console.log("");
console.log(`  ${user.userName} <${email}>`);
console.log(`  ${user.role}${user.isAdmin ? ", Admin" : ""} · ${user.status} · ${(user.assignedJobs || []).length} job(s) assigned`);
console.log("");
console.log(`  ${baseUrl}/login/confirm?token=${token}`);
console.log("");
console.log(`  Open it, press Confirm sign-in. Expires in ${TOKEN_TTL_MINUTES} minutes, single use.`);
console.log("");
