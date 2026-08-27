// Ad hoc verification for issue #30 — the Line creation form now submits a
// Job *record id* from a dropdown of existing Jobs (was free-text Job Code).
// This checks the SERVER-SIDE re-validation still rejects a Job that doesn't
// exist (issue #29's guarantee, now keyed on the record id) and that a valid
// pick still creates a Line — independent of the UI, which the browser can't
// be scripted here to drive.
//
// createDisciplineAction can't be called directly (requireAdmin needs a live
// session, redirect() throws outside the render pipeline), so this mirrors
// its job-resolution guard VERBATIM and calls the same lib functions. The
// requireAdmin gate itself is unchanged in the action (still the first thing
// it does) — verified by inspection, not here.
//
// From app/admin/disciplines/new/actions.js createDisciplineAction, mirrored 1:1:
//     const jobId = formData.get("jobId");
//     let job = null;
//     try { job = jobId ? await getJobByRecordId(jobId) : null; } catch { job = null; }
//     if (!job) return { error: "That Job doesn't exist. Pick one from the list." };
//     const { disciplineLabel } = await createDiscipline({ jobRecordId: job.id, disciplineName });
//
// Run with (from the repo root):
//   node --env-file=.env.local --experimental-loader ./scripts/esm-ext-loader.mjs scripts/tests/verify-line-job-dropdown-30.mjs
//
// Creates one throwaway Line for the happy path and deletes it afterward.

import { getAllJobs, getJobByRecordId } from "../../lib/airtable/jobs.js";
import { createDiscipline } from "../../lib/airtable/disciplines.js";
import { createFixtures } from "./_fixtures.mjs";
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

// Fixtures (#171) — see scripts/tests/_fixtures.mjs. One bucket, one row, no
// children. Its cleanup already survived a throw and already REPORTED a failed
// delete; what it could not do is let that failure reach a verdict, because
// `process.exitCode` is set inside run() before the finally ever executes. Same
// shape as verify-withdraw-revalidation-122.mjs, and neither measured residue.
const fixtures = createFixtures({
    tag: "V30",
    buckets: [
        // Tagged, under the rule's second clause (#171): this script calls
        // createDiscipline, so the tag goes in the name it was already choosing. It was
        // the fixed "__verify-30-delete-me", the shape a run tag must not have.
        { name: "disciplines", table: TABLES.DISCIPLINES, label: "Discipline", tagField: "Discipline Name" },
    ],
});
const TAG = fixtures.TAG;

let createdDisciplineId = null;
let complete = false;

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
    const { id, disciplineLabel } = await createDiscipline({
        jobRecordId: real.id,
        disciplineName: `${TAG} delete me`,
    });
    createdDisciplineId = fixtures.track("disciplines", id);
    const created = Boolean(id && disciplineLabel);
    if (!created) allPass = false;
    console.log(`   created: ${created ? `Line "${disciplineLabel}" [${id}]` : "FAILED"}`);
    console.log(`   => ${created ? "PASS" : "FAIL"}`);
    console.log("");

    console.log("=".repeat(56));
    // Exit code added by #152: printing the verdict and returning 0 either way
    // made a failure indistinguishable from a pass to anything but a reader.
    // Set rather than exited on, so the cleanup in the finally below still runs.
    console.log(allPass ? "ALL CASES PASS" : "SOME CASES FAILED");
    process.exitCode = allPass ? 0 : 1;
}

try {
    await run();
    complete = true;
} catch (err) {
    // A `catch` where there was none: the verdict below has to be reachable, and
    // `process.exitCode` is what this file uses so cleanup still runs (the #122
    // precedent) rather than `process.exit`.
    console.error(`\n  ABORTED — ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
}

console.log("\nCleaning up fixtures:");
const teardown = await fixtures.teardown({ complete });
console.log(fixtures.describe(teardown));
// TWO VERDICTS (#171): the cases' own pass/fail is printed inside run(), a leak
// is about this run's effect on a shared base.
if (teardown.leaked.length > 0) process.exitCode = 1;
