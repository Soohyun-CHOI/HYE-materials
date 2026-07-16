// Creates a reusable Job -> Line, and Vendor -> Address fixture set for
// live product demos (PR -> sign -> PO -> President sign -> Invoice).
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

import { createAddress } from "../../lib/airtable/addresses.js";
import { createJob, getJobByCode } from "../../lib/airtable/jobs.js";
import { createLine } from "../../lib/airtable/lines.js";
import { createVendor, getVendorByName } from "../../lib/airtable/vendors.js";
import { getUserByEmail } from "../../lib/airtable/users.js";

// Only one account can actually log in (magic link, sandboxed Resend) —
// see CLAUDE.md's auth section — so that same account plays every
// Requester/Signer/President role during a live demo. This script just
// needs it once, as the demo Job's PIC/Manager. Override via env var if a
// different account should own the demo Job.
const DEMO_PIC_EMAIL = process.env.DEMO_PIC_EMAIL || "soohyun.c@hanyangengusa.com";

const JOB_CODE = "26-DEMO-01"; // deliberately off the real "##-USA-@@" pattern, so it's never confused with a real Job
const JOB_NAME = "Demo Fabrication Project";
const BUSINESS_UNIT = "HT";
const LINE_NAME = "Demo Line A";
const VENDOR_NAME = "Demo Vendor Co.";

const JOB_DELIVERY_ADDRESS = {
    addressLabel: "Demo Site - Delivery",
    line1: "4820 Freight Yard Rd",
    city: "Round Rock",
    state: "TX",
    zipCode: "78664",
    country: "USA",
};

const VENDOR_ADDRESS = {
    addressLabel: "Demo Vendor Co. - Main",
    line1: "910 Industrial Pkwy, Ste 200",
    city: "Round Rock",
    state: "TX",
    zipCode: "78681",
    country: "USA",
};

async function main() {
    const user = await getUserByEmail(DEMO_PIC_EMAIL);
    if (!user) {
        throw new Error(
            `No User found for ${DEMO_PIC_EMAIL} -- set DEMO_PIC_EMAIL, or make sure that account has signed in at least once already.`
        );
    }
    console.log(`Using ${user.userName} (${DEMO_PIC_EMAIL}) as the demo Job's PIC/Manager.\n`);

    // Job + Line: skipped as one unit if the Job Code already exists.
    const existingJob = await getJobByCode(JOB_CODE);
    if (existingJob) {
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

    console.log("\nDemo fixtures ready:");
    console.log(`  Job "${JOB_CODE}" / Line "${LINE_NAME}"`);
    console.log(`  Vendor "${VENDOR_NAME}"`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
