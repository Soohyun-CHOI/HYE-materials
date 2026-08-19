// Creates a reusable Job -> Line, and Vendor -> Address fixture set for
// live product demos (PR -> sign -> PO -> President sign -> Invoice).
//
// IMPORTABLE AS WELL AS RUNNABLE, and the import is what makes the big seed
// self-sufficient. `seed_full_demo.mjs` needs exactly this Job, Line and Vendor and
// used to state that as a prerequisite in its header -- which held only as long as
// somebody read it. Restating the bootstrap over there would be two implementations
// of one thing; calling `ensureDemoFixtures()` is one. Running this file directly
// behaves exactly as before.
// Import-not-sync, same convention as scripts/import/import_jobs.py: skips
// whatever already exists (checked by Job Code / Vendor Name) rather than
// recreating or updating it, so this is safe to re-run before every demo
// without piling up duplicates.
//
// Kept in the repo intentionally (unlike scripts/tests/*, this fixture set
// is meant to persist in Airtable, not be created-then-deleted).
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/demo/seed_demo_fixtures.mjs
//
// Why the extra flags: lib/**/*.js import siblings without file extensions
// (fine under Next.js's bundler, not resolvable by plain Node ESM) — see
// scripts/esm-ext-loader.mjs.

import { pathToFileURL } from "node:url";
import { createAddress } from "../../lib/airtable/addresses.js";
import { createJob, getJobByCode } from "../../lib/airtable/jobs.js";
import { createLine } from "../../lib/airtable/lines.js";
import { createVendor, getVendorByName } from "../../lib/airtable/vendors.js";
import { addAssignedJob, createUser, getUserByEmail } from "../../lib/airtable/users.js";

// One account plays every Requester/Signer/President role during a live demo,
// which is a convenience rather than a constraint — the clause here used to say
// only one account could log in at all, because Resend was sandboxed, and that
// stopped being true when the domain was verified. This script just needs it
// once, as the demo Job's PIC/Manager. Override via env var if a different
// account should own the demo Job.
//
// It must ALREADY EXIST: a real person's account is not this script's to
// invent, so a missing one throws below rather than being created. The fixture
// account further down is the deliberate exception, and says why.
const DEMO_PIC_EMAIL = process.env.DEMO_PIC_EMAIL || "soohyun.c@hanyangengusa.com";

const JOB_CODE = "26-DEMO-01"; // deliberately off the real "##-USA-@@" pattern, so it's never confused with a real Job
const JOB_NAME = "Round Rock Compressor Station";
const BUSINESS_UNIT = "HT";
const LINE_NAME = "Unit 2 Piping";
const VENDOR_NAME = "Lone Star Pipe & Supply";

// THE SECOND PERMANENT FIXTURE ACCOUNT (#205), beside
// authz-fixture@hanyangengusa.com rather than replacing it. That one is
// non-Admin with an EMPTY Assigned Jobs, so it fails every role gate and every
// row gate at once — which is its whole value, and why CLAUDE.md forbids giving
// it Jobs. This one is the other half: non-Admin, Active, and inside one Job's
// scope, so it can answer "does a row-scoped surface admit and render" where the
// first can only answer "does a gate refuse".
//
// THE SEED CREATES IT, unlike DEMO_PIC_EMAIL above, and the difference is whose
// address it is. The PIC is a real person's account, which this script must
// never invent — so it throws and tells you to sign in. This one is synthetic
// and belongs to the fixture set, so a clean seed has to produce it or the pair
// is incomplete at the moment somebody reaches for it.
const SCOPED_FIXTURE_EMAIL = "scoped-fixture@hanyangengusa.com";

const JOB_DELIVERY_ADDRESS = {
    addressLabel: "Round Rock Compressor Station - Site",
    line1: "4820 Freight Yard Rd",
    city: "Round Rock",
    state: "TX",
    zipCode: "78664",
    country: "USA",
};

const VENDOR_ADDRESS = {
    addressLabel: "Lone Star Pipe & Supply - Main",
    line1: "910 Industrial Pkwy, Ste 200",
    city: "Round Rock",
    state: "TX",
    zipCode: "78681",
    country: "USA",
};

export async function ensureDemoFixtures() {
    const user = await getUserByEmail(DEMO_PIC_EMAIL);
    if (!user) {
        throw new Error(
            `No User found for ${DEMO_PIC_EMAIL} -- set DEMO_PIC_EMAIL, or make sure that account has signed in at least once already.`
        );
    }
    console.log(`Using ${user.userName} (${DEMO_PIC_EMAIL}) as the demo Job's PIC/Manager.\n`);

    // Job + Line: skipped as one unit if the Job Code already exists.
    let jobRecordId;
    const existingJob = await getJobByCode(JOB_CODE);
    if (existingJob) {
        jobRecordId = existingJob.id;
        console.log(`[SKIP] Job ${JOB_CODE} already exists (${existingJob.id}).`);
    } else {
        const deliveryAddress = await createAddress(JOB_DELIVERY_ADDRESS);
        console.log(`[CREATE] Address "${deliveryAddress.addressLabel}" (${deliveryAddress.id})`);

        const job = await createJob({
            jobCode: JOB_CODE,
            jobName: JOB_NAME,
            businessUnit: BUSINESS_UNIT,
            picUserId: user.id,
            managerUserId: user.id,
            deliveryAddressId: deliveryAddress.id,
        });
        console.log(`[CREATE] Job ${job.jobCode} (${job.id})`);

        const line = await createLine({ jobRecordId: job.id, lineName: LINE_NAME });
        console.log(`[CREATE] Line "${line.lineLabel}" (${line.id})`);
        jobRecordId = job.id;
    }

    // Vendor: independent skip check, so a prior partial run (e.g. Job
    // succeeded, Vendor step failed) doesn't get stuck skipping forever.
    const existingVendor = await getVendorByName(VENDOR_NAME);
    if (existingVendor) {
        console.log(`[SKIP] Vendor "${VENDOR_NAME}" already exists (${existingVendor.id}).`);
    } else {
        const vendorAddress = await createAddress(VENDOR_ADDRESS);
        console.log(`[CREATE] Address "${vendorAddress.addressLabel}" (${vendorAddress.id})`);

        const vendor = await createVendor({
            vendorName: VENDOR_NAME,
            picName: "Alex Rivera",
            picPhone: "512-555-0148",
            picEmail: "alex.rivera@demovendorco.example",
            addressId: vendorAddress.id,
        });
        console.log(`[CREATE] Vendor "${vendor.vendorName}" (${vendor.id})`);
    }

    // The scoped fixture account. Independent skip checks again, because the
    // record and the assignment are two facts: a run that created the user and
    // failed before assigning must be able to finish on the next run.
    let scoped = await getUserByEmail(SCOPED_FIXTURE_EMAIL);
    if (scoped) {
        console.log(`[SKIP] User ${SCOPED_FIXTURE_EMAIL} already exists (${scoped.id}).`);
    } else {
        // createUser is the app's own path — the single function verifyMagicLink
        // calls on a first sign-in, and the only thing that writes Role, Is Admin
        // and Status. So this record is the one a real first-time signer gets
        // rather than something assembled by hand in Airtable, and the userName
        // is derived exactly as lib/auth.js derives it, for the same reason.
        scoped = await createUser({
            userName: SCOPED_FIXTURE_EMAIL.split("@")[0],
            email: SCOPED_FIXTURE_EMAIL,
        });
        console.log(`[CREATE] User ${SCOPED_FIXTURE_EMAIL} (${scoped.id}) - Employee, non-Admin, Active`);
    }

    const assignment = await addAssignedJob(scoped.id, jobRecordId);
    console.log(
        assignment.changed
            ? `[CREATE] Assigned ${JOB_CODE} to ${SCOPED_FIXTURE_EMAIL}`
            : `[SKIP] ${SCOPED_FIXTURE_EMAIL} is already assigned to ${JOB_CODE}.`
    );

    console.log("\nDemo fixtures ready:");
    console.log(`  Job "${JOB_CODE}" / Line "${LINE_NAME}"`);
    console.log(`  Vendor "${VENDOR_NAME}"`);
    console.log("  Fixture accounts:");
    console.log("    authz-fixture@hanyangengusa.com  - no Jobs, refused everywhere");
    console.log(`    ${SCOPED_FIXTURE_EMAIL} - assigned ${JOB_CODE}, admitted by row scope`);

    return { jobRecordId, jobCode: JOB_CODE, lineName: LINE_NAME, vendorName: VENDOR_NAME };
}

// Run only when this file IS the entry point, so an importer pays nothing. Compared
// as a file URL rather than a path because `process.argv[1]` is a Windows path here
// and `import.meta.url` is not.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    ensureDemoFixtures().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
