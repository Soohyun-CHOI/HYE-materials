// canViewPR — the row-visibility rule the PR list, the PR detail page and the
// PO detail page share (#119, #132, #143).
//
// Extracted to the offline tier by #152; widened by #143 with the two chain
// clauses and the Draft clause. It was always a pure-function check, and
// lib/prVisibility.js imports nothing, so the whole rule is pinnable here.
//
// Worth pinning tightly because the failure directions are asymmetric. Too
// permissive leaks someone else's PR — a Draft especially, which nobody but its
// author should see. Too restrictive cuts the signing chain: a signer or
// correction recipient who cannot open the PR cannot take their turn, and the
// chain stops with no error to explain it.

import { canViewPR } from "../../../lib/prVisibility.js";
import { isMain, standalone } from "./_harness.mjs";

export const title = "Row visibility — canViewPR (#119/#132/#143)";

// Link-array ids are Airtable child record ids; the shapes below mirror what
// recordToUser / recordToPR now expose.
// Every user carries the two link arrays, because recordToUser always does —
// a fixture without them would be testing a shape production cannot produce,
// and canViewPR now throws on it (see the tripwire cases at the bottom).
const asUser = (over) => ({ signerRowIds: [], correctionRowIds: [], ...over });
const president = asUser({ id: "recPres", role: "President", isAdmin: false, assignedJobs: [] });
const admin = asUser({ id: "recAdmin", role: "Employee", isAdmin: true, assignedJobs: [] });
const employee = asUser({ id: "recEmp", role: "Employee", isAdmin: false, assignedJobs: ["recJobA"] });
const outsider = asUser({ id: "recOut", role: "Employee", isAdmin: false, assignedJobs: ["recJobB"] });

const submitted = (over = {}) => ({
    status: "In Review",
    requester: ["recOther"],
    job: ["recJobZ"],
    signerRowIds: [],
    correctionRowIds: [],
    ...over,
});

export function run({ check }) {
    // --- the pre-#143 rule, unchanged -------------------------------------
    check("President sees an unrelated PR", canViewPR(president, submitted()), true);
    check("Admin sees an unrelated PR", canViewPR(admin, submitted()), true);
    check(
        "Requester sees a PR they raised",
        canViewPR(employee, submitted({ requester: ["recEmp"] })),
        true
    );
    check(
        "Employee sees a PR on their assigned Job",
        canViewPR(employee, submitted({ job: ["recJobA"] })),
        true
    );
    check("Employee DENIED an unrelated PR", canViewPR(employee, submitted()), false);
    check("null user denied", canViewPR(null, submitted()), false);
    check("null pr denied", canViewPR(employee, null), false);
    check(
        "PR with no requester or job denied",
        canViewPR(employee, submitted({ requester: undefined, job: undefined })),
        false
    );
    check(
        "employee with no assigned jobs still sees their own",
        canViewPR(
            { id: "recEmp", role: "Employee", isAdmin: false },
            submitted({ requester: ["recEmp"] })
        ),
        true
    );

    // --- #143 clause 5: a signer on this PR's chain ------------------------
    // The case that made this necessary: a signer with no claim on the Job.
    const prWithSigners = submitted({ signerRowIds: ["recSig1", "recSig2"] });
    check(
        "signer off the PR's Job can open it",
        canViewPR({ ...outsider, signerRowIds: ["recSig2"] }, prWithSigners),
        true
    );
    check(
        "a signer on a DIFFERENT PR is not admitted here",
        canViewPR({ ...outsider, signerRowIds: ["recSigOther"] }, prWithSigners),
        false
    );
    check(
        "no overlap at all is refused",
        canViewPR({ ...outsider, signerRowIds: [] }, prWithSigners),
        false
    );
    check(
        "a PR with no signer rows admits nobody through clause 5",
        canViewPR({ ...outsider, signerRowIds: ["recSig1"] }, submitted({ signerRowIds: [] })),
        false
    );

    // --- #143 clause 6: recipient of a correction request on this PR -------
    const prWithCorrections = submitted({ correctionRowIds: ["recCR1"] });
    check(
        "correction recipient off the PR's Job can open it",
        canViewPR({ ...outsider, correctionRowIds: ["recCR1"] }, prWithCorrections),
        true
    );
    check(
        "recipient of a correction on a different PR is refused",
        canViewPR({ ...outsider, correctionRowIds: ["recCROther"] }, prWithCorrections),
        false
    );

    // Status-agnostic by design: nothing in the rule reads a child's Status,
    // so a resolved correction and a signer who already acted keep access.
    // These two assert the *shape* that makes that true — access depends only
    // on membership, so no status value can change the answer.
    check(
        "membership alone decides — a signer keeps access whatever their row says",
        canViewPR({ ...outsider, signerRowIds: ["recSig1"] }, prWithSigners),
        true
    );
    check(
        "membership alone decides — a correction recipient keeps access once resolved",
        canViewPR({ ...outsider, correctionRowIds: ["recCR1"] }, prWithCorrections),
        true
    );

    // --- #143 clause 1: Draft is the author's alone ------------------------
    const draft = (over = {}) => submitted({ status: "Draft", ...over });
    check(
        "Requester sees their own Draft",
        canViewPR(employee, draft({ requester: ["recEmp"] })),
        true
    );
    check(
        "a colleague on the same Job does NOT see someone's Draft",
        canViewPR(employee, draft({ job: ["recJobA"] })),
        false
    );
    check("Admin does NOT see someone else's Draft", canViewPR(admin, draft()), false);
    check("President does NOT see someone else's Draft", canViewPR(president, draft()), false);
    check(
        "an assigned signer does NOT see an unsubmitted Draft",
        canViewPR({ ...outsider, signerRowIds: ["recSig1"] }, draft({ signerRowIds: ["recSig1"] })),
        false
    );

    // --- Withdrawn takes no special path ----------------------------------
    // #122 keeps a withdrawn PR on record and in the list, so it is judged
    // exactly like any other submitted PR.
    check(
        "Withdrawn PR still visible to its Requester",
        canViewPR(employee, submitted({ status: "Withdrawn", requester: ["recEmp"] })),
        true
    );
    check(
        "Withdrawn PR still visible to its signer",
        canViewPR(
            { ...outsider, signerRowIds: ["recSig1"] },
            submitted({ status: "Withdrawn", signerRowIds: ["recSig1"] })
        ),
        true
    );
    check(
        "Withdrawn PR still refused to an unrelated Employee",
        canViewPR(employee, submitted({ status: "Withdrawn" })),
        false
    );

    // --- shape robustness --------------------------------------------------
    check(
        "an argument-shaped user with no claims refuses",
        canViewPR({ id: "x", role: "Employee", isAdmin: false, signerRowIds: [], correctionRowIds: [] }, submitted()),
        false
    );

    // A missing link array is a programming error, not a denial. Refusing
    // would look safe and would in fact be the stalled chain clauses 5 and 6
    // exist to prevent — a signer locked out of their own PR, with no error to
    // trace. Each of the four fields is checked on its own so the message
    // names the one that is absent.
    const throwsFor = (label, u, p) => {
        let threw = false;
        try {
            canViewPR(u, p);
        } catch {
            threw = true;
        }
        check(`throws rather than refusing: ${label}`, threw, true);
    };
    throwsFor("user.signerRowIds", { ...outsider, signerRowIds: undefined }, submitted());
    throwsFor("user.correctionRowIds", { ...outsider, correctionRowIds: undefined }, submitted());
    throwsFor("pr.signerRowIds", outsider, submitted({ signerRowIds: undefined }));
    throwsFor("pr.correctionRowIds", outsider, submitted({ correctionRowIds: undefined }));

    // But only when the answer actually depends on them: a decision already
    // reached by clauses 1-4 never needed the arrays, so those paths must not
    // throw on an object that lacks them.
    const bare = { status: "In Review", requester: ["recEmp"], job: ["recJobZ"] };
    check("a clause-3 match does not need the arrays", canViewPR(employee, bare), true);
    check(
        "a clause-2 match does not need the arrays",
        canViewPR(admin, { status: "In Review", requester: ["recOther"], job: ["recJobZ"] }),
        true
    );
    check(
        "a Draft decision does not need the arrays",
        canViewPR(employee, { status: "Draft", requester: ["recEmp"] }),
        true
    );
}

if (isMain(import.meta.url)) standalone(title, run);
