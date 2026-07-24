// Ad hoc verification for issue #30 — the Line creation form now submits a
// Job *record id* from a dropdown of existing Jobs (was free-text Job Code).
// This checks the SERVER-SIDE re-validation still rejects a Job that doesn't
// exist (issue #29's guarantee, now keyed on the record id) and that a valid
// pick still creates a Line — independent of the UI, which the browser can't
// be scripted here to drive.
//
// createLineAction can't be called directly (requireAdmin needs a live
// session, redirect() throws outside the render pipeline), so this mirrors
// its job-resolution guard VERBATIM and calls the same lib functions. The
// requireAdmin gate itself is unchanged in the action (still the first thing
// it does) — verified by inspection, not here.
//
// From app/admin/lines/new/actions.js createLineAction, mirrored 1:1:
//     const jobId = formData.get("jobId");
//     let job = null;
//     try { job = jobId ? await getJobByRecordId(jobId) : null; } catch { job = null; }
//     if (!job) return { error: "That Job doesn't exist. Pick one from the list." };
//     const { lineLabel } = await createLine({ jobRecordId: job.id, lineName });
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-line-job-dropdown-30.mjs
//
// Creates one throwaway Line for the happy path and deletes it afterward.

import { getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { createLine } from "../../lib/airtable/lines.js";
import { base, TABLES } from "../../lib/airtable/client.js";

// Verbatim mirror of the action's job-resolution guard.
async function resolveJobGuard(jobId) {
    let job = null;
    try {
        job = jobId ? await getJobByRecordId(jobId) : null;
    } catch {
        job = null;
    }
    if (!job) return { error: "That Job doesn't exist. Pick one from the list." };
    return { job };
}

let createdLineId = null;

async function run() {
    const jobs = await getAllJobs();
    if (jobs.length === 0) throw new Error("No Jobs in the base to test against.");
    const real = jobs[0];
    console.log(`Real Job used: ${real.jobCode} — ${real.jobName} [${real.id}]`);
    console.log("");

    const cases = [
        { n: 1, desc: "Valid pick (existing Job record id)", jobId: real.id, expect: "allow" },
        { n: 2, desc: "Forged: well-formed but nonexistent id", jobId: "rec00000000000000", expect: "reject" },
        { n: 3, desc: "Forged: malformed id", jobId: "not-a-record-id", expect: "reject" },
        { n: 4, desc: "Empty jobId (nothing selected / stripped)", jobId: "", expect: "reject" },
    ];

    let allPass = true;
    for (const c of cases) {
        const result = await resolveJobGuard(c.jobId);
        const rejected = "error" in result;
        const gateOk = c.expect === "reject" ? rejected : !rejected;
        if (!gateOk) allPass = false;
        const outcome = rejected
            ? `REJECTED — { error: "${result.error}" }`
            : `RESOLVED — job ${result.job.jobCode} [${result.job.id}]`;
        console.log(`Case ${c.n}: ${c.desc}`);
        console.log(`   jobId:  ${JSON.stringify(c.jobId)}`);
        console.log(`   result: ${outcome}`);
        console.log(`   => ${gateOk ? "PASS" : "FAIL"}`);
        console.log("");
    }

    // Happy path end-to-end: a valid pick actually creates a Line.
    console.log("Case 5: Valid pick creates a Line (end-to-end)");
    const { id, lineLabel } = await createLine({
        jobRecordId: real.id,
        lineName: "__verify-30-delete-me",
    });
    createdLineId = id;
    const created = Boolean(id && lineLabel);
    if (!created) allPass = false;
    console.log(`   created: ${created ? `Line "${lineLabel}" [${id}]` : "FAILED"}`);
    console.log(`   => ${created ? "PASS" : "FAIL"}`);
    console.log("");

    console.log("=".repeat(56));
    console.log(allPass ? "ALL CASES PASS" : "SOME CASES FAILED");
}

try {
    await run();
} finally {
    if (createdLineId) {
        try {
            await base(TABLES.LINES).destroy(createdLineId);
            console.log(`cleaned up test Line (${createdLineId})`);
        } catch (err) {
            console.error(`FAILED to clean up test Line (${createdLineId}) — delete it manually:`, err.message);
        }
    }
}
