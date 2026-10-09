// The job an `Asset Log` row is filed against (#363).
//
// WHAT THIS FILE IS FOR, AND WHY IT IS ITS OWN. `assignedJobsFor` and the
// picker's words were pinned inside `offline/asset-registration.mjs` while
// they lived in `lib/assetRegistration.js`. They are three write paths' rule now
// — registration, the two scan transitions, and the retirement — so a check
// named for one screen would be asserting about a module none of the other two
// would think to look in. The assertions themselves are #338's, moved rather
// than rewritten.
//
// IT PINS THE ONE PLACE THIS AXIS DELIBERATELY DISAGREES WITH ITS NEIGHBOUR.
// `assignedJobsFor` is not `lib/deliveryAccess.js:accessibleJobs`: that
// predicate admits President and Admin to every job, and this one admits nobody
// who is not assigned. An Admin on no job can record a delivery and cannot
// record an asset event, which reads like a bug until you know that
// `Asset Log."Job"` is the job the event HAPPENED on and the assets track does not
// pass through the office. The disagreement is held as an assertion, so a later
// pass that "fixes" one of them fails here rather than silently widening three
// write paths.
//
// WHAT IT CANNOT SEE. Whether a job list handed in is the whole table, which is
// the caller's business; and rendering, which is this tier's standing limit —
// that a picker with one assignment opens with it already chosen is checked in a
// browser.
//
// EXIT CODES, per docs/notes/verification.md: 0 all clear, 1 something failed.

import { readFileSync } from "node:fs";
import { canAccessJobDeliveries } from "../../../lib/deliveryAccess.js";
import { ASSET_JOB_COPY, assignedJobsFor, onlyJob } from "../../../lib/assetJob.js";
import { ASSET_REGISTRATION_COPY } from "../../../lib/assetRegistration.js";
import { ASSET_TRANSITION_COPY } from "../../../lib/assetTransition.js";
import { listJsFiles, parseFile, parseSource, repoPath, toPosix, walk, REPO_ROOT } from "./_ast.mjs";
import { isMain, standalone } from "./_harness.mjs";

/**
 * The files on this axis that may spell "one assignment" — `onlyJob` itself, and nothing
 * else (#458). A screen counting a job list for itself is the second copy of the rule.
 */
const SPELLS_ONE_JOB = /\bjobs\.length\s*===\s*1\b/;

/**
 * The source text a copy constant's `key` is assigned, or null.
 *
 * WHY THIS IS READ OFF THE SOURCE AND NOT COMPARED BY VALUE, MEASURED RATHER
 * THAN REASONED. The first version of section 3 asserted
 * `ASSET_REGISTRATION_COPY.jobUnchosen === ASSET_JOB_COPY.unchosen` and called it
 * an identity check. It is not one: two equal string literals in JavaScript are
 * the same primitive, so re-spelling `"Pick a job"` in the screen's own constant
 * passes — measured by mutation, 24 of 24 green. That is the trap #351, #353,
 * #352 and #362 each fell into once, one level along: the assertion was written
 * in terms of the value it was checking. What cannot be faked is the EXPRESSION,
 * so the property's own source is what gets compared.
 */
function propertySource(parsed, key) {
    let found = null;
    walk(parsed.ast, (n) => {
        if (n.type !== "Property" || n.key?.name !== key || n.shorthand) return;
        found = parsed.source.slice(n.value.start, n.value.end);
    });
    return found;
}

export const title = "The job an Asset Log row is filed against (#363)";

const JOBS = [
    { id: "job1", jobCode: "26-DEMO-01" },
    { id: "job2", jobCode: "26-DEMO-02" },
];

export function run({ check, assert, log }) {
    const onOne = { assignedJobs: ["job2"], isAdmin: false, role: "Employee" };
    const onNone = { assignedJobs: [], isAdmin: false, role: "Employee" };
    const adminOnNone = { assignedJobs: [], isAdmin: true, role: "Employee" };
    const presidentOnNone = { assignedJobs: [], isAdmin: false, role: "President" };

    // ── 1: whose jobs an actor may file against ────────────────────────────
    log("the job is the actor's own assignment, narrowed out of a loaded list:");
    check("one assignment yields one job", assignedJobsFor(onOne, JOBS).map((j) => j.id).join(), "job2");
    check("no assignment yields none", assignedJobsFor(onNone, JOBS).length, 0);
    check("a missing user yields none", assignedJobsFor(undefined, JOBS).length, 0);
    check("a user with no field at all yields none", assignedJobsFor({}, JOBS).length, 0);
    check("both assignments yield both", assignedJobsFor({ assignedJobs: ["job1", "job2"] }, JOBS).length, 2);
    check(
        "an assignment to a job that is not in the list yields none",
        assignedJobsFor({ assignedJobs: ["gone"] }, JOBS).length,
        0
    );
    check("and a missing job list yields none", assignedJobsFor(onOne, undefined).length, 0);
    // The list's own order survives, which is what makes the picker's order the
    // job list's rather than the assignment array's.
    check(
        "the loaded list's order is kept",
        assignedJobsFor({ assignedJobs: ["job2", "job1"] }, JOBS).map((j) => j.jobCode).join(),
        "26-DEMO-01,26-DEMO-02"
    );

    // ── 1b: one assignment, spelled once (#458) ────────────────────────────
    // "One assignment is used without asking" is three screens' reading — the
    // registration's choice starts on it, the transition's does, and a check-in
    // records on the press only then — so it is one function, held by value at the
    // edges, and nothing else on the axis counts a job list for itself.
    log("");
    log("one assignment is one job, and every other count is none:");
    check("one job is that job", onlyJob([JOBS[1]])?.id, "job2");
    check("two are none", onlyJob(JOBS), null);
    check("none are none", onlyJob([]), null);
    check("and a missing list is none", onlyJob(undefined), null);
    const assetsFiles = [...listJsFiles(repoPath("app/(assets)")), ...listJsFiles(repoPath("lib")).filter((abs) => /\/asset[A-Z]\w*\.js$/.test(toPosix(abs)))]
        .map((abs) => toPosix(abs).slice(toPosix(REPO_ROOT).length + 1))
        .sort();
    const spelling = assetsFiles.filter((rel) => SPELLS_ONE_JOB.test(readFileSync(repoPath(rel), "utf8")));
    check("  the axis's files were read, lib/assetJob.js among them", assetsFiles.length > 20 && assetsFiles.includes("lib/assetJob.js"), true);
    check("  and only lib/assetJob.js counts a job list for one", spelling.join(", "), "lib/assetJob.js");

    // ── 2: no office clause, and the disagreement is the assertion ─────────
    log("");
    log("and there is no office clause, which is where this axis parts from deliveries:");
    check("an Admin on no job gets no job here", assignedJobsFor(adminOnNone, JOBS).length, 0);
    check("a President on no job gets none either", assignedJobsFor(presidentOnNone, JOBS).length, 0);
    // THE DISAGREEMENT ITSELF, held rather than described. These two predicates
    // answer different questions and a later pass that aligned them would widen
    // three write paths with nothing failing.
    assert(
        "the delivery predicate admits an Admin on no job",
        canAccessJobDeliveries(adminOnNone, "job1") === true
    );
    assert(
        "  and this one does not, which is the whole reason there are two",
        assignedJobsFor(adminOnNone, JOBS).length === 0
    );

    // ── 3: the words, read by both screens rather than re-spelled ──────────
    // The design's verb since #456, `Choose` where it was `Pick` (0l), and a third
    // word for a picker left at its placeholder, which the registration dialog says
    // under the choice before anything is sent.
    log("");
    log("the picker's words, and both screens reading them:");
    check("the unchosen option", ASSET_JOB_COPY.unchosen, "Choose a job");
    check("the refusal for none chosen", ASSET_JOB_COPY.noneChosen, "Choose a job.");
    check("the not-your-job refusal", ASSET_JOB_COPY.notYours, "Choose a job you are assigned to.");
    check("three words and no more", Object.keys(ASSET_JOB_COPY).length, 3);
    // READ OFF THE SOURCE, for the reason `propertySource` records: comparing the
    // VALUES cannot tell a screen reading this constant from a screen spelling
    // the same words again, because two equal string literals are one primitive.
    // What is being held is that the copies cannot drift apart, and that is a
    // fact about the expression rather than about the string.
    for (const [what, file] of [
        ["registration dialog", "lib/assetRegistration.js"],
        ["asset page", "lib/assetTransition.js"],
    ]) {
        const parsed = parseFile(file);
        check(`the ${what} reads the unchosen option`, propertySource(parsed, "jobUnchosen"), "ASSET_JOB_COPY.unchosen");
        check(`  and the refusal`, propertySource(parsed, "jobNotYours"), "ASSET_JOB_COPY.notYours");
    }
    // The none-chosen refusal has one reader so far, the registration dialog; the
    // check-out answers a missing job with `notYours` (`readSubmission`).
    check(
        "the registration dialog reads the none-chosen refusal",
        propertySource(parseFile("lib/assetRegistration.js"), "jobNoneChosen"),
        "ASSET_JOB_COPY.noneChosen"
    );
    // The values agreeing is then a consequence rather than the claim, and it is
    // still worth one line: an import of the wrong key would read correctly above
    // and hand back the wrong word.
    check("so the words agree, registration", ASSET_REGISTRATION_COPY.jobUnchosen, ASSET_JOB_COPY.unchosen);
    check("  and the asset page", ASSET_TRANSITION_COPY.jobNotYours, ASSET_JOB_COPY.notYours);
    // `noJob` is deliberately NOT shared: each sentence names its own act.
    assert(
        "but the two no-job sentences are their screens' own",
        ASSET_REGISTRATION_COPY.noJob !== ASSET_TRANSITION_COPY.noJob
    );
    assert("  and neither is empty", Boolean(ASSET_REGISTRATION_COPY.noJob && ASSET_TRANSITION_COPY.noJob));

    // ── anti-vacuity ───────────────────────────────────────────────────────
    log("");
    log("anti-vacuity — this check is seen to be able to fail:");
    // Every equality above compares a filtered list against an expectation, and
    // a function returning its whole input would satisfy several of them. So the
    // filter is shown discarding something and keeping something on one input.
    const mixed = assignedJobsFor({ assignedJobs: ["job1", "gone"] }, JOBS);
    assert("the filter keeps what is assigned and drops what is not", mixed.length === 1 && mixed[0].id === "job1");
    // And the three-word count is shown to be a reading of the object rather than
    // a constant, by naming every key.
    assert(
        "the copy constant really holds those three keys",
        Object.keys(ASSET_JOB_COPY).sort().join() === "noneChosen,notYours,unchosen"
    );
    // AND THE SOURCE READER IS SHOWN TELLING A LITERAL FROM A REFERENCE, because
    // "it read `ASSET_JOB_COPY.unchosen`" and "it read nothing and the comparison
    // happened to hold" are one PASS otherwise. This is the mutation the loop in
    // section 3 exists for, run in-file.
    {
        const planted = parseSource(
            'const A = { jobUnchosen: "Choose a job", jobNotYours: ASSET_JOB_COPY.notYours };\n',
            "<planted-literal>"
        );
        check("  a re-spelled word reads as a literal", propertySource(planted, "jobUnchosen"), '"Choose a job"');
        check("  and a read one reads as the reference", propertySource(planted, "jobNotYours"), "ASSET_JOB_COPY.notYours");
    }
    // A key nothing assigns has to read as MISSING rather than as the expected
    // expression, or every assertion in the loop passes on a constant that
    // dropped the property.
    check("  and a key nothing assigns reads null", propertySource(parseSource("const A = { other: 1 };", "<planted>"), "jobUnchosen"), null);
    // The one-job scan is seen to catch a screen counting for itself, and to leave a
    // count of something else alone.
    assert("  a screen counting its jobs for one is seen", SPELLS_ONE_JOB.test("useState(jobs.length === 1 ? jobs[0].id : \"\")"));
    assert("  and a count of two, or of rows, is not", !SPELLS_ONE_JOB.test("jobs.length === 12 || rows.length === 1"));
}

if (isMain(import.meta.url)) await standalone(title, run);
